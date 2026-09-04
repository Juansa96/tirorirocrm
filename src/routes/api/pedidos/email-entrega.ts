import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  htmlEmailEntrega, plainEmailEntrega, textoEmailEntrega,
  ENTREGA_FROM, ENTREGA_SENDER_DOMAIN, ENTREGA_TEMPLATE, ETIQUETA_RESENA_PEDIDA,
} from "@/lib/email-entrega";
import { PASO_EMAIL_ENTREGA, PASO_EMAIL_ENTREGA_A, PASO_EMAIL_ENTREGA_POR } from "@/lib/types";
import { obtenerTokenBaja, emailSuprimido } from "@/lib/email-baja.server";

// Correo de entrega al cliente. Lo dispara alguien del EQUIPO desde la ficha
// del pedido, después de revisar el texto: nunca sale solo.
//   POST { pedidoId, asunto?, texto?, para? }
// Encola el correo por la misma cola que el aviso al tapicero (enqueue_email +
// email_send_log), deja constancia en pasos_tapicero (@emailEntrega…) y pone
// la etiqueta "reseña pedida" al cliente. Sin columnas nuevas.
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json" } });
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const Route = createFileRoute("/api/pedidos/email-entrega")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const authz = request.headers.get("authorization") ?? "";
        const token = authz.toLowerCase().startsWith("bearer ") ? authz.slice(7) : "";
        if (!token) return json({ error: "No autorizado" }, 401);
        const { data: u, error: uErr } = await supabaseAdmin.auth.getUser(token);
        if (uErr || !u?.user) return json({ error: "No autorizado" }, 401);
        const { data: perfil } = await supabaseAdmin.from("perfiles").select("rol, activo").eq("id", u.user.id).maybeSingle();
        if (!perfil || perfil.activo === false || !["admin", "equipo"].includes(perfil.rol as string)) {
          return json({ error: "Solo el equipo puede enviar este correo" }, 403);
        }

        const body = await request.json().catch(() => null) as Record<string, unknown> | null;
        const pedidoId = String(body?.pedidoId ?? "");
        if (!pedidoId) return json({ error: "Falta pedidoId" }, 400);

        const { data: pedido } = await supabaseAdmin.from("pedidos")
          .select("id, lead_id, producto_lead_id, entregado, pasos_tapicero").eq("id", pedidoId).maybeSingle();
        if (!pedido) return json({ error: "Pedido no encontrado" }, 404);
        if (!(pedido as { entregado?: boolean }).entregado) return json({ error: "El pedido aún no está entregado" }, 400);

        const leadId = (pedido as { lead_id?: string | null }).lead_id;
        const { data: lead } = leadId
          ? await supabaseAdmin.from("leads").select("id, nombre, email, etiquetas").eq("id", leadId).maybeSingle()
          : { data: null };
        const prodId = (pedido as { producto_lead_id?: string | null }).producto_lead_id;
        const { data: prod } = prodId
          ? await supabaseAdmin.from("productos_lead").select("tipo, modelo, cantidad").eq("id", prodId).maybeSingle()
          : { data: null };

        // Destinatario: el correo del cliente, salvo que el equipo escriba otro
        // (p. ej. un envío de prueba a la propia dirección).
        const to = String(body?.para ?? (lead as { email?: string } | null)?.email ?? "").trim().toLowerCase();
        if (!EMAIL_RE.test(to)) return json({ error: "El cliente no tiene un correo válido" }, 400);
        if (await emailSuprimido(supabaseAdmin, to)) return json({ error: "Esta dirección se dio de baja de nuestros correos (o rebotó). No se envía." }, 400);
        const unsubscribeToken = await obtenerTokenBaja(supabaseAdmin, to);
        if (!unsubscribeToken) return json({ error: "No se pudo preparar el enlace de baja del correo" }, 500);

        const porDefecto = textoEmailEntrega({
          nombre: (lead as { nombre?: string } | null)?.nombre ?? "",
          tipo: (prod as { tipo?: string } | null)?.tipo ?? "",
          modelo: (prod as { modelo?: string } | null)?.modelo ?? "",
          cantidad: Number((prod as { cantidad?: number } | null)?.cantidad) || 1,
        });
        const asunto = String(body?.asunto ?? "").trim().slice(0, 150) || porDefecto.asunto;
        const texto = String(body?.texto ?? "").trim().slice(0, 6000) || porDefecto.texto;

        const ahora = new Date().toISOString();
        const messageId = crypto.randomUUID();
        await supabaseAdmin.from("email_send_log").insert({
          message_id: messageId, template_name: ENTREGA_TEMPLATE, recipient_email: to, status: "pending",
          metadata: { pedido_id: pedidoId, enviado_por: u.user.email ?? u.user.id },
        } as never);
        const { error: encErr } = await supabaseAdmin.rpc("enqueue_email", {
          queue_name: "transactional_emails",
          payload: {
            // Sin run_id: la API de Lovable lo valida contra una ejecución real y
            // rechaza cualquier uuid inventado ("Run not found or expired").
            message_id: messageId, idempotency_key: messageId, to, from: ENTREGA_FROM, sender_domain: ENTREGA_SENDER_DOMAIN,
            subject: asunto, html: htmlEmailEntrega(texto), text: plainEmailEntrega(texto),
            purpose: "transactional", label: ENTREGA_TEMPLATE, queued_at: ahora,
            unsubscribe_token: unsubscribeToken,
          },
        });
        if (encErr) return json({ error: "No se pudo encolar el correo: " + encErr.message }, 500);

        // Constancia en el pedido (marcadores "@" en pasos_tapicero, sin migración).
        const pasos = { ...((pedido as { pasos_tapicero?: Record<string, string> | null }).pasos_tapicero ?? {}) };
        pasos[PASO_EMAIL_ENTREGA] = ahora;
        pasos[PASO_EMAIL_ENTREGA_A] = to;
        pasos[PASO_EMAIL_ENTREGA_POR] = u.user.email ?? "equipo";
        await supabaseAdmin.from("pedidos").update({ pasos_tapicero: pasos } as never).eq("id", pedidoId);

        // Etiqueta al cliente para seguir el premio a mano.
        if (lead) {
          const etq = Array.isArray((lead as { etiquetas?: unknown }).etiquetas) ? [...((lead as { etiquetas: string[] }).etiquetas)] : [];
          if (!etq.includes(ETIQUETA_RESENA_PEDIDA)) {
            etq.push(ETIQUETA_RESENA_PEDIDA);
            await supabaseAdmin.from("leads").update({ etiquetas: etq } as never).eq("id", (lead as { id: string }).id);
          }
        }

        return json({ ok: true, to, messageId });
      },
    },
  },
});
