import { useState, useMemo } from "react";
import { Check } from "lucide-react";
import type { Producto } from "@/lib/types";
import { CATALOG_TO_INTERNAL } from "@/lib/types";
import { useStore } from "@/lib/store";
import { FormaBadge } from "@/components/FormaBadge";
import {
  normalizarColeccionTela,
  displayColeccionTela,
  mismoModelo,
  MODELO_TBD,
  esModeloTBD,
  BANCO_OPCIONES,
  BANCO_MEDIDAS_FISICAS,
  BANCO_ALTO_FIJO,
  BANCO_FONDO_FIJO,
  findBancoById,
  CABECERO_ANCHOS as CABECERO_ANCHOS_CAT,
  CABECERO_ALTOS as CABECERO_ALTOS_CAT,
  CABECERO_GROSOR_CM,
  CABECERO_VIVO_DOBLE_RECARGO,
  PUF_OPCIONES,
  findPufById,
  MESA_OPCIONES,
  MESA_ALTO_FIJO,
  findMesaById,
  COJIN_OPCIONES,
  findCojinById,
  PANTALLA_OPCIONES as PANTALLA_OPCIONES_CAT,
  findPantallaById,
} from "@/lib/catalogo";

// ── Constantes ────────────────────────────────────────────────────
export const TIPOS_PRODUCTO = [
  { id: "cabecero",  label: "Cabecero" },
  { id: "banco",     label: "Banco" },
  { id: "puf",       label: "Puf" },
  { id: "mesa",      label: "Mesa de centro" },
  { id: "pantalla",  label: "Pantalla de lámpara" },
  { id: "almohadon", label: "Almohadón" },
  { id: "otro",      label: "Otro" },
] as const;

export const CABECERO_FORMAS = [
  { id: "recto",         name: "Calobra" },
  { id: "semicirculo",   name: "Pregonda" },
  { id: "corona-simple", name: "Macarella" },
  { id: "corona-doble",  name: "Conta" },
  { id: "ondas",         name: "Barbaria" },
];
// Alturas seleccionables (alias local, exportado para el resto del código).
export const CABECERO_ALTOS = CABECERO_ALTOS_CAT as readonly string[];

export const MESA_SUPERFICIES = [
  { id: "nada",        name: "Sin superficie" },
  { id: "metacrilato", name: "Metacrilato 5 mm (+50€)" },
  { id: "cristal",     name: "Cristal 6 mm (+100€)" },
];

export const PANTALLA_FORMAS = [
  { id: "cilindro",   name: "Almanzor — Cilíndrico" },
  { id: "cuadrado",   name: "Tormes — Cuadrado" },
  { id: "rectangulo", name: "La Serrota — Rectangular" },
];

export const FINISHES_CABECERO = [
  { id: "vivo-simple", name: "Vivo simple (incluido)" },
  { id: "vivo-doble",  name: `Vivo doble (+${CABECERO_VIVO_DOBLE_RECARGO}€)` },
];
export const FINISHES_PUF = [
  { id: "liso",        name: "Sin acabado" },
  { id: "vivo-simple", name: "Vivo simple (+15€)" },
];

export const TELAS_SUGERIDAS = [
  "Arequipa Beige","Ikat Natural","Ikat Verde Agua","Ikat Arena","Ikat Bali Azul",
  "Mil Rayas Gris","Rayas Arena","Mil Rayas Azul Marino","Flor Azul Protea","Floralia Vintage",
  "Morris Granadas Terracota","Pájaros Louise Azul","Pájaros Louise Rosa","Pájaros Louise Verde",
  "Toile de Jouy Azul","Espiga Agua","Pata de Gallo Verde","Coral Costero","Lino Greca",
  "Baqueira","Baqueira Roja","Cérler","Lola Gris","Rocío","Artesano Beige","Oxford",
  "Lino Verde Botella","Lino Verde","Güell Lamadrid","Vichy Denim","Vichy Verde",
  "Ramas Siena Azul","Flores Gardenia","Bibiana","Prints Botánicos","Rayas Verde Sage",
  "Raya Monina","Rayas Jules Verde","Lino Azul Provenzal","Lino Flores Normandía","Lino Flores Senda",
];


// ── Tipos ─────────────────────────────────────────────────────────
export type ProdTipo = "cabecero" | "banco" | "puf" | "mesa" | "pantalla" | "almohadon" | "otro" | "";
export const FORMA_POR_DECIDIR = "tbd";
export const FORMA_OTRA = "custom";

export interface ProdState {
  tipo: ProdTipo;
  forma: string; formaOtra: string;
  anchoCama: string; anchoCamaCustom: string;
  altoCabecero: string; altoCabeceroCustom: string;
  telaLateral: string; colgador: boolean;
  // Puf: pufId ∈ PUF_OPCIONES.id | "custom" | "tbd" | ""
  pufId: string; pufAnchoCustom: string; pufFondoCustom: string; pufAltoCustom: string; cantidadPuf: string;
  // Mesa: mesaId ∈ MESA_OPCIONES.id | "custom" | "tbd" | ""
  mesaId: string; mesaLargo: string; mesaAlto: string; mesaFondo: string; superficieMesa: string;
  // Pantalla: pantallaId ∈ PANTALLA_OPCIONES.id | "custom" | "tbd" | "";
  //          formaPantalla queda para agrupar visualmente el custom/tbd.
  pantallaId: string; formaPantalla: string; pantallaAnchoCustom: string; pantallaAltoCustom: string;
  tela: string; coleccionTela: string; acabado: string; telaVivo: string;
  tapetes: boolean;
  // Almohadón: almohadonId ∈ COJIN_OPCIONES.id | "custom" | "tbd" | ""
  almohadonId: string; almohadonMedidas: string; almohadonTela: string; almohadonRibete: string; almohadonSinRibete: boolean;
  // Otro: descripción libre o "Por decidir"
  otroDescripcion: string; otroPorDecidir: boolean;
  bancoMedida: string; bancoLargoCustom: string;
  cantidad: number; precioUnitario: number; notasProducto: string;
  // Snapshot de campos mutables al abrir en modo edición. Se usa para NO
  // sobreescribir valores históricos con defaults del catálogo (grosor 8 del
  // cabecero, alto/fondo del banco). Undefined ≡ creando; null ≡ editando y
  // el valor original era NULL; number ≡ editando con valor guardado.
  _origFondo?: number | null;
  _origAlto?: number | null;
  _isEdit?: boolean;
}

