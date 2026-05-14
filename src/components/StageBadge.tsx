import type { Etapa } from "@/lib/types";

const STYLES: Record<Etapa, string> = {
  Discovery: "bg-sky-100 text-sky-700",
  Llamada: "bg-amber-100 text-amber-700",
  Proposal: "bg-violet-100 text-violet-700",
  "Closed Won": "bg-emerald-100 text-emerald-700",
  "Closed Lost": "bg-red-100 text-red-700",
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
