import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { actions } from "@/lib/store";
import { VENDEDORES, ETAPAS, vendorName, type Etapa } from "@/lib/types";
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
    vendedor: "rocio@tiroriro.com" as string,
    etapa: "Discovery" as Etapa,
    valor: 0,
  });
  const [tarea, setTarea] = useState({ descripcion: "", fecha: todayISO() });
  const [submitting, setSubmitting] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.nombre.trim() || submitting) return;
    setSubmitting(true);
    const lead = await actions.addLead(form, tarea.descripcion.trim() ? tarea : undefined);
    setSubmitting(false);
    if (lead) navigate({ to: "/clientes/$id", params: { id: lead.id } });
  }

  const inputCls =
    "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-slate-400 focus:outline-none";

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Link to="/clientes" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" /> Volver
      </Link>
      <div>
        <h1 className="text-2xl font-bold">Nuevo Lead</h1>
        <p className="text-sm text-slate-500">Crea un nuevo cliente potencial</p>
      </div>

      <form onSubmit={submit} className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:p-6">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-700">
            Nombre completo <span className="text-red-500">*</span>
          </label>
          <input required value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} className={inputCls} />
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">Email</label>
            <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={inputCls} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">Teléfono</label>
            <input value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} className={inputCls} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">Ciudad</label>
            <input value={form.ciudad} onChange={(e) => setForm({ ...form, ciudad: e.target.value })} className={inputCls} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">Producto / Interés</label>
            <input list="productos-list" value={form.producto} onChange={(e) => setForm({ ...form, producto: e.target.value })} className={inputCls} />
            <datalist id="productos-list">
              <option value="Cabecero" />
              <option value="Tela" />
              <option value="Manta" />
              <option value="Otro" />
            </datalist>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">Vendedor asignado</label>
            <select value={form.vendedor} onChange={(e) => setForm({ ...form, vendedor: e.target.value })} className={inputCls}>
              {VENDEDORES.map((v) => (
                <option key={v} value={v}>{vendorName(v)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">Etapa inicial</label>
            <select value={form.etapa} onChange={(e) => setForm({ ...form, etapa: e.target.value as Etapa })} className={inputCls}>
              {ETAPAS.map((e) => (
                <option key={e} value={e}>{e}</option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="mb-1 block text-xs font-medium text-slate-700">Valor estimado (€)</label>
            <input type="number" min={0} value={form.valor} onChange={(e) => setForm({ ...form, valor: parseFloat(e.target.value) || 0 })} className={inputCls} />
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Primera tarea (opcional)</div>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
            <input placeholder="Descripción" value={tarea.descripcion} onChange={(e) => setTarea({ ...tarea, descripcion: e.target.value })} className={`${inputCls} md:col-span-2`} />
            <input type="date" value={tarea.fecha} onChange={(e) => setTarea({ ...tarea, fecha: e.target.value })} className={inputCls} />
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
