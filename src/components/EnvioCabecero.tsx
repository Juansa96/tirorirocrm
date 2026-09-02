// Sugerencia de coste de envío para CABECEROS según tamaño (pequeño/grande) y
// zona (Comunidad de Madrid / fuera). Solo se muestra para cabeceros; para el
// resto de productos el envío se sigue poniendo a mano.
//   pequeño + Madrid = 40 · pequeño + fuera = 60
//   grande  + Madrid = 60 · grande  + fuera = 80
import { Truck } from "lucide-react";
import { cabeceroEsGrande, envioCabecero, esZonaMadrid, mismoTipo } from "@/lib/catalogo";

export function SugerenciaEnvioCabecero({ tipo, ancho, alto, ciudad, provincia, costeEnvio, onApply }: {
  tipo: string;
  ancho: number | null | undefined;
  alto: number | null | undefined;
  ciudad?: string | null;
  provincia?: string | null;
  costeEnvio: number;
  onApply: (valor: number) => void;
}) {
  if (!mismoTipo(tipo, "cabecero")) return null;
  const grande = cabeceroEsGrande(ancho, alto);
  const madrid = esZonaMadrid(ciudad, provincia);
  const sugerido = envioCabecero(grande, madrid);
  const sinZona = !(ciudad || provincia);
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="inline-flex items-center gap-1 font-medium text-slate-700">
          <Truck className="h-3.5 w-3.5 text-slate-400" /> Envío sugerido
        </span>
        <span>
          cabecero <strong>{grande ? "grande" : "pequeño"}</strong> · {madrid ? "Madrid" : "fuera de Madrid"}:
          {" "}<strong>{sugerido}€</strong>
        </span>
        {costeEnvio !== sugerido && (
          <button
            type="button"
            onClick={() => onApply(sugerido)}
            className="rounded-md border border-slate-300 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-700 hover:bg-slate-100"
          >
            Aplicar {sugerido}€
          </button>
        )}
      </div>
      {sinZona && (
        <div className="mt-1 text-[11px] text-slate-400">Añade la ciudad del cliente para afinar Madrid / fuera de Madrid.</div>
      )}
    </div>
  );
}
