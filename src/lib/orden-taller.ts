// ─────────────────────────────────────────────────────────────────────────────
// Orden de la cola del taller (regla única para TODAS las vistas de tapicero).
//
// Las cards / filas se ordenan SIEMPRE por la fecha en la que el producto sale
// del taller: la fecha de RECOGIDA de Juan y, si todavía no está puesta, la
// fecha de ENTREGA al cliente. Lo que antes sale, primero.
//
// El orden manual (`orden_produccion`, arrastrando en el panel) se mantiene,
// pero DESEMPATA DENTRO DE UN MISMO DÍA. Antes mandaba sobre todo lo demás, y
// por eso un tapicero con posiciones guardadas hace semanas veía la cola
// congelada, ignorando las fechas de recogida (mientras otro tapicero, sin
// orden manual guardado, sí salía ordenado por fecha).
// ─────────────────────────────────────────────────────────────────────────────

// Fecha "infinita": los productos sin ninguna fecha van al final.
export const SIN_FECHA = "9999-12-31";

export interface ConFechasTaller {
  fechaRecogida?: string | null;
  fechaLimite?: string | null;
  ordenProduccion?: number | null;
}

// Fecha que manda en la cola: recogida por Juan → entrega al cliente → sin fecha.
export function fechaCola(p: ConFechasTaller): string {
  return p.fechaRecogida || p.fechaLimite || SIN_FECHA;
}

// Orden manual guardado; sin él, al final de su día.
export function ordenManual(p: ConFechasTaller): number {
  return p.ordenProduccion ?? Number.MAX_SAFE_INTEGER;
}

// Clave de ordenación: [día de salida, orden manual dentro del día, entrega].
export type ClaveCola = [string, number, string];

export function claveCola(p: ConFechasTaller): ClaveCola {
  return [fechaCola(p), ordenManual(p), p.fechaLimite || SIN_FECHA];
}

export function cmpClaveCola(a: ClaveCola, b: ClaveCola): number {
  if (a[0] !== b[0]) return a[0] < b[0] ? -1 : 1;
  if (a[1] !== b[1]) return a[1] < b[1] ? -1 : 1; // (evita restar dos MAX_SAFE_INTEGER)
  return a[2].localeCompare(b[2]);
}

// Comparador directo de dos pedidos/productos para `Array.prototype.sort`.
export function cmpCola(a: ConFechasTaller, b: ConFechasTaller): number {
  return cmpClaveCola(claveCola(a), claveCola(b));
}

// Renumera el orden manual de una secuencia ya colocada por el usuario: cada
// día de salida se numera 1, 2, 3… siguiendo el orden en el que sus productos
// aparecen en esa secuencia. Así el arrastre se guarda como "dentro de su día",
// que es justo lo que la cola respeta.
export function ordenPorDia<T extends ConFechasTaller & { id: string }>(secuencia: T[]): Map<string, number> {
  const contador = new Map<string, number>();
  const out = new Map<string, number>();
  for (const p of secuencia) {
    const dia = fechaCola(p);
    const n = (contador.get(dia) ?? 0) + 1;
    contador.set(dia, n);
    out.set(p.id, n);
  }
  return out;
}