export const EMPTY_PROD_STATE: ProdState = {
  tipo: "",
  forma: "", formaOtra: "", anchoCama: "150", anchoCamaCustom: "", altoCabecero: "100", altoCabeceroCustom: "", telaLateral: "", colgador: false,
  pufId: "", pufAnchoCustom: "", pufFondoCustom: "", pufAltoCustom: "", cantidadPuf: "1",
  mesaId: "", mesaLargo: "", mesaAlto: "", mesaFondo: "", superficieMesa: "nada",
  pantallaId: "", formaPantalla: "cilindro", pantallaAnchoCustom: "", pantallaAltoCustom: "",
  tela: "", coleccionTela: "basic", acabado: "", telaVivo: "",
  tapetes: false,
  almohadonId: "", almohadonMedidas: "", almohadonTela: "", almohadonRibete: "", almohadonSinRibete: false,
  otroDescripcion: "", otroPorDecidir: false,
  bancoMedida: "90", bancoLargoCustom: "",
  cantidad: 1, precioUnitario: 0, notasProducto: "",
};

// Preselección de "vivo-simple" al elegir tipo desde el CRM. Es una
// comodidad visible y modificable, NO un default silencioso del endpoint.
// Solo aplica a tipos que llevan vivo: cabecero, banco, puf, mesa.
const TIPOS_CON_VIVO = new Set<ProdTipo>(["cabecero", "banco", "puf", "mesa"]);
function acabadoDefault(tipo: ProdTipo): string {
  return TIPOS_CON_VIVO.has(tipo) ? "vivo-simple" : "";
}


// ── Conversiones ──────────────────────────────────────────────────
// Reglas comunes:
//  - Ningún campo se completa por defecto silenciosamente. Los defaults
//    marcados en decisiones anteriores (acabado, patas, modelo…) NO se
//    inventan: si el usuario no lo eligió, se guarda vacío/null.
//  - `precioUnitario` viene del state y NO se recalcula aquí; el reconciliador
//    de V8 vive en el selector, con banner explícito.
export function prodStateToProducto(f: ProdState): Omit<Producto, "id" | "leadId" | "createdAt" | "createdBy" | "caracteristicasConfirmadas" | "fechaConfirmacion" | "pagado50"> {
  let modelo = "", ancho: number | null = null, alto: number | null = null, fondo: number | null = null;
  let color = "", relleno = "", patas = "";
  const extras = (items: (string | false)[]) => items.filter(Boolean).join(" · ");

  if (f.tipo === "cabecero") {
    modelo = f.forma === FORMA_POR_DECIDIR || !f.forma
      ? "Forma por decidir"
      : f.forma === FORMA_OTRA
        ? (f.formaOtra.trim() || "Forma personalizada")
        : (CABECERO_FORMAS.find(x => x.id === f.forma)?.name ?? f.forma);
    ancho = f.anchoCama === "tbd" ? null : f.anchoCama === "custom" ? (Number(f.anchoCamaCustom) || null) : (Number(f.anchoCama) || null);
    alto  = f.altoCabecero === "tbd" ? null : f.altoCabecero === "custom" ? (Number(f.altoCabeceroCustom) || null) : (Number(f.altoCabecero) || null);
    fondo = f._isEdit
      ? (f._origFondo === null ? null : f._origFondo ?? null)
      : CABECERO_GROSOR_CM;
    color = f.telaLateral; relleno = f.telaVivo;
    const tbdForma = f.forma === FORMA_POR_DECIDIR || !f.forma;
    const tbdAncho = f.anchoCama === "tbd";
    const tbdAlto = f.altoCabecero === "tbd";
    patas = extras([
      f.colgador && "Con colgador (+5€)",
      f.tapetes && "Tapetes protectores (+5€)",
      tbdForma && "Forma por decidir",
      (tbdAncho || tbdAlto) && `Medidas por decidir${tbdAncho && tbdAlto ? "" : tbdAncho ? " (ancho)" : " (alto)"}`,
    ]);
  } else if (f.tipo === "puf") {
    const opt = findPufById(f.pufId);
    if (f.pufId === "tbd" || !f.pufId) {
      modelo = "Puf (medida por decidir)";
      ancho = null; alto = null; fondo = null;
    } else if (f.pufId === "custom") {
      modelo = "Puf (medida personalizada)";
      ancho = Number(f.pufAnchoCustom) || null;
      fondo = Number(f.pufFondoCustom) || null;
      alto  = Number(f.pufAltoCustom)  || null;
    } else if (opt) {
      modelo = opt.label;
      ancho = opt.ancho; fondo = opt.fondo; alto = opt.alto;
    }
    color  = f.telaLateral; relleno = f.telaVivo;
    patas  = extras([f.tapetes && "Tapetes protectores (+5€)", f.pufId === "tbd" && "Tamaño por decidir"]);
  } else if (f.tipo === "mesa") {
    const opt = findMesaById(f.mesaId);
    if (f.mesaId === "tbd" || !f.mesaId) {
      modelo = "Mesa (medida por decidir)";
      ancho = null; alto = null; fondo = null;
    } else if (f.mesaId === "custom") {
      modelo = "Mesa (medida personalizada)";
      ancho = Number(f.mesaLargo) || null;
      alto  = Number(f.mesaAlto)  || null;
      fondo = Number(f.mesaFondo) || null;
    } else if (opt) {
      modelo = opt.label;
      ancho = opt.ancho; alto = opt.alto; fondo = opt.fondo;
    }
    // La superficie se sigue guardando en `color` (contrato preexistente).
    color = MESA_SUPERFICIES.find(x => x.id === f.superficieMesa)?.name ?? "";
    patas = extras([f.tapetes && "Tapetes protectores (+5€)"]);
  } else if (f.tipo === "pantalla") {
    const opt = findPantallaById(f.pantallaId);
    if (f.pantallaId === "tbd" || !f.pantallaId) {
      modelo = "Pantalla (medida por decidir)";
      ancho = null; alto = null;
    } else if (f.pantallaId === "custom") {
      modelo = "Pantalla (medida personalizada)";
      ancho = Number(f.pantallaAnchoCustom) || null;
      alto  = Number(f.pantallaAltoCustom)  || null;
    } else if (opt) {
      modelo = opt.label;
      ancho = opt.ancho; alto = opt.alto;
    }
    // `relleno` guarda la forma (contrato preexistente).
    relleno = opt?.formaId ?? f.formaPantalla;
    patas = extras([f.tapetes && "Tapetes protectores (+5€)", f.pantallaId === "tbd" && "Medida por decidir"]);
  } else if (f.tipo === "banco") {
    const isTbd = f.bancoMedida === "tbd";
    const opt = isTbd ? undefined : findBancoById(f.bancoMedida);
    const fis = BANCO_MEDIDAS_FISICAS[f.bancoMedida];
    const anchoCustom = f.bancoMedida === "custom" ? (Number(f.bancoLargoCustom) || null) : null;
    modelo = isTbd ? "Oyambre — Por decidir" : `Oyambre — ${opt?.label ?? f.bancoMedida}`;
    ancho = isTbd ? null : f.bancoMedida === "custom" ? anchoCustom : (opt?.ancho ?? null);
    // Preserva alto/fondo históricos al editar: si el original era NULL,
    // no escribimos el default del catálogo. En "tbd" no se conocen medidas.
    if (isTbd) {
      alto = f._isEdit ? (f._origAlto ?? null) : null;
      fondo = f._isEdit ? (f._origFondo ?? null) : null;
    } else if (f._isEdit) {
      alto  = f._origAlto  === undefined ? (fis?.alto  ?? (f.bancoMedida === "custom" ? null : BANCO_ALTO_FIJO))  : f._origAlto;
      fondo = f._origFondo === undefined ? (fis?.fondo ?? (f.bancoMedida === "custom" ? null : BANCO_FONDO_FIJO)) : f._origFondo;
    } else {
      alto  = fis?.alto  ?? (f.bancoMedida === "custom" ? null : BANCO_ALTO_FIJO);
      fondo = fis?.fondo ?? (f.bancoMedida === "custom" ? null : BANCO_FONDO_FIJO);
    }
    // `patas` NO recibe medidas físicas: alto/fondo van en sus columnas.
    // Solo lleva lo que el operador introduce sobre las patas o el estado
    // "medidas personalizadas / por decidir" cuando aplica.
    patas = extras([
      f.bancoMedida === "custom" && "A consultar (medidas personalizadas)",
      isTbd && "Medida por decidir",
      f.tapetes && "Tapetes protectores (+5€)",
    ]);
    color = f.telaLateral; relleno = f.telaVivo;
  } else if (f.tipo === "almohadon") {
    const opt = findCojinById(f.almohadonId);
    if (f.almohadonId === "tbd" || (!f.almohadonId && !f.almohadonMedidas)) {
      modelo = "Almohadón (medida por decidir)";
      ancho = null; alto = null;
    } else if (f.almohadonId === "custom" || (!f.almohadonId && f.almohadonMedidas)) {
      modelo = f.almohadonMedidas || "Almohadón (medida personalizada)";
      ancho = null; alto = null;
    } else if (opt) {
      modelo = opt.label;
      ancho = opt.ancho; alto = opt.alto;
    }
    color = f.almohadonTela;
    patas = f.almohadonSinRibete ? "Sin ribete" : (f.almohadonRibete ? `Ribete: ${f.almohadonRibete}` : "");
  } else if (f.tipo === "otro") {
    modelo = f.otroPorDecidir ? MODELO_TBD : f.otroDescripcion;
  }

  return {
    tipo: f.tipo, modelo, ancho, alto, fondo,
    tela: f.tipo === "almohadon" ? f.almohadonTela : f.tela,
    color, relleno, patas,
    acabado: f.acabado, coleccionTela: normalizarColeccionTela(f.coleccionTela),
    cantidad: f.tipo === "puf" ? Number(f.cantidadPuf) : f.cantidad,
    precioUnitario: f.precioUnitario, notasProducto: f.notasProducto,
  };
}

