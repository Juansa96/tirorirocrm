// ══════════════════════════════════════════════════════════════════════════
// src/lib/catalogo.ts — FUENTE ÚNICA DE VERDAD del catálogo del CRM.
//
// Reglas:
//  - Toda opción tiene { activo, legacy? }. `activo=false` → NO aparece en
//    los selectores de creación. `legacy=true` → sigue existiendo para
//    resolver etiquetas de datos históricos, pero no se ofrece.
//  - Cambiar aquí un precio NO altera ningún registro ya guardado
//    (los `precio_unitario` viven en cada fila de productos_lead).
//  - Los alias de `tipo` en el endpoint público se normalizan aquí también,
//    para que la BD nunca reciba variantes con acentos o mayúsculas.
// ══════════════════════════════════════════════════════════════════════════

// ── Tipos canónicos ────────────────────────────────────────────────────────

export const TIPOS_VALIDOS = ["cabecero", "banco", "cojin", "puf", "mesa", "pantalla", "otro"] as const;
export type TipoProductoKey = (typeof TIPOS_VALIDOS)[number];

// Etiqueta legible en toda la UI (badges, filtros, agrupaciones).
// Ojo: el tipo interno es "cojin" pero al usuario se le muestra "Almohadón".
export const TIPO_LABEL: Record<TipoProductoKey, string> = {
  cabecero: "Cabecero",
  banco: "Banco",
  cojin: "Almohadón",
  puf: "Puf",
  mesa: "Mesa de centro",
  pantalla: "Pantalla de lámpara",
  otro: "Otro producto",
};

// Alias de entrada → tipo canónico. Se normaliza quitando acentos, minúsculas
// y espacios antes de comparar (ver normalizeTipo).
const TIPO_ALIAS: Record<string, TipoProductoKey> = {
  cabecero: "cabecero",
  cabeceros: "cabecero",
  banco: "banco",
  bancos: "banco",
  oyambre: "banco",
  cojin: "cojin",
  cojines: "cojin",
  almohadon: "cojin",
  almohadones: "cojin",
  almohada: "cojin",
  puf: "puf",
  pufs: "puf",
  pouf: "puf",
  mesa: "mesa",
  mesas: "mesa",
  "mesa-de-centro": "mesa",
  "mesa de centro": "mesa",
  pantalla: "pantalla",
  pantallas: "pantalla",
  "pantalla-de-lampara": "pantalla",
  "pantalla de lampara": "pantalla",
  lampara: "pantalla",
  otro: "otro",
  otros: "otro",
  varios: "otro",
  plaid: "otro",
  cubrecanape: "otro",
  cubrecanapes: "otro",
};

