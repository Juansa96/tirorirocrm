import { Drawer } from "vaul";
import type { ReactNode } from "react";

// ─────────────────────────────────────────────────────────────────────────
// Hoja inferior (bottom sheet) al estilo de iOS, para acciones y menús en el
// móvil: sube desde abajo, se arrastra para cerrar y respeta el área segura.
// Se usa para el menú "Más" de la barra inferior, para "Mover de etapa" en el
// pipeline y para cualquier lista de acciones rápidas.
// ─────────────────────────────────────────────────────────────────────────
export function BottomSheet({ open, onOpenChange, title, description, children }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange} shouldScaleBackground={false}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-[70] bg-slate-900/40 backdrop-blur-[2px]" />
        <Drawer.Content
          aria-describedby={description ? undefined : ""}
          className="fixed inset-x-0 bottom-0 z-[71] mx-auto flex max-h-[88dvh] w-full max-w-lg flex-col rounded-t-[22px] bg-white shadow-[0_-12px_40px_-12px_rgba(15,23,42,.35)] outline-none"
        >
          <div className="mx-auto mt-2.5 h-1.5 w-10 shrink-0 rounded-full bg-slate-300" />
          <div className="px-5 pb-2 pt-3">
            <Drawer.Title className="text-[17px] font-semibold text-slate-900">{title}</Drawer.Title>
            {description ? (
              <Drawer.Description className="mt-0.5 text-[13px] text-slate-500">{description}</Drawer.Description>
            ) : (
              <Drawer.Description className="sr-only">{title}</Drawer.Description>
            )}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">{children}</div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}

// Fila de acción dentro de una hoja: icono, texto y (opcional) detalle a la
// derecha. Altura táctil (52 px) y agrupación tipo lista "inset" de iOS.
export function SheetRow({ icon, label, detail, onClick, destructive = false, active = false, color }: {
  icon?: ReactNode;
  label: string;
  detail?: ReactNode;
  onClick: () => void;
  destructive?: boolean;
  active?: boolean;
  color?: string; // punto de color (etapas)
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-h-[52px] w-full items-center gap-3 px-4 text-left text-[16px] transition-colors active:bg-slate-100 ${destructive ? "text-rose-600" : "text-slate-900"} ${active ? "bg-slate-50" : ""}`}
    >
      {color && <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: color }} />}
      {icon && <span className={`flex h-7 w-7 shrink-0 items-center justify-center ${destructive ? "text-rose-500" : "text-slate-500"}`}>{icon}</span>}
      <span className={`min-w-0 flex-1 truncate ${active ? "font-semibold" : "font-medium"}`}>{label}</span>
      {detail && <span className="shrink-0 text-[14px] text-slate-400">{detail}</span>}
    </button>
  );
}

// Grupo de filas con separadores finos y esquinas redondeadas.
export function SheetGroup({ children, label }: { children: ReactNode; label?: string }) {
  return (
    <div className="mb-3">
      {label && <div className="px-4 pb-1.5 text-[12px] font-semibold uppercase tracking-wide text-slate-400">{label}</div>}
      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white [&>button+button]:border-t [&>button+button]:border-slate-100">{children}</div>
    </div>
  );
}
