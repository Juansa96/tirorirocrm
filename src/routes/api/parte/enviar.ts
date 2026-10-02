import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { enviarParte } from "@/lib/parte-email.server";

// ── Email del parte diario de marketing ─────────────────────────────────────
// POST { id }. Lo llama el trigger de la BD `whatsapp_eventos_parte_email`
// (pg_net) cuando la rutina de Claude guarda un email en whatsapp_eventos
// (campo 'parte_email'). Autenticación: cabecera x-whatsapp-token =
// whatsapp_config.webhook_token (como /api/leads/aviso-asignacion).

const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { "Content-Type": "application/json" } });
const s = (v: unknown): string => (v == null ? "" : String(v));

function safeEqual(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export const Route = createFileRoute("/api/parte/enviar")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const { data: cfg } = await supabaseAdmin.from("whatsapp_config").select("webhook_token").eq("id", 1).maybeSingle();
        if (!safeEqual(request.headers.get("x-whatsapp-token") ?? "", s((cfg as Record<string, unknown> | null)?.webhook_token))) {
          return json({ error: "No autorizado" }, 401);
        }
        const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
        const id = Number(body.id);
        if (!Number.isInteger(id) || id <= 0) return json({ error: "Falta id" }, 400);
        return json(await enviarParte(id));
      },
    },
  },
});
