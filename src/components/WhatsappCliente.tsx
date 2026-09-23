import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { MessageCircle, ChevronDown, ChevronRight } from "lucide-react";
import { useWhatsapp, waActions } from "@/lib/whatsapp/store";
import { PropuestaCard } from "@/components/whatsapp/PropuestaCard";
import { formatTelefonoWa, tiempoRelativo } from "@/lib/whatsapp/types";

// Sección "WhatsApp" de la ficha del cliente: resumen de cada chat enlazado,
// propuestas pendientes de la IA (con Aceptar / Rechazar) y los últimos
// mensajes desplegables. No se pinta nada si el cliente no tiene chats.
export function WhatsappCliente({ leadId }: { leadId: string }) {
  const wa = useWhatsapp();
  const [abierto, setAbierto] = useState<string | null>(null);
  const convs = wa.conversaciones.filter((c) => c.leadId === leadId);
  if (convs.length === 0) return null;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <MessageCircle className="h-4 w-4 text-emerald-600" />
        <h2 className="text-base font-semibold">WhatsApp</h2>
      </div>
      <div className="space-y-4">
        {convs.map((c) => {
          const props = wa.propuestas.filter((p) => p.conversacionId === c.id && p.estado === "pendiente");
          const msgs = wa.mensajes[c.id];
          const ultimos = msgs ? msgs.slice(-12) : null;
          const desplegado = abierto === c.id;
          return (
            <div key={c.id} className="space-y-2">
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <span>{formatTelefonoWa(c.telefono)}</span>
                <span>· {c.mensajes} mensajes · último {tiempoRelativo(c.ultimoMensajeAt)}</span>
                <Link to="/whatsapp/$id" params={{ id: c.id }} className="ml-auto font-medium text-[#1a4b5b] hover:underline">Ver conversación</Link>
              </div>
              {c.resumen && <p className="text-sm text-slate-700">{c.resumen}</p>}
              {props.length > 0 && <div className="space-y-2">{props.map((p) => <PropuestaCard key={p.id} p={p} conv={c} />)}</div>}
              <button
                onClick={() => { const next = desplegado ? null : c.id; setAbierto(next); if (next) void waActions.cargarMensajes(c.id); }}
                className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800"
              >
                {desplegado ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />} Últimos mensajes
              </button>
              {desplegado && (
                <div className="space-y-1 rounded-lg bg-slate-50 p-2">
                  {!ultimos ? <p className="text-xs text-slate-400">Cargando…</p> : ultimos.length === 0 ? <p className="text-xs text-slate-400">Sin mensajes.</p> : ultimos.map((m) => (
                    <p key={m.id} className={`text-xs ${m.direccion === "saliente" ? "text-emerald-800" : "text-slate-700"}`}>
                      <span className="font-semibold">{m.direccion === "saliente" ? "Tiroriro" : "Cliente"}</span> <span className="text-slate-400">{tiempoRelativo(m.enviadoAt)}</span> · {m.texto}
                    </p>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
