import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Users, TrendingUp, Trophy, Percent, Plus, ChevronDown, AlertTriangle, Package } from "lucide-react";
import { useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import { useStore, vendedorTotals } from "@/lib/store";
import { ETAPAS, ETAPA_COLORS, VENDEDORES, vendorName, semaforoPedido, type Etapa } from "@/lib/types";
import { formatCurrency, formatAxisCurrency } from "@/lib/format";
import { TaskItem } from "@/components/TaskItem";
import { sellerStyle } from "@/components/SellerBadge";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [{ title: "Dashboard — TiroCRM" }] }),
  component: Dashboard,
});

function KpiCard({ icon: Icon, label, value, badgeBg, iconColor, empty }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string; value: React.ReactNode; badgeBg: string; iconColor: string; empty?: boolean;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-shadow duration-150 hover:shadow-md">
      <div className="flex items-start justify-between">
        <div className="text-xs font-medium text-slate-500">{label}</div>
        <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${badgeBg}`}>
          <Icon className={`h-5 w-5 ${iconColor}`} />
        </div>
      </div>
      <div className={`mt-3 text-2xl font-bold ${empty ? "text-slate-400" : "text-slate-900"}`}>{value}</div>
      {empty && <div className="mt-1 text-xs text-slate-400">Sin datos aún</div>}
    </div>
  );
}

function Dashboard() {
  const { leads, tareas, pedidos } = useStore();
  const navigate = useNavigate();
  const [filterVendedor, setFilterVendedor] = useState("");

  const filteredLeads = filterVendedor
    ? leads.filter((l) => !l.vendedor || l.vendedor === filterVendedor)
    : leads;

  const totalLeads = filteredLeads.length;
  const valorPipeline = filteredLeads
    .filter((l) => l.etapa !== "Closed Won" && l.etapa !== "Closed Lost")
    .reduce((s, l) => s + l.valor, 0);
  const cerradoGanado = filteredLeads.filter((l) => l.etapa === "Closed Won").reduce((s, l) => s + l.valor, 0);
  const wonCount = filteredLeads.filter((l) => l.etapa === "Closed Won").length;
  const tasaConv = totalLeads > 0 && wonCount > 0 ? (wonCount / totalLeads) * 100 : null;

  const chartData = ETAPAS.map((etapa) => {
    const leadsEtapa = filteredLeads.filter((l) => l.etapa === etapa);
    const valor = leadsEtapa.reduce((s, l) => s + l.valor, 0);
    return { etapa, valor, displayValor: valor === 0 ? 0.0001 : valor, count: leadsEtapa.length, color: ETAPA_COLORS[etapa] };
  });

  const tareasPendientes = tareas
    .filter((t) => !t.completada && (!filterVendedor || t.vendedor === filterVendedor))
    .sort((a, b) => a.fecha.localeCompare(b.fecha));

  const vendTotals = vendedorTotals(leads);
  const maxVendValor = Math.max(1, ...VENDEDORES.map((v) => vendTotals.get(v)!.valor));

  // Pedidos en riesgo (ámbar) o atrasados (rojo), no entregados
  const pedidosRiesgo = pedidos.filter((p) => {
    if (p.entregado) return false;
    const s = semaforoPedido(p);
    return s.estado !== "verde";
  });
  const pedidosAtrasados = pedidosRiesgo.filter((p) => semaforoPedido(p).estado === "rojo");

  function goEtapa(etapa: Etapa) {
    navigate({
      to: "/pipeline",
      search: { etapa, ...(filterVendedor ? { vendedor: filterVendedor } : {}) } as never,
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-sm text-slate-500">Resumen del pipeline de ventas</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <select
              value={filterVendedor}
              onChange={(e) => setFilterVendedor(e.target.value)}
              className="appearance-none rounded-lg border border-slate-200 bg-white py-2 pl-3 pr-8 text-sm text-slate-700 focus:border-slate-400 focus:outline-none"
            >
              <option value="">Todos los vendedores</option>
              {VENDEDORES.map((v) => (
                <option key={v} value={v}>{vendorName(v)}</option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          </div>
          <Link to="/clientes/nuevo" className="inline-flex items-center gap-1.5 rounded-lg bg-[#1a1f36] px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors duration-150 hover:bg-[#2a2f46]">
            <Plus className="h-4 w-4" /> Nuevo Lead
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard icon={Users} label="TOTAL LEADS" value={totalLeads} badgeBg="bg-sky-100" iconColor="text-sky-600" />
        <KpiCard icon={TrendingUp} label="VALOR PIPELINE" value={formatCurrency(valorPipeline)} badgeBg="bg-amber-100" iconColor="text-amber-600" />
        <KpiCard icon={Trophy} label="CERRADO GANADO" value={formatCurrency(cerradoGanado)} badgeBg="bg-emerald-100" iconColor="text-emerald-600" />
        <KpiCard icon={Percent} label="TASA DE CONVERSIÓN" value={tasaConv !== null ? `${tasaConv.toFixed(1)}%` : "—"} badgeBg="bg-violet-100" iconColor="text-violet-600" empty={tasaConv === null} />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:p-6">
        <div className="mb-1 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">Valor por Etapa</h2>
          <span className="text-xs text-slate-400">Clic en barra → filtrar pipeline</span>
        </div>
        <div className="h-[240px] w-full md:h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 36 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="etapa" tick={{ fontSize: 10, fill: "#64748b" }} interval={0} angle={-30} textAnchor="end" />
              <YAxis tick={{ fontSize: 11, fill: "#64748b" }} tickFormatter={formatAxisCurrency} />
              <Tooltip
                cursor={{ fill: "rgba(0,0,0,0.04)" }}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0].payload as (typeof chartData)[number];
                  return (
                    <div className="rounded-lg border border-slate-200 bg-white p-2 text-xs shadow-md">
                      <div className="font-semibold">{d.etapa}</div>
                      <div className="text-slate-600">{d.valor === 0 ? "Sin valor asignado" : formatCurrency(d.valor)}</div>
                      <div className="text-slate-500">{d.count} leads</div>
                    </div>
                  );
                }}
              />
              <Bar dataKey="displayValor" radius={[4, 4, 0, 0]} minPointSize={2} cursor="pointer" onClick={(d: { etapa: Etapa }) => goEtapa(d.etapa)}>
                {chartData.map((d, i) => (
                  <Cell key={i} fill={d.valor === 0 ? "#e2e8f0" : d.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:p-6">
        <div className="mb-4 flex items-center gap-2">
          <h2 className="text-base font-semibold text-slate-900">Tareas Pendientes</h2>
          {tareasPendientes.length > 0 && (
            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-xs font-bold text-white">
              {tareasPendientes.length}
            </span>
          )}
        </div>
        {tareasPendientes.length === 0 ? (
          <div className="py-8 text-center text-sm text-slate-400">Sin tareas pendientes</div>
        ) : (
          <div className="space-y-2">
            {tareasPendientes.map((t) => {
              const lead = leads.find((l) => l.id === t.leadId);
              return <TaskItem key={t.id} tarea={t} clienteNombre={lead?.nombre ?? "—"} />;
            })}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:p-6">
        <h2 className="mb-4 text-base font-semibold text-slate-900">Rendimiento por Vendedor</h2>
        <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
          {VENDEDORES.map((v) => {
            const data = vendTotals.get(v)!;
            const style = sellerStyle(v);
            const pct = maxVendValor > 0 ? (data.valor / maxVendValor) * 100 : 0;
            const isSelected = filterVendedor === v;
            return (
              <button
                key={v}
                onClick={() => setFilterVendedor(isSelected ? "" : v)}
                className={`rounded-lg border p-3 text-left transition-colors ${
                  isSelected ? "border-slate-400 bg-slate-100" : "border-slate-200 bg-slate-50 hover:border-slate-300"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${style.dot}`} />
                  <span className="text-sm font-medium text-slate-700">{vendorName(v)}</span>
                </div>
                <div className="mt-2 text-xl font-bold text-slate-900">{data.leads} leads</div>
                <div className={`text-xs ${data.valor === 0 ? "text-slate-400" : "text-slate-600"}`}>
                  {formatCurrency(data.valor)}
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200">
                  <div className={`h-full rounded-full ${style.dot} transition-all duration-300`} style={{ width: `${pct}%` }} />
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
