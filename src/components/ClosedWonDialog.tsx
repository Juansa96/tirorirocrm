import { useState } from "react";

// Diálogo que se muestra al pasar un lead a "Closed Won": pide el importe y la
// fecha de la venta (se usan luego para la exportación de conversiones a
// Google Ads).
export function ClosedWonDialog({ importeInicial, onCancel, onConfirm }: {
  importeInicial?: number | null;
  onCancel: () => void;
  onConfirm: (ventaImporte: number | null, ventaFecha: string) => void;
}) {
  const [importe, setImporte] = useState(importeInicial != null ? String(importeInicial) : "");
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 md:items-center md:p-4" onClick={onCancel}>
      <div onClick={(e) => e.stopPropagation()} className="w-full rounded-t-2xl bg-white p-5 pb-8 shadow-2xl md:max-w-md md:rounded-2xl md:pb-5">
        <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-slate-200 md:hidden" />
        <h2 className="mb-1 text-lg font-bold text-slate-900">Venta cerrada</h2>
        <p className="mb-4 text-sm text-slate-500">Indica el importe y la fecha de la venta.</p>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Importe de la venta (€)</label>
            <input type="number" inputMode="decimal" step="0.01" min="0" autoFocus value={importe}
              onChange={(e) => setImporte(e.target.value)} placeholder="0,00"
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-slate-500 focus:outline-none" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Fecha de la venta</label>
            <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-slate-500 focus:outline-none" />
          </div>
        </div>
        <div className="mt-4 flex gap-2">
          <button onClick={onCancel} className="flex-1 rounded-lg border border-slate-300 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50">Cancelar</button>
          <button
            onClick={() => {
              const n = parseFloat(importe.replace(",", "."));
              onConfirm(Number.isFinite(n) ? n : null, fecha);
            }}
            className="flex-1 rounded-lg bg-emerald-600 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            Confirmar venta
          </button>
        </div>
      </div>
    </div>
  );
}
