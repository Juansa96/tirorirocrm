import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { guardarMensajes, safeEqual, tokensBandeja } from "@/lib/whatsapp/guardar.server";
import { leerCanal, guardarCanal } from "@/lib/whatsapp/canales.server";
import type { MensajeNormalizado } from "@/lib/whatsapp/parse";
import {
  claveEmail, idMensajeEmail, normCorreo, parsearRemitente, listaCorreos, esCorreoPropio, esRemitenteAutomatico, limpiarCuerpoCorreo,
} from "@/lib/whatsapp/canales";
import { VENDEDORES } from "@/lib/types";

// ── Entrada del correo de info@tirorirohome.com ─────────────────────────────
// La llama cada 5 minutos un script de Google Apps Script instalado en la
// propia cuenta de Gmail (ver src/lib/whatsapp/apps-script.ts; se copia desde
// la configuración de /whatsapp). Cabecera x-whatsapp-token = token de la
// bandeja. POST { cuenta, instalado, mensajes: [{ id, hilo, fecha, de, para,
// cc, asunto, texto, listUnsubscribe, historial }] }.
//
// Solo se guardan los correos de PERSONAS: se descartan avisos automáticos
// (noreply, Shopify, DHL, redes sociales, newsletters…), los del equipo y los
// que enviamos a quien no nos ha escrito (proveedores). Si la dirección es de
// un cliente que ya está en el CRM, se guarda siempre. El análisis lo hace el
// mismo ciclo que WhatsApp (/api/whatsapp/procesar).

const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { "Content-Type": "application/json" } });
type Row = Record<string, unknown>;
const s = (v: unknown): string => (v == null ? "" : String(v));
const MAX_MENSAJES = 200;

function fechaIso(v: unknown): string {
  const d = new Date(s(v));
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

export const Route = createFileRoute("/api/correo/entrada")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const tokens = await tokensBandeja();
        if (!tokens?.webhookToken) return json({ error: "Sin configurar" }, 503);
        const url = new URL(request.url);
        if (!safeEqual(request.headers.get("x-whatsapp-token") ?? url.searchParams.get("token") ?? "", tokens.webhookToken)) {
          return json({ error: "No autorizado" }, 401);
        }
        const body = (await request.json().catch(() => null)) as Row | null;
        if (!body || !Array.isArray(body.mensajes)) return json({ error: "Falta la lista de mensajes" }, 400);
        const cuenta = normCorreo(s(body.cuenta)) || "info@tirorirohome.com";
        const entrada = (body.mensajes as unknown[]).filter((m): m is Row => !!m && typeof m === "object").slice(0, MAX_MENSAJES);
        const ahora = new Date().toISOString();

        try {
          const equipo = [...VENDEDORES] as string[];
          const propio = (c: string) => c === cuenta || esCorreoPropio(c, equipo);

          // Clientes y conversaciones que ya conocemos: sus correos se guardan siempre.
          const { data: leads } = await supabaseAdmin.from("leads").select("email").not("email", "is", null);
          const conocidos = new Set(((leads ?? []) as Row[]).map((r) => normCorreo(s(r.email))).filter((e) => e.includes("@")));
          const { data: convs } = await supabaseAdmin.from("whatsapp_conversaciones").select("telefono").like("telefono", "mail:%");
          for (const r of (convs ?? []) as Row[]) conocidos.add(s(r.telefono).slice(5));

          // 1ª pasada: correos que nos escriben personas.
          const escriben = new Set<string>();
          const candidatos: Array<{ m: Row; persona: string; nombre: string; saliente: boolean }> = [];
          for (const m of entrada) {
            const de = parsearRemitente(s(m.de));
            if (!de.correo.includes("@")) continue;
            if (propio(de.correo)) {
              const persona = [...listaCorreos(s(m.para)), ...listaCorreos(s(m.cc))].find((c) => !propio(c));
              if (persona) candidatos.push({ m, persona, nombre: "", saliente: true });
              continue;
            }
            const conocido = conocidos.has(de.correo);
            if (!conocido && (esRemitenteAutomatico(de.correo) || m.listUnsubscribe === true)) continue;
            escriben.add(de.correo);
            candidatos.push({ m, persona: de.correo, nombre: de.nombre, saliente: false });
          }

          // 2ª pasada: lo que enviamos solo si es a alguien que nos escribe o ya conocemos.
          const mensajes: MensajeNormalizado[] = [];
          for (const { m, persona, nombre, saliente } of candidatos) {
            if (saliente && !conocidos.has(persona) && !escriben.has(persona)) continue;
            const asunto = s(m.asunto).trim();
            const cuerpo = limpiarCuerpoCorreo(s(m.texto)).slice(0, 8000);
            const texto = [asunto ? `Asunto: ${asunto}` : "", cuerpo].filter(Boolean).join("\n\n");
            if (!texto || !s(m.id)) continue;
            mensajes.push({
              waId: idMensajeEmail(s(m.id)),
              telefono: claveEmail(persona),
              nombreWa: saliente ? "" : nombre,
              direccion: saliente ? "saliente" : "entrante",
              tipo: "email",
              texto,
              enviadoAt: fechaIso(m.fecha),
              historial: m.historial === true,
              raw: { asunto, de: s(m.de), para: s(m.para), cc: s(m.cc), hilo: s(m.hilo) },
            });
          }

          const nuevos = mensajes.length ? await guardarMensajes(mensajes) : 0;
          const fila = await leerCanal("email");
          await guardarCanal("email", {
            ultimo_evento_at: ahora,
            ...(!fila?.conectadoAt ? { conectado_at: s(body.instalado) ? fechaIso(body.instalado) : ahora } : {}),
            datos: { cuenta },
            ultimo_error: null,
          });
          await supabaseAdmin.from("whatsapp_eventos").insert({
            campo: "email",
            mensajes: nuevos,
            payload: { recibidos: entrada.length, guardados: mensajes.length, nuevos } as never,
          } as never);
          return json({ ok: true, recibidos: entrada.length, guardados: mensajes.length, nuevos });
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          console.error("[correo/entrada]", msg);
          await supabaseAdmin.from("whatsapp_eventos").insert({ campo: "email:error", mensajes: 0, error: msg.slice(0, 1000) } as never);
          await guardarCanal("email", { ultimo_evento_at: ahora, ultimo_error: msg.slice(0, 1000), ultimo_error_at: ahora }).catch(() => undefined);
          // 500: el script no avanza su marca y lo reintenta en 5 minutos.
          return json({ ok: false, error: msg }, 500);
        }
      },
    },
  },
});
