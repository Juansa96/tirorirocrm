import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const USERS = [
  { email: "inaki@tiroriro.com", password: "Tiroriro2026", name: "Iñaki" },
  { email: "rocio@tiroriro.com", password: "Tiroriro2026", name: "Rocío" },
  { email: "juan@tiroriro.com", password: "Tiroriro2026", name: "Juan" },
  { email: "bea@tiroriro.com", password: "Tiroriro2026", name: "Bea" },
];

const LEADS = [
  { nombre: "Teresa Guardone", email: "", ciudad: "Lisboa", producto: "Cabecero", vendedor: "rocio@tiroriro.com", etapa: "Discovery", valor: 0 },
  { nombre: "Lucía García", email: "lucia.garciamata@gmail.com", ciudad: "Madrid", producto: "Cabecero", vendedor: "rocio@tiroriro.com", etapa: "Llamada", valor: 0 },
  { nombre: "Antonio Herrera", email: "toninohm10@hotmail.com", ciudad: "Madrid", producto: "Cabecero", vendedor: "inaki@tiroriro.com", etapa: "Llamada", valor: 345 },
  { nombre: "Alicia Mascort", email: "aliciamascort@gmail.com", ciudad: "Valencia", producto: "Cabecero", vendedor: "rocio@tiroriro.com", etapa: "Proposal", valor: 520 },
  { nombre: "Almu Alonso", email: "almualonso@gmail.com", ciudad: "Madrid", producto: "Cabecero", vendedor: "rocio@tiroriro.com", etapa: "Closed Won", valor: 250 },
];

const TAREAS = [
  { lead: "Teresa Guardone", descripcion: "Follow Up Teresa Portugal", vendedor: "rocio@tiroriro.com" },
  { lead: "Antonio Herrera", descripcion: "Recibir telas e ir a su casa a que decida", vendedor: "inaki@tiroriro.com" },
  { lead: "Alicia Mascort", descripcion: "Mandar muestras a Valencia", vendedor: "rocio@tiroriro.com" },
];

async function run() {
  const created: string[] = [];
  // Create users
  for (const u of USERS) {
    const { data: existing } = await supabaseAdmin.auth.admin.listUsers();
    const exists = existing?.users.some((x) => x.email === u.email);
    if (!exists) {
      const { error } = await supabaseAdmin.auth.admin.createUser({
        email: u.email,
        password: u.password,
        email_confirm: true,
        user_metadata: { name: u.name },
      });
      if (error) throw new Error(`User ${u.email}: ${error.message}`);
      created.push(u.email);
    }
  }

  // Seed leads if empty
  const { count } = await supabaseAdmin.from("leads").select("*", { count: "exact", head: true });
  if (!count) {
    const { data: insertedLeads, error: leadErr } = await supabaseAdmin
      .from("leads")
      .insert(LEADS)
      .select();
    if (leadErr) throw new Error(leadErr.message);
    const today = new Date().toISOString().slice(0, 10);
    const tareasRows = TAREAS.map((t) => {
      const lead = insertedLeads!.find((l) => l.nombre === t.lead);
      return {
        lead_id: lead!.id,
        descripcion: t.descripcion,
        vendedor: t.vendedor,
        fecha: today,
        completada: false,
      };
    });
    const { error: tErr } = await supabaseAdmin.from("tareas").insert(tareasRows);
    if (tErr) throw new Error(tErr.message);
  }

  return { createdUsers: created, leadsSeeded: !count };
}

export const Route = createFileRoute("/api/public/bootstrap")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const result = await run();
          return new Response(JSON.stringify(result), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        } catch (e) {
          return new Response(JSON.stringify({ error: (e as Error).message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
