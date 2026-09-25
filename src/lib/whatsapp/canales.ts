// ══════════════════════════════════════════════════════════════════════════
// Canales de la bandeja de mensajes: WhatsApp, Instagram (mensajes directos)
// y email (buzón info@tirorirohome.com).
//
// Los tres comparten las tablas whatsapp_* y el mismo motor de IA
// (procesar.server.ts). Sin columnas nuevas: el canal va en la clave de la
// conversación (columna `telefono`, única):
//   · WhatsApp  → "34660786453"          (wa_id, solo dígitos, como siempre)
//   · Instagram → "ig:<IGSID>"           (id de la persona en Instagram)
//   · Email     → "mail:<correo>"        (dirección en minúsculas)
// Y el id de cada mensaje (`wa_id`, único) lleva el mismo prefijo.
//
// Funciones puras, sin dependencias: se usan en servidor y navegador.
// ══════════════════════════════════════════════════════════════════════════

export type Canal = "whatsapp" | "instagram" | "email";

export const CANALES: Canal[] = ["whatsapp", "instagram", "email"];

export const CANAL_LABEL: Record<Canal, string> = {
  whatsapp: "WhatsApp",
  instagram: "Instagram",
  email: "Email",
};

/** Origen que se pone en la ficha del cliente creado desde ese canal. */
export const CANAL_ORIGEN: Record<Canal, string> = {
  whatsapp: "WhatsApp",
  instagram: "Instagram",
  email: "Email",
};

/** Emoji de las notas que deja la IA en la ficha. */
export const CANAL_EMOJI: Record<Canal, string> = {
  whatsapp: "📱",
  instagram: "📸",
  email: "✉️",
};

const PREFIJO_IG = "ig:";
const PREFIJO_MAIL = "mail:";

export function canalDe(clave: string | null | undefined): Canal {
  const c = (clave ?? "").trim();
  if (c.startsWith(PREFIJO_IG)) return "instagram";
  if (c.startsWith(PREFIJO_MAIL)) return "email";
  return "whatsapp";
}

/** Parte de la clave sin el prefijo del canal (IGSID, correo o wa_id). */
export function idDeClave(clave: string | null | undefined): string {
  const c = (clave ?? "").trim();
  if (c.startsWith(PREFIJO_IG)) return c.slice(PREFIJO_IG.length);
  if (c.startsWith(PREFIJO_MAIL)) return c.slice(PREFIJO_MAIL.length);
  return c;
}

export function claveInstagram(igsid: string): string { return PREFIJO_IG + igsid.trim(); }
export function claveEmail(correo: string): string { return PREFIJO_MAIL + normCorreo(correo); }
export function idMensajeInstagram(mid: string): string { return PREFIJO_IG + mid.trim(); }
export function idMensajeEmail(id: string): string { return PREFIJO_MAIL + id.trim(); }

/** Correo en minúsculas y sin espacios ni <>. */
export function normCorreo(c: string | null | undefined): string {
  return (c ?? "").trim().replace(/^<|>$/g, "").toLowerCase();
}

/**
 * Usuario de Instagram normalizado: sin @, sin la URL, en minúsculas.
 * "https://www.instagram.com/Ana.Perez/?hl=es" → "ana.perez"; "@ana" → "ana".
 */
