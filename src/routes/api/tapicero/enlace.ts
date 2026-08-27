import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Canjea el token de acceso por enlace del tapicero por un magiclink (token_hash)
// que el cliente verifica para abrir una sesión real. Así la RLS y el panel
// existente funcionan sin accesos anónimos ni duplicar el panel.
//   POST { token }  →  { ok, tokenHash }
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json" } });

export const Route = createFileRoute("/api/tapicero/enlace")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const body = await request.json().catch(() => null) as { token?: unknown } | null;
        const token = String(body?.token ?? "").trim();
        if (!token || token.length < 20) return json({ error: "Enlace no válido" }, 400);

        // Token → tapicero (activo). Las columnas access_token* aún no están en
        // los tipos generados de Supabase; se consulta con un builder laxo.
        const tapiceros = supabaseAdmin.from("tapiceros") as unknown as {
          select(cols: string): { eq(c: string, v: string): { maybeSingle(): Promise<{ data: Record<string, unknown> | null }> } };
        };
        const { data: tap } = await tapiceros.select("id, access_token_activo").eq("access_token", token).maybeSingle();
        if (!tap || tap.access_token_activo === false) return json({ error: "Enlace caducado o revocado" }, 401);
        const tapiceroId = tap.id as string;

        // Tapicero → usuario de acceso (perfil rol tapicero, activo).
        const { data: perfil } = await supabaseAdmin.from("perfiles")
          .select("id").eq("tapicero_id", tapiceroId).eq("rol", "tapicero").eq("activo", true).maybeSingle();
        if (!perfil) return json({ error: "Este tapicero no tiene acceso configurado. Avisa al equipo." }, 409);

        const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(perfil.id as string);
        const email = authUser?.user?.email;
        if (!email) return json({ error: "Sin email de acceso" }, 409);

        // Magiclink de admin: NO envía correo; devuelve el token_hash a verificar.
        const { data: link, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({ type: "magiclink", email });
        const tokenHash = link?.properties?.hashed_token;
        if (linkErr || !tokenHash) return json({ error: "No se pudo abrir la sesión" }, 500);

        return json({ ok: true, tokenHash });
      },
    },
  },
});
