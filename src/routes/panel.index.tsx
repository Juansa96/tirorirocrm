import { numeroPedidoLabel } from "@/lib/types";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { LogOut, Hammer, ChevronRight, ChevronDown, ArrowLeft, Eye, GripVertical, Truck, Car, Package, MapPin } from "lucide-react";
import { formatWeekdayShort } from "@/lib/format";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { tapiceroNombre, ESTADOS_PEDIDO, ESTADOS_TAPICERO, ESTADO_ENTREGADO_CLIENTE, type EstadoPedido, type Tapicero, type ModoEntrega } from "@/lib/types";
import { Tachado } from "@/components/Tachado";
import { displayNombreProducto, medidasEtiquetadas, pufTieneAlmacenaje, PUF_ALMACENAJE_LABEL } from "@/lib/catalogo";
import { SiluetaProducto } from "@/components/SiluetaProducto";
import { usePanelPedidos, type PanelPedido } from "@/lib/panel-data";
import { claveCola, cmpClaveCola, ordenPorDia, type ClaveCola } from "@/lib/orden-taller";
import { toast } from "sonner";

interface Search { tapicero?: string; }

export const Route = createFileRoute("/panel/")({
  head: () => ({ meta: [{ title: "Mi taller — Tiroriro" }] }),
  validateSearch: (s: Record<string, unknown>): Search => ({ tapicero: s.tapicero ? String(s.tapicero) : undefined }),
  component: Panel,
});

const FIN = "__end__";

// Una pestaña por estado del pedido (el tapicero ve cuatro; el equipo, cinco).
type Vista = EstadoPedido;
const esVista = (v: unknown): v is Vista => (ESTADOS_PEDIDO as readonly string[]).includes(String(v));
const ETIQUETA_VISTA: Record<Vista, string> = {
  "Pendiente": "Pendientes", "En marcha": "En marcha", "Terminado": "Terminados", "Recogido": "Recogidos", "Entregado al cliente": "Entregados",
};
const VACIO_VISTA: Record<Vista, string> = {
  "Pendiente": "Nada pendiente. 🎉",
  "En marcha": "Nada en marcha ahora mismo.",
  "Terminado": "Nada terminado pendiente de recoger.",
  "Recogido": "Nada recogido todavía.",
  "Entregado al cliente": "Nada entregado al cliente todavía.",
};

// ── Memoria de la vista del panel ─────────────────────────────────────────
// Al abrir una ficha y volver (flecha ← o "atrás" del navegador) el panel se
// vuelve a montar y carga la lista de cero, así que la restauración de scroll
// del router llega antes de que existan las cards y la página acaba arriba del
// todo. Aquí se guarda en sessionStorage la pestaña, los filtros, el producto
// que se abrió y el scroll, para volver EXACTAMENTE a la card en la que se
// estaba (y resaltarla un instante). Se guarda por tapicero, para que el
// equipo no herede la vista de otro panel.
const MEM_KEY = "panel-taller";
interface MemoriaPanel {
  tapicero: string; vista: Vista; retrasados: boolean; expandidos: string[];
  entrega?: ModoEntrega;   // filtro "a dónde va": "" = todos, "juan" | "mrw"
  productoId?: string; scrollY?: number;
}
function leerMemoria(tapicero: string): MemoriaPanel | null {
  try {
    const raw = sessionStorage.getItem(MEM_KEY);
    const m = raw ? (JSON.parse(raw) as MemoriaPanel) : null;
    return m && m.tapicero === tapicero ? m : null;
  } catch { return null; }
}
function guardarMemoria(m: MemoriaPanel) {
  try { sessionStorage.setItem(MEM_KEY, JSON.stringify(m)); } catch { /* sin sessionStorage: se pierde la memoria, nada más */ }
}

// Días para que Juan RECOJA el producto: rojo si ya pasó, ámbar si queda poco,
// verde si sobra. Sin fecha de recogida → gris "Sin recogida" (no un número).
function diasColor(d: number, estado: EstadoPedido, tieneRecogida: boolean) {
  if (estado === "Recogido") return { bg: "bg-violet-100", text: "text-violet-700", label: "Recogido" };
  if (estado === ESTADO_ENTREGADO_CLIENTE) return { bg: "bg-emerald-100", text: "text-emerald-700", label: "Entregado" };
  if (!tieneRecogida) return { bg: "bg-slate-100", text: "text-slate-400", label: "Sin recogida" };
  if (d < 0) return { bg: "bg-rose-100", text: "text-rose-700", label: `${Math.abs(d)}d tarde` };
  if (d <= 3) return { bg: "bg-amber-100", text: "text-amber-700", label: d === 0 ? "Hoy" : `${d}d` };
  return { bg: "bg-emerald-100", text: "text-emerald-700", label: `${d}d` };
}

// Clave de ordenación de un producto (ver src/lib/orden-taller.ts): manda la
// fecha de recogida de Juan — y la de entrega si aún no hay recogida —, y el
// orden manual solo desempata dentro de ese mismo día.
const claveDe = (p: PanelPedido): ClaveCola => claveCola(p);
const clienteDe = (p: PanelPedido) => p.cliente || "Sin cliente";

