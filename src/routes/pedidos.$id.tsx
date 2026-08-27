import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Trash2, Plus, Package, ExternalLink, Save, Ruler } from "lucide-react";
import { useStore, actions } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { semaforoPedido, flujoPedido, hitoLabel, cascadaMarcado, tapiceroNombre, FORMATOS_COLAB, TIPOS_COLAB, type Pedido, type Lead } from "@/lib/types";
import { formatCurrency, formatShortDate } from "@/lib/format";
import { displayNombreProducto, displayColeccionTela } from "@/lib/catalogo";
import { FichaTapiceroEquipo } from "@/components/FichaTapiceroEquipo";
import { telaToDraft, diffPedido, telasCambiadas, emptyTela, type TelaDraft } from "@/lib/pedido-form";
import { toast } from "sonner";

export const Route = createFileRoute("/pedidos/$id")({
  head: () => ({ meta: [{ title: "Pedido — TiroCRM" }] }),
  component: PedidoDetalle,
});

const SEM_COLOR = {
  verde: { bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-700", dot: "bg-emerald-500", label: "A tiempo" },
  ambar: { bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-700", dot: "bg-amber-500", label: "En riesgo" },
  rojo: { bg: "bg-rose-50", border: "border-rose-200", text: "text-rose-700", dot: "bg-rose-500", label: "Atrasado" },
} as const;

function PedidoDetalle() {
  const { id } = Route.useParams();
  const { pedidos } = useStore();
  const existe = pedidos.some((p) => p.id === id);
  if (!existe) {
    return (
      <div className="py-12 text-center">
        <p className="text-slate-500">Pedido no encontrado.</p>
        <Link to="/pedidos" className="mt-4 inline-block text-sm text-blue-600">Volver a pedidos</Link>
      </div>
    );
  }
  // key = id ⇒ el borrador se reinicia al cambiar de pedido.
  return <PedidoEditor key={id} pedidoId={id} />;
}

function PedidoEditor({ pedidoId }: { pedidoId: string }) {
  const { pedidos, leads, productos, pedidoTelas, tapiceros } = useStore();
  const { esEquipo } = useAuth();
  const navigate = useNavigate();

  const pedido = pedidos.find((p) => p.id === pedidoId);
  const lead = leads.find((l) => l.id === pedido?.leadId);
  const producto = productos.find((pr) => pr.id === pedido?.productoLeadId);
  const telasStore = useMemo(
    () => pedidoTelas.filter((t) => t.pedidoId === pedidoId).sort((a, b) => a.orden - b.orden),
    [pedidoTelas, pedidoId],
  );

  // ── Borrador (guardado explícito, punto 1) ──────────────────────────────
  const [draft, setDraft] = useState<Pedido>(() => pedido as Pedido);
  const [telasDraft, setTelasDraft] = useState<TelaDraft[]>(() => telasStore.map(telaToDraft));
  const [baseP, setBaseP] = useState<Pedido>(() => pedido as Pedido);
  const [baseT, setBaseT] = useState<TelaDraft[]>(() => telasStore.map(telaToDraft));
  const [saving, setSaving] = useState(false);

  const patch = useCallback((p: Partial<Pedido>) => setDraft((prev) => ({ ...prev, ...p })), []);

  const pedidoDirty = useMemo(
    () => Object.keys(diffPedido(baseP, draft)).length > 0 || draft.numero !== baseP.numero,
    [baseP, draft],
  );
  const telasDirty = useMemo(() => telasCambiadas(baseT, telasDraft), [baseT, telasDraft]);
  const dirty = pedidoDirty || telasDirty;

  // Refresca desde el store (cambios externos) SOLO cuando no hay cambios sin
  // guardar, para no pisar lo que el usuario está editando.
  useEffect(() => {
    if (dirty || !pedido) return;
    const freshT = telasStore.map(telaToDraft);
    if (JSON.stringify(pedido) !== JSON.stringify(baseP) || JSON.stringify(freshT) !== JSON.stringify(baseT)) {
      setBaseP(pedido); setDraft(pedido);
      setBaseT(freshT); setTelasDraft(freshT);
    }
  }, [pedido, telasStore, dirty, baseP, baseT]);

  // Aviso al cerrar/recargar la pestaña con cambios sin guardar.
  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);

  if (!pedido) return null; // borrado mientras se veía → el handler navega fuera

  const sem = semaforoPedido(draft, producto?.tipo ?? "");
  const c = SEM_COLOR[sem.estado];
  const hitos = flujoPedido(producto?.tipo ?? "");
  const tapiceroAsignado = tapiceros.find((t) => t.id === pedido.tapiceroId);
  const tapiceroDePaso = (stepKey: string) => {
    const selloId = pedido.pasosTapicero?.[stepKey];
    return selloId ? tapiceros.find((x) => x.id === selloId) : tapiceroAsignado;
  };
  const nombreDePaso = (stepKey: string): string => tapiceroNombre(tapiceroDePaso(stepKey));
  // Asignación de tapicero (principal y por paso): acción INMEDIATA (sella los
  // pasos ya hechos). No pasa por el borrador.
  const setPasoTapicero = (stepKey: string, tapiceroId: string) => {
    const next = { ...(pedido.pasosTapicero || {}) };
    if (tapiceroId) next[stepKey] = tapiceroId; else delete next[stepKey];
    void actions.updatePedido(pedido.id, { pasosTapicero: next });
  };
  const tapicerosSeleccionables = tapiceros.filter((t) => t.activo || t.id === pedido.tapiceroId);

  function guardarNumero(v: string) {
    const n = parseInt(v, 10);
    if (Number.isFinite(n) && n > 0) setDraft((prev) => ({ ...prev, numero: n }));
  }

  async function guardar() {
    if (saving) return;
    setSaving(true);
    try {
      // 1) Número (validación de duplicado). No se permite dejarlo vacío desde aquí.
      if (draft.numero !== baseP.numero && draft.numero != null) {
        const ok = await actions.actualizarNumeroPedido(pedidoId, draft.numero);
        if (!ok) { setDraft((prev) => ({ ...prev, numero: baseP.numero })); setSaving(false); return; }
      }
      // 2) Resto de campos del pedido
      const patchP = diffPedido(baseP, draft) as Record<string, unknown>;
      if (patchP.telaEstado !== undefined) {
        patchP.telaEstadoPor = "equipo";
        patchP.telaEstadoFecha = new Date().toISOString();
      }
      if (patchP.terminadoTapicero === false) {
        patchP.terminadoTapiceroPor = "";
        patchP.terminadoTapiceroFecha = "";
      }
      if (Object.keys(patchP).length > 0) await actions.updatePedido(pedidoId, patchP as Partial<Pedido>);
      // 3) Telas (diff create/update/delete)
      if (telasCambiadas(baseT, telasDraft)) {
        const ok = await actions.guardarTelasPedido(pedidoId, telasDraft);
        if (!ok) { setSaving(false); return; }
      }
      // 4) Nueva base = lo guardado
      setBaseP({ ...draft });
      setBaseT(telasDraft.map((t) => ({ ...t })));
      toast.success("Pedido guardado.");
    } finally {
      setSaving(false);
    }
  }

  function descartar() {
    setDraft(baseP);
    setTelasDraft(baseT.map((t) => ({ ...t })));
  }

  function volver(e: React.MouseEvent) {
    if (dirty && !confirm("Tienes cambios sin guardar. ¿Salir sin guardar?")) { e.preventDefault(); }
  }

  const medidas = [producto?.ancho, producto?.alto, producto?.fondo].filter((d): d is number => d != null && d > 0).join(" × ");

  return (
    <div className="space-y-4 pb-24">
      <Link to="/pedidos" onClick={volver} className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" /> Volver a pedidos
      </Link>

      {/* Header */}
      <div className={`flex flex-wrap items-start justify-between gap-3 rounded-xl border-2 bg-white p-4 shadow-sm md:p-6 ${c.border}`}>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Package className="h-5 w-5 text-[#1a1f36]" />
            {/* Número de pedido: visible siempre; editable solo por admin (punto 2/3). */}
            {esEquipo ? (
              <label className="inline-flex items-center gap-1 rounded-full bg-slate-800 px-2 py-0.5 text-xs font-bold text-white">
                Nº
                <input
                  type="number" min={1}
                  value={draft.numero ?? ""}
                  onChange={(e) => guardarNumero(e.target.value)}
                  placeholder="—"
                  className="w-14 rounded bg-slate-700 px-1 py-0.5 text-center text-xs font-bold text-white placeholder-slate-400 focus:bg-slate-600 focus:outline-none"
                  title="Editar número de pedido (admin)"
                />
              </label>
            ) : (
              pedido.numero != null && <span className="rounded-full bg-slate-800 px-2 py-0.5 text-xs font-bold text-white">Nº {pedido.numero}</span>
            )}
            <h1 className="truncate text-xl font-bold sm:text-2xl">{lead?.nombre ?? pedido.clienteNombreLibre ?? "—"}</h1>
            {lead ? (
              <Link to="/clientes/$id" params={{ id: lead.id }} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-200">
                <ExternalLink className="h-3 w-3" /> Ficha
              </Link>
            ) : (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">Sin lead vinculado</span>
            )}
          </div>
          <div className="mt-1 text-sm text-slate-500">
            {producto ? displayNombreProducto(producto.tipo, producto.modelo) : "Producto"}
            {producto && producto.cantidad > 1 && <span className="ml-1 rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-semibold text-slate-600">×{producto.cantidad}</span>}
          </div>
          <div className={`mt-2 inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium ${c.bg} ${c.text}`}>
            <span className={`h-2 w-2 rounded-full ${c.dot}`} />
            {c.label} · Hito real {sem.hitoActual}/{hitos.length} — esperado {sem.hitoEsperado}/{hitos.length}
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            onClick={() => {
              if (confirm("¿Eliminar este pedido? Las telas asociadas también se eliminarán.")) {
                void actions.deletePedido(pedido.id).then(() => navigate({ to: "/pedidos" }));
              }
            }}
            className="rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-sm font-medium text-rose-600 hover:bg-rose-50"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Datos del producto (medidas, telas, acabado) — para que NADA quede
          oculto al pasar de cliente a pedido (punto 8). */}
      {producto && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500"><Ruler className="h-3.5 w-3.5" /> Datos del producto</div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm sm:grid-cols-3">
            <Info k="Tipo" v={displayNombreProducto(producto.tipo, producto.modelo)} />
            <Info k="Medidas" v={medidas ? medidas + " cm" : "—"} />
            <Info k="Cantidad" v={String(producto.cantidad || 1)} />
            <Info k="Tela principal" v={[producto.tela, producto.coleccionTela ? displayColeccionTela(producto.coleccionTela) : ""].filter(Boolean).join(" · ") || "—"} />
            {producto.color && <Info k="Tela lateral" v={producto.color} />}
            {producto.relleno && <Info k="Tela vivo/ribete" v={producto.relleno} />}
            {producto.acabado && <Info k="Acabado" v={producto.acabado === "vivo-simple" ? "Vivo simple" : producto.acabado === "vivo-doble" ? "Vivo doble" : producto.acabado} />}
            {producto.patas && <Info k="Extras" v={producto.patas} />}
            {producto.notasProducto && <Info k="Notas" v={producto.notasProducto} full />}
          </div>
        </div>
      )}

      {/* Plazo */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Plazo</div>
          <div className="space-y-3">
            <div>
              <div className="text-xs text-slate-500">Fecha de creación</div>
              <div className="text-sm font-medium">{formatShortDate(pedido.fechaCreacionPedido.slice(0, 10))}</div>
            </div>
            <div>
              <label className="text-xs text-slate-500">Días de plazo</label>
              <input
                type="number" min={1}
                value={draft.diasPlazo}
                onChange={(e) => patch({ diasPlazo: Math.max(1, parseInt(e.target.value) || 20) })}
                className="mt-1 w-24 rounded border border-slate-200 px-2 py-1 text-sm focus:border-slate-400 focus:outline-none"
              />
            </div>
            <div>
              <div className="text-xs text-slate-500">Fecha límite</div>
              <div className={`text-sm font-bold ${sem.diasRestantes < 0 ? "text-rose-700" : "text-slate-900"}`}>
                {formatShortDate(pedido.fechaLimite)}
                {!draft.entregado && (
                  <span className="ml-2 text-xs font-normal text-slate-500">
                    ({sem.diasRestantes >= 0 ? `${sem.diasRestantes}d restantes` : `${Math.abs(sem.diasRestantes)}d tarde`})
                  </span>
                )}
              </div>
            </div>
            <div>
              <label className="text-xs text-slate-500">Fecha de entrega real</label>
              <input
                type="date" value={draft.fechaEntregaReal || ""}
                onChange={(e) => patch({ fechaEntregaReal: e.target.value })}
                className="mt-1 rounded border border-slate-200 px-2 py-1 text-sm focus:border-slate-400 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Pago / factura */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Pago y factura</div>
          <div className="space-y-3 text-sm">
            <Field label="Precio (€)">
              <input type="number" step="0.01" value={draft.precio}
                onChange={(e) => patch({ precio: parseFloat(e.target.value) || 0 })}
                className="w-full rounded border border-slate-200 px-2 py-1 focus:border-slate-400 focus:outline-none" />
            </Field>
            {lead?.clienteTipo === "partner_ab" && (
              <Field label="Precio con IVA (€)">
                <input type="number" step="0.01" value={draft.precioConIva ?? ""}
                  onChange={(e) => patch({ precioConIva: e.target.value === "" ? null : parseFloat(e.target.value) })}
                  className="w-full rounded border border-slate-200 px-2 py-1 focus:border-slate-400 focus:outline-none" />
              </Field>
            )}
            <Field label="Coste envío (€)">
              <input type="number" step="0.01" value={draft.costeEnvio}
                onChange={(e) => patch({ costeEnvio: parseFloat(e.target.value) || 0 })}
                className="w-full rounded border border-slate-200 px-2 py-1 focus:border-slate-400 focus:outline-none" />
            </Field>
            <Field label="Reserva (€)">
              <input type="number" step="0.01" value={draft.reserva}
                onChange={(e) => patch({ reserva: parseFloat(e.target.value) || 0 })}
                className="w-full rounded border border-slate-200 px-2 py-1 focus:border-slate-400 focus:outline-none" />
            </Field>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={draft.pagadoCompleto}
                onChange={(e) => patch({ pagadoCompleto: e.target.checked })}
                className="h-4 w-4 rounded border-slate-300" />
              <span>Pagado completo</span>
            </label>
            <Field label="Factura nº">
              <input type="text" value={draft.factura || ""}
                onChange={(e) => patch({ factura: e.target.value })}
                className="w-full rounded border border-slate-200 px-2 py-1 focus:border-slate-400 focus:outline-none" />
            </Field>
            <div className="flex items-center justify-between border-t border-slate-100 pt-2 text-xs">
              <span className="text-slate-500">Total (precio + envío)</span>
              <span className="font-bold text-slate-900">{formatCurrency(draft.precio + draft.costeEnvio)}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500">Pendiente</span>
              <span className="font-bold text-slate-900">
                {formatCurrency(Math.max(0, draft.precio + draft.costeEnvio - draft.reserva - (draft.pagadoCompleto ? (draft.precio + draft.costeEnvio - draft.reserva) : 0)))}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Tapicero asignado (acción inmediata) */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-slate-500">
          <span>Tapicero asignado</span>
          <span className="font-normal normal-case text-slate-400">se guarda al instante</span>
        </div>
        <select
          value={pedido.tapiceroId}
          onChange={(e) => actions.reasignarTapicero(pedido.id, e.target.value)}
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-slate-400 focus:outline-none sm:w-72"
        >
          <option value="">— Sin asignar —</option>
          {tapicerosSeleccionables.map((t) => (
            <option key={t.id} value={t.id}>{tapiceroNombre(t)}{!t.activo ? " (inactivo)" : ""}</option>
          ))}
        </select>
      </div>

      {/* Ficha para el tapicero (borrador; se guarda con el botón Guardar) */}
      <FichaTapiceroEquipo pedido={pedido} producto={producto} draft={draft} patch={patch} telas={telasDraft} setTelas={setTelasDraft} />

      {/* Hitos */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Ruta de producción</div>
        <div className="space-y-2">
          {hitos.map((h, index) => {
            const checked = draft[h.key] as boolean;
            const fecha = draft[h.fechaKey] as string;
            return (
              <div key={h.key} className={`flex flex-wrap items-center gap-3 rounded-lg border p-3 ${checked ? "border-emerald-200 bg-emerald-50/50" : "border-slate-200 bg-white"}`}>
                <label className="flex flex-1 cursor-pointer items-center gap-2">
                  <input type="checkbox" checked={checked}
                    onChange={(e) => {
                      const today = new Date().toISOString().slice(0, 10);
                      const next = cascadaMarcado(hitos, index, e.target.checked, draft, today);
                      patch(next);
                    }}
                    className="h-5 w-5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" />
                  <span className={`font-medium ${checked ? "text-slate-900" : "text-slate-600"}`}>{hitoLabel(h.label, nombreDePaso(h.key))}</span>
                </label>
                <select
                  value={pedido.pasosTapicero?.[h.key] ?? ""}
                  onChange={(e) => setPasoTapicero(h.key, e.target.value)}
                  title="Tapicero de este paso (se guarda al instante)"
                  className="rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600 focus:border-slate-400 focus:outline-none"
                >
                  <option value="">Tapicero: {tapiceroNombre(tapiceroAsignado) || "sin asignar"}</option>
                  {tapicerosSeleccionables.map((t) => (
                    <option key={t.id} value={t.id}>{tapiceroNombre(t)}{!t.activo ? " (inactivo)" : ""}</option>
                  ))}
                </select>
                {checked && (
                  <input type="date" value={fecha || ""}
                    onChange={(e) => patch({ [h.fechaKey]: e.target.value } as Partial<Pedido>)}
                    className="rounded border border-slate-200 px-2 py-1 text-xs" />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Telas (lista completa: tipo / nombre / estado / fecha + foto). Borrador. */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Telas del pedido</div>
          <button
            onClick={() => setTelasDraft((prev) => [...prev, emptyTela("Otra")])}
            className="inline-flex items-center gap-1 rounded-lg bg-[#1a1f36] px-3 py-1 text-xs font-medium text-white hover:bg-[#2a2f46]"
          >
            <Plus className="h-3.5 w-3.5" /> Añadir tela
          </button>
        </div>
        {telasDraft.length === 0 ? (
          <div className="py-4 text-center text-sm text-slate-400">Sin telas registradas</div>
        ) : (
          <div className="space-y-2">
            {telasDraft.map((t, i) => (
              <div key={t.id ?? `new-${i}`} className="grid grid-cols-1 gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 sm:grid-cols-[48px_110px_1fr_120px_140px_auto] sm:items-center">
                {t.telaFotoUrl ? (
                  <img src={t.telaFotoUrl} alt="" className="h-10 w-10 rounded object-cover" />
                ) : (
                  <span className="hidden h-10 w-10 items-center justify-center rounded bg-slate-200 text-[9px] text-slate-400 sm:flex">sin foto</span>
                )}
                <input type="text" value={t.tipoTela}
                  onChange={(e) => setTelasDraft((prev) => prev.map((x, j) => j === i ? { ...x, tipoTela: e.target.value } : x))}
                  placeholder="Tipo"
                  className="rounded border border-slate-200 bg-white px-2 py-1 text-sm font-medium" />
                <input type="text" value={t.mismaQueFrontal ? "Misma que la principal" : t.nombreTela}
                  disabled={t.mismaQueFrontal}
                  onChange={(e) => setTelasDraft((prev) => prev.map((x, j) => j === i ? { ...x, nombreTela: e.target.value } : x))}
                  placeholder="Nombre de la tela"
                  className="rounded border border-slate-200 bg-white px-2 py-1 text-sm disabled:bg-slate-100 disabled:text-slate-500" />
                <select value={t.estado}
                  onChange={(e) => setTelasDraft((prev) => prev.map((x, j) => j === i ? { ...x, estado: e.target.value } : x))}
                  className="rounded border border-slate-200 bg-white px-2 py-1 text-sm">
                  <option value="Pedida">Pedida</option>
                  <option value="Recibida">Recibida</option>
                </select>
                <input type="date" value={t.fechaRecibo || ""}
                  onChange={(e) => setTelasDraft((prev) => prev.map((x, j) => j === i ? { ...x, fechaRecibo: e.target.value } : x))}
                  className="rounded border border-slate-200 bg-white px-2 py-1 text-sm" />
                <button
                  onClick={() => setTelasDraft((prev) => prev.filter((_, j) => j !== i))}
                  className="justify-self-end rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
        <p className="mt-2 text-[11px] text-slate-400">Para buscar/enlazar fotos de tela usa los selectores por rol de la ficha del tapicero (arriba).</p>
      </div>

      {/* Colaboración (canje) */}
      <ColaboracionPanel draft={draft} patch={patch} lead={lead} />

      {/* Notas */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Notas del pedido</div>
        <textarea rows={3} value={draft.notasPedido || ""}
          onChange={(e) => patch({ notasPedido: e.target.value })}
          placeholder="Notas internas sobre este pedido…"
          className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none" />
      </div>

      {/* Barra fija de guardado (punto 1) */}
      {dirty && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-amber-200 bg-amber-50/95 px-4 py-3 backdrop-blur">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
            <span className="text-sm font-medium text-amber-800">Tienes cambios sin guardar</span>
            <div className="flex gap-2">
              <button onClick={descartar} disabled={saving}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50">
                Descartar
              </button>
              <button onClick={guardar} disabled={saving}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
                <Save className="h-4 w-4" /> {saving ? "Guardando…" : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ColaboracionPanel({ draft, patch, lead }: { draft: Pedido; patch: (p: Partial<Pedido>) => void; lead: Lead | undefined }) {
  const esInflu = lead?.tipo === "INFLUENCER";
  if (!draft.esCanje && !esInflu) return null;
  const tipoConocido = (TIPOS_COLAB as readonly string[]).includes(draft.tipoColaboracion);
  const selectValue = draft.tipoColaboracion === "" ? "" : tipoConocido ? draft.tipoColaboracion : "Otros";
  return (
    <div className="rounded-xl border border-pink-200 bg-pink-50/40 p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-xs font-semibold uppercase tracking-wide text-pink-600">Colaboración (canje)</div>
        <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-medium text-slate-700">
          <input type="checkbox" checked={draft.esCanje} onChange={(e) => patch({ esCanje: e.target.checked })} className="h-4 w-4 rounded border-slate-300 text-pink-600 focus:ring-pink-500" />
          Es canje (no cuenta como ingreso)
        </label>
      </div>
      {draft.esCanje && (
        <div className="space-y-3">
          <div>
            <div className="mb-1 text-xs text-slate-500">Formato (varios)</div>
            <div className="flex flex-wrap gap-1.5">
              {FORMATOS_COLAB.map((f) => {
                const on = (draft.formatos || []).includes(f);
                return (
                  <button key={f} type="button"
                    onClick={() => patch({ formatos: on ? draft.formatos.filter((x) => x !== f) : [...(draft.formatos || []), f] })}
                    className={`rounded-full border px-3 py-1.5 text-xs font-medium ${on ? "border-pink-500 bg-pink-500 text-white" : "border-slate-200 bg-white text-slate-600"}`}>
                    {f}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <div className="mb-1 text-xs text-slate-500">Tipo de colaboración</div>
            <select value={selectValue}
              onChange={(e) => patch({ tipoColaboracion: e.target.value === "Otros" ? "" : e.target.value })}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
              <option value="">— Selecciona —</option>
              {TIPOS_COLAB.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            {selectValue === "Otros" && (
              <input value={tipoConocido ? "" : draft.tipoColaboracion}
                onChange={(e) => patch({ tipoColaboracion: e.target.value })}
                placeholder="Describe la colaboración"
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs text-slate-500">{label}</label>
      {children}
    </div>
  );
}

function Info({ k, v, full }: { k: string; v: string; full?: boolean }) {
  return (
    <div className={full ? "col-span-2 sm:col-span-3" : ""}>
      <div className="text-[11px] uppercase tracking-wide text-slate-400">{k}</div>
      <div className="font-medium text-slate-800">{v}</div>
    </div>
  );
}
