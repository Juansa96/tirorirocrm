// ══════════════════════════════════════════════════════════════════════════
// Anuncios de Meta (Facebook / Instagram Ads): foto y cifras de CADA anuncio
// para el parte de marketing (solo servidor, service_role).
//
// Metricool solo da los datos por campaña; el detalle por anuncio (y la foto
// de la creatividad) se lee aquí de la API de marketing de Meta con una clave
// de solo lectura (ads_read) que un admin pega en /whatsapp → Configuración.
//
// Sin columnas ni tablas nuevas:
//   · la clave y la cuenta van en mensajeria_canales (fila «instagram»,
//     datos.meta_ads_token / datos.meta_ads_cuenta), solo admin;
//   · la foto y las cifras de cada anuncio van en UNA fila de whatsapp_eventos
//     (campo = «meta_ads»), que se reescribe en cada sincronización.
// La sincronización corre sola desde el ciclo de /api/whatsapp/procesar como
// mucho cada 3 horas, y al conectar la clave.
// ══════════════════════════════════════════════════════════════════════════

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { bytesABase64 } from "@/lib/ia-pedido.server";
import { guardarCanal, leerCanal } from "@/lib/whatsapp/canales.server";

type Row = Record<string, unknown>;
const s = (v: unknown): string => (v == null ? "" : String(v).trim());
const n = (v: unknown): number => { const x = Number(v); return Number.isFinite(x) ? x : 0; };
const isObj = (v: unknown): v is Row => !!v && typeof v === "object" && !Array.isArray(v);

const GRAPH = `https://graph.facebook.com/${process.env.META_GRAPH_VERSION || "v21.0"}`;
const CAMPO = "meta_ads";
const CADA_MS = 3 * 3_600_000;
const MAX_FOTO = 400 * 1024;

export interface Cifras { gasto: number; impresiones: number; alcance: number; clics: number; clics_enlace: number; leads: number; conversaciones: number }
export interface AnuncioMeta {
  id: string; nombre: string; campana: string; estado: string;
  foto: string;                 // data URI (vacío si no se pudo)
  mes: Cifras; semana: Cifras; ayer: Cifras;
}
export interface InstantaneaMeta { sincronizado_at: string; cuenta: string; anuncios: AnuncioMeta[]; error?: string }

async function fetchConTiempo(url: string, ms = 20_000): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try { return await fetch(url, { signal: ctrl.signal }); } finally { clearTimeout(t); }
}

async function graph(ruta: string, token: string, params: Record<string, string> = {}): Promise<Row> {
  const q = new URLSearchParams({ ...params, access_token: token });
  const res = await fetchConTiempo(`${GRAPH}/${ruta}?${q}`);
  const j = (await res.json().catch(() => ({}))) as Row;
  if (!res.ok) {
    const err = isObj(j.error) ? j.error : {};
    throw new Error(`Meta respondió ${res.status}: ${s(err.message) || "error desconocido"}`);
  }
  return j;
}

/** Recorre todas las páginas de un listado de la API. */
async function listar(ruta: string, token: string, params: Record<string, string>): Promise<Row[]> {
  const out: Row[] = [];
  let j = await graph(ruta, token, params);
  for (let i = 0; i < 20; i++) {
    out.push(...((Array.isArray(j.data) ? j.data : []) as Row[]));
    const next = isObj(j.paging) ? s(j.paging.next) : "";
    if (!next) break;
    const res = await fetchConTiempo(next);
    j = (await res.json().catch(() => ({}))) as Row;
    if (!res.ok) break;
  }
  return out;
}

function cuentaNormalizada(cuenta: string): string {
  const c = cuenta.replace(/\s+/g, "").replace(/^act_/i, "");
  if (!/^\d{5,25}$/.test(c)) throw new Error("La cuenta de anuncios es un número (por ejemplo 3757816891176752)");
  return `act_${c}`;
}

export async function configMetaAds(): Promise<{ token: string; cuenta: string }> {
  const fila = await leerCanal("instagram");
  return { token: s(fila?.datos.meta_ads_token), cuenta: s(fila?.datos.meta_ads_cuenta) };
}

/** Comprueba la clave contra la cuenta y la guarda. */
export async function conectarMetaAds(token: string, cuenta: string): Promise<{ nombre: string; cuenta: string }> {
  const t = token.trim();
  if (!t) throw new Error("Falta la clave de acceso de Meta");
  const act = cuentaNormalizada(cuenta || "3757816891176752");
  const j = await graph(act, t, { fields: "name,account_status,currency" });
  await guardarCanal("instagram", { datos: { meta_ads_token: t, meta_ads_cuenta: act, meta_ads_nombre: s(j.name), meta_ads_error: "" } });
  return { nombre: s(j.name), cuenta: act };
}

export async function desconectarMetaAds(): Promise<void> {
  await guardarCanal("instagram", { datos: { meta_ads_token: "", meta_ads_error: "" } });
}

function cifras(r: Row | undefined): Cifras {
  const acciones = (Array.isArray(r?.actions) ? r!.actions : []) as Row[];
  const accion = (...tipos: string[]) => acciones.filter((a) => tipos.includes(s(a.action_type))).reduce((t, a) => t + n(a.value), 0);
  return {
    gasto: n(r?.spend), impresiones: n(r?.impressions), alcance: n(r?.reach),
    clics: n(r?.clicks), clics_enlace: n(r?.inline_link_clicks),
    leads: accion("offsite_conversion.fb_pixel_lead", "lead"),
    conversaciones: accion("onsite_conversion.messaging_conversation_started_7d"),
  };
}

