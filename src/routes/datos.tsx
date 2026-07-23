import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { Download, CopyCheck } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { useStore } from "@/lib/store";
import type { Etapa } from "@/lib/types";
import { ETAPAS, ETAPA_COLORS, VENDEDORES, RANGOS_EDAD, vendorName } from "@/lib/types";
import { formatCurrency } from "@/lib/format";

export const Route = createFileRoute("/datos")({
  head: () => ({ meta: [{ title: "Datos — TiroCRM" }] }),
  component: DatosPage,
});

const PALETTE = ["#1a1f36","#38bdf8","#8b5cf6","#f59e0b","#10b981","#ef4444","#f97316","#ec4899","#06b6d4","#84cc16"];
const MESES_SHORT = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
const DIAS = ["Lun","Mar","Mié","Jue","Vie","Sáb","Dom"];

// Municipios de la Comunidad de Madrid que agrupamos bajo "Madrid"
const MADRID_CAM = new Set([
  "madrid","alcala de henares","mostoles","fuenlabrada","leganes","getafe","alcorcon",
  "torrejon de ardoz","parla","alcobendas","las rozas","las rozas de madrid",
  "san sebastian de los reyes","pozuelo de alarcon","coslada","rivas vaciamadrid",
  "rivas-vaciamadrid","valdemoro","majadahonda","collado villalba","aranjuez",
  "arganda del rey","boadilla del monte","tres cantos","pinto","colmenar viejo",
  "san fernando de henares","villaviciosa de odon","galapagar","mejorada del campo",
  "navalcarnero","torrelodones","ciempozuelos","algete","villanueva de la canada",
  "villanueva del pardillo","paracuellos de jarama","el escorial",
  "san lorenzo de el escorial","soto del real","guadarrama","moralzarzal",
  "hoyo de manzanares","manzanares el real","cercedilla","navacerrada",
  "becerril de la sierra","el molar","daganzo","daganzo de arriba","velilla de san antonio",
  "humanes de madrid","griñon","grinon","brunete","sevilla la nueva","villalbilla",
  "loeches","camarma de esteruelas","meco","ajalvir","fuente el saz",
  "valdetorres de jarama","torres de la alameda","chinchon","morata de tajuna",
  "ciempozuelos","san martin de la vega","valdeolmos","cobeña","cobena",
  "miraflores de la sierra","bustarviejo","el boalo","cerceda","mataelpino",
  "robledo de chavela","villa del prado","cadalso de los vidrios","aldea del fresno",
]);
function normalizeCiudad(c: string): string {
  if (!c) return c;
  const key = c.trim().toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (MADRID_CAM.has(key)) return "Madrid";
  return c;
}

function count<T extends string | number>(arr: T[]): { key: T; n: number }[] {
  const m = new Map<T, number>();
  arr.forEach(v => m.set(v, (m.get(v) ?? 0) + 1));
  return [...m.entries()].map(([key, n]) => ({ key, n })).sort((a, b) => b.n - a.n);
}

function KPI({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</div>
      <div className="mt-1 text-2xl font-bold text-slate-900">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-slate-400">{sub}</div>}
    </div>
  );
}

