import { useSyncExternalStore } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Lead, Tarea, Etapa, AuditEntry, Nota, Producto, Pedido, PedidoTela } from "./types";
import { VENDEDORES, telasPorTipo } from "./types";



interface State {
  leads: Lead[];
  tareas: Tarea[];
  audit: AuditEntry[];
  notas: Nota[];
  productos: Producto[];
  pedidos: Pedido[];
  pedidoTelas: PedidoTela[];
  loaded: boolean;
  realtimeStatus: "connected" | "connecting" | "disconnected";
  remoteUpdateTimestamps: Record<string, number>;
  presenceEditors: Record<string, string[]>;
}

let state: State = {
  leads: [], tareas: [], audit: [], notas: [], productos: [], pedidos: [], pedidoTelas: [], pedidos: [], pedidoTelas: [],
  loaded: false, realtimeStatus: "connecting", remoteUpdateTimestamps: {}, presenceEditors: {},
};
const listeners = new Set<() => void>();

function emit() { listeners.forEach((l) => l()); }

// Suppressed leads: after a local write we ignore the next realtime echo for 4 seconds
const suppressedLeads = new Map<string, number>();
function suppressLead(id: string) { suppressedLeads.set(id, Date.now() + 4000); }
function isSuppressed(id: string): boolean {
  const until = suppressedLeads.get(id);
  if (!until) return false;
  if (Date.now() > until) { suppressedLeads.delete(id); return false; }
  return true;
}

function mapLead(r: Record<string, unknown>): Lead {
  return {
    id: r.id as string,
    nombre: (r.nombre as string) ?? "",
    email: (r.email as string) ?? "",
    telefono: (r.telefono as string) ?? "",
    ciudad: (r.ciudad as string) ?? "",
    producto: (r.producto as string) ?? "",
    vendedor: r.vendedor as string,
    etapa: r.etapa as Etapa,
    valor: Number(r.valor) || 0,
    origen: (r.origen as string) ?? "",
    redSocial: (r.red_social as string) ?? "",
    fechaHold: (r.fecha_hold as string) ?? "",
    valorProducto: Number(r.valor_producto) || 0,
    valorEnvio: Number(r.valor_envio) || 0,
    edad: (r.edad as string) ?? "",
    fechaCreacion: (r.created_at as string) ?? "",
    fechaEntradaEtapa: (r.fecha_entrada_etapa as string) ?? (r.created_at as string) ?? "",
    razonUrgencia: (r.razon_urgencia as string) ?? "",
  };
}

function mapTarea(r: Record<string, unknown>): Tarea {
  return {
    id: r.id as string,
    leadId: r.lead_id as string,
    descripcion: r.descripcion as string,
    fecha: r.fecha as string,
    hora: (r.hora as string) ?? "",
    vendedor: r.vendedor as string,
    completada: !!(r.completada),
  };
}

function mapAudit(r: Record<string, unknown>): AuditEntry {
  return {
    id: r.id as string,
    tabla: r.tabla as string,
    leadId: (r.lead_id as string) ?? null,
    campo: r.campo as string,
    valorAnterior: (r.valor_anterior as string) ?? null,
    valorNuevo: (r.valor_nuevo as string) ?? null,
    usuario: (r.usuario as string) ?? null,
    createdAt: r.created_at as string,
  };
}

function mapNota(r: Record<string, unknown>): Nota {
  return {
    id: r.id as string,
    leadId: r.lead_id as string,
    contenido: r.contenido as string,
    usuario: (r.usuario as string) ?? "",
    createdAt: r.created_at as string,
  };
}

function mapProducto(r: Record<string, unknown>): Producto {
  return {
    id: r.id as string,
    leadId: r.lead_id as string,
    tipo: (r.tipo as string) ?? "",
    modelo: (r.modelo as string) ?? "",
    ancho: r.ancho != null ? Number(r.ancho) : null,
    alto: r.alto != null ? Number(r.alto) : null,
    tela: (r.tela as string) ?? "",
    color: (r.color as string) ?? "",
    relleno: (r.relleno as string) ?? "",
    patas: (r.patas as string) ?? "",
    acabado: (r.acabado as string) ?? "",
    coleccionTela: (r.coleccion_tela as string) ?? "",
    cantidad: Number(r.cantidad) || 1,
    precioUnitario: Number(r.precio_unitario) || 0,
    notasProducto: (r.notas_producto as string) ?? "",
    createdAt: r.created_at as string,
    createdBy: (r.created_by as string) ?? "",
    caracteristicasConfirmadas: !!r.caracteristicas_confirmadas,
    fechaConfirmacion: (r.fecha_confirmacion as string) ?? "",
    pagado50: !!r.pagado_50,
  };
}

