// ══════════════════════════════════════════════════════════════════════════
// Configuración de los canales Instagram y email (solo servidor).
//
// Tabla mensajeria_canales (una fila por canal). Solo la leen los admin del
// CRM (tiene la clave de Instagram); el servidor usa service_role. Los
// tokens del webhook y del cron son los de whatsapp_config: un único token
// para toda la bandeja de mensajes.
// ══════════════════════════════════════════════════════════════════════════

import { supabaseAdmin } from "@/integrations/supabase/client.server";

type Row = Record<string, unknown>;
const s = (v: unknown): string => (v == null ? "" : String(v).trim());

export type CanalExtra = "instagram" | "email";

export interface FilaCanal {
  canal: CanalExtra;
  activo: boolean;
  datos: Record<string, unknown>;
  conectadoAt: string;
  ultimoEventoAt: string;
}

export async function leerCanal(canal: CanalExtra): Promise<FilaCanal | null> {
  const { data, error } = await supabaseAdmin.from("mensajeria_canales" as never).select("*").eq("canal", canal).maybeSingle();
  if (error || !data) return null;
  const r = data as Row;
  return {
    canal,
    activo: r.activo !== false,
    datos: (r.datos && typeof r.datos === "object" ? r.datos : {}) as Record<string, unknown>,
    conectadoAt: s(r.conectado_at),
    ultimoEventoAt: s(r.ultimo_evento_at),
  };
}

/** Actualiza la fila del canal (la crea si no existe). `datos` se mezcla con lo que había. */
export async function guardarCanal(canal: CanalExtra, patch: { datos?: Record<string, unknown>; conectado_at?: string | null; ultimo_evento_at?: string; ultimo_error?: string | null; ultimo_error_at?: string | null; activo?: boolean }): Promise<void> {
  const actual = await leerCanal(canal);
  const fila: Row = { canal };
  if (patch.datos) fila.datos = { ...(actual?.datos ?? {}), ...patch.datos };
  for (const k of ["conectado_at", "ultimo_evento_at", "ultimo_error", "ultimo_error_at", "activo"] as const) {
    if (patch[k] !== undefined) fila[k] = patch[k];
  }
  const { error } = await supabaseAdmin.from("mensajeria_canales" as never).upsert(fila as never, { onConflict: "canal" });
  if (error) throw new Error(`No se pudo guardar la configuración de ${canal}: ${error.message}`);
}

/** Fecha de conexión de cada canal (para distinguir historial de mensajes en vivo). */
export async function conexionesCanales(): Promise<Record<CanalExtra, string>> {
  const { data } = await supabaseAdmin.from("mensajeria_canales" as never).select("canal, conectado_at");
  const out: Record<CanalExtra, string> = { instagram: "", email: "" };
  for (const r of (data ?? []) as Row[]) {
    const c = s(r.canal);
    if (c === "instagram" || c === "email") out[c] = s(r.conectado_at);
  }
  return out;
}

// ── Instagram (API de Instagram con inicio de sesión de Instagram) ──────────
export const IG_GRAPH = `https://graph.instagram.com/${process.env.INSTAGRAM_GRAPH_VERSION || "v23.0"}`;

async function fetchConTiempo(url: string, init: RequestInit = {}, ms = 15_000): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try { return await fetch(url, { ...init, signal: ctrl.signal }); } finally { clearTimeout(t); }
}

export async function tokenInstagram(): Promise<string> {
  const fila = await leerCanal("instagram");
  return s(fila?.datos.access_token) || s(process.env.INSTAGRAM_ACCESS_TOKEN);
}

/** Nombre y @usuario de quien escribe (solo funciona si nos ha escrito). */
export async function perfilInstagram(igsid: string, token: string): Promise<{ nombre: string; usuario: string } | null> {
  if (!token || !igsid) return null;
  try {
    const res = await fetchConTiempo(`${IG_GRAPH}/${encodeURIComponent(igsid)}?fields=name,username&access_token=${encodeURIComponent(token)}`);
    if (!res.ok) return null;
    const j = (await res.json()) as Row;
    const usuario = s(j.username);
    if (!usuario) return null;
    return { nombre: s(j.name), usuario };
  } catch {
    return null;
  }
}

/** Texto para `nombre_wa`: "Ana Pérez (@ana.perez)" o "@ana.perez". */
export function nombreInstagram(p: { nombre: string; usuario: string }): string {
  return p.nombre ? `${p.nombre} (@${p.usuario})` : `@${p.usuario}`;
}

/**
 * Comprueba la clave, suscribe la cuenta a los mensajes y la guarda.
 * Devuelve la cuenta conectada.
 */
export async function conectarInstagram(accessToken: string, appSecret: string): Promise<{ usuario: string; cuentaId: string }> {
  const token = accessToken.trim();
  if (!token) throw new Error("Falta la clave de acceso de Instagram");
  const me = await fetchConTiempo(`${IG_GRAPH}/me?fields=user_id,username&access_token=${encodeURIComponent(token)}`);
  const cuerpo = (await me.json().catch(() => ({}))) as Row;
  if (!me.ok) {
    const err = (cuerpo.error ?? {}) as Row;
    throw new Error(`Instagram no acepta la clave (${me.status}): ${s(err.message) || "revisa que sea la de la cuenta de Tiroriro"}`);
  }
  const usuario = s(cuerpo.username);
  const cuentaId = s(cuerpo.user_id) || s(cuerpo.id);
  // Suscribir la cuenta a los mensajes directos (idempotente).
  const sub = await fetchConTiempo(`${IG_GRAPH}/me/subscribed_apps?subscribed_fields=messages&access_token=${encodeURIComponent(token)}`, { method: "POST" });
  if (!sub.ok) {
    const j = (await sub.json().catch(() => ({}))) as Row;
    throw new Error(`No se pudo suscribir la cuenta a los mensajes (${sub.status}): ${s((j.error as Row | undefined)?.message)}`);
  }
  const datos: Record<string, unknown> = { access_token: token, usuario, cuenta_id: cuentaId, token_renovado_at: new Date().toISOString() };
  if (appSecret.trim()) datos.app_secret = appSecret.trim();
  await guardarCanal("instagram", { datos, ultimo_error: null });
  return { usuario, cuentaId };
}

/**
 * Las claves de larga duración de Instagram caducan a los 60 días si no se
 * renuevan. Se renuevan solas cada 20 días desde el ciclo de análisis.
 */
export async function renovarTokenInstagram(): Promise<void> {
  const fila = await leerCanal("instagram");
  const token = s(fila?.datos.access_token);
  if (!token) return;
  const ultima = Date.parse(s(fila?.datos.token_renovado_at));
  if (Number.isFinite(ultima) && Date.now() - ultima < 20 * 86_400_000) return;
  const res = await fetchConTiempo(`https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${encodeURIComponent(token)}`);
  const j = (await res.json().catch(() => ({}))) as Row;
  if (!res.ok || !s(j.access_token)) {
    const msg = `No se pudo renovar la clave de Instagram (${res.status}): ${s((j.error as Row | undefined)?.message)}`;
    await guardarCanal("instagram", { ultimo_error: msg, ultimo_error_at: new Date().toISOString(), datos: { token_renovado_at: new Date(Date.now() - 19 * 86_400_000).toISOString() } }); // reintento mañana
    return;
  }
  await guardarCanal("instagram", { datos: { access_token: s(j.access_token), token_renovado_at: new Date().toISOString() } });
}
