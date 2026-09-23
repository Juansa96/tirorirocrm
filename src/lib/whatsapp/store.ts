// ══════════════════════════════════════════════════════════════════════════
// Estado de WhatsApp en el navegador (bandeja /whatsapp y ficha del cliente).
//
// Separado del store principal para no tocar src/lib/store.ts: carga las
// conversaciones, propuestas y configuración, se suscribe a realtime y
// ofrece las acciones del equipo. Aplicar una propuesta REUTILIZA las
// acciones del store principal (setLeadEtapa, updateLead, addProducto…), así
// pasa por las mismas reglas que un cambio hecho a mano.
// ══════════════════════════════════════════════════════════════════════════

import { useEffect, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { actions } from "@/lib/store";
import { todayISO } from "@/lib/format";
import { normalizeTipo, TIPO_LABEL } from "@/lib/catalogo";
import type { Lead, Producto, Etapa } from "@/lib/types";
import {
  mapWaConversacion, mapWaMensaje, mapWaPropuesta, mapWaConfig, mapWaEvento, formatTelefonoWa,
  type WaConversacion, type WaMensaje, type WaPropuesta, type WaConfig, type WaEvento, type ProductoIA,
} from "./types";

interface WaState {
  loaded: boolean;
  cargando: boolean;
  config: WaConfig | null;
  conversaciones: WaConversacion[];
  propuestas: WaPropuesta[];          // pendientes + últimas resueltas
  mensajes: Record<string, WaMensaje[]>;
  eventos: WaEvento[];
  analizando: boolean;
}

let state: WaState = { loaded: false, cargando: false, config: null, conversaciones: [], propuestas: [], mensajes: {}, eventos: [], analizando: false };
const SERVER: WaState = state;
const listeners = new Set<() => void>();
function emit() { listeners.forEach((l) => l()); }
function set(patch: Partial<WaState>) { state = { ...state, ...patch }; emit(); }

let initStarted = false;
let canal: ReturnType<typeof supabase.channel> | null = null;

function ordenar(cs: WaConversacion[]): WaConversacion[] {
  return [...cs].sort((a, b) => (b.ultimoMensajeAt || b.createdAt).localeCompare(a.ultimoMensajeAt || a.createdAt));
}

async function cargarTodo() {
  set({ cargando: true });
  const [cfg, convs, props, evs] = await Promise.all([
    supabase.from("whatsapp_config").select("*").eq("id", 1).maybeSingle(),
    supabase.from("whatsapp_conversaciones").select("*").order("ultimo_mensaje_at", { ascending: false, nullsFirst: false }).limit(1000),
    supabase.from("whatsapp_propuestas").select("*").order("created_at", { ascending: false }).limit(400),
    supabase.from("whatsapp_eventos").select("id, recibido_at, campo, mensajes, error").order("id", { ascending: false }).limit(20),
  ]);
  set({
    loaded: true,
    cargando: false,
    config: cfg.data ? mapWaConfig(cfg.data as Record<string, unknown>) : null,
    conversaciones: ordenar(((convs.data ?? []) as Record<string, unknown>[]).map(mapWaConversacion)),
    propuestas: ((props.data ?? []) as Record<string, unknown>[]).map(mapWaPropuesta),
    eventos: ((evs.data ?? []) as Record<string, unknown>[]).map(mapWaEvento),
  });
}

function init() {
  if (initStarted || typeof window === "undefined") return;
  initStarted = true;
  void cargarTodo();
  canal = supabase
    .channel("tirocrm-whatsapp")
    .on("postgres_changes", { event: "*", schema: "public", table: "whatsapp_conversaciones" }, (payload) => {
      if (payload.eventType === "DELETE") {
        const id = (payload.old as Record<string, unknown>).id as string;
        set({ conversaciones: state.conversaciones.filter((c) => c.id !== id) });
        return;
      }
      const c = mapWaConversacion(payload.new as Record<string, unknown>);
      const existe = state.conversaciones.some((x) => x.id === c.id);
      set({ conversaciones: ordenar(existe ? state.conversaciones.map((x) => (x.id === c.id ? c : x)) : [c, ...state.conversaciones]) });
    })
    .on("postgres_changes", { event: "*", schema: "public", table: "whatsapp_propuestas" }, (payload) => {
      if (payload.eventType === "DELETE") {
        const id = (payload.old as Record<string, unknown>).id as string;
        set({ propuestas: state.propuestas.filter((p) => p.id !== id) });
        return;
      }
      const p = mapWaPropuesta(payload.new as Record<string, unknown>);
      const existe = state.propuestas.some((x) => x.id === p.id);
      set({ propuestas: existe ? state.propuestas.map((x) => (x.id === p.id ? p : x)) : [p, ...state.propuestas] });
    })
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "whatsapp_mensajes" }, (payload) => {
      const m = mapWaMensaje(payload.new as Record<string, unknown>);
      const lista = state.mensajes[m.conversacionId];
      if (!lista || lista.some((x) => x.id === m.id)) return;
      set({ mensajes: { ...state.mensajes, [m.conversacionId]: [...lista, m].sort((a, b) => a.enviadoAt.localeCompare(b.enviadoAt)) } });
    })
    .subscribe();
}

