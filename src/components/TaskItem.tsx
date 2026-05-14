import { Link } from "@tanstack/react-router";
import { Clock, AlertTriangle } from "lucide-react";
import { dateLabel, dateStatus } from "@/lib/format";
import { SellerBadge } from "./SellerBadge";
import type { Tarea } from "@/lib/types";

interface Props {
  tarea: Tarea;
  clienteNombre: string;
  showCheckbox?: boolean;
  onToggle?: () => void;
}

export function TaskItem({ tarea, clienteNombre, showCheckbox, onToggle }: Props) {
  const status = dateStatus(tarea.fecha);
  const fechaColor =
    status === "vencida"
      ? "text-red-600"
      : status === "hoy"
        ? "text-amber-600"
        : status === "mañana"
          ? "text-blue-600"
          : "text-slate-500";

  const content = (
    <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-3 transition-shadow duration-150 hover:shadow-md">
      {showCheckbox ? (
        <input
          type="checkbox"
          checked={tarea.completada}
          onChange={(e) => {
            e.stopPropagation();
            onToggle?.();
          }}
          onClick={(e) => e.stopPropagation()}
          className="h-4 w-4 shrink-0 rounded border-slate-300 accent-emerald-600"
        />
      ) : (
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100">
          <Clock className="h-4 w-4 text-amber-600" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div
          className={`truncate text-sm font-semibold ${tarea.completada ? "text-slate-400 line-through" : "text-slate-900"}`}
        >
          {clienteNombre}
        </div>
        <div
          className={`truncate text-xs ${tarea.completada ? "text-slate-400 line-through" : "text-slate-500"}`}
        >
          {tarea.descripcion}
        </div>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <div className={`flex items-center gap-1 text-xs font-medium ${fechaColor}`}>
          {status === "vencida" && <AlertTriangle className="h-3 w-3" />}
          {dateLabel(tarea.fecha)}
        </div>
        <SellerBadge vendedor={tarea.vendedor} />
      </div>
    </div>
  );

  if (showCheckbox) return content;
  return (
    <Link to="/clientes/$id" params={{ id: tarea.leadId }} className="block">
      {content}
    </Link>
  );
}
