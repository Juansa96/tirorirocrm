import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard, Columns3, List, LogOut, Search, X, BarChart2, Package, Users, WifiOff, RefreshCw, Scissors, MessageCircle,
  Ellipsis, CircleUserRound, ChevronRight,
} from "lucide-react";
import { useState, useEffect, useRef, type ComponentType } from "react";
import { useAuth } from "@/lib/auth";
import { useStore, actions } from "@/lib/store";
import { useWhatsapp, pendientesDe } from "@/lib/whatsapp/store";
import { vendorName } from "@/lib/types";
import { StageBadge } from "@/components/StageBadge";
import { BottomSheet, SheetGroup, SheetRow } from "@/components/BottomSheet";
import { TiroritoLogo } from "./TiroritoLogo";

interface NavItem {
  to: string;
  label: string;
  icon: ComponentType<{ className?: string; strokeWidth?: number }>;
  exact?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────
// Navegación.
//  · Móvil: barra inferior de 5 pestañas (como las apps de iOS): Inicio,
//    Pipeline, Mensajes, Pedidos y "Más" (hoja con el resto de secciones,
//    el perfil y cerrar sesión). Ocho pestañas no cabían y las etiquetas se
//    cortaban ("Dashbo…").
//  · iPad vertical (768–1023 px): carril con icono + etiqueta.
//  · iPad horizontal y escritorio (≥1024 px): barra lateral completa.
// ─────────────────────────────────────────────────────────────────────────
const NAV: NavItem[] = [
  { to: "/", label: "Inicio", icon: LayoutDashboard, exact: true },
  { to: "/pipeline", label: "Pipeline", icon: Columns3 },
  // Mensajes: WhatsApp, Instagram y email enlazados a clientes y propuestas
  // de la IA por revisar (la ruta sigue siendo /whatsapp para no romper enlaces).
  { to: "/whatsapp", label: "Mensajes", icon: MessageCircle },
  { to: "/pedidos", label: "Pedidos", icon: Package },
  { to: "/clientes", label: "Clientes", icon: List },
  // Telas: qué tela lleva cada pedido, dónde está y cuántos metros.
  { to: "/telas", label: "Telas", icon: Scissors },
  { to: "/datos", label: "Datos", icon: BarChart2 },
  // Usuarios también en móvil: es la única vía para entrar al panel del
  // tapicero desde el teléfono.
  { to: "/usuarios", label: "Usuarios", icon: Users },
];

// Las cuatro primeras van en la barra inferior del móvil; el resto, en "Más".
const NAV_TAB = NAV.slice(0, 4);
const NAV_MAS = NAV.slice(4);

function isActive(path: string, item: NavItem) {
  if (item.exact) return path === item.to;
  return path === item.to || path.startsWith(item.to + "/");
}

function useOnline() {
  const [online, setOnline] = useState(() => typeof navigator === "undefined" ? true : navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);
  return online;
}

function RealtimeDot({ effective }: { effective: "connected" | "connecting" | "disconnected" }) {
  const label = effective === "connected" ? "Sincronizado" : effective === "connecting" ? "Conectando…" : "Sin conexión";
  const color = effective === "connected" ? "bg-emerald-400" : effective === "connecting" ? "bg-amber-400 animate-pulse" : "bg-red-500";
  return (
    <div className="flex items-center gap-1.5" title={label}>
      <span className={`h-2 w-2 rounded-full ${color}`} />
      <span className="hidden text-xs text-white/40 lg:inline">{label}</span>
    </div>
  );
}

function OfflineBanner({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="sticky top-0 z-40 flex items-center justify-center gap-3 bg-rose-600 px-3 py-2 text-xs font-medium text-white shadow">
      <WifiOff className="h-4 w-4" />
      <span>Sin conexión — los cambios pueden no guardarse</span>
      <button onClick={onRetry} className="tap-free inline-flex items-center gap-1 rounded bg-white/15 px-2 py-0.5 font-semibold hover:bg-white/25">
        <RefreshCw className="h-3 w-3" /> Reintentar
      </button>
    </div>
  );
}

function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const { leads } = useStore();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); setOpen((v) => !v); }
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 30);
    else setQ("");
  }, [open]);

  const results = q.length >= 2
    ? leads.filter((l) => {
        const ql = q.toLowerCase();
        return l.nombre.toLowerCase().includes(ql) || l.email.toLowerCase().includes(ql) || (l.telefono && l.telefono.toLowerCase().includes(ql));
      }).slice(0, 8)
    : [];

  function goToLead(id: string) { navigate({ to: "/clientes/$id", params: { id } }); setOpen(false); }

  return (
    <>
      <button onClick={() => setOpen(true)} className="hidden w-full items-center gap-2 rounded-lg bg-white/5 px-3 py-2 text-left text-xs text-white/50 hover:bg-white/10 hover:text-white/80 md:flex md:justify-center lg:justify-start">
        <Search className="h-4 w-4 shrink-0" />
        <span className="hidden flex-1 lg:block">Buscar…</span>
        <kbd className="hidden rounded border border-white/10 px-1 py-0.5 text-[10px] lg:block">⌘K</kbd>
      </button>
      <button onClick={() => setOpen(true)} className="flex h-10 w-10 items-center justify-center rounded-full text-slate-700 active:bg-slate-100 md:hidden" aria-label="Buscar">
        <Search className="h-[22px] w-[22px]" strokeWidth={2} />
      </button>
      {open && (
        <div className="fixed inset-0 z-[60] flex items-start justify-center bg-slate-900/40 px-3 pt-[max(12px,env(safe-area-inset-top))] backdrop-blur-[2px] md:px-4 md:pt-[15vh]" onClick={() => setOpen(false)}>
          <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-slate-900/5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3">
              <Search className="h-5 w-5 shrink-0 text-slate-400" />
              <input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar cliente por nombre, email o teléfono" className="min-w-0 flex-1 text-base text-slate-900 placeholder-slate-400 outline-none" />
              <button onClick={() => setOpen(false)} className="tap-free rounded-full px-2 py-1 text-sm font-medium text-slate-500 hover:bg-slate-100 md:hidden">Cerrar</button>
              {q && <button onClick={() => setQ("")} className="tap-free hidden text-slate-400 hover:text-slate-600 md:block" aria-label="Borrar"><X className="h-4 w-4" /></button>}
            </div>
            {q.length >= 2 && results.length === 0 && (
              <div className="py-10 text-center text-sm text-slate-400">Sin resultados para <strong>"{q}"</strong></div>
            )}
            {results.length > 0 && (
              <ul className="max-h-[60dvh] overflow-y-auto py-1.5">
                {results.map((l) => (
                  <li key={l.id}>
                    <button onClick={() => goToLead(l.id)} className="flex min-h-[56px] w-full items-center gap-3 px-4 py-2.5 text-left transition-colors active:bg-slate-100 hover:bg-slate-50">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-500">
                        {l.nombre.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[15px] font-medium text-slate-900">{l.nombre}</div>
                        <div className="truncate text-xs text-slate-400">
                          {[vendorName(l.vendedor), l.email || l.telefono].filter(Boolean).join(" · ")}
                        </div>
                      </div>
                      <StageBadge etapa={l.etapa} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {q.length < 2 && (
              <div className="py-6 text-center text-xs text-slate-400">
                Escribe al menos 2 caracteres <span className="hidden md:inline">· <kbd className="rounded border border-slate-200 px-1">Esc</kbd> para cerrar</span>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

// Hoja "Más" del móvil: el resto de secciones, el perfil y cerrar sesión.
function MasSheet({ open, onOpenChange, path }: { open: boolean; onOpenChange: (v: boolean) => void; path: string }) {
  const navigate = useNavigate();
  const { displayName, email, signOut } = useAuth();
  const go = (to: string) => { onOpenChange(false); navigate({ to }); };
  return (
    <BottomSheet open={open} onOpenChange={onOpenChange} title="Más" description={displayName ? `${displayName} · ${email ?? ""}` : undefined}>
      <SheetGroup>
        {NAV_MAS.map((item) => {
          const Icon = item.icon;
          return <SheetRow key={item.to} icon={<Icon className="h-5 w-5" />} label={item.label} active={isActive(path, item)} detail={<ChevronRight className="h-4 w-4" />} onClick={() => go(item.to)} />;
        })}
      </SheetGroup>
      <SheetGroup>
        <SheetRow icon={<CircleUserRound className="h-5 w-5" />} label="Mi perfil" detail={<ChevronRight className="h-4 w-4" />} onClick={() => go("/perfil")} />
        <SheetRow icon={<LogOut className="h-5 w-5" />} label="Cerrar sesión" destructive onClick={() => { onOpenChange(false); void signOut(); }} />
      </SheetGroup>
    </BottomSheet>
  );
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  const path = useRouterState({ select: (r) => r.location.pathname });
  const { displayName, signOut } = useAuth();
  const initials = (displayName || "?").slice(0, 2).toUpperCase();
  const online = useOnline();
  const { realtimeStatus } = useStore();
  const effective: "connected" | "connecting" | "disconnected" =
    !online ? "disconnected" : realtimeStatus;
  const showBanner = !online || realtimeStatus === "disconnected";
  // Propuestas de WhatsApp sin revisar (contador en el menú).
  const pendientesWa = pendientesDe(useWhatsapp());
  const [masOpen, setMasOpen] = useState(false);
  const masActivo = NAV_MAS.some((i) => isActive(path, i)) || path === "/perfil";

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {showBanner && <OfflineBanner onRetry={() => actions.reconnectRealtime()} />}

      {/* Cabecera del móvil: logo, búsqueda y perfil. Cerrar sesión vive en "Más"
          (un botón de salir siempre a la vista invitaba a pulsarlo sin querer). */}
      <header className="bar-blur sticky top-0 z-30 flex h-[52px] items-center gap-1 border-b border-slate-200/70 px-3 pt-[env(safe-area-inset-top)] md:hidden">
        <Link to="/" aria-label="Inicio" className="flex h-10 items-center pl-1">
          <TiroritoLogo className="h-5 w-auto shrink-0 text-[#1a4b5b]" />
        </Link>
        <div className="ml-auto flex min-w-0 items-center gap-1">
          <GlobalSearch />
          <Link to="/perfil" aria-label="Mi perfil" title={displayName} className="flex h-10 w-10 items-center justify-center">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-500 text-[11px] font-bold text-[#1a1f36]">{initials}</span>
          </Link>
        </div>
      </header>

      <div className="flex">
        {/* Barra lateral (iPad vertical: carril con etiquetas; ≥1024 px: completa). */}
        <aside className="sticky top-0 hidden h-screen shrink-0 flex-col bg-[#1a1f36] md:flex md:w-[84px] lg:w-[240px]">
          <div className="flex h-16 items-center justify-center px-2 lg:justify-start lg:px-4">
            <TiroritoLogo className="hidden h-6 w-auto text-white lg:block" />
            <TiroritoLogo variant="icon" className="h-6 w-auto text-white lg:hidden" />
          </div>
          <div className="px-2 pb-2">
            <GlobalSearch />
          </div>
          <nav className="flex-1 space-y-1 px-2 py-2">
            {NAV.map((item) => {
              const active = isActive(path, item);
              const Icon = item.icon;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`relative flex flex-col items-center gap-1 rounded-xl px-1 py-2 text-[11px] font-medium transition-colors duration-150 lg:flex-row lg:gap-3 lg:px-3 lg:py-2.5 lg:text-sm ${active ? "bg-white/10 text-white" : "text-white/60 hover:bg-white/5 hover:text-white"}`}
                >
                  <Icon className="h-[22px] w-[22px] shrink-0 lg:h-5 lg:w-5" strokeWidth={active ? 2.25 : 1.75} />
                  <span className="max-w-full truncate">{item.label}</span>
                  {item.to === "/whatsapp" && pendientesWa > 0 && (
                    <>
                      <span className="ml-auto hidden rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold leading-none text-[#1a1f36] lg:inline">{pendientesWa}</span>
                      <span className="absolute left-1/2 top-1 ml-2 min-w-4 rounded-full bg-amber-500 px-1 text-center text-[9px] font-bold leading-4 text-[#1a1f36] lg:hidden">{pendientesWa}</span>
                    </>
                  )}
                </Link>
              );
            })}
          </nav>
          <div className="space-y-2 border-t border-white/10 p-3">
            <div className="flex justify-center px-1 lg:justify-start"><RealtimeDot effective={effective} /></div>
            <div className="hidden items-center gap-2 lg:flex">
              <Link to="/perfil" className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-500 text-xs font-bold text-[#1a1f36] hover:opacity-90" aria-label="Mi perfil">{initials}</Link>
              <Link to="/perfil" className="min-w-0 flex-1 truncate text-sm font-medium text-white hover:underline">{displayName}</Link>
              <button onClick={() => void signOut()} className="flex h-8 w-8 items-center justify-center rounded-lg text-white/50 hover:bg-white/10 hover:text-white" aria-label="Cerrar sesión" title="Cerrar sesión">
                <LogOut className="h-4 w-4" />
              </button>
            </div>
            <div className="flex flex-col items-center gap-1 lg:hidden">
              <Link to="/perfil" className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-500 text-xs font-bold text-[#1a1f36]" aria-label="Mi perfil" title={displayName}>{initials}</Link>
              <button onClick={() => void signOut()} className="flex h-10 w-full items-center justify-center rounded-lg text-white/60 hover:bg-white/10 hover:text-white" aria-label="Cerrar sesión" title="Cerrar sesión">
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        </aside>

        <main className="min-w-0 flex-1 overflow-x-clip pb-[calc(64px+env(safe-area-inset-bottom))] md:pb-0">
          <div key={path} className="mx-auto w-full max-w-7xl animate-page-in px-4 py-4 md:px-6 md:py-6 lg:px-8">{children}</div>
        </main>
      </div>

      {/* Barra de pestañas del móvil (5 pestañas, translúcida, área segura). */}
      <nav
        className="bar-blur fixed bottom-0 left-0 right-0 z-30 grid grid-cols-5 border-t border-slate-200/70 pb-[env(safe-area-inset-bottom)] md:hidden"
        aria-label="Navegación principal"
      >
        {NAV_TAB.map((item) => {
          const active = isActive(path, item) && !masOpen;
          const Icon = item.icon;
          return (
            <Link key={item.to} to={item.to} className={`relative flex h-[56px] min-w-0 flex-col items-center justify-center gap-[3px] px-1 text-[10.5px] font-medium transition-colors ${active ? "text-[#1a1f36]" : "text-slate-400"}`}>
              <span className="relative">
                <Icon className="h-[24px] w-[24px] shrink-0" strokeWidth={active ? 2.25 : 1.75} />
                {item.to === "/whatsapp" && pendientesWa > 0 && (
                  <span className="absolute -right-2.5 -top-1.5 min-w-[18px] rounded-full bg-rose-500 px-1 text-center text-[10px] font-bold leading-[18px] text-white ring-2 ring-white">{pendientesWa}</span>
                )}
              </span>
              <span className={`max-w-full truncate ${active ? "font-semibold" : ""}`}>{item.label}</span>
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setMasOpen(true)}
          className={`relative flex h-[56px] min-w-0 flex-col items-center justify-center gap-[3px] px-1 text-[10.5px] font-medium transition-colors ${masActivo || masOpen ? "text-[#1a1f36]" : "text-slate-400"}`}
          aria-haspopup="dialog"
          aria-expanded={masOpen}
        >
          <Ellipsis className="h-[24px] w-[24px] shrink-0" strokeWidth={masActivo || masOpen ? 2.25 : 1.75} />
          <span className={masActivo || masOpen ? "font-semibold" : ""}>Más</span>
        </button>
      </nav>
      <MasSheet open={masOpen} onOpenChange={setMasOpen} path={path} />
    </div>
  );
}
