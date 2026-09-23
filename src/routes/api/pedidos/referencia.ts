import { createFileRoute } from "@tanstack/react-router";
import { fotoBaseProducto, promptCorreccionImagen, promptReferencia, tituloPedidoIA, type ImagenesReferencia } from "@/lib/ia-prompts";
import { autenticarEquipo, cargarArchivoAnterior, cargarContextoPedido, traducirIndicacionImagen, descargarImagenBase64, guardarArchivoIA, json, generarImagen, respuestaLarga, selloFecha } from "@/lib/ia-pedido.server";

// Imagen de referencia del acabado generada por Gemini con el método de Juan:
// se parte de una FOTO REAL del producto (la de la web para las piezas de
// catálogo; si no, la foto de referencia que haya subido el equipo) y se le
// pide cambiar SOLO la tela y el vivo, adjuntando las fotos reales de las
// telas. Entra en la ficha como "referencia" PENDIENTE de aprobar; el
// tapicero no la ve hasta que alguien del equipo la aprueba.
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
        const corregir = typeof body?.corregir === "string" ? body.corregir : "";
        if (!pedidoId) return json({ error: "Falta pedidoId" }, 400);

        // Corregir una imagen ya generada: se edita esa imagen con la indicación.
        if (corregir) {
          if (!indicacion.trim()) return json({ error: "Escribe qué hay que corregir." }, 400);
          const prev = await cargarArchivoAnterior(pedidoId, corregir, "referencia");
          if (prev instanceof Response) return prev;
          const ctxC = await cargarContextoPedido(pedidoId);
          const contexto = ctxC instanceof Response ? "producto tapizado" : tituloPedidoIA(ctxC.datos);
          return respuestaLarga(async () => {
            const base = await descargarImagenBase64("", { bucket: "pedido-archivos", path: prev.storagePath });
            if (!base) return json({ error: "No se pudo leer la imagen anterior." }, 500);
            // Claude traduce la corrección a una instrucción de edición precisa.
            const instruccion = await traducirIndicacionImagen(indicacion, base, contexto);
            const r = await generarImagen({ prompt: promptCorreccionImagen(instruccion), imagenes: [base] });
            if (r instanceof Response) return r;
            const ext = r.mime.includes("jpeg") ? "jpg" : r.mime.includes("webp") ? "webp" : "png";
            const guardado = await guardarArchivoIA({ pedidoId, tipo: "referencia", nombre: `referencia-ia-${selloFecha()}.${ext}`, bytes: r.bytes, contentType: r.mime });
            if (guardado instanceof Response) return guardado;
            return json({ archivo: guardado, modelo: r.modelo });
          });
        }

        const ctx = await cargarContextoPedido(pedidoId);
        if (ctx instanceof Response) return ctx;
        const { datos, fotosTela, dibujoPngUrl, referenciaEquipo } = ctx;
        if (!datos.tipo) return json({ error: "El pedido no tiene producto." }, 400);

        return respuestaLarga(async () => {
          // Orden de las imágenes: [base] [tela principal] [tela lateral] [tela vivo] [dibujo].
          const adjuntas: { data: string; mime: string }[] = [];
          const im: ImagenesReferencia = { base: null, baseDescripcion: "", telaPrincipal: false, telaLateral: false, telaVivo: false, dibujo: false };

          const catalogo = fotoBaseProducto(datos.tipo, datos.modelo);
          const baseCat = catalogo ? await descargarImagenBase64(catalogo.url) : null;
          if (baseCat && catalogo) {
            adjuntas.push(baseCat); im.base = "catalogo"; im.baseDescripcion = catalogo.descripcion;
          } else if (referenciaEquipo) {
            const baseEq = await descargarImagenBase64("", { bucket: "pedido-archivos", path: referenciaEquipo });
            if (baseEq) { adjuntas.push(baseEq); im.base = "equipo"; }
          }

          const foto = (re: RegExp) => fotosTela.find((f) => re.test(f.rol));
          const principal = foto(/frontal|principal/i) ?? fotosTela[0];
          const lateral = foto(/lateral/i);
          const vivo = foto(/vivo|ribete/i);
          if (principal) { const x = await descargarImagenBase64(principal.url); if (x) { adjuntas.push(x); im.telaPrincipal = true; } }
          if (lateral && lateral.url !== principal?.url) { const x = await descargarImagenBase64(lateral.url); if (x) { adjuntas.push(x); im.telaLateral = true; } }
          if (vivo && vivo.url !== principal?.url) { const x = await descargarImagenBase64(vivo.url); if (x) { adjuntas.push(x); im.telaVivo = true; } }
          // El dibujo del configurador solo hace falta si no hay foto base.
          if (!im.base && dibujoPngUrl) { const x = await descargarImagenBase64(dibujoPngUrl); if (x) { adjuntas.push(x); im.dibujo = true; } }

          const indicacionIA = indicacion.trim() ? await traducirIndicacionImagen(indicacion, adjuntas[0] ?? null, tituloPedidoIA(datos)) : "";
          const r = await generarImagen({ prompt: promptReferencia(datos, im, indicacionIA), imagenes: adjuntas, aspectRatio: im.base ? undefined : "4:3" });
          if (r instanceof Response) return r;
          const ext = r.mime.includes("jpeg") ? "jpg" : r.mime.includes("webp") ? "webp" : "png";
          const guardado = await guardarArchivoIA({
            pedidoId, tipo: "referencia",
            nombre: `referencia-ia-${selloFecha()}.${ext}`,
            bytes: r.bytes, contentType: r.mime,
          });
          if (guardado instanceof Response) return guardado;
          return json({ archivo: guardado, modelo: r.modelo });
        });
      },
    },
  },
});
