import type { Lead, Pedido } from "@/lib/types";

// ── Normalización de campos de contacto ──────────────────────────────
// Se usa tanto para detectar leads duplicados como para reconocer a un
// cliente recurrente (mismo teléfono/email en otro lead ya entregado).

/** Teléfono: solo dígitos, nos quedamos con los últimos 9 (formato ES). */
export function normTel(t: string | null | undefined): string {
  const d = (t ?? "").replace(/\D/g, "");
  return d.length >= 9 ? d.slice(-9) : d;
}

/** Email: minúsculas y sin espacios. */
export function normEmail(e: string | null | undefined): string {
  return (e ?? "").trim().toLowerCase();
}

/** Nombre: minúsculas, sin acentos, espacios colapsados. */
export function normNombre(n: string | null | undefined): string {
  return (n ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ");
}

/**
 * Claves "fuertes" de un lead: teléfono y email normalizados. Solo estas
 * sirven para emparejar duplicados (el nombre solo puede coincidir por
 * casualidad, así que no basta por sí mismo).
 */
export function clavesFuertes(l: Lead): string[] {
  const out: string[] = [];
  const tel = normTel(l.telefono);
  if (tel.length >= 9) out.push("tel:" + tel);
  const email = normEmail(l.email);
  if (email.includes("@")) out.push("email:" + email);
  return out;
}

/**
 * Agrupa leads que comparten alguna clave fuerte (mismo teléfono o email),
 * dentro del mismo tipo (B2C con B2C, etc.). Devuelve solo los grupos con
 * 2 o más leads (posibles duplicados). El grupo se ordena por antigüedad
 * (el más antiguo primero: candidato natural a "conservar").
 */
export function detectarDuplicados(leads: Lead[]): Lead[][] {
  // union-find sencillo por índice
  const parent = leads.map((_, i) => i);
  const find = (x: number): number => (parent[x] === x ? x : (parent[x] = find(parent[x])));
  const union = (a: number, b: number) => { parent[find(a)] = find(b); };

  const porClave = new Map<string, number>();
  leads.forEach((l, i) => {
    for (const clave of clavesFuertes(l)) {
      const scoped = (l.tipo ?? "B2C") + "|" + clave;
      const prev = porClave.get(scoped);
      if (prev === undefined) porClave.set(scoped, i);
      else union(prev, i);
    }
  });

  const grupos = new Map<number, Lead[]>();
  leads.forEach((l, i) => {
    const root = find(i);
    const arr = grupos.get(root) ?? [];
    arr.push(l);
    grupos.set(root, arr);
  });

  return [...grupos.values()]
    .filter((g) => g.length >= 2)
    .map((g) => [...g].sort((a, b) =>
      (a.fechaCreacion || "").localeCompare(b.fechaCreacion || "")
    ));
}

/**
 * Un cliente es "recurrente" si él mismo o cualquier otro lead que comparta
 * teléfono/email tiene ya algún pedido entregado. Así, cuando se crea un
 * "nuevo encargo" (lead nuevo con los datos del anterior), se reconoce que
 * es un cliente de siempre aunque el lead nuevo aún no tenga entregas.
 */
export function esClienteRecurrente(lead: Lead, leads: Lead[], pedidos: Pedido[]): boolean {
  const claves = new Set(clavesFuertes(lead));
  const idsRelacionados = new Set<string>([lead.id]);
  if (claves.size > 0) {
    for (const otro of leads) {
      if (otro.id === lead.id) continue;
      if ((otro.tipo ?? "B2C") !== (lead.tipo ?? "B2C")) continue;
      if (clavesFuertes(otro).some((c) => claves.has(c))) idsRelacionados.add(otro.id);
    }
  }
  return pedidos.some((p) => idsRelacionados.has(p.leadId ?? "") && p.entregado);
}
