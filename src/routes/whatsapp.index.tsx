import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { MessageCircle, RefreshCw, Sparkles, Copy, Check, AlertTriangle, ChevronDown, ChevronRight, Settings2, Wifi, WifiOff, User, Instagram, Mail } from "lucide-react";
import { useStore } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { StageBadge } from "@/components/StageBadge";
import { PropuestaCard } from "@/components/whatsapp/PropuestaCard";
import { useWhatsapp, waActions, type EstadoCanal } from "@/lib/whatsapp/store";
import { nombreConversacion, identificadorConversacion, tiempoRelativo, type WaConversacion, type WaPropuesta } from "@/lib/whatsapp/types";
import { canalDe, CANAL_LABEL, type Canal } from "@/lib/whatsapp/canales";
import { appsScriptCorreo } from "@/lib/whatsapp/apps-script";
import { CanalIcono, CanalChip, CANAL_ESTILO } from "@/components/whatsapp/CanalIcono";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// ── Bandeja de mensajes: WhatsApp, Instagram y email ───────────────────────
// Qué ha entrado por cada canal, con qué cliente va cada conversación y qué
// propone la IA. Todo lo que cambia la ficha pasa por aquí con un toque (o
// desde la ficha del cliente, que enseña las mismas propuestas).

export const Route = createFileRoute("/whatsapp/")({
  head: () => ({ meta: [{ title: "Mensajes — TiroCRM" }] }),
  component: WhatsappPage,
});

