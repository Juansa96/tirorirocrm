import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { vendorName } from "./types";
import { setCurrentUser, teardownStore } from "./store";

export type Rol = "admin" | "equipo" | "tapicero";

interface Perfil {
  rol: Rol;
  tapiceroId: string;
  activo: boolean;
}

interface AuthCtx {
  session: Session | null;
  loading: boolean;
  email: string | null;
  displayName: string;
  // Perfil / rol
  perfilLoaded: boolean;
  rol: Rol | null;          // null = sesión sin perfil (sin acceso configurado)
  tapiceroId: string;       // solo relevante para rol tapicero
  esEquipo: boolean;        // admin o equipo
  esAdmin: boolean;
  esTapicero: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [perfilLoaded, setPerfilLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    const finish = (s: Session | null) => {
      if (!active) return;
      setSession(s);
      setCurrentUser(s?.user.email ?? null);
      setLoading(false);
    };

    const timeout = window.setTimeout(() => finish(null), 4000);
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      window.clearTimeout(timeout);
      finish(s);
    });

    supabase.auth.getSession()
      .then(({ data }) => {
        window.clearTimeout(timeout);
        finish(data.session);
      })
      .catch(() => {
        window.clearTimeout(timeout);
        finish(null);
      });

    return () => {
      active = false;
      window.clearTimeout(timeout);
      sub.subscription.unsubscribe();
    };
  }, []);

  // Carga el perfil (rol) del usuario en sesión.
  useEffect(() => {
    let active = true;
    const uid = session?.user.id;
    if (!uid) { setPerfil(null); setPerfilLoaded(true); return; }
    setPerfilLoaded(false);
    (async () => {
      try {
        const { data } = await supabase.from("perfiles").select("rol, tapicero_id, activo").eq("id", uid).maybeSingle();
        if (!active) return;
        setPerfil(data ? { rol: data.rol as Rol, tapiceroId: data.tapicero_id ?? "", activo: data.activo !== false } : null);
      } catch {
        if (active) setPerfil(null);
      } finally {
        if (active) setPerfilLoaded(true);
      }
    })();
    return () => { active = false; };
  }, [session?.user.id]);

  const email = session?.user.email ?? null;
  const displayName = email ? vendorName(email) : "";
  const rol = perfil?.rol ?? null;
  const activo = perfil?.activo ?? false;

  // Cuenta desactivada → cerrar sesión.
  useEffect(() => {
    if (perfilLoaded && perfil && !perfil.activo) {
      void supabase.auth.signOut();
    }
  }, [perfilLoaded, perfil]);

  const value: AuthCtx = {
    session,
    loading,
    email,
    displayName,
    perfilLoaded,
    rol: activo ? rol : null,
    tapiceroId: perfil?.tapiceroId ?? "",
    esEquipo: activo && (rol === "admin" || rol === "equipo"),
    esAdmin: activo && rol === "admin",
    esTapicero: activo && rol === "tapicero",
    async signIn(em, pw) {
      const { error } = await supabase.auth.signInWithPassword({ email: em, password: pw });
      return { error: error?.message ?? null };
    },
    async signOut() {
      await teardownStore();
      await supabase.auth.signOut();
    },
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be inside AuthProvider");
  return v;
}
