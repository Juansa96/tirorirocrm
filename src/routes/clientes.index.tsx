import { createFileRoute, Link } from "@tanstack/react-router";
import { Plus, ExternalLink, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { useStore, nextPendingTaskFor } from "@/lib/store";
import { VENDEDORES, vendorName } from "@/lib/types";
import { formatCurrency, dateLabel } from "@/lib/format";
import { SellerBadge } from "@/components/SellerBadge";
import { StageBadge } from "@/components/StageBadge";
import { DeleteLeadButton } from "@/components/DeleteLeadButton";

export const Route = createFileRoute("/clientes/")({
  head: () => ({ meta: [{ title: "Clientes — TiroCRM" }] }),
  component: ClientesList,
});

function ClientesList() {
  const { leads, tareas } = useStore();
  const [q, setQ] = useState("");
  const [vendedor, setVendedor] = useState("");
  const [producto, setProducto] = useState("");
  const [ciudad, setCiudad] = useState("");

  const productos = useMemo(() => Array.from(new Set(leads.map((l) => l.producto).filter(Boolean))), [leads]);
  const ciudades = useMemo(() => Array.from(new Set(leads.map((l) => l.ciudad).filter(Boolean))), [leads]);

  const filtered = leads.filter((l) => {
    const ql = q.toLowerCase();
    if (q && !l.nombre.toLowerCase().includes(ql) && !l.email.toLowerCase().includes(ql)) return false;
    if (vendedor && l.vendedor !== vendedor) return false;
    if (producto && l.producto !== producto) return false;
    if (ciudad && l.ciudad !== ciudad) return false;
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Clientes</h1>
          <p className="text-sm text-slate-500">{filtered.length} de {leads.length} registros</p>
        </div>
        <Link to="/clientes/nuevo" className="inline-flex items-center gap-1.5 rounded-lg bg-[#1a1f36] px-4 py-2 text-sm font-medium text-white hover:bg-[#2a2f46]">
          <Plus className="h-4 w-4" /> Nuevo Lead
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
        <div className="relative md:col-span-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre o email" className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm focus:border-slate-400 focus:outline-none" />
        </div>
        <select value={vendedor} onChange={(e) => setVendedor(e.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
          <option value="">Todos los vendedores</option>
          {VENDEDORES.map((v) => (<option key={v} value={v}>{vendorName(v)}</option>))}
        </select>
        <select value={producto} onChange={(e) => setProducto(e.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
          <option value="">Todos los intereses</option>
          {productos.map((p) => (<option key={p} value={p}>{p}</option>))}
        </select>
        <select value={ciudad} onChange={(e) => setCiudad(e.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
          <option value="">Todas las ciudades</option>
          {ciudades.map((c) => (<option key={c} value={c}>{c}</option>))}
        </select>
      </div>

      <div className="hidden overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm md:block">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Nombre</th>
              <th className="px-4 py-3">Vendedor</th>
              <th className="px-4 py-3">Etapa</th>
              <th className="px-4 py-3">Valor</th>
              <th className="px-4 py-3">Ciudad</th>
              <th className="px-4 py-3">Próxima Acción</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {filtered.map((l) => {
              const next = nextPendingTaskFor(l.id, tareas);
              return (
                <tr key={l.id} className="border-t border-slate-100 transition-colors hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <div className="font-semibold text-slate-900">{l.nombre}</div>
                    {l.email && <div className="text-xs text-slate-500">{l.email}</div>}
                  </td>
                  <td className="px-4 py-3"><SellerBadge vendedor={l.vendedor} /></td>
                  <td className="px-4 py-3"><StageBadge etapa={l.etapa} /></td>
                  <td className="px-4 py-3 font-medium">{l.valor > 0 ? formatCurrency(l.valor) : <span className="text-slate-400">—</span>}</td>
                  <td className="px-4 py-3 text-slate-600">{l.ciudad}</td>
                  <td className="px-4 py-3 text-slate-600">{next ? dateLabel(next.fecha) : <span className="text-slate-400">—</span>}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex items-center gap-1">
                      <Link to="/clientes/$id" params={{ id: l.id }} className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700">
                        <ExternalLink className="h-4 w-4" />
                      </Link>
                      <DeleteLeadButton id={l.id} variant="menu" />
                    </div>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-slate-400">Sin resultados</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="space-y-2 md:hidden">
        {filtered.map((l) => {
          const next = nextPendingTaskFor(l.id, tareas);
          return (
            <div key={l.id} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm transition-shadow hover:shadow-md">
              <div className="flex items-start justify-between gap-2">
                <Link to="/clientes/$id" params={{ id: l.id }} className="flex-1 font-semibold text-slate-900">
                  {l.nombre}
                </Link>
                <StageBadge etapa={l.etapa} />
                <DeleteLeadButton id={l.id} variant="menu" />
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-600">
                <SellerBadge vendedor={l.vendedor} />
                {l.valor > 0 && <span className="font-medium">{formatCurrency(l.valor)}</span>}
                {next && <span className="text-amber-700">· {dateLabel(next.fecha)}</span>}
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && <div className="py-8 text-center text-sm text-slate-400">Sin resultados</div>}
      </div>
    </div>
  );
}
