import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { LogOut, Hammer, ChevronRight, ArrowLeft, Eye, Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { tapiceroNombre, type Tapicero } from "@/lib/types";
import { displayNombreProducto, modeloDetalle, esDetalleMedida } from "@/lib/catalogo";
import { SiluetaProducto } from "@/components/SiluetaProducto";
import { usePanelPedidos, type PanelPedido } from "@/lib/panel-data";

interface Search { tapicero?: string; }

export const Route = createFileRoute("/panel")({
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
      })));
    });
  }, [esEquipo]);

  const viendoId = esTapicero ? miTapiceroId : (search.tapicero ?? "");
  const { pedidos } = usePanelPedidos(viendoId || null);
  const [verEntregados, setVerEntregados] = useState(false);
  // Filtro rápido: por estado de tela y por retraso.
  const [filtroEstado, setFiltroEstado] = useState<"todos" | "pendiente_tela" | "en_curso">("todos");
  const [soloRetrasados, setSoloRetrasados] = useState(false);

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
            {agruparPorCliente(lista).map((g) => (
              <ClienteGrupo key={g.cliente} cliente={g.cliente} prioritario={g.prioritario} items={g.items} tapiceroSearch={esEquipo ? viendoId : undefined} />
            ))}
          </div>
        )}
      </div>
    </Shell>
  );
}

interface Grupo { cliente: string; items: PanelPedido[]; prioritario: boolean; minPrioridad: number; masProximo: string; }

// Agrupa por cliente. Ordena: primero prioridad alta, y dentro de cada nivel,
// por la entrega más próxima (mayor retraso primero).
function agruparPorCliente(lista: PanelPedido[]): Grupo[] {
  const map = new Map<string, Grupo>();
  for (const p of lista) {
    const k = p.cliente || "Sin cliente";
    const g = map.get(k) ?? { cliente: k, items: [], prioritario: false, minPrioridad: 3, masProximo: "9999" };
    g.items.push(p);
    if (p.prioridad === 1) g.prioritario = true;
    if (p.prioridad < g.minPrioridad) g.minPrioridad = p.prioridad;
    if (p.fechaLimite && p.fechaLimite < g.masProximo) g.masProximo = p.fechaLimite;
    map.set(k, g);
  }
  const grupos = [...map.values()];
  for (const g of grupos) {
    // Dentro del cliente: prioridad alta primero, luego lo que antes vence.
    g.items.sort((a, b) => (a.prioridad - b.prioridad) || (a.fechaLimite || "9999").localeCompare(b.fechaLimite || "9999"));
  }
  return grupos.sort((a, b) => (a.minPrioridad - b.minPrioridad) || a.masProximo.localeCompare(b.masProximo));
}

function ClienteGrupo({ cliente, prioritario, items, tapiceroSearch }: { cliente: string; prioritario: boolean; items: PanelPedido[]; tapiceroSearch?: string }) {
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
        {items.map((p) => <ProductoRow key={p.id} p={p} tapiceroSearch={tapiceroSearch} />)}
      </div>
    </div>
  );
}

function ProductoRow({ p, tapiceroSearch }: { p: PanelPedido; tapiceroSearch?: string }) {
  const c = diasColor(p.diasRestantes, p.entregado);
  const medidasNum = [p.ancho, p.alto, p.fondo].filter((d): d is number => d != null && d > 0).join(" × ");
  const det = modeloDetalle(p.tipo, p.modelo);
  // Línea de medidas: las columnas numéricas si existen; si no, un detalle de
  // modelo que sea una medida (p. ej. almohadón "45×45" sin columnas); si no,
  // "Medida personalizada".
  const medidas = medidasNum ? medidasNum + " cm" : (det && esDetalleMedida(det) ? det : "Medida personalizada");
  const frontal = p.telas.find((t) => t.rol.toLowerCase() === "frontal");
  const prio = prioridadChip(p.prioridad);
  return (
    <Link to="/panel/$id" params={{ id: p.id }} search={tapiceroSearch ? { tapicero: tapiceroSearch } : {}}
      className="flex items-center gap-3 px-3 py-3 active:bg-slate-50">
      <div className="h-12 w-12 shrink-0 rounded-lg bg-slate-50 p-1.5"><SiluetaProducto tipo={p.tipo} modelo={p.modelo} className="h-full w-full" /></div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
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
