import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
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

const productoSchema = z.object({
  tipo: z.string().max(50).optional(),
  precio: z.coerce.number().min(0).max(1_000_000).optional(),
  cantidad: z.coerce.number().int().min(1).max(999).optional(),
}).passthrough();

const bodySchema = z.object({
  nombre: z.string().trim().min(1).max(200),
  email: z.string().trim().email().max(254),
  telefono: z.string().trim().max(20).optional().default(""),
  ciudad: z.string().trim().max(100).optional().default(""),
  mensaje: z.string().trim().max(2000).optional().default(""),
  origen: z.string().trim().max(50).optional().default(""),
  valor_envio: z.coerce.number().min(0).max(100_000).optional(),
  productos: z.array(productoSchema).max(50).optional(),
  configurador: productoSchema.optional(),
});

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

        // API key is mandatory to prevent anonymous lead spam.
        if (!configuredApiKey) {
          console.error("LEAD_FORM_API_KEY not configured; rejecting public submission");
          return json({ error: "Endpoint not configured" }, 503);
        }
        const providedKey = request.headers.get("x-api-key");
        if (providedKey !== configuredApiKey) {
          return json({ error: "Unauthorized" }, 401);
        }

        try {
          const raw = await request.json().catch(() => null);
          const parsed = bodySchema.safeParse(raw);
          if (!parsed.success) {
            return json({ error: "Datos inválidos", issues: parsed.error.flatten() }, 400);
          }
          const { nombre, email, telefono, ciudad, mensaje, origen, configurador, productos, valor_envio } = parsed.data;
          const nombreClean = sanitize(nombre);
          const emailClean = sanitize(email, 254);

          const vendedor = randomVendedor();

          // Build the list of product configs to insert.
          // Accept either `productos: [...]` (new, supports multiple) or legacy `configurador: {...}` (single).
          type ProdConfig = { config: Record<string, unknown>; precio: number; cantidad: number };
          const rawList: unknown[] = Array.isArray(productos)
            ? productos
            : (configurador && typeof configurador === "object" ? [configurador] : []);

          const prodConfigs: ProdConfig[] = rawList
            .filter((p): p is Record<string, unknown> => p !== null && typeof p === "object")
            .map((p) => {
              // Each item can be either the raw config (legacy) or { ...config, precio, cantidad }
              const precio = Math.max(0, Number(p.precio) || 0);
              const cantidad = Math.max(1, Math.floor(Number(p.cantidad) || 1));
              return { config: p, precio, cantidad };
            });

          const primerTipo = prodConfigs[0]?.config?.tipo as string | undefined;
          const tipoProducto = primerTipo
            ? (({ cabecero: "Cabecero", banco: "Banco", cojin: "Almohadón", puf: "Puf", mesa: "Mesa de centro", pantalla: "Pantalla de lámpara" } as Record<string, string>)[primerTipo] ?? "Cabecero")
            : "Cabecero";

          const totalProductos = prodConfigs.reduce((acc, p) => acc + p.precio * p.cantidad, 0);
          const envioNum = Math.max(0, Number(valor_envio) || 0);

          const { data: lead, error: leadErr } = await supabaseAdmin.from("leads").insert({
            nombre: nombreClean,
            email: emailClean,
            telefono: sanitize(telefono, 20),
            ciudad: sanitize(ciudad, 100),
            producto: tipoProducto,
            vendedor,
            etapa: "Discovery",
            valor: totalProductos + envioNum,
            valor_producto: totalProductos,
            valor_envio: envioNum,
            origen: sanitize(origen, 50) || "Formulario web",
            red_social: "",
            fecha_hold: null,
          }).select().single();

          if (leadErr || !lead) return json({ error: leadErr?.message ?? "Error creando lead" }, 500);

          if (mensaje) {
            await supabaseAdmin.from("notas").insert({ lead_id: lead.id, contenido: sanitize(mensaje, 2000), usuario: "formulario-web" });
          }

          for (const { config, precio, cantidad } of prodConfigs) {
            const producto = buildProducto(config as Record<string, string>);
            if (producto) {
              await supabaseAdmin.from("productos_lead").insert({
                lead_id: lead.id,
                ...producto,
                precio_unitario: precio,
                cantidad,
              });
            }
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
