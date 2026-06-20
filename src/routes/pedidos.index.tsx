import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Package, AlertTriangle, Filter, X } from "lucide-react";
import { useStore } from "@/lib/store";
import { semaforoPedido, estadoColumna, ESTADOS_PEDIDO_COL, type RutaEstado } from "@/lib/types";
import { formatShortDate, formatCurrency } from "@/lib/format";
import { TIPOS_PRODUCTO } from "@/components/ProductoForm";

export const Route = createFileRoute("/pedidos/")({
  head: () => ({ meta: [{ title: "Pedidos — TiroCRM" }] }),
  component: PedidosIndex,
});

const SEM_COLOR: Record<RutaEstado, { bg: string; text: string; dot: string; label: string }> = {
  verde: { bg: "bg-emerald-50",  text: "text-emerald-700", dot: "bg-emerald-500", label: "A tiempo" },
  ambar: { bg: "bg-amber-50",    text: "text-amber-700",   dot: "bg-amber-500",   label: "En riesgo" },
  rojo:  { bg: "bg-rose-50",     text: "text-rose-700",    dot: "bg-rose-500",    label: "Atrasado" },
};

function PedidosIndex() {
  const { pedidos, leads, productos } = useStore();
  const [view, setView] = useState<"kanban" | "lista">("kanban");
  const [filtro, setFiltro] = useState<"todos" | "cortos" | "atrasados">("todos");

  const enriched = useMemo(() => pedidos.map((p) => {
    const lead = leads.find((l) => l.id === p.leadId);
    const prod = productos.find((pr) => pr.id === p.productoLeadId);
    const sem = semaforoPedido(p);
    return { pedido: p, lead, producto: prod, sem };
  }), [pedidos, leads, productos]);

  const filtered = enriched.filter(({ pedido, sem }) => {
    if (filtro === "cortos") return pedido.diasPlazo <= 7;
    if (filtro === "atrasados") return sem.estado !== "verde" && !pedido.entregado;
    return true;
  });

  const atrasados = enriched.filter(({ pedido, sem }) => {
    if (pedido.entregado) return false;
    return sem.estado === "rojo";
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
            <Package className="h-6 w-6 text-[#1a1f36]" /> Pedidos
          </h1>
          <p className="text-sm text-slate-500">{filtered.length} de {pedidos.length} pedidos</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5">
            <button onClick={() => setView("kanban")} className={`rounded-md px-3 py-1 text-xs font-medium ${view === "kanban" ? "bg-[#1a1f36] text-white" : "text-slate-600"}`}>Kanban</button>
            <button onClick={() => setView("lista")} className={`rounded-md px-3 py-1 text-xs font-medium ${view === "lista" ? "bg-[#1a1f36] text-white" : "text-slate-600"}`}>Lista</button>
          </div>
          <select
            value={filtro}
            onChange={(e) => setFiltro(e.target.value as typeof filtro)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700"
          >
            <option value="todos">Todos</option>
            <option value="atrasados">Solo en riesgo / atrasados</option>
            <option value="cortos">Plazos cortos (≤7 días)</option>
          </select>
        </div>
      </div>

      {/* Pedidos atrasados — franja superior */}
      {atrasados.length > 0 && (
        <div className="rounded-xl border-2 border-rose-200 bg-rose-50/60 p-4">
          <div className="mb-3 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-rose-600" />
            <h2 className="text-sm font-bold uppercase tracking-wide text-rose-700">
              {atrasados.length} pedido{atrasados.length > 1 ? "s" : ""} atrasado{atrasados.length > 1 ? "s" : ""}
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {atrasados.map(({ pedido, lead, producto, sem }) => (
              <Link key={pedido.id} to="/pedidos/$id" params={{ id: pedido.id }} className="block rounded-lg border border-rose-300 bg-white p-3 transition-shadow hover:shadow-md">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-slate-900">{lead?.nombre ?? "—"}</div>
                    <div className="truncate text-xs text-slate-500">{producto?.modelo || producto?.tipo || "Producto"}</div>
                  </div>
                  <span className="shrink-0 rounded-full bg-rose-600 px-2 py-0.5 text-[10px] font-bold text-white">
                    {sem.diasRestantes < 0 ? `${Math.abs(sem.diasRestantes)}d tarde` : "límite hoy"}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {view === "kanban" ? (
        <div className="-mx-4 overflow-x-auto px-4 pb-6 md:mx-0 md:px-0">
          <div className="flex snap-x snap-mandatory gap-3 md:grid md:grid-cols-5">
            {ESTADOS_PEDIDO_COL.map((col) => {
              const colPedidos = filtered.filter(({ pedido }) => estadoColumna(pedido) === col);
              return (
                <div key={col} className="w-[78vw] shrink-0 snap-center rounded-xl border border-slate-200 bg-slate-50/60 md:w-auto md:min-w-0">
                  <div className="flex items-center gap-2 px-3 pt-3 pb-2">
                    <span className="min-w-0 truncate text-xs font-semibold text-slate-700">{col}</span>
                    <span className="ml-auto shrink-0 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-white border border-slate-200 px-1.5 text-[10px] font-bold text-slate-500">
                      {colPedidos.length}
                    </span>
                  </div>
                  <div className="space-y-2 p-2">
                    {colPedidos.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-slate-200 py-6 text-center text-xs text-slate-300">
                        Vacío
                      </div>
                    ) : (
                      colPedidos.map(({ pedido, lead, producto, sem }) => {
                        const c = SEM_COLOR[sem.estado];
                        return (
                          <Link key={pedido.id} to="/pedidos/$id" params={{ id: pedido.id }} className="block rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm transition-shadow hover:shadow-md">
                            <div className="flex items-center gap-1.5">
                              <span className={`h-2 w-2 shrink-0 rounded-full ${c.dot}`} title={c.label} />
                              <span className="truncate text-[13px] font-semibold text-slate-900">{lead?.nombre ?? "—"}</span>
                            </div>
                            <div className="mt-1 truncate text-xs text-slate-500">{producto?.modelo || producto?.tipo || "Producto"}</div>
                            <div className={`mt-2 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium ${c.bg} ${c.text}`}>
                              {pedido.entregado
                                ? "Entregado"
                                : sem.diasRestantes >= 0
                                  ? `${sem.diasRestantes}d restantes`
                                  : `${Math.abs(sem.diasRestantes)}d tarde`}
                            </div>
                          </Link>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3">Producto</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3">Plazo</th>
                <th className="px-4 py-3">Fecha límite</th>
                <th className="px-4 py-3">Precio</th>
                <th className="px-4 py-3">Semáforo</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(({ pedido, lead, producto, sem }) => {
                const c = SEM_COLOR[sem.estado];
                return (
                  <tr key={pedido.id} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <Link to="/pedidos/$id" params={{ id: pedido.id }} className="font-semibold text-slate-900 hover:text-[#1a4b5b] hover:underline">
                        {lead?.nombre ?? "—"}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {producto ? (TIPOS_PRODUCTO.find(t => t.id === producto.tipo)?.label ?? producto.tipo) : "—"} · {producto?.modelo}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{estadoColumna(pedido)}</td>
                    <td className="px-4 py-3 text-slate-600">{pedido.diasPlazo}d</td>
                    <td className="px-4 py-3 text-slate-600">{formatShortDate(pedido.fechaLimite)}</td>
                    <td className="px-4 py-3 font-medium">{formatCurrency(pedido.precio)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium ${c.bg} ${c.text}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${c.dot}`} />
                        {c.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-slate-400">Sin pedidos</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
