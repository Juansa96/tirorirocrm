import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Plus, Clock } from "lucide-react";
import { useState } from "react";
import { useStore, actions, nextPendingTaskFor } from "@/lib/store";
import { ETAPAS, ETAPA_COLORS, type Etapa } from "@/lib/types";
import { formatCurrency, dateLabel } from "@/lib/format";
import { SellerBadge } from "@/components/SellerBadge";

export const Route = createFileRoute("/pipeline")({
  head: () => ({
    meta: [
      { title: "Pipeline — TiroCRM" },
      { name: "description", content: "Pipeline de ventas Kanban" },
    ],
  }),
  component: Pipeline,
});

function Pipeline() {
  const { leads, tareas } = useStore();
  const navigate = useNavigate();
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<Etapa | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Pipeline</h1>
          <p className="text-sm text-slate-500">
            Arrastra las tarjetas para cambiar de etapa
          </p>
        </div>
        <Link
          to="/clientes/nuevo"
          className="inline-flex items-center gap-1.5 rounded-lg bg-[#1a1f36] px-4 py-2 text-sm font-medium text-white hover:bg-[#2a2f46]"
        >
          <Plus className="h-4 w-4" /> Nuevo Lead
        </Link>
      </div>

      <div className="-mx-4 overflow-x-auto px-4 pb-4 md:mx-0 md:px-0">
        <div className="flex snap-x snap-mandatory gap-3 md:grid md:snap-none md:grid-cols-5">
          {ETAPAS.map((etapa) => {
            const colLeads = leads.filter((l) => l.etapa === etapa);
            const total = colLeads.reduce((s, l) => s + l.valor, 0);
            const isOver = dragOver === etapa;
            return (
              <div
                key={etapa}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(etapa);
                }}
                onDragLeave={() => setDragOver(null)}
                onDrop={() => {
                  if (draggingId) actions.setLeadEtapa(draggingId, etapa);
                  setDraggingId(null);
                  setDragOver(null);
                }}
                className={`w-[85vw] shrink-0 snap-center rounded-xl border bg-slate-50 p-3 md:w-auto md:shrink ${
                  isOver ? "border-slate-400 bg-slate-100" : "border-slate-200"
                }`}
              >
                <div
                  className="mb-3 flex items-center justify-between rounded-lg px-3 py-2 text-white"
                  style={{ backgroundColor: ETAPA_COLORS[etapa] }}
                >
                  <div className="text-sm font-semibold">{etapa}</div>
                  <div className="text-xs opacity-90">{colLeads.length}</div>
                </div>
                <div className="mb-3 px-1 text-xs font-medium text-slate-600">
                  {formatCurrency(total)}
                </div>
                <div className="space-y-2">
                  {colLeads.length === 0 && (
                    <div className="rounded-lg border border-dashed border-slate-300 p-4 text-center text-xs text-slate-400">
                      Sin leads en esta etapa
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
                        onClick={() =>
                          navigate({ to: "/clientes/$id", params: { id: lead.id } })
                        }
                        className="cursor-pointer rounded-lg border border-slate-200 bg-white p-3 shadow-sm transition-shadow duration-150 hover:shadow-md"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="text-sm font-semibold text-slate-900">
                            {lead.nombre}
                          </div>
                          {lead.valor > 0 && (
                            <div className="shrink-0 text-xs font-semibold text-slate-700">
                              {formatCurrency(lead.valor)}
                            </div>
                          )}
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          <SellerBadge vendedor={lead.vendedor} />
                          {lead.producto && (
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                              {lead.producto}
                            </span>
                          )}
                        </div>
                        {next && (
                          <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-500">
                            <Clock className="h-3 w-3 shrink-0 text-amber-600" />
                            <span className="font-medium text-amber-700">
                              {dateLabel(next.fecha)}
                            </span>
                            <span className="truncate">· {next.descripcion}</span>
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
