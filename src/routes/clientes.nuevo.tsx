import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, Plus, Check } from "lucide-react";
import { actions } from "@/lib/store";
import { VENDEDORES, ETAPAS, ORIGENES, RANGOS_EDAD, vendorName, type Etapa } from "@/lib/types";
import { todayISO, defaultEnvio, isMadrid } from "@/lib/format";
import { ProductoForm, EMPTY_PROD_STATE } from "@/components/ProductoForm";
import { FormaBadge } from "@/components/FormaBadge";
import type { Producto } from "@/lib/types";

export const Route = createFileRoute("/clientes/nuevo")({
  head: () => ({ meta: [{ title: "Nuevo Lead — TiroCRM" }] }),
  component: NuevoLead,
});

function NuevoLead() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    nombre: "",
    email: "",
    telefono: "",
    ciudad: "",
    vendedor: "rocionavarreteurdiales98@gmail.com" as string,
    etapa: "Discovery" as Etapa,
    valorProducto: 0,
    valorEnvio: 0,
    origen: "" as string,
    redSocial: "",
    fechaHold: "",
    edad: "",
  });
  const [envioTouched, setEnvioTouched] = useState(false);
  const [tarea, setTarea] = useState({ descripcion: "", fecha: todayISO(), hora: "" });
  const [prodState, setProdState] = useState<Omit<Producto, "id" | "leadId" | "createdAt" | "createdBy"> | null>(null);
  const [showProdForm, setShowProdForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  function onCiudadChange(v: string) {
    setForm(prev => ({
      ...prev,
      ciudad: v,
      valorEnvio: envioTouched ? prev.valorEnvio : defaultEnvio(v),
    }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.nombre.trim() || submitting) return;
    if (form.etapa === "On Hold" && !form.fechaHold) {
      alert("La etapa 'On Hold' requiere una fecha concreta");
      return;
    }
    setSubmitting(true);
    const tipoLabel = prodState
      ? ({ cabecero: "Cabecero", banco: "Banco", cojin: "Almohadón", almohadon: "Almohadón", puf: "Puf", mesa: "Mesa de centro", pantalla: "Pantalla de lámpara", otro: "Otro" } as Record<string, string>)[prodState.tipo] ?? prodState.tipo
      : "Cabecero";
    const lead = await actions.addLead(
      { ...form, producto: tipoLabel, valor: form.valorProducto + form.valorEnvio },
      tarea.descripcion.trim() ? tarea : undefined,
    );
    if (lead && prodState) {
      await actions.addProducto(lead.id, prodState);
    }
    setSubmitting(false);
    if (lead) navigate({ to: "/clientes/$id", params: { id: lead.id } });
  }

  const cls = "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-slate-400 focus:outline-none";

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Link to="/clientes" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" /> Volver
      </Link>
      <div>
        <h1 className="text-2xl font-bold">Nuevo Lead</h1>
        <p className="text-sm text-slate-500">Crea un nuevo cliente potencial</p>
      </div>

      <form onSubmit={submit} className="space-y-5 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:p-6">

        {/* Datos personales */}
        <div>
          <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Datos del cliente</div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="mb-1 block text-xs font-medium text-slate-700">Nombre completo <span className="text-red-500">*</span></label>
              <input required value={form.nombre} onChange={e => setForm({...form, nombre: e.target.value})} className={cls} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">Email</label>
              <input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} className={cls} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">Teléfono</label>
              <input value={form.telefono} onChange={e => setForm({...form, telefono: e.target.value})} className={cls} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">Ciudad</label>
              <input value={form.ciudad} onChange={e => onCiudadChange(e.target.value)} className={cls} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">Red social / usuario</label>
              <input value={form.redSocial} onChange={e => setForm({...form, redSocial: e.target.value})} className={cls} placeholder="@usuario, perfil de IG..." />
            </div>
            <div className="md:col-span-2">
              <label className="mb-1 block text-xs font-medium text-slate-700">Rango de edad</label>
              <div className="flex flex-wrap gap-2">
                {RANGOS_EDAD.map(r => {
                  const selected = form.edad === r;
                  return (
                    <button key={r} type="button"
                      aria-pressed={selected}
                      onClick={() => setForm({...form, edad: selected ? "" : r})}
                      className={`inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${selected ? "border-[#1a1f36] bg-[#1a1f36] text-white shadow-sm ring-2 ring-[#1a1f36]/20" : "border-slate-200 bg-white text-slate-600 hover:border-slate-400"}`}>
                      {selected && <Check className="h-3 w-3" />}
                      {r}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Origen */}
        <div>
          <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Origen del lead</div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {ORIGENES.map(o => (
              <button key={o} type="button" onClick={() => setForm({...form, origen: o})}
                className={`rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${form.origen === o ? "border-[#1a1f36] bg-[#1a1f36] text-white" : "border-slate-200 bg-white text-slate-600 hover:border-slate-400"}`}>
                {o}
              </button>
            ))}
          </div>
        </div>

        {/* Pipeline */}
        <div>
          <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Pipeline</div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">Vendedor asignado</label>
              <select value={form.vendedor} onChange={e => setForm({...form, vendedor: e.target.value})} className={cls}>
                {VENDEDORES.map(v => <option key={v} value={v}>{vendorName(v)}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">Etapa inicial</label>
              <select value={form.etapa} onChange={e => setForm({...form, etapa: e.target.value as Etapa, fechaHold: ""})} className={cls}>
                {ETAPAS.map(e => <option key={e} value={e}>{e}</option>)}
              </select>
            </div>
            {form.etapa === "On Hold" && (
              <div>
                <label className="mb-1 block text-xs font-medium text-red-600">Fecha de On Hold <span className="text-red-500">*</span></label>
                <input type="date" required value={form.fechaHold} onChange={e => setForm({...form, fechaHold: e.target.value})} className={`${cls} border-red-200 focus:border-red-400`} />
              </div>
            )}
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">Valor producto (€)</label>
              <input type="number" min={0} value={form.valorProducto} onChange={e => setForm({...form, valorProducto: parseFloat(e.target.value) || 0})} className={cls} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">
                Valor envío (€)
                <span className="ml-1 font-normal text-slate-400">
                  · {form.ciudad ? (isMadrid(form.ciudad) ? "Madrid 40€" : "Fuera de Madrid — a consultar (mín. 60€)") : "Madrid 40€ · fuera mín. 60€ a consultar"}
                </span>
              </label>
              <input type="number" min={0} value={form.valorEnvio}
                onChange={e => { setEnvioTouched(true); setForm({...form, valorEnvio: parseFloat(e.target.value) || 0}); }}
                className={cls} />
            </div>
          </div>
        </div>

        {/* Producto */}
        <div>
          <div className="mb-3 flex items-center justify-between">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Producto (opcional)</div>
            {!showProdForm && !prodState && (
              <button type="button" onClick={() => setShowProdForm(true)}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:border-slate-400">
                <Plus className="h-3.5 w-3.5" /> Añadir producto
              </button>
            )}
          </div>
          {showProdForm && (
            <ProductoForm
              initial={EMPTY_PROD_STATE}
              onSave={p => { setProdState(p); setShowProdForm(false); }}
              onCancel={() => setShowProdForm(false)}
            />
          )}
          {prodState && !showProdForm && (
            <div className="flex items-center justify-between gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm">
              <span className="flex flex-wrap items-center gap-1.5 font-medium text-emerald-800">
                <span>{prodState.tipo} {prodState.modelo ? `— ${prodState.modelo}` : ""}{prodState.tela ? ` · ${prodState.tela}` : ""}</span>
                <FormaBadge modelo={prodState.modelo} />
              </span>
              <button type="button" onClick={() => setProdState(null)} className="text-xs text-slate-500 hover:text-red-600">Quitar</button>
            </div>
          )}
        </div>

        {/* Primera tarea */}
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Primera tarea (opcional)</div>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_auto_auto]">
            <input placeholder="Descripción de la tarea" value={tarea.descripcion} onChange={e => setTarea({...tarea, descripcion: e.target.value})} className={cls} />
            <input type="date" value={tarea.fecha} onChange={e => setTarea({...tarea, fecha: e.target.value})} className={cls} />
            <input type="time" value={tarea.hora} onChange={e => setTarea({...tarea, hora: e.target.value})} className={cls} />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Link to="/clientes" className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Cancelar</Link>
          <button type="submit" disabled={submitting || showProdForm} className="rounded-lg bg-[#1a1f36] px-4 py-2 text-sm font-medium text-white hover:bg-[#2a2f46] disabled:opacity-60">
            {submitting ? "Creando…" : "Crear lead"}
          </button>
        </div>
      </form>
    </div>
  );
}
