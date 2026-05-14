import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Columns3,
  List,
  CalendarClock,
} from "lucide-react";
import type { ComponentType } from "react";

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
  { to: "/tareas", label: "Tareas", icon: CalendarClock },
];

function Logo({ light = false }: { light?: boolean }) {
  return (
    <div className="flex flex-col">
      <div className="text-lg font-bold leading-tight">
        <span className={light ? "text-white" : "text-slate-900"}>Tiroriro</span>
        <span className="text-amber-500">Home</span>
      </div>
      {light && <div className="text-[11px] text-white/40">Sales CRM</div>}
    </div>
  );
}

function isActive(path: string, item: NavItem) {
  if (item.exact) return path === item.to;
  return path === item.to || path.startsWith(item.to + "/");
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  const path = useRouterState({ select: (r) => r.location.pathname });

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* Mobile header */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-slate-200 bg-white px-4 md:hidden">
        <Logo />
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-200 text-sm font-semibold text-slate-700">
          TR
        </div>
      </header>

      <div className="flex">
        {/* Sidebar (tablet collapsed / desktop expanded) */}
        <aside className="sticky top-0 hidden h-screen shrink-0 flex-col bg-[#1a1f36] md:flex md:w-[60px] lg:w-[240px]">
          <div className="flex h-16 items-center justify-center px-4 lg:justify-start">
            <div className="hidden lg:block">
              <Logo light />
            </div>
            <div className="text-lg font-bold lg:hidden">
              <span className="text-white">T</span>
              <span className="text-amber-500">H</span>
            </div>
          </div>
          <nav className="flex-1 space-y-1 px-2 py-4">
            {NAV.map((item) => {
              const active = isActive(path, item);
              const Icon = item.icon;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors duration-150 ${
                    active
                      ? "bg-white/10 text-white"
                      : "text-white/60 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  <span className="hidden lg:inline">{item.label}</span>
                </Link>
              );
            })}
          </nav>
          <div className="hidden border-t border-white/10 px-4 py-3 text-[11px] text-white/40 lg:block">
            © 2026 Tiroriro Home
          </div>
        </aside>

        <main className="min-w-0 flex-1 pb-20 md:pb-0">
          <div className="mx-auto w-full max-w-7xl px-4 py-4 md:px-6 md:py-6">
            {children}
          </div>
        </main>
      </div>

      {/* Bottom nav (mobile) */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 grid grid-cols-4 border-t border-slate-200 bg-white md:hidden">
        {NAV.map((item) => {
          const active = isActive(path, item);
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              className={`flex min-h-12 flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium transition-colors ${
                active ? "text-[#1a1f36]" : "text-slate-500"
              }`}
            >
              <Icon className={`h-5 w-5 ${active ? "text-amber-500" : ""}`} />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
