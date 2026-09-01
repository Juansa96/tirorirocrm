import { useSyncExternalStore } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Lead, Tarea, Etapa, AuditEntry, Nota, Producto, Pedido, PedidoTela, CatalogoProducto, LeadFoto, Tapicero, TelaBiblioteca, PedidoArchivo } from "./types";
import { VENDEDORES, flujoPedido, normNombreTela, marcadoresTapicero, PASO_INICIADO, PASO_INICIADO_POR, PASO_CAMBIO, PASO_CAMBIO_DETALLE } from "./types";
import { pedidoPendiente } from "./money";
import { todayISO } from "./format";
import { normalizarColeccionTela, normalizeTipo, displayColeccionTela } from "./catalogo";
import { loadRemoteCatalog } from "./catalogo-remote";
import { refreshSignedUrls, signPath, signPaths } from "./storage-urls";
import { TELAS_WEB } from "./telas-web-data";



interface State {
  leads: Lead[];
  tareas: Tarea[];
  audit: AuditEntry[];
  notas: Nota[];
  productos: Producto[];
  pedidos: Pedido[];
  pedidoTelas: PedidoTela[];
  catalogo: CatalogoProducto[];
  tapiceros: Tapicero[];
  telasBiblioteca: TelaBiblioteca[];
  telasWeb: TelaBiblioteca[];
  pedidoArchivos: PedidoArchivo[];
  leadFotos: LeadFoto[];
  loaded: boolean;
  realtimeStatus: "connected" | "connecting" | "disconnected";
  remoteUpdateTimestamps: Record<string, number>;
  presenceEditors: Record<string, string[]>;
}

let state: State = {
  leads: [], tareas: [], audit: [], notas: [], productos: [], pedidos: [], pedidoTelas: [], catalogo: [], tapiceros: [], telasBiblioteca: [], telasWeb: [], pedidoArchivos: [], leadFotos: [],
  loaded: false, realtimeStatus: "connecting", remoteUpdateTimestamps: {}, presenceEditors: {},
};
const listeners = new Set<() => void>();

function emit() { listeners.forEach((l) => l()); }

// Suppressed leads: after a local write we ignore the next realtime echo for 4 seconds
const suppressedLeads = new Map<string, number>();
function suppressLead(id: string) { suppressedLeads.set(id, Date.now() + 4000); }
function isSuppressed(id: string): boolean {
  const until = suppressedLeads.get(id);
  if (!until) return false;
  if (Date.now() > until) { suppressedLeads.delete(id); return false; }
  return true;
}

function mapLead(r: Record<string, unknown>): Lead {
  return {
    id: r.id as string,
    nombre: (r.nombre as string) ?? "",
    email: (r.email as string) ?? "",
    telefono: (r.telefono as string) ?? "",
    ciudad: (r.ciudad as string) ?? "",
    provincia: (r.provincia as string) ?? "",
    producto: (r.producto as string) ?? "",
    vendedor: r.vendedor as string,
    etapa: r.etapa as Etapa,
    valor: Number(r.valor) || 0,
    origen: (r.origen as string) ?? "",
    redSocial: (r.red_social as string) ?? "",
    fechaHold: (r.fecha_hold as string) ?? "",
    valorProducto: Number(r.valor_producto) || 0,
    valorEnvio: Number(r.valor_envio) || 0,
    edad: (r.edad as string) ?? "",
    fechaCreacion: (r.created_at as string) ?? "",
    fechaEntradaEtapa: (r.fecha_entrada_etapa as string) ?? (r.created_at as string) ?? "",
    razonUrgencia: (r.razon_urgencia as string) ?? "",
    clienteTipo: (r.cliente_tipo as string) ?? "normal",
    etiquetas: Array.isArray(r.etiquetas) ? (r.etiquetas as string[]) : [],
    cobrado: Boolean(r.cobrado),
    fechaCobro: (r.fecha_cobro as string) ?? "",
    tipo: ((r.tipo as string) === "B2B" ? "B2B" : (r.tipo as string) === "INFLUENCER" ? "INFLUENCER" : "B2C"),
    seguidores: Number(r.seguidores) || 0,
    redPrincipal: (r.red_principal as string) ?? "",
    usuario: (r.usuario as string) ?? "",
    razonSocial: (r.razon_social as string) ?? "",
    nif: (r.nif as string) ?? "",
    contactoNombre: (r.contacto_nombre as string) ?? "",
    contactoApellidos: (r.contacto_apellidos as string) ?? "",
    contactoCargo: (r.contacto_cargo as string) ?? "",
    direccion: (r.direccion as string) ?? "",
    web: (r.web as string) ?? "",
    instagram: (r.instagram as string) ?? "",
    notasB2b: (r.notas_b2b as string) ?? "",
    asignados: Array.isArray(r.asignados) ? (r.asignados as string[]) : [],
    gclid: (r.gclid as string) ?? "",
    gbraid: (r.gbraid as string) ?? "",
    wbraid: (r.wbraid as string) ?? "",
    utmSource: (r.utm_source as string) ?? "",
    utmMedium: (r.utm_medium as string) ?? "",
    utmCampaign: (r.utm_campaign as string) ?? "",
    utmTerm: (r.utm_term as string) ?? "",
    fbclid: (r.fbclid as string) ?? "",
    landingPath: (r.landing_path as string) ?? "",
    ventaImporte: r.venta_importe === null || r.venta_importe === undefined ? null : Number(r.venta_importe),
    ventaFecha: (r.venta_fecha as string) ?? "",
  };
}


function mapLeadFoto(r: Record<string, unknown>): LeadFoto {
  return {
    id: r.id as string,
    leadId: r.lead_id as string,
    storagePath: r.storage_path as string,
    url: r.url as string,
    pie: (r.pie as string) ?? "",
    createdAt: (r.created_at as string) ?? "",
  };
}

function mapTarea(r: Record<string, unknown>): Tarea {
  return {
    id: r.id as string,
    leadId: r.lead_id as string,
    descripcion: r.descripcion as string,
    fecha: r.fecha as string,
    hora: (r.hora as string) ?? "",
    vendedor: r.vendedor as string,
    completada: !!(r.completada),
  };
}

function mapAudit(r: Record<string, unknown>): AuditEntry {
  return {
    id: r.id as string,
    tabla: r.tabla as string,
    leadId: (r.lead_id as string) ?? null,
    campo: r.campo as string,
    valorAnterior: (r.valor_anterior as string) ?? null,
    valorNuevo: (r.valor_nuevo as string) ?? null,
    usuario: (r.usuario as string) ?? null,
    createdAt: r.created_at as string,
  };
}

function mapNota(r: Record<string, unknown>): Nota {
  return {
    id: r.id as string,
    leadId: r.lead_id as string,
    contenido: r.contenido as string,
    usuario: (r.usuario as string) ?? "",
    createdAt: r.created_at as string,
  };
}

function mapProducto(r: Record<string, unknown>): Producto {
  return {
    id: r.id as string,
    leadId: r.lead_id as string,
    tipo: (r.tipo as string) ?? "",
    modelo: (r.modelo as string) ?? "",
    ancho: r.ancho != null ? Number(r.ancho) : null,
    alto: r.alto != null ? Number(r.alto) : null,
    fondo: r.fondo != null ? Number(r.fondo) : null,
    tela: (r.tela as string) ?? "",
    color: (r.color as string) ?? "",
    relleno: (r.relleno as string) ?? "",
    patas: (r.patas as string) ?? "",
    acabado: (r.acabado as string) ?? "",
    coleccionTela: (r.coleccion_tela as string) ?? "",
    cantidad: Number(r.cantidad) || 1,
    precioUnitario: Number(r.precio_unitario) || 0,
    notasProducto: (r.notas_producto as string) ?? "",
    createdAt: r.created_at as string,
    createdBy: (r.created_by as string) ?? "",
    caracteristicasConfirmadas: !!r.caracteristicas_confirmadas,
    fechaConfirmacion: (r.fecha_confirmacion as string) ?? "",
    pagado50: !!r.pagado_50,
  };
}

function mapPedido(r: Record<string, unknown>): Pedido {
  const pasos = (r.pasos_tapicero && typeof r.pasos_tapicero === "object" ? r.pasos_tapicero : {}) as Record<string, string>;
  const marc = marcadoresTapicero(pasos);
  return {
    id: r.id as string,
    numero: r.numero != null ? Number(r.numero) : null,
    numeroSufijo: (r.numero_sufijo as string) ?? "",
    productoLeadId: r.producto_lead_id as string,
    leadId: (r.lead_id as string) ?? "",
    clienteNombreLibre: (r.cliente_nombre_libre as string) ?? "",
    fechaCreacionPedido: (r.fecha_creacion_pedido as string) ?? "",
    diasPlazo: Number(r.dias_plazo) || 20,
    fechaLimite: (r.fecha_limite as string) ?? "",
    fechaEntregaReal: (r.fecha_entrega_real as string) ?? "",
    pagado50: !!r.pagado_50,
    creadoManualmente: !!r.creado_manualmente,
    estadoPedido: (r.estado_pedido as string) ?? "En proceso",
    telaPedida: !!r.tela_pedida,
    telaPedidaFecha: (r.tela_pedida_fecha as string) ?? "",
    telaRecibida: !!r.tela_recibida,
    telaRecibidaFecha: (r.tela_recibida_fecha as string) ?? "",
    estructuraHecha: !!r.estructura_hecha,
    estructuraHechaFecha: (r.estructura_hecha_fecha as string) ?? "",
    tapizadoHecho: !!r.tapizado_hecho,
    tapizadoHechoFecha: (r.tapizado_hecho_fecha as string) ?? "",
    entregado: !!r.entregado,
    entregadoFecha: (r.entregado_fecha as string) ?? "",
    solicitadoDaniel: !!r.solicitado_daniel,
    solicitadoDanielFecha: (r.solicitado_daniel_fecha as string) ?? "",
    enviarTelaDaniel: !!r.enviar_tela_daniel,
    enviarTelaDanielFecha: (r.enviar_tela_daniel_fecha as string) ?? "",
    recibirDaniel: !!r.recibir_daniel,
    recibirDanielFecha: (r.recibir_daniel_fecha as string) ?? "",
    terminadoDaniel: !!r.terminado_daniel,
    terminadoDanielFecha: (r.terminado_daniel_fecha as string) ?? "",
    enviadoDaniel: !!r.enviado_daniel,
    enviadoDanielFecha: (r.enviado_daniel_fecha as string) ?? "",
    pantallaHecha: !!r.pantalla_hecha,
    pantallaHechaFecha: (r.pantalla_hecha_fecha as string) ?? "",
    precio: Number(r.precio) || 0,
    precioConIva: r.precio_con_iva != null ? Number(r.precio_con_iva) : null,
    costeEnvio: Number(r.coste_envio) || 0,
    reserva: Number(r.reserva) || 0,
    pagadoCompleto: !!r.pagado_completo,
    factura: (r.factura as string) ?? "",
    notasPedido: (r.notas_pedido as string) ?? "",
    enviadoTapicero: !!r.enviado_tapicero,
    enviadoTapiceroFecha: (r.enviado_tapicero_fecha as string) ?? "",
    telaEstado: (r.tela_estado as string) ?? "pendiente",
    telaEstadoPor: (r.tela_estado_por as string) ?? "",
    telaEstadoFecha: (r.tela_estado_fecha as string) ?? "",
    iniciadoTapicero: marc.iniciado,
    iniciadoTapiceroPor: marc.iniciadoPor,
    iniciadoTapiceroFecha: marc.iniciadoFecha,
    terminadoTapicero: !!r.terminado_tapicero,
    terminadoTapiceroPor: (r.terminado_tapicero_por as string) ?? "",
    terminadoTapiceroFecha: (r.terminado_tapicero_fecha as string) ?? "",
    cambioTrasEnvio: marc.cambioTrasEnvio,
    cambioTrasEnvioFecha: marc.cambioTrasEnvioFecha,
    cambioTrasEnvioDetalle: marc.cambioTrasEnvioDetalle,
    montaje: (r.montaje as string) ?? "",
    ordenProduccion: r.orden_produccion != null ? Number(r.orden_produccion) : null,
    notaTapicero: (r.nota_tapicero as string) ?? "",
    fechaRecogida: (r.fecha_recogida as string) ?? "",
    clienteNombre: (r.cliente_nombre as string) ?? "",
    tapiceroId: (r.tapicero_id as string) ?? "",
    pasosTapicero: pasos,
    createdAt: (r.created_at as string) ?? "",
    updatedAt: (r.updated_at as string) ?? "",
    empresaId: (r.empresa_id as string) ?? "",
    esCanje: !!r.es_canje,
    formatos: Array.isArray(r.formatos) ? (r.formatos as string[]) : [],
    tipoColaboracion: (r.tipo_colaboracion as string) ?? "",
  };
}

