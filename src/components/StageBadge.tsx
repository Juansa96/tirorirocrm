import type { Etapa } from "@/lib/types";

const STYLES: Record<Etapa, string> = {
  Discovery: "bg-sky-100 text-sky-700",
  "Primer Contacto": "bg-amber-100 text-amber-700",
  Negotiation: "bg-violet-100 text-violet-700",
  "On Hold": "bg-slate-100 text-slate-700",
  "Closed Won": "bg-emerald-100 text-emerald-700",
  "Closed Lost": "bg-red-100 text-red-700",
  "Cliente potencial": "bg-sky-100 text-sky-700",
  Propuesta: "bg-violet-100 text-violet-700",
  Ganado: "bg-emerald-100 text-emerald-700",
  Perdido: "bg-red-100 text-red-700",
  Contactado: "bg-pink-100 text-pink-700",
  Negociando: "bg-amber-100 text-amber-700",
};

export function StageBadge({ etapa }: { etapa: Etapa }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STYLES[etapa]}`}
    >
      {etapa}
    </span>
  );
}
