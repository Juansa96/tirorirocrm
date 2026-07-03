import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard, Columns3, List, LogOut, Search, X, BarChart2, Package, WifiOff, RefreshCw,
} from "lucide-react";
import { useState, useEffect, useRef, type ComponentType } from "react";
import { useAuth } from "@/lib/auth";
import { useStore, actions } from "@/lib/store";
import { vendorName } from "@/lib/types";
import { StageBadge } from "@/components/StageBadge";
import { TiroritoLogo } from "./TiroritoLogo";

interface NavItem {
  to: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  exact?: boolean;
}

const NAV: NavItem[] = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/pipeline", label: "Pipeline", icon: Columns3 },
  { to: "/clientes", label: "Clientes", icon: List },
  { to: "/datos", label: "Datos", icon: BarChart2 },
  { to: "/pedidos", label: "Pedidos", icon: Package },
];

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
      <button onClick={onRetry} className="inline-flex items-center gap-1 rounded bg-white/15 px-2 py-0.5 font-semibold hover:bg-white/25">
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
      }).slice(0, 7)
    : [];

  function goToLead(id: string) { navigate({ to: "/clientes/$id", params: { id } }); setOpen(false); }

  return (
    <>
      <button onClick={() => setOpen(true)} className="hidden w-full items-center gap-2 rounded-lg bg-white/5 px-3 py-2 text-left text-xs text-white/50 hover:bg-white/10 hover:text-white/80 md:flex">
        <Search className="h-3.5 w-3.5 shrink-0" />
        <span className="hidden flex-1 lg:block">Buscar...</span>
        <kbd className="hidden rounded border border-white/10 px-1 py-0.5 text-[10px] lg:block">⌘K</kbd>
      </button>
      <button onClick={() => setOpen(true)} className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 md:hidden" aria-label="Buscar">
        <Search className="h-4 w-4" />
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 px-4 pt-[15vh]" onClick={() => setOpen(false)}>
          <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3">
              <Search className="h-4 w-4 shrink-0 text-slate-400" />
              <input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre, email o teléfono…" className="flex-1 text-sm text-slate-900 placeholder-slate-400 outline-none" />
              {q && <button onClick={() => setQ("")} className="text-slate-400 hover:text-slate-600"><X className="h-4 w-4" /></button>}
            </div>
            {q.length >= 2 && results.length === 0 && (
              <div className="py-10 text-center text-sm text-slate-400">Sin resultados para <strong>"{q}"</strong></div>
            )}
            {results.length > 0 && (
              <ul className="max-h-80 overflow-y-auto py-1.5">
                {results.map((l) => (
                  <li key={l.id}>
                    <button onClick={() => goToLead(l.id)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-slate-50">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-500">
                        {l.nombre.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium text-slate-900">{l.nombre}</div>
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
                Escribe al menos 2 caracteres · <kbd className="rounded border border-slate-200 px-1">Esc</kbd> para cerrar
              </div>
            )}
          </div>
        </div>
      )}
    </>
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

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {showBanner && <OfflineBanner onRetry={() => actions.reconnectRealtime()} />}
      <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-slate-200 bg-white px-3 md:hidden">
        <TiroritoLogo className="h-5 w-auto shrink-0 text-[#1a4b5b]" />
        <div className="ml-auto flex min-w-0 items-center gap-2">
          <GlobalSearch />
          <Link to="/perfil" aria-label="Mi perfil" title={displayName} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-500 text-xs font-bold text-[#1a1f36]">{initials}</Link>
          <button onClick={() => void signOut()} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200" aria-label="Cerrar sesión">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </header>

      <div className="flex">
        <aside className="sticky top-0 hidden h-screen shrink-0 flex-col bg-[#1a1f36] md:flex md:w-[60px] lg:w-[240px]">
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
                <Link key={item.to} to={item.to} className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors duration-150 ${active ? "bg-white/10 text-white" : "text-white/60 hover:bg-white/5 hover:text-white"}`}>
                  <Icon className="h-5 w-5 shrink-0" />
                  <span className="hidden lg:inline">{item.label}</span>
                </Link>
              );
            })}
          </nav>
          <div className="space-y-2 border-t border-white/10 p-3">
            <div className="px-1"><RealtimeDot effective={effective} /></div>
            <div className="hidden items-center gap-2 lg:flex">
              <Link to="/perfil" className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-500 text-xs font-bold text-[#1a1f36] hover:opacity-90" aria-label="Mi perfil">{initials}</Link>
              <Link to="/perfil" className="min-w-0 flex-1 truncate text-sm font-medium text-white hover:underline">{displayName}</Link>
              <button onClick={() => void signOut()} className="flex h-8 w-8 items-center justify-center rounded-lg text-white/50 hover:bg-white/10 hover:text-white" aria-label="Cerrar sesión">
                <LogOut className="h-4 w-4" />
              </button>
            </div>
            <button onClick={() => void signOut()} className="flex h-9 w-full items-center justify-center rounded-lg text-white/60 hover:bg-white/10 hover:text-white lg:hidden" aria-label="Cerrar sesión">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </aside>

        <main className="min-w-0 flex-1 pb-20 md:pb-0">
          <div key={path} className="mx-auto w-full max-w-7xl animate-page-in px-4 py-4 md:px-6 md:py-6">{children}</div>
        </main>
      </div>

      <nav className="fixed bottom-0 left-0 right-0 z-30 grid grid-cols-5 border-t border-slate-200 bg-white md:hidden">
        {NAV.map((item) => {
          const active = isActive(path, item);
          const Icon = item.icon;
          return (
            <Link key={item.to} to={item.to} className={`flex min-h-12 min-w-0 flex-col items-center justify-center gap-0.5 px-1 py-2 text-[10px] font-medium transition-colors ${active ? "text-[#1a1f36]" : "text-slate-500"}`}>
              <Icon className={`h-5 w-5 shrink-0 ${active ? "text-amber-500" : ""}`} />
              <span className="max-w-full truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
