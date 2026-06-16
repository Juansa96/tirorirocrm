import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { TiroritoLogo } from "@/components/TiroritoLogo";

export const Route = createFileRoute("/reset-password")({
  head: () => ({ meta: [{ title: "Restablecer contraseña — TiroCRM" }] }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [done, setDone] = useState(false);

  // Supabase emits PASSWORD_RECOVERY when the user lands from the email link.
  // We also accept an existing session (covers the case where the listener
  // already fired before this component mounted).
  useEffect(() => {
    let active = true;
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (event === "PASSWORD_RECOVERY" || session) setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => {
      if (active && data.session) setReady(true);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    if (password.length < 8) {
      setErr("La contraseña debe tener al menos 8 caracteres.");
      return;
    }
    if (password !== confirm) {
      setErr("Las contraseñas no coinciden.");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      setErr(error.message);
      return;
    }
    setDone(true);
    setTimeout(() => navigate({ to: "/" }), 1500);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <form
        onSubmit={submit}
        className="w-full max-w-sm space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <div className="flex flex-col items-center gap-2">
          <TiroritoLogo className="h-10 w-auto text-[#1a4b5b]" />
          <div className="text-xs uppercase tracking-wider text-slate-400">Restablecer contraseña</div>
        </div>

        {!ready && !done && (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
            Esperando validar el enlace… Si no funciona, vuelve a solicitar el email desde la pantalla de inicio de sesión.
          </p>
        )}

        {done ? (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
            Contraseña actualizada. Redirigiendo…
          </div>
        ) : (
          <>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">Nueva contraseña</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">Confirmar contraseña</label>
              <input
                type="password"
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
              />
            </div>

            {err && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{err}</div>
            )}

            <button
              type="submit"
              disabled={loading || !ready}
              className="w-full rounded-lg bg-[#1a1f36] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#2a2f46] disabled:opacity-60"
            >
              {loading ? "Guardando…" : "Guardar nueva contraseña"}
            </button>
          </>
        )}
      </form>
    </div>
  );
}
