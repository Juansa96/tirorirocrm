import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { parsearWebhook, type MensajeNormalizado, type ContactoSync } from "@/lib/whatsapp/parse";
import { capturarAudiosWebhook } from "@/lib/whatsapp/audio.server";

// ── Webhook de WhatsApp (Cloud API / proveedor de coexistencia) ─────────────
// URL a poner en el proveedor:  https://<crm>/api/whatsapp/webhook?token=<webhook_token>
//   GET  → verificación de Meta (hub.mode / hub.verify_token / hub.challenge).
//   POST → eventos. Se guardan los mensajes (idempotente por id de WhatsApp)
//          y se responde 200 enseguida. El análisis con IA va aparte
//          (/api/whatsapp/procesar, lanzado por cron cada 2 minutos y desde
//          la bandeja del CRM), para no hacer esperar al proveedor.
// Autenticación del POST: ?token= o cabecera x-whatsapp-token igual a
// whatsapp_config.webhook_token; o, si hay app_secret, la firma
// X-Hub-Signature-256 de Meta. Sin token configurado, el endpoint está cerrado.

const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { "Content-Type": "application/json" } });
type Row = Record<string, unknown>;
const s = (v: unknown): string => (v == null ? "" : String(v));

function safeEqual(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function firmaValida(secret: string, cuerpo: string, cabecera: string | null): Promise<boolean> {
  if (!secret || !cabecera) return false;
  const firma = cabecera.replace(/^sha256=/i, "").trim().toLowerCase();
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(cuerpo));
  const hex = Array.from(new Uint8Array(mac)).map((b) => b.toString(16).padStart(2, "0")).join("");
  return safeEqual(hex, firma);
}

async function cargarConfig(): Promise<Row | null> {
  const { data } = await supabaseAdmin.from("whatsapp_config").select("*").eq("id", 1).maybeSingle();
  return (data as Row | null) ?? null;
}

// Guarda los mensajes agrupados por conversación. Devuelve cuántos son nuevos.
// Todo por lotes (una lectura de conversaciones, un alta conjunta de las que
// faltan, upserts de 200 mensajes y actualizaciones en paralelo): los paquetes
// de historial traen cientos de mensajes y, si el webhook tarda en responder,
// Meta lo da por fallido y reenvía el mismo paquete una y otra vez sin pasar
// al siguiente (se vio el 23/09/2026: un paquete de 77 KB repetido 28 veces).
const CAMPOS_CONV = "id, telefono, nombre_wa, mensajes, ultimo_mensaje_at, ultimo_mensaje_entrante_at";
const ms = (v: unknown): number => { const n = Date.parse(s(v)); return Number.isFinite(n) ? n : 0; };

async function leerConversaciones(telefonos: string[], destino: Map<string, Row>): Promise<void> {
  for (let i = 0; i < telefonos.length; i += 200) {
    const { data, error } = await supabaseAdmin.from("whatsapp_conversaciones").select(CAMPOS_CONV).in("telefono", telefonos.slice(i, i + 200));
    if (error) throw new Error("No se pudieron leer las conversaciones: " + error.message);
    for (const r of (data ?? []) as Row[]) destino.set(s(r.telefono), r);
  }
}

