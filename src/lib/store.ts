import { useSyncExternalStore } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Lead, Tarea, Etapa, AuditEntry, Nota, Producto } from "./types";


interface State {
  leads: Lead[];
  tareas: Tarea[];
  audit: AuditEntry[];
  notas: Nota[];
  productos: Producto[];
  loaded: boolean;
}

let state: State = { leads: [], tareas: [], audit: [], notas: [], productos: [], loaded: false };
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function mapLead(r: any): Lead {
  return {
    id: r.id,
    nombre: r.nombre,
    email: r.email ?? "",
    telefono: r.telefono ?? "",
    ciudad: r.ciudad ?? "",
    producto: r.producto ?? "",
    vendedor: r.vendedor,
    etapa: r.etapa as Etapa,
    valor: Number(r.valor) || 0,
    origen: r.origen ?? "",
    redSocial: r.red_social ?? "",
    fechaHold: r.fecha_hold ?? "",
    valorProducto: Number(r.valor_producto) || 0,
    valorEnvio: Number(r.valor_envio) || 0,
    fechaCreacion: r.created_at ?? "",
  };
}

function mapTarea(r: any): Tarea {
  return {
    id: r.id,
    leadId: r.lead_id,
    descripcion: r.descripcion,
    fecha: r.fecha,
    hora: r.hora ?? "",
    vendedor: r.vendedor,
    completada: !!r.completada,
  };
}

function mapAudit(r: any): AuditEntry {
  return {
    id: r.id,
    tabla: r.tabla,
    leadId: r.lead_id,
    campo: r.campo,
    valorAnterior: r.valor_anterior,
    valorNuevo: r.valor_nuevo,
    usuario: r.usuario,
    createdAt: r.created_at,
  };
}

function mapNota(r: any): Nota {
  return {
    id: r.id,
    leadId: r.lead_id,
    contenido: r.contenido,
    usuario: r.usuario ?? "",
    createdAt: r.created_at,
  };
}

function mapProducto(r: any): Producto {
  return {
    id: r.id,
    leadId: r.lead_id,
    tipo: r.tipo ?? "",
    modelo: r.modelo ?? "",
    ancho: r.ancho != null ? Number(r.ancho) : null,
    alto: r.alto != null ? Number(r.alto) : null,
    tela: r.tela ?? "",
    color: r.color ?? "",
    relleno: r.relleno ?? "",
    patas: r.patas ?? "",
    acabado: r.acabado ?? "",
    coleccionTela: r.coleccion_tela ?? "",
    cantidad: Number(r.cantidad) || 1,
    precioUnitario: Number(r.precio_unitario) || 0,
    notasProducto: r.notas_producto ?? "",
    createdAt: r.created_at,
    createdBy: r.created_by ?? "",
  };
}

let currentUser: string | null = null;
export function setCurrentUser(email: string | null) {
  currentUser = email;
}

let bootstrapped = false;
async function bootstrap() {
  try {
    await fetch("/api/public/bootstrap").catch(() => {});
  } catch {}
}

