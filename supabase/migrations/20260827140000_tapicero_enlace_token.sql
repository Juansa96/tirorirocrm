-- ══════════════════════════════════════════════════════════════════════════
-- Acceso del tapicero por enlace con token (sin usuario/contraseña).
--
-- El enlace /t/<token> se canjea en el servidor por una sesión real del usuario
-- del tapicero (magiclink de admin), así la RLS y el panel existente funcionan
-- sin cambios ni accesos anónimos. El token es un secreto: solo lo maneja el
-- equipo (RLS de tapiceros) y el servidor (service_role) al canjearlo.
--
-- Requiere que el tapicero tenga ya un usuario de acceso (perfil rol=tapicero).
-- ══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.tapiceros
  ADD COLUMN IF NOT EXISTS access_token TEXT,
  ADD COLUMN IF NOT EXISTS access_token_activo BOOLEAN NOT NULL DEFAULT true;

CREATE UNIQUE INDEX IF NOT EXISTS tapiceros_access_token_unq
  ON public.tapiceros(access_token) WHERE access_token IS NOT NULL;
