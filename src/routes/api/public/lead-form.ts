import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

import { buildProducto } from "@/lib/product-schema";
import { TIPO_LABEL, normalizeTipo, esColeccionTelaInvalida, esVarianteBancoInvalida } from "@/lib/catalogo";

// Todos los leads del formulario web se asignan a Rocío por defecto.
// El vendedor se puede reasignar manualmente desde la ficha del lead.
const DEFAULT_VENDEDOR = "rocionavarreteurdiales98@gmail.com";


function sanitize(val: unknown, maxLen = 200): string {
  if (val === null || val === undefined) return "";
  return String(val).trim().slice(0, maxLen);
}

// Objeto `config` que el configurador web envía con toda la configuración
// (sección 7.3). Se guarda íntegro en productos_lead.config_json.
const configSchema = z.object({
  forma: z.string().max(50).optional(),
  altura_cm: z.coerce.number().optional(),
  grosor_cm: z.coerce.number().optional(),
  vivo: z.string().max(30).optional(),
  tela_categoria: z.string().max(30).optional(),
  extras: z.array(z.string().max(200)).max(50).optional(),
  resumen: z.string().max(2000).optional(),
  desglose_precio: z.record(z.string(), z.union([z.number(), z.string(), z.null()])).optional(),
}).passthrough();

// Schema por producto (contrato sección 7.2). `.passthrough()` para no
// perder ningún campo desconocido: acaba en config_json.extras_no_mapeados.
const productoSchema = z.object({
  tipo: z.string().max(50).optional(),
  modelo: z.string().max(200).optional(),
  ancho: z.coerce.number().min(0).max(500).optional(),
  alto: z.coerce.number().min(0).max(500).optional(),
  fondo: z.coerce.number().min(0).max(500).optional(),
  tela: z.string().max(200).optional(),
  coleccion_tela: z.string().max(30).optional(),
  color: z.string().max(200).optional(),
  relleno: z.string().max(200).optional(),
  patas: z.string().max(200).optional(),
  acabado: z.string().max(30).optional(),
  cantidad: z.coerce.number().int().min(1).max(999).optional(),
  precio_unitario: z.coerce.number().min(0).max(1_000_000).optional(),
  precio: z.coerce.number().min(0).max(1_000_000).optional(), // alias legacy
  notas_producto: z.string().max(1000).optional(),
  config: configSchema.optional(),
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
}).passthrough();

// Campos "conocidos" a nivel de producto — todo lo demás va a extras_no_mapeados.
const KNOWN_PRODUCT_KEYS = new Set([
  "tipo","modelo","ancho","alto","fondo","tela","coleccion_tela","color","relleno",
  "patas","acabado","cantidad","precio_unitario","precio","notas_producto","config",
]);

