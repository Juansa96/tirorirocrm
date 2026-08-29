import { useState } from "react";
import { RAZONES_PERDIDA_B2C } from "@/lib/types";

// Diálogo que se muestra al pasar un lead B2C a "Closed Lost". La RAZÓN es
// obligatoria (una de las opciones fijas); las observaciones/comentario son
// opcionales. Devuelve ambas por separado al confirmar.
export function ClosedLostDialog({ onCancel, onConfirm }: {
  onCancel: () => void;
  onConfirm: (razon: string, comentario: string) => void;
}) {
  const [razon, setRazon] = useState<string>("");
  const [comentario, setComentario] = useState<string>("");
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 md:items-center md:p-4" onClick={onCancel}>
      <div onClick={(e) => e.stopPropagation()} className="w-full rounded-t-2xl bg-white p-5 pb-8 shadow-2xl md:max-w-md md:rounded-2xl md:pb-5">
        <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-slate-200 md:hidden" />
        <h2 className="mb-1 text-lg font-bold text-slate-900">¿Por qué se pierde este lead?</h2>
        <p className="mb-4 text-sm text-slate-500">Elige un motivo (obligatorio) para pasarlo a "Closed Lost".</p>
        <div className="space-y-1.5">
          {RAZONES_PERDIDA_B2C.map((r) => (
            <button
              key={r}
              onClick={() => setRazon(r)}
              className={`flex w-full items-center gap-2 rounded-lg border px-3 py-2.5 text-left text-sm ${razon === r ? "border-rose-400 bg-rose-50 text-rose-700" : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"}`}
            >
              <span className={`flex h-4 w-4 items-center justify-center rounded-full border ${razon === r ? "border-rose-500 bg-rose-500" : "border-slate-300"}`}>
                {razon === r && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
              </span>
              {r}
            </button>
          ))}
        </div>
        <div className="mt-3">
          <label className="mb-1 block text-xs font-medium text-slate-500">Observaciones / comentario <span className="font-normal text-slate-400">(opcional)</span></label>
          <textarea
            value={comentario}
            onChange={(e) => setComentario(e.target.value)}
            rows={2}
            placeholder="Detalle o contexto adicional…"
            className="w-full resize-none rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-slate-500 focus:outline-none"
          />
        </div>
        <div className="mt-4 flex gap-2">
          <button onClick={onCancel} className="flex-1 rounded-lg border border-slate-300 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50">Cancelar</button>
          <button
            onClick={() => onConfirm(razon, comentario.trim())}
            disabled={!razon}
            className="flex-1 rounded-lg bg-rose-600 py-2.5 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
          >
            Marcar como perdido
          </button>
        </div>
      </div>
    </div>
  );
}
