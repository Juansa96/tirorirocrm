import { createFileRoute } from "@tanstack/react-router";
import { llevaCroquis } from "@/lib/catalogo";
import { CROQUIS_SYSTEM, promptCroquis } from "@/lib/ia-prompts";
import { autenticarEquipo, cargarContextoPedido, extraerSVG, guardarArchivoIA, json, llamarClaude, respuestaLarga, selloFecha } from "@/lib/ia-pedido.server";

// Croquis (plano de corte de la madera) generado por Claude a partir de los
// datos del pedido: forma, medidas, grosor y enchufes/huecos. Entra en la ficha
// como "plantilla" PENDIENTE de aprobar; el tapicero no lo ve hasta que alguien
// del equipo lo aprueba.
//   POST { pedidoId, indicacion? }  →  { archivo: { id, url, nombre }, modelo }
export const Route = createFileRoute("/api/pedidos/croquis")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const auth = await autenticarEquipo(request);
        if (auth instanceof Response) return auth;

        const body = await request.json().catch(() => null) as Record<string, unknown> | null;
        const pedidoId = String(body?.pedidoId ?? "");
        const indicacion = typeof body?.indicacion === "string" ? body.indicacion.slice(0, 1000) : "";
        if (!pedidoId) return json({ error: "Falta pedidoId" }, 400);

        const ctx = await cargarContextoPedido(pedidoId);
        if (ctx instanceof Response) return ctx;
        const { datos } = ctx;
        if (!llevaCroquis(datos.tipo, datos.modelo)) return json({ error: "El croquis de corte solo se genera para cabeceros." }, 400);
        if (datos.ancho == null || datos.alto == null) return json({ error: "Faltan el ancho o el alto del cabecero: confírmalos antes de generar el croquis." }, 400);

        return respuestaLarga(async () => {
          const fecha = new Date().toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Europe/Madrid" });
          const r = await llamarClaude({ system: CROQUIS_SYSTEM, prompt: promptCroquis(datos, { fecha, indicacion }) });
          if (r instanceof Response) return r;
          const svg = extraerSVG(r.texto);
          if (!svg) return json({ error: "Claude no ha devuelto un SVG válido; vuelve a intentarlo." }, 502);

          const guardado = await guardarArchivoIA({
            pedidoId, tipo: "plantilla",
            nombre: `croquis-claude-${selloFecha()}.svg`,
            bytes: new TextEncoder().encode(svg), contentType: "image/svg+xml",
          });
          if (guardado instanceof Response) return guardado;
          return json({ archivo: guardado, modelo: r.modelo });
        });
      },
    },
  },
});
