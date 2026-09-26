import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { guardarMensajes, safeEqual, tokensBandeja } from "@/lib/whatsapp/guardar.server";
import { leerCanal, IG_GRAPH } from "@/lib/whatsapp/canales.server";
import { claveInstagram, idMensajeInstagram } from "@/lib/whatsapp/canales";
import type { MensajeNormalizado } from "@/lib/whatsapp/parse";

// ── Historial de mensajes directos de Instagram ─────────────────────────────
// POST { cursor? } → importa un lote de conversaciones (API de conversaciones
// de Instagram). Instagram solo da los 20 mensajes más recientes de cada
// conversación. Todo entra como HISTORIAL: solo se enlaza con el cliente y se
// resume, sin propuestas (misma regla que WhatsApp y el correo).
// Devuelve { conversaciones, mensajes, siguiente } — la bandeja lo llama en
// bucle hasta que `siguiente` viene vacío. Solo admin (o el token del cron).

const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { "Content-Type": "application/json" } });
type Row = Record<string, unknown>;
const s = (v: unknown): string => (v == null ? "" : String(v));
const isObj = (v: unknown): v is Row => !!v && typeof v === "object" && !Array.isArray(v);
const POR_LOTE = 5;
const MESES = 6;

async function autorizado(request: Request): Promise<boolean> {
  const tokens = await tokensBandeja();
  if (tokens && safeEqual(request.headers.get("x-whatsapp-token") ?? "", tokens.webhookToken)) return true;
  const authz = request.headers.get("authorization") ?? "";
  const bearer = authz.toLowerCase().startsWith("bearer ") ? authz.slice(7) : "";
  if (!bearer) return false;
  const { data: u, error } = await supabaseAdmin.auth.getUser(bearer);
  if (error || !u?.user) return false;
  const { data: perfil } = await supabaseAdmin.from("perfiles").select("rol, activo").eq("id", u.user.id).maybeSingle();
  return !!perfil && perfil.activo !== false && String(perfil.rol) === "admin";
}

async function getJson(url: string): Promise<Row> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 20_000);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    const j = (await res.json().catch(() => ({}))) as Row;
    if (!res.ok) throw new Error(`Instagram respondió ${res.status}: ${s((j.error as Row | undefined)?.message)}`);
    return j;
  } finally {
    clearTimeout(t);
  }
}

export const Route = createFileRoute("/api/instagram/historial")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        if (!(await autorizado(request))) return json({ error: "No autorizado" }, 401);
        const body = (await request.json().catch(() => ({}))) as Row;
        const fila = await leerCanal("instagram");
        const token = s(fila?.datos.access_token);
        const cuenta = s(fila?.datos.cuenta_id);
        if (!token) return json({ error: "Instagram no está conectado" }, 400);

        try {
          const campos = `id,updated_time,participants,messages.limit(20){id,created_time,from,to,message,attachments,is_unsupported}`;
          // El cursor que se devuelve es solo el "after" de Instagram (nunca la URL con la clave).
          const after = s(body.cursor).replace(/[^A-Za-z0-9_=-]/g, "");
          const url = `${IG_GRAPH}/me/conversations?platform=instagram&limit=${POR_LOTE}&fields=${encodeURIComponent(campos)}${after ? `&after=${encodeURIComponent(after)}` : ""}&access_token=${encodeURIComponent(token)}`;
          const pagina = await getJson(url);
          const convs = Array.isArray(pagina.data) ? (pagina.data as unknown[]).filter(isObj) : [];
          const limite = Date.now() - MESES * 30 * 86_400_000;

          const mensajes: MensajeNormalizado[] = [];
          let antiguas = 0;
          for (const c of convs) {
            if (Date.parse(s(c.updated_time)) < limite) { antiguas++; continue; }
            const participantes = (isObj(c.participants) && Array.isArray(c.participants.data) ? c.participants.data : []) as Row[];
            const persona = participantes.find((p) => s(p.id) && s(p.id) !== cuenta);
            if (!persona) continue;
            const igsid = s(persona.id);
            const usuario = s(persona.username);
            let lista = (isObj(c.messages) && Array.isArray(c.messages.data) ? c.messages.data : []) as Row[];
            // Si Instagram no expande el contenido, se pide cada mensaje por su id.
            if (lista.length && lista.every((m) => m.message === undefined && m.from === undefined)) {
              lista = (await Promise.all(lista.slice(0, 20).map((m) => getJson(`${IG_GRAPH}/${encodeURIComponent(s(m.id))}?fields=id,created_time,from,to,message,attachments,is_unsupported&access_token=${encodeURIComponent(token)}`).catch(() => null))))
                .filter((m): m is Row => !!m);
            }
            for (const m of lista) {
              const id = s(m.id);
              if (!id) continue;
              const de = isObj(m.from) ? s(m.from.id) : "";
              let texto = s(m.message).trim();
              const adjuntos = isObj(m.attachments) && Array.isArray(m.attachments.data) ? m.attachments.data.length : 0;
              if (!texto && adjuntos) texto = "[Adjunto]";
              if (!texto && m.is_unsupported === true) texto = "[Mensaje que Instagram no deja leer]";
              if (!texto) continue;
              mensajes.push({
                waId: idMensajeInstagram(id),
                telefono: claveInstagram(igsid),
                nombreWa: usuario ? `@${usuario}` : "",
                direccion: de && de !== igsid ? "saliente" : "entrante",
                tipo: texto === "[Mensaje que Instagram no deja leer]" ? "unsupported" : adjuntos && !s(m.message).trim() ? "ig_adjunto" : "text",
                texto: texto.slice(0, 4000),
                enviadoAt: new Date(s(m.created_time) || Date.now()).toISOString(),
                historial: true,
                raw: { historial_api: true, id },
              });
            }
          }

          const nuevos = mensajes.length ? await guardarMensajes(mensajes) : 0;
          // Si todas las de esta página son de hace más de 6 meses, no hace falta seguir.
          const paging = isObj(pagina.paging) ? pagina.paging : {};
          const cursores = isObj(paging.cursors) ? paging.cursors : {};
          const siguiente = convs.length > 0 && antiguas < convs.length && s(paging.next) ? s(cursores.after) : "";
          await supabaseAdmin.from("whatsapp_eventos").insert({ campo: "instagram:historial", mensajes: nuevos, payload: { conversaciones: convs.length, guardados: mensajes.length } as never } as never);
          return json({ ok: true, conversaciones: convs.length - antiguas, mensajes: nuevos, siguiente });
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          await supabaseAdmin.from("whatsapp_eventos").insert({ campo: "instagram:error", mensajes: 0, error: ("Historial: " + msg).slice(0, 1000) } as never);
          return json({ error: msg }, 500);
        }
      },
    },
  },
});
