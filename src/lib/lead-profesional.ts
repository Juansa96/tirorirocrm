// ══════════════════════════════════════════════════════════════════════════
// ¿El formulario web es de un PROFESIONAL? (tienda, estudio de interiorismo o
// decoración, arquitecto, hotel, reventa…). Decisión de Juan (26/09/2026):
// esos leads se le asignan a él y le llega un correo para que responda.
//
// Función pura, sin dependencias: frases concretas para no confundir a un
// particular ("¿tenéis tienda física?", "el estudio de casa") con un negocio.
// ══════════════════════════════════════════════════════════════════════════

export const VENDEDOR_PROFESIONALES = "sangradortorresjuan@gmail.com";
export const ETIQUETA_PROFESIONAL = "Profesional (B2B)";

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ");

// [patrón, motivo legible]
const PATRONES: Array<[RegExp, string]> = [
  [/\bb2b\b/, "habla de B2B"],
  [/\binterioris(ta|tas|mo)\b/, "interiorismo"],
  [/\bdecorador(a|es|as)?\b/, "decorador/a"],
  [/\barquitect(o|a|os|as|ura)\b/, "arquitectura"],
  [/\bestudio de (decoracion|interiorismo|interiores|arquitectura|diseno|interior)/, "estudio de decoración o interiorismo"],
  [/\b(tengo|tenemos|somos|llevo|llevamos|regento) (una|un) (tienda|estudio|showroom|hotel|negocio|empresa)\b/, "tiene un negocio"],
  [/\b(mi|nuestra) tienda\b|\bnuestro (estudio|showroom|negocio)\b/, "tiene un negocio"],
  [/\btienda de (muebles|decoracion|hogar|textil|colchones|mobiliario|interiorismo)\b/, "tienda de muebles o decoración"],
  [/\b(descuento|precio|precios|tarifa|tarifas|condiciones|venta|vendeis|vendes|trabajais) (a |para )?profesional(es)?\b/, "pide condiciones de profesional"],
  [/\b(a|para|con) profesionales\b|\b(somos|soy) profesional(es)?\b/, "profesional"],
  [/\b(reventa|revender|revendedor|distribuidor(a|es)?|distribuir|mayorista|al por mayor|punto de venta|showroom)\b/, "reventa o distribución"],
  [/\b(hotel|hoteles|hostal|casa rural|apartamentos turisticos|alojamiento turistico|contract)\b/, "hotel o contract"],
  [/\bpara (un|una|mis|nuestros|nuestras) client(e|a|es|as)\b|\bproyecto de (un|una) client/, "encargo para sus clientes"],
];

const DOMINIO_PROFESIONAL = /(interior|decora|deco[-.]|arquitect|estudio|design|disen|mueble|mobiliario|hotel)/;
const CORREO_GRATUITO = /@(gmail|hotmail|outlook|live|yahoo|icloud|me|msn|protonmail|proton|telefonica|movistar)\./;

/**
 * Devuelve el motivo si parece un profesional, o null si parece un particular.
 * Mira el mensaje, el nombre (p. ej. "Biombo S.L.") y el dominio del correo.
 */
export function motivoProfesional(datos: { mensaje?: string; nombre?: string; email?: string }): string | null {
  const texto = norm(`${datos.mensaje ?? ""} ${datos.nombre ?? ""}`);
  for (const [re, motivo] of PATRONES) if (re.test(texto)) return motivo;
  if (/\b(s\.?\s?l\.?u?|s\.?\s?a\.?)$/.test(norm(datos.nombre ?? "").trim())) return "el nombre es de una empresa";
  const email = norm(datos.email ?? "").trim();
  const dominio = email.split("@")[1] ?? "";
  if (dominio && !CORREO_GRATUITO.test(email) && DOMINIO_PROFESIONAL.test(dominio)) return `correo de empresa (${dominio})`;
  return null;
}
