// ══════════════════════════════════════════════════════════════════════════
// Lectura del payload del webhook de WhatsApp (formato Cloud API de Meta, que
// es el que reenvían los proveedores de coexistencia como Dualhook).
//
// Sin dependencias: se puede probar aislado. Devuelve mensajes normalizados
// (uno por mensaje de WhatsApp) con la dirección ya resuelta:
//   · campo "messages"            → mensajes del cliente (entrante)
//   · campo "smb_message_echoes"  → lo que contestamos desde la app (saliente)
//   · campo "history"             → historial sincronizado al conectar (ambos)
// Los "statuses" (entregado/leído) y las reacciones se ignoran.
// ══════════════════════════════════════════════════════════════════════════

import { digitosTelefono } from "./types";

export interface MensajeNormalizado {
  waId: string;                 // id del mensaje en WhatsApp
  telefono: string;             // wa_id del CLIENTE (dígitos)
  nombreWa: string;             // nombre de perfil del cliente si viene
  direccion: "entrante" | "saliente";
  tipo: string;
  texto: string;
  enviadoAt: string;            // ISO
  historial: boolean;           // viene de la sincronización de historial
  raw: unknown;
}

export interface ContactoSync {
  telefono: string;             // dígitos
  nombre: string;               // nombre con el que está guardado en la agenda del móvil
  accion: "add" | "remove";
}

export interface ResultadoParse {
  campos: string[];             // campos vistos (messages, smb_message_echoes, history…)
  mensajes: MensajeNormalizado[];
  contactos: ContactoSync[];    // agenda sincronizada (smb_app_state_sync)
  numeroNegocio: string;        // display_phone_number del negocio (dígitos)
  ignorados: number;            // mensajes descartados (statuses, reacciones, sin id…)
}

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => !!v && typeof v === "object" && !Array.isArray(v);
const str = (v: unknown): string => (v == null ? "" : String(v));

