import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Acciones del tapicero sobre SUS pedidos (o del equipo sobre cualquiera).
// El tapicero es solo-lectura a nivel de BD; estas escrituras pasan por aquí,
// validando el token y la propiedad del pedido.
//   POST { op: "tela_recibida" | "iniciado" | "terminado" | "cambio_visto", pedidoId, valor? }
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json" } });

export const Route = createFileRoute("/api/tapicero/accion")({
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
        const op = String(body?.op ?? "");
        const pedidoId = String(body?.pedidoId ?? "");
        if (!pedidoId) return json({ error: "Falta pedidoId" }, 400);

        // Carga el pedido y valida propiedad (el tapicero solo los suyos).
        const { data: pedido } = await supabaseAdmin.from("pedidos").select("id, tapicero_id").eq("id", pedidoId).maybeSingle();
        if (!pedido) return json({ error: "Pedido no encontrado" }, 404);
        if (esTapicero && pedido.tapicero_id !== perfil.tapicero_id) return json({ error: "No es tu pedido" }, 403);

        // Nombre de quien marca (para el histórico).
        let por = u.user.email ?? "usuario";
        if (esTapicero && perfil.tapicero_id) {
          const { data: tap } = await supabaseAdmin.from("tapiceros").select("nombre, apellido").eq("id", perfil.tapicero_id).maybeSingle();
          if (tap) por = [tap.nombre, tap.apellido].filter(Boolean).join(" ");
        }
        const ahora = new Date().toISOString();

        if (op === "tela_recibida") {
          const valor = body?.valor !== false; // por defecto true
          const { error } = await supabaseAdmin.from("pedidos").update({
            tela_estado: valor ? "recibida" : "enviada",
            tela_estado_por: por, tela_estado_fecha: ahora,
          } as never).eq("id", pedidoId);
          if (error) return json({ error: error.message }, 400);
          return json({ ok: true });
        }
        if (op === "iniciado") {
          const valor = body?.valor !== false; // por defecto true
          const { error } = await supabaseAdmin.from("pedidos").update({
            iniciado_tapicero: valor,
            iniciado_tapicero_por: valor ? por : null,
            iniciado_tapicero_fecha: valor ? ahora : null,
          } as never).eq("id", pedidoId);
          if (error) return json({ error: error.message }, 400);
          return json({ ok: true });
        }
        if (op === "cambio_visto") {
          // El tapicero da por vista la modificación (limpia el aviso).
          const { error } = await supabaseAdmin.from("pedidos").update({
            cambio_tras_envio: false,
          } as never).eq("id", pedidoId);
          if (error) return json({ error: error.message }, 400);
          return json({ ok: true });
        }
        if (op === "terminado") {
          const valor = body?.valor !== false;
          const { error } = await supabaseAdmin.from("pedidos").update({
            terminado_tapicero: valor,
            terminado_tapicero_por: valor ? por : null,
            terminado_tapicero_fecha: valor ? ahora : null,
          } as never).eq("id", pedidoId);
          if (error) return json({ error: error.message }, 400);
          return json({ ok: true });
        }
        return json({ error: "Operación no reconocida" }, 400);
      },
    },
  },
});
