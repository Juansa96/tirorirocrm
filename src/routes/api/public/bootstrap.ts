import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

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

async function run(userPassword: string) {
  const created: string[] = [];
  for (const u of USERS) {
    const { data: existing } = await supabaseAdmin.auth.admin.listUsers();
    const exists = existing?.users.some((x) => x.email === u.email);
    if (!exists) {
      const { error } = await supabaseAdmin.auth.admin.createUser({
        email: u.email,
        password: userPassword,
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

        // Secret is MANDATORY. If missing in the environment, the endpoint is closed.
        const configuredSecret = process.env.BOOTSTRAP_SECRET;
        if (!configuredSecret) {
          return json({ error: "Endpoint not configured" }, 503);
        }
        // Read the secret from a header, not the URL (URLs leak via logs / Referer / history).
        const provided = request.headers.get("x-bootstrap-secret");
        if (provided !== configuredSecret) {
          return json({ error: "Unauthorized" }, 401);
        }

        // User password is also mandatory — never fall back to a hardcoded value.
        const userPassword = process.env.BOOTSTRAP_USER_PASSWORD;
        if (!userPassword) {
          return json({ error: "Endpoint not configured" }, 503);
        }

        if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
          return json({ skipped: true, reason: "Admin backend unavailable in this runtime" });
        }

        try {
          const result = await run(userPassword);
          return json(result);
        } catch (e) {
          console.error("[bootstrap] unhandled error:", e);
          return json({ error: "Internal server error" }, 500);
        }
      },
    },
  },
});