function tsToIso(ts: unknown): string {
  const n = Number(ts);
  if (Number.isFinite(n) && n > 0) {
    // Meta manda segundos; por si acaso, milisegundos si es muy grande.
    const ms = n > 1e12 ? n : n * 1000;
    return new Date(ms).toISOString();
  }
  const d = new Date(str(ts));
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

const ETIQUETA_TIPO: Record<string, string> = {
  image: "[Imagen]", video: "[Vídeo]", audio: "[Audio]", voice: "[Nota de voz]", sticker: "[Sticker]",
  document: "[Documento]", location: "[Ubicación]", contacts: "[Contacto]", unsupported: "[Mensaje no soportado]",
};

/** Texto legible de un mensaje según su tipo. */
export function textoDeMensaje(m: Obj): string {
  const tipo = str(m.type) || "text";
  const cuerpo = isObj(m[tipo]) ? (m[tipo] as Obj) : {};
  switch (tipo) {
    case "text":
      return str(cuerpo.body);
    case "image": case "video": case "audio": case "voice": case "sticker": {
      const caption = str(cuerpo.caption).trim();
      return caption ? `${ETIQUETA_TIPO[tipo]} ${caption}` : ETIQUETA_TIPO[tipo];
    }
    case "document": {
      const nombre = str(cuerpo.filename).trim();
      const caption = str(cuerpo.caption).trim();
      return `[Documento${nombre ? `: ${nombre}` : ""}]${caption ? ` ${caption}` : ""}`;
    }
    case "location": {
      const partes = [str(cuerpo.name), str(cuerpo.address)].filter(Boolean).join(" · ");
      const coords = cuerpo.latitude != null ? ` (${cuerpo.latitude}, ${cuerpo.longitude})` : "";
      return `[Ubicación] ${partes}${coords}`.trim();
    }
    case "contacts": {
      const lista = Array.isArray(m.contacts) ? (m.contacts as Obj[]) : [];
      const nombres = lista.map((c) => str((c.name as Obj | undefined)?.formatted_name)).filter(Boolean);
      return `[Contacto] ${nombres.join(", ")}`.trim();
    }
    case "interactive": {
      const br = isObj(cuerpo.button_reply) ? (cuerpo.button_reply as Obj) : null;
      const lr = isObj(cuerpo.list_reply) ? (cuerpo.list_reply as Obj) : null;
      return str(br?.title || lr?.title || cuerpo.body);
    }
    case "button":
      return str(cuerpo.text);
    case "order":
      return "[Pedido del catálogo]";
    case "errors":
      // Encuestas, mensajes de ver una vez… que WhatsApp no reenvía por la API.
      return "[Mensaje que WhatsApp no deja leer]";
    default:
      return ETIQUETA_TIPO[tipo] ?? `[${tipo}]`;
  }
}

function extraerMensaje(
  m: Obj,
  opts: { negocio: string; direccion?: "entrante" | "saliente"; telefonoHilo?: string; nombres: Map<string, string>; historial: boolean },
): MensajeNormalizado | null {
  const waId = str(m.id);
  if (!waId) return null;
  const tipo = str(m.type) || "text";
  if (tipo === "reaction" || tipo === "system" || tipo === "request_welcome" || tipo === "edit") return null;

  const from = digitosTelefono(str(m.from));
  const to = digitosTelefono(str(m.to));
  const ctx = isObj(m.history_context) ? (m.history_context as Obj) : null;

  let direccion = opts.direccion;
  if (!direccion) {
    if (ctx && typeof ctx.from_me === "boolean") direccion = ctx.from_me ? "saliente" : "entrante";
    else if (opts.negocio && from && from === opts.negocio) direccion = "saliente";
    else if (opts.telefonoHilo && from && from !== opts.telefonoHilo) direccion = "saliente";
    else direccion = "entrante";
  }
  // El cliente es "from" si es entrante; si es saliente, "to" (o el hilo).
  let telefono = direccion === "entrante" ? from : to || opts.telefonoHilo || "";
  if (!telefono && opts.telefonoHilo) telefono = opts.telefonoHilo;
  if (!telefono) return null;
  if (opts.negocio && telefono === opts.negocio) return null; // no nos casamos con nosotros mismos

  return {
    waId,
    telefono,
    nombreWa: opts.nombres.get(telefono) ?? "",
    direccion,
    tipo,
    texto: textoDeMensaje(m).slice(0, 4000),
    enviadoAt: tsToIso(m.timestamp),
    historial: opts.historial,
    raw: m,
  };
}

/** Busca el array `entry` de Meta aunque el proveedor lo envuelva en otra clave. */
function encontrarEntries(body: unknown): Obj[] {
  if (!isObj(body)) return [];
  if (Array.isArray(body.entry)) return body.entry.filter(isObj);
  for (const k of ["data", "payload", "body", "event"]) {
    const inner = body[k];
    if (isObj(inner) && Array.isArray(inner.entry)) return inner.entry.filter(isObj);
  }
  // Un "value" suelto (algunos proveedores lo reenvían así).
  if (isObj(body.value) && typeof body.field === "string") return [{ changes: [body] }];
  return [];
}

export function parsearWebhook(body: unknown): ResultadoParse {
  const out: ResultadoParse = { campos: [], mensajes: [], contactos: [], numeroNegocio: "", ignorados: 0 };
  const vistos = new Set<string>();

  for (const entry of encontrarEntries(body)) {
    const changes = Array.isArray(entry.changes) ? entry.changes.filter(isObj) : [];
    for (const change of changes) {
      const field = str(change.field);
      const value = isObj(change.value) ? change.value : null;
      if (!value) continue;
      if (field && !out.campos.includes(field)) out.campos.push(field);

      const meta = isObj(value.metadata) ? (value.metadata as Obj) : {};
      const negocio = digitosTelefono(str(meta.display_phone_number));
      if (negocio && !out.numeroNegocio) out.numeroNegocio = negocio;

      const nombres = new Map<string, string>();
      const contactos = Array.isArray(value.contacts) ? (value.contacts as unknown[]).filter(isObj) : [];
      for (const c of contactos) {
        const wa = digitosTelefono(str(c.wa_id));
        const nombre = str((c.profile as Obj | undefined)?.name).trim();
        if (wa && nombre) nombres.set(wa, nombre);
      }

      const push = (m: MensajeNormalizado | null) => {
        if (!m) { out.ignorados++; return; }
        if (vistos.has(m.waId)) return;
        vistos.add(m.waId);
        out.mensajes.push(m);
      };

      if (Array.isArray(value.statuses)) out.ignorados += value.statuses.length;

      // Agenda del móvil (coexistencia): el nombre con el que el equipo tiene
      // guardado a cada contacto. Es el que queremos enseñar en el CRM.
      if (Array.isArray(value.state_sync)) {
        for (const e of (value.state_sync as unknown[]).filter(isObj)) {
          if (str(e.type) !== "contact" || !isObj(e.contact)) continue;
          const c = e.contact as Obj;
          const tel = digitosTelefono(str(c.phone_number));
          if (!tel || (negocio && tel === negocio)) continue;
          const nombre = (str(c.full_name) || str(c.first_name)).trim();
          out.contactos.push({ telefono: tel, nombre, accion: str(e.action) === "remove" ? "remove" : "add" });
        }
      }

      // Mensajes de clientes (y, por si el proveedor mezcla, nuestros propios).
      if (Array.isArray(value.messages)) {
        for (const m of (value.messages as unknown[]).filter(isObj)) {
          push(extraerMensaje(m, { negocio, nombres, historial: false }));
        }
      }
      // Ecos de lo que contestamos desde la app WhatsApp Business.
      const ecos = Array.isArray(value.message_echoes) ? value.message_echoes : Array.isArray(value.echoes) ? value.echoes : [];
      for (const m of (ecos as unknown[]).filter(isObj)) {
        push(extraerMensaje(m, { negocio, direccion: "saliente", nombres, historial: false }));
      }
      // Historial sincronizado al vincular (hasta 6 meses).
      if (Array.isArray(value.history)) {
        for (const h of (value.history as unknown[]).filter(isObj)) {
          const threads = Array.isArray(h.threads) ? (h.threads as unknown[]).filter(isObj) : [];
          for (const t of threads) {
            const hilo = digitosTelefono(str(t.id));
            const msgs = Array.isArray(t.messages) ? (t.messages as unknown[]).filter(isObj) : [];
            for (const m of msgs) push(extraerMensaje(m, { negocio, telefonoHilo: hilo, nombres, historial: true }));
          }
          // Variante plana: history[].messages[] sin hilos.
          const planos = Array.isArray(h.messages) ? (h.messages as unknown[]).filter(isObj) : [];
          for (const m of planos) push(extraerMensaje(m, { negocio, nombres, historial: true }));
        }
      }
    }
  }
  return out;
}
