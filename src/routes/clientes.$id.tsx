import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
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

// ── Configurador data (mirrors tirorirohome.com web configurator) ─────────────
const TIPOS_PRODUCTO = [
  { id: "cabecero", label: "Cabecero" },
  { id: "banco",    label: "Banco" },
  { id: "cojin",    label: "Almohadón" },
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

const BANCO_VARIANTES = [
  { id: "madera",    name: "Patas de madera" },
  { id: "enteladas", name: "Patas enteladas" },
  { id: "baul",      name: "Estilo baúl" },
];

const ALMOHADON_OPCIONES = [
  { id: "rodiles-40×40 cm",   label: "Rodiles — 40×40 cm" },
  { id: "rodiles-45×45 cm",   label: "Rodiles — 45×45 cm" },
  { id: "rodiles-50×50 cm",   label: "Rodiles — 50×50 cm" },
  { id: "covadonga-50×30 cm", label: "Covadonga — 50×30 cm" },
  { id: "covadonga-60×40 cm", label: "Covadonga — 60×40 cm" },
  { id: "gulpiyuri-13×90 cm", label: "Gulpiyuri (rulo) — 13×90 cm" },
];

const PUF_TAMAÑOS = ["40", "50"];

const MESA_PRESETS = ["120×45×60 cm", "80×45×80 cm"];
const MESA_SUPERFICIES = [
  { id: "nada",        name: "Sin superficie" },
  { id: "metacrilato", name: "Metacrilato 5 mm (+50€)" },
  { id: "cristal",     name: "Cristal 6 mm (+100€)" },
];

const PANTALLA_OPCIONES: Record<string, string[]> = {
  cilindro:   ["Ø15×20 cm", "Ø25×25 cm", "Ø40×40 cm"],
  cuadrado:   ["20×20 cm"],
  rectangulo: ["20×40 cm"],
};
const PANTALLA_FORMAS = [
  { id: "cilindro",   name: "Almanzor — Cilíndrico" },
  { id: "cuadrado",   name: "Tormes — Cuadrado" },
  { id: "rectangulo", name: "La Serrota — Rectangular" },
];

const FINISHES = [
  { id: "liso",        name: "Sin acabado" },
  { id: "vivo-simple", name: "Vivo simple (incluido)" },
  { id: "vivo-doble",  name: "Vivo doble (+10€)" },
];

// Key telas from the web (free text, datalist for suggestions)
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

type ProdTipo = "cabecero" | "banco" | "cojin" | "puf" | "mesa" | "pantalla" | "";

interface ProdState {
  tipo: ProdTipo;
  // cabecero
  forma: string; anchoCama: string; altoCm: string; telaLateral: string; colgador: boolean;
  // banco
  varianteBanco: string; largoBanco: string; altoBanco: string;
  // cojin
  opcionAlmohadon: string;
  // puf
  tamanoPuf: string; cantidadPuf: string;
  // mesa
  presetMesa: string; superficieMesa: string;
  // pantalla
  formaPantalla: string; tamanoPantalla: string;
  // common
  tela: string; coleccionTela: string; acabado: string;
  cantidad: number; precioUnitario: number; notasProducto: string;
}

const EMPTY_PROD_STATE: ProdState = {
  tipo: "", forma: "recto", anchoCama: "", altoCm: "", telaLateral: "", colgador: false,
  varianteBanco: "madera", largoBanco: "", altoBanco: "",
  opcionAlmohadon: "rodiles-45×45 cm",
  tamanoPuf: "40", cantidadPuf: "1",
  presetMesa: "120×45×60 cm", superficieMesa: "nada",
  formaPantalla: "cilindro", tamanoPantalla: "Ø40×40 cm",
  tela: "", coleccionTela: "Básicas", acabado: "vivo-simple",
  cantidad: 1, precioUnitario: 0, notasProducto: "",
};

function prodStateToProducto(f: ProdState): Omit<Producto, "id" | "leadId" | "createdAt" | "createdBy"> {
  let modelo = "", ancho: number | null = null, alto: number | null = null;
  let color = "", relleno = "", patas = "";

  if (f.tipo === "cabecero") {
    modelo = CABECERO_FORMAS.find(x => x.id === f.forma)?.name ?? f.forma;
    ancho = f.anchoCama ? Number(f.anchoCama) : null;
    alto = f.altoCm ? Number(f.altoCm) : null;
    color = f.telaLateral;
    patas = f.colgador ? "Con colgador" : "";
  } else if (f.tipo === "banco") {
    modelo = BANCO_VARIANTES.find(x => x.id === f.varianteBanco)?.name ?? f.varianteBanco;
    ancho = f.largoBanco ? Number(f.largoBanco) : null;
    alto = f.altoBanco ? Number(f.altoBanco) : null;
  } else if (f.tipo === "cojin") {
    const opt = ALMOHADON_OPCIONES.find(x => x.id === f.opcionAlmohadon);
    modelo = opt?.label ?? f.opcionAlmohadon;
    const dims = f.opcionAlmohadon.split("-")[1]?.replace(" cm", "").split("×");
    ancho = dims ? Number(dims[0]) : null;
    alto = dims ? Number(dims[1]) : null;
  } else if (f.tipo === "puf") {
    modelo = `${f.tamanoPuf} cm`;
    ancho = Number(f.tamanoPuf);
  } else if (f.tipo === "mesa") {
    modelo = f.presetMesa;
    const dims = f.presetMesa.replace(" cm", "").split("×");
    ancho = dims[0] ? Number(dims[0]) : null;
    alto = dims[1] ? Number(dims[1]) : null;
    color = MESA_SUPERFICIES.find(x => x.id === f.superficieMesa)?.name ?? "";
  } else if (f.tipo === "pantalla") {
    const fn = PANTALLA_FORMAS.find(x => x.id === f.formaPantalla)?.name.split("—")[0].trim() ?? "";
    modelo = `${fn} ${f.tamanoPantalla}`.trim();
    relleno = f.formaPantalla;
    patas = f.tamanoPantalla;
  }

  return {
    tipo: f.tipo,
    modelo,
    ancho,
    alto,
    tela: f.tela,
    color,
    relleno,
    patas,
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
  s.cantidad = p.cantidad;
  s.precioUnitario = p.precioUnitario;
  s.notasProducto = p.notasProducto;
  if (p.tipo === "cabecero") {
    s.forma = CABECERO_FORMAS.find(x => x.name === p.modelo)?.id ?? "recto";
    s.anchoCama = p.ancho ? String(p.ancho) : "";
    s.altoCm = p.alto ? String(p.alto) : "";
    s.telaLateral = p.color;
    s.colgador = p.patas === "Con colgador";
  } else if (p.tipo === "banco") {
    s.varianteBanco = BANCO_VARIANTES.find(x => x.name === p.modelo)?.id ?? "madera";
    s.largoBanco = p.ancho ? String(p.ancho) : "";
    s.altoBanco = p.alto ? String(p.alto) : "";
  } else if (p.tipo === "cojin") {
    s.opcionAlmohadon = ALMOHADON_OPCIONES.find(x => x.label === p.modelo)?.id ?? "rodiles-45×45 cm";
  } else if (p.tipo === "puf") {
    s.tamanoPuf = p.ancho ? String(p.ancho) : "40";
    s.cantidadPuf = String(p.cantidad);
  } else if (p.tipo === "mesa") {
    s.presetMesa = p.modelo || "120×45×60 cm";
    s.superficieMesa = MESA_SUPERFICIES.find(x => x.name === p.color)?.id ?? "nada";
  } else if (p.tipo === "pantalla") {
    s.formaPantalla = p.relleno || "cilindro";
    s.tamanoPantalla = p.patas || "";
  }
  return s;
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
  const btnTipo = (id: string) => `rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${f.tipo === id ? "border-[#1a1f36] bg-[#1a1f36] text-white" : "border-slate-200 text-slate-600 hover:border-slate-400"}`;

  return (
    <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
      {/* Tipo de producto */}
      <div>
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Tipo de producto</div>
        <div className="flex flex-wrap gap-2">
          {TIPOS_PRODUCTO.map(t => (
            <button key={t.id} type="button" onClick={() => s({ tipo: t.id as ProdTipo })} className={btnTipo(t.id)}>{t.label}</button>
          ))}
        </div>
      </div>

      {/* Cabecero */}
      {f.tipo === "cabecero" && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Forma</label>
              <select className={inp} value={f.forma} onChange={e => s({ forma: e.target.value })}>
                {CABECERO_FORMAS.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Ancho de cama (cm)</label>
              <select className={inp} value={f.anchoCama} onChange={e => s({ anchoCama: e.target.value })}>
                <option value="">Seleccionar…</option>
                {CABECERO_ANCHOS.map(a => <option key={a} value={a}>{a} cm</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Alto (cm)</label>
              <input type="number" className={inp} value={f.altoCm} onChange={e => s({ altoCm: e.target.value })} placeholder="ej. 100" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Acabado</label>
              <select className={inp} value={f.acabado} onChange={e => s({ acabado: e.target.value })}>
                {FINISHES.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
              </select>
            </div>
            <div className="flex items-end pb-1.5">
              <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" checked={f.colgador} onChange={e => s({ colgador: e.target.checked })} className="h-4 w-4 accent-[#1a1f36]" />
                Con colgador (+5€)
              </label>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Tela laterales (opcional — si es diferente)</label>
            <input list="telas-lateral-list" className={inp} value={f.telaLateral} onChange={e => s({ telaLateral: e.target.value })} placeholder="Dejar vacío si es la misma tela" />
            <datalist id="telas-lateral-list">{TELAS_SUGERIDAS.map(t => <option key={t} value={t} />)}</datalist>
          </div>
        </div>
      )}

      {/* Banco */}
      {f.tipo === "banco" && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <div className="md:col-span-3">
            <label className="mb-1 block text-xs font-medium text-slate-600">Variante</label>
            <div className="flex gap-2">
              {BANCO_VARIANTES.map(v => (
                <button key={v.id} type="button" onClick={() => s({ varianteBanco: v.id })}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${f.varianteBanco === v.id ? "border-[#1a1f36] bg-[#1a1f36] text-white" : "border-slate-200 text-slate-600 hover:border-slate-400"}`}>
                  {v.name}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Largo (cm)</label>
            <input type="number" className={inp} value={f.largoBanco} onChange={e => s({ largoBanco: e.target.value })} placeholder="ej. 120" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Alto (cm)</label>
            <input type="number" className={inp} value={f.altoBanco} onChange={e => s({ altoBanco: e.target.value })} placeholder="ej. 45" />
          </div>
        </div>
      )}

      {/* Almohadón */}
      {f.tipo === "cojin" && (
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Forma y tamaño</label>
          <div className="flex flex-wrap gap-2">
            {ALMOHADON_OPCIONES.map(o => (
              <button key={o.id} type="button" onClick={() => s({ opcionAlmohadon: o.id })}
                className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${f.opcionAlmohadon === o.id ? "border-[#1a1f36] bg-[#1a1f36] text-white" : "border-slate-200 text-slate-600 hover:border-slate-400"}`}>
                {o.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Puf */}
      {f.tipo === "puf" && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Tamaño (diámetro)</label>
            <div className="flex gap-2">
              {PUF_TAMAÑOS.map(t => (
                <button key={t} type="button" onClick={() => s({ tamanoPuf: t })}
                  className={`rounded-lg border px-4 py-2 text-xs font-medium transition-colors ${f.tamanoPuf === t ? "border-[#1a1f36] bg-[#1a1f36] text-white" : "border-slate-200 text-slate-600 hover:border-slate-400"}`}>
                  {t} cm
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Cantidad</label>
            <div className="flex gap-2">
              {[["1","Individual"],["2","Pareja (×2)"]].map(([v,l]) => (
                <button key={v} type="button" onClick={() => s({ cantidadPuf: v })}
                  className={`rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${f.cantidadPuf === v ? "border-[#1a1f36] bg-[#1a1f36] text-white" : "border-slate-200 text-slate-600 hover:border-slate-400"}`}>
                  {l}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Mesa */}
      {f.tipo === "mesa" && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Medidas (largo×alto×fondo)</label>
            <div className="flex gap-2">
              {MESA_PRESETS.map(p => (
                <button key={p} type="button" onClick={() => s({ presetMesa: p })}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${f.presetMesa === p ? "border-[#1a1f36] bg-[#1a1f36] text-white" : "border-slate-200 text-slate-600 hover:border-slate-400"}`}>
                  {p}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Superficie superior</label>
            <select className={inp} value={f.superficieMesa} onChange={e => s({ superficieMesa: e.target.value })}>
              {MESA_SUPERFICIES.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
            </select>
          </div>
        </div>
      )}

      {/* Pantalla de lámpara */}
      {f.tipo === "pantalla" && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Forma</label>
            <select className={inp} value={f.formaPantalla} onChange={e => s({ formaPantalla: e.target.value, tamanoPantalla: PANTALLA_OPCIONES[e.target.value]?.[0] ?? "" })}>
              {PANTALLA_FORMAS.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Tamaño</label>
            <select className={inp} value={f.tamanoPantalla} onChange={e => s({ tamanoPantalla: e.target.value })}>
              {(PANTALLA_OPCIONES[f.formaPantalla] ?? []).map(sz => <option key={sz} value={sz}>{sz}</option>)}
            </select>
          </div>
        </div>
      )}

      {/* Tela — always visible once tipo is selected */}
      {f.tipo && (
        <div className="space-y-3 border-t border-slate-200 pt-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Tela principal</label>
              <input list="telas-sugeridas" className={inp} value={f.tela} onChange={e => s({ tela: e.target.value })} placeholder="Ej. Arequipa Beige, Baqueira..." />
              <datalist id="telas-sugeridas">{TELAS_SUGERIDAS.map(t => <option key={t} value={t} />)}</datalist>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Colección</label>
              <div className="flex gap-2 pt-1">
                {["Básicas","Premium"].map(c => (
                  <button key={c} type="button" onClick={() => s({ coleccionTela: c })}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${f.coleccionTela === c ? "border-[#1a1f36] bg-[#1a1f36] text-white" : "border-slate-200 text-slate-600 hover:border-slate-400"}`}>
                    {c}
                  </button>
                ))}
              </div>
            </div>
          </div>
          {/* Acabado — not shown for pantalla (ribete incluido always) or puf */}
          {f.tipo !== "pantalla" && f.tipo !== "puf" && (
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Acabado</label>
              <div className="flex flex-wrap gap-2">
                {FINISHES.map(x => (
                  <button key={x.id} type="button" onClick={() => s({ acabado: x.id })}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${f.acabado === x.id ? "border-[#1a1f36] bg-[#1a1f36] text-white" : "border-slate-200 text-slate-600 hover:border-slate-400"}`}>
                    {x.name}
                  </button>
                ))}
              </div>
            </div>
          )}
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
  const [nuevaTarea, setNuevaTarea] = useState({ descripcion: "", fecha: todayISO(), hora: "" });
  const [nuevaNota, setNuevaNota] = useState("");
  const [editingNota, setEditingNota] = useState<string | null>(null);
  const [editNotaText, setEditNotaText] = useState("");
  const [showProdForm, setShowProdForm] = useState(false);
  const [editingProd, setEditingProd] = useState<string | null>(null);

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
      <Link to="/clientes" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" /> Volver
      </Link>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:p-6">
        <div>
          {editing ? (
            <input value={lead.nombre} onChange={(e) => actions.updateLead(lead.id, { nombre: e.target.value })} className="rounded border border-slate-300 px-2 py-1 text-2xl font-bold" />
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
                <input type="number" value={lead.valorProducto} autoFocus
                  onChange={(e) => actions.updateLead(lead.id, { valorProducto: parseFloat(e.target.value) || 0 })}
                  onBlur={() => setValorProductoEdit(false)} className="w-full rounded border border-slate-300 px-2 py-1 text-xl font-bold" />
              ) : (
                <button onClick={() => setValorProductoEdit(true)} className="text-xl font-bold text-slate-900 hover:text-slate-600">
                  {formatCurrency(lead.valorProducto)}
                </button>
              )}
            </div>
            <div>
              <div className="text-xs text-slate-500 mb-1">Envío</div>
              {valorEnvioEdit ? (
                <input type="number" value={lead.valorEnvio} autoFocus
                  onChange={(e) => actions.updateLead(lead.id, { valorEnvio: parseFloat(e.target.value) || 0 })}
                  onBlur={() => setValorEnvioEdit(false)} className="w-full rounded border border-slate-300 px-2 py-1 text-xl font-bold" />
              ) : (
                <button onClick={() => setValorEnvioEdit(true)} className="text-xl font-bold text-slate-900 hover:text-slate-600">
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
