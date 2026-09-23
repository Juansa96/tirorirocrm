// Solo servidor (rutas /api/pedidos/croquis y /api/pedidos/referencia).
// Reúne lo común de las dos generaciones automáticas: autenticar al equipo,
// cargar el pedido con su producto, telas y huecos, llamar a la API que toque
// y dejar el resultado en `pedido_archivos` como archivo PENDIENTE de aprobar
// (subido_por = "@ia:pendiente"). Sin columnas ni tablas nuevas.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { storagePathFromUrl } from "@/lib/storage-urls";
import { TELAS_WEB } from "@/lib/telas-web-data";
import { normNombreTela, huecosDe, paredDe, ARCHIVO_IA_PENDIENTE } from "@/lib/types";
import type { DatosPedidoIA } from "@/lib/ia-prompts";

export const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json" } });

// ── Autenticación: solo admin/equipo (el tapicero no genera nada) ──
export async function autenticarEquipo(request: Request): Promise<{ userId: string; email: string } | Response> {
  const authz = request.headers.get("authorization") ?? "";
  const token = authz.toLowerCase().startsWith("bearer ") ? authz.slice(7) : "";
  if (!token) return json({ error: "No autorizado" }, 401);
  const { data: u, error: uErr } = await supabaseAdmin.auth.getUser(token);
  if (uErr || !u?.user) return json({ error: "No autorizado" }, 401);
  const { data: perfil } = await supabaseAdmin.from("perfiles").select("rol, activo").eq("id", u.user.id).maybeSingle();
  if (!perfil || perfil.activo === false || !["admin", "equipo"].includes(perfil.rol as string)) {
    return json({ error: "Solo el equipo puede generar archivos del pedido" }, 403);
  }
  return { userId: u.user.id, email: u.user.email ?? "" };
}

// ── Contexto del pedido para los prompts ──
export interface ContextoPedidoIA {
  datos: DatosPedidoIA;
  fotosTela: { rol: string; url: string }[];   // url pública (web) o ruta del bucket "telas"
  referenciaEquipo: string;                      // ruta (bucket pedido-archivos) de la última imagen de referencia subida a mano, "" si no hay
  dibujoPngUrl: string;                          // dibujo del configurador (web), si lo hay
}

