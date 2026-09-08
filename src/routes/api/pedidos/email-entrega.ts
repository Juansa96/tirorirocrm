import { createFileRoute } from "@tanstack/react-router";
import { EmailAPIError, sendLovableEmail } from "@lovable.dev/email-js";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  htmlEmailEntrega, plainEmailEntrega, textoEmailEntrega,
  ENTREGA_FROM, ENTREGA_SENDER_DOMAIN, ENTREGA_TEMPLATE, ETIQUETA_RESENA_PEDIDA,
} from "@/lib/email-entrega";
import { PASO_EMAIL_ENTREGA, PASO_EMAIL_ENTREGA_A, PASO_EMAIL_ENTREGA_POR } from "@/lib/types";


// Correo de entrega al cliente. Lo dispara alguien del EQUIPO desde la ficha
// del pedido, después de revisar el texto: nunca sale solo.
//   POST { pedidoId, asunto?, mensaje?, para? }
//   `mensaje` es solo la parte personal (saludo + dos párrafos); el resto del
//   correo (pasos, premio, pie) lleva el diseño fijo de la web.
// Envía el correo por la API de correo de Lovable, deja constancia en
// email_send_log y en pasos_tapicero (@emailEntrega…) y pone la etiqueta
// "reseña pedida" al cliente. Sin columnas nuevas.
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

        const datos = {
          nombre: (lead as { nombre?: string } | null)?.nombre ?? "",
          tipo: (prod as { tipo?: string } | null)?.tipo ?? "",
          modelo: (prod as { modelo?: string } | null)?.modelo ?? "",
          cantidad: Number((prod as { cantidad?: number } | null)?.cantidad) || 1,
        };
        const porDefecto = textoEmailEntrega(datos);
        const asunto = String(body?.asunto ?? "").trim().slice(0, 150) || porDefecto.asunto;
        const mensaje = String(body?.mensaje ?? body?.texto ?? "").trim().slice(0, 4000) || porDefecto.mensaje;

        const ahora = new Date().toISOString();
        const messageId = crypto.randomUUID();
        const metadata = { pedido_id: pedidoId, enviado_por: u.user.email ?? u.user.id };
        const apiKey = process.env["LOVABLE_API_KEY"];
        if (!apiKey) return json({ error: "El envío de correo no está configurado" }, 500);

        const registrar = async (status: string, errorMessage?: string) => {
          const { error } = await supabaseAdmin.from("email_send_log").insert({
            message_id: messageId, template_name: ENTREGA_TEMPLATE, recipient_email: to,
            status, error_message: errorMessage ?? null, metadata,
          } as never);
          if (error) console.error("No se pudo registrar el envío", { code: error.code, message: error.message });
        };

        try {
          await sendLovableEmail(
            {
              to, from: ENTREGA_FROM, sender_domain: ENTREGA_SENDER_DOMAIN,
              subject: asunto, html: htmlEmailEntrega(datos, mensaje), text: plainEmailEntrega(datos, mensaje),
              purpose: "transactional", label: ENTREGA_TEMPLATE, idempotency_key: messageId,
            },
            { apiKey, sendUrl: process.env["LOVABLE_SEND_URL"] },
          );
        } catch (error) {
          if (error instanceof EmailAPIError && error.code === "recipient_suppressed") {
            await registrar("suppressed", "Dirección dada de baja o suprimida");
            return json({ error: "Esta dirección se dio de baja de nuestros correos (o rebotó). No se envía." }, 400);
          }
          const msg = error instanceof Error ? error.message : String(error);
          await registrar("failed", msg.slice(0, 1000));
          return json({ error: "No se pudo enviar el correo: " + msg }, 500);
        }
        await registrar("sent");

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
