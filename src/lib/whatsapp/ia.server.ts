// ══════════════════════════════════════════════════════════════════════════
// Lectura de una conversación de WhatsApp con IA (solo servidor).
//
// Usa la pasarela de IA de Lovable (ya disponible en el proyecto con
// LOVABLE_API_KEY, sin claves nuevas). Es compatible con la API de chat de
// OpenAI, así que se pide la respuesta como llamada a función para obtener
// JSON con forma fija, y se valida con zod antes de usarla.
// ══════════════════════════════════════════════════════════════════════════

import { z } from "zod";
import { ETAPAS, RAZONES_PERDIDA_B2C } from "@/lib/types";
import { CABECERO_FORMAS, PANTALLA_FORMAS, TIPO_LABEL } from "@/lib/catalogo";
import type { AnalisisIA } from "./types";

const GATEWAY_URL = process.env.LOVABLE_AI_GATEWAY_URL || "https://ai.gateway.lovable.dev/v1/chat/completions";

export interface MensajeParaIA {
  direccion: "entrante" | "saliente";
  texto: string;
  enviadoAt: string;
}

export interface ContextoLead {
  nombre: string;
  etapa: string;
  ciudad: string;
  provincia: string;
  email: string;
  direccion: string;
  productos: string[];       // descripciones cortas
  pedidos: string[];         // "Pedido 12 · Entregado"
  notasRecientes: string[];
}

export interface EntradaAnalisis {
  telefono: string;
  nombreWa: string;
  mensajes: MensajeParaIA[];
  lead: ContextoLead | null;
  modo: "normal" | "historico";
  modelo: string;
  hoy: string;               // YYYY-MM-DD
}

const productoSchema = z.object({
  tipo: z.string().default("otro"),
  modelo: z.string().nullish(),
  ancho: z.coerce.number().nullish(),
  alto: z.coerce.number().nullish(),
  fondo: z.coerce.number().nullish(),
  tela: z.string().nullish(),
  color: z.string().nullish(),
  montaje: z.enum(["colgar", "apoyar", ""]).nullish(),
  cantidad: z.coerce.number().nullish(),
  precio: z.coerce.number().nullish(),
  notas: z.string().nullish(),
});

const analisisSchema = z.object({
  es_cliente: z.boolean().default(true),
  resumen: z.string().default(""),
  contacto: z.object({
    nombre: z.string().nullish(),
    ciudad: z.string().nullish(),
    provincia: z.string().nullish(),
    email: z.string().nullish(),
    direccion: z.string().nullish(),
  }).default({}),
  productos: z.array(productoSchema).default([]),
  etapa_sugerida: z.string().nullish(),
  etapa_motivo: z.string().default(""),
  razon_perdida: z.string().nullish(),
  venta_importe: z.coerce.number().nullish(),
  nuevo_encargo: z.boolean().default(false),
  novedades: z.array(z.string()).default([]),
  siguiente_accion: z.object({ descripcion: z.string().default(""), fecha: z.string().nullish() }).nullish(),
  espera_respuesta: z.boolean().default(false),
  duda_identidad: z.string().nullish(),
});

