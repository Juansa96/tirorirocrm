// ══════════════════════════════════════════════════════════════════════════
// src/lib/product-schema.ts
//
// Shim delgado sobre src/lib/catalogo.ts. Todo lo que era duplicado se
// importa desde ahí. Este archivo solo mantiene:
//   - `buildProducto()`: construye una fila de productos_lead desde el
//     payload del formulario web (o del CRM manual, si algún día lo llama).
//   - Re-exports de CABECERO_FORMAS y PANTALLA_FORMAS que consume
//     FormaBadge.tsx.
// ══════════════════════════════════════════════════════════════════════════

import {
  TIPOS_VALIDOS,
  normalizeTipo,
  CABECERO_FORMAS,
  PANTALLA_FORMAS,
  BANCO_VARIANTES,
  BANCO_OYAMBRE_PRECIOS,
  BANCO_OPCIONES,
  BANCO_MEDIDAS_FISICAS,
  normalizarColeccionTela,
  esColeccionTelaInvalida,
  type TipoProductoKey,
} from "./catalogo";

// Re-exports para que FormaBadge y cualquier consumidor legacy siga funcionando
export {
  TIPOS_VALIDOS,
  normalizeTipo,
  CABECERO_FORMAS,
  PANTALLA_FORMAS,
  BANCO_VARIANTES,
  BANCO_OYAMBRE_PRECIOS,
};
export type { TipoProductoKey };

function sanitize(val: unknown, maxLen = 200): string {
  if (val === null || val === undefined) return "";
  return String(val).trim().slice(0, maxLen);
}

function num(val: unknown, max: number): number | null {
  if (val === null || val === undefined || val === "") return null;
  const n = Number(val);
  if (!Number.isFinite(n)) return null;
  return Math.min(n, max);
}

