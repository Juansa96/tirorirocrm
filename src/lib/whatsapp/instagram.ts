// ══════════════════════════════════════════════════════════════════════════
// Lectura del webhook de mensajes directos de Instagram (API de Instagram con
// inicio de sesión de Instagram, formato Messenger Platform).
//
// Sin dependencias: se puede probar aislado. Devuelve mensajes con la misma
// forma que los de WhatsApp (MensajeNormalizado), con la clave de la
// conversación "ig:<IGSID de la persona>" y el id "ig:<mid>".
//
//   entry[].messaging[]  { sender, recipient, timestamp, message }
//     · message.is_echo  → lo que contestamos desde Instagram (saliente)
//     · resto            → lo que escribe la persona (entrante)
//   entry[].changes[]    { field: "messages", value: { …igual… } }  (pruebas del panel de Meta)
// Se ignoran las lecturas, reacciones, mensajes borrados y los "postbacks".
// ══════════════════════════════════════════════════════════════════════════

import type { MensajeNormalizado } from "./parse";
import { claveInstagram, idMensajeInstagram } from "./canales";

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => !!v && typeof v === "object" && !Array.isArray(v);
const str = (v: unknown): string => (v == null ? "" : String(v));

export interface ResultadoInstagram {
  mensajes: MensajeNormalizado[];
  cuentas: string[];          // ids de la cuenta de Tiroriro que aparecen en el evento
  ignorados: number;
}

const ETIQUETA_ADJUNTO: Record<string, string> = {
  image: "[Imagen]", video: "[Vídeo]", audio: "[Nota de voz]", file: "[Archivo]",
  share: "[Publicación compartida]", story_mention: "[Te ha mencionado en una historia]",
  ig_reel: "[Reel compartido]", reel: "[Reel compartido]", ig_post: "[Publicación compartida]",
  animated_image: "[GIF]", sticker: "[Sticker]", template: "[Mensaje con botones]", fallback: "[Enlace]",
};

function tsToIso(ts: unknown): string {
  const n = Number(ts);
  if (Number.isFinite(n) && n > 0) return new Date(n > 1e12 ? n : n * 1000).toISOString();
  return new Date().toISOString();
}

/** Texto legible de un mensaje directo (texto, adjuntos, respuesta a historia). */
export function textoInstagram(m: Obj): { tipo: string; texto: string } {
  const partes: string[] = [];
  let tipo = "text";
  const replyTo = isObj(m.reply_to) ? (m.reply_to as Obj) : null;
  if (replyTo && isObj(replyTo.story)) { partes.push("[Respuesta a una historia]"); tipo = "story_reply"; }
  const adjuntos = Array.isArray(m.attachments) ? (m.attachments as unknown[]).filter(isObj) : [];
  for (const a of adjuntos) {
    const t = str(a.type) || "file";
    const payload = isObj(a.payload) ? (a.payload as Obj) : {};
    const titulo = str(payload.title).trim();
    partes.push(`${ETIQUETA_ADJUNTO[t] ?? `[${t}]`}${titulo ? ` ${titulo}` : ""}`);
    // Los audios de Instagram no se transcriben (el transcriptor es de WhatsApp).
    if (tipo === "text") tipo = t === "audio" ? "ig_audio" : `ig_${t}`;
  }
  if (m.is_unsupported === true) { partes.push("[Mensaje que Instagram no deja leer]"); tipo = "unsupported"; }
  const texto = str(m.text).trim();
  if (texto) partes.push(texto);
  return { tipo, texto: partes.join(" ").trim().slice(0, 4000) };
}

function extraer(ev: Obj, cuentasNegocio: Set<string>): MensajeNormalizado | null {
  const m = isObj(ev.message) ? (ev.message as Obj) : null;
  if (!m) return null;                              // read, reaction, postback, referral…
  if (m.is_deleted === true) return null;
  const mid = str(m.mid);
  if (!mid) return null;
  const sender = str((ev.sender as Obj | undefined)?.id);
  const recipient = str((ev.recipient as Obj | undefined)?.id);
  const saliente = m.is_echo === true || (!!sender && cuentasNegocio.has(sender));
  const persona = saliente ? recipient : sender;
  if (!persona || cuentasNegocio.has(persona)) return null;
  const { tipo, texto } = textoInstagram(m);
  if (!texto) return null;
  return {
    waId: idMensajeInstagram(mid),
    telefono: claveInstagram(persona),
    nombreWa: "",
    direccion: saliente ? "saliente" : "entrante",
    tipo,
    texto,
    enviadoAt: tsToIso(ev.timestamp),
    historial: false,
    raw: ev,
  };
}

export function parsearWebhookInstagram(body: unknown): ResultadoInstagram {
  const out: ResultadoInstagram = { mensajes: [], cuentas: [], ignorados: 0 };
  if (!isObj(body)) return out;
  const entries = Array.isArray(body.entry) ? (body.entry as unknown[]).filter(isObj) : [];
  const vistos = new Set<string>();
  for (const entry of entries) {
    const cuenta = str(entry.id);
    const cuentas = new Set<string>(cuenta ? [cuenta] : []);
    if (cuenta && !out.cuentas.includes(cuenta)) out.cuentas.push(cuenta);
    const eventos: Obj[] = [];
    if (Array.isArray(entry.messaging)) eventos.push(...(entry.messaging as unknown[]).filter(isObj));
    if (Array.isArray(entry.changes)) {
      for (const ch of (entry.changes as unknown[]).filter(isObj)) {
        if (str(ch.field) === "messages" && isObj(ch.value)) eventos.push(ch.value as Obj);
      }
    }
    for (const ev of eventos) {
      const m = extraer(ev, cuentas);
      if (!m) { out.ignorados++; continue; }
      if (vistos.has(m.waId)) continue;
      vistos.add(m.waId);
      out.mensajes.push(m);
    }
  }
  return out;
}
