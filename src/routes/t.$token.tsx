import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Hammer } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

// Acceso del tapicero por enlace con token, sin usuario/contraseña.
// Canjea el token por una sesión real (magiclink) y entra a su panel.
export const Route = createFileRoute("/t/$token")({
  head: () => ({ meta: [{ title: "Entrando… — Mi taller" }] }),
  component: EnlaceTapicero,
});

function EnlaceTapicero() {
  const { token } = Route.useParams();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancel = false;
    void (async () => {
      try {
        const res = await fetch("/api/tapicero/enlace", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        const d = await res.json().catch(() => ({}));
        if (!res.ok || !d?.tokenHash) { if (!cancel) setError(d?.error ?? "No se pudo abrir el enlace."); return; }
        const { error: vErr } = await supabase.auth.verifyOtp({ token_hash: d.tokenHash, type: "magiclink" });
        if (vErr) { if (!cancel) setError("No se pudo iniciar la sesión. Pide un enlace nuevo al equipo."); return; }
        if (!cancel) navigate({ to: "/panel" });
      } catch {
        if (!cancel) setError("No se pudo conectar. Revisa tu conexión.");
      }
    })();
    return () => { cancel = true; };
  }, [token, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="max-w-sm text-center">
        <div className="mb-3 inline-flex items-center gap-2 font-bold text-[#1a1f36]">
          <Hammer className="h-5 w-5" /> Mi taller
        </div>
        {error ? (
          <>
            <p className="text-sm text-rose-600">{error}</p>
            <a href="/login" className="mt-4 inline-block text-sm text-blue-600">Entrar con usuario</a>
          </>
        ) : (
          <p className="text-sm text-slate-500">Entrando en tu panel…</p>
        )}
      </div>
    </div>
  );
}
