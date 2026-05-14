export const VENDEDORES = [
  "inaki@tiroriro.com",
  "rocio@tiroriro.com",
  "juan@tiroriro.com",
  "bea@tiroriro.com",
] as const;

export type Vendedor = (typeof VENDEDORES)[number] | string;

const NAMES: Record<string, string> = {
  "inaki@tiroriro.com": "Iñaki",
  "rocio@tiroriro.com": "Rocío",
  "juan@tiroriro.com": "Juan",
  "bea@tiroriro.com": "Bea",
};

export function vendorName(v: string): string {
  return NAMES[v] ?? v;
}

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
  vendedor: string;
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

export interface AuditEntry {
  id: string;
  tabla: string;
  leadId: string | null;
  campo: string;
  valorAnterior: string | null;
  valorNuevo: string | null;
  usuario: string | null;
  createdAt: string;
}
