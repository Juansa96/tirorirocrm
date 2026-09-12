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

// ───────────── Tapiceros ─────────────
// Catálogo de tapiceros a los que se puede asignar un pedido (tabla `tapiceros`).
// `activo=false` = baja lógica: no se ofrece al asignar pedidos nuevos, pero
// se conserva para resolver el nombre en pedidos históricos ya asignados.
export interface Tapicero {
  id: string;
  nombre: string;
  apellido: string;
  activo: boolean;
  orden: number;
  accessToken: string;        // token de acceso por enlace (vacío si no generado)
  accessTokenActivo: boolean; // el enlace está activo
  ocultaApellidos: boolean;   // true = este tapicero ve solo la inicial del apellido del cliente
}

// Enmascara el apellido del cliente a la inicial: "Borja Gil Delgado" → "Borja G.".
// Fallback de UI; el enmascarado real de la vista del tapicero se hace en el
// backend (panel_pedidos / mask_apellido). Nombre solo (sin apellido) se deja igual.
export function maskApellido(nombre: string): string {
  const s = (nombre || "").trim();
  if (!s) return s;
  const partes = s.split(/\s+/);
  if (partes.length < 2) return s;
  return `${partes[0]} ${partes[1].charAt(0).toUpperCase()}.`;
}

// Nombre para mostrar en la UI. Hay dos "Daniel": SIEMPRE nombre + apellido
// cuando lo haya, para que no se confundan.
export function tapiceroNombre(t: Tapicero | undefined | null): string {
  if (!t) return "";
  return t.apellido ? `${t.nombre} ${t.apellido}` : t.nombre;
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

// Motivos por los que un lead B2C se marca como "Closed Lost". Se pide SIEMPRE
// (obligatorio) al pasar a esa etapa; el comentario/observaciones es opcional.
export const RAZONES_PERDIDA_B2C = [
  "Ilocalizable / No responde",
  "Precio",
  "Compró en la competencia",
  "Duplicado / no cualificado",
  "Solo pedía información",
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
  // ── Origen de campaña (llega del formulario web) ──
  gclid: string;
  gbraid: string;
  wbraid: string;
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  utmTerm: string;
  utmContent: string;
  utmPlacement: string;
  utmId: string;
  fbclid: string;
  landingPath: string;
  landingPage: string;
  referrer: string;
  // ── Venta cerrada (Closed Won) ──
  ventaImporte: number | null;
  ventaFecha: string;         // YYYY-MM-DD o ""
}

// Campos de campaña, en el orden en que se muestran en la ficha.
export const CAMPANA_FIELDS: { key: keyof Lead; label: string }[] = [
  { key: "gclid", label: "gclid" },
  { key: "gbraid", label: "gbraid" },
  { key: "wbraid", label: "wbraid" },
  { key: "utmSource", label: "utm_source" },
  { key: "utmMedium", label: "utm_medium" },
  { key: "utmCampaign", label: "utm_campaign" },
  { key: "utmTerm", label: "utm_term" },
  { key: "utmContent", label: "utm_content" },
  { key: "utmPlacement", label: "utm_placement" },
  { key: "utmId", label: "utm_id" },
  { key: "fbclid", label: "fbclid" },
  { key: "landingPath", label: "landing_path" },
  { key: "landingPage", label: "landing_page" },
  { key: "referrer", label: "referrer" },
];

/* ── Canal derivado (no se guarda en BD, se calcula) ───────────── */
export const CANALES = ["Meta Ads", "Google Ads", "Orgánico", "Directo"] as const;
export type Canal = (typeof CANALES)[number];

type CanalSource = Pick<Lead, "utmSource" | "gclid" | "referrer"> & Partial<Lead>;

export function canalOf(lead: CanalSource): Canal {
  const src = (lead.utmSource ?? "").trim().toLowerCase();
  const hasUtm = !!(
    src || (lead.utmMedium ?? "") || (lead.utmCampaign ?? "") ||
    (lead.utmContent ?? "") || (lead.utmId ?? "") || (lead.utmTerm ?? "")
  );
  if (src === "meta" || src === "facebook" || src === "instagram" || (lead.fbclid ?? "").trim()) return "Meta Ads";
  if ((lead.gclid ?? "").trim() || src === "google") return "Google Ads";
  if ((lead.referrer ?? "").trim() && !hasUtm) return "Orgánico";
  return "Directo";
}

export const CANAL_COLORS: Record<Canal, string> = {
  "Meta Ads": "bg-blue-50 text-blue-700 border-blue-200",
  "Google Ads": "bg-amber-50 text-amber-700 border-amber-200",
  "Orgánico": "bg-emerald-50 text-emerald-700 border-emerald-200",
  "Directo": "bg-slate-100 text-slate-600 border-slate-200",
};



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
// El número de pedido PUEDE repetirse (varios pedidos del mismo encargo).
// Para distinguirlos se puede añadir una letra opcional: 12, 12A, 12B…
export function numeroPedidoLabel(numero: number | null | undefined, sufijo?: string | null): string {
  if (numero == null) return "";
  return `${numero}${(sufijo ?? "").trim().toUpperCase()}`;
}

export interface Pedido {
  id: string;
  numero: number | null;      // número del pedido (correlativo, puede repetirse); null = sin número
  numeroSufijo: string;       // letra opcional para diferenciar números repetidos ("A", "B"…)
  productoLeadId: string;
  leadId: string;
  clienteNombreLibre: string;
  fechaCreacionPedido: string;
  diasPlazo: number;
  fechaLimite: string;        // YYYY-MM-DD
  fechaEntregaReal: string;
  pagado50: boolean;
  creadoManualmente: boolean;
  estadoPedido: EstadoPedido; // derivado de los hitos/marcadores (ver estadoDePedido)
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
  // ── Vista de tapicero (Fase 2) ──
  enviadoTapicero: boolean;         // el pedido está enviado al panel del tapicero
  enviadoTapiceroFecha: string;
  telaEstado: string;               // 'pendiente' | 'enviada' | 'recibida'
  telaEstadoPor: string;            // quién marcó el último estado de tela
  telaEstadoFecha: string;
  iniciadoTapicero: boolean;         // el tapicero ha empezado a fabricarlo
  iniciadoTapiceroPor: string;
  iniciadoTapiceroFecha: string;
  terminadoTapicero: boolean;
  terminadoTapiceroPor: string;
  terminadoTapiceroFecha: string;
  // ── Recogido por Juan (marcador en pasos_tapicero) ──
  recogido: boolean;
  recogidoFecha: string;
  recogidoPor: string;
  // ── Valores anteriores de datos cambiados (marcador @antes en pasos_tapicero) ──
  // campo → último valor anterior, para pintarlo tachado en las cards. Se vacía
  // al llegar a "Recogido".
  antes: Record<string, string>;
  // ── Correo de entrega al cliente (marcadores en pasos_tapicero) ──
  emailEntregaFecha: string;         // ISO del último envío, "" si no se ha enviado
  emailEntregaA: string;
  emailEntregaPor: string;
  montaje: string;                  // 'colgar' | 'apoyar' | ''
  ordenProduccion: number | null;   // orden manual de trabajo (1º, 2º…); null = sin orden
  notaTapicero: string;             // comentario que SÍ ve el tapicero (dirección de tela, etc.)
  fechaRecogida: string;            // fecha prevista de recogida por Juan en el taller (YYYY-MM-DD)
  clienteNombre: string;            // nombre de cliente denormalizado (el tapicero no ve leads)
  tapiceroId: string;  // uuid del tapicero asignado actualmente, o "" si sin asignar
  // Sello por paso: stepKey → tapicero_id de quien lo hizo. Se rellena solo al
  // reasignar (los pasos ya hechos se sellan con el tapicero saliente). Los
  // pasos sin sello se muestran con el tapicero actual (tapiceroId).
  pasosTapicero: Record<string, string>;
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
  // ── Fase 2 ──
  telaFotoUrl: string;        // foto (de la web o subida)
  telaBibliotecaId: string;   // ref a telas_biblioteca (si vino de una subida)
  telaColeccion: string;      // colección/proveedor (denormalizado para el tapicero)
  mismaQueFrontal: boolean;   // "misma tela que el frontal"
}

// Archivo adjunto a un pedido (plantilla de corte o etiqueta CTT).
export interface PedidoArchivo {
  id: string;
  pedidoId: string;
  tipo: string;       // 'plantilla' | 'etiqueta_ctt' | 'etiqueta_envio' | 'referencia'
  nombre: string;
  storagePath: string;
  url: string;
  subidoPor: string;
  transportista: string; // solo etiqueta de envío: 'ctt' | 'mrw' | texto libre
  createdAt: string;
}

// Tela de la biblioteca (subida a mano) o de la web (leída de /telas.json).
export interface TelaBiblioteca {
  id: string;
  nombre: string;
  fotoUrl: string;
  coleccion: string;   // basica | premium | otra
  origen: string;      // subida | web
}

// Normaliza un nombre de tela para deduplicar/buscar (sin acentos, minúsculas,
// espacios colapsados). Misma idea que mismoModelo pero para telas.
export function normNombreTela(s: string): string {
  return (s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase().replace(/\s+/g, " ");
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
  { key: "solicitadoDaniel", fechaKey: "solicitadoDanielFecha", label: "Solicitar a Daniel" },
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

// ───────────── Marcadores del tapicero (sin columnas nuevas) ─────────────
// "Iniciado" (el tapicero ha empezado) y "cambio tras envío" (el equipo cambió
// algo ya en su panel) se guardan DENTRO de `pasos_tapicero` (JSONB que ya
// existe en la BD), con claves reservadas con prefijo "@" que nunca chocan con
// las claves de hito (camelCase). Así no hace falta ninguna migración.
export const PASO_INICIADO = "@iniciado";           // valor: fecha ISO
export const PASO_INICIADO_POR = "@iniciadoPor";    // valor: nombre
export const PASO_RECOGIDO = "@recogido";           // valor: fecha ISO (Juan ya lo tiene)
export const PASO_RECOGIDO_POR = "@recogidoPor";    // valor: nombre
// Último valor anterior de cada dato cambiado (JSON campo → texto). Sustituye
// a los antiguos avisos "@cambio": en vez de avisar, la card enseña el valor
// viejo tachado junto al nuevo.
export const PASO_ANTES = "@antes";
// Claves antiguas del aviso de cambio: ya no se escriben; se limpian al tocar
// pasos_tapicero.
export const PASO_CAMBIO_LEGACY = ["@cambio", "@cambioDetalle"] as const;
// Correo de entrega al cliente (lo envía el equipo desde la ficha del pedido).
export const PASO_EMAIL_ENTREGA = "@emailEntrega";        // valor: fecha ISO del envío
export const PASO_EMAIL_ENTREGA_A = "@emailEntregaA";     // valor: dirección
export const PASO_EMAIL_ENTREGA_POR = "@emailEntregaPor"; // valor: quién lo envió

// ───────────── Historial "antes ponía …" ─────────────
// Los cambios de medidas, telas, montaje y precio se apuntan en `audit_log`
// (tabla que ya existe) con `tabla` = "productos_lead:<id>" o "pedidos:<id>",
// para poder enseñar bajo el campo una línea "Antes: 150 × 100 · Rocío, 2 sep"
// sin columnas nuevas. `campo` usa estas claves:
export const HISTORIAL_LABELS: Record<string, string> = {
  medidas: "medidas",
  tela_frontal: "tela principal",
  tela_lateral: "tela lateral",
  tela_vivo: "tela del vivo",
  montaje: "montaje",
  precio_producto: "precio del producto",
  precio_pedido: "precio del pedido",
};
export const tablaHistorialProducto = (productoId: string) => `productos_lead:${productoId}`;
export const tablaHistorialPedido = (pedidoId: string) => `pedidos:${pedidoId}`;

// Etiquetas de los campos que pueden llevar valor anterior tachado.
export const ANTES_LABELS: Record<string, string> = {
  medidas: "medidas",
  tela_frontal: "tela principal",
  tela_lateral: "tela lateral",
  tela_vivo: "tela del vivo",
  cantidad: "cantidad",
  modelo: "producto",
  montaje: "montaje",
  nota_tapicero: "indicaciones",
  fecha_recogida: "fecha de recogida",
  precio: "precio",
};

// Lee el mapa de valores anteriores guardado en pasos_tapicero["@antes"].
export function antesDe(pasos: Record<string, string> | null | undefined): Record<string, string> {
  const raw = pasos?.[PASO_ANTES];
  if (!raw) return {};
  try {
    const v = JSON.parse(raw) as unknown;
    if (!v || typeof v !== "object" || Array.isArray(v)) return {};
    const out: Record<string, string> = {};
    for (const [k, x] of Object.entries(v as Record<string, unknown>)) if (typeof x === "string" && x) out[k] = x;
    return out;
  } catch { return {}; }
}

// Devuelve pasos_tapicero con el valor anterior de `campo` apuntado (solo se
// conserva el ÚLTIMO anterior). Si el anterior está vacío, se quita la marca.
export function conAntes(pasos: Record<string, string> | null | undefined, cambios: Record<string, string | null | undefined>): Record<string, string> {
  const antes = antesDe(pasos);
  for (const [campo, valor] of Object.entries(cambios)) {
    const v = String(valor ?? "").trim();
    if (v) antes[campo] = v; else delete antes[campo];
  }
  const next: Record<string, string> = { ...(pasos || {}) };
  for (const k of PASO_CAMBIO_LEGACY) delete next[k];
  if (Object.keys(antes).length > 0) next[PASO_ANTES] = JSON.stringify(antes); else delete next[PASO_ANTES];
  return next;
}

// Deriva los marcadores del tapicero a partir de `pasos_tapicero`.
export function marcadoresTapicero(pasos: Record<string, string> | null | undefined): {
  iniciado: boolean; iniciadoFecha: string; iniciadoPor: string;
  recogido: boolean; recogidoFecha: string; recogidoPor: string;
  antes: Record<string, string>;
  emailEntregaFecha: string; emailEntregaA: string; emailEntregaPor: string;
} {
  const p = pasos || {};
  return {
    iniciado: !!p[PASO_INICIADO],
    iniciadoFecha: p[PASO_INICIADO] || "",
    iniciadoPor: p[PASO_INICIADO_POR] || "",
    recogido: !!p[PASO_RECOGIDO],
    recogidoFecha: p[PASO_RECOGIDO] || "",
    recogidoPor: p[PASO_RECOGIDO_POR] || "",
    antes: antesDe(p),
    emailEntregaFecha: p[PASO_EMAIL_ENTREGA] || "",
    emailEntregaA: p[PASO_EMAIL_ENTREGA_A] || "",
    emailEntregaPor: p[PASO_EMAIL_ENTREGA_POR] || "",
  };
}

// ───────────── Estado del pedido (cinco estados, uno solo a la vez) ─────────────
// Pendiente → En marcha → Terminado → Recogido → Entregado al cliente.
// No hay columna nueva: el estado se DERIVA de campos que ya existen, así que
// funciona aunque la base de datos no tenga aplicada la migración del trigger.
//   · Entregado al cliente ⇐ `entregado` (último hito de la ruta).
//   · Recogido            ⇐ marcador "@recogido" en pasos_tapicero.
//   · Terminado           ⇐ terminado_tapicero (⇄ hito Terminado Daniel / Pantalla hecha).
//   · En marcha           ⇐ marcador "@iniciado" en pasos_tapicero.
//   · Pendiente           ⇐ el resto.
// La columna `estado_pedido` (trigger) guarda el mismo valor como caché.
export const ESTADOS_PEDIDO = ["Pendiente", "En marcha", "Terminado", "Recogido", "Entregado al cliente"] as const;
export type EstadoPedido = (typeof ESTADOS_PEDIDO)[number];
export const ESTADO_ENTREGADO_CLIENTE: EstadoPedido = "Entregado al cliente";
// Estados que existen para el TAPICERO (nunca ve "Entregado al cliente").
export const ESTADOS_TAPICERO: EstadoPedido[] = ["Pendiente", "En marcha", "Terminado", "Recogido"];

export const ESTADO_PEDIDO_COLORS: Record<EstadoPedido, { bg: string; text: string; dot: string }> = {
  "Pendiente": { bg: "bg-slate-100", text: "text-slate-600", dot: "bg-slate-400" },
  "En marcha": { bg: "bg-amber-100", text: "text-amber-700", dot: "bg-amber-500" },
  "Terminado": { bg: "bg-sky-100", text: "text-sky-700", dot: "bg-sky-500" },
  "Recogido": { bg: "bg-violet-100", text: "text-violet-700", dot: "bg-violet-500" },
  "Entregado al cliente": { bg: "bg-emerald-100", text: "text-emerald-700", dot: "bg-emerald-500" },
};

export function indiceEstado(e: EstadoPedido): number {
  return ESTADOS_PEDIDO.indexOf(e);
}

// Campos mínimos de los que se deriva el estado (valen Pedido y filas crudas
// ya mapeadas a camelCase).
export interface FuenteEstado {
  entregado: boolean;
  terminadoTapicero: boolean;
  terminadoDaniel?: boolean;
  pantallaHecha?: boolean;
  pasosTapicero: Record<string, string> | null | undefined;
}

export function estadoDePedido(p: FuenteEstado): EstadoPedido {
  const pasos = p.pasosTapicero || {};
  if (p.entregado) return "Entregado al cliente";
  if (pasos[PASO_RECOGIDO]) return "Recogido";
  if (p.terminadoTapicero || p.terminadoDaniel || p.pantallaHecha) return "Terminado";
  if (pasos[PASO_INICIADO]) return "En marcha";
  return "Pendiente";
}

// Campos que toca un cambio de estado (para poder aplicarlo igual en el
// cliente y en el servidor).
export interface PatchEstado {
  pasosTapicero?: Record<string, string>;
  terminadoTapicero?: boolean; terminadoTapiceroPor?: string; terminadoTapiceroFecha?: string;
  terminadoDaniel?: boolean; terminadoDanielFecha?: string;
  pantallaHecha?: boolean; pantallaHechaFecha?: string;
  enviadoDaniel?: boolean; enviadoDanielFecha?: string;
  entregado?: boolean; entregadoFecha?: string;
}

export interface FuentePatchEstado extends FuenteEstado {
  terminadoTapiceroPor?: string; terminadoTapiceroFecha?: string;
  terminadoDanielFecha?: string; pantallaHechaFecha?: string;
  enviadoDaniel?: boolean; enviadoDanielFecha?: string;
  entregadoFecha?: string;
  tapiceroId?: string;
}

// Parche que deja el pedido EXACTAMENTE en `estado` (hacia delante o hacia
// atrás): marca lo que hay por debajo y limpia lo que hay por encima, de modo
// que el pedido está siempre en un único estado. Al llegar a "Recogido" se
// borran los valores anteriores tachados (ya no hace falta enseñarlos).
export function patchParaEstado(
  p: FuentePatchEstado,
  estado: EstadoPedido,
  opts: { por: string; ahora: string; tipoProducto: string },
): PatchEstado {
  const idx = indiceEstado(estado);
  const hoy = opts.ahora.slice(0, 10);
  const pantalla = esPantalla(opts.tipoProducto);
  const hitoFin = pantalla ? "pantallaHecha" : "terminadoDaniel";
  const pasos: Record<string, string> = { ...(p.pasosTapicero || {}) };
  for (const k of PASO_CAMBIO_LEGACY) delete pasos[k];
  const out: PatchEstado = {};

  // En marcha
  if (idx >= 1) {
    if (!pasos[PASO_INICIADO]) { pasos[PASO_INICIADO] = opts.ahora; pasos[PASO_INICIADO_POR] = opts.por; }
  } else {
    delete pasos[PASO_INICIADO]; delete pasos[PASO_INICIADO_POR];
  }

  // Terminado (botón del tapicero ⇄ hito de la ruta de producción)
  if (idx >= 2) {
    if (!p.terminadoTapicero) { out.terminadoTapicero = true; out.terminadoTapiceroPor = p.terminadoTapiceroPor || opts.por; out.terminadoTapiceroFecha = p.terminadoTapiceroFecha || opts.ahora; }
    if (pantalla) { if (!p.pantallaHecha) { out.pantallaHecha = true; out.pantallaHechaFecha = p.pantallaHechaFecha || hoy; } }
    else if (!p.terminadoDaniel) { out.terminadoDaniel = true; out.terminadoDanielFecha = p.terminadoDanielFecha || hoy; }
    if (p.tapiceroId && !pasos[hitoFin]) pasos[hitoFin] = p.tapiceroId;
  } else {
    if (p.terminadoTapicero) { out.terminadoTapicero = false; out.terminadoTapiceroPor = ""; out.terminadoTapiceroFecha = ""; }
    if (p.terminadoDaniel) { out.terminadoDaniel = false; out.terminadoDanielFecha = ""; }
    if (p.pantallaHecha) { out.pantallaHecha = false; out.pantallaHechaFecha = ""; }
    delete pasos.terminadoDaniel; delete pasos.pantallaHecha;
  }

  // Recogido por Juan (en el flujo Daniel equivale al hito "Enviado Daniel")
  if (idx >= 3) {
    if (!pasos[PASO_RECOGIDO]) { pasos[PASO_RECOGIDO] = opts.ahora; pasos[PASO_RECOGIDO_POR] = opts.por; }
    if (!pantalla && !p.enviadoDaniel) { out.enviadoDaniel = true; out.enviadoDanielFecha = p.enviadoDanielFecha || hoy; }
    if (!pantalla && p.tapiceroId && !pasos.enviadoDaniel) pasos.enviadoDaniel = p.tapiceroId;
    delete pasos[PASO_ANTES];
  } else {
    delete pasos[PASO_RECOGIDO]; delete pasos[PASO_RECOGIDO_POR];
    if (p.enviadoDaniel) { out.enviadoDaniel = false; out.enviadoDanielFecha = ""; }
    delete pasos.enviadoDaniel;
  }

  // Entregado al cliente
  if (idx >= 4) {
    if (!p.entregado) { out.entregado = true; out.entregadoFecha = p.entregadoFecha || hoy; }
  } else if (p.entregado) {
    out.entregado = false; out.entregadoFecha = "";
  }

  if (JSON.stringify(pasos) !== JSON.stringify(p.pasosTapicero || {})) out.pasosTapicero = pasos;
  return out;
}

// Etiqueta del hito personalizada con el tapicero asignado. Los pasos del
// flujo llevan "Daniel" cableado (histórico); si el pedido tiene un tapicero
// asignado, se sustituye por su nombre completo para no confundir a los dos
// Daniel. Sin tapicero asignado, se deja la etiqueta tal cual.
export function hitoLabel(label: string, nombreTapicero: string): string {
  if (!nombreTapicero) return label;
  return label.replace(/Daniel/g, nombreTapicero);
}

// Cascada de marcado de pasos (Tarea 3). Reglas:
//   · La cascada SOLO se dispara al MARCAR uno de los dos ÚLTIMOS pasos
//     (último o penúltimo): entonces se marcan automáticamente todos los
//     anteriores que estén sin marcar.
//   · Al marcar el antepenúltimo o cualquier paso anterior → solo ese paso.
//   · Al DESMARCAR nunca hay cascada: se desmarca únicamente ese paso y los
//     demás se quedan como estaban.
// La lógica es por POSICIÓN dentro de la secuencia, no por nombre de paso, así
// que sigue funcionando si se añade o quita un paso.
//
// Fechas: el paso sobre el que se hace clic recibe la fecha `hoy` (si no tenía
// ya una), como en el marcado manual normal. Los pasos marcados EN CASCADA se
// quedan SIN fecha (decisión del cliente): hechos pero con la fecha en blanco.
export function cascadaMarcado(
  hitos: HitoDef[],
  index: number,
  checked: boolean,
  pedido: Pedido,
  hoy: string,
): Partial<Pedido> {
  const patch: Record<string, unknown> = {};
  const h = hitos[index];
  patch[h.key] = checked;
  if (!checked) {
    // Desmarcar: solo este paso, sin tocar los demás ni sus fechas.
    return patch as Partial<Pedido>;
  }
  // Marcar: fecha de hoy en el paso clicado si aún no tenía.
  if (!pedido[h.fechaKey]) patch[h.fechaKey] = hoy;
  // Cascada solo desde los dos últimos pasos de la secuencia.
  const disparaCascada = index >= hitos.length - 2;
  if (disparaCascada) {
    for (let i = 0; i < index; i++) {
      const prev = hitos[i];
      if (!pedido[prev.key]) patch[prev.key] = true; // marcado por cascada, sin fecha
    }
  }
  return patch as Partial<Pedido>;
}

/** Nº de hitos completados y el hito "actual" (siguiente pendiente). */
export function progresoPedido(p: Pedido, tipoProducto: string): { hechos: number; total: number; actualLabel: string } {
  const hitos = flujoPedido(tipoProducto);
  const hechos = hitos.filter((h) => p[h.key]).length;
  const siguiente = hitos.find((h) => !p[h.key]);
  const actualLabel = p.entregado ? "Entregado" : siguiente ? siguiente.label : hitos[hitos.length - 1].label;
  return { hechos, total: hitos.length, actualLabel };
}

// ───────────── Semáforo de plazo ─────────────
export type RutaEstado = "verde" | "ambar" | "rojo";

/**
 * El color del pedido depende SOLO de la fecha límite real:
 *   · rojo  → ya se ha pasado de la fecha (atrasado de verdad).
 *   · ámbar → faltan 1 o 2 días (ojo, que termina el plazo).
 *   · verde → aún hay margen (o ya está entregado).
 *
 * El ritmo de hitos (dónde "debería" ir el pedido según el plazo) YA NO pinta
 * el pedido de rojo/ámbar: se devuelve como hitoEsperado/hitoActual para poder
 * mostrar un mensajito informativo (ver mensajeRitmoPedido), pero nunca marca
 * el pedido como retrasado por no ir marcando pasos.
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
  if (p.entregado) estado = "verde";
  else if (ahora > fechaLim) estado = "rojo";     // pasado de fecha → atrasado
  else if (diasRestantes <= 2) estado = "ambar";  // faltan 1-2 días → aviso
  else estado = "verde";

  return { estado, hitoActual, hitoEsperado, diasRestantes };
}

/**
 * Mensajito informativo de RITMO (no es un estado de retraso): si el pedido va
 * por detrás de donde debería según el plazo, sugiere en qué paso debería estar
 * ya, para que dé tiempo. Devuelve "" si va bien, si está entregado, o si ya
 * está atrasado de verdad (en ese caso manda la fecha, no el ritmo).
 */
export function mensajeRitmoPedido(p: Pedido, tipoProducto = "", nombreTapicero = "", hoyMs?: number): string {
  if (p.entregado) return "";
  const { hitoActual, hitoEsperado, diasRestantes } = semaforoPedido(p, tipoProducto, hoyMs);
  if (diasRestantes < 0) return "";           // ya atrasado: no hace falta el aviso de ritmo
  if (hitoEsperado <= hitoActual) return "";  // va al día o por delante
  const hitos = flujoPedido(tipoProducto);
  const idxEsperado = Math.min(hitos.length, hitoEsperado) - 1;
  // Usa el nombre del tapicero asignado en vez del "Daniel" cableado del flujo.
  const labelEsperado = idxEsperado >= 0 ? hitoLabel(hitos[idxEsperado].label, nombreTapicero) : "";
  if (!labelEsperado) return "";
  return `Para llegar a tiempo ya deberías ir por «${labelEsperado}».`;
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
  "Producto libre": "otro",
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


