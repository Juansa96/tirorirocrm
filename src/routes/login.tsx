import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { TiroritoLogo } from "@/components/TiroritoLogo";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Iniciar sesión — TiroCRM" }] }),
  component: LoginPage,
});

function LoginPage() {
  const { signIn, session } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"login" | "forgot">("login");
  const [resetMsg, setResetMsg] = useState<string | null>(null);

  if (session) {
    navigate({ to: "/" });
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    const { error } = await signIn(email.trim(), password);
    setLoading(false);
    if (error) {
      setErr("Email o contraseña incorrectos");
      return;
    }
    navigate({ to: "/" });
  }

  async function submitReset(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    setResetMsg(null);
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) {
      setErr("No se pudo enviar el email. Revisa la dirección e inténtalo de nuevo.");
      return;
    }
    setResetMsg("Te hemos enviado un email con un enlace para restablecer tu contraseña. Revisa tu bandeja de entrada.");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <form
        onSubmit={mode === "login" ? submit : submitReset}
        className="w-full max-w-sm space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <div className="flex flex-col items-center gap-2">
          <TiroritoLogo className="h-10 w-auto text-[#1a4b5b]" />
          <div className="text-xs uppercase tracking-wider text-slate-400">Sales CRM</div>
        </div>

        {mode === "forgot" && (
          <p className="text-xs text-slate-500">
            Introduce tu email y te enviaremos un enlace para restablecer la contraseña.
          </p>
        )}

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-700">Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
          />
        </div>

        {mode === "login" && (
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">Contraseña</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
            />
          </div>
        )}

        {err && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {err}
          </div>
        )}
        {resetMsg && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
            {resetMsg}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-[#1a1f36] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#2a2f46] disabled:opacity-60"
        >
          {loading
            ? (mode === "login" ? "Entrando…" : "Enviando…")
            : (mode === "login" ? "Iniciar sesión" : "Enviar enlace")}
        </button>

        <div className="text-center text-xs">
          {mode === "login" ? (
            <button
              type="button"
              onClick={() => { setMode("forgot"); setErr(null); setResetMsg(null); }}
              className="text-slate-500 hover:text-[#1a4b5b] hover:underline"
            >
              ¿Olvidaste tu contraseña?
            </button>
          ) : (
            <button
              type="button"
              onClick={() => { setMode("login"); setErr(null); setResetMsg(null); }}
              className="text-slate-500 hover:text-[#1a4b5b] hover:underline"
            >
              ← Volver al inicio de sesión
            </button>
          )}
        </div>

        <Link to="/login" className="hidden" />
      </form>
    </div>
  );
}
