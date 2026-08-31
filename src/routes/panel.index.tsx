import { numeroPedidoLabel } from "@/lib/types";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { LogOut, Hammer, ChevronRight, ChevronDown, ArrowLeft, Eye, GripVertical, Truck } from "lucide-react";
import { formatWeekdayShort } from "@/lib/format";
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

const FIN = "__end__";

// Días para que Juan RECOJA el producto: rojo si ya pasó, ámbar si queda poco,
// verde si sobra. Sin fecha de recogida → gris "Sin recogida" (no un número).
function diasColor(d: number, entregado: boolean, tieneRecogida: boolean) {
  if (entregado) return { bg: "bg-slate-100", text: "text-slate-500", label: "Entregado" };
  if (!tieneRecogida) return { bg: "bg-slate-100", text: "text-slate-400", label: "Sin recogida" };
  if (d < 0) return { bg: "bg-rose-100", text: "text-rose-700", label: `${Math.abs(d)}d tarde` };
  if (d <= 3) return { bg: "bg-amber-100", text: "text-amber-700", label: d === 0 ? "Hoy" : `${d}d` };
  return { bg: "bg-emerald-100", text: "text-emerald-700", label: `${d}d` };
}

// Orden efectivo de un producto: el orden manual si lo tiene; si no, al final.
const ordenDe = (p: PanelPedido) => p.ordenProduccion ?? Infinity;

// Clave de ordenación de un producto: orden manual (1º, 2º…), luego fecha de
// recogida por Juan y, por último, fecha de entrega al cliente.
type Clave = [number, string, string];
const claveDe = (p: PanelPedido): Clave => [ordenDe(p), p.fechaRecogida || "9999", p.fechaLimite || "9999"];
function cmpClave(a: Clave, b: Clave): number {
  if (a[0] !== b[0]) return a[0] < b[0] ? -1 : 1;   // (evita Infinity - Infinity = NaN)
  return a[1].localeCompare(b[1]) || a[2].localeCompare(b[2]);
}
const clienteDe = (p: PanelPedido) => p.cliente || "Sin cliente";

