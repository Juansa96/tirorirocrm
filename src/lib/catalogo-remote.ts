// ══════════════════════════════════════════════════════════════════════════
// src/lib/catalogo-remote.ts — Fuente única de precios (Fase 2).
//
// La web (tirorirohome.com) publica sus precios en /catalog.json, generado
// desde su `src/data/pricing.ts` (única fuente de verdad de PVP con IVA).
// Aquí los descargamos al arrancar y hacemos OVERLAY sobre las tablas de
// `catalogo.ts`: así el CRM no mantiene su propia copia de importes.
//
// Robustez:
//  - Si la descarga falla (web caída, sin red, JSON inválido) NO pasa nada:
//    quedan los valores locales de catalogo.ts, que son un espejo de la web
//    (Fase 1). El alta manual sigue funcionando siempre.
//  - Solo se sobrescriben importes conocidos; nunca se inventan opciones.
//  - No toca datos guardados: solo cambia los precios que se OFRECEN al crear
//    un producto nuevo.
// ══════════════════════════════════════════════════════════════════════════

import {
  CABECERO_ANCHOS, BANCO_OPCIONES, PUF_OPCIONES, MESA_OPCIONES,
  COJIN_OPCIONES, PANTALLA_OPCIONES,
} from "./catalogo";

// Se pide a la ruta servidor del propio CRM (mismo origen → sin CORS), que a
// su vez hace de proxy del /catalog.json de la web. Configurable por si se
// quisiera apuntar directamente a otra URL.
const WEB_CATALOG_URL =
  (import.meta.env.VITE_WEB_CATALOG_URL as string | undefined)?.trim() ||
  "/api/public/catalog";

type PriceMap = Record<string, number>;
interface RemoteCatalog {
  version?: string;
  cabecero?: { base?: PriceMap; premium?: PriceMap };
  banco?: { base?: PriceMap; premium?: PriceMap; vivo?: number };
  puf?: { base?: PriceMap; premium?: PriceMap; vivo?: number };
  mesa?: { base?: PriceMap; premium?: PriceMap; vivo?: number };
  cojin?: { base?: PriceMap; premium?: PriceMap };
  pantalla?: { base?: PriceMap; premium?: PriceMap };
}

// Mapa id-CRM → clave-web para las categorías cuyos ids no coinciden 1:1.
const PUF_KEY: Record<string, string> = {
  "cuad-40x40x40": "cuadrado-40", "cuad-50x50x40": "cuadrado-50", "cuad-60x60x40": "cuadrado-60",
  "red-40x40": "redondo-40", "red-50x40": "redondo-50", "red-60x40": "redondo-60",
};
const MESA_KEY: Record<string, string> = {
  "60x60x40": "60x60", "80x80x40": "80x80", "100x100x40": "100x100", "120x120x40": "120x120",
};
const COJIN_KEY: Record<string, string> = {
  "cuad-40x40": "rodiles-40x40", "cuad-45x45": "rodiles-45x45", "cuad-50x50": "rodiles-50x50",
  "rect-50x30": "covadonga-50x30", "rect-60x40": "covadonga-60x40", "rect-70x90": "covadonga-70x90",
  "cil-13x90": "gulpiyuri-13x90",
};
const PANTALLA_KEY: Record<string, string> = {
  "cil-40x40": "cilindro-Ø40×40cm", "cil-15x20": "cilindro-Ø15×20cm", "cil-25x25": "cilindro-Ø25×25cm",
  "cuad-20x20": "cuadrado-20×20cm", "rect-20x40": "rectangulo-20×40cm",
};

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

// Sobrescribe precio/premium de una lista de opciones a partir de los mapas
// web, resolviendo la clave con `keyOf`. Devuelve nº de opciones actualizadas.
function overlay<T extends { id: string; precio: number; premium: number }>(
  opciones: T[],
  base: PriceMap | undefined,
  premium: PriceMap | undefined,
  keyOf: (id: string) => string | undefined,
): number {
  if (!base && !premium) return 0;
  let n = 0;
  for (const o of opciones) {
    const key = keyOf(o.id);
    if (!key) continue;
    let touched = false;
    if (base && isNum(base[key])) { o.precio = base[key]; touched = true; }
    if (premium && isNum(premium[key])) { o.premium = premium[key]; touched = true; }
    if (touched) n++;
  }
  return n;
}

export function applyRemoteCatalog(remote: RemoteCatalog): void {
  const idSelf = (id: string) => id; // cabecero y banco: id = clave web
  overlay(CABECERO_ANCHOS, remote.cabecero?.base, remote.cabecero?.premium, idSelf);
  overlay(BANCO_OPCIONES, remote.banco?.base, remote.banco?.premium, idSelf);
  overlay(PUF_OPCIONES, remote.puf?.base, remote.puf?.premium, (id) => PUF_KEY[id]);
  overlay(MESA_OPCIONES, remote.mesa?.base, remote.mesa?.premium, (id) => MESA_KEY[id]);
  overlay(COJIN_OPCIONES, remote.cojin?.base, remote.cojin?.premium, (id) => COJIN_KEY[id]);
  overlay(PANTALLA_OPCIONES, remote.pantalla?.base, remote.pantalla?.premium, (id) => PANTALLA_KEY[id]);

  // Recargo de vivo por SKU (puf y mesa lo llevan en cada opción).
  if (isNum(remote.puf?.vivo)) for (const o of PUF_OPCIONES) o.vivo = remote.puf!.vivo!;
  if (isNum(remote.mesa?.vivo)) for (const o of MESA_OPCIONES) if (o.activo) o.vivo = remote.mesa!.vivo!;
}

// Descarga y aplica. Nunca lanza: devuelve true si aplicó, false si usó el
// espejo local. Timeout corto para no bloquear el arranque del CRM.
export async function loadRemoteCatalog(): Promise<boolean> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 4000);
    const res = await fetch(WEB_CATALOG_URL, { signal: ctrl.signal, cache: "no-cache" });
    clearTimeout(t);
    if (!res.ok) return false;
    const data = (await res.json()) as RemoteCatalog;
    if (!data || typeof data !== "object") return false;
    applyRemoteCatalog(data);
    return true;
  } catch {
    // Sin red / web caída / JSON inválido → se conservan los precios locales.
    return false;
  }
}
