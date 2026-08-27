import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { LogOut, Hammer, ChevronRight, ArrowLeft, Eye, Star, GripVertical } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { tapiceroNombre, type Tapicero } from "@/lib/types";
import { displayNombreProducto, modeloDetalle, esDetalleMedida } from "@/lib/catalogo";
import { SiluetaProducto } from "@/components/SiluetaProducto";
import { usePanelPedidos, type PanelPedido } from "@/lib/panel-data";
import { toast } from "sonner";

interface Search { tapicero?: string; }

export const Route = createFileRoute("/panel/")({
  head: () => ({ meta: [{ title: "Mi taller — Tiroriro" }] }),
  validateSearch: (s: Record<string, unknown>): Search => ({ tapicero: s.tapicero ? String(s.tapicero) : undefined }),
  component: Panel,
});

// Color por días restantes: rojo si se pasa, ámbar si queda poco, verde si sobra.
function diasColor(d: number, entregado: boolean) {
  if (entregado) return { bg: "bg-slate-100", text: "text-slate-500", label: "Entregado" };
  if (d < 0) return { bg: "bg-rose-100", text: "text-rose-700", label: `${Math.abs(d)}d tarde` };
  if (d <= 3) return { bg: "bg-amber-100", text: "text-amber-700", label: d === 0 ? "Hoy" : `${d}d` };
  return { bg: "bg-emerald-100", text: "text-emerald-700", label: `${d}d` };
}

// Chip de prioridad. Solo se muestra si NO es Normal (para no llenar de ruido).
function prioridadChip(prioridad: number): { bg: string; text: string; label: string } | null {
  if (prioridad === 1) return { bg: "bg-rose-100", text: "text-rose-700", label: "Alta" };
  if (prioridad === 3) return { bg: "bg-slate-100", text: "text-slate-500", label: "Baja" };
  return null;
}

