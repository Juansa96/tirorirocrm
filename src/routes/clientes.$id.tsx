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

// ── Producto form ──────────────────────────────────────────────────
const EMPTY_PROD: Omit<Producto, "id" | "leadId" | "createdAt" | "createdBy"> = {
  modelo: "", ancho: null, alto: null, tela: "", color: "",
  relleno: "", patas: "", cantidad: 1, precioUnitario: 0, notasProducto: "",
};

function ProductoForm({
  initial, onSave, onCancel,
}: {
  initial: Omit<Producto, "id" | "leadId" | "createdAt" | "createdBy">;
  onSave: (p: typeof initial) => void;
  onCancel: () => void;
}) {
  const [f, setF] = useState(initial);
  const inp = "w-full rounded border border-slate-200 px-2 py-1.5 text-sm focus:border-slate-400 focus:outline-none";
  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Modelo</label>
          <input list="modelos-list" className={inp} value={f.modelo} onChange={e => setF({...f, modelo: e.target.value})} placeholder="Cabecero Recto..." />
          <datalist id="modelos-list">
            <option value="Cabecero Recto" /><option value="Cabecero Redondeado" />
            <option value="Cabecero Capitoné" /><option value="Cabecero con Patas" />
          </datalist>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Ancho (cm)</label>
          <input type="number" className={inp} value={f.ancho ?? ""} onChange={e => setF({...f, ancho: e.target.value ? Number(e.target.value) : null})} placeholder="150" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Alto (cm)</label>
          <input type="number" className={inp} value={f.alto ?? ""} onChange={e => setF({...f, alto: e.target.value ? Number(e.target.value) : null})} placeholder="120" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Tela</label>
          <input list="telas-list" className={inp} value={f.tela} onChange={e => setF({...f, tela: e.target.value})} placeholder="Terciopelo, Lino..." />
          <datalist id="telas-list">
            <option value="Terciopelo" /><option value="Lino" /><option value="Bouclé" />
            <option value="Piel sintética" /><option value="Cotton" /><option value="Chenilla" />
          </datalist>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Color</label>
          <input className={inp} value={f.color} onChange={e => setF({...f, color: e.target.value})} placeholder="Beige, Gris perla..." />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Relleno</label>
          <select className={inp} value={f.relleno} onChange={e => setF({...f, relleno: e.target.value})}>
            <option value="">Seleccionar...</option>
            <option value="HR 30">Espuma HR 30</option>
            <option value="HR 35">Espuma HR 35</option>
            <option value="Viscoelástica">Viscoelástica</option>
            <option value="Fibra + espuma">Fibra + espuma</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Patas</label>
          <select className={inp} value={f.patas} onChange={e => setF({...f, patas: e.target.value})}>
            <option value="">Sin patas</option>
            <option value="Madera natural">Madera natural</option>
            <option value="Madera lacada blanca">Madera lacada blanca</option>
            <option value="Madera lacada negra">Madera lacada negra</option>
            <option value="Metal negro">Metal negro</option>
            <option value="Metal dorado">Metal dorado</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Cantidad</label>
          <input type="number" min={1} className={inp} value={f.cantidad} onChange={e => setF({...f, cantidad: Number(e.target.value) || 1})} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Precio unit. (€)</label>
          <input type="number" min={0} className={inp} value={f.precioUnitario} onChange={e => setF({...f, precioUnitario: Number(e.target.value) || 0})} />
        </div>
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-600">Notas del producto</label>
        <textarea rows={2} className={`${inp} resize-none`} value={f.notasProducto} onChange={e => setF({...f, notasProducto: e.target.value})} placeholder="Observaciones adicionales..." />
      </div>
      <div className="flex justify-end gap-2">
        <button onClick={onCancel} className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100">Cancelar</button>
        <button onClick={() => onSave(f)} className="rounded-lg bg-[#1a1f36] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#2a2f46]">
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
          className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-blue-600"
        >
          <Calendar className="h-4 w-4" />
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
              initial={EMPTY_PROD}
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
                  initial={{ modelo: p.modelo, ancho: p.ancho, alto: p.alto, tela: p.tela, color: p.color, relleno: p.relleno, patas: p.patas, cantidad: p.cantidad, precioUnitario: p.precioUnitario, notasProducto: p.notasProducto }}
                  onSave={(updated) => { actions.updateProducto(p.id, updated); setEditingProd(null); }}
                  onCancel={() => setEditingProd(null)}
                />
              ) : (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-slate-900">{p.modelo || "Producto"}</div>
                      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
                        {p.ancho && <span>Ancho: <strong>{p.ancho} cm</strong></span>}
                        {p.alto && <span>Alto: <strong>{p.alto} cm</strong></span>}
                        {p.tela && <span>Tela: <strong>{p.tela}</strong></span>}
                        {p.color && <span>Color: <strong>{p.color}</strong></span>}
                        {p.relleno && <span>Relleno: <strong>{p.relleno}</strong></span>}
                        {p.patas && <span>Patas: <strong>{p.patas}</strong></span>}
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