// JSON Schema de la función (lo que la IA debe devolver). Sin tipos "null"
// ni additionalProperties: no todos los modelos de la pasarela los aceptan.
// Lo que no se sabe se omite o va como cadena vacía; zod lo normaliza.
const PARAMETROS_FUNCION = {
  type: "object",
  properties: {
    es_cliente: { type: "boolean", description: "true si quien escribe es un cliente o posible cliente. false para proveedores, transportistas, tapiceros, amigos, spam o publicidad." },
    resumen: { type: "string", description: "1 a 3 frases en español: qué quiere y en qué punto está la conversación." },
    contacto: {
      type: "object",
      properties: {
        nombre: { type: "string", description: "Nombre y apellidos del cliente si aparecen en el chat (no el nombre del perfil). Vacío si no." },
        ciudad: { type: "string" },
        provincia: { type: "string" },
        email: { type: "string" },
        direccion: { type: "string", description: "Dirección de entrega completa si la ha dado." },
      },
    },
    productos: {
      type: "array",
      description: "Productos de los que se habla, con lo que se sepa de cada uno. Vacío si no se concreta nada.",
      items: {
        type: "object",
        properties: {
          tipo: { type: "string", enum: ["cabecero", "banco", "cojin", "puf", "mesa", "pantalla", "otro"] },
          modelo: { type: "string", description: "Forma o modelo si se nombra." },
          ancho: { type: "number", description: "cm; omitir si no se sabe" },
          alto: { type: "number", description: "cm; omitir si no se sabe" },
          fondo: { type: "number", description: "cm (bancos, pufs, mesas); omitir si no se sabe" },
          tela: { type: "string", description: "Nombre de la tela tal como aparece." },
          color: { type: "string" },
          montaje: { type: "string", enum: ["colgar", "apoyar", ""] },
          cantidad: { type: "number" },
          precio: { type: "number", description: "Precio en euros que se le ha dicho al cliente por este producto; omitir si no aparece." },
          notas: { type: "string", description: "Detalles sueltos: vivo, enchufes, huecos, plazos…" },
        },
        required: ["tipo"],
      },
    },
    etapa_sugerida: { type: "string", enum: [...ETAPAS, ""], description: "Etapa del pipeline que refleja el chat, o cadena vacía si no está claro." },
    etapa_motivo: { type: "string", description: "Cita corta del chat que justifica la etapa." },
    razon_perdida: { type: "string", enum: [...RAZONES_PERDIDA_B2C, ""], description: "Solo si etapa_sugerida es Closed Lost; si no, vacío." },
    venta_importe: { type: "number", description: "Importe total de la venta en euros si etapa_sugerida es Closed Won y se conoce; omitir si no." },
    nuevo_encargo: { type: "boolean", description: "true si es un cliente que ya compró antes y ahora pide OTRA cosa nueva." },
    novedades: { type: "array", items: { type: "string" }, description: "Hechos nuevos y útiles para la ficha (ha pagado la reserva, quiere factura, cambia las medidas, pregunta por la entrega…). Frases cortas. Vacío si no hay nada nuevo." },
    siguiente_accion: {
      type: "object",
      properties: {
        descripcion: { type: "string", description: "Vacío si no hay ningún compromiso." },
        fecha: { type: "string", description: "YYYY-MM-DD si se ha quedado en una fecha; si no, vacío." },
      },
      description: "Compromiso concreto que ha adquirido Tiroriro en el chat (enviar muestras, mandar presupuesto, llamar el lunes…). Nunca 'responder al cliente'. Si no hay, descripcion vacía.",
    },
    espera_respuesta: { type: "boolean", description: "true si el último mensaje es del cliente y sigue sin respuesta." },
    duda_identidad: { type: "string", description: "Si no queda claro quién es la persona o si escribe en nombre de otra, explícalo aquí. Vacío si no." },
  },
  required: ["es_cliente", "resumen", "contacto", "productos", "etapa_sugerida", "etapa_motivo", "nuevo_encargo", "novedades", "espera_respuesta"],
};

