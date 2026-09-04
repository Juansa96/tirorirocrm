import type { SupabaseClient } from "@supabase/supabase-js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Admin = SupabaseClient<any, any, any>;

// Token de baja ("unsubscribe") por dirección, obligatorio para la API de
// correo de Lovable en todo envío transaccional. Uno por email, reutilizable
// mientras no se haya usado. Misma tabla y misma lógica que la web
// (email_unsubscribe_tokens). Solo servidor (service role).
function generarToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function obtenerTokenBaja(admin: Admin, email: string): Promise<string | null> {
  const db = admin;
  const e = email.trim().toLowerCase();
  const { data: existente, error: e1 } = await db.from("email_unsubscribe_tokens").select("token, used_at").eq("email", e).maybeSingle();
  if (e1) return null;
  if (existente && !existente.used_at) return existente.token as string;
  if (existente) return existente.token as string; // ya usado: la API decide (dirección dada de baja)
  const token = generarToken();
  await db.from("email_unsubscribe_tokens").upsert({ token, email: e }, { onConflict: "email", ignoreDuplicates: true });
  const { data: guardado } = await db.from("email_unsubscribe_tokens").select("token").eq("email", e).maybeSingle();
  return (guardado?.token as string | undefined) ?? null;
}

// ¿Está la dirección dada de baja, rebotada o con queja? Entonces no se envía.
export async function emailSuprimido(admin: Admin, email: string): Promise<boolean> {
  const db = admin;
  const { data } = await db.from("suppressed_emails").select("id").eq("email", email.trim().toLowerCase()).limit(1);
  return !!(data && data.length > 0);
}
