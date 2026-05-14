import { useSyncExternalStore } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Lead, Tarea, Etapa, AuditEntry } from "./types";

interface State {
  leads: Lead[];
  tareas: Tarea[];
  audit: AuditEntry[];
  loaded: boolean;
}

let state: State = { leads: [], tareas: [], audit: [], loaded: false };
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
    fechaCreacion: r.fecha_creacion,
  };
}

function mapTarea(r: any): Tarea {
  return {
    id: r.id,
    leadId: r.lead_id,
    descripcion: r.descripcion,
    fecha: r.fecha,
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
  // realtime
  supabase
    .channel("tirocrm-realtime")
    .on("postgres_changes", { event: "*", schema: "public", table: "leads" }, () =>
      refetchLeads(),
    )
    .on("postgres_changes", { event: "*", schema: "public", table: "tareas" }, () =>
      refetchTareas(),
    )
    .on("postgres_changes", { event: "*", schema: "public", table: "audit_log" }, () =>
      refetchAudit(),
    )
    .subscribe();
}

async function refetchLeads() {
  const { data } = await supabase.from("leads").select("*").order("created_at", { ascending: false });
  state = { ...state, leads: (data ?? []).map(mapLead) };
  emit();
}
async function refetchTareas() {
  const { data } = await supabase.from("tareas").select("*").order("fecha", { ascending: true });
  state = { ...state, tareas: (data ?? []).map(mapTarea) };
  emit();
}
async function refetchAudit() {
  const { data } = await supabase.from("audit_log").select("*").order("created_at", { ascending: false }).limit(500);
  state = { ...state, audit: (data ?? []).map(mapAudit) };
  emit();
}
async function refetchAll() {
  await Promise.all([refetchLeads(), refetchTareas(), refetchAudit()]);
  state = { ...state, loaded: true };
  emit();
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  if (typeof window !== "undefined") void init();
  return () => {
    listeners.delete(cb);
  };
}

const SERVER: State = { leads: [], tareas: [], audit: [], loaded: false };
function getSnapshot(): State {
  return state;
}
function getServerSnapshot(): State {
  return SERVER;
}

export function useStore(): State {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export const actions = {
  async addLead(
    input: Omit<Lead, "id" | "fechaCreacion">,
    firstTask?: { descripcion: string; fecha: string },
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
        vendedor: lead.vendedor,
        completada: false,
      });
    }
    await refetchAll();
    return lead;
  },
  async updateLead(id: string, patch: Partial<Lead>) {
    const dbPatch: Record<string, unknown> = {};
    if (patch.nombre !== undefined) dbPatch.nombre = patch.nombre;
    if (patch.email !== undefined) dbPatch.email = patch.email;
    if (patch.telefono !== undefined) dbPatch.telefono = patch.telefono;
    if (patch.ciudad !== undefined) dbPatch.ciudad = patch.ciudad;
    if (patch.producto !== undefined) dbPatch.producto = patch.producto;
    if (patch.vendedor !== undefined) dbPatch.vendedor = patch.vendedor;
    if (patch.etapa !== undefined) dbPatch.etapa = patch.etapa;
    if (patch.valor !== undefined) dbPatch.valor = patch.valor;
    // Optimistic local update
    state = {
      ...state,
      leads: state.leads.map((l) => (l.id === id ? { ...l, ...patch } : l)),
    };
    emit();
    await supabase.from("leads").update(dbPatch as never).eq("id", id);
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
      vendedor: input.vendedor,
      completada: false,
    });
    await refetchTareas();
  },
  async toggleTarea(id: string) {
    const t = state.tareas.find((x) => x.id === id);
    if (!t) return;
    const next = !t.completada;
    state = {
      ...state,
      tareas: state.tareas.map((x) => (x.id === id ? { ...x, completada: next } : x)),
    };
    emit();
    await supabase.from("tareas").update({ completada: next }).eq("id", id);
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