export function normInstagram(v: string | null | undefined): string {
  let t = (v ?? "").trim().toLowerCase();
  if (!t) return "";
  const url = /instagram\.com\/([a-z0-9._]+)/.exec(t);
  if (url) t = url[1];
  t = t.replace(/^@+/, "").replace(/[/?#].*$/, "");
  return /^[a-z0-9._]{2,30}$/.test(t) ? t : "";
}

/** Usuarios de Instagram que tiene un lead (campo red social, @usuario o instagram). */
export function instagramsDeLead(l: { redSocial?: string | null; usuario?: string | null; instagram?: string | null }): string[] {
  const out = new Set<string>();
  for (const v of [l.redSocial, l.usuario, l.instagram]) {
    // "red social" a veces trae varias cosas: "@ana / tiktok @ana2".
    for (const trozo of (v ?? "").split(/[\s,;|/]+(?=@|https?:)/)) {
      const n = normInstagram(trozo);
      if (n) out.add(n);
    }
  }
  return [...out];
}

/** "Ana Pérez (@ana.perez)" o "@ana.perez" → "ana.perez". */
export function instagramDeNombre(nombre: string | null | undefined): string {
  const m = /@([A-Za-z0-9._]{2,30})/.exec(nombre ?? "");
  return m ? m[1].toLowerCase() : "";
}

/** Nombre sin el usuario: "Ana Pérez (@ana.perez)" → "Ana Pérez"; "@ana" → "". */
export function nombreSinUsuario(nombre: string | null | undefined): string {
  return (nombre ?? "").replace(/\(?@[A-Za-z0-9._]{2,30}\)?/g, "").trim();
}

// ── Direcciones propias (nunca son clientes) ────────────────────────────────
const DOMINIOS_PROPIOS = ["tirorirohome.com", "tiroriro.com", "notify.tirorirohome.com"];

export function esCorreoPropio(correo: string, equipo: string[] = []): boolean {
  const c = normCorreo(correo);
  if (!c.includes("@")) return false;
  const dominio = c.split("@")[1];
  if (DOMINIOS_PROPIOS.some((d) => dominio === d || dominio.endsWith("." + d))) return true;
  return equipo.map(normCorreo).includes(c);
}

// ── Correos automáticos (no son personas escribiendo) ───────────────────────
// Remitentes de avisos, facturas, envíos, redes sociales y newsletters. Si el
// correo es de un cliente que ya está en el CRM, se guarda igualmente.
const REMITENTE_AUTOMATICO = /(^|[._+-])(no-?reply|do-?not-?reply|noreply|notif(y|ication|icaciones|ications)?|newsletter|news|mailer(-daemon)?|bounces?|postmaster|billing|e-?billing|facturacion|facturas?|invoices?|alerts?|avisos?|marketing|promo(ciones)?|comunicaciones|info-?noreply|system|automated|support-?noreply)([._+-]|@)/;
const DOMINIO_AUTOMATICO = /(^|\.)(shopify\.com|dhl\.(com|es)|seur\.(com|es)|correos\.es|mrw\.es|gls-spain\.es|nacex\.es|ups\.com|fedex\.com|google\.com|googlemail\.com|youtube\.com|tiktok\.com|facebookmail\.com|facebook\.com|instagram\.com|meta\.com|linkedin\.com|pinterest\.com|metricool\.com|amazon\.(com|es)|amazonses\.com|paypal\.(com|es)|stripe\.com|lovable\.(dev|app)|supabase\.(io|com)|github\.com|mailchimp\.com|mailchimpapp\.net|sendgrid\.net|hubspot(email)?\.(com|net)|klaviyo(mail)?\.com|canva\.com|apple\.com|microsoft\.com|wetransfer\.com|bbva\.(com|es)|santander\.(com|es)|caixabank\.(com|es)|holded\.com|dualhook\.com|calendly\.com|zoom\.us|trustpilot\.com|glovo(app)?\.com|wallapop\.com|milanuncios\.com)$/;

export function esRemitenteAutomatico(correo: string): boolean {
  const c = normCorreo(correo);
  if (!c.includes("@")) return true;
  const [local, dominio] = c.split("@");
  return REMITENTE_AUTOMATICO.test(local + "@") || DOMINIO_AUTOMATICO.test(dominio);
}

/**
 * Separa "Ana Pérez <ana@x.com>" → { nombre: "Ana Pérez", correo: "ana@x.com" }.
 * Acepta también el correo solo.
 */
export function parsearRemitente(v: string | null | undefined): { nombre: string; correo: string } {
  const t = (v ?? "").trim();
  const m = /^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/.exec(t);
  if (m) return { nombre: m[1].trim(), correo: normCorreo(m[2]) };
  const suelto = /[^\s<>,;"]+@[^\s<>,;"]+/.exec(t);
  return { nombre: "", correo: normCorreo(suelto ? suelto[0] : t) };
}

/** Lista "A <a@x>, b@y" → correos normalizados. */
export function listaCorreos(v: string | null | undefined): string[] {
  return (v ?? "").split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map((x) => parsearRemitente(x).correo).filter((c) => c.includes("@"));
}

/**
 * Quita del cuerpo del correo lo citado de mensajes anteriores ("El lun, …
 * escribió:", líneas con ">", "-----Mensaje original-----") y la firma de
 * móvil, para que la IA lea solo lo nuevo.
 */
export function limpiarCuerpoCorreo(texto: string): string {
  const lineas = (texto ?? "").replace(/\r\n?/g, "\n").split("\n");
  const out: string[] = [];
  for (let i = 0; i < lineas.length; i++) {
    const l = lineas[i];
    const t = l.trim();
    if (/^(-{2,}\s*)?(mensaje original|original message|forwarded message|mensaje reenviado)/i.test(t.replace(/^-+\s*/, ""))) break;
    if (/^(el|on)\s.+(escribi[oó]|wrote)\s*:?\s*$/i.test(t)) break;
    // "El lun, 22 sept 2026 a las 10:00, Ana <ana@x.com>" partido en dos líneas.
    if (/^(el|on)\s.+\d/i.test(t) && /(escribi[oó]|wrote)\s*:?\s*$/i.test((lineas[i + 1] ?? "").trim())) break;
    if (/^(de|from):\s.+@/i.test(t) && out.length > 0) break;
    if (/^>/.test(t)) continue;
    if (/^(enviado desde mi|sent from my|obtener outlook para)/i.test(t)) break;
    out.push(l);
  }
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}
