import { createFileRoute } from "@tanstack/react-router";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { useStore } from "@/lib/store";
import { ETAPAS, ETAPA_COLORS, VENDEDORES, vendorName } from "@/lib/types";
import { formatCurrency } from "@/lib/format";

export const Route = createFileRoute("/datos")({
  head: () => ({ meta: [{ title: "Datos — TiroCRM" }] }),
  component: DatosPage,
});

const PALETTE = ["#1a1f36","#38bdf8","#8b5cf6","#f59e0b","#10b981","#ef4444","#f97316","#ec4899","#06b6d4","#84cc16"];
const MESES_SHORT = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
const DIAS = ["Lun","Mar","Mié","Jue","Vie","Sáb","Dom"];

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
  const { leads, notas, productos } = useStore();

  // ── KPIs ────────────────────────────────────────────────────────
  const total = leads.length;
  const closedWon  = leads.filter(l => l.etapa === "Closed Won").length;
  const closedLost = leads.filter(l => l.etapa === "Closed Lost").length;
  const totalCerrados = closedWon + closedLost;
  const convRate = totalCerrados > 0 ? Math.round(closedWon / totalCerrados * 100) : 0;
  const valorTotal = leads.reduce((s, l) => s + l.valor, 0);
  const valorWon   = leads.filter(l => l.etapa === "Closed Won").reduce((s, l) => s + l.valor, 0);

  const now = new Date();
  const thisMonth = leads.filter(l => {
    const d = new Date(l.fechaCreacion || l.created_at ?? "");
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;

  // ── Pipeline funnel ──────────────────────────────────────────────
  const pipelineData = ETAPAS.map(e => ({
    etapa: e.replace("Primer Contacto", "1er Contacto"),
    count: leads.filter(l => l.etapa === e).length,
    valor: leads.filter(l => l.etapa === e).reduce((s, l) => s + l.valor, 0),
    color: ETAPA_COLORS[e],
  }));

  // ── Canales ──────────────────────────────────────────────────────
  const canalData = count(leads.map(l => l.origen || "Sin especificar"))
    .map(({ key, n }) => ({ name: key, value: n }));

  // ── Vendedores ───────────────────────────────────────────────────
  const vendedorData = VENDEDORES.map(v => ({
    name: vendorName(v).split(" ")[0],
    leads: leads.filter(l => l.vendedor === v).length,
    ganados: leads.filter(l => l.vendedor === v && l.etapa === "Closed Won").length,
    valor: leads.filter(l => l.vendedor === v).reduce((s, l) => s + l.valor, 0),
  }));

  // ── Productos ────────────────────────────────────────────────────
  const tipoData = count(productos.map(p => p.tipo || "Sin tipo"))
    .map(({ key, n }) => ({ name: key.charAt(0).toUpperCase() + key.slice(1), value: n }));

  const modeloData = count(
    productos.filter(p => p.modelo && p.modelo !== "Forma por decidir").map(p => p.modelo)
  ).slice(0, 8);

  // ── Telas ────────────────────────────────────────────────────────
  const telaData = count(
    productos.filter(p => p.tela && p.tela !== "Por decidir").map(p => p.tela)
  ).slice(0, 10);
  const maxTela = telaData[0]?.n ?? 1;

  // ── Colección ────────────────────────────────────────────────────
  const coleccionData = count(
    productos.filter(p => p.coleccionTela).map(p => p.coleccionTela)
  ).map(({ key, n }) => ({ name: key, value: n }));

  // ── Anchos de cabecero ───────────────────────────────────────────
  const anchoData = count(
    productos.filter(p => p.tipo === "cabecero" && p.ancho).map(p => `${p.ancho} cm`)
  ).slice(0, 8);
  const maxAncho = anchoData[0]?.n ?? 1;

  // ── Ciudades ─────────────────────────────────────────────────────
  const ciudadData = count(
    leads.filter(l => l.ciudad).map(l => l.ciudad)
  ).slice(0, 8);
  const maxCiudad = ciudadData[0]?.n ?? 1;

  // ── Motivos de cierre ────────────────────────────────────────────
  const wonReasons  = notas.filter(n => n.contenido.startsWith("[Closed Won]")).map(n => n.contenido.replace("[Closed Won]", "").trim()).filter(Boolean);
  const lostReasons = notas.filter(n => n.contenido.startsWith("[Closed Lost]")).map(n => n.contenido.replace("[Closed Lost]", "").trim()).filter(Boolean);

  // ── Temporal: últimos 6 meses ────────────────────────────────────
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    return { label: MESES_SHORT[d.getMonth()], month: d.getMonth(), year: d.getFullYear(), count: 0 };
  });
  leads.forEach(l => {
    const d = new Date(l.fechaCreacion || "");
    const m = months.find(x => x.month === d.getMonth() && x.year === d.getFullYear());
    if (m) m.count++;
  });

  // ── Días de semana ───────────────────────────────────────────────
  const byDay = Array(7).fill(0);
  leads.forEach(l => {
    const d = new Date(l.fechaCreacion || "");
    if (isNaN(d.getTime())) return;
    byDay[(d.getDay() + 6) % 7]++;
  });
  const dayData = DIAS.map((dia, i) => ({ dia, count: byDay[i] }));

  // ── Conversión por canal ─────────────────────────────────────────
  const conversionPorCanal = Object.entries(
    leads.reduce((acc, l) => {
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

  const tooltipStyle = { fontSize: 12, borderRadius: 8, border: "1px solid #e2e8f0" };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Datos</h1>
        <p className="text-xs text-slate-400">Análisis sobre {total} leads · {productos.length} productos configurados</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KPI label="Total leads" value={total} sub={`${thisMonth} este mes`} />
        <KPI label="Conversión" value={`${convRate}%`} sub={`${closedWon} ganados / ${totalCerrados} cerrados`} />
        <KPI label="Valor pipeline" value={formatCurrency(valorTotal)} sub="leads activos" />
        <KPI label="Ingresos cerrados" value={formatCurrency(valorWon)} sub="Closed Won" />
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

      {/* Vendedores */}
      <Card title="Rendimiento por vendedor">
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={vendedorData} margin={{ left: -10 }}>
            <XAxis dataKey="name" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
            <Tooltip contentStyle={tooltipStyle} />
            <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="leads" name="Total leads" fill="#38bdf8" radius={[4, 4, 0, 0]} />
            <Bar dataKey="ganados" name="Closed Won" fill="#10b981" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      {/* Productos y modelos */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card title="Tipos de producto más pedidos">
          {tipoData.length === 0 ? <Empty /> : (
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={tipoData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={65} label={({ name, percent }) => `${name} ${Math.round(percent * 100)}%`} labelLine={false} fontSize={10}>
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

      {/* Ciudades + conversión por canal */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card title="Ciudades con más leads">
          {ciudadData.length === 0 ? <Empty /> : (
            <div className="space-y-2">
              {ciudadData.map(({ key, n }, i) => (
                <HBar key={key} label={key} value={n} max={maxCiudad} color={PALETTE[i % PALETTE.length]} />
              ))}
            </div>
          )}
        </Card>

        <Card title="Tasa de conversión por canal">
          {conversionPorCanal.length === 0 ? (
            <div className="py-8 text-center text-sm text-slate-300">
              Necesitas más leads cerrados (Won/Lost) por canal para ver este dato
            </div>
          ) : (
            <div className="space-y-2">
              {conversionPorCanal.map(({ canal, tasa, total }, i) => (
                <HBar key={canal} label={canal} value={tasa} max={100} color={PALETTE[i % PALETTE.length]} note={`${tasa}% (${total} leads)`} />
              ))}
            </div>
          )}
        </Card>
      </div>

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

      {/* Nota sobre edad */}
      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-400">
        💡 <strong className="text-slate-500">Edad de los solicitantes</strong> — El CRM no captura la edad aún. Si quieres este dato, puedo añadir un campo opcional de edad (o rango de edad) al formulario de nuevo lead.
      </div>
    </div>
  );
}