function buildConfigJson(rawProduct: Record<string, unknown>): Record<string, unknown> | null {
  const config = (rawProduct.config && typeof rawProduct.config === "object")
    ? { ...(rawProduct.config as Record<string, unknown>) }
    : {};
  const extras: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(rawProduct)) {
    if (!KNOWN_PRODUCT_KEYS.has(k)) extras[k] = v;
  }
  const out: Record<string, unknown> = { ...config };
  if (Object.keys(extras).length > 0) out.extras_no_mapeados = extras;
  return Object.keys(out).length > 0 ? out : null;
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

        // API key es obligatoria para evitar spam anónimo.
        if (!configuredApiKey) {
          console.error("LEAD_FORM_API_KEY not configured; rejecting public submission");
          return json({ error: "Endpoint not configured" }, 503);
        }
        // Comparación en tiempo constante contra la clave de producción.
        const providedKey = request.headers.get("x-api-key") ?? "";
        const safeEqual = (a: string, b: string): boolean => {
          if (a.length !== b.length) return false;
          let diff = 0;
          for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
          return diff === 0;
        };
        if (!safeEqual(providedKey, configuredApiKey)) {
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

          const vendedor = DEFAULT_VENDEDOR;

          // Aceptar `productos: [...]` (contrato nuevo) o `configurador: {...}` (legacy).
          type ProdConfig = { raw: Record<string, unknown>; precio: number; cantidad: number };
          const rawList: unknown[] = Array.isArray(productos)
            ? productos
            : (configurador && typeof configurador === "object" ? [configurador] : []);

          const prodConfigs: ProdConfig[] = rawList
            .filter((p): p is Record<string, unknown> => p !== null && typeof p === "object")
            .map((p) => {
              const precio = Math.max(0, Number(p.precio_unitario ?? p.precio) || 0);
              const cantidad = Math.max(1, Math.floor(Number(p.cantidad) || 1));
              return { raw: p, precio, cantidad };
            });

          // Etiqueta del campo `leads.producto` (columna resumen para listados).
          // Fallback CORREGIDO: "Sin especificar" en vez de "Cabecero" (2.2).
          const primerTipoRaw = prodConfigs[0]?.raw?.tipo;
          const primerTipo = normalizeTipo(primerTipoRaw);
          const tipoProductoLabel = primerTipo ? TIPO_LABEL[primerTipo] : "Sin especificar";

          const totalProductos = prodConfigs.reduce((acc, p) => acc + p.precio * p.cantidad, 0);
          const ciudadClean = sanitize(ciudad, 100);
          const isMadrid = (() => {
            const c = ciudadClean.toLowerCase();
            return c === "madrid" || c.startsWith("madrid,") || c.includes(" madrid") || c.endsWith(" madrid");
          })();
          // Default envío: Madrid 40€, fuera 60€ (mínimo a consultar).
          const envioNum = valor_envio !== undefined
            ? Math.max(0, Number(valor_envio) || 0)
            : (isMadrid ? 40 : 60);

          const { data: lead, error: leadErr } = await supabaseAdmin.from("leads").insert({
            nombre: nombreClean,
            email: emailClean,
            telefono: sanitize(telefono, 20),
            ciudad: ciudadClean,
            producto: tipoProductoLabel,
            vendedor,
            etapa: "Discovery",
            valor: totalProductos + envioNum,
            valor_producto: totalProductos,
            valor_envio: envioNum,
            origen: sanitize(origen, 50) || "Formulario web",
            red_social: "",
            fecha_hold: null,
            tipo: "B2C",
          }).select().single();

          if (leadErr || !lead) return json({ error: leadErr?.message ?? "Error creando lead" }, 500);

          if (mensaje) {
            await supabaseAdmin.from("notas").insert({ lead_id: lead.id, contenido: sanitize(mensaje, 2000), usuario: "formulario-web" });
          }
          if (valor_envio === undefined && !isMadrid && ciudadClean) {
            await supabaseAdmin.from("notas").insert({
              lead_id: lead.id,
              contenido: `⚠️ Envío a consultar — ${ciudadClean} (fuera de Madrid). Aplicado mínimo provisional 60€.`,
              usuario: "sistema",
            });
          }

          // Inserta productos. Si buildProducto devuelve null (tipo no
          // reconocido), NO se descarta en silencio: se registra nota de aviso
          // con el payload completo para que se pueda revisar manualmente (2.3).
          for (const { raw, precio, cantidad } of prodConfigs) {
            const producto = buildProducto(raw as Record<string, unknown>);
            const config_json = buildConfigJson(raw);
            if (producto) {
              await supabaseAdmin.from("productos_lead").insert({
                lead_id: lead.id,
                ...producto,
                precio_unitario: precio || producto.precio_unitario,
                cantidad,
                config_json: config_json as never,
              });
              const rawObj = raw as Record<string, unknown>;
              const rawTipo = String(rawObj.tipo ?? "").toLowerCase().trim();
              const cfg = (rawObj.config ?? {}) as Record<string, unknown>;

              // Aviso: tipo "otro" sin descripción real (adenda A1).
              const tieneModelo = typeof rawObj.modelo === "string" && rawObj.modelo.trim().length > 0
                || typeof cfg.modelo === "string" && (cfg.modelo as string).trim().length > 0;
              const tieneResumen = typeof cfg.resumen === "string" && (cfg.resumen as string).trim().length > 0;
              if (rawTipo === "otro" && !tieneModelo && !tieneResumen) {
                await supabaseAdmin.from("notas").insert({
                  lead_id: lead.id,
                  contenido:
                    "AVISO: llegó un producto tipo \"otro\" sin descripción desde la web.\n" +
                    "Payload recibido: " + JSON.stringify(raw),
                  usuario: "sistema",
                });
              }

              // Aviso: coleccion_tela presente pero no reconocida (B.1 §1.2).
              // Guardado como null (nunca inventamos "basic" a partir de una errata).
              const coleccionRaw = rawObj.coleccion_tela ?? (rawObj as Record<string, unknown>).coleccionTela
                ?? (cfg.coleccion_tela ?? (cfg as Record<string, unknown>).coleccionTela);
              if (esColeccionTelaInvalida(coleccionRaw)) {
                await supabaseAdmin.from("notas").insert({
                  lead_id: lead.id,
                  contenido:
                    "AVISO: colección de tela no reconocida: \"" + String(coleccionRaw) + "\". " +
                    "Guardada como sin categoría (null). Revisar y clasificar manualmente.",
                  usuario: "sistema",
                });
              }

              // Aviso: variante de banco presente pero no reconocida (B.1 §2.1).
              // NO se inventa modelo "Oyambre"; se guarda tal cual venga en el payload.
              const varianteBancoRaw = rawObj.varianteBanco ?? (rawObj as Record<string, unknown>).bancoMedida
                ?? cfg.varianteBanco ?? (cfg as Record<string, unknown>).bancoMedida;
              if (rawTipo === "banco" && esVarianteBancoInvalida(varianteBancoRaw)) {
                await supabaseAdmin.from("notas").insert({
                  lead_id: lead.id,
                  contenido:
                    "AVISO: variante de banco no reconocida: \"" + String(varianteBancoRaw) + "\". " +
                    "Modelo guardado tal cual llegó del payload (no se ha inventado \"Oyambre\").",
                  usuario: "sistema",
                });
              }
            } else {
              await supabaseAdmin.from("notas").insert({
                lead_id: lead.id,
                contenido:
                  "AVISO: llegó un producto desde la web que no se pudo procesar.\n" +
                  "Payload recibido: " + JSON.stringify(raw),
                usuario: "sistema",
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
          console.error("[lead-form] unhandled error:", e);
          return json({ error: "Internal server error" }, 500);
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
