// ══════════════════════════════════════════════════════════════════════════
// Notas de voz y audios de WhatsApp → texto (solo servidor, service_role).
//
// El webhook solo trae el id del audio en WhatsApp (válido 7 días); el
// archivo se descarga aparte con una clave:
//   · DUALHOOK_API_KEY (dh_live_…): API de Dualhook, que es quien reenvía los
//     mensajes (GET https://api.dualhook.com/v25.0/<id> → url /content).
//   · o WHATSAPP_ACCESS_TOKEN: token de sistema de Meta (Graph API).
// Sin ninguna de las dos no se hace nada y los audios siguen como "[Audio]".
//
// Transcripción con Gemini: GEMINI_API_KEY si existe (API de Google) y, si
// no, la pasarela de IA de Lovable (LOVABLE_API_KEY), la misma que ya lee los
// chats. El audio no se guarda: solo la transcripción, en el propio mensaje
// (texto) y el estado en raw._transcripcion, sin columnas nuevas.
//
// Se hace ANTES del análisis de la conversación (procesar.server.ts), así la
// IA lee lo que dice el audio como un mensaje más y propone igual que con el
// texto (tarea, cliente, producto…). Si una conversación ya se había
// analizado sin la transcripción, se marca para volver a analizarla.
// ══════════════════════════════════════════════════════════════════════════

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { bytesABase64 } from "@/lib/ia-pedido.server";

type Row = Record<string, unknown>;
const s = (v: unknown): string => (v == null ? "" : String(v).trim());
const isObj = (v: unknown): v is Row => !!v && typeof v === "object" && !Array.isArray(v);

const TIPOS_AUDIO = ["audio", "voice"];
const DIAS_VALIDEZ = 7;          // los ids de medios de los webhooks caducan a los 7 días de recibirlos
const MAX_BYTES = 15 * 1024 * 1024;
const MAX_INTENTOS = 3;
const SIN_AUDIO = "__SIN_AUDIO__";
const GATEWAY_URL = process.env.LOVABLE_AI_GATEWAY_URL || "https://ai.gateway.lovable.dev/v1/chat/completions";

export interface InformeAudios { transcritos: number; errores: string[] }

export function audioConfigurado(): boolean {
  return !!(process.env.DUALHOOK_API_KEY || process.env.WHATSAPP_ACCESS_TOKEN) && !!(process.env.GEMINI_API_KEY || process.env.LOVABLE_API_KEY);
}

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
const INSTRUCCION = `Transcribe literalmente esta nota de voz de WhatsApp (normalmente en español; es de Tiroriro Home, un taller de cabeceros y muebles tapizados, o de uno de sus clientes). Devuelve SOLO la transcripción, sin comillas, sin comentarios ni explicaciones. Escribe los números y las medidas con cifras (160 x 120 cm). Si no se entiende nada o no hay voz, responde exactamente ${SIN_AUDIO}. Si no has recibido ningún audio, responde exactamente ${SIN_AUDIO}.`;

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
  const data = (await res.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string; thought?: boolean }> } }> };
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
    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string | null } }> };
    const bruto = s(data.choices?.[0]?.message?.content);
    // Si el modelo no ha recibido el audio, contesta la marca: probar la siguiente forma.
    if (!bruto || bruto.includes(SIN_AUDIO) || /no (puedo|he recibido|veo).{0,40}audio/i.test(bruto)) { ultimo = "el modelo no recibió el audio"; continue; }
    varianteBuena = i;
    return limpiarTranscripcion(bruto);
  }
  throw new ErrorAudio(`La pasarela de IA de Lovable no acepta el audio: ${ultimo}. Añade GEMINI_API_KEY para transcribir con Google.`);
}

async function transcribir(bytes: Uint8Array, mime: string): Promise<string> {
  const b64 = bytesABase64(bytes);
  return process.env.GEMINI_API_KEY ? transcribirGemini(b64, mime) : transcribirLovable(b64, mime);
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
  if (!audioConfigurado()) return informe;

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
    const esVoz = cuerpo.voice === true || tipo === "voice";
    const caption = s(cuerpo.caption);
    const ahora = new Date().toISOString();
    let patch: Row;
    try {
      const mediaId = mediaIdDe(raw, tipo);
      if (!mediaId) throw new ErrorAudio("El mensaje no trae el id del audio", true);
      const { bytes, mime } = await descargarMedia(mediaId);
      const texto = await transcribir(bytes, mime);
      const etiqueta = esVoz ? "[Nota de voz]" : "[Audio]";
      patch = {
        texto: texto ? `${etiqueta} «${texto}»${caption ? ` ${caption}` : ""}` : `${etiqueta} (sin voz reconocible)${caption ? ` ${caption}` : ""}`,
        raw: { ...raw, _transcripcion: { estado: "ok", texto, at: ahora } },
      };
      informe.transcritos++;
      const convId = s(m.conversacion_id);
      const f = s(m.enviado_at);
      if (!reanalizar.has(convId) || f < (reanalizar.get(convId) ?? "")) reanalizar.set(convId, f);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      informe.errores.push(`Audio: ${msg}`);
      // Clave inválida o IA caída: es de configuración, no del audio. No se
      // gastan sus intentos y se para hasta el siguiente ciclo.
      if (/clave|no atiende|no acepta/i.test(msg)) break;
      const definitivo = e instanceof ErrorAudio && e.definitivo;
      patch = { raw: { ...raw, _transcripcion: { estado: definitivo ? "no_disponible" : "error", intentos, error: msg.slice(0, 300), at: ahora } } };
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