function mapPedido(r: Record<string, unknown>): Pedido {
  return {
    id: r.id as string,
    productoLeadId: r.producto_lead_id as string,
    leadId: r.lead_id as string,
    fechaCreacionPedido: (r.fecha_creacion_pedido as string) ?? "",
    diasPlazo: Number(r.dias_plazo) || 20,
    fechaLimite: (r.fecha_limite as string) ?? "",
    fechaEntregaReal: (r.fecha_entrega_real as string) ?? "",
    pagado50: !!r.pagado_50,
    pagoTodoAlFinal: !!r.pago_todo_al_final,
    creadoManualmente: !!r.creado_manualmente,
    estadoPedido: (r.estado_pedido as string) ?? "En proceso",
    telaPedida: !!r.tela_pedida,
    telaPedidaFecha: (r.tela_pedida_fecha as string) ?? "",
    telaRecibida: !!r.tela_recibida,
    telaRecibidaFecha: (r.tela_recibida_fecha as string) ?? "",
    estructuraHecha: !!r.estructura_hecha,
    estructuraHechaFecha: (r.estructura_hecha_fecha as string) ?? "",
    tapizadoHecho: !!r.tapizado_hecho,
    tapizadoHechoFecha: (r.tapizado_hecho_fecha as string) ?? "",
    entregado: !!r.entregado,
    entregadoFecha: (r.entregado_fecha as string) ?? "",
    precio: Number(r.precio) || 0,
    reserva: Number(r.reserva) || 0,
    pagadoCompleto: !!r.pagado_completo,
    factura: (r.factura as string) ?? "",
    notasPedido: (r.notas_pedido as string) ?? "",
    createdAt: (r.created_at as string) ?? "",
    updatedAt: (r.updated_at as string) ?? "",
  };
}

function mapPedidoTela(r: Record<string, unknown>): PedidoTela {
  return {
    id: r.id as string,
    pedidoId: r.pedido_id as string,
    tipoTela: (r.tipo_tela as string) ?? "",
    nombreTela: (r.nombre_tela as string) ?? "",
    estado: (r.estado as string) ?? "Pedida",
    fechaRecibo: (r.fecha_recibo as string) ?? "",
    orden: Number(r.orden) || 0,
    createdAt: (r.created_at as string) ?? "",
  };
}

let currentUser: string | null = null;
export function setCurrentUser(email: string | null) { currentUser = email; }

// Presence channel (ephemeral — no DB table needed)
let presenceChannel: ReturnType<typeof supabase.channel> | null = null;

function syncPresence() {
  if (!presenceChannel) return;
  const raw = presenceChannel.presenceState<{ user: string; editing: string }>();
  const editors: Record<string, string[]> = {};
  for (const presences of Object.values(raw)) {
    for (const p of presences) {
      if (p.editing && p.user && p.user !== currentUser) {
        if (!editors[p.editing]) editors[p.editing] = [];
        editors[p.editing].push(p.user);
      }
    }
  }
  state = { ...state, presenceEditors: editors };
  emit();
}

