import { useState } from "react";
import { useStore } from "@/lib/store";
import { HISTORIAL_LABELS, vendorName, type AuditEntry } from "@/lib/types";
import { formatShortDate } from "@/lib/format";

// Línea gris "Antes: 150 × 100 · Rocío, 2 sep" bajo un dato que ha cambiado
// (medidas, telas, montaje, precio). Lee el historial que ya existe
// (`audit_log`); si hay más de un cambio, "ver historial" los despliega.
// No bloquea nada: es la regla de Juan, "manda el último, pero que salte".
function quien(u: string | null): string {
  if (!u) return "sistema";
  const n = vendorName(u);
  return n !== u ? n : u.split("@")[0];
}

export function Antes({ tabla, campos, className = "" }: { tabla: string; campos: string[]; className?: string }) {
  const { audit } = useStore();
  const [abierto, setAbierto] = useState<string | null>(null);
  const porCampo = campos
    .map((c) => ({ campo: c, entradas: audit.filter((a) => a.tabla === tabla && a.campo === c).sort((a, b) => b.createdAt.localeCompare(a.createdAt)) }))
    .filter((x) => x.entradas.length > 0);
  if (porCampo.length === 0) return null;
  const fecha = (a: AuditEntry) => formatShortDate(a.createdAt.slice(0, 10));
  return (
    <div className={`space-y-0.5 text-[11px] leading-snug text-slate-400 ${className}`}>
      {porCampo.map(({ campo, entradas }) => {
        const u = entradas[0];
        const label = HISTORIAL_LABELS[campo] ?? campo;
        return (
          <div key={campo}>
            <span>Antes{campos.length > 1 ? ` (${label})` : ""}: </span>
            <span className="text-slate-600">{u.valorAnterior || "—"}</span>
            <span> · {quien(u.usuario)}, {fecha(u)}</span>
            {entradas.length > 1 && (
              <button type="button" onClick={() => setAbierto(abierto === campo ? null : campo)} className="ml-1 underline decoration-dotted hover:text-slate-600">
                {abierto === campo ? "ocultar" : `ver historial (${entradas.length})`}
              </button>
            )}
            {abierto === campo && (
              <ul className="mt-0.5 space-y-0.5 pl-3">
                {entradas.map((a) => (
                  <li key={a.id}><span className="text-slate-600">{a.valorAnterior || "—"}</span> → <span className="text-slate-600">{a.valorNuevo || "—"}</span> · {quien(a.usuario)}, {fecha(a)}</li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}
