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
  // Each SVG draws the silhouette of the cabecero/pantalla shape, viewBox 0 0 32 16
  const common = { className, viewBox: "0 0 32 16", fill: "currentColor" } as const;
  switch (forma) {
    case "recto":
      return <svg {...common}><rect x="2" y="2" width="28" height="12" rx="1" /></svg>;
    case "semicirculo":
      return <svg {...common}><path d="M2 14 V8 a14 6 0 0 1 28 0 V14 Z" /></svg>;
    case "corona-simple":
      return <svg {...common}><path d="M2 14 V6 Q8 6 10 6 Q16 -1 22 6 Q24 6 30 6 V14 Z" /></svg>;
    case "corona-doble":
      return <svg {...common}><path d="M2 14 V8 Q6 8 8 8 Q11 3 14 8 Q16 8 18 8 Q21 1 24 8 Q27 8 30 8 V14 Z" /></svg>;
    case "ondas":
      return <svg {...common}><path d="M2 14 V8 Q4 4 6 8 Q8 4 10 8 Q12 4 14 8 Q16 4 18 8 Q20 4 22 8 Q24 4 26 8 Q28 4 30 8 V14 Z" /></svg>;
    case "cilindro":
      return <svg {...common}><ellipse cx="16" cy="3" rx="10" ry="2" /><path d="M6 3 V13 a10 2 0 0 0 20 0 V3" fill="none" stroke="currentColor" strokeWidth="1.5" /></svg>;
    case "cuadrado":
      return <svg {...common}><rect x="6" y="2" width="20" height="12" rx="0.5" fill="none" stroke="currentColor" strokeWidth="1.5" /></svg>;
    case "rectangulo":
      return <svg {...common}><rect x="2" y="3" width="28" height="10" rx="0.5" fill="none" stroke="currentColor" strokeWidth="1.5" /></svg>;
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
