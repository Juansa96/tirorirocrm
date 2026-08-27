import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Subida de la foto (opcional) del producto terminado por el tapicero.
// El tapicero es solo-lectura a nivel de BD; esta escritura pasa por aquí con
// service_role, validando token, rol y propiedad del pedido. Solo imágenes.
//   POST { pedidoId, filename, contentType, dataBase64 }
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json" } });

const MAX_BYTES = 8 * 1024 * 1024; // 8 MB (la foto se comprime en el cliente)

export const Route = createFileRoute("/api/tapicero/foto")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const authz = request.headers.get("authorization") ?? "";
        const token = authz.toLowerCase().startsWith("bearer ") ? authz.slice(7) : "";
        if (!token) return json({ error: "No autorizado" }, 401);
        const { data: u, error: uErr } = await supabaseAdmin.auth.getUser(token);
        if (uErr || !u?.user) return json({ error: "No autorizado" }, 401);

        const { data: perfil } = await supabaseAdmin.from("perfiles").select("rol, tapicero_id, activo").eq("id", u.user.id).maybeSingle();
        if (!perfil || perfil.activo === false) return json({ error: "Sin acceso" }, 403);
        const esEquipo = ["admin", "equipo"].includes(perfil.rol as string);
        const esTapicero = perfil.rol === "tapicero";
        if (!esEquipo && !esTapicero) return json({ error: "Sin acceso" }, 403);

        const body = await request.json().catch(() => null) as Record<string, unknown> | null;
        const pedidoId = String(body?.pedidoId ?? "");
        const filename = String(body?.filename ?? "foto.jpg").replace(/[^\w.-]+/g, "_").slice(0, 120);
        const contentType = String(body?.contentType ?? "");
        const dataBase64 = String(body?.dataBase64 ?? "");
        if (!pedidoId) return json({ error: "Falta pedidoId" }, 400);
        if (!contentType.startsWith("image/")) return json({ error: "Solo se admiten imágenes" }, 400);
        if (!dataBase64) return json({ error: "Falta la imagen" }, 400);

        // Valida propiedad del pedido (el tapicero, solo los suyos).
        const { data: pedido } = await supabaseAdmin.from("pedidos").select("id, tapicero_id").eq("id", pedidoId).maybeSingle();
        if (!pedido) return json({ error: "Pedido no encontrado" }, 404);
        if (esTapicero && pedido.tapicero_id !== perfil.tapicero_id) return json({ error: "No es tu pedido" }, 403);

        // Decodifica y valida tamaño.
        let bytes: Buffer;
        try { bytes = Buffer.from(dataBase64, "base64"); } catch { return json({ error: "Imagen inválida" }, 400); }
        if (bytes.length === 0) return json({ error: "Imagen vacía" }, 400);
        if (bytes.length > MAX_BYTES) return json({ error: "Imagen demasiado grande (máx. 8 MB)" }, 413);

        // Nombre de quien sube (para el histórico).
        let por = u.user.email ?? "usuario";
        if (esTapicero && perfil.tapicero_id) {
          const { data: tap } = await supabaseAdmin.from("tapiceros").select("nombre, apellido").eq("id", perfil.tapicero_id).maybeSingle();
          if (tap) por = [tap.nombre, tap.apellido].filter(Boolean).join(" ");
        }

        const path = `${pedidoId}/foto_terminado/${crypto.randomUUID()}-${filename}`;
        const { error: upErr } = await supabaseAdmin.storage.from("pedido-archivos").upload(path, bytes, { contentType, upsert: false });
        if (upErr) return json({ error: "No se pudo subir la foto" }, 400);

        const { data: signed } = await supabaseAdmin.storage.from("pedido-archivos").createSignedUrl(path, 60 * 60 * 24 * 7);
        const url = signed?.signedUrl ?? "";
        const { error: insErr } = await supabaseAdmin.from("pedido_archivos").insert({
          pedido_id: pedidoId, tipo: "foto_terminado", nombre: filename, storage_path: path, url, subido_por: por,
        } as never);
        if (insErr) return json({ error: insErr.message }, 400);

        return json({ ok: true });
      },
    },
  },
});
