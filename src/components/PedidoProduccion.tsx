// Piezas de "asignación / producción" de un pedido, compartidas entre la ficha
// del pedido (pedidos.$id.tsx) y la ficha del cliente (clientes.$id.tsx):
//   · TapiceroAsignado   — selector de tapicero (acción inmediata)
//   · RutaProduccion      — hitos + tapicero por paso
//   · TelasPedidoEditor   — lista completa de telas del pedido (borrador)
//   · PedidoProduccionEditor — editor autónomo (tapicero + ficha + hitos + telas
//                              + barra de guardado) para embeber en Clientes.
import { useState, type Dispatch, type SetStateAction } from "react";
import { Plus, Trash2, Save, Hammer } from "lucide-react";
import { useStore, actions } from "@/lib/store";
import { flujoPedido, hitoLabel, cascadaMarcado, tapiceroNombre, type Pedido, type Producto } from "@/lib/types";
import { emptyTela, type TelaDraft } from "@/lib/pedido-form";
import { FichaTapiceroEquipo } from "@/components/FichaTapiceroEquipo";
import { usePedidoDraft } from "@/lib/use-pedido-draft";
import { faltaParaTaller } from "@/lib/catalogo";

// ── Selector de tapicero (acción inmediata: sella los pasos ya hechos) ──────
export function TapiceroAsignado({ pedido }: { pedido: Pedido }) {
  const { tapiceros, productos } = useStore();
  const seleccionables = tapiceros.filter((t) => t.activo || t.id === pedido.tapiceroId);
  const producto = productos.find((p) => p.id === pedido.productoLeadId);
  // Sin medidas o sin fecha de recogida el pedido no puede entrar en el taller.
  const faltan = pedido.tapiceroId ? [] : faltaParaTaller(producto, pedido.fechaRecogida);
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-slate-500">
        <span>Tapicero asignado</span>
        <span className="font-normal normal-case text-slate-400">se guarda al instante</span>
      </div>
      <select
        value={pedido.tapiceroId}
        disabled={faltan.length > 0}
        onChange={(e) => actions.reasignarTapicero(pedido.id, e.target.value)}
        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-slate-400 focus:outline-none disabled:bg-slate-50 disabled:text-slate-400 sm:w-72"
      >
        <option value="">— Sin asignar —</option>
        {seleccionables.map((t) => (
          <option key={t.id} value={t.id}>{tapiceroNombre(t)}{!t.activo ? " (inactivo)" : ""}</option>
        ))}
      </select>
      {faltan.length > 0 && (
        <p className="mt-2 text-xs text-rose-700">Para asignarlo falta {faltan.join(" y ")}. Se rellena más abajo, en la ficha para el tapicero, y se guarda.</p>
      )}
    </div>
  );
}

