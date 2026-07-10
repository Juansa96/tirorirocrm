import type { Pedido } from "./types";

// ─────────────────────────────────────────────────────────────────────────
// Núcleo de dinero — `pedidos` es la fuente de verdad.
//
// Reglas (decididas con el cliente):
//  • Precio de venta = producto + envío. No hay costes ni márgenes.
//    - pedido.precio     → precio del PRODUCTO
//    - pedido.costeEnvio → envío (editable a mano en cada pedido)
//  • Cobro por pedido: Pendiente / Parcial / Cobrado.
//    - Pendiente = venta − cobrado.
//    - reserva = cantidad ya cobrada a cuenta (down payment editable).
//    - pagadoCompleto = todo cobrado.
//  • "Pagado 50%" pre-rellena la reserva con la mitad del precio de PRODUCTO
//    (el envío queda aparte), pero la reserva es editable después.
// ─────────────────────────────────────────────────────────────────────────

export type EstadoCobro = "Pendiente" | "Parcial" | "Cobrado";

/** Venta total del pedido = producto + envío. */
export function pedidoTotal(p: Pedido): number {
  return (p.precio || 0) + (p.costeEnvio || 0);
}

/**
 * Cantidad ya cobrada del pedido.
 * Si está marcado como pagado completo, se cobra el total; si no, lo que haya
 * en la reserva (acotado al total, nunca más que la venta).
 */
export function pedidoCobrado(p: Pedido): number {
  const total = pedidoTotal(p);
  if (p.pagadoCompleto) return total;
  const reserva = Math.max(0, p.reserva || 0);
  return Math.min(reserva, total);
}

/** Pendiente de cobro = venta − cobrado (nunca negativo). */
export function pedidoPendiente(p: Pedido): number {
  return Math.max(0, pedidoTotal(p) - pedidoCobrado(p));
}

/** Estado de cobro derivado de venta/cobrado. */
export function estadoCobro(p: Pedido): EstadoCobro {
  const total = pedidoTotal(p);
  const cobrado = pedidoCobrado(p);
  if (total > 0 && cobrado >= total) return "Cobrado";
  if (cobrado > 0) return "Parcial";
  return "Pendiente";
}

/**
 * Reserva sugerida al marcar "media pagada": la mitad del precio de PRODUCTO
 * (sin envío). Redondeada a 2 decimales para evitar arrastres de coma flotante.
 */
export function reservaMedia(p: Pedido): number {
  return Math.round(((p.precio || 0) / 2) * 100) / 100;
}

export interface ResumenCobro {
  venta: number;
  cobrado: number;
  pendiente: number;
  count: number;
}

/**
 * Agrega venta / cobrado / pendiente sobre un conjunto de pedidos.
 * `excluir` permite dejar fuera pedidos que no cuentan como ingreso
 * (p. ej. colaboraciones de influencers = canje — se implementa en tarea 7).
 */
export function resumenCobro(pedidos: Pedido[], excluir?: (p: Pedido) => boolean): ResumenCobro {
  const acc: ResumenCobro = { venta: 0, cobrado: 0, pendiente: 0, count: 0 };
  for (const p of pedidos) {
    if (excluir?.(p)) continue;
    acc.venta += pedidoTotal(p);
    acc.cobrado += pedidoCobrado(p);
    acc.pendiente += pedidoPendiente(p);
    acc.count += 1;
  }
  return acc;
}