export async function cargarContextoPedido(pedidoId: string): Promise<ContextoPedidoIA | Response> {
  const { data: pedido } = await supabaseAdmin.from("pedidos")
    .select("id, numero, numero_sufijo, lead_id, producto_lead_id, cliente_nombre, cliente_nombre_libre, montaje, nota_tapicero, pasos_tapicero")
    .eq("id", pedidoId).maybeSingle();
  if (!pedido) return json({ error: "Pedido no encontrado" }, 404);
  const p = pedido as Record<string, unknown>;
  const prodId = p.producto_lead_id as string | null;
  const [{ data: prod }, { data: telas }, { data: lead }, { data: refs }] = await Promise.all([
    prodId ? supabaseAdmin.from("productos_lead").select("tipo, modelo, ancho, alto, fondo, cantidad, acabado, patas, notas_producto, config_json").eq("id", prodId).maybeSingle() : Promise.resolve({ data: null }),
    supabaseAdmin.from("pedido_telas").select("tipo_tela, nombre_tela, tela_foto_url, tela_coleccion, orden").eq("pedido_id", pedidoId).order("orden"),
    p.lead_id ? supabaseAdmin.from("leads").select("nombre").eq("id", p.lead_id as string).maybeSingle() : Promise.resolve({ data: null }),
    supabaseAdmin.from("pedido_archivos").select("storage_path, nombre, subido_por, created_at").eq("pedido_id", pedidoId).eq("tipo", "referencia").order("created_at", { ascending: false }),
  ]);
  // Foto de referencia subida A MANO por el equipo (p. ej. la que manda el
  // cliente): sirve de base cuando la pieza no es de catálogo.
  const refManual = ((refs ?? []) as Record<string, unknown>[]).find((r) =>
    r.subido_por !== ARCHIVO_IA_PENDIENTE && !/^referencia-gemini-/.test(String(r.nombre ?? "")) && /\.(png|jpe?g|webp)$/i.test(String(r.nombre ?? "")));
  const referenciaEquipo = (refManual?.storage_path as string) ?? "";
  const pr = (prod ?? {}) as Record<string, unknown>;
  const pasos = (p.pasos_tapicero && typeof p.pasos_tapicero === "object" ? p.pasos_tapicero : {}) as Record<string, string>;
  const num = (v: unknown) => (v == null || v === "" ? null : Number.isFinite(Number(v)) ? Number(v) : null);
  const telasRows = ((telas ?? []) as Record<string, unknown>[]).map((t) => ({
    rol: (t.tipo_tela as string) ?? "",
    nombre: (t.nombre_tela as string) ?? "",
    coleccion: (t.tela_coleccion as string) ?? "",
    fotoPropia: (t.tela_foto_url as string) ?? "",
  }));
  const fotosTela = telasRows.map((t) => {
    if (!t.nombre) return null;
    const propia = t.fotoPropia;
    const web = TELAS_WEB[normNombreTela(t.nombre)]?.foto ?? "";
    const url = propia || web;
    return url ? { rol: t.rol, url } : null;
  }).filter((x): x is { rol: string; url: string } => !!x);
  const cfg = pr.config_json && typeof pr.config_json === "object" ? (pr.config_json as Record<string, unknown>) : null;
  const dib = cfg?.dibujo && typeof cfg.dibujo === "object" ? (cfg.dibujo as Record<string, unknown>) : null;
  const dibujoPngUrl = typeof dib?.png_url === "string" && /^https:\/\//.test(dib.png_url) ? dib.png_url : "";

  const datos: DatosPedidoIA = {
    numero: num(p.numero),
    numeroSufijo: (p.numero_sufijo as string) ?? "",
    clienteNombre: ((p.cliente_nombre as string) || (lead as { nombre?: string } | null)?.nombre || (p.cliente_nombre_libre as string) || ""),
    tipo: (pr.tipo as string) ?? "",
    modelo: (pr.modelo as string) ?? "",
    ancho: num(pr.ancho), alto: num(pr.alto), fondo: num(pr.fondo),
    cantidad: Number(pr.cantidad) || 1,
    montaje: (p.montaje as string) ?? "",
    acabado: (pr.acabado as string) ?? "",
    patas: (pr.patas as string) ?? "",
    huecos: huecosDe(pasos),
    pared: paredDe(pasos),
    telas: telasRows.map(({ rol, nombre, coleccion }) => ({ rol, nombre, coleccion })),
    notaTapicero: (p.nota_tapicero as string) ?? "",
    notasProducto: (pr.notas_producto as string) ?? "",
  };
  return { datos, fotosTela, dibujoPngUrl, referenciaEquipo };
}

// ── Descarga de una imagen (foto de tela o dibujo) a base64 para adjuntarla ──
// Las fotos de tela subidas a mano viven en el bucket privado "telas": se
// descargan con service_role. Las de la web son públicas.
const MAX_IMG_BYTES = 6 * 1024 * 1024;
export async function descargarImagenBase64(url: string, bucketPath?: { bucket: string; path: string }): Promise<{ data: string; mime: string } | null> {
  try {
    let bytes: ArrayBuffer | null = null;
    let mime = "";
    const bucket = bucketPath?.bucket ?? "telas";
    const path = bucketPath?.path ?? storagePathFromUrl(url, "telas");
    if (path) {
      const { data, error } = await supabaseAdmin.storage.from(bucket).download(path);
      if (error || !data) return null;
      bytes = await data.arrayBuffer();
      mime = data.type || "";
    } else if (/^https?:\/\//.test(url)) {
      const res = await fetch(url);
      if (!res.ok) return null;
      mime = res.headers.get("content-type")?.split(";")[0]?.trim() ?? "";
      bytes = await res.arrayBuffer();
    }
    if (!bytes || bytes.byteLength === 0 || bytes.byteLength > MAX_IMG_BYTES) return null;
    if (!mime.startsWith("image/")) {
      const ext = url.split("?")[0]?.split(".").pop()?.toLowerCase() ?? "";
      mime = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : ext === "gif" ? "image/gif" : "image/jpeg";
    }
    return { data: bytesABase64(new Uint8Array(bytes)), mime };
  } catch { return null; }
}

