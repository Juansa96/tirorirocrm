import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { CopyCheck, Trash2, Check, Package, ArrowLeft, ShieldCheck } from "lucide-react";
import { useStore, actions } from "@/lib/store";
import { formatShortDate, formatCurrency } from "@/lib/format";
import { TIPOS_PRODUCTO } from "@/components/ProductoForm";
import { displayModelo } from "@/lib/catalogo";
import type { Producto, Lead } from "@/lib/types";

export const Route = createFileRoute("/duplicados")({
  head: () => ({ meta: [{ title: "Duplicados — TiroCRM" }] }),
  component: DuplicadosPage,
});

const TAG = "[posible-duplicado]";
function esDuplicado(p: Producto): boolean {
  return (p.notasProducto || "").toLowerCase().includes("[posible-duplicado]");
}
function dupKey(p: Producto): string {
  return [p.leadId, p.tipo, p.modelo, p.ancho ?? "", p.alto ?? "", p.precioUnitario].join("|");
}
function tipoLabel(tipo: string): string {
  return TIPOS_PRODUCTO.find((t) => t.id === tipo)?.label ?? tipo;
}

interface Grupo {
  key: string;
  lead: Lead | undefined;
  productos: Producto[];
}

function DuplicadosPage() {
  const { productos, leads, pedidos } = useStore();

  const grupos: Grupo[] = useMemo(() => {
    // Agrupa por clave de duplicado; solo interesan los grupos que tienen al
    // menos una fila marcada como [posible-duplicado].
    const map = new Map<string, Producto[]>();
    for (const p of productos) {
      const k = dupKey(p);
      const arr = map.get(k) ?? [];
      arr.push(p);
      map.set(k, arr);
    }
    const out: Grupo[] = [];
    for (const [key, arr] of map.entries()) {
      if (arr.length < 2) continue;
      if (!arr.some(esDuplicado)) continue;
      // Orden: primero el que se conserva (sin tag), luego los marcados.
      arr.sort((a, b) => Number(esDuplicado(a)) - Number(esDuplicado(b)) || (a.createdAt || "").localeCompare(b.createdAt || ""));
      out.push({ key, lead: leads.find((l) => l.id === arr[0].leadId), productos: arr });
    }
    // Grupos con nombre de cliente ordenados alfabéticamente.
    out.sort((a, b) => (a.lead?.nombre || "").localeCompare(b.lead?.nombre || ""));
    return out;
  }, [productos, leads]);

  const pedidosDe = (prodId: string) => pedidos.filter((pd) => pd.productoLeadId === prodId);
  const totalMarcados = grupos.reduce((s, g) => s + g.productos.filter(esDuplicado).length, 0);

  return (
    <div className="space-y-5">
      <Link to="/datos" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" /> Volver a Datos
      </Link>
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
          <CopyCheck className="h-6 w-6 text-[#1a1f36]" /> Revisar duplicados
        </h1>
        <p className="text-sm text-slate-500">
          {grupos.length} grupo{grupos.length === 1 ? "" : "s"} · {totalMarcados} producto{totalMarcados === 1 ? "" : "s"} marcado{totalMarcados === 1 ? "" : "s"} como posible duplicado
        </p>
      </div>

      {grupos.length === 0 ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 py-12 text-center">
          <ShieldCheck className="mx-auto mb-2 h-8 w-8 text-emerald-500" />
          <p className="text-sm font-medium text-emerald-800">No hay duplicados pendientes de revisar</p>
          <p className="text-xs text-emerald-600">Todo limpio.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {grupos.map((g) => (
            <div key={g.key} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/70 px-4 py-2.5">
                <div className="min-w-0">
                  {g.lead ? (
                    <Link to="/clientes/$id" params={{ id: g.lead.id }} className="text-sm font-bold text-slate-900 hover:text-[#1a4b5b] hover:underline">
                      {g.lead.nombre}
                    </Link>
                  ) : (
                    <span className="text-sm font-bold text-slate-900">Sin cliente</span>
                  )}
                  <span className="ml-2 text-xs text-slate-500">
                    {tipoLabel(g.productos[0].tipo)}{displayModelo(g.productos[0].modelo) ? ` · ${displayModelo(g.productos[0].modelo)}` : ""}
                    {g.productos[0].ancho && g.productos[0].alto ? ` · ${g.productos[0].ancho}×${g.productos[0].alto}` : ""}
                    {g.productos[0].precioUnitario > 0 ? ` · ${formatCurrency(g.productos[0].precioUnitario)}` : ""}
                  </span>
                </div>
                <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-600">{g.productos.length} copias</span>
              </div>

              <div className="divide-y divide-slate-100">
                {g.productos.map((p) => {
                  const dup = esDuplicado(p);
                  const peds = pedidosDe(p.id);
                  return (
                    <div key={p.id} className={`flex flex-wrap items-center gap-3 px-4 py-3 ${dup ? "" : "bg-emerald-50/40"}`}>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          {dup ? (
                            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">⚠ Posible duplicado</span>
                          ) : (
                            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">✓ Se conserva</span>
                          )}
                          {p.tela && <span className="text-xs text-slate-600">Tela: <strong>{p.tela}</strong></span>}
                          {p.color && <span className="text-xs text-slate-600">Lateral: <strong>{p.color}</strong></span>}
                          <span className="text-xs text-slate-400">Creado {formatShortDate(p.createdAt)}</span>
                          {peds.length > 0 && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-semibold text-sky-700">
                              <Package className="h-3 w-3" /> {peds.length} pedido{peds.length === 1 ? "" : "s"}
                            </span>
                          )}
                        </div>
                        {p.notasProducto && (
                          <div className="mt-1 truncate text-xs italic text-slate-400">
                            {p.notasProducto.replace(new RegExp(TAG.replace(/[[\]]/g, "\\$&"), "gi"), "").trim()}
                          </div>
                        )}
                      </div>
                      {dup && (
                        <div className="flex shrink-0 items-center gap-1.5">
                          <button
                            onClick={() => actions.desmarcarDuplicado(p.id)}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                            title="No es un duplicado — quitar la marca"
                          >
                            <Check className="h-3.5 w-3.5" /> No es duplicado
                          </button>
                          <button
                            onClick={() => {
                              const aviso = peds.length > 0
                                ? `Este producto tiene ${peds.length} pedido(s) enlazado(s). Si lo borras, esos pedidos quedarán sin producto. ¿Eliminar de todas formas?`
                                : "¿Eliminar este producto duplicado?";
                              if (confirm(aviso)) actions.deleteProducto(p.id);
                            }}
                            className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-100"
                          >
                            <Trash2 className="h-3.5 w-3.5" /> Eliminar
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
