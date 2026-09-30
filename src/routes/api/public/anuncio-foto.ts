import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { fotoAnuncioMeta } from "@/lib/metaads.server";

// Miniatura de un anuncio de Meta por su id o por su nombre:
// GET /api/public/anuncio-foto?id=120248772530450643  ·  ?nombre=Leads_A_Conta_Esperando
// Sale de la sincronización con la API de anuncios (src/lib/metaads.server.ts)
// o, en los «clic a WhatsApp», de raw._anuncio del primer mensaje
// (src/lib/whatsapp/anuncios.server.ts). Es la creatividad pública del anuncio,
// sin datos del cliente. La usa el email del parte de marketing: Gmail no
// enseña imágenes data: ni adjuntos en línea hechos con la herramienta de envío.

export const Route = createFileRoute("/api/public/anuncio-foto")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        const q = new URL(request.url).searchParams;
        const id = q.get("id") ?? "";
        const nombre = (q.get("nombre") ?? "").slice(0, 200);
        if (id && !/^\d{6,25}$/.test(id)) return new Response("id no válido", { status: 400 });
        if (!id && !nombre) return new Response("falta id o nombre", { status: 400 });
        let foto = await fotoAnuncioMeta({ id, nombre });
        if (!foto && id) {
          const { data } = await supabaseAdmin.from("whatsapp_mensajes")
            .select("foto:raw->_anuncio->>foto")
            .eq("raw->_anuncio->>id", id)
            .eq("raw->_anuncio->>estado", "ok")
            .limit(1)
            .maybeSingle();
          foto = String((data as { foto?: string } | null)?.foto ?? "");
        }
        const m = /^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i.exec(foto);
        if (!m) return new Response("sin foto", { status: 404 });
        const bin = atob(m[2]);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        return new Response(bytes, {
          status: 200,
          headers: { "Content-Type": m[1], "Cache-Control": "public, max-age=86400", "Access-Control-Allow-Origin": "*" },
        });
      },
    },
  },
});
