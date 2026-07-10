import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Plus, Clock, X, ChevronDown, List } from "lucide-react";
import { useState } from "react";
import { useStore, actions } from "@/lib/store";
import { ETAPAS_B2B, ETAPA_COLORS, ASIGNADOS_B2B, type EtapaB2B, type Lead } from "@/lib/types";
import { formatCurrency } from "@/lib/format";
import { useTouchStageDrag } from "@/lib/stage-drag";
import { DeleteLeadButton } from "@/components/DeleteLeadButton";

interface Search {
  etapa?: EtapaB2B;
  asignado?: string;
}

export const Route = createFileRoute("/pipeline-b2b")({
  head: () => ({ meta: [{ title: "Pipeline B2B — TiroCRM" }] }),
  validateSearch: (s: Record<string, unknown>): Search => {
    const e = s.etapa as EtapaB2B | undefined;
    const a = s.asignado as string | undefined;
    return {
      ...(e && (ETAPAS_B2B as readonly string[]).includes(e) ? { etapa: e } : {}),
      ...(a ? { asignado: a } : {}),
    };
  },
  component: PipelineB2B,
});

function LeadCard({ lead, onNavigate }: { lead: Lead; onNavigate: () => void }) {
  const titulo = lead.razonSocial || lead.contactoNombre || lead.nombre;
  return (
    <div
      onClick={onNavigate}
      className="group relative cursor-pointer rounded-xl border border-slate-200 bg-white px-4 py-3.5 shadow-sm transition-all duration-150 hover:border-slate-300 hover:shadow-md"
    >
      <div className="absolute right-2 top-2 opacity-0 transition-opacity group-hover:opacity-100" onClick={(e) => e.stopPropagation()}>
        <DeleteLeadButton id={lead.id} variant="menu" />
      </div>
      <p className="truncate pr-6 text-[13px] font-semibold leading-snug text-slate-900">{titulo}</p>
      {lead.contactoNombre && (
        <p className="mt-0.5 truncate text-[11px] text-slate-500">{lead.contactoNombre} {lead.contactoApellidos}</p>
      )}
      {lead.valor > 0 && (
        <p className="mt-1.5 text-base font-bold text-slate-900">{formatCurrency(lead.valor)}</p>
      )}
      {(lead.asignados ?? []).length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1">
          {lead.asignados.map((a) => (
            <span key={a} className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">{a}</span>
          ))}
        </div>
      ) : (
        <div className="mt-2 text-[10px] text-slate-400">Sin asignar</div>
      )}
      {lead.instagram && <div className="mt-1.5 truncate text-[11px] text-pink-600">{lead.instagram}</div>}
    </div>
  );
}

function PipelineB2B() {
  const { leads } = useStore();
  const navigate = useNavigate();
  const { etapa: filterEtapa, asignado: filterAsignado } = Route.useSearch();
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<EtapaB2B | null>(null);
  const touchHandlers = useTouchStageDrag<EtapaB2B>(setDragOver, setDraggingId, actions.setLeadEtapa);

  const b2b = leads.filter((l) => l.tipo === "B2B");
  const visibleEtapas = filterEtapa ? ETAPAS_B2B.filter((e) => e === filterEtapa) : ETAPAS_B2B;

  function setAsignado(v: string) {
    navigate({ to: "/pipeline-b2b", search: (prev: Record<string, unknown>) => ({ ...prev, asignado: v || undefined }) });
  }
  function clearFilters() {
    navigate({ to: "/pipeline-b2b", search: {} });
  }

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-slate-900">Pipeline B2B</h1>
          <p className="text-xs text-slate-400">Arrastra (o mantén pulsado en móvil) para mover de etapa</p>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <div className="relative min-w-0 flex-1 sm:flex-initial">
            <select
              value={filterAsignado ?? ""}
              onChange={(e) => setAsignado(e.target.value)}
              className="w-full appearance-none rounded-lg border border-slate-200 bg-white py-1.5 pl-3 pr-7 text-xs font-medium text-slate-700 focus:border-slate-400 focus:outline-none"
            >
              <option value="">Todos los asignados</option>
              {ASIGNADOS_B2B.map((a) => (<option key={a} value={a}>{a}</option>))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          </div>
          {(filterEtapa || filterAsignado) && (
            <button onClick={clearFilters} className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-500 hover:bg-slate-50">
              <X className="h-3 w-3" /> Quitar
            </button>
          )}
          <Link to="/b2b" className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-600 hover:bg-slate-50">
            <List className="h-3 w-3" /> Lista
          </Link>
          <Link to="/b2b/nuevo" className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-[#1a4b5b] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#245e73]">
            <Plus className="h-3.5 w-3.5" /> Nueva empresa
          </Link>
        </div>
      </div>

      <div className="-mx-4 overflow-x-auto px-4 pb-6 md:mx-0 md:px-0">
        <div className={`flex snap-x snap-mandatory gap-3 md:snap-none ${filterEtapa ? "md:max-w-sm" : "md:grid md:grid-cols-4"}`}>
          {visibleEtapas.map((etapa) => {
            const colLeads = b2b.filter((l) =>
              l.etapa === etapa && (!filterAsignado || (l.asignados ?? []).includes(filterAsignado))
            );
            const total = colLeads.reduce((s, l) => s + (l.valor || 0), 0);
            const isOver = dragOver === etapa;
            const color = ETAPA_COLORS[etapa];

            return (
              <div
                key={etapa}
                data-etapa={etapa}
                onDragOver={(e) => { e.preventDefault(); setDragOver(etapa); }}
                onDragLeave={() => setDragOver(null)}
                onDrop={() => {
                  if (draggingId) actions.setLeadEtapa(draggingId, etapa);
                  setDraggingId(null);
                  setDragOver(null);
                }}
                className={`w-[78vw] shrink-0 snap-center rounded-xl border md:w-auto md:min-w-0 md:shrink transition-colors duration-150 ${
                  isOver ? "border-slate-400 bg-slate-100" : "border-slate-200 bg-slate-50/60"
                }`}
              >
                <div className="h-1 w-full rounded-t-xl" style={{ backgroundColor: color }} />
                <div className="flex items-center gap-2 px-3 pt-3 pb-2">
                  <span className="min-w-0 truncate text-xs font-semibold text-slate-700">{etapa}</span>
                  <span className="ml-auto shrink-0 flex h-4.5 min-w-[1.25rem] items-center justify-center rounded-full bg-white border border-slate-200 px-1.5 text-[10px] font-bold text-slate-500">
                    {colLeads.length}
                  </span>
                </div>
                <div className="px-3 pb-2.5">
                  {total > 0 ? (
                    <span className="text-[11px] font-semibold text-slate-500">{formatCurrency(total)}</span>
                  ) : (
                    <span className="text-[11px] text-slate-300">—</span>
                  )}
                </div>
                <div className="space-y-2 px-2 pb-3">
                  {colLeads.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-200 py-6 text-center text-xs text-slate-300">
                      Sin empresas
                    </div>
                  ) : (
                    colLeads.map((lead) => (
                      <div
                        key={lead.id}
                        draggable
                        onDragStart={() => setDraggingId(lead.id)}
                        onDragEnd={() => setDraggingId(null)}
                        {...touchHandlers(lead.id, lead.etapa as EtapaB2B)}
                      >
                        <LeadCard lead={lead} onNavigate={() => navigate({ to: "/clientes/$id", params: { id: lead.id } })} />
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
