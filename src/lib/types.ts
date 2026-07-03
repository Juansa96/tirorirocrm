export const VENDEDORES = [
  "isangradortorres@gmail.com",
  "rocionavarreteurdiales98@gmail.com",
  "sangradortorresjuan@gmail.com",
  "bea.gyerro@gmail.com",
] as const;

export type Vendedor = (typeof VENDEDORES)[number] | string;

const NAMES: Record<string, string> = {
  "isangradortorres@gmail.com": "Iñaki",
  "rocionavarreteurdiales98@gmail.com": "Rocío",
  "sangradortorresjuan@gmail.com": "Juan",
  "bea.gyerro@gmail.com": "Bea",
  // Compatibilidad con datos antiguos en Supabase
  "inaki@tiroriro.com": "Iñaki",
  "rocio@tiroriro.com": "Rocío",
  "juan@tiroriro.com": "Juan",
  "bea@tiroriro.com": "Bea",
};

export function vendorName(v: string): string {
  return NAMES[v] ?? v;
}

export type Etapa =
  | "Discovery"
  | "Primer Contacto"
  | "Negotiation"
  | "On Hold"
  | "Closed Won"
  | "Closed Lost";

export const ETAPAS: Etapa[] = [
  "Discovery",
  "Primer Contacto",
  "Negotiation",
  "On Hold",
  "Closed Won",
  "Closed Lost",
];

export const ETAPA_COLORS: Record<Etapa, string> = {
  Discovery: "#38bdf8",
  "Primer Contacto": "#f59e0b",
  Negotiation: "#8b5cf6",
  "On Hold": "#94a3b8",
  "Closed Won": "#10b981",
  "Closed Lost": "#ef4444",
};

export const ORIGENES = [
  "Formulario web",
  "Instagram",
  "TikTok",
  "WhatsApp",
  "Llamada",
  "Correo",
  "Boca a boca",
  "Referido",
] as const;

export type Origen = (typeof ORIGENES)[number] | string;

export const RANGOS_EDAD = ["< 30", "30-40", "40-50", "50-60", "> 60"] as const;
export type RangoEdad = (typeof RANGOS_EDAD)[number] | "";

export interface Lead {
  id: string;
  nombre: string;
  email: string;
  telefono: string;
  ciudad: string;
  producto: string;
  vendedor: string;
  etapa: Etapa;
  valor: number;
  origen: string;
  redSocial: string;
  fechaHold: string;
  valorProducto: number;
  valorEnvio: number;
  edad: string;
  fechaCreacion: string;
  fechaEntradaEtapa: string;
  razonUrgencia: string;
  clienteTipo: string;        // 'normal' | 'partner_ab'
  etiquetas: string[];
  cobrado: boolean;
  fechaCobro: string;         // YYYY-MM-DD o ""
}


export interface LeadFoto {
  id: string;
  leadId: string;
  storagePath: string;
  url: string;
  pie: string;
  createdAt: string;
}

export interface Tarea {
  id: string;
  leadId: string;
  descripcion: string;
  fecha: string;
  hora: string;
  vendedor: string;
  completada: boolean;
}

export interface Nota {
  id: string;
  leadId: string;
  contenido: string;
  usuario: string;
  createdAt: string;
}

export interface Producto {
  id: string;
  leadId: string;
  tipo: string;          // cabecero | banco | cojin | puf | mesa | pantalla
  modelo: string;        // forma / variante display name
  ancho: number | null;
  alto: number | null;
  tela: string;
  color: string;
  relleno: string;
  patas: string;
  acabado: string;
  coleccionTela: string;
  cantidad: number;
  precioUnitario: number;
  notasProducto: string;
  createdAt: string;
  createdBy: string;
  caracteristicasConfirmadas: boolean;
  fechaConfirmacion: string;
  pagado50: boolean;
}

export interface AuditEntry {
  id: string;
  tabla: string;
  leadId: string | null;
  campo: string;
  valorAnterior: string | null;
  valorNuevo: string | null;
  usuario: string | null;
  createdAt: string;
}

// ───────────── Pedidos ─────────────
export interface Pedido {
  id: string;
  productoLeadId: string;
  leadId: string;
  clienteNombreLibre: string;
  fechaCreacionPedido: string;
  diasPlazo: number;
  fechaLimite: string;        // YYYY-MM-DD
  fechaEntregaReal: string;
  pagado50: boolean;
  pagoTodoAlFinal: boolean;
  creadoManualmente: boolean;
  estadoPedido: string;       // En proceso | Terminado | Entregado
  telaPedida: boolean;
  telaPedidaFecha: string;
  telaRecibida: boolean;
  telaRecibidaFecha: string;
  estructuraHecha: boolean;
  estructuraHechaFecha: string;
  tapizadoHecho: boolean;
  tapizadoHechoFecha: string;
  entregado: boolean;
  entregadoFecha: string;
  precio: number;
  precioConIva: number | null;
  costeEnvio: number;
  reserva: number;
  pagadoCompleto: boolean;
  factura: string;
  notasPedido: string;
  createdAt: string;
  updatedAt: string;
}

