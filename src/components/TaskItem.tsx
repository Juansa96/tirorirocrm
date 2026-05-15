import { useNavigate } from "@tanstack/react-router";
import { Clock, AlertTriangle, Calendar } from "lucide-react";
import { dateLabel, dateStatus } from "@/lib/format";
import { SellerBadge } from "./SellerBadge";
import type { Tarea } from "@/lib/types";

interface Props {
  tarea: Tarea;
  clienteNombre: string;
  showCheckbox?: boolean;
  onToggle?: () => void;
}

function googleCalUrl(t: Tarea, nombre: string): string {
  const base = "https://calendar.google.com/calendar/render?action=TEMPLATE";
  const title = encodeURIComponent(`${t.descripcion} — ${nombre}`);
  let dates = "";
  if (t.hora) {
    const [h, m] = t.hora.split(":").map(Number);
    const start = t.fecha.replace(/-/g, "") + "T" + String(h).padStart(2, "0") + String(m).padStart(2, "0") + "00";
    const endH = h + 1 < 24 ? h + 1 : h;
    const end = t.fecha.replace(/-/g, "") + "T" + String(endH).padStart(2, "0") + String(m).padStart(2, "0") + "00";
    dates = `${start}/${end}`;
  } else {
    const day = t.fecha.replace(/-/g, "");
    dates = `${day}/${day}`;
  }
  return `${base}&text=${title}&dates=${dates}&details=${encodeURIComponent("Lead: " + nombre)}`;
}

export function TaskItem({ tarea, clienteNombre, showCheckbox, onToggle }: Props) {
  const status = dateStatus(tarea.fecha);
  const fechaColor =
    status === "vencida" ? "text-red-600"
    : status === "hoy"    ? "text-amber-600"
    : status === "mañana" ? "text-blue-600"
    : "text-slate-500";

  const content = (
    <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-3 transition-shadow duration-150 hover:shadow-md">
      {showCheckbox ? (
        <input
          type="checkbox"
          checked={tarea.completada}
          onChange={(e) => { e.stopPropagation(); onToggle?.(); }}
          onClick={(e) => e.stopPropagation()}
          className="h-4 w-4 shrink-0 rounded border-slate-300 accent-emerald-600"
        />
      ) : (
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100">
          <Clock className="h-4 w-4 text-amber-600" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className={`truncate text-sm font-semibold ${tarea.completada ? "text-slate-400 line-through" : "text-slate-900"}`}>
          {clienteNombre}
        </div>
        <div className={`truncate text-xs ${tarea.completada ? "text-slate-400 line-through" : "text-slate-500"}`}>
          {tarea.descripcion}
        </div>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1.5">
        <div className={`flex items-center gap-1 text-xs font-medium ${fechaColor}`}>
          {status === "vencida" && <AlertTriangle className="h-3 w-3" />}
          {dateLabel(tarea.fecha)}
          {tarea.hora && <span className="text-slate-400">· {tarea.hora}</span>}
        </div>
        <div className="flex items-center gap-1.5">
          <SellerBadge vendedor={tarea.vendedor} />
          <a
            href={googleCalUrl(tarea, clienteNombre)}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            title="Añadir a Google Calendar"
            className="inline-flex items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-700 hover:bg-blue-100"
          >
            <Calendar className="h-3 w-3" />
            Cal
          </a>
        </div>
      </div>
    </div>
  );

  if (showCheckbox) return content;
  const navigate = useNavigate();
  return (
    <div
      role="link"
      tabIndex={0}
      onClick={() => navigate({ to: "/clientes/$id", params: { id: tarea.leadId } })}
      onKeyDown={(e) => { if (e.key === "Enter") navigate({ to: "/clientes/$id", params: { id: tarea.leadId } }); }}
      className="block cursor-pointer"
    >
      {content}
    </div>
  );
}
