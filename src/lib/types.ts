export type Vendedor = "Iñaki" | "Rocío" | "Juan" | "Bea";
export const VENDEDORES: Vendedor[] = ["Iñaki", "Rocío", "Juan", "Bea"];

export type Etapa =
  | "Discovery"
  | "Llamada"
  | "Proposal"
  | "Closed Won"
  | "Closed Lost";
export const ETAPAS: Etapa[] = [
  "Discovery",
  "Llamada",
  "Proposal",
  "Closed Won",
  "Closed Lost",
];

export const ETAPA_COLORS: Record<Etapa, string> = {
  Discovery: "#38bdf8",
  Llamada: "#f59e0b",
  Proposal: "#8b5cf6",
  "Closed Won": "#10b981",
  "Closed Lost": "#ef4444",
};

export interface Lead {
  id: string;
  nombre: string;
  email: string;
  telefono: string;
  ciudad: string;
  producto: string;
  vendedor: Vendedor;
  etapa: Etapa;
  valor: number;
  fechaCreacion: string;
}

export interface Tarea {
  id: string;
  leadId: string;
  descripcion: string;
  fecha: string;
  vendedor: string;
  completada: boolean;
}
