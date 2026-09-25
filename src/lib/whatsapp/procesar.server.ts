// ══════════════════════════════════════════════════════════════════════════
// Motor de la integración de WhatsApp (solo servidor, service_role).
//
// Coge las conversaciones con mensajes sin analizar, se las pasa a la IA y
// aplica estas REGLAS (deterministas, la IA solo extrae):
//
//   HACE SOLO (sin preguntar)
//   · Enlazar la conversación con el cliente cuando el teléfono coincide con
//     UN solo lead.
//   · Rellenar datos VACÍOS de la ficha (ciudad, provincia, email, dirección,
//     teléfono, nombre si no lo había).
//   · Dejar una nota en la ficha con las novedades del chat y el resumen.
//
//   NUNCA crea clientes: los crea el equipo (Rocío, Juan, Bea, Iñaki). Cuando
//   escribe alguien que no está en el CRM, deja la propuesta "crear cliente"
//   con los datos extraídos y los posibles duplicados (misma persona que
//   entró por el formulario web o por Instagram con otro teléfono).
//
//   PROPONE (el equipo acepta o rechaza desde /whatsapp)
//   · Crear el cliente (con candidatos a duplicado para enlazar en su lugar).
//   · Cambiar de etapa (nunca se mueve sola, ni hacia delante ni hacia atrás).
//   · Un dato distinto al que ya hay en la ficha.
//   · Crear o corregir un producto (medidas, tela, modelo).
//   · Con qué cliente enlazar cuando hay varios candidatos o coincide el
//     nombre/email pero no el teléfono (para no crear duplicados).
//   · Una tarea si Tiroriro se ha comprometido a algo concreto.
//   · "Nuevo encargo" si un cliente ya entregado pide otra cosa.
//
//   NO TOCA
//   · Pedidos (hitos, tapicero, entregas): eso es del equipo.
//   · Leads en Closed Won / Closed Lost: solo nota + tarea + nuevo encargo.
//   · Conversaciones descartadas a mano ("ignorada").
//
//   HISTORIAL (mensajes anteriores a conectar el CRM): solo enlaza por
//   teléfono, rellena vacíos y guarda el resumen. Ni crea clientes ni propone.
// ══════════════════════════════════════════════════════════════════════════

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { ETAPAS, RAZONES_PERDIDA_B2C, type Etapa } from "@/lib/types";
import { normalizeTipo, TIPO_LABEL, stripDiacritics, mismoTipo } from "@/lib/catalogo";
import { normTel, normEmail } from "@/lib/duplicados";
import { analizarConversacionIA, ErrorIA, type ContextoLead, type MensajeParaIA } from "./ia.server";
import { transcribirAudiosPendientes } from "./audio.server";
import { TIPOS_SIN_CONTENIDO } from "./parse";
import { claveTelefono, formatTelefonoWa, type AnalisisIA, type ProductoIA, type TipoPropuesta } from "./types";

type Row = Record<string, unknown>;
const s = (v: unknown): string => (v == null ? "" : String(v).trim());
const norm = (v: unknown): string => stripDiacritics(s(v)).toLowerCase().replace(/\s+/g, " ");

export interface InformeProceso {
  procesadas: number;
  creadas: number;
  vinculadas: number;
  propuestas: number;
  saltadas: number;
  audios: number;         // notas de voz transcritas en esta pasada
  errores: string[];
  detenido?: string;      // motivo por el que se paró antes de tiempo (429, 402…)
}

interface Cfg {
  activo: boolean;
  modelo: string;
  conectadoAt: string;
  vendedorDefecto: string;
}

interface LeadMin {
  id: string; nombre: string; telefono: string; email: string; ciudad: string; provincia: string;
  direccion: string; etapa: string; tipo: string; origen: string; createdAt: string;
}
interface ProductoMin { id: string; leadId: string; tipo: string; modelo: string; ancho: number | null; alto: number | null; fondo: number | null; tela: string; color: string; cantidad: number; precioUnitario: number }
interface PedidoMin { id: string; leadId: string; entregado: boolean; numero: number | null; estado: string }

