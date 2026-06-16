import { createFileRoute, Link } from "@tanstack/react-router";
import { Plus, ChevronRight, Search, ArrowUp, ArrowDown } from "lucide-react";
import { useMemo, useState } from "react";
import { useStore, nextPendingTaskFor } from "@/lib/store";
import { VENDEDORES, vendorName, ETAPAS } from "@/lib/types";
import { formatCurrency, dateLabel, formatShortDate } from "@/lib/format";
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
  type SortKey = "fechaCreacion" | "nombre" | "vendedor" | "etapa" | "valor" | "ciudad" | "proximaAccion";
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" } | null>(null);

  const productos = useMemo(() => Array.from(new Set(leads.map((l) => l.producto).filter(Boolean))), [leads]);
  const ciudades = useMemo(() => Array.from(new Set(leads.map((l) => l.ciudad).filter(Boolean))), [leads]);

  const filtered = leads.filter((l) => {
    const ql = q.toLowerCase();
    if (q && !l.nombre.toLowerCase().includes(ql) && !l.email.toLowerCase().includes(ql) && !l.telefono.toLowerCase().includes(ql)) return false;
    if (vendedor && l.vendedor && l.vendedor !== vendedor) return false;
    if (producto && l.producto !== producto) return false;
    if (ciudad && l.ciudad !== ciudad) return false;
    return true;
  });

  const sorted = useMemo(() => {
    if (!sort) return filtered;
    const arr = [...filtered];
    arr.sort((a, b) => {
      let cmp = 0;
      switch (sort.key) {
        case "fechaCreacion": {
          const timeA = a.fechaCreacion ? new Date(a.fechaCreacion).getTime() : Infinity;
          const timeB = b.fechaCreacion ? new Date(b.fechaCreacion).getTime() : Infinity;
          cmp = timeA - timeB;
          break;
        }
        case "nombre":
          cmp = a.nombre.localeCompare(b.nombre, "es");
          break;
        case "vendedor":
          cmp = (a.vendedor || "").localeCompare(b.vendedor || "", "es");
          break;
        case "etapa":
          cmp = ETAPAS.indexOf(a.etapa) - ETAPAS.indexOf(b.etapa);
          break;
        case "valor":
          cmp = (a.valor || 0) - (b.valor || 0);
          break;
        case "ciudad":
          cmp = (a.ciudad || "").localeCompare(b.ciudad || "", "es");
          break;
        case "proximaAccion": {
          const nextA = nextPendingTaskFor(a.id, tareas);
          const nextB = nextPendingTaskFor(b.id, tareas);
          const dateA = nextA ? new Date(nextA.fecha).getTime() : Infinity;
          const dateB = nextB ? new Date(nextB.fecha).getTime() : Infinity;
          cmp = dateA - dateB;
          break;
        }
      }
      return sort.dir === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [filtered, sort, tareas]);

  function toggleSort(key: SortKey) {
    setSort((prev) => {
      if (prev?.key === key) {
        return prev.dir === "asc" ? { key, dir: "desc" } : null;
      }
      return { key, dir: "asc" };
    });
  }

  function SortHeader({ label, sortKey }: { label: string; sortKey: SortKey }) {
    const active = sort?.key === sortKey;
    return (
      <th
        className="cursor-pointer select-none px-4 py-3 hover:text-slate-700"
        onClick={() => toggleSort(sortKey)}
      >
        <span className="inline-flex items-center gap-1">
          {label}
          {active && (sort.dir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
        </span>
      </th>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Clientes</h1>
          <p className="text-sm text-slate-500">{sorted.length} de {leads.length} registros</p>
        </div>
        <Link to="/clientes/nuevo" className="inline-flex items-center gap-1.5 rounded-lg bg-[#1a1f36] px-4 py-2 text-sm font-medium text-white hover:bg-[#2a2f46]">
          <Plus className="h-4 w-4" /> Nuevo Lead
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <div className="relative col-span-2 md:col-span-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre, email o teléfono" className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm focus:border-slate-400 focus:outline-none" />
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
              <SortHeader label="Fecha de entrada" sortKey="fechaCreacion" />
              <SortHeader label="Nombre" sortKey="nombre" />
              <SortHeader label="Vendedor" sortKey="vendedor" />
              <SortHeader label="Etapa" sortKey="etapa" />
              <SortHeader label="Valor" sortKey="valor" />
              <SortHeader label="Ciudad" sortKey="ciudad" />
              <SortHeader label="Próxima Acción" sortKey="proximaAccion" />
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {sorted.map((l) => {
              const next = nextPendingTaskFor(l.id, tareas);
              return (
                <tr key={l.id} className="group border-t border-slate-100 transition-colors hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{formatShortDate(l.fechaCreacion)}</td>
                  <td className="px-4 py-3">
                    <Link to="/clientes/$id" params={{ id: l.id }} className="block font-semibold text-slate-900 hover:text-[#1a4b5b] hover:underline">
                      {l.nombre}
                    </Link>
                    {l.email && <div className="text-xs text-slate-500">{l.email}</div>}
                  </td>
                  <td className="px-4 py-3"><SellerBadge vendedor={l.vendedor} /></td>
                  <td className="px-4 py-3"><StageBadge etapa={l.etapa} /></td>
                  <td className="px-4 py-3 font-medium">{l.valor > 0 ? formatCurrency(l.valor) : <span className="text-slate-400">—</span>}</td>
                  <td className="px-4 py-3 text-slate-600">{l.ciudad}</td>
                  <td className="px-4 py-3 text-slate-600">{next ? dateLabel(next.fecha) : <span className="text-slate-400">—</span>}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex items-center gap-1">
                      <Link
                        to="/clientes/$id"
                        params={{ id: l.id }}
                        aria-label={`Abrir ficha de ${l.nombre}`}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-600 transition-all hover:bg-[#1a1f36] hover:text-white hover:shadow-md"
                      >
                        <ChevronRight className="h-5 w-5 transition-transform group-hover:translate-x-0.5" />
                      </Link>
                      <DeleteLeadButton id={l.id} variant="menu" />
                    </div>
                  </td>
                </tr>
              );
            })}
            {sorted.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-sm text-slate-400">Sin resultados</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="space-y-2 md:hidden">
        {sorted.map((l) => {
          const next = nextPendingTaskFor(l.id, tareas);
          return (
            <div key={l.id} className="group relative overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-all active:scale-[0.99] active:shadow-inner">
              <Link
                to="/clientes/$id"
                params={{ id: l.id }}
                aria-label={`Abrir ficha de ${l.nombre}`}
                className="flex items-stretch"
              >
                <div className="flex-1 p-3 pr-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-semibold text-slate-900">{l.nombre}</div>
                      <div className="mt-0.5 text-[11px] text-slate-400">Entrada: {formatShortDate(l.fechaCreacion)}</div>
                    </div>
                    <StageBadge etapa={l.etapa} />
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-600">
                    <SellerBadge vendedor={l.vendedor} />
                    {l.valor > 0 && <span className="font-medium">{formatCurrency(l.valor)}</span>}
                    {next && <span className="text-amber-700">· {dateLabel(next.fecha)}</span>}
                  </div>
                </div>
                <div className="flex w-12 items-center justify-center bg-slate-50 text-slate-400 transition-all group-hover:bg-[#1a1f36] group-hover:text-white group-active:bg-[#1a1f36] group-active:text-white">
                  <ChevronRight className="h-5 w-5 animate-pulse-x" />
                </div>
              </Link>
              <div className="absolute right-14 top-2">
                <DeleteLeadButton id={l.id} variant="menu" />
              </div>
            </div>
          );
        })}
        {sorted.length === 0 && <div className="py-8 text-center text-sm text-slate-400">Sin resultados</div>}
      </div>
    </div>
  );
}
