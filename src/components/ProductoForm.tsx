import { useState } from "react";
import { Check } from "lucide-react";
import type { Producto } from "@/lib/types";

// ── Constantes ────────────────────────────────────────────────────
export const TIPOS_PRODUCTO = [
  { id: "cabecero", label: "Cabecero" },
  { id: "puf",      label: "Puf" },
  { id: "mesa",     label: "Mesa de centro" },
  { id: "pantalla", label: "Pantalla de lámpara" },
] as const;

export const CABECERO_FORMAS = [
  { id: "recto",         name: "Calobra" },
  { id: "semicirculo",   name: "Pregonda" },
  { id: "corona-simple", name: "Macarella" },
  { id: "corona-doble",  name: "Conta" },
  { id: "ondas",         name: "Barbaria" },
];
export const CABECERO_ANCHOS = ["90", "105", "135", "150", "160", "180", "200"];
export const CABECERO_ALTOS  = ["100", "120"];

export const MESA_PRESETS = ["120×45×60 cm", "80×45×80 cm"];
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
export const PANTALLA_OPCIONES: Record<string, string[]> = {
  cilindro:   ["Ø15×20 cm", "Ø25×25 cm", "Ø40×40 cm"],
  cuadrado:   ["20×20 cm"],
  rectangulo: ["20×40 cm"],
};

