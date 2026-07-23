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

export type EtapaB2C =
  | "Discovery"
  | "Primer Contacto"
  | "Negotiation"
  | "On Hold"
  | "Closed Won"
  | "Closed Lost";

export type EtapaB2B =
  | "Cliente potencial"
  | "Propuesta"
  | "Ganado"
  | "Perdido";

export type EtapaColab =
  | "Contactado"
  | "Negociando"
  | "Ganado"
  | "Perdido";

export type Etapa = EtapaB2C | EtapaB2B | EtapaColab;

// Motivos por los que una colaboración se marca como "Perdido".
// Se pregunta siempre al mover a Perdido; "Otro" permite texto libre.
export const RAZONES_PERDIDA_COLAB = [
  "No responde",
  "Pide pago (no acepta canje)",
  "No encaja con la marca",
  "Fechas no compatibles",
  "Colabora con la competencia",
  "Pocos seguidores / bajo alcance",
  "Otro",
] as const;

export const ETAPAS: EtapaB2C[] = [
  "Discovery",
  "Primer Contacto",
  "Negotiation",
  "On Hold",
  "Closed Won",
  "Closed Lost",
];

export const ETAPAS_B2B: EtapaB2B[] = [
  "Cliente potencial",
  "Propuesta",
  "Ganado",
  "Perdido",
];

export const ETAPAS_COLAB: EtapaColab[] = [
  "Contactado",
  "Negociando",
  "Ganado",
  "Perdido",
];

export const ETAPA_COLORS: Record<Etapa, string> = {
  Discovery: "#38bdf8",
  "Primer Contacto": "#f59e0b",
  Negotiation: "#8b5cf6",
  "On Hold": "#94a3b8",
  "Closed Won": "#10b981",
  "Closed Lost": "#ef4444",
  "Cliente potencial": "#38bdf8",
  Propuesta: "#8b5cf6",
  Ganado: "#10b981",
  Perdido: "#ef4444",
  Contactado: "#ec4899",
  Negociando: "#f59e0b",
};

export type TipoLead = "B2C" | "B2B" | "INFLUENCER";
export const ASIGNADOS_B2B = ["Iñaki", "Juan", "Rocío", "Bea"] as const;
export type AsignadoB2B = (typeof ASIGNADOS_B2B)[number];

// ── Influencers / colaboraciones (canje) ─────────────────────────────
export const REDES_SOCIALES = ["Instagram", "TikTok", "YouTube", "Otra"] as const;
export type RedSocialPrincipal = (typeof REDES_SOCIALES)[number] | "";

// Formato de la publicación (varios por colaboración)
export const FORMATOS_COLAB = ["Publicación", "Reel", "Story"] as const;
export type FormatoColab = (typeof FORMATOS_COLAB)[number];

// Tipo de colaboración
export const TIPOS_COLAB = [
  "Sorteo",
  "Mención conjunta con otras marcas",
  "Reseña/valoración",
  "Unboxing",
  "Código descuento/afiliado",
  "Cesión de contenido",
  "Otros",
] as const;
export type TipoColab = (typeof TIPOS_COLAB)[number] | "";


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
  provincia: string;
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
  // ── B2B ──
  tipo: TipoLead;             // 'B2C' (default) | 'B2B'
  razonSocial: string;
  nif: string;
  contactoNombre: string;
  contactoApellidos: string;
  contactoCargo: string;
  direccion: string;
  web: string;
  instagram: string;
  notasB2b: string;
  asignados: string[];        // subconjunto de ASIGNADOS_B2B
  // ── Influencer (solo si tipo === 'INFLUENCER') ──
  seguidores: number;         // nº de seguidores en la red principal
  redPrincipal: string;       // 'Instagram' | 'TikTok' | 'YouTube' | 'Otra'
  usuario: string;            // @usuario
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
  fondo: number | null;
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
  // ── Flujo "Daniel" (todos los productos salvo pantalla de lámpara) ──
  solicitadoDaniel: boolean;
  solicitadoDanielFecha: string;
  enviarTelaDaniel: boolean;
  enviarTelaDanielFecha: string;
  recibirDaniel: boolean;
  recibirDanielFecha: string;
  terminadoDaniel: boolean;
  terminadoDanielFecha: string;
  enviadoDaniel: boolean;
  enviadoDanielFecha: string;
  // ── Flujo corto de pantallas de lámpara ──
  pantallaHecha: boolean;
  pantallaHechaFecha: string;
  precio: number;
  precioConIva: number | null;
  costeEnvio: number;
  reserva: number;
  pagadoCompleto: boolean;
  factura: string;
  notasPedido: string;
  createdAt: string;
  updatedAt: string;
  empresaId: string;   // uuid del lead B2B vinculado, o "" si no aplica
  // ── Colaboración con influencer (canje) ──
  esCanje: boolean;            // true = colaboración: se ve el precio pero NO cuenta como ingreso/venta
  formatos: string[];         // subconjunto de FORMATOS_COLAB
  tipoColaboracion: string;   // uno de TIPOS_COLAB (o texto libre si "Otros")
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
  // Acepta tanto los canónicos ("cojin") como los alias históricos ("almohadon", "cojín").
  const t = (tipo || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (t === "cabecero") return ["Frontal", "Lateral", "Vivo"];
  if (t === "puf") return ["Superior", "Lateral", "Vivo"];
  if (t === "cojin" || t === "almohadon" || t === "almohadones" || t === "cojines") return ["Principal"];
  if (t === "banco") return ["Asiento", "Lateral", "Vivo"];
  if (t === "pantalla") return ["Principal"];
  if (t === "mesa") return [];
  return ["Principal"];
}