async function descargarFoto(url: string): Promise<string> {
  if (!url) return "";
  try {
    const res = await fetchConTiempo(url, 10_000);
    const mime = (res.headers.get("content-type") ?? "").split(";")[0].trim();
    if (!res.ok || !mime.startsWith("image/")) return "";
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (!bytes.length || bytes.length > MAX_FOTO) return "";
    return `data:${mime};base64,${bytesABase64(bytes)}`;
  } catch {
    return "";
  }
}

async function leerInstantanea(): Promise<{ id: number | null; datos: InstantaneaMeta | null }> {
  const { data } = await supabaseAdmin.from("whatsapp_eventos").select("id, payload").eq("campo", CAMPO).order("id", { ascending: false }).limit(1).maybeSingle();
  const r = data as Row | null;
  return { id: r ? n(r.id) : null, datos: r && isObj(r.payload) ? (r.payload as unknown as InstantaneaMeta) : null };
}

export async function instantaneaMetaAds(): Promise<InstantaneaMeta | null> {
  return (await leerInstantanea()).datos;
}

/** Foto (data URI) de un anuncio por su id o por su nombre exacto. */
export async function fotoAnuncioMeta(clave: { id?: string; nombre?: string }): Promise<string> {
  const d = await instantaneaMetaAds();
  const a = d?.anuncios.find((x) => (clave.id && x.id === clave.id) || (clave.nombre && x.nombre === clave.nombre));
  return a?.foto ?? "";
}

function hoyMadrid(offsetDias = 0): string {
  const d = new Date(Date.now() - offsetDias * 86_400_000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

/**
 * Lee de Meta todos los anuncios de la cuenta que están activos o han gastado
 * este mes, con su foto y sus cifras (mes, últimos 7 días y ayer), y los guarda.
 * `forzar` ignora el mínimo de 3 horas entre sincronizaciones.
 */
export async function sincronizarMetaAds(opts: { forzar?: boolean } = {}): Promise<{ anuncios: number; fotos: number } | null> {
  const { token, cuenta } = await configMetaAds();
  if (!token || !cuenta) return null;
  const previa = await leerInstantanea();
  if (!opts.forzar && previa.datos && Date.now() - Date.parse(previa.datos.sincronizado_at) < CADA_MS) return null;

  const ayer = hoyMadrid(1);
  const inicioMes = `${ayer.slice(0, 8)}01`;
  const hace7 = hoyMadrid(7);
  let instantanea: InstantaneaMeta;
  try {
    const campos = "ad_id,ad_name,campaign_name,spend,impressions,reach,clicks,inline_link_clicks,actions";
    const rango = (desde: string, hasta: string) => ({ level: "ad", fields: campos, limit: "500", time_range: JSON.stringify({ since: desde, until: hasta }) });
    const [ads, mes, semana, deAyer] = await Promise.all([
      listar(`${cuenta}/ads`, token, {
        fields: "id,name,effective_status,campaign{name},creative.thumbnail_width(320).thumbnail_height(320){thumbnail_url,image_url}",
        limit: "200",
      }),
      listar(`${cuenta}/insights`, token, rango(inicioMes, ayer)),
      listar(`${cuenta}/insights`, token, rango(hace7, ayer)),
      listar(`${cuenta}/insights`, token, rango(ayer, ayer)),
    ]);
    const porId = (filas: Row[]) => new Map(filas.map((f) => [s(f.ad_id), f]));
    const mMes = porId(mes), mSem = porId(semana), mAyer = porId(deAyer);
    const fotosPrevias = new Map((previa.datos?.anuncios ?? []).filter((a) => a.foto).map((a) => [a.id, a.foto]));

    const anuncios: AnuncioMeta[] = [];
    for (const ad of ads) {
      const id = s(ad.id);
      const estado = s(ad.effective_status);
      const cMes = cifras(mMes.get(id));
      if (estado !== "ACTIVE" && cMes.gasto <= 0) continue; // solo lo que está en marcha o ha gastado este mes
      const creativo = isObj(ad.creative) ? ad.creative : {};
      const foto = fotosPrevias.get(id) || await descargarFoto(s(creativo.thumbnail_url) || s(creativo.image_url));
      anuncios.push({
        id, nombre: s(ad.name), campana: isObj(ad.campaign) ? s(ad.campaign.name) : s(mMes.get(id)?.campaign_name),
        estado, foto, mes: cMes, semana: cifras(mSem.get(id)), ayer: cifras(mAyer.get(id)),
      });
    }
    anuncios.sort((a, b) => b.mes.gasto - a.mes.gasto);
    instantanea = { sincronizado_at: new Date().toISOString(), cuenta, anuncios };
    await guardarCanal("instagram", { datos: { meta_ads_error: "", meta_ads_sincronizado_at: instantanea.sincronizado_at } });
  } catch (e) {
    const msg = (e instanceof Error ? e.message : String(e)).slice(0, 300);
    await guardarCanal("instagram", { datos: { meta_ads_error: msg } });
    // Se conserva lo último bueno; se anota el error y se reintenta en 3 horas.
    instantanea = { ...(previa.datos ?? { cuenta, anuncios: [] }), sincronizado_at: new Date().toISOString(), error: msg };
  }

  const fila = { campo: CAMPO, mensajes: instantanea.anuncios.length, error: instantanea.error ?? null, payload: instantanea, recibido_at: new Date().toISOString() };
  if (previa.id != null) await supabaseAdmin.from("whatsapp_eventos").update(fila as never).eq("id", previa.id);
  else await supabaseAdmin.from("whatsapp_eventos").insert(fila as never);
  return { anuncios: instantanea.anuncios.length, fotos: instantanea.anuncios.filter((a) => a.foto).length };
}
