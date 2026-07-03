import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Plus, Clock, X, ChevronDown } from "lucide-react";
import { useState, useRef } from "react";
import { useStore, actions, nextPendingTaskFor } from "@/lib/store";
import {
  ETAPAS, ETAPAS_B2B, ETAPA_COLORS, VENDEDORES, ASIGNADOS_B2B, vendorName,
  type Etapa, type EtapaB2B, type Lead,
} from "@/lib/types";
import { formatCurrency, dateLabel } from "@/lib/format";
import { sellerStyle } from "@/components/SellerBadge";
import { DeleteLeadButton } from "@/components/DeleteLeadButton";

type Tab = "b2c" | "b2b";

type SortB2B = "fecha_desc" | "fecha_asc" | "municipio_asc" | "municipio_desc" | "nombre_asc" | "nombre_desc";

interface Search {
  tab?: Tab;
  etapa?: string;
  vendedor?: string;
  asignado?: string;
  municipio?: string;
  provincia?: string;
  q?: string;
  sort?: SortB2B;
}

const SORTS_B2B: SortB2B[] = ["fecha_desc", "fecha_asc", "municipio_asc", "municipio_desc", "nombre_asc", "nombre_desc"];

export const Route = createFileRoute("/pipeline")({
  head: () => ({ meta: [{ title: "Pipeline — TiroCRM" }] }),
  validateSearch: (s: Record<string, unknown>): Search => {
    const tab = s.tab === "b2b" ? "b2b" : s.tab === "b2c" ? "b2c" : undefined;
    const e = typeof s.etapa === "string" ? s.etapa : undefined;
    const v = typeof s.vendedor === "string" ? s.vendedor : undefined;
    const a = typeof s.asignado === "string" ? s.asignado : undefined;
    const m = typeof s.municipio === "string" ? s.municipio : undefined;
    const p = typeof s.provincia === "string" ? s.provincia : undefined;
    const q = typeof s.q === "string" ? s.q : undefined;
    const so = typeof s.sort === "string" && (SORTS_B2B as string[]).includes(s.sort) ? (s.sort as SortB2B) : undefined;
    return {
      ...(tab ? { tab } : {}),
      ...(e ? { etapa: e } : {}),
      ...(v && VENDEDORES.includes(v as never) ? { vendedor: v } : {}),
      ...(a ? { asignado: a } : {}),
      ...(m ? { municipio: m } : {}),
      ...(p ? { provincia: p } : {}),
      ...(q ? { q } : {}),
      ...(so ? { sort: so } : {}),
    };
  },
  component: PipelinePage,
});

function normalize(s: string): string {
  return (s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}
function b2bTitle(l: Lead): string {
  return l.razonSocial || l.contactoNombre || l.nombre || "";
}
const SIN_MUNI = "__sin__";
const SIN_PROV = "__sin__";

function vendorFirst(v: string) {
  return vendorName(v).split(" ")[0];
}

function daysInStage(lead: ReturnType<typeof useStore>["leads"][0]): number {
  if (!lead.fechaEntradaEtapa) return 0;
  const diff = Date.now() - new Date(lead.fechaEntradaEtapa).getTime();
  return Math.max(0, Math.floor(diff / 86400000));
}

/* ============================ B2C card ============================ */
/* ============================ Paid badge (from pedidos) ============================ */
function PaidBadge({ leadId, pedidos }: { leadId: string; pedidos: ReturnType<typeof useStore>["pedidos"] }) {
  const related = pedidos.filter((p) => p.leadId === leadId);
  if (related.length === 0) return null;
  const paid = related.filter((p) => p.pagadoCompleto).length;
  if (paid === 0) return null;
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700">
      ✓ Pagado{related.length > 1 ? ` ${paid}/${related.length}` : ""}
    </span>
  );
}

