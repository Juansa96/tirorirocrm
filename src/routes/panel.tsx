import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { LogOut, Hammer, ChevronRight, ArrowLeft, Eye } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { tapiceroNombre, type Tapicero } from "@/lib/types";
import { tipoLabelOf, displayModelo } from "@/lib/catalogo";
import { formatShortDate } from "@/lib/format";
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
      })));
    });
  }, [esEquipo]);

  const viendoId = esTapicero ? miTapiceroId : (search.tapicero ?? "");
  const { pedidos } = usePanelPedidos(viendoId || null);
  const [verEntregados, setVerEntregados] = useState(false);

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
  const lista = verEntregados ? entregados : activos;

  return (
    <Shell onSignOut={signOut} equipo={esEquipo} bannerNombre={esEquipo ? tapiceroNombre(tapiceroActual) : ""}>
      <div className="mx-auto max-w-2xl px-3 py-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 text-sm">
            <button onClick={() => setVerEntregados(false)} className={`rounded-md px-3 py-1.5 font-medium ${!verEntregados ? "bg-slate-900 text-white" : "text-slate-600"}`}>En curso ({activos.length})</button>
            <button onClick={() => setVerEntregados(true)} className={`rounded-md px-3 py-1.5 font-medium ${verEntregados ? "bg-slate-900 text-white" : "text-slate-600"}`}>Terminados ({entregados.length})</button>
          </div>
        </div>

        {pedidos === null ? (
          <div className="py-16 text-center text-slate-400">Cargando…</div>
        ) : lista.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white py-16 text-center text-slate-400">
            {verEntregados ? "Nada terminado todavía." : "No tienes pedidos en curso. 🎉"}
          </div>
        ) : (
          <div className="space-y-3">
            {lista.map((p) => <TarjetaPedido key={p.id} p={p} tapiceroSearch={esEquipo ? viendoId : undefined} />)}
          </div>
        )}
      </div>
    </Shell>
  );
}

function TarjetaPedido({ p, tapiceroSearch }: { p: PanelPedido; tapiceroSearch?: string }) {
  const c = diasColor(p.diasRestantes, p.entregado);
  const medidas = [p.ancho, p.alto, p.fondo].filter((d): d is number => d != null && d > 0).join(" × ");
  const telaEstadoLbl = p.telaEstado === "recibida" ? "Tela recibida" : p.telaEstado === "enviada" ? "Tela enviada" : "Tela pendiente";
  const telaEstadoCls = p.telaEstado === "recibida" ? "bg-emerald-100 text-emerald-700" : p.telaEstado === "enviada" ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-500";
  return (
    <Link to="/panel/$id" params={{ id: p.id }} search={tapiceroSearch ? { tapicero: tapiceroSearch } : {}}
      className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm active:bg-slate-50">
      <div className="h-20 w-20 shrink-0 rounded-xl bg-slate-50 p-2">
        <SiluetaProducto tipo={p.tipo} modelo={p.modelo} className="h-full w-full" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-base font-bold text-slate-900">{tipoLabelOf(p.tipo)} {displayModelo(p.modelo)}</div>
        {medidas && <div className="text-sm text-slate-600">{medidas} cm</div>}
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${c.bg} ${c.text}`}>{c.label}</span>
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${telaEstadoCls}`}>{telaEstadoLbl}</span>
          {p.fechaLimite && <span className="text-[11px] text-slate-400">entrega {formatShortDate(p.fechaLimite)}</span>}
        </div>
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