// ── Ruta de producción (hitos) ──────────────────────────────────────────────
export function RutaProduccion({ pedido, producto, draft, patch, setTelasDraft }: {
  pedido: Pedido;
  producto: Producto | undefined;
  draft: Pedido;
  patch: (p: Partial<Pedido>) => void;
  setTelasDraft: Dispatch<SetStateAction<TelaDraft[]>>;
}) {
  const { tapiceros } = useStore();
  const hitos = flujoPedido(producto?.tipo ?? "");
  const tapiceroAsignado = tapiceros.find((t) => t.id === pedido.tapiceroId);
  const seleccionables = tapiceros.filter((t) => t.activo || t.id === pedido.tapiceroId);
  const tapiceroDePaso = (stepKey: string) => {
    const selloId = pedido.pasosTapicero?.[stepKey];
    return selloId ? tapiceros.find((x) => x.id === selloId) : tapiceroAsignado;
  };
  const nombreDePaso = (stepKey: string): string => tapiceroNombre(tapiceroDePaso(stepKey));
  const setPasoTapicero = (stepKey: string, tapiceroId: string) => {
    const next = { ...(pedido.pasosTapicero || {}) };
    if (tapiceroId) next[stepKey] = tapiceroId; else delete next[stepKey];
    void actions.updatePedido(pedido.id, { pasosTapicero: next });
  };

  return (
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
                    if (next.telaRecibida === true) {
                      setTelasDraft((prev) => prev.map((t) => ({ ...t, estado: "Recibida", fechaRecibo: t.fechaRecibo || today })));
                    } else if (next.telaPedida === true) {
                      setTelasDraft((prev) => prev.map((t) => ({ ...t, estado: "Pedida" })));
                    } else if (h.key === "telaRecibida" && next.telaRecibida === false) {
                      setTelasDraft((prev) => prev.map((t) => ({ ...t, estado: "Pedida", fechaRecibo: "" })));
                    }
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
                {seleccionables.map((t) => (
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
  );
}

// ── Lista completa de telas del pedido (borrador) ───────────────────────────
export function TelasPedidoEditor({ telasDraft, setTelasDraft }: {
  telasDraft: TelaDraft[];
  setTelasDraft: Dispatch<SetStateAction<TelaDraft[]>>;
}) {
  return (
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
  );
}

// ── Editor autónomo de asignación/producción (para embeber en Clientes) ─────
// Reúne el tapicero, la ficha del tapicero (telas por rol, recogida, montaje,
// comentarios, archivos), la ruta de producción y las telas, con su propia
// barra de guardado en línea (no fija) para no chocar con otras.
// Ficha de producción de un PRODUCTO desde la ficha del cliente. Si el producto
// ya tiene pedido, muestra el editor completo. Si NO tiene, permite asignar un
// tapicero (o crear la ficha) y crea el pedido automáticamente en ese momento
// —no solo por ver el producto—, tras lo cual aparece la ficha completa.
export function ProduccionProducto({ producto, esCanje = false }: { producto: Producto; esCanje?: boolean }) {
  const { pedidos, tapiceros } = useStore();
  const [creando, setCreando] = useState(false);
  const pedidosProd = pedidos.filter((p) => p.productoLeadId === producto.id);

  async function crear(tapiceroId?: string) {
    if (creando) return;
    setCreando(true);
    try {
      const ped = await actions.crearPedidoManual({
        leadId: producto.leadId,
        productoId: producto.id,
        diasPlazo: 20,
        precio: (producto.precioUnitario || 0) * (producto.cantidad || 1),
        reserva: 0,
        costeEnvio: 0,
        esCanje,
      });
      if (ped && tapiceroId) await actions.reasignarTapicero(ped.id, tapiceroId);
    } finally {
      setCreando(false);
    }
  }

  if (pedidosProd.length > 0) {
    return (
      <div>
        {pedidosProd.length > 1 && (
          <div className="mb-2 text-[11px] text-slate-400">Este producto tiene varios pedidos; se muestra el primero. Abre los demás desde Pedidos.</div>
        )}
        <PedidoProduccionEditor pedidoId={pedidosProd[0].id} />
      </div>
    );
  }

  const seleccionables = tapiceros.filter((t) => t.activo);
  return (
    <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50/40 p-4 shadow-sm">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-amber-700">
        <Hammer className="h-4 w-4" /> Producción / tapicero
      </div>
      <p className="text-xs text-slate-500">
        Aún no hay pedido para este producto. Al <strong>asignar un tapicero</strong> (o crear la ficha) se crea el pedido automáticamente y se activa la ficha completa (telas, montaje, recogida, plantilla…).
      </p>
      <div>
        <div className="mb-1 text-xs font-medium text-slate-500">Tapicero asignado</div>
        <select
          value=""
          disabled={creando}
          onChange={(e) => { if (e.target.value) void crear(e.target.value); }}
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-slate-400 focus:outline-none disabled:opacity-60 sm:w-72"
        >
          <option value="">{creando ? "Creando…" : "— Asignar tapicero —"}</option>
          {seleccionables.map((t) => (
            <option key={t.id} value={t.id}>{tapiceroNombre(t)}</option>
          ))}
        </select>
      </div>
      <button
        type="button"
        disabled={creando}
        onClick={() => void crear()}
        className="text-xs font-medium text-slate-500 underline hover:text-slate-700 disabled:opacity-60"
      >
        o crear la ficha sin asignar tapicero todavía
      </button>
    </div>
  );
}

export function PedidoProduccionEditor({ pedidoId }: { pedidoId: string }) {
  const { productos } = useStore();
  const api = usePedidoDraft(pedidoId);
  if (!api) return null;
  const { pedido, draft, patch, telasDraft, setTelasDraft, dirty, saving, guardar, descartar } = api;
  const producto = productos.find((p) => p.id === pedido.productoLeadId);

  return (
    <div className="space-y-4">
      <TapiceroAsignado pedido={pedido} />
      <FichaTapiceroEquipo pedido={pedido} producto={producto} draft={draft} patch={patch} telas={telasDraft} setTelas={setTelasDraft} />
      <RutaProduccion pedido={pedido} producto={producto} draft={draft} patch={patch} setTelasDraft={setTelasDraft} />
      <TelasPedidoEditor telasDraft={telasDraft} setTelasDraft={setTelasDraft} />

      {dirty && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
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
      )}
    </div>
  );
}
