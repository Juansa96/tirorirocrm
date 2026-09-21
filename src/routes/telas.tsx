import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Search, X, ImageOff, Check, Store, Home, Truck, PackageOpen, Scissors, Eye, EyeOff } from "lucide-react";
import { useStore, actions } from "@/lib/store";
import {
  numeroPedidoLabel, normNombreTela, tapiceroNombre, esPantalla, telaInfoDe, conTelaInfo,
  type Pedido, type Producto, type Lead, type PedidoTela, type TelaInfoPedido,
} from "@/lib/types";
import { displayNombreProducto, medidasEtiquetadas } from "@/lib/catalogo";
import { SiluetaProducto } from "@/components/SiluetaProducto";
import { formatShortDate, todayISO } from "@/lib/format";
import { toast } from "sonner";

// ── Sección Telas ───────────────────────────────────────────────────────────
// Vista informativa de las telas en uso: qué tela lleva cada pedido (con foto),
// para qué cliente y producto, cuántos metros hacen falta y si es de doble
// ancho, y en qué punto del camino está:
//   1. Pedida al comercio      ⇐ hito `telaPedida` del pedido
//   2. Ha llegado a Boadilla   ⇐ hito `telaRecibida` (o la fila de tela "Recibida")
//   3. Enviada a Yecla         ⇐ hito `enviarTelaDaniel` (no aplica a pantallas)
// De ahí se deduce QUIÉN la tiene ahora. No hay columnas nuevas: metros y doble
// ancho van en `pasos_tapicero` ("@tela:<rol>", ver telaInfoDe en types.ts).

export const Route = createFileRoute("/telas")({
  head: () => ({ meta: [{ title: "Telas — TiroCRM" }] }),
  component: TelasPage,
});

type Lugar = "sin-pedir" | "comercio" | "boadilla" | "yecla";
const LUGARES: Lugar[] = ["sin-pedir", "comercio", "boadilla", "yecla"];
const LUGAR: Record<Lugar, { label: string; quien: string; bg: string; text: string; ring: string; icon: typeof Store }> = {
  "sin-pedir": { label: "Sin pedir", quien: "Nadie todavía", bg: "bg-rose-50", text: "text-rose-700", ring: "ring-rose-300", icon: PackageOpen },
  "comercio": { label: "Pedida al comercio", quien: "El comercio (en camino)", bg: "bg-amber-50", text: "text-amber-700", ring: "ring-amber-300", icon: Store },
  "boadilla": { label: "En Boadilla", quien: "Boadilla", bg: "bg-sky-50", text: "text-sky-700", ring: "ring-sky-300", icon: Home },
  "yecla": { label: "Enviada a Yecla", quien: "Yecla (tapicero)", bg: "bg-emerald-50", text: "text-emerald-700", ring: "ring-emerald-300", icon: Truck },
};

type Paso = "pedida" | "boadilla" | "yecla";

interface Fila {
  key: string;
  pedido: Pedido;
  producto: Producto | undefined;
  lead: Lead | undefined;
  cliente: string;
  telaId: string;          // id de pedido_telas ("" si la tela viene solo del producto)
  rol: string;             // Frontal / Lateral / Vivo / Principal…
  nombre: string;
  fotoUrl: string;
  coleccion: string;
  info: TelaInfoPedido;    // metros + doble ancho
  pantalla: boolean;       // las pantallas no pasan por Yecla
  pedida: boolean; pedidaFecha: string;
  boadilla: boolean; boadillaFecha: string;
  yecla: boolean; yeclaFecha: string;
  lugar: Lugar;
  quien: string;
}

interface Grupo {
  key: string;
  nombre: string;
  fotoUrl: string;
  coleccion: string;
  filas: Fila[];
  metros: number;
  dobleAncho: boolean;
}

