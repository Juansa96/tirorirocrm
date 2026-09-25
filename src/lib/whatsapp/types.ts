// ══════════════════════════════════════════════════════════════════════════
// Integración de WhatsApp — tipos compartidos entre servidor y navegador.
//
// Flujo: el proveedor (coexistencia app + Cloud API) manda cada mensaje al
// webhook → se guarda en whatsapp_mensajes → una IA lee la conversación,
// la enlaza con el cliente del CRM por teléfono, rellena los datos vacíos y
// deja PROPUESTAS (etapa, producto, fusión…) que el equipo acepta o rechaza
// desde /whatsapp. Ver procesar.server.ts para las reglas.
// ══════════════════════════════════════════════════════════════════════════

export type EstadoConversacion = "nueva" | "vinculada" | "no_cliente" | "ignorada";
export type OrigenConversacion = "webhook" | "historial";
export type DireccionMensaje = "entrante" | "saliente";
export type EstadoPropuesta = "pendiente" | "aceptada" | "rechazada";

// Tipos de propuesta que genera la IA (el equipo decide con un toque):
//  · crear_lead       → alguien nuevo: crear el cliente (o enlazar con un duplicado)
//  · vincular_lead    → no está claro con qué cliente enlazar (o hay varios)
//  · cambiar_etapa    → mover el lead de etapa en el pipeline
//  · actualizar_campo → un dato del cliente distinto al que hay en la ficha
//  · producto         → crear o corregir un producto (medidas, tela…)
//  · tarea            → compromiso que se ha adquirido en el chat
//  · nuevo_encargo    → cliente ya entregado que pide algo nuevo
export type TipoPropuesta = "crear_lead" | "vincular_lead" | "cambiar_etapa" | "actualizar_campo" | "producto" | "tarea" | "nuevo_encargo";

export interface ProductoIA {
  tipo: string;               // cabecero | banco | cojin | puf | mesa | pantalla | otro
  modelo?: string | null;     // forma / modelo si se menciona (Conta, Calobra…)
  ancho?: number | null;
  alto?: number | null;
  fondo?: number | null;
  tela?: string | null;
  color?: string | null;
  montaje?: "colgar" | "apoyar" | null;
  cantidad?: number | null;
  precio?: number | null;     // precio que se le ha dado al cliente, si aparece
  notas?: string | null;
}

export interface ContactoIA {
  nombre?: string | null;
  ciudad?: string | null;
  provincia?: string | null;
  email?: string | null;
  direccion?: string | null;
}

export interface SiguienteAccionIA {
  descripcion: string;
  fecha?: string | null;      // YYYY-MM-DD
}

// Resultado del análisis de una conversación por la IA.
export interface AnalisisIA {
  es_cliente: boolean;                 // ¿es (posible) cliente? proveedores, spam, personal → false
  resumen: string;                     // 1-3 frases: qué quiere y en qué punto está
  contacto: ContactoIA;
  productos: ProductoIA[];
  etapa_sugerida: string | null;       // Discovery | Primer Contacto | Negotiation | On Hold | Closed Won | Closed Lost
  etapa_motivo: string;
  razon_perdida?: string | null;       // si Closed Lost: una de RAZONES_PERDIDA_B2C
  venta_importe?: number | null;       // si Closed Won y se conoce
  nuevo_encargo: boolean;              // cliente antiguo que pide otra cosa
  novedades: string[];                 // hechos nuevos relevantes para la ficha
  siguiente_accion?: SiguienteAccionIA | null;
  espera_respuesta: boolean;           // el último mensaje es del cliente y está sin contestar
  duda_identidad?: string | null;
}

export interface WaConversacion {
  id: string;
  telefono: string;                    // wa_id: dígitos con prefijo de país (34…)
  nombreWa: string;
  leadId: string | null;
  estado: EstadoConversacion;
  origen: OrigenConversacion;
  resumen: string;
  datos: Partial<AnalisisIA> & { auto?: string[]; nota_hash?: string; modo?: "normal" | "historico" };
  ultimoMensajeAt: string;
  ultimoMensajeEntranteAt: string;
  ultimoAnalisisAt: string;
  analizadoHasta: string;
  mensajes: number;
  createdAt: string;
  updatedAt: string;
}

export interface WaMensaje {
  id: string;
  waId: string;
  conversacionId: string;
  direccion: DireccionMensaje;
  tipo: string;
  texto: string;
  enviadoAt: string;
}

export interface WaPropuesta {
  id: string;
  conversacionId: string;
  leadId: string | null;
  tipo: TipoPropuesta;
  clave: string;
  payload: Record<string, unknown>;
  motivo: string;
  estado: EstadoPropuesta;
  resueltaPor: string;
  resueltaAt: string;
  createdAt: string;
}

export interface WaConfig {
  webhookToken: string;
  verifyToken: string;
  modelo: string;
  activo: boolean;
  conectadoAt: string;
  ultimoEventoAt: string;
  ultimoProcesoAt: string;
  ultimoError: string;
  ultimoErrorAt: string;
  numeroNegocio: string;
  vendedorDefecto: string;
}

export interface WaEvento {
  id: number;
  recibidoAt: string;
  campo: string;
  mensajes: number;
  error: string;
}

// ── Mapeos fila → objeto ────────────────────────────────────────────────────
type Row = Record<string, unknown>;
const s = (v: unknown): string => (v == null ? "" : String(v));

