export function formatCurrency(n: number): string {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

export function formatAxisCurrency(n: number): string {
  if (n === 0) return "0 €";
  if (Math.abs(n) >= 1_000_000) {
    return `${(n / 1_000_000).toLocaleString("es-ES", { maximumFractionDigits: 1 })}M €`;
  }
  if (Math.abs(n) >= 1000) {
    return `${(n / 1000).toLocaleString("es-ES", { maximumFractionDigits: 1 })}k €`;
  }
  return `${n.toLocaleString("es-ES")} €`;
}

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const DIAS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];

// Parse a YYYY-MM-DD string as local time, not UTC.
// new Date("2026-05-15") parses as UTC midnight → off-by-one in UTC+2 timezone.
// If iso contains a time component (timestamptz), defer to native Date.
function parseLocalDate(iso: string): Date {
  if (!iso) return new Date(NaN);
  if (iso.length > 10) return new Date(iso);
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function formatShortDate(iso: string): string {
  const d = parseLocalDate(iso);
  if (isNaN(d.getTime())) return "—";
  return `${d.getDate()} ${MESES[d.getMonth()]}`;
}

export function formatLongDate(iso: string): string {
  const d = parseLocalDate(iso);
  const yy = String(d.getFullYear()).slice(-2);
  return `${DIAS[d.getDay()]} ${d.getDate()} ${MESES[d.getMonth()]} ${yy}`;
}

export function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export type DateStatus = "vencida" | "hoy" | "mañana" | "futura";

export function dateStatus(iso: string): DateStatus {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = parseLocalDate(iso);
  const diff = Math.round((d.getTime() - today.getTime()) / 86400000);
  if (diff < 0) return "vencida";
  if (diff === 0) return "hoy";
  if (diff === 1) return "mañana";
  return "futura";
}

export function dateLabel(iso: string): string {
  const s = dateStatus(iso);
  if (s === "vencida") return "Vencida";
  if (s === "hoy") return "Hoy";
  if (s === "mañana") return "Mañana";
  return formatShortDate(iso);
}

// Envío por defecto Tiroriro: 40€ en Madrid, 60€ mínimo a consultar fuera.
export function isMadrid(ciudad: string): boolean {
  const c = (ciudad || "").trim().toLowerCase();
  if (!c) return false;
  return c === "madrid" || c.startsWith("madrid,") || c.includes(" madrid") || c.endsWith(" madrid");
}
export function defaultEnvio(ciudad: string): number {
  return isMadrid(ciudad) ? 40 : 60;
}
