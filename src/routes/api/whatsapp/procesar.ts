import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { procesarConversaciones } from "@/lib/whatsapp/procesar.server";

// ── Análisis de conversaciones de WhatsApp con IA ───────────────────────────
// POST { conversacionId?, forzar?, limite? }
// Lo llama:
//   · el cron de la base de datos (pg_cron + pg_net) cada 2 minutos, con la
//     cabecera x-whatsapp-token = whatsapp_config.webhook_token;
//   · la bandeja /whatsapp del CRM (usuario del equipo, Bearer token) para
//     "Analizar ahora" una conversación concreta o todo lo pendiente.
// Por llamada se analizan como mucho unas pocas conversaciones (el resto
// espera al siguiente tick), así ninguna petición se alarga demasiado.

const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { "Content-Type": "application/json" } });
const s = (v: unknown): string => (v == null ? "" : String(v));

function safeEqual(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function autorizado(request: Request): Promise<boolean> {
  const { data: cfg } = await supabaseAdmin.from("whatsapp_config").select("webhook_token").eq("id", 1).maybeSingle();
  const token = request.headers.get("x-whatsapp-token") ?? "";
  if (cfg && safeEqual(token, s((cfg as Record<string, unknown>).webhook_token))) return true;

  const authz = request.headers.get("authorization") ?? "";
  const bearer = authz.toLowerCase().startsWith("bearer ") ? authz.slice(7) : "";
  if (!bearer) return false;
  const { data: u, error } = await supabaseAdmin.auth.getUser(bearer);
  if (error || !u?.user) return false;
  const { data: perfil } = await supabaseAdmin.from("perfiles").select("rol, activo").eq("id", u.user.id).maybeSingle();
  return !!perfil && perfil.activo !== false && ["admin", "equipo"].includes(String(perfil.rol));
}

export const Route = createFileRoute("/api/whatsapp/procesar")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        if (!(await autorizado(request))) return json({ error: "No autorizado" }, 401);
        const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
        const conversacionId = s(body.conversacionId) || undefined;
        const forzar = body.forzar === true;
        const limite = Number(body.limite) || undefined;
        try {
          const informe = await procesarConversaciones({ conversacionId, forzar, limite, debounceSeg: forzar ? 0 : undefined });
          return json(informe);
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          console.error("[whatsapp/procesar]", msg);
          return json({ error: msg }, 500);
        }
      },
    },
  },
});
