import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Trash2, Plus, Package, ExternalLink } from "lucide-react";
import { useStore, actions } from "@/lib/store";
import { semaforoPedido, FORMATOS_COLAB, TIPOS_COLAB, type Pedido, type Lead } from "@/lib/types";
import { formatCurrency, formatShortDate } from "@/lib/format";
import { TIPOS_PRODUCTO } from "@/components/ProductoForm";

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
  const navigate = useNavigate();
  const { pedidos, leads, productos, pedidoTelas } = useStore();
  const pedido = pedidos.find((p) => p.id === id);

  if (!pedido) {
    return (
      <div className="py-12 text-center">
        <p className="text-slate-500">Pedido no encontrado.</p>
        <Link to="/pedidos" className="mt-4 inline-block text-sm text-blue-600">Volver a pedidos</Link>
      </div>
    );
  }

  const lead = leads.find((l) => l.id === pedido.leadId);
  const producto = productos.find((pr) => pr.id === pedido.productoLeadId);
  const telas = pedidoTelas.filter((t) => t.pedidoId === pedido.id).sort((a, b) => a.orden - b.orden);
  const sem = semaforoPedido(pedido);
  const c = SEM_COLOR[sem.estado];

  const hitos: { key: keyof typeof pedido; fechaKey: keyof typeof pedido; label: string }[] = [
    { key: "telaPedida", fechaKey: "telaPedidaFecha", label: "Tela pedida" },
    { key: "telaRecibida", fechaKey: "telaRecibidaFecha", label: "Tela recibida" },
    { key: "estructuraHecha", fechaKey: "estructuraHechaFecha", label: "Estructura hecha" },
    { key: "tapizadoHecho", fechaKey: "tapizadoHechoFecha", label: "Tapizado hecho" },
    { key: "entregado", fechaKey: "entregadoFecha", label: "Entregado" },
  ];

  return (
    <div className="space-y-4">
      <Link to="/pedidos" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" /> Volver a pedidos
      </Link>

      {/* Header */}
      <div className={`flex flex-wrap items-start justify-between gap-3 rounded-xl border-2 bg-white p-4 shadow-sm md:p-6 ${c.border}`}>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Package className="h-5 w-5 text-[#1a1f36]" />
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
            {producto ? `${TIPOS_PRODUCTO.find(t => t.id === producto.tipo)?.label ?? producto.tipo} · ${producto.modelo}` : "Producto"}
          </div>
          <div className={`mt-2 inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium ${c.bg} ${c.text}`}>
            <span className={`h-2 w-2 rounded-full ${c.dot}`} />
            {c.label} · Hito real {sem.hitoActual}/4 — esperado {sem.hitoEsperado}/4
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
                type="number"
                min={1}
                defaultValue={pedido.diasPlazo}
                key={pedido.diasPlazo}
                onBlur={(e) => {
                  const v = Math.max(1, parseInt(e.target.value) || 20);
                  if (v !== pedido.diasPlazo) void actions.updatePedido(pedido.id, { diasPlazo: v });
                }}
                className="mt-1 w-24 rounded border border-slate-200 px-2 py-1 text-sm focus:border-slate-400 focus:outline-none"
              />
            </div>
            <div>
              <div className="text-xs text-slate-500">Fecha límite</div>
              <div className={`text-sm font-bold ${sem.diasRestantes < 0 ? "text-rose-700" : "text-slate-900"}`}>
                {formatShortDate(pedido.fechaLimite)}
                {!pedido.entregado && (
                  <span className="ml-2 text-xs font-normal text-slate-500">
                    ({sem.diasRestantes >= 0 ? `${sem.diasRestantes}d restantes` : `${Math.abs(sem.diasRestantes)}d tarde`})
                  </span>
                )}
              </div>
            </div>
            <div>
              <label className="text-xs text-slate-500">Fecha de entrega real</label>
              <input
                type="date"
                defaultValue={pedido.fechaEntregaReal}
                key={"er-" + pedido.fechaEntregaReal}
                onBlur={(e) => {
                  if (e.target.value !== pedido.fechaEntregaReal) {
                    void actions.updatePedido(pedido.id, { fechaEntregaReal: e.target.value });
                  }
                }}
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
              <input
                type="number" step="0.01" defaultValue={pedido.precio} key={"p-" + pedido.precio}
                onBlur={(e) => { const v = parseFloat(e.target.value) || 0; if (v !== pedido.precio) void actions.updatePedido(pedido.id, { precio: v }); }}
                className="w-full rounded border border-slate-200 px-2 py-1 focus:border-slate-400 focus:outline-none"
              />
            </Field>
            {lead?.clienteTipo === "partner_ab" && (
              <Field label="Precio con IVA (€)">
                <input
                  type="number" step="0.01" defaultValue={pedido.precioConIva ?? ""} key={"piva-" + pedido.precioConIva}
                  onBlur={(e) => { const v = e.target.value === "" ? null : parseFloat(e.target.value); if (v !== pedido.precioConIva) void actions.updatePedido(pedido.id, { precioConIva: v as number | null }); }}
                  className="w-full rounded border border-slate-200 px-2 py-1 focus:border-slate-400 focus:outline-none"
                />
              </Field>
            )}
            <Field label="Coste envío (€)">
              <input
                type="number" step="0.01" defaultValue={pedido.costeEnvio} key={"e-" + pedido.costeEnvio}
                onBlur={(e) => { const v = parseFloat(e.target.value) || 0; if (v !== pedido.costeEnvio) void actions.updatePedido(pedido.id, { costeEnvio: v }); }}
                className="w-full rounded border border-slate-200 px-2 py-1 focus:border-slate-400 focus:outline-none"
              />
            </Field>
            <Field label="Reserva (€)">
              <input
                type="number" step="0.01" defaultValue={pedido.reserva} key={"r-" + pedido.reserva}
                onBlur={(e) => { const v = parseFloat(e.target.value) || 0; if (v !== pedido.reserva) void actions.updatePedido(pedido.id, { reserva: v }); }}
                className="w-full rounded border border-slate-200 px-2 py-1 focus:border-slate-400 focus:outline-none"
              />
            </Field>
            <label className="flex items-center gap-2">
              <input
                type="checkbox" checked={pedido.pagadoCompleto}
                onChange={(e) => actions.updatePedido(pedido.id, { pagadoCompleto: e.target.checked })}
                className="h-4 w-4 rounded border-slate-300"
              />
              <span>Pagado completo</span>
            </label>
            <Field label="Factura nº">
              <input
                type="text" defaultValue={pedido.factura} key={"f-" + pedido.factura}
                onBlur={(e) => { if (e.target.value !== pedido.factura) void actions.updatePedido(pedido.id, { factura: e.target.value }); }}
                className="w-full rounded border border-slate-200 px-2 py-1 focus:border-slate-400 focus:outline-none"
              />
            </Field>
            <div className="flex items-center justify-between border-t border-slate-100 pt-2 text-xs">
              <span className="text-slate-500">Total (precio + envío)</span>
              <span className="font-bold text-slate-900">{formatCurrency(pedido.precio + pedido.costeEnvio)}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500">Pendiente</span>
              <span className="font-bold text-slate-900">
                {formatCurrency(Math.max(0, pedido.precio + pedido.costeEnvio - pedido.reserva - (pedido.pagadoCompleto ? (pedido.precio + pedido.costeEnvio - pedido.reserva) : 0)))}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Hitos */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Ruta de producción</div>
        <div className="space-y-2">
          {hitos.map((h) => {
            const checked = pedido[h.key] as boolean;
            const fecha = pedido[h.fechaKey] as string;
            return (
              <div key={h.key} className={`flex flex-wrap items-center gap-3 rounded-lg border p-3 ${checked ? "border-emerald-200 bg-emerald-50/50" : "border-slate-200 bg-white"}`}>
                <label className="flex flex-1 cursor-pointer items-center gap-2">
                  <input
                    type="checkbox" checked={checked}
                    onChange={(e) => {
                      const next: Partial<typeof pedido> = { [h.key]: e.target.checked } as Partial<typeof pedido>;
                      if (e.target.checked && !fecha) {
                        const today = new Date().toISOString().slice(0, 10);
                        (next as Record<string, unknown>)[h.fechaKey] = today;
                      }
                      void actions.updatePedido(pedido.id, next);
                    }}
                    className="h-5 w-5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className={`font-medium ${checked ? "text-slate-900" : "text-slate-600"}`}>{h.label}</span>
                </label>
                {checked && (
                  <input
                    type="date" defaultValue={fecha} key={h.fechaKey + fecha}
                    onBlur={(e) => {
                      if (e.target.value !== fecha) {
                        void actions.updatePedido(pedido.id, { [h.fechaKey]: e.target.value } as Partial<typeof pedido>);
                      }
                    }}
                    className="rounded border border-slate-200 px-2 py-1 text-xs"
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Telas */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Telas</div>
          <button
            onClick={() => {
              const tipo = prompt("Tipo de tela (ej: Frontal, Lateral, Vivo…)");
              if (tipo && tipo.trim()) void actions.addPedidoTela(pedido.id, tipo.trim());
            }}
            className="inline-flex items-center gap-1 rounded-lg bg-[#1a1f36] px-3 py-1 text-xs font-medium text-white hover:bg-[#2a2f46]"
          >
            <Plus className="h-3.5 w-3.5" /> Añadir tela
          </button>
        </div>
        {telas.length === 0 ? (
          <div className="py-4 text-center text-sm text-slate-400">Sin telas registradas</div>
        ) : (
          <div className="space-y-2">
            {telas.map((t) => (
              <div key={t.id} className="grid grid-cols-1 gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 sm:grid-cols-[120px_1fr_120px_140px_auto] sm:items-center">
                <input
                  type="text" defaultValue={t.tipoTela} key={"tt-" + t.tipoTela}
                  onBlur={(e) => { if (e.target.value !== t.tipoTela) void actions.updatePedidoTela(t.id, { tipoTela: e.target.value }); }}
                  placeholder="Tipo"
                  className="rounded border border-slate-200 bg-white px-2 py-1 text-sm font-medium"
                />
                <input
                  type="text" defaultValue={t.nombreTela} key={"nt-" + t.nombreTela}
                  onBlur={(e) => { if (e.target.value !== t.nombreTela) void actions.updatePedidoTela(t.id, { nombreTela: e.target.value }); }}
                  placeholder="Nombre de la tela"
                  className="rounded border border-slate-200 bg-white px-2 py-1 text-sm"
                />
                <select
                  value={t.estado}
                  onChange={(e) => actions.updatePedidoTela(t.id, { estado: e.target.value })}
                  className="rounded border border-slate-200 bg-white px-2 py-1 text-sm"
                >
                  <option value="Pedida">Pedida</option>
                  <option value="Recibida">Recibida</option>
                </select>
                <input
                  type="date" defaultValue={t.fechaRecibo} key={"fr-" + t.fechaRecibo}
                  onBlur={(e) => { if (e.target.value !== t.fechaRecibo) void actions.updatePedidoTela(t.id, { fechaRecibo: e.target.value }); }}
                  className="rounded border border-slate-200 bg-white px-2 py-1 text-sm"
                />
                <button
                  onClick={() => { if (confirm("¿Eliminar esta tela?")) void actions.deletePedidoTela(t.id); }}
                  className="justify-self-end rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Colaboración (canje) */}
      <ColaboracionPanel pedido={pedido} lead={lead} />

      {/* Notas */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Notas del pedido</div>
        <textarea
          rows={3}
          defaultValue={pedido.notasPedido}
          key={"np-" + pedido.notasPedido}
          onBlur={(e) => { if (e.target.value !== pedido.notasPedido) void actions.updatePedido(pedido.id, { notasPedido: e.target.value }); }}
          placeholder="Notas internas sobre este pedido…"
          className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
        />
      </div>
    </div>
  );
}

function ColaboracionPanel({ pedido, lead }: { pedido: Pedido; lead: Lead | undefined }) {
  const esInflu = lead?.tipo === "INFLUENCER";
  // Se muestra si ya es canje, o si el cliente es influencer (para poder marcarlo).
  if (!pedido.esCanje && !esInflu) return null;
  const tipoConocido = (TIPOS_COLAB as readonly string[]).includes(pedido.tipoColaboracion);
  const selectValue = pedido.tipoColaboracion === "" ? "" : tipoConocido ? pedido.tipoColaboracion : "Otros";
  return (
    <div className="rounded-xl border border-pink-200 bg-pink-50/40 p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-xs font-semibold uppercase tracking-wide text-pink-600">Colaboración (canje)</div>
        <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-medium text-slate-700">
          <input type="checkbox" checked={pedido.esCanje} onChange={(e) => actions.updatePedido(pedido.id, { esCanje: e.target.checked })} className="h-4 w-4 rounded border-slate-300 text-pink-600 focus:ring-pink-500" />
          Es canje (no cuenta como ingreso)
        </label>
      </div>
      {pedido.esCanje && (
        <div className="space-y-3">
          <div>
            <div className="mb-1 text-xs text-slate-500">Formato (varios)</div>
            <div className="flex flex-wrap gap-1.5">
              {FORMATOS_COLAB.map((f) => {
                const on = (pedido.formatos || []).includes(f);
                return (
                  <button key={f} type="button"
                    onClick={() => {
                      const next = on ? pedido.formatos.filter((x) => x !== f) : [...(pedido.formatos || []), f];
                      actions.updatePedido(pedido.id, { formatos: next });
                    }}
                    className={`rounded-full border px-3 py-1.5 text-xs font-medium ${on ? "border-pink-500 bg-pink-500 text-white" : "border-slate-200 bg-white text-slate-600"}`}>
                    {f}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <div className="mb-1 text-xs text-slate-500">Tipo de colaboración</div>
            <select
              value={selectValue}
              onChange={(e) => actions.updatePedido(pedido.id, { tipoColaboracion: e.target.value === "Otros" ? "" : e.target.value })}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              <option value="">— Selecciona —</option>
              {TIPOS_COLAB.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            {selectValue === "Otros" && (
              <input
                defaultValue={tipoConocido ? "" : pedido.tipoColaboracion}
                key={"otros-" + pedido.id}
                onBlur={(e) => actions.updatePedido(pedido.id, { tipoColaboracion: e.target.value })}
                placeholder="Describe la colaboración"
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
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
