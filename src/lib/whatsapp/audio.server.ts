// ══════════════════════════════════════════════════════════════════════════
// Notas de voz y audios de WhatsApp → texto (solo servidor, service_role).
//
// 1. CAPTURA (webhook, al instante): cada audio en vivo trae un enlace de
//    WhatsApp que caduca en ~5 minutos. El webhook lo descarga en ese momento
//    y lo deja en el bucket privado "lead-fotos" (solo equipo), carpeta
//    whatsapp-audio/. Si WhatsApp exige clave para ese enlace, se usa
//    WHATSAPP_ACCESS_TOKEN si existe; si no, queda anotado el fallo en
//    raw._audio y, con DUALHOOK_API_KEY, se reintenta en el paso 2 por el id
//    del audio (válido 7 días).
// 2. TRANSCRIPCIÓN (cron cada 2 minutos, antes del análisis): lee el audio
//    guardado, lo transcribe con la IA de Lovable (LOVABLE_API_KEY, créditos
//    de Lovable) o con GEMINI_API_KEY si algún día se añade, guarda el texto
//    en el mensaje ("[Nota de voz] «…»") y BORRA el archivo. El estado va en
//    raw._transcripcion: sin columnas nuevas.
//
// La IA lee la transcripción como un mensaje más y propone igual que con el
// texto (tarea, cliente, producto…). Si una conversación ya se había
// analizado sin la transcripción, se marca para volver a analizarla.
// ══════════════════════════════════════════════════════════════════════════

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { bytesABase64 } from "@/lib/ia-pedido.server";

type Row = Record<string, unknown>;
const s = (v: unknown): string => (v == null ? "" : String(v).trim());
const isObj = (v: unknown): v is Row => !!v && typeof v === "object" && !Array.isArray(v);

// ig_audio: nota de voz de Instagram (su enlace no necesita clave, pero caduca).
const TIPOS_AUDIO = ["audio", "voice", "ig_audio"];
const DIAS_VALIDEZ = 7;          // los ids de medios de los webhooks caducan a los 7 días de recibirlos
const MAX_BYTES = 15 * 1024 * 1024;
const MAX_INTENTOS = 3;
const SIN_AUDIO = "__SIN_AUDIO__";
const GATEWAY_URL = process.env.LOVABLE_AI_GATEWAY_URL || "https://ai.gateway.lovable.dev/v1/chat/completions";

export interface InformeAudios { transcritos: number; errores: string[] }

const BUCKET = "lead-fotos";
const CARPETA = "whatsapp-audio";

function iaConfigurada(): boolean { return !!(process.env.GEMINI_API_KEY || process.env.LOVABLE_API_KEY); }
function claveMedios(): boolean { return !!(process.env.DUALHOOK_API_KEY || process.env.WHATSAPP_ACCESS_TOKEN); }

class ErrorAudio extends Error {
  constructor(message: string, public definitivo = false) { super(message); this.name = "ErrorAudio"; }
}

async function fetchConTiempo(url: string, init: RequestInit, ms: number): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try { return await fetch(url, { ...init, signal: ctrl.signal }); } finally { clearTimeout(t); }
}

