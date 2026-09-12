import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { esPantalla, estadoDePedido, patchParaEstado, conAntes, ESTADOS_PEDIDO, ESTADO_ENTREGADO_CLIENTE, type EstadoPedido, type PatchEstado } from "@/lib/types";
import { medidasEtiquetadas } from "@/lib/catalogo";

// Acciones del tapicero sobre SUS pedidos (o del equipo sobre cualquiera).
// El tapicero es solo-lectura a nivel de BD; estas escrituras pasan por aquí,
// validando el token y la propiedad del pedido.
//   POST { op: "estado", pedidoId, estado }  → cambia el estado del pedido
//        (Pendiente | En marcha | Terminado | Recogido | Entregado al cliente).
//        El tapicero puede moverse entre los cuatro primeros, hacia delante o
//        hacia atrás (por si se equivoca); "Entregado al cliente" es solo del
//        equipo (para él ese estado no existe).
//   POST { op: "tela_recibida", pedidoId, valor? }
//   POST { op: "medidas", pedidoId, ancho?, alto?, fondo? }  → corrige las medidas
//        del PRODUCTO del pedido (productos_lead.ancho/alto/fondo). Es la misma
//        fila que editan Clientes y Pedidos: no hay copia en el pedido. El valor
//        anterior queda apuntado para enseñarlo tachado en la card.
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json" } });

// Columnas de `pedidos` que toca un cambio de estado (camelCase → snake_case).
const COL_ESTADO: Record<keyof PatchEstado, string> = {
  pasosTapicero: "pasos_tapicero",
  terminadoTapicero: "terminado_tapicero", terminadoTapiceroPor: "terminado_tapicero_por", terminadoTapiceroFecha: "terminado_tapicero_fecha",
  terminadoDaniel: "terminado_daniel", terminadoDanielFecha: "terminado_daniel_fecha",
  pantallaHecha: "pantalla_hecha", pantallaHechaFecha: "pantalla_hecha_fecha",
  enviadoDaniel: "enviado_daniel", enviadoDanielFecha: "enviado_daniel_fecha",
  entregado: "entregado", entregadoFecha: "entregado_fecha",
};

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
        // recogido / valores anteriores (claves con prefijo "@"), sin columnas nuevas.
        const { data: pedido } = await supabaseAdmin.from("pedidos")
          .select("id, tapicero_id, pasos_tapicero, producto_lead_id, entregado, entregado_fecha, tela_recibida, tela_recibida_fecha, enviar_tela_daniel, enviar_tela_daniel_fecha, terminado_tapicero, terminado_tapicero_por, terminado_tapicero_fecha, terminado_daniel, terminado_daniel_fecha, pantalla_hecha, pantalla_hecha_fecha, enviado_daniel, enviado_daniel_fecha")
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

        const pasosActuales = (pedido.pasos_tapicero && typeof pedido.pasos_tapicero === "object"
          ? pedido.pasos_tapicero : {}) as Record<string, string>;
        const ped = pedido as Record<string, unknown>;

        // Vista camelCase del pedido para las reglas compartidas con el cliente.
        const fuente = {
          entregado: !!ped.entregado, entregadoFecha: (ped.entregado_fecha as string) ?? "",
          terminadoTapicero: !!ped.terminado_tapicero, terminadoTapiceroPor: (ped.terminado_tapicero_por as string) ?? "", terminadoTapiceroFecha: (ped.terminado_tapicero_fecha as string) ?? "",
          terminadoDaniel: !!ped.terminado_daniel, terminadoDanielFecha: (ped.terminado_daniel_fecha as string) ?? "",
          pantallaHecha: !!ped.pantalla_hecha, pantallaHechaFecha: (ped.pantalla_hecha_fecha as string) ?? "",
          enviadoDaniel: !!ped.enviado_daniel, enviadoDanielFecha: (ped.enviado_daniel_fecha as string) ?? "",
          pasosTapicero: pasosActuales,
          tapiceroId: (ped.tapicero_id as string) ?? "",
        };
        const estadoActual = estadoDePedido(fuente);

        // El tapicero no ve (ni toca) los pedidos ya entregados al cliente.
        if (esTapicero && estadoActual === ESTADO_ENTREGADO_CLIENTE) return json({ error: "Este pedido ya no está en tu panel" }, 403);

        const producto = async (): Promise<{ tipo: string; modelo: string; ancho: number | null; alto: number | null; fondo: number | null } | null> => {
          if (!ped.producto_lead_id) return null;
          const { data: pr } = await supabaseAdmin.from("productos_lead").select("tipo, modelo, ancho, alto, fondo").eq("id", ped.producto_lead_id as string).maybeSingle();
          if (!pr) return null;
          const r = pr as Record<string, unknown>;
          return { tipo: String(r.tipo ?? ""), modelo: String(r.modelo ?? ""), ancho: (r.ancho as number | null) ?? null, alto: (r.alto as number | null) ?? null, fondo: (r.fondo as number | null) ?? null };
        };

        if (op === "estado") {
          const estado = String(body?.estado ?? "") as EstadoPedido;
          if (!(ESTADOS_PEDIDO as readonly string[]).includes(estado)) return json({ error: "Estado no válido" }, 400);
          if (esTapicero && estado === ESTADO_ENTREGADO_CLIENTE) return json({ error: "Solo el equipo puede marcar la entrega al cliente" }, 403);
          const prod = await producto();
          const patch = patchParaEstado(fuente, estado, { por, ahora, tipoProducto: prod?.tipo ?? "" });
          const upd: Record<string, unknown> = {};
          for (const [k, v] of Object.entries(patch)) {
            const col = COL_ESTADO[k as keyof PatchEstado];
            if (col) upd[col] = v === "" ? null : v;
          }
          if (Object.keys(upd).length === 0) return json({ ok: true, estado });
          const { error } = await supabaseAdmin.from("pedidos").update(upd as never).eq("id", pedidoId);
          if (error) return json({ error: error.message }, 400);
          return json({ ok: true, estado });
        }
        if (op === "tela_recibida") {
          const valor = body?.valor !== false; // por defecto true
          const prod = await producto();
          const pantalla = esPantalla(prod?.tipo ?? "");
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
          const prod = await producto();
          const { error } = await supabaseAdmin.from("productos_lead").update(patch as never).eq("id", prodId);
          if (error) return json({ error: error.message }, 400);
          // Valor anterior tachado en la card (mientras el pedido no esté recogido).
          if (prod && estadoActual !== "Recogido" && estadoActual !== ESTADO_ENTREGADO_CLIENTE) {
            const texto = (m: { ancho: number | null; alto: number | null; fondo: number | null }) => {
              const e = medidasEtiquetadas(prod.tipo, prod.modelo, m.ancho, m.alto, m.fondo);
              return [e.texto, e.extra].filter(Boolean).join(" · ").replace(/\u00a0/g, " ");
            };
            const antes = texto(prod);
            const despues = texto({ ancho: patch.ancho ?? prod.ancho, alto: patch.alto ?? prod.alto, fondo: patch.fondo ?? prod.fondo });
            if (antes !== despues) {
              const pasos = conAntes(pasosActuales, { medidas: antes || "—" });
              await supabaseAdmin.from("pedidos").update({ pasos_tapicero: pasos } as never).eq("id", pedidoId);
            }
          }
          return json({ ok: true, medidas: patch });
        }
        return json({ error: "Operación no reconocida" }, 400);
      },
    },
  },
});
