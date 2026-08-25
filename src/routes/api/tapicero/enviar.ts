import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// "Enviar a Daniel": marca los pedidos como enviados al panel del tapicero y
// encola UN email (agrupado por tapicero) con enlace a su ficha. Solo equipo.
//   POST { pedidoIds: string[] }
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json" } });

const FROM = "Tiroriro Home <pedidos@notify.tirorirohome.com>";
const SENDER_DOMAIN = "notify.tirorirohome.com";

function esc(s: string): string {
  return (s || "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));
}

export const Route = createFileRoute("/api/tapicero/enviar")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const authz = request.headers.get("authorization") ?? "";
        const token = authz.toLowerCase().startsWith("bearer ") ? authz.slice(7) : "";
        if (!token) return json({ error: "No autorizado" }, 401);
        const { data: u, error: uErr } = await supabaseAdmin.auth.getUser(token);
        if (uErr || !u?.user) return json({ error: "No autorizado" }, 401);
        const { data: perfil } = await supabaseAdmin.from("perfiles").select("rol, activo").eq("id", u.user.id).maybeSingle();
        if (!perfil || perfil.activo === false || !["admin", "equipo"].includes(perfil.rol as string)) {
          return json({ error: "Solo el equipo puede enviar" }, 403);
        }

        const body = await request.json().catch(() => null) as { pedidoIds?: unknown } | null;
        const ids = Array.isArray(body?.pedidoIds) ? body!.pedidoIds.map(String).filter(Boolean) : [];
        if (ids.length === 0) return json({ error: "Sin pedidos" }, 400);

        const ahora = new Date().toISOString();
        await supabaseAdmin.from("pedidos").update({ enviado_tapicero: true, enviado_tapicero_fecha: ahora } as never).in("id", ids);

        // Datos de los pedidos + su producto para el email.
        const { data: peds } = await supabaseAdmin.from("pedidos").select("id, tapicero_id, fecha_limite, producto_lead_id").in("id", ids);
        const origin = (() => { try { return new URL(request.url).origin; } catch { return "https://tirorirocrm.lovable.app"; } })();
        const rows = (peds ?? []) as unknown as Record<string, unknown>[];
        const prodIds = rows.map((p) => p.producto_lead_id).filter(Boolean) as string[];
        const { data: prods } = prodIds.length ? await supabaseAdmin.from("productos_lead").select("id, tipo, modelo, ancho, alto, fondo").in("id", prodIds) : { data: [] as never[] };
        const prodById = new Map((prods as unknown as Record<string, unknown>[] ?? []).map((p) => [p.id as string, p]));

        // Agrupa por tapicero → un email por tapicero.
        const porTapicero = new Map<string, Record<string, unknown>[]>();
        for (const p of rows) {
          const tid = (p.tapicero_id as string) ?? "";
          if (!tid) continue;
          (porTapicero.get(tid) ?? porTapicero.set(tid, []).get(tid)!).push(p);
        }

        let emailsEncolados = 0;
        for (const [tid, lista] of porTapicero) {
          // Email del tapicero: perfil (rol tapicero, tapicero_id=tid) → auth user.
          const { data: perfilTap } = await supabaseAdmin.from("perfiles").select("id").eq("tapicero_id", tid).eq("rol", "tapicero").eq("activo", true).maybeSingle();
          if (!perfilTap) continue; // sin usuario de tapicero → no hay a quién enviar
          const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(perfilTap.id as string);
          const to = authUser?.user?.email;
          if (!to) continue;

          const items = lista.map((p) => {
            const pr = prodById.get(p.producto_lead_id as string) ?? {};
            const medidas = [pr.ancho, pr.alto, pr.fondo].filter((d) => d != null && Number(d) > 0).join(" × ");
            const titulo = `${esc(String(pr.tipo ?? "Producto"))} ${esc(String(pr.modelo ?? ""))}`.trim();
            const fecha = p.fecha_limite ? `entrega ${esc(String(p.fecha_limite))}` : "";
            const link = `${origin}/panel/${p.id}`;
            return `<tr><td style="padding:12px 0;border-bottom:1px solid #eee">
              <div style="font-weight:700;font-size:16px;color:#1a1f36">${titulo}</div>
              <div style="color:#555;font-size:14px">${medidas ? medidas + " cm · " : ""}${fecha}</div>
              <a href="${link}" style="display:inline-block;margin-top:8px;background:#1a1f36;color:#fff;text-decoration:none;padding:10px 16px;border-radius:8px;font-weight:600;font-size:15px">Ver ficha del pedido</a>
            </td></tr>`;
          }).join("");

          const n = lista.length;
          const primero = prodById.get(lista[0].producto_lead_id as string) ?? {};
          const subject = n === 1
            ? `Nuevo pedido: ${String(primero.tipo ?? "")} ${String(primero.modelo ?? "")}`.trim()
            : `${n} pedidos nuevos para ti`;
          const html = `<!doctype html><html><body style="margin:0;background:#f4f4f5;font-family:-apple-system,Segoe UI,Roboto,sans-serif">
            <div style="max-width:520px;margin:0 auto;padding:24px 16px">
              <h1 style="font-size:20px;color:#1a1f36">Tienes ${n === 1 ? "un pedido nuevo" : n + " pedidos nuevos"} 🧵</h1>
              <p style="color:#555;font-size:15px">Entra en tu panel para ver la forma, las medidas, las telas y las fechas.</p>
              <table style="width:100%;border-collapse:collapse">${items}</table>
              <p style="margin-top:20px"><a href="${origin}/panel" style="display:inline-block;background:#1a4b5b;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:700;font-size:16px">Abrir mi taller</a></p>
            </div></body></html>`;
          const text = `Tienes ${n} pedido(s) nuevo(s). Abre tu panel: ${origin}/panel`;

          const messageId = crypto.randomUUID();
          await supabaseAdmin.from("email_send_log").insert({ message_id: messageId, template_name: "tapicero_asignacion", recipient_email: to, status: "pending" });
          const { error: encErr } = await supabaseAdmin.rpc("enqueue_email", {
            queue_name: "transactional_emails",
            payload: {
              run_id: crypto.randomUUID(), message_id: messageId, to, from: FROM, sender_domain: SENDER_DOMAIN,
              subject, html, text, purpose: "transactional", label: "tapicero_asignacion", queued_at: ahora,
            },
          });
          if (!encErr) emailsEncolados++;
        }

        return json({ ok: true, enviados: ids.length, emailsEncolados });
      },
    },
  },
});
