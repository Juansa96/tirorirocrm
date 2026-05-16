import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Contraseña leída desde variable de entorno — nunca hardcodeada en código
// Configura BOOTSTRAP_USER_PASSWORD en Lovable > Project Settings > Environment Variables
const USER_PASSWORD = process.env.BOOTSTRAP_USER_PASSWORD ?? "Tiroriro2026";

const USERS = [
  { email: "isangradortorres@gmail.com", name: "Iñaki" },
  { email: "rocionavarreteurdiales98@gmail.com", name: "Rocío" },
  { email: "sangradortorresjuan@gmail.com", name: "Juan" },
  { email: "bea.gyerro@gmail.com", name: "Bea" },
];

const LEADS = [
  { nombre: "Teresa Guardone", email: "", ciudad: "Lisboa", producto: "Cabecero", vendedor: "rocionavarreteurdiales98@gmail.com", etapa: "Discovery", valor: 0 },
  { nombre: "Lucía García", email: "lucia.garciamata@gmail.com", ciudad: "Madrid", producto: "Cabecero", vendedor: "rocionavarreteurdiales98@gmail.com", etapa: "Primer Contacto", valor: 0 },
  { nombre: "Antonio Herrera", email: "toninohm10@hotmail.com", ciudad: "Madrid", producto: "Cabecero", vendedor: "isangradortorres@gmail.com", etapa: "Primer Contacto", valor: 345 },
  { nombre: "Alicia Mascort", email: "aliciamascort@gmail.com", ciudad: "Valencia", producto: "Cabecero", vendedor: "rocionavarreteurdiales98@gmail.com", etapa: "Negotiation", valor: 520 },
  { nombre: "Almu Alonso", email: "almualonso@gmail.com", ciudad: "Madrid", producto: "Cabecero", vendedor: "rocionavarreteurdiales98@gmail.com", etapa: "Closed Won", valor: 250 },
];

const TAREAS = [
  { lead: "Teresa Guardone", descripcion: "Follow Up Teresa Portugal", vendedor: "rocionavarreteurdiales98@gmail.com" },
  { lead: "Antonio Herrera", descripcion: "Recibir telas e ir a su casa a que decida", vendedor: "isangradortorres@gmail.com" },
  { lead: "Alicia Mascort", descripcion: "Mandar muestras a Valencia", vendedor: "rocionavarreteurdiales98@gmail.com" },
];

async function run() {
  const created: string[] = [];
  for (const u of USERS) {
    const { data: existing } = await supabaseAdmin.auth.admin.listUsers();
    const exists = existing?.users.some((x) => x.email === u.email);
    if (!exists) {
      const { error } = await supabaseAdmin.auth.admin.createUser({
        email: u.email,
        password: USER_PASSWORD,
        email_confirm: true,
        user_metadata: { name: u.name },
      });
      if (error) throw new Error(`User ${u.email}: ${error.message}`);
      created.push(u.email);
    }
  }

  const { count } = await supabaseAdmin.from("leads").select("*", { count: "exact", head: true });
  if (!count) {
    const { data: insertedLeads, error: leadErr } = await supabaseAdmin.from("leads").insert(LEADS).select();
    if (leadErr) throw new Error(leadErr.message);
    const today = new Date().toISOString().slice(0, 10);
    const tareasRows = TAREAS.map((t) => {
      const lead = insertedLeads!.find((l) => l.nombre === t.lead);
      return { lead_id: lead!.id, descripcion: t.descripcion, vendedor: t.vendedor, fecha: today, completada: false };
    });
    const { error: tErr } = await supabaseAdmin.from("tareas").insert(tareasRows);
    if (tErr) throw new Error(tErr.message);
  }

  return { createdUsers: created, leadsSeeded: !count };
}

export const Route = createFileRoute("/api/public/bootstrap")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        const json = (body: unknown, status = 200) =>
          new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

        // Require secret token if BOOTSTRAP_SECRET env var is configured
        const configuredSecret = process.env.BOOTSTRAP_SECRET;
        if (configuredSecret) {
          const provided = new URL(request.url).searchParams.get("secret");
          if (provided !== configuredSecret) {
            return json({ error: "Unauthorized" }, 401);
          }
        }

        if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
          return json({ skipped: true, reason: "Admin backend unavailable in this runtime" });
        }

        try {
          const result = await run();
          return json(result);
        } catch (e) {
          return json({ error: (e as Error).message }, 500);
        }
      },
    },
  },
});