/* ============================ B2C card ============================ */
function LeadCardB2C({ lead, tareas, pedidos, onNavigate }: { lead: ReturnType<typeof useStore>["leads"][0]; tareas: ReturnType<typeof useStore>["tareas"]; pedidos: ReturnType<typeof useStore>["pedidos"]; onNavigate: () => void }) {
  const next = nextPendingTaskFor(lead.id, tareas);
  const dot = sellerStyle(lead.vendedor).dot;
  const closed = lead.etapa === "Closed Won" || lead.etapa === "Closed Lost";
  const days = daysInStage(lead);

  return (
    <div
      onClick={onNavigate}
      className="group relative cursor-pointer rounded-xl border border-slate-200 bg-white px-4 py-3.5 shadow-sm transition-all duration-150 hover:border-slate-300 hover:shadow-md"
    >
      <div className="absolute right-2 top-2 opacity-0 transition-opacity group-hover:opacity-100" onClick={(e) => e.stopPropagation()}>
        <DeleteLeadButton id={lead.id} variant="menu" />
      </div>
      <p className="truncate pr-6 text-[13px] font-semibold leading-snug text-slate-900">{lead.nombre}</p>
      {lead.valor > 0 ? (
        <p className="mt-1.5 text-base font-bold tracking-tight text-slate-900">{formatCurrency(lead.valor)}</p>
      ) : (
        <p className="mt-1.5 text-sm font-medium text-slate-300">—</p>
      )}
      <div className="mt-1.5">
        <PaidBadge leadId={lead.id} pedidos={pedidos} />
      </div>
      <div className="mt-2.5 flex items-center gap-1.5 text-xs text-slate-500">
        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${dot}`} />
        <span className="font-medium text-slate-600">{vendorFirst(lead.vendedor)}</span>
        {lead.producto && (<><span className="text-slate-300">·</span><span className="truncate">{lead.producto}</span></>)}
      </div>
      {!closed && (
        <div className="mt-2 flex items-center gap-1.5 rounded-lg bg-slate-100 px-2 py-1 text-[11px] text-slate-500">
          <Clock className="h-3 w-3 shrink-0 text-slate-400" />
          <span className="font-semibold">{days}d en esta etapa</span>
        </div>
      )}
      {next && (
        <div className="mt-2 flex items-center gap-1.5 rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs">
          <Clock className="h-3 w-3 shrink-0 text-amber-500" />
          <span className="shrink-0 font-semibold text-amber-700">{dateLabel(next.fecha)}</span>
          <span className="min-w-0 truncate text-slate-400">· {next.descripcion}</span>
        </div>
      )}
    </div>
  );
}

/* ============================ B2B card ============================ */
function LeadCardB2B({ lead, pedidos, onNavigate }: { lead: Lead; pedidos: ReturnType<typeof useStore>["pedidos"]; onNavigate: () => void }) {
  const titulo = lead.razonSocial || lead.contactoNombre || lead.nombre;
  return (
    <div
      onClick={onNavigate}
      className="group relative cursor-pointer rounded-xl border border-slate-200 bg-white px-4 py-3.5 shadow-sm transition-all duration-150 hover:border-slate-300 hover:shadow-md"
    >
      <div className="absolute right-2 top-2 opacity-0 transition-opacity group-hover:opacity-100" onClick={(e) => e.stopPropagation()}>
        <DeleteLeadButton id={lead.id} variant="menu" />
      </div>
      <p className="truncate pr-6 text-[13px] font-semibold leading-snug text-slate-900">{titulo}</p>
      {lead.contactoNombre && (
        <p className="mt-0.5 truncate text-[11px] text-slate-500">{lead.contactoNombre} {lead.contactoApellidos}</p>
      )}
      {lead.valor > 0 && (
        <p className="mt-1.5 text-base font-bold text-slate-900">{formatCurrency(lead.valor)}</p>
      )}
      <div className="mt-1.5"><PaidBadge leadId={lead.id} pedidos={pedidos} /></div>
      {(lead.asignados ?? []).length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1">
          {lead.asignados.map((a) => (
            <span key={a} className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">{a}</span>
          ))}
        </div>
      ) : (
        <div className="mt-2 text-[10px] text-slate-400">Sin asignar</div>
      )}
      {lead.instagram && <div className="mt-1.5 truncate text-[11px] text-pink-600">{lead.instagram}</div>}
    </div>
  );
}

/* ============================ Tabs ============================ */
function TabsHeader({ tab }: { tab: Tab }) {
  const navigate = useNavigate();
  const setTab = (t: Tab) => navigate({ to: "/pipeline", search: t === "b2c" ? {} : { tab: "b2b" } });
  const base = "px-4 py-2 text-sm font-semibold border-b-2 transition-colors";
  return (
    <div className="flex items-center gap-1 border-b border-slate-200">
      <button onClick={() => setTab("b2c")} className={`${base} ${tab === "b2c" ? "border-[#1a1f36] text-[#1a1f36]" : "border-transparent text-slate-500 hover:text-slate-700"}`}>B2C</button>
      <button onClick={() => setTab("b2b")} className={`${base} ${tab === "b2b" ? "border-[#1a4b5b] text-[#1a4b5b]" : "border-transparent text-slate-500 hover:text-slate-700"}`}>B2B</button>
    </div>
  );
}

/* ============================ B2C view ============================ */
function PipelineB2C() {
  const store = useStore();
  const leads = store.leads.filter((l) => l.tipo !== "B2B");
  const tareas = store.tareas;
  const pedidos = store.pedidos;
  const navigate = useNavigate();
  const search = Route.useSearch();
  const filterEtapa = search.etapa && (ETAPAS as readonly string[]).includes(search.etapa) ? (search.etapa as Etapa) : undefined;
  const filterVendedor = search.vendedor;
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<Etapa | null>(null);
  const touchDragId = useRef<string | null>(null);

  const visibleEtapas = filterEtapa ? ETAPAS.filter((e) => e === filterEtapa) : ETAPAS;
  const hasFilter = !!(filterEtapa || filterVendedor);

  function setVendedor(v: string) {
    navigate({ to: "/pipeline", search: (prev: Record<string, unknown>) => ({ ...prev, vendedor: v || undefined }) });
  }
  function clearFilters() {
    navigate({ to: "/pipeline", search: {} });
  }

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-slate-400">Arrastra las tarjetas para mover etapas</p>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <div className="relative min-w-0 flex-1 sm:flex-initial">
            <select value={filterVendedor ?? ""} onChange={(e) => setVendedor(e.target.value)} className="w-full appearance-none rounded-lg border border-slate-200 bg-white py-1.5 pl-3 pr-7 text-xs font-medium text-slate-700 focus:border-slate-400 focus:outline-none">
              <option value="">Todos los vendedores</option>
              {VENDEDORES.map((v) => (<option key={v} value={v}>{vendorName(v)}</option>))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          </div>
          {hasFilter && (
            <button onClick={clearFilters} className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-500 hover:bg-slate-50">
              <X className="h-3 w-3" /> Quitar
            </button>
          )}
          <Link to="/clientes/nuevo" className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-[#1a1f36] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#2a2f46]">
            <Plus className="h-3.5 w-3.5" /> Nuevo Lead
          </Link>
        </div>
      </div>

      <div className="-mx-4 overflow-x-auto px-4 pb-6 md:mx-0 md:px-0">
        <div className={`flex snap-x snap-mandatory gap-3 md:snap-none ${filterEtapa ? "md:max-w-sm" : "md:grid md:grid-cols-6"}`}>
          {visibleEtapas.map((etapa) => {
            const colLeads = leads.filter((l) => l.etapa === etapa && (!filterVendedor || !l.vendedor || l.vendedor === filterVendedor));
            const total = colLeads.reduce((s, l) => s + l.valor, 0);
            const isOver = dragOver === etapa;
            const color = ETAPA_COLORS[etapa];
            return (
              <div
                key={etapa}
                data-etapa={etapa}
                onDragOver={(e) => { e.preventDefault(); setDragOver(etapa); }}
                onDragLeave={() => setDragOver(null)}
                onDrop={() => { if (draggingId) actions.setLeadEtapa(draggingId, etapa); setDraggingId(null); setDragOver(null); }}
                className={`w-[78vw] shrink-0 snap-center rounded-xl border md:w-auto md:min-w-0 md:shrink transition-colors duration-150 ${isOver ? "border-slate-400 bg-slate-100" : "border-slate-200 bg-slate-50/60"}`}
              >
                <div className="h-1 w-full rounded-t-xl" style={{ backgroundColor: color }} />
                <div className="flex items-center gap-2 px-3 pt-3 pb-2">
                  <span className="min-w-0 truncate text-xs font-semibold text-slate-700">{etapa}</span>
                  <span className="ml-auto shrink-0 flex h-4.5 min-w-[1.25rem] items-center justify-center rounded-full bg-white border border-slate-200 px-1.5 text-[10px] font-bold text-slate-500">{colLeads.length}</span>
                </div>
                <div className="px-3 pb-2.5">
                  {total > 0 ? (<span className="text-[11px] font-semibold text-slate-500">{formatCurrency(total)}</span>) : (<span className="text-[11px] text-slate-300">—</span>)}
                </div>
                <div className="space-y-2 px-2 pb-3">
                  {colLeads.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-200 py-6 text-center text-xs text-slate-300">Sin leads</div>
                  ) : (
                    colLeads.map((lead) => (
                      <div
                        key={lead.id}
                        draggable
                        onDragStart={() => setDraggingId(lead.id)}
                        onDragEnd={() => setDraggingId(null)}
                        onTouchStart={() => { touchDragId.current = lead.id; }}
                        onTouchMove={(e) => {
                          if (!touchDragId.current) return;
                          const touch = e.touches[0];
                          const el = document.elementFromPoint(touch.clientX, touch.clientY);
                          const col = el?.closest("[data-etapa]");
                          const over = col?.getAttribute("data-etapa") as Etapa | null;
                          setDragOver(over ?? null);
                        }}
                        onTouchEnd={() => {
                          if (touchDragId.current && dragOver) actions.setLeadEtapa(touchDragId.current, dragOver);
                          touchDragId.current = null;
                          setDragOver(null);
                        }}
                      >
                        <LeadCardB2C lead={lead} tareas={tareas} pedidos={pedidos} onNavigate={() => navigate({ to: "/clientes/$id", params: { id: lead.id } })} />
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ============================ B2B view ============================ */
function PipelineB2BView() {
  const { leads, pedidos } = useStore();
  const navigate = useNavigate();
  const search = Route.useSearch();
  const filterEtapa = search.etapa && (ETAPAS_B2B as readonly string[]).includes(search.etapa) ? (search.etapa as EtapaB2B) : undefined;
  const filterAsignado = search.asignado;
  const filterMunicipio = search.municipio;
  const filterProvincia = search.provincia;
  const filterQ = search.q ?? "";
  const sort: SortB2B = search.sort ?? "fecha_desc";
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<EtapaB2B | null>(null);
  const touchDragId = useRef<string | null>(null);

  const b2b = leads.filter((l) => l.tipo === "B2B");
  const visibleEtapas = filterEtapa ? ETAPAS_B2B.filter((e) => e === filterEtapa) : ETAPAS_B2B;

  // Opciones dinámicas de municipio / provincia
  const municipios = Array.from(new Set(b2b.map((l) => (l.ciudad || "").trim()).filter(Boolean)))
    .sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" }));
  const hasSinMuni = b2b.some((l) => !(l.ciudad || "").trim());
  const provincias = Array.from(new Set(b2b.map((l) => (l.provincia || "").trim()).filter(Boolean)))
    .sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" }));
  const hasSinProv = b2b.some((l) => !(l.provincia || "").trim());

  function setParam(key: keyof Search, value: string | undefined) {
    navigate({ to: "/pipeline", search: (prev: Record<string, unknown>) => ({ ...prev, tab: "b2b", [key]: value || undefined }) });
  }
  function clearFilters() {
    navigate({ to: "/pipeline", search: { tab: "b2b" } });
  }

  const hasFilter = !!(filterEtapa || filterAsignado || filterMunicipio || filterProvincia || filterQ || (search.sort && search.sort !== "fecha_desc"));

  // Filtrado
  const nq = normalize(filterQ);
  const filtered = b2b.filter((l) => {
    if (filterAsignado && !(l.asignados ?? []).includes(filterAsignado)) return false;
    const muni = (l.ciudad || "").trim();
    const prov = (l.provincia || "").trim();
    if (filterMunicipio) {
      if (filterMunicipio === SIN_MUNI) { if (muni) return false; }
      else if (muni !== filterMunicipio) return false;
    }
    if (filterProvincia) {
      if (filterProvincia === SIN_PROV) { if (prov) return false; }
      else if (prov !== filterProvincia) return false;
    }
    if (nq) {
      const hay = normalize(b2bTitle(l)) + " " + normalize(muni);
      if (!hay.includes(nq)) return false;
    }
    return true;
  });

  // Ordenación (los sin municipio/nombre siempre al final)
  const cmp = (a: string, b: string) => a.localeCompare(b, "es", { sensitivity: "base" });
  const sorted = [...filtered].sort((a, b) => {
    switch (sort) {
      case "fecha_asc": return (a.fechaCreacion || "").localeCompare(b.fechaCreacion || "");
      case "fecha_desc": return (b.fechaCreacion || "").localeCompare(a.fechaCreacion || "");
      case "municipio_asc": {
        const ac = (a.ciudad || "").trim(), bc = (b.ciudad || "").trim();
        if (!ac && bc) return 1; if (ac && !bc) return -1; if (!ac && !bc) return 0;
        return cmp(ac, bc);
      }
      case "municipio_desc": {
        const ac = (a.ciudad || "").trim(), bc = (b.ciudad || "").trim();
        if (!ac && bc) return 1; if (ac && !bc) return -1; if (!ac && !bc) return 0;
        return cmp(bc, ac);
      }
      case "nombre_asc": return cmp(b2bTitle(a), b2bTitle(b));
      case "nombre_desc": return cmp(b2bTitle(b), b2bTitle(a));
      default: return 0;
    }
  });

  const selectCls = "w-full appearance-none rounded-lg border border-slate-200 bg-white py-1.5 pl-3 pr-7 text-xs font-medium text-slate-700 focus:border-slate-400 focus:outline-none";

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-slate-400">Arrastra las tarjetas para mover etapas</p>
        <Link to="/b2b/nuevo" className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-[#1a4b5b] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#245e73]">
          <Plus className="h-3.5 w-3.5" /> Nueva empresa
        </Link>
      </div>

      {/* Barra de filtros */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-6">
        <input
          type="text"
          value={filterQ}
          onChange={(e) => setParam("q", e.target.value)}
          placeholder="Buscar estudio o municipio…"
          className="lg:col-span-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 focus:border-slate-400 focus:outline-none"
        />
        <div className="relative">
          <select value={filterMunicipio ?? ""} onChange={(e) => setParam("municipio", e.target.value)} className={selectCls}>
            <option value="">Todos los municipios</option>
            {municipios.map((m) => (<option key={m} value={m}>{m}</option>))}
            {hasSinMuni && <option value={SIN_MUNI}>— Sin municipio —</option>}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
        </div>
        <div className="relative">
          <select value={filterProvincia ?? ""} onChange={(e) => setParam("provincia", e.target.value)} className={selectCls}>
            <option value="">Todas las provincias</option>
            {provincias.map((p) => (<option key={p} value={p}>{p}</option>))}
            {hasSinProv && <option value={SIN_PROV}>— Sin provincia —</option>}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
        </div>
        <div className="relative">
          <select value={filterAsignado ?? ""} onChange={(e) => setParam("asignado", e.target.value)} className={selectCls}>
            <option value="">Todos los asignados</option>
            {ASIGNADOS_B2B.map((a) => (<option key={a} value={a}>{a}</option>))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
        </div>
        <div className="relative flex items-center gap-2">
          <div className="relative flex-1">
            <select value={sort} onChange={(e) => setParam("sort", e.target.value)} className={selectCls}>
              <option value="fecha_desc">Fecha (más reciente)</option>
              <option value="fecha_asc">Fecha (más antigua)</option>
              <option value="municipio_asc">Municipio (A-Z)</option>
              <option value="municipio_desc">Municipio (Z-A)</option>
              <option value="nombre_asc">Nombre (A-Z)</option>
              <option value="nombre_desc">Nombre (Z-A)</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          </div>
          {hasFilter && (
            <button onClick={clearFilters} title="Limpiar filtros" className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-500 hover:bg-slate-50">
              <X className="h-3 w-3" /> Limpiar
            </button>
          )}
        </div>
      </div>

      <div className="-mx-4 overflow-x-auto px-4 pb-6 md:mx-0 md:px-0">
        <div className={`flex snap-x snap-mandatory gap-3 md:snap-none ${filterEtapa ? "md:max-w-sm" : "md:grid md:grid-cols-4"}`}>
          {visibleEtapas.map((etapa) => {
            const colLeads = sorted.filter((l) => l.etapa === etapa);
            const total = colLeads.reduce((s, l) => s + (l.valor || 0), 0);
            const isOver = dragOver === etapa;
            const color = ETAPA_COLORS[etapa];
            return (
              <div
                key={etapa}
                data-etapa={etapa}
                onDragOver={(e) => { e.preventDefault(); setDragOver(etapa); }}
                onDragLeave={() => setDragOver(null)}
                onDrop={() => { if (draggingId) actions.setLeadEtapa(draggingId, etapa); setDraggingId(null); setDragOver(null); }}
                className={`w-[78vw] shrink-0 snap-center rounded-xl border md:w-auto md:min-w-0 md:shrink transition-colors duration-150 ${isOver ? "border-slate-400 bg-slate-100" : "border-slate-200 bg-slate-50/60"}`}
              >
                <div className="h-1 w-full rounded-t-xl" style={{ backgroundColor: color }} />
                <div className="flex items-center gap-2 px-3 pt-3 pb-2">
                  <span className="min-w-0 truncate text-xs font-semibold text-slate-700">{etapa}</span>
                  <span className="ml-auto shrink-0 flex h-4.5 min-w-[1.25rem] items-center justify-center rounded-full bg-white border border-slate-200 px-1.5 text-[10px] font-bold text-slate-500">{colLeads.length}</span>
                </div>
                <div className="px-3 pb-2.5">
                  {total > 0 ? (<span className="text-[11px] font-semibold text-slate-500">{formatCurrency(total)}</span>) : (<span className="text-[11px] text-slate-300">—</span>)}
                </div>
                <div className="space-y-2 px-2 pb-3">
                  {colLeads.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-200 py-6 text-center text-xs text-slate-300">Sin empresas</div>
                  ) : (
                    colLeads.map((lead) => (
                      <div
                        key={lead.id}
                        draggable
                        onDragStart={() => setDraggingId(lead.id)}
                        onDragEnd={() => setDraggingId(null)}
                        onTouchStart={() => { touchDragId.current = lead.id; }}
                        onTouchMove={(e) => {
                          if (!touchDragId.current) return;
                          const touch = e.touches[0];
                          const el = document.elementFromPoint(touch.clientX, touch.clientY);
                          const col = el?.closest("[data-etapa]");
                          const over = col?.getAttribute("data-etapa") as EtapaB2B | null;
                          setDragOver(over ?? null);
                        }}
                        onTouchEnd={() => {
                          if (touchDragId.current && dragOver) actions.setLeadEtapa(touchDragId.current, dragOver);
                          touchDragId.current = null;
                          setDragOver(null);
                        }}
                      >
                        <LeadCardB2B lead={lead} pedidos={pedidos} onNavigate={() => navigate({ to: "/clientes/$id", params: { id: lead.id } })} />
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}

function PipelinePage() {
  const { tab: tabParam } = Route.useSearch();
  const tab: Tab = tabParam === "b2b" ? "b2b" : "b2c";
  return (
    <div className="flex h-full flex-col gap-4">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Pipeline</h1>
      </div>
      <TabsHeader tab={tab} />
      {tab === "b2c" ? <PipelineB2C /> : <PipelineB2BView />}
    </div>
  );
}
