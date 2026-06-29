import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Plus, Clock, X, ChevronDown } from "lucide-react";
import { useState, useRef } from "react";
import { useStore, actions, nextPendingTaskFor } from "@/lib/store";
import { ETAPAS, ETAPA_COLORS, VENDEDORES, vendorName, type Etapa } from "@/lib/types";
import { formatCurrency, dateLabel } from "@/lib/format";
import { sellerStyle } from "@/components/SellerBadge";
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

function vendorFirst(v: string) {
  return vendorName(v).split(" ")[0];
}

function daysInStage(lead: ReturnType<typeof useStore>["leads"][0]): number {
  if (!lead.fechaEntradaEtapa) return 0;
  const diff = Date.now() - new Date(lead.fechaEntradaEtapa).getTime();
  return Math.max(0, Math.floor(diff / 86400000));
}

// Urgency colors removed for now — días en etapa se muestra en gris neutro.


function LeadCard({ lead, tareas, onNavigate }: { lead: ReturnType<typeof useStore>["leads"][0]; tareas: ReturnType<typeof useStore>["tareas"]; onNavigate: () => void }) {
  const next = nextPendingTaskFor(lead.id, tareas);
  const dot = sellerStyle(lead.vendedor).dot;
  const closed = lead.etapa === "Closed Won" || lead.etapa === "Closed Lost";
  const days = daysInStage(lead);

  return (
    <div
      onClick={onNavigate}
      className="group relative cursor-pointer rounded-xl border border-slate-200 bg-white px-4 py-3.5 shadow-sm transition-all duration-150 hover:border-slate-300 hover:shadow-md"
    >
      {/* Delete — only on hover */}
      <div className="absolute right-2 top-2 opacity-0 transition-opacity group-hover:opacity-100" onClick={(e) => e.stopPropagation()}>
        <DeleteLeadButton id={lead.id} variant="menu" />
      </div>

      {/* Name */}
      <p className="truncate pr-6 text-[13px] font-semibold leading-snug text-slate-900">
        {lead.nombre}
      </p>

      {/* Valor — most important signal */}
      {lead.valor > 0 ? (
        <p className="mt-1.5 text-base font-bold tracking-tight text-slate-900">
          {formatCurrency(lead.valor)}
        </p>
      ) : (
        <p className="mt-1.5 text-sm font-medium text-slate-300">—</p>
      )}

      {/* Seller + product — compact, single line */}
      <div className="mt-2.5 flex items-center gap-1.5 text-xs text-slate-500">
        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${dot}`} />
        <span className="font-medium text-slate-600">{vendorFirst(lead.vendedor)}</span>
        {lead.producto && (
          <>
            <span className="text-slate-300">·</span>
            <span className="truncate">{lead.producto}</span>
          </>
        )}
      </div>

      {/* Días en etapa — neutro, sin colorear */}
      {!closed && (
        <div className="mt-2 flex items-center gap-1.5 rounded-lg bg-slate-100 px-2 py-1 text-[11px] text-slate-500">
          <Clock className="h-3 w-3 shrink-0 text-slate-400" />
          <span className="font-semibold">{days}d en esta etapa</span>
        </div>
      )}


      {/* Next task — subtle amber pill */}
      {next && (
        <div className="mt-2 flex items-center gap-1.5 rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs">
          <Clock className="h-3 w-3 shrink-0 text-amber-500" />
          <span className="shrink-0 font-semibold text-amber-700">{dateLabel(next.fecha)}</span>
          <span className="min-w-0 truncate text-slate-400">· {next.descripcion}</span>
        </div>
      )}
    </div>
  );
}

function Pipeline() {
  const { leads, tareas } = useStore();
  const navigate = useNavigate();
  const { etapa: filterEtapa, vendedor: filterVendedor } = Route.useSearch();
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<Etapa | null>(null);
  // Touch drag state (mobile support — HTML5 drag API doesn't work on touch)
  const touchDragId = useRef<string | null>(null);

  const visibleEtapas = filterEtapa ? ETAPAS.filter((e) => e === filterEtapa) : ETAPAS;
  const hasFilter = !!(filterEtapa || filterVendedor);

  function setVendedor(v: string) {
    navigate({ to: "/pipeline", search: (prev: Record<string, unknown>) => ({ ...prev, vendedor: v || undefined }) });
  }
  function clearFilters() {
    navigate({ to: "/pipeline", search: {} });
  }

  return (
    <div className="flex h-full flex-col gap-4">

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-slate-900">Pipeline</h1>
          <p className="text-xs text-slate-400">Arrastra las tarjetas para mover etapas</p>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <div className="relative min-w-0 flex-1 sm:flex-initial">
            <select
              value={filterVendedor ?? ""}
              onChange={(e) => setVendedor(e.target.value)}
              className="w-full appearance-none rounded-lg border border-slate-200 bg-white py-1.5 pl-3 pr-7 text-xs font-medium text-slate-700 focus:border-slate-400 focus:outline-none"
            >
              <option value="">Todos los vendedores</option>
              {VENDEDORES.map((v) => (
                <option key={v} value={v}>{vendorName(v)}</option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          </div>
          {hasFilter && (
            <button onClick={clearFilters} className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-500 hover:bg-slate-50">
              <X className="h-3 w-3" /> Quitar
            </button>
          )}
          <Link
            to="/clientes/nuevo"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-[#1a1f36] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#2a2f46]"
          >
            <Plus className="h-3.5 w-3.5" /> Nuevo Lead
          </Link>
        </div>
      </div>

      {/* Columns */}
      <div className="-mx-4 overflow-x-auto px-4 pb-6 md:mx-0 md:px-0">
        <div className={`flex snap-x snap-mandatory gap-3 md:snap-none ${filterEtapa ? "md:max-w-sm" : "md:grid md:grid-cols-6"}`}>
          {visibleEtapas.map((etapa) => {
            const colLeads = leads.filter(
              (l) => l.etapa === etapa && (!filterVendedor || !l.vendedor || l.vendedor === filterVendedor)
            );
            const total = colLeads.reduce((s, l) => s + l.valor, 0);
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
                {/* Colored top accent */}
                <div className="h-1 w-full rounded-t-xl" style={{ backgroundColor: color }} />

                {/* Column header */}
                <div className="flex items-center gap-2 px-3 pt-3 pb-2">
                  <span className="min-w-0 truncate text-xs font-semibold text-slate-700">{etapa}</span>
                  <span className="ml-auto shrink-0 flex h-4.5 min-w-[1.25rem] items-center justify-center rounded-full bg-white border border-slate-200 px-1.5 text-[10px] font-bold text-slate-500">
                    {colLeads.length}
                  </span>
                </div>

                {/* Total */}
                <div className="px-3 pb-2.5">
                  {total > 0 ? (
                    <span className="text-[11px] font-semibold text-slate-500">{formatCurrency(total)}</span>
                  ) : (
                    <span className="text-[11px] text-slate-300">—</span>
                  )}
                </div>

                {/* Cards */}
                <div className="space-y-2 px-2 pb-3">
                  {colLeads.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-200 py-6 text-center text-xs text-slate-300">
                      Sin leads
                    </div>
                  ) : (
                    colLeads.map((lead) => (
                      <div
                        key={lead.id}
                        draggable
                        onDragStart={() => setDraggingId(lead.id)}
                        onDragEnd={() => setDraggingId(null)}
                        onTouchStart={() => { touchDragId.current = lead.id; }}
                        onTouchMove={(e) => {
                          if (!touchDragId.current) return;
                          const touch = e.touches[0];
                          const el = document.elementFromPoint(touch.clientX, touch.clientY);
                          const col = el?.closest("[data-etapa]");
                          const over = col?.getAttribute("data-etapa") as Etapa | null;
                          setDragOver(over ?? null);
                        }}
                        onTouchEnd={() => {
                          if (touchDragId.current && dragOver) {
                            actions.setLeadEtapa(touchDragId.current, dragOver);
                          }
                          touchDragId.current = null;
                          setDragOver(null);
                        }}
                      >
                        <LeadCard
                          lead={lead}
                          tareas={tareas}
                          onNavigate={() => navigate({ to: "/clientes/$id", params: { id: lead.id } })}
                        />
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