interface Catalogo {
  leads: LeadMin[];
  productos: ProductoMin[];
  pedidos: PedidoMin[];
  tareasPendientes: Set<string>;
}

const CLAIM_SEG = 90;

// ── Utilidades de BD ────────────────────────────────────────────────────────
async function cargarConfig(): Promise<Cfg | null> {
  const { data } = await supabaseAdmin.from("whatsapp_config").select("*").eq("id", 1).maybeSingle();
  if (!data) return null;
  const r = data as Row;
  return { activo: r.activo !== false, modelo: s(r.modelo), conectadoAt: s(r.conectado_at), vendedorDefecto: s(r.vendedor_defecto) || "rocionavarreteurdiales98@gmail.com" };
}

async function anotarError(msg: string) {
  await supabaseAdmin.from("whatsapp_config").update({ ultimo_error: msg.slice(0, 1000), ultimo_error_at: new Date().toISOString() } as never).eq("id", 1);
}

async function cargarCatalogo(): Promise<Catalogo> {
  const [{ data: leads }, { data: productos }, { data: pedidos }, { data: tareas }] = await Promise.all([
    supabaseAdmin.from("leads").select("id, nombre, telefono, email, ciudad, provincia, direccion, etapa, tipo, origen, created_at"),
    supabaseAdmin.from("productos_lead").select("id, lead_id, tipo, modelo, ancho, alto, fondo, tela, color, cantidad, precio_unitario"),
    supabaseAdmin.from("pedidos").select("id, lead_id, entregado, numero, estado_pedido"),
    supabaseAdmin.from("tareas").select("lead_id").eq("completada", false),
  ]);
  return {
    leads: ((leads ?? []) as Row[]).map((r) => ({
      id: s(r.id), nombre: s(r.nombre), telefono: s(r.telefono), email: s(r.email), ciudad: s(r.ciudad),
      provincia: s(r.provincia), direccion: s(r.direccion), etapa: s(r.etapa), tipo: s(r.tipo) || "B2C", origen: s(r.origen), createdAt: s(r.created_at),
    })),
    productos: ((productos ?? []) as Row[]).map((r) => ({
      id: s(r.id), leadId: s(r.lead_id), tipo: s(r.tipo), modelo: s(r.modelo),
      ancho: r.ancho == null ? null : Number(r.ancho), alto: r.alto == null ? null : Number(r.alto), fondo: r.fondo == null ? null : Number(r.fondo),
      tela: s(r.tela), color: s(r.color), cantidad: Number(r.cantidad) || 1, precioUnitario: Number(r.precio_unitario) || 0,
    })),
    pedidos: ((pedidos ?? []) as Row[]).map((r) => ({ id: s(r.id), leadId: s(r.lead_id), entregado: !!r.entregado, numero: r.numero == null ? null : Number(r.numero), estado: s(r.estado_pedido) })),
    tareasPendientes: new Set(((tareas ?? []) as Row[]).map((r) => s(r.lead_id))),
  };
}

async function nota(leadId: string, contenido: string) {
  await supabaseAdmin.from("notas").insert({ lead_id: leadId, contenido: contenido.slice(0, 4000), usuario: "whatsapp" } as never);
}

async function proponer(conversacionId: string, leadId: string | null, tipo: TipoPropuesta, clave: string, payload: Record<string, unknown>, motivo: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from("whatsapp_propuestas")
    .upsert({ conversacion_id: conversacionId, lead_id: leadId, tipo, clave: clave.slice(0, 200), payload: payload as never, motivo: motivo.slice(0, 1500) } as never, { onConflict: "conversacion_id,clave", ignoreDuplicates: true })
    .select("id");
  if (error) throw new Error("No se pudo guardar la propuesta: " + error.message);
  return (data?.length ?? 0) > 0;
}

