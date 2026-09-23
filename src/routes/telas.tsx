import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Search, X, Check, ChevronRight, RotateCcw, Minus, Plus, ShoppingBag, Store, Home, Truck, Sparkles, Pencil,
} from "lucide-react";
import { useStore, actions } from "@/lib/store";
import {
  numeroPedidoLabel, normNombreTela, tapiceroNombre, esPantalla, telaInfoDe, conTelaInfo,
  type Pedido, type Producto, type Lead, type PedidoTela, type TelaInfoPedido,
} from "@/lib/types";
import { displayNombreProducto, medidasEtiquetadas, etiquetaTela } from "@/lib/catalogo";
import { formatShortDate, todayISO } from "@/lib/format";
import { toast } from "sonner";

// ── Sección Telas ───────────────────────────────────────────────────────────
// Una tarjeta por pedido con sus telas (foto, metros, doble ancho) y UN solo
// botón: el siguiente paso del camino de la tela.
//   Por pedir  →  Pedida (al comercio)  →  En Boadilla  →  En Yecla (tapicero)
// Los pasos son los hitos que ya existen en el pedido (`telaPedida`,
// `telaRecibida`, `enviarTelaDaniel`); las pantallas terminan en Boadilla.
// Metros y doble ancho se guardan en `pasos_tapicero` ("@tela:<rol>", ver
// telaInfoDe en types.ts). No hay columnas nuevas.

export const Route = createFileRoute("/telas")({
  head: () => ({ meta: [{ title: "Telas — TiroCRM" }] }),
  component: TelasPage,
});

type Etapa = "pedir" | "pedida" | "boadilla" | "yecla";
const ETAPAS: Etapa[] = ["pedir", "pedida", "boadilla", "yecla"];
const ETAPA: Record<Etapa, { tab: string; estado: string; dot: string; bar: string; text: string; soft: string; icon: typeof Store }> = {
  pedir:    { tab: "Por pedir",   estado: "Por pedir", dot: "bg-rose-500",    bar: "bg-rose-400",    text: "text-rose-700",    soft: "bg-rose-50",    icon: ShoppingBag },
  pedida:   { tab: "Pedida",      estado: "Pedida al comercio",    dot: "bg-amber-500",   bar: "bg-amber-400",   text: "text-amber-700",   soft: "bg-amber-50",   icon: Store },
  boadilla: { tab: "En Boadilla", estado: "En Boadilla",           dot: "bg-sky-500",     bar: "bg-sky-400",     text: "text-sky-700",     soft: "bg-sky-50",     icon: Home },
  yecla:    { tab: "En Yecla",    estado: "En Yecla",              dot: "bg-emerald-500", bar: "bg-emerald-400", text: "text-emerald-700", soft: "bg-emerald-50", icon: Truck },
};

interface TelaDePedido {
  id: string;            // id de pedido_telas ("" si la tela viene solo del producto)
  rol: string;           // Frontal / Lateral / Vivo / Principal…
  etiqueta: string;      // "Tela frontal", "Tela de ribete"…
  nombre: string;
  fotoUrl: string;
  info: TelaInfoPedido;  // metros + doble ancho
}

interface Item {
  pedido: Pedido;
  producto: Producto | undefined;
  lead: Lead | undefined;
  cliente: string;
  titulo: string;
  medidas: string;
  cantidad: number;
  pantalla: boolean;     // las pantallas no pasan por Yecla
  tapicero: string;
  telas: TelaDePedido[];
  etapa: Etapa;
  fechaEtapa: string;    // fecha del último paso dado (si la hay)
}

