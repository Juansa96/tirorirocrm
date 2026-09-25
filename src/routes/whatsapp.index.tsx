import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { MessageCircle, RefreshCw, Sparkles, Copy, Check, AlertTriangle, ChevronDown, ChevronRight, Settings2, Wifi, WifiOff, User } from "lucide-react";
import { useStore } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { StageBadge } from "@/components/StageBadge";
import { PropuestaCard } from "@/components/whatsapp/PropuestaCard";
import { useWhatsapp, waActions } from "@/lib/whatsapp/store";
import { nombreConversacion, formatTelefonoWa, tiempoRelativo, type WaConversacion, type WaPropuesta } from "@/lib/whatsapp/types";
import { toast } from "sonner";

// ── Bandeja de WhatsApp ─────────────────────────────────────────────────────
// Qué ha entrado por WhatsApp, con qué cliente va cada chat y qué propone la
// IA. Todo lo que cambia la ficha pasa por aquí con un toque (o desde la
// ficha del cliente, que enseña las mismas propuestas).

export const Route = createFileRoute("/whatsapp/")({
  head: () => ({ meta: [{ title: "WhatsApp — TiroCRM" }] }),
  component: WhatsappPage,
});

type Pestana = "pendientes" | "todas" | "sin-cliente" | "descartadas";

function esHistorico(c: WaConversacion): boolean { return c.datos?.modo === "historico"; }

function CopiarBoton({ texto }: { texto: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      onClick={() => { void navigator.clipboard?.writeText(texto).then(() => { setOk(true); setTimeout(() => setOk(false), 1500); }).catch(() => toast.error("No se pudo copiar")); }}
      className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50"
      title="Copiar"
    >
      {ok ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />} {ok ? "Copiado" : "Copiar"}
    </button>
  );
}