function promptSistema(hoy: string): string {
  const formas = Object.values(CABECERO_FORMAS).join(", ");
  const pantallas = Object.values(PANTALLA_FORMAS).join(", ");
  const tipos = Object.entries(TIPO_LABEL).map(([k, v]) => `${k} (${v})`).join(", ");
  return `Eres el asistente del CRM de Tiroriro Home, un taller de Madrid que fabrica cabeceros de cama tapizados a medida y otros muebles tapizados (bancos, almohadones, pufs, mesas de centro tapizadas y pantallas de lámpara). Los clientes escriben por WhatsApp; tú lees la conversación y extraes lo que sirve para la ficha del cliente en el CRM. Hoy es ${hoy}.

REGLAS
- Extrae SOLO lo que diga el chat. No inventes ni completes con suposiciones. Si algo no aparece, déjalo en null o vacío.
- Tipos de producto: ${tipos}. Formas de cabecero: ${formas}. Formas de pantalla: ${pantallas}. Un cabecero se define por ancho (cm), alto (100, 120 o 130 cm normalmente), forma, tela y color, y montaje (colgar en la pared o apoyar en el suelo). Un banco (modelo Oyambre) por ancho. Envío: Madrid 40 €, resto de España 60 €.
- Los mensajes marcados [Tiroriro] los escribe el equipo (Rocío, Juan, Iñaki o Bea); los marcados [Cliente] los escribe la persona.
- "[Nota de voz] «…»" es la transcripción automática de un audio: trátala como si esa persona lo hubiera escrito (puede tener alguna palabra mal transcrita). "[Audio]" o "[Nota de voz]" sin texto es un audio que aún no se ha podido transcribir: no supongas lo que dice.
- Etapas del pipeline (elige la que refleje el chat, o null si dudas):
  · Discovery: la persona ha escrito y aún no le hemos contestado con información.
  · Primer Contacto: ya le hemos respondido (precio orientativo, preguntas sobre medidas…) pero no hay negociación concreta.
  · Negotiation: se está concretando un pedido: medidas, tela, precio, plazos, muestras, presupuesto.
  · On Hold: la persona ha dicho explícitamente que lo deja para más adelante.
  · Closed Won: SOLO si ha confirmado el pedido de forma clara ("adelante", ha enviado la dirección para el pedido, ha pagado o manda justificante).
  · Closed Lost: SOLO si ha dicho que no de forma clara, ha comprado en otro sitio, o lleva más de 3 semanas sin contestar a un presupuesto.
  Si el cliente ya tiene un pedido en marcha o entregado y solo pregunta por él, no cambies la etapa (etapa_sugerida null) y explica en novedades.
- es_cliente: false para proveedores de tela, transportistas, tapiceros, bancos, publicidad, spam, contactos personales o conversaciones sin relación con comprar un producto.
- novedades: solo hechos nuevos que un comercial querría ver en la ficha. Nada de "el cliente saluda".
- siguiente_accion: solo compromisos concretos de Tiroriro con fecha o acción clara. Nunca "responder", "contestar" o "hacer seguimiento" a secas.
- Responde llamando a la función registrar_analisis. Todo en español.`;
}

function promptUsuario(e: EntradaAnalisis): string {
  const partes: string[] = [];
  partes.push(`Teléfono del cliente: +${e.telefono}. Nombre del perfil de WhatsApp: ${e.nombreWa || "(sin nombre)"}.`);
  if (e.modo === "historico") {
    partes.push("Esta conversación es HISTORIAL antiguo (anterior a conectar el CRM). Resume y extrae datos; la etapa y las acciones tienen poca importancia.");
  }
  if (e.lead) {
    const l = e.lead;
    partes.push(`FICHA ACTUAL EN EL CRM → nombre: ${l.nombre || "(vacío)"} · etapa: ${l.etapa} · ciudad: ${l.ciudad || "(vacía)"} · provincia: ${l.provincia || "(vacía)"} · email: ${l.email || "(vacío)"} · dirección: ${l.direccion || "(vacía)"}`);
    if (l.productos.length) partes.push(`Productos en la ficha: ${l.productos.join(" | ")}`);
    if (l.pedidos.length) partes.push(`Pedidos: ${l.pedidos.join(" | ")}`);
    if (l.notasRecientes.length) partes.push(`Notas recientes: ${l.notasRecientes.join(" | ")}`);
    partes.push("Compara el chat con la ficha: en productos indica lo que dice el chat (aunque coincida), en novedades solo lo nuevo.");
  } else {
    partes.push("Esta persona NO está en el CRM todavía (o no se ha podido enlazar).");
  }
  partes.push("CONVERSACIÓN (de más antigua a más reciente):");
  for (const m of e.mensajes) {
    const quien = m.direccion === "saliente" ? "[Tiroriro]" : "[Cliente]";
    const fecha = m.enviadoAt.slice(0, 16).replace("T", " ");
    partes.push(`${fecha} ${quien} ${m.texto.replace(/\s+/g, " ").slice(0, 1200)}`);
  }
  return partes.join("\n");
}