// Recupera el id de opción de un catálogo dado un ancho/alto/fondo. Devuelve
// "" si no encuentra match exacto (el llamante decide fallback a "custom").
function findCatalogIdByDims<T extends { id: string; ancho: number; alto: number; fondo?: number }>(
  list: T[], ancho: number | null, alto: number | null, fondo?: number | null
): string {
  if (ancho === null || alto === null) return "";
  const match = list.find(o =>
    o.ancho === ancho && o.alto === alto &&
    (fondo == null || o.fondo === undefined || o.fondo === fondo)
  );
  return match?.id ?? "";
}

export function productoToState(p: Omit<Producto, "id" | "leadId" | "createdAt" | "createdBy" | "caracteristicasConfirmadas" | "fechaConfirmacion" | "pagado50">): ProdState {
  const s = { ...EMPTY_PROD_STATE };
  s.tipo = p.tipo as ProdTipo;
  s.tela = p.tela; s.coleccionTela = normalizarColeccionTela(p.coleccionTela);
  s.acabado = p.acabado || "";
  s.precioUnitario = p.precioUnitario; s.notasProducto = p.notasProducto;
  s.tapetes = p.patas?.includes("Tapetes") ?? false;
  // Marca edición y captura dims originales (para NO sobreescribir NULLs
  // históricos con defaults del catálogo al guardar).
  s._isEdit = true;
  s._origFondo = p.fondo ?? null;
  s._origAlto  = p.alto  ?? null;

  if (p.tipo === "cabecero") {
    const formaMatch = CABECERO_FORMAS.find(x => mismoModelo(x.name, p.modelo));
    if (formaMatch) { s.forma = formaMatch.id; }
    else if (mismoModelo(p.modelo, "Forma por decidir")) { s.forma = FORMA_POR_DECIDIR; }
    else if (p.modelo) { s.forma = FORMA_OTRA; s.formaOtra = p.modelo; }
    else { s.forma = ""; }
    const a = p.ancho ? String(p.ancho) : "";
    const anchosStd = CABECERO_ANCHOS_CAT.map(x => x.id);
    s.anchoCama = anchosStd.includes(a) ? a : (a ? "custom" : "150");
    s.anchoCamaCustom = anchosStd.includes(a) ? "" : a;
    const h = p.alto ? String(p.alto) : "";
    s.altoCabecero = CABECERO_ALTOS.includes(h) ? h : (h ? "custom" : "100");
    s.altoCabeceroCustom = CABECERO_ALTOS.includes(h) ? "" : h;
    s.telaLateral = p.color; s.telaVivo = p.relleno ?? "";
    s.colgador = p.patas?.includes("Con colgador") ?? false;
    s.cantidad = p.cantidad;
  } else if (p.tipo === "puf") {
    const id = findCatalogIdByDims(PUF_OPCIONES, p.ancho, p.alto, p.fondo);
    s.pufId = id || (p.ancho ? "custom" : "");
    s.pufAnchoCustom = !id && p.ancho ? String(p.ancho) : "";
    s.pufFondoCustom = !id && p.fondo ? String(p.fondo) : "";
    s.pufAltoCustom  = !id && p.alto  ? String(p.alto)  : "";
    s.cantidadPuf = String(p.cantidad);
    s.telaLateral = p.color; s.telaVivo = p.relleno ?? "";
  } else if (p.tipo === "mesa") {
    const id = findCatalogIdByDims(MESA_OPCIONES, p.ancho, p.alto, p.fondo);
    s.mesaId = id || (p.ancho ? "custom" : "");
    s.mesaLargo = !id && p.ancho ? String(p.ancho) : "";
    s.mesaAlto  = !id && p.alto  ? String(p.alto)  : "";
    s.mesaFondo = !id && p.fondo ? String(p.fondo) : (p.relleno ?? "");
    s.superficieMesa = MESA_SUPERFICIES.find(x => x.name === p.color)?.id ?? "nada";
    s.cantidad = p.cantidad;
  } else if (p.tipo === "pantalla") {
    const id = findCatalogIdByDims(PANTALLA_OPCIONES_CAT, p.ancho, p.alto);
    s.pantallaId = id || (p.ancho ? "custom" : "");
    s.formaPantalla = (p.relleno && ["cilindro","cuadrado","rectangulo"].includes(p.relleno)) ? p.relleno : "cilindro";
    s.pantallaAnchoCustom = !id && p.ancho ? String(p.ancho) : "";
    s.pantallaAltoCustom  = !id && p.alto  ? String(p.alto)  : "";
    s.cantidad = p.cantidad;
  } else if (p.tipo === "almohadon") {
    const id = findCatalogIdByDims(COJIN_OPCIONES, p.ancho, p.alto);
    s.almohadonId = id || (p.ancho || p.modelo ? "custom" : "");
    s.almohadonMedidas = !id ? (p.modelo && !mismoModelo(p.modelo, "Almohadón") ? p.modelo : "") : "";
    s.almohadonTela = p.color || p.tela || "";
    if (p.patas === "Sin ribete") { s.almohadonSinRibete = true; s.almohadonRibete = ""; }
    else if (p.patas?.startsWith("Ribete: ")) { s.almohadonSinRibete = false; s.almohadonRibete = p.patas.slice(8); }
    s.cantidad = p.cantidad;
  } else if (p.tipo === "otro") {
    s.otroPorDecidir = esModeloTBD(p.modelo);
    s.otroDescripcion = s.otroPorDecidir ? "" : p.modelo;
    s.cantidad = p.cantidad;
  } else if (p.tipo === "banco") {
    const a = p.ancho ? String(p.ancho) : "";
    const stdAnchos = BANCO_OPCIONES
      .filter(o => o.id !== "custom" && o.id !== "60-doble" && o.ancho !== null)
      .map(o => String(o.ancho));
    const isDoble = /doble/i.test(p.modelo);
    const isTbd = mismoModelo(p.modelo, "Oyambre — Por decidir") || /por decidir/i.test(p.modelo);
    s.bancoMedida = isTbd ? "tbd" : (isDoble ? "60-doble" : (stdAnchos.includes(a) ? a : (a ? "custom" : "90")));
    s.bancoLargoCustom = s.bancoMedida === "custom" ? a : "";
    s.telaLateral = p.color; s.telaVivo = p.relleno ?? "";
    s.cantidad = p.cantidad;
  }

  return s;
}