let initStarted = false;
let realtimeChannel: ReturnType<typeof supabase.channel> | null = null;
async function init() {
  if (initStarted) return;
  initStarted = true;
  await refetchAll();

  realtimeChannel = supabase
    .channel("tirocrm-realtime")
    // ── LEADS: surgical update from payload, no full refetch ──────────
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "leads" }, (payload) => {
      const newLead = mapLead(payload.new as Record<string, unknown>);
      if (state.leads.find((l) => l.id === newLead.id)) return;
      state = { ...state, leads: [newLead, ...state.leads] };
      emit();
      // Notify team about externally-created leads (formulario web / configurador)
      const createdBy = (payload.new as Record<string, unknown>).created_by as string | null | undefined;
      const isExternal =
        createdBy === "formulario-web" ||
        newLead.origen === "Formulario web" ||
        newLead.origen === "Configurador";
      if (isExternal) {
        toast.info(`Nuevo lead del formulario web: ${newLead.nombre}`, {
          duration: 12000,
          action: { label: "Ver", onClick: () => { window.location.assign(`/clientes/${newLead.id}`); } },
        });
      }
    })
    .on("postgres_changes", { event: "UPDATE", schema: "public", table: "leads" }, (payload) => {
      const updated = mapLead(payload.new as Record<string, unknown>);
      if (!isSuppressed(updated.id)) {
        // Mark as a remote update for conflict detection in open lead views
        state = {
          ...state,
          leads: state.leads.map((l) => l.id === updated.id ? updated : l),
          remoteUpdateTimestamps: { ...state.remoteUpdateTimestamps, [updated.id]: Date.now() },
        };
      } else {
        state = { ...state, leads: state.leads.map((l) => l.id === updated.id ? updated : l) };
      }
      emit();
    })
    .on("postgres_changes", { event: "DELETE", schema: "public", table: "leads" }, (payload) => {
      const id = (payload.old as Record<string, unknown>).id as string;
      state = { ...state, leads: state.leads.filter((l) => l.id !== id) };
      emit();
    })
    // ── TAREAS: surgical ──────────────────────────────────────────────
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "tareas" }, (payload) => {
      const t = mapTarea(payload.new as Record<string, unknown>);
      if (!state.tareas.find((x) => x.id === t.id)) {
        state = { ...state, tareas: [...state.tareas, t].sort((a, b) => a.fecha.localeCompare(b.fecha)) };
        emit();
      }
    })
    .on("postgres_changes", { event: "UPDATE", schema: "public", table: "tareas" }, (payload) => {
      const t = mapTarea(payload.new as Record<string, unknown>);
      state = { ...state, tareas: state.tareas.map((x) => x.id === t.id ? t : x) };
      emit();
    })
    .on("postgres_changes", { event: "DELETE", schema: "public", table: "tareas" }, (payload) => {
      const id = (payload.old as Record<string, unknown>).id as string;
      state = { ...state, tareas: state.tareas.filter((t) => t.id !== id) };
      emit();
    })
    // ── AUDIT LOG: append-only from realtime, never delete ────────────
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "audit_log" }, (payload) => {
      const a = mapAudit(payload.new as Record<string, unknown>);
      if (!state.audit.find((x) => x.id === a.id)) {
        state = { ...state, audit: [a, ...state.audit] };
        emit();
      }
    })
    // ── NOTAS: surgical ───────────────────────────────────────────────
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "notas" }, (payload) => {
      const n = mapNota(payload.new as Record<string, unknown>);
      if (!state.notas.find((x) => x.id === n.id)) {
        state = { ...state, notas: [n, ...state.notas] };
        emit();
      }
    })
    .on("postgres_changes", { event: "UPDATE", schema: "public", table: "notas" }, (payload) => {
      const n = mapNota(payload.new as Record<string, unknown>);
      state = { ...state, notas: state.notas.map((x) => x.id === n.id ? n : x) };
      emit();
    })
    .on("postgres_changes", { event: "DELETE", schema: "public", table: "notas" }, (payload) => {
      const id = (payload.old as Record<string, unknown>).id as string;
      state = { ...state, notas: state.notas.filter((n) => n.id !== id) };
      emit();
    })
    // ── PRODUCTOS: surgical ───────────────────────────────────────────
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "productos_lead" }, (payload) => {
      const p = mapProducto(payload.new as Record<string, unknown>);
      if (!state.productos.find((x) => x.id === p.id)) {
        state = { ...state, productos: [...state.productos, p] };
        emit();
      }
    })
    .on("postgres_changes", { event: "UPDATE", schema: "public", table: "productos_lead" }, (payload) => {
      const p = mapProducto(payload.new as Record<string, unknown>);
      state = { ...state, productos: state.productos.map((x) => x.id === p.id ? p : x) };
      emit();
    })
    .on("postgres_changes", { event: "DELETE", schema: "public", table: "productos_lead" }, (payload) => {
      const id = (payload.old as Record<string, unknown>).id as string;
      state = { ...state, productos: state.productos.filter((p) => p.id !== id) };
      emit();
    })
    .subscribe((status) => {
      const next: State["realtimeStatus"] =
        status === "SUBSCRIBED" ? "connected" :
        status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED" ? "disconnected" :
        "connecting";
      state = { ...state, realtimeStatus: next };
      emit();
    });

  // Presence channel: shows who else is viewing the same lead in real time
  presenceChannel = supabase.channel("tirocrm-presence");
  presenceChannel
    .on("presence", { event: "sync" }, syncPresence)
    .on("presence", { event: "join" }, syncPresence)
    .on("presence", { event: "leave" }, syncPresence)
    .subscribe(async (status) => {
      if (status === "SUBSCRIBED" && currentUser) {
        await presenceChannel!.track({ user: currentUser, editing: "" });
      }
    });
}

