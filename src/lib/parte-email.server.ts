// Email del parte diario de marketing (solo servidor). Juan (02/10/2026) quiere
// las fotos de los anuncios dentro del correo; la herramienta de Gmail que usa
// la rutina de Claude borra todas las imágenes, así que el correo lo manda el
// CRM. La rutina deja el email listo en `whatsapp_eventos` (campo
// 'parte_email', payload { para, asunto, html, texto }) y el trigger de la BD
// `whatsapp_eventos_parte_email` (pg_net) llama a /api/parte/enviar con su id.
// El resultado se guarda en el mismo payload (estado, enviados, error).

import { EmailAPIError, sendLovableEmail } from "@lovable.dev/email-js";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { ENTREGA_FROM, ENTREGA_SENDER_DOMAIN } from "@/lib/email-entrega";

/** Solo el equipo: el parte no sale nunca a otras direcciones. */
export const PARTE_PARA_PERMITIDOS = ["sangradortorresjuan@gmail.com", "info@tirorirohome.com"];

const TEMPLATE = "parte_marketing";
const s = (v: unknown) => (v == null ? "" : String(v).trim());

export async function enviarParte(id: number): Promise<{ enviados: string[]; errores: string[]; motivo?: string }> {
  const { data } = await supabaseAdmin.from("whatsapp_eventos").select("id, campo, payload").eq("id", id).maybeSingle();
  const fila = data as { campo?: string; payload?: Record<string, unknown> } | null;
  if (!fila || fila.campo !== "parte_email") return { enviados: [], errores: [], motivo: "no es un parte" };
  const p = fila.payload ?? {};
  if (p.estado === "enviado") return { enviados: [], errores: [], motivo: "ya enviado" };

  const apiKey = process.env["LOVABLE_API_KEY"];
  const asunto = s(p.asunto).slice(0, 200);
  const html = s(p.html);
  const texto = s(p.texto) || "Parte de marketing de Tiroriro.";
  const para = (Array.isArray(p.para) ? p.para : []).map((x) => s(x).toLowerCase()).filter((x) => PARTE_PARA_PERMITIDOS.includes(x));

  const guardar = async (cambios: Record<string, unknown>) => {
    await supabaseAdmin.from("whatsapp_eventos").update({ payload: { ...p, ...cambios } } as never).eq("id", id);
  };
  if (!apiKey) { await guardar({ estado: "error", error: "LOVABLE_API_KEY no configurada" }); return { enviados: [], errores: [], motivo: "sin clave" }; }
  if (!asunto || !html || !para.length) { await guardar({ estado: "error", error: "faltan asunto, html o destinatarios" }); return { enviados: [], errores: [], motivo: "incompleto" }; }

  const enviados: string[] = [];
  const errores: string[] = [];
  for (const to of para) {
    const messageId = crypto.randomUUID();
    let status = "sent";
    let errorMessage: string | null = null;
    try {
      await sendLovableEmail(
        {
          to, from: ENTREGA_FROM, sender_domain: ENTREGA_SENDER_DOMAIN,
          subject: asunto, html, text: texto, purpose: "transactional", label: TEMPLATE,
          idempotency_key: `parte-${id}-${to}`,
        },
        { apiKey, sendUrl: process.env["LOVABLE_SEND_URL"] },
      );
      enviados.push(to);
    } catch (error) {
      status = "failed";
      errorMessage = (error instanceof EmailAPIError ? `${error.code}: ${error.message}` : error instanceof Error ? error.message : String(error)).slice(0, 1000);
      errores.push(`${to}: ${errorMessage}`);
      console.error("[parte-email]", errorMessage);
    }
    await supabaseAdmin.from("email_send_log").insert({
      message_id: messageId, template_name: TEMPLATE, recipient_email: to,
      status, error_message: errorMessage, metadata: { evento_id: id },
    } as never);
  }
  await guardar({ estado: errores.length ? (enviados.length ? "parcial" : "error") : "enviado", enviados, error: errores.join(" · ") || null, enviado_at: new Date().toISOString() });
  return { enviados, errores };
}