// Lista plana ordenada MANTENIENDO JUNTOS todos los productos de un mismo
// cliente. Los clientes se ordenan por su producto más urgente (menor clave, o
// sea: el que antes hay que tener listo para la recogida); dentro de cada
// cliente, sus productos van por esa misma clave. Así un cliente nunca queda
// partido en la cola del taller.
function ordenarFlat(lista: PanelPedido[]): PanelPedido[] {
  const minPorCliente = new Map<string, ClaveCola>();
  for (const p of lista) {
    const c = clienteDe(p);
    const k = claveDe(p);
    const cur = minPorCliente.get(c);
    if (!cur || cmpClaveCola(k, cur) < 0) minPorCliente.set(c, k);
  }
  return [...lista].sort((a, b) => {
    const ca = clienteDe(a), cb = clienteDe(b);
    if (ca !== cb) return cmpClaveCola(minPorCliente.get(ca)!, minPorCliente.get(cb)!) || ca.localeCompare(cb);
    return cmpClaveCola(claveDe(a), claveDe(b));
  });
}

// Agrupa productos CONSECUTIVOS del mismo cliente en "tramos" (cada tramo = una
// card de cliente). Si un cliente tiene productos no consecutivos (porque se
// movió uno suelto), aparece en varias cards.
interface Tramo { cliente: string; repId: string; items: PanelPedido[]; }
function construirTramos(flat: PanelPedido[]): Tramo[] {
  const tramos: Tramo[] = [];
  for (const p of flat) {
    const ult = tramos[tramos.length - 1];
    if (ult && ult.cliente === (p.cliente || "Sin cliente")) ult.items.push(p);
    else tramos.push({ cliente: p.cliente || "Sin cliente", repId: p.id, items: [p] });
  }
  return tramos;
}