async function refetchLeads() {
  const { data, error } = await supabase.from("leads").select("*").order("created_at", { ascending: false });
  if (!error && data) { state = { ...state, leads: data.map(mapLead) }; emit(); }
}
async function refetchTareas() {
  const { data, error } = await supabase.from("tareas").select("*").order("fecha", { ascending: true });
  if (!error && data) { state = { ...state, tareas: data.map(mapTarea) }; emit(); }
}
async function refetchAudit() {
  const { data, error } = await supabase.from("audit_log").select("*").order("created_at", { ascending: false }).limit(500);
  if (!error && data) { state = { ...state, audit: data.map(mapAudit) }; emit(); }
}
async function refetchNotas() {
  const { data, error } = await supabase.from("notas").select("*").order("created_at", { ascending: false });
  if (!error && data) { state = { ...state, notas: data.map(mapNota) }; emit(); }
}
async function refetchProductos() {
  const { data, error } = await supabase.from("productos_lead").select("*").order("created_at", { ascending: true });
  if (!error && data) { state = { ...state, productos: data.map(mapProducto) }; emit(); }
}
async function refetchAll() {
  await Promise.all([refetchLeads(), refetchTareas(), refetchAudit(), refetchNotas(), refetchProductos()]);
  state = { ...state, loaded: true };
  emit();
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  if (typeof window !== "undefined") void init();
  return () => { listeners.delete(cb); };
}

const SERVER: State = {
  leads: [], tareas: [], audit: [], notas: [], productos: [], pedidos: [], pedidoTelas: [],
  loaded: false, realtimeStatus: "connecting", remoteUpdateTimestamps: {}, presenceEditors: {},
};
function getSnapshot(): State { return state; }
function getServerSnapshot(): State { return SERVER; }

