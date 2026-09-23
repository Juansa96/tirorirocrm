import { useRef, useState } from "react";
import { Send, Hammer, FileUp, Download, Trash2, CheckCircle2, Truck, Image as ImageIcon, Calendar, AlertTriangle, X, Plus, Sparkles, RefreshCw, MessageSquarePlus, Loader2, Plug } from "lucide-react";
import { useStore, actions } from "@/lib/store";
import { supabase } from "@/integrations/supabase/client";
import { tapiceroNombre, archivoPendienteIA, huecosDe, conHuecos, huecoVacio, huecoEnEspejo, paredDe, conPared, TIPOS_HUECO, TIPO_HUECO_LABEL, type Pedido, type Producto, type HuecoPedido, type TipoHueco, type ColocacionPared, type PosicionPared } from "@/lib/types";
import { formatShortDate } from "@/lib/format";
import { displayNombreProducto, telasDeProducto, tipoLlevaVivo, montajeEfectivo, esSinVivo, faltaParaTaller, llevaCroquis } from "@/lib/catalogo";
import { FabricPicker } from "@/components/FabricPicker";
import { Tachado } from "@/components/Tachado";
import { emptyTela, type TelaDraft } from "@/lib/pedido-form";
import { toast } from "sonner";
import { confirmar, pedirTexto } from "@/components/Confirmar";