function Panel() {
  const { esTapicero, esEquipo, tapiceroId: miTapiceroId, signOut } = useAuth();
  const search = Route.useSearch();
  const navigate = useNavigate();

  // Equipo: puede elegir tapicero (?tapicero=). Tapicero: siempre el suyo.
  const [tapiceros, setTapiceros] = useState<Tapicero[]>([]);
  useEffect(() => {
    if (!esEquipo) return;
    void supabase.from("tapiceros").select("*").order("orden").then(({ data }) => {
      setTapiceros(((data as unknown as Record<string, unknown>[]) ?? []).map((t) => ({
        id: t.id as string, nombre: (t.nombre as string) ?? "", apellido: (t.apellido as string) ?? "",
        activo: t.activo !== false, orden: Number(t.orden) || 0,
        accessToken: (t.access_token as string) ?? "", accessTokenActivo: t.access_token_activo !== false,
        ocultaApellidos: t.oculta_apellidos === true,
      })));
    });
  }, [esEquipo]);

  const viendoId = esTapicero ? miTapiceroId : (search.tapicero ?? "");
  const { pedidos, refetch } = usePanelPedidos(viendoId || null, esTapicero);
  const [verEntregados, setVerEntregados] = useState(false);
  // Filtro rápido: por estado de tela y por retraso.
  const [filtroEstado, setFiltroEstado] = useState<"todos" | "pendiente_tela" | "en_curso">("todos");
  const [soloRetrasados, setSoloRetrasados] = useState(false);
  // Reordenación por arrastre (solo equipo). `ordenOverride` reordena al instante
  // (optimista) mientras se guarda en la BD.
  const [ordenOverride, setOrdenOverride] = useState<Record<string, number>>({});
  // Reordenación por arrastre con POINTER EVENTS (funciona con ratón y en
  // móvil/táctil; la card se ve moverse). dy = desplazamiento vertical en px.
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [dy, setDy] = useState(0);
  const dragIdRef = useRef<string | null>(null);
  const overIdRef = useRef<string | null>(null);
  const rowRefs = useRef<Map<string, HTMLElement>>(new Map());
  const dragStart = useRef<{ y: number; flat: PanelPedido[] } | null>(null);

  const registrar = useCallback((rid: string, el: HTMLElement | null) => {
    if (el) rowRefs.current.set(rid, el); else rowRefs.current.delete(rid);
  }, []);

  const tapiceroActual = tapiceros.find((t) => t.id === viendoId);

  // Equipo sin tapicero elegido → selector.
  if (esEquipo && !viendoId) {
    return (
      <Shell onSignOut={signOut} equipo>
        <div className="mx-auto max-w-md px-4 py-10">
          <h1 className="mb-4 text-lg font-bold text-slate-900">Ver panel de un tapicero</h1>
          <div className="space-y-2">
            {tapiceros.filter((t) => t.activo).map((t) => (
              <button key={t.id} onClick={() => navigate({ to: "/panel", search: { tapicero: t.id } })}
                className="flex w-full items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3 text-left hover:bg-slate-50">
                <span className="font-medium">{tapiceroNombre(t)}</span><ChevronRight className="h-4 w-4 text-slate-400" />
              </button>
            ))}
          </div>
        </div>
      </Shell>
    );
  }

  const activos = (pedidos ?? []).filter((p) => !p.terminado && !p.entregado);
  const entregados = (pedidos ?? []).filter((p) => p.terminado || p.entregado);
  const base = verEntregados ? entregados : activos;
  const lista = base.filter((p) => {
    if (!verEntregados && filtroEstado === "pendiente_tela" && p.telaEstado === "recibida") return false;
    if (!verEntregados && filtroEstado === "en_curso" && p.telaEstado !== "recibida") return false;
    if (soloRetrasados && p.diasRestantes >= 0) return false;
    return true;
  });

  // Solo el equipo puede reordenar, y solo en "En curso" sin filtros (para que
  // la secuencia sea la global). El tapicero nunca puede: solo ve el número.
  const puedeOrdenar = esEquipo && !verEntregados && filtroEstado === "todos" && !soloRetrasados;

  // Aplica el orden optimista (arrastre en curso) a una lista.
  const conOrden = (arr: PanelPedido[]) =>
    Object.keys(ordenOverride).length === 0
      ? arr
      : arr.map((p) => (ordenOverride[p.id] != null ? { ...p, ordenProduccion: ordenOverride[p.id] } : p));

  // Guarda una secuencia plana como orden_produccion = 1..N (refleja al instante
  // y persiste en la BD).
  async function guardarOrden(flat: PanelPedido[]) {
    setOrdenOverride(Object.fromEntries(flat.map((p, i) => [p.id, i + 1])));
    try {
      await Promise.all(flat.map((p, i) => supabase.from("pedidos").update({ orden_produccion: i + 1 } as never).eq("id", p.id)));
      await refetch();
    } catch { toast.error("No se pudo guardar el orden."); }
    setOrdenOverride({});
  }

  // Funciones normales (no hooks): van después del early-return de arriba, así
  // que no pueden ser useCallback. Referencian refs, no estado obsoleto, y se
  // registran/retiran con la misma identidad dentro de un mismo arrastre.
  function onPointerMove(e: PointerEvent) {
    if (!dragStart.current) return;
    e.preventDefault(); // evita el scroll de la página durante el arrastre táctil
    setDy(e.clientY - dragStart.current.y);
    let found: string | null = null;
    for (const [rid, el] of rowRefs.current) {
      const r = el.getBoundingClientRect();
      if (e.clientY >= r.top && e.clientY <= r.bottom) { found = rid; break; }
    }
    if (found && found !== overIdRef.current) { overIdRef.current = found; setOverId(found); }
  }

  async function finalizarDrag() {
    window.removeEventListener("pointermove", onPointerMove);
    const st = dragStart.current;
    const arrastrado = dragIdRef.current;
    const destino = overIdRef.current;
    dragStart.current = null; dragIdRef.current = null; overIdRef.current = null;
    setDragId(null); setOverId(null); setDy(0);
    if (!st || !arrastrado || !destino || arrastrado === destino) return;
    const from = st.flat.findIndex((x) => x.id === arrastrado);
    const to = st.flat.findIndex((x) => x.id === destino);
    if (from < 0 || to < 0) return;
    const arr = [...st.flat];
    const [m] = arr.splice(from, 1);
    arr.splice(to, 0, m);
    await guardarOrden(arr);
  }

  function onGripDown(id: string, e: React.PointerEvent) {
    if (!puedeOrdenar) return;
    e.preventDefault();
    const flat = agruparPorCliente(conOrden(activos)).flatMap((g) => g.items);
    dragStart.current = { y: e.clientY, flat };
    dragIdRef.current = id; overIdRef.current = id;
    setDragId(id); setOverId(id); setDy(0);
    window.addEventListener("pointermove", onPointerMove, { passive: false });
    window.addEventListener("pointerup", finalizarDrag, { once: true });
    window.addEventListener("pointercancel", finalizarDrag, { once: true });
  }

  const dnd: DnD | undefined = puedeOrdenar
    ? { dragId, overId, dy, registrar, onGripDown }
    : undefined;

  return (
    <Shell onSignOut={signOut} equipo={esEquipo} bannerNombre={esEquipo ? tapiceroNombre(tapiceroActual) : ""}>
      <div className="mx-auto max-w-2xl px-3 py-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 text-sm">
            <button onClick={() => setVerEntregados(false)} className={`rounded-md px-3 py-1.5 font-medium ${!verEntregados ? "bg-slate-900 text-white" : "text-slate-600"}`}>En curso ({activos.length})</button>
            <button onClick={() => setVerEntregados(true)} className={`rounded-md px-3 py-1.5 font-medium ${verEntregados ? "bg-slate-900 text-white" : "text-slate-600"}`}>Terminados ({entregados.length})</button>
          </div>
        </div>

        {/* Filtro rápido: estado de tela + retraso */}
        <div className="mb-3 flex flex-wrap items-center gap-1.5">
          {!verEntregados && ([
            ["todos", "Todos"],
            ["pendiente_tela", "Pendiente de tela"],
            ["en_curso", "Tela recibida"],
          ] as const).map(([v, lbl]) => (
            <button key={v} onClick={() => setFiltroEstado(v)}
              className={`rounded-full border px-3 py-1 text-xs font-medium ${filtroEstado === v ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-600"}`}>
              {lbl}
            </button>
          ))}
          <button onClick={() => setSoloRetrasados((v) => !v)}
            className={`rounded-full border px-3 py-1 text-xs font-medium ${soloRetrasados ? "border-rose-500 bg-rose-500 text-white" : "border-slate-200 bg-white text-slate-600"}`}>
            Solo retrasados
          </button>
        </div>

        {pedidos === null ? (
          <div className="py-16 text-center text-slate-400">Cargando…</div>
        ) : lista.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white py-16 text-center text-slate-400">
            {base.length === 0 ? (verEntregados ? "Nada terminado todavía." : "No tienes pedidos en curso. 🎉") : "Nada con este filtro."}
          </div>
        ) : (
          <div className="space-y-4">
            {puedeOrdenar && <p className="mb-2 px-1 text-xs text-slate-400">Arrastra ⠿ para ordenar la prioridad de trabajo.</p>}
            {agruparPorCliente(conOrden(lista)).map((g) => (
              <ClienteGrupo key={g.cliente} cliente={g.cliente} prioritario={g.prioritario} items={g.items} tapiceroSearch={esEquipo ? viendoId : undefined} dnd={dnd} />
            ))}
          </div>
        )}
      </div>
    </Shell>
  );
}