async function guardarMensajes(mensajes: MensajeNormalizado[]): Promise<number> {
  const porTelefono = new Map<string, MensajeNormalizado[]>();
  for (const m of mensajes) {
    const arr = porTelefono.get(m.telefono) ?? [];
    arr.push(m);
    porTelefono.set(m.telefono, arr);
  }
  for (const lista of porTelefono.values()) lista.sort((a, b) => a.enviadoAt.localeCompare(b.enviadoAt));
  const telefonos = [...porTelefono.keys()];
  const nombreDe = (lista: MensajeNormalizado[]) => lista.map((m) => m.nombreWa).filter(Boolean).pop() ?? "";

  // 1. Conversaciones que ya existen.
  const convs = new Map<string, Row>();
  await leerConversaciones(telefonos, convs);

  // 2. Alta de las que faltan (origen historial si solo llega historial). Si
  //    otro evento la crea a la vez, el upsert la ignora y se relee.
  const altas = telefonos.filter((t) => !convs.has(t)).map((telefono) => {
    const lista = porTelefono.get(telefono) ?? [];
    return { telefono, nombre_wa: nombreDe(lista), origen: lista.every((m) => m.historial) ? "historial" : "webhook" };
  });
  if (altas.length) {
    const { data, error } = await supabaseAdmin.from("whatsapp_conversaciones")
      .upsert(altas as never, { onConflict: "telefono", ignoreDuplicates: true })
      .select(CAMPOS_CONV);
    if (error) throw new Error("No se pudo crear la conversación: " + error.message);
    for (const r of (data ?? []) as Row[]) convs.set(s(r.telefono), r);
    const faltan = altas.map((a) => a.telefono).filter((t) => !convs.has(t));
    if (faltan.length) await leerConversaciones(faltan, convs);
  }

  // 3. Mensajes (idempotente por wa_id) en lotes; se cuentan los nuevos por conversación.
  const filas: Row[] = [];
  for (const [telefono, lista] of porTelefono) {
    const conv = convs.get(telefono);
    if (!conv) throw new Error("No se pudo crear la conversación de " + telefono);
    for (const m of lista) {
      filas.push({ wa_id: m.waId, conversacion_id: s(conv.id), direccion: m.direccion, tipo: m.tipo, texto: m.texto, enviado_at: m.enviadoAt, raw: m.raw });
    }
  }
  const nuevosPorConv = new Map<string, number>();
  for (let i = 0; i < filas.length; i += 200) {
    const { data, error } = await supabaseAdmin.from("whatsapp_mensajes")
      .upsert(filas.slice(i, i + 200) as never, { onConflict: "wa_id", ignoreDuplicates: true })
      .select("conversacion_id");
    if (error) throw new Error("No se pudieron guardar los mensajes: " + error.message);
    for (const r of (data ?? []) as Row[]) {
      const id = s(r.conversacion_id);
      nuevosPorConv.set(id, (nuevosPorConv.get(id) ?? 0) + 1);
    }
  }

  // 4. Contadores, fechas y nombre de perfil: solo donde cambie algo, en paralelo.
  const updates: Promise<void>[] = [];
  for (const [telefono, lista] of porTelefono) {
    const conv = convs.get(telefono);
    if (!conv) continue;
    const convId = s(conv.id);
    const patch: Record<string, unknown> = {};
    const nuevos = nuevosPorConv.get(convId) ?? 0;
    if (nuevos) patch.mensajes = (Number(conv.mensajes) || 0) + nuevos;
    const ultimo = lista[lista.length - 1].enviadoAt;
    const ultimoEntrante = [...lista].reverse().find((m) => m.direccion === "entrante")?.enviadoAt ?? "";
    if (ms(ultimo) > ms(conv.ultimo_mensaje_at)) patch.ultimo_mensaje_at = ultimo;
    if (ultimoEntrante && ms(ultimoEntrante) > ms(conv.ultimo_mensaje_entrante_at)) patch.ultimo_mensaje_entrante_at = ultimoEntrante;
    // El nombre de perfil de WhatsApp solo rellena si no hay ninguno: el de
    // la agenda del móvil (smb_app_state_sync) manda.
    const nombre = nombreDe(lista);
    if (nombre && !s(conv.nombre_wa)) patch.nombre_wa = nombre;
    if (Object.keys(patch).length === 0) continue;
    updates.push((async () => {
      const { error } = await supabaseAdmin.from("whatsapp_conversaciones").update(patch as never).eq("id", convId);
      if (error) throw new Error("No se pudo actualizar la conversación: " + error.message);
    })());
  }
  await Promise.all(updates);

  let total = 0;
  for (const n of nuevosPorConv.values()) total += n;
  return total;
}

// Agenda del móvil: guarda el nombre del contacto en su conversación (y la
// crea sin mensajes si aún no existe, para tener el nombre cuando escriba).
// También por lotes: al conectar llega la agenda entera de golpe.
async function guardarContactos(contactos: ContactoSync[]): Promise<number> {
  const porTelefono = new Map<string, string>();
  for (const c of contactos) {
    if (c.accion === "remove" || !c.nombre) continue;
    porTelefono.set(c.telefono, c.nombre);
  }
  if (porTelefono.size === 0) return 0;
  const convs = new Map<string, Row>();
  await leerConversaciones([...porTelefono.keys()], convs);

  let n = 0;
  const updates: Promise<void>[] = [];
  const altas: Row[] = [];
  for (const [telefono, nombre] of porTelefono) {
    const conv = convs.get(telefono);
    if (!conv) { altas.push({ telefono, nombre_wa: nombre, origen: "historial" }); continue; }
    if (s(conv.nombre_wa) === nombre) continue;
    n++;
    updates.push((async () => {
      const { error } = await supabaseAdmin.from("whatsapp_conversaciones").update({ nombre_wa: nombre } as never).eq("id", s(conv.id));
      if (error) throw new Error("No se pudo guardar el nombre del contacto: " + error.message);
    })());
  }
  for (let i = 0; i < altas.length; i += 200) {
    const { data, error } = await supabaseAdmin.from("whatsapp_conversaciones")
      .upsert(altas.slice(i, i + 200) as never, { onConflict: "telefono", ignoreDuplicates: true })
      .select("id");
    if (error) throw new Error("No se pudo crear la conversación del contacto: " + error.message);
    n += data?.length ?? 0;
  }
  await Promise.all(updates);
  return n;
}

