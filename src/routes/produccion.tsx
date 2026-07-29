import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { Package, User } from "lucide-react";
import { useStore } from "@/lib/store";
import { tapiceroNombre, type Pedido, type Lead, type Producto, type Tapicero } from "@/lib/types";
import { formatShortDate } from "@/lib/format";
import { tipoLabelOf, displayModelo, displayColeccionTela } from "@/lib/catalogo";

export const Route = createFileRoute("/produccion")({
  head: () => ({ meta: [{ title: "Producción — TiroCRM" }] }),
  component: Produccion,
});

// Medidas legibles a partir de ancho/alto/fondo (los que existan).
function medidasOf(p: Producto | undefined): string {
  if (!p) return "—";
  const dims = [p.ancho, p.alto, p.fondo].filter((d): d is number => d != null && d > 0);
  return dims.length ? dims.join(" × ") + " cm" : "—";
}

// Tela legible: nombre de tela + categoría (Básicas/Premium) si la hay.
function telaOf(p: Producto | undefined): string {
  if (!p) return "—";
  const partes = [p.tela?.trim(), p.coleccionTela ? displayColeccionTela(p.coleccionTela) : ""].filter(Boolean);
  return partes.length ? partes.join(" · ") : "—";
}

interface Linea {
  pedido: Pedido;
  lead: Lead | undefined;
  producto: Producto | undefined;
}

interface Grupo {
  tapicero: Tapicero | null; // null = "Sin asignar"
  lineas: Linea[];
}

function Produccion() {
  const { pedidos, leads, productos, tapiceros } = useStore();
  const [soloEnCurso, setSoloEnCurso] = useState(true);

  const grupos = useMemo<Grupo[]>(() => {
    // Filtra por "en curso" = todavía no entregado.
    const visibles = pedidos.filter((p) => (soloEnCurso ? !p.entregado : true));

    const lineaDe = (p: Pedido): Linea => ({
      pedido: p,
      lead: leads.find((l) => l.id === p.leadId),
      producto: productos.find((pr) => pr.id === p.productoLeadId),
    });

    // Orden de tapiceros: activos por `orden`, luego inactivos que aún tengan
    // pedidos (para no perderlos), y por último el grupo "Sin asignar".
    const conPedidos = new Set(pedidos.map((p) => p.tapiceroId).filter(Boolean));
    const ordenados = [...tapiceros].sort((a, b) => a.orden - b.orden)
      .filter((t) => t.activo || conPedidos.has(t.id));

    const out: Grupo[] = ordenados.map((t) => ({
      tapicero: t,
      lineas: visibles.filter((p) => p.tapiceroId === t.id).map(lineaDe),
    }));

    const sinAsignar = visibles.filter((p) => !p.tapiceroId);
    if (sinAsignar.length > 0) {
      out.push({ tapicero: null, lineas: sinAsignar.map(lineaDe) });
    }
    // Ordena cada grupo por fecha de entrega comprometida (más próxima primero).
    for (const g of out) {
      g.lineas.sort((a, b) => (a.pedido.fechaLimite || "9999").localeCompare(b.pedido.fechaLimite || "9999"));
    }
    // Solo grupos con al menos una línea.
    return out.filter((g) => g.lineas.length > 0);
  }, [pedidos, leads, productos, tapiceros, soloEnCurso]);

  const totalLineas = grupos.reduce((acc, g) => acc + g.lineas.length, 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold sm:text-2xl">
            <Package className="h-5 w-5 text-[#1a1f36]" /> Producción por tapicero
          </h1>
          <p className="mt-1 text-sm text-slate-500">{totalLineas} producto{totalLineas === 1 ? "" : "s"} {soloEnCurso ? "en curso" : "en total"}</p>
        </div>
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm">
          <input
            type="checkbox"
            checked={soloEnCurso}
            onChange={(e) => setSoloEnCurso(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
          />
          Solo en curso
        </label>
      </div>

      {grupos.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white py-16 text-center text-sm text-slate-400 shadow-sm">
          No hay productos {soloEnCurso ? "en curso" : ""} para mostrar.
        </div>
      ) : (
        grupos.map((g) => (
          <div key={g.tapicero?.id ?? "sin-asignar"} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/60 px-4 py-3">
              <div className="flex items-center gap-2 font-semibold text-slate-900">
                <User className="h-4 w-4 text-slate-400" />
                {g.tapicero ? tapiceroNombre(g.tapicero) : "Sin asignar"}
                {g.tapicero && !g.tapicero.activo && (
                  <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-medium text-slate-500">inactivo</span>
                )}
              </div>
              <span className="rounded-full bg-[#1a1f36] px-2.5 py-0.5 text-xs font-bold text-white">
                {g.lineas.length}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wide text-slate-400">
                    <th className="px-4 py-2 font-semibold">Cliente</th>
                    <th className="px-4 py-2 font-semibold">Producto</th>
                    <th className="px-4 py-2 font-semibold">Medidas</th>
                    <th className="px-4 py-2 font-semibold">Tela</th>
                    <th className="px-4 py-2 font-semibold">Entrega comprometida</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {g.lineas.map(({ pedido, lead, producto }) => (
                    <tr key={pedido.id} className="hover:bg-slate-50">
                      <td className="px-4 py-2.5">
                        <Link to="/pedidos/$id" params={{ id: pedido.id }} className="font-medium text-slate-900 hover:text-blue-600">
                          {lead?.nombre || pedido.clienteNombreLibre || "—"}
                        </Link>
                      </td>
                      <td className="px-4 py-2.5 text-slate-700">
                        {producto ? `${tipoLabelOf(producto.tipo)} · ${displayModelo(producto.modelo)}` : "—"}
                      </td>
                      <td className="px-4 py-2.5 text-slate-600">{medidasOf(producto)}</td>
                      <td className="px-4 py-2.5 text-slate-600">{telaOf(producto)}</td>
                      <td className="px-4 py-2.5 text-slate-600">{pedido.fechaLimite ? formatShortDate(pedido.fechaLimite) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
