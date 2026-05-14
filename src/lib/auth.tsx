import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { vendorName } from "./types";
import { setCurrentUser } from "./store";

interface AuthCtx {
  session: Session | null;
  loading: boolean;
  email: string | null;
  displayName: string;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      setCurrentUser(s?.user.email ?? null);
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setCurrentUser(data.session?.user.email ?? null);
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const email = session?.user.email ?? null;
  const displayName = email ? vendorName(email) : "";

  const value: AuthCtx = {
    session,
    loading,
    email,
    displayName,
    async signIn(em, pw) {
      const { error } = await supabase.auth.signInWithPassword({ email: em, password: pw });
      return { error: error?.message ?? null };
    },
    async signOut() {
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