function mapPedidoTela(r: Record<string, unknown>): PedidoTela {
  return {
    id: r.id as string,
    pedidoId: r.pedido_id as string,
    tipoTela: (r.tipo_tela as string) ?? "",
    nombreTela: (r.nombre_tela as string) ?? "",
    estado: (r.estado as string) ?? "Pedida",
    fechaRecibo: (r.fecha_recibo as string) ?? "",
    orden: Number(r.orden) || 0,
    createdAt: (r.created_at as string) ?? "",
    telaFotoUrl: (r.tela_foto_url as string) ?? "",
    telaBibliotecaId: (r.tela_biblioteca_id as string) ?? "",
    telaColeccion: (r.tela_coleccion as string) ?? "",
    mismaQueFrontal: !!r.misma_que_frontal,
  };
}

// Filas de tela a sembrar en pedido_telas al crear un pedido desde un producto.
// COPIA todas las telas que el producto ya tiene (frontal, lateral, vivo) para
// que NADA se pierda en la conversión cliente → pedido (ver punto 8). Usa los
// roles canónicos "Frontal"/"Lateral"/"Vivo" (los mismos que lee la ficha del
// tapicero), no los nombres antiguos de telasPorTipo. Solo siembra filas con
// contenido; la primera (Frontal) siempre existe para arrastrar la colección.
function telasSeedDeProducto(prod: Producto): Array<{ tipo_tela: string; nombre_tela: string; tela_coleccion: string | null; estado: string; orden: number }> {
  const tipo = normalizeTipo(prod.tipo);
  const rows: Array<{ tipo_tela: string; nombre_tela: string; tela_coleccion: string | null; orden: number }> = [];
  const frontalColeccion = prod.coleccionTela ? displayColeccionTela(prod.coleccionTela) : null;
  rows.push({ tipo_tela: "Frontal", nombre_tela: (prod.tela || "").trim(), tela_coleccion: frontalColeccion, orden: 0 });
  const push = (tipo_tela: string, nombre: string) => {
    const n = (nombre || "").trim();
    if (n) rows.push({ tipo_tela, nombre_tela: n, tela_coleccion: null, orden: rows.length });
  };
  if (tipo === "cabecero" || tipo === "banco" || tipo === "puf" || tipo === "otro") {
    push("Lateral", prod.color);   // color guarda la tela lateral en estos tipos
    push("Vivo", prod.relleno);    // relleno guarda la tela del vivo/ribete
  } else if (tipo === "cojin") {
    const p = prod.patas || "";
    if (/^ribete:\s*/i.test(p)) push("Vivo", p.replace(/^ribete:\s*/i, ""));
  }
  return rows.map((r) => ({ ...r, estado: "Pedida" }));
}

let currentUser: string | null = null;
export function setCurrentUser(email: string | null) { currentUser = email; }

// Presence channel (ephemeral — no DB table needed)
let presenceChannel: ReturnType<typeof supabase.channel> | null = null;

function syncPresence() {
  if (!presenceChannel) return;
  const raw = presenceChannel.presenceState<{ user: string; editing: string }>();
  const editors: Record<string, string[]> = {};
  for (const presences of Object.values(raw)) {
    for (const p of presences) {
      if (p.editing && p.user && p.user !== currentUser) {
        if (!editors[p.editing]) editors[p.editing] = [];
        editors[p.editing].push(p.user);
      }
    }
  }
  state = { ...state, presenceEditors: editors };
  emit();
}

let initStarted = false;
let realtimeChannel: ReturnType<typeof supabase.channel> | null = null;
async function init() {
  if (initStarted) return;
  initStarted = true;
  await refetchAll();

  realtimeChannel = supabase
    .channel("tirocrm-realtime")
    // ── LEADS: surgical update from payload, no full refetch ──────────
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "leads" }, (payload) => {
      const newLead = mapLead(payload.new as Record<string, unknown>);
      if (state.leads.find((l) => l.id === newLead.id)) return;
      state = { ...state, leads: [newLead, ...state.leads] };
      emit();
      // Notify team about externally-created leads (formulario web)
      const createdBy = (payload.new as Record<string, unknown>).created_by as string | null | undefined;
      const isExternal =
        createdBy === "formulario-web" ||
        newLead.origen === "Formulario web";
      if (isExternal) {
        toast.info(`Nuevo lead del formulario web: ${newLead.nombre}`, {
          duration: 12000,
          action: { label: "Ver", onClick: () => { window.location.assign(`/clientes/${newLead.id}`); } },
        });
      }
    })
    .on("postgres_changes", { event: "UPDATE", schema: "public", table: "leads" }, (payload) => {
      const updated = mapLead(payload.new as Record<string, unknown>);
      if (!isSuppressed(updated.id)) {
        // Mark as a remote update for conflict detection in open lead views
        state = {
          ...state,
          leads: state.leads.map((l) => l.id === updated.id ? updated : l),
          remoteUpdateTimestamps: { ...state.remoteUpdateTimestamps, [updated.id]: Date.now() },
        };
      } else {
        state = { ...state, leads: state.leads.map((l) => l.id === updated.id ? updated : l) };
      }
      emit();
    })
    .on("postgres_changes", { event: "DELETE", schema: "public", table: "leads" }, (payload) => {
      const id = (payload.old as Record<string, unknown>).id as string;
      state = { ...state, leads: state.leads.filter((l) => l.id !== id) };
      emit();
    })
    // ── TAREAS: surgical ──────────────────────────────────────────────
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "tareas" }, (payload) => {
      const t = mapTarea(payload.new as Record<string, unknown>);
      if (!state.tareas.find((x) => x.id === t.id)) {
        state = { ...state, tareas: [...state.tareas, t].sort((a, b) => a.fecha.localeCompare(b.fecha)) };
        emit();
      }
    })
    .on("postgres_changes", { event: "UPDATE", schema: "public", table: "tareas" }, (payload) => {
      const t = mapTarea(payload.new as Record<string, unknown>);
      state = { ...state, tareas: state.tareas.map((x) => x.id === t.id ? t : x) };
      emit();
    })
    .on("postgres_changes", { event: "DELETE", schema: "public", table: "tareas" }, (payload) => {
      const id = (payload.old as Record<string, unknown>).id as string;
      state = { ...state, tareas: state.tareas.filter((t) => t.id !== id) };
      emit();
    })
    // ── AUDIT LOG: append-only from realtime, never delete ────────────
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "audit_log" }, (payload) => {
      const a = mapAudit(payload.new as Record<string, unknown>);
      if (!state.audit.find((x) => x.id === a.id)) {
        state = { ...state, audit: [a, ...state.audit] };
        emit();
      }
    })
    // ── NOTAS: surgical ───────────────────────────────────────────────
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "notas" }, (payload) => {
      const n = mapNota(payload.new as Record<string, unknown>);
      if (!state.notas.find((x) => x.id === n.id)) {
        state = { ...state, notas: [n, ...state.notas] };
        emit();
      }
    })
    .on("postgres_changes", { event: "UPDATE", schema: "public", table: "notas" }, (payload) => {
      const n = mapNota(payload.new as Record<string, unknown>);
      state = { ...state, notas: state.notas.map((x) => x.id === n.id ? n : x) };
      emit();
    })
    .on("postgres_changes", { event: "DELETE", schema: "public", table: "notas" }, (payload) => {
      const id = (payload.old as Record<string, unknown>).id as string;
      state = { ...state, notas: state.notas.filter((n) => n.id !== id) };
      emit();
    })
    // ── PRODUCTOS: surgical ───────────────────────────────────────────
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "productos_lead" }, (payload) => {
      const p = mapProducto(payload.new as Record<string, unknown>);
      if (!state.productos.find((x) => x.id === p.id)) {
        state = { ...state, productos: [...state.productos, p] };
        emit();
      }
    })
    .on("postgres_changes", { event: "UPDATE", schema: "public", table: "productos_lead" }, (payload) => {
      const p = mapProducto(payload.new as Record<string, unknown>);
      state = { ...state, productos: state.productos.map((x) => x.id === p.id ? p : x) };
      emit();
    })
    .on("postgres_changes", { event: "DELETE", schema: "public", table: "productos_lead" }, (payload) => {
      const id = (payload.old as Record<string, unknown>).id as string;
      state = { ...state, productos: state.productos.filter((p) => p.id !== id) };
      emit();
    })
    // ── PEDIDOS: surgical ─────────────────────────────────────────────
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "pedidos" }, (payload) => {
      const p = mapPedido(payload.new as Record<string, unknown>);
      if (!state.pedidos.find((x) => x.id === p.id)) {
        state = { ...state, pedidos: [...state.pedidos, p] };
        emit();
      }
    })
    .on("postgres_changes", { event: "UPDATE", schema: "public", table: "pedidos" }, (payload) => {
      const p = mapPedido(payload.new as Record<string, unknown>);
      state = { ...state, pedidos: state.pedidos.map((x) => x.id === p.id ? p : x) };
      emit();
    })
    .on("postgres_changes", { event: "DELETE", schema: "public", table: "pedidos" }, (payload) => {
      const id = (payload.old as Record<string, unknown>).id as string;
      state = { ...state, pedidos: state.pedidos.filter((p) => p.id !== id) };
      emit();
    })
    // ── PEDIDO_TELAS: surgical ────────────────────────────────────────
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "pedido_telas" }, (payload) => {
      const t = mapPedidoTela(payload.new as Record<string, unknown>);
      if (!state.pedidoTelas.find((x) => x.id === t.id)) {
        state = { ...state, pedidoTelas: [...state.pedidoTelas, t] };
        emit();
      }
    })
    .on("postgres_changes", { event: "UPDATE", schema: "public", table: "pedido_telas" }, (payload) => {
      const t = mapPedidoTela(payload.new as Record<string, unknown>);
      state = { ...state, pedidoTelas: state.pedidoTelas.map((x) => x.id === t.id ? t : x) };
      emit();
    })
    .on("postgres_changes", { event: "DELETE", schema: "public", table: "pedido_telas" }, (payload) => {
      const id = (payload.old as Record<string, unknown>).id as string;
      state = { ...state, pedidoTelas: state.pedidoTelas.filter((t) => t.id !== id) };
      emit();
    })
    .subscribe((status) => {
      const next: State["realtimeStatus"] =
        status === "SUBSCRIBED" ? "connected" :
        status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED" ? "disconnected" :
        "connecting";
      state = { ...state, realtimeStatus: next };
      emit();
    });


  // Presence channel: shows who else is viewing the same lead in real time
  presenceChannel = supabase.channel("tirocrm-presence");
  presenceChannel
    .on("presence", { event: "sync" }, syncPresence)
    .on("presence", { event: "join" }, syncPresence)
    .on("presence", { event: "leave" }, syncPresence)
    .subscribe(async (status) => {
      if (status === "SUBSCRIBED" && currentUser) {
        await presenceChannel!.track({ user: currentUser, editing: "" });
      }
    });
}