// ── TelaSelect ────────────────────────────────────────────────────
const TELA_INP = "w-full rounded border border-slate-200 px-2 py-1.5 text-sm focus:border-slate-400 focus:outline-none bg-white";
const TELA_BTN = (active: boolean) =>
  `rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${active ? "border-[#1a1f36] bg-[#1a1f36] text-white" : "border-slate-200 text-slate-600 hover:border-slate-400"}`;

export const TELA_POR_DECIDIR = "Por decidir";

export function TelaSelect({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  const [modo, setModo] = useState<"web" | "otro" | "tbd">(() => {
    if (value === TELA_POR_DECIDIR) return "tbd";
    if (value !== "" && !TELAS_SUGERIDAS.includes(value)) return "otro";
    return "web";
  });
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <button type="button" className={TELA_BTN(modo === "web")} onClick={() => { setModo("web"); onChange(""); }}>Tela de la web</button>
        <button type="button" className={TELA_BTN(modo === "otro")} onClick={() => { setModo("otro"); onChange(""); }}>Otra tela</button>
        <button type="button" className={TELA_BTN(modo === "tbd")} onClick={() => { setModo("tbd"); onChange(TELA_POR_DECIDIR); }}>Por decidir</button>
      </div>
      {modo === "web" && (
        <select className={TELA_INP} value={value} onChange={e => onChange(e.target.value)}>
          <option value="">— Selecciona tela —</option>
          {TELAS_SUGERIDAS.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      )}
      {modo === "otro" && (
        <input type="text" className={TELA_INP} value={value} onChange={e => onChange(e.target.value)}
          placeholder={placeholder ?? "Escribe el nombre de la tela…"} autoFocus />
      )}
      {modo === "tbd" && (
        <div className="rounded-lg border border-dashed border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-700">
          Tela pendiente de decidir — se puede editar más adelante
        </div>
      )}
    </div>
  );
}

// ── TelaSection ────────────────────────────────────────────────────
const SECTION_CLS = "text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2";
const BTN_CLS = (active: boolean) =>
  `rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${active ? "border-[#1a1f36] bg-[#1a1f36] text-white" : "border-slate-200 text-slate-600 hover:border-slate-400"}`;

function TelaSection({ tela, onTela, coleccionTela, onColeccion, telaLateral, onTelaLateral, showLateral }: {
  tela: string; onTela: (v: string) => void;
  coleccionTela: string; onColeccion: (v: string) => void;
  telaLateral: string; onTelaLateral: (v: string) => void;
  showLateral: boolean;
}) {
  return (
    <div className="space-y-3">
      <div>
        <div className={SECTION_CLS}>Tela principal</div>
        <TelaSelect value={tela} onChange={onTela} />
      </div>
      <div>
        <div className={SECTION_CLS}>Colección</div>
        <div className="flex gap-2">
          {(["basic","premium"] as const).map(c => <button key={c} type="button" onClick={() => onColeccion(c)} className={BTN_CLS(normalizarColeccionTela(coleccionTela) === c)}>{displayColeccionTela(c)}</button>)}
        </div>
      </div>
      {showLateral && (
        <div>
          <div className={SECTION_CLS}>Tela lateral <span className="normal-case font-normal text-slate-400">(opcional, +15€ — vacío = igual que la principal)</span></div>
          <TelaSelect value={telaLateral} onChange={onTelaLateral} placeholder="Dejar vacío si es la misma tela" />
        </div>
      )}
    </div>
  );
}

// ── PriceReconciler ───────────────────────────────────────────────
// V8 unificado. Al EDITAR (isEditing=true) el `precioUnitario` guardado nunca
// se reasigna solo al cambiar variante. Si el catálogo difiere, se muestra
// aviso ámbar con botón explícito "Actualizar a X€".
function PriceReconciler({ isEditing, saved, catalog, onUpdate }: {
  isEditing: boolean; saved: number; catalog: number; onUpdate: (v: number) => void;
}) {
  if (!isEditing || catalog <= 0 || saved === catalog) return null;
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
      <span>
        Precio guardado <strong>{saved}€</strong> · Precio actual del catálogo <strong>{catalog}€</strong>.
      </span>
      <button
        type="button"
        onClick={() => onUpdate(catalog)}
        className="rounded-md border border-amber-400 bg-white px-2 py-1 text-xs font-medium text-amber-800 hover:bg-amber-100"
      >
        Actualizar a {catalog}€
      </button>
    </div>
  );
}

// Al pulsar una variante: crear pre-rellena precioUnitario; editar solo cambia
// el campo indicado. Helper para evitar duplicar la condición en cada botón.
function patchPrecio<T extends Record<string, unknown>>(isEditing: boolean, patch: T, precio: number): T & { precioUnitario?: number } {
  return isEditing ? patch : { ...patch, precioUnitario: precio };
}