// "3,5" / "3.5" → 3.5 ; "" → 0
function metrosNum(s: string): number {
  const n = Number(String(s ?? "").trim().replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : 0;
}
function fmtMetros(n: number): string {
  return n.toLocaleString("es-ES", { maximumFractionDigits: 2 }) + " m";
}

// Etapas por las que pasa un pedido (las pantallas terminan en Boadilla).
function etapasDe(pantalla: boolean): Etapa[] {
  return pantalla ? ["pedir", "pedida", "boadilla"] : ETAPAS;
}

function TelasPage() {
  const { pedidos, productos, leads, pedidoTelas, tapiceros, telasBiblioteca, telasWeb } = useStore();
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<"todo" | Etapa>("todo");
  const [telaF, setTelaF] = useState("");           // filtro por tela (lista de la compra)
  const [verEntregados, setVerEntregados] = useState(false);
  const [editando, setEditando] = useState<{ item: Item; tela: TelaDePedido } | null>(null);

  // Foto de una tela por nombre (biblioteca subida > web).
  const fotoDe = useMemo(() => {
    const m = new Map<string, string>();
    for (const t of telasWeb) if (t.fotoUrl) m.set(normNombreTela(t.nombre), t.fotoUrl);
    for (const t of telasBiblioteca) if (t.fotoUrl) m.set(normNombreTela(t.nombre), t.fotoUrl);
    return (nombre: string) => m.get(normNombreTela(nombre)) ?? "";
  }, [telasWeb, telasBiblioteca]);

  const { items, entregados, sinTela } = useMemo(() => {
    const items: Item[] = [];
    let entregados = 0, sinTela = 0;
    const telasPorPedido = new Map<string, PedidoTela[]>();
    for (const t of pedidoTelas) {
      const arr = telasPorPedido.get(t.pedidoId) ?? [];
      arr.push(t); telasPorPedido.set(t.pedidoId, arr);
    }
    for (const p of pedidos) {
      const producto = productos.find((x) => x.id === p.productoLeadId);
      const lead = leads.find((l) => l.id === p.leadId);
      const cliente = lead?.nombre || p.clienteNombre || p.clienteNombreLibre || "Sin cliente";
      const pantalla = esPantalla(producto?.tipo ?? "");
      // Filas de tela del pedido, sin las "misma que la principal" (es la misma
      // tela). Si el pedido no tiene filas, se usa la tela escrita en el producto.
      const filas = (telasPorPedido.get(p.id) ?? [])
        .filter((t) => !t.mismaQueFrontal && t.nombreTela.trim())
        .sort((a, b) => a.orden - b.orden);
      const fuentes = filas.length > 0
        ? filas.map((t) => ({ id: t.id, rol: t.tipoTela || "Principal", nombre: t.nombreTela.trim(), foto: t.telaFotoUrl, recibida: t.estado === "Recibida" }))
        : producto?.tela?.trim()
          ? [{ id: "", rol: "Principal", nombre: producto.tela.trim(), foto: "", recibida: false }]
          : [];
      if (fuentes.length === 0) { if (!p.entregado) sinTela++; continue; }
      if (p.entregado) { entregados++; if (!verEntregados) continue; }
      const pedida = !!p.telaPedida;
      const llegada = !!p.telaRecibida || fuentes.some((t) => t.recibida);
      const enviada = !pantalla && !!p.enviarTelaDaniel;
      const etapa: Etapa = enviada ? "yecla" : llegada ? "boadilla" : pedida ? "pedida" : "pedir";
      const fechaEtapa = etapa === "yecla" ? p.enviarTelaDanielFecha : etapa === "boadilla" ? p.telaRecibidaFecha : etapa === "pedida" ? p.telaPedidaFecha : "";
      items.push({
        pedido: p, producto, lead, cliente,
        titulo: producto ? displayNombreProducto(producto.tipo, producto.modelo) : "Producto",
        medidas: producto ? medidasEtiquetadas(producto.tipo, producto.modelo, producto.ancho, producto.alto, producto.fondo).texto : "",
        cantidad: producto?.cantidad ?? 1,
        pantalla,
        tapicero: tapiceroNombre(tapiceros.find((t) => t.id === p.tapiceroId)),
        telas: fuentes.map((t) => ({
          id: t.id, rol: t.rol, etiqueta: etiquetaTela(producto?.tipo ?? "", t.rol), nombre: t.nombre,
          fotoUrl: t.foto || fotoDe(t.nombre), info: telaInfoDe(p.pasosTapicero, t.rol),
        })),
        etapa, fechaEtapa,
      });
    }
    // Lo más urgente primero: por fecha límite de entrega; luego el nº más alto.
    items.sort((a, b) => {
      const fa = a.pedido.fechaLimite || "9999", fb = b.pedido.fechaLimite || "9999";
      if (fa !== fb) return fa < fb ? -1 : 1;
      return (b.pedido.numero ?? -1) - (a.pedido.numero ?? -1);
    });
    return { items, entregados, sinTela };
  }, [pedidos, productos, leads, pedidoTelas, tapiceros, verEntregados, fotoDe]);

  // Búsqueda: nº de pedido, cliente, producto o nombre de tela.
  const buscados = useMemo(() => {
    const ql = normNombreTela(q);
    if (!ql) return items;
    return items.filter((it) => normNombreTela([
      it.pedido.numero != null ? `nº ${numeroPedidoLabel(it.pedido.numero, it.pedido.numeroSufijo)}` : "",
      it.cliente, it.titulo, it.medidas, ...it.telas.map((t) => t.nombre),
    ].join(" ")).includes(ql));
  }, [items, q]);

  // Contadores de las pestañas (responden a la búsqueda).
  const conteo = useMemo(() => {
    const c: Record<Etapa, number> = { pedir: 0, pedida: 0, boadilla: 0, yecla: 0 };
    for (const it of buscados) c[it.etapa]++;
    return c;
  }, [buscados]);

  // Lista de la compra: telas de los pedidos "por pedir", con metros sumados.
  const compra = useMemo(() => {
    const m = new Map<string, { key: string; nombre: string; fotoUrl: string; metros: number; pedidos: number; dobleAncho: boolean }>();
    for (const it of buscados) {
      if (it.etapa !== "pedir") continue;
      for (const t of it.telas) {
        const key = normNombreTela(t.nombre);
        const g = m.get(key) ?? { key, nombre: t.nombre, fotoUrl: "", metros: 0, pedidos: 0, dobleAncho: false };
        if (!g.fotoUrl && t.fotoUrl) g.fotoUrl = t.fotoUrl;
        g.metros += metrosNum(t.info.metros);
        g.pedidos++;
        if (t.info.dobleAncho) g.dobleAncho = true;
        m.set(key, g);
      }
    }
    return [...m.values()].sort((a, b) => b.metros - a.metros || a.nombre.localeCompare(b.nombre, "es"));
  }, [buscados]);

  // Si la tela filtrada deja de estar en la lista (p. ej. se ha pedido), se suelta el filtro.
  useEffect(() => {
    if (telaF && !compra.some((c) => c.key === telaF)) setTelaF("");
  }, [telaF, compra]);

  const visibles = useMemo(() => buscados.filter((it) => {
    if (tab !== "todo" && it.etapa !== tab) return false;
    if (telaF && tab === "pedir" && !it.telas.some((t) => normNombreTela(t.nombre) === telaF)) return false;
    return true;
  }), [buscados, tab, telaF]);

  const secciones = useMemo(() => (tab === "todo" ? ETAPAS : [tab])
    .map((e) => ({ etapa: e, items: visibles.filter((it) => it.etapa === e) }))
    .filter((s) => s.items.length > 0), [visibles, tab]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Telas</h1>
        <p className="mt-0.5 text-sm text-slate-500">Dónde está la tela de cada pedido y qué toca hacer ahora.</p>
      </div>

      {/* Búsqueda + pestañas por etapa: fijas arriba al hacer scroll. */}
      <div className="sticky top-14 z-20 -mx-4 space-y-2.5 bg-slate-50/95 px-4 pb-2 pt-1 backdrop-blur md:top-0 md:-mx-6 md:px-6 md:pt-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar pedido, cliente o tela"
            className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-10 text-[15px] text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-slate-400 focus:outline-none"
          />
          {q && (
            <button type="button" onClick={() => setQ("")} className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600" aria-label="Borrar búsqueda">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <div className="relative">
          <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-0.5 [scrollbar-width:none] md:mx-0 md:flex-wrap md:px-0 [&::-webkit-scrollbar]:hidden">
            <Tab activo={tab === "todo"} onClick={() => setTab("todo")} label="Todo" n={buscados.length} />
            {ETAPAS.map((e) => (
              <Tab key={e} activo={tab === e} onClick={() => setTab(e)} label={ETAPA[e].tab} n={conteo[e]} dot={ETAPA[e].dot} />
            ))}
          </div>
          {/* Pista en móvil de que hay más pestañas a la derecha. */}
          <span className="pointer-events-none absolute inset-y-0 -right-4 w-10 bg-gradient-to-l from-slate-50 to-transparent md:hidden" aria-hidden />
        </div>
      </div>

      {/* Lista de la compra: solo en "Por pedir". Pulsar una tela filtra los pedidos. */}
      {tab === "pedir" && compra.length > 0 && (
        <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h2 className="flex items-center gap-1.5 text-sm font-semibold text-slate-900"><ShoppingBag className="h-4 w-4 text-slate-400" /> Lista de la compra</h2>
            <span className="text-xs text-slate-400">{compra.length} tela{compra.length === 1 ? "" : "s"}{compra.some((c) => c.metros > 0) ? ` · ${fmtMetros(compra.reduce((s, c) => s + c.metros, 0))}` : ""}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {compra.map((c) => {
              const activo = telaF === c.key;
              return (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => setTelaF(activo ? "" : c.key)}
                  className={`flex items-center gap-2.5 rounded-xl border py-1.5 pl-1.5 pr-3 text-left transition-colors ${activo ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white hover:bg-slate-50"}`}
                >
                  <FotoTela url={c.fotoUrl} nombre={c.nombre} className="h-9 w-9 rounded-lg" />
                  <span className="min-w-0">
                    <span className="block max-w-[10rem] truncate text-sm font-semibold leading-tight">{c.nombre}</span>
                    <span className={`block text-xs ${activo ? "text-white/70" : "text-slate-500"}`}>
                      {c.metros > 0 ? fmtMetros(c.metros) : "Sin metros"}{c.dobleAncho ? " · doble ancho" : ""}{c.pedidos > 1 ? ` · ${c.pedidos} pedidos` : ""}
                    </span>
                  </span>
                  {activo && <X className="ml-1 h-3.5 w-3.5 shrink-0 text-white/70" />}
                </button>
              );
            })}
          </div>
        </section>
      )}

      {visibles.length === 0 ? (
        <Vacio tab={tab} hayItems={items.length > 0} buscando={!!q || !!telaF} />
      ) : (
        <div className="space-y-6">
          {secciones.map((s) => (
            <section key={s.etapa}>
              {tab === "todo" && (
                <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <span className={`h-2 w-2 rounded-full ${ETAPA[s.etapa].dot}`} />
                  {ETAPA[s.etapa].tab}
                  <span className="font-normal text-slate-400">{s.items.length}</span>
                </h2>
              )}
              <div className="grid grid-cols-1 items-start gap-3 md:grid-cols-2 xl:grid-cols-3">
                {s.items.map((it) => (
                  <PedidoCard key={it.pedido.id} item={it} onEditar={(tela) => setEditando({ item: it, tela })} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {(entregados > 0 || sinTela > 0) && (
        <div className="flex flex-col items-center gap-1 pt-2 text-center text-xs text-slate-400">
          {entregados > 0 && (
            <button type="button" onClick={() => setVerEntregados((v) => !v)} className="rounded-full px-3 py-1.5 font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-700">
              {verEntregados ? "Ocultar los pedidos entregados" : `Ver también ${entregados} pedido${entregados === 1 ? "" : "s"} entregado${entregados === 1 ? "" : "s"}`}
            </button>
          )}
          {sinTela > 0 && (
            <Link to="/pedidos" className="rounded-full px-3 py-1.5 hover:bg-slate-100 hover:text-slate-700">
              {sinTela} pedido{sinTela === 1 ? "" : "s"} en curso sin tela asignada · ir a Pedidos
            </Link>
          )}
        </div>
      )}

      {editando && (
        <EditarTelaSheet
          key={`${editando.item.pedido.id}:${editando.tela.rol}`}
          item={editando.item}
          tela={editando.tela}
          onClose={() => setEditando(null)}
        />
      )}
    </div>
  );
}

function Tab({ activo, onClick, label, n, dot }: { activo: boolean; onClick: () => void; label: string; n: number; dot?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition-colors ${
        activo ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-100"
      }`}
    >
      {dot && <span className={`h-2 w-2 rounded-full ${dot}`} />}
      {label}
      <span className={`rounded-full px-1.5 text-xs tabular-nums ${activo ? "bg-white/15 text-white/90" : "bg-slate-100 text-slate-500"}`}>{n}</span>
    </button>
  );
}

function Vacio({ tab, hayItems, buscando }: { tab: "todo" | Etapa; hayItems: boolean; buscando: boolean }) {
  let titulo = "Todavía no hay telas en pedidos en curso.";
  let texto = "En cuanto un pedido tenga tela asignada, aparecerá aquí.";
  if (buscando) { titulo = "Nada coincide con la búsqueda."; texto = "Prueba con otro nombre, cliente o nº de pedido."; }
  else if (hayItems && tab === "pedir") { titulo = "No queda ninguna tela por pedir."; texto = "Todo lo que hay en curso ya está pedido."; }
  else if (hayItems && tab === "pedida") { titulo = "No hay telas esperando al comercio."; texto = "Nada pendiente de llegar."; }
  else if (hayItems && tab === "boadilla") { titulo = "No hay telas en Boadilla."; texto = "Nada pendiente de enviar a Yecla."; }
  else if (hayItems && tab === "yecla") { titulo = "No hay telas en Yecla."; texto = "Aún no se ha enviado ninguna al tapicero."; }
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
      <Sparkles className="mx-auto mb-3 h-6 w-6 text-slate-300" />
      <div className="text-sm font-semibold text-slate-700">{titulo}</div>
      <div className="mt-1 text-xs text-slate-400">{texto}</div>
    </div>
  );
}

function FotoTela({ url, nombre, className }: { url: string; nombre: string; className: string }) {
  return url ? (
    <img src={url} alt={nombre} loading="lazy" className={`shrink-0 bg-slate-100 object-cover ${className}`} />
  ) : (
    <span className={`flex shrink-0 items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 text-sm font-bold uppercase text-slate-400 ${className}`} title="Sin foto">
      {(nombre || "?").trim().charAt(0)}
    </span>
  );
}

// ── Marcar / desmarcar un paso del camino de la tela ───────────────────────
// Marcar un paso posterior marca también los anteriores (sin fecha); desmarcar
// solo toca ese paso. Las filas de tela del pedido siguen al hito de Boadilla
// (igual que en la ruta de producción de la ficha del pedido).
async function marcarPaso(p: Pedido, filas: PedidoTela[], paso: Exclude<Etapa, "pedir">, valor: boolean) {
  const hoy = todayISO();
  const patch: Partial<Pedido> = {};
  if (paso === "pedida") {
    patch.telaPedida = valor; patch.telaPedidaFecha = valor ? (p.telaPedidaFecha || hoy) : "";
  } else if (paso === "boadilla") {
    patch.telaRecibida = valor; patch.telaRecibidaFecha = valor ? (p.telaRecibidaFecha || hoy) : "";
    if (valor && !p.telaPedida) patch.telaPedida = true;
  } else {
    patch.enviarTelaDaniel = valor; patch.enviarTelaDanielFecha = valor ? (p.enviarTelaDanielFecha || hoy) : "";
    if (valor && !p.telaPedida) patch.telaPedida = true;
    if (valor && !p.telaRecibida) patch.telaRecibida = true;
  }
  await actions.updatePedido(p.id, patch);
  const llegada = paso === "boadilla" ? valor : (paso === "yecla" && valor && !p.telaRecibida) ? true : null;
  if (llegada !== null) {
    for (const t of filas) {
      await actions.updatePedidoTela(t.id, llegada ? { estado: "Recibida", fechaRecibo: t.fechaRecibo || hoy } : { estado: "Pedida", fechaRecibo: "" });
    }
  }
}

// ── Tarjeta de un pedido: sus telas y el siguiente paso ────────────────────
function PedidoCard({ item: it, onEditar }: { item: Item; onEditar: (tela: TelaDePedido) => void }) {
  const { pedidoTelas } = useStore();
  const [busy, setBusy] = useState(false);
  const p = it.pedido;
  const etapas = etapasDe(it.pantalla);
  const idx = etapas.indexOf(it.etapa);
  const siguiente = etapas[idx + 1];
  const e = ETAPA[it.etapa];

  const estado = it.etapa === "yecla"
    ? (it.tapicero ? `Con ${it.tapicero} en Yecla` : "En Yecla, con el tapicero")
    : e.estado;
  const accion = siguiente === "pedida" ? "Ya la he pedido" : siguiente === "boadilla" ? "Ha llegado a Boadilla" : siguiente === "yecla" ? "Enviada a Yecla" : "";

  async function paso(etapa: Exclude<Etapa, "pedir">, valor: boolean) {
    setBusy(true);
    try { await marcarPaso(p, pedidoTelas.filter((t) => t.pedidoId === p.id), etapa, valor); }
    finally { setBusy(false); }
  }

  return (
    <article className={`flex flex-col overflow-hidden rounded-2xl border bg-white shadow-sm ${p.entregado ? "border-slate-200 opacity-80" : "border-slate-200"}`}>
      <Link to="/pedidos/$id" params={{ id: p.id }} className="group flex items-start gap-3 px-4 pt-4 pb-3 hover:bg-slate-50/70">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {p.numero != null && <span className="shrink-0 rounded-md bg-slate-900 px-1.5 py-0.5 text-[11px] font-bold tabular-nums text-white">Nº {numeroPedidoLabel(p.numero, p.numeroSufijo)}</span>}
            <span className="truncate text-[15px] font-semibold text-slate-900">{it.cliente}</span>
            {p.entregado && <span className="shrink-0 rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700">Entregado</span>}
          </div>
          <div className="mt-1 truncate text-sm text-slate-500">
            {it.titulo}{it.medidas ? ` · ${it.medidas}` : ""}{it.cantidad > 1 ? ` · ×${it.cantidad}` : ""}
          </div>
          {p.fechaLimite && <div className="mt-0.5 text-xs text-slate-400">Entrega {formatShortDate(p.fechaLimite)}</div>}
        </div>
        <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-slate-300 transition-colors group-hover:text-slate-500" />
      </Link>

      <ul className="divide-y divide-slate-100 border-t border-slate-100">
        {it.telas.map((t) => {
          const metros = metrosNum(t.info.metros);
          return (
            <li key={t.rol}>
              <button
                type="button"
                onClick={() => onEditar(t)}
                className="group flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-slate-50/70"
                title="Metros y doble ancho"
              >
                <FotoTela url={t.fotoUrl} nombre={t.nombre} className="h-12 w-12 rounded-xl" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-slate-900">{t.nombre}</span>
                  <span className="block truncate text-xs text-slate-500">{t.etiqueta}{t.info.dobleAncho ? " · doble ancho" : ""}</span>
                </span>
                <span className="flex shrink-0 items-center gap-1.5">
                  {metros > 0
                    ? <span className="text-sm font-semibold tabular-nums text-slate-900">{fmtMetros(metros)}</span>
                    : <span className="text-xs text-slate-400">Metros</span>}
                  <Pencil className="h-3.5 w-3.5 text-slate-300 transition-colors group-hover:text-slate-500" />
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <div className="mt-auto border-t border-slate-100 px-4 pb-4 pt-3">
        {/* Camino de la tela: un segmento por etapa, coloreados hasta la actual. */}
        <div className="flex gap-1" aria-hidden>
          {etapas.map((et, i) => <span key={et} className={`h-1.5 flex-1 rounded-full ${i <= idx ? e.bar : "bg-slate-100"}`} />)}
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
          <span className={`flex min-w-0 items-center gap-1.5 text-sm font-medium ${e.text}`}>
            <span className={`h-2 w-2 shrink-0 rounded-full ${e.dot}`} />
            <span className="truncate">{estado}</span>
            {it.fechaEtapa && <span className="shrink-0 text-xs font-normal text-slate-400">{formatShortDate(it.fechaEtapa)}</span>}
          </span>
          {idx > 0 && !p.entregado && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void paso(it.etapa as Exclude<Etapa, "pedir">, false)}
              className="flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-xs text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50"
              title="Volver al paso anterior"
            >
              <RotateCcw className="h-3 w-3" /> Deshacer
            </button>
          )}
        </div>
        {!siguiente && it.pantalla && !p.entregado && (
          <p className="mt-2 text-xs text-slate-400">La pantalla se hace en Boadilla: la tela no viaja a Yecla.</p>
        )}
        {siguiente && !p.entregado && (
          <button
            type="button"
            disabled={busy}
            onClick={() => void paso(siguiente as Exclude<Etapa, "pedir">, true)}
            className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#1a1f36] text-sm font-semibold text-white transition-colors hover:bg-[#2a3050] active:scale-[0.99] disabled:opacity-50"
          >
            <Check className="h-4 w-4" /> {accion}
          </button>
        )}
      </div>
    </article>
  );
}

// ── Hoja para editar metros y doble ancho de una tela del pedido ───────────
function EditarTelaSheet({ item, tela, onClose }: { item: Item; tela: TelaDePedido; onClose: () => void }) {
  const [metros, setMetros] = useState(tela.info.metros);
  const [dobleAncho, setDobleAncho] = useState(tela.info.dobleAncho);
  const [guardando, setGuardando] = useState(false);
  const p = item.pedido;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function ajustar(delta: number) {
    const n = Math.max(0, Math.round((metrosNum(metros) + delta) * 2) / 2);
    setMetros(n > 0 ? n.toLocaleString("es-ES", { maximumFractionDigits: 2 }) : "");
  }

  async function guardar() {
    const info: TelaInfoPedido = { metros: metros.trim(), dobleAncho };
    const actual = telaInfoDe(p.pasosTapicero, tela.rol);
    if (actual.metros !== info.metros || actual.dobleAncho !== info.dobleAncho) {
      setGuardando(true);
      try {
        await actions.updatePedido(p.id, { pasosTapicero: conTelaInfo(p.pasosTapicero, tela.rol, info) });
        toast.success("Tela actualizada.");
      } finally { setGuardando(false); }
    }
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:px-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Metros de ${tela.nombre}`}
        className="w-full rounded-t-3xl bg-white p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-2xl sm:max-w-sm sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3">
          <FotoTela url={tela.fotoUrl} nombre={tela.nombre} className="h-14 w-14 rounded-2xl" />
          <div className="min-w-0 flex-1">
            <div className="truncate text-base font-semibold text-slate-900">{tela.nombre}</div>
            <div className="truncate text-xs text-slate-500">{tela.etiqueta} · {p.numero != null ? `Nº ${numeroPedidoLabel(p.numero, p.numeroSufijo)} · ` : ""}{item.cliente}</div>
          </div>
          <button type="button" onClick={onClose} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600" aria-label="Cerrar">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-5">
          <div className="mb-1.5 text-xs font-medium text-slate-500">Metros que hacen falta</div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => ajustar(-0.5)} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50" aria-label="Medio metro menos"><Minus className="h-4 w-4" /></button>
            <div className="relative flex-1">
              <input
                autoFocus
                type="text"
                inputMode="decimal"
                value={metros}
                onChange={(e) => setMetros(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") void guardar(); }}
                placeholder="0"
                className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-3 pr-8 text-center text-lg font-semibold tabular-nums text-slate-900 focus:border-slate-400 focus:outline-none"
                aria-label="Metros de tela"
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">m</span>
            </div>
            <button type="button" onClick={() => ajustar(0.5)} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50" aria-label="Medio metro más"><Plus className="h-4 w-4" /></button>
          </div>
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={dobleAncho}
          onClick={() => setDobleAncho((v) => !v)}
          className="mt-4 flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-left hover:bg-slate-50"
        >
          <span>
            <span className="block text-sm font-medium text-slate-900">Doble ancho</span>
            <span className="block text-xs text-slate-500">La tela viene en 280 cm en vez de 140</span>
          </span>
          <span className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${dobleAncho ? "bg-emerald-500" : "bg-slate-200"}`}>
            <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${dobleAncho ? "translate-x-[22px]" : "translate-x-0.5"}`} />
          </span>
        </button>

        <div className="mt-5 flex gap-2">
          <button type="button" onClick={onClose} className="h-11 flex-1 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-600 hover:bg-slate-50">Cancelar</button>
          <button type="button" disabled={guardando} onClick={() => void guardar()} className="h-11 flex-1 rounded-xl bg-[#1a1f36] text-sm font-semibold text-white hover:bg-[#2a3050] disabled:opacity-50">
            {guardando ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}
