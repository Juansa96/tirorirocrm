import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { displayColeccionTela, stripDiacritics } from "@/lib/catalogo";
import { maskApellido, marcadoresTapicero } from "@/lib/types";
import { refreshSignedUrls, signPaths } from "@/lib/storage-urls";
import { cmpCola } from "@/lib/orden-taller";
import { TELAS_WEB } from "@/lib/telas-web-data";

export interface PanelTela { rol: string; nombre: string; fotoUrl: string; coleccion: string; mismaQueFrontal: boolean; }
export interface PanelArchivo { id: string; tipo: string; nombre: string; url: string; transportista: string; createdAt: string; }
export interface PanelPedido {
  id: string;
  numero: number | null;
  numeroSufijo: string;
  cliente: string;
  ordenProduccion: number | null; // orden manual de trabajo (1º, 2º…)
  notaTapicero: string;           // comentario para el tapicero (dirección de tela, etc.)
  tipo: string; modelo: string;
  cantidad: number;    // nº de unidades de este producto (p. ej. pufs que van de 2 en 2)
  ancho: number | null; alto: number | null; fondo: number | null;
  acabado: string; montaje: string; patas: string; notasProducto: string; notasPedido: string;
  telaTexto: string;   // tela del producto (texto), respaldo si no hay telas con foto
  tapiceroNombre: string;
  fechaLimite: string; fechaAsignacion: string; fechaRecogida: string; diasRestantes: number;
  entregado: boolean;
  telaEstado: string; telaEstadoPor: string; telaEstadoFecha: string;
  iniciado: boolean; iniciadoPor: string; iniciadoFecha: string;
  terminado: boolean; terminadoPor: string; terminadoFecha: string;
  cambioTrasEnvio: boolean; cambioTrasEnvioFecha: string; cambioTrasEnvioDetalle: string;
  telas: PanelTela[]; archivos: PanelArchivo[];
}

function diasHasta(fecha: string): number {
  if (!fecha) return 9999;
  const ms = new Date(fecha + "T00:00:00").getTime() - Date.now();
  return Math.ceil(ms / 86400000);
}

// ── Catálogo de telas de la web (nombre → foto), para rellenar la foto de las
// telas que ya están asignadas por nombre pero sin foto propia. Así el tapicero
// ve la foto de la web sin que el equipo tenga que reasignar la tela.
function normTela(s: string): string {
  return stripDiacritics(s).trim().toLowerCase().replace(/\s+/g, " ");
}
let telasWebCache: Map<string, { foto: string; coleccion: string }> | null = null;
async function getTelasWeb(): Promise<Map<string, { foto: string; coleccion: string }>> {
  if (telasWebCache) return telasWebCache;
  // Base: catálogo empaquetado (siempre disponible, sin depender de la red).
  const map = new Map<string, { foto: string; coleccion: string }>(Object.entries(TELAS_WEB));
  // Enriquecimiento: catálogo en vivo (por si se han añadido telas nuevas).
  try {
    const res = await fetch("/api/public/telas", { cache: "no-cache" });
    if (res.ok) {
      const data = await res.json() as { telas?: Array<Record<string, unknown>> };
      for (const t of data.telas ?? []) {
        const nombre = normTela(String(t.nombre ?? ""));
        const foto = String(t.foto ?? "");
        if (nombre && foto) map.set(nombre, { foto, coleccion: String(t.coleccion ?? "") });
      }
    }
  } catch { /* la web no responde: nos quedamos con el catálogo empaquetado */ }
  telasWebCache = map;
  return map;
}