interface Grupo { cliente: string; items: PanelPedido[]; prioritario: boolean; minOrden: number; minPrioridad: number; masProximo: string; }

// Orden efectivo de un producto: el orden manual si lo tiene; si no, va al final
// (Infinity) y se ordena por prioridad y entrega.
const ordenDe = (p: PanelPedido) => p.ordenProduccion ?? Infinity;

// Agrupa por cliente. Ordena por: orden manual (1º, 2º…), luego prioridad alta,
// luego la entrega más próxima. Un cliente sube con su producto mejor situado
// (así el otro producto del mismo cliente "sube" con el prioritario).
function agruparPorCliente(lista: PanelPedido[]): Grupo[] {
  const map = new Map<string, Grupo>();
  for (const p of lista) {
    const k = p.cliente || "Sin cliente";
    const g = map.get(k) ?? { cliente: k, items: [], prioritario: false, minOrden: Infinity, minPrioridad: 3, masProximo: "9999" };
    g.items.push(p);
    if (p.prioridad === 1) g.prioritario = true;
    if (ordenDe(p) < g.minOrden) g.minOrden = ordenDe(p);
    if (p.prioridad < g.minPrioridad) g.minPrioridad = p.prioridad;
    if (p.fechaLimite && p.fechaLimite < g.masProximo) g.masProximo = p.fechaLimite;
    map.set(k, g);
  }
  const grupos = [...map.values()];
  for (const g of grupos) {
    g.items.sort((a, b) => (ordenDe(a) - ordenDe(b)) || (a.prioridad - b.prioridad) || (a.fechaLimite || "9999").localeCompare(b.fechaLimite || "9999"));
  }
  return grupos.sort((a, b) => (a.minOrden - b.minOrden) || (a.minPrioridad - b.minPrioridad) || a.masProximo.localeCompare(b.masProximo));
}

