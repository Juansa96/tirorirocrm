import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// ── TEMPORAL (28/09/2026): importar los 14 mini cabeceros de muestra ────────
// Los pedidos 108–121 (cliente Juan Sangrador, tapicero Miguel Ángel) se
// crearon por SQL. Sus fotos, croquis y fotos de tela viajan como archivos
// estáticos en /public/mini-cabeceros (desde la sesión de Claude no se llega
// al almacenamiento de Supabase) y esta ruta los copia a los buckets y los
// enlaza en pedido_archivos / pedido_telas, ya aprobados (subidos por Juan).
// Idempotente: salta lo que ya esté. Se borra (ruta + carpeta) en cuanto se
// haya ejecutado.
//   POST { numeros?: number[] }   cabecera x-whatsapp-token (el mismo secreto
//   que el cron de WhatsApp y el aviso de asignación, sin secretos nuevos).

const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { "Content-Type": "application/json" } });
const s = (v: unknown): string => (v == null ? "" : String(v));

function safeEqual(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

const JUAN = "sangradortorresjuan@gmail.com";
const SIETE_DIAS = 60 * 60 * 24 * 7;

// numero de pedido → pieza (m01…m14), forma y tela de la foto (rol en pedido_telas)
const PIEZAS: { numero: number; pieza: string; forma: string; tela: string; rolTela: "Frontal" | "Lateral" }[] = [
  { numero: 108, pieza: "01", forma: "Conta", tela: "Ikat Verde Agua", rolTela: "Frontal" },
  { numero: 109, pieza: "02", forma: "Calobra", tela: "Rayas Espiga Verde", rolTela: "Frontal" },
  { numero: 110, pieza: "03", forma: "Pregonda", tela: "Raya Arequipa Verde", rolTela: "Frontal" },
  { numero: 111, pieza: "04", forma: "Macarella", tela: "Baqueira", rolTela: "Frontal" },
  { numero: 112, pieza: "05", forma: "Barbaria", tela: "Cerler", rolTela: "Frontal" },
  { numero: 113, pieza: "06", forma: "Conta", tela: "Lino Palmeta Azul Marino", rolTela: "Frontal" },
  { numero: 114, pieza: "07", forma: "Calobra", tela: "Lino Rayas Verde Sage", rolTela: "Frontal" },
  { numero: 115, pieza: "08", forma: "Pregonda", tela: "Lino Rayas Castilla", rolTela: "Frontal" },
  { numero: 116, pieza: "09", forma: "Macarella", tela: "Recarano azul", rolTela: "Frontal" },
  { numero: 117, pieza: "10", forma: "Barbaria", tela: "LOLA", rolTela: "Frontal" },
  { numero: 118, pieza: "11", forma: "Conta", tela: "Lino Flor Bosforo", rolTela: "Lateral" },
  { numero: 119, pieza: "12", forma: "Pregonda", tela: "Silvestre Papiro", rolTela: "Frontal" },
  { numero: 120, pieza: "13", forma: "Calobra", tela: "Celtic indigo azul", rolTela: "Frontal" },
  { numero: 121, pieza: "14", forma: "Macarella", tela: "Anaya", rolTela: "Frontal" },
];

async function descargar(origin: string, archivo: string): Promise<Uint8Array> {
  const res = await fetch(`${origin}/mini-cabeceros/${archivo}`);
  if (!res.ok) throw new Error(`${archivo}: HTTP ${res.status}`);
  return new Uint8Array(await res.arrayBuffer());
}

async function subirArchivo(pedidoId: string, tipo: "plantilla" | "referencia", nombre: string, bytes: Uint8Array, contentType: string) {
  const safe = nombre.replace(/[^\w.-]+/g, "_").slice(0, 120);
  const path = `${pedidoId}/${tipo}/${crypto.randomUUID()}-${safe}`;
  const { error: upErr } = await supabaseAdmin.storage.from("pedido-archivos").upload(path, bytes, { contentType, upsert: false });
  if (upErr) throw new Error(`${safe}: ${upErr.message}`);
  const { data: signed } = await supabaseAdmin.storage.from("pedido-archivos").createSignedUrl(path, SIETE_DIAS);
  const { error } = await supabaseAdmin.from("pedido_archivos").insert({
    pedido_id: pedidoId, tipo, nombre: safe, storage_path: path, url: signed?.signedUrl ?? "", subido_por: JUAN,
  } as never);
  if (error) {
    await supabaseAdmin.storage.from("pedido-archivos").remove([path]);
    throw new Error(`${safe}: ${error.message}`);
  }
}

export const Route = createFileRoute("/api/pedidos/importar-mini")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const { data: cfg } = await supabaseAdmin.from("whatsapp_config").select("webhook_token").eq("id", 1).maybeSingle();
        if (!safeEqual(request.headers.get("x-whatsapp-token") ?? "", s((cfg as Record<string, unknown> | null)?.webhook_token))) {
          return json({ error: "No autorizado" }, 401);
        }
        const body = (await request.json().catch(() => ({}))) as { numeros?: unknown };
        const pedir = Array.isArray(body.numeros) ? new Set(body.numeros.map(Number)) : null;
        const origin = new URL(request.url).origin;
        const resultado: Record<string, string[]> = {};

        for (const p of PIEZAS) {
          if (pedir && !pedir.has(p.numero)) continue;
          const log: string[] = (resultado[p.numero] = []);
          try {
            const { data: ped } = await supabaseAdmin.from("pedidos").select("id")
              .eq("numero", p.numero).eq("cliente_nombre_libre", "Juan Sangrador").eq("creado_manualmente", true).maybeSingle();
            const pedidoId = s((ped as { id?: string } | null)?.id);
            if (!pedidoId) { log.push("pedido no encontrado"); continue; }
            const { data: ya } = await supabaseAdmin.from("pedido_archivos").select("tipo").eq("pedido_id", pedidoId);
            const tipos = new Set(((ya ?? []) as { tipo: string }[]).map((a) => a.tipo));

            if (!tipos.has("plantilla")) {
              await subirArchivo(pedidoId, "plantilla", `Croquis_${p.forma}_30x20x3_pedido${p.numero}.pdf`, await descargar(origin, `m${p.pieza}-croquis.pdf`), "application/pdf");
              log.push("croquis");
            }
            if (!tipos.has("referencia")) {
              await subirArchivo(pedidoId, "referencia", `Mini_${p.pieza}_${p.forma}_${p.tela}.jpg`, await descargar(origin, `m${p.pieza}-foto.jpg`), "image/jpeg");
              log.push("foto");
            }

            const { data: tel } = await supabaseAdmin.from("pedido_telas").select("id, tela_foto_url")
              .eq("pedido_id", pedidoId).eq("tipo_tela", p.rolTela).maybeSingle();
            const telaRow = tel as { id?: string; tela_foto_url?: string | null } | null;
            if (telaRow?.id && !telaRow.tela_foto_url) {
              const path = `telas/${crypto.randomUUID()}.jpg`;
              const { error: upErr } = await supabaseAdmin.storage.from("telas").upload(path, await descargar(origin, `m${p.pieza}-tela.jpg`), { contentType: "image/jpeg", upsert: false });
              if (upErr) throw new Error(`tela: ${upErr.message}`);
              const { data: signed } = await supabaseAdmin.storage.from("telas").createSignedUrl(path, SIETE_DIAS);
              await supabaseAdmin.from("pedido_telas").update({ tela_foto_url: signed?.signedUrl ?? "" } as never).eq("id", telaRow.id);
              log.push("tela");
            }
            if (log.length === 0) log.push("ya estaba");
          } catch (e) {
            log.push("ERROR " + (e instanceof Error ? e.message : String(e)));
          }
        }
        return json({ ok: true, resultado });
      },
    },
  },
});