async function refetchLeads() {
  const { data, error } = await supabase.from("leads").select("*").order("created_at", { ascending: false });
  if (!error && data) { state = { ...state, leads: data.map(mapLead) }; emit(); }
}
async function refetchTareas() {
  const { data, error } = await supabase.from("tareas").select("*").order("fecha", { ascending: true });
  if (!error && data) { state = { ...state, tareas: data.map(mapTarea) }; emit(); }
}
async function refetchAudit() {
  const { data, error } = await supabase.from("audit_log").select("*").order("created_at", { ascending: false }).limit(500);
  if (!error && data) { state = { ...state, audit: data.map(mapAudit) }; emit(); }
}
async function refetchNotas() {
  const { data, error } = await supabase.from("notas").select("*").order("created_at", { ascending: false });
  if (!error && data) { state = { ...state, notas: data.map(mapNota) }; emit(); }
}
async function refetchProductos() {
  const { data, error } = await supabase.from("productos_lead").select("*").order("created_at", { ascending: true });
  if (!error && data) { state = { ...state, productos: data.map(mapProducto) }; emit(); }
}
async function refetchPedidos() {
  const { data, error } = await supabase.from("pedidos").select("*").order("created_at", { ascending: false });
  if (!error && data) { state = { ...state, pedidos: (data as unknown as Record<string, unknown>[]).map(mapPedido) }; emit(); }
}
async function refetchPedidoTelas() {
  const { data, error } = await supabase.from("pedido_telas").select("*").order("orden", { ascending: true });
  if (!error && data) {
    const raw = data as unknown as Record<string, unknown>[];
    const firmadas = await refreshSignedUrls("telas", raw.map((r) => (r.tela_foto_url as string) ?? ""));
    const rows = raw.map(mapPedidoTela).map((t) => ({ ...t, telaFotoUrl: firmadas.get(t.telaFotoUrl) ?? t.telaFotoUrl }));
    state = { ...state, pedidoTelas: rows }; emit();
  }
}
async function refetchCatalogo() {
  const { data, error } = await supabase.from("catalogo_productos").select("*").order("tipo", { ascending: true }).order("orden", { ascending: true });
  if (!error && data) {
    const rows = (data as unknown as Record<string, unknown>[]).map((r): CatalogoProducto => ({
      id: r.id as string,
      tipo: (r.tipo as string) ?? "",
      modelo: (r.modelo as string) ?? "",
      descripcion: (r.descripcion as string) ?? "",
      precioDesde: Number(r.precio_desde) || 0,
      activo: r.activo !== false,
      orden: Number(r.orden) || 0,
    }));
    state = { ...state, catalogo: rows }; emit();
  }
}
async function refetchLeadFotos() {
  const { data, error } = await supabase.from("lead_fotos").select("*").order("created_at", { ascending: false });
  if (!error && data) { state = { ...state, leadFotos: (data as unknown as Record<string, unknown>[]).map(mapLeadFoto) }; emit(); }
}
async function refetchTapiceros() {
  const { data, error } = await supabase.from("tapiceros").select("*").order("orden", { ascending: true });
  if (!error && data) {
    const rows = (data as unknown as Record<string, unknown>[]).map((r): Tapicero => ({
      id: r.id as string,
      nombre: (r.nombre as string) ?? "",
      apellido: (r.apellido as string) ?? "",
      activo: r.activo !== false,
      orden: Number(r.orden) || 0,
      accessToken: (r.access_token as string) ?? "",
      accessTokenActivo: r.access_token_activo !== false,
      ocultaApellidos: r.oculta_apellidos === true,
    }));
    state = { ...state, tapiceros: rows }; emit();
  }
}
async function refetchTelasBiblioteca() {
  const { data, error } = await supabase.from("telas_biblioteca").select("*").order("nombre", { ascending: true });
  if (!error && data) {
    const raw = data as unknown as Record<string, unknown>[];
    // Bucket privado: se refirman las URLs guardadas (públicas antiguas o
    // firmadas caducadas) antes de mostrarlas.
    const firmadas = await refreshSignedUrls("telas", raw.map((r) => (r.foto_url as string) ?? ""));
    const rows = raw.map((r): TelaBiblioteca => {
      const url = (r.foto_url as string) ?? "";
      return {
        id: r.id as string,
        nombre: (r.nombre as string) ?? "",
        fotoUrl: firmadas.get(url) ?? url,
        coleccion: (r.coleccion as string) ?? "otra",
        origen: (r.origen as string) ?? "subida",
      };
    });
    state = { ...state, telasBiblioteca: rows }; emit();
  }
}
// Convierte un nombre normalizado ("arequipa beige") a un display bonito
// ("Arequipa Beige") para el catálogo empaquetado (que solo guarda la clave
// normalizada). El catálogo en vivo, si responde, trae el nombre real.
function titleCaseTela(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

// Filas base a partir del catálogo EMPAQUETADO (siempre disponible, sin red):
// así el selector de telas muestra todas las telas de la web con su foto al
// instante, sin depender de que /api/public/telas responda.
function telasWebEmpaquetadas(): TelaBiblioteca[] {
  return Object.entries(TELAS_WEB).map(([norm, v]) => ({
    id: "web:" + norm,
    nombre: titleCaseTela(norm),
    fotoUrl: v.foto,
    coleccion: v.coleccion || "basica",
    origen: "web",
  }));
}

// Telas publicadas por la web (nombre + foto), leídas por el proxy del CRM.
// Se siembra primero desde el catálogo empaquetado (para que aparezcan de
// inmediato con foto) y luego se enriquece/actualiza con el catálogo en vivo.
async function fetchTelasWeb() {
  // Semilla inmediata desde el catálogo empaquetado.
  const base = new Map<string, TelaBiblioteca>();
  for (const t of telasWebEmpaquetadas()) base.set(normNombreTela(t.nombre), t);
  state = { ...state, telasWeb: [...base.values()] }; emit();
  try {
    const res = await fetch("/api/public/telas", { cache: "no-cache" });
    if (!res.ok) return;
    const data = await res.json() as { telas?: Array<Record<string, unknown>> };
    // El catálogo en vivo pisa al empaquetado (nombre real + telas nuevas).
    for (const t of data.telas ?? []) {
      const nombre = String(t.nombre ?? "");
      const foto = String(t.foto ?? "");
      if (!nombre || !foto) continue;
      base.set(normNombreTela(nombre), {
        id: "web:" + String(t.id ?? nombre),
        nombre,
        fotoUrl: foto,
        coleccion: String(t.coleccion ?? "basica"),
        origen: "web",
      });
    }
    state = { ...state, telasWeb: [...base.values()] }; emit();
  } catch { /* la web no responde: quedan las telas empaquetadas + subidas */ }
}
async function refetchPedidoArchivos() {
  const { data, error } = await supabase.from("pedido_archivos").select("*").order("created_at", { ascending: false });
  if (!error && data) {
    const raw = data as unknown as Record<string, unknown>[];
    // Bucket privado: se firma la descarga a partir de la ruta guardada.
    const firmadas = await signPaths("pedido-archivos", raw.map((r) => (r.storage_path as string) ?? ""));
    const rows = raw.map((r): PedidoArchivo => {
      const path = (r.storage_path as string) ?? "";
      return {
        id: r.id as string,
        pedidoId: r.pedido_id as string,
        tipo: (r.tipo as string) ?? "",
        nombre: (r.nombre as string) ?? "",
        storagePath: path,
        url: firmadas.get(path) ?? ((r.url as string) ?? ""),
        subidoPor: (r.subido_por as string) ?? "",
        transportista: (r.transportista as string) ?? "",
        createdAt: (r.created_at as string) ?? "",
      };
    });
    state = { ...state, pedidoArchivos: rows }; emit();
  }
}
async function refetchAll() {
  // loadRemoteCatalog() aplica los precios de la web (fuente única, Fase 2)
  // sobre el catálogo local antes de marcar `loaded`. Nunca lanza: si la web
  // no responde, quedan los precios espejo locales.
  await Promise.all([refetchLeads(), refetchTareas(), refetchAudit(), refetchNotas(), refetchProductos(), refetchPedidos(), refetchPedidoTelas(), refetchCatalogo(), refetchTapiceros(), refetchTelasBiblioteca(), refetchPedidoArchivos(), fetchTelasWeb(), refetchLeadFotos(), loadRemoteCatalog()]);
  state = { ...state, loaded: true };
  emit();
}


function subscribe(cb: () => void) {
  listeners.add(cb);
  if (typeof window !== "undefined") void init();
  return () => { listeners.delete(cb); };
}





const SERVER: State = {
  leads: [], tareas: [], audit: [], notas: [], productos: [], pedidos: [], pedidoTelas: [], catalogo: [], tapiceros: [], telasBiblioteca: [], telasWeb: [], pedidoArchivos: [], leadFotos: [],
  loaded: false, realtimeStatus: "connecting", remoteUpdateTimestamps: {}, presenceEditors: {},
};
function getSnapshot(): State { return state; }
function getServerSnapshot(): State { return SERVER; }

export function useStore(): State {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

// Tear down realtime + presence subscriptions and reset in-memory state.
// Called on signOut so the next user starts clean and we don't leak channels.
export async function teardownStore() {
  try {
    if (realtimeChannel) { await supabase.removeChannel(realtimeChannel); realtimeChannel = null; }
    if (presenceChannel) { await supabase.removeChannel(presenceChannel); presenceChannel = null; }
  } catch { /* ignore */ }
  initStarted = false;
  state = {
    leads: [], tareas: [], audit: [], notas: [], productos: [], pedidos: [], pedidoTelas: [], catalogo: [], tapiceros: [], telasBiblioteca: [], telasWeb: [], pedidoArchivos: [], leadFotos: [],
    loaded: false, realtimeStatus: "connecting", remoteUpdateTimestamps: {}, presenceEditors: {},
  };
  emit();
}

async function syncLeadValorFromProductos(leadId: string) {
  const lead = state.leads.find((l) => l.id === leadId);
  if (!lead) return;
  // Regla de dinero: los leads mandan HASTA que existe un pedido. En cuanto hay
  // un pedido para este lead, manda `pedidos` (ver syncLeadFromPedidos) y este
  // sync por productos no debe pisar los valores.
  if (state.pedidos.some((p) => p.leadId === leadId)) return;
  const productos = state.productos.filter((p) => p.leadId === leadId);
  // Si no quedan productos, el valor de producto vuelve a 0 (antes se quedaba
  // "pegado" al precio del último producto borrado).
  const valorProducto = productos.reduce((acc, p) => acc + (p.precioUnitario || 0) * (p.cantidad || 1), 0);
  if (valorProducto === lead.valorProducto) return;
  const valor = valorProducto + lead.valorEnvio;
  state = {
    ...state,
    leads: state.leads.map((l) => l.id === leadId ? { ...l, valorProducto, valor } : l),
  };
  emit();
  suppressLead(leadId);
  await supabase.from("leads").update({ valor_producto: valorProducto, valor }).eq("id", leadId);
}

// Fuente de verdad del dinero: en cuanto hay pedidos, el lead refleja lo que
// dicen los pedidos (venta = producto+envío, y si todo está cobrado marca el
// lead como cobrado). Se llama tras cualquier alta/edición/borrado de pedido.
async function syncLeadFromPedidos(leadId: string | null | undefined) {
  if (!leadId) return;
  const lead = state.leads.find((l) => l.id === leadId);
  if (!lead) return;
  // Los pedidos de canje (colaboraciones de influencer) NO cuentan como venta.
  const peds = state.pedidos.filter((p) => p.leadId === leadId && !p.esCanje);
  if (peds.length === 0) return; // sin pedidos de venta, manda el lead
  const valorProducto = peds.reduce((s, p) => s + (p.precio || 0), 0);
  const valorEnvio = peds.reduce((s, p) => s + (p.costeEnvio || 0), 0);
  const valor = valorProducto + valorEnvio;
  const pendiente = peds.reduce((s, p) => s + pedidoPendiente(p), 0);
  const cobrado = valor > 0 && pendiente <= 0;
  const fechaCobro = cobrado ? (lead.fechaCobro || todayISO()) : "";

  const dbPatch: Record<string, unknown> = {};
  if (valorProducto !== lead.valorProducto) dbPatch.valor_producto = valorProducto;
  if (valorEnvio !== lead.valorEnvio) dbPatch.valor_envio = valorEnvio;
  if (valor !== lead.valor) dbPatch.valor = valor;
  if (cobrado !== lead.cobrado) { dbPatch.cobrado = cobrado; dbPatch.fecha_cobro = fechaCobro || null; }
  if (Object.keys(dbPatch).length === 0) return;

  state = {
    ...state,
    leads: state.leads.map((l) => l.id === leadId ? { ...l, valorProducto, valorEnvio, valor, cobrado, fechaCobro } : l),
  };
  emit();
  suppressLead(leadId);
  await supabase.from("leads").update(dbPatch as never).eq("id", leadId);
}

// Guarda contra recursión al sincronizar el precio entre producto y pedido
// (evita que producto→pedido dispare pedido→producto y viceversa).
let _syncingPrecio = false;

// Propaga el precio de un PRODUCTO a sus pedidos: precio del pedido = precio
// unitario × cantidad. Así, si cambias el precio en la ficha del producto, se
// actualiza en el/los pedido(s) y en el valor del cliente.
async function propagarPrecioProductoAPedidos(productoId: string, precioUnitario: number, cantidad: number) {
  if (_syncingPrecio) return;
  const total = Math.round((precioUnitario || 0) * (cantidad || 1) * 100) / 100;
  const afectados = state.pedidos.filter((p) => p.productoLeadId === productoId && (p.precio || 0) !== total);
  if (afectados.length === 0) return;
  _syncingPrecio = true;
  try {
    state = { ...state, pedidos: state.pedidos.map((p) => p.productoLeadId === productoId ? { ...p, precio: total } : p) };
    emit();
    await Promise.all(afectados.map((p) => supabase.from("pedidos").update({ precio: total } as never).eq("id", p.id)));
    for (const lid of new Set(afectados.map((p) => p.leadId).filter(Boolean))) await syncLeadFromPedidos(lid);
  } finally { _syncingPrecio = false; }
}

// Propaga el precio de un PEDIDO a su producto: precio unitario = precio del
// pedido ÷ cantidad. Así, si cambias el precio en el pedido, se refleja en la
// ficha del producto.
async function propagarPrecioPedidoAProducto(pedidoId: string) {
  if (_syncingPrecio) return;
  const ped = state.pedidos.find((p) => p.id === pedidoId);
  if (!ped) return;
  const prod = state.productos.find((pr) => pr.id === ped.productoLeadId);
  if (!prod) return;
  const cant = prod.cantidad || 1;
  const nuevoUnit = Math.round(((ped.precio || 0) / cant) * 100) / 100;
  if (prod.precioUnitario === nuevoUnit) return;
  _syncingPrecio = true;
  try {
    state = { ...state, productos: state.productos.map((p) => p.id === prod.id ? { ...p, precioUnitario: nuevoUnit } : p) };
    emit();
    await supabase.from("productos_lead").update({ precio_unitario: nuevoUnit } as never).eq("id", prod.id);
  } finally { _syncingPrecio = false; }
}

// Marca "cambio tras envío" en los pedidos indicados que ya estén en manos de
// un tapicero (asignado y sin entregar → visible en su panel). Sirve para que
// el tapicero se entere de que se ha cambiado algo por si ya lo había empezado.
// El marcador se guarda DENTRO de pasos_tapicero (columna que ya existe): no
// necesita ninguna migración. No molesta a pedidos sin tapicero ni entregados.
async function flagCambioPedidos(pedidoIds: string[], detalle: string) {
  const ids = new Set(pedidoIds);
  const afectados = state.pedidos.filter((p) => ids.has(p.id) && p.tapiceroId && !p.entregado);
  if (afectados.length === 0) return;
  const fecha = new Date().toISOString();
  // Se escribe pedido a pedido para fusionar en su pasos_tapicero sin pisar el
  // histórico de pasos ni el marcador de "iniciado".
  state = {
    ...state,
    pedidos: state.pedidos.map((p) => afectados.some((a) => a.id === p.id)
      ? { ...p, cambioTrasEnvio: true, cambioTrasEnvioFecha: fecha, cambioTrasEnvioDetalle: detalle,
          pasosTapicero: { ...(p.pasosTapicero || {}), [PASO_CAMBIO]: fecha, [PASO_CAMBIO_DETALLE]: detalle } }
      : p),
  };
  emit();
  await Promise.all(afectados.map((a) => {
    const pasos = { ...(a.pasosTapicero || {}), [PASO_CAMBIO]: fecha, [PASO_CAMBIO_DETALLE]: detalle };
    return supabase.from("pedidos").update({ pasos_tapicero: pasos } as never).eq("id", a.id);
  }));
}

// Campos del PEDIDO que, si cambian estando ya asignado a un tapicero, le
// afectan (cómo/cuándo fabricar o recoger) y por tanto disparan el aviso.
const CAMBIO_PEDIDO_LABELS: Partial<Record<keyof Pedido, string>> = {
  montaje: "montaje",
  notaTapicero: "indicaciones",
  fechaRecogida: "fecha de recogida",
  ordenProduccion: "orden de trabajo",
  diasPlazo: "plazo de entrega",
  fechaCreacionPedido: "plazo de entrega",
};

export const actions = {
  async addLead(
    input: Omit<Lead, "id" | "fechaCreacion" | "fechaEntradaEtapa" | "razonUrgencia"
      | "gclid" | "gbraid" | "wbraid" | "utmSource" | "utmMedium" | "utmCampaign"
      | "utmTerm" | "fbclid" | "landingPath" | "ventaImporte" | "ventaFecha">,
    firstTask?: { descripcion: string; fecha: string; hora?: string },
  ): Promise<Lead | null> {
    const { data, error } = await supabase
      .from("leads")
      .insert({
        nombre: input.nombre,
        email: input.email,
        telefono: input.telefono,
        ciudad: input.ciudad,
        provincia: input.provincia ?? null,
        producto: input.producto,
        vendedor: input.vendedor,
        etapa: input.etapa,
        valor: input.valor,
        origen: input.origen ?? "",
        red_social: input.redSocial ?? "",
        fecha_hold: input.fechaHold || null,
        valor_producto: input.valorProducto ?? 0,
        valor_envio: input.valorEnvio ?? 0,
        edad: input.edad ?? "",
        tipo: input.tipo ?? "B2C",
        razon_social: input.razonSocial ?? null,
        nif: input.nif ?? null,
        contacto_nombre: input.contactoNombre ?? null,
        contacto_apellidos: input.contactoApellidos ?? null,
        contacto_cargo: input.contactoCargo ?? null,
        direccion: input.direccion ?? null,
        web: input.web ?? null,
        instagram: input.instagram ?? null,
        notas_b2b: input.notasB2b ?? null,
        asignados: input.asignados ?? [],
        seguidores: input.seguidores ?? 0,
        red_principal: input.redPrincipal ?? null,
        usuario: input.usuario ?? null,
      } as never)
      .select()
      .single();
    if (error || !data) { toast.error("Error al crear el lead."); return null; }
    const lead = mapLead(data as Record<string, unknown>);
    suppressLead(lead.id);
    // Insert locally so the UI updates immediately. The realtime INSERT echo
    // is deduped in the handler (find by id), avoiding refetching 5 tables.
    if (!state.leads.find((l) => l.id === lead.id)) {
      state = { ...state, leads: [lead, ...state.leads] };
      emit();
    }
    if (firstTask?.descripcion.trim()) {
      await supabase.from("tareas").insert({
        lead_id: lead.id,
        descripcion: firstTask.descripcion,
        fecha: firstTask.fecha,
        hora: firstTask.hora ?? "",
        vendedor: lead.vendedor,
        completada: false,
      });
    }
    return lead;
  },

  async updateLead(id: string, patch: Partial<Lead>) {
    const prevLead = state.leads.find((l) => l.id === id);
    const prevState = state;
    const dbPatch: Record<string, unknown> = {};
    if (patch.nombre !== undefined) dbPatch.nombre = patch.nombre;
    if (patch.email !== undefined) dbPatch.email = patch.email;
    if (patch.telefono !== undefined) dbPatch.telefono = patch.telefono;
    if (patch.ciudad !== undefined) dbPatch.ciudad = patch.ciudad;
    if (patch.provincia !== undefined) dbPatch.provincia = patch.provincia || null;
    if (patch.producto !== undefined) dbPatch.producto = patch.producto;
    if (patch.vendedor !== undefined) dbPatch.vendedor = patch.vendedor;
    if (patch.etapa !== undefined) dbPatch.etapa = patch.etapa;
    if (patch.valor !== undefined) dbPatch.valor = patch.valor;
    if (patch.origen !== undefined) dbPatch.origen = patch.origen;
    if (patch.redSocial !== undefined) dbPatch.red_social = patch.redSocial;
    if (patch.fechaHold !== undefined) dbPatch.fecha_hold = patch.fechaHold || null;
    if (patch.razonUrgencia !== undefined) dbPatch.razon_urgencia = patch.razonUrgencia;
    if (patch.clienteTipo !== undefined) dbPatch.cliente_tipo = patch.clienteTipo;
    if (patch.etiquetas !== undefined) dbPatch.etiquetas = patch.etiquetas;
    if (patch.cobrado !== undefined) dbPatch.cobrado = patch.cobrado;
    if (patch.fechaCobro !== undefined) dbPatch.fecha_cobro = patch.fechaCobro || null;
    if (patch.tipo !== undefined) dbPatch.tipo = patch.tipo;
    if (patch.razonSocial !== undefined) dbPatch.razon_social = patch.razonSocial || null;
    if (patch.nif !== undefined) dbPatch.nif = patch.nif || null;
    if (patch.contactoNombre !== undefined) dbPatch.contacto_nombre = patch.contactoNombre || null;
    if (patch.contactoApellidos !== undefined) dbPatch.contacto_apellidos = patch.contactoApellidos || null;
    if (patch.contactoCargo !== undefined) dbPatch.contacto_cargo = patch.contactoCargo || null;
    if (patch.direccion !== undefined) dbPatch.direccion = patch.direccion || null;
    if (patch.web !== undefined) dbPatch.web = patch.web || null;
    if (patch.instagram !== undefined) dbPatch.instagram = patch.instagram || null;
    if (patch.notasB2b !== undefined) dbPatch.notas_b2b = patch.notasB2b || null;
    if (patch.asignados !== undefined) dbPatch.asignados = patch.asignados;
    if (patch.seguidores !== undefined) dbPatch.seguidores = patch.seguidores;
    if (patch.redPrincipal !== undefined) dbPatch.red_principal = patch.redPrincipal || null;
    if (patch.usuario !== undefined) dbPatch.usuario = patch.usuario || null;
    if (patch.gclid !== undefined) dbPatch.gclid = patch.gclid || null;
    if (patch.gbraid !== undefined) dbPatch.gbraid = patch.gbraid || null;
    if (patch.wbraid !== undefined) dbPatch.wbraid = patch.wbraid || null;
    if (patch.utmSource !== undefined) dbPatch.utm_source = patch.utmSource || null;
    if (patch.utmMedium !== undefined) dbPatch.utm_medium = patch.utmMedium || null;
    if (patch.utmCampaign !== undefined) dbPatch.utm_campaign = patch.utmCampaign || null;
    if (patch.utmTerm !== undefined) dbPatch.utm_term = patch.utmTerm || null;
    if (patch.fbclid !== undefined) dbPatch.fbclid = patch.fbclid || null;
    if (patch.landingPath !== undefined) dbPatch.landing_path = patch.landingPath || null;
    if (patch.ventaImporte !== undefined) dbPatch.venta_importe = patch.ventaImporte ?? null;
    if (patch.ventaFecha !== undefined) dbPatch.venta_fecha = patch.ventaFecha || null;

    // edad se guarda por separado para que un fallo por columna inexistente
    // no impida guardar el resto de campos
    const edadValue = patch.edad;
    if (patch.valorProducto !== undefined) dbPatch.valor_producto = patch.valorProducto;
    if (patch.valorEnvio !== undefined) dbPatch.valor_envio = patch.valorEnvio;
    if ((patch.valorProducto !== undefined || patch.valorEnvio !== undefined) && prevLead) {
      const prod = patch.valorProducto ?? prevLead.valorProducto;
      const envio = patch.valorEnvio ?? prevLead.valorEnvio;
      dbPatch.valor = prod + envio;
      patch = { ...patch, valor: prod + envio };
    }
    // Optimistic update
    state = { ...state, leads: state.leads.map((l) => (l.id === id ? { ...l, ...patch } : l)) };
    emit();
    suppressLead(id);

    // Guardado principal (sin edad)
    if (Object.keys(dbPatch).length > 0) {
      const { error } = await supabase.from("leads").update(dbPatch as never).eq("id", id);
      if (error) {
        state = prevState;
        emit();
        toast.error("Error al guardar el cliente. Los cambios no se han guardado.");
        return;
      }
    }

    // Guardado de edad por separado — falla silenciosamente si la columna no existe aún
    if (edadValue !== undefined) {
      await supabase.from("leads").update({ edad: edadValue } as never).eq("id", id).then(({ error }) => {
        if (error) console.warn("[updateLead] edad column not available yet:", error.message);
      });
    }
    // El check "Cobrado" del CLIENTE NO arrastra sus pedidos (decisión del
    // cliente): marcar/desmarcar el cliente no toca el "pagado completo" de cada
    // pedido. El sentido pedido → cliente sí sigue: cuando TODOS los pedidos de
    // venta están cobrados, syncLeadFromPedidos marca el cliente como cobrado.
    // Historial: NO lo insertamos desde la app. La BD tiene un trigger
    // (log_lead_changes) que registra cada cambio con el nombre real de la
    // columna. Insertarlo también aquí duplicaba cada entrada (p. ej.
    // "redSocial" y "red_social"). Se deja solo el trigger.
  },

  async setLeadEtapa(id: string, etapa: Etapa) {
    await actions.updateLead(id, { etapa });
  },

  async deleteLead(id: string) {
    // Borrado con UNDO: ocultamos del UI inmediatamente y diferimos el delete real 5s
    const lead = state.leads.find((l) => l.id === id);
    if (!lead) return;
    const relProductos = state.productos.filter((p) => p.leadId === id);
    const relTareas = state.tareas.filter((t) => t.leadId === id);
    const relNotas = state.notas.filter((n) => n.leadId === id);
    state = {
      ...state,
      leads: state.leads.filter((l) => l.id !== id),
      productos: state.productos.filter((p) => p.leadId !== id),
      tareas: state.tareas.filter((t) => t.leadId !== id),
      notas: state.notas.filter((n) => n.leadId !== id),
    };
    emit();

    let cancelled = false;
    const timer = setTimeout(async () => {
      if (cancelled) return;
      const { error } = await supabase.from("leads").delete().eq("id", id);
      if (error) {
        // Restauramos si falla
        state = {
          ...state,
          leads: [lead, ...state.leads],
          productos: [...relProductos, ...state.productos],
          tareas: [...relTareas, ...state.tareas],
          notas: [...relNotas, ...state.notas],
        };
        emit();
        toast.error("Error al eliminar el cliente.");
      }
    }, 5000);

    toast(`Cliente "${lead.nombre}" eliminado`, {
      duration: 5000,
      action: {
        label: "Deshacer",
        onClick: () => {
          cancelled = true;
          clearTimeout(timer);
          state = {
            ...state,
            leads: [lead, ...state.leads.filter((l) => l.id !== id)],
            productos: [...relProductos, ...state.productos],
            tareas: [...relTareas, ...state.tareas],
            notas: [...relNotas, ...state.notas],
          };
          emit();
          toast.success("Cliente restaurado");
        },
      },
    });
  },

  // Fusiona dos clientes duplicados: reasigna TODO lo que cuelga del duplicado
  // (productos, pedidos, tareas, notas, fotos, historial) al que se conserva,
  // rellena en el conservado los campos de contacto que tuviera vacíos, y
  // borra el duplicado. Pensado para cuando el mismo cliente aparece 2 veces.
  async fusionarLeads(keepId: string, dropId: string) {
    if (keepId === dropId) return;
    const keep = state.leads.find((l) => l.id === keepId);
    const drop = state.leads.find((l) => l.id === dropId);
    if (!keep || !drop) { toast.error("No se encontró alguno de los clientes a fusionar."); return; }

    // 1) Reasignar todo lo relacionado del duplicado → cliente a conservar.
    const tablas = ["productos_lead", "pedidos", "tareas", "notas", "lead_fotos", "audit_log"] as const;
    for (const t of tablas) {
      const { error } = await supabase.from(t).update({ lead_id: keepId } as never).eq("lead_id", dropId);
      if (error) { toast.error("Error al fusionar: " + error.message); return; }
    }

    // 2) Rellenar en el conservado los campos de contacto que estén vacíos.
    const patch: Record<string, unknown> = {};
    const patchLocal: Partial<Lead> = {};
    const strFields: Array<[keyof Lead, string]> = [
      ["email", "email"], ["telefono", "telefono"], ["ciudad", "ciudad"], ["provincia", "provincia"],
      ["direccion", "direccion"], ["edad", "edad"], ["origen", "origen"], ["redSocial", "red_social"],
      ["instagram", "instagram"], ["web", "web"], ["nif", "nif"], ["razonSocial", "razon_social"],
      ["contactoNombre", "contacto_nombre"], ["contactoApellidos", "contacto_apellidos"], ["usuario", "usuario"],
    ];
    for (const [campo, col] of strFields) {
      const actual = ((keep[campo] as string) ?? "").trim();
      const otro = ((drop[campo] as string) ?? "").trim();
      if (!actual && otro) { patch[col] = otro; (patchLocal as Record<string, unknown>)[campo] = otro; }
    }
    const etqUnion = Array.from(new Set([...(keep.etiquetas ?? []), ...(drop.etiquetas ?? [])]));
    if (etqUnion.length !== (keep.etiquetas ?? []).length) { patch.etiquetas = etqUnion; patchLocal.etiquetas = etqUnion; }
    if (Object.keys(patch).length > 0) {
      suppressLead(keepId);
      await supabase.from("leads").update(patch as never).eq("id", keepId);
    }

    // 3) Borrar el duplicado.
    const { error: delErr } = await supabase.from("leads").delete().eq("id", dropId);
    if (delErr) { toast.error("Error al eliminar el duplicado: " + delErr.message); return; }

    // 4) Actualizar estado local.
    state = {
      ...state,
      leads: state.leads.filter((l) => l.id !== dropId).map((l) => (l.id === keepId ? { ...l, ...patchLocal } : l)),
      productos: state.productos.map((p) => (p.leadId === dropId ? { ...p, leadId: keepId } : p)),
      pedidos: state.pedidos.map((p) => (p.leadId === dropId ? { ...p, leadId: keepId } : p)),
      tareas: state.tareas.map((t) => (t.leadId === dropId ? { ...t, leadId: keepId } : t)),
      notas: state.notas.map((n) => (n.leadId === dropId ? { ...n, leadId: keepId } : n)),
      leadFotos: state.leadFotos.map((f) => (f.leadId === dropId ? { ...f, leadId: keepId } : f)),
      audit: state.audit.map((a) => (a.leadId === dropId ? { ...a, leadId: keepId } : a)),
    };
    emit();

    // 5) Recalcular valor y estado de cobro del cliente conservado.
    await syncLeadValorFromProductos(keepId);
    await syncLeadFromPedidos(keepId);
    toast.success("Clientes fusionados.");
  },

  // Cliente recurrente: crea un NUEVO lead con los datos reutilizables del
  // cliente de siempre (contacto, ciudad, vendedor…) pero empezando de cero en
  // el pipeline. El interés inicial y los importes van en blanco: es un encargo
  // nuevo. Se reconoce como recurrente porque comparte teléfono/email con un
  // lead que ya tuvo entregas (ver esClienteRecurrente en duplicados.ts).
  async nuevoEncargoRecurrente(origenId: string): Promise<Lead | null> {
    const origen = state.leads.find((l) => l.id === origenId);
    if (!origen) { toast.error("No se encontró el cliente."); return null; }
    const tipo = origen.tipo ?? "B2C";
    const etapaInicial: Etapa = tipo === "B2B" ? "Cliente potencial" : tipo === "INFLUENCER" ? "Contactado" : "Discovery";
    const nuevo = await actions.addLead({
      nombre: origen.nombre,
      email: origen.email,
      telefono: origen.telefono,
      ciudad: origen.ciudad,
      provincia: origen.provincia,
      producto: "",
      vendedor: origen.vendedor,
      etapa: etapaInicial,
      valor: 0,
      origen: origen.origen,
      redSocial: origen.redSocial,
      fechaHold: "",
      valorProducto: 0,
      valorEnvio: 0,
      edad: origen.edad,
      clienteTipo: origen.clienteTipo,
      etiquetas: [],
      cobrado: false,
      fechaCobro: "",
      tipo,
      razonSocial: origen.razonSocial,
      nif: origen.nif,
      contactoNombre: origen.contactoNombre,
      contactoApellidos: origen.contactoApellidos,
      contactoCargo: origen.contactoCargo,
      direccion: origen.direccion,
      web: origen.web,
      instagram: origen.instagram,
      notasB2b: "",
      asignados: origen.asignados ?? [],
      seguidores: origen.seguidores,
      redPrincipal: origen.redPrincipal,
      usuario: origen.usuario,
    });
    if (nuevo) toast.success("Nuevo encargo creado: empieza el pipeline desde el principio.");
    return nuevo;
  },

  async addTarea(input: Omit<Tarea, "id" | "completada">) {
    // Idempotencia: si ya existe una tarea idéntica creada en <10s, no insertar
    const recentDup = state.tareas.find((t) =>
      t.leadId === input.leadId &&
      t.descripcion.trim() === input.descripcion.trim() &&
      t.fecha === input.fecha &&
      (t.hora ?? "") === (input.hora ?? "")
    );
    if (recentDup) return;
    const tempId = crypto.randomUUID();
    const optimistic: Tarea = {
      id: tempId, leadId: input.leadId, descripcion: input.descripcion,
      fecha: input.fecha, hora: input.hora ?? "", vendedor: input.vendedor, completada: false,
    };
    state = { ...state, tareas: [...state.tareas, optimistic].sort((a, b) => a.fecha.localeCompare(b.fecha)) };
    emit();
    const { data, error } = await supabase.from("tareas").insert({
      lead_id: input.leadId,
      descripcion: input.descripcion,
      fecha: input.fecha,
      hora: input.hora ?? "",
      vendedor: input.vendedor,
      completada: false,
    }).select().single();
    if (error || !data) {
      state = { ...state, tareas: state.tareas.filter((t) => t.id !== tempId) };
      emit();
      toast.error("Error al crear la tarea.");
      return;
    }
    const real = mapTarea(data as Record<string, unknown>);
    state = { ...state, tareas: state.tareas.map((t) => t.id === tempId ? real : t) };
    emit();
  },

  async reconnectRealtime() {
    try {
      if (realtimeChannel) { await supabase.removeChannel(realtimeChannel); realtimeChannel = null; }
      if (presenceChannel) { await supabase.removeChannel(presenceChannel); presenceChannel = null; }
    } catch { /* ignore */ }
    initStarted = false;
    state = { ...state, realtimeStatus: "connecting" };
    emit();
    await init();
  },


  async updateTarea(id: string, patch: Partial<Pick<Tarea, "descripcion" | "fecha" | "hora" | "completada">>) {
    const prevState = state;
    state = { ...state, tareas: state.tareas.map((t) => (t.id === id ? { ...t, ...patch } : t)) };
    emit();
    const dbPatch: Record<string, unknown> = {};
    if (patch.descripcion !== undefined) dbPatch.descripcion = patch.descripcion;
    if (patch.fecha !== undefined) dbPatch.fecha = patch.fecha;
    if (patch.hora !== undefined) dbPatch.hora = patch.hora;
    if (patch.completada !== undefined) dbPatch.completada = patch.completada;
    const { error } = await supabase.from("tareas").update(dbPatch as never).eq("id", id);
    if (error) { state = prevState; emit(); toast.error("Error al actualizar la tarea."); }
  },

  async toggleTarea(id: string) {
    const t = state.tareas.find((x) => x.id === id);
    if (!t) return;
    await actions.updateTarea(id, { completada: !t.completada });
  },

  async deleteTarea(id: string) {
    const prevState = state;
    state = { ...state, tareas: state.tareas.filter((t) => t.id !== id) };
    emit();
    const { error } = await supabase.from("tareas").delete().eq("id", id);
    if (error) { state = prevState; emit(); toast.error("Error al eliminar la tarea."); }
  },

  async addNota(leadId: string, contenido: string): Promise<boolean> {
    // Use a real UUID so we can swap it with the DB UUID before realtime fires,
    // preventing the duplicate-note bug (realtime INSERT couldn't find the tempId
    // and added the note a second time).
    const tempId = crypto.randomUUID();
    const optimistic: Nota = { id: tempId, leadId, contenido, usuario: currentUser ?? "", createdAt: new Date().toISOString() };
    state = { ...state, notas: [optimistic, ...state.notas] };
    emit();
    const { data, error } = await supabase
      .from("notas")
      .insert({ lead_id: leadId, contenido, usuario: currentUser ?? "" })
      .select()
      .single();
    if (error) {
      state = { ...state, notas: state.notas.filter((n) => n.id !== tempId) };
      emit();
      toast.error("Error al guardar la nota.");
      return false;
    }
    // Replace temp entry with the real DB row — realtime dedup will now skip it
    const real = mapNota(data as Record<string, unknown>);
    state = { ...state, notas: state.notas.map((n) => (n.id === tempId ? real : n)) };
    emit();
    return true;
  },

  async updateNota(id: string, contenido: string) {
    const prevState = state;
    state = { ...state, notas: state.notas.map((n) => (n.id === id ? { ...n, contenido } : n)) };
    emit();
    const { error } = await supabase.from("notas").update({ contenido }).eq("id", id);
    if (error) { state = prevState; emit(); toast.error("Error al guardar la nota."); }
  },

  async deleteNota(id: string) {
    const prevState = state;
    state = { ...state, notas: state.notas.filter((n) => n.id !== id) };
    emit();
    const { error } = await supabase.from("notas").delete().eq("id", id);
    if (error) { state = prevState; emit(); toast.error("Error al eliminar la nota."); }
  },



  async addProducto(leadId: string, input: Omit<Producto, "id" | "leadId" | "createdAt" | "createdBy" | "caracteristicasConfirmadas" | "fechaConfirmacion" | "pagado50">) {
    const { data, error } = await supabase.from("productos_lead").insert({
      lead_id: leadId, tipo: input.tipo, modelo: input.modelo,
      ancho: input.ancho, alto: input.alto, fondo: input.fondo, tela: input.tela,
      color: input.color, relleno: input.relleno, patas: input.patas,
      acabado: input.acabado, coleccion_tela: normalizarColeccionTela(input.coleccionTela),
      cantidad: input.cantidad, precio_unitario: input.precioUnitario,
      notas_producto: input.notasProducto, created_by: currentUser ?? "",
    }).select().single();
    if (error) { toast.error("Error al guardar el producto."); return; }
    if (data) {
      const nuevo = mapProducto(data as Record<string, unknown>);
      if (!state.productos.find((x) => x.id === nuevo.id)) {
        state = { ...state, productos: [...state.productos, nuevo] };
        emit();
      }
    }
    await syncLeadValorFromProductos(leadId);
  },

  async updateProducto(id: string, input: Omit<Producto, "id" | "leadId" | "createdAt" | "createdBy" | "caracteristicasConfirmadas" | "fechaConfirmacion" | "pagado50">) {
    const prev = state.productos.find((p) => p.id === id);
    const prevState = state;
    if (prev) {
      const optimistic: Producto = { ...prev, ...input };
      state = { ...state, productos: state.productos.map((p) => p.id === id ? optimistic : p) };
      emit();
    }
    const { error } = await supabase.from("productos_lead").update({
      tipo: input.tipo, modelo: input.modelo, ancho: input.ancho, alto: input.alto, fondo: input.fondo,
      tela: input.tela, color: input.color, relleno: input.relleno, patas: input.patas,
      acabado: input.acabado, coleccion_tela: normalizarColeccionTela(input.coleccionTela),
      cantidad: input.cantidad, precio_unitario: input.precioUnitario,
      notas_producto: input.notasProducto,
    }).eq("id", id);
    if (error) { state = prevState; emit(); toast.error("Error al actualizar el producto."); return; }
    if (prev) await syncLeadValorFromProductos(prev.leadId);
    // Si cambió el precio o la cantidad, se propaga al/los pedido(s) del producto.
    if (prev && (prev.precioUnitario !== input.precioUnitario || prev.cantidad !== input.cantidad)) {
      await propagarPrecioProductoAPedidos(id, input.precioUnitario, input.cantidad);
    }
    // Aviso al tapicero si cambia algo del producto de un pedido ya asignado.
    if (prev) {
      const cambios: string[] = [];
      if (prev.ancho !== input.ancho || prev.alto !== input.alto || prev.fondo !== input.fondo) cambios.push("medidas");
      if (prev.tela !== input.tela || prev.color !== input.color || prev.coleccionTela !== input.coleccionTela) cambios.push("tela");
      if (prev.acabado !== input.acabado) cambios.push("acabado/vivo");
      if (prev.tipo !== input.tipo || prev.modelo !== input.modelo) cambios.push("modelo");
      if (prev.cantidad !== input.cantidad) cambios.push("cantidad");
      if (prev.patas !== input.patas || prev.relleno !== input.relleno) cambios.push("extras");
      if (prev.notasProducto !== input.notasProducto) cambios.push("notas");
      if (cambios.length > 0) {
        const ids = state.pedidos.filter((p) => p.productoLeadId === id).map((p) => p.id);
        await flagCambioPedidos(ids, "Cambió en el producto: " + cambios.join(", "));
      }
    }
  },

  // Fija el acabado (tipo de vivo: "", "vivo-simple", "vivo-doble") de un
  // producto de forma inmediata. Se usa desde la ficha del tapicero para poder
  // especificar el vivo del cabecero/banco/puf sin abrir el editor completo.
  async setProductoAcabado(id: string, acabado: string) {
    const prev = state.productos.find((p) => p.id === id);
    if (!prev) return;
    const prevState = state;
    state = { ...state, productos: state.productos.map((p) => p.id === id ? { ...p, acabado } : p) };
    emit();
    const { error } = await supabase.from("productos_lead").update({ acabado: acabado || null } as never).eq("id", id);
    if (error) { state = prevState; emit(); toast.error("No se pudo actualizar el acabado."); }
  },

  // Quita el tag "[posible-duplicado]" de las notas de un producto (falso
  // positivo tras revisarlo en la vista de duplicados).
  async desmarcarDuplicado(id: string) {
    const prod = state.productos.find((p) => p.id === id);
    if (!prod) return;
    const nuevasNotas = (prod.notasProducto || "")
      .replace(/\s*\[posible-duplicado\]\s*/gi, " ")
      .replace(/\s+/g, " ")
      .trim();
    const prevState = state;
    state = { ...state, productos: state.productos.map((p) => p.id === id ? { ...p, notasProducto: nuevasNotas } : p) };
    emit();
    const { error } = await supabase.from("productos_lead").update({ notas_producto: nuevasNotas } as never).eq("id", id);
    if (error) { state = prevState; emit(); toast.error("Error al actualizar el producto."); return; }
    toast.success("Marcado como no duplicado.");
  },

  async deleteProducto(id: string) {
    const prev = state.productos.find((p) => p.id === id);
    const prevState = state;
    state = { ...state, productos: state.productos.filter((p) => p.id !== id) };
    emit();
    const { error } = await supabase.from("productos_lead").delete().eq("id", id);
    if (error) { state = prevState; emit(); toast.error("Error al eliminar el producto."); return; }
    if (prev) await syncLeadValorFromProductos(prev.leadId);
  },

  // Presence: call on mount (leadId) and unmount (null) of the lead detail page
  trackEditing(leadId: string | null) {
    if (!presenceChannel || !currentUser) return;
    void presenceChannel.track({ user: currentUser, editing: leadId ?? "" });
  },

  // ── PRODUCTOS extra (confirmación / pago 50) ─────────────────────
  async updateProductoFlags(id: string, patch: { caracteristicasConfirmadas?: boolean; pagado50?: boolean }) {
    const prevState = state;
    state = {
      ...state,
      productos: state.productos.map((p) => p.id === id ? { ...p, ...patch } : p),
    };
    emit();
    const dbPatch: Record<string, unknown> = {};
    if (patch.caracteristicasConfirmadas !== undefined) dbPatch.caracteristicas_confirmadas = patch.caracteristicasConfirmadas;
    if (patch.pagado50 !== undefined) dbPatch.pagado_50 = patch.pagado50;
    const { error } = await supabase.from("productos_lead").update(dbPatch as never).eq("id", id);
    if (error) { state = prevState; emit(); toast.error("Error al actualizar el producto."); return; }
    // (Antes se creaba el pedido AUTOMÁTICAMENTE al marcar las 2 casillas. Se
    // quitó para dejar solo 2 formas claras de crear pedido: el botón «Crear
    // pedido» del producto y «Nuevo pedido» en Pedidos.)
  },

  // ── PEDIDOS ──────────────────────────────────────────────────────
  async crearPedido(opts: {
    productoId: string;
    diasPlazo?: number;
    pagado50: boolean;
    pagoTodoAlFinal: boolean;
    creadoManualmente: boolean;
    esCanje?: boolean;  // colaboración de influencer: se ve el precio pero no cuenta como ingreso
    silent?: boolean;   // no mostrar el toast por defecto (el caller pondrá el suyo)
  }): Promise<Pedido | null> {
    const prod = state.productos.find((p) => p.id === opts.productoId);
    if (!prod) { toast.error("Producto no encontrado."); return null; }
    if (!prod.caracteristicasConfirmadas) {
      toast.error("Confirma primero las características del producto.");
      return null;
    }
    const precio = (prod.precioUnitario || 0) * (prod.cantidad || 1);
    // "Pagado 50%" pre-rellena la reserva con la mitad del precio de PRODUCTO
    // (envío aparte). La reserva es editable después en el pedido.
    const reserva = opts.pagado50 ? Math.round((precio / 2) * 100) / 100 : 0;
    // Trasvasa el envío del lead al PRIMER pedido de venta para no perderlo
    // cuando `syncLeadFromPedidos` recalcule valorEnvio a partir de pedidos.
    // Si ya existe un pedido de venta, el envío ya vive allí.
    const leadDelPedido = state.leads.find((l) => l.id === prod.leadId);
    const yaHayPedidoVenta = state.pedidos.some((p) => p.leadId === prod.leadId && !p.esCanje);
    const costeEnvioInicial = !opts.esCanje && !yaHayPedidoVenta ? (leadDelPedido?.valorEnvio || 0) : 0;
    const { data, error } = await supabase.from("pedidos").insert({
      producto_lead_id: prod.id,
      lead_id: prod.leadId,
      cliente_nombre: leadDelPedido?.nombre ?? "",
      dias_plazo: opts.diasPlazo ?? 20,
      pagado_50: opts.pagado50,
      creado_manualmente: opts.creadoManualmente,
      precio,
      reserva,
      coste_envio: costeEnvioInicial,
      es_canje: !!opts.esCanje,
    } as never).select().single();
    if (error || !data) { toast.error("Error al crear el pedido."); return null; }
    const pedido = mapPedido(data as Record<string, unknown>);
    if (!state.pedidos.find((p) => p.id === pedido.id)) {
      state = { ...state, pedidos: [pedido, ...state.pedidos] };
      emit();
    }
    // Copia TODAS las telas del producto (frontal + lateral + vivo) para no
    // perder nada en la conversión cliente → pedido (punto 8).
    const rows = telasSeedDeProducto(prod).map((r) => ({ ...r, pedido_id: pedido.id }));
    if (rows.length > 0) {
      await supabase.from("pedido_telas").insert(rows);
    }
    await syncLeadFromPedidos(prod.leadId);
    if (!opts.silent) toast.success("Pedido creado.");
    return pedido;
  },

  // Creación manual: no exige características confirmadas ni pagos.
  // Acepta lead existente o nombre libre, y producto existente o nuevo.
  async crearPedidoManual(opts: {
    leadId: string | null;
    clienteNombreLibre?: string;
    productoId?: string | null;
    nuevoProducto?: { tipo: string; modelo: string };
    diasPlazo: number;
    precio: number;
    reserva: number;
    costeEnvio: number;
    fechaCreacion?: string;
    empresaId?: string | null;
    esCanje?: boolean;
    formatos?: string[];
    tipoColaboracion?: string;
  }): Promise<Pedido | null> {
    let productoId = opts.productoId ?? null;
    let tipoProd = "";
    let telaSeed = "";
    let prodExistente: Producto | null = null;
    if (!productoId && opts.nuevoProducto) {
      const { data: pd, error: pe } = await supabase.from("productos_lead").insert({
        lead_id: opts.leadId,
        tipo: opts.nuevoProducto.tipo,
        modelo: opts.nuevoProducto.modelo,
        cantidad: 1,
        precio_unitario: opts.precio,
        caracteristicas_confirmadas: true,
        created_by: currentUser ?? "manual",
      }).select().single();
      if (pe || !pd) { toast.error("Error al crear el producto."); return null; }
      productoId = (pd as Record<string, unknown>).id as string;
      tipoProd = opts.nuevoProducto.tipo;
    } else if (productoId) {
      const existing = state.productos.find((p) => p.id === productoId);
      tipoProd = existing?.tipo ?? "";
      telaSeed = existing?.tela ?? "";
      prodExistente = existing ?? null;
    }
    if (!productoId) { toast.error("Selecciona o crea un producto."); return null; }

    const insertPedido: Record<string, unknown> = {
      producto_lead_id: productoId,
      lead_id: opts.leadId,
      cliente_nombre_libre: opts.clienteNombreLibre ?? "",
      cliente_nombre: opts.clienteNombreLibre || state.leads.find((l) => l.id === opts.leadId)?.nombre || "",
      dias_plazo: opts.diasPlazo,
      precio: opts.precio,
      reserva: opts.reserva,
      coste_envio: opts.costeEnvio,
      creado_manualmente: true,
    };
    if (opts.fechaCreacion) insertPedido.fecha_creacion_pedido = opts.fechaCreacion;
    if (opts.empresaId) insertPedido.empresa_id = opts.empresaId;
    if (opts.esCanje) insertPedido.es_canje = true;
    if (opts.formatos && opts.formatos.length > 0) insertPedido.formatos = opts.formatos;
    if (opts.tipoColaboracion) insertPedido.tipo_colaboracion = opts.tipoColaboracion;

    const { data, error } = await supabase.from("pedidos").insert(insertPedido).select().single();
    if (error || !data) { toast.error("Error al crear el pedido."); return null; }
    const pedido = mapPedido(data as Record<string, unknown>);
    if (!state.pedidos.find((p) => p.id === pedido.id)) {
      state = { ...state, pedidos: [pedido, ...state.pedidos] };
      emit();
    }
    // Si el pedido parte de un producto existente, copia todas sus telas
    // (frontal + lateral + vivo). Si es un producto nuevo mínimo, siembra solo
    // el frontal con la tela indicada.
    const rows = prodExistente
      ? telasSeedDeProducto(prodExistente).map((r) => ({ ...r, pedido_id: pedido.id }))
      : (telaSeed || tipoProd)
        ? [{ pedido_id: pedido.id, tipo_tela: "Frontal", nombre_tela: telaSeed, tela_coleccion: null, estado: "Pedida", orden: 0 }]
        : [];
    if (rows.length > 0) {
      await supabase.from("pedido_telas").insert(rows);
    }
    await syncLeadFromPedidos(opts.leadId);
    toast.success("Pedido creado.");
    return pedido;
  },

  async updatePedido(id: string, patch: Partial<Pedido>) {
    const prevState = state;
    const actual = state.pedidos.find((p) => p.id === id);
    const leadId = actual?.leadId;
    // Aviso de cambio tras envío: si el pedido ya está en manos de un tapicero
    // y cambia algún campo que le afecta, se marca (dentro de pasos_tapicero)
    // para que lo revise. No se dispara si el patch ya toca pasos_tapicero
    // (reasignación / marcado de pasos), para no pisarlo.
    if (actual?.tapiceroId && !actual.entregado && !("pasosTapicero" in patch)) {
      const labels = [...new Set(
        (Object.keys(patch) as (keyof Pedido)[])
          .filter((k) => CAMBIO_PEDIDO_LABELS[k] && actual[k] !== patch[k])
          .map((k) => CAMBIO_PEDIDO_LABELS[k]!),
      )];
      if (labels.length > 0) {
        patch = {
          ...patch,
          pasosTapicero: {
            ...(actual.pasosTapicero || {}),
            [PASO_CAMBIO]: new Date().toISOString(),
            [PASO_CAMBIO_DETALLE]: "Cambió: " + labels.join(", "),
          },
        };
      }
    }
    state = { ...state, pedidos: state.pedidos.map((p) => p.id === id ? { ...p, ...patch } : p) };
    emit();
    const dbPatch: Record<string, unknown> = {};
    const map: Record<string, string> = {
      numero: "numero",
      numeroSufijo: "numero_sufijo",
      fechaCreacionPedido: "fecha_creacion_pedido",
      diasPlazo: "dias_plazo",
      fechaEntregaReal: "fecha_entrega_real",
      pagado50: "pagado_50",
      telaPedida: "tela_pedida",
      telaPedidaFecha: "tela_pedida_fecha",
      telaRecibida: "tela_recibida",
      telaRecibidaFecha: "tela_recibida_fecha",
      estructuraHecha: "estructura_hecha",
      estructuraHechaFecha: "estructura_hecha_fecha",
      tapizadoHecho: "tapizado_hecho",
      tapizadoHechoFecha: "tapizado_hecho_fecha",
      entregado: "entregado",
      entregadoFecha: "entregado_fecha",
      solicitadoDaniel: "solicitado_daniel",
      solicitadoDanielFecha: "solicitado_daniel_fecha",
      enviarTelaDaniel: "enviar_tela_daniel",
      enviarTelaDanielFecha: "enviar_tela_daniel_fecha",
      recibirDaniel: "recibir_daniel",
      recibirDanielFecha: "recibir_daniel_fecha",
      terminadoDaniel: "terminado_daniel",
      terminadoDanielFecha: "terminado_daniel_fecha",
      enviadoDaniel: "enviado_daniel",
      enviadoDanielFecha: "enviado_daniel_fecha",
      pantallaHecha: "pantalla_hecha",
      pantallaHechaFecha: "pantalla_hecha_fecha",
      precio: "precio",
      precioConIva: "precio_con_iva",
      costeEnvio: "coste_envio",
      reserva: "reserva",
      pagadoCompleto: "pagado_completo",
      factura: "factura",
      notasPedido: "notas_pedido",
      tapiceroId: "tapicero_id",
      pasosTapicero: "pasos_tapicero",
      enviadoTapicero: "enviado_tapicero",
      enviadoTapiceroFecha: "enviado_tapicero_fecha",
      telaEstado: "tela_estado",
      telaEstadoPor: "tela_estado_por",
      telaEstadoFecha: "tela_estado_fecha",
      terminadoTapicero: "terminado_tapicero",
      terminadoTapiceroPor: "terminado_tapicero_por",
      terminadoTapiceroFecha: "terminado_tapicero_fecha",
      montaje: "montaje",
      ordenProduccion: "orden_produccion",
      notaTapicero: "nota_tapicero",
      fechaRecogida: "fecha_recogida",
      clienteNombre: "cliente_nombre",
      clienteNombreLibre: "cliente_nombre_libre",
      esCanje: "es_canje",
      formatos: "formatos",
      tipoColaboracion: "tipo_colaboracion",
    };
    for (const [k, v] of Object.entries(patch)) {
      const col = map[k];
      if (col) dbPatch[col] = v === "" ? null : v;
    }
    const { error } = await supabase.from("pedidos").update(dbPatch as never).eq("id", id);
    if (error) { state = prevState; emit(); toast.error("Error al actualizar el pedido."); return; }
    // La fecha límite la recalcula un trigger a partir de fecha_creacion + días
    // de plazo. Si cambia alguna de las dos, refrescamos para traer la nueva.
    if ("fechaCreacionPedido" in patch || "diasPlazo" in patch) await refetchPedidos();
    await syncLeadFromPedidos(leadId);
    // Si cambió el precio del pedido, se refleja en la ficha del producto.
    if ("precio" in patch) await propagarPrecioPedidoAProducto(id);
  },

  // Edición MANUAL del número de pedido (solo equipo). El número PUEDE
  // repetirse; para diferenciar dos pedidos con el mismo número se usa una
  // letra opcional (sufijo): 12, 12A, 12B…
  async actualizarNumeroPedido(id: string, numero: number, sufijo = ""): Promise<boolean> {
    if (!Number.isInteger(numero) || numero < 1) { toast.error("El número debe ser un entero positivo."); return false; }
    const suf = sufijo.trim().toUpperCase();
    if (suf && !/^[A-Z]{1,2}$/.test(suf)) { toast.error("La letra debe ser 1 o 2 letras (A-Z)."); return false; }
    const actual = state.pedidos.find((p) => p.id === id);
    if (!actual) return false;
    if (actual.numero === numero && (actual.numeroSufijo ?? "") === suf) return true;
    const prevState = state;
    state = { ...state, pedidos: state.pedidos.map((p) => p.id === id ? { ...p, numero, numeroSufijo: suf } : p) };
    emit();
    const { error } = await supabase.from("pedidos").update({ numero, numero_sufijo: suf || null } as never).eq("id", id);
    if (error) {
      state = prevState; emit();
      toast.error("No se pudo cambiar el número.");
      return false;
    }
    toast.success(`Número de pedido actualizado a ${numero}${suf}.`);
    return true;
  },

  // Reasigna el tapicero conservando el histórico por paso. Los pasos YA HECHOS
  // que aún no tengan sello se sellan con el tapicero SALIENTE (así "los
  // anteriores" mantienen quién los hizo); los pasos no hechos siguen al
  // tapicero nuevo. Usar esto (no updatePedido) al cambiar de tapicero.
  async reasignarTapicero(pedidoId: string, nuevoTapiceroId: string) {
    const pedido = state.pedidos.find((p) => p.id === pedidoId);
    if (!pedido) return;
    const saliente = pedido.tapiceroId;
    if (saliente === nuevoTapiceroId) return; // sin cambios
    const producto = state.productos.find((pr) => pr.id === pedido.productoLeadId);
    const sellos: Record<string, string> = { ...(pedido.pasosTapicero || {}) };
    if (saliente) {
      for (const h of flujoPedido(producto?.tipo ?? "")) {
        if ((pedido[h.key] as boolean) && !sellos[h.key]) sellos[h.key] = saliente;
      }
    }
    // Cambiar de tapicero arranca en limpio para el nuevo: se borran los
    // marcadores de "iniciado" y de "cambio tras envío" (que viven dentro de
    // pasos_tapicero). Asignar NO implica "solicitado" (ese paso se marca a mano).
    delete sellos[PASO_INICIADO];
    delete sellos[PASO_INICIADO_POR];
    delete sellos[PASO_CAMBIO];
    delete sellos[PASO_CAMBIO_DETALLE];
    const patch: Partial<Pedido> = { tapiceroId: nuevoTapiceroId, pasosTapicero: sellos };
    await actions.updatePedido(pedidoId, patch);
  },

  // ───────── Catálogo de tapiceros (gestión desde Usuarios) ─────────
  async addTapicero(nombre: string, apellido: string): Promise<boolean> {
    if (!nombre.trim()) { toast.error("El tapicero necesita un nombre."); return false; }
    const orden = state.tapiceros.length + 1;
    const { error } = await supabase.from("tapiceros").insert({ nombre: nombre.trim(), apellido: apellido.trim(), activo: true, orden } as never);
    if (error) { toast.error("No se pudo crear el tapicero."); return false; }
    await refetchTapiceros();
    return true;
  },
  async deleteTapicero(id: string): Promise<boolean> {
    // La FK de pedidos es ON DELETE SET NULL: sus pedidos quedan sin asignar.
    const prev = state;
    state = { ...state, tapiceros: state.tapiceros.filter((t) => t.id !== id) };
    emit();
    const { error } = await supabase.from("tapiceros").delete().eq("id", id);
    if (error) { state = prev; emit(); toast.error("No se pudo eliminar el tapicero."); return false; }
    await refetchPedidos();
    return true;
  },
  async updateTapicero(id: string, patch: { nombre?: string; apellido?: string; activo?: boolean; ocultaApellidos?: boolean }) {
    const db: Record<string, unknown> = {};
    if (patch.nombre !== undefined) db.nombre = patch.nombre.trim();
    if (patch.apellido !== undefined) db.apellido = patch.apellido.trim();
    if (patch.activo !== undefined) db.activo = patch.activo;
    if (patch.ocultaApellidos !== undefined) db.oculta_apellidos = patch.ocultaApellidos;
    const prev = state;
    state = { ...state, tapiceros: state.tapiceros.map((t) => t.id === id ? { ...t, ...patch } : t) };
    emit();
    const { error } = await supabase.from("tapiceros").update(db as never).eq("id", id);
    if (error) { state = prev; emit(); toast.error("No se pudo actualizar el tapicero."); }
  },

  // Genera (o regenera) el token de acceso por enlace del tapicero. El equipo
  // puede actualizar tapiceros por RLS. Devuelve el token nuevo o "".
  async generarEnlaceTapicero(id: string): Promise<string> {
    const token = (crypto.randomUUID() + crypto.randomUUID()).replace(/-/g, "");
    const { error } = await supabase.from("tapiceros")
      .update({ access_token: token, access_token_activo: true } as never).eq("id", id);
    if (error) { toast.error("No se pudo generar el enlace."); return ""; }
    state = { ...state, tapiceros: state.tapiceros.map((t) => t.id === id ? { ...t, accessToken: token, accessTokenActivo: true } : t) };
    emit();
    return token;
  },

  // Revoca el enlace (borra el token). El enlace deja de funcionar al instante.
  async revocarEnlaceTapicero(id: string) {
    const prev = state;
    state = { ...state, tapiceros: state.tapiceros.map((t) => t.id === id ? { ...t, accessToken: "", accessTokenActivo: false } : t) };
    emit();
    const { error } = await supabase.from("tapiceros")
      .update({ access_token: null, access_token_activo: false } as never).eq("id", id);
    if (error) { state = prev; emit(); toast.error("No se pudo revocar el enlace."); }
  },

  // "Media pagada (todos)": marca el 50% en los pedidos ACTUALES indicados.
  // Pre-rellena la reserva con la mitad del precio de PRODUCTO (envío aparte)
  // y activa pagado50. No toca pedidos ya cobrados por completo, ni baja una
  // reserva que ya sea >= media. No afecta a pedidos creados después.
  async marcarMediaPagadaGrupo(pedidoIds: string[]) {
    const objetivo = state.pedidos.filter((p) => {
      if (!pedidoIds.includes(p.id)) return false;
      if (p.pagadoCompleto) return false;
      const media = Math.round(((p.precio || 0) / 2) * 100) / 100;
      if (media <= 0) return false;
      return (p.reserva || 0) < media;
    });
    if (objetivo.length === 0) {
      toast.info("No hay pedidos a los que aplicar la media.");
      return;
    }
    const prevState = state;
    const updates = new Map<string, number>();
    for (const p of objetivo) {
      updates.set(p.id, Math.round(((p.precio || 0) / 2) * 100) / 100);
    }
    // Optimistic
    state = {
      ...state,
      pedidos: state.pedidos.map((p) =>
        updates.has(p.id) ? { ...p, reserva: updates.get(p.id)!, pagado50: true } : p,
      ),
    };
    emit();
    const results = await Promise.all(
      Array.from(updates.entries()).map(([id, reserva]) =>
        supabase.from("pedidos").update({ reserva, pagado_50: true } as never).eq("id", id),
      ),
    );
    if (results.some((r) => r.error)) {
      state = prevState;
      emit();
      toast.error("Error al marcar la media pagada.");
      return;
    }
    // Refleja el nuevo cobro en cada lead afectado.
    const leadIds = new Set(objetivo.map((p) => p.leadId).filter(Boolean));
    for (const lid of leadIds) await syncLeadFromPedidos(lid);
    toast.success(`Media pagada marcada en ${objetivo.length} pedido${objetivo.length === 1 ? "" : "s"}.`);
  },

  async deletePedido(id: string) {
    const prevState = state;
    const leadId = state.pedidos.find((p) => p.id === id)?.leadId;
    state = { ...state, pedidos: state.pedidos.filter((p) => p.id !== id) };
    emit();
    const { error } = await supabase.from("pedidos").delete().eq("id", id);
    if (error) { state = prevState; emit(); toast.error("Error al eliminar el pedido."); return; }
    // Si aún quedan pedidos del lead, mandan ellos; si no, vuelve a mandar el
    // lead (valor recalculado desde sus productos).
    if (leadId) {
      if (state.pedidos.some((p) => p.leadId === leadId)) await syncLeadFromPedidos(leadId);
      else await syncLeadValorFromProductos(leadId);
    }
  },

  async addPedidoTela(pedidoId: string, tipoTela: string) {
    const orden = state.pedidoTelas.filter((t) => t.pedidoId === pedidoId).length;
    const { error } = await supabase.from("pedido_telas").insert({
      pedido_id: pedidoId, tipo_tela: tipoTela, estado: "Pedida", orden,
    });
    if (error) { toast.error("Error al añadir la tela."); return; }
    await flagCambioPedidos([pedidoId], "Cambió: telas del pedido");
  },

  async updatePedidoTela(id: string, patch: Partial<PedidoTela>) {
    const prevState = state;
    const telaPrev = state.pedidoTelas.find((t) => t.id === id);
    state = { ...state, pedidoTelas: state.pedidoTelas.map((t) => t.id === id ? { ...t, ...patch } : t) };
    emit();
    const dbPatch: Record<string, unknown> = {};
    if (patch.tipoTela !== undefined) dbPatch.tipo_tela = patch.tipoTela;
    if (patch.nombreTela !== undefined) dbPatch.nombre_tela = patch.nombreTela;
    if (patch.estado !== undefined) dbPatch.estado = patch.estado;
    if (patch.fechaRecibo !== undefined) dbPatch.fecha_recibo = patch.fechaRecibo || null;
    if (patch.telaFotoUrl !== undefined) dbPatch.tela_foto_url = patch.telaFotoUrl || null;
    if (patch.telaBibliotecaId !== undefined) dbPatch.tela_biblioteca_id = patch.telaBibliotecaId || null;
    if (patch.telaColeccion !== undefined) dbPatch.tela_coleccion = patch.telaColeccion || null;
    if (patch.mismaQueFrontal !== undefined) dbPatch.misma_que_frontal = patch.mismaQueFrontal;
    const { error } = await supabase.from("pedido_telas").update(dbPatch as never).eq("id", id);
    if (error) { state = prevState; emit(); toast.error("Error al actualizar la tela."); return; }
    // Solo avisa si cambió la ESPECIFICACIÓN de la tela (nombre, foto, colección,
    // rol o "misma que frontal"), no el mero progreso (estado/fecha de recibo).
    const cambioSpec = ["tipoTela", "nombreTela", "telaFotoUrl", "telaColeccion", "mismaQueFrontal"]
      .some((k) => (patch as Record<string, unknown>)[k] !== undefined && telaPrev && (patch as Record<string, unknown>)[k] !== (telaPrev as unknown as Record<string, unknown>)[k]);
    if (cambioSpec && telaPrev) await flagCambioPedidos([telaPrev.pedidoId], "Cambió: telas del pedido");
  },

  // Guarda el CONJUNTO de telas de un pedido (diff create/update/delete) en una
  // sola operación. Se usa por el guardado explícito de la ficha de pedido: las
  // filas con `id` se actualizan, las nuevas se insertan y las que ya no están
  // se borran. `orden` se reasigna por posición.
  async guardarTelasPedido(pedidoId: string, rows: Array<{
    id: string | null; tipoTela: string; nombreTela: string; estado: string;
    fechaRecibo: string; telaFotoUrl: string; telaBibliotecaId: string;
    telaColeccion: string; mismaQueFrontal: boolean;
  }>): Promise<boolean> {
    const existentes = state.pedidoTelas.filter((t) => t.pedidoId === pedidoId);
    const keepIds = new Set(rows.filter((r) => r.id).map((r) => r.id as string));
    // ¿Cambió realmente la especificación de telas? (para avisar al tapicero solo
    // si hay cambio de verdad, no en cada guardado). Ignora estado/fecha (progreso).
    const existById = new Map(existentes.map((e) => [e.id, e]));
    const huboCambioTelas =
      existentes.some((e) => !keepIds.has(e.id)) ||
      rows.some((r) => {
        if (!r.id) return true;
        const e = existById.get(r.id);
        if (!e) return true;
        return e.tipoTela !== r.tipoTela || e.nombreTela !== r.nombreTela ||
          e.telaFotoUrl !== r.telaFotoUrl || e.telaBibliotecaId !== r.telaBibliotecaId ||
          e.telaColeccion !== r.telaColeccion || e.mismaQueFrontal !== r.mismaQueFrontal;
      });
    try {
      // Borrados
      const aBorrar = existentes.filter((e) => !keepIds.has(e.id)).map((e) => e.id);
      if (aBorrar.length > 0) {
        const { error } = await supabase.from("pedido_telas").delete().in("id", aBorrar);
        if (error) throw error;
      }
      // Altas / actualizaciones (por posición → orden)
      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        const payload = {
          pedido_id: pedidoId,
          tipo_tela: r.tipoTela,
          nombre_tela: r.nombreTela,
          estado: r.estado || "Pedida",
          fecha_recibo: r.fechaRecibo || null,
          tela_foto_url: r.telaFotoUrl || null,
          tela_biblioteca_id: r.telaBibliotecaId || null,
          tela_coleccion: r.telaColeccion || null,
          misma_que_frontal: !!r.mismaQueFrontal,
          orden: i,
        };
        if (r.id) {
          const { error } = await supabase.from("pedido_telas").update(payload as never).eq("id", r.id);
          if (error) throw error;
        } else {
          const { error } = await supabase.from("pedido_telas").insert(payload as never);
          if (error) throw error;
        }
      }
      await refetchPedidoTelas();
      if (huboCambioTelas) await flagCambioPedidos([pedidoId], "Cambió: telas del pedido");
      return true;
    } catch {
      toast.error("Error al guardar las telas del pedido.");
      return false;
    }
  },

  async deletePedidoTela(id: string) {
    const prevState = state;
    const telaPrev = state.pedidoTelas.find((t) => t.id === id);
    state = { ...state, pedidoTelas: state.pedidoTelas.filter((t) => t.id !== id) };
    emit();
    const { error } = await supabase.from("pedido_telas").delete().eq("id", id);
    if (error) { state = prevState; emit(); toast.error("Error al eliminar la tela."); return; }
    if (telaPrev) await flagCambioPedidos([telaPrev.pedidoId], "Cambió: telas del pedido");
  },

  // ───────── Biblioteca de telas + telas por pedido (Fase 2) ─────────
  // Sube (o reutiliza) una tela en la biblioteca. Si `blob` es null se guarda
  // sin foto. Deduplica por nombre normalizado. Devuelve la fila de biblioteca.
  async subirTela(nombre: string, blob: Blob | null, coleccion = "otra"): Promise<TelaBiblioteca | null> {
    const norm = normNombreTela(nombre);
    if (!norm) { toast.error("La tela necesita un nombre."); return null; }
    const existente = state.telasBiblioteca.find((t) => normNombreTela(t.nombre) === norm);
    let fotoUrl = existente?.fotoUrl ?? "";
    if (blob) {
      const path = `telas/${crypto.randomUUID()}.jpg`;
      const { error: upErr } = await supabase.storage.from("telas").upload(path, blob, { contentType: "image/jpeg", upsert: false });
      if (upErr) { toast.error("No se pudo subir la foto de la tela."); return null; }
      fotoUrl = await signPath("telas", path);
    }
    if (existente) {
      if (blob) await supabase.from("telas_biblioteca").update({ foto_url: fotoUrl } as never).eq("id", existente.id);
      await refetchTelasBiblioteca();
      return { ...existente, fotoUrl };
    }
    const { data, error } = await supabase.from("telas_biblioteca").insert({
      nombre: nombre.trim(), nombre_norm: norm, foto_url: fotoUrl || null, coleccion, origen: "subida", created_by: currentUser,
    } as never).select().single();
    if (error || !data) { toast.error("No se pudo guardar la tela."); return null; }
    await refetchTelasBiblioteca();
    const r = data as Record<string, unknown>;
    return { id: r.id as string, nombre: (r.nombre as string) ?? "", fotoUrl: (r.foto_url as string) ?? "", coleccion: (r.coleccion as string) ?? "otra", origen: "subida" };
  },

  // Asigna la tela de un rol (Frontal/Lateral/Vivo) a un pedido. Crea la fila
  // en pedido_telas si no existe, o la actualiza.
  async asignarTelaPedido(pedidoId: string, rol: string, tela: { nombreTela: string; telaFotoUrl: string; telaBibliotecaId?: string; telaColeccion?: string; mismaQueFrontal?: boolean }) {
    const existente = state.pedidoTelas.find((t) => t.pedidoId === pedidoId && t.tipoTela === rol);
    if (existente) {
      await actions.updatePedidoTela(existente.id, {
        nombreTela: tela.nombreTela, telaFotoUrl: tela.telaFotoUrl,
        telaBibliotecaId: tela.telaBibliotecaId ?? "", telaColeccion: tela.telaColeccion ?? "",
        mismaQueFrontal: !!tela.mismaQueFrontal,
      });
      return;
    }
    const orden = state.pedidoTelas.filter((t) => t.pedidoId === pedidoId).length;
    const { error } = await supabase.from("pedido_telas").insert({
      pedido_id: pedidoId, tipo_tela: rol, estado: "Pedida", orden,
      nombre_tela: tela.nombreTela, tela_foto_url: tela.telaFotoUrl || null,
      tela_biblioteca_id: tela.telaBibliotecaId || null, tela_coleccion: tela.telaColeccion || null,
      misma_que_frontal: !!tela.mismaQueFrontal,
    } as never);
    if (error) toast.error("No se pudo asignar la tela.");
  },

  // ───────── Archivos del pedido (plantilla / referencia / etiqueta de envío) ─────────
  // La subida es solo del equipo (RLS lo garantiza). `transportista` solo aplica
  // a la etiqueta de envío.
  async subirArchivoPedido(pedidoId: string, tipo: "plantilla" | "etiqueta_ctt" | "etiqueta_envio" | "referencia", file: File, transportista?: string) {
    const path = `${pedidoId}/${tipo}/${crypto.randomUUID()}-${file.name}`;
    const { error: upErr } = await supabase.storage.from("pedido-archivos").upload(path, file, { upsert: false });
    if (upErr) { toast.error("No se pudo subir el archivo."); return; }
    const url = await signPath("pedido-archivos", path);
    const { error } = await supabase.from("pedido_archivos").insert({
      pedido_id: pedidoId, tipo, nombre: file.name, storage_path: path, url, subido_por: currentUser,
      transportista: tipo === "etiqueta_envio" ? (transportista || null) : null,
    } as never);
    if (error) { toast.error("No se pudo guardar el archivo."); return; }
    await refetchPedidoArchivos();
  },
  async deleteArchivoPedido(id: string, storagePath: string) {
    const prevState = state;
    state = { ...state, pedidoArchivos: state.pedidoArchivos.filter((a) => a.id !== id) };
    emit();
    await supabase.storage.from("pedido-archivos").remove([storagePath]);
    const { error } = await supabase.from("pedido_archivos").delete().eq("id", id);
    if (error) { state = prevState; emit(); toast.error("No se pudo eliminar el archivo."); return; }
    await refetchPedidoArchivos();
  },

  // deleteAuditEntry intentionally removed — audit log is append-only

  // ───────── Fotos del lead ─────────
  async addLeadFoto(leadId: string, file: File, pie = ""): Promise<LeadFoto | null> {
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
    const path = `${leadId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error: upErr } = await supabase.storage.from("lead-fotos").upload(path, file, {
      contentType: file.type || `image/${ext}`,
      cacheControl: "3600",
    });
    if (upErr) { toast.error("Error subiendo la foto."); return null; }
    // Signed URL (bucket privado) — 7 días
    const { data: signed } = await supabase.storage.from("lead-fotos").createSignedUrl(path, 60 * 60 * 24 * 7);
    const url = signed?.signedUrl ?? "";
    const { data, error } = await supabase.from("lead_fotos").insert({
      lead_id: leadId,
      storage_path: path,
      url,
      pie,
    }).select().single();
    if (error || !data) {
      await supabase.storage.from("lead-fotos").remove([path]);
      toast.error("Error al registrar la foto.");
      return null;
    }
    const foto = mapLeadFoto(data as unknown as Record<string, unknown>);
    state = { ...state, leadFotos: [foto, ...state.leadFotos] };
    emit();
    return foto;
  },

  async deleteLeadFoto(id: string) {
    const foto = state.leadFotos.find((f) => f.id === id);
    if (!foto) return;
    const prevState = state;
    state = { ...state, leadFotos: state.leadFotos.filter((f) => f.id !== id) };
    emit();
    const { error } = await supabase.from("lead_fotos").delete().eq("id", id);
    if (error) { state = prevState; emit(); toast.error("Error al borrar la foto."); return; }
    await supabase.storage.from("lead-fotos").remove([foto.storagePath]);
  },

  async refreshLeadFotoUrl(id: string): Promise<string | null> {
    const foto = state.leadFotos.find((f) => f.id === id);
    if (!foto) return null;
    const { data } = await supabase.storage.from("lead-fotos").createSignedUrl(foto.storagePath, 60 * 60 * 24 * 7);
    if (!data?.signedUrl) return null;
    await supabase.from("lead_fotos").update({ url: data.signedUrl }).eq("id", id);
    state = { ...state, leadFotos: state.leadFotos.map((f) => f.id === id ? { ...f, url: data.signedUrl } : f) };
    emit();
    return data.signedUrl;
  },
};


export function nextPendingTaskFor(leadId: string, tareas: Tarea[]): Tarea | undefined {
  return tareas
    .filter((t) => t.leadId === leadId && !t.completada)
    .sort((a, b) => a.fecha.localeCompare(b.fecha))[0];
}

export function vendedorTotals(leads: Lead[]) {
  const map = new Map<string, { leads: number; valor: number }>();
  VENDEDORES.forEach((v) => map.set(v, { leads: 0, valor: 0 }));
  leads.forEach((l) => {
    const cur = map.get(l.vendedor) ?? { leads: 0, valor: 0 };
    cur.leads += 1;
    cur.valor += l.valor;
    map.set(l.vendedor, cur);
  });
  return map;
}

if (typeof window !== "undefined") {
  window.addEventListener("online", () => { void actions.reconnectRealtime(); });
}