let initStarted = false;
async function init() {
  if (initStarted) return;
  initStarted = true;
  if (!bootstrapped) {
    bootstrapped = true;
    await bootstrap();
  }
  await refetchAll();
  supabase
    .channel("tirocrm-realtime")
    .on("postgres_changes", { event: "*", schema: "public", table: "leads" }, () => refetchLeads())
    .on("postgres_changes", { event: "*", schema: "public", table: "tareas" }, () => refetchTareas())
    .on("postgres_changes", { event: "*", schema: "public", table: "audit_log" }, () => refetchAudit())
    .on("postgres_changes", { event: "*", schema: "public", table: "notas" }, () => refetchNotas())
    .on("postgres_changes", { event: "*", schema: "public", table: "productos_lead" }, () => refetchProductos())
    .subscribe();
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

const SERVER: State = { leads: [], tareas: [], audit: [], notas: [], productos: [], loaded: false };
function getSnapshot(): State { return state; }
function getServerSnapshot(): State { return SERVER; }

export function useStore(): State {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export const actions = {
  async addLead(
    input: Omit<Lead, "id" | "fechaCreacion">,
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
      })
      .select()
      .single();
    if (error || !data) return null;
    const lead = mapLead(data);
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
    await refetchAll();
    return lead;
  },

  async updateLead(id: string, patch: Partial<Lead>) {
    const prevLead = state.leads.find((l) => l.id === id);
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
    if (patch.valorProducto !== undefined) dbPatch.valor_producto = patch.valorProducto;
    if (patch.valorEnvio !== undefined) dbPatch.valor_envio = patch.valorEnvio;
    if ((patch.valorProducto !== undefined || patch.valorEnvio !== undefined) && prevLead) {
      const prod = patch.valorProducto ?? prevLead.valorProducto;
      const envio = patch.valorEnvio ?? prevLead.valorEnvio;
      dbPatch.valor = prod + envio;
      patch = { ...patch, valor: prod + envio };
    }
    state = { ...state, leads: state.leads.map((l) => (l.id === id ? { ...l, ...patch } : l)) };
    emit();
    await supabase.from("leads").update(dbPatch as never).eq("id", id);
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
    state = { ...state, leads: state.leads.filter((l) => l.id !== id) };
    emit();
    await supabase.from("leads").delete().eq("id", id);
  },

  async addTarea(input: Omit<Tarea, "id" | "completada">) {
    await supabase.from("tareas").insert({
      lead_id: input.leadId,
      descripcion: input.descripcion,
      fecha: input.fecha,
      hora: input.hora ?? "",
      vendedor: input.vendedor,
      completada: false,
    });
    await refetchTareas();
  },

  async updateTarea(id: string, patch: Partial<Pick<Tarea, "descripcion" | "fecha" | "hora" | "completada">>) {
    state = { ...state, tareas: state.tareas.map((t) => (t.id === id ? { ...t, ...patch } : t)) };
    emit();
    const dbPatch: Record<string, unknown> = {};
    if (patch.descripcion !== undefined) dbPatch.descripcion = patch.descripcion;
    if (patch.fecha !== undefined) dbPatch.fecha = patch.fecha;
    if (patch.hora !== undefined) dbPatch.hora = patch.hora;
    if (patch.completada !== undefined) dbPatch.completada = patch.completada;
    await supabase.from("tareas").update(dbPatch as never).eq("id", id);
  },

  async toggleTarea(id: string) {
    const t = state.tareas.find((x) => x.id === id);
    if (!t) return;
    await actions.updateTarea(id, { completada: !t.completada });
  },

  async deleteTarea(id: string) {
    state = { ...state, tareas: state.tareas.filter((t) => t.id !== id) };
    emit();
    await supabase.from("tareas").delete().eq("id", id);
  },

  async addNota(leadId: string, contenido: string): Promise<boolean> {
    const tempId = `opt-${Date.now()}`;
    const optimistic: Nota = { id: tempId, leadId, contenido, usuario: currentUser ?? "", createdAt: new Date().toISOString() };
    state = { ...state, notas: [optimistic, ...state.notas] };
    emit();
    const { error } = await supabase.from("notas").insert({ lead_id: leadId, contenido, usuario: currentUser ?? "" });
    if (error) {
      state = { ...state, notas: state.notas.filter((n) => n.id !== tempId) };
      emit();
      console.error("addNota error:", error.message);
      return false;
    }
    await refetchNotas();
    return true;
  },

  async updateNota(id: string, contenido: string) {
    state = { ...state, notas: state.notas.map((n) => (n.id === id ? { ...n, contenido } : n)) };
    emit();
    await supabase.from("notas").update({ contenido }).eq("id", id);
  },

  async deleteNota(id: string) {
    state = { ...state, notas: state.notas.filter((n) => n.id !== id) };
    emit();
    await supabase.from("notas").delete().eq("id", id);
  },

  async addProducto(leadId: string, input: Omit<Producto, "id" | "leadId" | "createdAt" | "createdBy">) {
    await supabase.from("productos_lead").insert({
      lead_id: leadId,
      tipo: input.tipo,
      modelo: input.modelo,
      ancho: input.ancho,
      alto: input.alto,
      tela: input.tela,
      color: input.color,
      relleno: input.relleno,
      patas: input.patas,
      acabado: input.acabado,
      coleccion_tela: input.coleccionTela,
      cantidad: input.cantidad,
      precio_unitario: input.precioUnitario,
      notas_producto: input.notasProducto,
      created_by: currentUser ?? "",
    });
    await refetchProductos();
  },

  async updateProducto(id: string, input: Omit<Producto, "id" | "leadId" | "createdAt" | "createdBy">) {
    await supabase.from("productos_lead").update({
      tipo: input.tipo,
      modelo: input.modelo,
      ancho: input.ancho,
      alto: input.alto,
      tela: input.tela,
      color: input.color,
      relleno: input.relleno,
      patas: input.patas,
      acabado: input.acabado,
      coleccion_tela: input.coleccionTela,
      cantidad: input.cantidad,
      precio_unitario: input.precioUnitario,
      notas_producto: input.notasProducto,
    }).eq("id", id);
    await refetchProductos();
  },

  async deleteProducto(id: string) {
    state = { ...state, productos: state.productos.filter((p) => p.id !== id) };
    emit();
    await supabase.from("productos_lead").delete().eq("id", id);
  },

  async deleteAuditEntry(id: string) {
    state = { ...state, audit: state.audit.filter((a) => a.id !== id) };
    emit();
    await supabase.from("audit_log").delete().eq("id", id);
  },
};

export function nextPendingTaskFor(leadId: string, tareas: Tarea[]): Tarea | undefined {
  return tareas
    .filter((t) => t.leadId === leadId && !t.completada)
    .sort((a, b) => a.fecha.localeCompare(b.fecha))[0];
}

export function vendedorTotals(leads: Lead[]) {
  const map = new Map<string, { leads: number; valor: number }>();
  ["isangradortorres@gmail.com", "rocionavarreteurdiales98@gmail.com", "sangradortorresjuan@gmail.com", "bea.gyerro@gmail.com"].forEach((v) =>
    map.set(v, { leads: 0, valor: 0 }),
  );
  leads.forEach((l) => {
    const cur = map.get(l.vendedor) ?? { leads: 0, valor: 0 };
    cur.leads += 1;
    cur.valor += l.valor;
    map.set(l.vendedor, cur);
  });
  return map;
}
