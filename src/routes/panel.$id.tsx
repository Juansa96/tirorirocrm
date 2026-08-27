import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  ArrowLeft, Download, PackageCheck, Ruler, Calendar, Scissors, User, Flag,
  StickyNote, Truck, Image as ImageIcon, X, ZoomIn, Sofa, Anchor,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import {
  displayNombreProducto, telasDeProducto, etiquetaTela, prioridadLabel,
} from "@/lib/catalogo";
import { formatShortDate } from "@/lib/format";
import { SiluetaProducto } from "@/components/SiluetaProducto";
import { usePanelPedidos, accionTapicero, type PanelPedido, type PanelTela } from "@/lib/panel-data";
import { toast } from "sonner";

interface Search { tapicero?: string; }

export const Route = createFileRoute("/panel/$id")({
  head: () => ({ meta: [{ title: "Pedido — Mi taller" }] }),
  validateSearch: (s: Record<string, unknown>): Search => ({ tapicero: s.tapicero ? String(s.tapicero) : undefined }),
  component: FichaPanel,
});

// Badge de plazo/retraso (una sola pieza, legible en móvil).
function plazoBadge(d: number, entregado: boolean) {
  if (entregado) return { bg: "bg-slate-100", text: "text-slate-500", label: "Entregado" };
  if (d < 0) return { bg: "bg-rose-100", text: "text-rose-700", label: `${Math.abs(d)}d tarde` };
  if (d <= 3) return { bg: "bg-amber-100", text: "text-amber-700", label: d === 0 ? "Hoy" : `${d}d` };
  return { bg: "bg-emerald-100", text: "text-emerald-700", label: `${d}d` };
}

function prioridadBadge(prioridad: number): { bg: string; text: string } {
  if (prioridad === 1) return { bg: "bg-rose-100", text: "text-rose-700" };
  if (prioridad === 3) return { bg: "bg-slate-100", text: "text-slate-500" };
  return { bg: "bg-slate-100", text: "text-slate-600" };
}