type Pestana = "pendientes" | "todas" | "sin-cliente" | "descartadas";
type FiltroCanal = "todos" | Canal;

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
  const [canal, setCanal] = useState<FiltroCanal>("todos");

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
    const conMensajes = wa.conversaciones.filter((c) => (c.mensajes > 0 || !!c.ultimoMensajeAt) && (canal === "todos" || canalDe(c.telefono) === canal));
    const todas = conMensajes.filter((c) => c.estado !== "ignorada");
    const pendientes = todas.filter((c) => (pendientesPorConv.get(c.id)?.length ?? 0) > 0 || (c.estado === "nueva" && c.analizadoHasta && c.datos?.es_cliente !== false && !esHistorico(c)));
    const sinCliente = todas.filter((c) => !c.leadId && (c.estado === "nueva" || c.estado === "no_cliente"));
    const descartadas = conMensajes.filter((c) => c.estado === "ignorada");
    return { pendientes, todas, sinCliente, descartadas };
  }, [wa.conversaciones, pendientesPorConv, canal]);

  // Conversaciones con algo por revisar, por canal (para los contadores de los filtros).
  const porCanal = useMemo(() => {
    const out: Record<Canal, number> = { whatsapp: 0, instagram: 0, email: 0 };
    for (const c of wa.conversaciones) {
      if (c.estado === "ignorada" || !(c.mensajes > 0 || c.ultimoMensajeAt)) continue;
      if ((pendientesPorConv.get(c.id)?.length ?? 0) > 0) out[canalDe(c.telefono)]++;
    }
    return out;
  }, [wa.conversaciones, pendientesPorConv]);

  const lista = pestana === "pendientes" ? listas.pendientes : pestana === "todas" ? listas.todas : pestana === "sin-cliente" ? listas.sinCliente : listas.descartadas;
  const totalPropuestas = wa.propuestas.filter((p) => p.estado === "pendiente").length;
  const cfg = wa.config;
  const conectado = !!cfg?.ultimoEventoAt;
  const origen = typeof window !== "undefined" ? window.location.origin : "";
  const webhookUrl = cfg ? `${origen}/api/whatsapp/webhook?token=${cfg.webhookToken}` : "";
  const igWebhookUrl = cfg ? `${origen}/api/instagram/webhook?token=${cfg.webhookToken}` : "";
  const ig = wa.canales.find((c) => c.canal === "instagram");
  const correo = wa.canales.find((c) => c.canal === "email");
  const sinAnalizar = wa.conversaciones.filter((c) => c.estado !== "ignorada" && c.ultimoMensajeAt && (!c.analizadoHasta || c.analizadoHasta < c.ultimoMensajeAt)).length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
            <MessageCircle className="h-6 w-6 text-emerald-600" /> Mensajes
          </h1>
          <p className="text-xs text-slate-400">WhatsApp, Instagram y email de info@</p>
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
          <span className="inline-flex items-center gap-1.5"><Wifi className="h-3.5 w-3.5" /> WhatsApp conectado · último mensaje recibido {tiempoRelativo(cfg.ultimoEventoAt)}</span>
        ) : (
          <span className="inline-flex items-center gap-1.5"><WifiOff className="h-3.5 w-3.5" /> Todavía no ha llegado ningún mensaje. Falta vincular el número en el proveedor (ver configuración).</span>
        )}
        {esAdmin && <EstadoCanalChip nombre="Instagram" icono={<Instagram className="h-3.5 w-3.5" />} estado={ig} />}
        {esAdmin && <EstadoCanalChip nombre="Email" icono={<Mail className="h-3.5 w-3.5" />} estado={correo} />}
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
          <h2 className="flex items-center gap-2 font-semibold"><MessageCircle className="h-4 w-4 text-emerald-600" /> Conectar el número de WhatsApp Business</h2>
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
          <ConfigInstagram webhookUrl={igWebhookUrl} verifyToken={cfg.verifyToken} estado={ig} />
          <ConfigCorreo url={`${origen}/api/correo/entrada`} token={cfg.webhookToken} estado={correo} />
        </div>
      )}

      {/* Canal */}
      <div className="flex flex-wrap gap-2 text-sm">
        {(["todos", "whatsapp", "instagram", "email"] as FiltroCanal[]).map((k) => {
          const activo = canal === k;
          const n = k === "todos" ? 0 : porCanal[k];
          return (
            <button key={k} onClick={() => setCanal(k)} className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 font-medium transition-colors ${activo ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}>
              {k === "todos" ? <MessageCircle className="h-3.5 w-3.5" /> : <CanalIcono canal={k} className={`h-3.5 w-3.5 ${activo ? "!text-white" : ""}`} />}
              {k === "todos" ? "Todos" : CANAL_LABEL[k]}
              {n > 0 && <span className={`rounded-full px-1.5 text-[11px] font-bold ${activo ? "bg-white/20" : "bg-amber-100 text-amber-800"}`}>{n}</span>}
            </button>
          );
        })}
      </div>

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
            const cc = canalDe(c.telefono);
            return (
              <li key={c.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-start gap-3">
                  <div className={`relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold ${CANAL_ESTILO[cc].avatar}`}>
                    {nombre.replace(/^@/, "").slice(0, 1).toUpperCase()}
                    <span className="absolute -bottom-0.5 -right-0.5 rounded-full bg-white p-0.5 shadow-sm"><CanalIcono canal={cc} className="h-3 w-3" /></span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link to="/whatsapp/$id" params={{ id: c.id }} className="font-semibold text-slate-900 hover:underline">{nombre}</Link>
                      <span className="text-xs text-slate-400">{identificadorConversacion(c)}</span>
                      {canal === "todos" && cc !== "whatsapp" && <CanalChip canal={cc} />}
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

// ── Estado y configuración de Instagram y email (solo admin) ────────────────
function EstadoCanalChip({ nombre, icono, estado }: { nombre: string; icono: React.ReactNode; estado?: EstadoCanal }) {
  if (!estado?.ultimoEventoAt) return <span className="inline-flex items-center gap-1.5 opacity-60">{icono} {nombre}: sin conectar</span>;
  return (
    <span className="inline-flex items-center gap-1.5" title={estado.ultimoError || undefined}>
      {icono} {nombre}: {tiempoRelativo(estado.ultimoEventoAt)}
      {estado.ultimoError && estado.ultimoErrorAt >= estado.ultimoEventoAt && <AlertTriangle className="h-3 w-3 text-rose-600" />}
    </span>
  );
}

function Bloque({ texto }: { texto: string }) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg bg-slate-50 p-2 font-mono text-[11px] text-slate-700">
      <span className="min-w-0 flex-1 break-all">{texto}</span>
      <CopiarBoton texto={texto} />
    </div>
  );
}

