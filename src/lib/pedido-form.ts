// Tipos y helpers del formulario de pedido con GUARDADO EXPLÍCITO (punto 1).
// La ficha de pedido edita un "borrador" en memoria; nada se persiste hasta
// pulsar "Guardar". Aquí viven las piezas compartidas entre la ruta
// (pedidos.$id.tsx) y el panel del equipo (FichaTapiceroEquipo.tsx).

import type { Pedido, PedidoTela } from "./types";

// Una fila de tela dentro del borrador. `id === null` ⇒ tela nueva sin guardar.
export interface TelaDraft {
  id: string | null;
  tipoTela: string;
  nombreTela: string;
  estado: string;          // "Pedida" | "Recibida"
  fechaRecibo: string;
  telaFotoUrl: string;
  telaBibliotecaId: string;
  telaColeccion: string;
  mismaQueFrontal: boolean;
}

export function telaToDraft(t: PedidoTela): TelaDraft {
  return {
    id: t.id,
    tipoTela: t.tipoTela,
    nombreTela: t.nombreTela,
    estado: t.estado || "Pedida",
    fechaRecibo: t.fechaRecibo || "",
    telaFotoUrl: t.telaFotoUrl || "",
    telaBibliotecaId: t.telaBibliotecaId || "",
    telaColeccion: t.telaColeccion || "",
    mismaQueFrontal: !!t.mismaQueFrontal,
  };
}

export function emptyTela(tipoTela: string): TelaDraft {
  return { id: null, tipoTela, nombreTela: "", estado: "Pedida", fechaRecibo: "", telaFotoUrl: "", telaBibliotecaId: "", telaColeccion: "", mismaQueFrontal: false };
}

// Campos del PEDIDO que gestiona el borrador (se comparan para saber si hay
// cambios y se envían en el patch al guardar). `numero` y `tapiceroId` se
// tratan aparte (validación de duplicado / reasignación con sellado de pasos).
export const CAMPOS_EDITABLES_PEDIDO: (keyof Pedido)[] = [
  "diasPlazo", "fechaEntregaReal", "precio", "precioConIva", "costeEnvio", "reserva",
  "pagadoCompleto", "factura", "notasPedido", "montaje", "prioridad", "notaTapicero",
  "fechaRecogida", "telaEstado", "terminadoTapicero", "esCanje", "formatos", "tipoColaboracion",
  // Hitos de producción (booleano + fecha)
  "telaPedida", "telaPedidaFecha", "telaRecibida", "telaRecibidaFecha",
  "estructuraHecha", "estructuraHechaFecha", "tapizadoHecho", "tapizadoHechoFecha",
  "entregado", "entregadoFecha", "solicitadoDaniel", "solicitadoDanielFecha",
  "enviarTelaDaniel", "enviarTelaDanielFecha", "recibirDaniel", "recibirDanielFecha",
  "terminadoDaniel", "terminadoDanielFecha", "enviadoDaniel", "enviadoDanielFecha",
  "pantallaHecha", "pantallaHechaFecha", "pasosTapicero",
];

// ¿Difieren dos valores de campo? (compara arrays/objetos por JSON).
function distinto(a: unknown, b: unknown): boolean {
  if (a === b) return false;
  if (typeof a === "object" || typeof b === "object") return JSON.stringify(a ?? null) !== JSON.stringify(b ?? null);
  return true;
}

// Patch con SOLO los campos del pedido que cambiaron respecto a la base.
export function diffPedido(base: Pedido, draft: Pedido): Partial<Pedido> {
  const patch: Partial<Pedido> = {};
  for (const k of CAMPOS_EDITABLES_PEDIDO) {
    if (distinto(base[k], draft[k])) (patch as Record<string, unknown>)[k] = draft[k];
  }
  return patch;
}

// ¿El borrador de telas difiere del original?
export function telasCambiadas(base: TelaDraft[], draft: TelaDraft[]): boolean {
  return JSON.stringify(base) !== JSON.stringify(draft);
}