function FichaPanel() {
  const { id } = Route.useParams();
  const search = Route.useSearch();
  const { esTapicero, esEquipo, tapiceroId: miTapiceroId } = useAuth();
  const viendoId = esTapicero ? miTapiceroId : (search.tapicero ?? "");
  const { pedidos, refetch } = usePanelPedidos(viendoId || null);
  const p = (pedidos ?? []).find((x) => x.id === id);
  const backSearch = esEquipo && viendoId ? { tapicero: viendoId } : {};
  // Imagen ampliada a pantalla completa (referencia / miniaturas de tela).
  const [zoom, setZoom] = useState<{ url: string; alt: string } | null>(null);

  if (pedidos === null) return <div className="min-h-screen bg-slate-50 p-8 text-center text-slate-400">Cargando…</div>;
  if (!p) return (
    <div className="min-h-screen bg-slate-50 p-8 text-center">
      <p className="text-slate-500">Pedido no encontrado.</p>
      <Link to="/panel" search={backSearch} className="mt-4 inline-block text-sm text-blue-600">Volver</Link>
    </div>
  );

  const medidas = [p.ancho, p.alto, p.fondo].filter((d): d is number => d != null && d > 0).join(" × ");
  const plazo = plazoBadge(p.diasRestantes, p.entregado);
  const prio = prioridadBadge(p.prioridad);

  const plantilla = p.archivos.filter((a) => a.tipo === "plantilla");
  const referencia = p.archivos.filter((a) => a.tipo === "referencia");
  const etiquetas = p.archivos.filter((a) => a.tipo === "etiqueta_envio" || a.tipo === "etiqueta_ctt");

  // Extras del producto (tapetes / colgadores) leídos de `patas`.
  const llevaTapetes = /tapete/i.test(p.patas);
  const llevaColgador = /colgador/i.test(p.patas);

  return (
    <div className="min-h-screen bg-slate-50 pb-28">
      <header className="sticky top-0 z-10 flex items-center gap-2 border-b border-slate-200 bg-white px-4 py-3">
        <Link to="/panel" search={backSearch} className="text-slate-500"><ArrowLeft className="h-5 w-5" /></Link>
        <div className="min-w-0 flex-1">
          <div className="truncate text-lg font-bold text-slate-900">{displayNombreProducto(p.tipo, p.modelo)}</div>
          {p.cliente && <div className="truncate text-xs text-slate-500">Cliente: {p.cliente}</div>}
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-4 px-4 py-4">
        {/* 1 · Cabecera: cliente, producto, medidas, tapicero, prioridad, plazo */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-bold leading-none ${plazo.bg} ${plazo.text}`}>{plazo.label}</span>
            <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold leading-none ${prio.bg} ${prio.text}`}>
              <Flag className="h-3 w-3" /> Prioridad {prioridadLabel(p.prioridad)}
            </span>
          </div>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Detalle icon={<Ruler className="h-4 w-4" />} label="Medidas" valor={medidas ? medidas + " cm" : "Medida personalizada"} />
            <Detalle icon={<User className="h-4 w-4" />} label="Cliente" valor={p.cliente || "—"} />
            <Detalle icon={<Sofa className="h-4 w-4" />} label="Producto" valor={displayNombreProducto(p.tipo, p.modelo)} />
            <Detalle icon={<User className="h-4 w-4" />} label="Tapicero" valor={p.tapiceroNombre || "Sin asignar"} />
          </div>
        </div>

        {/* 2 · Forma del producto en trazo, grande */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <SiluetaProducto tipo={p.tipo} modelo={p.modelo} className="mx-auto h-44 w-auto" />
        </div>

        {/* 3 · Plantilla de corte */}
        <Bloque titulo="Plantilla de corte" icon={<Scissors className="h-4 w-4" />}>
          {plantilla.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 py-4 text-center text-sm text-slate-400">Sin plantilla subida</div>
          ) : (
            <div className="space-y-2">
              {plantilla.map((a) => (
                <a key={a.id} href={a.url} target="_blank" rel="noreferrer"
                  className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-medium text-slate-800 active:bg-slate-100">
                  <Scissors className="h-5 w-5 text-slate-500" />
                  <span className="min-w-0 flex-1 truncate">{a.nombre}</span>
                  <Download className="h-4 w-4 text-blue-600" />
                </a>
              ))}
            </div>
          )}
        </Bloque>

        {/* 4 · Imagen de referencia del acabado (Gemini), ampliable */}
        <Bloque titulo="Imagen de referencia del acabado" icon={<ImageIcon className="h-4 w-4" />}>
          {referencia.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 py-4 text-center text-sm text-slate-400">Sin imagen de referencia</div>
          ) : (
            <div className="space-y-3">
              {referencia.map((a) => (
                <button key={a.id} type="button" onClick={() => setZoom({ url: a.url, alt: "Referencia del acabado" })}
                  className="group relative block w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
                  <img src={a.url} alt="Referencia del acabado" loading="lazy" className="max-h-96 w-full object-contain" />
                  <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-black/60 px-2 py-1 text-[11px] font-medium text-white">
                    <ZoomIn className="h-3.5 w-3.5" /> Ampliar
                  </span>
                </button>
              ))}
              <p className="text-xs text-slate-500">Indica la dirección de la tela y cómo debe quedar el producto acabado.</p>
            </div>
          )}
        </Bloque>

        {/* 5 · Bloque de telas, adaptado al tipo de producto */}
        <Bloque titulo="Telas" icon={<Sofa className="h-4 w-4" />}>
          <TelasProducto p={p} onZoom={(url, alt) => setZoom({ url, alt })} />
        </Bloque>

        {/* 6 · Extras (tapetes / colgadores) */}
        <Bloque titulo="Extras" icon={<Anchor className="h-4 w-4" />}>
          <div className="flex flex-wrap gap-2">
            {!llevaTapetes && !llevaColgador && (
              <span className="rounded-full bg-slate-100 px-3 py-1.5 text-sm text-slate-500">Sin extras</span>
            )}
            {llevaTapetes && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-700">
                <PackageCheck className="h-4 w-4" /> Tapetes para el suelo
              </span>
            )}
            {llevaColgador && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-700">
                <Anchor className="h-4 w-4" /> Colgadores
              </span>
            )}
          </div>
        </Bloque>

        {/* 7 · Fechas */}
        <Bloque titulo="Fechas" icon={<Calendar className="h-4 w-4" />}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Detalle icon={<Calendar className="h-4 w-4" />} label="Entrega al cliente"
              valor={p.fechaLimite ? formatShortDate(p.fechaLimite) : "—"} />
            <Detalle icon={<Truck className="h-4 w-4" />} label="Recogida por Juan (taller)"
              valor={p.fechaRecogida ? formatShortDate(p.fechaRecogida) : "—"} />
          </div>
        </Bloque>

        {/* 8 · Etiqueta de envío (solo lectura para el tapicero) */}
        <Bloque titulo="Etiqueta de envío" icon={<Truck className="h-4 w-4" />}>
          {etiquetas.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 py-4 text-center text-sm text-slate-400">Sin etiqueta de envío</div>
          ) : (
            <div className="space-y-2">
              {etiquetas.map((a) => (
                <a key={a.id} href={a.url} target="_blank" rel="noreferrer"
                  className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-medium text-slate-800 active:bg-slate-100">
                  <Truck className="h-5 w-5 text-slate-500" />
                  <span className="min-w-0 flex-1 truncate">{a.nombre}</span>
                  {a.transportista && <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[11px] uppercase text-slate-600">{a.transportista}</span>}
                  <Download className="h-4 w-4 text-blue-600" />
                </a>
              ))}
            </div>
          )}
        </Bloque>

        {/* Notas */}
        {(p.notasProducto || p.notasPedido) && (
          <div className="flex gap-2 rounded-2xl bg-amber-50 p-4 text-sm text-amber-900">
            <StickyNote className="h-4 w-4 shrink-0" />
            <div className="whitespace-pre-wrap">{[p.notasProducto, p.notasPedido].filter(Boolean).join("\n")}</div>
          </div>
        )}

        {/* Histórico de acciones del tapicero */}
        {(p.telaEstado === "recibida" || p.terminado) && (
          <div className="space-y-1 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
            {p.telaEstado === "recibida" && (
              <div>Tela recibida{p.telaEstadoFecha ? ` el ${formatShortDate(p.telaEstadoFecha.slice(0, 10))}` : ""}{p.telaEstadoPor ? ` por ${p.telaEstadoPor}` : ""}.</div>
            )}
            {p.terminado && (
              <div>Producto terminado{p.terminadoFecha ? ` el ${formatShortDate(p.terminadoFecha.slice(0, 10))}` : ""}{p.terminadoPor ? ` por ${p.terminadoPor}` : ""}.</div>
            )}
          </div>
        )}
      </main>

      {/* 9 · Acciones fijas abajo */}
      <AccionesTapicero p={p} onDone={refetch} />

      {/* Lightbox */}
      {zoom && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={() => setZoom(null)}>
          <button type="button" aria-label="Cerrar" className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20">
            <X className="h-5 w-5" />
          </button>
          <img src={zoom.url} alt={zoom.alt} className="max-h-full max-w-full rounded-lg object-contain" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
}

