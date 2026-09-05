import { useMemo, useState } from "react";
import { Mail, MessageCircle, CheckCircle2, Send } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { formatShortDate } from "@/lib/format";
import { textoEmailEntrega, textoWhatsAppEntrega, htmlEmailEntrega, ENTREGA_WHATSAPP_INTL, ENTREGA_FROM } from "@/lib/email-entrega";
import type { Lead, Pedido, Producto } from "@/lib/types";
import { confirmar } from "@/components/Confirmar";

// Bloque "Correo de entrega" en la ficha del pedido. Solo aparece cuando el
// pedido está ENTREGADO y solo lo ve el equipo. Nada sale sin revisar y pulsar
// Enviar. Si el cliente no tiene correo (la mayoría), ofrece el texto para
// WhatsApp, que abre el chat con el mensaje ya escrito.
export function EmailEntrega({ pedido, lead, producto }: { pedido: Pedido; lead: Lead | undefined; producto: Producto | undefined }) {
  const { esEquipo } = useAuth();
  const datos = useMemo(() => ({
    nombre: lead?.nombre ?? "", tipo: producto?.tipo ?? "", modelo: producto?.modelo ?? "", cantidad: producto?.cantidad ?? 1,
  }), [lead?.nombre, producto?.tipo, producto?.modelo, producto?.cantidad]);
  const porDefecto = useMemo(() => textoEmailEntrega(datos), [datos]);
  const [abierto, setAbierto] = useState(false);
  const [asunto, setAsunto] = useState(porDefecto.asunto);
  const [mensaje, setMensaje] = useState(porDefecto.mensaje);
  const [para, setPara] = useState(lead?.email ?? "");
  const [busy, setBusy] = useState(false);

  if (!esEquipo || !pedido.entregado) return null;

  const enviado = !!pedido.emailEntregaFecha;
  const whatsapp = textoWhatsAppEntrega({ nombre: lead?.nombre ?? "", tipo: producto?.tipo ?? "", modelo: producto?.modelo ?? "", cantidad: producto?.cantidad ?? 1 });
  const telefono = (lead?.telefono || "").replace(/\D/g, "");
  const waNumero = telefono ? (telefono.length === 9 ? "34" + telefono : telefono) : "";
  const waUrl = `https://wa.me/${waNumero || ENTREGA_WHATSAPP_INTL}?text=${encodeURIComponent(whatsapp)}`;

  async function copiarWhatsApp() {
    try { await navigator.clipboard.writeText(whatsapp); toast.success("Texto copiado. Pégalo en WhatsApp."); }
    catch { toast.error("No se pudo copiar. Selecciona el texto y cópialo a mano."); }
  }

  async function enviar() {
    if (!para.trim()) { toast.error("Escribe la dirección de correo del cliente."); return; }
    if (enviado && !(await confirmar({ titulo: "¿Enviarlo otra vez?", texto: `Este correo ya se envió el ${formatShortDate(pedido.emailEntregaFecha.slice(0, 10))} a ${pedido.emailEntregaA}.`, aceptar: "Enviar de nuevo" }))) return;
    setBusy(true);
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token ?? "";
    const res = await fetch("/api/pedidos/email-entrega", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ pedidoId: pedido.id, asunto, mensaje, para: para.trim() }),
    });
    setBusy(false);
    if (res.ok) { toast.success("Correo de entrega enviado a " + para.trim()); setAbierto(false); }
    else { const d = await res.json().catch(() => ({})); toast.error(d.error ?? "No se pudo enviar el correo."); }
  }

  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-emerald-700">
          <Mail className="h-4 w-4" /> Correo de entrega al cliente
        </div>
        {enviado && (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">
            <CheckCircle2 className="h-3.5 w-3.5" /> Enviado el {formatShortDate(pedido.emailEntregaFecha.slice(0, 10))} a {pedido.emailEntregaA}
          </span>
        )}
      </div>
      <p className="mt-1.5 text-sm text-slate-600">
        Con el diseño de la web (logo, foto y tipografías): da las gracias, pide la reseña en Google y una foto para Instagram, y ofrece el descuento del siguiente pedido. Se envía desde <span className="font-medium">{ENTREGA_FROM.replace(/<.*>/, "").trim()}</span> solo cuando pulses Enviar.
      </p>

      {!lead?.email && (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Este cliente no tiene correo en su ficha. Puedes escribirlo abajo o usar la versión para WhatsApp.
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={() => setAbierto((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700">
          <Send className="h-4 w-4" /> {abierto ? "Cerrar vista previa" : enviado ? "Revisar y reenviar" : "Revisar y enviar"}
        </button>
        <a href={waUrl} target="_blank" rel="noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
          <MessageCircle className="h-4 w-4" /> Abrir en WhatsApp
        </a>
        <button type="button" onClick={() => void copiarWhatsApp()}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
          Copiar texto de WhatsApp
        </button>
      </div>

      {abierto && (
        <div className="mt-4 space-y-3 rounded-lg border border-slate-200 bg-white p-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs text-slate-500">Para
              <input type="email" inputMode="email" value={para} onChange={(e) => setPara(e.target.value)} placeholder="correo@cliente.com"
                className="mt-1 w-full rounded border border-slate-200 px-2 py-2 text-sm focus:border-slate-400 focus:outline-none" />
            </label>
            <label className="text-xs text-slate-500">Asunto
              <input type="text" value={asunto} onChange={(e) => setAsunto(e.target.value)}
                className="mt-1 w-full rounded border border-slate-200 px-2 py-2 text-sm focus:border-slate-400 focus:outline-none" />
            </label>
          </div>
          <label className="block text-xs text-slate-500">Mensaje personal <span className="text-slate-400">(el resto del correo, con la reseña, la foto y el descuento, va fijo con el diseño de la web)</span>
            <textarea rows={7} value={mensaje} onChange={(e) => setMensaje(e.target.value)}
              className="mt-1 w-full resize-y rounded border border-slate-200 px-3 py-2 font-serif text-[15px] leading-relaxed focus:border-slate-400 focus:outline-none" />
          </label>
          <div>
            <div className="mb-1 text-xs text-slate-500">Así le llegará</div>
            <iframe title="Vista previa del correo" sandbox="" srcDoc={htmlEmailEntrega(datos, mensaje)}
              className="h-[720px] w-full rounded-lg border border-slate-200 bg-[#F7F4EE]" />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <button type="button" onClick={() => { setAsunto(porDefecto.asunto); setMensaje(porDefecto.mensaje); }}
              className="text-xs text-slate-500 underline hover:text-slate-800">Volver al texto por defecto</button>
            <button type="button" disabled={busy} onClick={() => void enviar()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
              <Send className="h-4 w-4" /> {busy ? "Enviando…" : "Enviar correo"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