function Panel() {
  const { esTapicero, esEquipo, tapiceroId: miTapiceroId, signOut } = useAuth();
  const search = Route.useSearch();
  const navigate = useNavigate();

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
  const { pedidos, error: errorCarga, refetch } = usePanelPedidos(viendoId || null, esTapicero);
  const [vista, setVista] = useState<Vista>("Pendiente");
  const [soloRetrasados, setSoloRetrasados] = useState(false);
  // Filtro "a dónde va": solo lo que se lleva Juan a Madrid, o solo lo que sale
  // por MRW desde el taller. Así, el día que Juan va a Yecla, el taller y él
  // ven de un vistazo qué se carga en el coche y qué hay que mandar.
  const [filtroEntrega, setFiltroEntrega] = useState<ModoEntrega>("");
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set());

  // La pestaña activa se trae a la vista en la fila desplazable (móvil).
  const tabsRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const cont = tabsRef.current;
    const el = cont?.querySelector<HTMLElement>(`[data-vista="${vista}"]`);
    if (!cont || !el) return;
    const izq = el.offsetLeft - 12, der = el.offsetLeft + el.offsetWidth + 12;
    if (izq < cont.scrollLeft) cont.scrollTo({ left: Math.max(0, izq), behavior: "smooth" });
    else if (der > cont.scrollLeft + cont.clientWidth) cont.scrollTo({ left: der - cont.clientWidth, behavior: "smooth" });
  }, [vista]);

  // ── Volver a la misma card al regresar de una ficha ───────────────────────
  // 1) Al montar (o cuando se sabe qué panel es), se recupera la vista guardada.
  //    Se hace en un efecto, no en el estado inicial, para no discrepar con el
  //    HTML del servidor (sessionStorage solo existe en el navegador).
  const restauradoRef = useRef<string>("");       // tapicero cuya memoria ya se ha leído
  const pendienteRef = useRef<{ productoId?: string; scrollY?: number } | null>(null);
  const [resaltado, setResaltado] = useState<string | null>(null);
  useEffect(() => {
    if (!viendoId || restauradoRef.current === viendoId) return;
    restauradoRef.current = viendoId;
    const m = leerMemoria(viendoId);
    if (!m) return;
    if (esVista(m.vista)) setVista(m.vista);
    setSoloRetrasados(m.retrasados);
    setFiltroEntrega(m.entrega === "juan" || m.entrega === "mrw" ? m.entrega : "");
    setExpandidos(new Set(m.expandidos));
    if (m.productoId || m.scrollY != null) pendienteRef.current = { productoId: m.productoId, scrollY: m.scrollY };
  }, [viendoId]);
  // 2) Cada cambio de pestaña/filtro se recuerda (sin tocar el scroll pendiente).
  useEffect(() => {
    if (!viendoId || restauradoRef.current !== viendoId) return;
    const prev = leerMemoria(viendoId);
    guardarMemoria({
      tapicero: viendoId, vista, retrasados: soloRetrasados, entrega: filtroEntrega, expandidos: [...expandidos],
      productoId: prev?.productoId, scrollY: prev?.scrollY,
    });
  }, [viendoId, vista, soloRetrasados, filtroEntrega, expandidos]);
  // 3) Al pulsar un producto se apunta cuál y a qué altura estaba la página.
  const recordarProducto = (productoId: string) => {
    if (!viendoId) return;
    guardarMemoria({
      tapicero: viendoId, vista, retrasados: soloRetrasados, entrega: filtroEntrega, expandidos: [...expandidos],
      productoId, scrollY: window.scrollY,
    });
  };

  // ── Arrastre (pointer events: ratón + táctil) ──────────────────────────────
  const [ordenOverride, setOrdenOverride] = useState<Record<string, number>>({});
  const [dragKind, setDragKind] = useState<"run" | "product" | null>(null);
  const [dragKey, setDragKey] = useState<string | null>(null); // repId (run) o productId
  const [overId, setOverId] = useState<string | null>(null);
  const [dy, setDy] = useState(0);
  const dragKindRef = useRef<"run" | "product" | null>(null);
  const dragKeyRef = useRef<string | null>(null);
  const movedIdsRef = useRef<string[]>([]);
  const overIdRef = useRef<string | null>(null);
  const startYRef = useRef(0);
  const flatRef = useRef<PanelPedido[]>([]);
  const cardRefs = useRef<Map<string, HTMLElement>>(new Map());
  const rowRefs = useRef<Map<string, HTMLElement>>(new Map());

  // 4) Cuando la lista ya está pintada, se vuelve a la altura guardada; si la
  //    fila no queda a la vista (la cola cambió mientras tanto), se centra. La
  //    fila se resalta un momento para orientar al ojo. Si el producto ya no
  //    está en esta pestaña (p. ej. se marcó terminado), se deja el scroll donde
  //    estaba y ya.
  const listaPintada = pedidos !== null && !errorCarga;
  useLayoutEffect(() => {
    const pend = pendienteRef.current;
    if (!pend || !listaPintada) return;
    pendienteRef.current = null;
    if (pend.scrollY != null) window.scrollTo({ top: pend.scrollY, behavior: "instant" });
    const fila = pend.productoId
      ? document.querySelector<HTMLElement>(`[data-producto-id="${pend.productoId}"]`)
      : null;
    // El scroll pendiente ya se ha consumido: no se repite en una recarga.
    const m = leerMemoria(viendoId);
    if (m) guardarMemoria({ ...m, productoId: undefined, scrollY: undefined });
    if (!fila) return;
    const r = fila.getBoundingClientRect();
    if (r.top < 0 || r.bottom > window.innerHeight) fila.scrollIntoView({ block: "center", behavior: "instant" });
    setResaltado(fila.dataset.productoId ?? null);
    const t = setTimeout(() => setResaltado(null), 1600);
    return () => clearTimeout(t);
  }, [listaPintada, viendoId]);

  const tapiceroActual = tapiceros.find((t) => t.id === viendoId);

  if (esEquipo && !viendoId) {
    return (
      <Shell onSignOut={signOut} equipo>
        <div className="mx-auto max-w-md px-4 py-10">
          <h1 className="mb-4 text-lg font-bold text-slate-900">Ver panel de un tapicero</h1>
          <div className="space-y-2">
            {tapiceros.filter((t) => t.activo).map((t) => (
              <button key={t.id} onClick={() => navigate({ to: "/panel", search: { tapicero: t.id } })}
                className="flex min-h-[52px] w-full items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left text-[15px] hover:bg-slate-50 active:bg-slate-50">
                <span className="font-medium">{tapiceroNombre(t)}</span><ChevronRight className="h-4 w-4 text-slate-400" />
              </button>
            ))}
          </div>
        </div>
      </Shell>
    );
  }

  // Una sección por estado, sin mezclar: Pendientes / En marcha / Terminados /
  // Recogidos (y, solo para el equipo, Entregados al cliente). Los pedidos
  // entregados al cliente ya vienen filtrados para el tapicero (panel-data).
  const vistas: Vista[] = esEquipo ? [...ESTADOS_PEDIDO] : [...ESTADOS_TAPICERO];
  const porEstado = new Map<Vista, PanelPedido[]>(vistas.map((v) => [v, (pedidos ?? []).filter((p) => p.estado === v)]));
  const base = porEstado.get(vista) ?? [];
  const lista = base.filter((p) => !(soloRetrasados && p.diasRestantes >= 0) && (!filtroEntrega || p.entrega.modo === filtroEntrega));
  const enCurso = vista === "Pendiente" || vista === "En marcha";
  // Cuántos de esta pestaña se lleva Juan y cuántos salen por MRW (y cuántos
  // no tienen destino conocido: sin ciudad en la ficha del cliente).
  const nJuan = base.filter((p) => p.entrega.modo === "juan").length;
  const nMrw = base.filter((p) => p.entrega.modo === "mrw").length;
  const nSinDestino = base.length - nJuan - nMrw;

  // Solo el equipo reordena, y solo en Pendientes / En marcha sin filtros (secuencia global).
  const puedeOrdenar = esEquipo && enCurso && !soloRetrasados && !filtroEntrega;

  const conOrden = (arr: PanelPedido[]) =>
    Object.keys(ordenOverride).length === 0
      ? arr
      : arr.map((p) => (ordenOverride[p.id] != null ? { ...p, ordenProduccion: ordenOverride[p.id] } : p));

  const flat = ordenarFlat(conOrden(lista));
  flatRef.current = flat;
  const tramos = construirTramos(flat);
  // Posición (1º, 2º…) de cada producto en la cola de trabajo, según el orden
  // final ya calculado. Se muestra SIEMPRE, aunque no haya orden manual.
  const posiciones = new Map(flat.map((p, i) => [p.id, i + 1]));
  // Nº de productos por cliente en toda la lista (para avisar de repartos).
  const totalPorCliente = new Map<string, number>();
  for (const p of flat) totalPorCliente.set(p.cliente || "Sin cliente", (totalPorCliente.get(p.cliente || "Sin cliente") || 0) + 1);

  // Guarda el arrastre. El orden manual se numera POR DÍA de salida (recogida o,
  // si no la hay, entrega): así la cola sigue mandándola la fecha y el arrastre
  // decide el orden dentro de ese día. Si se suelta algo en un día que no es el
  // suyo, vuelve a su sitio y se avisa (la fecha manda).
  //
  // La pestaña solo enseña los pedidos de UN estado, pero el orden manual es
  // una sola cola compartida por Pendientes y En marcha (misma numeración por
  // día). Si se renumerase solo con los visibles, un "Pendiente" podría acabar
  // con la misma posición que un "En marcha" del mismo día y la cola se
  // embarullaría. Por eso se renumera sobre la cola en curso COMPLETA: los
  // pedidos de la otra pestaña conservan su hueco y los visibles se recolocan
  // en los huecos que ya ocupaban, en el nuevo orden.
  async function guardarOrden(nuevoFlat: PanelPedido[]) {
    const visibles = new Set(nuevoFlat.map((p) => p.id));
    const enCursoTodos = ordenarFlat((pedidos ?? []).filter((p) => p.estado === "Pendiente" || p.estado === "En marcha"));
    let i = 0;
    const colaCompleta = enCursoTodos.map((p) => (visibles.has(p.id) ? nuevoFlat[i++] ?? p : p));
    // Visibles que no estuvieran en la cola en curso (no debería pasar): al final.
    for (; i < nuevoFlat.length; i++) colaCompleta.push(nuevoFlat[i]);
    const nuevoOrden = ordenPorDia(colaCompleta);
    setOrdenOverride(Object.fromEntries(nuevoOrden));
    const conNuevoOrden = nuevoFlat.map((p) => ({ ...p, ordenProduccion: nuevoOrden.get(p.id) ?? null }));
    const resultado = ordenarFlat(conNuevoOrden);
    if (resultado.some((p, i) => p.id !== nuevoFlat[i]?.id)) {
      toast.info("La cola la manda la fecha de recogida: se ha colocado dentro de su día.");
    }
    try {
      // Solo se escriben los pedidos cuyo orden cambia realmente (también los
      // de la otra pestaña si su número dentro del día ha cambiado).
      const cambios = colaCompleta.filter((p) => (p.ordenProduccion ?? null) !== (nuevoOrden.get(p.id) ?? null));
      const res = await Promise.all(cambios.map((p) =>
        supabase.from("pedidos").update({ orden_produccion: nuevoOrden.get(p.id) ?? null } as never).eq("id", p.id)));
      // Supabase devuelve el fallo en `error`, no lo lanza: sin esto, un orden
      // que no se ha guardado parecería guardado hasta recargar.
      const fallo = res.find((r) => r.error)?.error;
      if (fallo) toast.error("No se pudo guardar el orden: " + fallo.message);
      await refetch();
    } catch { toast.error("No se pudo guardar el orden."); }
    setOrdenOverride({});
  }

  const registrarCard = (repId: string, el: HTMLElement | null) => { if (el) cardRefs.current.set(repId, el); else cardRefs.current.delete(repId); };
  const registrarRow = (pid: string, el: HTMLElement | null) => { if (el) rowRefs.current.set(pid, el); else rowRefs.current.delete(pid); };

  function onPointerMove(e: PointerEvent) {
    if (!dragKindRef.current) return;
    e.preventDefault();
    setDy(e.clientY - startYRef.current);
    // Objetivo: primero filas (más finas), luego cards; si va por debajo de todo → final.
    let found: string | null = null;
    for (const [pid, el] of rowRefs.current) {
      const r = el.getBoundingClientRect();
      if (e.clientY >= r.top && e.clientY <= r.bottom) { found = pid; break; }
    }
    if (!found) {
      for (const [rep, el] of cardRefs.current) {
        const r = el.getBoundingClientRect();
        if (e.clientY >= r.top && e.clientY <= r.bottom) { found = rep; break; }
      }
    }
    if (!found) found = FIN;
    if (found !== overIdRef.current) { overIdRef.current = found; setOverId(found); }
  }

  async function finalizarDrag() {
    window.removeEventListener("pointermove", onPointerMove);
    const moved = movedIdsRef.current;
    const destino = overIdRef.current;
    const flatActual = flatRef.current;
    dragKindRef.current = null; dragKeyRef.current = null; movedIdsRef.current = []; overIdRef.current = null;
    setDragKind(null); setDragKey(null); setOverId(null); setDy(0);
    if (!moved.length) return;
    const movedSet = new Set(moved);
    // Soltar sobre uno de los que se mueven → sin cambios.
    if (destino && destino !== FIN && movedSet.has(destino)) return;
    const rest = flatActual.filter((p) => !movedSet.has(p.id));
    let insertAt = rest.length;
    if (destino && destino !== FIN) {
      const idx = rest.findIndex((p) => p.id === destino);
      if (idx >= 0) insertAt = idx;
    }
    const movedRows = flatActual.filter((p) => movedSet.has(p.id));
    const result = [...rest.slice(0, insertAt), ...movedRows, ...rest.slice(insertAt)];
    await guardarOrden(result);
  }

  function iniciar(kind: "run" | "product", key: string, ids: string[], e: React.PointerEvent) {
    if (!puedeOrdenar) return;
    e.preventDefault();
    e.stopPropagation();
    dragKindRef.current = kind; dragKeyRef.current = key; movedIdsRef.current = ids;
    overIdRef.current = key; startYRef.current = e.clientY;
    setDragKind(kind); setDragKey(key); setOverId(key); setDy(0);
    window.addEventListener("pointermove", onPointerMove, { passive: false });
    window.addEventListener("pointerup", finalizarDrag, { once: true });
    window.addEventListener("pointercancel", finalizarDrag, { once: true });
  }

  const dnd: DnD | undefined = puedeOrdenar ? {
    dragKind, dragKey, overId, dy,
    registrarCard, registrarRow,
    onRunGrip: (repId, ids, e) => iniciar("run", repId, ids, e),
    onProductGrip: (pid, e) => iniciar("product", pid, [pid], e),
  } : undefined;

  const toggle = (cliente: string) => setExpandidos((prev) => {
    const next = new Set(prev);
    if (next.has(cliente)) next.delete(cliente); else next.add(cliente);
    return next;
  });

  return (
    <Shell onSignOut={signOut} equipo={esEquipo} bannerNombre={esEquipo ? tapiceroNombre(tapiceroActual) : ""}>
      <div className="mx-auto max-w-2xl px-3 py-4">
        {/* Pestañas de estado. En móvil no caben las cinco en el ancho de la
            pantalla (la de "Entregados" se salía): la fila se desplaza en
            horizontal, cada pestaña conserva su ancho y la activa se trae a la
            vista sola. En pantallas anchas se reparten el ancho como antes. */}
        <div ref={tabsRef} className="-mx-3 mb-3 overflow-x-auto px-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex w-max min-w-full gap-1 rounded-xl bg-slate-200/70 p-1 text-[13px] sm:text-sm" role="tablist">
            {vistas.map((v) => {
              const n = porEstado.get(v)?.length ?? 0;
              const activa = vista === v;
              return (
                <button key={v} data-vista={v} role="tab" aria-selected={activa} onClick={() => setVista(v)}
                  className={`inline-flex min-h-10 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-3 font-semibold transition-all sm:flex-1 ${activa ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}>
                  {ETIQUETA_VISTA[v]}
                  <span className={`rounded-full px-1.5 py-px text-[11px] font-bold tabular-nums ${activa ? "bg-slate-900 text-white" : "bg-slate-300/60 text-slate-600"}`}>{n}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Filtros: retrasados (solo en curso) y "a dónde va" (en todas las
            pestañas menos Entregados): lo que se lleva Juan a Madrid frente a lo
            que sale por MRW desde el taller. */}
        {(enCurso || vista !== ESTADO_ENTREGADO_CLIENTE) && (
          <div className="mb-3 flex flex-wrap items-center gap-1.5">
            {enCurso && (
              <button onClick={() => setSoloRetrasados((v) => !v)}
                className={`inline-flex h-10 items-center gap-2 rounded-full px-4 text-[13px] font-semibold transition-colors ${soloRetrasados ? "bg-rose-500 text-white" : "bg-white text-slate-700 ring-1 ring-slate-200"}`}>
                <span className={`h-2 w-2 rounded-full ${soloRetrasados ? "bg-white" : "bg-rose-500"}`} /> Solo retrasados
              </button>
            )}
            {vista !== ESTADO_ENTREGADO_CLIENTE && (
              <>
                <button onClick={() => setFiltroEntrega((v) => (v === "juan" ? "" : "juan"))} title="Productos que Juan se lleva en el coche a Madrid"
                  className={`inline-flex h-10 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-semibold transition-colors ${filtroEntrega === "juan" ? "bg-slate-900 text-white" : "bg-white text-slate-700 ring-1 ring-slate-200"}`}>
                  <Car className="h-4 w-4" /> Se lo lleva Juan
                  <span className={`rounded-full px-1.5 py-px text-[11px] font-bold tabular-nums ${filtroEntrega === "juan" ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"}`}>{nJuan}</span>
                </button>
                <button onClick={() => setFiltroEntrega((v) => (v === "mrw" ? "" : "mrw"))} title="Productos que salen por MRW desde el taller"
                  className={`inline-flex h-10 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-semibold transition-colors ${filtroEntrega === "mrw" ? "bg-sky-600 text-white" : "bg-white text-slate-700 ring-1 ring-slate-200"}`}>
                  <Package className="h-4 w-4" /> Envío MRW
                  <span className={`rounded-full px-1.5 py-px text-[11px] font-bold tabular-nums ${filtroEntrega === "mrw" ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"}`}>{nMrw}</span>
                </button>
                {nSinDestino > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-700" title="Sin ciudad en la ficha del cliente: el equipo tiene que indicar a dónde va">
                    <MapPin className="h-3 w-3" /> {nSinDestino} sin destino
                  </span>
                )}
              </>
            )}
          </div>
        )}

        {errorCarga ? (
          // Un panel vacío por un fallo de carga haría creer al taller que no
          // tiene trabajo: se dice claramente que ha fallado y se puede reintentar.
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-center">
            <p className="text-sm font-medium text-rose-700">No se han podido cargar tus pedidos.</p>
            <p className="mt-1 text-xs text-rose-600">{errorCarga}</p>
            <button onClick={() => void refetch()} className="mt-3 rounded-lg border border-rose-300 bg-white px-3 py-1.5 text-sm font-medium text-rose-700 hover:bg-rose-100">
              Reintentar
            </button>
          </div>
        ) : pedidos === null ? (
          <div className="py-16 text-center text-slate-400">Cargando…</div>
        ) : flat.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white py-16 text-center text-slate-400">
            {base.length === 0 ? VACIO_VISTA[vista] : "Nada con este filtro."}
          </div>
        ) : (
          <div className="space-y-3">
            {puedeOrdenar && <p className="mb-1 px-1 text-xs text-slate-400">Ordenado por fecha de recogida (o de entrega si aún no hay recogida). Arrastra ⠿ de la cabecera para mover el cliente dentro de su día; despliega para arrastrar un producto suelto.</p>}
            {/* Zona de "soltar al final" */}
            {tramos.map((t) => (
              <ClienteCard
                key={t.repId}
                tramo={t}
                posiciones={posiciones}
                totalCliente={totalPorCliente.get(t.cliente) ?? t.items.length}
                expandido={expandidos.has(t.cliente)}
                onToggle={() => toggle(t.cliente)}
                tapiceroSearch={esEquipo ? viendoId : undefined}
                dnd={dnd}
                resaltado={resaltado}
                onAbrir={recordarProducto}
              />
            ))}
            {/* Marcador de final (permite soltar al final de la cola) */}
            {dnd && dnd.dragKind && (
              <div
                ref={(el) => dnd.registrarCard(FIN, el)}
                className={`rounded-xl border-2 border-dashed py-3 text-center text-xs ${dnd.overId === FIN ? "border-slate-900 text-slate-700" : "border-slate-200 text-slate-400"}`}
              >
                Soltar aquí para poner al final
              </div>
            )}
          </div>
        )}
      </div>
    </Shell>
  );
}