function AccionesTapicero({ p, onDone }: { p: PanelPedido; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  async function marca(op: "tela_recibida" | "terminado", valor = true) {
    setBusy(true);
    const ok = await accionTapicero(op, p.id, valor);
    setBusy(false);
    if (ok) { toast.success("Hecho ✅"); void onDone(); } else toast.error("No se pudo guardar.");
  }
  const telaRecibida = p.telaEstado === "recibida";
  return (
    <div className="fixed bottom-0 left-0 right-0 z-20 border-t border-slate-200 bg-white p-3">
      <div className="mx-auto flex max-w-2xl gap-2">
        <button disabled={busy} onClick={() => marca("tela_recibida", !telaRecibida)}
          className={`flex-1 rounded-xl px-3 py-3.5 text-sm font-bold ${telaRecibida ? "border border-emerald-300 bg-emerald-50 text-emerald-700" : "bg-emerald-600 text-white"} disabled:opacity-50`}>
          {telaRecibida ? "✓ Tela recibida" : "He recibido la tela"}
        </button>
        <button disabled={busy} onClick={() => marca("terminado", !p.terminado)}
          className={`flex-1 rounded-xl px-3 py-3.5 text-sm font-bold ${p.terminado ? "border border-slate-300 bg-slate-100 text-slate-600" : "bg-[#1a1f36] text-white"} disabled:opacity-50`}>
          {p.terminado ? "✓ Terminado" : "Pedido terminado"}
        </button>
      </div>
    </div>
  );
}

// Telas del producto, adaptadas al tipo: solo se muestran los roles que
// aplican y que tienen tela asignada (no se deja el hueco vacío).
function TelasProducto({ p, onZoom }: { p: PanelPedido; onZoom: (url: string, alt: string) => void }) {
  const roles = telasDeProducto(p.tipo);
  const cards = roles
    .map((r) => ({ r, tela: p.telas.find((t) => t.rol.toLowerCase() === r.rol.toLowerCase()) }))
    // Frontal admite respaldo por texto (telaTexto) si no hay fila de tela.
    .filter(({ r, tela }) => {
      const tieneAlgo = tela && (tela.nombre || tela.fotoUrl || tela.mismaQueFrontal);
      return tieneAlgo || (r.rol === "Frontal" && !!p.telaTexto);
    });

  if (cards.length === 0) {
    return <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 py-4 text-center text-sm text-slate-400">Sin telas asignadas</div>;
  }

  return (
    <div className="grid grid-cols-1 gap-3">
      {cards.map(({ r, tela }) => (
        <TelaCard key={r.rol} label={etiquetaTela(p.tipo, r.rol)} tela={tela}
          fallback={r.rol === "Frontal" ? p.telaTexto : undefined} onZoom={onZoom} />
      ))}
    </div>
  );
}

function TelaCard({ label, tela, fallback, onZoom }: {
  label: string; tela: PanelTela | undefined; fallback?: string; onZoom: (url: string, alt: string) => void;
}) {
  const misma = tela?.mismaQueFrontal;
  const nombre = misma ? "Misma que el frontal" : (tela?.nombre || fallback || "—");
  const foto = tela?.fotoUrl;
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3">
      {foto ? (
        <button type="button" onClick={() => onZoom(foto, nombre)} className="shrink-0">
          <img src={foto} alt={nombre} loading="lazy" className="h-20 w-20 rounded-xl object-cover" />
        </button>
      ) : (
        <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-300">
          <Sofa className="h-6 w-6" />
        </div>
      )}
      <div className="min-w-0">
        <div className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</div>
        <div className="truncate text-lg font-bold text-slate-900">{nombre}</div>
        {!misma && tela?.coleccion && <div className="truncate text-xs text-slate-500">{tela.coleccion}</div>}
      </div>
    </div>
  );
}

function Bloque({ titulo, icon, children }: { titulo: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="mb-2.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
        <span className="text-slate-400">{icon}</span> {titulo}
      </div>
      {children}
    </div>
  );
}

function Detalle({ icon, label, valor }: { icon: React.ReactNode; label: string; valor: string }) {
  return (
    <div className="flex items-start gap-2">
      <span className="mt-0.5 text-slate-400">{icon}</span>
      <div className="min-w-0">
        <div className="text-[11px] uppercase tracking-wide text-slate-400">{label}</div>
        <div className="text-sm font-semibold text-slate-800">{valor || "—"}</div>
      </div>
    </div>
  );
}
