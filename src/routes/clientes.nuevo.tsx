import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { actions } from "@/lib/store";
import { VENDEDORES, ETAPAS, ORIGENES, vendorName, type Etapa } from "@/lib/types";
import { todayISO } from "@/lib/format";

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
    producto: "Cabecero",
    vendedor: "rocionavarreteurdiales98@gmail.com" as string,
    etapa: "Discovery" as Etapa,
    valor: 0,
    origen: "" as string,
    redSocial: "",
    fechaHold: "",
  });
  const [tarea, setTarea] = useState({ descripcion: "", fecha: todayISO(), hora: "" });
  const [submitting, setSubmitting] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.nombre.trim() || submitting) return;
    if (form.etapa === "On Hold" && !form.fechaHold) {
      alert("La etapa 'On Hold' requiere una fecha concreta");
      return;
    }
    setSubmitting(true);
    const lead = await actions.addLead(form, tarea.descripcion.trim() ? tarea : undefined);
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
              <input value={form.ciudad} onChange={e => setForm({...form, ciudad: e.target.value})} className={cls} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">Red social / usuario</label>
              <input value={form.redSocial} onChange={e => setForm({...form, redSocial: e.target.value})} className={cls} placeholder="@usuario, perfil de IG..." />
            </div>
          </div>
        </div>

        {/* Origen */}
        <div>
          <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Origen del lead</div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {ORIGENES.map(o => (
              <button
                key={o}
                type="button"
                onClick={() => setForm({...form, origen: o})}
                className={`rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
                  form.origen === o
                    ? "border-[#1a1f36] bg-[#1a1f36] text-white"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-400"
                }`}
              >
                {o}
              </button>
            ))}
          </div>
        </div>

        {/* CRM */}
        <div>
          <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Pipeline</div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">Producto / Interés</label>
              <input list="productos-list" value={form.producto} onChange={e => setForm({...form, producto: e.target.value})} className={cls} />
              <datalist id="productos-list">
                <option value="Cabecero" /><option value="Tela" /><option value="Manta" /><option value="Otro" />
              </datalist>
            </div>
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
            <div className={form.etapa === "On Hold" ? "" : "md:col-span-2"}>
              <label className="mb-1 block text-xs font-medium text-slate-700">Valor estimado (€)</label>
              <input type="number" min={0} value={form.valor} onChange={e => setForm({...form, valor: parseFloat(e.target.value) || 0})} className={cls} />
            </div>
          </div>
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
          <button type="submit" disabled={submitting} className="rounded-lg bg-[#1a1f36] px-4 py-2 text-sm font-medium text-white hover:bg-[#2a2f46] disabled:opacity-60">
            {submitting ? "Creando…" : "Crear lead"}
          </button>
        </div>
      </form>
    </div>
  );
}
