import { createFileRoute, Link } from "@tanstack/react-router";
import { Fragment, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Mic, Sparkles, User, UserPlus, Link2, Unlink, Ban, RotateCcw, Search, ChevronDown, ChevronRight } from "lucide-react";
import { useStore } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { StageBadge } from "@/components/StageBadge";
import { PropuestaCard } from "@/components/whatsapp/PropuestaCard";
import { confirmar } from "@/components/Confirmar";
import { useWhatsapp, waActions } from "@/lib/whatsapp/store";
import { nombreConversacion, formatTelefonoWa, tiempoRelativo, partesAudio, type WaMensaje } from "@/lib/whatsapp/types";
import { TIPO_LABEL, normalizeTipo } from "@/lib/catalogo";

export const Route = createFileRoute("/whatsapp/$id")({
  head: () => ({ meta: [{ title: "Conversación de WhatsApp — TiroCRM" }] }),
  component: ConversacionPage,
});

function diaDe(iso: string): string {
  return new Date(iso).toLocaleDateString("es-ES", { weekday: "short", day: "2-digit", month: "short", year: "numeric" });
}
function horaDe(iso: string): string {
  return new Date(iso).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
}

// Las notas de voz se ven con su icono y, cuando ya están transcritas, con lo que dicen.
function TextoMensaje({ m }: { m: WaMensaje }) {
  const audio = partesAudio(m.texto);
  if (!audio) return <p className="whitespace-pre-wrap break-words">{m.texto || <span className="italic text-slate-400">[{m.tipo}]</span>}</p>;
  return (
    <div>
      <p className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide opacity-70"><Mic className="h-3 w-3" /> {audio.etiqueta}</p>
      {audio.texto
        ? <p className="whitespace-pre-wrap break-words italic">«{audio.texto}»</p>
        : <p className="text-xs italic opacity-60">Sin transcribir todavía</p>}
    </div>
  );
}