export function useStore(): State {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

// Tear down realtime + presence subscriptions and reset in-memory state.
// Called on signOut so the next user starts clean and we don't leak channels.
export async function teardownStore() {
  try {
    if (realtimeChannel) { await supabase.removeChannel(realtimeChannel); realtimeChannel = null; }
    if (presenceChannel) { await supabase.removeChannel(presenceChannel); presenceChannel = null; }
  } catch { /* ignore */ }
  initStarted = false;
  state = {
    leads: [], tareas: [], audit: [], notas: [], productos: [], pedidos: [], pedidoTelas: [],
    loaded: false, realtimeStatus: "connecting", remoteUpdateTimestamps: {}, presenceEditors: {},
  };
  emit();
}

async function syncLeadValorFromProductos(leadId: string) {
  const lead = state.leads.find((l) => l.id === leadId);
  if (!lead) return;
  const productos = state.productos.filter((p) => p.leadId === leadId);
  if (productos.length === 0) return;
  const valorProducto = productos.reduce((acc, p) => acc + (p.precioUnitario || 0) * (p.cantidad || 1), 0);
  if (valorProducto === lead.valorProducto) return;
  const valor = valorProducto + lead.valorEnvio;
  state = {
    ...state,
    leads: state.leads.map((l) => l.id === leadId ? { ...l, valorProducto, valor } : l),
  };
  emit();
  suppressLead(leadId);
  await supabase.from("leads").update({ valor_producto: valorProducto, valor } as never).eq("id", leadId);
}

export const actions = {
  async addLead(
    input: Omit<Lead, "id" | "fechaCreacion" | "fechaEntradaEtapa" | "razonUrgencia">,
    firstTask?: { descripcion: string; fecha: string; hora?: string },
  ): Promise<Lead | null> {
    const { data, error } = await supabase
      .from("leads")
      .insert({
        nombre: input.nombre,
        email: input.email,
        telefono: input.telefono,
        ciudad: input.ciudad,
        producto: input.producto,
        vendedor: input.vendedor,
        etapa: input.etapa,
        valor: input.valor,
        origen: input.origen ?? "",
        red_social: input.redSocial ?? "",
        fecha_hold: input.fechaHold || null,
        valor_producto: input.valorProducto ?? 0,
        valor_envio: input.valorEnvio ?? 0,
        edad: input.edad ?? "",
      })
      .select()
      .single();
    if (error || !data) { toast.error("Error al crear el lead."); return null; }
    const lead = mapLead(data as Record<string, unknown>);
    suppressLead(lead.id);
    // Insert locally so the UI updates immediately. The realtime INSERT echo
    // is deduped in the handler (find by id), avoiding refetching 5 tables.
    if (!state.leads.find((l) => l.id === lead.id)) {
      state = { ...state, leads: [lead, ...state.leads] };
      emit();
    }
    if (firstTask?.descripcion.trim()) {
      await supabase.from("tareas").insert({
        lead_id: lead.id,
        descripcion: firstTask.descripcion,
        fecha: firstTask.fecha,
        hora: firstTask.hora ?? "",
        vendedor: lead.vendedor,
        completada: false,
      });
    }
    return lead;
  },

  async updateLead(id: string, patch: Partial<Lead>) {
    const prevLead = state.leads.find((l) => l.id === id);
    const prevState = state;
    const dbPatch: Record<string, unknown> = {};
    if (patch.nombre !== undefined) dbPatch.nombre = patch.nombre;
    if (patch.email !== undefined) dbPatch.email = patch.email;
    if (patch.telefono !== undefined) dbPatch.telefono = patch.telefono;
    if (patch.ciudad !== undefined) dbPatch.ciudad = patch.ciudad;
    if (patch.producto !== undefined) dbPatch.producto = patch.producto;
    if (patch.vendedor !== undefined) dbPatch.vendedor = patch.vendedor;
    if (patch.etapa !== undefined) dbPatch.etapa = patch.etapa;
    if (patch.valor !== undefined) dbPatch.valor = patch.valor;
    if (patch.origen !== undefined) dbPatch.origen = patch.origen;
    if (patch.redSocial !== undefined) dbPatch.red_social = patch.redSocial;
    if (patch.fechaHold !== undefined) dbPatch.fecha_hold = patch.fechaHold || null;
    // edad se guarda por separado para que un fallo por columna inexistente
    // no impida guardar el resto de campos
    const edadValue = patch.edad;
    if (patch.valorProducto !== undefined) dbPatch.valor_producto = patch.valorProducto;
    if (patch.valorEnvio !== undefined) dbPatch.valor_envio = patch.valorEnvio;
    if ((patch.valorProducto !== undefined || patch.valorEnvio !== undefined) && prevLead) {
      const prod = patch.valorProducto ?? prevLead.valorProducto;
      const envio = patch.valorEnvio ?? prevLead.valorEnvio;
      dbPatch.valor = prod + envio;
      patch = { ...patch, valor: prod + envio };
    }
    // Optimistic update
    state = { ...state, leads: state.leads.map((l) => (l.id === id ? { ...l, ...patch } : l)) };
    emit();
    suppressLead(id);

    // Guardado principal (sin edad)
    if (Object.keys(dbPatch).length > 0) {
      const { error } = await supabase.from("leads").update(dbPatch as never).eq("id", id);
      if (error) {
        state = prevState;
        emit();
        toast.error("Error al guardar el cliente. Los cambios no se han guardado.");
        return;
      }
    }

    // Guardado de edad por separado — falla silenciosamente si la columna no existe aún
    if (edadValue !== undefined) {
      await supabase.from("leads").update({ edad: edadValue } as never).eq("id", id).then(({ error }) => {
        if (error) console.warn("[updateLead] edad column not available yet:", error.message);
      });
    }
    if (prevLead && currentUser) {
      const isValorDerived = patch.valorProducto !== undefined || patch.valorEnvio !== undefined;
      const entries: Record<string, unknown>[] = [];
      for (const [key, newVal] of Object.entries(patch)) {
        if (key === "valor" && isValorDerived) continue;
        const oldVal = prevLead[key as keyof Lead];
        if (String(oldVal) !== String(newVal)) {
          entries.push({
            tabla: "leads", lead_id: id, campo: key,
            valor_anterior: String(oldVal ?? ""),
            valor_nuevo: String(newVal ?? ""),
            usuario: currentUser,
          });
        }
      }
      if (entries.length > 0) await supabase.from("audit_log").insert(entries as never);
    }
  },

  async setLeadEtapa(id: string, etapa: Etapa) {
    await actions.updateLead(id, { etapa });
  },

  async deleteLead(id: string) {
    const prevState = state;
    state = { ...state, leads: state.leads.filter((l) => l.id !== id) };
    emit();
    const { error } = await supabase.from("leads").delete().eq("id", id);
    if (error) { state = prevState; emit(); toast.error("Error al eliminar el cliente."); }
  },

  async addTarea(input: Omit<Tarea, "id" | "completada">) {
    const { error } = await supabase.from("tareas").insert({
      lead_id: input.leadId,
      descripcion: input.descripcion,
      fecha: input.fecha,
      hora: input.hora ?? "",
      vendedor: input.vendedor,
      completada: false,
    });
    if (error) toast.error("Error al crear la tarea.");
  },

  async updateTarea(id: string, patch: Partial<Pick<Tarea, "descripcion" | "fecha" | "hora" | "completada">>) {
    const prevState = state;
    state = { ...state, tareas: state.tareas.map((t) => (t.id === id ? { ...t, ...patch } : t)) };
    emit();
    const dbPatch: Record<string, unknown> = {};
    if (patch.descripcion !== undefined) dbPatch.descripcion = patch.descripcion;
    if (patch.fecha !== undefined) dbPatch.fecha = patch.fecha;
    if (patch.hora !== undefined) dbPatch.hora = patch.hora;
    if (patch.completada !== undefined) dbPatch.completada = patch.completada;
    const { error } = await supabase.from("tareas").update(dbPatch as never).eq("id", id);
    if (error) { state = prevState; emit(); toast.error("Error al actualizar la tarea."); }
  },

  async toggleTarea(id: string) {
    const t = state.tareas.find((x) => x.id === id);
    if (!t) return;
    await actions.updateTarea(id, { completada: !t.completada });
  },

  async deleteTarea(id: string) {
    const prevState = state;
    state = { ...state, tareas: state.tareas.filter((t) => t.id !== id) };
    emit();
    const { error } = await supabase.from("tareas").delete().eq("id", id);
    if (error) { state = prevState; emit(); toast.error("Error al eliminar la tarea."); }
  },

  async addNota(leadId: string, contenido: string): Promise<boolean> {
    // Use a real UUID so we can swap it with the DB UUID before realtime fires,
    // preventing the duplicate-note bug (realtime INSERT couldn't find the tempId
    // and added the note a second time).
    const tempId = crypto.randomUUID();
    const optimistic: Nota = { id: tempId, leadId, contenido, usuario: currentUser ?? "", createdAt: new Date().toISOString() };
    state = { ...state, notas: [optimistic, ...state.notas] };
    emit();
    const { data, error } = await supabase
      .from("notas")
      .insert({ lead_id: leadId, contenido, usuario: currentUser ?? "" })
      .select()
      .single();
    if (error) {
      state = { ...state, notas: state.notas.filter((n) => n.id !== tempId) };
      emit();
      toast.error("Error al guardar la nota.");
      return false;
    }
    // Replace temp entry with the real DB row — realtime dedup will now skip it
    const real = mapNota(data as Record<string, unknown>);
    state = { ...state, notas: state.notas.map((n) => (n.id === tempId ? real : n)) };
    emit();
    return true;
  },

  async updateNota(id: string, contenido: string) {
    const prevState = state;
    state = { ...state, notas: state.notas.map((n) => (n.id === id ? { ...n, contenido } : n)) };
    emit();
    const { error } = await supabase.from("notas").update({ contenido }).eq("id", id);
    if (error) { state = prevState; emit(); toast.error("Error al guardar la nota."); }
  },

  async deleteNota(id: string) {
    const prevState = state;
    state = { ...state, notas: state.notas.filter((n) => n.id !== id) };
    emit();
    const { error } = await supabase.from("notas").delete().eq("id", id);
    if (error) { state = prevState; emit(); toast.error("Error al eliminar la nota."); }
  },



  async addProducto(leadId: string, input: Omit<Producto, "id" | "leadId" | "createdAt" | "createdBy" | "caracteristicasConfirmadas" | "fechaConfirmacion" | "pagado50">) {
    const { data, error } = await supabase.from("productos_lead").insert({
      lead_id: leadId, tipo: input.tipo, modelo: input.modelo,
      ancho: input.ancho, alto: input.alto, tela: input.tela,
      color: input.color, relleno: input.relleno, patas: input.patas,
      acabado: input.acabado, coleccion_tela: input.coleccionTela,
      cantidad: input.cantidad, precio_unitario: input.precioUnitario,
      notas_producto: input.notasProducto, created_by: currentUser ?? "",
    }).select().single();
    if (error) { toast.error("Error al guardar el producto."); return; }
    if (data) {
      const nuevo = mapProducto(data as Record<string, unknown>);
      if (!state.productos.find((x) => x.id === nuevo.id)) {
        state = { ...state, productos: [...state.productos, nuevo] };
        emit();
      }
    }
    await syncLeadValorFromProductos(leadId);
  },

  async updateProducto(id: string, input: Omit<Producto, "id" | "leadId" | "createdAt" | "createdBy" | "caracteristicasConfirmadas" | "fechaConfirmacion" | "pagado50">) {
    const prev = state.productos.find((p) => p.id === id);
    const prevState = state;
    if (prev) {
      const optimistic: Producto = { ...prev, ...input };
      state = { ...state, productos: state.productos.map((p) => p.id === id ? optimistic : p) };
      emit();
    }
    const { error } = await supabase.from("productos_lead").update({
      tipo: input.tipo, modelo: input.modelo, ancho: input.ancho, alto: input.alto,
      tela: input.tela, color: input.color, relleno: input.relleno, patas: input.patas,
      acabado: input.acabado, coleccion_tela: input.coleccionTela,
      cantidad: input.cantidad, precio_unitario: input.precioUnitario,
      notas_producto: input.notasProducto,
    }).eq("id", id);
    if (error) { state = prevState; emit(); toast.error("Error al actualizar el producto."); return; }
    if (prev) await syncLeadValorFromProductos(prev.leadId);
  },

  async deleteProducto(id: string) {
    const prev = state.productos.find((p) => p.id === id);
    const prevState = state;
    state = { ...state, productos: state.productos.filter((p) => p.id !== id) };
    emit();
    const { error } = await supabase.from("productos_lead").delete().eq("id", id);
    if (error) { state = prevState; emit(); toast.error("Error al eliminar el producto."); return; }
    if (prev) await syncLeadValorFromProductos(prev.leadId);
  },

  // Presence: call on mount (leadId) and unmount (null) of the lead detail page
  trackEditing(leadId: string | null) {
    if (!presenceChannel || !currentUser) return;
    void presenceChannel.track({ user: currentUser, editing: leadId ?? "" });
  },

  // deleteAuditEntry intentionally removed — audit log is append-only for trazabilidad
};

export function nextPendingTaskFor(leadId: string, tareas: Tarea[]): Tarea | undefined {
  return tareas
    .filter((t) => t.leadId === leadId && !t.completada)
    .sort((a, b) => a.fecha.localeCompare(b.fecha))[0];
}

export function vendedorTotals(leads: Lead[]) {
  const map = new Map<string, { leads: number; valor: number }>();
  VENDEDORES.forEach((v) => map.set(v, { leads: 0, valor: 0 }));
  leads.forEach((l) => {
    const cur = map.get(l.vendedor) ?? { leads: 0, valor: 0 };
    cur.leads += 1;
    cur.valor += l.valor;
    map.set(l.vendedor, cur);
  });
  return map;
}
