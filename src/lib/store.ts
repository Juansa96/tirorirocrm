import { useSyncExternalStore } from "react";
import type { Lead, Tarea, Etapa, Vendedor } from "./types";

const LS_KEY = "tirocrm:v1";

interface State {
  leads: Lead[];
  tareas: Tarea[];
}

const SEED: State = {
  leads: [
    {
      id: "l1",
      nombre: "Teresa Guardone",
      email: "",
      telefono: "",
      ciudad: "Lisboa",
      producto: "Cabecero",
      vendedor: "Rocío",
      etapa: "Discovery",
      valor: 0,
      fechaCreacion: "2026-05-01",
    },
    {
      id: "l2",
      nombre: "Lucía García",
      email: "lucia.garciamata@gmail.com",
      telefono: "",
      ciudad: "Madrid",
      producto: "Cabecero",
      vendedor: "Rocío",
      etapa: "Llamada",
      valor: 0,
      fechaCreacion: "2026-05-03",
    },
    {
      id: "l3",
      nombre: "Antonio Herrera",
      email: "toninohm10@hotmail.com",
      telefono: "",
      ciudad: "Madrid",
      producto: "Cabecero",
      vendedor: "Iñaki",
      etapa: "Llamada",
      valor: 345,
      fechaCreacion: "2026-05-05",
    },
    {
      id: "l4",
      nombre: "Alicia Mascort",
      email: "aliciamascort@gmail.com",
      telefono: "",
      ciudad: "Valencia",
      producto: "Cabecero",
      vendedor: "Rocío",
      etapa: "Proposal",
      valor: 520,
      fechaCreacion: "2026-05-07",
    },
    {
      id: "l5",
      nombre: "Almu Alonso",
      email: "almualonso@gmail.com",
      telefono: "",
      ciudad: "Madrid",
      producto: "Cabecero",
      vendedor: "Rocío",
      etapa: "Closed Won",
      valor: 250,
      fechaCreacion: "2026-04-28",
    },
  ],
  tareas: [
    { id: "t1", leadId: "l1", descripcion: "Follow Up Teresa Portugal", fecha: "2026-05-14", vendedor: "Rocío", completada: false },
    { id: "t2", leadId: "l3", descripcion: "Recibir telas e ir a su casa a que decida", fecha: "2026-05-14", vendedor: "Iñaki", completada: false },
    { id: "t3", leadId: "l4", descripcion: "Mandar muestras a Valencia", fecha: "2026-05-14", vendedor: "Rocío", completada: false },
  ],
};

let state: State = SEED;
const listeners = new Set<() => void>();

function load() {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) state = JSON.parse(raw);
    else save();
  } catch {
    /* noop */
  }
}

function save() {
  if (typeof window === "undefined") return;
  localStorage.setItem(LS_KEY, JSON.stringify(state));
}

let loaded = false;
function ensureLoaded() {
  if (!loaded && typeof window !== "undefined") {
    load();
    loaded = true;
  }
}

function emit() {
  save();
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  ensureLoaded();
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function getSnapshot(): State {
  ensureLoaded();
  return state;
}

const SERVER_SNAPSHOT: State = SEED;
function getServerSnapshot(): State {
  return SERVER_SNAPSHOT;
}

export function useStore(): State {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

export const actions = {
  addLead(input: Omit<Lead, "id" | "fechaCreacion">, firstTask?: { descripcion: string; fecha: string }) {
    const lead: Lead = {
      ...input,
      id: uid(),
      fechaCreacion: new Date().toISOString().slice(0, 10),
    };
    state = { ...state, leads: [...state.leads, lead] };
    if (firstTask && firstTask.descripcion.trim()) {
      const tarea: Tarea = {
        id: uid(),
        leadId: lead.id,
        descripcion: firstTask.descripcion,
        fecha: firstTask.fecha,
        vendedor: lead.vendedor,
        completada: false,
      };
      state = { ...state, tareas: [...state.tareas, tarea] };
    }
    emit();
    return lead;
  },
  updateLead(id: string, patch: Partial<Lead>) {
    state = {
      ...state,
      leads: state.leads.map((l) => (l.id === id ? { ...l, ...patch } : l)),
    };
    emit();
  },
  setLeadEtapa(id: string, etapa: Etapa) {
    actions.updateLead(id, { etapa });
  },
  addTarea(input: Omit<Tarea, "id" | "completada">) {
    const t: Tarea = { ...input, id: uid(), completada: false };
    state = { ...state, tareas: [...state.tareas, t] };
    emit();
  },
  toggleTarea(id: string) {
    state = {
      ...state,
      tareas: state.tareas.map((t) =>
        t.id === id ? { ...t, completada: !t.completada } : t,
      ),
    };
    emit();
  },
};

export function nextPendingTaskFor(leadId: string, tareas: Tarea[]): Tarea | undefined {
  return tareas
    .filter((t) => t.leadId === leadId && !t.completada)
    .sort((a, b) => a.fecha.localeCompare(b.fecha))[0];
}

export function vendedorTotals(leads: Lead[]) {
  const map = new Map<Vendedor, { leads: number; valor: number }>();
  (["Iñaki", "Rocío", "Juan", "Bea"] as Vendedor[]).forEach((v) =>
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