// ───────────── Flujo de producción (hitos) ─────────────
// Los pedidos siguen el flujo "Daniel" salvo las pantallas de lámpara, que
// llevan un flujo corto. Un único sitio define el orden de hitos y de ahí
// beben el detalle del pedido, la lista y el semáforo.
export interface HitoDef {
  key: keyof Pedido;        // campo booleano del hito
  fechaKey: keyof Pedido;   // campo fecha del hito
  label: string;
}

export function esPantalla(tipoProducto: string): boolean {
  return (tipoProducto || "").toLowerCase() === "pantalla";
}

const FLUJO_PANTALLA: HitoDef[] = [
  { key: "telaPedida", fechaKey: "telaPedidaFecha", label: "Tela pedida" },
  { key: "telaRecibida", fechaKey: "telaRecibidaFecha", label: "Tela recibida" },
  { key: "pantallaHecha", fechaKey: "pantallaHechaFecha", label: "Pantalla hecha" },
  { key: "entregado", fechaKey: "entregadoFecha", label: "Entregado" },
];

const FLUJO_DANIEL: HitoDef[] = [
  { key: "solicitadoDaniel", fechaKey: "solicitadoDanielFecha", label: "Solicitado a Daniel" },
  { key: "telaPedida", fechaKey: "telaPedidaFecha", label: "Pedir tela" },
  { key: "telaRecibida", fechaKey: "telaRecibidaFecha", label: "Recibir tela" },
  { key: "enviarTelaDaniel", fechaKey: "enviarTelaDanielFecha", label: "Enviar tela a Daniel" },
  { key: "recibirDaniel", fechaKey: "recibirDanielFecha", label: "Recibir de Daniel" },
  { key: "terminadoDaniel", fechaKey: "terminadoDanielFecha", label: "Terminado Daniel" },
  { key: "enviadoDaniel", fechaKey: "enviadoDanielFecha", label: "Enviado Daniel" },
  { key: "entregado", fechaKey: "entregadoFecha", label: "Entregado" },
];

export function flujoPedido(tipoProducto: string): HitoDef[] {
  return esPantalla(tipoProducto) ? FLUJO_PANTALLA : FLUJO_DANIEL;
}

/** Nº de hitos completados y el hito "actual" (siguiente pendiente). */
export function progresoPedido(p: Pedido, tipoProducto: string): { hechos: number; total: number; actualLabel: string } {
  const hitos = flujoPedido(tipoProducto);
  const hechos = hitos.filter((h) => p[h.key]).length;
  const siguiente = hitos.find((h) => !p[h.key]);
  const actualLabel = p.entregado ? "Entregado" : siguiente ? siguiente.label : hitos[hitos.length - 1].label;
  return { hechos, total: hitos.length, actualLabel };
}

// ───────────── Semáforo de ruta ideal ─────────────
export type RutaEstado = "verde" | "ambar" | "rojo";

/**
 * Reparte dias_plazo entre los hitos del flujo del pedido (según el tipo de
 * producto) y compara el hito real con el esperado para hoy.
 */
export function semaforoPedido(p: Pedido, tipoProducto = "", hoyMs?: number): { estado: RutaEstado; hitoActual: number; hitoEsperado: number; diasRestantes: number } {
  const hitos = flujoPedido(tipoProducto);
  const total = hitos.length;
  const ahora = hoyMs ?? Date.now();
  const creado = new Date(p.fechaCreacionPedido).getTime();
  const transcurridos = Math.max(0, (ahora - creado) / 86400000);
  const ratio = p.diasPlazo > 0 ? transcurridos / p.diasPlazo : 0;
  const hitoEsperado = Math.min(total, Math.round(ratio * total));
  const hitoActual = hitos.filter((h) => p[h.key]).length;

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
  "Banco": "banco",
};

export const INTERNAL_TO_CATALOG: Record<string, string> = {
  cabecero: "Cabecero",
  puf: "Puf",
  mesa: "Mesa de centro",
  pantalla: "Pantalla de lámpara",
  almohadon: "Almohadón",
  otro: "Cubrecanapé",
  banco: "Banco",
};


