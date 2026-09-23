import type { ProductoDibujo } from "@/lib/types";

// Dibujo de la pieza tal y como la montó el cliente en el configurador de
// tirorirohome.com (silueta neutra con las proporciones elegidas). Llega con
// cada lead del configurador; si no hay, no se pinta nada.
export function DibujoCliente({ dibujo, className = "" }: { dibujo: ProductoDibujo | null | undefined; className?: string }) {
  if (!dibujo) return null;
  const src = dibujo.pngUrl ?? (dibujo.svg ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(dibujo.svg)}` : null);
  if (!src) return null;
  const img = (
    <img
      src={src}
      alt="Dibujo de la pieza configurada por el cliente"
      loading="lazy"
      className="block h-auto w-full max-w-[280px] rounded-md border border-slate-200 bg-white"
    />
  );
  return (
    <figure className={`inline-block ${className}`}>
      {dibujo.pngUrl ? (
        <a href={dibujo.pngUrl} target="_blank" rel="noopener noreferrer" title="Abrir el dibujo en grande">{img}</a>
      ) : img}
      <figcaption className="mt-1 text-[10px] uppercase tracking-wide text-slate-400">Dibujo del cliente (configurador web)</figcaption>
    </figure>
  );
}