function Card({ title, children, className = "" }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-slate-200 bg-white p-4 shadow-sm ${className}`}>
      <div className="mb-4 text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</div>
      {children}
    </div>
  );
}

function HBar({ label, value, max, color = "#1a1f36", note }: { label: string; value: number; max: number; color?: string; note?: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <div className="w-28 shrink-0 truncate text-xs text-slate-600" title={label}>{label}</div>
      <div className="flex-1 overflow-hidden rounded-full bg-slate-100 h-2">
        <div className="h-2 rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <div className="w-8 shrink-0 text-right text-xs font-semibold text-slate-700">{value}</div>
      {note && <div className="text-xs text-slate-400">{note}</div>}
    </div>
  );
}

function Empty() {
  return <div className="py-8 text-center text-sm text-slate-300">Sin datos suficientes aún</div>;
}

function DatosPage() {
  const { leads, notas, productos, audit } = useStore();

  // Nº de productos marcados como posible duplicado (para el acceso a /duplicados)
  const dupCount = useMemo(
    () => productos.filter((p) => (p.notasProducto || "").toLowerCase().includes("[posible-duplicado]")).length,
    [productos],
  );

  // ── Filtros ──────────────────────────────────────────────────────
  const now = new Date();
  const [vendedorFilter, setVendedorFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [activePreset, setActivePreset] = useState("all");

  function applyPreset(p: string) {
    setActivePreset(p);
    if (p === "month") {
      setDateFrom(new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10));
      setDateTo(new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10));
    } else if (p === "quarter") {
      const d = new Date(now.getFullYear(), now.getMonth() - 2, 1);
      setDateFrom(d.toISOString().slice(0, 10));
      setDateTo("");
    } else if (p === "semester") {
      const d = new Date(now.getFullYear(), now.getMonth() - 5, 1);
      setDateFrom(d.toISOString().slice(0, 10));
      setDateTo("");
    } else {
      setDateFrom("");
      setDateTo("");
    }
  }

  const filtered = useMemo(() => leads.filter(l => {
    if (vendedorFilter !== "all" && l.vendedor && l.vendedor !== vendedorFilter) return false;
    if (dateFrom && l.fechaCreacion < dateFrom) return false;
    if (dateTo && l.fechaCreacion > dateTo) return false;
    return true;
  }), [leads, vendedorFilter, dateFrom, dateTo]);

  const filteredIds = useMemo(() => new Set(filtered.map(l => l.id)), [filtered]);
  const filteredProductos = useMemo(() => productos.filter(p => filteredIds.has(p.leadId)), [productos, filteredIds]);
  const filteredNotas = useMemo(() => notas.filter(n => filteredIds.has(n.leadId)), [notas, filteredIds]);

  const activeFilters = vendedorFilter !== "all" || dateFrom || dateTo;

  // ── KPIs ─────────────────────────────────────────────────────────
  const total = filtered.length;
  const closedWon  = filtered.filter(l => l.etapa === "Closed Won").length;
  const closedLost = filtered.filter(l => l.etapa === "Closed Lost").length;
  const totalCerrados = closedWon + closedLost;
  const convRate = totalCerrados > 0 ? Math.round(closedWon / totalCerrados * 100) : 0;
  const valorTotal = filtered.reduce((s, l) => s + l.valor, 0);
  const valorWon = filtered.filter(l => l.etapa === "Closed Won").reduce((s, l) => s + l.valor, 0);
  const ticketMedio = closedWon > 0 ? Math.round(valorWon / closedWon) : 0;
  const onHold = filtered.filter(l => l.etapa === "On Hold").length;

  const thisMonth = filtered.filter(l => {
    const d = new Date(l.fechaCreacion || "");
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;

  // ── Pipeline funnel ───────────────────────────────────────────────
  const pipelineData = ETAPAS.map(e => ({
    etapa: e.replace("Primer Contacto", "1er Contacto"),
    count: filtered.filter(l => l.etapa === e).length,
    valor: filtered.filter(l => l.etapa === e).reduce((s, l) => s + l.valor, 0),
    color: ETAPA_COLORS[e],
  }));

  // ── Canales ───────────────────────────────────────────────────────
  const canalData = count(filtered.map(l => l.origen || "Sin especificar"))
    .map(({ key, n }) => ({ name: key, value: n }));

  // ── Valor por canal ───────────────────────────────────────────────
  const valorCanalData = Object.entries(
    filtered.reduce((acc, l) => {
      const o = l.origen || "Sin especificar";
      acc[o] = (acc[o] ?? 0) + l.valor;
      return acc;
    }, {} as Record<string, number>)
  )
    .map(([canal, valor]) => ({ canal, valor: Math.round(valor) }))
    .sort((a, b) => b.valor - a.valor)
    .slice(0, 8);

  // ── Vendedores ────────────────────────────────────────────────────
  const vendedorData = VENDEDORES.map(v => {
    const vLeads = filtered.filter(l => l.vendedor === v);
    const ganados = vLeads.filter(l => l.etapa === "Closed Won");
    return {
      name: vendorName(v).split(" ")[0],
      leads: vLeads.length,
      ganados: ganados.length,
      valor: vLeads.reduce((s, l) => s + l.valor, 0),
      ticketMedio: ganados.length > 0 ? Math.round(ganados.reduce((s, l) => s + l.valor, 0) / ganados.length) : 0,
      tasaConv: vLeads.filter(l => ["Closed Won","Closed Lost"].includes(l.etapa)).length > 0
        ? Math.round(ganados.length / vLeads.filter(l => ["Closed Won","Closed Lost"].includes(l.etapa)).length * 100)
        : 0,
    };
  }).filter(v => v.leads > 0 || vendedorFilter === "all");

  // ── Productos ─────────────────────────────────────────────────────
  const tipoData = count(filteredProductos.map(p => p.tipo || "Sin tipo"))
    .map(({ key, n }) => ({ name: key.charAt(0).toUpperCase() + key.slice(1), value: n }));

  const modeloData = count(
    filteredProductos.filter(p => p.modelo && !mismoModelo(p.modelo, "Forma por decidir")).map(p => p.modelo)
  ).slice(0, 8);

  // ── Telas ─────────────────────────────────────────────────────────
  const telaData = count(
    filteredProductos.filter(p => p.tela && p.tela !== "Por decidir").map(p => p.tela)
  ).slice(0, 10);
  const maxTela = telaData[0]?.n ?? 1;

  // ── Colección ─────────────────────────────────────────────────────
  const coleccionData = count(
    filteredProductos.filter(p => p.coleccionTela).map(p => p.coleccionTela)
  ).map(({ key, n }) => ({ name: key, value: n }));

  // ── Anchos de cabecero ────────────────────────────────────────────
  const anchoData = count(
    filteredProductos.filter(p => p.tipo === "cabecero" && p.ancho).map(p => `${p.ancho} cm`)
  ).slice(0, 8);
  const maxAncho = anchoData[0]?.n ?? 1;

  // ── Ciudades ──────────────────────────────────────────────────────
  const ciudadData = count(
    filtered.filter(l => l.ciudad).map(l => normalizeCiudad(l.ciudad))
  ).slice(0, 8);
  const maxCiudad = ciudadData[0]?.n ?? 1;

  // ── Motivos de cierre ─────────────────────────────────────────────
  const wonReasons  = filteredNotas.filter(n => n.contenido.startsWith("[Closed Won]")).map(n => n.contenido.replace("[Closed Won]", "").trim()).filter(Boolean);
  const lostReasons = filteredNotas.filter(n => n.contenido.startsWith("[Closed Lost]")).map(n => n.contenido.replace("[Closed Lost]", "").trim()).filter(Boolean);

  // ── Temporal: últimos 6 meses ─────────────────────────────────────
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    return { label: MESES_SHORT[d.getMonth()], month: d.getMonth(), year: d.getFullYear(), count: 0 };
  });
  filtered.forEach(l => {
    const d = new Date(l.fechaCreacion || "");
    const m = months.find(x => x.month === d.getMonth() && x.year === d.getFullYear());
    if (m) m.count++;
  });

  // ── Días de semana ────────────────────────────────────────────────
  const byDay = Array(7).fill(0);
  filtered.forEach(l => {
    const d = new Date(l.fechaCreacion || "");
    if (isNaN(d.getTime())) return;
    byDay[(d.getDay() + 6) % 7]++;
  });
  const dayData = DIAS.map((dia, i) => ({ dia, count: byDay[i] }));

  // ── Conversión por canal ──────────────────────────────────────────
  const conversionPorCanal = Object.entries(
    filtered.reduce((acc, l) => {
      const o = l.origen || "Sin especificar";
      if (!acc[o]) acc[o] = { total: 0, won: 0 };
      acc[o].total++;
      if (l.etapa === "Closed Won") acc[o].won++;
      return acc;
    }, {} as Record<string, { total: number; won: number }>)
  )
    .filter(([, v]) => v.total >= 2)
    .map(([canal, v]) => ({ canal, tasa: Math.round(v.won / v.total * 100), total: v.total }))
    .sort((a, b) => b.tasa - a.tasa);

  // ── Funnel de conversión por etapa ────────────────────────────────
  // Para cada lead, calculamos la "etapa máxima alcanzada" mirando su etapa actual
  // y el histórico de la auditoría (campo='etapa'). Así un Closed Lost cuenta como
  // "alcanzó" Discovery / Primer Contacto / Negotiation si pasó por ellas.
  const FUNNEL_ORDER: Etapa[] = ["Discovery", "Primer Contacto", "Negotiation", "Closed Won"];
  const etapaRank: Record<string, number> = {
    "Discovery": 0, "Primer Contacto": 1, "Negotiation": 2, "Closed Won": 3,
    "On Hold": -1, "Closed Lost": -1,
  };
  const filteredIdSet = filteredIds;
  const maxRankByLead = new Map<string, number>();
  filtered.forEach(l => {
    const r = etapaRank[l.etapa] ?? -1;
    maxRankByLead.set(l.id, r);
  });
  audit.forEach(a => {
    if (a.campo !== "etapa" || !a.leadId || !filteredIdSet.has(a.leadId)) return;
    [a.valorAnterior, a.valorNuevo].forEach(v => {
      if (!v) return;
      const r = etapaRank[v] ?? -1;
      const cur = maxRankByLead.get(a.leadId!) ?? -1;
      if (r > cur) maxRankByLead.set(a.leadId!, r);
    });
  });
  const totalFunnel = filtered.length;
  const funnelData = FUNNEL_ORDER.map((etapa, i) => {
    const reached = Array.from(maxRankByLead.values()).filter(r => r >= i).length;
    return { etapa, count: reached, pct: totalFunnel > 0 ? Math.round(reached / totalFunnel * 100) : 0 };
  });

  // ── Edad ──────────────────────────────────────────────────────────
  const edadData = RANGOS_EDAD.map(r => ({
    rango: r,
    count: filtered.filter(l => l.edad === r).length,
  }));
  const sinEdad = filtered.filter(l => !l.edad).length;

  // ── Export CSV ────────────────────────────────────────────────────
  function exportCSV() {
    const headers = ["Nombre","Email","Teléfono","Ciudad","Vendedor","Etapa","Origen","Valor Producto (€)","Valor Envío (€)","Valor Total (€)","Edad","Red Social","Fecha Creación"];
    const rows = filtered.map(l => [
      l.nombre, l.email, l.telefono, l.ciudad, vendorName(l.vendedor),
      l.etapa, l.origen, l.valorProducto, l.valorEnvio, l.valor,
      l.edad, l.redSocial, l.fechaCreacion,
    ]);
    const csv = [headers, ...rows]
      .map(r => r.map(c => `"${String(c ?? "").replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tirorirocrm_leads_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const tooltipStyle = { fontSize: 12, borderRadius: 8, border: "1px solid #e2e8f0" };
  const presetBtn = (p: string, label: string) =>
    `px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${activePreset === p ? "bg-[#1a1f36] text-white border-[#1a1f36]" : "bg-white text-slate-600 border-slate-200 hover:border-slate-400"}`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Datos</h1>
          <p className="text-xs text-slate-400">
            {activeFilters
              ? `${filtered.length} de ${leads.length} leads · con filtros activos`
              : `${leads.length} leads en total · ${filteredProductos.length} productos`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {dupCount > 0 && (
            <Link
              to="/duplicados"
              className="inline-flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-800 shadow-sm hover:bg-amber-100 transition-colors"
            >
              <CopyCheck className="h-4 w-4" />
              Revisar duplicados
              <span className="rounded-full bg-amber-200 px-1.5 py-0.5 text-[10px] font-bold text-amber-900">{dupCount}</span>
            </Link>
          )}
          <button
            onClick={exportCSV}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 hover:border-slate-400 transition-colors"
          >
            <Download className="h-4 w-4" />
            Exportar Excel
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Filtros</div>
        <div className="flex flex-wrap gap-3">
          {/* Preset fechas */}
          <div className="flex gap-1.5">
            {[
              { p: "all", label: "Todo" },
              { p: "month", label: "Este mes" },
              { p: "quarter", label: "3 meses" },
              { p: "semester", label: "6 meses" },
            ].map(({ p, label }) => (
              <button key={p} onClick={() => applyPreset(p)} className={presetBtn(p, label)}>{label}</button>
            ))}
          </div>

          {/* Fechas custom */}
          <div className="flex items-center gap-1.5">
            <input
              type="date" value={dateFrom}
              onChange={e => { setDateFrom(e.target.value); setActivePreset("custom"); }}
              className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs text-slate-700 focus:outline-none focus:border-slate-400"
            />
            <span className="text-xs text-slate-400">—</span>
            <input
              type="date" value={dateTo}
              onChange={e => { setDateTo(e.target.value); setActivePreset("custom"); }}
              className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs text-slate-700 focus:outline-none focus:border-slate-400"
            />
          </div>

          {/* Vendedor */}
          <select
            value={vendedorFilter}
            onChange={e => setVendedorFilter(e.target.value)}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-700 focus:outline-none focus:border-slate-400 bg-white"
          >
            <option value="all">Todos los vendedores</option>
            {VENDEDORES.map(v => <option key={v} value={v}>{vendorName(v)}</option>)}
          </select>

          {/* Reset */}
          {activeFilters && (
            <button
              onClick={() => { setVendedorFilter("all"); setDateFrom(""); setDateTo(""); setActivePreset("all"); }}
              className="text-xs text-slate-400 hover:text-slate-700 underline"
            >
              Quitar filtros
            </button>
          )}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KPI label="Total leads" value={total} sub={`${thisMonth} este mes`} />
        <KPI label="Conversión" value={`${convRate}%`} sub={`${closedWon} ganados / ${totalCerrados} cerrados`} />
        <KPI label="Ticket medio" value={ticketMedio > 0 ? formatCurrency(ticketMedio) : "—"} sub="por lead cerrado Won" />
        <KPI label="Ingresos cerrados" value={formatCurrency(valorWon)} sub={`Pipeline total: ${formatCurrency(valorTotal)}`} />
      </div>

      {/* KPIs fila 2 */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KPI label="On Hold" value={onHold} sub="pendientes de retomar" />
        <KPI label="Closed Won" value={closedWon} />
        <KPI label="Closed Lost" value={closedLost} />
        <KPI label="Productos" value={filteredProductos.length} sub="configurados" />
      </div>

      {/* Pipeline funnel + canales */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card title="Leads por etapa">
          {total === 0 ? <Empty /> : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={pipelineData} layout="vertical" margin={{ left: 0, right: 16 }}>
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="etapa" tick={{ fontSize: 10 }} width={90} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [v, "leads"]} />
                <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                  {pipelineData.map((e) => <Cell key={e.etapa} fill={e.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card title="Canales de entrada">
          {canalData.length === 0 ? <Empty /> : (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={canalData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ name, percent }) => `${name} ${Math.round(percent * 100)}%`} labelLine={false} fontSize={10}>
                  {canalData.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      {/* Temporal */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card title="Leads por mes (últimos 6 meses)">
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={months} margin={{ left: -20 }}>
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [v, "leads"]} />
              <Bar dataKey="count" fill="#1a1f36" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Día de la semana con más leads">
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={dayData} margin={{ left: -20 }}>
              <XAxis dataKey="dia" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [v, "leads"]} />
              <Bar dataKey="count" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Vendedores — leads + ganados */}
      <Card title="Rendimiento por vendedor — leads y cierres">
        {vendedorData.length === 0 ? <Empty /> : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={vendedorData} margin={{ left: -10 }}>
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="leads" name="Total leads" fill="#38bdf8" radius={[4, 4, 0, 0]} />
              <Bar dataKey="ganados" name="Closed Won" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </Card>

      {/* Vendedores — ticket medio + conversión */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card title="Ticket medio por vendedor (€)">
          {vendedorData.filter(v => v.ticketMedio > 0).length === 0 ? <Empty /> : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={vendedorData} margin={{ left: -10 }}>
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${v}€`} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`${v}€`, "ticket medio"]} />
                <Bar dataKey="ticketMedio" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card title="Tasa de conversión por vendedor (%)">
          {vendedorData.filter(v => v.tasaConv > 0).length === 0 ? <Empty /> : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={vendedorData} margin={{ left: -10 }}>
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${v}%`} domain={[0, 100]} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`${v}%`, "conversión"]} />
                <Bar dataKey="tasaConv" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      {/* Valor por canal */}
      <Card title="Valor (€) generado por canal">
        {valorCanalData.length === 0 ? <Empty /> : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={valorCanalData} layout="vertical" margin={{ left: 0, right: 24 }}>
              <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={v => `${v}€`} />
              <YAxis type="category" dataKey="canal" tick={{ fontSize: 10 }} width={100} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`${v}€`, "valor"]} />
              <Bar dataKey="valor" radius={[0, 4, 4, 0]}>
                {valorCanalData.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </Card>

      {/* Conversión por canal */}
      <Card title="Tasa de conversión por canal">
        {conversionPorCanal.length === 0 ? (
          <div className="py-8 text-center text-sm text-slate-300">
            Necesitas más leads cerrados (Won/Lost) por canal
          </div>
        ) : (
          <div className="space-y-2">
            {conversionPorCanal.map(({ canal, tasa, total }, i) => (
              <HBar key={canal} label={canal} value={tasa} max={100} color={PALETTE[i % PALETTE.length]} note={`${tasa}% (${total} leads)`} />
            ))}
          </div>
        )}
      </Card>

      {/* Productos y modelos */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card title="Tipos de producto más pedidos">
          {tipoData.length === 0 ? <Empty /> : (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart margin={{ top: 16, right: 16, bottom: 16, left: 16 }}>
                <Pie data={tipoData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius="70%" label={({ name, percent }) => `${name} ${Math.round(percent * 100)}%`} labelLine={false} fontSize={10}>
                  {tipoData.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card title="Modelos más pedidos (top 8)">
          {modeloData.length === 0 ? <Empty /> : (
            <div className="space-y-2">
              {modeloData.map(({ key, n }, i) => (
                <HBar key={key} label={key} value={n} max={modeloData[0].n} color={PALETTE[i % PALETTE.length]} />
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Telas */}
      <Card title="Telas más solicitadas (top 10)">
        {telaData.length === 0 ? <Empty /> : (
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {telaData.map(({ key, n }, i) => (
              <HBar key={key} label={key} value={n} max={maxTela} color={PALETTE[i % PALETTE.length]} />
            ))}
          </div>
        )}
      </Card>

      {/* Anchos + Colección */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card title="Ancho de cabecero más pedido">
          {anchoData.length === 0 ? <Empty /> : (
            <div className="space-y-2">
              {anchoData.map(({ key, n }, i) => (
                <HBar key={key} label={key} value={n} max={maxAncho} color={PALETTE[i % PALETTE.length]} />
              ))}
            </div>
          )}
        </Card>

        <Card title="Colección de tela">
          {coleccionData.length === 0 ? <Empty /> : (
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={coleccionData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={65} label={({ name, percent }) => `${name} ${Math.round(percent * 100)}%`} labelLine={false} fontSize={12}>
                  {coleccionData.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      {/* Ciudades */}
      <Card title="Ciudades con más leads">
        {ciudadData.length === 0 ? <Empty /> : (
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {ciudadData.map(({ key, n }, i) => (
              <HBar key={key} label={key} value={n} max={maxCiudad} color={PALETTE[i % PALETTE.length]} />
            ))}
          </div>
        )}
      </Card>

      {/* Edad */}
      <Card title="Rango de edad de los clientes">
        {edadData.every(d => d.count === 0) ? (
          <div className="py-8 text-center text-sm text-slate-300">
            Sin datos de edad aún — rellena el campo en cada lead para verlo aquí
          </div>
        ) : (
          <div className="space-y-3">
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={edadData} margin={{ left: -20 }}>
                <XAxis dataKey="rango" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [v, "leads"]} />
                <Bar dataKey="count" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
            {sinEdad > 0 && (
              <p className="text-center text-xs text-slate-400">{sinEdad} lead{sinEdad !== 1 ? "s" : ""} sin edad registrada</p>
            )}
          </div>
        )}
      </Card>

      {/* Funnel de conversión por etapa */}
      <Card title="Funnel de conversión por etapa">
        {totalFunnel === 0 ? <Empty /> : (
          <div className="space-y-2">
            {funnelData.map((d, i) => {
              const prev = i > 0 ? funnelData[i - 1].count : d.count;
              const dropPct = prev > 0 ? Math.round(((prev - d.count) / prev) * 100) : 0;
              const widthPct = funnelData[0].count > 0 ? Math.round((d.count / funnelData[0].count) * 100) : 0;
              const color = i === funnelData.length - 1 ? "#10b981" : PALETTE[i % PALETTE.length];
              return (
                <div key={d.etapa} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-700">{d.etapa}</span>
                    <span className="text-slate-500">
                      <span className="font-semibold text-slate-900">{d.count}</span> leads · {d.pct}%
                      {i > 0 && dropPct > 0 && <span className="ml-2 text-rose-500">↓ {dropPct}% de la etapa anterior</span>}
                    </span>
                  </div>
                  <div className="h-6 overflow-hidden rounded bg-slate-100">
                    <div className="h-6 rounded transition-all" style={{ width: `${widthPct}%`, backgroundColor: color }} />
                  </div>
                </div>
              );
            })}
            <p className="pt-2 text-[11px] text-slate-400">
              Se considera que un lead "alcanzó" una etapa si está actualmente en ella o pasó por ella según el histórico.
              Se excluyen On Hold y Closed Lost (no son fases del funnel).
            </p>
          </div>
        )}
      </Card>

      {/* Motivos de cierre */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card title="Motivos — Closed Won">
          {wonReasons.length === 0 ? (
            <div className="py-6 text-center text-sm text-slate-300">
              Cuando cierres un lead como Won y pongas el motivo, aparecerá aquí
            </div>
          ) : (
            <ul className="space-y-1.5">
              {wonReasons.map((r, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />
                  <span className="text-slate-700">{r}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Motivos — Closed Lost">
          {lostReasons.length === 0 ? (
            <div className="py-6 text-center text-sm text-slate-300">
              Cuando cierres un lead como Lost y pongas el motivo, aparecerá aquí
            </div>
          ) : (
            <ul className="space-y-1.5">
              {lostReasons.map((r, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-red-400" />
                  <span className="text-slate-700">{r}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
