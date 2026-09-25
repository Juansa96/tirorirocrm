// Correo a Juan cuando entra por la web un lead PROFESIONAL (ver
// lead-profesional.ts): para que no se quede sin responder. Solo servidor.
// Nunca rompe el alta del lead: si falla, se registra y se sigue.

import { EmailAPIError, sendLovableEmail } from "@lovable.dev/email-js";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { ENTREGA_FROM, ENTREGA_SENDER_DOMAIN } from "@/lib/email-entrega";
import { VENDEDOR_PROFESIONALES } from "@/lib/lead-profesional";

const TEMPLATE = "aviso-lead-profesional";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export interface DatosAvisoProfesional {
  leadId: string;
  nombre: string;
  email: string;
  telefono: string;
  ciudad: string;
  mensaje: string;
  motivo: string;
  urlFicha: string;
}

export async function avisarLeadProfesional(d: DatosAvisoProfesional): Promise<void> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) { console.error("[aviso-profesional] LOVABLE_API_KEY no configurada"); return; }

  const asunto = `💼 Profesional por la web: ${d.nombre} — pendiente de responder`;
  const filas: Array<[string, string]> = [
    ["Nombre", d.nombre], ["Email", d.email], ["Teléfono", d.telefono], ["Ciudad", d.ciudad], ["Por qué parece profesional", d.motivo],
  ];
  const html = `<!doctype html><html><body style="margin:0;background:#f6f3ee;font-family:Arial,Helvetica,sans-serif;color:#1d3b45">
<div style="max-width:560px;margin:0 auto;padding:24px">
<h1 style="font-size:20px;margin:0 0 8px">Nuevo lead profesional en el CRM</h1>
<p style="margin:0 0 16px;font-size:14px">Ha entrado por el formulario de la web y te lo he asignado. <strong>Recuerda responderle.</strong></p>
<table style="width:100%;border-collapse:collapse;background:#fff;border-radius:8px;font-size:14px">
${filas.filter(([, v]) => v).map(([k, v]) => `<tr><td style="padding:8px 12px;color:#6b7c82;width:40%">${esc(k)}</td><td style="padding:8px 12px">${esc(v)}</td></tr>`).join("")}
</table>
${d.mensaje ? `<p style="margin:16px 0 4px;font-size:13px;color:#6b7c82">Mensaje</p><div style="background:#fff;border-radius:8px;padding:12px;font-size:14px;white-space:pre-wrap">${esc(d.mensaje)}</div>` : ""}
<p style="margin:20px 0"><a href="${esc(d.urlFicha)}" style="background:#1d3b45;color:#fff;text-decoration:none;padding:10px 16px;border-radius:6px;font-size:14px">Abrir la ficha en el CRM</a></p>
<p style="font-size:12px;color:#6b7c82">Aviso automático del CRM de Tiroriro.</p>
</div></body></html>`;
  const text = `Nuevo lead profesional en el CRM. Te lo he asignado: recuerda responderle.\n\n${filas.filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join("\n")}\n\n${d.mensaje ? `Mensaje:\n${d.mensaje}\n\n` : ""}Ficha: ${d.urlFicha}`;

  const messageId = crypto.randomUUID();
  const registrar = async (status: string, errorMessage?: string) => {
    await supabaseAdmin.from("email_send_log").insert({
      message_id: messageId, template_name: TEMPLATE, recipient_email: VENDEDOR_PROFESIONALES,
      status, error_message: errorMessage ?? null, metadata: { lead_id: d.leadId },
    } as never);
  };
  try {
    await sendLovableEmail(
      {
        to: VENDEDOR_PROFESIONALES, from: ENTREGA_FROM, sender_domain: ENTREGA_SENDER_DOMAIN,
        subject: asunto, html, text, purpose: "transactional", label: TEMPLATE,
        idempotency_key: `aviso-profesional-${d.leadId}`, reply_to: d.email || undefined,
      },
      { apiKey, sendUrl: process.env["LOVABLE_SEND_URL"] },
    );
    await registrar("sent");
  } catch (error) {
    const msg = error instanceof EmailAPIError ? `${error.code}: ${error.message}` : error instanceof Error ? error.message : String(error);
    console.error("[aviso-profesional]", msg);
    await registrar("failed", msg.slice(0, 1000));
  }
}