function WhatsappPage() {
  const wa = useWhatsapp();
  const { leads } = useStore();
  const { esAdmin } = useAuth();
  const [pestana, setPestana] = useState<Pestana>("pendientes");
  const [verConfig, setVerConfig] = useState(false);

  const pendientesPorConv = useMemo(() => {
    const m = new Map<string, WaPropuesta[]>();
    for (const p of wa.propuestas) {
      if (p.estado !== "pendiente") continue;
      const arr = m.get(p.conversacionId) ?? [];
      arr.push(p);
      m.set(p.conversacionId, arr);
    }
    return m;
  }, [wa.propuestas]);

  const leadDe = (c: WaConversacion) => (c.leadId ? leads.find((l) => l.id === c.leadId) : undefined);

  const listas = useMemo(() => {
    // Con mensajes = contador > 0 o algún mensaje recibido (por si el contador se quedó atrás).
    const conMensajes = wa.conversaciones.filter((c) => c.mensajes > 0 || !!c.ultimoMensajeAt);
    const todas = conMensajes.filter((c) => c.estado !== "ignorada");
    const pendientes = todas.filter((c) => (pendientesPorConv.get(c.id)?.length ?? 0) > 0 || (c.estado === "nueva" && c.analizadoHasta && c.datos?.es_cliente !== false && !esHistorico(c)));
    const sinCliente = todas.filter((c) => !c.leadId && (c.estado === "nueva" || c.estado === "no_cliente"));
    const descartadas = conMensajes.filter((c) => c.estado === "ignorada");
    return { pendientes, todas, sinCliente, descartadas };
  }, [wa.conversaciones, pendientesPorConv]);

  const lista = pestana === "pendientes" ? listas.pendientes : pestana === "todas" ? listas.todas : pestana === "sin-cliente" ? listas.sinCliente : listas.descartadas;
  const totalPropuestas = wa.propuestas.filter((p) => p.estado === "pendiente").length;
  const cfg = wa.config;
  const conectado = !!cfg?.ultimoEventoAt;
  const origen = typeof window !== "undefined" ? window.location.origin : "";
  const webhookUrl = cfg ? `${origen}/api/whatsapp/webhook?token=${cfg.webhookToken}` : "";
  const sinAnalizar = wa.conversaciones.filter((c) => c.estado !== "ignorada" && c.ultimoMensajeAt && (!c.analizadoHasta || c.analizadoHasta < c.ultimoMensajeAt)).length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
            <MessageCircle className="h-6 w-6 text-emerald-600" /> WhatsApp
          </h1>
          <p className="text-sm text-slate-500">
            {totalPropuestas > 0 ? `${totalPropuestas} propuesta${totalPropuestas === 1 ? "" : "s"} por revisar` : "Nada pendiente de revisar"}
            {sinAnalizar > 0 && ` · ${sinAnalizar} chat${sinAnalizar === 1 ? "" : "s"} con mensajes sin leer por la IA`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => void waActions.recargar()} disabled={wa.cargando} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">
            <RefreshCw className={`h-4 w-4 ${wa.cargando ? "animate-spin" : ""}`} /> Actualizar
          </button>
          <button onClick={() => void waActions.analizar()} disabled={wa.analizando} className="inline-flex items-center gap-1.5 rounded-lg bg-[#1a1f36] px-3 py-2 text-sm font-semibold text-white hover:bg-[#2a2f46] disabled:opacity-50">
            <Sparkles className={`h-4 w-4 ${wa.analizando ? "animate-pulse" : ""}`} /> {wa.analizando ? "Analizando…" : "Analizar ahora"}
          </button>
        </div>
      </div>

      {/* Estado de la conexión */}
      <div className={`flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border px-4 py-2.5 text-xs ${!cfg ? "border-rose-200 bg-rose-50 text-rose-700" : conectado ? "border-emerald-200 bg-emerald-50/60 text-emerald-800" : "border-amber-200 bg-amber-50/60 text-amber-800"}`}>
        {!cfg ? (
          <span className="inline-flex items-center gap-1.5"><WifiOff className="h-3.5 w-3.5" /> Falta la configuración de WhatsApp en la base de datos.</span>
        ) : conectado ? (
          <span className="inline-flex items-center gap-1.5"><Wifi className="h-3.5 w-3.5" /> Conectado · último mensaje recibido {tiempoRelativo(cfg.ultimoEventoAt)}</span>
        ) : (
          <span className="inline-flex items-center gap-1.5"><WifiOff className="h-3.5 w-3.5" /> Todavía no ha llegado ningún mensaje. Falta vincular el número en el proveedor (ver configuración).</span>
        )}
        {cfg?.ultimoProcesoAt && <span>Último análisis {tiempoRelativo(cfg.ultimoProcesoAt)}</span>}
        {cfg && !cfg.activo && <span className="font-semibold">Análisis desactivado</span>}
        {cfg?.ultimoError && (
          <span className="inline-flex items-center gap-1 text-rose-700" title={cfg.ultimoError}><AlertTriangle className="h-3.5 w-3.5" /> Último error {tiempoRelativo(cfg.ultimoErrorAt)}: {cfg.ultimoError.slice(0, 90)}</span>
        )}
        {esAdmin && (
          <button onClick={() => setVerConfig((v) => !v)} className="ml-auto inline-flex items-center gap-1 font-medium underline-offset-2 hover:underline">
            <Settings2 className="h-3.5 w-3.5" /> Configuración {verConfig ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          </button>
        )}
      </div>

      {verConfig && cfg && (
        <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 text-sm shadow-sm">
          <h2 className="font-semibold">Conectar el número de WhatsApp Business</h2>
          <ol className="list-decimal space-y-1.5 pl-5 text-slate-600">
            <li>Alta en el proveedor de coexistencia (Dualhook) y vincular el número escaneando el código QR desde la app WhatsApp Business del móvil. Marcar «compartir historial».</li>
            <li>En el proveedor, poner esta URL como destino de los webhooks (mensajes, ecos y historial):</li>
          </ol>
          <div className="flex flex-wrap items-center gap-2 rounded-lg bg-slate-50 p-2 font-mono text-[11px] text-slate-700">
            <span className="min-w-0 flex-1 break-all">{webhookUrl}</span>
            <CopiarBoton texto={webhookUrl} />
          </div>
          <ol className="list-decimal space-y-1.5 pl-5 text-slate-600" start={3}>
            <li>Si pide un «verify token» para la verificación de Meta, es este:</li>
          </ol>
          <div className="flex flex-wrap items-center gap-2 rounded-lg bg-slate-50 p-2 font-mono text-[11px] text-slate-700">
            <span className="min-w-0 flex-1 break-all">{cfg.verifyToken}</span>
            <CopiarBoton texto={cfg.verifyToken} />
          </div>
          <ol className="list-decimal space-y-1.5 pl-5 text-slate-600" start={4}>
            <li>Escribir un WhatsApp de prueba al número del negocio: en un minuto debe aparecer aquí como conversación nueva.</li>
          </ol>
          <p className="text-xs text-slate-400">Modelo de IA: {cfg.modelo} · Vendedora por defecto de los clientes nuevos: {cfg.vendedorDefecto}. Los mensajes se analizan solos cada 2 minutos (cron de la base de datos) y también al pulsar «Analizar ahora».</p>
          <p className="text-xs text-slate-500">Notas de voz: se descargan al llegar, se transcriben con la IA de Lovable y la IA las lee como un mensaje más. El audio se borra en cuanto está transcrito.</p>
          {wa.eventos.length > 0 && (
            <details className="text-xs text-slate-500">
              <summary className="cursor-pointer font-medium">Últimos eventos recibidos</summary>
              <ul className="mt-1 space-y-0.5 font-mono">
                {wa.eventos.map((e) => (
                  <li key={e.id} className={e.error ? "text-rose-600" : ""}>{new Date(e.recibidoAt).toLocaleString("es-ES")} · {e.campo} · {e.mensajes} msg{e.error ? ` · ${e.error}` : ""}</li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}

      {/* Pestañas */}
      <div className="flex flex-wrap gap-1 rounded-xl bg-slate-100 p-1 text-sm">
        {([
          ["pendientes", `Pendientes (${listas.pendientes.length})`],
          ["todas", `Todas (${listas.todas.length})`],
          ["sin-cliente", `Sin cliente (${listas.sinCliente.length})`],
          ["descartadas", `Descartadas (${listas.descartadas.length})`],
        ] as Array<[Pestana, string]>).map(([k, label]) => (
          <button key={k} onClick={() => setPestana(k)} className={`rounded-lg px-3 py-1.5 font-medium transition-colors ${pestana === k ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}>{label}</button>
        ))}
      </div>

      {!wa.loaded ? (
        <p className="py-10 text-center text-sm text-slate-400">Cargando…</p>
      ) : lista.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 py-12 text-center text-sm text-slate-400">
          {pestana === "pendientes" ? "No hay nada que revisar. 🎉" : "No hay conversaciones aquí."}
        </div>
      ) : (
        <ul className="space-y-3">
          {lista.map((c) => {
            const lead = leadDe(c);
            const props = pendientesPorConv.get(c.id) ?? [];
            const nombre = nombreConversacion(c, lead?.nombre);
            return (
              <li key={c.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-sm font-bold text-emerald-700">{nombre.slice(0, 1).toUpperCase()}</div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link to="/whatsapp/$id" params={{ id: c.id }} className="font-semibold text-slate-900 hover:underline">{nombre}</Link>
                      <span className="text-xs text-slate-400">{formatTelefonoWa(c.telefono)}</span>
                      {lead ? (
                        <>
                          <Link to="/clientes/$id" params={{ id: lead.id }} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700 hover:bg-slate-200"><User className="h-3 w-3" /> Ficha</Link>
                          <StageBadge etapa={lead.etapa} />
                        </>
                      ) : c.estado === "no_cliente" ? (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">No parece cliente</span>
                      ) : c.estado === "ignorada" ? (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">Descartada</span>
                      ) : (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800">Sin cliente</span>
                      )}
                      {esHistorico(c) && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">Historial</span>}
                      <span className="ml-auto text-xs text-slate-400">{tiempoRelativo(c.ultimoMensajeAt)} · {c.mensajes} msg</span>
                    </div>
                    {c.resumen ? (
                      <p className="mt-1 line-clamp-2 text-sm text-slate-600">{c.resumen}</p>
                    ) : (
                      <p className="mt-1 text-sm italic text-slate-400">{c.analizadoHasta ? "Sin resumen." : "Pendiente de que la IA lo lea."}</p>
                    )}
                    {props.length > 0 && (
                      <div className="mt-3 space-y-2">
                        {props.map((p) => <PropuestaCard key={p.id} p={p} conv={c} />)}
                      </div>
                    )}
                    {props.length === 0 && !lead && c.estado === "nueva" && c.analizadoHasta && !esHistorico(c) && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Link to="/whatsapp/$id" params={{ id: c.id }} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">Enlazar o crear cliente</Link>
                        <button onClick={() => void waActions.ignorar(c.id)} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-50">Descartar</button>
                      </div>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
