import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { VENDEDORES } from "@/lib/types";
import { buildProducto } from "@/lib/product-schema";

function randomVendedor(): string {
  return VENDEDORES[Math.floor(Math.random() * VENDEDORES.length)];
}

function sanitize(val: unknown, maxLen = 200): string {
  if (val === null || val === undefined) return "";
  return String(val).trim().slice(0, maxLen);
}

export const Route = createFileRoute("/api/public/lead-form")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const configuredApiKey = process.env.LEAD_FORM_API_KEY;
        const cors = {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, X-Api-Key",
          "Content-Type": "application/json",
        };
        const json = (body: unknown, status = 200) =>
          new Response(JSON.stringify(body), { status, headers: cors });

        // Require API key if LEAD_FORM_API_KEY env var is configured
        if (configuredApiKey) {
          const providedKey = request.headers.get("x-api-key");
          if (providedKey !== configuredApiKey) {
            return json({ error: "Unauthorized" }, 401);
          }
        }

        try {
          const body = await request.json().catch(() => null);
          if (!body || typeof body !== "object") return json({ error: "Invalid JSON body" }, 400);

          const { nombre, email, telefono, ciudad, mensaje, origen, configurador } = body as Record<string, unknown>;
          const nombreClean = sanitize(nombre);
          const emailClean = sanitize(email, 254);

          if (!nombreClean || !emailClean) return json({ error: "nombre y email son requeridos" }, 400);
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailClean)) return json({ error: "email inválido" }, 400);

          const vendedor = randomVendedor();
          const tipoProducto = typeof configurador === "object" && configurador !== null && "tipo" in configurador
            ? (({ cabecero: "Cabecero", banco: "Banco", cojin: "Almohadón", puf: "Puf", mesa: "Mesa de centro", pantalla: "Pantalla de lámpara" } as Record<string, string>)[(configurador as Record<string, unknown>).tipo as string] ?? "Cabecero")
            : "Cabecero";

          // Precio del configurador (si el cliente venía del configurador con precio calculado)
          const precioProducto = typeof configurador === "object" && configurador !== null
            ? Math.max(0, Number((configurador as Record<string, unknown>).precio) || 0)
            : 0;

          const { data: lead, error: leadErr } = await supabaseAdmin.from("leads").insert({
            nombre: nombreClean,
            email: emailClean,
            telefono: sanitize(telefono, 20),
            ciudad: sanitize(ciudad, 100),
            producto: tipoProducto,
            vendedor,
            etapa: "Discovery",
            valor: precioProducto,
            valor_producto: precioProducto,
            valor_envio: 0,
            origen: sanitize(origen, 50) || "Formulario web",
            red_social: "",
            fecha_hold: null,
          }).select().single();

          if (leadErr || !lead) return json({ error: leadErr?.message ?? "Error creando lead" }, 500);

          if (mensaje) {
            await supabaseAdmin.from("notas").insert({ lead_id: lead.id, contenido: sanitize(mensaje, 2000), usuario: "formulario-web" });
          }

          if (configurador && typeof configurador === "object") {
            const producto = buildProducto(configurador as Record<string, string>);
            if (producto) await supabaseAdmin.from("productos_lead").insert({
              lead_id: lead.id,
              ...producto,
              precio_unitario: precioProducto,
            });
          }

          const today = new Date().toISOString().slice(0, 10);
          await supabaseAdmin.from("tareas").insert({
            lead_id: lead.id,
            descripcion: `Primer contacto con ${nombreClean} (formulario web)`,
            fecha: today, hora: "", vendedor, completada: false,
          });

          return json({ ok: true, leadId: lead.id }, 201);
        } catch (e) {
          return json({ error: (e as Error).message }, 500);
        }
      },

      OPTIONS: async () => new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, X-Api-Key",
        },
      }),
    },
  },
});
