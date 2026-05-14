import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useStore, actions } from "@/lib/store";
import { VENDEDORES } from "@/lib/types";
import { dateStatus } from "@/lib/format";
import { TaskItem } from "@/components/TaskItem";

export const Route = createFileRoute("/tareas")({
  head: () => ({
    meta: [
      { title: "Tareas — TiroCRM" },
      { name: "description", content: "Tareas pendientes y vencidas" },
    ],
  }),
  component: TareasPage,
});

function TareasPage() {
  const { leads, tareas } = useStore();
  const [vendedor, setVendedor] = useState("");
  const [estado, setEstado] = useState<"todas" | "pendiente" | "completada">("pendiente");

  const filtered = tareas.filter((t) => {
    if (vendedor && t.vendedor !== vendedor) return false;
    if (estado === "pendiente" && t.completada) return false;
    if (estado === "completada" && !t.completada) return false;
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    if (a.completada !== b.completada) return a.completada ? 1 : -1;
    const order = { vencida: 0, hoy: 1, mañana: 2, futura: 3 } as const;
    const sa = order[dateStatus(a.fecha)];
    const sb = order[dateStatus(b.fecha)];
    if (sa !== sb) return sa - sb;
    return a.fecha.localeCompare(b.fecha);
  });

  const inputCls = "rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm";

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Tareas Pendientes</h1>
        <p className="text-sm text-slate-500">Acciones vencidas y de hoy</p>
      </div>

      <div className="grid grid-cols-2 gap-2 md:flex md:flex-wrap">
        <select
          value={vendedor}
          onChange={(e) => setVendedor(e.target.value)}
          className={inputCls}
        >
          <option value="">Todos los vendedores</option>
          {VENDEDORES.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
        <select
          value={estado}
          onChange={(e) => setEstado(e.target.value as typeof estado)}
          className={inputCls}
        >
          <option value="pendiente">Pendientes</option>
          <option value="completada">Completadas</option>
          <option value="todas">Todas</option>
        </select>
      </div>

      <div className="space-y-2">
        {sorted.length === 0 && (
          <div className="rounded-xl border border-dashed border-slate-200 py-12 text-center text-sm text-slate-400">
            Sin tareas
          </div>
        )}
        {sorted.map((t) => {
          const lead = leads.find((l) => l.id === t.leadId);
          return (
            <TaskItem
              key={t.id}
              tarea={t}
              clienteNombre={lead?.nombre ?? "—"}
              showCheckbox
              onToggle={() => actions.toggleTarea(t.id)}
            />
          );
        })}
      </div>
    </div>
  );
}