export const Route = createFileRoute("/api/whatsapp/webhook")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        const url = new URL(request.url);
        const mode = url.searchParams.get("hub.mode");
        const token = url.searchParams.get("hub.verify_token") ?? "";
        const challenge = url.searchParams.get("hub.challenge") ?? "";
        const cfg = await cargarConfig();
        if (!cfg) return json({ error: "Sin configurar" }, 503);
        if (mode === "subscribe" && safeEqual(token, s(cfg.verify_token))) {
          return new Response(challenge, { status: 200, headers: { "Content-Type": "text/plain" } });
        }
        // Comprobación manual desde el navegador con ?token=
        if (safeEqual(url.searchParams.get("token") ?? "", s(cfg.webhook_token))) {
          return json({ ok: true, version: 2, mensaje: "Webhook de WhatsApp listo", ultimoEvento: cfg.ultimo_evento_at ?? null });
        }
        return json({ error: "No autorizado" }, 403);
      },

      POST: async ({ request }: { request: Request }) => {
        const cfg = await cargarConfig();
        if (!cfg || !s(cfg.webhook_token)) return json({ error: "Sin configurar" }, 503);
        const url = new URL(request.url);
        const cuerpo = await request.text();

        const tokenDado = url.searchParams.get("token") ?? request.headers.get("x-whatsapp-token") ?? "";
        let autorizado = safeEqual(tokenDado, s(cfg.webhook_token));
        if (!autorizado && s(cfg.app_secret)) {
          autorizado = await firmaValida(s(cfg.app_secret), cuerpo, request.headers.get("x-hub-signature-256"));
        }
        if (!autorizado) return json({ error: "No autorizado" }, 401);

        let body: unknown = null;
        try { body = JSON.parse(cuerpo); } catch { /* se registra abajo */ }
        const ahora = new Date().toISOString();

        try {
          if (body == null) throw new Error("El cuerpo no es JSON");
          const parsed = parsearWebhook(body);
          const nuevos = parsed.mensajes.length ? await guardarMensajes(parsed.mensajes) : 0;
          const contactos = parsed.contactos.length ? await guardarContactos(parsed.contactos) : 0;
          // Audios: su enlace caduca en minutos, así que se descargan ya (la
          // transcripción la hace el ciclo de análisis). Nunca rompe el webhook.
          if (parsed.mensajes.some((m) => m.tipo === "audio" || m.tipo === "voice")) {
            await capturarAudiosWebhook(parsed.mensajes).catch((e) => console.error("[whatsapp/webhook] audio", e));
          }

          const patch: Record<string, unknown> = { ultimo_evento_at: ahora };
          if (parsed.numeroNegocio && !s(cfg.numero_negocio)) patch.numero_negocio = parsed.numeroNegocio;
          const enVivo = parsed.campos.some((c) => c === "messages" || c === "smb_message_echoes");
          if (enVivo && !s(cfg.conectado_at)) patch.conectado_at = ahora;
          await supabaseAdmin.from("whatsapp_config").update(patch as never).eq("id", 1);

          await supabaseAdmin.from("whatsapp_eventos").insert({
            campo: parsed.campos.join(",").slice(0, 200) || "(sin campo)",
            mensajes: nuevos + contactos,
            // Solo guardamos el payload hasta 120 KB (un paquete de historial ronda los 80 KB).
            payload: cuerpo.length < 120_000 ? (body as never) : ({ resumen: `payload de ${cuerpo.length} bytes`, campos: parsed.campos } as never),
          } as never);

          return json({ ok: true, mensajes: nuevos, ignorados: parsed.ignorados });
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          console.error("[whatsapp/webhook]", msg);
          await supabaseAdmin.from("whatsapp_eventos").insert({ campo: "error", mensajes: 0, error: msg.slice(0, 1000), payload: cuerpo.length < 20_000 && body != null ? (body as never) : null } as never);
          await supabaseAdmin.from("whatsapp_config").update({ ultimo_evento_at: ahora, ultimo_error: msg.slice(0, 1000), ultimo_error_at: ahora } as never).eq("id", 1);
          // 200 para que el proveedor no reintente en bucle un payload que no entendemos.
          return json({ ok: false, error: msg });
        }
      },
    },
  },
});