// ── Descarga ────────────────────────────────────────────────────────────────
async function descargarMedia(mediaId: string): Promise<{ bytes: Uint8Array; mime: string }> {
  const dualhook = process.env.DUALHOOK_API_KEY;
  const clave = dualhook || process.env.WHATSAPP_ACCESS_TOKEN || "";
  const base = dualhook
    ? (process.env.DUALHOOK_API_URL || "https://api.dualhook.com/v25.0")
    : `https://graph.facebook.com/${process.env.WHATSAPP_GRAPH_VERSION || "v21.0"}`;
  const auth = { Authorization: `Bearer ${clave}` };

  const meta = await fetchConTiempo(`${base.replace(/\/$/, "")}/${encodeURIComponent(mediaId)}`, { headers: auth }, 15_000);
  if (meta.status === 404 || meta.status === 410) throw new ErrorAudio("El audio ya no está disponible en WhatsApp (caducado)", true);
  if (meta.status === 401 || meta.status === 403) throw new ErrorAudio(`La clave de ${dualhook ? "Dualhook" : "WhatsApp"} no es válida (${meta.status})`);
  if (!meta.ok) throw new ErrorAudio(`No se pudo consultar el audio (${meta.status}): ${(await meta.text()).slice(0, 200)}`);
  const info = (await meta.json().catch(() => ({}))) as Row;
  const url = s(info.url);
  if (!url) throw new ErrorAudio("La API no devolvió la dirección del audio");
  if (Number(info.file_size) > MAX_BYTES) throw new ErrorAudio("Audio demasiado largo para transcribir", true);

  const res = await fetchConTiempo(url, { headers: auth }, 30_000);
  if (!res.ok) throw new ErrorAudio(`No se pudo descargar el audio (${res.status})`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  if (bytes.length === 0) throw new ErrorAudio("El audio descargado está vacío");
  if (bytes.length > MAX_BYTES) throw new ErrorAudio("Audio demasiado largo para transcribir", true);
  const mime = (s(info.mime_type) || res.headers.get("content-type") || "audio/ogg").split(";")[0].trim();
  return { bytes, mime };
}

// ── Transcripción ───────────────────────────────────────────────────────────
const INSTRUCCION = `Transcribe literalmente esta nota de voz de WhatsApp o Instagram (normalmente en español; es de Tiroriro Home, un taller de cabeceros y muebles tapizados, o de uno de sus clientes). Devuelve SOLO la transcripción, sin comillas, sin comentarios ni explicaciones. Escribe los números y las medidas con cifras (160 x 120 cm). Si no se entiende nada o no hay voz, responde exactamente ${SIN_AUDIO}. Si no has recibido ningún audio, responde exactamente ${SIN_AUDIO}.`;

function limpiarTranscripcion(t: string): string {
  const limpio = t.trim().replace(/^["«“]+|["»”]+$/g, "").trim();
  if (!limpio || limpio.includes(SIN_AUDIO)) return "";
  return limpio.slice(0, 3500);
}

async function transcribirGemini(b64: string, mime: string): Promise<string> {
  const model = process.env.WHATSAPP_AUDIO_MODEL || "gemini-flash-latest";
  const res = await fetchConTiempo(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: "POST",
    headers: { "x-goog-api-key": process.env.GEMINI_API_KEY ?? "", "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: INSTRUCCION }, { inline_data: { mime_type: mime, data: b64 } }] }],
      generationConfig: { temperature: 0 },
    }),
  }, 60_000);
  if (!res.ok) throw new ErrorAudio(`Gemini no pudo transcribir (${res.status}): ${(await res.text()).slice(0, 200)}`);
  const data = (await res.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string; thought?: boolean }> } }>; usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; thoughtsTokenCount?: number } };
  ultimoConsumo = { modelo: model, tokensEntrada: Number(data.usageMetadata?.promptTokenCount) || 0, tokensSalida: (Number(data.usageMetadata?.candidatesTokenCount) || 0) + (Number(data.usageMetadata?.thoughtsTokenCount) || 0), segundos: 0, bytes: 0, intentosFormato: 1 };
  const texto = (data.candidates?.[0]?.content?.parts ?? []).filter((p) => !p.thought).map((p) => p.text ?? "").join("");
  return limpiarTranscripcion(texto);
}

// La pasarela de Lovable es compatible con la API de OpenAI, que no tiene una
// forma única de mandar audio OGG. Se prueban las variantes habituales y se
// recuerda la que funcione mientras viva el proceso.
type Variante = (b64: string, mime: string) => Record<string, unknown>;
const VARIANTES: Variante[] = [
  (b64, mime) => ({ type: "image_url", image_url: { url: `data:${mime};base64,${b64}` } }),
  (b64, mime) => ({ type: "file", file: { filename: `nota-de-voz.${mime.split("/")[1] || "ogg"}`, file_data: `data:${mime};base64,${b64}` } }),
  (b64, mime) => ({ type: "input_audio", input_audio: { data: b64, format: mime.split("/")[1] || "ogg" } }),
];
let varianteBuena: number | null = null;

