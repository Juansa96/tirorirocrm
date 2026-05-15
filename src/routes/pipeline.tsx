import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Plus, Clock, X, ChevronDown } from "lucide-react";
import { useState } from "react";
import { useStore, actions, nextPendingTaskFor } from "@/lib/store";
import { ETAPAS, ETAPA_COLORS, VENDEDORES, vendorName, type Etapa } from "@/lib/types";
import { formatCurrency, dateLabel } from "@/lib/format";
import { SellerBadge } from "@/components/SellerBadge";
import { DeleteLeadButton } from "@/components/DeleteLeadButton";

interface Search {
  etapa?: Etapa;
  vendedor?: string;
}

export const Route = createFileRoute("/pipeline")({
  head: () => ({ meta: [{ title: "Pipeline — TiroCRM" }] }),
  validateSearch: (s: Record<string, unknown>): Search => {
    const e = s.etapa as Etapa | undefined;
    const v = s.vendedor as string | undefined;
    return {
      ...(e && ETAPAS.includes(e) ? { etapa: e } : {}),
      ...(v && VENDEDORES.includes(v as never) ? { vendedor: v } : {}),
    };
  },
  component: Pipeline,
});

function Pipeline() {
  const { leads, tareas } = useStore();
  const navigate = useNavigate();
  const { etapa: filterEtapa, vendedor: filterVendedor } = Route.useSearch();
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<Etapa | null>(null);

  const visibleEtapas = filterEtapa ? ETAPAS.filter((e) => e === filterEtapa) : ETAPAS;
  const hasFilter = !!(filterEtapa || filterVendedor);

  function setVendedor(v: string) {
    navigate({ to: "/pipeline", search: (prev: Record<string, unknown>) => ({ ...prev, vendedor: v || undefined }) });
  }
  function clearFilters() {
    navigate({ to: "/pipeline", search: {} });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Pipeline</h1>
          <p className="text-sm text-slate-500">Arrastra las tarjetas para cambiar de etapa</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Vendedor filter */}
          <div className="relative">
            <select
              value={filterVendedor ?? ""}
              onChange={(e) => setVendedor(e.target.value)}
              className="appearance-none rounded-lg border border-slate-200 bg-white py-2 pl-3 pr-8 text-sm text-slate-700 focus:border-slate-400 focus:outline-none"
            >
              <option value="">Todos los vendedores</option>
              {VENDEDORES.map((v) => (
                <option key={v} value={v}>{vendorName(v)}</option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          </div>
          <Link to="/clientes/nuevo" className="inline-flex items-center gap-1.5 rounded-lg bg-[#1a1f36] px-4 py-2 text-sm font-medium text-white hover:bg-[#2a2f46]">
            <Plus className="h-4 w-4" /> Nuevo Lead
          </Link>
        </div>
      </div>

      {hasFilter && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
          <span className="text-slate-500">Filtros activos:</span>
          {filterEtapa && (
            <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium text-white" style={{ backgroundColor: ETAPA_COLORS[filterEtapa as Etapa] }}>
              {filterEtapa}
            </span>
          )}
          {filterVendedor && (
            <span className="inline-flex items-center rounded-full bg-slate-700 px-2 py-0.5 text-xs font-medium text-white">
              {vendorName(filterVendedor)}
            </span>
          )}
          <button onClick={clearFilters} className="ml-auto inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-slate-600 hover:bg-slate-100">
            <X className="h-3 w-3" /> Quitar filtros
          </button>
        </div>
      )}

      <div className="-mx-4 overflow-x-auto px-4 pb-4 md:mx-0 md:px-0">
        <div className={`flex snap-x snap-mandatory gap-3 md:snap-none ${filterEtapa ? "md:max-w-md" : "md:grid md:grid-cols-6"}`}>
          {visibleEtapas.map((etapa) => {
            const colLeads = leads.filter((l) => l.etapa === etapa && (!filterVendedor || l.vendedor === filterVendedor));
            const total = colLeads.reduce((s, l) => s + l.valor, 0);
            const isOver = dragOver === etapa;
            return (
              <div
                key={etapa}
                onDragOver={(e) => { e.preventDefault(); setDragOver(etapa); }}
                onDragLeave={() => setDragOver(null)}
                onDrop={() => {
                  if (draggingId) actions.setLeadEtapa(draggingId, etapa);
                  setDraggingId(null);
                  setDragOver(null);
                }}
                className={`w-[80vw] shrink-0 snap-center rounded-xl border bg-slate-50 p-3 md:w-auto md:min-w-0 md:shrink ${
                  isOver ? "border-slate-400 bg-slate-100" : "border-slate-200"
                }`}
              >
                <div className="mb-3 flex items-center justify-between rounded-lg px-2 py-2 text-white" style={{ backgroundColor: ETAPA_COLORS[etapa] }}>
                  <div className="text-xs font-semibold leading-tight">{etapa}</div>
                  <div className="ml-1 shrink-0 text-xs opacity-90">{colLeads.length}</div>
                </div>
                {total > 0 && <div className="mb-2 px-1 text-xs font-medium text-slate-600">{formatCurrency(total)}</div>}
                <div className="space-y-2">
                  {colLeads.length === 0 && (
                    <div className="rounded-lg border border-dashed border-slate-300 p-3 text-center text-xs text-slate-400">
                      Vacío
                    </div>
                  )}
                  {colLeads.map((lead) => {
                    const next = nextPendingTaskFor(lead.id, tareas);
                    return (
                      <div
                        key={lead.id}
                        draggable
                        onDragStart={() => setDraggingId(lead.id)}
                        onDragEnd={() => setDraggingId(null)}
                        onClick={() => navigate({ to: "/clientes/$id", params: { id: lead.id } })}
                        className="cursor-pointer rounded-lg border border-slate-200 bg-white p-3 shadow-sm transition-shadow duration-150 hover:shadow-md"
                      >
                        <div className="flex items-start justify-between gap-1">
                          <div className="min-w-0 text-sm font-semibold leading-snug text-slate-900">{lead.nombre}</div>
                          <DeleteLeadButton id={lead.id} variant="menu" />
                        </div>
                        {lead.valor > 0 && (
                          <div className="mt-1 text-xs font-semibold text-emerald-700">{formatCurrency(lead.valor)}</div>
                        )}
                        <div className="mt-2 flex flex-wrap items-center gap-1">
                          <SellerBadge vendedor={lead.vendedor} />
                          {lead.producto && (
                            <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">{lead.producto}</span>
                          )}
                        </div>
                        {next && (
                          <div className="mt-2 flex items-center gap-1 text-xs text-slate-500">
                            <Clock className="h-3 w-3 shrink-0 text-amber-600" />
                            <span className="font-medium text-amber-700">{dateLabel(next.fecha)}</span>
                            <span className="min-w-0 truncate">· {next.descripcion}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
