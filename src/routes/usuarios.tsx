import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { Users, Plus, KeyRound, Power, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useStore } from "@/lib/store";
import { tapiceroNombre, type Tapicero } from "@/lib/types";
import { toast } from "sonner";

export const Route = createFileRoute("/usuarios")({
  head: () => ({ meta: [{ title: "Usuarios — TiroCRM" }] }),
  component: Usuarios,
});

interface UsuarioRow {
  id: string; email: string; rol: string; tapiceroId: string; activo: boolean;
}

async function apiCall(method: "GET" | "POST", body?: unknown): Promise<Response> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token ?? "";
  return fetch("/api/admin/usuarios", {
    method,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
}

function Usuarios() {
  const { esEquipo, perfilLoaded } = useAuth();
  const navigate = useNavigate();
  const { tapiceros } = useStore();
  const [rows, setRows] = useState<UsuarioRow[] | null>(null);
  const [creando, setCreando] = useState(false);

  const cargar = useCallback(async () => {
    const res = await apiCall("GET");
    if (res.ok) { const d = await res.json(); setRows(d.usuarios ?? []); }
    else { toast.error("No se pudo cargar la lista de usuarios."); setRows([]); }
  }, []);

  useEffect(() => {
    if (perfilLoaded && !esEquipo) { navigate({ to: "/" }); return; }
    if (esEquipo) void cargar();
  }, [esEquipo, perfilLoaded, navigate, cargar]);

  if (!esEquipo) return null;

  const tapiceroNombreById = (id: string) => tapiceroNombre(tapiceros.find((t) => t.id === id));

  async function resetPassword(u: UsuarioRow) {
    const pw = prompt(`Nueva contraseña para ${u.email} (mínimo 8 caracteres):`);
    if (!pw) return;
    if (pw.length < 8) { toast.error("Mínimo 8 caracteres."); return; }
    const res = await apiCall("POST", { op: "password", id: u.id, password: pw });
    if (res.ok) toast.success("Contraseña actualizada."); else toast.error("No se pudo cambiar la contraseña.");
  }

  async function toggleActivo(u: UsuarioRow) {
    const res = await apiCall("POST", { op: "activo", id: u.id, activo: !u.activo });
    if (res.ok) { toast.success(u.activo ? "Usuario desactivado." : "Usuario activado."); void cargar(); }
    else toast.error("No se pudo cambiar el estado.");
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
          <Users className="h-6 w-6 text-[#1a1f36]" /> Usuarios
        </h1>
        <button onClick={() => void cargar()} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
          <RefreshCw className="h-4 w-4" /> Actualizar
        </button>
      </div>

      {/* Alta de tapicero */}
      <NuevoTapicero
        abierto={creando}
        onAbrir={() => setCreando((v) => !v)}
        tapiceros={tapiceros}
        onCreado={() => { setCreando(false); void cargar(); }}
      />

      {/* Lista */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-slate-400">
                <th className="px-4 py-2 font-semibold">Email</th>
                <th className="px-4 py-2 font-semibold">Rol</th>
                <th className="px-4 py-2 font-semibold">Tapicero</th>
                <th className="px-4 py-2 font-semibold">Estado</th>
                <th className="px-4 py-2 font-semibold text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows === null ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">Cargando…</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">Sin usuarios</td></tr>
              ) : rows.map((u) => (
                <tr key={u.id} className={u.activo ? "" : "bg-slate-50/60 text-slate-400"}>
                  <td className="px-4 py-2.5 font-medium">{u.email}</td>
                  <td className="px-4 py-2.5">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${u.rol === "tapicero" ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-600"}`}>
                      {u.rol === "tapicero" ? "Tapicero" : u.rol === "admin" ? "Admin" : "Equipo"}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-slate-600">{u.rol === "tapicero" ? (tapiceroNombreById(u.tapiceroId) || "—") : "—"}</td>
                  <td className="px-4 py-2.5">{u.activo ? "Activo" : "Desactivado"}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex justify-end gap-1.5">
                      <button onClick={() => void resetPassword(u)} title="Resetear contraseña" className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-600 hover:bg-slate-50">
                        <KeyRound className="h-4 w-4" />
                      </button>
                      <button onClick={() => void toggleActivo(u)} title={u.activo ? "Desactivar" : "Activar"} className={`rounded-lg border p-1.5 ${u.activo ? "border-rose-200 text-rose-600 hover:bg-rose-50" : "border-emerald-200 text-emerald-600 hover:bg-emerald-50"}`}>
                        <Power className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function NuevoTapicero({ abierto, onAbrir, tapiceros, onCreado }: {
  abierto: boolean; onAbrir: () => void;
  tapiceros: Tapicero[];
  onCreado: () => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [tapiceroId, setTapiceroId] = useState("");
  const [guardando, setGuardando] = useState(false);

  async function crear() {
    if (!email || password.length < 8 || !tapiceroId) { toast.error("Email, contraseña (≥8) y tapicero son obligatorios."); return; }
    setGuardando(true);
    const res = await apiCall("POST", { op: "create", email, password, tapiceroId });
    setGuardando(false);
    if (res.ok) { toast.success("Usuario tapicero creado."); setEmail(""); setPassword(""); setTapiceroId(""); onCreado(); }
    else { const d = await res.json().catch(() => ({})); toast.error(d.error ?? "No se pudo crear el usuario."); }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <button onClick={onAbrir} className="inline-flex items-center gap-1.5 rounded-lg bg-[#1a1f36] px-3 py-2 text-sm font-medium text-white hover:bg-[#2a2f46]">
        <Plus className="h-4 w-4" /> Nuevo usuario tapicero
      </button>
      {abierto && (
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="text-sm">
            <span className="mb-1 block text-xs text-slate-500">Email de acceso</span>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="daniel@…" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-xs text-slate-500">Contraseña (mín. 8)</span>
            <input type="text" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="contraseña" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-xs text-slate-500">Tapicero</span>
            <select value={tapiceroId} onChange={(e) => setTapiceroId(e.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
              <option value="">— Elegir —</option>
              {tapiceros.filter((t) => t.activo).map((t) => (
                <option key={t.id} value={t.id}>{tapiceroNombre(t)}</option>
              ))}
            </select>
          </label>
          <div className="flex items-end">
            <button onClick={() => void crear()} disabled={guardando} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50">
              {guardando ? "Creando…" : "Crear usuario"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