function ConfigInstagram({ webhookUrl, verifyToken, estado }: { webhookUrl: string; verifyToken: string; estado?: EstadoCanal }) {
  const [token, setToken] = useState("");
  const [secreto, setSecreto] = useState("");
  const [busy, setBusy] = useState(false);

  async function guardar(desconectar = false) {
    setBusy(true);
    try {
      const { data } = await supabase.auth.getSession();
      const res = await fetch("/api/instagram/config", {
        method: "POST",
        headers: { Authorization: `Bearer ${data.session?.access_token ?? ""}`, "Content-Type": "application/json" },
        body: JSON.stringify(desconectar ? { desconectar: true } : { accessToken: token, appSecret: secreto }),
      });
      const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (!res.ok) { toast.error(String(body.error ?? `Error ${res.status}`)); return; }
      toast.success(desconectar ? "Instagram desconectado" : `Instagram conectado: @${String(body.usuario ?? "")}`);
      setToken(""); setSecreto("");
      await waActions.recargar();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3 border-t border-slate-100 pt-4">
      <h2 className="flex items-center gap-2 font-semibold"><Instagram className="h-4 w-4 text-pink-600" /> Conectar los mensajes directos de Instagram</h2>
      {estado?.conClave ? (
        <p className="text-xs text-emerald-700">Cuenta conectada{estado.usuario ? `: @${estado.usuario}` : ""}{estado.ultimoEventoAt ? ` · último mensaje ${tiempoRelativo(estado.ultimoEventoAt)}` : " · todavía no ha llegado ningún mensaje"}.</p>
      ) : (
        <p className="text-xs text-slate-500">La cuenta de Instagram tiene que ser profesional (empresa o creador). Se hace una vez, desde el ordenador:</p>
      )}
      {estado?.ultimoError && <p className="text-xs text-rose-700">Último error {tiempoRelativo(estado.ultimoErrorAt)}: {estado.ultimoError}</p>}
      <ol className="list-decimal space-y-1.5 pl-5 text-slate-600">
        <li>En <span className="font-medium">developers.facebook.com</span> → Mis apps → Crear app (tipo «Empresa»). Añadir el producto <span className="font-medium">Instagram</span> → «API con inicio de sesión de Instagram».</li>
        <li>En «Generar identificadores de acceso», añadir la cuenta de Instagram de Tiroriro, iniciar sesión con ella y copiar el identificador (token) que aparece.</li>
        <li>En «Configurar webhooks», poner esta URL de devolución de llamada:</li>
      </ol>
      <Bloque texto={webhookUrl} />
      <p className="pl-5 text-slate-600">y este identificador de verificación:</p>
      <Bloque texto={verifyToken} />
      <ol className="list-decimal space-y-1.5 pl-5 text-slate-600" start={4}>
        <li>Pulsar «Verificar y guardar» y suscribirse al campo <span className="font-mono">messages</span>.</li>
        <li>Pegar aquí el token del paso 2 (y, si quieres más seguridad, la «clave secreta de la app de Instagram» de la configuración básica) y pulsar Conectar:</li>
      </ol>
      <div className="grid gap-2 pl-5 sm:grid-cols-[1fr_1fr_auto]">
        <input value={token} onChange={(e) => setToken(e.target.value)} placeholder="Token de acceso de Instagram (IGAA…)" className="rounded-lg border border-slate-200 px-3 py-2 font-mono text-xs" />
        <input value={secreto} onChange={(e) => setSecreto(e.target.value)} placeholder="Clave secreta de la app (opcional)" className="rounded-lg border border-slate-200 px-3 py-2 font-mono text-xs" />
        <button disabled={busy || !token.trim()} onClick={() => void guardar()} className="rounded-lg bg-pink-600 px-3 py-2 text-xs font-semibold text-white hover:bg-pink-700 disabled:opacity-50">{busy ? "Conectando…" : "Conectar"}</button>
      </div>
      <ol className="list-decimal space-y-1.5 pl-5 text-slate-600" start={6}>
        <li>Publicar la app (arriba, «Publicar» / modo «Activo») para que lleguen los mensajes de cualquier persona, no solo de las cuentas de prueba. Mandar un mensaje directo de prueba: en un minuto aparece aquí.</li>
      </ol>
      <p className="text-xs text-slate-400">La clave caduca a los 60 días; el CRM la renueva sola. Los mensajes directos solo llegan desde que se conecta (Instagram no deja leer el historial).</p>
      {estado?.conClave && (
        <button disabled={busy} onClick={() => void guardar(true)} className="text-xs text-slate-500 underline-offset-2 hover:text-rose-600 hover:underline">Desconectar Instagram</button>
      )}
    </div>
  );
}

function ConfigCorreo({ url, token, estado }: { url: string; token: string; estado?: EstadoCanal }) {
  const [ver, setVer] = useState(false);
  const cuenta = estado?.cuenta || "info@tirorirohome.com";
  const script = appsScriptCorreo({ url, token, cuenta });
  return (
    <div className="space-y-3 border-t border-slate-100 pt-4">
      <h2 className="flex items-center gap-2 font-semibold"><Mail className="h-4 w-4 text-sky-600" /> Conectar el correo de {cuenta}</h2>
      {estado?.ultimoEventoAt
        ? <p className="text-xs text-emerald-700">Conectado · último envío del correo {tiempoRelativo(estado.ultimoEventoAt)}.</p>
        : <p className="text-xs text-slate-500">Se hace una vez, con la sesión de {cuenta} abierta en el navegador:</p>}
      {estado?.ultimoError && <p className="text-xs text-rose-700">Último error {tiempoRelativo(estado.ultimoErrorAt)}: {estado.ultimoError}</p>}
      <ol className="list-decimal space-y-1.5 pl-5 text-slate-600">
        <li>Abrir <span className="font-medium">script.google.com</span> → «Nuevo proyecto».</li>
        <li>Borrar lo que haya y pegar este código (lleva ya la dirección y la clave del CRM):</li>
      </ol>
      <div className="flex flex-wrap items-center gap-2 pl-5">
        <CopiarBoton texto={script} />
        <button onClick={() => setVer((v) => !v)} className="text-xs text-slate-500 underline-offset-2 hover:underline">{ver ? "Ocultar código" : "Ver código"}</button>
      </div>
      {ver && <pre className="max-h-64 overflow-auto rounded-lg bg-slate-50 p-2 text-[10px] text-slate-700">{script}</pre>}
      <ol className="list-decimal space-y-1.5 pl-5 text-slate-600" start={3}>
        <li>Guardar, elegir la función <span className="font-mono">instalar</span> arriba y pulsar «Ejecutar». Aceptar los permisos de Gmail (es la propia cuenta).</li>
        <li>Listo: cada 5 minutos se mandan los correos nuevos. La primera vez también los de los últimos 30 días, como historial (solo se enlazan y resumen).</li>
      </ol>
      <p className="text-xs text-slate-400">El CRM solo guarda correos de personas: descarta avisos automáticos (formularios, Shopify, DHL, redes sociales, newsletters…) y lo que se envía a proveedores. Los clientes nuevos nunca se crean solos: queda la propuesta, sugiriendo Rocío o Juan si es un profesional.</p>
    </div>
  );
}