export function stripDiacritics(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

// Compara dos etiquetas de modelo/forma tolerando acentos, mayúsculas, espacios
// dobles y trims. Sustituye a `a === b` en cualquier campo de texto que venga
// tanto de payloads externos como de datos históricos. Cadena vacía nunca
// hace match (aunque las dos estén vacías) — evita colapsar "no dato" con "no dato".
export function mismoModelo(a: unknown, b: unknown): boolean {
  const norm = (v: unknown) =>
    stripDiacritics(String(v ?? "")).trim().toLowerCase().replace(/\s+/g, " ");
  const na = norm(a);
  if (!na) return false;
  return na === norm(b);
}

export function normalizeTipo(raw: unknown): TipoProductoKey | null {
  if (raw === null || raw === undefined) return null;
  const key = stripDiacritics(String(raw)).trim().toLowerCase();
  if (!key) return null;
  return TIPO_ALIAS[key] ?? null;
}

// ── Formas (cabecero + pantalla) ───────────────────────────────────────────
// Se conservan tal cual porque FormaBadge y buildProducto las consumen.
export const CABECERO_FORMAS: Record<string, string> = {
  recto: "Calobra",
  semicirculo: "Pregonda",
  "corona-simple": "Macarella",
  "corona-doble": "Conta",
  ondas: "Barbaria",
};

export const PANTALLA_FORMAS: Record<string, string> = {
  cilindro: "Almanzor",
  cuadrado: "Tormes",
  rectangulo: "La Serrota",
};

// ── Bancos (Oyambre) ───────────────────────────────────────────────────────
// Precios sugeridos actualizados (sección 6.2). Se añade 180 cm. La variante
// "60 cm doble" queda como LEGACY: no seleccionable pero resoluble para datos
// históricos. "Mis medidas" queda como opción abierta.

export interface BancoOpcion {
  id: string;
  label: string;
  precio: number;
  ancho: number | null;
  activo: boolean;
  legacy?: boolean;
}

export const BANCO_OPCIONES: BancoOpcion[] = [
  { id: "60",       label: "60 cm",         precio: 295, ancho: 60,  activo: true },
  { id: "90",       label: "90 cm",         precio: 335, ancho: 90,  activo: true },
  { id: "120",      label: "120 cm",        precio: 380, ancho: 120, activo: true },
  { id: "150",      label: "150 cm",        precio: 430, ancho: 150, activo: true },
  { id: "180",      label: "180 cm",        precio: 485, ancho: 180, activo: true },
  { id: "60-doble", label: "60 cm doble",   precio: 370, ancho: 60,  activo: false, legacy: true },
  { id: "custom",   label: "Mis medidas",   precio: 0,   ancho: null, activo: true },
];

// Medidas físicas por variante estándar. Fuente única de verdad — cualquier
// valor por defecto para `fondo`/`alto` de un banco viene de aquí. Se aplica
// SOLO cuando el payload no manda ese campo (payload manda si viene). Se
// mantiene como mapa por-variante aunque hoy las 5 sean iguales: futuros
// modelos con otro fondo se cambian aquí en una línea. "custom" no tiene
// defaults (medidas propias del cliente).
export const BANCO_MEDIDAS_FISICAS: Record<string, { fondo: number; alto: number }> = {
  "60":  { fondo: 33, alto: 45 },
  "90":  { fondo: 33, alto: 45 },
  "120": { fondo: 33, alto: 45 },
  "150": { fondo: 33, alto: 45 },
  "180": { fondo: 33, alto: 45 },
};

// Compatibilidad hacia atrás. Nuevos usos deben leer BANCO_MEDIDAS_FISICAS.
export const BANCO_ALTO_FIJO = 45;
export const BANCO_FONDO_FIJO = 33;
export const BANCO_VIVO_RECARGO = 30;

// True si `raw` trae una variante presente pero desconocida (dispara nota).
// Undefined/vacío → false (ausencia legítima, no error).
export function esVarianteBancoInvalida(raw: unknown): boolean {
  if (raw === null || raw === undefined) return false;
  const s = stripDiacritics(String(raw)).trim().toLowerCase();
  if (!s) return false;
  return !BANCO_OPCIONES.some((o) => o.id.toLowerCase() === s);
}

// Compatibilidad con el código antiguo (product-schema.ts los re-exporta)
export const BANCO_VARIANTES: Record<string, string> = Object.fromEntries(
  BANCO_OPCIONES.map((o) => [o.id, `Oyambre ${o.label}`])
);
export const BANCO_OYAMBRE_PRECIOS: Record<string, number> = Object.fromEntries(
  BANCO_OPCIONES.map((o) => [o.id, o.precio])
);

// ── Cabeceros ──────────────────────────────────────────────────────────────
// La forma NO afecta al precio. El precio depende solo de ancho, altura,
// vivo y colección de tela.

export const CABECERO_GROSOR_CM = 8;
export const CABECERO_ALTURA_BASE_CM = 100;
export const CABECERO_SUPLEMENTO_10CM = 15;
export const CABECERO_VIVO_DOBLE_RECARGO = 15;
export const CABECERO_COLGADOR_RECARGO = 5;

export interface CabeceroAnchoOpcion {
  id: string;          // ancho como string, ej. "150"
  label: string;       // "150 cm"
  ancho: number;
  precio: number;      // precio base (basic, altura 100, vivo simple)
  premium: number;     // suplemento tela premium
  activo: boolean;
  legacy?: boolean;
}

export const CABECERO_ANCHOS: CabeceroAnchoOpcion[] = [
  { id: "90",  label: "90 cm",  ancho: 90,  precio: 285, premium: 60,  activo: true },
  { id: "105", label: "105 cm", ancho: 105, precio: 315, premium: 65,  activo: true },
  { id: "135", label: "135 cm", ancho: 135, precio: 360, premium: 80,  activo: true },
  { id: "150", label: "150 cm", ancho: 150, precio: 400, premium: 90,  activo: true },
  { id: "160", label: "160 cm", ancho: 160, precio: 435, premium: 100, activo: true },
  { id: "180", label: "180 cm", ancho: 180, precio: 455, premium: 110, activo: true },
  { id: "200", label: "200 cm", ancho: 200, precio: 485, premium: 115, activo: true },
];

// Alturas seleccionables del cabecero (más "Otra altura" y "Por decidir" en la UI)
export const CABECERO_ALTOS = ["100", "120"] as const;

// ── Pufs ──────────────────────────────────────────────────────────────────
// Redesign completo: forma cuadrada / redonda con SKUs concretos.
// El pack de 2 unidades desaparece.

export interface PufOpcion {
  id: string;
  label: string;
  forma: "cuadrado" | "redondo";
  ancho: number;
  fondo: number;
  alto: number;
  precio: number;
  premium: number;
  vivo: number;
  activo: boolean;
  legacy?: boolean;
}

export const PUF_OPCIONES: PufOpcion[] = [
  { id: "cuad-40x40x40", label: "Cuadrado 40×40×40 cm",   forma: "cuadrado", ancho: 40, fondo: 40, alto: 40, precio: 150, premium: 45, vivo: 15, activo: true },
  { id: "cuad-50x50x45", label: "Cuadrado 50×50×45 cm",   forma: "cuadrado", ancho: 50, fondo: 50, alto: 45, precio: 175, premium: 55, vivo: 15, activo: true },
  { id: "cuad-60x40x45", label: "Cuadrado 60×40×45 cm",   forma: "cuadrado", ancho: 60, fondo: 40, alto: 45, precio: 225, premium: 70, vivo: 15, activo: true },
  { id: "red-40x40",     label: "Redondo Ø40 × 40 cm alto", forma: "redondo", ancho: 40, fondo: 40, alto: 40, precio: 160, premium: 45, vivo: 15, activo: true },
  { id: "red-50x45",     label: "Redondo Ø50 × 45 cm alto", forma: "redondo", ancho: 50, fondo: 50, alto: 45, precio: 185, premium: 55, vivo: 15, activo: true },
  { id: "red-60x45",     label: "Redondo Ø60 × 45 cm alto", forma: "redondo", ancho: 60, fondo: 60, alto: 45, precio: 240, premium: 70, vivo: 15, activo: true },
];

// ── Mesas de centro ────────────────────────────────────────────────────────
// Ahora TODAS son cuadradas con altura fija 40 cm.
// 120×45×60 y 80×45×80 quedan como legacy para renderizar históricos.

export interface MesaOpcion {
  id: string;
  label: string;
  ancho: number;
  fondo: number;
  alto: number;
  precio: number;
  premium: number;
  vivo: number;
  activo: boolean;
  legacy?: boolean;
}

export const MESA_ALTO_FIJO = 40;

export const MESA_OPCIONES: MesaOpcion[] = [
  { id: "60x60x40",   label: "60×60×40 cm",    ancho: 60,  fondo: 60,  alto: 40, precio: 220, premium: 65,  vivo: 30, activo: true },
  { id: "80x80x40",   label: "80×80×40 cm",    ancho: 80,  fondo: 80,  alto: 40, precio: 320, premium: 100, vivo: 30, activo: true },
  { id: "100x100x40", label: "100×100×40 cm",  ancho: 100, fondo: 100, alto: 40, precio: 360, premium: 125, vivo: 30, activo: true },
  { id: "120x120x40", label: "120×120×40 cm",  ancho: 120, fondo: 120, alto: 40, precio: 405, premium: 155, vivo: 30, activo: true },
  // Legacy — solo para resolver etiquetas de pedidos antiguos
  { id: "120x45x60-legacy", label: "120×45×60 cm", ancho: 120, fondo: 60, alto: 45, precio: 0, premium: 0, vivo: 0, activo: false, legacy: true },
  { id: "80x45x80-legacy",  label: "80×45×80 cm",  ancho: 80,  fondo: 80, alto: 45, precio: 0, premium: 0, vivo: 0, activo: false, legacy: true },
];

// Superficies válidas de mesa. "nada" es un valor legítimo — significa
// "sin superficie añadida". Se guarda como tal en productos_lead.color por
// diseño preexistente (no se cambia para no romper la interfaz ni las
// comparaciones con datos históricos).
export const MESA_SUPERFICIES = [
  { id: "nada",        name: "Sin superficie",             recargo: 0 },
  { id: "metacrilato", name: "Metacrilato 5 mm (+50€)",    recargo: 50 },
  { id: "cristal",     name: "Cristal 6 mm (+100€)",       recargo: 100 },
] as const;

// ── Almohadones (tipo interno "cojin") ─────────────────────────────────────
// Sin opción de vivo. Etiqueta visible = "Almohadón".

export interface CojinOpcion {
  id: string;
  label: string;
  forma: "cuadrado" | "rectangular" | "cilindro";
  ancho: number;
  alto: number;
  precio: number;
  premium: number;
  activo: boolean;
  legacy?: boolean;
}

export const COJIN_OPCIONES: CojinOpcion[] = [
  { id: "cuad-40x40",   label: "Cuadrado 40×40",     forma: "cuadrado",    ancho: 40, alto: 40, precio: 60,  premium: 35, activo: true },
  { id: "cuad-45x45",   label: "Cuadrado 45×45",     forma: "cuadrado",    ancho: 45, alto: 45, precio: 65,  premium: 40, activo: true },
  { id: "cuad-50x50",   label: "Cuadrado 50×50",     forma: "cuadrado",    ancho: 50, alto: 50, precio: 70,  premium: 40, activo: true },
  { id: "rect-50x30",   label: "Rectangular 50×30",  forma: "rectangular", ancho: 50, alto: 30, precio: 60,  premium: 35, activo: true },
  { id: "rect-60x40",   label: "Rectangular 60×40",  forma: "rectangular", ancho: 60, alto: 40, precio: 75,  premium: 40, activo: true },
  { id: "rect-70x90",   label: "Rectangular 70×90",  forma: "rectangular", ancho: 70, alto: 90, precio: 100, premium: 60, activo: true },
  { id: "cil-13x90",    label: "Cilindro 13×90",     forma: "cilindro",    ancho: 13, alto: 90, precio: 70,  premium: 40, activo: true },
];

// ── Pantallas de lámpara ───────────────────────────────────────────────────
// Sin opción de vivo. Formas: cilindro (Almanzor), cuadrado (Tormes),
// rectangulo (La Serrota).

export interface PantallaOpcion {
  id: string;
  label: string;
  formaId: string;          // clave en PANTALLA_FORMAS
  ancho: number;
  alto: number;
  precio: number;
  premium: number;
  activo: boolean;
  legacy?: boolean;
}

export const PANTALLA_OPCIONES: PantallaOpcion[] = [
  { id: "cil-40x40", label: "Ø40 × 40 cm",  formaId: "cilindro",   ancho: 40, alto: 40, precio: 75, premium: 30, activo: true },
  { id: "cil-15x20", label: "Ø15 × 20 cm",  formaId: "cilindro",   ancho: 15, alto: 20, precio: 25, premium: 15, activo: true },
  { id: "cil-25x25", label: "Ø25 × 25 cm",  formaId: "cilindro",   ancho: 25, alto: 25, precio: 45, premium: 20, activo: true },
  { id: "cuad-20x20", label: "20 × 20 cm",  formaId: "cuadrado",   ancho: 20, alto: 20, precio: 35, premium: 20, activo: true },
  { id: "rect-20x40", label: "20 × 40 cm",  formaId: "rectangulo", ancho: 20, alto: 40, precio: 65, premium: 20, activo: true },
];

// ── Telas ──────────────────────────────────────────────────────────────────
// La web colapsa el catálogo en dos categorías: BASIC y PREMIUM.
// La lista de telas concretas se mantiene informativa para el selector manual.
// Canónico en BD: SIEMPRE minúscula, sin acentos → "basic" | "premium".
// La capitalización ("Básicas" / "Premium") es solo de UI; nunca se guarda así.
// Filas históricas ("Premium", "Básicas") NO se migran; se normalizan al comparar.
export const TELA_CATEGORIAS = ["basic", "premium"] as const;
export type TelaCategoria = (typeof TELA_CATEGORIAS)[number];

// UI/store-safe: valor por defecto "basic" cuando el valor es ausente o no
// reconocido. Se sigue usando en toda la UI y el store (contrato existente).
// El endpoint público usa además `esColeccionTelaInvalida()` para NO
// interpretar valores desconocidos como "basic" en silencio.
export function normalizarColeccionTela(raw: unknown): TelaCategoria {
  const s = stripDiacritics(String(raw ?? "")).trim().toLowerCase();
  if (s === "premium") return "premium";
  return "basic"; // "basic", "basica", "básicas", vacío/null/undefined → basic
}

// True si `raw` trae un valor NO vacío y NO reconocido (dispara nota de
// aviso en el endpoint). Vacío/ausente → false (ausencia legítima = basic).
// Reconoce: "basic"/"basica"/"basicas" (con o sin acentos) y "premium".
export function esColeccionTelaInvalida(raw: unknown): boolean {
  if (raw === null || raw === undefined) return false;
  const s = stripDiacritics(String(raw)).trim().toLowerCase();
  if (!s) return false;
  return s !== "premium" && s !== "basic" && s !== "basica" && s !== "basicas";
}

// Etiqueta para render en UI. Acepta valores canónicos y también los históricos
// "Básicas"/"Premium" para no romper filas antiguas al mostrarlas.
export function displayColeccionTela(raw: unknown): string {
  return normalizarColeccionTela(raw) === "premium" ? "Premium" : "Básicas";
}

// Nombres sugeridos para el selector manual (misma lista que la web).
export const TELAS_SUGERIDAS = [
  "Arequipa Beige","Ikat Natural","Ikat Verde Agua","Ikat Arena","Ikat Bali Azul",
  "Mil Rayas Gris","Rayas Arena","Mil Rayas Azul Marino","Flor Azul Protea","Floralia Vintage",
  "Morris Granadas Terracota","Pájaros Louise Azul","Pájaros Louise Rosa","Pájaros Louise Verde",
  "Toile de Jouy Azul","Espiga Agua","Pata de Gallo Verde","Coral Costero","Lino Greca",
  "Baqueira","Baqueira Roja","Cérler","Lola Gris","Rocío","Artesano Beige","Oxford",
  "Lino Verde Botella","Lino Verde","Güell Lamadrid","Vichy Denim","Vichy Verde",
  "Ramas Siena Azul","Flores Gardenia","Bibiana","Prints Botánicos","Rayas Verde Sage",
  "Raya Monina","Rayas Jules Verde","Lino Azul Provenzal","Lino Flores Normandía","Lino Flores Senda",
] as const;

// ── Helpers genéricos ──────────────────────────────────────────────────────

export function getOpcionesSeleccionables<T extends { activo: boolean }>(list: T[]): T[] {
  return list.filter((o) => o.activo);
}

export function findBancoById(id: string): BancoOpcion | undefined {
  return BANCO_OPCIONES.find((o) => o.id === id);
}
export function findPufById(id: string): PufOpcion | undefined {
  return PUF_OPCIONES.find((o) => o.id === id);
}
export function findMesaById(id: string): MesaOpcion | undefined {
  return MESA_OPCIONES.find((o) => o.id === id);
}
export function findCojinById(id: string): CojinOpcion | undefined {
  return COJIN_OPCIONES.find((o) => o.id === id);
}
export function findPantallaById(id: string): PantallaOpcion | undefined {
  return PANTALLA_OPCIONES.find((o) => o.id === id);
}

// ── Constantes UI trasladadas desde ProductoForm.tsx (B.2a) ────────────────
// Estos son los valores exactos que consume el componente HOY. Vivirán aquí
// como fuente única mientras B.2b rediseña esos selectores para usar los
// catálogos nuevos (MESA_OPCIONES, PUF_OPCIONES, PANTALLA_OPCIONES...).

// Presets de mesa que muestra la UI actual (dos medidas rectangulares).
export const MESA_PRESETS_UI = ["120×45×60 cm", "80×45×80 cm"] as const;

// Diámetros de puf que la UI actual ofrece como estándar (cm, string).
export const PUF_TAMANOS_UI = ["40", "50"] as const;

// Tamaños de pantalla por forma, tal cual los muestra la UI actual.
export const PANTALLA_TAMANOS_UI: Record<string, string[]> = {
  cilindro:   ["Ø15×20 cm", "Ø25×25 cm", "Ø40×40 cm"],
  cuadrado:   ["20×20 cm"],
  rectangulo: ["20×40 cm"],
};

// Alturas de cabecero (alias del ya existente CABECERO_ALTOS, para simetría
// con el resto de constantes UI trasladadas).
export const CABECERO_ALTURAS_UI = CABECERO_ALTOS;

