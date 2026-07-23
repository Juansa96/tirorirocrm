import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import {
  ArrowLeft, Mail, Phone, MapPin, Plus, History, Trash2,
  Edit2, Check, X, MessageSquare, ShoppingBag, Radio, Clock, AlertTriangle, Package, Zap, Camera, ImagePlus,
} from "lucide-react";
import { useStore, actions } from "@/lib/store";
import { ETAPAS, ETAPAS_B2B, ETAPAS_COLAB, ETAPA_COLORS, VENDEDORES, ORIGENES, RANGOS_EDAD, ASIGNADOS_B2B, REDES_SOCIALES, vendorName, type Etapa, type Lead, type Tarea, type AsignadoB2B } from "@/lib/types";
import { MotivoPerdidaDialog } from "@/components/MotivoPerdidaDialog";
import { formatCurrency, todayISO } from "@/lib/format";
import { SellerBadge } from "@/components/SellerBadge";
import { DeleteLeadButton } from "@/components/DeleteLeadButton";
import { FormaBadge } from "@/components/FormaBadge";
import {
  ProductoForm, EMPTY_PROD_STATE, productoToState,
  TIPOS_PRODUCTO,
} from "@/components/ProductoForm";
import { displayColeccionTela } from "@/lib/catalogo";

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




