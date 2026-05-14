import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Endpoint público para recibir leads desde el formulario de tirorirohome.com
// POST /api/public/lead-form
// Body JSON: { nombre, email, telefono, ciudad, mensaje, origen? }

export const Route = createFileRoute("/api/public/lead-form")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const cors = {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
          "Content-Type": "application/json",
        };

        try {
          const body = await request.json();
          const { nombre, email, telefono, ciudad, mensaje, origen } = body;

          if (!nombre || !email) {
            return new Response(JSON.stringify({ error: "nombre y email son requeridos" }), { status: 400, headers: cors });
          }

          const { data: lead, error: leadErr } = await supabaseAdmin
            .from("leads")
            .insert({
              nombre: String(nombre).trim(),
              email: String(email).trim(),
              telefono: String(telefono ?? "").trim(),
              ciudad: String(ciudad ?? "").trim(),
              producto: "Cabecero",
              vendedor: "rocionavarreteurdiales98@gmail.com",
              etapa: "Discovery",
              valor: 0,
              origen: origen ?? "Formulario web",
              red_social: "",
              fecha_hold: null,
            })
            .select()
            .single();

          if (leadErr || !lead) {
            return new Response(JSON.stringify({ error: leadErr?.message ?? "Error creando lead" }), { status: 500, headers: cors });
          }

          // Si hay mensaje, añadirlo como nota
          if (mensaje) {
            await supabaseAdmin.from("notas").insert({
              lead_id: lead.id,
              contenido: String(mensaje).trim(),
              usuario: "formulario-web",
            });
          }

          // Tarea automática de primer contacto para hoy
          const today = new Date().toISOString().slice(0, 10);
          await supabaseAdmin.from("tareas").insert({
            lead_id: lead.id,
            descripcion: `Primer contacto con ${nombre} (formulario web)`,
            fecha: today,
            hora: "",
            vendedor: "rocionavarreteurdiales98@gmail.com",
            completada: false,
          });

          return new Response(JSON.stringify({ ok: true, leadId: lead.id }), { status: 201, headers: cors });
        } catch (e) {
          return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { "Content-Type": "application/json" } });
        }
      },

      OPTIONS: async () => {
        return new Response(null, {
          status: 204,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
          },
        });
      },
    },
  },
});
