import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Users, TrendingUp, Trophy, Wallet, Plus, ChevronDown, AlertTriangle, Package, Sparkles } from "lucide-react";

import { useState, useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import { useStore, vendedorTotals } from "@/lib/store";
import { ETAPAS, ETAPA_COLORS, VENDEDORES, vendorName, semaforoPedido, type Etapa } from "@/lib/types";
import { resumenCobro } from "@/lib/money";
import { formatCurrency, formatAxisCurrency } from "@/lib/format";
import { TaskItem } from "@/components/TaskItem";
import { sellerStyle } from "@/components/SellerBadge";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [{ title: "Dashboard — TiroCRM" }] }),
  component: Dashboard,
});

function KpiCard({ icon: Icon, label, value, sub, badgeBg, iconColor, empty }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string; value: React.ReactNode; sub?: React.ReactNode;
  badgeBg: string; iconColor: string; empty?: boolean;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-shadow duration-150 hover:shadow-md">
      <div className="flex items-start justify-between">
        <div className="text-xs font-medium text-slate-500">{label}</div>
        <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${badgeBg}`}>
          <Icon className={`h-5 w-5 ${iconColor}`} />
        </div>
      </div>
      <div className="mt-3 flex items-baseline gap-2">
        <div className={`text-2xl font-bold ${empty ? "text-slate-400" : "text-slate-900"}`}>{value}</div>
        {sub && <div className="text-xs text-slate-400">{sub}</div>}
      </div>
      {empty && <div className="mt-1 text-xs text-slate-400">Sin datos aún</div>}
    </div>
  );
}


// ── Dinero (pedidos como fuente de verdad) con filtro por fechas ──────────
type RangoPreset = "mes" | "mesPasado" | "anio" | "todo";

function rangoFechas(preset: RangoPreset): { desde: string; hasta: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  if (preset === "mes") return { desde: iso(new Date(y, m, 1)), hasta: iso(new Date(y, m + 1, 0)) };
  if (preset === "mesPasado") return { desde: iso(new Date(y, m - 1, 1)), hasta: iso(new Date(y, m, 0)) };
  if (preset === "anio") return { desde: `${y}-01-01`, hasta: `${y}-12-31` };
  return { desde: "", hasta: "" };
}

const PRESET_LABEL: Record<RangoPreset, string> = {
  mes: "Este mes", mesPasado: "Mes pasado", anio: "Este año", todo: "Todo",
};

function DineroPedidos() {
  const { pedidos } = useStore();
  const [preset, setPreset] = useState<RangoPreset>("mes");
  const [desde, setDesde] = useState(() => rangoFechas("mes").desde);
  const [hasta, setHasta] = useState(() => rangoFechas("mes").hasta);

  function aplicarPreset(p: RangoPreset) {
    setPreset(p);
    const r = rangoFechas(p);
    setDesde(r.desde);
    setHasta(r.hasta);
  }

  const filtrados = useMemo(() => {
    return pedidos.filter((p) => {
      // Fecha del pedido (solo parte YYYY-MM-DD). Sin fecha → se incluye sólo si el rango es "todo".
      const f = (p.fechaCreacionPedido || "").slice(0, 10);
      if (!desde && !hasta) return true;
      if (!f) return false;
      if (desde && f < desde) return false;
      if (hasta && f > hasta) return false;
      return true;
    });
  }, [pedidos, desde, hasta]);

  // Las colaboraciones de influencers (canje) no cuentan como venta/ingreso.
  const resumen = useMemo(() => resumenCobro(filtrados, (p) => p.esCanje), [filtrados]);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Dinero · Pedidos</h2>
          <p className="text-xs text-slate-500">{resumen.count} pedido{resumen.count === 1 ? "" : "s"} en el periodo</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 text-xs">
            {(["mes", "mesPasado", "anio", "todo"] as RangoPreset[]).map((p) => (
              <button
                key={p}
                onClick={() => aplicarPreset(p)}
                className={`rounded-md px-2 py-1 font-medium ${preset === p ? "bg-slate-900 text-white" : "text-slate-600 hover:text-slate-900"}`}
              >
                {PRESET_LABEL[p]}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1 text-xs text-slate-500">
            <input
              type="date"
              value={desde}
              max={hasta || undefined}
              onChange={(e) => { setDesde(e.target.value); setPreset("todo"); }}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-slate-700 focus:border-slate-400 focus:outline-none"
            />
            <span>–</span>
            <input
              type="date"
              value={hasta}
              min={desde || undefined}
              onChange={(e) => { setHasta(e.target.value); setPreset("todo"); }}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-slate-700 focus:border-slate-400 focus:outline-none"
            />
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <KpiCard icon={TrendingUp} label="VENTAS (PRODUCTO + ENVÍO)" value={formatCurrency(resumen.venta)} badgeBg="bg-slate-100" iconColor="text-slate-700" />
        <KpiCard icon={Trophy} label="COBRADO" value={formatCurrency(resumen.cobrado)} badgeBg="bg-emerald-100" iconColor="text-emerald-600" />
        <KpiCard icon={Wallet} label="PENDIENTE DE COBRO" value={formatCurrency(resumen.pendiente)} badgeBg="bg-amber-100" iconColor="text-amber-700" />
      </div>
    </div>
  );
}

// ── Influencers / colaboraciones (canje) ──────────────────────────────────
function DashboardInfluencers() {
  const { pedidos, leads } = useStore();
  const data = useMemo(() => {
    const leadById = new Map(leads.map((l) => [l.id, l] as const));
    const colabs = pedidos.filter((p) => p.esCanje || (p.leadId && leadById.get(p.leadId)?.tipo === "INFLUENCER"));
    let alcance = 0;
    let valorCanje = 0;
    const porFormato = new Map<string, number>();
    const porTipo = new Map<string, number>();
    for (const p of colabs) {
      const lead = p.leadId ? leadById.get(p.leadId) : undefined;
      alcance += lead?.seguidores || 0;
      valorCanje += (p.precio || 0) + (p.costeEnvio || 0);
      for (const f of p.formatos || []) porFormato.set(f, (porFormato.get(f) || 0) + 1);
      const t = p.tipoColaboracion || "Sin especificar";
      porTipo.set(t, (porTipo.get(t) || 0) + 1);
    }
    const costePorMil = alcance > 0 ? valorCanje / (alcance / 1000) : 0;
    return { n: colabs.length, alcance, valorCanje, costePorMil, porFormato, porTipo };
  }, [pedidos, leads]);

  if (data.n === 0) return null;

  return (
    <div className="rounded-xl border border-pink-200 bg-white p-4 shadow-sm md:p-6">
      <div className="mb-4 flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-pink-600" />
        <h2 className="text-base font-semibold text-slate-900">Influencers · Colaboraciones</h2>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard icon={Users} label="ALCANCE TOTAL" value={data.alcance.toLocaleString("es-ES")} sub="seguidores" badgeBg="bg-pink-100" iconColor="text-pink-600" />
        <KpiCard icon={Sparkles} label="COLABORACIONES" value={data.n} badgeBg="bg-pink-100" iconColor="text-pink-600" />
        <KpiCard icon={Wallet} label="VALOR EN CANJE" value={formatCurrency(data.valorCanje)} badgeBg="bg-slate-100" iconColor="text-slate-700" />
        <KpiCard icon={TrendingUp} label="COSTE-CANJE / 1.000 SEG." value={formatCurrency(data.costePorMil)} badgeBg="bg-amber-100" iconColor="text-amber-700" />
      </div>
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <BreakdownList title="Por formato" entries={data.porFormato} />
        <BreakdownList title="Por tipo" entries={data.porTipo} />
      </div>
    </div>
  );
}

function BreakdownList({ title, entries }: { title: string; entries: Map<string, number> }) {
  const rows = Array.from(entries.entries()).sort((a, b) => b[1] - a[1]);
  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50/60 p-3">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</div>
      {rows.length === 0 ? (
        <div className="text-xs text-slate-400">Sin datos</div>
      ) : (
        <div className="space-y-1.5">
          {rows.map(([k, n]) => (
            <div key={k} className="flex items-center justify-between text-sm">
              <span className="truncate text-slate-700">{k}</span>
              <span className="ml-2 shrink-0 rounded-full bg-white px-2 py-0.5 text-xs font-bold text-slate-600">{n}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Dashboard() {
  const store = useStore();
  // Dashboard sólo muestra métricas del canal B2C (excluye B2B e influencers).
  const leads = store.leads.filter((l) => l.tipo !== "B2B" && l.tipo !== "INFLUENCER");
  const tareas = store.tareas;
  const pedidos = store.pedidos;
  const navigate = useNavigate();
  const [filterVendedor, setFilterVendedor] = useState("");

  const filteredLeads = filterVendedor
    ? leads.filter((l) => !l.vendedor || l.vendedor === filterVendedor)
    : leads;

  // Total leads: activos = todos menos Closed Lost y Closed Won ya cobrado.
  const totalLeadsActivos = filteredLeads.filter(
    (l) => l.etapa !== "Closed Lost" && !(l.etapa === "Closed Won" && l.cobrado)
  ).length;
  const totalLeadsHistorico = filteredLeads.length;

  const valorPipeline = filteredLeads
    .filter((l) => l.etapa !== "Closed Won" && l.etapa !== "Closed Lost")
    .reduce((s, l) => s + l.valor, 0);

  const wonLeads = filteredLeads.filter((l) => l.etapa === "Closed Won");
  const ganadoPendiente = wonLeads.filter((l) => !l.cobrado).reduce((s, l) => s + l.valor, 0);
  const ganadoCobrado = wonLeads.filter((l) => l.cobrado).reduce((s, l) => s + l.valor, 0);

  const chartData = ETAPAS.map((etapa) => {
    const leadsEtapa = filteredLeads.filter((l) => l.etapa === etapa);
    const valor = leadsEtapa.reduce((s, l) => s + l.valor, 0);
    return { etapa, valor, displayValor: valor === 0 ? 0.0001 : valor, count: leadsEtapa.length, color: ETAPA_COLORS[etapa] };
  });

  // Tareas del dashboard: ocultar las de leads en Closed Won / On Hold (siguen en la ficha).
  const leadsById = new Map(leads.map((l) => [l.id, l] as const));
  const tareasPendientes = tareas
    .filter((t) => {
      if (t.completada) return false;
      if (filterVendedor && t.vendedor !== filterVendedor) return false;
      const lead = leadsById.get(t.leadId);
      if (lead && (lead.etapa === "Closed Won" || lead.etapa === "On Hold")) return false;
      return true;
    })
    .sort((a, b) => a.fecha.localeCompare(b.fecha));

  // Rendimiento por vendedor: solo Closed Won (cobrado o no).
  const wonLeadsGlobal = leads.filter((l) => l.etapa === "Closed Won");
  const vendTotals = vendedorTotals(wonLeadsGlobal);
  const maxVendValor = Math.max(1, ...VENDEDORES.map((v) => vendTotals.get(v)!.valor));


  // Pedidos en riesgo (ámbar) o atrasados (rojo), no entregados.
  // El flujo depende del tipo de producto, así que lo resolvemos por pedido.
  const tipoProdDe = (p: (typeof pedidos)[number]) => store.productos.find((pr) => pr.id === p.productoLeadId)?.tipo ?? "";
  const pedidosRiesgo = pedidos.filter((p) => {
    if (p.entregado) return false;
    return semaforoPedido(p, tipoProdDe(p)).estado !== "verde";
  });
  const pedidosAtrasados = pedidosRiesgo.filter((p) => semaforoPedido(p, tipoProdDe(p)).estado === "rojo");

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
        <KpiCard
          icon={Users}
          label="TOTAL LEADS"
          value={totalLeadsActivos}
          sub={<>de {totalLeadsHistorico} en total</>}
          badgeBg="bg-sky-100"
          iconColor="text-sky-600"
        />
        <KpiCard icon={TrendingUp} label="VALOR PIPELINE" value={formatCurrency(valorPipeline)} badgeBg="bg-amber-100" iconColor="text-amber-600" />
        <KpiCard icon={Wallet} label="GANADO · PENDIENTE DE COBRO" value={formatCurrency(ganadoPendiente)} badgeBg="bg-amber-100" iconColor="text-amber-700" />
        <KpiCard icon={Trophy} label="GANADO · YA COBRADO" value={formatCurrency(ganadoCobrado)} badgeBg="bg-emerald-100" iconColor="text-emerald-600" />
      </div>


      <DineroPedidos />

      <DashboardInfluencers />

      {pedidosRiesgo.length > 0 && (
        <Link
          to="/pedidos"
          className={`flex flex-wrap items-center gap-3 rounded-xl border-2 p-4 transition-shadow hover:shadow-md ${pedidosAtrasados.length > 0 ? "border-rose-200 bg-rose-50/60" : "border-amber-200 bg-amber-50/60"}`}
        >
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${pedidosAtrasados.length > 0 ? "bg-rose-100" : "bg-amber-100"}`}>
            <AlertTriangle className={`h-5 w-5 ${pedidosAtrasados.length > 0 ? "text-rose-600" : "text-amber-600"}`} />
          </div>
          <div className="min-w-0 flex-1">
            <div className={`text-sm font-bold ${pedidosAtrasados.length > 0 ? "text-rose-800" : "text-amber-800"}`}>
              {pedidosAtrasados.length > 0
                ? `${pedidosAtrasados.length} pedido${pedidosAtrasados.length > 1 ? "s" : ""} atrasado${pedidosAtrasados.length > 1 ? "s" : ""}`
                : `${pedidosRiesgo.length} pedido${pedidosRiesgo.length > 1 ? "s" : ""} en riesgo`}
            </div>
            <div className={`text-xs ${pedidosAtrasados.length > 0 ? "text-rose-600" : "text-amber-600"}`}>
              {pedidosRiesgo.length} pedido{pedidosRiesgo.length > 1 ? "s" : ""} fuera de la ruta ideal — revisa para evitar cuellos de botella
            </div>
          </div>
          <div className="inline-flex items-center gap-1 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm">
            <Package className="h-3.5 w-3.5" /> Ver pedidos
          </div>
        </Link>
      )}


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
