// Correo "Se te ha asignado un contacto" (solo servidor). Petición de Juan
// (26/09/2026): cada vez que un lead pasa a ser suyo —formulario web de un
// profesional, reasignación a mano, lo que sea— le llega un correo para no
// olvidarse de contactarle. Lo dispara un trigger de la BD sobre `leads`
// (ver /api/leads/aviso-asignacion). Nunca rompe nada: si falla, se registra.

import { EmailAPIError, sendLovableEmail } from "@lovable.dev/email-js";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { ENTREGA_FROM, ENTREGA_SENDER_DOMAIN } from "@/lib/email-entrega";
import { VENDEDOR_PROFESIONALES } from "@/lib/lead-profesional";

/** Vendedores que reciben el correo al asignárseles un contacto. */
export const AVISAR_ASIGNACION_A = [VENDEDOR_PROFESIONALES];

const TEMPLATE = "aviso-asignacion";
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const s = (v: unknown) => (v == null ? "" : String(v).trim());

export async function avisarAsignacion(leadId: string, origenUrl: string): Promise<{ enviado: boolean; motivo?: string }> {
  const { data: lead } = await supabaseAdmin.from("leads")
    .select("id, nombre, email, telefono, ciudad, etapa, origen, vendedor, etiquetas").eq("id", leadId).maybeSingle();
  const l = lead as Record<string, unknown> | null;
  if (!l) return { enviado: false, motivo: "lead no encontrado" };
  const para = s(l.vendedor).toLowerCase();
  if (!AVISAR_ASIGNACION_A.includes(para)) return { enviado: false, motivo: "vendedor sin aviso" };

  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) return { enviado: false, motivo: "LOVABLE_API_KEY no configurada" };

  // Mensaje del formulario y motivo "profesional", si los hay (se escriben
  // justo después de crear el lead; la llamada llega unos segundos más tarde).
  const { data: notas } = await supabaseAdmin.from("notas").select("contenido, usuario")
    .eq("lead_id", leadId).in("usuario", ["formulario-web", "sistema"]).order("created_at", { ascending: true }).limit(10);
  const lista = (notas ?? []) as Array<{ contenido?: string; usuario?: string }>;
  const mensaje = s(lista.find((n) => n.usuario === "formulario-web")?.contenido).slice(0, 2000);
  const profesional = s(lista.find((n) => s(n.contenido).startsWith("💼"))?.contenido).replace(/^💼\s*/, "");

  const nombre = s(l.nombre) || "(sin nombre)";
  const asunto = `Se te ha asignado un contacto: ${nombre}`;
  const urlFicha = `${origenUrl}/clientes/${leadId}`;
  const filas: Array<[string, string]> = [
    ["Nombre", nombre], ["Teléfono", s(l.telefono)], ["Email", s(l.email)], ["Ciudad", s(l.ciudad)],
    ["Etapa", s(l.etapa)], ["Origen", s(l.origen)], ["Profesional", profesional],
  ];
  const visibles = filas.filter(([, v]) => v);
  const html = `<!doctype html><html><body style="margin:0;background:#f6f3ee;font-family:Arial,Helvetica,sans-serif;color:#1d3b45">
<div style="max-width:560px;margin:0 auto;padding:24px">
<h1 style="font-size:20px;margin:0 0 8px">Se te ha asignado un contacto</h1>
<p style="margin:0 0 16px;font-size:14px">${esc(nombre)} es tuyo en el CRM. <strong>No te olvides de contactarle.</strong></p>
<table style="width:100%;border-collapse:collapse;background:#fff;border-radius:8px;font-size:14px">
${visibles.map(([k, v]) => `<tr><td style="padding:8px 12px;color:#6b7c82;width:35%">${esc(k)}</td><td style="padding:8px 12px">${esc(v)}</td></tr>`).join("")}
</table>
${mensaje ? `<p style="margin:16px 0 4px;font-size:13px;color:#6b7c82">Lo que escribió en la web</p><div style="background:#fff;border-radius:8px;padding:12px;font-size:14px;white-space:pre-wrap">${esc(mensaje)}</div>` : ""}
<p style="margin:20px 0"><a href="${esc(urlFicha)}" style="background:#1d3b45;color:#fff;text-decoration:none;padding:10px 16px;border-radius:6px;font-size:14px">Abrir la ficha en el CRM</a></p>
<p style="font-size:12px;color:#6b7c82">Aviso automático del CRM de Tiroriro.</p>
</div></body></html>`;
  const text = `Se te ha asignado un contacto en el CRM. No te olvides de contactarle.\n\n${visibles.map(([k, v]) => `${k}: ${v}`).join("\n")}\n\n${mensaje ? `Lo que escribió en la web:\n${mensaje}\n\n` : ""}Ficha: ${urlFicha}`;

  const messageId = crypto.randomUUID();
  const registrar = async (status: string, errorMessage?: string) => {
    await supabaseAdmin.from("email_send_log").insert({
      message_id: messageId, template_name: TEMPLATE, recipient_email: para,
      status, error_message: errorMessage ?? null, metadata: { lead_id: leadId },
    } as never);
  };
  try {
    await sendLovableEmail(
      {
        to: para, from: ENTREGA_FROM, sender_domain: ENTREGA_SENDER_DOMAIN,
        subject: asunto, html, text, purpose: "transactional", label: TEMPLATE,
        // Un correo por lead y vendedor cada 10 minutos (evita duplicados por reintentos).
        idempotency_key: `asignacion-${leadId}-${para}-${Math.floor(Date.now() / 600_000)}`,
        reply_to: s(l.email) || undefined,
      },
      { apiKey, sendUrl: process.env["LOVABLE_SEND_URL"] },
    );
    await registrar("sent");
    return { enviado: true };
  } catch (error) {
    const msg = error instanceof EmailAPIError ? `${error.code}: ${error.message}` : error instanceof Error ? error.message : String(error);
    console.error("[aviso-asignacion]", msg);
    await registrar("failed", msg.slice(0, 1000));
    return { enviado: false, motivo: msg };
  }
}