// "3,5" / "3.5" → 3.5 ; "" → 0
function metrosNum(s: string): number {
  const n = Number(String(s ?? "").trim().replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : 0;
}
function fmtMetros(n: number): string {
  return n.toLocaleString("es-ES", { maximumFractionDigits: 2 }) + " m";
}
function coleccionLabel(c: string): string {
  const k = (c || "").toLowerCase();
  if (k === "basica" || k === "básica" || k === "basic") return "Básica";
  if (k === "premium") return "Premium";
  return c || "";
}

function TelasPage() {
  const { pedidos, productos, leads, pedidoTelas, tapiceros, telasBiblioteca, telasWeb } = useStore();
  const [q, setQ] = useState("");
  const [lugarF, setLugarF] = useState<"todos" | Lugar>("todos");
  const [verEntregados, setVerEntregados] = useState(false);
  const [modo, setModo] = useState<"tela" | "pedido">("tela");

  // Foto y colección de una tela por nombre (biblioteca subida > web).
  const fotoDe = useMemo(() => {
    const m = new Map<string, { fotoUrl: string; coleccion: string }>();
    for (const t of telasWeb) m.set(normNombreTela(t.nombre), { fotoUrl: t.fotoUrl, coleccion: t.coleccion });
    for (const t of telasBiblioteca) {
      const k = normNombreTela(t.nombre);
      const prev = m.get(k);
      m.set(k, { fotoUrl: t.fotoUrl || prev?.fotoUrl || "", coleccion: t.coleccion || prev?.coleccion || "" });
    }
    return (nombre: string) => m.get(normNombreTela(nombre)) ?? { fotoUrl: "", coleccion: "" };
  }, [telasWeb, telasBiblioteca]);

  const filasTodas = useMemo<Fila[]>(() => {
    const out: Fila[] = [];
    const telasPorPedido = new Map<string, PedidoTela[]>();
    for (const t of pedidoTelas) {
      const arr = telasPorPedido.get(t.pedidoId) ?? [];
      arr.push(t); telasPorPedido.set(t.pedidoId, arr);
    }
    for (const p of pedidos) {
      if (!verEntregados && p.entregado) continue;
      const producto = productos.find((x) => x.id === p.productoLeadId);
      const lead = leads.find((l) => l.id === p.leadId);
      const cliente = lead?.nombre || p.clienteNombre || p.clienteNombreLibre || "Sin cliente";
      const pantalla = esPantalla(producto?.tipo ?? "");
      const tapicero = tapiceroNombre(tapiceros.find((t) => t.id === p.tapiceroId));
      // Filas de tela del pedido (sin las que son "misma que la principal": es
      // la misma tela y ya cuenta en la principal). Si el pedido no tiene
      // filas, se usa la tela escrita en el producto para no perderla de vista.
      const filas = (telasPorPedido.get(p.id) ?? [])
        .filter((t) => !t.mismaQueFrontal && t.nombreTela.trim())
        .sort((a, b) => a.orden - b.orden);
      const fuentes = filas.length > 0
        ? filas.map((t) => ({ id: t.id, rol: t.tipoTela || "Principal", nombre: t.nombreTela.trim(), foto: t.telaFotoUrl, coleccion: t.telaColeccion, recibida: t.estado === "Recibida", fechaRecibo: t.fechaRecibo }))
        : producto?.tela?.trim()
          ? [{ id: "", rol: "Principal", nombre: producto.tela.trim(), foto: "", coleccion: producto.coleccionTela, recibida: false, fechaRecibo: "" }]
          : [];
      for (const t of fuentes) {
        const ref = fotoDe(t.nombre);
        const pedida = !!p.telaPedida;
        const boadilla = !!p.telaRecibida || t.recibida;
        const yecla = !pantalla && !!p.enviarTelaDaniel;
        const lugar: Lugar = yecla ? "yecla" : boadilla ? "boadilla" : pedida ? "comercio" : "sin-pedir";
        const quien = lugar === "yecla" && tapicero ? `${tapicero} (Yecla)` : LUGAR[lugar].quien;
        out.push({
          key: `${p.id}:${t.id || t.rol}`,
          pedido: p, producto, lead, cliente,
          telaId: t.id, rol: t.rol, nombre: t.nombre,
          fotoUrl: t.foto || ref.fotoUrl, coleccion: t.coleccion || ref.coleccion,
          info: telaInfoDe(p.pasosTapicero, t.rol),
          pantalla,
          pedida, pedidaFecha: p.telaPedidaFecha,
          boadilla, boadillaFecha: p.telaRecibidaFecha || t.fechaRecibo,
          yecla, yeclaFecha: p.enviarTelaDanielFecha,
          lugar, quien,
        });
      }
    }
    return out;
  }, [pedidos, productos, leads, pedidoTelas, tapiceros, verEntregados, fotoDe]);

  const conteo = useMemo(() => {
    const c: Record<Lugar, number> = { "sin-pedir": 0, comercio: 0, boadilla: 0, yecla: 0 };
    for (const f of filasTodas) c[f.lugar]++;
    return c;
  }, [filasTodas]);

  const filas = useMemo(() => {
    const ql = normNombreTela(q);
    return filasTodas.filter((f) => {
      if (lugarF !== "todos" && f.lugar !== lugarF) return false;
      if (!ql) return true;
      const txt = normNombreTela([
        f.nombre, f.cliente, f.producto ? displayNombreProducto(f.producto.tipo, f.producto.modelo) : "",
        f.pedido.numero != null ? `nº ${numeroPedidoLabel(f.pedido.numero, f.pedido.numeroSufijo)}` : "", f.coleccion, f.rol,
      ].join(" "));
      return txt.includes(ql);
    });
  }, [filasTodas, lugarF, q]);

  const grupos = useMemo<Grupo[]>(() => {
    const m = new Map<string, Grupo>();
    for (const f of filas) {
      const key = normNombreTela(f.nombre);
      const g = m.get(key) ?? { key, nombre: f.nombre, fotoUrl: "", coleccion: "", filas: [], metros: 0, dobleAncho: false };
      if (!g.fotoUrl && f.fotoUrl) g.fotoUrl = f.fotoUrl;
      if (!g.coleccion && f.coleccion) g.coleccion = f.coleccion;
      g.filas.push(f);
      g.metros += metrosNum(f.info.metros);
      if (f.info.dobleAncho) g.dobleAncho = true;
      m.set(key, g);
    }
    return [...m.values()].sort((a, b) => b.filas.length - a.filas.length || a.nombre.localeCompare(b.nombre, "es"));
  }, [filas]);

  const filasPorPedido = useMemo(() => [...filas].sort((a, b) => {
    const na = a.pedido.numero ?? -1, nb = b.pedido.numero ?? -1;
    if (na !== nb) return nb - na;
    return a.cliente.localeCompare(b.cliente, "es") || a.rol.localeCompare(b.rol, "es");
  }), [filas]);

  const metrosTotal = useMemo(() => filas.reduce((s, f) => s + metrosNum(f.info.metros), 0), [filas]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-slate-900"><Scissors className="h-5 w-5 text-[#1a4b5b]" /> Telas</h1>
          <p className="mt-0.5 text-sm text-slate-500">Qué tela lleva cada pedido, cuántos metros hacen falta y dónde está ahora mismo.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setVerEntregados((v) => !v)}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium ${verEntregados ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}
          >
            {verEntregados ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
            {verEntregados ? "Con entregados" : "Solo en curso"}
          </button>
        </div>
      </div>

      {/* Resumen por lugar: cada tarjeta filtra al pulsarla. */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {LUGARES.map((l) => {
          const c = LUGAR[l];
          const Icon = c.icon;
          const activo = lugarF === l;
          return (
            <button
              key={l}
              type="button"
              onClick={() => setLugarF(activo ? "todos" : l)}
              className={`flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 text-left shadow-sm transition-colors hover:bg-slate-50 ${activo ? `ring-2 ${c.ring}` : ""}`}
            >
              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${c.bg} ${c.text}`}><Icon className="h-4 w-4" /></span>
              <span className="min-w-0">
                <span className="block text-lg font-bold leading-tight text-slate-900 tabular-nums">{conteo[l]}</span>
                <span className="block truncate text-[11px] font-medium text-slate-500">{c.label}</span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar tela, cliente, producto o nº de pedido…"
            className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-9 text-sm focus:border-slate-400 focus:outline-none"
          />
          {q && (
            <button type="button" onClick={() => setQ("")} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-600" aria-label="Borrar búsqueda">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <div className="flex rounded-lg border border-slate-200 bg-white p-0.5 text-xs">
          {([["tela", "Por tela"], ["pedido", "Por pedido"]] as const).map(([m, label]) => (
            <button key={m} type="button" onClick={() => setModo(m)}
              className={`flex-1 rounded-md px-3 py-1.5 font-medium sm:flex-none ${modo === m ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-50"}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
        <span><strong className="text-slate-700">{grupos.length}</strong> tela{grupos.length === 1 ? "" : "s"}</span>
        <span>·</span>
        <span><strong className="text-slate-700">{filas.length}</strong> tela{filas.length === 1 ? "" : "s"} de pedido</span>
        {metrosTotal > 0 && (<><span>·</span><span><strong className="text-slate-700">{fmtMetros(metrosTotal)}</strong> apuntados</span></>)}
        {lugarF !== "todos" && (
          <button type="button" onClick={() => setLugarF("todos")} className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-0.5 font-medium text-slate-600 hover:bg-slate-50">
            {LUGAR[lugarF].label} <X className="h-3 w-3" />
          </button>
        )}
      </div>

      {filas.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white py-14 text-center text-sm text-slate-400">
          {filasTodas.length === 0
            ? "Todavía no hay telas en pedidos en curso. Las telas se ven aquí en cuanto un pedido tiene tela asignada."
            : "Nada coincide con el filtro."}
        </div>
      ) : modo === "tela" ? (
        <div className="space-y-3">
          {grupos.map((g) => <GrupoTelaCard key={g.key} grupo={g} />)}
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="divide-y divide-slate-100">
            {filasPorPedido.map((f) => <FilaTela key={f.key} fila={f} mostrarTela />)}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Tarjeta de una tela con todos los pedidos que la llevan ────────────────
function GrupoTelaCard({ grupo }: { grupo: Grupo }) {
  const [abierto, setAbierto] = useState(true);
  const lugares = new Set(grupo.filas.map((f) => f.lugar));
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <button type="button" onClick={() => setAbierto((v) => !v)} className="flex w-full items-center gap-3 border-b border-slate-100 bg-slate-50 p-3 text-left">
        <FotoTela url={grupo.fotoUrl} nombre={grupo.nombre} className="h-14 w-14 rounded-xl" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-base font-bold leading-tight text-slate-900">{grupo.nombre}</div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500">
            {grupo.coleccion && <span>{coleccionLabel(grupo.coleccion)}</span>}
            <span>{grupo.filas.length} pedido{grupo.filas.length === 1 ? "" : "s"}</span>
            {grupo.metros > 0 && <span className="font-semibold text-slate-700">{fmtMetros(grupo.metros)}</span>}
            {grupo.dobleAncho && <span className="rounded bg-violet-100 px-1.5 py-0.5 text-[10px] font-bold text-violet-700">Doble ancho</span>}
          </div>
          <div className="mt-1.5 flex flex-wrap gap-1">
            {LUGARES.filter((l) => lugares.has(l)).map((l) => (
              <span key={l} className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${LUGAR[l].bg} ${LUGAR[l].text}`}>
                {LUGAR[l].label} · {grupo.filas.filter((f) => f.lugar === l).length}
              </span>
            ))}
          </div>
        </div>
        <span className="shrink-0 text-xs text-slate-400">{abierto ? "Ocultar" : "Ver"}</span>
      </button>
      {abierto && (
        <div className="divide-y divide-slate-100">
          {grupo.filas.map((f) => <FilaTela key={f.key} fila={f} />)}
        </div>
      )}
    </div>
  );
}

function FotoTela({ url, nombre, className }: { url: string; nombre: string; className: string }) {
  return url ? (
    <img src={url} alt={nombre} loading="lazy" className={`shrink-0 border border-slate-200 object-cover ${className}`} />
  ) : (
    <span className={`flex shrink-0 items-center justify-center border border-dashed border-slate-200 bg-slate-50 text-slate-300 ${className}`} title="Sin foto">
      <ImageOff className="h-5 w-5" />
    </span>
  );
}

// ── Una tela de un pedido: cliente, producto, metros, doble ancho y camino ──
function FilaTela({ fila: f, mostrarTela = false }: { fila: Fila; mostrarTela?: boolean }) {
  const { pedidoTelas } = useStore();
  const [busy, setBusy] = useState(false);
  const p = f.pedido;
  const titulo = f.producto ? displayNombreProducto(f.producto.tipo, f.producto.modelo) : "Producto";
  const med = f.producto ? medidasEtiquetadas(f.producto.tipo, f.producto.modelo, f.producto.ancho, f.producto.alto, f.producto.fondo).texto : "";
  const cantidad = f.producto?.cantidad ?? 1;
  const c = LUGAR[f.lugar];
  const LugarIcon = c.icon;

  // Marca / desmarca un paso del camino de la tela. Marcar un paso posterior
  // marca también los anteriores (sin fecha); desmarcar solo toca ese paso.
  async function marcar(paso: Paso, valor: boolean) {
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
    setBusy(true);
    try {
      await actions.updatePedido(p.id, patch);
      // Las filas de tela del pedido siguen al hito de Boadilla (igual que en la
      // ruta de producción de la ficha del pedido).
      const llegada = paso === "boadilla" ? valor : (paso === "yecla" && valor && !p.telaRecibida) ? true : null;
      if (llegada !== null) {
        for (const t of pedidoTelas.filter((t) => t.pedidoId === p.id)) {
          await actions.updatePedidoTela(t.id, llegada ? { estado: "Recibida", fechaRecibo: t.fechaRecibo || hoy } : { estado: "Pedida", fechaRecibo: "" });
        }
      }
    } finally { setBusy(false); }
  }

  async function guardarInfo(info: TelaInfoPedido) {
    const actual = telaInfoDe(p.pasosTapicero, f.rol);
    if (actual.metros === info.metros && actual.dobleAncho === info.dobleAncho) return;
    await actions.updatePedido(p.id, { pasosTapicero: conTelaInfo(p.pasosTapicero, f.rol, info) });
    toast.success("Tela actualizada.");
  }

  const pasos: Array<{ paso: Paso; label: string; hecho: boolean; fecha: string; icon: typeof Store }> = [
    { paso: "pedida", label: "Pedida al comercio", hecho: f.pedida, fecha: f.pedidaFecha, icon: Store },
    { paso: "boadilla", label: "En Boadilla", hecho: f.boadilla, fecha: f.boadillaFecha, icon: Home },
    ...(f.pantalla ? [] : [{ paso: "yecla" as Paso, label: "Enviada a Yecla", hecho: f.yecla, fecha: f.yeclaFecha, icon: Truck }]),
  ];

  return (
    <div className="flex gap-3 p-3">
      {mostrarTela
        ? <FotoTela url={f.fotoUrl} nombre={f.nombre} className="h-12 w-12 rounded-lg" />
        : <div className="h-12 w-12 shrink-0 rounded-lg bg-slate-50 p-1.5"><SiluetaProducto tipo={f.producto?.tipo ?? ""} modelo={f.producto?.modelo ?? ""} className="h-full w-full" /></div>}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {p.numero != null && (
            <Link to="/pedidos/$id" params={{ id: p.id }} className="shrink-0 rounded bg-indigo-600 px-1.5 py-0.5 text-[10px] font-bold text-white hover:bg-indigo-700">
              Nº {numeroPedidoLabel(p.numero, p.numeroSufijo)}
            </Link>
          )}
          {f.lead ? (
            <Link to="/clientes/$id" params={{ id: f.lead.id }} className="min-w-0 truncate font-semibold text-slate-900 hover:underline">{f.cliente}</Link>
          ) : (
            <span className="min-w-0 truncate font-semibold text-slate-900">{f.cliente}</span>
          )}
          {p.entregado && <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700">Entregado</span>}
        </div>
        <div className="mt-0.5 text-xs text-slate-600">
          {mostrarTela && <span className="font-semibold text-slate-800">{f.nombre} · </span>}
          {titulo}{med ? ` · ${med}` : ""}{cantidad > 1 ? ` · ×${cantidad}` : ""}
          <span className="ml-1.5 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">{f.rol}</span>
        </div>

        <div className="mt-2 flex flex-wrap gap-1.5">
          {pasos.map((s) => {
            const Icon = s.icon;
            return (
              <button
                key={s.paso}
                type="button"
                disabled={busy}
                onClick={() => void marcar(s.paso, !s.hecho)}
                title={s.hecho ? `Desmarcar «${s.label}»` : `Marcar «${s.label}»`}
                className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-medium disabled:opacity-50 ${
                  s.hecho ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-dashed border-slate-300 bg-white text-slate-400 hover:border-slate-400 hover:text-slate-600"
                }`}
              >
                {s.hecho ? <Check className="h-3 w-3" /> : <Icon className="h-3 w-3" />}
                {s.label}{s.hecho && s.fecha ? ` · ${formatShortDate(s.fecha)}` : ""}
              </button>
            );
          })}
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${c.bg} ${c.text}`}>
            <LugarIcon className="h-3 w-3" /> La tiene: {f.quien}
          </span>
          <MetrosEditor key={`${f.key}:${f.info.metros}:${f.info.dobleAncho}`} info={f.info} onSave={(i) => void guardarInfo(i)} />
        </div>
      </div>
    </div>
  );
}

// Metros y doble ancho: se guardan al salir del campo (o con Intro) y al
// pulsar el botón de doble ancho.
function MetrosEditor({ info, onSave }: { info: TelaInfoPedido; onSave: (i: TelaInfoPedido) => void }) {
  const [metros, setMetros] = useState(info.metros);
  const guardarMetros = () => { if (metros.trim() !== info.metros) onSave({ metros: metros.trim(), dobleAncho: info.dobleAncho }); };
  return (
    <span className="inline-flex items-center gap-1.5">
      <label className="inline-flex items-center gap-1 text-[11px] text-slate-500">
        <input
          type="text"
          inputMode="decimal"
          value={metros}
          onChange={(e) => setMetros(e.target.value)}
          onBlur={guardarMetros}
          onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
          placeholder="—"
          className="w-14 rounded border border-slate-200 bg-white px-1.5 py-0.5 text-right text-xs tabular-nums focus:border-slate-400 focus:outline-none"
          aria-label="Metros de tela"
        />
        m
      </label>
      <button
        type="button"
        onClick={() => onSave({ metros: metros.trim(), dobleAncho: !info.dobleAncho })}
        className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${info.dobleAncho ? "border-violet-300 bg-violet-100 text-violet-700" : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"}`}
        title="Marcar si la tela es de doble ancho"
      >
        {info.dobleAncho ? "✓ Doble ancho" : "Doble ancho"}
      </button>
    </span>
  );
}
