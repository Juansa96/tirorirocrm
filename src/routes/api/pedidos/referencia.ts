import { createFileRoute } from "@tanstack/react-router";
import { promptReferencia } from "@/lib/ia-prompts";
import { autenticarEquipo, cargarContextoPedido, descargarImagenBase64, guardarArchivoIA, json, llamarGeminiImagen, selloFecha } from "@/lib/ia-pedido.server";

// Imagen de referencia del acabado generada por Gemini: cómo debe quedar la
// pieza con su tela. Se adjuntan como referencia la foto real de la tela
// (frontal y, si es distinta, lateral/vivo) y el dibujo del configurador si el
// pedido viene de la web. Entra en la ficha como "referencia" PENDIENTE de
// aprobar; el tapicero no la ve hasta que alguien del equipo la aprueba.
//   POST { pedidoId, indicacion? }  →  { archivo: { id, url, nombre }, modelo }
export const Route = createFileRoute("/api/pedidos/referencia")({
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
        const { datos, fotosTela, dibujoPngUrl } = ctx;
        if (!datos.tipo) return json({ error: "El pedido no tiene producto." }, 400);

        // Imágenes adjuntas: primero la tela frontal, luego (si son distintas)
        // lateral y vivo; al final el dibujo del cliente. Máximo 4.
        const vistas = new Set<string>();
        const adjuntas: { data: string; mime: string }[] = [];
        const orden = [...fotosTela].sort((a, b) => (/frontal|principal/i.test(b.rol) ? 1 : 0) - (/frontal|principal/i.test(a.rol) ? 1 : 0));
        for (const f of orden) {
          if (vistas.has(f.url) || adjuntas.length >= 3) continue;
          vistas.add(f.url);
          const im = await descargarImagenBase64(f.url);
          if (im) adjuntas.push(im);
        }
        const hayFotoTela = adjuntas.length > 0;
        let hayDibujo = false;
        if (dibujoPngUrl) {
          const im = await descargarImagenBase64(dibujoPngUrl);
          if (im) { adjuntas.push(im); hayDibujo = true; }
        }

        const r = await llamarGeminiImagen({ prompt: promptReferencia(datos, { hayFotoTela, hayDibujo, indicacion }), imagenes: adjuntas, aspectRatio: "4:3" });
        if (r instanceof Response) return r;
        const ext = r.mime.includes("jpeg") ? "jpg" : r.mime.includes("webp") ? "webp" : "png";
        const guardado = await guardarArchivoIA({
          pedidoId, tipo: "referencia",
          nombre: `referencia-gemini-${selloFecha()}.${ext}`,
          bytes: r.bytes, contentType: r.mime,
        });
        if (guardado instanceof Response) return guardado;
        return json({ archivo: guardado, modelo: r.modelo });
      },
    },
  },
});