interface DnD {
  dragId: string | null;
  overId: string | null;
  dy: number;
  registrar: (id: string, el: HTMLElement | null) => void;
  onGripDown: (id: string, e: React.PointerEvent) => void;
}

function ClienteGrupo({ cliente, prioritario, items, tapiceroSearch, dnd }: { cliente: string; prioritario: boolean; items: PanelPedido[]; tapiceroSearch?: string; dnd?: DnD }) {
  return (
    <div className={`overflow-hidden rounded-2xl border bg-white shadow-sm ${prioritario ? "border-amber-300" : "border-slate-200"}`}>
      <div className={`flex items-center justify-between gap-2 border-b px-4 py-2.5 ${prioritario ? "border-amber-100 bg-amber-50" : "border-slate-100 bg-slate-50"}`}>
        <div className="flex items-center gap-2 font-bold text-slate-900">
          {prioritario && <Star className="h-4 w-4 fill-amber-400 text-amber-400" />}
          {cliente}
        </div>
        <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-slate-500">{items.length} producto{items.length === 1 ? "" : "s"}</span>
      </div>
      <div className="divide-y divide-slate-100">
        {items.map((p) => <ProductoRow key={p.id} p={p} tapiceroSearch={tapiceroSearch} dnd={dnd} />)}
      </div>
    </div>
  );
}