// ProductoForm, constantes y helpers importados desde @/components/ProductoForm

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
  const { leads, tareas, audit, notas, productos, pedidos, remoteUpdateTimestamps, presenceEditors } = useStore();
  const navigate = useNavigate();
  const lead = leads.find((l) => l.id === id);

  const [editing, setEditing] = useState(false);
  // Draft text fields — only sent to Supabase on blur or when "Hecho" is clicked,
  // NOT on every keystroke (prevents audit-log spam and excessive DB writes)
  const [draft, setDraft] = useState<{ nombre: string; email: string; telefono: string; ciudad: string; redSocial: string } | null>(null);
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
  // Conflict detection: banner when another user modifies this lead while we have it open
  const [conflictBanner, setConflictBanner] = useState(false);
  const lastSeenRemote = useRef<number | undefined>(undefined);
  // Closed Won/Lost reason dialog
  const [closingEtapa, setClosingEtapa] = useState<Etapa | null>(null);
  const [closingReason, setClosingReason] = useState("");
  // Motivo de pérdida para colaboraciones (influencer → "Perdido")
  const [perdidaColab, setPerdidaColab] = useState(false);

  const hasUnsaved = showProdForm || editingProd !== null;

  useEffect(() => {
    if (!hasUnsaved) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [hasUnsaved]);

  // Track presence: announce we're viewing this lead, clear on unmount
  useEffect(() => {
    actions.trackEditing(id);
    return () => { actions.trackEditing(null); };
  }, [id]);

  // Show conflict banner when another user edits this lead while we have it open
  useEffect(() => {
    const remote = remoteUpdateTimestamps[id];
    if (!remote) return;
    if (lastSeenRemote.current === undefined) {
      lastSeenRemote.current = remote;
      return;
    }
    if (remote !== lastSeenRemote.current) {
      lastSeenRemote.current = remote;
      setConflictBanner(true);
    }
  }, [remoteUpdateTimestamps, id]);

  function openEditing() {
    if (!lead) return;
    setDraft({ nombre: lead.nombre, email: lead.email, telefono: lead.telefono, ciudad: lead.ciudad, redSocial: lead.redSocial });
    setEditing(true);
  }

  function saveDraftField(field: keyof NonNullable<typeof draft>, value: string) {
    if (!lead || !draft) return;
    if (value !== lead[field as keyof typeof lead]) {
      void actions.updateLead(lead.id, { [field]: value } as Partial<Lead>);
    }
  }

  function closeEditing() {
    // Los campos ya se guardan onBlur en saveDraftField; aquí solo cerramos el modo edición.
    // No re-aplicamos un patch global para evitar guardados duplicados que generan dos entradas en el histórico.
    setDraft(null);
    setEditing(false);
  }

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

  // Closed Won/Lost confirmation dialog
  function handleEtapaClick(etapa: Etapa) {
    // Colaboraciones: al pasar a "Perdido" pedimos siempre el motivo.
    if (lead!.tipo === "INFLUENCER" && etapa === "Perdido") {
      setPerdidaColab(true);
      return;
    }
    if (etapa === "Closed Won" || etapa === "Closed Lost") {
      setClosingEtapa(etapa);
      setClosingReason("");
    } else {
      actions.setLeadEtapa(lead!.id, etapa);
    }
  }

  async function confirmClose() {
    if (!closingEtapa || !lead) return;
    await actions.setLeadEtapa(lead.id, closingEtapa);
    if (closingReason.trim()) {
      await actions.addNota(lead.id, `[${closingEtapa}] ${closingReason.trim()}`);
    }
    setClosingEtapa(null);
    setClosingReason("");
  }

  return (
    <div className="space-y-4">
      <button onClick={goBack} className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" /> Volver
        {hasUnsaved && <span className="ml-1 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">Sin guardar</span>}
      </button>

      {/* Presence banner: who else is viewing this lead right now */}
      {(presenceEditors[id] ?? []).length > 0 && (
        <div className="flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm text-blue-800">
          <Radio className="h-3.5 w-3.5 shrink-0 text-blue-500" />
          <span>También está viendo: <strong>{(presenceEditors[id] ?? []).join(", ")}</strong></span>
        </div>
      )}

      {/* Conflict banner */}
      {conflictBanner && (
        <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
          <p className="flex-1 text-sm text-amber-800">
            Otro usuario ha modificado este lead mientras lo tenías abierto. Los datos mostrados son los más recientes.
          </p>
          <button onClick={() => setConflictBanner(false)} className="shrink-0 text-amber-500 hover:text-amber-700">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Closed Won/Lost dialog */}
      {closingEtapa && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-2 flex items-center gap-2">
            <span className="inline-flex rounded-full px-2.5 py-1 text-xs font-semibold text-white" style={{ backgroundColor: ETAPA_COLORS[closingEtapa] }}>
              {closingEtapa}
            </span>
            <span className="text-sm font-medium text-slate-700">Motivo del cierre (opcional)</span>
          </div>
          <textarea
            autoFocus
            value={closingReason}
            onChange={(e) => setClosingReason(e.target.value)}
            placeholder={closingEtapa === "Closed Won" ? "¿Qué fue determinante para cerrar la venta?" : "¿Por qué se perdió este lead?"}
            rows={2}
            className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
          />
          <div className="mt-3 flex gap-2 justify-end">
            <button onClick={() => setClosingEtapa(null)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50">Cancelar</button>
            <button onClick={confirmClose} className="rounded-lg px-3 py-1.5 text-sm font-medium text-white" style={{ backgroundColor: ETAPA_COLORS[closingEtapa] }}>
              Confirmar cierre
            </button>
          </div>
        </div>
      )}

      {perdidaColab && (
        <MotivoPerdidaDialog
          onCancel={() => setPerdidaColab(false)}
          onConfirm={(motivo) => {
            actions.setLeadEtapa(lead.id, "Perdido");
            if (motivo.trim()) void actions.addNota(lead.id, `[Perdido] ${motivo.trim()}`);
            setPerdidaColab(false);
          }}
        />
      )}

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:p-6">
        <div className="min-w-0 flex-1">
          {editing && draft ? (
            <input
              value={draft.nombre}
              onChange={(e) => setDraft({ ...draft, nombre: e.target.value })}
              onBlur={(e) => saveDraftField("nombre", e.target.value)}
              className="w-full rounded border border-slate-300 px-2 py-1 text-xl font-bold sm:text-2xl"
            />
          ) : (
            <h1 className="truncate text-xl font-bold sm:text-2xl">{lead.nombre}</h1>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <SellerBadge vendedor={lead.vendedor} />
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <DeleteLeadButton id={lead.id} redirectAfter />
          <button onClick={editing ? closeEditing : openEditing} className="rounded-lg bg-[#1a1f36] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#2a2f46]">
            {editing ? "Hecho" : "Editar"}
          </button>
        </div>
      </div>

      {/* Bloque B2B (razón social, contacto, asignados) */}
      {lead.tipo === "B2B" && <B2BInfoPanel lead={lead} />}

      {/* Bloque Influencer (seguidores, red, usuario) */}
      {lead.tipo === "INFLUENCER" && <InfluencerPanel lead={lead} />}

      {/* Etapa + razón de urgencia */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Etapa</div>
        <div className="flex flex-wrap gap-2">
          {(lead.tipo === "B2B" ? (ETAPAS_B2B as readonly Etapa[]) : lead.tipo === "INFLUENCER" ? (ETAPAS_COLAB as readonly Etapa[]) : (ETAPAS as readonly Etapa[])).map((e) => {
            const active = lead.etapa === e;
            return (
              <button key={e} onClick={() => handleEtapaClick(e)}
                className="rounded-full px-3 py-1.5 text-xs font-medium transition-all"
                style={{ backgroundColor: active ? ETAPA_COLORS[e] : "#f1f5f9", color: active ? "#fff" : "#475569" }}>
                {e}
              </button>
            );
          })}
        </div>
        {lead.etapa === "Closed Won" && (
          <div className="mt-3 flex flex-wrap items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50/50 px-3 py-2">
            <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-700">
              <input
                type="checkbox"
                checked={lead.cobrado}
                onChange={(e) => void actions.updateLead(lead.id, {
                  cobrado: e.target.checked,
                  fechaCobro: e.target.checked ? (lead.fechaCobro || new Date().toISOString().slice(0, 10)) : "",
                })}
                className="h-4 w-4 accent-emerald-600"
              />
              {lead.cobrado ? "✓ Cobrado" : "Marcar como cobrado"}
            </label>
            {lead.cobrado && (
              <label className="flex items-center gap-2 text-xs text-slate-600">
                <span>Fecha de cobro:</span>
                <input
                  type="date"
                  value={lead.fechaCobro}
                  onChange={(e) => void actions.updateLead(lead.id, { fechaCobro: e.target.value })}
                  className="rounded border border-slate-200 px-2 py-1 text-xs"
                />
              </label>
            )}
          </div>
        )}

        {lead.etapa !== "Closed Won" && lead.etapa !== "Closed Lost" && (
          <div className="mt-3">
            <label className="mb-1 flex items-center gap-1.5 text-xs font-medium text-slate-600">
              <Zap className="h-3.5 w-3.5 text-amber-500" />
              Razón de urgencia / situación actual
            </label>
            <input
              type="text"
              defaultValue={lead.razonUrgencia}
              key={lead.id + lead.razonUrgencia}
              onBlur={(e) => {
                if (e.target.value !== lead.razonUrgencia) {
                  void actions.updateLead(lead.id, { razonUrgencia: e.target.value });
                }
              }}
              placeholder="Ej: esperando confirmación de medidas, pendiente de envío de muestras…"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
            />
          </div>
        )}
        <div className="mt-3 flex items-center gap-2 border-t border-slate-100 pt-3">
          <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-medium text-slate-600">
            <input
              type="checkbox"
              checked={lead.clienteTipo === "partner_ab"}
              onChange={(e) => void actions.updateLead(lead.id, { clienteTipo: e.target.checked ? "partner_ab" : "normal" })}
              className="h-3.5 w-3.5 rounded border-slate-300 text-[#1a4b5b] focus:ring-[#1a4b5b]"
            />
            Cliente Alejandra Blanc (partner)
          </label>
          {lead.clienteTipo === "partner_ab" && (
            <span className="rounded-full bg-[#e6f1f4] px-2 py-0.5 text-[10px] font-bold text-[#1a4b5b]">PARTNER · 5 días</span>
          )}
        </div>
      </div>

      {/* Info + Valor */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Información</div>
          <div className="space-y-3 text-sm">
            <InfoRow icon={Mail} label="Email">
              {editing && draft ? <input value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} onBlur={(e) => saveDraftField("email", e.target.value)} className={inp} /> : (lead.email || <span className="text-slate-400">—</span>)}
            </InfoRow>
            <InfoRow icon={Phone} label="Teléfono">
              {editing ? (
                <input value={draft?.telefono ?? lead.telefono} onChange={(e) => draft && setDraft({ ...draft, telefono: e.target.value })} onBlur={(e) => saveDraftField("telefono", e.target.value)} className={inp} />
              ) : lead.telefono ? (
                <div className="flex items-center gap-2">
                  <span>{lead.telefono}</span>
                  <a
                    href={`https://wa.me/${lead.telefono.replace(/\D/g, "")}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100"
                  >
                    WhatsApp
                  </a>
                </div>
              ) : <span className="text-slate-400">—</span>}
            </InfoRow>
            <InfoRow icon={MapPin} label="Ciudad">
              {editing && draft ? <input value={draft.ciudad} onChange={(e) => setDraft({ ...draft, ciudad: e.target.value })} onBlur={(e) => saveDraftField("ciudad", e.target.value)} className={inp} /> : (lead.ciudad || <span className="text-slate-400">—</span>)}
            </InfoRow>
            <InfoRow icon={Radio} label="Red social">
              {editing && draft ? (
                <input value={draft.redSocial} onChange={(e) => setDraft({ ...draft, redSocial: e.target.value })} onBlur={(e) => saveDraftField("redSocial", e.target.value)} className={inp} placeholder="@usuario..." />
              ) : lead.redSocial ? (
                <div className="flex items-center gap-2">
                  <span>{lead.redSocial}</span>
                  {(() => {
                    const handle = lead.redSocial.trim().replace(/^@/, "").replace(/^https?:\/\/(www\.)?instagram\.com\//i, "").replace(/\/$/, "");
                    if (!handle || handle.includes(" ") || handle.includes("/")) return null;
                    return (
                      <a
                        href={`https://instagram.com/${handle}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center rounded-full border border-pink-200 bg-gradient-to-br from-pink-50 to-orange-50 px-2 py-0.5 text-[11px] font-medium text-pink-700 hover:from-pink-100 hover:to-orange-100"
                        title="Abrir en Instagram"
                      >
                        Abrir IG ↗
                      </a>
                    );
                  })()}
                </div>
              ) : <span className="text-slate-400">—</span>}
            </InfoRow>
            <div>
              <div className="mb-1.5 text-xs text-slate-500">Edad aprox.</div>
              <div className="flex flex-wrap gap-1.5">
                {RANGOS_EDAD.map(r => (
                  <button
                    key={r}
                    onClick={() => actions.updateLead(lead.id, { edad: lead.edad === r ? "" : r })}
                    className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${lead.edad === r ? "border-[#1a1f36] bg-[#1a1f36] text-white" : "border-slate-200 bg-white text-slate-500 hover:border-slate-400"}`}
                  >
                    {r}
                  </button>
                ))}
                {!lead.edad && <span className="self-center text-xs text-slate-300">Sin especificar</span>}
              </div>
            </div>

            {/* Etiquetas libres */}
            <EtiquetasEditor lead={lead} />

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
              {leadProductos.length > 0 ? (
                <div className="space-y-1">
                  {leadProductos.map((p) => {
                    const subtotal = (p.precioUnitario || 0) * (p.cantidad || 1);
                    return (
                      <div key={p.id} className="flex items-baseline justify-between gap-2 text-sm">
                        <span className="flex min-w-0 flex-1 items-center gap-1.5 truncate text-slate-600">
                          <span className="truncate">{p.modelo || "Producto"}</span>
                          <FormaBadge modelo={p.modelo} />
                          {p.cantidad > 1 && <span className="text-slate-400">×{p.cantidad}</span>}
                        </span>
                        <span className="font-semibold text-slate-900">{formatCurrency(subtotal)}</span>
                      </div>
                    );
                  })}
                  <div className="flex items-baseline justify-between gap-2 border-t border-slate-100 pt-1 text-sm">
                    <span className="text-xs text-slate-500">Subtotal productos</span>
                    <span className="font-bold text-slate-900">
                      {formatCurrency(leadProductos.reduce((acc, p) => acc + (p.precioUnitario || 0) * (p.cantidad || 1), 0))}
                    </span>
                  </div>
                </div>
              ) : valorProductoEdit ? (
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
              <div className="text-2xl font-bold text-slate-900">
                {formatCurrency(
                  (leadProductos.length > 0
                    ? leadProductos.reduce((acc, p) => acc + (p.precioUnitario || 0) * (p.cantidad || 1), 0)
                    : lead.valorProducto)
                  + lead.valorEnvio
                )}
              </div>
            </div>
          </div>
          <div className="mt-2 text-xs text-slate-400">
            {leadProductos.length > 0 ? "Edita el precio en cada producto" : "Toca para editar"}
          </div>
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
            <div className="flex items-center gap-2">
              {(() => {
                const pendientes = leadProductos.filter((p) =>
                  p.caracteristicasConfirmadas &&
                  !pedidos.some((pd) => pd.productoLeadId === p.id) &&
                  !(p.notasProducto || "").toLowerCase().includes("posible-duplicado")
                );
                if (pendientes.length === 0) return null;
                return (
                  <button
                    onClick={async () => {
                      if (!confirm(`¿Crear ${pendientes.length} pedido(s) pendiente(s)?`)) return;
                      for (const p of pendientes) {
                        await actions.crearPedido({
                          productoId: p.id,
                          pagado50: lead.tipo === "INFLUENCER" ? false : p.pagado50,
                          pagoTodoAlFinal: lead.tipo !== "INFLUENCER" && !p.pagado50,
                          creadoManualmente: !p.pagado50,
                          esCanje: lead.tipo === "INFLUENCER",
                        });
                      }
                    }}
                    className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700"
                  >
                    <Package className="h-3.5 w-3.5" /> Crear pedidos pendientes ({pendientes.length})
                  </button>
                );
              })()}
              <button onClick={() => setShowProdForm(true)} className="inline-flex items-center gap-1 rounded-lg bg-[#1a1f36] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#2a2f46]">
                <Plus className="h-3.5 w-3.5" /> Añadir producto
              </button>
            </div>
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
                  initial={productoToState({ tipo: p.tipo, modelo: p.modelo, ancho: p.ancho, alto: p.alto, fondo: p.fondo, tela: p.tela, color: p.color, relleno: p.relleno, patas: p.patas, acabado: p.acabado, coleccionTela: p.coleccionTela, cantidad: p.cantidad, precioUnitario: p.precioUnitario, notasProducto: p.notasProducto })}
                  onSave={(updated) => { actions.updateProducto(p.id, updated); setEditingProd(null); }}
                  onCancel={() => setEditingProd(null)}
                />
              ) : (
                <div className={`rounded-lg border p-3 ${p.caracteristicasConfirmadas ? "border-emerald-200 bg-emerald-50/40" : "border-slate-200 bg-slate-50"}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {p.tipo && <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">{TIPOS_PRODUCTO.find(t => t.id === p.tipo)?.label ?? p.tipo}</span>}
                        <span className="font-medium text-slate-900">{p.modelo || "Producto"}</span>
                        <FormaBadge modelo={p.modelo} />
                        {(p.notasProducto || "").toLowerCase().includes("posible-duplicado") && (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800" title="Detectado como posible duplicado. Revísalo y bórralo si procede.">
                            ⚠ Posible duplicado
                          </span>
                        )}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
                        {p.ancho && <span>Ancho: <strong>{p.ancho} cm</strong></span>}
                        {p.alto && <span>Alto: <strong>{p.alto} cm</strong></span>}
                        {p.fondo != null && <span>Fondo: <strong>{p.fondo} cm</strong></span>}
                        {p.tela && <span>Tela: <strong>{p.tela}</strong></span>}
                        {p.coleccionTela && <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px]">{displayColeccionTela(p.coleccionTela)}</span>}
                        {p.color && <span>Lateral: <strong>{p.color}</strong></span>}
                        {p.acabado && p.acabado !== "liso" && <span>Acabado: <strong>{p.acabado === "vivo-simple" ? "Vivo simple" : "Vivo doble"}</strong></span>}
                        {p.relleno && (p.tipo === "cabecero" || p.tipo === "puf") && <span>Tela vivo: <strong>{p.relleno}</strong></span>}
                        {p.patas && <span><strong>{p.patas}</strong></span>}
                        <span>Cant: <strong>{p.cantidad}</strong></span>
                        {p.precioUnitario > 0 && <span>Precio: <strong>{formatCurrency(p.precioUnitario)}</strong></span>}
                        {p.precioUnitario > 0 && p.cantidad > 1 && <span>Total: <strong>{formatCurrency(p.precioUnitario * p.cantidad)}</strong></span>}
                      </div>
                      {p.notasProducto && <div className="mt-1 text-xs italic text-slate-500">{p.notasProducto}</div>}

                      {/* Confirmación + pago 50 + crear pedido */}
                      <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-slate-200 pt-2.5">
                        <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-slate-700">
                          <input
                            type="checkbox"
                            checked={p.caracteristicasConfirmadas}
                            onChange={(e) => actions.updateProductoFlags(p.id, { caracteristicasConfirmadas: e.target.checked })}
                            className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                          />
                          <span className="font-medium">Características confirmadas</span>
                        </label>
                        <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-slate-700">
                          <input
                            type="checkbox"
                            checked={p.pagado50}
                            onChange={(e) => actions.updateProductoFlags(p.id, { pagado50: e.target.checked })}
                            className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span>Pagado 50%</span>
                        </label>
                        <CrearPedidoButton producto={p} pedidos={pedidos.filter((pd) => pd.productoLeadId === p.id)} navigate={navigate} esCanje={lead.tipo === "INFLUENCER"} />
                      </div>
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

      {/* Fotos */}
      <FotosSection leadId={lead.id} />

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

const ETIQUETAS_SUGERIDAS = ["Mayorista", "Problemático", "Recurrente", "VIP", "Prioritario", "Urgente"];

function EtiquetasEditor({ lead }: { lead: Lead }) {
  const [input, setInput] = useState("");
  const tags = lead.etiquetas ?? [];
  function add(t: string) {
    const v = t.trim();
    if (!v || tags.includes(v)) { setInput(""); return; }
    void actions.updateLead(lead.id, { etiquetas: [...tags, v] });
    setInput("");
  }
  function remove(t: string) {
    void actions.updateLead(lead.id, { etiquetas: tags.filter((x) => x !== t) });
  }
  const sugerencias = ETIQUETAS_SUGERIDAS.filter((s) => !tags.includes(s));
  return (
    <div>
      <div className="mb-1.5 text-xs text-slate-500">Etiquetas</div>
      <div className="flex flex-wrap items-center gap-1.5">
        {tags.map((t) => (
          <span key={t} className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-700">
            {t}
            <button onClick={() => remove(t)} className="rounded-full hover:bg-slate-200" aria-label={`Quitar ${t}`}>
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(input); } }}
          onBlur={() => input.trim() && add(input)}
          placeholder="+ etiqueta"
          className="min-w-[90px] flex-1 rounded-full border border-dashed border-slate-300 bg-white px-2 py-0.5 text-xs text-slate-700 placeholder-slate-400 focus:border-slate-500 focus:outline-none"
        />
      </div>
      {sugerencias.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {sugerencias.map((s) => (
            <button key={s} onClick={() => add(s)} className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] text-slate-400 hover:border-slate-400 hover:text-slate-700">
              + {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}


function CrearPedidoButton({
  producto, pedidos, navigate, esCanje = false,
}: {
  producto: { id: string; caracteristicasConfirmadas: boolean; pagado50: boolean };
  pedidos: { id: string }[];
  navigate: ReturnType<typeof useNavigate>;
  esCanje?: boolean;
}) {
  // Si ya hay pedido(s), muestra chips clicables
  if (pedidos.length > 0) {
    return (
      <div className="ml-auto flex flex-wrap items-center gap-1.5">
        {pedidos.map((pd, i) => (
          <button
            key={pd.id}
            onClick={() => navigate({ to: "/pedidos/$id", params: { id: pd.id } })}
            className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold text-emerald-800 hover:bg-emerald-200"
          >
            <Package className="h-3 w-3" /> {esCanje ? "Colaboración" : "Pedido"} #{i + 1}
          </button>
        ))}
      </div>
    );
  }
  // Sin confirmación → no se puede crear
  if (!producto.caracteristicasConfirmadas) {
    return (
      <span className="ml-auto text-[11px] italic text-slate-400">
        Confirma características para {esCanje ? "generar la colaboración" : "crear pedido"}
      </span>
    );
  }

  // Influencer → pedido de canje (sin pago). Confirmadas las características, se genera directo.
  if (esCanje) {
    return (
      <button
        onClick={async () => {
          const ped = await actions.crearPedido({
            productoId: producto.id,
            pagado50: false,
            pagoTodoAlFinal: false,
            creadoManualmente: true,
            esCanje: true,
          });
          if (ped) navigate({ to: "/pedidos/$id", params: { id: ped.id } });
        }}
        className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-pink-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-pink-700"
      >
        <Package className="h-3.5 w-3.5" /> Generar pedido (canje)
      </button>
    );
  }

  async function handle(manualConfirm = false) {
    if (producto.pagado50 || manualConfirm) {
      const ped = await actions.crearPedido({
        productoId: producto.id,
        pagado50: producto.pagado50,
        pagoTodoAlFinal: false,
        creadoManualmente: manualConfirm && !producto.pagado50,
      });
      if (ped) navigate({ to: "/pedidos/$id", params: { id: ped.id } });
    } else {
      if (confirm("¿Crear este pedido sin que se haya pagado el 50%? (ej. cliente de confianza o pago al final)")) {
        const ped = await actions.crearPedido({
          productoId: producto.id,
          pagado50: false,
          pagoTodoAlFinal: true,
          creadoManualmente: true,
        });
        if (ped) navigate({ to: "/pedidos/$id", params: { id: ped.id } });
      }
    }
  }

  if (producto.pagado50) {
    return (
      <button
        onClick={() => handle(false)}
        className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
      >
        <Package className="h-3.5 w-3.5" /> Crear pedido
      </button>
    );
  }
  return (
    <button
      onClick={() => handle(false)}
      className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-100"
      title="Pago 50% no marcado — pedirá confirmación"
    >
      <Package className="h-3.5 w-3.5" /> Crear pedido (sin pago)
    </button>
  );
}

function FotosSection({ leadId }: { leadId: string }) {
  const { leadFotos } = useStore();
  const fotos = leadFotos.filter((f) => f.leadId === leadId);
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    for (const f of Array.from(files)) {
      if (!f.type.startsWith("image/")) continue;
      await actions.addLeadFoto(leadId, f);
    }
    setUploading(false);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function onDelete(id: string) {
    if (!window.confirm("¿Borrar esta foto?")) return;
    await actions.deleteLeadFoto(id);
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Camera className="h-4 w-4 text-slate-500" />
          <h2 className="text-base font-semibold">Fotos</h2>
          {fotos.length > 0 && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">{fotos.length}</span>}
        </div>
        <button
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:border-slate-400 disabled:opacity-50"
        >
          <ImagePlus className="h-3.5 w-3.5" />
          {uploading ? "Subiendo..." : "Añadir foto"}
        </button>
        <input ref={inputRef} type="file" accept="image/*" multiple className="hidden" onChange={onPick} />
      </div>
      {fotos.length === 0 ? (
        <div className="py-6 text-center text-sm text-slate-400">Sin fotos. Sube capturas de DMs, referencias o medidas.</div>
      ) : (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
          {fotos.map((f) => (
            <div key={f.id} className="group relative aspect-square overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
              <img
                src={f.url}
                alt={f.pie || "Foto"}
                loading="lazy"
                onClick={() => setPreview(f.url)}
                onError={async () => { const u = await actions.refreshLeadFotoUrl(f.id); if (u && f.url !== u) {/* re-render via state */} }}
                className="h-full w-full cursor-zoom-in object-cover transition-transform group-hover:scale-105"
              />
              <button
                onClick={() => onDelete(f.id)}
                className="absolute right-1 top-1 rounded-full bg-white/90 p-1 text-slate-600 opacity-0 shadow-sm transition-opacity hover:bg-rose-50 hover:text-rose-600 group-hover:opacity-100"
                aria-label="Borrar foto"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
      {preview && (
        <div
          onClick={() => setPreview(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
        >
          <img src={preview} alt="" className="max-h-full max-w-full rounded-lg shadow-2xl" />
        </div>
      )}
    </div>
  );
}

function InfluencerPanel({ lead }: { lead: Lead }) {
  const inp = "w-full rounded border border-slate-200 px-2 py-1 text-sm focus:border-slate-400 focus:outline-none";
  return (
    <div className="rounded-xl border border-pink-200 bg-pink-50/40 p-4 shadow-sm">
      <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-pink-600">Ficha de influencer</div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-700">Nº de seguidores</label>
          <input type="number" min={0} defaultValue={lead.seguidores} key={lead.seguidores}
            onBlur={(e) => { const v = parseInt(e.target.value) || 0; if (v !== lead.seguidores) actions.updateLead(lead.id, { seguidores: v }); }}
            className={inp} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-700">Red principal</label>
          <select value={lead.redPrincipal || "Instagram"} onChange={(e) => actions.updateLead(lead.id, { redPrincipal: e.target.value })} className={inp}>
            {REDES_SOCIALES.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-700">@usuario</label>
          <input defaultValue={lead.usuario} key={lead.usuario}
            onBlur={(e) => { if (e.target.value !== lead.usuario) actions.updateLead(lead.id, { usuario: e.target.value }); }}
            className={inp} placeholder="@usuario" />
        </div>
      </div>
      <div className="mt-2 text-xs text-slate-500">Los pedidos de este influencer se registran como <strong>canje</strong> (no cuentan como ingreso).</div>
    </div>
  );
}

function B2BInfoPanel({ lead }: { lead: Lead }) {
  const inp = "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-slate-400 focus:outline-none";
  function upd(patch: Partial<Lead>) { void actions.updateLead(lead.id, patch); }
  function toggleAsignado(a: AsignadoB2B) {
    const cur = lead.asignados ?? [];
    upd({ asignados: cur.includes(a) ? cur.filter((x) => x !== a) : [...cur, a] });
  }
  return (
    <div className="rounded-xl border border-[#1a4b5b]/20 bg-[#f5fafb] p-4 shadow-sm md:p-5">
      <div className="mb-3 flex items-center gap-2">
        <span className="rounded-full bg-[#1a4b5b] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">B2B</span>
        <span className="text-sm font-semibold text-slate-800">Datos de empresa</span>
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Razón social</label>
          <input defaultValue={lead.razonSocial} key={"rs" + lead.razonSocial} onBlur={(e) => { if (e.target.value !== lead.razonSocial) upd({ razonSocial: e.target.value }); }} className={inp} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">NIF / CIF</label>
          <input defaultValue={lead.nif} key={"nif" + lead.nif} onBlur={(e) => { if (e.target.value !== lead.nif) upd({ nif: e.target.value }); }} className={inp} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Contacto (nombre)</label>
          <input defaultValue={lead.contactoNombre} key={"cn" + lead.contactoNombre} onBlur={(e) => { if (e.target.value !== lead.contactoNombre) upd({ contactoNombre: e.target.value }); }} className={inp} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Apellidos</label>
          <input defaultValue={lead.contactoApellidos} key={"ca" + lead.contactoApellidos} onBlur={(e) => { if (e.target.value !== lead.contactoApellidos) upd({ contactoApellidos: e.target.value }); }} className={inp} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Cargo</label>
          <input defaultValue={lead.contactoCargo} key={"cc" + lead.contactoCargo} onBlur={(e) => { if (e.target.value !== lead.contactoCargo) upd({ contactoCargo: e.target.value }); }} className={inp} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Web</label>
          <input defaultValue={lead.web} key={"w" + lead.web} onBlur={(e) => { if (e.target.value !== lead.web) upd({ web: e.target.value }); }} className={inp} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Instagram</label>
          <input defaultValue={lead.instagram} key={"ig" + lead.instagram} onBlur={(e) => { if (e.target.value !== lead.instagram) upd({ instagram: e.target.value }); }} className={inp} />
        </div>
        <div className="md:col-span-2">
          <label className="mb-1 block text-xs font-medium text-slate-600">Dirección</label>
          <input defaultValue={lead.direccion} key={"d" + lead.direccion} onBlur={(e) => { if (e.target.value !== lead.direccion) upd({ direccion: e.target.value }); }} className={inp} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Municipio</label>
          <input defaultValue={lead.ciudad} key={"mun" + lead.ciudad} onBlur={(e) => { if (e.target.value !== lead.ciudad) upd({ ciudad: e.target.value }); }} className={inp} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Provincia</label>
          <input defaultValue={lead.provincia} key={"prov" + lead.provincia} onBlur={(e) => { if (e.target.value !== lead.provincia) upd({ provincia: e.target.value }); }} className={inp} />
        </div>
        <div className="md:col-span-2">
          <label className="mb-1 block text-xs font-medium text-slate-600">Notas B2B</label>
          <textarea defaultValue={lead.notasB2b} key={"n" + lead.notasB2b} rows={2} onBlur={(e) => { if (e.target.value !== lead.notasB2b) upd({ notasB2b: e.target.value }); }} className={inp} />
        </div>
      </div>
      <div className="mt-4">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Asignados</div>
        <div className="flex flex-wrap gap-2">
          {ASIGNADOS_B2B.map((a) => {
            const on = (lead.asignados ?? []).includes(a);
            return (
              <button key={a} type="button" onClick={() => toggleAsignado(a)}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${on ? "border-[#1a4b5b] bg-[#1a4b5b] text-white" : "border-slate-200 bg-white text-slate-600 hover:border-slate-400"}`}>
                {a}
              </button>
            );
          })}
          {(lead.asignados ?? []).length === 0 && <span className="self-center text-xs text-slate-400">Sin asignar</span>}
        </div>
      </div>
    </div>
  );
}