function hashCorto(texto: string): string {
  let h = 0;
  for (let i = 0; i < texto.length; i++) h = (h * 31 + texto.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

// ── Descripciones para el contexto de la IA ────────────────────────────────
function describirProducto(p: ProductoMin): string {
  const medidas = [p.ancho, p.alto, p.fondo].filter((n) => n != null).join("×");
  return [TIPO_LABEL[normalizeTipo(p.tipo) ?? "otro"], p.modelo, medidas ? `${medidas} cm` : "", p.tela ? `tela ${p.tela}` : "", p.color ? `color ${p.color}` : "", p.cantidad > 1 ? `×${p.cantidad}` : ""]
    .filter(Boolean).join(" · ");
}

function describirProductoIA(p: ProductoIA): string {
  const medidas = [p.ancho, p.alto, p.fondo].filter((n) => n != null).join("×");
  return [TIPO_LABEL[normalizeTipo(p.tipo) ?? "otro"], p.modelo, medidas ? `${medidas} cm` : "", p.tela ? `tela ${p.tela}` : "", p.color ? `color ${p.color}` : ""].filter(Boolean).join(" · ");
}

// ── Reglas ──────────────────────────────────────────────────────────────────
interface Resultado { auto: string[]; propuestas: number; creado: boolean; vinculado: boolean; estado: "nueva" | "vinculada" | "no_cliente"; leadId: string | null }

function idxEtapa(e: string): number { return (ETAPAS as readonly string[]).indexOf(e); }

// Posibles duplicados: misma persona que ya entró por otro canal (formulario
// web, Instagram…) con otro teléfono o sin él. Se busca por email exacto y por
// nombre parecido (mismo nombre completo, o mismo nombre y apellido aunque
// haya más palabras, o el nombre del chat contenido en el de la ficha).
function candidatosDuplicado(cat: Catalogo, nombres: string[], email: string, excluir: Set<string>): LeadMin[] {
  const em = normEmail(email);
  const claves = nombres.map(norm).filter((n) => n.length >= 3);
  const tokensDe = (n: string) => n.split(" ").filter((x) => x.length >= 3);
  return cat.leads.filter((l) => {
    if (excluir.has(l.id)) return false;
    if (em && em.includes("@") && normEmail(l.email) === em) return true;
    const ln = norm(l.nombre);
    if (!ln) return false;
    for (const n of claves) {
      if (ln === n) return true;
      const a = tokensDe(n), b = tokensDe(ln);
      if (a.length >= 2 && b.length >= 2 && a[0] === b[0] && a.some((x, i) => i > 0 && b.includes(x))) return true;
      if (n.length >= 8 && ln.includes(n)) return true;
    }
    return false;
  }).slice(0, 6);
}

async function rellenarVacios(lead: LeadMin, conv: Row, a: AnalisisIA, res: Resultado, propuestasPermitidas: boolean) {
  const patch: Record<string, unknown> = {};
  const nuevos: Record<string, string> = {
    ciudad: s(a.contacto.ciudad).slice(0, 100),
    provincia: s(a.contacto.provincia).slice(0, 100),
    email: s(a.contacto.email).slice(0, 254),
    direccion: s(a.contacto.direccion).slice(0, 300),
  };
  for (const [campo, nuevo] of Object.entries(nuevos)) {
    if (!nuevo) continue;
    const actual = (lead as unknown as Record<string, string>)[campo] ?? "";
    if (!actual.trim()) {
      patch[campo] = nuevo;
      res.auto.push(`${campo}: ${nuevo}`);
    } else if (propuestasPermitidas) {
      const iguales = campo === "email" ? normEmail(actual) === normEmail(nuevo) : norm(actual) === norm(nuevo) || norm(actual).includes(norm(nuevo)) || norm(nuevo).includes(norm(actual));
      if (!iguales) {
        const ok = await proponer(s(conv.id), lead.id, "actualizar_campo", `campo:${campo}:${hashCorto(norm(nuevo))}`, { campo, actual, nuevo }, `En el chat aparece «${nuevo}» y en la ficha hay «${actual}».`);
        if (ok) res.propuestas++;
      }
    }
  }
  // Nombre: solo si la ficha no tiene uno de verdad.
  // Nombre: el del chat y, si no, el de la agenda del móvil (nunca el número).
  const nombreIA = (s(a.contacto.nombre) || s(conv.nombre_wa)).slice(0, 200);
  const nombreFicha = lead.nombre.trim();
  const sinNombre = !nombreFicha || /^whatsapp\b/i.test(nombreFicha) || /^\+?[\d\s]+$/.test(nombreFicha);
  if (nombreIA && sinNombre) { patch.nombre = nombreIA; res.auto.push(`nombre: ${nombreIA}`); }
  else if (nombreIA && propuestasPermitidas && s(a.contacto.nombre) && !norm(nombreFicha).includes(norm(nombreIA)) && !norm(nombreIA).includes(norm(nombreFicha))) {
    const ok = await proponer(s(conv.id), lead.id, "actualizar_campo", `campo:nombre:${hashCorto(norm(nombreIA))}`, { campo: "nombre", actual: nombreFicha, nuevo: nombreIA }, "El nombre que da en el chat no coincide con el de la ficha.");
    if (ok) res.propuestas++;
  }
  // Teléfono: si la ficha no lo tenía (lead enlazado por nombre/email o creado desde la web).
  if (!lead.telefono.trim()) { patch.telefono = formatTelefonoWa(s(conv.telefono)); res.auto.push(`teléfono: ${patch.telefono}`); }
  if (!lead.origen.trim()) patch.origen = "WhatsApp";

  if (Object.keys(patch).length > 0) {
    const { error } = await supabaseAdmin.from("leads").update(patch as never).eq("id", lead.id);
    if (error) throw new Error("No se pudo actualizar la ficha: " + error.message);
  }
}

async function proponerEtapaYResto(lead: LeadMin, conv: Row, a: AnalisisIA, cat: Catalogo, res: Resultado) {
  const convId = s(conv.id);
  const pedidosLead = cat.pedidos.filter((p) => p.leadId === lead.id);
  const cerrado = lead.etapa === "Closed Won" || lead.etapa === "Closed Lost";

  // Etapa: solo hacia delante y solo en B2C (el pipeline B2B/colab tiene otras etapas).
  if (lead.tipo === "B2C" && a.etapa_sugerida && a.etapa_sugerida !== lead.etapa) {
    const cur = idxEtapa(lead.etapa), nue = idxEtapa(a.etapa_sugerida);
    const reabrir = lead.etapa === "Closed Lost" && (a.etapa_sugerida === "Negotiation" || a.etapa_sugerida === "Closed Won");
    if ((!cerrado && nue > cur) || reabrir) {
      const payload: Record<string, unknown> = { etapa: a.etapa_sugerida, desde: lead.etapa };
      if (a.etapa_sugerida === "Closed Lost") payload.razon = a.razon_perdida ?? RAZONES_PERDIDA_B2C[0];
      if (a.etapa_sugerida === "Closed Won" && a.venta_importe != null) payload.venta_importe = a.venta_importe;
      const ok = await proponer(convId, lead.id, "cambiar_etapa", `etapa:${a.etapa_sugerida}`, payload, a.etapa_motivo || a.resumen);
      if (ok) res.propuestas++;
    }
  }

  // Cliente ya entregado que pide otra cosa.
  if (a.nuevo_encargo && lead.etapa === "Closed Won" && pedidosLead.some((p) => p.entregado)) {
    const ok = await proponer(convId, lead.id, "nuevo_encargo", `nuevo_encargo:${new Date().toISOString().slice(0, 7)}`, { resumen: a.resumen }, a.resumen);
    if (ok) res.propuestas++;
  }

  // Productos: crear si no hay ninguno del tipo; corregir si cambian medidas/tela/modelo.
  if (!cerrado) {
    const prods = cat.productos.filter((p) => p.leadId === lead.id);
    for (const p of a.productos.slice(0, 6)) {
      const tipo = normalizeTipo(p.tipo) ?? "otro";
      const existente = prods.find((x) => mismoTipo(x.tipo, tipo));
      if (!existente) {
        if (!p.ancho && !p.alto && !p.tela && !p.modelo) continue; // demasiado vago para crear nada
        const ok = await proponer(convId, lead.id, "producto", `producto:crear:${tipo}:${p.ancho ?? ""}x${p.alto ?? ""}`, { accion: "crear", producto: p }, `En el chat se habla de: ${describirProductoIA(p)}. La ficha no tiene ningún ${TIPO_LABEL[tipo].toLowerCase()}.`);
        if (ok) res.propuestas++;
        continue;
      }
      const cambios: Record<string, { de: unknown; a: unknown }> = {};
      for (const k of ["ancho", "alto", "fondo"] as const) {
        const nuevo = p[k];
        if (nuevo == null || !Number.isFinite(Number(nuevo))) continue;
        const actual = existente[k];
        if (actual == null || Number(actual) !== Number(nuevo)) cambios[k] = { de: actual, a: Number(nuevo) };
      }
      const telaIA = s(p.tela);
      if (telaIA && norm(existente.tela) !== norm(telaIA) && !norm(existente.tela).includes(norm(telaIA)) && !norm(telaIA).includes(norm(existente.tela))) cambios.tela = { de: existente.tela, a: telaIA };
      const modeloIA = s(p.modelo);
      if (modeloIA && existente.modelo && norm(existente.modelo) !== norm(modeloIA) && !norm(existente.modelo).includes(norm(modeloIA))) cambios.modelo = { de: existente.modelo, a: modeloIA };
      if (modeloIA && !existente.modelo) cambios.modelo = { de: "", a: modeloIA };
      const colorIA = s(p.color);
      if (colorIA && !existente.color) cambios.color = { de: "", a: colorIA };
      if (Object.keys(cambios).length === 0) continue;
      const desc = Object.entries(cambios).map(([k, v]) => `${k}: ${v.de ?? "—"} → ${v.a}`).join(", ");
      const ok = await proponer(convId, lead.id, "producto", `producto:editar:${existente.id}:${hashCorto(desc)}`, { accion: "editar", productoId: existente.id, cambios, producto: p }, `En el chat el ${TIPO_LABEL[tipo].toLowerCase()} queda así: ${desc}.`);
      if (ok) res.propuestas++;
    }
  }

  // Tarea: compromiso concreto y sin tareas pendientes ya.
  const acc = a.siguiente_accion;
  if (acc?.descripcion?.trim() && !cat.tareasPendientes.has(lead.id)) {
    const desc = acc.descripcion.trim().slice(0, 200);
    if (!/^(responder|contestar|hacer seguimiento|seguimiento)\b/i.test(desc)) {
      const ok = await proponer(convId, lead.id, "tarea", `tarea:${hashCorto(norm(desc))}`, { descripcion: desc, fecha: acc.fecha ?? null }, "Compromiso que aparece en el chat.");
      if (ok) res.propuestas++;
    }
  }
}

async function notaDeNovedades(lead: LeadMin, conv: Row, a: AnalisisIA, res: Resultado, recienEnlazada: boolean): Promise<string | undefined> {
  const datos = (conv.datos && typeof conv.datos === "object" ? conv.datos : {}) as Record<string, unknown>;
  const lineas: string[] = [];
  if (recienEnlazada) lineas.push(`Conversación de WhatsApp enlazada (${formatTelefonoWa(s(conv.telefono))}). ${a.resumen}`.trim());
  for (const n of a.novedades) lineas.push(`• ${n}`);
  if (res.auto.length) lineas.push(`Datos rellenados desde el chat: ${res.auto.join(" · ")}`);
  if (lineas.length === 0) return undefined;
  const hash = hashCorto(lineas.join("\n"));
  if (s(datos.nota_hash) === hash) return hash;
  const fecha = new Date().toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" });
  await nota(lead.id, `📱 WhatsApp · ${fecha}\n${lineas.join("\n")}`);
  return hash;
}

async function aplicarAnalisis(conv: Row, a: AnalisisIA, cat: Catalogo, _cfg: Cfg, modo: "normal" | "historico"): Promise<Resultado> {
  const convId = s(conv.id);
  const estadoPrevio = (s(conv.estado) as Resultado["estado"]) || "nueva";
  const res: Resultado = {
    auto: [], propuestas: 0, creado: false, vinculado: false,
    // Si el cliente se borró (lead_id en null) la conversación vuelve a "nueva".
    estado: conv.lead_id ? "vinculada" : estadoPrevio === "vinculada" ? "nueva" : estadoPrevio,
    leadId: conv.lead_id ? s(conv.lead_id) : null,
  };
  const clave = claveTelefono(s(conv.telefono));
  let lead: LeadMin | null = res.leadId ? cat.leads.find((l) => l.id === res.leadId) ?? null : null;
  let recienEnlazada = false;

  // 1) Enlazar por teléfono (o crear) si aún no tiene cliente.
  if (!lead) {
    const porTel = clave.length >= 9 ? cat.leads.filter((l) => normTel(l.telefono) === clave) : [];
    if (porTel.length === 1) {
      lead = porTel[0];
      recienEnlazada = true;
    } else if (porTel.length > 1) {
      if (modo === "normal") {
        const ok = await proponer(convId, null, "vincular_lead", "vincular", {
          candidatos: porTel.map((l) => ({ id: l.id, nombre: l.nombre, etapa: l.etapa, ciudad: l.ciudad, telefono: l.telefono })),
          duplicados: true,
        }, `Hay ${porTel.length} clientes con este teléfono. Elige con cuál va (y revisa si son duplicados).`);
        if (ok) res.propuestas++;
      }
    } else if (!a.es_cliente) {
      res.estado = "no_cliente";
    } else if (modo === "normal") {
      // Nadie con este teléfono: NO se crea el cliente. Se propone crearlo,
      // con los posibles duplicados por nombre/email para enlazar en su lugar.
      const cands = candidatosDuplicado(cat, [s(a.contacto.nombre), s(conv.nombre_wa)], s(a.contacto.email), new Set());
      const nombre = s(a.contacto.nombre) || s(conv.nombre_wa);
      const ok = await proponer(convId, null, "crear_lead", "crear", {
        sugerido: {
          nombre, ciudad: s(a.contacto.ciudad), provincia: s(a.contacto.provincia), email: s(a.contacto.email), direccion: s(a.contacto.direccion),
          telefono: formatTelefonoWa(s(conv.telefono)),
        },
        productos: a.productos.slice(0, 6),
        candidatos: cands.map((l) => ({ id: l.id, nombre: l.nombre, etapa: l.etapa, ciudad: l.ciudad, telefono: l.telefono, origen: l.origen })),
      }, cands.length > 0
        ? `${nombre || "Esta persona"} no está en el CRM con este teléfono, pero hay ${cands.length === 1 ? "un cliente" : cands.length + " clientes"} con nombre o email parecido (puede haber entrado por la web o Instagram). Enlaza si es la misma persona; si no, créalo.`
        : `${nombre || "Esta persona"} escribe por WhatsApp y no está en el CRM. ${a.resumen}`);
      if (ok) res.propuestas++;
    }
  }

  if (!lead) {
    return res;
  }

  // 2) Vincular.
  if (recienEnlazada || res.leadId !== lead.id) {
    res.leadId = lead.id;
    res.vinculado = !res.creado;
  }
  res.estado = "vinculada";

  // 3) Rellenar vacíos (siempre) y proponer diferencias (solo modo normal).
  await rellenarVacios(lead, conv, a, res, modo === "normal" && !res.creado);

  // 4) Etapa, productos, tareas: solo modo normal y no en un cliente recién creado
  //    (sus productos ya se han creado con él).
  if (modo === "normal" && !res.creado) await proponerEtapaYResto(lead, conv, a, cat, res);

  // 5) Nota con novedades.
  const hash = await notaDeNovedades(lead, conv, a, res, recienEnlazada);
  if (hash) (conv as Record<string, unknown>).__nota_hash = hash;
  return res;
}

// ── Punto de entrada ────────────────────────────────────────────────────────
export async function procesarConversaciones(opts: { conversacionId?: string; forzar?: boolean; limite?: number; debounceSeg?: number } = {}): Promise<InformeProceso> {
  const informe: InformeProceso = { procesadas: 0, creadas: 0, vinculadas: 0, propuestas: 0, saltadas: 0, audios: 0, errores: [] };
  const cfg = await cargarConfig();
  if (!cfg) { informe.errores.push("Falta la fila de whatsapp_config"); return informe; }
  if (!cfg.activo && !opts.forzar) { informe.detenido = "Integración desactivada"; return informe; }

  // Audios primero: la transcripción entra como texto del mensaje y la IA la
  // lee en el análisis de abajo (si ya estaba analizada, vuelve a la cola).
  try {
    const au = await transcribirAudiosPendientes({ conversacionId: opts.conversacionId });
    informe.audios = au.transcritos;
    if (au.errores.length) { informe.errores.push(...au.errores); await anotarError(au.errores[au.errores.length - 1]); }
  } catch (e) {
    const msg = "Audio: " + (e instanceof Error ? e.message : String(e));
    informe.errores.push(msg);
    await anotarError(msg);
  }

  const ahora = Date.now();
  const debounce = Math.max(0, opts.debounceSeg ?? 120);
  let q = supabaseAdmin.from("whatsapp_conversaciones").select("*").neq("estado", "ignorada");
  if (opts.conversacionId) q = q.eq("id", opts.conversacionId);
  else q = q.lt("ultimo_mensaje_at", new Date(ahora - debounce * 1000).toISOString()).order("ultimo_mensaje_at", { ascending: false }).limit(300);
  const { data: filas, error: qErr } = await q;
  if (qErr) { informe.errores.push("No se pudieron leer las conversaciones: " + qErr.message); return informe; }

  const pendientes = ((filas ?? []) as Row[]).filter((c) => {
    if (opts.forzar) return true;
    const ult = s(c.ultimo_mensaje_at), hasta = s(c.analizado_hasta);
    if (!ult) return false;
    if (hasta && hasta >= ult) return false;
    const claim = s(c.ultimo_analisis_at);
    if (claim && Date.parse(claim) > ahora - CLAIM_SEG * 1000) return false; // otro proceso lo tiene
    return true;
  }).slice(0, Math.max(1, Math.min(opts.limite ?? 6, 25)));

  if (pendientes.length === 0) {
    await supabaseAdmin.from("whatsapp_config").update({ ultimo_proceso_at: new Date().toISOString() } as never).eq("id", 1);
    return informe;
  }

  const cat = await cargarCatalogo();
  const hoy = new Date().toISOString().slice(0, 10);

  for (const conv of pendientes) {
    const convId = s(conv.id);
    // Reclamar la conversación (evita que dos procesos analicen lo mismo).
    const { data: claim } = await supabaseAdmin
      .from("whatsapp_conversaciones")
      .update({ ultimo_analisis_at: new Date().toISOString() } as never)
      .eq("id", convId)
      .or(`ultimo_analisis_at.is.null,ultimo_analisis_at.lt.${new Date(ahora - CLAIM_SEG * 1000).toISOString().replace(/\.\d{3}Z$/, "Z")}`)
      .select("id");
    if (!opts.forzar && (!claim || claim.length === 0)) { informe.saltadas++; continue; }

    try {
      const { data: msgs } = await supabaseAdmin
        .from("whatsapp_mensajes")
        .select("direccion, texto, enviado_at, tipo")
        .eq("conversacion_id", convId)
        .order("enviado_at", { ascending: false })
        .limit(80);
      const mensajes: MensajeParaIA[] = ((msgs ?? []) as Row[]).reverse()
        // Sin los avisos de "mensaje no disponible/no soportado": no dicen nada
        // y, solos, hacían que la IA propusiera crear un cliente fantasma.
        .filter((m) => s(m.texto) && !TIPOS_SIN_CONTENIDO.includes(s(m.tipo)))
        .map((m) => ({ direccion: s(m.direccion) === "saliente" ? "saliente" : "entrante", texto: s(m.texto), enviadoAt: s(m.enviado_at) }));
      const ultimoAt = s(conv.ultimo_mensaje_at) || (mensajes.length ? mensajes[mensajes.length - 1].enviadoAt : new Date().toISOString());

      if (mensajes.length === 0) {
        const patch: Record<string, unknown> = { analizado_hasta: ultimoAt };
        if ((msgs ?? []).length > 0 && !conv.lead_id) patch.resumen = "Solo hay mensajes que WhatsApp no deja leer (mensajes temporales, borrados o de un tipo no compatible). No hay nada que proponer.";
        await supabaseAdmin.from("whatsapp_conversaciones").update(patch as never).eq("id", convId);
        continue;
      }

      // Historial: solo conversaciones que entraron por la sincronización de
      // historial y que no han tenido mensajes nuevos desde que se conectó.
      // (Comparar solo fechas fallaba: el webhook fija conectado_at con
      // milisegundos y el primer mensaje en vivo, con segundos, quedaba "antes".)
      const modo: "normal" | "historico" = s(conv.origen) === "historial" && (!cfg.conectadoAt || ultimoAt < cfg.conectadoAt) ? "historico" : "normal";

      let leadCtx: ContextoLead | null = null;
      const leadActual = conv.lead_id ? cat.leads.find((l) => l.id === s(conv.lead_id)) ?? null : null;
      if (leadActual) {
        const { data: notas } = await supabaseAdmin.from("notas").select("contenido").eq("lead_id", leadActual.id).order("created_at", { ascending: false }).limit(4);
        leadCtx = {
          nombre: leadActual.nombre, etapa: leadActual.etapa, ciudad: leadActual.ciudad, provincia: leadActual.provincia, email: leadActual.email, direccion: leadActual.direccion,
          productos: cat.productos.filter((p) => p.leadId === leadActual.id).map(describirProducto),
          pedidos: cat.pedidos.filter((p) => p.leadId === leadActual.id).map((p) => `Pedido ${p.numero ?? "s/n"} · ${p.estado || (p.entregado ? "Entregado" : "En curso")}`),
          notasRecientes: ((notas ?? []) as Row[]).map((n) => s(n.contenido).replace(/\s+/g, " ").slice(0, 200)),
        };
      }

      const analisis = await analizarConversacionIA({
        telefono: s(conv.telefono), nombreWa: s(conv.nombre_wa), mensajes, lead: leadCtx, modo, modelo: cfg.modelo, hoy,
      });

      const res = await aplicarAnalisis(conv, analisis, cat, cfg, modo);
      const datosPrevios = (conv.datos && typeof conv.datos === "object" ? conv.datos : {}) as Record<string, unknown>;
      const notaHash = s((conv as Record<string, unknown>).__nota_hash) || s(datosPrevios.nota_hash);
      await supabaseAdmin.from("whatsapp_conversaciones").update({
        lead_id: res.leadId,
        estado: res.estado,
        resumen: analisis.resumen,
        datos: { ...analisis, auto: res.auto, nota_hash: notaHash || undefined, modo } as never,
        analizado_hasta: ultimoAt,
        ultimo_analisis_at: new Date().toISOString(),
      } as never).eq("id", convId);

      informe.procesadas++;
      if (res.creado) informe.creadas++;
      if (res.vinculado) informe.vinculadas++;
      informe.propuestas += res.propuestas;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      informe.errores.push(`${convId.slice(0, 8)}: ${msg}`);
      await anotarError(msg);
      if (e instanceof ErrorIA && (e.status === 429 || e.status === 402)) { informe.detenido = msg; break; }
    }
  }

  await supabaseAdmin.from("whatsapp_config").update({ ultimo_proceso_at: new Date().toISOString(), ...(informe.errores.length === 0 ? { ultimo_error: null } : {}) } as never).eq("id", 1);
  return informe;
}
