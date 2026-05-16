import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { VENDEDORES } from "@/lib/types";

function randomVendedor(): string {
  return VENDEDORES[Math.floor(Math.random() * VENDEDORES.length)];
}

function sanitize(val: unknown, maxLen = 200): string {
  if (val === null || val === undefined) return "";
  return String(val).trim().slice(0, maxLen);
}

function buildProducto(config: Record<string, string>) {
  const tipo = sanitize(config.tipo, 50);
  if (!tipo) return null;

  const CABECERO_FORMAS: Record<string, string> = {
    recto: "Calobra", semicirculo: "Pregonda", "corona-simple": "Macarella",
    "corona-doble": "Conta", ondas: "Barbaria",
  };
  const BANCO_VARIANTES: Record<string, string> = {
    madera: "Patas de madera", enteladas: "Patas enteladas", baul: "Estilo baúl",
  };
  const PANTALLA_FORMAS: Record<string, string> = {
    cilindro: "Almanzor", cuadrado: "Tormes", rectangulo: "La Serrota",
  };

  const TIPOS_VALIDOS = ["cabecero", "banco", "cojin", "puf", "mesa", "pantalla"];
  if (!TIPOS_VALIDOS.includes(tipo)) return null;

  let modelo = "", ancho: number | null = null, alto: number | null = null;
  let color = "", relleno = "", patas = "";

  if (tipo === "cabecero") {
    modelo = CABECERO_FORMAS[config.forma] ?? sanitize(config.forma, 50);
    ancho = config.anchoCama ? Math.min(Number(config.anchoCama), 400) : config.ancho ? Math.min(Number(config.ancho), 400) : null;
    alto = config.altoCm ? Math.min(Number(config.altoCm), 300) : config.alto ? Math.min(Number(config.alto), 300) : null;
    color = sanitize(config.telaLateral);
    patas = config.colgador === "true" ? "Con colgador" : "";
  } else if (tipo === "banco") {
    modelo = BANCO_VARIANTES[config.varianteBanco] ?? sanitize(config.varianteBanco, 50);
    ancho = config.largoBanco ? Math.min(Number(config.largoBanco), 400) : null;
    alto = config.altoBanco ? Math.min(Number(config.altoBanco), 300) : null;
  } else if (tipo === "cojin") {
    modelo = sanitize(config.opcionAlmohadon?.replace(/-/g, " — "), 100);
    const dims = config.opcionAlmohadon?.split("-")[1]?.replace(" cm", "").split("×");
    ancho = dims ? Number(dims[0]) : null;
    alto = dims ? Number(dims[1]) : null;
  } else if (tipo === "puf") {
    modelo = `${sanitize(config.tamanoPuf, 20)} cm`;
    ancho = config.tamanoPuf ? Math.min(Number(config.tamanoPuf), 200) : null;
  } else if (tipo === "mesa") {
    modelo = sanitize(config.presetMesa, 50);
    const dims = (config.presetMesa ?? "").replace(" cm", "").split("×");
    ancho = dims[0] ? Number(dims[0]) : null;
    alto = dims[1] ? Number(dims[1]) : null;
    color = sanitize(config.superficieMesa) || "nada";
  } else if (tipo === "pantalla") {
    const forma = sanitize(config.formaPantalla, 30);
    modelo = `${PANTALLA_FORMAS[forma] ?? forma} ${sanitize(config.tamanoPantalla, 20)}`.trim();
    relleno = forma;
    patas = sanitize(config.tamanoPantalla, 20);
  }

  return {
    tipo, modelo,
    ancho: Number.isFinite(ancho) ? ancho : null,
    alto: Number.isFinite(alto) ? alto : null,
    tela: sanitize(config.tela ?? config.fabricName),
    color, relleno, patas,
    acabado: sanitize(config.acabado ?? config.finish, 30) || "vivo-simple",
    coleccion_tela: sanitize(config.coleccionTela, 30) || (config.fabricGroup === "Premium" ? "Premium" : "Básicas"),
    cantidad: 1, precio_unitario: 0, notas_producto: "",
    created_by: "formulario-web",
  };
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

          const { data: lead, error: leadErr } = await supabase.from("leads").insert({
            nombre: nombreClean,
            email: emailClean,
            telefono: sanitize(telefono, 20),
            ciudad: sanitize(ciudad, 100),
            producto: tipoProducto,
            vendedor,
            etapa: "Discovery",
            valor: 0,
            origen: sanitize(origen, 50) || "Formulario web",
            red_social: "",
            fecha_hold: null,
          }).select().single();

          if (leadErr || !lead) return json({ error: leadErr?.message ?? "Error creando lead" }, 500);

          if (mensaje) {
            await supabase.from("notas").insert({ lead_id: lead.id, contenido: sanitize(mensaje, 2000), usuario: "formulario-web" });
          }

          if (configurador && typeof configurador === "object") {
            const producto = buildProducto(configurador as Record<string, string>);
            if (producto) await supabase.from("productos_lead").insert({ lead_id: lead.id, ...producto });
          }

          const today = new Date().toISOString().slice(0, 10);
          await supabase.from("tareas").insert({
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
