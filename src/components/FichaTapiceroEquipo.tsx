import { useRef } from "react";
import { Send, Hammer, FileUp, Download, Trash2, CheckCircle2 } from "lucide-react";
import { useStore, actions } from "@/lib/store";
import { supabase } from "@/integrations/supabase/client";
import { tapiceroNombre, type Pedido, type Producto } from "@/lib/types";
import { formatShortDate } from "@/lib/format";
import { displayModelo } from "@/lib/catalogo";
import { FabricPicker, type TelaSel } from "@/components/FabricPicker";
import { toast } from "sonner";

const ROLES = ["Frontal", "Lateral", "Vivo"] as const;

// Panel del EQUIPO dentro de la ficha del pedido: rellena todo lo que verá el
// tapicero (telas con foto, montaje, estado de tela, archivos) y envía el
// pedido a su panel.
export function FichaTapiceroEquipo({ pedido, producto }: { pedido: Pedido; producto: Producto | undefined }) {
  const { pedidoTelas, pedidoArchivos, tapiceros } = useStore();
  const telas = pedidoTelas.filter((t) => t.pedidoId === pedido.id);
  const telaDe = (rol: string): TelaSel | null => {
    const t = telas.find((x) => x.tipoTela === rol);
    if (!t) return null;
    return { nombreTela: t.nombreTela, telaFotoUrl: t.telaFotoUrl, telaBibliotecaId: t.telaBibliotecaId };
  };
  const mismaFrontal = (rol: string) => telas.find((x) => x.tipoTela === rol)?.mismaQueFrontal ?? false;
  const tapicero = tapiceros.find((t) => t.id === pedido.tapiceroId);
  const archivos = pedidoArchivos.filter((a) => a.pedidoId === pedido.id);

  function setTelaEstado(estado: string) {
    const hoy = new Date().toISOString();
    actions.updatePedido(pedido.id, { telaEstado: estado, telaEstadoPor: "equipo", telaEstadoFecha: hoy });
  }

  function enviarADaniel() {
    if (pedido.enviadoTapicero) return;
    const faltan: string[] = [];
    if (!pedido.tapiceroId) faltan.push("tapicero asignado");
    if (!producto?.modelo && !producto?.tipo) faltan.push("forma/modelo");
    if (!pedido.fechaLimite) faltan.push("fecha de entrega");
    if (!telas.some((t) => t.tipoTela === "Frontal" && t.nombreTela)) faltan.push("tela frontal");
    const ok = faltan.length === 0
      ? confirm("¿Enviar este pedido al panel de " + (tapiceroNombre(tapicero) || "el tapicero") + "?")
      : confirm("⚠️ Falta: " + faltan.join(", ") + ".\n¿Enviarlo igualmente al panel del tapicero?");
    if (!ok) return;
    void (async () => {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token ?? "";
      const res = await fetch("/api/tapicero/enviar", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ pedidoIds: [pedido.id] }),
      });
      if (res.ok) {
        const d = await res.json().catch(() => ({}));
        // Reflejo local inmediato (el realtime lo confirma).
        actions.updatePedido(pedido.id, { enviadoTapicero: true, enviadoTapiceroFecha: new Date().toISOString() });
        toast.success(d.emailsEncolados ? "Enviado + email al tapicero." : "Enviado al panel del tapicero.");
      } else {
        toast.error("No se pudo enviar.");
      }
    })();
  }

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-amber-700">
          <Hammer className="h-4 w-4" /> Ficha para el tapicero
        </div>
        {pedido.enviadoTapicero ? (
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">
              <CheckCircle2 className="h-3.5 w-3.5" /> Enviado {pedido.enviadoTapiceroFecha ? formatShortDate(pedido.enviadoTapiceroFecha.slice(0, 10)) : ""}
            </span>
            <button onClick={() => { if (confirm("¿Quitar del panel del tapicero?")) actions.updatePedido(pedido.id, { enviadoTapicero: false }); }} className="text-xs text-slate-500 underline hover:text-slate-700">quitar</button>
          </div>
        ) : (
          <button onClick={enviarADaniel} className="inline-flex items-center gap-1.5 rounded-lg bg-[#1a1f36] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#2a2f46]">
            <Send className="h-4 w-4" /> Enviar a {tapiceroNombre(tapicero) || "tapicero"}
          </button>
        )}
      </div>

      {/* Telas frontal / lateral / vivo */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {ROLES.map((rol) => (
          <div key={rol} className="rounded-lg border border-slate-200 bg-white p-2.5">
            <FabricPicker
              label={rol === "Frontal" ? "Tela frontal" : rol === "Lateral" ? "Tela lateral" : "Tela del vivo"}
              value={telaDe(rol)}
              onSelect={(t) => actions.asignarTelaPedido(pedido.id, rol, { ...t, mismaQueFrontal: false })}
            />
            {rol !== "Frontal" && (
              <label className="mt-2 flex items-center gap-1.5 text-[11px] text-slate-500">
                <input
                  type="checkbox"
                  checked={mismaFrontal(rol)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      const f = telaDe("Frontal");
                      actions.asignarTelaPedido(pedido.id, rol, { nombreTela: f?.nombreTela ?? "", telaFotoUrl: f?.telaFotoUrl ?? "", telaBibliotecaId: f?.telaBibliotecaId ?? "", mismaQueFrontal: true });
                    } else {
                      actions.asignarTelaPedido(pedido.id, rol, { nombreTela: "", telaFotoUrl: "", telaBibliotecaId: "", mismaQueFrontal: false });
                    }
                  }}
                  className="h-3.5 w-3.5 rounded border-slate-300"
                />
                Misma que el frontal
              </label>
            )}
          </div>
        ))}
      </div>

      {/* Montaje + estado de tela */}
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-white p-2.5">
          <div className="mb-1.5 text-xs font-medium text-slate-500">Montaje</div>
          <div className="flex gap-2">
            {[["colgar", "Colgar en pared"], ["apoyar", "Apoyar en suelo"]].map(([v, lbl]) => (
              <button key={v} onClick={() => actions.updatePedido(pedido.id, { montaje: pedido.montaje === v ? "" : v })}
                className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium ${pedido.montaje === v ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 text-slate-600"}`}>
                {lbl}
              </button>
            ))}
          </div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-2.5">
          <div className="mb-1.5 text-xs font-medium text-slate-500">Estado de la tela</div>
          <div className="flex gap-1.5">
            {[["pendiente", "Pendiente"], ["enviada", "Enviada"], ["recibida", "Recibida"]].map(([v, lbl]) => (
              <button key={v} onClick={() => setTelaEstado(v)}
                className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium ${pedido.telaEstado === v ? "border-emerald-600 bg-emerald-600 text-white" : "border-slate-200 text-slate-600"}`}>
                {lbl}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Archivos */}
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <ArchivoSlot pedidoId={pedido.id} tipo="plantilla" titulo="Plantilla de corte (SVG/PLT)" accept=".svg,.plt" archivos={archivos.filter((a) => a.tipo === "plantilla")} />
        <ArchivoSlot pedidoId={pedido.id} tipo="etiqueta_ctt" titulo="Etiquetas CTT (PDF)" accept="application/pdf,.pdf" archivos={archivos.filter((a) => a.tipo === "etiqueta_ctt")} />
      </div>

      {/* Estado de acciones del tapicero */}
      {(pedido.telaEstado === "recibida" || pedido.terminadoTapicero) && (
        <div className="mt-3 space-y-1 rounded-lg border border-slate-200 bg-white p-2.5 text-xs text-slate-600">
          {pedido.telaEstado === "recibida" && pedido.telaEstadoPor && (
            <div>Tela marcada como recibida por <strong>{pedido.telaEstadoPor}</strong>{pedido.telaEstadoFecha ? ` · ${formatShortDate(pedido.telaEstadoFecha.slice(0, 10))}` : ""}</div>
          )}
          {pedido.terminadoTapicero && (
            <div className="flex items-center justify-between">
              <span>Terminado por <strong>{pedido.terminadoTapiceroPor || "tapicero"}</strong>{pedido.terminadoTapiceroFecha ? ` · ${formatShortDate(pedido.terminadoTapiceroFecha.slice(0, 10))}` : ""}</span>
              <button onClick={() => actions.updatePedido(pedido.id, { terminadoTapicero: false })} className="underline hover:text-slate-800">deshacer</button>
            </div>
          )}
        </div>
      )}
      {producto && (
        <div className="mt-2 text-[11px] text-slate-400">{producto.tipo} · {displayModelo(producto.modelo)}</div>
      )}
    </div>
  );
}

function ArchivoSlot({ pedidoId, tipo, titulo, accept, archivos }: {
  pedidoId: string; tipo: "plantilla" | "etiqueta_ctt"; titulo: string; accept: string;
  archivos: { id: string; nombre: string; url: string; storagePath: string; createdAt: string }[];
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-2.5">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-xs font-medium text-slate-500">{titulo}</span>
        <button onClick={() => ref.current?.click()} className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50">
          <FileUp className="h-3.5 w-3.5" /> Subir
        </button>
        <input ref={ref} type="file" accept={accept} className="hidden" onChange={(e) => {
          const f = e.target.files?.[0]; if (f) void actions.subirArchivoPedido(pedidoId, tipo, f);
          if (ref.current) ref.current.value = "";
        }} />
      </div>
      {archivos.length === 0 ? (
        <div className="py-2 text-center text-[11px] text-slate-400">Sin archivos</div>
      ) : (
        <ul className="space-y-1">
          {archivos.map((a) => (
            <li key={a.id} className="flex items-center gap-2 text-xs">
              <a href={a.url} target="_blank" rel="noreferrer" className="inline-flex min-w-0 flex-1 items-center gap-1 text-blue-600 hover:underline">
                <Download className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">{a.nombre}</span>
              </a>
              <button onClick={() => { if (confirm("¿Eliminar archivo?")) void actions.deleteArchivoPedido(a.id, a.storagePath); }} className="text-slate-400 hover:text-rose-600"><Trash2 className="h-3.5 w-3.5" /></button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
