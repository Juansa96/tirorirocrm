import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { conectarMetaAds, configMetaAds, desconectarMetaAds, instantaneaMetaAds, sincronizarMetaAds } from "@/lib/metaads.server";
import { leerCanal } from "@/lib/whatsapp/canales.server";

// ── Anuncios de Meta: clave de solo lectura para el parte (solo admin) ──────
// GET → estado (cuenta, última sincronización, nº de anuncios y fotos, error).
// POST { token, cuenta } → comprueba la clave, la guarda y sincroniza ya.
// POST { sincronizar: true } → sincroniza ahora. POST { desconectar: true }.

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

async function estado() {
  const { token, cuenta } = await configMetaAds();
  const fila = await leerCanal("instagram");
  const inst = await instantaneaMetaAds();
  return {
    conectado: !!token,
    cuenta,
    nombre: s(fila?.datos.meta_ads_nombre),
    error: s(fila?.datos.meta_ads_error),
    sincronizadoAt: inst?.sincronizado_at ?? "",
    anuncios: inst?.anuncios.length ?? 0,
    fotos: inst?.anuncios.filter((a) => a.foto).length ?? 0,
  };
}

export const Route = createFileRoute("/api/metaads/config")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        if (!(await esAdmin(request))) return json({ error: "Solo un administrador" }, 401);
        return json(await estado());
      },
      POST: async ({ request }: { request: Request }) => {
        if (!(await esAdmin(request))) return json({ error: "Solo un administrador puede conectar los anuncios de Meta" }, 401);
        const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
        try {
          if (body.desconectar === true) await desconectarMetaAds();
          else {
            if (body.sincronizar !== true) await conectarMetaAds(s(body.token), s(body.cuenta));
            await sincronizarMetaAds({ forzar: true });
          }
          return json({ ok: true, ...(await estado()) });
        } catch (e) {
          return json({ error: e instanceof Error ? e.message : String(e) }, 400);
        }
      },
    },
  },
});
