import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { Users, Plus, KeyRound, Power, RefreshCw, Trash2, Hammer, Eye, Link2, Copy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useStore, actions } from "@/lib/store";
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

  async function cambiarRol(u: UsuarioRow, rol: string, tapiceroId?: string) {
    if (!rol) return;
    const tid = tapiceroId ?? u.tapiceroId ?? "";
    if (rol === "tapicero" && !tid) { toast.error("Elige primero un tapicero."); return; }
    const res = await apiCall("POST", { op: "rol", id: u.id, rol, tapiceroId: tid });
    if (res.ok) { toast.success("Rol actualizado."); void cargar(); }
    else { const d = await res.json().catch(() => ({})); toast.error(d.error ?? "No se pudo cambiar el rol."); }
  }

  async function eliminar(u: UsuarioRow) {
    if (!confirm(`¿Eliminar el usuario ${u.email}? Perderá el acceso definitivamente.`)) return;
    const res = await apiCall("POST", { op: "delete", id: u.id });
    if (res.ok) { toast.success("Usuario eliminado."); void cargar(); }
    else { const d = await res.json().catch(() => ({})); toast.error(d.error ?? "No se pudo eliminar."); }
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

      {/* Catálogo de tapiceros (personas) + acceso a su panel */}
      <TapicerosSection tapiceros={tapiceros} />

      <div className="pt-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Usuarios de acceso (login)</div>
      <p className="-mt-3 text-xs text-slate-400">Crea logins del equipo o de tapiceros. Si un login aparece «Sin acceso», asígnale un rol en la tabla.</p>

      {/* Alta de usuario */}
      <NuevoUsuario
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
                    <select
                      value={u.rol}
                      onChange={(e) => void cambiarRol(u, e.target.value)}
                      className={`rounded-lg border px-2 py-1 text-xs font-medium ${u.rol ? "border-slate-200 bg-white text-slate-700" : "border-rose-300 bg-rose-50 text-rose-700"}`}
                    >
                      {!u.rol && <option value="">Sin acceso</option>}
                      <option value="admin">Admin</option>
                      <option value="equipo">Equipo</option>
                      <option value="tapicero">Tapicero</option>
                    </select>
                  </td>
                  <td className="px-4 py-2.5 text-slate-600">
                    {u.rol === "tapicero" ? (
                      <select
                        value={u.tapiceroId}
                        onChange={(e) => void cambiarRol(u, "tapicero", e.target.value)}
                        className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs"
                      >
                        <option value="">— Elegir —</option>
                        {tapiceros.filter((t) => t.activo || t.id === u.tapiceroId).map((t) => (
                          <option key={t.id} value={t.id}>{tapiceroNombre(t)}</option>
                        ))}
                      </select>
                    ) : "—"}
                  </td>
                  <td className="px-4 py-2.5">{u.rol ? (u.activo ? "Activo" : "Desactivado") : "Sin acceso"}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex justify-end gap-1.5">
                      <button onClick={() => void resetPassword(u)} title="Resetear contraseña" className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-600 hover:bg-slate-50">
                        <KeyRound className="h-4 w-4" />
                      </button>
                      <button onClick={() => void toggleActivo(u)} title={u.activo ? "Desactivar" : "Activar"} className={`rounded-lg border p-1.5 ${u.activo ? "border-amber-200 text-amber-600 hover:bg-amber-50" : "border-emerald-200 text-emerald-600 hover:bg-emerald-50"}`}>
                        <Power className="h-4 w-4" />
                      </button>
                      <button onClick={() => void eliminar(u)} title="Eliminar usuario" className="rounded-lg border border-rose-200 p-1.5 text-rose-600 hover:bg-rose-50">
                        <Trash2 className="h-4 w-4" />
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

function TapicerosSection({ tapiceros }: { tapiceros: Tapicero[] }) {
  const [nombre, setNombre] = useState("");
  const [apellido, setApellido] = useState("");
  const [guardando, setGuardando] = useState(false);
  const orden = [...tapiceros].sort((a, b) => a.orden - b.orden);

  async function crear() {
    if (!nombre.trim()) return;
    setGuardando(true);
    const ok = await actions.addTapicero(nombre, apellido);
    setGuardando(false);
    if (ok) { setNombre(""); setApellido(""); toast.success("Tapicero añadido."); }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900">
        <Hammer className="h-4 w-4 text-[#1a1f36]" /> Tapiceros
      </div>
      <div className="space-y-2">
        {orden.map((t) => (
          <div key={t.id} className={`flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 ${t.activo ? "" : "bg-slate-50 text-slate-400"}`}>
            <span className="min-w-0 flex-1 truncate font-medium">{tapiceroNombre(t)}{!t.activo && " (inactivo)"}</span>
            <EnlaceTapicero tapicero={t} />
            <Link to="/panel" search={{ tapicero: t.id }} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50">
              <Eye className="h-3.5 w-3.5" /> Ver panel
            </Link>
            <button onClick={() => void actions.updateTapicero(t.id, { activo: !t.activo })} title={t.activo ? "Desactivar" : "Activar"}
              className={`rounded-lg border p-1.5 ${t.activo ? "border-amber-200 text-amber-600 hover:bg-amber-50" : "border-emerald-200 text-emerald-600 hover:bg-emerald-50"}`}>
              <Power className="h-3.5 w-3.5" />
            </button>
            <button onClick={() => { if (confirm(`¿Eliminar a ${tapiceroNombre(t)}? Sus pedidos quedarán sin asignar.`)) void actions.deleteTapicero(t.id); }} title="Eliminar tapicero"
              className="rounded-lg border border-rose-200 p-1.5 text-rose-600 hover:bg-rose-50">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-end gap-2">
        <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre" className="w-32 rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        <input value={apellido} onChange={(e) => setApellido(e.target.value)} placeholder="Apellido (opcional)" className="w-40 rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        <button onClick={() => void crear()} disabled={!nombre.trim() || guardando} className="inline-flex items-center gap-1 rounded-lg bg-[#1a1f36] px-3 py-2 text-sm font-medium text-white disabled:opacity-40">
          <Plus className="h-4 w-4" /> Añadir tapicero
        </button>
      </div>
    </div>
  );
}

// Enlace de acceso del tapicero (sin usuario/contraseña). Requiere que el
// tapicero tenga ya un usuario de login (rol tapicero).
function EnlaceTapicero({ tapicero }: { tapicero: Tapicero }) {
  const [generando, setGenerando] = useState(false);
  const tieneEnlace = !!tapicero.accessToken && tapicero.accessTokenActivo;

  function urlDe(token: string) {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    return `${origin}/t/${token}`;
  }
  async function copiar(token: string) {
    try { await navigator.clipboard.writeText(urlDe(token)); toast.success("Enlace copiado."); }
    catch { toast.error("No se pudo copiar. Enlace: " + urlDe(token)); }
  }
  async function crear() {
    setGenerando(true);
    const token = await actions.generarEnlaceTapicero(tapicero.id);
    setGenerando(false);
    if (token) { await copiar(token); }
  }

  if (!tieneEnlace) {
    return (
      <button onClick={() => void crear()} disabled={generando} title="Crear enlace de acceso sin contraseña"
        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">
        <Link2 className="h-3.5 w-3.5" /> {generando ? "Creando…" : "Crear enlace"}
      </button>
    );
  }
  return (
    <div className="inline-flex items-center gap-1">
      <button onClick={() => void copiar(tapicero.accessToken)} title="Copiar enlace de acceso"
        className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 px-2.5 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-50">
        <Copy className="h-3.5 w-3.5" /> Copiar enlace
      </button>
      <button onClick={() => { if (confirm("¿Regenerar el enlace? El anterior dejará de funcionar.")) void actions.generarEnlaceTapicero(tapicero.id).then((tk) => { if (tk) toast.success("Enlace nuevo generado y copiado."); }); }}
        title="Regenerar" className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-50">
        <RefreshCw className="h-3.5 w-3.5" />
      </button>
      <button onClick={() => { if (confirm("¿Revocar el enlace de acceso?")) void actions.revocarEnlaceTapicero(tapicero.id); }}
        title="Revocar enlace" className="rounded-lg border border-rose-200 p-1.5 text-rose-600 hover:bg-rose-50">
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function NuevoUsuario({ abierto, onAbrir, tapiceros, onCreado }: {
  abierto: boolean; onAbrir: () => void;
  tapiceros: Tapicero[];
  onCreado: () => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rol, setRol] = useState("tapicero");
  const [tapiceroId, setTapiceroId] = useState("");
  const [guardando, setGuardando] = useState(false);

  async function crear() {
    if (!email || password.length < 8 || (rol === "tapicero" && !tapiceroId)) {
      toast.error("Email, contraseña (≥8) y, si es tapicero, la persona son obligatorios."); return;
    }
    setGuardando(true);
    const res = await apiCall("POST", { op: "create", email, password, rol, tapiceroId });
    setGuardando(false);
    if (res.ok) { toast.success("Usuario creado."); setEmail(""); setPassword(""); setTapiceroId(""); onCreado(); }
    else { const d = await res.json().catch(() => ({})); toast.error(d.error ?? "No se pudo crear el usuario."); }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <button onClick={onAbrir} className="inline-flex items-center gap-1.5 rounded-lg bg-[#1a1f36] px-3 py-2 text-sm font-medium text-white hover:bg-[#2a2f46]">
        <Plus className="h-4 w-4" /> Nuevo usuario
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
            <span className="mb-1 block text-xs text-slate-500">Rol</span>
            <select value={rol} onChange={(e) => setRol(e.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
              <option value="tapicero">Tapicero</option>
              <option value="equipo">Equipo</option>
              <option value="admin">Admin</option>
            </select>
          </label>
          {rol === "tapicero" && (
            <label className="text-sm">
              <span className="mb-1 block text-xs text-slate-500">Tapicero</span>
              <select value={tapiceroId} onChange={(e) => setTapiceroId(e.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
                <option value="">— Elegir —</option>
                {tapiceros.filter((t) => t.activo).map((t) => (
                  <option key={t.id} value={t.id}>{tapiceroNombre(t)}</option>
                ))}
              </select>
            </label>
          )}
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