interface DnD {
  dragKind: "run" | "product" | null;
  dragKey: string | null;
  overId: string | null;
  dy: number;
  registrarCard: (repId: string, el: HTMLElement | null) => void;
  registrarRow: (productId: string, el: HTMLElement | null) => void;
  onRunGrip: (repId: string, ids: string[], e: React.PointerEvent) => void;
  onProductGrip: (productId: string, e: React.PointerEvent) => void;
}

function ClienteCard({ tramo, posiciones, totalCliente, expandido, onToggle, tapiceroSearch, dnd, resaltado, onAbrir }: {
  tramo: Tramo; posiciones: Map<string, number>; totalCliente: number; expandido: boolean; onToggle: () => void;
  tapiceroSearch?: string; dnd?: DnD; resaltado: string | null; onAbrir: (productoId: string) => void;
}) {
  const otros = totalCliente - tramo.items.length; // productos de este cliente en otras posiciones
  const arrastrandoRun = dnd?.dragKind === "run" && dnd.dragKey === tramo.repId;
  const encima = !!dnd && dnd.overId === tramo.repId && dnd.dragKey !== tramo.repId;
  const ids = tramo.items.map((p) => p.id);
  return (
    <div
      ref={dnd ? (el) => dnd.registrarCard(tramo.repId, el) : undefined}
      className={`overflow-hidden rounded-2xl border bg-white shadow-sm ${arrastrandoRun ? "relative z-30 shadow-xl ring-2 ring-slate-900/10" : ""} ${encima ? "ring-2 ring-slate-900" : "border-slate-200"}`}
      style={arrastrandoRun ? { transform: `translateY(${dnd!.dy}px)`, opacity: 0.97, touchAction: "none" } : undefined}
    >
      <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50 px-2 py-2.5">
        {dnd && (
          <span
            onPointerDown={(e) => dnd.onRunGrip(tramo.repId, ids, e)}
            title="Arrastra para mover el cliente entero"
            style={{ touchAction: "none" }}
            className="flex cursor-grab items-center text-slate-300 hover:text-slate-500 active:cursor-grabbing"
          >
            <GripVertical className="h-5 w-5" />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className="break-words font-bold leading-tight text-slate-900 line-clamp-2">{tramo.cliente}</div>
          {otros > 0 && (
            <div className="text-[11px] font-medium leading-tight text-amber-600">
              {otros} producto{otros === 1 ? "" : "s"} de este cliente en otra posición
            </div>
          )}
        </div>
        <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-slate-500">
          {tramo.items.length}<span className="hidden sm:inline"> producto{tramo.items.length === 1 ? "" : "s"}</span>
        </span>
        {dnd && (
          <button onClick={onToggle} title={expandido ? "Contraer" : "Desplegar para mover un producto suelto"}
            className="shrink-0 rounded-md p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-600">
            {expandido ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
        )}
      </div>
      <div className="divide-y divide-slate-100">
        {tramo.items.map((p) => (
          <ProductoRow key={p.id} p={p} posicion={posiciones.get(p.id) ?? 0} tapiceroSearch={tapiceroSearch}
            dnd={dnd} arrastrarProducto={!!dnd && expandido} resaltado={resaltado === p.id} onAbrir={onAbrir} />
        ))}
      </div>
    </div>
  );
}

// Estados en los que aún tiene sentido enseñar la fecha de recogida.
const enCursoOTerminado = (e: EstadoPedido) => e === "Pendiente" || e === "En marcha" || e === "Terminado";

function ProductoRow({ p, posicion, tapiceroSearch, dnd, arrastrarProducto, resaltado, onAbrir }: {
  p: PanelPedido; posicion: number; tapiceroSearch?: string; dnd?: DnD; arrastrarProducto: boolean;
  resaltado: boolean; onAbrir: (productoId: string) => void;
}) {
  const c = diasColor(p.diasRestantes, p.estado, !!p.fechaRecogida);
  // Medidas con etiqueta por tipo ("Ancho 150 · Alto 130 cm"); si falta una
  // obligatoria se enseña un aviso ámbar en vez de un texto gris. Si se han
  // cambiado, el valor anterior sale tachado delante (p.antes). Un pedido ya
  // recogido o entregado no avisa de nada: ese trabajo ya está hecho.
  const med = medidasEtiquetadas(p.tipo, p.modelo, p.ancho, p.alto, p.fondo);
  const cerrado = p.estado === "Recogido" || p.estado === ESTADO_ENTREGADO_CLIENTE;
  const frontal = p.telas.find((t) => t.rol.toLowerCase() === "frontal");
  const arrastrandoEste = dnd?.dragKind === "product" && dnd.dragKey === p.id;
  const encima = !!dnd && dnd.overId === p.id && dnd.dragKey !== p.id;
  return (
    <div
      ref={arrastrarProducto && dnd ? (el) => dnd.registrarRow(p.id, el) : undefined}
      data-producto-id={p.id}
      className={`flex items-center transition-colors duration-1000 ${resaltado ? "bg-amber-50" : "bg-white"} ${arrastrandoEste ? "relative z-30 rounded-lg shadow-xl ring-2 ring-slate-900/10" : ""} ${encima ? "border-t-2 border-slate-900" : "border-t-2 border-transparent"}`}
      style={arrastrandoEste ? { transform: `translateY(${dnd!.dy}px)`, opacity: 0.97, touchAction: "none" } : undefined}
    >
      {arrastrarProducto && dnd && (
        <span
          onPointerDown={(e) => dnd.onProductGrip(p.id, e)}
          title="Arrastra este producto suelto"
          style={{ touchAction: "none" }}
          className="flex cursor-grab items-center self-stretch pl-1.5 pr-0.5 text-slate-300 hover:text-slate-500 active:cursor-grabbing"
        >
          <GripVertical className="h-4 w-4" />
        </span>
      )}
      <Link to="/panel/$id" params={{ id: p.id }} search={tapiceroSearch ? { tapicero: tapiceroSearch } : {}} draggable={false}
        onClick={() => onAbrir(p.id)}
        className="flex min-w-0 flex-1 items-center gap-2.5 px-2 py-3.5 active:bg-slate-50">
        {posicion > 0 && (
          <span className="w-5 shrink-0 text-center text-xs font-semibold tabular-nums text-slate-400">{posicion}</span>
        )}
        <div className="h-12 w-12 shrink-0 rounded-lg bg-slate-50 p-1.5"><SiluetaProducto tipo={p.tipo} modelo={p.modelo} className="h-full w-full" /></div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
            {p.numero != null && <span className="shrink-0 rounded bg-indigo-600 px-1.5 py-0.5 text-[10px] font-bold text-white">Nº {numeroPedidoLabel(p.numero, p.numeroSufijo)}</span>}
            <span className={`shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium ${p.cantidad > 1 ? "text-slate-700" : "text-slate-400"}`}>
              <Tachado antes={p.antes.cantidad ? `×${p.antes.cantidad}` : ""}>×{p.cantidad} {p.cantidad === 1 ? "ud" : "uds"}</Tachado>
            </span>
            {pufTieneAlmacenaje(p.modelo) && <span className="shrink-0 rounded bg-sky-100 px-1.5 py-0.5 text-[10px] font-bold text-sky-700">{PUF_ALMACENAJE_LABEL}</span>}
            {/* El equipo ha cambiado el croquis o la imagen de referencia con el
                pedido ya en el taller: se avisa en la lista para que no se trabaje
                con la versión vieja (el aviso se quita con "Visto" en la ficha). */}
            {!cerrado && p.antes.plantilla && <span className="shrink-0 rounded bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold text-white" title={`Croquis: ${p.antes.plantilla}`}>↻ Croquis nuevo</span>}
            {!cerrado && p.antes.referencia && <span className="shrink-0 rounded bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold text-white" title={`Imagen de referencia: ${p.antes.referencia}`}>↻ Imagen nueva</span>}
            <span className="w-full font-semibold leading-tight text-slate-900"><Tachado antes={p.antes.modelo}>{displayNombreProducto(p.tipo, p.modelo)}</Tachado></span>
          </div>
          <div className="mt-0.5 text-xs text-slate-500">
            {p.antes.medidas && <s className="mr-1 text-slate-400" title={`Antes: ${p.antes.medidas}`}>{p.antes.medidas}</s>}
            {cerrado
              ? (med.texto || "")
              : med.faltan.length > 0 || !med.texto
                ? <span className="inline-block rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-amber-700">{med.texto ? `FALTA ${med.faltan.join(" Y ").toUpperCase()}` : "FALTAN MEDIDAS"}</span>
                : med.texto}
            {!cerrado && med.texto && med.faltan.length > 0 && <span className="ml-1.5">{med.texto}</span>}
          </div>
          <div className="truncate text-xs text-slate-600"><Tachado antes={p.antes.tela_frontal}>{frontal?.nombre || p.telaTexto || "Tela sin especificar"}</Tachado></div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5">
            {p.fechaRecogida && enCursoOTerminado(p.estado) && (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500" title="Fecha en que Juan pasa a recoger el producto">
                <Truck className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                <Tachado antes={p.antes.fecha_recogida}>Recoge Juan {formatWeekdayShort(p.fechaRecogida)}</Tachado>
              </span>
            )}
            {p.estado !== ESTADO_ENTREGADO_CLIENTE && <EntregaChip modo={p.entrega.modo} destino={p.entrega.destino} />}
          </div>
        </div>
        <div className="flex shrink-0 items-center">
          <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-1.5 text-[13px] font-bold leading-none ${c.bg} ${c.text}`}>{c.label}</span>
        </div>
        <ChevronRight className="h-5 w-5 shrink-0 text-slate-300" />
      </Link>
    </div>
  );
}

// A dónde va el producto al salir del taller: en el coche de Juan (zona de
// Madrid) o por MRW al resto de España. Sin ciudad en la ficha → aviso ámbar.
function EntregaChip({ modo, destino }: { modo: ModoEntrega; destino: string }) {
  if (modo === "juan") {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-600" title="Juan se lo lleva en el coche y lo entrega en Madrid">
        <Car className="h-3.5 w-3.5 shrink-0 text-slate-400" /> Se lo lleva Juan{destino ? ` · ${destino}` : ""}
      </span>
    );
  }
  if (modo === "mrw") {
    return (
      <span className="inline-flex items-center gap-1 rounded bg-sky-50 px-1.5 py-0.5 text-[11px] font-semibold text-sky-700" title="Sale por MRW desde el taller: NO va en el coche de Juan">
        <Package className="h-3.5 w-3.5 shrink-0" /> Envío MRW{destino ? ` → ${destino}` : ""}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded bg-amber-50 px-1.5 py-0.5 text-[11px] font-semibold text-amber-700" title="Falta la ciudad en la ficha del cliente: el equipo tiene que indicar a dónde va">
      <MapPin className="h-3.5 w-3.5 shrink-0" /> Destino sin indicar
    </span>
  );
}

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
      <header className="bar-blur sticky top-0 z-10 flex h-[52px] items-center justify-between border-b border-slate-200/70 px-4 pt-[env(safe-area-inset-top)]">
        <div className="flex items-center gap-2 text-[17px] font-bold tracking-tight text-[#1a1f36]"><Hammer className="h-5 w-5" /> Mi taller</div>
        {!equipo && (
          <button onClick={onSignOut} className="inline-flex h-10 items-center gap-1.5 rounded-full px-3 text-sm font-medium text-slate-500 hover:bg-slate-100" aria-label="Salir">
            <LogOut className="h-4 w-4" /> Salir
          </button>
        )}
      </header>
      {children}
    </div>
  );
}
