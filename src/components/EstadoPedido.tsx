import { ESTADOS_PEDIDO, ESTADO_PEDIDO_COLORS, indiceEstado, type EstadoPedido } from "@/lib/types";

// Pastilla con el estado del pedido (mismo color en el CRM y en el panel).
export function EstadoBadge({ estado, className = "" }: { estado: EstadoPedido; className?: string }) {
  const c = ESTADO_PEDIDO_COLORS[estado];
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-bold leading-none ${c.bg} ${c.text} ${className}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${c.dot}`} />
      {estado}
    </span>
  );
}

// Selector de estado: una fila de botones, uno por estado, con el actual
// resaltado. Pulsar cualquiera mueve el pedido a ese estado (hacia delante o
// hacia atrás). `estados` limita los que se ofrecen (el tapicero no ve
// "Entregado al cliente").
export function EstadoSelector({ estado, estados = [...ESTADOS_PEDIDO], onChange, disabled = false, compacto = false }: {
  estado: EstadoPedido;
  estados?: EstadoPedido[];
  onChange: (e: EstadoPedido) => void;
  disabled?: boolean;
  compacto?: boolean;
}) {
  const actual = indiceEstado(estado);
  return (
    <div className={`grid gap-1.5 ${estados.length === 5 ? "grid-cols-5" : "grid-cols-4"}`}>
      {estados.map((e) => {
        const i = indiceEstado(e);
        const c = ESTADO_PEDIDO_COLORS[e];
        const activo = e === estado;
        const hecho = i < actual;
        return (
          <button key={e} type="button" disabled={disabled || activo} onClick={() => onChange(e)}
            title={activo ? "Estado actual" : hecho ? `Volver a «${e}»` : `Pasar a «${e}»`}
            className={`rounded-xl border px-1.5 text-center font-bold leading-tight transition-colors disabled:cursor-default ${compacto ? "py-2 text-[11px]" : "py-3 text-xs sm:text-sm"} ${
              activo
                ? `${c.bg} ${c.text} border-transparent ring-2 ring-offset-1 ring-slate-900/70`
                : hecho
                  ? "border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100"
                  : "border-slate-900 bg-[#1a1f36] text-white hover:bg-[#2a2f46]"
            } ${disabled && !activo ? "opacity-50" : ""}`}>
            {activo ? "✓ " : ""}{e}
          </button>
        );
      })}
    </div>
  );
}
