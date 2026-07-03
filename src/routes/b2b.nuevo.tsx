import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, Building2, Check } from "lucide-react";
import { toast } from "sonner";
import { actions } from "@/lib/store";
import { supabase } from "@/integrations/supabase/client";
import { ASIGNADOS_B2B, ETAPAS_B2B, VENDEDORES, vendorName, type AsignadoB2B, type EtapaB2B } from "@/lib/types";

export const Route = createFileRoute("/b2b/nuevo")({
  head: () => ({ meta: [{ title: "Nueva empresa B2B — TiroCRM" }] }),
  component: NuevaEmpresaB2B,
});

function NuevaEmpresaB2B() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    razonSocial: "",
    nif: "",
    contactoNombre: "",
    contactoApellidos: "",
    contactoCargo: "",
    direccion: "",
    telefono: "",
    email: "",
    web: "",
    instagram: "",
    notas: "",
    etapa: "Cliente potencial" as EtapaB2B,
    vendedor: "rocionavarreteurdiales98@gmail.com" as string,
  });
  const [asignados, setAsignados] = useState<AsignadoB2B[]>([]);
  const [saving, setSaving] = useState(false);

  function toggleAsignado(a: AsignadoB2B) {
    setAsignados((prev) => prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;

    const razon = form.razonSocial.trim();
    const contacto = form.contactoNombre.trim();
    const ig = form.instagram.trim();
    if (!razon && !contacto && !ig) {
      toast.error("Añade al menos razón social, nombre de contacto o Instagram.");
      return;
    }

    // Chequeo de duplicados (además del índice único que sirve de red).
    if (razon || form.nif.trim()) {
      const q = supabase.from("leads").select("id,razon_social,nif,nombre").eq("tipo", "B2B");
      const { data: existentes } = await q;
      const dup = (existentes ?? []).find((r) => {
        const rr = r as { razon_social: string | null; nif: string | null };
        if (form.nif.trim() && rr.nif && rr.nif.trim().toLowerCase() === form.nif.trim().toLowerCase()) return true;
        if (razon && rr.razon_social && rr.razon_social.trim().toLowerCase() === razon.toLowerCase() && !form.nif.trim()) return true;
        return false;
      });
      if (dup) {
        toast.error("Ya existe una empresa B2B con ese NIF o razón social.");
        return;
      }
    }

    setSaving(true);
    const nombre = razon || contacto || ig || "Sin nombre";
    const lead = await actions.addLead({
      nombre,
      email: form.email.trim(),
      telefono: form.telefono.trim(),
      ciudad: "",
      provincia: "",
      producto: "",
      vendedor: form.vendedor,
      etapa: form.etapa,
      valor: 0,
      origen: "",
      redSocial: "",
      fechaHold: "",
      valorProducto: 0,
      valorEnvio: 0,
      edad: "",
      clienteTipo: "normal",
      etiquetas: [],
      cobrado: false,
      fechaCobro: "",
      tipo: "B2B",
      razonSocial: razon,
      nif: form.nif.trim(),
      contactoNombre: contacto,
      contactoApellidos: form.contactoApellidos.trim(),
      contactoCargo: form.contactoCargo.trim(),
      direccion: form.direccion.trim(),
      web: form.web.trim(),
      instagram: ig,
      notasB2b: form.notas.trim(),
      asignados,
    });
    setSaving(false);
    if (lead) {
      toast.success("Empresa B2B creada.");
      navigate({ to: "/clientes/$id", params: { id: lead.id } });
    }
  }

  const cls = "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-slate-400 focus:outline-none";

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Link to="/b2b" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" /> Volver a B2B
      </Link>
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Building2 className="h-6 w-6 text-[#1a4b5b]" /> Nueva empresa B2B
        </h1>
        <p className="text-sm text-slate-500">Al menos uno: razón social, nombre de contacto o Instagram.</p>
      </div>

      <form onSubmit={submit} className="space-y-5 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:p-6">
        <section>
          <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Empresa</div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="mb-1 block text-xs font-medium text-slate-700">Razón social</label>
              <input value={form.razonSocial} onChange={(e) => setForm({ ...form, razonSocial: e.target.value })} className={cls} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">NIF / CIF</label>
              <input value={form.nif} onChange={(e) => setForm({ ...form, nif: e.target.value })} className={cls} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">Web</label>
              <input value={form.web} onChange={(e) => setForm({ ...form, web: e.target.value })} className={cls} placeholder="https://…" />
            </div>
            <div className="md:col-span-2">
              <label className="mb-1 block text-xs font-medium text-slate-700">Dirección</label>
              <input value={form.direccion} onChange={(e) => setForm({ ...form, direccion: e.target.value })} className={cls} />
            </div>
          </div>
        </section>

        <section>
          <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Contacto</div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">Nombre</label>
              <input value={form.contactoNombre} onChange={(e) => setForm({ ...form, contactoNombre: e.target.value })} className={cls} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">Apellidos</label>
              <input value={form.contactoApellidos} onChange={(e) => setForm({ ...form, contactoApellidos: e.target.value })} className={cls} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">Cargo</label>
              <input value={form.contactoCargo} onChange={(e) => setForm({ ...form, contactoCargo: e.target.value })} className={cls} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">Teléfono</label>
              <input value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} className={cls} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">Email</label>
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={cls} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">Instagram</label>
              <input value={form.instagram} onChange={(e) => setForm({ ...form, instagram: e.target.value })} className={cls} placeholder="@empresa" />
            </div>
          </div>
        </section>

        <section>
          <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Pipeline</div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">Etapa</label>
              <select value={form.etapa} onChange={(e) => setForm({ ...form, etapa: e.target.value as EtapaB2B })} className={cls}>
                {ETAPAS_B2B.map((e) => <option key={e} value={e}>{e}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">Vendedor responsable</label>
              <select value={form.vendedor} onChange={(e) => setForm({ ...form, vendedor: e.target.value })} className={cls}>
                {VENDEDORES.map((v) => <option key={v} value={v}>{vendorName(v)}</option>)}
              </select>
            </div>
          </div>
        </section>

        <section>
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Asignados</div>
          <div className="flex flex-wrap gap-2">
            {ASIGNADOS_B2B.map((a) => {
              const on = asignados.includes(a);
              return (
                <button key={a} type="button" onClick={() => toggleAsignado(a)}
                  className={`inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-medium ${on ? "border-[#1a4b5b] bg-[#1a4b5b] text-white" : "border-slate-200 bg-white text-slate-600 hover:border-slate-400"}`}>
                  {on && <Check className="h-3 w-3" />} {a}
                </button>
              );
            })}
          </div>
          {asignados.length === 0 && <p className="mt-2 text-xs text-slate-400">Sin asignar (opcional)</p>}
        </section>

        <section>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">Notas</label>
          <textarea value={form.notas} onChange={(e) => setForm({ ...form, notas: e.target.value })} rows={3} className={cls} />
        </section>

        <div className="flex justify-end gap-2 pt-2">
          <Link to="/b2b" className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Cancelar</Link>
          <button type="submit" disabled={saving} className="rounded-lg bg-[#1a4b5b] px-4 py-2 text-sm font-medium text-white hover:bg-[#245e73] disabled:opacity-60">
            {saving ? "Creando…" : "Crear empresa"}
          </button>
        </div>
      </form>
    </div>
  );
}