function ProductoRow({ p, tapiceroSearch, dnd }: { p: PanelPedido; tapiceroSearch?: string; dnd?: DnD }) {
  const c = diasColor(p.diasRestantes, p.entregado);
  const medidasNum = [p.ancho, p.alto, p.fondo].filter((d): d is number => d != null && d > 0).join(" × ");
  const det = modeloDetalle(p.tipo, p.modelo);
  const medidas = medidasNum ? medidasNum + " cm" : (det && esDetalleMedida(det) ? det : "Medidas sin poner");
  const frontal = p.telas.find((t) => t.rol.toLowerCase() === "frontal");
  const prio = prioridadChip(p.prioridad);
  const arrastrando = dnd?.dragId === p.id;
  const encima = !!dnd && dnd.overId === p.id && dnd.dragId != null && dnd.dragId !== p.id;
  return (
    <div
      ref={dnd ? (el) => dnd.registrar(p.id, el) : undefined}
      className={`flex items-center bg-white ${arrastrando ? "relative z-30 rounded-lg shadow-xl ring-2 ring-slate-900/10" : ""} ${encima ? "border-t-2 border-slate-900" : "border-t-2 border-transparent"}`}
      style={arrastrando ? { transform: `translateY(${dnd!.dy}px)`, opacity: 0.97, touchAction: "none" } : undefined}
    >
      {/* Tirador de arrastre (pointer events: ratón + táctil). Solo equipo. */}
      {dnd && (
        <span
          onPointerDown={(e) => dnd.onGripDown(p.id, e)}
          title="Arrastra para ordenar"
          style={{ touchAction: "none" }}
          className="flex cursor-grab items-center self-stretch pl-1.5 pr-0.5 text-slate-300 hover:text-slate-500 active:cursor-grabbing"
        >
          <GripVertical className="h-5 w-5" />
        </span>
      )}
      <Link to="/panel/$id" params={{ id: p.id }} search={tapiceroSearch ? { tapicero: tapiceroSearch } : {}} draggable={false}
        className="flex min-w-0 flex-1 items-center gap-2.5 px-2 py-3 active:bg-slate-50">
        {p.ordenProduccion != null && (
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-900 text-[11px] font-bold text-white">{p.ordenProduccion}</span>
        )}
        <div className="h-12 w-12 shrink-0 rounded-lg bg-slate-50 p-1.5"><SiluetaProducto tipo={p.tipo} modelo={p.modelo} className="h-full w-full" /></div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            {p.numero != null && <span className="shrink-0 rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-bold text-white">Nº {p.numero}</span>}
            {p.prioridad === 1 && <Star className="h-3.5 w-3.5 shrink-0 fill-amber-400 text-amber-400" />}
            <span className="truncate font-semibold text-slate-900">{displayNombreProducto(p.tipo, p.modelo)}</span>
          </div>
          <div className="text-xs text-slate-500">{medidas}</div>
          <div className="truncate text-xs text-slate-600">{frontal?.nombre || p.telaTexto || "Tela sin especificar"}</div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-bold leading-none ${c.bg} ${c.text}`}>{c.label}</span>
          {prio && <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-semibold leading-none ${prio.bg} ${prio.text}`}>{prio.label}</span>}
        </div>
        <ChevronRight className="h-5 w-5 shrink-0 text-slate-300" />
      </Link>
    </div>
  );
}

// Interfaz del panel (sin el CRM). Banner cuando lo ve el equipo.
function Shell({ children, onSignOut, equipo, bannerNombre }: {
  children: React.ReactNode; onSignOut: () => void; equipo?: boolean; bannerNombre?: string;
}) {
  return (
    <div className="min-h-screen bg-slate-50">
      {equipo && (
        <div className="flex items-center justify-between gap-2 bg-[#1a4b5b] px-4 py-2 text-xs font-medium text-white">
          <span className="inline-flex items-center gap-1.5"><Eye className="h-3.5 w-3.5" /> Vista de equipo{bannerNombre ? ` · panel de ${bannerNombre}` : ""}</span>
          <Link to="/" className="inline-flex items-center gap-1 rounded bg-white/15 px-2 py-0.5 hover:bg-white/25"><ArrowLeft className="h-3 w-3" /> Volver al CRM</Link>
        </div>
      )}
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
        <div className="flex items-center gap-2 font-bold text-[#1a1f36]"><Hammer className="h-5 w-5" /> Mi taller</div>
        {!equipo && (
          <button onClick={onSignOut} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50">
            <LogOut className="h-4 w-4" /> Salir
          </button>
        )}
      </header>
      {children}
    </div>
  );
}
