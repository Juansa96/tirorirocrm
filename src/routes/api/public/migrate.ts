import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/migrate")({
  component: () => null,
});

export async function POST({ request }: { request: Request }) {
  // Auth check
  const secret = request.headers.get("x-secret") ?? new URL(request.url).searchParams.get("secret");
  if (secret !== process.env.BOOTSTRAP_SECRET) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const PROJECT_REF = SUPABASE_URL?.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !PROJECT_REF) {
    return new Response(JSON.stringify({ error: "Missing env vars", SUPABASE_URL, hasKey: !!SERVICE_ROLE_KEY }), { status: 500 });
  }

  const SQL = "ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS edad TEXT DEFAULT '';";

  // Try Supabase Management API
  const mgmtRes = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({ query: SQL }),
  });
  const mgmtBody = await mgmtRes.text();

  // Check if edad column exists now
  const checkRes = await fetch(`${SUPABASE_URL}/rest/v1/leads?select=edad&limit=1`, {
    headers: {
      "apikey": SERVICE_ROLE_KEY,
      "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
    },
  });
  const checkBody = await checkRes.text();
  const columnExists = checkRes.ok && !checkBody.includes("does not exist");

  return new Response(JSON.stringify({
    columnExists,
    mgmtStatus: mgmtRes.status,
    mgmtBody,
    checkBody,
    projectRef: PROJECT_REF,
  }), { status: 200, headers: { "Content-Type": "application/json" } });
}