export function bytesABase64(bytes: Uint8Array): string {
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return btoa(bin);
}
export function base64ABytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// ── Guardar el resultado como archivo del pedido pendiente de aprobar ──
export async function guardarArchivoIA(opts: {
  pedidoId: string; tipo: "plantilla" | "referencia"; nombre: string; bytes: Uint8Array; contentType: string;
}): Promise<{ id: string; url: string; nombre: string; storagePath: string } | Response> {
  const safe = opts.nombre.replace(/[^\w.-]+/g, "_").slice(0, 120);
  const path = `${opts.pedidoId}/${opts.tipo}/${crypto.randomUUID()}-${safe}`;
  const { error: upErr } = await supabaseAdmin.storage.from("pedido-archivos").upload(path, opts.bytes, { contentType: opts.contentType, upsert: false });
  if (upErr) return json({ error: "No se pudo guardar el archivo generado: " + upErr.message }, 500);
  const { data: signed } = await supabaseAdmin.storage.from("pedido-archivos").createSignedUrl(path, 60 * 60 * 24 * 7);
  const url = signed?.signedUrl ?? "";
  const { data: row, error } = await supabaseAdmin.from("pedido_archivos").insert({
    pedido_id: opts.pedidoId, tipo: opts.tipo, nombre: safe, storage_path: path, url, subido_por: ARCHIVO_IA_PENDIENTE,
  } as never).select("id").single();
  if (error || !row) {
    await supabaseAdmin.storage.from("pedido-archivos").remove([path]);
    return json({ error: "No se pudo registrar el archivo generado" }, 500);
  }
  return { id: (row as { id: string }).id, url, nombre: safe, storagePath: path };
}

