import { FormaSVG, formaForModelo } from "@/components/FormaBadge";
import { normalizeTipo } from "@/lib/catalogo";

// Silueta grande y limpia del producto, SIN textura de tela (solo el contorno).
// Reutiliza las siluetas por forma de cabecero/pantalla (FormaBadge) y añade
// formas genéricas por tipo para banco/puf/mesa/almohadón/otro.
export function SiluetaProducto({ tipo, modelo, className = "h-40 w-full" }: {
  tipo: string; modelo: string; className?: string;
}) {
  const t = normalizeTipo(tipo);
  const forma = formaForModelo(modelo);

  // Cabecero / pantalla: silueta por forma concreta.
  if ((t === "cabecero" || t === "pantalla") && forma) {
    return <div className="flex items-center justify-center text-slate-700"><FormaSVG forma={forma} className={className} /></div>;
  }

  const common = { className, viewBox: "0 0 32 32", fill: "none", stroke: "currentColor", strokeWidth: 1.5 } as const;
  let svg: React.ReactNode;
  switch (t) {
    case "banco":
      svg = <svg {...common}><rect x="2" y="12" width="28" height="9" rx="2" /><line x1="6" y1="21" x2="6" y2="27" /><line x1="26" y1="21" x2="26" y2="27" /></svg>;
      break;
    case "puf":
      svg = <svg {...common}><rect x="7" y="11" width="18" height="13" rx="4" /></svg>;
      break;
    case "mesa":
      svg = <svg {...common}><rect x="6" y="10" width="20" height="12" rx="1" /></svg>;
      break;
    case "cojin":
      svg = <svg {...common}><rect x="7" y="7" width="18" height="18" rx="3" /></svg>;
      break;
    case "cabecero":
      svg = <svg {...common}><rect x="4" y="6" width="24" height="16" rx="1" /></svg>;
      break;
    case "pantalla":
      svg = <svg {...common}><path d="M9 8 h14 l3 16 h-20 z" /></svg>;
      break;
    default:
      svg = <svg {...common}><rect x="6" y="8" width="20" height="16" rx="2" /></svg>;
  }
  return <div className="flex items-center justify-center text-slate-700">{svg}</div>;
}
