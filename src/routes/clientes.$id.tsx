import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import {
  ArrowLeft, Mail, Phone, MapPin, Package, Plus, History, Trash2,
  Edit2, Check, X, Calendar, MessageSquare, ShoppingBag, Radio, Clock,
} from "lucide-react";
import { useStore, actions } from "@/lib/store";
import { ETAPAS, ETAPA_COLORS, VENDEDORES, ORIGENES, vendorName, type Etapa, type Producto, type Tarea } from "@/lib/types";
import { formatCurrency, todayISO } from "@/lib/format";
import { SellerBadge } from "@/components/SellerBadge";
import { DeleteLeadButton } from "@/components/DeleteLeadButton";

export const Route = createFileRoute("/clientes/$id")({
  head: () => ({ meta: [{ title: "Cliente — TiroCRM" }] }),
  component: ClienteDetalle,
});

const FIELD_LABELS: Record<string, string> = {
  etapa: "etapa", valor: "valor", vendedor: "vendedor",
  nombre: "nombre", email: "email", telefono: "teléfono",
  ciudad: "ciudad", producto: "producto",
};

function formatAuditValue(field: string, val: string | null): string {
  if (val === null || val === "") return "—";
  if (field === "valor") return formatCurrency(Number(val));
  if (field === "vendedor") return vendorName(val);
  return val;
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const MESES = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
  return `${d.getDate()} ${MESES[d.getMonth()]} ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
}

function googleCalendarUrl(t: Tarea, clienteNombre: string): string {
  const base = "https://calendar.google.com/calendar/render?action=TEMPLATE";
  const title = encodeURIComponent(`${t.descripcion} — ${clienteNombre}`);
  let dates = "";
  if (t.hora) {
    const [h, m] = t.hora.split(":").map(Number);
    const start = t.fecha.replace(/-/g, "") + "T" + String(h).padStart(2,"0") + String(m).padStart(2,"0") + "00";
    const endH = h + 1 < 24 ? h + 1 : h;
    const end = t.fecha.replace(/-/g, "") + "T" + String(endH).padStart(2,"0") + String(m).padStart(2,"0") + "00";
    dates = `${start}/${end}`;
  } else {
    const day = t.fecha.replace(/-/g, "");
    dates = `${day}/${day}`;
  }
  return `${base}&text=${title}&dates=${dates}&details=${encodeURIComponent("Lead: " + clienteNombre)}`;
}

// ── Configurador (espejo exacto de tirorirohome.com — solo productos visibles) ──
// Banco y Almohadón: "Próximamente" en la web → no se muestran aquí todavía.
// Si se activan en la web, añadir sus ids a TIPOS_PRODUCTO y sus secciones al form.
const TIPOS_PRODUCTO = [
  { id: "cabecero", label: "Cabecero" },
  { id: "puf",      label: "Puf" },
  { id: "mesa",     label: "Mesa de centro" },
  { id: "pantalla", label: "Pantalla de lámpara" },
] as const;

const CABECERO_FORMAS = [
  { id: "recto",         name: "Calobra" },
  { id: "semicirculo",   name: "Pregonda" },
  { id: "corona-simple", name: "Macarella" },
  { id: "corona-doble",  name: "Conta" },
  { id: "ondas",         name: "Barbaria" },
];
const CABECERO_ANCHOS = ["90", "105", "135", "150", "160", "180", "200"];
const CABECERO_ALTOS  = ["100", "120"];

// Puf: solo forma "Patos" (cuadrado) visible — Monteferro próximamente
// Mesa: solo "Cabo de Palos" visible — Calblanque próximamente
const MESA_PRESETS = ["120×45×60 cm", "80×45×80 cm"];
const MESA_SUPERFICIES = [
  { id: "nada",        name: "Sin superficie" },
  { id: "metacrilato", name: "Metacrilato 5 mm (+50€)" },
  { id: "cristal",     name: "Cristal 6 mm (+100€)" },
];

// Pantalla: 3 formas visibles — Gredos, La Galana, La Paramera próximamente
const PANTALLA_FORMAS = [
  { id: "cilindro",   name: "Almanzor — Cilíndrico" },
  { id: "cuadrado",   name: "Tormes — Cuadrado" },
  { id: "rectangulo", name: "La Serrota — Rectangular" },
];
const PANTALLA_OPCIONES: Record<string, string[]> = {
  cilindro:   ["Ø15×20 cm", "Ø25×25 cm", "Ø40×40 cm"],
  cuadrado:   ["20×20 cm"],
  rectangulo: ["20×40 cm"],
};

// Acabados por tipo (igual que en la web)
const FINISHES_CABECERO = [
  { id: "vivo-simple", name: "Vivo simple (incluido)" },
  { id: "vivo-doble",  name: "Vivo doble (+10€)" },
];
const FINISHES_PUF = [
  { id: "liso",        name: "Sin acabado" },
  { id: "vivo-simple", name: "Vivo simple" },
];

const TELAS_SUGERIDAS = [
  "Arequipa Beige","Ikat Natural","Ikat Verde Agua","Ikat Arena","Ikat Bali Azul",
  "Mil Rayas Gris","Rayas Arena","Mil Rayas Azul Marino","Flor Azul Protea","Floralia Vintage",
  "Morris Granadas Terracota","Pájaros Louise Azul","Pájaros Louise Rosa","Pájaros Louise Verde",
  "Toile de Jouy Azul","Espiga Agua","Pata de Gallo Verde","Coral Costero","Lino Greca",
  "Baqueira","Baqueira Roja","Cérler","Lola Gris","Rocío","Artesano Beige","Oxford",
  "Lino Verde Botella","Lino Verde","Güell Lamadrid","Vichy Denim","Vichy Verde",
  "Ramas Siena Azul","Flores Gardenia","Bibiana","Prints Botánicos","Rayas Verde Sage",
  "Raya Monina","Rayas Jules Verde","Lino Azul Provenzal","Lino Flores Normandía","Lino Flores Senda",
];

type ProdTipo = "cabecero" | "puf" | "mesa" | "pantalla" | "";

interface ProdState {
  tipo: ProdTipo;
  // cabecero
  forma: string;
  anchoCama: string;       // preset o "custom"
  anchoCamaCustom: string;
  altoCabecero: string;    // "100" | "120" | "custom"
  altoCabeceroCustom: string;
  telaLateral: string;
  colgador: boolean;
  // puf
  tamanoPuf: string;       // "40" | "50" | "custom"
  tamanoPufCustom: string;
  cantidadPuf: string;
  // mesa
  presetMesa: string;      // preset o "custom"
  mesaLargo: string; mesaAlto: string; mesaFondo: string;
  superficieMesa: string;
  // pantalla
  formaPantalla: string;
  tamanoPantalla: string;
  // común
  tela: string;
  coleccionTela: string;
  acabado: string;
  telaVivo: string;
  tapetes: boolean;
  cantidad: number;
  precioUnitario: number;
  notasProducto: string;
}

const EMPTY_PROD_STATE: ProdState = {
  tipo: "",
  forma: "recto", anchoCama: "150", anchoCamaCustom: "", altoCabecero: "100", altoCabeceroCustom: "", telaLateral: "", colgador: false,
  tamanoPuf: "40", tamanoPufCustom: "", cantidadPuf: "1",
  presetMesa: "120×45×60 cm", mesaLargo: "", mesaAlto: "", mesaFondo: "", superficieMesa: "nada",
  formaPantalla: "cilindro", tamanoPantalla: "Ø40×40 cm",
  tela: "", coleccionTela: "Básicas", acabado: "vivo-simple", telaVivo: "",
  tapetes: false,
  cantidad: 1, precioUnitario: 0, notasProducto: "",
};

function prodStateToProducto(f: ProdState): Omit<Producto, "id" | "leadId" | "createdAt" | "createdBy"> {
  let modelo = "", ancho: number | null = null, alto: number | null = null;
  let color = "", relleno = "", patas = "";

  const extras = (items: (string | false)[]) => items.filter(Boolean).join(" · ");

  if (f.tipo === "cabecero") {
    modelo = CABECERO_FORMAS.find(x => x.id === f.forma)?.name ?? f.forma;
    ancho = f.anchoCama === "custom" ? (Number(f.anchoCamaCustom) || null) : (Number(f.anchoCama) || null);
    alto  = f.altoCabecero === "custom" ? (Number(f.altoCabeceroCustom) || null) : (Number(f.altoCabecero) || null);
    color = f.telaLateral;
    relleno = f.telaVivo;
    patas = extras([f.colgador && "Con colgador (+5€)", f.tapetes && "Tapetes protectores (+5€)"]);
  } else if (f.tipo === "puf") {
    modelo = "Patos";
    ancho  = f.tamanoPuf === "custom" ? (Number(f.tamanoPufCustom) || null) : (Number(f.tamanoPuf) || null);
    color  = f.telaLateral;
    relleno = f.telaVivo;
    patas  = extras([f.tapetes && "Tapetes protectores (+5€)"]);
  } else if (f.tipo === "mesa") {
    if (f.presetMesa === "custom") {
      modelo = "Medida personalizada";
      ancho  = Number(f.mesaLargo) || null;
      alto   = Number(f.mesaAlto) || null;
      relleno = f.mesaFondo;
    } else {
      modelo = f.presetMesa;
      const dims = f.presetMesa.replace(" cm", "").split("×");
      ancho  = dims[0] ? Number(dims[0]) : null;
      alto   = dims[1] ? Number(dims[1]) : null;
      relleno = dims[2] ?? "";
    }
    color = MESA_SUPERFICIES.find(x => x.id === f.superficieMesa)?.name ?? "";
    patas = extras([f.tapetes && "Tapetes protectores (+5€)"]);
  } else if (f.tipo === "pantalla") {
    const fn = PANTALLA_FORMAS.find(x => x.id === f.formaPantalla)?.name.split("—")[0].trim() ?? "";
    modelo  = `${fn} ${f.tamanoPantalla}`.trim();
    relleno = f.formaPantalla;
    patas   = extras([f.tamanoPantalla, f.tapetes && "Tapetes protectores (+5€)"]);
  }

  return {
    tipo: f.tipo,
    modelo, ancho, alto,
    tela: f.tela, color, relleno, patas,
    acabado: f.acabado,
    coleccionTela: f.coleccionTela,
    cantidad: f.tipo === "puf" ? Number(f.cantidadPuf) : f.cantidad,
    precioUnitario: f.precioUnitario,
    notasProducto: f.notasProducto,
  };
}

function productoToState(p: Omit<Producto, "id" | "leadId" | "createdAt" | "createdBy">): ProdState {
  const s = { ...EMPTY_PROD_STATE };
  s.tipo = p.tipo as ProdTipo;
  s.tela = p.tela;
  s.coleccionTela = p.coleccionTela || "Básicas";
  s.acabado = p.acabado || "vivo-simple";
  s.precioUnitario = p.precioUnitario;
  s.notasProducto = p.notasProducto;
  s.tapetes = p.patas?.includes("Tapetes") ?? false;

  if (p.tipo === "cabecero") {
    s.forma = CABECERO_FORMAS.find(x => x.name === p.modelo)?.id ?? "recto";
    const a = p.ancho ? String(p.ancho) : "";
    s.anchoCama = CABECERO_ANCHOS.includes(a) ? a : (a ? "custom" : "150");
    s.anchoCamaCustom = CABECERO_ANCHOS.includes(a) ? "" : a;
    const h = p.alto ? String(p.alto) : "";
    s.altoCabecero = CABECERO_ALTOS.includes(h) ? h : (h ? "custom" : "100");
    s.altoCabeceroCustom = CABECERO_ALTOS.includes(h) ? "" : h;
    s.telaLateral = p.color;
    s.telaVivo = p.relleno ?? "";
    s.colgador = p.patas?.includes("Con colgador") ?? false;
    s.cantidad = p.cantidad;
  } else if (p.tipo === "puf") {
    const a = p.ancho ? String(p.ancho) : "";
    s.tamanoPuf = ["40","50"].includes(a) ? a : (a ? "custom" : "40");
    s.tamanoPufCustom = ["40","50"].includes(a) ? "" : a;
    s.cantidadPuf = String(p.cantidad);
    s.telaLateral = p.color;
    s.telaVivo = p.relleno ?? "";
  } else if (p.tipo === "mesa") {
    s.presetMesa = MESA_PRESETS.includes(p.modelo) ? p.modelo : "custom";
    s.mesaLargo = p.ancho ? String(p.ancho) : "";
    s.mesaAlto  = p.alto  ? String(p.alto)  : "";
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

const TELA_INP = "w-full rounded border border-slate-200 px-2 py-1.5 text-sm focus:border-slate-400 focus:outline-none bg-white";

const TELA_BTN = (active: boolean) =>
  `rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${active ? "border-[#1a1f36] bg-[#1a1f36] text-white" : "border-slate-200 text-slate-600 hover:border-slate-400"}`;

function TelaSelect({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
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

function ProductoForm({
  initial, onSave, onCancel,
}: {
  initial: ProdState;
  onSave: (p: Omit<Producto, "id" | "leadId" | "createdAt" | "createdBy">) => void;
  onCancel: () => void;
}) {
  const [f, setF] = useState<ProdState>(initial);
  const s = (patch: Partial<ProdState>) => setF(prev => ({ ...prev, ...patch }));
  const inp = "w-full rounded border border-slate-200 px-2 py-1.5 text-sm focus:border-slate-400 focus:outline-none bg-white";
  const btn = (active: boolean) => `rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${active ? "border-[#1a1f36] bg-[#1a1f36] text-white" : "border-slate-200 text-slate-600 hover:border-slate-400"}`;
  const section = "text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2";

  function TelaSection({ showLateral }: { showLateral: boolean }) {
    return (
      <div className="space-y-3">
        <div>
          <div className={section}>Tela principal</div>
          <TelaSelect value={f.tela} onChange={v => s({ tela: v })} />
        </div>
        <div>
          <div className={section}>Colección</div>
          <div className="flex gap-2">
            {["Básicas","Premium"].map(c => <button key={c} type="button" onClick={() => s({ coleccionTela: c })} className={btn(f.coleccionTela === c)}>{c}</button>)}
          </div>
        </div>
        {showLateral && (
          <div>
            <div className={section}>Tela lateral <span className="normal-case font-normal text-slate-400">(opcional, +15€ — vacío = igual que la principal)</span></div>
            <TelaSelect value={f.telaLateral} onChange={v => s({ telaLateral: v })} placeholder="Dejar vacío si es la misma tela" />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
      {/* 1. Tipo */}
      <div>
        <div className={section}>Tipo de producto</div>
        <div className="flex flex-wrap gap-2">
          {TIPOS_PRODUCTO.map(t => (
            <button key={t.id} type="button" onClick={() => s({ tipo: t.id as ProdTipo })} className={btn(f.tipo === t.id)}>{t.label}</button>
          ))}
        </div>
      </div>

      {/* ── CABECERO ────────────────────────────────────────────── */}
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
          <TelaSection showLateral />
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

      {/* ── PUF ─────────────────────────────────────────────────── */}
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
          <TelaSection showLateral />
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

      {/* ── MESA ─────────────────────────────────────────────────── */}
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
          <TelaSection showLateral={false} />
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

      {/* ── PANTALLA ─────────────────────────────────────────────── */}
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
          <TelaSection showLateral={false} />
          <div className="rounded-lg border border-slate-100 bg-white px-3 py-2 text-xs text-slate-600">
            Acabado: <strong>Ribete incluido</strong> — vivo en borde superior e inferior sin coste adicional
          </div>
          <div>
            <div className={section}>Extras</div>
            <label className="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" checked={f.tapetes} onChange={e => s({ tapetes: e.target.checked })} className="h-4 w-4 accent-[#1a1f36]" /> Tapetes protectores (+5€)</label>
          </div>
        </>
      )}

      {/* ── Precio / cantidad / notas (siempre, si hay tipo) ──── */}
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
        <button onClick={onCancel} className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100">Cancelar</button>
        <button
          disabled={!f.tipo}
          onClick={() => onSave(prodStateToProducto(f))}
          className="rounded-lg bg-[#1a1f36] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#2a2f46] disabled:opacity-40">
          <Check className="mr-1 inline h-3.5 w-3.5" />Guardar
        </button>
      </div>
    </div>
  );
}

// ── Tarea row ─────────────────────────────────────────────────────
function TareaRow({ tarea, clienteNombre }: { tarea: Tarea; clienteNombre: string }) {
  const [editing, setEditing] = useState(false);
  const [desc, setDesc] = useState(tarea.descripcion);
  const [fecha, setFecha] = useState(tarea.fecha);
  const [hora, setHora] = useState(tarea.hora ?? "");

  function save() {
    actions.updateTarea(tarea.id, { descripcion: desc, fecha, hora });
    setEditing(false);
  }

  if (editing) {
    return (
      <div className="space-y-2 rounded-lg border border-blue-200 bg-blue-50 p-3">
        <input className="w-full rounded border border-slate-200 px-2 py-1 text-sm" value={desc} onChange={e => setDesc(e.target.value)} />
        <div className="flex gap-2">
          <input type="date" className="rounded border border-slate-200 px-2 py-1 text-sm" value={fecha} onChange={e => setFecha(e.target.value)} />
          <input type="time" className="rounded border border-slate-200 px-2 py-1 text-sm" value={hora} onChange={e => setHora(e.target.value)} />
        </div>
        <div className="flex gap-2">
          <button onClick={save} className="inline-flex items-center gap-1 rounded bg-emerald-600 px-2 py-1 text-xs font-medium text-white"><Check className="h-3 w-3"/>Guardar</button>
          <button onClick={() => setEditing(false)} className="rounded border px-2 py-1 text-xs text-slate-600"><X className="h-3 w-3"/></button>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex items-start gap-3 rounded-lg border p-3 transition-colors ${tarea.completada ? "border-emerald-100 bg-emerald-50" : "border-slate-200 bg-white"}`}>
      <button
        onClick={() => actions.toggleTarea(tarea.id)}
        className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${tarea.completada ? "border-emerald-500 bg-emerald-500 text-white" : "border-slate-300 hover:border-emerald-400"}`}
      >
        {tarea.completada && <Check className="h-3.5 w-3.5" />}
      </button>
      <div className="min-w-0 flex-1">
        <div className={`text-sm font-medium ${tarea.completada ? "text-slate-400" : "text-slate-900"}`}>{tarea.descripcion}</div>
        <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-slate-500">
          <span>{tarea.fecha}{tarea.hora ? ` · ${tarea.hora}` : ""}</span>
          <SellerBadge vendedor={tarea.vendedor} />
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <a
          href={googleCalendarUrl(tarea, clienteNombre)}
          target="_blank"
          rel="noreferrer"
          title="Añadir a Google Calendar"
          className="inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100"
        >
          <Calendar className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Calendar</span>
        </a>
        <button onClick={() => setEditing(true)} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
          <Edit2 className="h-4 w-4" />
        </button>
        <button onClick={() => { if (confirm("¿Eliminar esta tarea?")) actions.deleteTarea(tarea.id); }} className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────
function ClienteDetalle() {
  const { id } = Route.useParams();
  const { leads, tareas, audit, notas, productos } = useStore();
  const navigate = useNavigate();
  const lead = leads.find((l) => l.id === id);

  const [editing, setEditing] = useState(false);
  const [valorProductoEdit, setValorProductoEdit] = useState(false);
  const [valorEnvioEdit, setValorEnvioEdit] = useState(false);
  const [localValorProducto, setLocalValorProducto] = useState<number | null>(null);
  const [localValorEnvio, setLocalValorEnvio] = useState<number | null>(null);
  const [nuevaTarea, setNuevaTarea] = useState({ descripcion: "", fecha: todayISO(), hora: "" });
  const [nuevaNota, setNuevaNota] = useState("");
  const [editingNota, setEditingNota] = useState<string | null>(null);
  const [editNotaText, setEditNotaText] = useState("");
  const [showProdForm, setShowProdForm] = useState(false);
  const [editingProd, setEditingProd] = useState<string | null>(null);

  const hasUnsaved = showProdForm || editingProd !== null;

  useEffect(() => {
    if (!hasUnsaved) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [hasUnsaved]);

  function goBack() {
    if (hasUnsaved) {
      if (!window.confirm("Tienes un producto sin guardar. ¿Salir sin guardar?")) return;
    }
    navigate({ to: "/clientes" });
  }

  if (!lead) {
    return (
      <div className="py-12 text-center">
        <p className="text-slate-500">Cliente no encontrado.</p>
        <Link to="/clientes" className="mt-4 inline-block text-sm text-blue-600">Volver a clientes</Link>
      </div>
    );
  }

  const leadTareas = tareas.filter((t) => t.leadId === lead.id).sort((a, b) => {
    if (a.completada !== b.completada) return a.completada ? 1 : -1;
    return a.fecha.localeCompare(b.fecha);
  });
  const leadAudit = audit.filter((a) => a.leadId === lead.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const leadNotas = notas.filter((n) => n.leadId === lead.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const leadProductos = productos.filter((p) => p.leadId === lead.id);

  const inp = "w-full rounded border border-slate-200 px-2 py-1 text-sm focus:border-slate-400 focus:outline-none";

  return (
    <div className="space-y-4">
      <button onClick={goBack} className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" /> Volver
        {hasUnsaved && <span className="ml-1 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">Sin guardar</span>}
      </button>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:p-6">
        <div>
          {editing ? (
            <input value={lead.nombre} onChange={(e) => actions.updateLead(lead.id, { nombre: e.target.value })} className="w-full rounded border border-slate-300 px-2 py-1 text-2xl font-bold" />
          ) : (
            <h1 className="text-2xl font-bold">{lead.nombre}</h1>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <SellerBadge vendedor={lead.vendedor} />
          </div>
        </div>
        <div className="flex gap-2">
          <DeleteLeadButton id={lead.id} redirectAfter />
          <button onClick={() => setEditing(!editing)} className="rounded-lg bg-[#1a1f36] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#2a2f46]">
            {editing ? "Hecho" : "Editar"}
          </button>
        </div>
      </div>

      {/* Etapa */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Etapa</div>
        <div className="flex flex-wrap gap-2">
          {ETAPAS.map((e) => {
            const active = lead.etapa === e;
            return (
              <button key={e} onClick={() => actions.setLeadEtapa(lead.id, e)}
                className="rounded-full px-3 py-1.5 text-xs font-medium transition-all"
                style={{ backgroundColor: active ? ETAPA_COLORS[e] : "#f1f5f9", color: active ? "#fff" : "#475569" }}>
                {e}
              </button>
            );
          })}
        </div>
      </div>

      {/* Info + Valor */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Información</div>
          <div className="space-y-3 text-sm">
            <InfoRow icon={Mail} label="Email">
              {editing ? <input value={lead.email} onChange={(e) => actions.updateLead(lead.id, { email: e.target.value })} className={inp} /> : (lead.email || <span className="text-slate-400">—</span>)}
            </InfoRow>
            <InfoRow icon={Phone} label="Teléfono">
              {editing ? <input value={lead.telefono} onChange={(e) => actions.updateLead(lead.id, { telefono: e.target.value })} className={inp} /> : (lead.telefono || <span className="text-slate-400">—</span>)}
            </InfoRow>
            <InfoRow icon={MapPin} label="Ciudad">
              {editing ? <input value={lead.ciudad} onChange={(e) => actions.updateLead(lead.id, { ciudad: e.target.value })} className={inp} /> : (lead.ciudad || <span className="text-slate-400">—</span>)}
            </InfoRow>
            <InfoRow icon={Radio} label="Red social">
              {editing ? <input value={lead.redSocial} onChange={(e) => actions.updateLead(lead.id, { redSocial: e.target.value })} className={inp} placeholder="@usuario..." /> : (lead.redSocial || <span className="text-slate-400">—</span>)}
            </InfoRow>
            {lead.origen && (
              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-500">Origen:</span>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-700">{lead.origen}</span>
              </div>
            )}
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <Clock className="h-3.5 w-3.5" />
              <span>Creado: <strong className="text-slate-600">{lead.fechaCreacion ? formatDateTime(lead.fechaCreacion) : "—"}</strong></span>
            </div>
            {lead.etapa === "On Hold" && (
              <div>
                <label className="mb-1 block text-xs font-medium text-red-600">Fecha On Hold</label>
                <input type="date" value={lead.fechaHold} onChange={e => actions.updateLead(lead.id, { fechaHold: e.target.value })} className={`${inp} border-red-200`} />
              </div>
            )}
            {editing && (
              <div>
                <label className="mb-1 block text-xs text-slate-500">Origen</label>
                <select value={lead.origen} onChange={e => actions.updateLead(lead.id, { origen: e.target.value })} className={inp}>
                  <option value="">Sin especificar</option>
                  {ORIGENES.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
            )}
            {editing && (
              <div>
                <label className="mb-1 block text-xs text-slate-500">Vendedor</label>
                <select value={lead.vendedor} onChange={(e) => actions.updateLead(lead.id, { vendedor: e.target.value })} className={inp}>
                  {VENDEDORES.map((v) => <option key={v} value={v}>{vendorName(v)}</option>)}
                </select>
              </div>
            )}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Valor estimado</div>
          <div className="space-y-3">
            <div>
              <div className="text-xs text-slate-500 mb-1">Producto</div>
              {valorProductoEdit ? (
                <input type="number" value={localValorProducto ?? lead.valorProducto} autoFocus
                  onChange={(e) => setLocalValorProducto(parseFloat(e.target.value) || 0)}
                  onBlur={() => {
                    if (localValorProducto !== null) actions.updateLead(lead.id, { valorProducto: localValorProducto });
                    setLocalValorProducto(null);
                    setValorProductoEdit(false);
                  }} className="w-full rounded border border-slate-300 px-2 py-1 text-xl font-bold" />
              ) : (
                <button onClick={() => { setLocalValorProducto(lead.valorProducto); setValorProductoEdit(true); }} className="text-xl font-bold text-slate-900 hover:text-slate-600">
                  {formatCurrency(lead.valorProducto)}
                </button>
              )}
            </div>
            <div>
              <div className="text-xs text-slate-500 mb-1">Envío</div>
              {valorEnvioEdit ? (
                <input type="number" value={localValorEnvio ?? lead.valorEnvio} autoFocus
                  onChange={(e) => setLocalValorEnvio(parseFloat(e.target.value) || 0)}
                  onBlur={() => {
                    if (localValorEnvio !== null) actions.updateLead(lead.id, { valorEnvio: localValorEnvio });
                    setLocalValorEnvio(null);
                    setValorEnvioEdit(false);
                  }} className="w-full rounded border border-slate-300 px-2 py-1 text-xl font-bold" />
              ) : (
                <button onClick={() => { setLocalValorEnvio(lead.valorEnvio); setValorEnvioEdit(true); }} className="text-xl font-bold text-slate-900 hover:text-slate-600">
                  {formatCurrency(lead.valorEnvio)}
                </button>
              )}
            </div>
            <div className="border-t border-slate-100 pt-2">
              <div className="text-xs text-slate-500 mb-1">Total</div>
              <div className="text-2xl font-bold text-slate-900">{formatCurrency(lead.valorProducto + lead.valorEnvio)}</div>
            </div>
          </div>
          <div className="mt-2 text-xs text-slate-400">Toca para editar</div>
        </div>
      </div>

      {/* Productos */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShoppingBag className="h-4 w-4 text-slate-500" />
            <h2 className="text-base font-semibold">Productos</h2>
            {leadProductos.length > 0 && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">{leadProductos.length}</span>}
          </div>
          {!showProdForm && (
            <button onClick={() => setShowProdForm(true)} className="inline-flex items-center gap-1 rounded-lg bg-[#1a1f36] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#2a2f46]">
              <Plus className="h-3.5 w-3.5" /> Añadir producto
            </button>
          )}
        </div>

        {showProdForm && (
          <div className="mb-4">
            <ProductoForm
              initial={EMPTY_PROD_STATE}
              onSave={(p) => { actions.addProducto(lead.id, p); setShowProdForm(false); }}
              onCancel={() => setShowProdForm(false)}
            />
          </div>
        )}

        {leadProductos.length === 0 && !showProdForm && (
          <div className="py-4 text-center text-sm text-slate-400">Sin productos añadidos</div>
        )}

        <div className="space-y-3">
          {leadProductos.map((p) => (
            <div key={p.id}>
              {editingProd === p.id ? (
                <ProductoForm
                  initial={productoToState({ tipo: p.tipo, modelo: p.modelo, ancho: p.ancho, alto: p.alto, tela: p.tela, color: p.color, relleno: p.relleno, patas: p.patas, acabado: p.acabado, coleccionTela: p.coleccionTela, cantidad: p.cantidad, precioUnitario: p.precioUnitario, notasProducto: p.notasProducto })}
                  onSave={(updated) => { actions.updateProducto(p.id, updated); setEditingProd(null); }}
                  onCancel={() => setEditingProd(null)}
                />
              ) : (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        {p.tipo && <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">{TIPOS_PRODUCTO.find(t => t.id === p.tipo)?.label ?? p.tipo}</span>}
                        <span className="font-medium text-slate-900">{p.modelo || "Producto"}</span>
                      </div>
                      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
                        {p.ancho && <span>Ancho: <strong>{p.ancho} cm</strong></span>}
                        {p.alto && <span>Alto: <strong>{p.alto} cm</strong></span>}
                        {p.tela && <span>Tela: <strong>{p.tela}</strong></span>}
                        {p.coleccionTela && <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px]">{p.coleccionTela}</span>}
                        {p.color && <span>Lateral: <strong>{p.color}</strong></span>}
                        {p.acabado && p.acabado !== "liso" && <span>Acabado: <strong>{p.acabado === "vivo-simple" ? "Vivo simple" : "Vivo doble"}</strong></span>}
                        {p.relleno && (p.tipo === "cabecero" || p.tipo === "puf") && <span>Tela vivo: <strong>{p.relleno}</strong></span>}
                        {p.patas && <span><strong>{p.patas}</strong></span>}
                        <span>Cant: <strong>{p.cantidad}</strong></span>
                        {p.precioUnitario > 0 && <span>Precio: <strong>{formatCurrency(p.precioUnitario)}</strong></span>}
                        {p.precioUnitario > 0 && p.cantidad > 1 && <span>Total: <strong>{formatCurrency(p.precioUnitario * p.cantidad)}</strong></span>}
                      </div>
                      {p.notasProducto && <div className="mt-1 text-xs italic text-slate-500">{p.notasProducto}</div>}
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <button onClick={() => setEditingProd(p.id)} className="rounded p-1 text-slate-400 hover:bg-white hover:text-slate-700"><Edit2 className="h-4 w-4" /></button>
                      <button onClick={() => { if (confirm("¿Eliminar este producto?")) actions.deleteProducto(p.id); }} className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Tareas */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <h2 className="text-base font-semibold">Tareas</h2>
          {leadTareas.filter(t => !t.completada).length > 0 && (
            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-xs font-bold text-white">
              {leadTareas.filter(t => !t.completada).length}
            </span>
          )}
        </div>
        <div className="space-y-2">
          {leadTareas.length === 0 && <div className="py-4 text-center text-sm text-slate-400">Sin tareas</div>}
          {leadTareas.map((t) => <TareaRow key={t.id} tarea={t} clienteNombre={lead.nombre} />)}
        </div>
        <div className="mt-4 rounded-lg border border-dashed border-slate-300 p-3">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Nueva tarea</div>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_auto_auto_auto]">
            <input placeholder="Descripción de la tarea…" value={nuevaTarea.descripcion}
              onChange={(e) => setNuevaTarea({ ...nuevaTarea, descripcion: e.target.value })}
              className="rounded border border-slate-200 px-3 py-2 text-sm" />
            <input type="date" value={nuevaTarea.fecha}
              onChange={(e) => setNuevaTarea({ ...nuevaTarea, fecha: e.target.value })}
              className="rounded border border-slate-200 px-3 py-2 text-sm" />
            <input type="time" value={nuevaTarea.hora}
              onChange={(e) => setNuevaTarea({ ...nuevaTarea, hora: e.target.value })}
              className="rounded border border-slate-200 px-3 py-2 text-sm" />
            <button
              onClick={() => {
                if (!nuevaTarea.descripcion.trim()) return;
                actions.addTarea({ leadId: lead.id, descripcion: nuevaTarea.descripcion, fecha: nuevaTarea.fecha, hora: nuevaTarea.hora, vendedor: lead.vendedor });
                setNuevaTarea({ descripcion: "", fecha: todayISO(), hora: "" });
              }}
              className="inline-flex items-center justify-center gap-1 rounded-lg bg-[#1a1f36] px-3 py-2 text-sm font-medium text-white hover:bg-[#2a2f46]">
              <Plus className="h-4 w-4" /> Añadir
            </button>
          </div>
        </div>
      </div>

      {/* Notas */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-slate-500" />
          <h2 className="text-base font-semibold">Notas</h2>
          {leadNotas.length > 0 && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">{leadNotas.length}</span>}
        </div>
        <div className="mb-4 flex gap-2">
          <textarea
            placeholder="Escribe una nota…"
            value={nuevaNota}
            onChange={(e) => setNuevaNota(e.target.value)}
            rows={2}
            className="flex-1 resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
          />
          <button
            onClick={() => { if (!nuevaNota.trim()) return; actions.addNota(lead.id, nuevaNota.trim()); setNuevaNota(""); }}
            className="self-end rounded-lg bg-[#1a1f36] px-3 py-2 text-sm font-medium text-white hover:bg-[#2a2f46]">
            <Plus className="h-4 w-4" />
          </button>
        </div>
        {leadNotas.length === 0 && <div className="py-4 text-center text-sm text-slate-400">Sin notas</div>}
        <div className="space-y-3">
          {leadNotas.map((n) => (
            <div key={n.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              {editingNota === n.id ? (
                <div className="space-y-2">
                  <textarea rows={3} className="w-full resize-none rounded border border-slate-200 px-2 py-1 text-sm" value={editNotaText} onChange={e => setEditNotaText(e.target.value)} />
                  <div className="flex gap-2">
                    <button onClick={() => { actions.updateNota(n.id, editNotaText); setEditingNota(null); }} className="inline-flex items-center gap-1 rounded bg-emerald-600 px-2 py-1 text-xs text-white"><Check className="h-3 w-3"/>Guardar</button>
                    <button onClick={() => setEditingNota(null)} className="rounded border px-2 py-1 text-xs text-slate-600">Cancelar</button>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <p className="flex-1 whitespace-pre-wrap text-sm text-slate-800">{n.contenido}</p>
                    <div className="flex shrink-0 gap-1">
                      <button onClick={() => { setEditingNota(n.id); setEditNotaText(n.contenido); }} className="rounded p-1 text-slate-400 hover:bg-white hover:text-slate-700"><Edit2 className="h-3.5 w-3.5" /></button>
                      <button onClick={() => { if (confirm("¿Eliminar esta nota?")) actions.deleteNota(n.id); }} className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-xs text-slate-400">
                    <span className="font-medium text-slate-600">{vendorName(n.usuario) || n.usuario}</span>
                    <span>·</span>
                    <span>{formatDateTime(n.createdAt)}</span>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Historial de cambios */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <History className="h-4 w-4 text-slate-500" />
          <h2 className="text-base font-semibold">Historial de cambios</h2>
        </div>
        {leadAudit.length === 0 ? (
          <div className="py-4 text-center text-sm text-slate-400">Sin cambios registrados</div>
        ) : (
          <ul className="space-y-2 text-sm">
            {leadAudit.map((a) => (
              <li key={a.id} className="flex flex-wrap items-baseline gap-x-1 gap-y-0.5 rounded-lg border border-slate-100 px-3 py-2">
                <span className="font-medium text-slate-900">{a.usuario ? vendorName(a.usuario) : "Sistema"}</span>
                <span className="text-slate-600">cambió {FIELD_LABELS[a.campo] ?? a.campo} de</span>
                <span className="font-medium text-slate-700">{formatAuditValue(a.campo, a.valorAnterior)}</span>
                <span className="text-slate-600">a</span>
                <span className="font-medium text-slate-700">{formatAuditValue(a.campo, a.valorNuevo)}</span>
                <span className="ml-auto text-xs text-slate-400">{formatDateTime(a.createdAt)}</span>
                <button onClick={() => { if (confirm("¿Eliminar este registro del historial?")) actions.deleteAuditEntry(a.id); }} className="ml-1 rounded p-0.5 text-slate-300 hover:bg-red-50 hover:text-red-500">
                  <Trash2 className="h-3 w-3" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function InfoRow({ icon: Icon, label, children }: { icon: React.ComponentType<{ className?: string }>; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
      <div className="min-w-0 flex-1">
        <div className="text-xs text-slate-500">{label}</div>
        <div className="text-slate-900">{children}</div>
      </div>
    </div>
  );
}
