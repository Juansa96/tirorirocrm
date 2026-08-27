// ══════════════════════════════════════════════════════════════════════════
// URLs firmadas para los buckets privados ("telas", "pedido-archivos").
//
// Histórico: estos buckets eran públicos y en la base de datos se guardó la
// URL pública completa. Ahora son privados, así que:
//   - al subir, se guarda la ruta y se firma la URL para mostrarla,
//   - al leer, se vuelve a firmar a partir de la ruta (que se extrae de la
//     URL guardada cuando la fila es antigua).
// Nunca lanza: si algo falla se devuelve la URL original (que simplemente no
// cargará), para no romper la pantalla.
// ══════════════════════════════════════════════════════════════════════════

import { supabase } from "@/integrations/supabase/client";

export const SIGNED_URL_TTL = 60 * 60 * 8; // 8 h

// Extrae la ruta dentro del bucket a partir de una URL pública o firmada.
// Ej.: …/storage/v1/object/public/telas/telas/uuid.jpg → "telas/uuid.jpg"
export function storagePathFromUrl(url: string, bucket: string): string {
  if (!url) return "";
  if (!url.includes("/storage/v1/object/")) return "";
  const marker = `/${bucket}/`;
  const i = url.indexOf(marker);
  if (i === -1) return "";
  const rest = url.slice(i + marker.length);
  const clean = rest.split("?")[0] ?? "";
  try {
    return decodeURIComponent(clean);
  } catch {
    return clean;
  }
}

// Firma un lote de rutas. Devuelve un mapa ruta → URL firmada.
export async function signPaths(bucket: string, paths: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const unique = Array.from(new Set(paths.filter(Boolean)));
  if (unique.length === 0) return out;
  try {
    const { data } = await supabase.storage.from(bucket).createSignedUrls(unique, SIGNED_URL_TTL);
    for (const row of data ?? []) {
      const p = (row as { path?: string | null }).path ?? "";
      if (p && row.signedUrl) out.set(p, row.signedUrl);
    }
  } catch {
    // Sin red / sin permiso → se conservan las URLs originales.
  }
  return out;
}

// Firma una única ruta (devuelve "" si no se puede).
export async function signPath(bucket: string, path: string): Promise<string> {
  if (!path) return "";
  try {
    const { data } = await supabase.storage.from(bucket).createSignedUrl(path, SIGNED_URL_TTL);
    return data?.signedUrl ?? "";
  } catch {
    return "";
  }
}

// Dada una lista de URLs guardadas (públicas antiguas o firmadas caducadas),
// devuelve un mapa urlGuardada → urlFirmada vigente.
export async function refreshSignedUrls(bucket: string, urls: string[]): Promise<Map<string, string>> {
  const byPath = new Map<string, string[]>();
  for (const u of urls) {
    const p = storagePathFromUrl(u, bucket);
    if (!p) continue;
    (byPath.get(p) ?? byPath.set(p, []).get(p)!).push(u);
  }
  const signed = await signPaths(bucket, Array.from(byPath.keys()));
  const out = new Map<string, string>();
  for (const [p, originals] of byPath) {
    const s = signed.get(p);
    if (!s) continue;
    for (const o of originals) out.set(o, s);
  }
  return out;
}
