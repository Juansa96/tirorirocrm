import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { entregaEfectiva, type EntregaEfectiva } from "@/lib/types";
import { esZonaMadrid } from "@/lib/catalogo";

// A dónde va cada pedido al salir del taller (ver `entregaEfectiva` en
// src/lib/types.ts): lo fijado por el equipo en pasos_tapicero["@envio"] y, si
// no, lo deducido de la ciudad/provincia del cliente. El tapicero no puede leer
// `leads` (RLS), así que se calcula aquí con service_role y se le devuelve
// SOLO el modo y la ciudad/provincia; la dirección completa solo va al equipo.
//   GET /api/tapicero/entregas?tapicero=<id>   (el tapicero: siempre el suyo)
//   → { entregas: { [pedidoId]: { modo, destino, nota, origen, direccion? } } }
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });

export interface EntregaPanel extends EntregaEfectiva {
  direccion: string;   // dirección completa del cliente (solo equipo; "" para el tapicero)
}

export const Route = createFileRoute("/api/tapicero/entregas")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        const authz = request.headers.get("authorization") ?? "";
        const token = authz.toLowerCase().startsWith("bearer ") ? authz.slice(7) : "";
        if (!token) return json({ error: "No autorizado" }, 401);
        const { data: u, error: uErr } = await supabaseAdmin.auth.getUser(token);
        if (uErr || !u?.user) return json({ error: "No autorizado" }, 401);
        const { data: perfil } = await supabaseAdmin.from("perfiles").select("rol, tapicero_id, activo").eq("id", u.user.id).maybeSingle();
        if (!perfil || perfil.activo === false) return json({ error: "Sin acceso" }, 403);
        const esEquipo = ["admin", "equipo"].includes(perfil.rol as string);
        const esTapicero = perfil.rol === "tapicero";
        if (!esEquipo && !esTapicero) return json({ error: "Sin acceso" }, 403);

        const url = new URL(request.url);
        const tapiceroId = esTapicero ? String(perfil.tapicero_id ?? "") : String(url.searchParams.get("tapicero") ?? "");
        if (!tapiceroId) return json({ entregas: {} });

        const { data: peds, error } = await supabaseAdmin.from("pedidos").select("id, lead_id, pasos_tapicero").eq("tapicero_id", tapiceroId);
        if (error) return json({ error: error.message }, 400);
        const rows = (peds ?? []) as unknown as Array<{ id: string; lead_id: string | null; pasos_tapicero: unknown }>;
        const leadIds = [...new Set(rows.map((p) => p.lead_id).filter(Boolean) as string[])];
        const leadById = new Map<string, { ciudad: string; provincia: string; direccion: string }>();
        if (leadIds.length) {
          const { data: leads } = await supabaseAdmin.from("leads").select("id, ciudad, provincia, direccion").in("id", leadIds);
          for (const l of (leads ?? []) as unknown as Array<Record<string, unknown>>) {
            leadById.set(String(l.id), { ciudad: String(l.ciudad ?? ""), provincia: String(l.provincia ?? ""), direccion: String(l.direccion ?? "") });
          }
        }
        const entregas: Record<string, EntregaPanel> = {};
        for (const p of rows) {
          const pasos = (p.pasos_tapicero && typeof p.pasos_tapicero === "object" ? p.pasos_tapicero : {}) as Record<string, string>;
          const lead = p.lead_id ? leadById.get(p.lead_id) : undefined;
          const e = entregaEfectiva(pasos, lead, esZonaMadrid);
          entregas[p.id] = { ...e, direccion: esEquipo ? (lead?.direccion ?? "").trim() : "" };
        }
        return json({ entregas });
      },
    },
  },
});