export const FINISHES_CABECERO = [
  { id: "vivo-simple", name: "Vivo simple (incluido)" },
  { id: "vivo-doble",  name: "Vivo doble (+10€)" },
];
export const FINISHES_PUF = [
  { id: "liso",        name: "Sin acabado" },
  { id: "vivo-simple", name: "Vivo simple" },
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
export type ProdTipo = "cabecero" | "puf" | "mesa" | "pantalla" | "";

export interface ProdState {
  tipo: ProdTipo;
  forma: string;
  anchoCama: string; anchoCamaCustom: string;
  altoCabecero: string; altoCabeceroCustom: string;
  telaLateral: string; colgador: boolean;
  tamanoPuf: string; tamanoPufCustom: string; cantidadPuf: string;
  presetMesa: string; mesaLargo: string; mesaAlto: string; mesaFondo: string; superficieMesa: string;
  formaPantalla: string; tamanoPantalla: string;
  tela: string; coleccionTela: string; acabado: string; telaVivo: string;
  tapetes: boolean;
  cantidad: number; precioUnitario: number; notasProducto: string;
}

export const EMPTY_PROD_STATE: ProdState = {
  tipo: "",
  forma: "recto", anchoCama: "150", anchoCamaCustom: "", altoCabecero: "100", altoCabeceroCustom: "", telaLateral: "", colgador: false,
  tamanoPuf: "40", tamanoPufCustom: "", cantidadPuf: "1",
  presetMesa: "120×45×60 cm", mesaLargo: "", mesaAlto: "", mesaFondo: "", superficieMesa: "nada",
  formaPantalla: "cilindro", tamanoPantalla: "Ø40×40 cm",
  tela: "", coleccionTela: "Básicas", acabado: "vivo-simple", telaVivo: "",
  tapetes: false,
  cantidad: 1, precioUnitario: 0, notasProducto: "",
};

// ── Conversiones ──────────────────────────────────────────────────
export function prodStateToProducto(f: ProdState): Omit<Producto, "id" | "leadId" | "createdAt" | "createdBy"> {
  let modelo = "", ancho: number | null = null, alto: number | null = null;
  let color = "", relleno = "", patas = "";
  const extras = (items: (string | false)[]) => items.filter(Boolean).join(" · ");

  if (f.tipo === "cabecero") {
    modelo = CABECERO_FORMAS.find(x => x.id === f.forma)?.name ?? f.forma;
    ancho = f.anchoCama === "custom" ? (Number(f.anchoCamaCustom) || null) : (Number(f.anchoCama) || null);
    alto  = f.altoCabecero === "custom" ? (Number(f.altoCabeceroCustom) || null) : (Number(f.altoCabecero) || null);
    color = f.telaLateral; relleno = f.telaVivo;
    patas = extras([f.colgador && "Con colgador (+5€)", f.tapetes && "Tapetes protectores (+5€)"]);
  } else if (f.tipo === "puf") {
    modelo = "Patos";
    ancho  = f.tamanoPuf === "custom" ? (Number(f.tamanoPufCustom) || null) : (Number(f.tamanoPuf) || null);
    color  = f.telaLateral; relleno = f.telaVivo;
    patas  = extras([f.tapetes && "Tapetes protectores (+5€)"]);
  } else if (f.tipo === "mesa") {
    if (f.presetMesa === "custom") {
      modelo = "Medida personalizada";
      ancho = Number(f.mesaLargo) || null; alto = Number(f.mesaAlto) || null; relleno = f.mesaFondo;
    } else {
      modelo = f.presetMesa;
      const dims = f.presetMesa.replace(" cm", "").split("×");
      ancho = dims[0] ? Number(dims[0]) : null; alto = dims[1] ? Number(dims[1]) : null; relleno = dims[2] ?? "";
    }
    color = MESA_SUPERFICIES.find(x => x.id === f.superficieMesa)?.name ?? "";
    patas = extras([f.tapetes && "Tapetes protectores (+5€)"]);
  } else if (f.tipo === "pantalla") {
    const fn = PANTALLA_FORMAS.find(x => x.id === f.formaPantalla)?.name.split("—")[0].trim() ?? "";
    modelo = `${fn} ${f.tamanoPantalla}`.trim();
    relleno = f.formaPantalla;
    patas = extras([f.tamanoPantalla, f.tapetes && "Tapetes protectores (+5€)"]);
  }

  return {
    tipo: f.tipo, modelo, ancho, alto,
    tela: f.tela, color, relleno, patas,
    acabado: f.acabado, coleccionTela: f.coleccionTela,
    cantidad: f.tipo === "puf" ? Number(f.cantidadPuf) : f.cantidad,
    precioUnitario: f.precioUnitario, notasProducto: f.notasProducto,
  };
}

export function productoToState(p: Omit<Producto, "id" | "leadId" | "createdAt" | "createdBy">): ProdState {
  const s = { ...EMPTY_PROD_STATE };
  s.tipo = p.tipo as ProdTipo;
  s.tela = p.tela; s.coleccionTela = p.coleccionTela || "Básicas";
  s.acabado = p.acabado || "vivo-simple";
  s.precioUnitario = p.precioUnitario; s.notasProducto = p.notasProducto;
  s.tapetes = p.patas?.includes("Tapetes") ?? false;

  if (p.tipo === "cabecero") {
    s.forma = CABECERO_FORMAS.find(x => x.name === p.modelo)?.id ?? "recto";
    const a = p.ancho ? String(p.ancho) : "";
    s.anchoCama = CABECERO_ANCHOS.includes(a) ? a : (a ? "custom" : "150");
    s.anchoCamaCustom = CABECERO_ANCHOS.includes(a) ? "" : a;
    const h = p.alto ? String(p.alto) : "";
    s.altoCabecero = CABECERO_ALTOS.includes(h) ? h : (h ? "custom" : "100");
    s.altoCabeceroCustom = CABECERO_ALTOS.includes(h) ? "" : h;
    s.telaLateral = p.color; s.telaVivo = p.relleno ?? "";
    s.colgador = p.patas?.includes("Con colgador") ?? false;
    s.cantidad = p.cantidad;
  } else if (p.tipo === "puf") {
    const a = p.ancho ? String(p.ancho) : "";
    s.tamanoPuf = ["40","50"].includes(a) ? a : (a ? "custom" : "40");
    s.tamanoPufCustom = ["40","50"].includes(a) ? "" : a;
    s.cantidadPuf = String(p.cantidad);
    s.telaLateral = p.color; s.telaVivo = p.relleno ?? "";
  } else if (p.tipo === "mesa") {
    s.presetMesa = MESA_PRESETS.includes(p.modelo) ? p.modelo : "custom";
    s.mesaLargo = p.ancho ? String(p.ancho) : ""; s.mesaAlto = p.alto ? String(p.alto) : "";
    s.mesaFondo = p.relleno ?? "";
    s.superficieMesa = MESA_SUPERFICIES.find(x => x.name === p.color)?.id ?? "nada";
    s.cantidad = p.cantidad;
  } else if (p.tipo === "pantalla") {
    s.formaPantalla = p.relleno || "cilindro";
    s.tamanoPantalla = (p.patas ?? "").split(" · ")[0] || "";
    s.cantidad = p.cantidad;
  }
  return s;
}

// ── TelaSelect ────────────────────────────────────────────────────
const TELA_INP = "w-full rounded border border-slate-200 px-2 py-1.5 text-sm focus:border-slate-400 focus:outline-none bg-white";
const TELA_BTN = (active: boolean) =>
  `rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${active ? "border-[#1a1f36] bg-[#1a1f36] text-white" : "border-slate-200 text-slate-600 hover:border-slate-400"}`;

export function TelaSelect({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  const [modo, setModo] = useState<"web" | "otro">(() =>
    value !== "" && !TELAS_SUGERIDAS.includes(value) ? "otro" : "web"
  );
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <button type="button" className={TELA_BTN(modo === "web")} onClick={() => { setModo("web"); onChange(""); }}>Tela de la web</button>
        <button type="button" className={TELA_BTN(modo === "otro")} onClick={() => { setModo("otro"); onChange(""); }}>Otra tela</button>
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
    </div>
  );
}

// ── TelaSection (nivel de módulo para evitar remount en cada render) ──
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
          {["Básicas","Premium"].map(c => <button key={c} type="button" onClick={() => onColeccion(c)} className={BTN_CLS(coleccionTela === c)}>{c}</button>)}
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

// ── ProductoForm ──────────────────────────────────────────────────
export function ProductoForm({
  initial, onSave, onCancel,
}: {
  initial: ProdState;
  onSave: (p: Omit<Producto, "id" | "leadId" | "createdAt" | "createdBy">) => void;
  onCancel: () => void;
}) {
  const [f, setF] = useState<ProdState>(initial);
  const s = (patch: Partial<ProdState>) => setF(prev => ({ ...prev, ...patch }));
  const inp = "w-full rounded border border-slate-200 px-2 py-1.5 text-sm focus:border-slate-400 focus:outline-none bg-white";
  const btn = (active: boolean) => BTN_CLS(active);
  const section = SECTION_CLS;

  return (
    <div className="space-y-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div>
        <div className={section}>Tipo de producto</div>
        <div className="flex flex-wrap gap-2">
          {TIPOS_PRODUCTO.map(t => (
            <button key={t.id} type="button" onClick={() => s({ tipo: t.id as ProdTipo })} className={btn(f.tipo === t.id)}>{t.label}</button>
          ))}
        </div>
      </div>

      {/* ── CABECERO ── */}
      {f.tipo === "cabecero" && (
        <>
          <div>
            <div className={section}>Forma</div>
            <div className="flex flex-wrap gap-2">
              {CABECERO_FORMAS.map(x => <button key={x.id} type="button" onClick={() => s({ forma: x.id })} className={btn(f.forma === x.id)}>{x.name}</button>)}
            </div>
          </div>
          <div>
            <div className={section}>Ancho de cabecero</div>
            <div className="flex flex-wrap gap-2">
              {CABECERO_ANCHOS.map(a => <button key={a} type="button" onClick={() => s({ anchoCama: a })} className={btn(f.anchoCama === a)}>{a} cm</button>)}
              <button type="button" onClick={() => s({ anchoCama: "custom" })} className={btn(f.anchoCama === "custom")}>Otra medida</button>
            </div>
            {f.anchoCama === "custom" && <input type="number" className="mt-2 w-32 rounded border border-slate-200 px-2 py-1.5 text-sm" value={f.anchoCamaCustom} onChange={e => s({ anchoCamaCustom: e.target.value })} placeholder="cm" min={60} max={300} />}
          </div>
          <div>
            <div className={section}>Alto del cabecero</div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => s({ altoCabecero: "100" })} className={btn(f.altoCabecero === "100")}>100 cm (estándar)</button>
              <button type="button" onClick={() => s({ altoCabecero: "120" })} className={btn(f.altoCabecero === "120")}>120 cm</button>
              <button type="button" onClick={() => s({ altoCabecero: "custom" })} className={btn(f.altoCabecero === "custom")}>Otra medida</button>
            </div>
            {f.altoCabecero === "custom" && <input type="number" className="mt-2 w-32 rounded border border-slate-200 px-2 py-1.5 text-sm" value={f.altoCabeceroCustom} onChange={e => s({ altoCabeceroCustom: e.target.value })} placeholder="cm" min={40} max={200} />}
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
      )}

      {/* ── PUF ── */}
      {f.tipo === "puf" && (
        <>
          <div>
            <div className={section}>Tamaño (diámetro)</div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => s({ tamanoPuf: "40" })} className={btn(f.tamanoPuf === "40")}>40 cm</button>
              <button type="button" onClick={() => s({ tamanoPuf: "50" })} className={btn(f.tamanoPuf === "50")}>50 cm</button>
              <button type="button" onClick={() => s({ tamanoPuf: "custom" })} className={btn(f.tamanoPuf === "custom")}>Otra medida</button>
            </div>
            {f.tamanoPuf === "custom" && <input type="number" className="mt-2 w-32 rounded border border-slate-200 px-2 py-1.5 text-sm" value={f.tamanoPufCustom} onChange={e => s({ tamanoPufCustom: e.target.value })} placeholder="cm" min={30} max={120} />}
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
          {(f.acabado === "vivo-simple" || f.acabado === "vivo-doble") && (
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
      )}

      {/* ── MESA ── */}
      {f.tipo === "mesa" && (
        <>
          <div>
            <div className={section}>Medidas (largo × alto × fondo)</div>
            <div className="flex flex-wrap gap-2">
              {MESA_PRESETS.map(p => <button key={p} type="button" onClick={() => s({ presetMesa: p })} className={btn(f.presetMesa === p)}>{p}</button>)}
              <button type="button" onClick={() => s({ presetMesa: "custom" })} className={btn(f.presetMesa === "custom")}>Otra medida</button>
            </div>
            {f.presetMesa === "custom" && (
              <div className="mt-2 grid grid-cols-3 gap-2">
                <div><label className="mb-1 block text-xs text-slate-500">Largo (cm)</label><input type="number" className={inp} value={f.mesaLargo} onChange={e => s({ mesaLargo: e.target.value })} min={40} max={300} /></div>
                <div><label className="mb-1 block text-xs text-slate-500">Alto (cm)</label><input type="number" className={inp} value={f.mesaAlto} onChange={e => s({ mesaAlto: e.target.value })} min={20} max={100} /></div>
                <div><label className="mb-1 block text-xs text-slate-500">Fondo (cm)</label><input type="number" className={inp} value={f.mesaFondo} onChange={e => s({ mesaFondo: e.target.value })} min={20} max={150} /></div>
              </div>
            )}
          </div>
          <TelaSection tela={f.tela} onTela={v => s({ tela: v })} coleccionTela={f.coleccionTela} onColeccion={v => s({ coleccionTela: v })} telaLateral={f.telaLateral} onTelaLateral={v => s({ telaLateral: v })} showLateral={false} />
          <div className="rounded-lg border border-slate-100 bg-white px-3 py-2 text-xs text-slate-600">
            Acabado: <strong>Vivo simple</strong> — incluido en el precio
          </div>
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
      )}

      {/* ── PANTALLA ── */}
      {f.tipo === "pantalla" && (
        <>
          <div>
            <div className={section}>Forma</div>
            <div className="flex flex-wrap gap-2">
              {PANTALLA_FORMAS.map(x => <button key={x.id} type="button" onClick={() => s({ formaPantalla: x.id, tamanoPantalla: PANTALLA_OPCIONES[x.id]?.[0] ?? "" })} className={btn(f.formaPantalla === x.id)}>{x.name}</button>)}
            </div>
          </div>
          <div>
            <div className={section}>Medida</div>
            <div className="flex flex-wrap gap-2">
              {(PANTALLA_OPCIONES[f.formaPantalla] ?? []).map(sz => <button key={sz} type="button" onClick={() => s({ tamanoPantalla: sz })} className={btn(f.tamanoPantalla === sz)}>{sz}</button>)}
            </div>
          </div>
          <TelaSection tela={f.tela} onTela={v => s({ tela: v })} coleccionTela={f.coleccionTela} onColeccion={v => s({ coleccionTela: v })} telaLateral={f.telaLateral} onTelaLateral={v => s({ telaLateral: v })} showLateral={false} />
          <div className="rounded-lg border border-slate-100 bg-white px-3 py-2 text-xs text-slate-600">
            Acabado: <strong>Ribete incluido</strong> — vivo en borde superior e inferior sin coste adicional
          </div>
          <div>
            <div className={section}>Extras</div>
            <label className="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" checked={f.tapetes} onChange={e => s({ tapetes: e.target.checked })} className="h-4 w-4 accent-[#1a1f36]" /> Tapetes protectores (+5€)</label>
          </div>
        </>
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
          disabled={!f.tipo}
          onClick={() => onSave(prodStateToProducto(f))}
          className="rounded-lg bg-[#1a1f36] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#2a2f46] disabled:opacity-40">
          <Check className="mr-1 inline h-3.5 w-3.5" />Guardar producto
        </button>
      </div>
    </div>
  );
}