// Construye una fila insertable en productos_lead a partir de un payload
// del formulario web. Devuelve `null` si el `tipo` no se puede normalizar;
// en ese caso el endpoint público deja constancia con una nota (no descarta
// en silencio — ver 2.3).
export function buildProducto(
  config: Record<string, unknown>,
  createdBy = "formulario-web"
): {
  tipo: TipoProductoKey;
  modelo: string;
  ancho: number | null;
  alto: number | null;
  fondo: number | null;
  tela: string;
  color: string;
  relleno: string;
  patas: string;
  acabado: string | null;
  coleccion_tela: string | null;
  cantidad: number;
  precio_unitario: number;
  notas_producto: string;
  created_by: string;
} | null {
  const tipo = normalizeTipo(config.tipo);
  if (!tipo || !(TIPOS_VALIDOS as readonly string[]).includes(tipo)) return null;

  // Campos top-level del payload (contrato de la sección 7.2). Si vienen,
  // tienen prioridad sobre los campos legacy calculados a partir de `config.*`.
  const topModelo = sanitize(config.modelo, 200);
  const topAncho = num(config.ancho, 500);
  const topAlto = num(config.alto, 500);
  const topFondo = num(config.fondo, 500);
  const topTela = sanitize(config.tela ?? (config as Record<string, unknown>).fabricName, 200);
  const topColor = sanitize(config.color, 200);
  const topRelleno = sanitize(config.relleno, 200);
  const topPatas = sanitize(config.patas, 200);
  const topAcabado = sanitize(config.acabado ?? (config as Record<string, unknown>).finish, 30);
  const coleccionRaw =
    config.coleccion_tela ?? (config as Record<string, unknown>).coleccionTela ??
    ((config as Record<string, unknown>).fabricGroup === "Premium" ? "Premium" : undefined);
  // Coleccion: si viene un valor NO reconocido, se guarda null. Si viene vacío
  // o ausente, cae en el default "basic" (base del producto). El aviso lo
  // dispara el endpoint público con esColeccionTelaInvalida.
  const topColeccion: string | null = esColeccionTelaInvalida(coleccionRaw)
    ? null
    : normalizarColeccionTela(coleccionRaw);

  let modelo = "";
  let ancho: number | null = null;
  let alto: number | null = null;
  let fondo: number | null = null;
  let color = "";
  let relleno = "";
  let patas = "";

  if (tipo === "cabecero") {
    modelo = CABECERO_FORMAS[sanitize(config.forma, 50)] ?? sanitize(config.forma, 50);
    ancho = num(config.anchoCama, 400) ?? num(config.ancho, 400);
    alto = num(config.altoCm, 300) ?? num(config.alto, 300);
    color = sanitize(config.telaLateral);
    patas = config.colgador === "true" || config.colgador === true ? "Con colgador" : "";
  } else if (tipo === "banco") {
    // Variante del banco tal cual llega en el payload. Si NO se reconoce en
    // el catálogo, NO se inventa "Oyambre" — se deja lo que venga como modelo
    // (o vacío) y el endpoint dispara nota vía esVarianteBancoInvalida.
    const varianteRaw = String(config.varianteBanco ?? config.bancoMedida ?? "");
    const opt = BANCO_OPCIONES.find((o) => o.id === varianteRaw);
    modelo = opt ? `Oyambre ${opt.label}` : sanitize(varianteRaw, 200);
    ancho = varianteRaw === "custom"
      ? num(config.largoBanco, 400)
      : (opt?.ancho ?? null);
    // Defaults físicos del banco: solo si el payload NO manda fondo/alto,
    // y solo para variantes estándar (no "custom"). Vienen de la fuente única.
    const fis = BANCO_MEDIDAS_FISICAS[varianteRaw];
    if (fis) {
      if (topFondo === null) fondo = fis.fondo;
      if (topAlto === null) alto = fis.alto;
    }
    // patas queda vacío por defecto — solo se llena con lo que venga en el
    // payload (topPatas más abajo). Se elimina el string "Fondo N cm · Alto N cm".
  } else if (tipo === "cojin") {
    const opcionAlmohadon = sanitize(config.opcionAlmohadon, 100);
    modelo = opcionAlmohadon.replace(/-/g, " — ");
    const dims = opcionAlmohadon.split("-")[1]?.replace(" cm", "").split("×");
    ancho = dims?.[0] ? Number(dims[0]) : null;
    alto = dims?.[1] ? Number(dims[1]) : null;
  } else if (tipo === "puf") {
    const t = sanitize(config.tamanoPuf, 20);
    modelo = t ? `${t} cm` : "";
    ancho = num(config.tamanoPuf, 200);
  } else if (tipo === "mesa") {
    modelo = sanitize(config.presetMesa, 50);
    const dims = (sanitize(config.presetMesa, 50)).replace(" cm", "").split("×");
    ancho = dims[0] ? Number(dims[0]) : null;
    alto = dims[1] ? Number(dims[1]) : null;
    // "nada" = valor legítimo (sin superficie). Ver MESA_SUPERFICIES.
    color = sanitize(config.superficieMesa) || "nada";
  } else if (tipo === "pantalla") {
    const forma = sanitize(config.formaPantalla, 30);
    modelo = `${PANTALLA_FORMAS[forma] ?? forma} ${sanitize(config.tamanoPantalla, 20)}`.trim();
    relleno = forma;
    patas = sanitize(config.tamanoPantalla, 20);
  } else if (tipo === "otro") {
    modelo = sanitize(
      config.modelo ??
      (config as Record<string, unknown>).resumen ??
      (config as Record<string, unknown>).descripcion ??
      (config as Record<string, unknown>).otroDescripcion,
      200
    );
  }

  // Priorizar campos top-level cuando estén presentes (nuevo contrato).
  if (topModelo) modelo = topModelo;
  if (topAncho !== null) ancho = topAncho;
  if (topAlto !== null) alto = topAlto;
  if (topFondo !== null) fondo = topFondo;
  if (topColor) color = topColor;
  if (topRelleno) relleno = topRelleno;
  if (topPatas) patas = topPatas;

  const cantidad = Math.max(1, Math.floor(Number(config.cantidad) || 1));
  const precio = Math.max(0, Number(config.precio_unitario ?? config.precio) || 0);

  return {
    tipo,
    modelo: modelo || (tipo === "otro" ? "Sin descripcion" : ""),
    ancho: Number.isFinite(ancho) ? ancho : null,
    alto: Number.isFinite(alto) ? alto : null,
    fondo: Number.isFinite(fondo) ? fondo : null,
    tela: topTela,
    color,
    relleno,
    patas,
    // Default "vivo-simple" SOLO para tipos que realmente llevan vivo.
    // cojin/pantalla/otro: NULL si no viene, nunca inventar acabado.
    acabado: topAcabado
      ? topAcabado
      : (tipo === "cabecero" || tipo === "banco" || tipo === "puf" || tipo === "mesa" ? "vivo-simple" : null),
    coleccion_tela: topColeccion,
    cantidad,
    precio_unitario: precio,
    notas_producto: sanitize(config.notas_producto, 500),
    created_by: createdBy,
  };
}
