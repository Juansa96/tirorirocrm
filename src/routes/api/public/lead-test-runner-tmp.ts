// TEMPORAL — se elimina al cerrar la Fase B. Ejecuta P1/P2/P3 contra
// /api/public/lead-form con LEAD_FORM_API_KEY_TEST y devuelve resultados
// + filas creadas. No expone la clave en ninguna respuesta.
import { createFileRoute } from "@tanstack/react-router";

const P1 = {
  nombre: "TEST_P1_LEGACY",
  email: "test-p1@tirorirocrm.invalid",
  telefono: "600000001",
  ciudad: "Madrid",
  mensaje: "Prueba P1 formato antiguo",
  configurador: {
    tipo: "cabecero",
    modelo: "Ithaka",
    ancho: 160,
    alto: 120,
    tela: "Lino natural",
    color: "beige",
    relleno: "espuma",
    patas: "sin patas",
    acabado: "vivo-simple",
    cantidad: 1,
    precio_unitario: 385,
  },
};

const P2 = {
  nombre: "TEST_P2_NUEVO",
  email: "test-p2@tirorirocrm.invalid",
  telefono: "600000002",
  ciudad: "Bilbao",
  mensaje: "Prueba P2 formato nuevo con extras",
  productos: [
    {
      tipo: "puf",
      modelo: "Puf redondo pequeño",
      ancho: 60,
      alto: 40,
      tela: "Bouclé arena",
      cantidad: 1,
      precio_unitario: 165,
      config: {
        forma: "redondo",
        altura_cm: 40,
        grosor_cm: 15,
        vivo: "doble",
        tela_categoria: "premium",
        extras: ["cremallera", "funda extraible"],
        resumen: "Puf redondo Bouclé arena 60x40 vivo doble",
        desglose_precio: { base: 150, tela: 10, extras: 5 },
        campo_inventado_1: "foo",
        campo_inventado_2: { anidado: true, valor: 42 },
      },
    },
  ],
  valor_envio: 40,
};

const P3 = {
  nombre: "TEST_P3_SOFA",
  email: "test-p3@tirorirocrm.invalid",
  telefono: "600000003",
  ciudad: "Sevilla",
  mensaje: "Prueba P3 tipo desconocido",
  productos: [
    {
      tipo: "sofa",
      modelo: "Chester 3 plazas",
      cantidad: 1,
      precio_unitario: 1200,
    },
  ],
};

export const Route = createFileRoute("/api/public/lead-test-runner-tmp")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const key = process.env.LEAD_FORM_API_KEY_TEST;
        if (!key) {
          return new Response(JSON.stringify({ error: "test key not configured" }), { status: 503, headers: { "Content-Type": "application/json" } });
        }
        const origin = new URL(request.url).origin;
        const endpoint = `${origin}/api/public/lead-form`;

        const run = async (label: string, payload: unknown) => {
          const res = await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-Api-Key": key },
            body: JSON.stringify(payload),
          });
          const text = await res.text();
          let body: unknown;
          try { body = JSON.parse(text); } catch { body = text; }
          return { label, status: res.status, body };
        };

        const results = [
          await run("P1", P1),
          await run("P2", P2),
          await run("P3", P3),
        ];

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const leadIds = results
          .map(r => (r.body as { leadId?: string } | null)?.leadId)
          .filter((x): x is string => typeof x === "string");

        const [leads, productos, notas, counts] = await Promise.all([
          leadIds.length ? supabaseAdmin.from("leads").select("*").in("id", leadIds) : Promise.resolve({ data: [] }),
          leadIds.length ? supabaseAdmin.from("productos_lead").select("*").in("lead_id", leadIds) : Promise.resolve({ data: [] }),
          leadIds.length ? supabaseAdmin.from("notas").select("*").in("lead_id", leadIds) : Promise.resolve({ data: [] }),
          (async () => {
            const [l, p, pe, n, t] = await Promise.all([
              supabaseAdmin.from("leads").select("id", { count: "exact", head: true }),
              supabaseAdmin.from("productos_lead").select("id", { count: "exact", head: true }),
              supabaseAdmin.from("pedidos").select("id", { count: "exact", head: true }),
              supabaseAdmin.from("notas").select("id", { count: "exact", head: true }),
              supabaseAdmin.from("tareas").select("id", { count: "exact", head: true }),
            ]);
            return { leads: l.count, productos_lead: p.count, pedidos: pe.count, notas: n.count, tareas: t.count };
          })(),
        ]);

        return new Response(JSON.stringify({
          payloads: { P1, P2, P3 },
          results,
          rows: {
            leads: (leads as { data: unknown }).data,
            productos_lead: (productos as { data: unknown }).data,
            notas: (notas as { data: unknown }).data,
          },
          counts,
          leadIds,
        }, null, 2), { status: 200, headers: { "Content-Type": "application/json" } });
      },
    },
  },
});