// Panel del EQUIPO dentro de la ficha del pedido. Trabaja sobre el BORRADOR
// (nada se persiste hasta pulsar "Guardar" en la ficha): las telas y los campos
// del tapicero (montaje, estado de tela, comentario, recogida) se
// editan en memoria. Los ARCHIVOS (plantilla, referencia, etiqueta) y el aviso
// por email sí son acciones inmediatas (subidas / correos).
export function FichaTapiceroEquipo({ pedido, producto, draft, patch, telas, setTelas }: {
  pedido: Pedido;
  producto: Producto | undefined;
  draft: Pedido;
  patch: (p: Partial<Pedido>) => void;
  telas: TelaDraft[];
  setTelas: (updater: (prev: TelaDraft[]) => TelaDraft[]) => void;
}) {
  const { pedidoArchivos, tapiceros, iaEnCurso } = useStore();
  const roles = telasDeProducto(producto?.tipo);
  const telaDe = (rol: string) => telas.find((t) => t.tipoTela.toLowerCase() === rol.toLowerCase());
  const tapicero = tapiceros.find((t) => t.id === pedido.tapiceroId);
  const archivos = pedidoArchivos.filter((a) => a.pedidoId === pedido.id);

  // Upsert / borrado de la tela de un rol dentro del borrador.
  function upsertRol(rol: string, cambio: Partial<TelaDraft>) {
    setTelas((prev) => {
      const i = prev.findIndex((t) => t.tipoTela.toLowerCase() === rol.toLowerCase());
      if (i === -1) return [...prev, { ...emptyTela(rol), ...cambio }];
      const next = [...prev];
      next[i] = { ...next[i], ...cambio };
      return next;
    });
  }
  function removeRol(rol: string) {
    setTelas((prev) => prev.filter((t) => t.tipoTela.toLowerCase() !== rol.toLowerCase()));
  }

  // Requisitos DUROS para entrar en el taller (medidas obligatorias y fecha de
  // recogida): sin ellos no se puede asignar tapicero ni avisarle. Se evalúan
  // sobre el borrador para que el aviso desaparezca al rellenar la fecha.
  const bloqueos = faltaParaTaller(producto, draft.fechaRecogida);
  // Aviso de producto incompleto (para no mandar a producción algo a medias).
  const incompletos: string[] = [];
  const esCabecero = llevaCroquis(producto?.tipo, producto?.modelo);
  if (esCabecero && !archivos.some((a) => a.tipo === "plantilla" && !archivoPendienteIA(a))) incompletos.push("plantilla de corte");
  if (!archivos.some((a) => a.tipo === "referencia" && !archivoPendienteIA(a))) incompletos.push("imagen de referencia");
  if (!telas.some((t) => t.tipoTela.toLowerCase() === "frontal" && t.nombreTela)) incompletos.push("tela principal");

  // Aviso por email (el tapicero ya VE el pedido en cuanto está asignado; esto
  // solo le manda un correo de aviso). Acción inmediata.
  function enviarADaniel() {
    // Sin medidas o sin fecha de recogida no se envía: ni "¿igualmente?".
    const duros = faltaParaTaller(producto, pedido.fechaRecogida);
    if (duros.length > 0) {
      toast.error(`No se puede enviar al taller: falta ${duros.join(" y ")}.${!pedido.fechaRecogida && draft.fechaRecogida ? " Guarda la ficha primero." : ""}`);
      return;
    }
    const faltan: string[] = [];
    if (!pedido.tapiceroId) faltan.push("tapicero asignado");
    if (!producto?.modelo && !producto?.tipo) faltan.push("forma/modelo");
    if (!pedido.fechaLimite) faltan.push("fecha de entrega");
    if (!telas.some((t) => t.tipoTela.toLowerCase() === "frontal" && t.nombreTela)) faltan.push("tela principal");
    void (async () => {
      const ok = faltan.length === 0
        ? await confirmar({ titulo: "¿Avisar a " + (tapiceroNombre(tapicero) || "el tapicero") + "?", texto: "Le llegará un correo con el enlace a la ficha del pedido.", aceptar: "Enviar aviso" })
        : await confirmar({ titulo: "Falta: " + faltan.join(", "), texto: "¿Avisar igualmente al tapicero?", aceptar: "Avisar igualmente" });
      if (!ok) return;
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
        {pedido.tapiceroId ? (
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">
              <CheckCircle2 className="h-3.5 w-3.5" /> Ya lo ve {tapiceroNombre(tapicero) || "el tapicero"} en su panel
            </span>
            <button onClick={enviarADaniel} className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50">
              <Send className="h-3.5 w-3.5" /> Avisar por email
            </button>
          </div>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700">
            Sin asignar · no lo ve nadie
          </span>
        )}
      </div>

      {/* Requisitos para entrar en el taller (bloquean asignar / avisar) */}
      {bloqueos.length > 0 && (
        <div className="mb-3 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            {pedido.tapiceroId
              ? <><strong>Al taller le falta {bloqueos.join(" y ")}</strong> — el tapicero lo ve pero no puede empezarlo con garantías. Complétalo aquí (las medidas también las puede corregir él desde su panel).</>
              : <><strong>No puede ir al taller todavía</strong> — falta {bloqueos.join(" y ")}. Hasta completarlo no se puede asignar tapicero ni avisarle.</>}
            {!pedido.fechaRecogida && draft.fechaRecogida ? " Guarda la ficha para que cuente la fecha." : ""}
          </div>
        </div>
      )}

      {/* Aviso de producto incompleto */}
      {incompletos.length > 0 && (
        <div className="mb-3 flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-100/70 px-3 py-2 text-xs text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div><strong>Producto incompleto</strong> — falta: {incompletos.join(", ")}. Complétalo antes de mandar a producción.</div>
        </div>
      )}

      {/* Comentarios para el tapicero (esto SÍ lo ve; las notas internas no).
          Se le sugieren las notas del pedido y del producto para incluirlas a
          mano si procede. */}
      <ComentarioTapicero
        value={draft.notaTapicero}
        onChange={(v) => patch({ notaTapicero: v })}
        notasPedido={draft.notasPedido}
        notasProducto={producto?.notasProducto}
      />

      {/* Telas según el tipo de producto. Frontal siempre; lateral/ribete solo
          si se añaden a mano (punto 7): no aparecen como hueco por defecto. */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {roles.map(({ rol, label, opcional }) => {
          const t = telaDe(rol);
          const presente = !!t;
          if (opcional && !presente) {
            return (
              <button key={rol} type="button" onClick={() => upsertRol(rol, {})}
                className="flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-slate-300 bg-white p-2.5 text-xs font-medium text-slate-500 hover:border-slate-400 hover:text-slate-700">
                <Plus className="h-3.5 w-3.5" /> Añadir {label.toLowerCase()}
              </button>
            );
          }
          const esFrontal = rol.toLowerCase() === "frontal";
          return (
            <div key={rol} className="rounded-lg border border-slate-200 bg-white p-2.5">
              <div className="flex items-start justify-between gap-1">
                <div className="min-w-0 flex-1">
                  <FabricPicker
                    label={label}
                    value={t ? { nombreTela: t.nombreTela, telaFotoUrl: t.telaFotoUrl, telaBibliotecaId: t.telaBibliotecaId, telaColeccion: t.telaColeccion } : null}
                    onSelect={(sel) => upsertRol(rol, { nombreTela: sel.nombreTela, telaFotoUrl: sel.telaFotoUrl, telaBibliotecaId: sel.telaBibliotecaId ?? "", telaColeccion: sel.telaColeccion ?? "", mismaQueFrontal: false })}
                  />
                </div>
                {/* Quitar la tela/foto enlazada (punto 9). Frontal se vacía; los
                    opcionales se eliminan por completo. */}
                {(t?.nombreTela || t?.telaFotoUrl || t?.mismaQueFrontal || (!esFrontal && presente)) && (
                  <button type="button" title="Quitar tela" onClick={() => esFrontal ? upsertRol(rol, { nombreTela: "", telaFotoUrl: "", telaBibliotecaId: "", telaColeccion: "", mismaQueFrontal: false }) : removeRol(rol)}
                    className="mt-5 shrink-0 rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600">
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              {!esFrontal && (
                <label className="mt-2 flex items-center gap-1.5 text-[11px] text-slate-500">
                  <input
                    type="checkbox"
                    checked={!!t?.mismaQueFrontal}
                    onChange={(e) => {
                      if (e.target.checked) {
                        const f = telaDe("Frontal");
                        upsertRol(rol, { nombreTela: f?.nombreTela ?? "", telaFotoUrl: f?.telaFotoUrl ?? "", telaBibliotecaId: f?.telaBibliotecaId ?? "", telaColeccion: f?.telaColeccion ?? "", mismaQueFrontal: true });
                      } else {
                        upsertRol(rol, { nombreTela: "", telaFotoUrl: "", telaBibliotecaId: "", telaColeccion: "", mismaQueFrontal: false });
                      }
                    }}
                    className="h-3.5 w-3.5 rounded border-slate-300"
                  />
                  Misma que la principal
                </label>
              )}
            </div>
          );
        })}
      </div>

      {(pedido.antes.tela_frontal || pedido.antes.tela_lateral || pedido.antes.tela_vivo) && (
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-0.5 text-[11px] text-slate-500">
          {pedido.antes.tela_frontal && <span>Principal: <Tachado antes={pedido.antes.tela_frontal}>{telaDe("Frontal")?.nombreTela || "—"}</Tachado></span>}
          {pedido.antes.tela_lateral && <span>Lateral: <Tachado antes={pedido.antes.tela_lateral}>{telaDe("Lateral")?.mismaQueFrontal ? "Misma que la principal" : (telaDe("Lateral")?.nombreTela || "—")}</Tachado></span>}
          {pedido.antes.tela_vivo && <span>Vivo: <Tachado antes={pedido.antes.tela_vivo}>{telaDe("Vivo")?.nombreTela || "—"}</Tachado></span>}
        </div>
      )}

      {/* Vivo / ribete del cabecero, banco o puf. Se especifica aquí (Sin vivo /
          Vivo simple / Vivo doble) y lo ve el tapicero. Acción inmediata sobre
          el producto (no pasa por el borrador). */}
      {producto && tipoLlevaVivo(producto.tipo) && (
        <div className="mt-3 rounded-lg border border-slate-200 bg-white p-2.5">
          <div className="mb-1.5 text-xs font-medium text-slate-500">Vivo / ribete <span className="text-slate-400">(lo ve el tapicero · se guarda al instante)</span></div>
          <div className="flex flex-wrap gap-2">
            {([["", "Sin vivo"], ["vivo-simple", "Vivo simple"], ["vivo-doble", "Vivo doble"]] as const).map(([v, lbl]) => {
              // "Sin vivo" cubre tanto el acabado vacío como el "liso" guardado
              // desde el formulario de producto o desde la web.
              const activo = v === "" ? esSinVivo(producto.acabado) : producto.acabado === v;
              return (
                <button key={v || "sin"} type="button" onClick={() => void actions.setProductoAcabado(producto.id, v)}
                  className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium ${activo ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 text-slate-600"}`}>
                  {lbl}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Montaje + estado de tela */}
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-white p-2.5">
          <div className="mb-1.5 text-xs font-medium text-slate-500">Montaje{pedido.antes.montaje && <span className="ml-1.5 text-slate-400">antes: <s>{pedido.antes.montaje}</s></span>}</div>
          <div className="flex gap-2">
            {[["colgar", "Colgar en pared"], ["apoyar", "Apoyar en suelo"]].map(([v, lbl]) => (
              <button key={v} onClick={() => patch({ montaje: draft.montaje === v ? "" : v })}
                className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium ${montajeEfectivo(producto?.tipo, draft.montaje) === v ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 text-slate-600"}`}>
                {lbl}
              </button>
            ))}
          </div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-2.5">
          <div className="mb-1.5 text-xs font-medium text-slate-500">Estado de la tela</div>
          <div className="flex gap-1.5">
            {[["pendiente", "Pendiente"], ["enviada", "Enviada"], ["recibida", "Recibida"]].map(([v, lbl]) => (
              <button key={v} onClick={() => patch({ telaEstado: v })}
                className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium ${draft.telaEstado === v ? "border-emerald-600 bg-emerald-600 text-white" : "border-slate-200 text-slate-600"}`}>
                {lbl}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Fecha de recogida por Juan */}
      <div className="mt-3 rounded-lg border border-slate-200 bg-white p-2.5">
        <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-slate-500"><Calendar className="h-3.5 w-3.5" /> Fecha prevista de recogida por Juan (taller){pedido.antes.fecha_recogida && <span className="text-slate-400">· antes: <s>{pedido.antes.fecha_recogida}</s></span>}</div>
        <input
          type="date" value={draft.fechaRecogida || ""}
          onChange={(e) => patch({ fechaRecogida: e.target.value })}
          className="rounded border border-slate-200 px-2 py-1 text-sm"
        />
      </div>

      {/* Enchufes, huecos y anclajes (van al croquis y al panel del tapicero).
          Se editan en el borrador y se guardan con "Guardar". */}
      {esCabecero && (
        <>
          <HuecosEditor huecos={huecosDe(draft.pasosTapicero)} onChange={(hs) => patch({ pasosTapicero: conHuecos(draft.pasosTapicero, hs) })} />
          <ParedEditor pared={paredDe(draft.pasosTapicero)} onChange={(c) => patch({ pasosTapicero: conPared(draft.pasosTapicero, c) })} />
        </>
      )}

      {/* Archivos: plantilla + imagen de referencia + etiqueta de envío (subida inmediata).
          El croquis lo genera Claude y la imagen la IA de Lovable; quedan pendientes hasta
          que alguien del equipo los aprueba. */}
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <ArchivoSlot pedidoId={pedido.id} tipo="plantilla" titulo="Croquis / plantilla de corte" accept=".svg,.plt,application/pdf,.pdf,image/*" icon={<FileUp className="h-3.5 w-3.5" />}
          archivos={archivos.filter((a) => a.tipo === "plantilla")} generando={iaEnCurso.includes(`${pedido.id}:plantilla`)}
          puedeGenerar={esCabecero && producto?.ancho != null && producto?.alto != null}
          motivoNoGenerar={!esCabecero ? "Solo para cabeceros" : "Faltan el ancho o el alto"} />
        <ArchivoSlot pedidoId={pedido.id} tipo="referencia" titulo="Imagen de referencia del acabado" accept="image/*" icon={<ImageIcon className="h-3.5 w-3.5" />}
          archivos={archivos.filter((a) => a.tipo === "referencia")} generando={iaEnCurso.includes(`${pedido.id}:referencia`)}
          puedeGenerar={!!producto} motivoNoGenerar="Sin producto" />
      </div>
      <div className="mt-3">
        <EtiquetaEnvioSlot pedidoId={pedido.id} archivos={archivos.filter((a) => a.tipo === "etiqueta_envio" || a.tipo === "etiqueta_ctt")} />
      </div>

      {/* Foto del acabado subida por el tapicero (solo lectura para el equipo) */}
      {archivos.some((a) => a.tipo === "foto_terminado") && (
        <div className="mt-3 rounded-lg border border-slate-200 bg-white p-2.5">
          <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-slate-500"><ImageIcon className="h-3.5 w-3.5" /> Foto del producto terminado</div>
          <div className="grid grid-cols-4 gap-2">
            {archivos.filter((a) => a.tipo === "foto_terminado").map((a) => (
              <div key={a.id} className="group relative overflow-hidden rounded-lg border border-slate-200">
                <a href={a.url} target="_blank" rel="noreferrer"><img src={a.url} alt="Producto terminado" loading="lazy" className="aspect-square w-full object-cover" /></a>
                <button onClick={() => void confirmar({ titulo: "¿Eliminar esta foto?", peligroso: true, aceptar: "Eliminar" }).then((ok) => { if (ok) void actions.deleteArchivoPedido(a.id, a.storagePath); })}
                  className="absolute right-1 top-1 rounded-full bg-black/50 p-1 text-white opacity-0 group-hover:opacity-100"><Trash2 className="h-3 w-3" /></button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Histórico de acciones del tapicero (tela recibida / en marcha /
          terminado / recogido). El estado se cambia en el bloque "Estado del
          pedido"; aquí solo se enseña quién y cuándo. */}
      {(draft.telaEstado === "recibida" || draft.iniciadoTapicero || draft.terminadoTapicero || pedido.recogido) && (
        <div className="mt-3 space-y-1 rounded-lg border border-slate-200 bg-white p-2.5 text-xs text-slate-600">
          {draft.telaEstado === "recibida" && (
            <div className="flex items-center justify-between">
              <span>Tela recibida{pedido.telaEstadoFecha ? ` el ${formatShortDate(pedido.telaEstadoFecha.slice(0, 10))}` : ""}{pedido.telaEstadoPor ? ` por ${pedido.telaEstadoPor}` : ""}</span>
              <button onClick={() => patch({ telaEstado: "enviada" })} className="underline hover:text-slate-800">deshacer</button>
            </div>
          )}
          {draft.iniciadoTapicero && (
            <div className="flex items-center justify-between">
              <span>En marcha{pedido.iniciadoTapiceroPor ? ` · empezado por ${pedido.iniciadoTapiceroPor}` : ""}{pedido.iniciadoTapiceroFecha ? ` · ${formatShortDate(pedido.iniciadoTapiceroFecha.slice(0, 10))}` : ""}</span>
            </div>
          )}
          {draft.terminadoTapicero && (
            <div className="flex items-center justify-between">
              <span>Terminado por <strong>{pedido.terminadoTapiceroPor || "tapicero"}</strong>{pedido.terminadoTapiceroFecha ? ` · ${formatShortDate(pedido.terminadoTapiceroFecha.slice(0, 10))}` : ""}</span>
            </div>
          )}
          {pedido.recogido && (
            <div className="flex items-center justify-between">
              <span>Recogido por Juan{pedido.recogidoFecha ? ` · ${formatShortDate(pedido.recogidoFecha.slice(0, 10))}` : ""}{pedido.recogidoPor ? ` · marcado por ${pedido.recogidoPor}` : ""}</span>
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

// Comentario para el tapicero: lo ÚNICO de texto que ve el tapicero (las notas
// internas del pedido/producto no se le muestran). Con sugerencias rápidas.
// Controlado por el borrador (se guarda al pulsar "Guardar").
const SUGERENCIAS_TAPICERO = [
  "Dirección de la tela: dibujo vertical",
  "Dirección de la tela: rayas horizontales",
  "Centrar el motivo",
  "Ribete en contraste",
  "Cuidado con el sentido del dibujo",
  "Lleva cremallera",
];
function ComentarioTapicero({ value, onChange, notasPedido, notasProducto }: {
  value: string; onChange: (v: string) => void;
  notasPedido?: string; notasProducto?: string;
}) {
  function añadir(s: string) {
    const base = (value || "").trim();
    if (base.includes(s.trim())) return; // no duplicar si ya está incluido
    onChange(base ? base + "\n" + s : s);
  }
  const yaIncluye = (s: string) => (value || "").includes((s || "").trim());
  // Sugerencias derivadas de las notas del pedido y del producto (el equipo
  // decide manualmente si incluirlas en lo que ve el tapicero).
  const notas = [
    { origen: "Nota del pedido", texto: (notasPedido || "").trim() },
    { origen: "Nota del producto", texto: (notasProducto || "").trim() },
  ].filter((n) => n.texto && !yaIncluye(n.texto));
  return (
    <div className="mb-3 rounded-lg border border-slate-200 bg-white p-2.5">
      <div className="mb-1.5 text-xs font-medium text-slate-500">Comentarios para el tapicero <span className="text-slate-400">(esto sí lo ve)</span></div>
      <textarea
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        rows={2}
        placeholder="Dirección de la tela, indicaciones de tapizado…"
        className="w-full resize-none rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm focus:border-slate-400 focus:outline-none"
      />
      {notas.length > 0 && (
        <div className="mt-2 space-y-1 rounded-lg border border-amber-200 bg-amber-50/60 p-2">
          <div className="text-[11px] font-medium text-amber-700">Sugerencias (pulsa para añadirlas):</div>
          {notas.map((n) => (
            <button key={n.origen} type="button" onClick={() => añadir(n.texto)}
              className="flex w-full items-start gap-1.5 rounded-md border border-amber-200 bg-white px-2 py-1 text-left text-[11px] text-slate-600 hover:bg-amber-100">
              <Plus className="mt-0.5 h-3 w-3 shrink-0 text-amber-600" />
              <span><span className="font-medium text-amber-700">{n.origen}:</span> {n.texto}</span>
            </button>
          ))}
        </div>
      )}
      <div className="mt-1.5 flex flex-wrap gap-1">
        {SUGERENCIAS_TAPICERO.map((s) => (
          <button key={s} type="button" onClick={() => añadir(s)}
            className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] text-slate-600 hover:bg-slate-100">
            + {s}
          </button>
        ))}
      </div>
    </div>
  );
}

function ArchivoSlot({ pedidoId, tipo, titulo, accept, icon, archivos, generando, puedeGenerar, motivoNoGenerar }: {
  pedidoId: string; tipo: "plantilla" | "referencia"; titulo: string; accept: string; icon: React.ReactNode;
  archivos: { id: string; nombre: string; url: string; storagePath: string; subidoPor: string; createdAt: string }[];
  generando: boolean; puedeGenerar: boolean; motivoNoGenerar: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [indicando, setIndicando] = useState(false);
  // La imagen se genera con la IA de Lovable (modelo de imagen de Gemini).
  const motor = tipo === "plantilla" ? "Claude" : "Lovable";
  const pendientes = archivos.filter(archivoPendienteIA);
  const aprobados = archivos.filter((a) => !archivoPendienteIA(a));
  const esImagen = (a: { nombre: string }) => /\.(png|jpe?g|webp|gif|svg)$/i.test(a.nombre);

  async function generar(indicacion?: string, corregir?: string) {
    if (indicando) return;
    setIndicando(true);
    try { await actions.generarArchivoIA(pedidoId, tipo, indicacion, corregir ? { corregir } : undefined); } finally { setIndicando(false); }
  }
  // Corrige ESTA versión: se manda la imagen o el croquis anterior con la
  // indicación y solo cambia eso (no se empieza de cero).
  async function corregirEsta(archivoId: string) {
    const texto = await pedirTexto({
      titulo: tipo === "plantilla" ? "¿Qué corrijo en este croquis?" : "¿Qué corrijo en esta imagen?",
      texto: tipo === "plantilla" ? "Ej.: el arco central más bajo, enchufe a 40 cm del borde izquierdo…" : "Ej.: quita los otros cojines, el vivo más fino, la tela más clara…",
      aceptar: "Corregir",
    });
    if (texto == null || !texto.trim()) return;
    await generar(texto, archivoId);
  }
  const ocupado = generando || indicando;

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-2.5">
      <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-medium text-slate-500">{titulo}</span>
        <div className="flex shrink-0 items-center gap-1">
          <button type="button" disabled={ocupado || !puedeGenerar} title={puedeGenerar ? `Generar con ${motor}` : motivoNoGenerar}
            onClick={() => void generar()}
            className="inline-flex items-center gap-1 rounded-lg border border-violet-300 bg-violet-50 px-2 py-1 text-[11px] font-medium text-violet-700 hover:bg-violet-100 disabled:cursor-not-allowed disabled:opacity-50">
            {ocupado ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />} {ocupado ? "Generando…" : aprobados.length + pendientes.length > 0 ? `Regenerar (${motor})` : `Generar con ${motor}`}
          </button>
          <button type="button" onClick={() => ref.current?.click()} className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50">
            {icon} Subir
          </button>
        </div>
        <input ref={ref} type="file" accept={accept} className="hidden" onChange={(e) => {
          const f = e.target.files?.[0]; if (f) void actions.subirArchivoPedido(pedidoId, tipo, f);
          if (ref.current) ref.current.value = "";
        }} />
      </div>

      {ocupado && (
        <div className="mb-2 rounded-md bg-violet-50 px-2 py-1.5 text-[11px] text-violet-700">
          {motor} está {tipo === "plantilla" ? "dibujando el croquis" : "creando la imagen"}… puede tardar alrededor de un minuto. Puedes seguir trabajando.
        </div>
      )}

      {/* Pendientes de aprobar: vista previa grande + botones */}
      {pendientes.map((a) => (
        <div key={a.id} className="mb-2 rounded-lg border-2 border-amber-300 bg-amber-50 p-2">
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-amber-700"><Sparkles className="h-3 w-3" /> Pendiente de aprobar · {motor}</span>
            <span className="text-[10px] text-amber-700/70">{formatShortDate(a.createdAt.slice(0, 10))}</span>
          </div>
          {esImagen(a) ? (
            <a href={a.url} target="_blank" rel="noreferrer" title="Abrir en grande">
              <img src={a.url} alt={titulo} loading="lazy" className="max-h-64 w-full rounded-md border border-amber-200 bg-white object-contain" />
            </a>
          ) : (
            <a href={a.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"><Download className="h-3.5 w-3.5" /> {a.nombre}</a>
          )}
          <div className="mt-2 flex flex-wrap gap-1.5">
            <button type="button" onClick={() => void actions.aprobarArchivoIA(a.id)}
              className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-emerald-700">
              <CheckCircle2 className="h-3.5 w-3.5" /> Aprobar
            </button>
            <button type="button" disabled={ocupado} onClick={() => void generar()}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">
              <RefreshCw className="h-3.5 w-3.5" /> Regenerar
            </button>
            <button type="button" disabled={ocupado} onClick={() => void corregirEsta(a.id)}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">
              <MessageSquarePlus className="h-3.5 w-3.5" /> Corregir esta
            </button>
            <button type="button" onClick={() => void confirmar({ titulo: "¿Descartar este archivo generado?", peligroso: true, aceptar: "Descartar" }).then((ok) => { if (ok) void actions.deleteArchivoPedido(a.id, a.storagePath); })}
              className="ml-auto inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] text-slate-500 hover:text-rose-600">
              <Trash2 className="h-3.5 w-3.5" /> Descartar
            </button>
          </div>
        </div>
      ))}

      {aprobados.length === 0 ? (
        pendientes.length === 0 && !ocupado && <div className="py-2 text-center text-[11px] text-slate-400">Sin archivos</div>
      ) : (
        <ul className="space-y-1">
          {aprobados.map((a) => (
            <li key={a.id} className="flex items-center gap-2 text-xs">
              {esImagen(a) && <a href={a.url} target="_blank" rel="noreferrer" className="shrink-0"><img src={a.url} alt="" loading="lazy" className="h-10 w-14 rounded border border-slate-200 bg-white object-cover" /></a>}
              <a href={a.url} target="_blank" rel="noreferrer" className="inline-flex min-w-0 flex-1 items-center gap-1 text-blue-600 hover:underline">
                <Download className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">{a.nombre}</span>
              </a>
              <button onClick={() => void confirmar({ titulo: "¿Eliminar este archivo?", peligroso: true, aceptar: "Eliminar" }).then((ok) => { if (ok) void actions.deleteArchivoPedido(a.id, a.storagePath); })} className="text-slate-400 hover:text-rose-600"><Trash2 className="h-3.5 w-3.5" /></button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// Enchufes, interruptores, huecos y anclajes del cabecero, medidos como en los
// croquis de Juan (visto desde la cama): del borde lateral al MARCO y del
// borde inferior a la base del marco. Se guardan en pasos_tapicero["@huecos"]
// (sin columnas nuevas); los usa el croquis de Claude y los ve el tapicero.
function HuecosEditor({ huecos, onChange }: { huecos: HuecoPedido[]; onChange: (h: HuecoPedido[]) => void }) {
  const inp = "w-full rounded border border-slate-200 px-2 py-1 text-xs";
  const num = (v: string): number | null => { const n = Number(v.replace(",", ".")); return v.trim() === "" || !Number.isFinite(n) ? null : n; };
  const set = (i: number, cambio: Partial<HuecoPedido>) => onChange(huecos.map((h, j) => (j === i ? { ...h, ...cambio } : h)));
  const nuevoMarco3 = (): HuecoPedido => ({ ...huecoVacio("enchufe"), ancho: 22.2, alto: 8, nota: "marco de 3, huecos Ø6" });
  return (
    <div className="mt-3 rounded-lg border border-slate-200 bg-white p-2.5">
      <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500"><Plug className="h-3.5 w-3.5" /> Enchufes, interruptores y huecos <span className="font-normal text-slate-400">(van al croquis)</span></span>
        <div className="flex gap-1">
          <button type="button" onClick={() => onChange([...huecos, nuevoMarco3()])} className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50">
            <Plus className="h-3.5 w-3.5" /> Marco de 3 enchufes
          </button>
          <button type="button" onClick={() => onChange([...huecos, huecoVacio("otro")])} className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50">
            <Plus className="h-3.5 w-3.5" /> Otro
          </button>
        </div>
      </div>
      {huecos.length === 0 ? (
        <div className="py-1 text-[11px] text-slate-400">Ninguno. Si el cabecero lleva enchufes, añade cada marco con sus distancias en cm.</div>
      ) : (
        <div className="space-y-1.5">
          <div className="hidden grid-cols-[7rem_5.5rem_1fr_1fr_4rem_4rem_1fr_3rem] gap-1.5 text-[10px] uppercase tracking-wide text-slate-400 sm:grid">
            <span>Tipo</span><span>Medido desde</span><span>Borde → marco</span><span>Abajo → base</span><span>Ancho</span><span>Alto</span><span>Nota</span><span />
          </div>
          {huecos.map((h, i) => (
            <div key={i} className="grid grid-cols-2 gap-1.5 sm:grid-cols-[7rem_5.5rem_1fr_1fr_4rem_4rem_1fr_3rem]">
              <select className={inp} value={h.tipo} onChange={(e) => set(i, { tipo: e.target.value as TipoHueco })}>
                {TIPOS_HUECO.map((t) => <option key={t} value={t}>{TIPO_HUECO_LABEL[t]}</option>)}
              </select>
              <select className={inp} value={h.lado} onChange={(e) => set(i, { lado: e.target.value === "der" ? "der" : "izq" })}>
                <option value="izq">Borde izq.</option>
                <option value="der">Borde der.</option>
              </select>
              <input type="text" inputMode="decimal" className={inp} placeholder="p. ej. 27,5" value={h.desdeBorde ?? ""} onChange={(e) => set(i, { desdeBorde: num(e.target.value) })} />
              <input type="text" inputMode="decimal" className={inp} placeholder="p. ej. 44,5" value={h.desdeAbajo ?? ""} onChange={(e) => set(i, { desdeAbajo: num(e.target.value) })} />
              <input type="text" inputMode="decimal" className={inp} placeholder="22,2" value={h.ancho ?? ""} onChange={(e) => set(i, { ancho: num(e.target.value) })} />
              <input type="text" inputMode="decimal" className={inp} placeholder="8" value={h.alto ?? ""} onChange={(e) => set(i, { alto: num(e.target.value) })} />
              <input type="text" className={inp} placeholder="marco de 3, Ø6…" value={h.nota} onChange={(e) => set(i, { nota: e.target.value })} />
              <div className="flex items-center justify-end gap-1">
                <button type="button" onClick={() => onChange([...huecos.slice(0, i + 1), huecoEnEspejo(h), ...huecos.slice(i + 1)])} className="text-[10px] font-medium text-slate-500 hover:text-slate-800" title="Añadir el mismo al otro lado">⇄</button>
                <button type="button" onClick={() => onChange(huecos.filter((_, j) => j !== i))} className="text-slate-400 hover:text-rose-600" title="Quitar"><X className="h-3.5 w-3.5" /></button>
              </div>
            </div>
          ))}
          <div className="text-[10px] text-slate-400">Visto desde la cama. "Borde → marco": del borde lateral del cabecero al marco. "Abajo → base": del borde inferior del cabecero a la base del marco. ⇄ añade el mismo al otro lado.</div>
        </div>
      )}
    </div>
  );
}

// Colocación del cabecero en la pared (opcional): altura de colgado, ancho de
// la pared y si va centrado o pegado a un lado. Va al croquis ("En la pared").
function ParedEditor({ pared, onChange }: { pared: ColocacionPared; onChange: (c: ColocacionPared) => void }) {
  const inp = "w-full rounded border border-slate-200 px-2 py-1 text-xs";
  const num = (v: string): number | null => { const n = Number(v.replace(",", ".")); return v.trim() === "" || !Number.isFinite(n) ? null : n; };
  return (
    <div className="mt-3 rounded-lg border border-slate-200 bg-white p-2.5">
      <div className="mb-1.5 text-xs font-medium text-slate-500">Colocación en la pared <span className="font-normal text-slate-400">(opcional, va al croquis)</span></div>
      <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-3">
        <label className="text-[10px] uppercase tracking-wide text-slate-400">Colgado a (cm del suelo)
          <input type="text" inputMode="decimal" className={inp} placeholder="p. ej. 25" value={pared.alturaSuelo ?? ""} onChange={(e) => onChange({ ...pared, alturaSuelo: num(e.target.value) })} />
        </label>
        <label className="text-[10px] uppercase tracking-wide text-slate-400">Ancho de la pared (cm)
          <input type="text" inputMode="decimal" className={inp} placeholder="p. ej. 278" value={pared.anchoPared ?? ""} onChange={(e) => onChange({ ...pared, anchoPared: num(e.target.value) })} />
        </label>
        <label className="text-[10px] uppercase tracking-wide text-slate-400">Posición
          <select className={inp} value={pared.posicion} onChange={(e) => onChange({ ...pared, posicion: e.target.value as PosicionPared })}>
            <option value="">Sin indicar</option>
            <option value="centrado">Centrado</option>
            <option value="izq">Pegado a la izquierda</option>
            <option value="der">Pegado a la derecha</option>
          </select>
        </label>
      </div>
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
              <button onClick={() => void confirmar({ titulo: "¿Eliminar esta etiqueta?", peligroso: true, aceptar: "Eliminar" }).then((ok) => { if (ok) void actions.deleteArchivoPedido(a.id, a.storagePath); })} className="text-slate-400 hover:text-rose-600"><Trash2 className="h-3.5 w-3.5" /></button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
