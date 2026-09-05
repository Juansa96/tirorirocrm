import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { esPantalla } from "@/lib/types";

// Acciones del tapicero sobre SUS pedidos (o del equipo sobre cualquiera).
// El tapicero es solo-lectura a nivel de BD; estas escrituras pasan por aquí,
// validando el token y la propiedad del pedido.
//   POST { op: "tela_recibida" | "iniciado" | "terminado" | "cambio_visto", pedidoId, valor? }
//   POST { op: "medidas", pedidoId, ancho?, alto?, fondo? }  → corrige las medidas
//        del PRODUCTO del pedido (productos_lead.ancho/alto/fondo). Es la misma
//        fila que editan Clientes y Pedidos: no hay copia en el pedido.
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
        // `pasos_tapicero` (JSONB) guarda también los marcadores de iniciado /
        // cambio (claves con prefijo "@"), sin necesidad de columnas nuevas.
        const { data: pedido } = await supabaseAdmin.from("pedidos")
          .select("id, tapicero_id, pasos_tapicero, producto_lead_id, entregado, tela_recibida, tela_recibida_fecha, enviar_tela_daniel, enviar_tela_daniel_fecha, terminado_daniel_fecha, pantalla_hecha_fecha")
          .eq("id", pedidoId).maybeSingle();
        if (!pedido) return json({ error: "Pedido no encontrado" }, 404);
        if (esTapicero && pedido.tapicero_id !== perfil.tapicero_id) return json({ error: "No es tu pedido" }, 403);

        // Nombre de quien marca (para el histórico).
        let por = u.user.email ?? "usuario";
        if (esTapicero && perfil.tapicero_id) {
          const { data: tap } = await supabaseAdmin.from("tapiceros").select("nombre, apellido").eq("id", perfil.tapicero_id).maybeSingle();
          if (tap) por = [tap.nombre, tap.apellido].filter(Boolean).join(" ");
        }
        const ahora = new Date().toISOString();

        // Marcadores dentro de pasos_tapicero (JSONB existente). Claves "@".
        // Las claves camelCase de hito guardan quién hizo ese paso (sello).
        const pasosActuales = (pedido.pasos_tapicero && typeof pedido.pasos_tapicero === "object"
          ? pedido.pasos_tapicero : {}) as Record<string, string>;
        const ped = pedido as Record<string, unknown>;

        // Los botones del tapicero y los hitos del equipo son la misma verdad
        // (misma regla que sincronizarHitosTapicero en el store del equipo).
        const tipoProducto = async (): Promise<string> => {
          if (!ped.producto_lead_id) return "";
          const { data: pr } = await supabaseAdmin.from("productos_lead").select("tipo").eq("id", ped.producto_lead_id as string).maybeSingle();
          return String((pr as { tipo?: string } | null)?.tipo ?? "");
        };

        if (op === "tela_recibida") {
          const valor = body?.valor !== false; // por defecto true
          const pantalla = esPantalla(await tipoProducto());
          const upd: Record<string, unknown> = {
            tela_estado: valor ? "recibida" : "enviada",
            tela_estado_por: por, tela_estado_fecha: ahora,
          };
          if (valor) {
            // El tapicero tiene la tela ⇒ el equipo la recibió y se la envió.
            if (!ped.tela_recibida) { upd.tela_recibida = true; upd.tela_recibida_fecha = ped.tela_recibida_fecha ?? ahora; }
            if (!pantalla && !ped.enviar_tela_daniel) { upd.enviar_tela_daniel = true; upd.enviar_tela_daniel_fecha = ped.enviar_tela_daniel_fecha ?? ahora; }
          }
          const { error } = await supabaseAdmin.from("pedidos").update(upd as never).eq("id", pedidoId);
          if (error) return json({ error: error.message }, 400);
          return json({ ok: true });
        }
        if (op === "iniciado") {
          const valor = body?.valor !== false; // por defecto true
          const pasos = { ...pasosActuales };
          if (valor) { pasos["@iniciado"] = ahora; pasos["@iniciadoPor"] = por; }
          else { delete pasos["@iniciado"]; delete pasos["@iniciadoPor"]; }
          const { error } = await supabaseAdmin.from("pedidos").update({ pasos_tapicero: pasos } as never).eq("id", pedidoId);
          if (error) return json({ error: error.message }, 400);
          return json({ ok: true });
        }
        if (op === "cambio_visto") {
          // El tapicero da por vista la modificación (limpia el aviso).
          const pasos = { ...pasosActuales };
          delete pasos["@cambio"]; delete pasos["@cambioDetalle"];
          const { error } = await supabaseAdmin.from("pedidos").update({ pasos_tapicero: pasos } as never).eq("id", pedidoId);
          if (error) return json({ error: error.message }, 400);
          return json({ ok: true });
        }
        if (op === "medidas") {
          // Medidas del producto (largo/ancho, alto, fondo) en cm. Cada campo
          // es opcional: si no viene, no se toca; null/"" ⇒ sin especificar.
          const prodId = (pedido as { producto_lead_id?: string | null }).producto_lead_id;
          if (!prodId) return json({ error: "El pedido no tiene producto" }, 400);
          const medida = (v: unknown): number | null | undefined => {
            if (v === undefined) return undefined;
            if (v === null || v === "") return null;
            const n = Number(v);
            if (!Number.isFinite(n) || n <= 0 || n > 500) return undefined;
            return Math.round(n * 10) / 10;
          };
          const patch: Record<string, number | null> = {};
          const ancho = medida(body?.ancho), alto = medida(body?.alto), fondo = medida(body?.fondo);
          if (ancho !== undefined) patch.ancho = ancho;
          if (alto !== undefined) patch.alto = alto;
          if (fondo !== undefined) patch.fondo = fondo;
          if (Object.keys(patch).length === 0) return json({ error: "Sin medidas válidas" }, 400);
          const { error } = await supabaseAdmin.from("productos_lead").update(patch as never).eq("id", prodId);
          if (error) return json({ error: error.message }, 400);
          // Si lo corrige el EQUIPO desde el panel y el pedido sigue en el
          // taller, se avisa al tapicero igual que al editar desde Pedidos.
          if (esEquipo && pedido.tapicero_id && !(pedido as { entregado?: boolean }).entregado) {
            const pasos = { ...pasosActuales, "@cambio": ahora, "@cambioDetalle": "Cambió en el producto: medidas" };
            await supabaseAdmin.from("pedidos").update({ pasos_tapicero: pasos } as never).eq("id", pedidoId);
          }
          return json({ ok: true, medidas: patch });
        }
        if (op === "terminado") {
          const valor = body?.valor !== false;
          const pantalla = esPantalla(await tipoProducto());
          // Hito de la ruta de producción que equivale a "terminado" en el taller.
          const hitoCol = pantalla ? "pantalla_hecha" : "terminado_daniel";
          const hitoFechaCol = pantalla ? "pantalla_hecha_fecha" : "terminado_daniel_fecha";
          const hitoKey = pantalla ? "pantallaHecha" : "terminadoDaniel";
          const pasos = { ...pasosActuales };
          if (valor && pedido.tapicero_id) pasos[hitoKey] = pedido.tapicero_id as string; else delete pasos[hitoKey];
          const { error } = await supabaseAdmin.from("pedidos").update({
            terminado_tapicero: valor,
            terminado_tapicero_por: valor ? por : null,
            terminado_tapicero_fecha: valor ? ahora : null,
            [hitoCol]: valor,
            [hitoFechaCol]: valor ? (ped[hitoFechaCol] ?? ahora) : null,
            pasos_tapicero: pasos,
          } as never).eq("id", pedidoId);
          if (error) return json({ error: error.message }, 400);
          return json({ ok: true });
        }
        return json({ error: "Operación no reconocida" }, 400);
      },
    },
  },
});
