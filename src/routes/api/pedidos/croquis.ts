import { createFileRoute } from "@tanstack/react-router";
import { llevaCroquis } from "@/lib/catalogo";
import { CROQUIS_SYSTEM, promptCorreccionCroquis, promptCroquis } from "@/lib/ia-prompts";
import { autenticarEquipo, cargarArchivoAnterior, cargarContextoPedido, descargarTexto, extraerSVG, firmar, guardarArchivoIA, json, lanzarSegundoPlano, llamarClaude, resultadoSegundoPlano, selloFecha } from "@/lib/ia-pedido.server";

// Croquis (plano de corte de la madera) generado por Claude a partir de los
// datos del pedido: forma, medidas, grosor y enchufes/huecos. Entra en la ficha
// como "plantilla" PENDIENTE de aprobar; el tapicero no lo ve hasta que alguien
// del equipo lo aprueba.
// Claude puede tardar varios minutos, así que va en segundo plano (ver
// lanzarSegundoPlano en ia-pedido.server.ts):
//   POST { pedidoId, indicacion?, corregir? }  →  { lote }       (navegador, equipo)
//   POST { pedidoId, lote }                    →  { pendiente } | { archivo } | { error }
//   POST + cabecera x-croquis-trabajo          →  hace el croquis (solo la BD, vía pg_net)
const CABECERA_TRABAJO = "x-croquis-trabajo";
const TRABAJO_CADUCA_MS = 10 * 60 * 1000;
const firmaTrabajo = (pedidoId: string, t: number, indicacion: string, corregir: string) => firmar(`trabajo:${pedidoId}:${t}:${corregir}:${indicacion}`);
const firmaLote = (pedidoId: string, id: number) => firmar(`lote:${pedidoId}:${id}`);

type Peticion = { pedidoId: string; indicacion: string; corregir: string };

// Comprueba que se puede hacer el croquis y monta el texto para Claude.
async function prepararCroquis({ pedidoId, indicacion, corregir }: Peticion): Promise<{ prompt: string } | Response> {
  const ctx = await cargarContextoPedido(pedidoId);
  if (ctx instanceof Response) return ctx;
  const { datos } = ctx;
  if (!llevaCroquis(datos.tipo, datos.modelo)) return json({ error: "El croquis de corte solo se genera para cabeceros." }, 400);
  if (datos.ancho == null || datos.alto == null) return json({ error: "Faltan el ancho o el alto del cabecero: confírmalos antes de generar el croquis." }, 400);

  // Corregir un croquis ya generado: Claude recibe el SVG anterior y aplica solo el cambio.
  if (corregir) {
    if (!indicacion.trim()) return json({ error: "Escribe qué hay que corregir." }, 400);
    const prev = await cargarArchivoAnterior(pedidoId, corregir, "plantilla");
    if (prev instanceof Response) return prev;
    if (!/\.svg$/i.test(prev.nombre)) return json({ error: "Solo se pueden corregir croquis generados (SVG); para otro archivo usa Regenerar." }, 400);
    const svgAnterior = (await descargarTexto("pedido-archivos", prev.storagePath)) ?? "";
    if (!svgAnterior.includes("<svg")) return json({ error: "No se pudo leer el croquis anterior." }, 500);
    return { prompt: promptCorreccionCroquis(svgAnterior, indicacion) };
  }
  const fecha = new Date().toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Europe/Madrid" });
  return { prompt: promptCroquis(datos, { fecha, indicacion }) };
}

