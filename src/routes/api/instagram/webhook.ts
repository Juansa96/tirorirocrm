import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { parsearWebhookInstagram } from "@/lib/whatsapp/instagram";
import { guardarMensajes, leerConversaciones, safeEqual, firmaValida, tokensBandeja } from "@/lib/whatsapp/guardar.server";
import { leerCanal, guardarCanal, perfilInstagram, nombreInstagram } from "@/lib/whatsapp/canales.server";
import { idDeClave, instagramDeNombre } from "@/lib/whatsapp/canales";
import { capturarAudiosWebhook } from "@/lib/whatsapp/audio.server";

// ── Webhook de mensajes directos de Instagram ───────────────────────────────
// URL a poner en la app de Meta (producto Instagram → Webhooks):
//   https://<crm>/api/instagram/webhook?token=<webhook_token de whatsapp_config>
//   GET  → verificación de Meta (hub.verify_token = verify_token de whatsapp_config).
//   POST → mensajes. Se guardan en la bandeja (whatsapp_* con clave "ig:…") y
//          se responde 200 enseguida; el análisis lo hace el mismo cron que
//          WhatsApp (/api/whatsapp/procesar).
// Autenticación del POST: ?token= igual al de la bandeja, o la firma
// X-Hub-Signature-256 con el secreto de la app si se ha guardado.

const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { "Content-Type": "application/json" } });
type Row = Record<string, unknown>;
const s = (v: unknown): string => (v == null ? "" : String(v));

// Pone el nombre y el @ de cada persona nueva (Instagram no lo manda en el webhook).
async function completarPerfiles(claves: string[]): Promise<void> {
  const fila = await leerCanal("instagram");
  const token = s(fila?.datos.access_token);
  if (!token || claves.length === 0) return;
  const convs = new Map<string, Row>();
  await leerConversaciones(claves, convs);
  await Promise.all([...convs.values()].filter((c) => !instagramDeNombre(s(c.nombre_wa))).slice(0, 10).map(async (c) => {
    const perfil = await perfilInstagram(idDeClave(s(c.telefono)), token);
    if (!perfil) return;
    await supabaseAdmin.from("whatsapp_conversaciones").update({ nombre_wa: nombreInstagram(perfil) } as never).eq("id", s(c.id));
  }));
}

export const Route = createFileRoute("/api/instagram/webhook")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        const url = new URL(request.url);
        const tokens = await tokensBandeja();
        if (!tokens) return json({ error: "Sin configurar" }, 503);
        if (url.searchParams.get("hub.mode") === "subscribe" && safeEqual(url.searchParams.get("hub.verify_token") ?? "", tokens.verifyToken)) {
          return new Response(url.searchParams.get("hub.challenge") ?? "", { status: 200, headers: { "Content-Type": "text/plain" } });
        }
        if (safeEqual(url.searchParams.get("token") ?? "", tokens.webhookToken)) {
          const fila = await leerCanal("instagram");
          return json({ ok: true, mensaje: "Webhook de Instagram listo", cuenta: s(fila?.datos.usuario) || null, ultimoEvento: fila?.ultimoEventoAt || null });
        }
        return json({ error: "No autorizado" }, 403);
      },

      POST: async ({ request }: { request: Request }) => {
        const tokens = await tokensBandeja();
        if (!tokens?.webhookToken) return json({ error: "Sin configurar" }, 503);
        const url = new URL(request.url);
        const cuerpo = await request.text();
        let autorizado = safeEqual(url.searchParams.get("token") ?? request.headers.get("x-whatsapp-token") ?? "", tokens.webhookToken);
        const fila = await leerCanal("instagram");
        const secreto = s(fila?.datos.app_secret);
        if (!autorizado && secreto) autorizado = await firmaValida(secreto, cuerpo, request.headers.get("x-hub-signature-256"));
        if (!autorizado) return json({ error: "No autorizado" }, 401);

        let body: unknown = null;
        try { body = JSON.parse(cuerpo); } catch { /* se registra abajo */ }
        const ahora = new Date().toISOString();
        try {
          if (body == null) throw new Error("El cuerpo no es JSON");
          const parsed = parsearWebhookInstagram(body);
          // La cuenta de Tiroriro, si la conocemos, nunca es "la persona".
          const propia = s(fila?.datos.cuenta_id);
          const mensajes = parsed.mensajes.filter((m) => !propia || idDeClave(m.telefono) !== propia);
          const nuevos = mensajes.length ? await guardarMensajes(mensajes) : 0;
          // Notas de voz: su enlace caduca, se descargan ya (la transcripción va en el ciclo de análisis).
          if (mensajes.some((m) => m.tipo === "ig_audio")) await capturarAudiosWebhook(mensajes).catch((e) => console.error("[instagram/webhook] audio", e));
          if (mensajes.length) await completarPerfiles([...new Set(mensajes.map((m) => m.telefono))]).catch((e) => console.error("[instagram/webhook] perfil", e));

          await guardarCanal("instagram", {
            ultimo_evento_at: ahora,
            ...(mensajes.length && !fila?.conectadoAt ? { conectado_at: ahora } : {}),
            ...(!s(fila?.datos.cuenta_id) && parsed.cuentas[0] ? { datos: { cuenta_id: parsed.cuentas[0] } } : {}),
          });
          await supabaseAdmin.from("whatsapp_eventos").insert({
            campo: "instagram",
            mensajes: nuevos,
            payload: cuerpo.length < 60_000 ? (body as never) : ({ resumen: `payload de ${cuerpo.length} bytes` } as never),
          } as never);
          return json({ ok: true, mensajes: nuevos, ignorados: parsed.ignorados });
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          console.error("[instagram/webhook]", msg);
          await supabaseAdmin.from("whatsapp_eventos").insert({ campo: "instagram:error", mensajes: 0, error: msg.slice(0, 1000), payload: cuerpo.length < 20_000 && body != null ? (body as never) : null } as never);
          await guardarCanal("instagram", { ultimo_evento_at: ahora, ultimo_error: msg.slice(0, 1000), ultimo_error_at: ahora }).catch(() => undefined);
          // 200 para que Meta no reintente en bucle un evento que no entendemos.
          return json({ ok: false, error: msg });
        }
      },
    },
  },
});