export class ErrorIA extends Error {
  constructor(message: string, public status?: number) { super(message); this.name = "ErrorIA"; }
}

function extraerJSON(texto: string): unknown {
  const limpio = texto.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  try { return JSON.parse(limpio); } catch { /* sigue */ }
  const a = limpio.indexOf("{"), b = limpio.lastIndexOf("}");
  if (a >= 0 && b > a) return JSON.parse(limpio.slice(a, b + 1));
  throw new ErrorIA("La IA no devolvió JSON");
}

export async function analizarConversacionIA(e: EntradaAnalisis): Promise<AnalisisIA> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new ErrorIA("LOVABLE_API_KEY no está configurada en el servidor");

  const body = {
    model: e.modelo || "google/gemini-2.5-flash",
    messages: [
      { role: "system", content: promptSistema(e.hoy) },
      { role: "user", content: promptUsuario(e) },
    ],
    tools: [{
      type: "function",
      function: {
        name: "registrar_analisis",
        description: "Registra en el CRM lo extraído de la conversación de WhatsApp.",
        parameters: PARAMETROS_FUNCION,
      },
    }],
    tool_choice: { type: "function", function: { name: "registrar_analisis" } },
    temperature: 0.2,
  };

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 60_000);
  let res: Response;
  try {
    res = await fetch(GATEWAY_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
  } finally {
    clearTimeout(t);
  }
  if (res.status === 429) throw new ErrorIA("La pasarela de IA está limitando peticiones (429); se reintentará más tarde", 429);
  if (res.status === 402) throw new ErrorIA("Sin crédito de IA en Lovable (402): revisa el uso en Lovable Cloud → AI", 402);
  if (!res.ok) throw new ErrorIA(`Error de la pasarela de IA (${res.status}): ${(await res.text()).slice(0, 300)}`, res.status);

  const data = await res.json() as {
    choices?: Array<{ message?: { content?: string | null; tool_calls?: Array<{ function?: { name?: string; arguments?: string } }> } }>;
  };
  const msg = data.choices?.[0]?.message;
  const args = msg?.tool_calls?.find((c) => c.function?.name === "registrar_analisis")?.function?.arguments
    ?? msg?.tool_calls?.[0]?.function?.arguments;
  const crudo = args ? extraerJSON(args) : msg?.content ? extraerJSON(msg.content) : null;
  if (!crudo) throw new ErrorIA("La IA no devolvió ningún análisis");

  const parsed = analisisSchema.safeParse(crudo);
  if (!parsed.success) throw new ErrorIA("El análisis de la IA no tiene la forma esperada: " + parsed.error.issues.map((i) => i.path.join(".") + " " + i.message).join("; "));
  const a = parsed.data;
  // Normalizaciones defensivas.
  const etapa = a.etapa_sugerida && (ETAPAS as readonly string[]).includes(a.etapa_sugerida) ? a.etapa_sugerida : null;
  const razon = a.razon_perdida && (RAZONES_PERDIDA_B2C as readonly string[]).includes(a.razon_perdida) ? a.razon_perdida : null;
  return {
    ...a,
    contacto: a.contacto ?? {},
    etapa_sugerida: etapa,
    razon_perdida: razon,
    productos: a.productos.map((p) => ({ ...p, tipo: p.tipo || "otro", montaje: p.montaje || null })),
    siguiente_accion: a.siguiente_accion?.descripcion?.trim() ? { descripcion: a.siguiente_accion.descripcion.trim(), fecha: a.siguiente_accion.fecha?.trim() || null } : null,
    duda_identidad: a.duda_identidad?.trim() || null,
    venta_importe: a.venta_importe && a.venta_importe > 0 ? a.venta_importe : null,
    novedades: a.novedades.map((n) => n.trim()).filter(Boolean).slice(0, 8),
    resumen: a.resumen.trim().slice(0, 1200),
  };
}
