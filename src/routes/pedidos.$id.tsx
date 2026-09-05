import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, Trash2, Package, ExternalLink, Save, Ruler, Pencil } from "lucide-react";
import { useStore, actions } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { numeroPedidoLabel, semaforoPedido, mensajeRitmoPedido, flujoPedido, tapiceroNombre, tablaHistorialProducto, tablaHistorialPedido, FORMATOS_COLAB, TIPOS_COLAB, type Pedido, type Lead } from "@/lib/types";
import { formatCurrency, formatShortDate } from "@/lib/format";
import { displayNombreProducto, displayColeccionTela, vivoLabel, tipoLlevaVivo, displayExtras, medidasEtiquetadas } from "@/lib/catalogo";
import { FichaTapiceroEquipo } from "@/components/FichaTapiceroEquipo";
import { ProductoForm, productoToState } from "@/components/ProductoForm";
import { TapiceroAsignado, RutaProduccion, TelasPedidoEditor } from "@/components/PedidoProduccion";
import { SugerenciaEnvioCabecero } from "@/components/EnvioCabecero";
import { EmailEntrega } from "@/components/EmailEntrega";
import { Antes } from "@/components/Antes";
import { usePedidoDraft } from "@/lib/use-pedido-draft";

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
  const { esEquipo } = useAuth();
  const navigate = useNavigate();
  const { leads, productos, tapiceros } = useStore();
  const api = usePedidoDraft(pedidoId);
  const [editProd, setEditProd] = useState(false);

  if (!api) return null; // borrado mientras se veía
  const { pedido, draft, patch, telasDraft, setTelasDraft, dirty, saving, guardar, descartar, guardarNumero, guardarSufijo } = api;

  const lead = leads.find((l) => l.id === pedido.leadId);
  const producto = productos.find((pr) => pr.id === pedido.productoLeadId);

  const sem = semaforoPedido(draft, producto?.tipo ?? "");
  const c = SEM_COLOR[sem.estado];
  const hitos = flujoPedido(producto?.tipo ?? "");
  const tapiceroAsignado = tapiceros.find((t) => t.id === pedido.tapiceroId);

  function volver(e: React.MouseEvent) {
    if (dirty && !confirm("Tienes cambios sin guardar. ¿Salir sin guardar?")) { e.preventDefault(); }
  }

  const med = medidasEtiquetadas(producto?.tipo, producto?.modelo, producto?.ancho, producto?.alto, producto?.fondo);
  const medidas = [med.texto, med.extra].filter(Boolean).join(" · ");

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
            {/* Número de pedido: visible siempre; editable solo por admin. */}
            {esEquipo ? (
              <label className="inline-flex items-center gap-1 rounded-full bg-indigo-600 px-2 py-0.5 text-xs font-bold text-white">
                Nº
                <input
                  type="number" inputMode="decimal" min={1}
                  value={draft.numero ?? ""}
                  onChange={(e) => guardarNumero(e.target.value)}
                  placeholder="—"
                  className="w-14 rounded bg-indigo-500 px-1 py-0.5 text-center text-xs font-bold text-white placeholder-indigo-200 focus:bg-indigo-400 focus:outline-none"
                  title="Editar número de pedido (admin)"
                />
                <input
                  type="text" maxLength={2}
                  value={draft.numeroSufijo ?? ""}
                  onChange={(e) => guardarSufijo(e.target.value)}
                  placeholder="A"
                  className="w-8 rounded bg-indigo-500 px-1 py-0.5 text-center text-xs font-bold uppercase text-white placeholder-indigo-200 focus:bg-indigo-400 focus:outline-none"
                  title="Letra opcional para diferenciar pedidos con el mismo número"
                />
              </label>
            ) : (
              pedido.numero != null && <span className="rounded-full bg-indigo-600 px-2 py-0.5 text-xs font-bold text-white">Nº {numeroPedidoLabel(pedido.numero, pedido.numeroSufijo)}</span>
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
          {pedido.iniciadoTapicero && !pedido.terminadoTapicero && !pedido.entregado && (
            <div className="ml-2 mt-2 inline-flex items-center gap-1 rounded-md bg-amber-100 px-2 py-1 text-xs font-bold text-amber-700">
              En marcha{pedido.iniciadoTapiceroPor ? ` · ${pedido.iniciadoTapiceroPor}` : ""}
            </div>
          )}
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

      {/* Datos del producto — editable (mismo formulario que en Clientes). Al
          guardar se actualiza el MISMO producto (se refleja en la ficha del
          cliente) y se avisa al tapicero si ya estaba asignado. */}
      {producto && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500"><Ruler className="h-3.5 w-3.5" /> Datos del producto</div>
            {!editProd && (
              <button onClick={() => setEditProd(true)} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50">
                <Pencil className="h-3.5 w-3.5" /> Editar producto
              </button>
            )}
          </div>
          {editProd ? (
            <ProductoForm
              initial={productoToState({ tipo: producto.tipo, modelo: producto.modelo, ancho: producto.ancho, alto: producto.alto, fondo: producto.fondo, tela: producto.tela, color: producto.color, relleno: producto.relleno, patas: producto.patas, acabado: producto.acabado, coleccionTela: producto.coleccionTela, cantidad: producto.cantidad, precioUnitario: producto.precioUnitario, notasProducto: producto.notasProducto })}
              onSave={(updated) => { void actions.updateProducto(producto.id, updated); setEditProd(false); }}
              onCancel={() => setEditProd(false)}
              isEditing
            />
          ) : (
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm sm:grid-cols-3">
              <Info k="Tipo" v={displayNombreProducto(producto.tipo, producto.modelo)} />
              <Info k="Medidas" v={medidas || "—"} />
              <Info k="Cantidad" v={String(producto.cantidad || 1)} />
              <Info k="Tela principal" v={[producto.tela, producto.coleccionTela ? displayColeccionTela(producto.coleccionTela) : ""].filter(Boolean).join(" · ") || "—"} />
              {producto.color && <Info k="Tela lateral" v={producto.color} />}
              {producto.relleno && <Info k="Tela vivo/ribete" v={producto.relleno} />}
              {tipoLlevaVivo(producto.tipo)
                ? <Info k="Vivo" v={vivoLabel(producto.acabado)} />
                : producto.acabado && <Info k="Acabado" v={producto.acabado} />}
              {displayExtras(producto.patas) && <Info k="Extras" v={displayExtras(producto.patas)} />}
              {producto.notasProducto && <Info k="Notas" v={producto.notasProducto} full />}
              <Antes tabla={tablaHistorialProducto(producto.id)} campos={["medidas", "tela_frontal", "tela_lateral", "tela_vivo", "montaje"]} className="col-span-2 sm:col-span-3" />
            </div>
          )}
        </div>
      )}

      {/* Plazo */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Plazo</div>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-slate-500">Fecha de creación</label>
              <input
                type="date" value={(draft.fechaCreacionPedido || "").slice(0, 10)}
                onChange={(e) => patch({ fechaCreacionPedido: e.target.value })}
                className="mt-1 block rounded border border-slate-200 px-2 py-1 text-sm focus:border-slate-400 focus:outline-none"
              />
              <div className="mt-0.5 text-[11px] text-slate-400">Al cambiarla se recalcula la fecha límite (útil si aparece como atrasado sin serlo).</div>
            </div>
            <div>
              <label className="text-xs text-slate-500">Días de plazo</label>
              <input
                type="number" inputMode="decimal" min={1}
                value={draft.diasPlazo}
                onChange={(e) => patch({ diasPlazo: Math.max(1, parseInt(e.target.value) || 20) })}
                className="mt-1 w-24 rounded border border-slate-200 px-2 py-1 text-sm focus:border-slate-400 focus:outline-none"
              />
            </div>
            <div>
              <div className="text-xs text-slate-500">Fecha límite</div>
              <div className={`text-sm font-bold ${sem.diasRestantes < 0 && !draft.entregado ? "text-rose-700" : "text-slate-900"}`}>
                {formatShortDate(pedido.fechaLimite)}
                {!draft.entregado && (
                  <span className="ml-2 text-xs font-normal text-slate-500">
                    ({sem.diasRestantes >= 0 ? `${sem.diasRestantes}d restantes` : `${Math.abs(sem.diasRestantes)}d tarde`})
                  </span>
                )}
              </div>
              {(() => { const ritmo = mensajeRitmoPedido(draft, producto?.tipo ?? "", tapiceroNombre(tapiceroAsignado)); return ritmo ? (
                <div className="mt-1.5 rounded-lg bg-slate-50 px-2.5 py-1.5 text-[11px] text-slate-500">💡 {ritmo}</div>
              ) : null; })()}
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
              <input type="number" inputMode="decimal" step="0.01" value={draft.precio}
                onChange={(e) => patch({ precio: parseFloat(e.target.value) || 0 })}
                className="w-full rounded border border-slate-200 px-2 py-1 focus:border-slate-400 focus:outline-none" />
              <Antes tabla={tablaHistorialPedido(pedido.id)} campos={["precio_pedido"]} className="mt-1" />
            </Field>
            {lead?.clienteTipo === "partner_ab" && (
              <Field label="Precio con IVA (€)">
                <input type="number" inputMode="decimal" step="0.01" value={draft.precioConIva ?? ""}
                  onChange={(e) => patch({ precioConIva: e.target.value === "" ? null : parseFloat(e.target.value) })}
                  className="w-full rounded border border-slate-200 px-2 py-1 focus:border-slate-400 focus:outline-none" />
              </Field>
            )}
            <Field label="Coste envío (€)">
              <input type="number" inputMode="decimal" step="0.01" value={draft.costeEnvio}
                onChange={(e) => patch({ costeEnvio: parseFloat(e.target.value) || 0 })}
                className="w-full rounded border border-slate-200 px-2 py-1 focus:border-slate-400 focus:outline-none" />
            </Field>
            <SugerenciaEnvioCabecero
              tipo={producto?.tipo ?? ""}
              ancho={producto?.ancho} alto={producto?.alto}
              ciudad={lead?.ciudad} provincia={lead?.provincia}
              costeEnvio={draft.costeEnvio}
              onApply={(v) => patch({ costeEnvio: v })}
            />
            <Field label="Reserva (€)">
              <input type="number" inputMode="decimal" step="0.01" value={draft.reserva}
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
      <TapiceroAsignado pedido={pedido} />

      {/* Ficha para el tapicero (borrador; se guarda con el botón Guardar) */}
      <FichaTapiceroEquipo pedido={pedido} producto={producto} draft={draft} patch={patch} telas={telasDraft} setTelas={setTelasDraft} />

      {/* Ruta de producción (hitos) */}
      <RutaProduccion pedido={pedido} producto={producto} draft={draft} patch={patch} setTelasDraft={setTelasDraft} />

      {/* Correo de entrega al cliente: solo cuando el pedido está ENTREGADO
          (guardado), y solo lo ve el equipo. Nunca sale sin pulsar Enviar. */}
      <EmailEntrega pedido={pedido} lead={lead} producto={producto} />

      {/* Telas del pedido (borrador) */}
      <TelasPedidoEditor telasDraft={telasDraft} setTelasDraft={setTelasDraft} />

      {/* Colaboración (canje) */}
      <ColaboracionPanel draft={draft} patch={patch} lead={lead} />

      {/* Notas */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Notas del pedido <span className="font-normal normal-case text-slate-400">· internas (el tapicero NO las ve)</span></div>
        <textarea rows={3} value={draft.notasPedido || ""}
          onChange={(e) => patch({ notasPedido: e.target.value })}
          placeholder="Logística, incidencias, acuerdos… (internas)"
          className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none" />
      </div>

      {/* Barra fija de guardado */}
      {dirty && (
        <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-40 border-t border-amber-200 bg-amber-50/95 px-4 py-3 shadow-[0_-8px_24px_-14px_rgba(0,0,0,.35)] backdrop-blur md:bottom-0 md:shadow-none">
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
