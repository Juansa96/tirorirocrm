import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import { Package, AlertTriangle, Sparkles, Search, Plus, X, Check, ChevronRight, Pencil, Download, Trash2, Archive } from "lucide-react";
import { useStore, actions } from "@/lib/store";
import { semaforoPedido, type RutaEstado, type Pedido, type Lead, type Producto } from "@/lib/types";
import { formatShortDate, formatCurrency } from "@/lib/format";
import { TIPOS_PRODUCTO } from "@/components/ProductoForm";

function exportPedidosCSV(rows: Array<Record<string, string | number>>, filename: string) {
  const headers = Object.keys(rows[0] ?? {});
  const esc = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [headers.join(";"), ...rows.map((r) => headers.map((h) => esc(r[h])).join(";"))].join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export const Route = createFileRoute("/pedidos/")({
  head: () => ({ meta: [{ title: "Pedidos — TiroCRM" }] }),
  component: PedidosIndex,
});

const SEM_COLOR: Record<RutaEstado, { bg: string; text: string; dot: string; label: string; border: string }> = {
  verde: { bg: "bg-emerald-50",  text: "text-emerald-700", dot: "bg-emerald-500", label: "A tiempo",  border: "border-emerald-200" },
  ambar: { bg: "bg-amber-50",    text: "text-amber-700",   dot: "bg-amber-500",   label: "En riesgo", border: "border-amber-200" },
  rojo:  { bg: "bg-rose-50",     text: "text-rose-700",    dot: "bg-rose-500",    label: "Atrasado",  border: "border-rose-200" },
};

const ESTADO_OPTS = ["Todos", "En proceso", "Terminado", "Entregado"] as const;
type EstadoFiltro = typeof ESTADO_OPTS[number];

function PedidosIndex() {
  const { pedidos, leads, productos, pedidoTelas } = useStore();
  const [tab, setTab] = useState<"normal" | "ab">("normal");
  const [view, setView] = useState<"activos" | "archivo">("activos");
  const [search, setSearch] = useState("");
  const [semF, setSemF] = useState<"todos" | RutaEstado>("todos");
  const [newOpen, setNewOpen] = useState(false);
  const [, setNowTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setNowTick((n) => n + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  const enriched = useMemo(() => pedidos.map((p) => {
    const lead = leads.find((l) => l.id === p.leadId);
    const prod = productos.find((pr) => pr.id === p.productoLeadId);
    const sem = semaforoPedido(p);
    const tls = pedidoTelas.filter((t) => t.pedidoId === p.id);
    const totalT = tls.length;
    const okT = tls.filter((t) => t.estado === "Recibida").length;
    return { pedido: p, lead, producto: prod, sem, totalT, okT };
  }), [pedidos, leads, productos, pedidoTelas]);

  // "B2B" tab: pedidos vinculados a empresa B2B O al partner Alejandra Blanc (legacy clienteTipo).
  const isB2B = ({ pedido, lead }: (typeof enriched)[number]) =>
    !!pedido.empresaId || lead?.clienteTipo === "partner_ab" || lead?.tipo === "B2B";
  const abCount = enriched.filter(isB2B).length;
  const normalCount = enriched.length - abCount;

  const baseTab = enriched.filter((it) => tab === "ab" ? isB2B(it) : !isB2B(it));

  // Group by person (leadId || clienteNombreLibre)
  type Group = { key: string; nombre: string; lead: Lead | undefined; items: typeof baseTab; allEntregados: boolean; oldest: string; total: number };
  const groupsAll: Group[] = useMemo(() => {
    const map = new Map<string, Group>();
    for (const it of baseTab) {
      const key = it.lead?.id || it.pedido.clienteNombreLibre || it.pedido.id;
      const nombre = it.lead?.nombre || it.pedido.clienteNombreLibre || "—";
      const g = map.get(key) ?? { key, nombre, lead: it.lead, items: [], allEntregados: true, oldest: it.pedido.fechaCreacionPedido, total: 0 };
      g.items.push(it);
      if (!it.pedido.entregado) g.allEntregados = false;
      if (it.pedido.fechaCreacionPedido && (!g.oldest || it.pedido.fechaCreacionPedido < g.oldest)) g.oldest = it.pedido.fechaCreacionPedido;
      g.total += (it.pedido.precio || 0) + (it.pedido.costeEnvio || 0);
      map.set(key, g);
    }
    for (const g of map.values()) {
      g.items.sort((a, b) => (a.pedido.fechaCreacionPedido || "").localeCompare(b.pedido.fechaCreacionPedido || ""));
    }
    return Array.from(map.values());
  }, [baseTab]);

  const groups = useMemo(() => {
    const filtered = groupsAll.filter((g) => view === "archivo" ? g.allEntregados : !g.allEntregados);
    // Filtros texto/semáforo
    const q = search.trim().toLowerCase();
    return filtered
      .map((g) => {
        const items = g.items.filter(({ pedido, producto, sem }) => {
          if (view === "activos" && pedido.entregado) return false;
          if (semF !== "todos" && sem.estado !== semF) return false;
          if (q) {
            const nombre = g.nombre.toLowerCase();
            const prodTxt = ((producto?.modelo || "") + " " + (producto?.tipo || "")).toLowerCase();
            if (!nombre.includes(q) && !prodTxt.includes(q)) return false;
          }
          return true;
        });
        return { ...g, items };
      })
      .filter((g) => g.items.length > 0)
      .sort((a, b) => view === "archivo"
        ? (b.oldest || "").localeCompare(a.oldest || "")
        : (a.oldest || "").localeCompare(b.oldest || ""));
  }, [groupsAll, view, search, semF]);

  const totalPedidos = groups.reduce((s, g) => s + g.items.length, 0);
  const archivoCount = groupsAll.filter((g) => g.allEntregados).length;

  const atrasados = baseTab.filter(({ pedido, sem }) => !pedido.entregado && sem.estado === "rojo");

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
            <Package className="h-6 w-6 text-[#1a1f36]" /> Pedidos
          </h1>
          <p className="text-sm text-slate-500">{groups.length} cliente{groups.length === 1 ? "" : "s"} · {totalPedidos} pedido{totalPedidos === 1 ? "" : "s"}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              const rows = groups.flatMap((g) => g.items.map(({ pedido, producto, sem }) => ({
                Cliente: g.nombre,
                Producto: [producto?.tipo, producto?.modelo].filter(Boolean).join(" "),
                Estado: pedido.estadoPedido,
                Semaforo: sem.estado,
                FechaCreacion: formatShortDate(pedido.fechaCreacionPedido),
                FechaLimite: formatShortDate(pedido.fechaLimite),
                FechaEntrega: formatShortDate(pedido.fechaEntregaReal),
                Precio: pedido.precio || 0,
                CosteEnvio: pedido.costeEnvio || 0,
                Pagado50: pedido.pagado50 ? "Sí" : "No",
                PagadoCompleto: pedido.pagadoCompleto ? "Sí" : "No",
                Factura: pedido.factura || "",
              })));
              if (rows.length === 0) return;
              exportPedidosCSV(rows, `pedidos-${new Date().toISOString().slice(0, 10)}.csv`);
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            title="Exportar CSV"
          >
            <Download className="h-4 w-4" /> <span className="hidden sm:inline">Exportar</span>
          </button>
          <button
            onClick={() => setNewOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#1a1f36] px-3 py-2 text-sm font-medium text-white hover:bg-[#2a2f46]"
          >
            <Plus className="h-4 w-4" /> Nuevo pedido
          </button>
        </div>
      </div>

      {/* Tabs partner */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200">
        <button onClick={() => setTab("normal")} className={`flex items-center gap-2 border-b-2 px-3 pb-2 pt-1 text-sm font-semibold transition-colors ${tab === "normal" ? "border-[#1a1f36] text-slate-900" : "border-transparent text-slate-400 hover:text-slate-600"}`}>
          <Package className="h-4 w-4" /> Pedidos
          <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-600">{normalCount}</span>
        </button>
        <button onClick={() => setTab("ab")} className={`flex items-center gap-2 border-b-2 px-3 pb-2 pt-1 text-sm font-semibold transition-colors ${tab === "ab" ? "border-[#1a4b5b] text-slate-900" : "border-transparent text-slate-400 hover:text-slate-600"}`}>
          <Sparkles className="h-4 w-4 text-[#1a4b5b]" /> B2B
          <span className="rounded-full bg-[#e6f1f4] px-1.5 py-0.5 text-[10px] font-bold text-[#1a4b5b]">{abCount}</span>
        </button>
      </div>

      {/* Sub-tabs Activos / Archivo */}
      <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 text-sm">
        <button onClick={() => setView("activos")} className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium ${view === "activos" ? "bg-slate-900 text-white" : "text-slate-600"}`}>
          <Package className="h-3.5 w-3.5" /> Activos
        </button>
        <button onClick={() => setView("archivo")} className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium ${view === "archivo" ? "bg-slate-900 text-white" : "text-slate-600"}`}>
          <Archive className="h-3.5 w-3.5" /> Archivo {archivoCount > 0 && <span className="rounded-full bg-slate-200 px-1.5 py-0.5 text-[10px] font-bold text-slate-700">{archivoCount}</span>}
        </button>
      </div>

      {/* Atrasados banner */}
      {view === "activos" && atrasados.length > 0 && (
        <div className="rounded-xl border-2 border-rose-200 bg-rose-50/60 p-4">
          <div className="mb-3 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-rose-600" />
            <h2 className="text-sm font-bold uppercase tracking-wide text-rose-700">
              {atrasados.length} pedido{atrasados.length > 1 ? "s" : ""} atrasado{atrasados.length > 1 ? "s" : ""}
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {atrasados.map(({ pedido, lead, producto, sem }) => (
              <Link key={pedido.id} to="/pedidos/$id" params={{ id: pedido.id }} className="block rounded-lg border border-rose-300 bg-white p-3 transition-shadow hover:shadow-md">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-slate-900">{lead?.nombre ?? pedido.clienteNombreLibre ?? "—"}</div>
                    <div className="truncate text-xs text-slate-500">{producto?.modelo || producto?.tipo || "Producto"}</div>
                  </div>
                  <span className="shrink-0 rounded-full bg-rose-600 px-2 py-0.5 text-[10px] font-bold text-white">
                    {sem.diasRestantes < 0 ? `${Math.abs(sem.diasRestantes)}d tarde` : "límite hoy"}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-2 shadow-sm">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por cliente o producto…"
            className="w-full rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-2 text-sm focus:border-slate-400 focus:bg-white focus:outline-none"
          />
        </div>
        <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 text-xs">
          {(["todos", "verde", "ambar", "rojo"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setSemF(s)}
              className={`rounded-md px-2 py-1 font-medium ${semF === s ? "bg-slate-900 text-white" : "text-slate-600"}`}
            >
              {s === "todos" ? "Todos" : SEM_COLOR[s].label}
            </button>
          ))}
        </div>
      </div>

      {/* Grupos por persona */}
      <div className="space-y-4">
        {groups.map((g) => (
          <PersonaGroup key={g.key} nombre={g.nombre} lead={g.lead} total={g.total} items={g.items} />
        ))}
        {groups.length === 0 && (
          <div className="rounded-xl border border-slate-200 bg-white py-10 text-center text-sm text-slate-400">
            {view === "archivo" ? "Sin pedidos en el archivo" : "Sin pedidos activos"}
          </div>
        )}
      </div>

      {newOpen && <NuevoPedidoModal onClose={() => setNewOpen(false)} />}
    </div>
  );
}

function PersonaGroup({ nombre, lead, total, items }: {
  nombre: string; lead: Lead | undefined; total: number;
  items: Array<{ pedido: Pedido; lead: Lead | undefined; producto: Producto | undefined; sem: ReturnType<typeof semaforoPedido>; totalT: number; okT: number }>;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/70 px-4 py-2.5">
        <div className="min-w-0">
          {lead ? (
            <Link to="/clientes/$id" params={{ id: lead.id }} className="truncate text-sm font-bold text-slate-900 hover:text-[#1a4b5b] hover:underline">
              {nombre}
            </Link>
          ) : (
            <span className="truncate text-sm font-bold text-slate-900">{nombre}</span>
          )}
          <span className="ml-2 text-xs text-slate-500">{items.length} producto{items.length === 1 ? "" : "s"}</span>
          {!lead && <span className="ml-2 inline-block rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">Sin lead vinculado</span>}
        </div>
        <div className="text-sm font-bold text-slate-900">{formatCurrency(total)}</div>
      </div>

      {/* Desktop: tabla compacta */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-sm">
          <thead className="bg-white text-left text-[11px] uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2">Producto</th>
              <th className="px-3 py-2">Telas</th>
              <th className="px-3 py-2 text-center" title="Estructura hecha">Estr.</th>
              <th className="px-3 py-2 text-center" title="Tapizado hecho">Tapi.</th>
              <th className="px-3 py-2">Deadline</th>
              <th className="px-3 py-2">Días</th>
              <th className="px-3 py-2 text-right">Precio</th>
              <th className="px-3 py-2 text-right">Envío</th>
              <th className="px-3 py-2 text-center">Pagado</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {items.map(({ pedido, producto, sem, totalT, okT }) => (
              <PedidoRow key={pedido.id} pedido={pedido} producto={producto} sem={sem} totalT={totalT} okT={okT} />
            ))}
          </tbody>
        </table>
      </div>

      {/* Móvil: tarjetas */}
      <div className="space-y-2 p-3 md:hidden">
        {items.map(({ pedido, producto, sem, totalT, okT }) => (
          <PedidoCard key={pedido.id} pedido={pedido} producto={producto} sem={sem} totalT={totalT} okT={okT} />
        ))}
      </div>
    </div>
  );
}


// ──────────────────────────────────────────────────────────────────────────
// Card móvil + bottom sheet de edición
function PedidoCard({ pedido, producto, sem, totalT, okT }: {
  pedido: Pedido; producto: Producto | undefined;
  sem: ReturnType<typeof semaforoPedido>; totalT: number; okT: number;
}) {
  const [editing, setEditing] = useState(false);
  const c = SEM_COLOR[sem.estado];
  const tipoLabel = producto ? (TIPOS_PRODUCTO.find(t => t.id === producto.tipo)?.label ?? producto.tipo) : "";
  const diasLabel = pedido.entregado ? "Entregado" : sem.diasRestantes >= 0 ? `${sem.diasRestantes}d restantes` : `${Math.abs(sem.diasRestantes)}d de retraso`;
  const borderLeft = sem.estado === "verde" ? "border-l-emerald-500" : sem.estado === "ambar" ? "border-l-amber-500" : "border-l-rose-500";

  return (
    <>
      <div className={`rounded-xl border border-slate-200 border-l-4 ${borderLeft} bg-white shadow-sm`}>
        <Link to="/pedidos/$id" params={{ id: pedido.id }} className="flex items-start gap-3 p-3.5 active:bg-slate-50">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${c.dot}`} />
              <h3 className="truncate text-sm font-semibold text-slate-900">
                {producto ? `${tipoLabel}${producto.modelo ? ` · ${producto.modelo}` : ""}` : "Pedido"}
              </h3>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
              <span className={`font-medium ${sem.estado === "rojo" && !pedido.entregado ? "text-rose-700" : "text-slate-600"}`}>{diasLabel}</span>
              <span className="text-slate-400">·</span>
              <span className="text-slate-500">{formatShortDate(pedido.fechaLimite)}</span>
              {totalT > 0 && (<><span className="text-slate-400">·</span><span className={okT === totalT ? "text-emerald-700" : "text-slate-500"}>Telas {okT}/{totalT}</span></>)}
              <span className="text-slate-400">·</span>
              <span className="font-semibold text-slate-700">{formatCurrency((pedido.precio || 0) + (pedido.costeEnvio || 0))}</span>
            </div>
          </div>
          <ChevronRight className="mt-1 h-5 w-5 shrink-0 text-slate-300" />
        </Link>

        <div className="grid grid-cols-4 border-t border-slate-100">
          <ToggleHito label="Estr." active={pedido.estructuraHecha} onToggle={() => actions.updatePedido(pedido.id, { estructuraHecha: !pedido.estructuraHecha, estructuraHechaFecha: !pedido.estructuraHecha && !pedido.estructuraHechaFecha ? new Date().toISOString().slice(0, 10) : pedido.estructuraHechaFecha })} />
          <ToggleHito label="Tapi." active={pedido.tapizadoHecho} onToggle={() => actions.updatePedido(pedido.id, { tapizadoHecho: !pedido.tapizadoHecho, tapizadoHechoFecha: !pedido.tapizadoHecho && !pedido.tapizadoHechoFecha ? new Date().toISOString().slice(0, 10) : pedido.tapizadoHechoFecha })} />
          <button onClick={() => setEditing(true)} className="flex h-12 items-center justify-center gap-1.5 border-l border-slate-100 text-xs font-medium text-slate-600 active:bg-slate-100">
            <Pencil className="h-3.5 w-3.5" /> Editar
          </button>
          <button onClick={() => { if (confirm("¿Eliminar este pedido?")) actions.deletePedido(pedido.id); }} className="flex h-12 items-center justify-center border-l border-slate-100 text-rose-500 active:bg-rose-50">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
      {editing && <EditPedidoSheet pedido={pedido} onClose={() => setEditing(false)} />}
    </>
  );
}

function ToggleHito({ label, active, onToggle }: { label: string; active: boolean; onToggle: () => void }) {
  return (
    <button onClick={onToggle} className={`flex h-12 items-center justify-center gap-1.5 border-r border-slate-100 text-xs font-medium active:bg-slate-100 ${active ? "text-emerald-700" : "text-slate-500"}`}>
      <span className={`flex h-4 w-4 items-center justify-center rounded border ${active ? "border-emerald-500 bg-emerald-500 text-white" : "border-slate-300 bg-white"}`}>
        {active && <Check className="h-3 w-3" />}
      </span>
      {label}
    </button>
  );
}

function EditPedidoSheet({ pedido, onClose }: { pedido: Pedido; onClose: () => void }) {
  const [precio, setPrecio] = useState(pedido.precio);
  const [reserva, setReserva] = useState(pedido.reserva);
  const [costeEnvio, setCosteEnvio] = useState(pedido.costeEnvio);
  const [pagado, setPagado] = useState(pedido.pagadoCompleto);

  async function save() {
    await actions.updatePedido(pedido.id, { precio, reserva, costeEnvio, pagadoCompleto: pagado });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-slate-900/50" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full rounded-t-2xl bg-white p-5 pb-8 shadow-2xl">
        <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-slate-200" />
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">Editar pedido</h2>
          <button onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-full text-slate-400 active:bg-slate-100"><X className="h-5 w-5" /></button>
        </div>
        <div className="space-y-3">
          <SheetField label="Precio (€)"><input type="number" inputMode="decimal" step="0.01" value={precio} onChange={(e) => setPrecio(parseFloat(e.target.value) || 0)} className="w-full rounded-lg border border-slate-300 px-3 py-3 text-base focus:border-slate-500 focus:outline-none" /></SheetField>
          <SheetField label="Reserva (€)"><input type="number" inputMode="decimal" step="0.01" value={reserva} onChange={(e) => setReserva(parseFloat(e.target.value) || 0)} className="w-full rounded-lg border border-slate-300 px-3 py-3 text-base focus:border-slate-500 focus:outline-none" /></SheetField>
          <SheetField label="Coste envío (€)"><input type="number" inputMode="decimal" step="0.01" value={costeEnvio} onChange={(e) => setCosteEnvio(parseFloat(e.target.value) || 0)} className="w-full rounded-lg border border-slate-300 px-3 py-3 text-base focus:border-slate-500 focus:outline-none" /></SheetField>
          <button onClick={() => setPagado(!pagado)} className={`flex w-full items-center justify-between rounded-lg border px-4 py-3 text-base ${pagado ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-slate-300 bg-white text-slate-700"}`}>
            <span className="font-medium">Pagado completo</span>
            <span className={`flex h-6 w-6 items-center justify-center rounded border-2 ${pagado ? "border-emerald-500 bg-emerald-500 text-white" : "border-slate-300 bg-white"}`}>
              {pagado && <Check className="h-4 w-4" />}
            </span>
          </button>
          <div className="rounded-lg bg-slate-50 px-3 py-2.5 text-sm text-slate-500">
            Total: <span className="font-bold text-slate-900">{formatCurrency(precio + costeEnvio)}</span>
          </div>
          <div className="flex gap-2 pt-2">
            <button onClick={onClose} className="flex-1 rounded-lg border border-slate-300 py-3 text-base font-medium text-slate-700 active:bg-slate-100">Cancelar</button>
            <button onClick={save} className="flex-1 rounded-lg bg-[#1a1f36] py-3 text-base font-semibold text-white active:bg-[#2a2f46]">Guardar</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SheetField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</label>
      {children}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
function PedidoRow({ pedido, producto, sem, totalT, okT }: {
  pedido: Pedido; producto: Producto | undefined;
  sem: ReturnType<typeof semaforoPedido>; totalT: number; okT: number;
}) {
  const c = SEM_COLOR[sem.estado];
  const tipoLabel = producto ? (TIPOS_PRODUCTO.find(t => t.id === producto.tipo)?.label ?? producto.tipo) : "";
  return (
    <tr className="border-t border-slate-100 hover:bg-slate-50/60">
      <td className="px-3 py-2 text-xs text-slate-700">
        <Link to="/pedidos/$id" params={{ id: pedido.id }} className="font-medium hover:text-[#1a4b5b] hover:underline">
          {producto ? `${tipoLabel}${producto.modelo ? ` · ${producto.modelo}` : ""}` : "—"}
        </Link>
        {producto?.ancho && producto?.alto && (
          <div className="text-[11px] text-slate-400">{producto.ancho}×{producto.alto}</div>
        )}
      </td>
      <td className="px-3 py-2">
        <Link to="/pedidos/$id" params={{ id: pedido.id }} className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium ${okT === totalT && totalT > 0 ? "bg-emerald-50 text-emerald-700" : okT > 0 ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-600"}`}>
          {okT}/{totalT}
        </Link>
      </td>
      <td className="px-3 py-2 text-center">
        <CheckCell value={pedido.estructuraHecha} onChange={(v) => actions.updatePedido(pedido.id, { estructuraHecha: v, estructuraHechaFecha: v && !pedido.estructuraHechaFecha ? new Date().toISOString().slice(0, 10) : pedido.estructuraHechaFecha })} />
      </td>
      <td className="px-3 py-2 text-center">
        <CheckCell value={pedido.tapizadoHecho} onChange={(v) => actions.updatePedido(pedido.id, { tapizadoHecho: v, tapizadoHechoFecha: v && !pedido.tapizadoHechoFecha ? new Date().toISOString().slice(0, 10) : pedido.tapizadoHechoFecha })} />
      </td>
      <td className={`px-3 py-2 text-xs ${sem.diasRestantes < 0 && !pedido.entregado ? "font-bold text-rose-700" : "text-slate-600"}`}>
        {formatShortDate(pedido.fechaLimite)}
      </td>
      <td className="px-3 py-2">
        <span className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium ${c.bg} ${c.text}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${c.dot}`} />
          {pedido.entregado ? "OK" : sem.diasRestantes >= 0 ? `${sem.diasRestantes}d` : `${Math.abs(sem.diasRestantes)}d tarde`}
        </span>
      </td>
      <td className="px-3 py-2 text-right">
        <NumberCell value={pedido.precio} onSave={(v) => actions.updatePedido(pedido.id, { precio: v })} />
      </td>
      <td className="px-3 py-2 text-right">
        <NumberCell value={pedido.costeEnvio} onSave={(v) => actions.updatePedido(pedido.id, { costeEnvio: v })} />
      </td>
      <td className="px-3 py-2 text-center">
        <CheckCell value={pedido.pagadoCompleto} onChange={(v) => actions.updatePedido(pedido.id, { pagadoCompleto: v })} />
      </td>
      <td className="px-3 py-2 text-right">
        <button
          onClick={() => { if (confirm("¿Eliminar este pedido?")) actions.deletePedido(pedido.id); }}
          className="rounded p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
          title="Eliminar pedido"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </td>
    </tr>
  );
}

function CheckCell({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!value)}
      className={`flex h-6 w-6 mx-auto items-center justify-center rounded border ${value ? "border-emerald-500 bg-emerald-500 text-white" : "border-slate-300 bg-white text-transparent hover:border-slate-500"}`}
    >
      <Check className="h-3.5 w-3.5" />
    </button>
  );
}

function NumberCell({ value, onSave }: { value: number; onSave: (v: number) => void }) {
  return (
    <input
      type="number"
      step="0.01"
      defaultValue={value}
      key={value}
      onBlur={(e) => {
        const v = parseFloat(e.target.value) || 0;
        if (v !== value) onSave(v);
      }}
      className="w-20 rounded border border-transparent bg-transparent px-1 py-0.5 text-right text-sm hover:border-slate-200 focus:border-slate-400 focus:bg-white focus:outline-none"
    />
  );
}

// ──────────────────────────────────────────────────────────────────────────
function NuevoPedidoModal({ onClose }: { onClose: () => void }) {
  const { leads, productos } = useStore();
  const [mode, setMode] = useState<"lead" | "libre" | "b2b">("lead");
  const [leadId, setLeadId] = useState<string>("");
  const [leadSearch, setLeadSearch] = useState("");
  const [nombreLibre, setNombreLibre] = useState("");
  const [empresaId, setEmpresaId] = useState<string>("");
  const [prodMode, setProdMode] = useState<"existente" | "nuevo">("nuevo");
  const [productoId, setProductoId] = useState<string>("");
  const [tipo, setTipo] = useState<string>("cabecero");
  const [modelo, setModelo] = useState("");
  const [diasPlazo, setDiasPlazo] = useState(20);
  const [precio, setPrecio] = useState(0);
  const [reserva, setReserva] = useState(0);
  const [costeEnvio, setCosteEnvio] = useState(0);
  const [saving, setSaving] = useState(false);

  const empresasB2B = useMemo(() => leads.filter((l) => l.tipo === "B2B"), [leads]);

  const leadFiltered = useMemo(() => {
    const q = leadSearch.toLowerCase();
    return leads.filter((l) => l.nombre.toLowerCase().includes(q)).slice(0, 8);
  }, [leads, leadSearch]);

  const productosDelLead = useMemo(
    () => productos.filter((p) => leadId && p.leadId === leadId),
    [productos, leadId]
  );

  async function submit() {
    if (mode === "lead" && !leadId) return;
    if (mode === "libre" && !nombreLibre.trim()) return;
    if (mode === "b2b" && !empresaId) return;
    if (prodMode === "existente" && !productoId) return;
    if (prodMode === "nuevo" && !tipo) return;
    setSaving(true);
    const finalLeadId = mode === "lead" ? leadId : mode === "b2b" ? empresaId : null;
    const created = await actions.crearPedidoManual({
      leadId: finalLeadId,
      clienteNombreLibre: mode === "libre" ? nombreLibre.trim() : "",
      productoId: prodMode === "existente" ? productoId : null,
      nuevoProducto: prodMode === "nuevo" ? { tipo, modelo: modelo.trim() } : undefined,
      diasPlazo, precio, reserva, costeEnvio,
      empresaId: mode === "b2b" ? empresaId : undefined,
    });
    setSaving(false);
    if (created) onClose();
  }

  const selectedLead = leads.find((l) => l.id === leadId);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-slate-900/50 md:items-start md:p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-xl rounded-t-2xl bg-white p-5 pb-8 shadow-2xl md:my-8 md:rounded-xl md:pb-5">
        <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-slate-200 md:hidden" />
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">Nuevo pedido</h2>
          <button onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-full text-slate-400 active:bg-slate-100 md:h-8 md:w-8"><X className="h-5 w-5 md:h-4 md:w-4" /></button>
        </div>

        <div className="space-y-4">
          {/* Cliente */}
          <div>
            <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">Cliente</div>
            <div className="mb-2 grid grid-cols-2 gap-1 rounded-lg border border-slate-200 bg-white p-0.5 text-sm md:inline-flex md:text-xs">
              <button onClick={() => setMode("lead")} className={`rounded-md px-2 py-2 md:py-1 ${mode === "lead" ? "bg-slate-900 text-white" : "text-slate-600"}`}>Cliente existente</button>
              <button onClick={() => setMode("libre")} className={`rounded-md px-2 py-2 md:py-1 ${mode === "libre" ? "bg-slate-900 text-white" : "text-slate-600"}`}>No está en el CRM</button>
            </div>
            {mode === "lead" ? (
              <div className="space-y-1.5">
                <input
                  value={selectedLead ? selectedLead.nombre : leadSearch}
                  onChange={(e) => { setLeadSearch(e.target.value); setLeadId(""); }}
                  placeholder="Buscar lead por nombre…"
                  className="w-full rounded-lg border border-slate-300 px-3 py-3 text-base focus:border-slate-500 focus:outline-none md:py-1.5 md:text-sm"
                />
                {!selectedLead && leadSearch && (
                  <div className="max-h-60 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-sm">
                    {leadFiltered.length === 0 ? (
                      <div className="px-3 py-2 text-xs text-slate-400">Sin coincidencias</div>
                    ) : leadFiltered.map((l) => (
                      <button key={l.id} onClick={() => { setLeadId(l.id); setLeadSearch(""); }} className="block w-full px-3 py-3 text-left text-base active:bg-slate-100 md:py-1.5 md:text-sm md:hover:bg-slate-50">
                        {l.nombre}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <input
                value={nombreLibre}
                onChange={(e) => setNombreLibre(e.target.value)}
                placeholder="Nombre del cliente"
                className="w-full rounded-lg border border-slate-300 px-3 py-3 text-base focus:border-slate-500 focus:outline-none md:py-1.5 md:text-sm"
              />
            )}
          </div>

          {/* Producto */}
          <div>
            <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">Producto</div>
            {productosDelLead.length > 0 && (
              <div className="mb-2 grid grid-cols-2 gap-1 rounded-lg border border-slate-200 bg-white p-0.5 text-sm md:inline-flex md:text-xs">
                <button onClick={() => setProdMode("existente")} className={`rounded-md px-2 py-2 md:py-1 ${prodMode === "existente" ? "bg-slate-900 text-white" : "text-slate-600"}`}>Existente del lead</button>
                <button onClick={() => setProdMode("nuevo")} className={`rounded-md px-2 py-2 md:py-1 ${prodMode === "nuevo" ? "bg-slate-900 text-white" : "text-slate-600"}`}>Nuevo producto</button>
              </div>
            )}
            {prodMode === "existente" && productosDelLead.length > 0 ? (
              <select value={productoId} onChange={(e) => setProductoId(e.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-3 text-base md:py-1.5 md:text-sm">
                <option value="">— Selecciona producto —</option>
                {productosDelLead.map((p) => (
                  <option key={p.id} value={p.id}>
                    {TIPOS_PRODUCTO.find(t => t.id === p.tipo)?.label ?? p.tipo}{p.modelo ? ` · ${p.modelo}` : ""}
                  </option>
                ))}
              </select>
            ) : (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <select value={tipo} onChange={(e) => setTipo(e.target.value)} className="rounded-lg border border-slate-300 bg-white px-3 py-3 text-base md:py-1.5 md:text-sm">
                  {TIPOS_PRODUCTO.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                </select>
                <input value={modelo} onChange={(e) => setModelo(e.target.value)} placeholder="Modelo" className="rounded-lg border border-slate-300 px-3 py-3 text-base md:py-1.5 md:text-sm" />
              </div>
            )}
          </div>

          {/* Datos pedido */}
          <div className="grid grid-cols-2 gap-2">
            <Field label="Días de plazo"><input type="number" inputMode="numeric" min={1} value={diasPlazo} onChange={(e) => setDiasPlazo(parseInt(e.target.value) || 20)} className="w-full rounded-lg border border-slate-300 px-3 py-3 text-base md:py-1.5 md:text-sm" /></Field>
            <Field label="Precio (€)"><input type="number" inputMode="decimal" step="0.01" value={precio} onChange={(e) => setPrecio(parseFloat(e.target.value) || 0)} className="w-full rounded-lg border border-slate-300 px-3 py-3 text-base md:py-1.5 md:text-sm" /></Field>
            <Field label="Reserva (€)"><input type="number" inputMode="decimal" step="0.01" value={reserva} onChange={(e) => setReserva(parseFloat(e.target.value) || 0)} className="w-full rounded-lg border border-slate-300 px-3 py-3 text-base md:py-1.5 md:text-sm" /></Field>
            <Field label="Coste envío (€)"><input type="number" inputMode="decimal" step="0.01" value={costeEnvio} onChange={(e) => setCosteEnvio(parseFloat(e.target.value) || 0)} className="w-full rounded-lg border border-slate-300 px-3 py-3 text-base md:py-1.5 md:text-sm" /></Field>
          </div>

          <div className="rounded-lg bg-slate-50 px-3 py-2.5 text-sm text-slate-500">
            Total a cobrar: <span className="font-bold text-slate-900">{formatCurrency(precio + costeEnvio)}</span>
          </div>

          <div className="flex gap-2 border-t border-slate-100 pt-3">
            <button onClick={onClose} className="flex-1 rounded-lg border border-slate-300 py-3 text-base font-medium text-slate-700 active:bg-slate-100 md:flex-none md:py-1.5 md:text-sm">Cancelar</button>
            <button onClick={submit} disabled={saving} className="flex-1 rounded-lg bg-[#1a1f36] py-3 text-base font-semibold text-white hover:bg-[#2a2f46] disabled:opacity-50 md:flex-none md:px-3 md:py-1.5 md:text-sm">
              {saving ? "Creando…" : "Crear pedido"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-0.5 block text-xs text-slate-500">{label}</label>
      {children}
    </div>
  );
}
