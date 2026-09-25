import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { conectarInstagram, guardarCanal } from "@/lib/whatsapp/canales.server";

// ── Conectar la cuenta de Instagram (solo admin) ────────────────────────────
// POST { accessToken, appSecret? } → comprueba la clave con Instagram,
// suscribe la cuenta a los mensajes directos y la guarda en
// mensajeria_canales. POST { desconectar: true } la borra.

const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { "Content-Type": "application/json" } });
const s = (v: unknown): string => (v == null ? "" : String(v));

async function esAdmin(request: Request): Promise<boolean> {
  const authz = request.headers.get("authorization") ?? "";
  const bearer = authz.toLowerCase().startsWith("bearer ") ? authz.slice(7) : "";
  if (!bearer) return false;
  const { data: u, error } = await supabaseAdmin.auth.getUser(bearer);
  if (error || !u?.user) return false;
  const { data: perfil } = await supabaseAdmin.from("perfiles").select("rol, activo").eq("id", u.user.id).maybeSingle();
  return !!perfil && perfil.activo !== false && String(perfil.rol) === "admin";
}

export const Route = createFileRoute("/api/instagram/config")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        if (!(await esAdmin(request))) return json({ error: "Solo un administrador puede conectar Instagram" }, 401);
        const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
        try {
          if (body.desconectar === true) {
            await guardarCanal("instagram", { datos: { access_token: "", app_secret: "", usuario: "", cuenta_id: "" }, conectado_at: null });
            return json({ ok: true });
          }
          const r = await conectarInstagram(s(body.accessToken), s(body.appSecret));
          return json({ ok: true, usuario: r.usuario });
        } catch (e) {
          return json({ error: e instanceof Error ? e.message : String(e) }, 400);
        }
      },
    },
  },
});