// ── CatalogoSelector ──────────────────────────────────────────────
function CatalogoSelector({ f, s }: { f: ProdState; s: (patch: Partial<ProdState>) => void }) {
  const { catalogo } = useStore();
  const internalToLabel: Record<string, string> = {
    cabecero: "Cabecero", puf: "Puf", mesa: "Mesa de centro",
    pantalla: "Pantalla de lámpara", almohadon: "Almohadón", otro: "Cubrecanapé",
    banco: "Banco",
  };

  const tipos = useMemo(() => {
    const fromCat = Array.from(new Set(catalogo.map(c => c.tipo)));
    return fromCat.length > 0
      ? fromCat
      : ["Cabecero", "Banco", "Puf", "Mesa de centro", "Pantalla de lámpara", "Almohadón", "Cubrecanapé"];
  }, [catalogo]);

  const tipoLabel = f.tipo ? internalToLabel[f.tipo] ?? "" : "";
  const modelosTipo = useMemo(
    () => catalogo.filter(c => c.tipo === tipoLabel).sort((a, b) => a.orden - b.orden),
    [catalogo, tipoLabel]
  );

  const selectedModelo = useMemo(() => {
    if (!modelosTipo.length) return "";
    if (f.tipo === "cabecero") {
      const m = CABECERO_FORMAS.find(x => x.id === f.forma)?.name ?? "";
      return modelosTipo.find(x => mismoModelo(x.modelo, m))?.id ?? "";
    }
    if (f.tipo === "pantalla") {
      const m = PANTALLA_FORMAS.find(x => x.id === f.formaPantalla)?.name.split("—")[0].trim() ?? "";
      return modelosTipo.find(x => mismoModelo(x.modelo, m))?.id ?? "";
    }
    if (f.tipo === "puf") {
      return modelosTipo.find(x => mismoModelo(x.modelo, "Patos"))?.id ?? "";
    }
    if (f.tipo === "almohadon") return modelosTipo[0]?.id ?? "";
    if (f.tipo === "otro") return modelosTipo[0]?.id ?? "";
    if (f.tipo === "mesa") {
      return modelosTipo.find(x => mismoModelo(x.modelo, "Cabo de Palos"))?.id ?? "";
    }
    if (f.tipo === "banco") {
      return modelosTipo.find(x => mismoModelo(x.modelo, "Oyambre"))?.id ?? modelosTipo[0]?.id ?? "";
    }
    return "";
  }, [modelosTipo, f.tipo, f.forma, f.formaPantalla]);

  function setTipo(label: string) {
    const internal = (CATALOG_TO_INTERNAL[label] ?? "") as ProdTipo;
    // Preseleccionar acabado por comodidad (visible y modificable). Solo
    // aplica al CREAR (isEditing=false); en edición mantenemos lo guardado.
    const patch: Partial<ProdState> = { tipo: internal };
    if (!f._isEdit) patch.acabado = acabadoDefault(internal);
    s(patch);
  }
  function setModelo(id: string) {
    const m = modelosTipo.find(x => x.id === id);
    if (!m) return;
    if (f.tipo === "cabecero") {
      const forma = CABECERO_FORMAS.find(x => x.name === m.modelo)?.id ?? FORMA_POR_DECIDIR;
      s({ forma });
    } else if (f.tipo === "pantalla") {
      const fp = PANTALLA_FORMAS.find(x => x.name.split("—")[0].trim() === m.modelo)?.id;
      if (fp) s({ formaPantalla: fp });
    } else if (f.tipo === "otro") {
      s({ otroDescripcion: m.modelo });
    }
  }

  const sel = "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-slate-400 focus:outline-none";
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <div>
        <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Tipo de producto</div>
        <select className={sel} value={tipoLabel} onChange={(e) => setTipo(e.target.value)}>
          <option value="">— Selecciona tipo —</option>
          {tipos.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>
      <div>
        <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Modelo</div>
        <select
          className={sel}
          value={selectedModelo}
          onChange={(e) => setModelo(e.target.value)}
          disabled={!tipoLabel || modelosTipo.length === 0}
        >
          <option value="">{tipoLabel ? "— Selecciona modelo —" : "Elige tipo primero"}</option>
          {modelosTipo.map(m => (
            <option key={m.id} value={m.id}>
              {m.modelo}{m.activo ? "" : " (Próximamente)"}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

// ── ProductoForm ──────────────────────────────────────────────────
export function ProductoForm({
  initial, onSave, onCancel, isEditing = false,
}: {
  initial: ProdState;
  onSave: (p: Omit<Producto, "id" | "leadId" | "createdAt" | "createdBy" | "caracteristicasConfirmadas" | "fechaConfirmacion" | "pagado50">) => void;
  onCancel: () => void;
  isEditing?: boolean;
}) {
  const [f, setF] = useState<ProdState>(initial);
  const s = (patch: Partial<ProdState>) => setF(prev => ({ ...prev, ...patch }));
  const inp = "w-full rounded border border-slate-200 px-2 py-1.5 text-sm focus:border-slate-400 focus:outline-none bg-white";
  const btn = (active: boolean) => BTN_CLS(active);
  const section = SECTION_CLS;

  return (
    <div className="space-y-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
      <CatalogoSelector f={f} s={s} />

      {/* ── CABECERO ── */}
      {f.tipo === "cabecero" && (() => {
        const anchoOpt = CABECERO_ANCHOS_CAT.find(x => x.id === f.anchoCama);
        return (
        <>
          <div>
            <div className={section}>Forma</div>
            <div className="flex flex-wrap gap-2">
              {CABECERO_FORMAS.map(x => <button key={x.id} type="button" onClick={() => s({ forma: x.id })} className={`${btn(f.forma === x.id)} inline-flex items-center gap-1.5`}><span>{x.name}</span><FormaBadge modelo={x.name} className="border-transparent bg-transparent px-0 py-0" /></button>)}
              <button type="button" onClick={() => s({ forma: FORMA_POR_DECIDIR })} className={btn(f.forma === FORMA_POR_DECIDIR || !f.forma)}>Por decidir</button>
            </div>
            {(f.forma === FORMA_POR_DECIDIR || !f.forma) && (
              <div className="mt-2 rounded-lg border border-dashed border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                Forma pendiente de decidir — se puede editar más adelante
              </div>
            )}
          </div>
          <div>
            <div className={section}>Ancho de cabecero</div>
            <div className="flex flex-wrap gap-2">
              {CABECERO_ANCHOS_CAT.filter(x => x.activo || x.id === f.anchoCama).map(x => (
                <button
                  key={x.id}
                  type="button"
                  onClick={() => s(patchPrecio(isEditing, { anchoCama: x.id }, x.precio))}
                  className={btn(f.anchoCama === x.id)}
                >
                  {x.label} · {x.precio}€{x.legacy ? " (retirado)" : ""}
                </button>
              ))}
              <button type="button" onClick={() => s({ anchoCama: "custom" })} className={btn(f.anchoCama === "custom")}>Otra medida</button>
              <button type="button" onClick={() => s({ anchoCama: "tbd" })} className={btn(f.anchoCama === "tbd")}>Por decidir</button>
            </div>
            {f.anchoCama === "custom" && <input type="number" className="mt-2 w-32 rounded border border-slate-200 px-2 py-1.5 text-sm" value={f.anchoCamaCustom} onChange={e => s({ anchoCamaCustom: e.target.value })} placeholder="cm" min={60} max={300} />}
            <PriceReconciler isEditing={isEditing} saved={f.precioUnitario} catalog={anchoOpt?.precio ?? 0} onUpdate={v => s({ precioUnitario: v })} />
          </div>
          <div>
            <div className={section}>Alto del cabecero</div>
            <div className="flex flex-wrap gap-2">
              {CABECERO_ALTOS.map(a => (
                <button key={a} type="button" onClick={() => s({ altoCabecero: a })} className={btn(f.altoCabecero === a)}>
                  {a} cm{a === "100" ? " (estándar)" : ""}
                </button>
              ))}
              <button type="button" onClick={() => s({ altoCabecero: "custom" })} className={btn(f.altoCabecero === "custom")}>Otra medida</button>
              <button type="button" onClick={() => s({ altoCabecero: "tbd" })} className={btn(f.altoCabecero === "tbd")}>Por decidir</button>
            </div>
            {f.altoCabecero === "custom" && <input type="number" className="mt-2 w-32 rounded border border-slate-200 px-2 py-1.5 text-sm" value={f.altoCabeceroCustom} onChange={e => s({ altoCabeceroCustom: e.target.value })} placeholder="cm" min={40} max={200} />}
          </div>
          <div className="rounded-lg border border-slate-100 bg-white px-3 py-2 text-xs text-slate-600">
            Grosor <strong>{CABECERO_GROSOR_CM} cm</strong> (fijo)
          </div>
          <TelaSection tela={f.tela} onTela={v => s({ tela: v })} coleccionTela={f.coleccionTela} onColeccion={v => s({ coleccionTela: v })} telaLateral={f.telaLateral} onTelaLateral={v => s({ telaLateral: v })} showLateral />
          <div>
            <div className={section}>Acabado</div>
            <div className="flex flex-wrap gap-2">
              {FINISHES_CABECERO.map(x => <button key={x.id} type="button" onClick={() => s({ acabado: x.id })} className={btn(f.acabado === x.id)}>{x.name}</button>)}
            </div>
          </div>
          {(f.acabado === "vivo-simple" || f.acabado === "vivo-doble") && (
            <div>
              <div className={section}>Tela del vivo <span className="normal-case font-normal text-slate-400">(opcional — vacío = igual que la principal)</span></div>
              <TelaSelect value={f.telaVivo} onChange={v => s({ telaVivo: v })} placeholder="Tela para el ribete…" />
            </div>
          )}
          <div>
            <div className={section}>Extras</div>
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" checked={f.colgador} onChange={e => s({ colgador: e.target.checked })} className="h-4 w-4 accent-[#1a1f36]" /> Colgador (+5€)</label>
              <label className="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" checked={f.tapetes} onChange={e => s({ tapetes: e.target.checked })} className="h-4 w-4 accent-[#1a1f36]" /> Tapetes protectores (+5€)</label>
            </div>
          </div>
        </>
        );
      })()}

      {/* ── BANCO OYAMBRE ── */}
      {f.tipo === "banco" && (() => {
        const activas = BANCO_OPCIONES.filter(o => o.activo);
        const selectedOpt = findBancoById(f.bancoMedida);
        const showLegacy = selectedOpt && !selectedOpt.activo;
        const opciones = showLegacy ? [...activas, selectedOpt!] : activas;
        return (
        <>
          <div>
            <div className={section}>Medida (Oyambre)</div>
            <div className="flex flex-wrap gap-2">
              {opciones.map(x => (
                <button
                  key={x.id}
                  type="button"
                  onClick={() => s(patchPrecio(isEditing, { bancoMedida: x.id }, x.precio))}
                  className={btn(f.bancoMedida === x.id)}
                >
                  {x.label}
                  {x.id === "custom"
                    ? " · A consultar"
                    : x.precio > 0 ? ` · ${x.precio}€` : ""}
                  {x.legacy ? " (retirado)" : ""}
                </button>
              ))}
            </div>
            <PriceReconciler isEditing={isEditing} saved={f.precioUnitario} catalog={selectedOpt?.precio ?? 0} onUpdate={v => s({ precioUnitario: v })} />
            {f.bancoMedida === "custom" && (
              <div className="mt-2 space-y-2">
                <input
                  type="number"
                  min={40}
                  max={400}
                  className="w-32 rounded border border-slate-200 px-2 py-1.5 text-sm"
                  placeholder="Largo (cm)"
                  value={f.bancoLargoCustom}
                  onChange={e => s({ bancoLargoCustom: e.target.value })}
                />
                <div className="rounded-lg border border-dashed border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                  Precio a consultar — introdúcelo manualmente abajo cuando lo negocies.
                </div>
              </div>
            )}
            <div className="mt-2 rounded-lg border border-slate-100 bg-white px-3 py-2 text-xs text-slate-600">
              Alto <strong>{BANCO_ALTO_FIJO} cm</strong> · Fondo <strong>{BANCO_FONDO_FIJO} cm</strong> {f.bancoMedida !== "custom" && "(fijos en medidas estándar)"}
            </div>
          </div>

          <TelaSection
            tela={f.tela}
            onTela={v => s({ tela: v })}
            coleccionTela={f.coleccionTela}
            onColeccion={v => s({ coleccionTela: v })}
            telaLateral={f.telaLateral}
            onTelaLateral={v => s({ telaLateral: v })}
            showLateral
          />
          <div>
            <div className={section}>Extras</div>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={f.tapetes} onChange={e => s({ tapetes: e.target.checked })} className="h-4 w-4 accent-[#1a1f36]" />
              Tapetes protectores (+5€)
            </label>
          </div>
        </>
        );
      })()}

      {/* ── PUF ── */}
      {f.tipo === "puf" && (() => {
        const activasCuad = PUF_OPCIONES.filter(o => o.activo && o.forma === "cuadrado");
        const activasRed  = PUF_OPCIONES.filter(o => o.activo && o.forma === "redondo");
        const selectedOpt = findPufById(f.pufId);
        const legacyExtra = selectedOpt && !selectedOpt.activo ? [selectedOpt] : [];
        return (
        <>
          <div>
            <div className={section}>Forma cuadrada</div>
            <div className="flex flex-wrap gap-2">
              {[...activasCuad, ...legacyExtra.filter(o => o.forma === "cuadrado")].map(x => (
                <button key={x.id} type="button"
                  onClick={() => s(patchPrecio(isEditing, { pufId: x.id }, x.precio))}
                  className={btn(f.pufId === x.id)}>
                  {x.label} · {x.precio}€{x.legacy ? " (retirado)" : ""}
                </button>
              ))}
            </div>
            <div className={`${section} mt-3`}>Forma redonda</div>
            <div className="flex flex-wrap gap-2">
              {[...activasRed, ...legacyExtra.filter(o => o.forma === "redondo")].map(x => (
                <button key={x.id} type="button"
                  onClick={() => s(patchPrecio(isEditing, { pufId: x.id }, x.precio))}
                  className={btn(f.pufId === x.id)}>
                  {x.label} · {x.precio}€{x.legacy ? " (retirado)" : ""}
                </button>
              ))}
            </div>
            <div className={`${section} mt-3`}>Otras opciones</div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => s({ pufId: "custom" })} className={btn(f.pufId === "custom")}>Otra medida</button>
              <button type="button" onClick={() => s({ pufId: "tbd" })} className={btn(f.pufId === "tbd")}>Por decidir</button>
            </div>
            <PriceReconciler isEditing={isEditing} saved={f.precioUnitario} catalog={selectedOpt?.precio ?? 0} onUpdate={v => s({ precioUnitario: v })} />
            {f.pufId === "custom" && (
              <div className="mt-2 grid grid-cols-3 gap-2">
                <div><label className="mb-1 block text-xs text-slate-500">Ancho (cm)</label><input type="number" className={inp} value={f.pufAnchoCustom} onChange={e => s({ pufAnchoCustom: e.target.value })} min={20} max={200} /></div>
                <div><label className="mb-1 block text-xs text-slate-500">Fondo (cm)</label><input type="number" className={inp} value={f.pufFondoCustom} onChange={e => s({ pufFondoCustom: e.target.value })} min={20} max={200} /></div>
                <div><label className="mb-1 block text-xs text-slate-500">Alto (cm)</label><input type="number" className={inp} value={f.pufAltoCustom} onChange={e => s({ pufAltoCustom: e.target.value })} min={20} max={100} /></div>
              </div>
            )}
          </div>
          <div>
            <div className={section}>Cantidad</div>
            <div className="flex gap-2">
              <button type="button" onClick={() => s({ cantidadPuf: "1" })} className={btn(f.cantidadPuf === "1")}>1 puf</button>
              <button type="button" onClick={() => s({ cantidadPuf: "2" })} className={btn(f.cantidadPuf === "2")}>2 pufs (pareja)</button>
            </div>
          </div>
          <TelaSection tela={f.tela} onTela={v => s({ tela: v })} coleccionTela={f.coleccionTela} onColeccion={v => s({ coleccionTela: v })} telaLateral={f.telaLateral} onTelaLateral={v => s({ telaLateral: v })} showLateral />
          <div>
            <div className={section}>Acabado</div>
            <div className="flex flex-wrap gap-2">
              {FINISHES_PUF.map(x => <button key={x.id} type="button" onClick={() => s({ acabado: x.id })} className={btn(f.acabado === x.id)}>{x.name}</button>)}
            </div>
          </div>
          {f.acabado === "vivo-simple" && (
            <div>
              <div className={section}>Tela del vivo <span className="normal-case font-normal text-slate-400">(opcional — vacío = igual que la principal)</span></div>
              <TelaSelect value={f.telaVivo} onChange={v => s({ telaVivo: v })} placeholder="Tela para el ribete…" />
            </div>
          )}
          <div>
            <div className={section}>Extras</div>
            <label className="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" checked={f.tapetes} onChange={e => s({ tapetes: e.target.checked })} className="h-4 w-4 accent-[#1a1f36]" /> Tapetes protectores (+5€)</label>
          </div>
        </>
        );
      })()}

      {/* ── MESA ── */}
      {f.tipo === "mesa" && (() => {
        const activas = MESA_OPCIONES.filter(o => o.activo);
        const selectedOpt = findMesaById(f.mesaId);
        const showLegacy = selectedOpt && !selectedOpt.activo;
        const opciones = showLegacy ? [...activas, selectedOpt!] : activas;
        return (
        <>
          <div>
            <div className={section}>Medida (alto {MESA_ALTO_FIJO} cm fijo)</div>
            <div className="flex flex-wrap gap-2">
              {opciones.map(x => (
                <button key={x.id} type="button"
                  onClick={() => s(patchPrecio(isEditing, { mesaId: x.id }, x.precio))}
                  className={btn(f.mesaId === x.id)}>
                  {x.label}{x.precio > 0 ? ` · ${x.precio}€` : ""}{x.legacy ? " (retirado)" : ""}
                </button>
              ))}
              <button type="button" onClick={() => s({ mesaId: "custom" })} className={btn(f.mesaId === "custom")}>Otra medida</button>
              <button type="button" onClick={() => s({ mesaId: "tbd" })} className={btn(f.mesaId === "tbd")}>Por decidir</button>
            </div>
            <PriceReconciler isEditing={isEditing} saved={f.precioUnitario} catalog={selectedOpt?.precio ?? 0} onUpdate={v => s({ precioUnitario: v })} />
            {f.mesaId === "custom" && (
              <div className="mt-2 grid grid-cols-3 gap-2">
                <div><label className="mb-1 block text-xs text-slate-500">Largo (cm)</label><input type="number" className={inp} value={f.mesaLargo} onChange={e => s({ mesaLargo: e.target.value })} min={40} max={300} /></div>
                <div><label className="mb-1 block text-xs text-slate-500">Alto (cm)</label><input type="number" className={inp} value={f.mesaAlto} onChange={e => s({ mesaAlto: e.target.value })} min={20} max={100} /></div>
                <div><label className="mb-1 block text-xs text-slate-500">Fondo (cm)</label><input type="number" className={inp} value={f.mesaFondo} onChange={e => s({ mesaFondo: e.target.value })} min={20} max={150} /></div>
              </div>
            )}
          </div>
          <TelaSection tela={f.tela} onTela={v => s({ tela: v })} coleccionTela={f.coleccionTela} onColeccion={v => s({ coleccionTela: v })} telaLateral={f.telaLateral} onTelaLateral={v => s({ telaLateral: v })} showLateral={false} />
          <div>
            <div className={section}>Superficie encima de la mesa</div>
            <div className="flex flex-wrap gap-2">
              {MESA_SUPERFICIES.map(x => <button key={x.id} type="button" onClick={() => s({ superficieMesa: x.id })} className={btn(f.superficieMesa === x.id)}>{x.name}</button>)}
            </div>
          </div>
          <div>
            <div className={section}>Extras</div>
            <label className="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" checked={f.tapetes} onChange={e => s({ tapetes: e.target.checked })} className="h-4 w-4 accent-[#1a1f36]" /> Tapetes protectores (+5€)</label>
          </div>
        </>
        );
      })()}

      {/* ── PANTALLA ── */}
      {f.tipo === "pantalla" && (() => {
        const selectedOpt = findPantallaById(f.pantallaId);
        const byForma = (fid: string) => PANTALLA_OPCIONES_CAT.filter(o => o.formaId === fid && (o.activo || o.id === f.pantallaId));
        return (
        <>
          {PANTALLA_FORMAS.map(fp => {
            const opts = byForma(fp.id);
            if (opts.length === 0) return null;
            return (
              <div key={fp.id}>
                <div className={section}>{fp.name}</div>
                <div className="flex flex-wrap gap-2">
                  {opts.map(x => (
                    <button key={x.id} type="button"
                      onClick={() => s(patchPrecio(isEditing, { pantallaId: x.id, formaPantalla: x.formaId }, x.precio))}
                      className={btn(f.pantallaId === x.id)}>
                      {x.label} · {x.precio}€{x.legacy ? " (retirado)" : ""}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
          <div>
            <div className={section}>Otras opciones</div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => s({ pantallaId: "custom" })} className={btn(f.pantallaId === "custom")}>Otra medida</button>
              <button type="button" onClick={() => s({ pantallaId: "tbd" })} className={btn(f.pantallaId === "tbd")}>Por decidir</button>
            </div>
            <PriceReconciler isEditing={isEditing} saved={f.precioUnitario} catalog={selectedOpt?.precio ?? 0} onUpdate={v => s({ precioUnitario: v })} />
            {f.pantallaId === "custom" && (
              <div className="mt-2 grid grid-cols-2 gap-2">
                <div><label className="mb-1 block text-xs text-slate-500">Ancho / Ø (cm)</label><input type="number" className={inp} value={f.pantallaAnchoCustom} onChange={e => s({ pantallaAnchoCustom: e.target.value })} min={5} max={200} /></div>
                <div><label className="mb-1 block text-xs text-slate-500">Alto (cm)</label><input type="number" className={inp} value={f.pantallaAltoCustom} onChange={e => s({ pantallaAltoCustom: e.target.value })} min={5} max={200} /></div>
              </div>
            )}
          </div>
          <TelaSection tela={f.tela} onTela={v => s({ tela: v })} coleccionTela={f.coleccionTela} onColeccion={v => s({ coleccionTela: v })} telaLateral={f.telaLateral} onTelaLateral={v => s({ telaLateral: v })} showLateral={false} />
          <div>
            <div className={section}>Extras</div>
            <label className="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" checked={f.tapetes} onChange={e => s({ tapetes: e.target.checked })} className="h-4 w-4 accent-[#1a1f36]" /> Tapetes protectores (+5€)</label>
          </div>
        </>
        );
      })()}

      {/* ── ALMOHADÓN ── */}
      {f.tipo === "almohadon" && (() => {
        const activas = COJIN_OPCIONES.filter(o => o.activo);
        const selectedOpt = findCojinById(f.almohadonId);
        const showLegacy = selectedOpt && !selectedOpt.activo;
        const opciones = showLegacy ? [...activas, selectedOpt!] : activas;
        return (
        <>
          <div>
            <div className={section}>Medida</div>
            <div className="flex flex-wrap gap-2">
              {opciones.map(x => (
                <button key={x.id} type="button"
                  onClick={() => s(patchPrecio(isEditing, { almohadonId: x.id }, x.precio))}
                  className={btn(f.almohadonId === x.id)}>
                  {x.label} · {x.precio}€{x.legacy ? " (retirado)" : ""}
                </button>
              ))}
              <button type="button" onClick={() => s({ almohadonId: "custom" })} className={btn(f.almohadonId === "custom")}>Otra medida</button>
              <button type="button" onClick={() => s({ almohadonId: "tbd" })} className={btn(f.almohadonId === "tbd")}>Por decidir</button>
            </div>
            <PriceReconciler isEditing={isEditing} saved={f.precioUnitario} catalog={selectedOpt?.precio ?? 0} onUpdate={v => s({ precioUnitario: v })} />
            {f.almohadonId === "custom" && (
              <input type="text" className={`${inp} mt-2`} value={f.almohadonMedidas} onChange={e => s({ almohadonMedidas: e.target.value })} placeholder="Ej. 55×35 cm" />
            )}
          </div>
          <div>
            <div className={section}>Tela</div>
            <TelaSelect value={f.almohadonTela} onChange={v => s({ almohadonTela: v })} />
          </div>
          <div>
            <div className={section}>Ribete</div>
            <input
              type="text"
              className={inp}
              value={f.almohadonRibete}
              onChange={e => s({ almohadonRibete: e.target.value })}
              placeholder="Tipo de ribete…"
              disabled={f.almohadonSinRibete}
            />
            <label className="mt-2 flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={f.almohadonSinRibete}
                onChange={e => s({ almohadonSinRibete: e.target.checked, almohadonRibete: e.target.checked ? "" : f.almohadonRibete })}
                className="h-4 w-4 accent-[#1a1f36]"
              />
              Sin ribete
            </label>
          </div>
        </>
        );
      })()}

      {/* ── OTRO ── */}
      {f.tipo === "otro" && (
        <div className="space-y-2">
          <div className={section}>¿Qué producto es? {!f.otroPorDecidir && <span className="text-red-500">*</span>}</div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => s({ otroPorDecidir: false })} className={btn(!f.otroPorDecidir)}>Descripción libre</button>
            <button type="button" onClick={() => s({ otroPorDecidir: true, otroDescripcion: "" })} className={btn(f.otroPorDecidir)}>Por decidir</button>
          </div>
          {!f.otroPorDecidir && (
            <input
              type="text"
              className={inp}
              value={f.otroDescripcion}
              onChange={e => s({ otroDescripcion: e.target.value })}
              placeholder="Describe el producto…"
            />
          )}
          {f.otroPorDecidir && (
            <div className="rounded-lg border border-dashed border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-700">
              Producto pendiente de definir — se puede editar más adelante
            </div>
          )}
        </div>
      )}

      {/* ── Precio / cantidad / notas ── */}
      {f.tipo && (
        <div className="space-y-3 border-t border-slate-200 pt-4">
          <div className="grid grid-cols-2 gap-3">
            {f.tipo !== "puf" && (
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Cantidad</label>
                <input type="number" min={1} className={inp} value={f.cantidad} onChange={e => s({ cantidad: Number(e.target.value) || 1 })} />
              </div>
            )}
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Precio unitario (€)</label>
              <input type="number" min={0} className={inp} value={f.precioUnitario} onChange={e => s({ precioUnitario: Number(e.target.value) || 0 })} />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Notas adicionales</label>
            <textarea rows={2} className={`${inp} resize-none`} value={f.notasProducto} onChange={e => s({ notasProducto: e.target.value })} placeholder="Observaciones…" />
          </div>
        </div>
      )}

      <div className="flex justify-end gap-2 pt-1">
        <button type="button" onClick={onCancel} className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100">Cancelar</button>
        <button
          type="button"
          disabled={!f.tipo || (f.tipo === "otro" && !f.otroPorDecidir && !f.otroDescripcion.trim())}
          onClick={() => onSave(prodStateToProducto(f))}
          className="rounded-lg bg-[#1a1f36] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#2a2f46] disabled:opacity-40">
          <Check className="mr-1 inline h-3.5 w-3.5" />Guardar producto
        </button>
      </div>
    </div>
  );
}
