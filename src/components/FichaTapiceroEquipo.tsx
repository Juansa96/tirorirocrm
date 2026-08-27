import { useRef } from "react";
import { Send, Hammer, FileUp, Download, Trash2, CheckCircle2, Flag, Truck, Image as ImageIcon, Calendar, AlertTriangle } from "lucide-react";
import { useStore, actions } from "@/lib/store";
import { supabase } from "@/integrations/supabase/client";
import { tapiceroNombre, type Pedido, type Producto } from "@/lib/types";
import { formatShortDate } from "@/lib/format";
import { displayNombreProducto, telasDeProducto, PRIORIDAD_OPCIONES } from "@/lib/catalogo";
import { FabricPicker, type TelaSel } from "@/components/FabricPicker";
import { toast } from "sonner";

// Panel del EQUIPO dentro de la ficha del pedido: rellena todo lo que verá el
// tapicero (prioridad, telas con foto adaptadas al tipo, montaje, estado de
// tela, plantilla, imagen de referencia, etiqueta de envío, fecha de recogida)
// y envía el pedido a su panel. El tapicero es SOLO LECTURA (RLS): solo puede
// marcar "tela recibida" y "terminado" desde su panel.
export function FichaTapiceroEquipo({ pedido, producto }: { pedido: Pedido; producto: Producto | undefined }) {
  const { pedidoTelas, pedidoArchivos, tapiceros } = useStore();
  const telas = pedidoTelas.filter((t) => t.pedidoId === pedido.id);
  const roles = telasDeProducto(producto?.tipo);
  const telaDe = (rol: string): TelaSel | null => {
    const t = telas.find((x) => x.tipoTela === rol);
    if (!t) return null;
    return { nombreTela: t.nombreTela, telaFotoUrl: t.telaFotoUrl, telaBibliotecaId: t.telaBibliotecaId, telaColeccion: t.telaColeccion };
  };
  const mismaFrontal = (rol: string) => telas.find((x) => x.tipoTela === rol)?.mismaQueFrontal ?? false;
  const tapicero = tapiceros.find((t) => t.id === pedido.tapiceroId);
  const archivos = pedidoArchivos.filter((a) => a.pedidoId === pedido.id);

  // Aviso de producto incompleto (para no mandar a producción algo a medias).
  const incompletos: string[] = [];
  if (!archivos.some((a) => a.tipo === "plantilla")) incompletos.push("plantilla de corte");
  if (!archivos.some((a) => a.tipo === "referencia")) incompletos.push("imagen de referencia");
  if (!telas.some((t) => t.tipoTela === "Frontal" && t.nombreTela)) incompletos.push("tela principal");

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
    if (!telas.some((t) => t.tipoTela === "Frontal" && t.nombreTela)) faltan.push("tela principal");
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

      {/* Aviso de producto incompleto */}
      {incompletos.length > 0 && (
        <div className="mb-3 flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-100/70 px-3 py-2 text-xs text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div><strong>Producto incompleto</strong> — falta: {incompletos.join(", ")}. Complétalo antes de mandar a producción.</div>
        </div>
      )}

      {/* Prioridad (la asigna el equipo; el tapicero solo la ve) */}
      <div className="mb-3 rounded-lg border border-slate-200 bg-white p-2.5">
        <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-slate-500"><Flag className="h-3.5 w-3.5" /> Prioridad</div>
        <div className="flex gap-1.5">
          {PRIORIDAD_OPCIONES.map((o) => (
            <button key={o.valor} onClick={() => actions.updatePedido(pedido.id, { prioridad: o.valor })}
              className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium ${pedido.prioridad === o.valor ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 text-slate-600"}`}>
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {/* Telas según el tipo de producto */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {roles.map(({ rol, label }) => (
          <div key={rol} className="rounded-lg border border-slate-200 bg-white p-2.5">
            <FabricPicker
              label={label}
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
                      actions.asignarTelaPedido(pedido.id, rol, { nombreTela: f?.nombreTela ?? "", telaFotoUrl: f?.telaFotoUrl ?? "", telaBibliotecaId: f?.telaBibliotecaId ?? "", telaColeccion: f?.telaColeccion ?? "", mismaQueFrontal: true });
                    } else {
                      actions.asignarTelaPedido(pedido.id, rol, { nombreTela: "", telaFotoUrl: "", telaBibliotecaId: "", telaColeccion: "", mismaQueFrontal: false });
                    }
                  }}
                  className="h-3.5 w-3.5 rounded border-slate-300"
                />
                Misma que la principal
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

      {/* Fecha de recogida por Juan */}
      <div className="mt-3 rounded-lg border border-slate-200 bg-white p-2.5">
        <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-slate-500"><Calendar className="h-3.5 w-3.5" /> Fecha prevista de recogida por Juan (taller)</div>
        <input
          type="date" defaultValue={pedido.fechaRecogida} key={"fr-" + pedido.fechaRecogida}
          onBlur={(e) => { if (e.target.value !== pedido.fechaRecogida) void actions.updatePedido(pedido.id, { fechaRecogida: e.target.value }); }}
          className="rounded border border-slate-200 px-2 py-1 text-sm"
        />
      </div>

      {/* Archivos: plantilla + imagen de referencia + etiqueta de envío */}
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <ArchivoSlot pedidoId={pedido.id} tipo="plantilla" titulo="Plantilla de corte (PLT/PDF/SVG)" accept=".svg,.plt,application/pdf,.pdf" icon={<FileUp className="h-3.5 w-3.5" />} archivos={archivos.filter((a) => a.tipo === "plantilla")} />
        <ArchivoSlot pedidoId={pedido.id} tipo="referencia" titulo="Imagen de referencia del acabado" accept="image/*" icon={<ImageIcon className="h-3.5 w-3.5" />} archivos={archivos.filter((a) => a.tipo === "referencia")} />
      </div>
      <div className="mt-3">
        <EtiquetaEnvioSlot pedidoId={pedido.id} archivos={archivos.filter((a) => a.tipo === "etiqueta_envio" || a.tipo === "etiqueta_ctt")} />
      </div>

      {/* Estado de acciones del tapicero (con deshacer desde administración) */}
      {(pedido.telaEstado === "recibida" || pedido.terminadoTapicero) && (
        <div className="mt-3 space-y-1 rounded-lg border border-slate-200 bg-white p-2.5 text-xs text-slate-600">
          {pedido.telaEstado === "recibida" && (
            <div className="flex items-center justify-between">
              <span>Tela recibida{pedido.telaEstadoFecha ? ` el ${formatShortDate(pedido.telaEstadoFecha.slice(0, 10))}` : ""}{pedido.telaEstadoPor ? ` por ${pedido.telaEstadoPor}` : ""}</span>
              <button onClick={() => setTelaEstado("enviada")} className="underline hover:text-slate-800">deshacer</button>
            </div>
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
        <div className="mt-2 text-[11px] text-slate-400">{displayNombreProducto(producto.tipo, producto.modelo)}</div>
      )}
    </div>
  );
}

function ArchivoSlot({ pedidoId, tipo, titulo, accept, icon, archivos }: {
  pedidoId: string; tipo: "plantilla" | "referencia"; titulo: string; accept: string; icon: React.ReactNode;
  archivos: { id: string; nombre: string; url: string; storagePath: string; createdAt: string }[];
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-2.5">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-slate-500">{titulo}</span>
        <button onClick={() => ref.current?.click()} className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-slate-300 px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50">
          {icon} Subir
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

// Etiqueta de envío: PDF o imagen, con transportista (CTT hoy, MRW pronto).
function EtiquetaEnvioSlot({ pedidoId, archivos }: {
  pedidoId: string;
  archivos: { id: string; nombre: string; url: string; storagePath: string; transportista: string; createdAt: string }[];
}) {
  const ref = useRef<HTMLInputElement>(null);
  const transRef = useRef<HTMLSelectElement>(null);
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-2.5">
      <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500"><Truck className="h-3.5 w-3.5" /> Etiqueta de envío (PDF o imagen)</span>
        <div className="flex items-center gap-1.5">
          <select ref={transRef} defaultValue="ctt" className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-[11px] text-slate-600">
            <option value="ctt">CTT Express</option>
            <option value="mrw">MRW</option>
            <option value="otro">Otro</option>
          </select>
          <button onClick={() => ref.current?.click()} className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-slate-300 px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50">
            <FileUp className="h-3.5 w-3.5" /> Subir
          </button>
        </div>
        <input ref={ref} type="file" accept="application/pdf,.pdf,image/*" className="hidden" onChange={(e) => {
          const f = e.target.files?.[0]; if (f) void actions.subirArchivoPedido(pedidoId, "etiqueta_envio", f, transRef.current?.value || "ctt");
          if (ref.current) ref.current.value = "";
        }} />
      </div>
      {archivos.length === 0 ? (
        <div className="py-2 text-center text-[11px] text-slate-400">Sin etiqueta subida</div>
      ) : (
        <ul className="space-y-1">
          {archivos.map((a) => (
            <li key={a.id} className="flex items-center gap-2 text-xs">
              <a href={a.url} target="_blank" rel="noreferrer" className="inline-flex min-w-0 flex-1 items-center gap-1 text-blue-600 hover:underline">
                <Download className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">{a.nombre}</span>
              </a>
              {a.transportista && <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] uppercase text-slate-600">{a.transportista}</span>}
              <button onClick={() => { if (confirm("¿Eliminar etiqueta?")) void actions.deleteArchivoPedido(a.id, a.storagePath); }} className="text-slate-400 hover:text-rose-600"><Trash2 className="h-3.5 w-3.5" /></button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