// Fecha corta para el nombre del archivo: 2026-09-23_1432
export function selloFecha(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}`;
}

// ── Llamada a Claude (API de Mensajes de Anthropic, HTTP directo) ──
// Sin SDK: el lockfile del proyecto apunta al registro privado de Lovable y
// no se puede añadir una dependencia desde aquí con garantías.
export const ANTHROPIC_MODEL_DEFECTO = "claude-opus-5";
// Streaming (SSE): un croquis puede tardar un par de minutos y ocupar muchos
// tokens; así no hay límite de tiempo por petición bloqueante.
export async function llamarClaude(opts: {
  system: string; prompt: string; maxTokens?: number;
  documentos?: { titulo: string; pdfBase64: string }[];   // PDFs de ejemplo, antes del texto
}): Promise<{ texto: string; modelo: string } | Response> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return json({ error: "Falta configurar ANTHROPIC_API_KEY en Lovable Cloud (Secrets).", noConfigurado: true }, 503);
  const model = process.env.ANTHROPIC_MODEL || ANTHROPIC_MODEL_DEFECTO;
  const docs = opts.documentos ?? [];
  const content: Record<string, unknown>[] = docs.map((d, i) => ({
    type: "document",
    source: { type: "base64", media_type: "application/pdf", data: d.pdfBase64 },
    title: d.titulo,
    // Los ejemplos no cambian entre pedidos: se cachean junto al system.
    ...(i === docs.length - 1 ? { cache_control: { type: "ephemeral" } } : {}),
  }));
  content.push({ type: "text", text: opts.prompt });
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model,
      max_tokens: opts.maxTokens ?? 48000,
      stream: true,
      system: opts.system,
      output_config: { effort: "high" },
      messages: [{ role: "user", content }],
    }),
  });
  if (!res.ok || !res.body) {
    const body = await res.json().catch(() => null) as Record<string, unknown> | null;
    const msg = (body?.error as { message?: string } | undefined)?.message ?? `HTTP ${res.status}`;
    return json({ error: `Claude no ha podido generar el croquis: ${msg}` }, 502);
  }
  let texto = "";
  let modeloUsado = model;
  let stop = "";
  let errorStream = "";
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let k: number;
    while ((k = buf.indexOf("\n\n")) !== -1) {
      const evento = buf.slice(0, k);
      buf = buf.slice(k + 2);
      const linea = evento.split("\n").find((l) => l.startsWith("data:"));
      if (!linea) continue;
      let ev: Record<string, unknown>;
      try { ev = JSON.parse(linea.slice(5).trim()) as Record<string, unknown>; } catch { continue; }
      if (ev.type === "message_start") modeloUsado = String((ev.message as { model?: string } | undefined)?.model ?? model);
      else if (ev.type === "content_block_delta") {
        const delta = ev.delta as { type?: string; text?: string } | undefined;
        if (delta?.type === "text_delta") texto += delta.text ?? "";
      } else if (ev.type === "message_delta") stop = String((ev.delta as { stop_reason?: string } | undefined)?.stop_reason ?? stop);
      else if (ev.type === "error") errorStream = String((ev.error as { message?: string } | undefined)?.message ?? "error");
    }
  }
  if (errorStream) return json({ error: `Claude no ha podido generar el croquis: ${errorStream}` }, 502);
  if (stop === "refusal") return json({ error: "Claude ha rechazado la petición." }, 502);
  if (stop === "max_tokens") return json({ error: "El croquis se ha cortado por longitud; vuelve a intentarlo." }, 502);
  if (!texto.trim()) return json({ error: "Claude no ha devuelto contenido." }, 502);
  return { texto, modelo: modeloUsado };
}

// Respuesta "larga": la generación puede tardar más de lo que aguanta un
// proxy sin recibir nada, así que se abre la respuesta enseguida y se manda
// un espacio cada pocos segundos; al terminar se escribe el JSON final
// (JSON.parse ignora los espacios de delante). El estado HTTP es siempre 200:
// el cliente mira `error` en el cuerpo.
export function respuestaLarga(trabajo: () => Promise<Response>): Response {
  const enc = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const latido = setInterval(() => { try { controller.enqueue(enc.encode(" ")); } catch { /* cerrado */ } }, 8000);
      try {
        const r = await trabajo();
        controller.enqueue(enc.encode(await r.text()));
      } catch (e) {
        controller.enqueue(enc.encode(JSON.stringify({ error: `Error inesperado: ${e instanceof Error ? e.message : String(e)}` })));
      } finally {
        clearInterval(latido);
        controller.close();
      }
    },
  });
  return new Response(stream, { status: 200, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
}

// Extrae el SVG de la respuesta (por si viene con texto o vallas de código).
export function extraerSVG(texto: string): string | null {
  const i = texto.indexOf("<svg");
  const j = texto.lastIndexOf("</svg>");
  if (i === -1 || j === -1 || j < i) return null;
  let svg = texto.slice(i, j + "</svg>".length);
  if (!/xmlns=/.test(svg.slice(0, 200))) svg = svg.replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"');
  // Sin scripts ni referencias externas: el archivo se abre en el navegador del tapicero.
  if (/<script|<foreignObject|xlink:href\s*=\s*"http|href\s*=\s*"http|<image/i.test(svg)) return null;
  return `<?xml version="1.0" encoding="UTF-8"?>\n${svg}`;
}

// ── Llamada a Gemini (generación de imagen, HTTP directo) ──
export const GEMINI_MODEL_DEFECTO = "gemini-2.5-flash-image";
// Imagen con Gemini. Dos vías, por este orden:
//   1) GEMINI_API_KEY (clave propia de Google AI Studio) → API de Google.
//   2) Si no, la pasarela de IA de Lovable (LOVABLE_API_KEY, ya configurada en
//      Lovable Cloud; se paga con créditos de Lovable) con el modelo de imagen
//      de Gemini. Modelo configurable con LOVABLE_IMAGE_MODEL.
const GATEWAY_URL = process.env.LOVABLE_AI_GATEWAY_URL || "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODELOS_IMAGEN_LOVABLE = ["google/gemini-2.5-flash-image-preview", "google/gemini-2.5-flash-image"];

export async function generarImagen(opts: {
  prompt: string;
  imagenes: { data: string; mime: string }[];
  aspectRatio?: string;
}): Promise<{ bytes: Uint8Array; mime: string; modelo: string } | Response> {
  if (process.env.GEMINI_API_KEY) return llamarGeminiImagen(opts);
  if (process.env.LOVABLE_API_KEY) return llamarImagenLovable(opts);
  return json({ error: "Falta configurar la IA de imágenes: activa la IA de Lovable Cloud o añade GEMINI_API_KEY.", noConfigurado: true }, 503);
}

async function llamarImagenLovable(opts: { prompt: string; imagenes: { data: string; mime: string }[] }): Promise<{ bytes: Uint8Array; mime: string; modelo: string } | Response> {
  const apiKey = process.env.LOVABLE_API_KEY!;
  const content: Record<string, unknown>[] = [{ type: "text", text: opts.prompt }];
  for (const im of opts.imagenes) content.push({ type: "image_url", image_url: { url: `data:${im.mime};base64,${im.data}` } });
  const modelos = process.env.LOVABLE_IMAGE_MODEL ? [process.env.LOVABLE_IMAGE_MODEL] : MODELOS_IMAGEN_LOVABLE;
  let ultimoError = "";
  for (const model of modelos) {
    const res = await fetch(GATEWAY_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model, messages: [{ role: "user", content }], modalities: ["image", "text"] }),
    });
    if (res.status === 402) return json({ error: "Sin crédito de IA en Lovable: revisa el uso en Lovable Cloud → AI." }, 502);
    if (res.status === 429) return json({ error: "La IA de Lovable está saturada ahora mismo; vuelve a intentarlo en un minuto." }, 502);
    const body = await res.json().catch(() => null) as Record<string, unknown> | null;
    if (!res.ok) {
      ultimoError = (body?.error as { message?: string } | undefined)?.message ?? `HTTP ${res.status}`;
      // Modelo no disponible con ese nombre: se prueba el siguiente.
      if (res.status === 400 || res.status === 404) continue;
      return json({ error: `La IA de imágenes no ha podido generar la imagen: ${ultimoError}` }, 502);
    }
    const msg = (body?.choices as { message?: Record<string, unknown> }[] | undefined)?.[0]?.message;
    const imgs = (msg?.images as { image_url?: { url?: string } }[] | undefined) ?? [];
    let url = imgs.find((i) => i.image_url?.url)?.image_url?.url ?? "";
    // Por si la imagen llega dentro del contenido en vez de en `images`.
    if (!url && Array.isArray(msg?.content)) {
      url = ((msg!.content as { type?: string; image_url?: { url?: string } }[]).find((c) => c.type === "image_url")?.image_url?.url) ?? "";
    }
    const m = /^data:([^;]+);base64,(.+)$/.exec(url);
    if (m) return { bytes: base64ABytes(m[2]), mime: m[1], modelo: model };
    if (/^https?:\/\//.test(url)) {
      const r = await fetch(url);
      if (r.ok) return { bytes: new Uint8Array(await r.arrayBuffer()), mime: r.headers.get("content-type") ?? "image/png", modelo: model };
    }
    const texto = typeof msg?.content === "string" ? msg.content.slice(0, 200) : "";
    return json({ error: `La IA no ha devuelto ninguna imagen${texto ? `: ${texto}` : "."}` }, 502);
  }
  return json({ error: `La IA de imágenes no ha podido generar la imagen: ${ultimoError}` }, 502);
}

export async function llamarGeminiImagen(opts: {
  prompt: string;
  imagenes: { data: string; mime: string }[];
  aspectRatio?: string;
}): Promise<{ bytes: Uint8Array; mime: string; modelo: string } | Response> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return json({ error: "Falta configurar GEMINI_API_KEY en Lovable Cloud (Secrets).", noConfigurado: true }, 503);
  const model = process.env.GEMINI_IMAGE_MODEL || GEMINI_MODEL_DEFECTO;
  const parts: Record<string, unknown>[] = [{ text: opts.prompt }];
  for (const im of opts.imagenes) parts.push({ inline_data: { mime_type: im.mime, data: im.data } });
  const pedir = (modalidades: string[]) => fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify({
      contents: [{ role: "user", parts }],
      // Sin aspectRatio al editar una foto: Gemini conserva el encuadre de la base.
      generationConfig: { responseModalities: modalidades, ...(opts.aspectRatio ? { imageConfig: { aspectRatio: opts.aspectRatio } } : {}) },
    }),
  });
  let res = await pedir(["IMAGE"]);
  let body = await res.json().catch(() => null) as Record<string, unknown> | null;
  // Algunas versiones del modelo solo aceptan salida mixta texto+imagen.
  if (res.status === 400 && /modalit/i.test(String((body?.error as { message?: string } | undefined)?.message ?? ""))) {
    res = await pedir(["TEXT", "IMAGE"]);
    body = await res.json().catch(() => null) as Record<string, unknown> | null;
  }
  if (!res.ok) {
    const msg = (body?.error as { message?: string } | undefined)?.message ?? `HTTP ${res.status}`;
    return json({ error: `Gemini no ha podido generar la imagen: ${msg}` }, 502);
  }
  const cands = Array.isArray(body?.candidates) ? (body!.candidates as Record<string, unknown>[]) : [];
  for (const c of cands) {
    const content = c.content as { parts?: Record<string, unknown>[] } | undefined;
    for (const part of content?.parts ?? []) {
      const inline = (part.inlineData ?? part.inline_data) as { data?: string; mimeType?: string; mime_type?: string } | undefined;
      if (inline?.data) {
        const mime = inline.mimeType ?? inline.mime_type ?? "image/png";
        return { bytes: base64ABytes(inline.data), mime, modelo: model };
      }
    }
  }
  const bloqueo = (body?.promptFeedback as { blockReason?: string } | undefined)?.blockReason
    ?? (cands[0]?.finishReason as string | undefined);
  return json({ error: `Gemini no ha devuelto ninguna imagen${bloqueo ? ` (${bloqueo})` : ""}.` }, 502);
}
