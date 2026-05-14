import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, Mail, Phone, MapPin, Package, Plus } from "lucide-react";
import { useStore, actions } from "@/lib/store";
import { ETAPAS, ETAPA_COLORS, VENDEDORES, type Etapa, type Vendedor } from "@/lib/types";
import { formatCurrency, todayISO } from "@/lib/format";
import { SellerBadge } from "@/components/SellerBadge";
import { TaskItem } from "@/components/TaskItem";

export const Route = createFileRoute("/clientes/$id")({
  head: () => ({
    meta: [{ title: "Cliente — TiroCRM" }],
  }),
  component: ClienteDetalle,
});

function ClienteDetalle() {
  const { id } = Route.useParams();
  const { leads, tareas } = useStore();
  const navigate = useNavigate();
  const lead = leads.find((l) => l.id === id);

  const [editing, setEditing] = useState(false);
  const [valorEdit, setValorEdit] = useState(false);
  const [nuevaTarea, setNuevaTarea] = useState({ descripcion: "", fecha: todayISO() });

  if (!lead) {
    return (
      <div className="py-12 text-center">
        <p className="text-slate-500">Cliente no encontrado.</p>
        <Link to="/clientes" className="mt-4 inline-block text-sm text-blue-600">
          Volver a clientes
        </Link>
      </div>
    );
  }

  const leadTareas = tareas
    .filter((t) => t.leadId === lead.id)
    .sort((a, b) => a.fecha.localeCompare(b.fecha));

  function addTask() {
    if (!nuevaTarea.descripcion.trim()) return;
    actions.addTarea({
      leadId: lead!.id,
      descripcion: nuevaTarea.descripcion,
      fecha: nuevaTarea.fecha,
      vendedor: lead!.vendedor,
    });
    setNuevaTarea({ descripcion: "", fecha: todayISO() });
  }

  return (
    <div className="space-y-4">
      <Link
        to="/clientes"
        className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" /> Volver
      </Link>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:p-6">
        <div>
          {editing ? (
            <input
              value={lead.nombre}
              onChange={(e) => actions.updateLead(lead.id, { nombre: e.target.value })}
              className="rounded border border-slate-300 px-2 py-1 text-2xl font-bold"
            />
          ) : (
            <h1 className="text-2xl font-bold">{lead.nombre}</h1>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <SellerBadge vendedor={lead.vendedor} />
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
              {lead.producto}
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => navigate({ to: "/clientes" })}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Cerrar
          </button>
          <button
            onClick={() => setEditing(!editing)}
            className="rounded-lg bg-[#1a1f36] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#2a2f46]"
          >
            {editing ? "Hecho" : "Editar"}
          </button>
        </div>
      </div>

      {/* Etapa selector */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:p-6">
        <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Etapa
        </div>
        <div className="flex flex-wrap gap-2">
          {ETAPAS.map((e) => {
            const active = lead.etapa === e;
            return (
              <button
                key={e}
                onClick={() => actions.setLeadEtapa(lead.id, e)}
                className="rounded-full px-3 py-1.5 text-xs font-medium transition-all"
                style={{
                  backgroundColor: active ? ETAPA_COLORS[e] : "#f1f5f9",
                  color: active ? "#fff" : "#475569",
                }}
              >
                {e}
              </button>
            );
          })}
        </div>
      </div>

      {/* Info */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:p-6">
          <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Información
          </div>
          <div className="space-y-3 text-sm">
            <InfoRow icon={Mail} label="Email">
              {editing ? (
                <input
                  value={lead.email}
                  onChange={(e) => actions.updateLead(lead.id, { email: e.target.value })}
                  className="w-full rounded border border-slate-200 px-2 py-1"
                />
              ) : (
                lead.email || <span className="text-slate-400">—</span>
              )}
            </InfoRow>
            <InfoRow icon={Phone} label="Teléfono">
              {editing ? (
                <input
                  value={lead.telefono}
                  onChange={(e) =>
                    actions.updateLead(lead.id, { telefono: e.target.value })
                  }
                  className="w-full rounded border border-slate-200 px-2 py-1"
                />
              ) : (
                lead.telefono || <span className="text-slate-400">—</span>
              )}
            </InfoRow>
            <InfoRow icon={MapPin} label="Ciudad">
              {editing ? (
                <input
                  value={lead.ciudad}
                  onChange={(e) =>
                    actions.updateLead(lead.id, { ciudad: e.target.value })
                  }
                  className="w-full rounded border border-slate-200 px-2 py-1"
                />
              ) : (
                lead.ciudad || <span className="text-slate-400">—</span>
              )}
            </InfoRow>
            <InfoRow icon={Package} label="Producto">
              {editing ? (
                <input
                  value={lead.producto}
                  onChange={(e) =>
                    actions.updateLead(lead.id, { producto: e.target.value })
                  }
                  className="w-full rounded border border-slate-200 px-2 py-1"
                />
              ) : (
                lead.producto
              )}
            </InfoRow>
            {editing && (
              <div>
                <label className="mb-1 block text-xs text-slate-500">Vendedor</label>
                <select
                  value={lead.vendedor}
                  onChange={(e) =>
                    actions.updateLead(lead.id, {
                      vendedor: e.target.value as Vendedor,
                    })
                  }
                  className="w-full rounded border border-slate-200 px-2 py-1"
                >
                  {VENDEDORES.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:p-6">
          <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Valor estimado
          </div>
          {valorEdit ? (
            <input
              type="number"
              value={lead.valor}
              autoFocus
              onChange={(e) =>
                actions.updateLead(lead.id, { valor: parseFloat(e.target.value) || 0 })
              }
              onBlur={() => setValorEdit(false)}
              className="w-full rounded border border-slate-300 px-2 py-1 text-2xl font-bold"
            />
          ) : (
            <button
              onClick={() => setValorEdit(true)}
              className="text-3xl font-bold text-slate-900 hover:text-slate-600"
            >
              {formatCurrency(lead.valor)}
            </button>
          )}
          <div className="mt-1 text-xs text-slate-400">Toca para editar</div>
        </div>
      </div>

      {/* Tareas */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:p-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold">Tareas</h2>
        </div>
        <div className="space-y-2">
          {leadTareas.length === 0 && (
            <div className="py-4 text-center text-sm text-slate-400">Sin tareas</div>
          )}
          {leadTareas.map((t) => (
            <TaskItem
              key={t.id}
              tarea={t}
              clienteNombre={lead.nombre}
              showCheckbox
              onToggle={() => actions.toggleTarea(t.id)}
            />
          ))}
        </div>
        <div className="mt-4 grid grid-cols-1 gap-2 rounded-lg border border-dashed border-slate-300 p-3 md:grid-cols-[1fr_auto_auto]">
          <input
            placeholder="Nueva tarea…"
            value={nuevaTarea.descripcion}
            onChange={(e) =>
              setNuevaTarea({ ...nuevaTarea, descripcion: e.target.value })
            }
            className="rounded border border-slate-200 px-3 py-2 text-sm"
          />
          <input
            type="date"
            value={nuevaTarea.fecha}
            onChange={(e) => setNuevaTarea({ ...nuevaTarea, fecha: e.target.value })}
            className="rounded border border-slate-200 px-3 py-2 text-sm"
          />
          <button
            onClick={addTask}
            className="inline-flex items-center justify-center gap-1 rounded-lg bg-[#1a1f36] px-3 py-2 text-sm font-medium text-white hover:bg-[#2a2f46]"
          >
            <Plus className="h-4 w-4" /> Añadir
          </button>
        </div>
      </div>
    </div>
  );
}

function InfoRow({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
      <div className="min-w-0 flex-1">
        <div className="text-xs text-slate-500">{label}</div>
        <div className="text-slate-900">{children}</div>
      </div>
    </div>
  );
}
