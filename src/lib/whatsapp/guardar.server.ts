// ══════════════════════════════════════════════════════════════════════════
// Guardado de mensajes en la bandeja (solo servidor, service_role). Lo usan
// los tres canales: webhook de WhatsApp, webhook de Instagram y la entrada
// del correo. La clave de la conversación (`telefono`) lleva el canal; ver
// canales.ts.
// ══════════════════════════════════════════════════════════════════════════

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { MensajeNormalizado } from "./parse";

type Row = Record<string, unknown>;
const s = (v: unknown): string => (v == null ? "" : String(v));

// Guarda los mensajes agrupados por conversación. Devuelve cuántos son nuevos.
// Todo por lotes (una lectura de conversaciones, un alta conjunta de las que
// faltan, upserts de 200 mensajes y actualizaciones en paralelo): los paquetes
// de historial traen cientos de mensajes y, si el webhook tarda en responder,
// Meta lo da por fallido y reenvía el mismo paquete una y otra vez sin pasar
// al siguiente (se vio el 23/09/2026: un paquete de 77 KB repetido 28 veces).
const CAMPOS_CONV = "id, telefono, nombre_wa, mensajes, ultimo_mensaje_at, ultimo_mensaje_entrante_at";
const ms = (v: unknown): number => { const n = Date.parse(s(v)); return Number.isFinite(n) ? n : 0; };

export async function leerConversaciones(telefonos: string[], destino: Map<string, Row>): Promise<void> {
  for (let i = 0; i < telefonos.length; i += 200) {
    const { data, error } = await supabaseAdmin.from("whatsapp_conversaciones").select(CAMPOS_CONV).in("telefono", telefonos.slice(i, i + 200));
    if (error) throw new Error("No se pudieron leer las conversaciones: " + error.message);
    for (const r of (data ?? []) as Row[]) destino.set(s(r.telefono), r);
  }
}

export async function guardarMensajes(mensajes: MensajeNormalizado[]): Promise<number> {
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

  // (El contador y las fechas también los pone el trigger de la BD
  //  whatsapp_mensajes_contador en la misma transacción del alta, migración
  //  20260926150000: así no se descuadran aunque este webhook falle después.)
  // 4. Contador de mensajes: se RECUENTA en la BD, no se suma. Si una entrega
  //    falló a medias (mensajes guardados pero contador sin actualizar), el
  //    reintento de Meta llega con 0 nuevos y sumar dejaba el contador mal para
  //    siempre (y a 0 el chat no salía en la bandeja). Por lotes de 25.
  const reales = new Map<string, number>();
  const convIds = [...new Set([...porTelefono.keys()].map((t) => s(convs.get(t)?.id)).filter(Boolean))];
  for (let i = 0; i < convIds.length; i += 25) {
    await Promise.all(convIds.slice(i, i + 25).map(async (id) => {
      const { count, error } = await supabaseAdmin.from("whatsapp_mensajes").select("id", { count: "exact", head: true }).eq("conversacion_id", id);
      if (!error && count != null) reales.set(id, count);
    }));
  }

  // 5. Contadores, fechas y nombre de perfil: solo donde cambie algo, en paralelo.
  const updates: Promise<void>[] = [];
  for (const [telefono, lista] of porTelefono) {
    const conv = convs.get(telefono);
    if (!conv) continue;
    const convId = s(conv.id);
    const patch: Record<string, unknown> = {};
    const nuevos = nuevosPorConv.get(convId) ?? 0;
    const total = reales.get(convId) ?? (Number(conv.mensajes) || 0) + nuevos;
    if (total !== (Number(conv.mensajes) || 0)) patch.mensajes = total;
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


// ── Autenticación de las entradas (webhooks, correo) ────────────────────────
export function safeEqual(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Firma X-Hub-Signature-256 de Meta (HMAC-SHA256 del cuerpo con el secreto de la app). */
export async function firmaValida(secret: string, cuerpo: string, cabecera: string | null): Promise<boolean> {
  if (!secret || !cabecera) return false;
  const firma = cabecera.replace(/^sha256=/i, "").trim().toLowerCase();
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(cuerpo));
  const hex = Array.from(new Uint8Array(mac)).map((b) => b.toString(16).padStart(2, "0")).join("");
  return safeEqual(hex, firma);
}

/** Token común de la bandeja (whatsapp_config.webhook_token / verify_token). */
export async function tokensBandeja(): Promise<{ webhookToken: string; verifyToken: string } | null> {
  const { data } = await supabaseAdmin.from("whatsapp_config").select("webhook_token, verify_token").eq("id", 1).maybeSingle();
  if (!data) return null;
  const r = data as Row;
  return { webhookToken: s(r.webhook_token), verifyToken: s(r.verify_token) };
}
