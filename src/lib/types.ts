export const VENDEDORES = [
  "isangradortorres@gmail.com",
  "rocionavarreteurdiales98@gmail.com",
  "sangradortorresjuan@gmail.com",
  "bea.gyerro@gmail.com",
] as const;

export type Vendedor = (typeof VENDEDORES)[number] | string;

const NAMES: Record<string, string> = {
  "isangradortorres@gmail.com": "Iñaki",
  "rocionavarreteurdiales98@gmail.com": "Rocío",
  "sangradortorresjuan@gmail.com": "Juan",
  "bea.gyerro@gmail.com": "Bea",
  // Compatibilidad con datos antiguos en Supabase
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
  hora: string;
  vendedor: string;
  completada: boolean;
}

export interface Nota {
  id: string;
  leadId: string;
  contenido: string;
  usuario: string;
  createdAt: string;
}

export interface Producto {
  id: string;
  leadId: string;
  modelo: string;
  ancho: number | null;
  alto: number | null;
  tela: string;
  color: string;
  relleno: string;
  patas: string;
  cantidad: number;
  precioUnitario: number;
  notasProducto: string;
  createdAt: string;
  createdBy: string;
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
