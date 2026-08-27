import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// ── Gestión de usuarios (solo equipo) ───────────────────────────────────────
// Ruta de servidor con service_role. Valida SIEMPRE que quien llama es del
// equipo (admin/equipo) leyendo su token. El rol tapicero jamás llega aquí.
//
//   GET  → lista de usuarios (equipo + tapiceros) con rol/estado.
//   POST → { op: "create" | "password" | "activo", ... }
//     create:   { email, password, tapiceroId }         crea un usuario tapicero
//     password: { id, password }                          resetea la contraseña
//     activo:   { id, activo }                            activa / desactiva

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

// Devuelve el uid si el llamante es equipo; si no, una Response de error.
async function requireEquipo(request: Request): Promise<{ uid: string } | Response> {
  const authz = request.headers.get("authorization") ?? "";
  const token = authz.toLowerCase().startsWith("bearer ") ? authz.slice(7) : "";
  if (!token) return json({ error: "No autorizado" }, 401);
  const { data: userData, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !userData?.user) return json({ error: "No autorizado" }, 401);
  const { data: perfil } = await supabaseAdmin
    .from("perfiles").select("rol, activo").eq("id", userData.user.id).maybeSingle();
  if (!perfil || perfil.activo === false || !["admin", "equipo"].includes(perfil.rol as string)) {
    return json({ error: "Solo el equipo puede gestionar usuarios" }, 403);
  }
  return { uid: userData.user.id };
}

const ROLES_VALIDOS = ["admin", "equipo", "tapicero"] as const;

// Lista TODOS los usuarios de auth, tengan perfil o no. Los que no lo tienen
// aparecen con rol "" (sin acceso) para poder asignárselo desde la app.
async function listUsers(): Promise<Response> {
  const { data: perfiles } = await supabaseAdmin.from("perfiles").select("id, rol, tapicero_id, activo");
  const { data: authList } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
  const perfilById = new Map((perfiles ?? []).map((p) => [p.id as string, p]));
  const rows = (authList?.users ?? []).map((u) => {
    const p = perfilById.get(u.id);
    return {
      id: u.id,
      email: u.email ?? "",
      rol: (p?.rol as string) ?? "",
      tapiceroId: (p?.tapicero_id as string) ?? "",
      activo: p ? p.activo !== false : false,
    };
  });
  return json({ usuarios: rows });
}

export const Route = createFileRoute("/api/admin/usuarios")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        const auth = await requireEquipo(request);
        if (auth instanceof Response) return auth;
        return listUsers();
      },
      POST: async ({ request }: { request: Request }) => {
        const auth = await requireEquipo(request);
        if (auth instanceof Response) return auth;
        const body = await request.json().catch(() => null) as Record<string, unknown> | null;
        const op = String(body?.op ?? "");

        if (op === "create") {
          const email = String(body?.email ?? "").trim().toLowerCase();
          const password = String(body?.password ?? "");
          const tapiceroId = String(body?.tapiceroId ?? "").trim();
          const rol = String(body?.rol ?? "tapicero");
          if (!ROLES_VALIDOS.includes(rol as (typeof ROLES_VALIDOS)[number])) {
            return json({ error: "Rol no válido" }, 400);
          }
          if (!email || password.length < 8 || (rol === "tapicero" && !tapiceroId)) {
            return json({ error: "Faltan datos (email, contraseña ≥ 8, tapicero)" }, 400);
          }
          const { data: created, error: cErr } = await supabaseAdmin.auth.admin.createUser({
            email, password, email_confirm: true,
          });
          if (cErr || !created?.user) return json({ error: cErr?.message ?? "No se pudo crear el usuario" }, 400);
          const { error: pErr } = await supabaseAdmin.from("perfiles").insert({
            id: created.user.id, rol, tapicero_id: rol === "tapicero" ? tapiceroId : null, activo: true,
          });
          if (pErr) {
            // Rollback del usuario auth si el perfil falla.
            await supabaseAdmin.auth.admin.deleteUser(created.user.id);
            return json({ error: "No se pudo crear el perfil: " + pErr.message }, 400);
          }
          return json({ ok: true, id: created.user.id }, 201);
        }

        // Asigna / cambia el rol de un usuario ya existente en auth (incluye
        // cuentas sin perfil, que de otro modo quedarían sin acceso).
        if (op === "rol") {
          const id = String(body?.id ?? "");
          const rol = String(body?.rol ?? "");
          const tapiceroId = String(body?.tapiceroId ?? "").trim();
          if (!id) return json({ error: "Falta id" }, 400);
          if (!ROLES_VALIDOS.includes(rol as (typeof ROLES_VALIDOS)[number])) {
            return json({ error: "Rol no válido" }, 400);
          }
          if (rol === "tapicero" && !tapiceroId) return json({ error: "Falta el tapicero" }, 400);
          const { data: user, error: uErr } = await supabaseAdmin.auth.admin.getUserById(id);
          if (uErr || !user?.user) return json({ error: "Usuario no encontrado" }, 404);
          const { error } = await supabaseAdmin.from("perfiles").upsert({
            id, rol, tapicero_id: rol === "tapicero" ? tapiceroId : null, activo: true,
          }, { onConflict: "id" });
          if (error) return json({ error: error.message }, 400);
          await supabaseAdmin.auth.admin.updateUserById(id, { ban_duration: "none" });
          return json({ ok: true });
        }

        if (op === "password") {
          const id = String(body?.id ?? "");
          const password = String(body?.password ?? "");
          if (!id || password.length < 8) return json({ error: "Contraseña mínima 8 caracteres" }, 400);
          const { error } = await supabaseAdmin.auth.admin.updateUserById(id, { password });
          if (error) return json({ error: error.message }, 400);
          return json({ ok: true });
        }

        if (op === "delete") {
          const id = String(body?.id ?? "");
          if (!id) return json({ error: "Falta id" }, 400);
          if (id === auth.uid) return json({ error: "No puedes borrarte a ti mismo" }, 400);
          await supabaseAdmin.from("perfiles").delete().eq("id", id);
          const { error } = await supabaseAdmin.auth.admin.deleteUser(id);
          if (error) return json({ error: error.message }, 400);
          return json({ ok: true });
        }

        if (op === "activo") {
          const id = String(body?.id ?? "");
          const activo = body?.activo === true;
          if (!id) return json({ error: "Falta id" }, 400);
          const { error: uErr } = await supabaseAdmin.from("perfiles").update({ activo }).eq("id", id);
          if (uErr) return json({ error: uErr.message }, 400);
          // Bloquea/desbloquea el login a nivel de auth (no solo el perfil).
          await supabaseAdmin.auth.admin.updateUserById(id, { ban_duration: activo ? "none" : "876000h" });
          return json({ ok: true });
        }

        return json({ error: "Operación no reconocida" }, 400);
      },
    },
  },
});
