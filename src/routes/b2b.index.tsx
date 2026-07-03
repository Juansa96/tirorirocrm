import { createFileRoute, Link } from "@tanstack/react-router";
import { Plus, ChevronRight, Search, Columns3, Building2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { ASIGNADOS_B2B, ETAPAS_B2B, ETAPA_COLORS, type EtapaB2B } from "@/lib/types";
import { formatCurrency, formatShortDate } from "@/lib/format";
import { StageBadge } from "@/components/StageBadge";
import { DeleteLeadButton } from "@/components/DeleteLeadButton";

export const Route = createFileRoute("/b2b/")({
  head: () => ({ meta: [{ title: "B2B — TiroCRM" }] }),
  component: B2BList,
});

function B2BList() {
  const { leads } = useStore();
  const [q, setQ] = useState("");
  const [asignado, setAsignado] = useState("");
  const [etapa, setEtapa] = useState<EtapaB2B | "">("");

  const b2b = useMemo(() => leads.filter((l) => l.tipo === "B2B"), [leads]);

  const filtered = b2b.filter((l) => {
    const ql = q.toLowerCase();
    if (q) {
      const hay = [l.nombre, l.razonSocial, l.contactoNombre, l.contactoApellidos, l.email, l.telefono, l.instagram, l.nif]
        .filter(Boolean).join(" ").toLowerCase();
      if (!hay.includes(ql)) return false;
    }
    if (asignado) {
      if (asignado === "__sin__") { if ((l.asignados ?? []).length > 0) return false; }
      else if (!(l.asignados ?? []).includes(asignado)) return false;
    }
    if (etapa && l.etapa !== etapa) return false;
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
            <Building2 className="h-6 w-6 text-[#1a4b5b]" /> B2B — Empresas
          </h1>
          <p className="text-sm text-slate-500">{filtered.length} de {b2b.length} empresas</p>
        </div>
        <div className="flex gap-2">
          <Link to="/pipeline-b2b" className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
            <Columns3 className="h-4 w-4" /> Pipeline B2B
          </Link>
          <Link to="/b2b/nuevo" className="inline-flex items-center gap-1.5 rounded-lg bg-[#1a4b5b] px-4 py-2 text-sm font-medium text-white hover:bg-[#245e73]">
            <Plus className="h-4 w-4" /> Nueva empresa
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por razón social, contacto, NIF, IG…"
            className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm focus:border-slate-400 focus:outline-none"
          />
        </div>
        <select value={asignado} onChange={(e) => setAsignado(e.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
          <option value="">Todos los asignados</option>
          <option value="__sin__">Sin asignar</option>
          {ASIGNADOS_B2B.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <select value={etapa} onChange={(e) => setEtapa(e.target.value as EtapaB2B | "")} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
          <option value="">Todas las etapas</option>
          {ETAPAS_B2B.map((e) => <option key={e} value={e}>{e}</option>)}
        </select>
      </div>

      {/* Chips etapa */}
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={() => setEtapa("")}
          className={`rounded-full px-2.5 py-1 text-xs font-medium ${etapa === "" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
        >Todas</button>
        {ETAPAS_B2B.map((e) => {
          const active = etapa === e;
          return (
            <button
              key={e}
              type="button"
              onClick={() => setEtapa(active ? "" : e)}
              className="rounded-full px-2.5 py-1 text-xs font-medium"
              style={{ backgroundColor: active ? ETAPA_COLORS[e] : "#f1f5f9", color: active ? "#fff" : "#475569" }}
            >
              {e}
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white py-16 text-center">
          <Building2 className="mx-auto mb-2 h-8 w-8 text-slate-300" />
          <div className="text-sm text-slate-500">{b2b.length === 0 ? "Aún no hay empresas B2B" : "Sin resultados"}</div>
          {b2b.length === 0 && (
            <Link to="/b2b/nuevo" className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-[#1a4b5b] px-4 py-2 text-sm font-medium text-white hover:bg-[#245e73]">
              <Plus className="h-4 w-4" /> Crear la primera empresa
            </Link>
          )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="hidden w-full text-sm md:table">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Empresa</th>
                <th className="px-4 py-3">Contacto</th>
                <th className="px-4 py-3">Etapa</th>
                <th className="px-4 py-3">Asignados</th>
                <th className="px-4 py-3">Valor</th>
                <th className="px-4 py-3">Alta</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((l) => {
                const titulo = l.razonSocial || l.contactoNombre || l.nombre || "Sin nombre";
                const contacto = [l.contactoNombre, l.contactoApellidos].filter(Boolean).join(" ") || l.instagram || l.email || "—";
                return (
                  <tr key={l.id} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <Link to="/clientes/$id" params={{ id: l.id }} className="font-semibold text-slate-900 hover:text-[#1a4b5b] hover:underline">{titulo}</Link>
                      {l.nif && <div className="text-[11px] text-slate-400">NIF {l.nif}</div>}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{contacto}</td>
                    <td className="px-4 py-3"><StageBadge etapa={l.etapa} /></td>
                    <td className="px-4 py-3">
                      {(l.asignados ?? []).length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {l.asignados.map((a) => (
                            <span key={a} className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700">{a}</span>
                          ))}
                        </div>
                      ) : <span className="text-xs text-slate-400">Sin asignar</span>}
                    </td>
                    <td className="px-4 py-3 font-medium">{l.valor > 0 ? formatCurrency(l.valor) : <span className="text-slate-400">—</span>}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">{formatShortDate(l.fechaCreacion)}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-1">
                        <Link to="/clientes/$id" params={{ id: l.id }} className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-600 hover:bg-[#1a4b5b] hover:text-white">
                          <ChevronRight className="h-4 w-4" />
                        </Link>
                        <DeleteLeadButton id={l.id} variant="menu" />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div className="divide-y divide-slate-100 md:hidden">
            {filtered.map((l) => {
              const titulo = l.razonSocial || l.contactoNombre || l.nombre || "Sin nombre";
              return (
                <Link key={l.id} to="/clientes/$id" params={{ id: l.id }} className="block p-3 active:bg-slate-50">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-slate-900">{titulo}</div>
                      {l.contactoNombre && <div className="truncate text-xs text-slate-500">{l.contactoNombre} {l.contactoApellidos}</div>}
                    </div>
                    <StageBadge etapa={l.etapa} />
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-1 text-xs">
                    {(l.asignados ?? []).length > 0
                      ? l.asignados.map((a) => <span key={a} className="rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-600">{a}</span>)
                      : <span className="text-slate-400">Sin asignar</span>}
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