// El trabajo largo: lo llama la base de datos y espera a que termine.
async function hacerCroquis(p: Peticion): Promise<Response> {
  const prep = await prepararCroquis(p);
  if (prep instanceof Response) return prep;
  const r = await llamarClaude({ system: CROQUIS_SYSTEM, prompt: prep.prompt });
  if (r instanceof Response) return r;
  const svg = extraerSVG(r.texto);
  if (!svg) return json({ error: "Claude no ha devuelto un SVG válido; vuelve a intentarlo." }, 502);
  const guardado = await guardarArchivoIA({
    pedidoId: p.pedidoId, tipo: "plantilla",
    nombre: `croquis-claude-${selloFecha()}.svg`,
    bytes: new TextEncoder().encode(svg), contentType: "image/svg+xml",
  });
  if (guardado instanceof Response) return guardado;
  return json({ archivo: guardado, modelo: r.modelo });
}

export const Route = createFileRoute("/api/pedidos/croquis")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const body = await request.json().catch(() => null) as Record<string, unknown> | null;
        const pedidoId = String(body?.pedidoId ?? "");
        const indicacion = typeof body?.indicacion === "string" ? body.indicacion.slice(0, 1000) : "";
        const corregir = typeof body?.corregir === "string" ? body.corregir : "";
        if (!pedidoId) return json({ error: "Falta pedidoId" }, 400);

        // 3) El trabajo, llamado desde la base de datos con la firma del encargo.
        const firmaRecibida = request.headers.get(CABECERA_TRABAJO);
        if (firmaRecibida) {
          const t = Number(body?.t);
          if (!Number.isFinite(t) || Math.abs(Date.now() - t) > TRABAJO_CADUCA_MS || firmaRecibida !== await firmaTrabajo(pedidoId, t, indicacion, corregir)) {
            return json({ error: "Encargo no válido" }, 401);
          }
          return hacerCroquis({ pedidoId, indicacion, corregir });
        }

        const auth = await autenticarEquipo(request);
        if (auth instanceof Response) return auth;

        // 2) ¿Ha terminado ya?
        const lote = typeof body?.lote === "string" ? body.lote : "";
        if (lote) {
          const [pre, idTxt = "", firma = ""] = lote.split(".");
          const id = Number(idTxt);
          // Lotes de la versión anterior (API de lotes de Anthropic): se abandonan.
          if (pre !== "pg" || !Number.isInteger(id)) return json({ error: "Se ha cambiado cómo se generan los croquis: vuelve a pulsar Generar." }, 400);
          if (firma !== await firmaLote(pedidoId, id)) return json({ error: "Ese croquis no corresponde a este pedido." }, 400);
          const res = await resultadoSegundoPlano(id);
          if (!res) return json({ pendiente: true });
          if (res.timedOut) return json({ error: "Claude ha tardado demasiado en hacer el croquis; vuelve a intentarlo." }, 502);
          let r: Record<string, unknown> | null = null;
          try { r = JSON.parse(res.content.trim() || "null") as Record<string, unknown> | null; } catch { /* no es JSON */ }
          if (r && (r.archivo || r.error)) return json(r, r.archivo ? 200 : 502);
          const detalle = res.errorMsg || (res.status ? `HTTP ${res.status}` : "sin respuesta");
          return json({ error: `No se pudo generar el croquis (${detalle}); vuelve a intentarlo.` }, 502);
        }

        // 1) Encargo: se valida ya (para avisar enseguida) y se lanza en segundo plano.
        const prep = await prepararCroquis({ pedidoId, indicacion, corregir });
        if (prep instanceof Response) return prep;
        if (!process.env.ANTHROPIC_API_KEY) return json({ error: "Falta configurar ANTHROPIC_API_KEY en Lovable Cloud (Secrets).", noConfigurado: true }, 503);
        const t = Date.now();
        const url = new URL("/api/pedidos/croquis", request.url).toString();
        const id = await lanzarSegundoPlano(url, { [CABECERA_TRABAJO]: await firmaTrabajo(pedidoId, t, indicacion, corregir) },
          { pedidoId, indicacion, corregir, t }, 15 * 60 * 1000);
        if (id instanceof Response) return id;
        return json({ lote: `pg.${id}.${await firmaLote(pedidoId, id)}` });
      },
    },
  },
});