// Consumo de la última llamada (para saber el coste real por audio).
interface Consumo { modelo: string; tokensEntrada: number; tokensSalida: number; segundos: number; bytes: number; intentosFormato: number }
let ultimoConsumo: Consumo | null = null;

async function transcribirLovable(b64: string, mime: string): Promise<string> {
  const apiKey = process.env.LOVABLE_API_KEY ?? "";
  const model = process.env.WHATSAPP_AUDIO_MODEL_LOVABLE || "google/gemini-2.5-flash";
  const orden = varianteBuena != null ? [varianteBuena] : VARIANTES.map((_, i) => i);
  let ultimo = "";
  for (const i of orden) {
    const res = await fetchConTiempo(GATEWAY_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model, temperature: 0, messages: [{ role: "user", content: [{ type: "text", text: INSTRUCCION }, VARIANTES[i](b64, mime)] }] }),
    }, 60_000);
    if (res.status === 429 || res.status === 402) throw new ErrorAudio(`La pasarela de IA no atiende ahora (${res.status})`);
    if (!res.ok) { ultimo = `(${res.status}) ${(await res.text()).slice(0, 160)}`; continue; }
    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string | null } }>; usage?: { prompt_tokens?: number; completion_tokens?: number }; model?: string };
    ultimoConsumo = { modelo: data.model || model, tokensEntrada: Number(data.usage?.prompt_tokens) || 0, tokensSalida: Number(data.usage?.completion_tokens) || 0, segundos: 0, bytes: 0, intentosFormato: orden.indexOf(i) + 1 };
    const bruto = s(data.choices?.[0]?.message?.content);
    // Si el modelo no ha recibido el audio, contesta la marca: probar la siguiente forma.
    if (!bruto || bruto.includes(SIN_AUDIO) || /no (puedo|he recibido|veo).{0,40}audio/i.test(bruto)) { ultimo = "el modelo no recibió el audio"; continue; }
    varianteBuena = i;
    return limpiarTranscripcion(bruto);
  }
  throw new ErrorAudio(`La pasarela de IA de Lovable no acepta el audio: ${ultimo}`);
}

async function transcribir(bytes: Uint8Array, mime: string): Promise<string> {
  ultimoConsumo = null;
  const b64 = bytesABase64(bytes);
  return process.env.GEMINI_API_KEY ? transcribirGemini(b64, mime) : transcribirLovable(b64, mime);
}

// ── Captura en el webhook ───────────────────────────────────────────────────
/** Enlace del audio en un evento de Instagram (message.attachments[type=audio].payload.url). */
function urlAudioInstagram(raw: Row): string {
  const msg = isObj(raw.message) ? (raw.message as Row) : {};
  const adjuntos = Array.isArray(msg.attachments) ? (msg.attachments as unknown[]).filter(isObj) : [];
  const audio = adjuntos.find((a) => s(a.type) === "audio");
  return s(isObj(audio?.payload) ? (audio!.payload as Row).url : "");
}

interface MensajeAudio { waId: string; tipo: string; historial: boolean; raw: unknown }