// Lista plana ordenada MANTENIENDO JUNTOS todos los productos de un mismo
// cliente. Los clientes se ordenan por su producto más urgente (menor clave);
// dentro de cada cliente, sus productos van por esa misma clave. Así un cliente
// nunca queda partido en la cola del taller.
function ordenarFlat(lista: PanelPedido[]): PanelPedido[] {
  const minPorCliente = new Map<string, Clave>();
  for (const p of lista) {
    const c = clienteDe(p);
    const k = claveDe(p);
    const cur = minPorCliente.get(c);
    if (!cur || cmpClave(k, cur) < 0) minPorCliente.set(c, k);
  }
  return [...lista].sort((a, b) => {
    const ca = clienteDe(a), cb = clienteDe(b);
    if (ca !== cb) return cmpClave(minPorCliente.get(ca)!, minPorCliente.get(cb)!) || ca.localeCompare(cb);
    return cmpClave(claveDe(a), claveDe(b));
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
  const { pedidos, refetch } = usePanelPedidos(viendoId || null, esTapicero);
  const [vista, setVista] = useState<"en_curso" | "por_recoger" | "terminados">("en_curso");
  const enCurso = vista === "en_curso";
  const [filtroEstado, setFiltroEstado] = useState<"todos" | "pendiente_tela" | "en_curso">("todos");
  const [soloRetrasados, setSoloRetrasados] = useState(false);
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set());

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

  const tapiceroActual = tapiceros.find((t) => t.id === viendoId);

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

  // Tres estados de un producto en el taller:
  //  · En curso:    el tapicero aún lo está haciendo (ni terminado ni recogido).
  //  · Por recoger: el tapicero lo marcó terminado, pendiente de que Juan lo
  //                 recoja. Aquí Juan ve de un vistazo qué puede llevarse.
  //  · Terminados:  ya recogido/entregado.
  const activos = (pedidos ?? []).filter((p) => !p.terminado && !p.entregado);
  const porRecoger = (pedidos ?? []).filter((p) => p.terminado && !p.entregado);
  const terminados = (pedidos ?? []).filter((p) => p.entregado);
  const base = vista === "terminados" ? terminados : vista === "por_recoger" ? porRecoger : activos;
  const lista = base.filter((p) => {
    if (enCurso && filtroEstado === "pendiente_tela" && p.telaEstado === "recibida") return false;
    if (enCurso && filtroEstado === "en_curso" && p.telaEstado !== "recibida") return false;
    if (soloRetrasados && p.diasRestantes >= 0) return false;
    return true;
  });

  // Solo el equipo reordena, y solo en "En curso" sin filtros (secuencia global).
  const puedeOrdenar = esEquipo && enCurso && filtroEstado === "todos" && !soloRetrasados;

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

  async function guardarOrden(nuevoFlat: PanelPedido[]) {
    setOrdenOverride(Object.fromEntries(nuevoFlat.map((p, i) => [p.id, i + 1])));
    try {
      await Promise.all(nuevoFlat.map((p, i) => supabase.from("pedidos").update({ orden_produccion: i + 1 } as never).eq("id", p.id)));
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
        <div className="mb-3 flex rounded-lg border border-slate-200 bg-white p-0.5 text-xs sm:text-sm">
          {([
            ["en_curso", "En curso", activos.length],
            ["por_recoger", "Por recoger", porRecoger.length],
            ["terminados", "Terminados", terminados.length],
          ] as const).map(([v, lbl, n]) => (
            <button key={v} onClick={() => setVista(v)}
              className={`flex-1 whitespace-nowrap rounded-md px-2 py-1.5 text-center font-medium ${vista === v ? "bg-slate-900 text-white" : "text-slate-600"}`}>
              {lbl} ({n})
            </button>
          ))}
        </div>

        {enCurso && (
          <div className="mb-3 flex flex-wrap items-center gap-1.5">
            {([
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
        )}

        {pedidos === null ? (
          <div className="py-16 text-center text-slate-400">Cargando…</div>
        ) : flat.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white py-16 text-center text-slate-400">
            {base.length === 0
              ? (vista === "terminados" ? "Nada recogido todavía." : vista === "por_recoger" ? "Nada por recoger todavía." : "No tienes pedidos en curso. 🎉")
              : "Nada con este filtro."}
          </div>
        ) : (
          <div className="space-y-3">
            {puedeOrdenar && <p className="mb-1 px-1 text-xs text-slate-400">Arrastra ⠿ de la cabecera para mover el cliente entero. Despliega para arrastrar un producto suelto.</p>}
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

function ClienteCard({ tramo, posiciones, totalCliente, expandido, onToggle, tapiceroSearch, dnd }: {
  tramo: Tramo; posiciones: Map<string, number>; totalCliente: number; expandido: boolean; onToggle: () => void;
  tapiceroSearch?: string; dnd?: DnD;
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
            dnd={dnd} arrastrarProducto={!!dnd && expandido} />
        ))}
      </div>
    </div>
  );
}

function ProductoRow({ p, posicion, tapiceroSearch, dnd, arrastrarProducto }: {
  p: PanelPedido; posicion: number; tapiceroSearch?: string; dnd?: DnD; arrastrarProducto: boolean;
}) {
  const c = diasColor(p.diasRestantes, p.entregado, !!p.fechaRecogida);
  const medidasNum = [p.ancho, p.alto, p.fondo].filter((d): d is number => d != null && d > 0).join(" × ");
  const det = modeloDetalle(p.tipo, p.modelo);
  const medidas = medidasNum ? medidasNum + " cm" : (det && esDetalleMedida(det) ? det : "Medidas sin especificar");
  const frontal = p.telas.find((t) => t.rol.toLowerCase() === "frontal");
  const arrastrandoEste = dnd?.dragKind === "product" && dnd.dragKey === p.id;
  const encima = !!dnd && dnd.overId === p.id && dnd.dragKey !== p.id;
  return (
    <div
      ref={arrastrarProducto && dnd ? (el) => dnd.registrarRow(p.id, el) : undefined}
      className={`flex items-center bg-white ${arrastrandoEste ? "relative z-30 rounded-lg shadow-xl ring-2 ring-slate-900/10" : ""} ${encima ? "border-t-2 border-slate-900" : "border-t-2 border-transparent"}`}
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
        className="flex min-w-0 flex-1 items-center gap-2.5 px-2 py-3 active:bg-slate-50">
        {posicion > 0 && (
          <span className="w-5 shrink-0 text-center text-xs font-semibold tabular-nums text-slate-400">{posicion}</span>
        )}
        <div className="h-12 w-12 shrink-0 rounded-lg bg-slate-50 p-1.5"><SiluetaProducto tipo={p.tipo} modelo={p.modelo} className="h-full w-full" /></div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
            {p.numero != null && <span className="shrink-0 rounded bg-indigo-600 px-1.5 py-0.5 text-[10px] font-bold text-white">Nº {numeroPedidoLabel(p.numero, p.numeroSufijo)}</span>}
            <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold ${p.cantidad > 1 ? "bg-amber-500 text-white" : "bg-slate-100 text-slate-500"}`}>×{p.cantidad} {p.cantidad === 1 ? "ud" : "uds"}</span>
            <span className="w-full font-semibold leading-tight text-slate-900">{displayNombreProducto(p.tipo, p.modelo)}</span>
          </div>
          <div className="mt-0.5 text-xs text-slate-500">{medidas}</div>
          <div className="truncate text-xs text-slate-600">{frontal?.nombre || p.telaTexto || "Tela sin especificar"}</div>
          {p.fechaRecogida && !p.entregado && (
            <div className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-slate-500" title="Fecha en que Juan pasa a recoger el producto">
              <Truck className="h-3.5 w-3.5 shrink-0 text-slate-400" />
              Recoge Juan {formatWeekdayShort(p.fechaRecogida)}
            </div>
          )}
        </div>
        <div className="flex shrink-0 items-center">
          <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-bold leading-none ${c.bg} ${c.text}`}>{c.label}</span>
        </div>
        <ChevronRight className="h-5 w-5 shrink-0 text-slate-300" />
      </Link>
    </div>
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
