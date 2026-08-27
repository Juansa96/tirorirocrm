import { useState, useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { User, Eye, Send } from "lucide-react";
import { useStore, actions } from "@/lib/store";
import { supabase } from "@/integrations/supabase/client";
import { tapiceroNombre, type Pedido, type Lead, type Producto, type Tapicero } from "@/lib/types";
import { formatShortDate } from "@/lib/format";
import { tipoLabelOf, displayModelo, displayColeccionTela } from "@/lib/catalogo";
import { toast } from "sonner";

// Avisa por email a un tapicero de un grupo de pedidos (uno solo, agrupado).
async function avisarGrupo(pedidoIds: string[]): Promise<void> {
  if (pedidoIds.length === 0) return;
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token ?? "";
  const res = await fetch("/api/tapicero/enviar", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ pedidoIds }),
  });
  if (res.ok) { const d = await res.json().catch(() => ({})); toast.success(d.emailsEncolados ? "Email enviado al tapicero." : "Marcado como enviado."); }
  else toast.error("No se pudo enviar el aviso.");
}

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

interface Linea { pedido: Pedido; lead: Lead | undefined; producto: Producto | undefined; }
interface Grupo { tapicero: Tapicero | null; lineas: Linea[]; }

const SIN_ASIGNAR = "__sin__";

// Vista de producción por tapicero. Va DENTRO de Pedidos (pestaña Producción).
// Permite filtrar por un tapicero concreto y ver solo lo que está en curso.
export function ProduccionPanel() {
  const { pedidos, leads, productos, tapiceros } = useStore();
  const [soloEnCurso, setSoloEnCurso] = useState(true);
  const [tapiceroF, setTapiceroF] = useState<string>("todos"); // "todos" | id | SIN_ASIGNAR

  // Tapiceros que aparecen en el selector: activos + inactivos que tengan pedidos.
  const conPedidos = useMemo(
    () => new Set(pedidos.map((p) => p.tapiceroId).filter(Boolean)),
    [pedidos],
  );
  const tapicerosSelect = useMemo(
    () => [...tapiceros].sort((a, b) => a.orden - b.orden).filter((t) => t.activo || conPedidos.has(t.id)),
    [tapiceros, conPedidos],
  );

  const grupos = useMemo<Grupo[]>(() => {
    const visibles = pedidos.filter((p) => (soloEnCurso ? !p.entregado : true));
    const lineaDe = (p: Pedido): Linea => ({
      pedido: p,
      lead: leads.find((l) => l.id === p.leadId),
      producto: productos.find((pr) => pr.id === p.productoLeadId),
    });

    const out: Grupo[] = tapicerosSelect
      .filter((t) => tapiceroF === "todos" || tapiceroF === t.id)
      .map((t) => ({ tapicero: t, lineas: visibles.filter((p) => p.tapiceroId === t.id).map(lineaDe) }));

    if (tapiceroF === "todos" || tapiceroF === SIN_ASIGNAR) {
      const sinAsignar = visibles.filter((p) => !p.tapiceroId);
      if (sinAsignar.length > 0) out.push({ tapicero: null, lineas: sinAsignar.map(lineaDe) });
    }
    for (const g of out) {
      g.lineas.sort((a, b) => (a.pedido.fechaLimite || "9999").localeCompare(b.pedido.fechaLimite || "9999"));
    }
    return out.filter((g) => g.lineas.length > 0);
  }, [pedidos, leads, productos, tapicerosSelect, soloEnCurso, tapiceroF]);

  const totalLineas = grupos.reduce((acc, g) => acc + g.lineas.length, 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-2 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-xs font-medium text-slate-500">Tapicero</label>
          <select
            value={tapiceroF}
            onChange={(e) => setTapiceroF(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm focus:border-slate-400 focus:outline-none"
          >
            <option value="todos">Todos los tapiceros</option>
            {tapicerosSelect.map((t) => (
              <option key={t.id} value={t.id}>{tapiceroNombre(t)}{!t.activo ? " (inactivo)" : ""}</option>
            ))}
            <option value={SIN_ASIGNAR}>Sin asignar</option>
          </select>
          <span className="text-xs text-slate-400">{totalLineas} producto{totalLineas === 1 ? "" : "s"}</span>
        </div>
        <Link
          to="/panel"
          search={tapiceroF !== "todos" && tapiceroF !== SIN_ASIGNAR ? { tapicero: tapiceroF } : {}}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          <Eye className="h-4 w-4" /> Ver panel del tapicero
        </Link>
        <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-700">
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
        <div className="rounded-xl border border-slate-200 bg-white py-12 text-center text-sm text-slate-400 shadow-sm">
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
              <div className="flex items-center gap-2">
                {g.tapicero && (
                  <button
                    onClick={() => { if (confirm(`¿Avisar por email a ${tapiceroNombre(g.tapicero)} de estos ${g.lineas.length} pedido(s)?`)) void avisarGrupo(g.lineas.map((l) => l.pedido.id)); }}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    <Send className="h-3.5 w-3.5" /> Avisar por email
                  </button>
                )}
                <span className="rounded-full bg-[#1a1f36] px-2.5 py-0.5 text-xs font-bold text-white">{g.lineas.length}</span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wide text-slate-400">
                    <th className="px-4 py-2 font-semibold">Cliente</th>
                    <th className="px-4 py-2 font-semibold">Producto</th>
                    <th className="px-4 py-2 font-semibold">Medidas</th>
                    <th className="px-4 py-2 font-semibold">Tela</th>
                    <th className="px-4 py-2 font-semibold">Entrega comprometida</th>
                    <th className="px-4 py-2 font-semibold">Tapicero</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {g.lineas.map(({ pedido, lead, producto }) => (
                    <tr key={pedido.id} className="hover:bg-slate-50">
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-1.5">
                          {pedido.numero != null && <span className="shrink-0 rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-bold text-white">Nº {pedido.numero}</span>}
                          <Link to="/pedidos/$id" params={{ id: pedido.id }} className="font-medium text-slate-900 hover:text-blue-600">
                            {lead?.nombre || pedido.clienteNombreLibre || "—"}
                          </Link>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-slate-700">
                        {producto ? `${tipoLabelOf(producto.tipo)} · ${displayModelo(producto.modelo)}` : "—"}
                      </td>
                      <td className="px-4 py-2.5 text-slate-600">{medidasOf(producto)}</td>
                      <td className="px-4 py-2.5 text-slate-600">{telaOf(producto)}</td>
                      <td className="px-4 py-2.5 text-slate-600">{pedido.fechaLimite ? formatShortDate(pedido.fechaLimite) : "—"}</td>
                      <td className="px-4 py-2.5">
                        <select
                          value={pedido.tapiceroId}
                          onChange={(e) => actions.reasignarTapicero(pedido.id, e.target.value)}
                          className="rounded border border-slate-200 bg-white px-2 py-1 text-xs focus:border-slate-400 focus:outline-none"
                        >
                          <option value="">Sin asignar</option>
                          {tapicerosSelect.map((t) => (
                            <option key={t.id} value={t.id}>{tapiceroNombre(t)}{!t.activo ? " (inactivo)" : ""}</option>
                          ))}
                          {/* Incluye el asignado aunque esté inactivo y no salga en la lista */}
                          {pedido.tapiceroId && !tapicerosSelect.some((t) => t.id === pedido.tapiceroId) && (
                            <option value={pedido.tapiceroId}>(tapicero actual)</option>
                          )}
                        </select>
                      </td>
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