function Burbujas({ mensajes }: { mensajes: WaMensaje[] }) {
  let ultimoDia = "";
  return (
    <div className="space-y-1.5">
      {mensajes.map((m) => {
        const dia = diaDe(m.enviadoAt);
        const separador = dia !== ultimoDia;
        ultimoDia = dia;
        const mio = m.direccion === "saliente";
        return (
          <div key={m.id}>
            {separador && <div className="my-3 text-center text-[11px] font-medium uppercase tracking-wide text-slate-400">{dia}</div>}
            <div className={`flex ${mio ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm shadow-sm ${mio ? "rounded-br-sm bg-emerald-100 text-emerald-950" : "rounded-bl-sm border border-slate-200 bg-white text-slate-800"}`}>
                <TextoMensaje m={m} />
                <p className={`mt-0.5 text-right text-[10px] ${mio ? "text-emerald-700/70" : "text-slate-400"}`}>{horaDe(m.enviadoAt)}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ConversacionPage() {
  const { id } = Route.useParams();
  const wa = useWhatsapp();
  const { leads } = useStore();
  const { email } = useAuth();
  const conv = wa.conversaciones.find((c) => c.id === id);
  const mensajes = wa.mensajes[id];
  const [buscar, setBuscar] = useState("");
  const [verResueltas, setVerResueltas] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => { void waActions.cargarMensajes(id); }, [id]);

  const lead = conv?.leadId ? leads.find((l) => l.id === conv.leadId) : undefined;
  const propuestas = useMemo(() => wa.propuestas.filter((p) => p.conversacionId === id), [wa.propuestas, id]);
  const pendientes = propuestas.filter((p) => p.estado === "pendiente");
  const resueltas = propuestas.filter((p) => p.estado !== "pendiente");

  const candidatos = useMemo(() => {
    const q = buscar.trim().toLowerCase();
    if (q.length < 2) return [];
    return leads.filter((l) => l.nombre.toLowerCase().includes(q) || l.telefono.toLowerCase().includes(q) || l.email.toLowerCase().includes(q)).slice(0, 6);
  }, [buscar, leads]);

  if (!wa.loaded) return <p className="py-10 text-center text-sm text-slate-400">Cargando…</p>;
  if (!conv) {
    return (
      <div className="space-y-3">
        <Link to="/whatsapp" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900"><ArrowLeft className="h-4 w-4" /> Volver a WhatsApp</Link>
        <p className="text-sm text-slate-500">Esta conversación no existe.</p>
      </div>
    );
  }

  const nombre = nombreConversacion(conv, lead?.nombre);
  const d = conv.datos ?? {};
  const contacto = d.contacto ?? {};
  const datosContacto = [
    contacto.nombre ? ["Nombre", contacto.nombre] : null,
    contacto.ciudad ? ["Ciudad", contacto.ciudad] : null,
    contacto.provincia ? ["Provincia", contacto.provincia] : null,
    contacto.email ? ["Email", contacto.email] : null,
    contacto.direccion ? ["Dirección", contacto.direccion] : null,
  ].filter((x): x is [string, string] => !!x);

  async function accion(fn: () => Promise<unknown>) {
    setBusy(true);
    try { await fn(); } finally { setBusy(false); }
  }

  return (
    <div className="space-y-4">
      <Link to="/whatsapp" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900"><ArrowLeft className="h-4 w-4" /> Volver a WhatsApp</Link>

      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-base font-bold text-emerald-700">{nombre.slice(0, 1).toUpperCase()}</div>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-bold text-slate-900">{nombre}</h1>
          <p className="text-xs text-slate-500">{formatTelefonoWa(conv.telefono)}{conv.nombreWa && conv.nombreWa !== nombre ? ` · perfil «${conv.nombreWa}»` : ""} · {conv.mensajes} mensajes · último {tiempoRelativo(conv.ultimoMensajeAt)}</p>
        </div>
        <button onClick={() => void accion(() => waActions.analizar(conv.id))} disabled={busy || wa.analizando} className="inline-flex items-center gap-1.5 rounded-lg bg-[#1a1f36] px-3 py-2 text-sm font-semibold text-white hover:bg-[#2a2f46] disabled:opacity-50">
          <Sparkles className={`h-4 w-4 ${wa.analizando ? "animate-pulse" : ""}`} /> Analizar ahora
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
        {/* Chat */}
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 md:p-4">
          {!mensajes ? (
            <p className="py-8 text-center text-sm text-slate-400">Cargando mensajes…</p>
          ) : mensajes.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">Sin mensajes.</p>
          ) : (
            <Burbujas mensajes={mensajes} />
          )}
        </div>

        {/* Panel lateral */}
        <div className="space-y-4">
          {/* Cliente */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold"><User className="h-4 w-4 text-slate-500" /> Cliente en el CRM</h2>
            {lead ? (
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Link to="/clientes/$id" params={{ id: lead.id }} className="font-semibold text-[#1a4b5b] hover:underline">{lead.nombre}</Link>
                  <StageBadge etapa={lead.etapa} />
                </div>
                <p className="text-xs text-slate-500">{[lead.ciudad, lead.telefono, lead.email].filter(Boolean).join(" · ")}</p>
                <button disabled={busy} onClick={() => void confirmar({ titulo: "¿Desenlazar esta conversación?", texto: "La ficha del cliente no se borra; solo se deja de asociar el chat.", aceptar: "Desenlazar" }).then((ok) => { if (ok) void accion(() => waActions.desvincular(conv.id)); })} className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-rose-600">
                  <Unlink className="h-3 w-3" /> Desenlazar
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-slate-500">
                  {conv.estado === "ignorada" ? "Conversación descartada." : conv.estado === "no_cliente" ? "La IA cree que no es un cliente (proveedor, spam…)." : "Sin cliente asociado."}
                </p>
                {conv.estado === "ignorada" ? (
                  <button disabled={busy} onClick={() => void accion(() => waActions.ignorar(conv.id, false))} className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"><RotateCcw className="h-3.5 w-3.5" /> Recuperar</button>
                ) : (
                  <>
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                      <input value={buscar} onChange={(e) => setBuscar(e.target.value)} placeholder="Enlazar con un cliente existente…" className="w-full rounded-lg border border-slate-200 py-2 pl-8 pr-2 text-sm" />
                    </div>
                    {candidatos.length > 0 && (
                      <ul className="space-y-1">
                        {candidatos.map((l) => (
                          <li key={l.id}>
                            <button disabled={busy} onClick={() => void accion(() => waActions.vincular(conv.id, l.id))} className="flex w-full flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-sm hover:border-emerald-400 hover:bg-emerald-50 disabled:opacity-50">
                              <Link2 className="h-3.5 w-3.5 text-emerald-600" />
                              <span className="font-medium">{l.nombre}</span>
                              <StageBadge etapa={l.etapa} />
                              {l.telefono && <span className="text-xs text-slate-400">{l.telefono}</span>}
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                    <div className="flex flex-wrap gap-2 pt-1">
                      <button disabled={busy} onClick={() => void accion(() => waActions.crearCliente(conv, wa.config?.vendedorDefecto || email || ""))} className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
                        <UserPlus className="h-3.5 w-3.5" /> Crear cliente
                      </button>
                      <button disabled={busy} onClick={() => void accion(() => waActions.ignorar(conv.id))} className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50">
                        <Ban className="h-3.5 w-3.5" /> Descartar
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Propuestas */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold"><Sparkles className="h-4 w-4 text-amber-500" /> Propuestas {pendientes.length > 0 && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-800">{pendientes.length}</span>}</h2>
            {pendientes.length === 0 ? (
              <p className="text-xs text-slate-400">Nada pendiente.</p>
            ) : (
              <div className="space-y-2">{pendientes.map((p) => <PropuestaCard key={p.id} p={p} conv={conv} />)}</div>
            )}
            {resueltas.length > 0 && (
              <div className="mt-3">
                <button onClick={() => setVerResueltas((v) => !v)} className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800">
                  {verResueltas ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />} {resueltas.length} resuelta{resueltas.length === 1 ? "" : "s"}
                </button>
                {verResueltas && <div className="mt-2 space-y-2">{resueltas.map((p) => <PropuestaCard key={p.id} p={p} conv={conv} />)}</div>}
              </div>
            )}
          </div>

          {/* Lo que ha leído la IA */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm shadow-sm">
            <h2 className="mb-2 text-sm font-semibold">Lo que ha entendido la IA</h2>
            {conv.resumen ? <p className="text-slate-700">{conv.resumen}</p> : <p className="text-xs italic text-slate-400">{conv.analizadoHasta ? "Sin resumen." : "Todavía no lo ha leído."}</p>}
            {datosContacto.length > 0 && (
              <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
                {datosContacto.map(([k, v]) => (<Fragment key={k}><dt className="text-slate-400">{k}</dt><dd className="text-slate-700">{v}</dd></Fragment>))}
              </dl>
            )}
            {(d.productos?.length ?? 0) > 0 && (
              <ul className="mt-3 space-y-1 text-xs text-slate-700">
                {d.productos!.map((p, i) => {
                  const tipo = normalizeTipo(p.tipo) ?? "otro";
                  const medidas = [p.ancho, p.alto, p.fondo].filter((n) => n != null).join("×");
                  return <li key={i}>• {[TIPO_LABEL[tipo], p.modelo, medidas ? `${medidas} cm` : "", p.tela, p.color, p.precio ? `${p.precio} €` : ""].filter(Boolean).join(" · ")}</li>;
                })}
              </ul>
            )}
            {(d.novedades?.length ?? 0) > 0 && (
              <div className="mt-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Novedades</p>
                <ul className="mt-1 space-y-0.5 text-xs text-slate-700">{d.novedades!.map((n, i) => <li key={i}>• {n}</li>)}</ul>
              </div>
            )}
            {(d.auto?.length ?? 0) > 0 && (
              <div className="mt-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Hecho automáticamente</p>
                <ul className="mt-1 space-y-0.5 text-xs text-emerald-700">{d.auto!.map((n, i) => <li key={i}>✓ {n}</li>)}</ul>
              </div>
            )}
            {d.duda_identidad && <p className="mt-3 text-xs text-amber-700">⚠ {d.duda_identidad}</p>}
            {conv.ultimoAnalisisAt && <p className="mt-3 text-[11px] text-slate-400">Última lectura {tiempoRelativo(conv.ultimoAnalisisAt)}{d.modo === "historico" ? " · historial" : ""}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
