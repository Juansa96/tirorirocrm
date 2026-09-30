// ══════════════════════════════════════════════════════════════════════════
// Fotos de los anuncios de Meta «clic a WhatsApp» (solo servidor, service_role).
//
// Cuando alguien escribe desde un anuncio, el mensaje trae en raw.referral el
// id del anuncio (source_id) y la miniatura de la creatividad (image_url o
// thumbnail_url). Ese enlace de fbcdn caduca en unos días, así que el ciclo de
// /procesar (cron cada 2 minutos) la descarga una vez por anuncio y la deja en
// el propio mensaje como data URI: raw._anuncio = { id, estado, foto, … }.
// Sin columnas ni buckets nuevos.
//
// La usa el parte diario de marketing (scripts/informe-marketing) para poner
// la foto de cada creatividad junto a sus chats y su coste.
// ══════════════════════════════════════════════════════════════════════════

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { bytesABase64 } from "@/lib/ia-pedido.server";

type Row = Record<string, unknown>;
const s = (v: unknown): string => (v == null ? "" : String(v).trim());
const isObj = (v: unknown): v is Row => !!v && typeof v === "object" && !Array.isArray(v);

const DIAS = 6;               // los enlaces de fbcdn duran ~5–7 días
const MAX_BYTES = 400 * 1024; // las miniaturas pesan 20–60 KB
const MAX_INTENTOS = 3;
const POR_CICLO = 3;

export interface InformeAnuncios { guardadas: number; errores: string[] }

async function descargar(url: string): Promise<string> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 10_000);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    const mime = (res.headers.get("content-type") ?? "").split(";")[0].trim();
    if (!res.ok) throw new Error(`Meta respondió ${res.status}`);
    if (!mime.startsWith("image/")) throw new Error(`no es una imagen (${mime || "sin tipo"})`);
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (bytes.length === 0) throw new Error("imagen vacía");
    if (bytes.length > MAX_BYTES) throw new Error("imagen demasiado grande");
    return `data:${mime};base64,${bytesABase64(bytes)}`;
  } finally { clearTimeout(t); }
}

/** Guarda la miniatura de los anuncios que aún no la tienen. */
export async function guardarFotosAnuncios(): Promise<InformeAnuncios> {
  const informe: InformeAnuncios = { guardadas: 0, errores: [] };

  // Anuncios que ya tienen foto (o que se han intentado): de todo el historial.
  const { data: hechos, error: e1 } = await supabaseAdmin.from("whatsapp_mensajes")
    .select("ad:raw->_anuncio->>id, estado:raw->_anuncio->>estado, intentos:raw->_anuncio->>intentos")
    .not("raw->_anuncio", "is", null)
    .limit(1000);
  if (e1) { informe.errores.push("Anuncios: " + e1.message); return informe; }
  const conFoto = new Set<string>();
  const intentos = new Map<string, number>();
  for (const h of (hechos ?? []) as Row[]) {
    const ad = s(h.ad);
    if (s(h.estado) === "ok") conFoto.add(ad);
    else intentos.set(ad, Math.max(intentos.get(ad) ?? 0, Number(h.intentos) || 1));
  }

  // Mensajes recientes que llegan desde un anuncio (el enlace aún no ha caducado).
  const desde = new Date(Date.now() - DIAS * 86_400_000).toISOString();
  const { data, error } = await supabaseAdmin.from("whatsapp_mensajes")
    .select("id, raw, enviado_at")
    .eq("direccion", "entrante")
    .not("raw->referral", "is", null)
    .gte("enviado_at", desde)
    .order("enviado_at", { ascending: false })
    .limit(300);
  if (error) { informe.errores.push("Anuncios: " + error.message); return informe; }

  // El mensaje más reciente de cada anuncio (su enlace es el que más dura).
  const porAnuncio = new Map<string, Row>();
  for (const m of (data ?? []) as Row[]) {
    const raw = isObj(m.raw) ? m.raw : {};
    const ref = isObj(raw.referral) ? raw.referral : {};
    const ad = s(ref.source_id);
    if (!ad || s(ref.source_type) !== "ad" || conFoto.has(ad) || porAnuncio.has(ad)) continue;
    if ((intentos.get(ad) ?? 0) >= MAX_INTENTOS) continue;
    if (!s(ref.image_url) && !s(ref.thumbnail_url)) continue;
    porAnuncio.set(ad, m);
  }

  for (const [ad, m] of [...porAnuncio].slice(0, POR_CICLO)) {
    const raw = m.raw as Row;
    const ref = raw.referral as Row;
    const url = s(ref.image_url) || s(ref.thumbnail_url);
    const base = { id: ad, titulo: s(ref.headline).slice(0, 200), texto: s(ref.body).slice(0, 500), enlace: s(ref.source_url), tipo: s(ref.media_type), at: new Date().toISOString() };
    let anuncio: Row;
    try {
      anuncio = { ...base, estado: "ok", foto: await descargar(url) };
      informe.guardadas++;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      anuncio = { ...base, estado: "error", intentos: (intentos.get(ad) ?? 0) + 1, error: msg.slice(0, 200) };
      informe.errores.push(`Foto del anuncio ${ad}: ${msg}`);
    }
    const { error: upErr } = await supabaseAdmin.from("whatsapp_mensajes").update({ raw: { ...raw, _anuncio: anuncio } } as never).eq("id", s(m.id));
    if (upErr) informe.errores.push("No se pudo guardar la foto del anuncio: " + upErr.message);
  }
  return informe;
}
