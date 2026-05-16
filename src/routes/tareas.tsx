import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ChevronLeft, ChevronRight, LayoutList, CalendarDays } from "lucide-react";
import { useStore, actions } from "@/lib/store";
import { VENDEDORES, vendorName, type Tarea } from "@/lib/types";
import { dateStatus, todayISO } from "@/lib/format";
import { TaskItem } from "@/components/TaskItem";

export const Route = createFileRoute("/tareas")({
  head: () => ({ meta: [{ title: "Tareas — TiroCRM" }] }),
  component: TareasPage,
});

// ── Calendar helpers ─────────────────────────────────────────────
const DIAS_LABEL = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const MESES_LABEL = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

function weekStart(d: Date): Date {
  const day = d.getDay(); // 0=Sun
  const diff = (day === 0 ? -6 : 1 - day);
  const s = new Date(d);
  s.setDate(d.getDate() + diff);
  s.setHours(0, 0, 0, 0);
  return s;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function toISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function parseLocalDate(iso: string): Date {
  const [y, m, day] = iso.split("-").map(Number);
  return new Date(y, m - 1, day);
}

const STATUS_DOT: Record<string, string> = {
  vencida: "bg-red-500",
  hoy:     "bg-amber-400",
  mañana:  "bg-blue-400",
  futura:  "bg-slate-300",
};

const STATUS_PILL: Record<string, string> = {
  vencida: "bg-red-50 border-red-200 text-red-700",
  hoy:     "bg-amber-50 border-amber-200 text-amber-700",
  mañana:  "bg-blue-50 border-blue-200 text-blue-700",
  futura:  "bg-slate-50 border-slate-200 text-slate-600",
};

// ── Calendar View ────────────────────────────────────────────────
function CalendarView({
  tareas,
  leads,
  vendedor,
}: {
  tareas: Tarea[];
  leads: ReturnType<typeof useStore>["leads"];
  vendedor: string;
}) {
  const navigate = useNavigate();
  const [anchor, setAnchor] = useState(() => weekStart(new Date()));
  const today = todayISO();

  const days = Array.from({ length: 7 }, (_, i) => addDays(anchor, i));

  const visible = tareas.filter((t) => !vendedor || t.vendedor === vendedor);

  function tasksByDay(iso: string) {
    return visible.filter((t) => t.fecha === iso);
  }

  function prev() { setAnchor((d) => addDays(d, -7)); }
  function next() { setAnchor((d) => addDays(d, 7)); }
  function goToday() { setAnchor(weekStart(new Date())); }

  const weekLabel = (() => {
    const s = days[0]; const e = days[6];
    if (s.getMonth() === e.getMonth()) return `${s.getDate()}–${e.getDate()} ${MESES_LABEL[s.getMonth()]} ${s.getFullYear()}`;
    return `${s.getDate()} ${MESES_LABEL[s.getMonth()]} – ${e.getDate()} ${MESES_LABEL[e.getMonth()]} ${s.getFullYear()}`;
  })();

  return (
    <div className="space-y-3">
      {/* Week nav */}
      <div className="flex items-center gap-2">
        <button onClick={prev} className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button onClick={next} className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50">
          <ChevronRight className="h-4 w-4" />
        </button>
        <span className="flex-1 text-sm font-semibold text-slate-700">{weekLabel}</span>
        <button onClick={goToday} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">
          Hoy
        </button>
      </div>

      {/* Desktop: 7-column grid */}
      <div className="hidden gap-2 md:grid md:grid-cols-7">
        {days.map((day) => {
          const iso = toISO(day);
          const isToday = iso === today;
          const dayTasks = tasksByDay(iso);
          return (
            <div key={iso} className={`min-h-[160px] rounded-xl border p-2 ${isToday ? "border-amber-300 bg-amber-50" : "border-slate-200 bg-white"}`}>
              <div className="mb-2 text-center">
                <div className="text-[10px] font-medium uppercase tracking-wide text-slate-400">{DIAS_LABEL[(day.getDay() + 6) % 7]}</div>
                <div className={`mt-0.5 flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold mx-auto ${isToday ? "bg-amber-400 text-white" : "text-slate-700"}`}>
                  {day.getDate()}
                </div>
              </div>
              <div className="space-y-1">
                {dayTasks.length === 0 && (
                  <div className="py-2 text-center text-[10px] text-slate-300">—</div>
                )}
                {dayTasks.map((t) => {
                  const lead = leads.find((l) => l.id === t.leadId);
                  const st = dateStatus(t.fecha);
                  return (
                    <button
                      key={t.id}
                      onClick={() => navigate({ to: "/clientes/$id", params: { id: t.leadId } })}
                      className={`w-full rounded-lg border px-2 py-1.5 text-left text-[11px] leading-tight transition-shadow hover:shadow-sm ${t.completada ? "opacity-50" : STATUS_PILL[st]}`}
                    >
                      <div className="flex items-center gap-1">
                        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${STATUS_DOT[st]}`} />
                        <span className="truncate font-medium">{lead?.nombre ?? "—"}</span>
                      </div>
                      {t.hora && <div className="mt-0.5 pl-2.5 text-[10px] opacity-70">{t.hora}</div>}
                      <div className="mt-0.5 truncate pl-2.5 opacity-60">{t.descripcion}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Mobile: vertical day list */}
      <div className="space-y-3 md:hidden">
        {days.map((day) => {
          const iso = toISO(day);
          const isToday = iso === today;
          const dayTasks = tasksByDay(iso);
          if (dayTasks.length === 0) return null;
          return (
            <div key={iso}>
              <div className={`mb-1.5 flex items-center gap-2 ${isToday ? "text-amber-700" : "text-slate-500"}`}>
                <span className="text-xs font-semibold uppercase tracking-wide">{DIAS_LABEL[(day.getDay() + 6) % 7]}</span>
                <span className={`flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold ${isToday ? "bg-amber-400 text-white" : "bg-slate-100 text-slate-600"}`}>
                  {day.getDate()}
                </span>
                {isToday && <span className="text-xs font-medium text-amber-600">Hoy</span>}
              </div>
              <div className="space-y-1.5">
                {dayTasks.map((t) => {
                  const lead = leads.find((l) => l.id === t.leadId);
                  const st = dateStatus(t.fecha);
                  return (
                    <button
                      key={t.id}
                      onClick={() => navigate({ to: "/clientes/$id", params: { id: t.leadId } })}
                      className={`flex w-full items-start gap-2 rounded-xl border px-3 py-2.5 text-left transition-shadow hover:shadow-sm ${t.completada ? "opacity-50" : STATUS_PILL[st]}`}
                    >
                      <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${STATUS_DOT[st]}`} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold">{lead?.nombre ?? "—"}</div>
                        <div className="truncate text-xs opacity-70">{t.descripcion}{t.hora ? ` · ${t.hora}` : ""}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
        {days.every((day) => tasksByDay(toISO(day)).length === 0) && (
          <div className="py-10 text-center text-sm text-slate-400">Sin tareas esta semana</div>
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-3 pt-1 text-xs text-slate-400">
        {[["vencida", "Vencida"], ["hoy", "Hoy"], ["mañana", "Mañana"], ["futura", "Futura"]].map(([key, label]) => (
          <span key={key} className="flex items-center gap-1">
            <span className={`h-2 w-2 rounded-full ${STATUS_DOT[key]}`} />
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────
function TareasPage() {
  const { leads, tareas } = useStore();
  const [vendedor, setVendedor] = useState("");
  const [estado, setEstado] = useState<"todas" | "pendiente" | "completada">("pendiente");
  const [view, setView] = useState<"lista" | "calendario">("lista");

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

  const pendingCount = tareas.filter((t) => !t.completada && (!vendedor || t.vendedor === vendedor)).length;
  const overdueCount = tareas.filter((t) => !t.completada && dateStatus(t.fecha) === "vencida" && (!vendedor || t.vendedor === vendedor)).length;

  const inputCls = "rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm";

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Tareas</h1>
          <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
            <span>{pendingCount} pendientes</span>
            {overdueCount > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 font-semibold text-red-700">
                {overdueCount} vencida{overdueCount !== 1 ? "s" : ""}
              </span>
            )}
          </div>
        </div>
        {/* View toggle */}
        <div className="flex rounded-lg border border-slate-200 bg-white p-0.5">
          <button
            onClick={() => setView("lista")}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${view === "lista" ? "bg-[#1a1f36] text-white" : "text-slate-500 hover:text-slate-700"}`}
          >
            <LayoutList className="h-3.5 w-3.5" /> Lista
          </button>
          <button
            onClick={() => setView("calendario")}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${view === "calendario" ? "bg-[#1a1f36] text-white" : "text-slate-500 hover:text-slate-700"}`}
          >
            <CalendarDays className="h-3.5 w-3.5" /> Semana
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <select value={vendedor} onChange={(e) => setVendedor(e.target.value)} className={inputCls}>
          <option value="">Todos los vendedores</option>
          {VENDEDORES.map((v) => (<option key={v} value={v}>{vendorName(v)}</option>))}
        </select>
        {view === "lista" && (
          <select value={estado} onChange={(e) => setEstado(e.target.value as typeof estado)} className={inputCls}>
            <option value="pendiente">Pendientes</option>
            <option value="completada">Completadas</option>
            <option value="todas">Todas</option>
          </select>
        )}
      </div>

      {/* Content */}
      {view === "calendario" ? (
        <CalendarView tareas={tareas} leads={leads} vendedor={vendedor} />
      ) : (
        <div className="space-y-2">
          {sorted.length === 0 && (
            <div className="rounded-xl border border-dashed border-slate-200 py-12 text-center text-sm text-slate-400">Sin tareas</div>
          )}
          {sorted.map((t) => {
            const lead = leads.find((l) => l.id === t.leadId);
            return (
              <TaskItem key={t.id} tarea={t} clienteNombre={lead?.nombre ?? "—"} showCheckbox onToggle={() => actions.toggleTarea(t.id)} />
            );
          })}
        </div>
      )}
    </div>
  );
}