// Carga (y mantiene en tiempo real) los pedidos ENVIADOS de un tapicero, con su
// producto, telas y archivos. Usa consultas directas (no el store del equipo);
// la RLS garantiza que un tapicero solo obtiene los suyos.
export function usePanelPedidos(tapiceroId: string | null | undefined, esViewerElTapicero = false) {
  const [pedidos, setPedidos] = useState<PanelPedido[] | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cargar = useCallback(async () => {
    if (!tapiceroId) { setPedidos([]); return; }
    // Muestra TODOS los pedidos asignados al tapicero (no solo los "enviados").
    // PRIVACIDAD (backend): al tapicero NO se le devuelven las columnas del
    // nombre del cliente; se piden aparte ya recortadas por panel_cliente_nombres.
    // El equipo recibe todo ("*"), incluido el nombre completo.
    // `pasos_tapicero` (JSONB) incluye los marcadores de iniciado / cambio, así
    // que no hacen falta columnas nuevas ni migraciones.
    const COLS_TAPICERO = "id,numero,numero_sufijo,producto_lead_id,montaje,notas_pedido,nota_tapicero,orden_produccion,fecha_limite,fecha_recogida,enviado_tapicero_fecha,entregado,tela_estado,tela_estado_por,tela_estado_fecha,terminado_tapicero,terminado_tapicero_por,terminado_tapicero_fecha,pasos_tapicero,tapicero_id";
    const { data: peds } = await supabase.from("pedidos")
      .select(esViewerElTapicero ? COLS_TAPICERO : "*")
      .eq("tapicero_id", tapiceroId);
    const rows = (peds ?? []) as unknown as Record<string, unknown>[];

    // Nombre del tapicero asignado (todos los pedidos son del mismo).
    const { data: tapRow } = await supabase.from("tapiceros").select("nombre, apellido").eq("id", tapiceroId).maybeSingle();
    const tapiceroNombre = tapRow ? [tapRow.nombre as string, tapRow.apellido as string].filter(Boolean).join(" ") : "";
    const prodIds = rows.map((p) => p.producto_lead_id).filter(Boolean) as string[];
    const pedIds = rows.map((p) => p.id) as string[];


    // Nombres de cliente recortados para el tapicero (el apellido completo no
    // sale de la BD). El equipo usa los nombres que ya vienen en las filas.
    const nombreById = new Map<string, string>();
    if (esViewerElTapicero && pedIds.length) {
      const { data: nombres } = await supabase.rpc("panel_cliente_nombres", { p_ids: pedIds });
      for (const n of (nombres ?? []) as Array<{ id: string; nombre: string }>) nombreById.set(n.id, n.nombre ?? "");
    }

    // Respaldo del nombre para el EQUIPO: si un pedido no tiene el nombre
    // denormalizado (cliente_nombre / nombre libre), se resuelve desde el lead
    // vinculado (el equipo sí puede leer leads). Evita "Sin cliente" en el panel
    // cuando el pedido está vinculado a un cliente real (p. ej. tras conversión
    // de lead sin denormalizar el nombre).
    const leadNombreById = new Map<string, string>();
    if (!esViewerElTapicero) {
      const leadIds = [...new Set(rows.map((p) => p.lead_id).filter(Boolean) as string[])];
      if (leadIds.length) {
        const { data: ls } = await supabase.from("leads").select("id, nombre").in("id", leadIds);
        for (const l of (ls ?? []) as Array<{ id: string; nombre: string }>) leadNombreById.set(l.id, l.nombre ?? "");
      }
    }

    const [{ data: prods }, { data: telas }, { data: archivos }] = await Promise.all([
      prodIds.length ? supabase.from("productos_lead").select("*").in("id", prodIds) : Promise.resolve({ data: [] as never[] }),
      pedIds.length ? supabase.from("pedido_telas").select("*").in("pedido_id", pedIds) : Promise.resolve({ data: [] as never[] }),
      pedIds.length ? supabase.from("pedido_archivos").select("*").in("pedido_id", pedIds) : Promise.resolve({ data: [] as never[] }),
    ]);
    const prodById = new Map((prods as unknown as Record<string, unknown>[] ?? []).map((p) => [p.id as string, p]));
    const telasByPedido = new Map<string, Record<string, unknown>[]>();
    for (const t of (telas as unknown as Record<string, unknown>[] ?? [])) {
      const k = t.pedido_id as string;
      (telasByPedido.get(k) ?? telasByPedido.set(k, []).get(k)!).push(t);
    }
    const archByPedido = new Map<string, Record<string, unknown>[]>();
    for (const a of (archivos as unknown as Record<string, unknown>[] ?? [])) {
      const k = a.pedido_id as string;
      (archByPedido.get(k) ?? archByPedido.set(k, []).get(k)!).push(a);
    }

    // Buckets privados: se firman las fotos de tela y los archivos del pedido.
    const telaRows = (telas as unknown as Record<string, unknown>[] ?? []);
    const archRows = (archivos as unknown as Record<string, unknown>[] ?? []);
    const [telasFirmadas, archFirmados, telasWeb] = await Promise.all([
      refreshSignedUrls("telas", telaRows.map((t) => (t.tela_foto_url as string) ?? "")),
      signPaths("pedido-archivos", archRows.map((a) => (a.storage_path as string) ?? "")),
      getTelasWeb(),
    ]);

    const out: PanelPedido[] = rows.map((p) => {
      const prod = prodById.get(p.producto_lead_id as string) ?? {};
      // Marcadores del tapicero (iniciado / cambio) derivados de pasos_tapicero.
      const marc = marcadoresTapicero(
        (p.pasos_tapicero && typeof p.pasos_tapicero === "object" ? p.pasos_tapicero : {}) as Record<string, string>,
      );
      const fechaLimite = (p.fecha_limite as string) ?? "";
      const fechaRecogida = (p.fecha_recogida as string) ?? "";
      const ts = (telasByPedido.get(p.id as string) ?? []).map((t): PanelTela => {
        const nombre = (t.nombre_tela as string) ?? "";
        const propia = telasFirmadas.get((t.tela_foto_url as string) ?? "") ?? ((t.tela_foto_url as string) ?? "");
        // Si la tela no tiene foto propia pero su nombre está en el catálogo de
        // la web, se usa la foto (y colección) de la web.
        const web = !propia && nombre ? telasWeb.get(normTela(nombre)) : undefined;
        return {
          rol: (t.tipo_tela as string) ?? "",
          nombre,
          fotoUrl: propia || web?.foto || "",
          coleccion: (t.tela_coleccion as string) || (web?.coleccion ?? ""),
          mismaQueFrontal: !!t.misma_que_frontal,
        };
      });
      const ar = (archByPedido.get(p.id as string) ?? []).map((a): PanelArchivo => ({
        id: a.id as string, tipo: (a.tipo as string) ?? "", nombre: (a.nombre as string) ?? "",
        url: archFirmados.get((a.storage_path as string) ?? "") ?? ((a.url as string) ?? ""),
        transportista: (a.transportista as string) ?? "",
        createdAt: (a.created_at as string) ?? "",
      }));
      // En el panel el apellido SIEMPRE se ve recortado ("Lucía L."): para el
      // tapicero viene ya recortado del backend (RPC); para el equipo se recorta
      // aquí. El nombre completo solo se ve fuera del panel (Pedidos, Clientes).
      const nombreCliente = esViewerElTapicero
        ? (nombreById.get(p.id as string) ?? "Cliente")
        : maskApellido((p.cliente_nombre as string) || (p.cliente_nombre_libre as string) || leadNombreById.get(p.lead_id as string) || "");
      return {
        id: p.id as string,
        numero: p.numero != null ? Number(p.numero) : null,
        numeroSufijo: (p.numero_sufijo as string) ?? "",
        cliente: nombreCliente,
        ordenProduccion: p.orden_produccion != null ? Number(p.orden_produccion) : null,
        notaTapicero: (p.nota_tapicero as string) ?? "",
        tipo: (prod.tipo as string) ?? "",
        modelo: (prod.modelo as string) ?? "",
        cantidad: Math.max(1, Number(prod.cantidad) || 1),
        ancho: (prod.ancho as number | null) ?? null,
        alto: (prod.alto as number | null) ?? null,
        fondo: (prod.fondo as number | null) ?? null,
        acabado: (prod.acabado as string) ?? "",
        telaTexto: [(prod.tela as string) || "", prod.coleccion_tela ? displayColeccionTela(prod.coleccion_tela as string) : ""].filter(Boolean).join(" · "),
        tapiceroNombre,
        montaje: (p.montaje as string) ?? "",
        patas: (prod.patas as string) ?? "",
        notasProducto: (prod.notas_producto as string) ?? "",
        notasPedido: (p.notas_pedido as string) ?? "",
        fechaLimite,
        fechaAsignacion: (p.enviado_tapicero_fecha as string) ?? "",
        fechaRecogida,
        // Los "días" del panel cuentan hacia la fecha en que Juan pasa a
        // RECOGER el producto (no la entrega final al cliente). Si aún no hay
        // fecha de recogida, diasHasta("") = 9999 y la card muestra "Sin
        // recogida" en vez de un número (ver diasColor/plazoBadge).
        diasRestantes: diasHasta(fechaRecogida),
        entregado: !!p.entregado,
        telaEstado: (p.tela_estado as string) ?? "pendiente",
        telaEstadoPor: (p.tela_estado_por as string) ?? "",
        telaEstadoFecha: (p.tela_estado_fecha as string) ?? "",
        iniciado: marc.iniciado,
        iniciadoPor: marc.iniciadoPor,
        iniciadoFecha: marc.iniciadoFecha,
        terminado: !!p.terminado_tapicero,
        terminadoPor: (p.terminado_tapicero_por as string) ?? "",
        terminadoFecha: (p.terminado_tapicero_fecha as string) ?? "",
        cambioTrasEnvio: marc.cambioTrasEnvio,
        cambioTrasEnvioFecha: marc.cambioTrasEnvioFecha,
        cambioTrasEnvioDetalle: marc.cambioTrasEnvioDetalle,
        telas: ts, archivos: ar,
      };
    });
    // Lo que antes sale del taller, primero: manda la fecha de recogida de Juan
    // (y la de entrega si aún no hay recogida). Ver src/lib/orden-taller.ts.
    out.sort(cmpCola);
    setPedidos(out);
  }, [tapiceroId, esViewerElTapicero]);

  useEffect(() => {
    void cargar();
    if (!tapiceroId) return;
    const debounced = () => { if (timer.current) clearTimeout(timer.current); timer.current = setTimeout(() => void cargar(), 400); };
    const ch = supabase.channel("panel-" + tapiceroId)
      .on("postgres_changes", { event: "*", schema: "public", table: "pedidos" }, debounced)
      .on("postgres_changes", { event: "*", schema: "public", table: "pedido_telas" }, debounced)
      .on("postgres_changes", { event: "*", schema: "public", table: "pedido_archivos" }, debounced)
      .subscribe();
    return () => { if (timer.current) clearTimeout(timer.current); void supabase.removeChannel(ch); };
  }, [tapiceroId, cargar]);

  return { pedidos, refetch: cargar };
}

// Llama a la ruta de servidor para marcar tela recibida / terminado.
export async function accionTapicero(op: "tela_recibida" | "iniciado" | "terminado" | "cambio_visto", pedidoId: string, valor = true): Promise<boolean> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token ?? "";
  const res = await fetch("/api/tapicero/accion", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ op, pedidoId, valor }),
  });
  return res.ok;
}

// Sube (opcionalmente) una foto del producto terminado. La escritura pasa por
// la ruta de servidor (el tapicero es solo-lectura en BD). La imagen se comprime
// antes de enviarse en base64.
export async function subirFotoTerminado(pedidoId: string, file: File): Promise<boolean> {
  const { compressImage } = await import("@/lib/img");
  const blob = await compressImage(file);
  const dataUrl: string = await new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
  const dataBase64 = dataUrl.includes(",") ? dataUrl.slice(dataUrl.indexOf(",") + 1) : dataUrl;
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token ?? "";
  const res = await fetch("/api/tapicero/foto", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ pedidoId, filename: file.name || "foto.jpg", contentType: "image/jpeg", dataBase64 }),
  });
  return res.ok;
}
