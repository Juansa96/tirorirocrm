import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { ArrowLeft, User, Mail, KeyRound, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/perfil")({
  head: () => ({ meta: [{ title: "Mi perfil — TiroCRM" }] }),
  component: PerfilPage,
});

function PerfilPage() {
  const { email, displayName } = useAuth();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [loading, setLoading] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    setOk(false);
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
    setPassword("");
    setConfirm("");
    setOk(true);
  }

  const initials = (displayName || email || "?").slice(0, 2).toUpperCase();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-2">
        <Link to="/" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
          <ArrowLeft className="h-4 w-4" /> Volver
        </Link>
      </div>

      <header className="flex items-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-500 text-xl font-bold text-[#1a1f36]">
          {initials}
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{displayName || "Mi perfil"}</h1>
          <p className="text-sm text-slate-500">Gestiona tus datos de acceso</p>
        </div>
      </header>

      <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-700">Datos personales</h2>
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-3">
            <User className="h-4 w-4 text-slate-400" />
            <span className="text-slate-500">Nombre:</span>
            <span className="font-medium text-slate-900">{displayName || "—"}</span>
          </div>
          <div className="flex items-center gap-3">
            <Mail className="h-4 w-4 text-slate-400" />
            <span className="text-slate-500">Email:</span>
            <span className="font-medium text-slate-900">{email || "—"}</span>
          </div>
        </div>
      </section>

      <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-slate-500" />
          <h2 className="text-sm font-semibold text-slate-700">Cambiar contraseña</h2>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">Nueva contraseña</label>
            <input
              type="password"
              required
              autoComplete="new-password"
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
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
            />
          </div>

          {err && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{err}</div>
          )}
          {ok && (
            <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
              <CheckCircle2 className="h-4 w-4" /> Contraseña actualizada correctamente.
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-[#1a1f36] px-4 py-2 text-sm font-medium text-white hover:bg-[#2a2f46] disabled:opacity-60"
          >
            {loading ? "Guardando…" : "Actualizar contraseña"}
          </button>
        </form>
      </section>
    </div>
  );
}