/** Descarga al momento los audios en vivo (el enlace caduca en minutos) y los guarda aparte. */
export async function capturarAudiosWebhook(mensajes: MensajeAudio[]): Promise<void> {
  const audios = mensajes.filter((m) => TIPOS_AUDIO.includes(m.tipo) && !m.historial && isObj(m.raw)).slice(0, 10);
  await Promise.all(audios.map(async (m) => {
    const raw = m.raw as Row;
    const esIg = m.tipo === "ig_audio";
    const cuerpo = esIg ? {} : isObj(raw[m.tipo]) ? (raw[m.tipo] as Row) : {};
    const url = esIg ? urlAudioInstagram(raw) : s(cuerpo.url);
    let info: Row;
    try {
      if (!url) throw new Error("sin enlace en el webhook");
      const token = esIg ? "" : process.env.WHATSAPP_ACCESS_TOKEN; // nunca la clave de Dualhook: esto va a Meta
      const res = await fetchConTiempo(url, token ? { headers: { Authorization: `Bearer ${token}` } } : {}, 10_000);
      const ctype = (res.headers.get("content-type") ?? "").split(";")[0].trim();
      if (!res.ok) throw new Error(`WhatsApp respondió ${res.status}${ctype ? ` (${ctype})` : ""}`);
      if (/text\/html|application\/json/i.test(ctype)) throw new Error(`WhatsApp no devolvió el audio (${ctype})`);
      const bytes = new Uint8Array(await res.arrayBuffer());
      if (bytes.length === 0) throw new Error("audio vacío");
      if (bytes.length > MAX_BYTES) throw new Error("audio demasiado largo");
      // Instagram manda las notas de voz como MP4/AAC (a veces etiquetadas como vídeo).
      const mime = (s(cuerpo.mime_type) || ctype || (esIg ? "audio/mp4" : "audio/ogg")).split(";")[0].trim().replace(/^video\//, "audio/");
      const path = `${CARPETA}/${m.waId.replace(/[^A-Za-z0-9_-]/g, "_").slice(-120)}.${mime.split("/")[1] || "ogg"}`;
      const { error } = await supabaseAdmin.storage.from(BUCKET).upload(path, bytes, { contentType: mime, upsert: true });
      if (error) throw new Error("no se pudo guardar: " + error.message);
      info = { path, mime, at: new Date().toISOString() };
    } catch (e) {
      info = { error: (e instanceof Error ? e.message : String(e)).slice(0, 300), at: new Date().toISOString() };
    }
    await supabaseAdmin.from("whatsapp_mensajes").update({ raw: { ...raw, _audio: info } } as never).eq("wa_id", m.waId);
  }));
}

async function leerGuardado(path: string): Promise<{ bytes: Uint8Array; mime: string }> {
  const { data, error } = await supabaseAdmin.storage.from(BUCKET).download(path);
  if (error || !data) throw new ErrorAudio("El audio guardado ya no está", true);
  return { bytes: new Uint8Array(await data.arrayBuffer()), mime: (data.type || "audio/ogg").split(";")[0] };
}

// ── Punto de entrada ────────────────────────────────────────────────────────
function mediaIdDe(raw: Row, tipo: string): string {
  const cuerpo = isObj(raw[tipo]) ? (raw[tipo] as Row) : isObj(raw.audio) ? (raw.audio as Row) : null;
  return s(cuerpo?.id);
}

/**
 * Transcribe los audios recientes que aún no tienen texto. Si la conversación
 * ya se había analizado, la deja pendiente para que la IA lea el audio.
 */
export async function transcribirAudiosPendientes(opts: { conversacionId?: string; limite?: number } = {}): Promise<InformeAudios> {
  const informe: InformeAudios = { transcritos: 0, errores: [] };
  if (!iaConfigurada()) return informe;
  const conClave = claveMedios();

  const desde = new Date(Date.now() - DIAS_VALIDEZ * 86_400_000).toISOString();
  let q = supabaseAdmin.from("whatsapp_mensajes")
    .select("id, conversacion_id, tipo, texto, enviado_at, raw")
    .in("tipo", TIPOS_AUDIO)
    .gte("created_at", desde) // los 7 días cuentan desde que llegó el webhook, no desde que se mandó
    .order("enviado_at", { ascending: false })
    .limit(200);
  if (opts.conversacionId) q = q.eq("conversacion_id", opts.conversacionId);
  const { data, error } = await q;
  if (error) { informe.errores.push("No se pudieron leer los audios: " + error.message); return informe; }

  const pendientes = ((data ?? []) as Row[]).filter((m) => {
    const raw = isObj(m.raw) ? m.raw : {};
    const t = isObj(raw._transcripcion) ? raw._transcripcion : null;
    const guardado = isObj(raw._audio) && !!s((raw._audio as Row).path);
    if (!guardado && (!conClave || s(m.tipo) === "ig_audio")) return false; // ni capturado ni forma de descargarlo
    if (!t) return true;
    return s(t.estado) === "error" && Number(t.intentos) < MAX_INTENTOS;
  }).slice(0, Math.max(1, Math.min(opts.limite ?? 4, 10)));

  const reanalizar = new Map<string, string>(); // conversación → fecha del audio más antiguo transcrito
  for (const m of pendientes) {
    const raw = isObj(m.raw) ? (m.raw as Row) : {};
    const previo = isObj(raw._transcripcion) ? (raw._transcripcion as Row) : {};
    const intentos = (Number(previo.intentos) || 0) + 1;
    const tipo = s(m.tipo);
    const cuerpo = isObj(raw[tipo]) ? (raw[tipo] as Row) : {};
    const esVoz = cuerpo.voice === true || tipo === "voice" || tipo === "ig_audio";
    const caption = s(cuerpo.caption);
    const ahora = new Date().toISOString();
    const path = isObj(raw._audio) ? s((raw._audio as Row).path) : "";
    let patch: Row;
    try {
      let audio: { bytes: Uint8Array; mime: string };
      if (path) audio = await leerGuardado(path);
      else {
        const mediaId = mediaIdDe(raw, tipo);
        if (!mediaId) throw new ErrorAudio("El mensaje no trae el id del audio", true);
        audio = await descargarMedia(mediaId);
      }
      const texto = await transcribir(audio.bytes, audio.mime);
      // Transcrito: el audio no se conserva.
      if (path) await supabaseAdmin.storage.from(BUCKET).remove([path]);
      const etiqueta = esVoz ? "[Nota de voz]" : "[Audio]";
      patch = {
        texto: texto ? `${etiqueta} «${texto}»${caption ? ` ${caption}` : ""}` : `${etiqueta} (sin voz reconocible)${caption ? ` ${caption}` : ""}`,
        raw: { ...raw, _transcripcion: { estado: "ok", texto, at: ahora, consumo: ultimoConsumo ? { ...ultimoConsumo, segundos: Number(cuerpo.seconds) || null, bytes: audio.bytes.length, via: process.env.GEMINI_API_KEY ? "gemini" : "lovable" } : null } },
      };
      informe.transcritos++;
      const convId = s(m.conversacion_id);
      const f = s(m.enviado_at);
      if (!reanalizar.has(convId) || f < (reanalizar.get(convId) ?? "")) reanalizar.set(convId, f);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      informe.errores.push(`Audio: ${msg}`);
      // Clave inválida o IA saturada/sin crédito: es de configuración, no del
      // audio. No se gastan sus intentos y se para hasta el siguiente ciclo.
      // ("no acepta el audio" sí gasta intento: así no se reintenta sin fin.)
      if (/clave|no atiende/i.test(msg)) break;
      const definitivo = e instanceof ErrorAudio && e.definitivo;
      patch = { raw: { ...raw, _transcripcion: { estado: definitivo ? "no_disponible" : "error", intentos, error: msg.slice(0, 300), at: ahora } } };
      // Sin más intentos: tampoco se conserva el audio.
      if (path && (definitivo || intentos >= MAX_INTENTOS)) await supabaseAdmin.storage.from(BUCKET).remove([path]);
    }
    const { error: upErr } = await supabaseAdmin.from("whatsapp_mensajes").update(patch as never).eq("id", s(m.id));
    if (upErr) informe.errores.push("No se pudo guardar la transcripción: " + upErr.message);
  }

  // Conversaciones que la IA ya había leído sin estos audios → volver a analizarlas.
  for (const [convId, desdeAudio] of reanalizar) {
    await supabaseAdmin.from("whatsapp_conversaciones")
      .update({ analizado_hasta: null } as never)
      .eq("id", convId)
      .gte("analizado_hasta", desdeAudio);
  }
  return informe;
}
