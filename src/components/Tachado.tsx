import type { ReactNode } from "react";

// Valor anterior tachado seguido del valor nuevo: "~~160 cm~~ 180 cm". Sustituye
// a los antiguos avisos "se ha cambiado X" de las cards. Si no hay valor
// anterior, pinta solo el nuevo. Solo se enseña el ÚLTIMO valor anterior
// (regla de Juan), y desaparece cuando el pedido queda en "Recogido".
export function Tachado({ antes, children, className = "" }: { antes?: string | null; children: ReactNode; className?: string }) {
  if (!antes) return <>{children}</>;
  return (
    <span className={className}>
      <s className="mr-1 font-normal text-slate-400 decoration-slate-400" title={`Antes: ${antes}`}>{antes}</s>
      {children}
    </span>
  );
}
