import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const SQL = "ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS edad TEXT DEFAULT '';";

export const Route = createFileRoute("/api/public/migrate")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        const json = (body: unknown, status = 200) =>
          new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

        const secret = new URL(request.url).searchParams.get("secret");
        if (secret !== process.env.BOOTSTRAP_SECRET) return json({ error: "Unauthorized" }, 401);

        if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
          return json({ error: "Missing env vars" }, 500);
        }

        const PROJECT_REF = process.env.SUPABASE_URL.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];
        const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

        // 1. Check if column already exists
        const check = await fetch(`${process.env.SUPABASE_URL}/rest/v1/leads?select=edad&limit=1`, {
          headers: { apikey: SERVICE_KEY!, Authorization: `Bearer ${SERVICE_KEY}` },
        });
        if (check.ok) return json({ ok: true, message: "Column 'edad' already exists — nothing to do" });

        // 2. Try Supabase Management API (needs PAT — likely 401)
        const mgmt = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_KEY}` },
          body: JSON.stringify({ query: SQL }),
        });
        if (mgmt.ok) {
          return json({ ok: true, method: "management-api", status: mgmt.status });
        }

        // 3. Try calling exec_sql RPC (exists in some Supabase setups)
        const rpc = await supabaseAdmin.rpc("exec_sql" as never, { query: SQL } as never);
        if (!rpc.error) return json({ ok: true, method: "rpc-exec_sql" });

        // 4. Try calling query RPC
        const rpc2 = await supabaseAdmin.rpc("query" as never, { q: SQL } as never);
        if (!rpc2.error) return json({ ok: true, method: "rpc-query" });

        return json({
          ok: false,
          mgmtStatus: mgmt.status,
          mgmtBody: await mgmt.text().catch(() => ""),
          rpcError: rpc.error?.message,
          rpc2Error: rpc2.error?.message,
          projectRef: PROJECT_REF,
          message: "Could not run DDL automatically. Need PAT or manual run.",
        });
      },
    },
  },
});
