import { CABECERO_FORMAS, PANTALLA_FORMAS } from "@/lib/product-schema";

// Reverse maps: modelo name → forma key
const CABECERO_MODELO_TO_FORMA: Record<string, string> = Object.fromEntries(
  Object.entries(CABECERO_FORMAS).map(([k, v]) => [v, k])
);
const PANTALLA_MODELO_TO_FORMA: Record<string, string> = Object.fromEntries(
  Object.entries(PANTALLA_FORMAS).map(([k, v]) => [v, k])
);

// Human labels per forma
const FORMA_LABEL: Record<string, string> = {
  recto: "Recto",
  semicirculo: "Semicírculo",
  "corona-simple": "Corona simple",
  "corona-doble": "Corona doble",
  ondas: "Ondas",
  cilindro: "Cilindro",
  cuadrado: "Cuadrado",
  rectangulo: "Rectángulo",
};

function FormaSVG({ forma, className = "h-3.5 w-3.5" }: { forma: string; className?: string }) {
  // Mirrors the SVGs used on tirorirohome.com (viewBox 0 0 32 32, stroked silhouette)
  const common = { className, viewBox: "0 0 32 32", fill: "none", stroke: "currentColor", strokeWidth: 1.5 } as const;
  switch (forma) {
    case "recto":
      return <svg {...common}><rect x="4" y="6" width="24" height="16" rx="1" /></svg>;
    case "semicirculo":
      return <svg {...common}><path d="M 4 22 L 4 14 Q 16 4 28 14 L 28 22 Z" /></svg>;
    case "corona-simple":
      return <svg {...common}><path d="M 2 22 L 2 14 C 8 14 10 11 10.4 9.2 A 5.6 1.6 0 0 1 21.6 9.2 C 22 11 24 14 30 14 L 30 22 Z" /></svg>;
    case "corona-doble":
      return <svg {...common}><path d="M 2 22 L 2 14 Q 7 14 7 11.5 Q 12 11.5 12 9 A 4 2 0 0 1 20 9 Q 20 11.5 25 11.5 Q 25 14 30 14 L 30 22 Z" /></svg>;
    case "ondas":
      return <svg {...common}><path d="M 2 22 L 2 15 Q 5.5 8 9 15 Q 12.5 8 16 15 Q 19.5 8 23 15 Q 26.5 8 30 15 L 30 22 Z" /></svg>;
    case "cilindro":
      return <svg {...common}><ellipse cx="16" cy="6" rx="10" ry="2" /><path d="M6 6 V26 a10 2 0 0 0 20 0 V6" /></svg>;
    case "cuadrado":
      return <svg {...common}><rect x="6" y="6" width="20" height="20" rx="1" /></svg>;
    case "rectangulo":
      return <svg {...common}><rect x="2" y="8" width="28" height="16" rx="1" /></svg>;
    default:
      return null;
  }
}

export function formaForModelo(modelo: string): string | null {
  if (!modelo) return null;
  const m = modelo.trim();
  return CABECERO_MODELO_TO_FORMA[m] ?? PANTALLA_MODELO_TO_FORMA[m] ?? null;
}

export function FormaBadge({ modelo, className = "" }: { modelo: string | null | undefined; className?: string }) {
  const forma = modelo ? formaForModelo(modelo) : null;
  if (!forma) return null;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-medium text-slate-600 ${className}`}
      title={`Forma: ${FORMA_LABEL[forma] ?? forma}`}
    >
      <FormaSVG forma={forma} />
      {FORMA_LABEL[forma] ?? forma}
    </span>
  );
}