export interface PedidoTela {
  id: string;
  pedidoId: string;
  tipoTela: string;
  nombreTela: string;
  estado: string;   // Pedida | Recibida
  fechaRecibo: string;
  orden: number;
  createdAt: string;
}

// Plantilla de telas según tipo de producto (punto de partida; el usuario puede editar libremente)
export function telasPorTipo(tipo: string): string[] {
  const t = (tipo || "").toLowerCase();
  if (t === "cabecero") return ["Frontal", "Lateral", "Vivo"];
  if (t === "puf") return ["Superior", "Lateral", "Vivo"];
  if (t === "cojin" || t === "cojín") return ["Principal"];
  if (t === "banco") return ["Asiento", "Lateral", "Vivo"];
  if (t === "pantalla") return ["Principal"];
  if (t === "mesa") return [];
  return ["Principal"];
}

// ───────────── Semáforo de ruta ideal ─────────────
export type RutaEstado = "verde" | "ambar" | "rojo";

/**
 * Reparte dias_plazo en 4 tramos (25/50/75/100) → tela_pedida, tela_recibida,
 * estructura+tapizado, entregado. Compara hito real con hito esperado para hoy.
 */
export function semaforoPedido(p: Pedido, hoyMs?: number): { estado: RutaEstado; hitoActual: number; hitoEsperado: number; diasRestantes: number } {
  const ahora = hoyMs ?? Date.now();
  const creado = new Date(p.fechaCreacionPedido).getTime();
  const transcurridos = Math.max(0, (ahora - creado) / 86400000);
  const ratio = p.diasPlazo > 0 ? transcurridos / p.diasPlazo : 0;
  // hitoEsperado: 0..4
  let hitoEsperado = 0;
  if (ratio >= 0.25) hitoEsperado = 1;
  if (ratio >= 0.5) hitoEsperado = 2;
  if (ratio >= 0.75) hitoEsperado = 3;
  if (ratio >= 1) hitoEsperado = 4;

  // hitoActual real
  let hitoActual = 0;
  if (p.telaPedida) hitoActual = 1;
  if (p.telaRecibida) hitoActual = 2;
  if (p.estructuraHecha && p.tapizadoHecho) hitoActual = 3;
  if (p.entregado) hitoActual = 4;

  const fechaLim = p.fechaLimite ? new Date(p.fechaLimite + "T23:59:59").getTime() : creado + p.diasPlazo * 86400000;
  const diasRestantes = Math.ceil((fechaLim - ahora) / 86400000);

  let estado: RutaEstado = "verde";
  if (p.entregado) {
    estado = "verde";
  } else if (ahora > fechaLim) {
    estado = "rojo";
  } else {
    const gap = hitoEsperado - hitoActual;
    if (gap <= 0) estado = "verde";
    else if (gap === 1) estado = "ambar";
    else estado = "rojo";
  }

  return { estado, hitoActual, hitoEsperado, diasRestantes };
}

export function estadoColumna(p: Pedido): "Tela pedida" | "Tela recibida" | "En producción" | "Terminado" | "Entregado" {
  if (p.entregado) return "Entregado";
  if (p.estructuraHecha && p.tapizadoHecho) return "Terminado";
  if (p.estructuraHecha || p.tapizadoHecho) return "En producción";
  if (p.telaRecibida) return "Tela recibida";
  return "Tela pedida";
}

export const ESTADOS_PEDIDO_COL = ["Tela pedida", "Tela recibida", "En producción", "Terminado", "Entregado"] as const;

// ───────────── Catálogo de productos ─────────────
export interface CatalogoProducto {
  id: string;
  tipo: string;          // "Cabecero", "Puf", "Mesa de centro", "Pantalla de lámpara", "Almohadón", "Cubrecanapé"
  modelo: string;
  descripcion: string;
  precioDesde: number;
  activo: boolean;
  orden: number;
}

// Mapping catálogo (label) ↔ tipo interno usado en productos_lead
export const CATALOG_TO_INTERNAL: Record<string, string> = {
  "Cabecero": "cabecero",
  "Puf": "puf",
  "Mesa de centro": "mesa",
  "Pantalla de lámpara": "pantalla",
  "Almohadón": "almohadon",
  "Cubrecanapé": "otro",
};

export const INTERNAL_TO_CATALOG: Record<string, string> = {
  cabecero: "Cabecero",
  puf: "Puf",
  mesa: "Mesa de centro",
  pantalla: "Pantalla de lámpara",
  almohadon: "Almohadón",
  otro: "Cubrecanapé",
};

