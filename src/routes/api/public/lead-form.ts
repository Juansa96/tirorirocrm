import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

const VENDEDORES = [
  "isangradortorres@gmail.com",
  "rocionavarreteurdiales98@gmail.com",
  "sangradortorresjuan@gmail.com",
  "bea.gyerro@gmail.com",
] as const;

function randomVendedor(): string {
  return VENDEDORES[Math.floor(Math.random() * VENDEDORES.length)];
}

// Parse configurator data from web form into a productos_lead record
function buildProducto(config: Record<string, string>) {
  const tipo = config.tipo || "";
  if (!tipo) return null;

  const CABECERO_FORMAS: Record<string, string> = {
    "recto": "Calobra", "semicirculo": "Pregonda", "corona-simple": "Macarella",
    "corona-doble": "Conta", "ondas": "Barbaria",
  };
  const BANCO_VARIANTES: Record<string, string> = {
    "madera": "Patas de madera", "enteladas": "Patas enteladas", "baul": "Estilo baúl",
  };
  const PANTALLA_FORMAS: Record<string, string> = {
    "cilindro": "Almanzor", "cuadrado": "Tormes", "rectangulo": "La Serrota",
  };

  let modelo = "", ancho: number | null = null, alto: number | null = null;
  let color = "", relleno = "", patas = "";

  if (tipo === "cabecero") {
    modelo = CABECERO_FORMAS[config.forma] ?? config.forma ?? "";
    ancho = config.anchoCama ? Number(config.anchoCama) : (config.ancho ? Number(config.ancho) : null);
    alto = config.altoCm ? Number(config.altoCm) : (config.alto ? Number(config.alto) : null);
    color = config.telaLateral ?? "";
    patas = config.colgador === "true" ? "Con colgador" : "";
  } else if (tipo === "banco") {
    modelo = BANCO_VARIANTES[config.varianteBanco] ?? config.varianteBanco ?? "";
    ancho = config.largoBanco ? Number(config.largoBanco) : null;
    alto = config.altoBanco ? Number(config.altoBanco) : null;
  } else if (tipo === "cojin") {
    modelo = config.opcionAlmohadon?.replace(/-/g, " — ") ?? "";
    const dims = config.opcionAlmohadon?.split("-")[1]?.replace(" cm", "").split("×");
    ancho = dims ? Number(dims[0]) : null;
    alto = dims ? Number(dims[1]) : null;
  } else if (tipo === "puf") {
    modelo = `${config.tamanoPuf ?? "40"} cm`;
    ancho = config.tamanoPuf ? Number(config.tamanoPuf) : null;
  } else if (tipo === "mesa") {
    modelo = config.presetMesa ?? "";
    const dims = (config.presetMesa ?? "").replace(" cm", "").split("×");
    ancho = dims[0] ? Number(dims[0]) : null;
    alto = dims[1] ? Number(dims[1]) : null;
    color = config.superficieMesa ?? "nada";
  } else if (tipo === "pantalla") {
    modelo = `${PANTALLA_FORMAS[config.formaPantalla] ?? config.formaPantalla} ${config.tamanoPantalla ?? ""}`.trim();
    relleno = config.formaPantalla ?? "";
    patas = config.tamanoPantalla ?? "";
  }

  return {
    tipo,
    modelo,
    ancho,
    alto,
    tela: config.tela ?? config.fabricName ?? "",
    color,
    relleno,
    patas,
    acabado: config.acabado ?? config.finish ?? "vivo-simple",
    coleccion_tela: config.coleccionTela ?? (config.fabricGroup === "Premium" ? "Premium" : "Básicas"),
    cantidad: 1,
    precio_unitario: 0,
    notas_producto: "",
    created_by: "formulario-web",
  };
}

// Endpoint público para recibir leads desde el formulario de tirorirohome.com
// POST /api/public/lead-form
// Body: { nombre, email, telefono, ciudad, mensaje, origen?, configurador? }
// configurador: { tipo, forma, anchoCama, altoCm, tela, telaLateral, acabado, ... }

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
          const { nombre, email, telefono, ciudad, mensaje, origen, configurador } = body;

          if (!nombre || !email) {
            return new Response(JSON.stringify({ error: "nombre y email son requeridos" }), { status: 400, headers: cors });
          }

          const vendedor = randomVendedor();
          const tipoProducto = configurador?.tipo
            ? ({ cabecero: "Cabecero", banco: "Banco", cojin: "Almohadón", puf: "Puf", mesa: "Mesa de centro", pantalla: "Pantalla de lámpara" }[configurador.tipo as string] ?? "Cabecero")
            : "Cabecero";

          const { data: lead, error: leadErr } = await supabase
            .from("leads")
            .insert({
              nombre: String(nombre).trim(),
              email: String(email).trim(),
              telefono: String(telefono ?? "").trim(),
              ciudad: String(ciudad ?? "").trim(),
              producto: tipoProducto,
              vendedor,
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

          // Nota con los detalles del formulario
          if (mensaje) {
            await supabase.from("notas").insert({
              lead_id: lead.id,
              contenido: String(mensaje).trim(),
              usuario: "formulario-web",
            });
          }

          // Si viene del configurador, crear producto automáticamente
          if (configurador && typeof configurador === "object") {
            const producto = buildProducto(configurador as Record<string, string>);
            if (producto) {
              await supabase.from("productos_lead").insert({ lead_id: lead.id, ...producto });
            }
          }

          // Tarea automática de primer contacto para hoy
          const today = new Date().toISOString().slice(0, 10);
          await supabase.from("tareas").insert({
            lead_id: lead.id,
            descripcion: `Primer contacto con ${nombre} (formulario web)`,
            fecha: today,
            hora: "",
            vendedor,
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
