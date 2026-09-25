import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { avisarAsignacion } from "@/lib/aviso-profesional.server";

// ── Correo "Se te ha asignado un contacto" ──────────────────────────────────
// POST { leadId }. Lo llama el trigger de la BD `leads_aviso_asignacion`
// (pg_net) cuando un lead se crea o se reasigna a un vendedor con aviso
// (AVISAR_ASIGNACION_A). Autenticación: cabecera x-whatsapp-token =
// whatsapp_config.webhook_token (el mismo secreto que usa el cron de WhatsApp,
// para no añadir secretos nuevos).

const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { "Content-Type": "application/json" } });
const s = (v: unknown): string => (v == null ? "" : String(v));

function safeEqual(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export const Route = createFileRoute("/api/leads/aviso-asignacion")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const { data: cfg } = await supabaseAdmin.from("whatsapp_config").select("webhook_token").eq("id", 1).maybeSingle();
        if (!safeEqual(request.headers.get("x-whatsapp-token") ?? "", s((cfg as Record<string, unknown> | null)?.webhook_token))) {
          return json({ error: "No autorizado" }, 401);
        }
        const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
        const leadId = s(body.leadId);
        if (!/^[0-9a-f-]{36}$/i.test(leadId)) return json({ error: "Falta leadId" }, 400);
        // El formulario web escribe las notas justo después de crear el lead:
        // se espera un poco para incluir su mensaje en el correo.
        await new Promise((r) => setTimeout(r, 4000));
        const res = await avisarAsignacion(leadId, new URL(request.url).origin);
        return json(res);
      },
    },
  },
});