export function useWhatsapp(): WaState {
  useEffect(() => { init(); }, []);
  return useSyncExternalStore((cb) => { listeners.add(cb); return () => listeners.delete(cb); }, () => state, () => SERVER);
}

/** Propuestas pendientes (para el contador del menú). */
export function pendientesDe(st: WaState): number {
  const props = st.propuestas.filter((p) => p.estado === "pendiente").length;
  return props;
}

async function tokenSesion(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? "";
}

function esRegistroDe(p: WaPropuesta): string { return `${p.tipo}:${p.clave}`; }

export const waActions = {
  async cargarMensajes(conversacionId: string, forzar = false): Promise<WaMensaje[]> {
    if (!forzar && state.mensajes[conversacionId]) return state.mensajes[conversacionId];
    const { data } = await supabase.from("whatsapp_mensajes").select("id, wa_id, conversacion_id, direccion, tipo, texto, enviado_at").eq("conversacion_id", conversacionId).order("enviado_at", { ascending: true }).limit(2000);
    const lista = ((data ?? []) as Record<string, unknown>[]).map(mapWaMensaje);
    set({ mensajes: { ...state.mensajes, [conversacionId]: lista } });
    return lista;
  },

  async recargar() { await cargarTodo(); },

  /** Lanza el análisis con IA (una conversación o todo lo pendiente). */
  async analizar(conversacionId?: string): Promise<{ ok: boolean; texto: string }> {
    set({ analizando: true });
    try {
      const res = await fetch("/api/whatsapp/procesar", {
        method: "POST",
        headers: { Authorization: `Bearer ${await tokenSesion()}`, "Content-Type": "application/json" },
        body: JSON.stringify(conversacionId ? { conversacionId, forzar: true } : { limite: 10 }),
      });
      const body = await res.json().catch(() => ({})) as Record<string, unknown>;
      if (!res.ok) {
        const texto = String(body.error ?? `Error ${res.status}`);
        toast.error(texto);
        return { ok: false, texto };
      }
      const partes: string[] = [];
      if (body.procesadas) partes.push(`${body.procesadas} analizada${Number(body.procesadas) === 1 ? "" : "s"}`);
      if (body.creadas) partes.push(`${body.creadas} cliente${Number(body.creadas) === 1 ? "" : "s"} nuevo${Number(body.creadas) === 1 ? "" : "s"}`);
      if (body.propuestas) partes.push(`${body.propuestas} propuesta${Number(body.propuestas) === 1 ? "" : "s"}`);
      const errores = Array.isArray(body.errores) ? (body.errores as string[]) : [];
      const texto = partes.length ? partes.join(" · ") : errores.length ? errores[0] : body.detenido ? String(body.detenido) : "Nada nuevo que analizar";
      if (errores.length) toast.error(errores[0]); else toast.success(texto);
      await cargarTodo();
      return { ok: errores.length === 0, texto };
    } finally {
      set({ analizando: false });
    }
  },

  async vincular(conversacionId: string, leadId: string) {
    const { error } = await supabase.from("whatsapp_conversaciones").update({ lead_id: leadId, estado: "vinculada", analizado_hasta: null } as never).eq("id", conversacionId);
    if (error) { toast.error("No se pudo enlazar: " + error.message); return false; }
    // Las propuestas de "¿con qué cliente va?" quedan resueltas.
    await supabase.from("whatsapp_propuestas").update({ estado: "aceptada", resuelta_at: new Date().toISOString() } as never).eq("conversacion_id", conversacionId).eq("tipo", "vincular_lead").eq("estado", "pendiente");
    toast.success("Conversación enlazada. Se volverá a analizar con la ficha.");
    return true;
  },

  async desvincular(conversacionId: string) {
    const { error } = await supabase.from("whatsapp_conversaciones").update({ lead_id: null, estado: "nueva" } as never).eq("id", conversacionId);
    if (error) toast.error("No se pudo desenlazar: " + error.message);
  },

  async ignorar(conversacionId: string, ignorar = true) {
    const { error } = await supabase.from("whatsapp_conversaciones").update({ estado: ignorar ? "ignorada" : "nueva" } as never).eq("id", conversacionId);
    if (error) toast.error("No se pudo actualizar: " + error.message);
    if (ignorar) await supabase.from("whatsapp_propuestas").update({ estado: "rechazada", resuelta_at: new Date().toISOString() } as never).eq("conversacion_id", conversacionId).eq("estado", "pendiente");
  },

  /** Crea el cliente con lo que la IA ha extraído y enlaza la conversación. */
  async crearCliente(conv: WaConversacion, vendedor: string): Promise<Lead | null> {
    const d = conv.datos ?? {};
    const contacto = d.contacto ?? {};
    const primerTipo = d.productos?.[0] ? normalizeTipo(d.productos[0].tipo) : null;
    const lead = await actions.addLead({
      nombre: (contacto.nombre || conv.nombreWa || `WhatsApp ${formatTelefonoWa(conv.telefono)}`).trim(),
      email: contacto.email ?? "",
      telefono: formatTelefonoWa(conv.telefono),
      ciudad: contacto.ciudad ?? "",
      provincia: contacto.provincia ?? "",
      producto: primerTipo ? TIPO_LABEL[primerTipo] : "Sin especificar",
      vendedor,
      etapa: "Discovery",
      valor: 0, origen: "WhatsApp", redSocial: "", fechaHold: "", valorProducto: 0, valorEnvio: 0, edad: "",
      clienteTipo: "normal", etiquetas: [], cobrado: false, fechaCobro: "",
      tipo: "B2C", razonSocial: "", nif: "", contactoNombre: "", contactoApellidos: "", contactoCargo: "",
      direccion: contacto.direccion ?? "", web: "", instagram: "", notasB2b: "", asignados: [],
      seguidores: 0, redPrincipal: "", usuario: "",
    });
    if (!lead) return null;
    for (const p of (d.productos ?? []).slice(0, 6)) await actions.addProducto(lead.id, productoDesdeIA(p));
    if (conv.resumen) await actions.addNota(lead.id, `📱 Conversación de WhatsApp enlazada (${formatTelefonoWa(conv.telefono)}). ${conv.resumen}`);
    await waActions.vincular(conv.id, lead.id);
    return lead;
  },

  async rechazar(p: WaPropuesta, usuario: string) {
    const { error } = await supabase.from("whatsapp_propuestas").update({ estado: "rechazada", resuelta_por: usuario, resuelta_at: new Date().toISOString() } as never).eq("id", p.id);
    if (error) toast.error("No se pudo rechazar: " + error.message);
  },

  /**
   * Aplica una propuesta con las acciones del CRM y la marca como aceptada.
   * `extra` trae lo que pide cada tipo: importe/fecha (Closed Won), razón
   * (Closed Lost), leadId elegido (vincular)…
   */
  async aceptar(p: WaPropuesta, usuario: string, extra: Record<string, unknown> = {}): Promise<boolean> {
    const pl = p.payload;
    try {
      switch (p.tipo) {
        case "cambiar_etapa": {
          if (!p.leadId) throw new Error("La propuesta no tiene cliente");
          const etapa = String(pl.etapa) as Etapa;
          if (etapa === "Closed Won") {
            await actions.updateLead(p.leadId, {
              etapa,
              ventaImporte: extra.ventaImporte === undefined ? (pl.venta_importe == null ? null : Number(pl.venta_importe)) : (extra.ventaImporte as number | null),
              ventaFecha: String(extra.ventaFecha ?? todayISO()),
            });
          } else if (etapa === "Closed Lost") {
            await actions.setLeadEtapa(p.leadId, etapa);
            const razon = String(extra.razon ?? pl.razon ?? "");
            const comentario = String(extra.comentario ?? "");
            await actions.addNota(p.leadId, `[Closed Lost] ${razon}${comentario ? ` — ${comentario}` : ""}`);
          } else {
            await actions.setLeadEtapa(p.leadId, etapa);
          }
          break;
        }
        case "actualizar_campo": {
          if (!p.leadId) throw new Error("La propuesta no tiene cliente");
          const campo = String(pl.campo);
          if (!["nombre", "ciudad", "provincia", "email", "direccion"].includes(campo)) throw new Error("Campo no editable: " + campo);
          await actions.updateLead(p.leadId, { [campo]: String(pl.nuevo ?? "") } as Partial<Lead>);
          break;
        }
        case "producto": {
          if (!p.leadId) throw new Error("La propuesta no tiene cliente");
          const ia = (pl.producto ?? {}) as ProductoIA;
          if (pl.accion === "crear") {
            await actions.addProducto(p.leadId, productoDesdeIA(ia));
          } else {
            const actual = (extra.productoActual as Producto | undefined);
            if (!actual) throw new Error("No se encontró el producto a corregir");
            const cambios = (pl.cambios ?? {}) as Record<string, { de: unknown; a: unknown }>;
            const input = productoInput(actual);
            for (const [k, v] of Object.entries(cambios)) {
              if (k === "ancho" || k === "alto" || k === "fondo") input[k] = v.a == null ? null : Number(v.a);
              else if (k === "tela" || k === "modelo" || k === "color") input[k] = String(v.a ?? "");
            }
            await actions.updateProducto(actual.id, input);
          }
          break;
        }
        case "tarea": {
          if (!p.leadId) throw new Error("La propuesta no tiene cliente");
          const fecha = String(pl.fecha || todayISO());
          await actions.addTarea({ leadId: p.leadId, descripcion: String(pl.descripcion ?? "Seguimiento WhatsApp"), fecha, hora: "", vendedor: String(extra.vendedor ?? usuario) });
          break;
        }
        case "vincular_lead": {
          const leadId = String(extra.leadId ?? "");
          if (!leadId) throw new Error("Elige un cliente");
          await waActions.vincular(p.conversacionId, leadId);
          return true; // vincular() ya marca la propuesta
        }
        case "nuevo_encargo": {
          if (!p.leadId) throw new Error("La propuesta no tiene cliente");
          const nuevo = await actions.nuevoEncargoRecurrente(p.leadId);
          if (!nuevo) throw new Error("No se pudo crear el nuevo encargo");
          await supabase.from("whatsapp_conversaciones").update({ lead_id: nuevo.id, analizado_hasta: null } as never).eq("id", p.conversacionId);
          break;
        }
        default:
          throw new Error("Tipo de propuesta desconocido: " + esRegistroDe(p));
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
      return false;
    }
    const { error } = await supabase.from("whatsapp_propuestas").update({ estado: "aceptada", resuelta_por: usuario, resuelta_at: new Date().toISOString() } as never).eq("id", p.id);
    if (error) toast.error("Aplicado, pero no se pudo marcar la propuesta: " + error.message);
    return true;
  },
};

type ProductoInput = Omit<Producto, "id" | "leadId" | "createdAt" | "createdBy" | "caracteristicasConfirmadas" | "fechaConfirmacion" | "pagado50">;

function productoInput(p: Producto): ProductoInput {
  return {
    tipo: p.tipo, modelo: p.modelo, ancho: p.ancho, alto: p.alto, fondo: p.fondo, tela: p.tela, color: p.color,
    relleno: p.relleno, patas: p.patas, acabado: p.acabado, coleccionTela: p.coleccionTela, cantidad: p.cantidad,
    precioUnitario: p.precioUnitario, notasProducto: p.notasProducto,
  };
}

export function productoDesdeIA(p: ProductoIA): ProductoInput {
  return {
    tipo: normalizeTipo(p.tipo) ?? "otro",
    modelo: (p.modelo ?? "").trim(),
    ancho: p.ancho ?? null, alto: p.alto ?? null, fondo: p.fondo ?? null,
    tela: (p.tela ?? "").trim(), color: (p.color ?? "").trim(), relleno: "",
    patas: p.montaje === "colgar" ? "Montaje: pared" : p.montaje === "apoyar" ? "Montaje: suelo" : "",
    acabado: "", coleccionTela: "",
    cantidad: Math.max(1, Math.floor(Number(p.cantidad) || 1)),
    precioUnitario: Math.max(0, Number(p.precio) || 0),
    notasProducto: ["Desde WhatsApp", (p.notas ?? "").trim()].filter(Boolean).join(" · "),
  };
}