export function mapWaConversacion(r: Row): WaConversacion {
  return {
    id: s(r.id),
    telefono: s(r.telefono),
    nombreWa: s(r.nombre_wa),
    leadId: r.lead_id ? s(r.lead_id) : null,
    estado: (s(r.estado) || "nueva") as EstadoConversacion,
    origen: (s(r.origen) || "webhook") as OrigenConversacion,
    resumen: s(r.resumen),
    datos: (r.datos && typeof r.datos === "object" ? r.datos : {}) as WaConversacion["datos"],
    ultimoMensajeAt: s(r.ultimo_mensaje_at),
    ultimoMensajeEntranteAt: s(r.ultimo_mensaje_entrante_at),
    ultimoAnalisisAt: s(r.ultimo_analisis_at),
    analizadoHasta: s(r.analizado_hasta),
    mensajes: Number(r.mensajes) || 0,
    createdAt: s(r.created_at),
    updatedAt: s(r.updated_at),
  };
}

export function mapWaMensaje(r: Row): WaMensaje {
  return {
    id: s(r.id),
    waId: s(r.wa_id),
    conversacionId: s(r.conversacion_id),
    direccion: (s(r.direccion) === "saliente" ? "saliente" : "entrante"),
    tipo: s(r.tipo) || "text",
    texto: s(r.texto),
    enviadoAt: s(r.enviado_at),
  };
}

export function mapWaPropuesta(r: Row): WaPropuesta {
  return {
    id: s(r.id),
    conversacionId: s(r.conversacion_id),
    leadId: r.lead_id ? s(r.lead_id) : null,
    tipo: s(r.tipo) as TipoPropuesta,
    clave: s(r.clave),
    payload: (r.payload && typeof r.payload === "object" ? r.payload : {}) as Record<string, unknown>,
    motivo: s(r.motivo),
    estado: (s(r.estado) || "pendiente") as EstadoPropuesta,
    resueltaPor: s(r.resuelta_por),
    resueltaAt: s(r.resuelta_at),
    createdAt: s(r.created_at),
  };
}

export function mapWaConfig(r: Row): WaConfig {
  return {
    webhookToken: s(r.webhook_token),
    verifyToken: s(r.verify_token),
    modelo: s(r.modelo),
    activo: r.activo !== false,
    conectadoAt: s(r.conectado_at),
    ultimoEventoAt: s(r.ultimo_evento_at),
    ultimoProcesoAt: s(r.ultimo_proceso_at),
    ultimoError: s(r.ultimo_error),
    ultimoErrorAt: s(r.ultimo_error_at),
    numeroNegocio: s(r.numero_negocio),
    vendedorDefecto: s(r.vendedor_defecto),
  };
}

export function mapWaEvento(r: Row): WaEvento {
  return { id: Number(r.id) || 0, recibidoAt: s(r.recibido_at), campo: s(r.campo), mensajes: Number(r.mensajes) || 0, error: s(r.error) };
}

// ── Teléfonos ───────────────────────────────────────────────────────────────
/** Solo dígitos del wa_id (Meta ya lo manda así: 34660786453). */
export function digitosTelefono(t: string | null | undefined): string {
  return (t ?? "").replace(/\D/g, "");
}

/** Los últimos 9 dígitos: clave para casar con leads.telefono (ver normTel en duplicados.ts). */
export function claveTelefono(t: string | null | undefined): string {
  const d = digitosTelefono(t);
  return d.length >= 9 ? d.slice(-9) : d;
}

/** "34660786453" → "+34 660 786 453" (lo que se guarda en la ficha del cliente). */
export function formatTelefonoWa(waId: string): string {
  const d = digitosTelefono(waId);
  if (!d) return "";
  if (d.length === 11 && d.startsWith("34")) {
    const n = d.slice(2);
    return `+34 ${n.slice(0, 3)} ${n.slice(3, 6)} ${n.slice(6)}`;
  }
  if (d.length === 9) return `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}`;
  return `+${d}`;
}

/** Nombre a mostrar para una conversación. */
export function nombreConversacion(c: Pick<WaConversacion, "nombreWa" | "telefono" | "datos">, leadNombre?: string): string {
  if (leadNombre?.trim()) return leadNombre.trim();
  const ia = c.datos?.contacto?.nombre?.trim();
  if (ia) return ia;
  if (c.nombreWa.trim()) return c.nombreWa.trim();
  return formatTelefonoWa(c.telefono);
}

/** "hace 5 min", "hace 3 h", "ayer", "12 sep". */
export function tiempoRelativo(iso: string): string {
  if (!iso) return "";
  const ms = Date.now() - Date.parse(iso);
  if (Number.isNaN(ms)) return "";
  const min = Math.round(ms / 60000);
  if (min < 1) return "ahora";
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.round(h / 24);
  if (d === 1) return "ayer";
  if (d < 7) return `hace ${d} días`;
  return new Date(iso).toLocaleDateString("es-ES", { day: "2-digit", month: "short" });
}

// Etiquetas cortas de los tipos de propuesta (UI).
export const TIPO_PROPUESTA_LABEL: Record<TipoPropuesta, string> = {
  crear_lead: "Cliente nuevo por WhatsApp",
  vincular_lead: "¿Con qué cliente va?",
  cambiar_etapa: "Cambiar de etapa",
  actualizar_campo: "Dato distinto en la ficha",
  producto: "Producto",
  tarea: "Tarea",
  nuevo_encargo: "Nuevo encargo",
};

export const CAMPO_LABEL: Record<string, string> = {
  nombre: "Nombre",
  ciudad: "Ciudad",
  provincia: "Provincia",
  email: "Email",
  direccion: "Dirección",
};

/** Separa la etiqueta de una nota de voz transcrita: "[Nota de voz] «hola»" → { etiqueta, texto }. */
export function partesAudio(texto: string): { etiqueta: string; texto: string } | null {
  const m = /^\[(Nota de voz|Audio)\]\s*(?:«([\s\S]*)»|(.*))$/.exec(texto.trim());
  if (!m) return null;
  return { etiqueta: m[1], texto: (m[2] ?? m[3] ?? "").trim() };
}
