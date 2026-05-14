import type { Vendedor } from "@/lib/types";

const STYLES: Record<string, { badge: string; dot: string }> = {
  Iñaki: { badge: "bg-blue-100 text-blue-700", dot: "bg-blue-500" },
  Rocío: { badge: "bg-emerald-100 text-emerald-700", dot: "bg-emerald-500" },
  Juan: { badge: "bg-violet-100 text-violet-700", dot: "bg-violet-500" },
  Bea: { badge: "bg-amber-100 text-amber-700", dot: "bg-amber-500" },
};

export function sellerStyle(v: string) {
  return STYLES[v] ?? { badge: "bg-slate-100 text-slate-700", dot: "bg-slate-400" };
}

export function SellerBadge({ vendedor }: { vendedor: Vendedor | string }) {
  const s = sellerStyle(vendedor);
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${s.badge}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      {vendedor}
    </span>
  );
}
