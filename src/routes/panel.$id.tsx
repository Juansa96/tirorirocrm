import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useRef } from "react";
import {
  ArrowLeft, Download, Scissors, Truck, Image as ImageIcon, X, ZoomIn, Camera, Printer,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import {
  displayNombreProducto, telasDeProducto, etiquetaTela,
} from "@/lib/catalogo";
import { formatShortDate } from "@/lib/format";
import { SiluetaProducto } from "@/components/SiluetaProducto";
import { usePanelPedidos, accionTapicero, subirFotoTerminado, type PanelPedido, type PanelTela } from "@/lib/panel-data";
import { toast } from "sonner";

interface Search { tapicero?: string; }

export const Route = createFileRoute("/panel/$id")({
  head: () => ({ meta: [{ title: "Pedido — Mi taller" }] }),
  validateSearch: (s: Record<string, unknown>): Search => ({ tapicero: s.tapicero ? String(s.tapicero) : undefined }),
  component: FichaPanel,
});

function plazoBadge(d: number, entregado: boolean) {
  if (entregado) return { bg: "bg-slate-100", text: "text-slate-500", label: "Entregado" };
  if (d < 0) return { bg: "bg-rose-100", text: "text-rose-700", label: `${Math.abs(d)}d tarde` };
  if (d <= 3) return { bg: "bg-amber-100", text: "text-amber-700", label: d === 0 ? "Hoy" : `${d}d` };
  return { bg: "bg-emerald-100", text: "text-emerald-700", label: `${d}d` };
}
function FichaPanel() {
  const { id } = Route.useParams();
  const search = Route.useSearch();
  const { esTapicero, esEquipo, tapiceroId: miTapiceroId } = useAuth();
  const viendoId = esTapicero ? miTapiceroId : (search.tapicero ?? "");
  const { pedidos, refetch } = usePanelPedidos(viendoId || null, esTapicero);
  const p = (pedidos ?? []).find((x) => x.id === id);
  const backSearch = esEquipo && viendoId ? { tapicero: viendoId } : {};
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
  const montaje = p.montaje === "colgar" ? "Colgar en pared" : p.montaje === "apoyar" ? "Apoyar en suelo" : "";
  const extras = [/tapete/i.test(p.patas) && "Tapetes suelo", /colgador/i.test(p.patas) && "Colgadores"].filter(Boolean) as string[];

  const plantilla = p.archivos.filter((a) => a.tipo === "plantilla");
  const etiquetas = p.archivos.filter((a) => a.tipo === "etiqueta_envio" || a.tipo === "etiqueta_ctt");
  const referencia = p.archivos.filter((a) => a.tipo === "referencia");
  const fotosAcabado = p.archivos.filter((a) => a.tipo === "foto_terminado");

  return (
    <div className="min-h-screen bg-slate-50 pb-24 print:pb-0">
      <header className="sticky top-0 z-10 flex items-center gap-2 border-b border-slate-200 bg-white px-3 py-2 print:static">
        <Link to="/panel" search={backSearch} className="text-slate-500 print:hidden"><ArrowLeft className="h-5 w-5" /></Link>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            {p.numero != null && <span className="shrink-0 rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-bold text-white">Nº {p.numero}</span>}
            <div className="truncate text-base font-bold text-slate-900">{displayNombreProducto(p.tipo, p.modelo)}</div>
          </div>
          {p.cliente && <div className="truncate text-[11px] text-slate-500">{p.cliente}</div>}
        </div>
        <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-bold leading-none ${plazo.bg} ${plazo.text}`}>{plazo.label}</span>
        <button type="button" onClick={() => window.print()} title="Imprimir / Guardar PDF"
          className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50 print:hidden">
          <Printer className="h-3.5 w-3.5" />
        </button>
      </header>

      <main className="mx-auto max-w-4xl space-y-3 px-3 py-3 text-sm print:space-y-2 print:py-1">
        <div className="grid gap-3 lg:grid-cols-2 print:grid-cols-2 print:gap-2">
          {/* 1 · Producto: datos + forma (pequeña) */}
          <section className="rounded-xl border border-slate-200 bg-white p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Producto</h2>
              {p.numero != null && <span className="inline-flex items-center whitespace-nowrap rounded-full bg-slate-800 px-2 py-0.5 text-[11px] font-bold leading-none text-white">Nº {p.numero}</span>}
            </div>
            <div className="flex gap-3">
              <div className="h-20 w-20 shrink-0 rounded-lg border border-slate-100 bg-slate-50 p-1.5">
                <SiluetaProducto tipo={p.tipo} modelo={p.modelo} className="h-full w-full" />
              </div>
              <dl className="min-w-0 flex-1 space-y-1">
                <Dato k="Producto" v={displayNombreProducto(p.tipo, p.modelo)} />
                <Dato k="Medidas" v={medidas ? medidas + " cm" : "Medidas sin poner"} />
                <Dato k="Cliente" v={p.cliente || "—"} />
                <Dato k="Tapicero" v={p.tapiceroNombre || "Sin asignar"} />
                {montaje && <Dato k="Montaje" v={montaje} />}
              </dl>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-1.5 border-t border-slate-100 pt-2 text-[11px]">
              <span className="text-slate-400">Entrega cliente:</span>
              <span className="font-semibold text-slate-700">{p.fechaLimite ? formatShortDate(p.fechaLimite) : "—"}</span>
              <span className="ml-2 text-slate-400">Lo recoge Juan:</span>
              <span className="font-semibold text-slate-700">{p.fechaRecogida ? formatShortDate(p.fechaRecogida) : "—"}</span>
            </div>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {extras.length === 0 ? (
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500">Sin extras</span>
              ) : extras.map((e) => (
                <span key={e} className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">{e}</span>
              ))}
            </div>
          </section>

          {/* 2 · Tapizado: cómo debe quedar + telas */}
          <section className="rounded-xl border border-slate-200 bg-white p-3">
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Tapizado</h2>
            {referencia.length > 0 ? (
              <button type="button" onClick={() => setZoom({ url: referencia[0].url, alt: "Cómo debe quedar" })}
                className="group relative mb-2 block w-full overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
                <img src={referencia[0].url} alt="Cómo debe quedar" loading="lazy" className="max-h-44 w-full object-contain" />
                <span className="absolute right-1.5 top-1.5 inline-flex items-center gap-1 rounded-full bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white print:hidden">
                  <ZoomIn className="h-3 w-3" /> Ampliar
                </span>
                <span className="absolute bottom-1.5 left-1.5 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white">Cómo debe quedar</span>
              </button>
            ) : (
              <div className="mb-2 flex items-center gap-1.5 rounded-lg border border-dashed border-slate-200 bg-slate-50 px-2 py-1.5 text-[11px] text-slate-400">
                <ImageIcon className="h-3.5 w-3.5" /> Sin imagen de referencia
              </div>
            )}
            <TelasProducto p={p} onZoom={(url, alt) => setZoom({ url, alt })} />
          </section>
        </div>

        {/* 3 · Documentos */}
        <section className="rounded-xl border border-slate-200 bg-white p-3">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Documentos</h2>
          <div className="grid gap-2 sm:grid-cols-2">
            <DocSlot icon={<Scissors className="h-4 w-4 text-slate-500" />} titulo="Plantilla de corte" archivos={plantilla} vacio="Sin plantilla subida" />
            <DocSlot icon={<Truck className="h-4 w-4 text-slate-500" />} titulo="Etiqueta de envío (lo recoge el transportista)" archivos={etiquetas} vacio="Sin etiqueta · lo recoge Juan" mostrarTransportista />
          </div>
        </section>

        {/* Comentarios para el tapicero (dirección de tela, etc.). NO se muestran
            las notas internas del pedido/producto. */}
        {p.notaTapicero && (
          <section className="rounded-xl border border-amber-200 bg-amber-50/60 p-3 text-[13px] text-amber-900">
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-amber-700">Indicaciones</div>
            <div className="whitespace-pre-wrap">{p.notaTapicero}</div>
          </section>
        )}

        {/* Histórico + foto del acabado (no salen en el PDF) */}
        <section className="space-y-2 print:hidden">
          {(p.telaEstado === "recibida" || p.terminado) && (
            <div className="rounded-xl border border-slate-200 bg-white p-3 text-[13px] text-slate-600">
              {p.telaEstado === "recibida" && (
                <div>Tela recibida{p.telaEstadoFecha ? ` el ${formatShortDate(p.telaEstadoFecha.slice(0, 10))}` : ""}{p.telaEstadoPor ? ` por ${p.telaEstadoPor}` : ""}.</div>
              )}
              {p.terminado && (
                <div>Terminado{p.terminadoFecha ? ` el ${formatShortDate(p.terminadoFecha.slice(0, 10))}` : ""}{p.terminadoPor ? ` por ${p.terminadoPor}` : ""}.</div>
              )}
            </div>
          )}
          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <Camera className="h-3.5 w-3.5" /> Foto del acabado <span className="font-normal normal-case text-slate-400">(opcional)</span>
            </div>
            <FotoTerminado pedidoId={p.id} fotos={fotosAcabado} onDone={refetch} onZoom={(url) => setZoom({ url, alt: "Producto terminado" })} />
          </div>
        </section>
      </main>

      <AccionesTapicero p={p} onDone={refetch} />

      {zoom && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={() => setZoom(null)}>
          <button type="button" aria-label="Cerrar" className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"><X className="h-5 w-5" /></button>
          <img src={zoom.url} alt={zoom.alt} className="max-h-full max-w-full rounded-lg object-contain" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
}

function Dato({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex gap-2">
      <dt className="w-20 shrink-0 text-[11px] uppercase tracking-wide text-slate-400">{k}</dt>
      <dd className="min-w-0 flex-1 truncate font-semibold text-slate-800">{v || "—"}</dd>
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
    <div className="fixed bottom-0 left-0 right-0 z-20 border-t border-slate-200 bg-white p-2.5 print:hidden">
      <div className="mx-auto flex max-w-4xl gap-2">
        <button disabled={busy} onClick={() => marca("tela_recibida", !telaRecibida)}
          className={`flex-1 rounded-xl px-3 py-3 text-sm font-bold ${telaRecibida ? "border border-emerald-300 bg-emerald-50 text-emerald-700" : "bg-emerald-600 text-white"} disabled:opacity-50`}>
          {telaRecibida ? "✓ Tela recibida" : "He recibido la tela"}
        </button>
        <button disabled={busy} onClick={() => marca("terminado", !p.terminado)}
          className={`flex-1 rounded-xl px-3 py-3 text-sm font-bold ${p.terminado ? "border border-slate-300 bg-slate-100 text-slate-600" : "bg-[#1a1f36] text-white"} disabled:opacity-50`}>
          {p.terminado ? "✓ Terminado" : "Pedido terminado"}
        </button>
      </div>
    </div>
  );
}

// Telas adaptadas al tipo: solo los roles que aplican y tienen tela.
function TelasProducto({ p, onZoom }: { p: PanelPedido; onZoom: (url: string, alt: string) => void }) {
  const roles = telasDeProducto(p.tipo);
  // Se muestra un rol si es OBLIGATORIO (aunque falte la tela, para que se vea
  // el hueco — p. ej. en cabecero: frontal + lateral + ribete siempre) o si
  // tiene tela asignada. Los roles opcionales sin tela no se muestran.
  const cards = roles
    .map((r) => ({ r, tela: p.telas.find((t) => t.rol.toLowerCase() === r.rol.toLowerCase()) }))
    .filter(({ r, tela }) => {
      const tieneAlgo = !!(tela && (tela.nombre || tela.fotoUrl || tela.mismaQueFrontal)) || (r.rol === "Frontal" && !!p.telaTexto);
      return !r.opcional || tieneAlgo;
    });

  if (cards.length === 0) {
    return <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 py-3 text-center text-[11px] text-slate-400">Sin telas asignadas</div>;
  }
  return (
    <div className="space-y-2">
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
  const nombre = misma ? "Misma que la principal" : (tela?.nombre || fallback || "");
  const foto = tela?.fotoUrl;
  const falta = !nombre && !foto;
  // Hueco vacío evidente (en ámbar) para que se note que falta asignar la tela.
  if (falta) {
    return (
      <div className="flex items-center gap-2.5 rounded-lg border border-dashed border-amber-300 bg-amber-50/50 p-2">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md bg-amber-100 text-[9px] font-medium text-amber-700">Falta</div>
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-medium uppercase tracking-wide text-slate-400">{label}</div>
          <div className="font-semibold text-amber-700">Falta asignar</div>
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2.5 rounded-lg border border-slate-200 bg-white p-2">
      {foto ? (
        <button type="button" onClick={() => onZoom(foto, nombre)} className="shrink-0">
          <img src={foto} alt={nombre} loading="lazy" className="h-14 w-14 rounded-md object-cover" />
        </button>
      ) : (
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md bg-slate-100 text-[9px] text-slate-400">Sin foto</div>
      )}
      <div className="min-w-0 flex-1">
        <div className="text-[10px] font-medium uppercase tracking-wide text-slate-400">{label}</div>
        <div className="truncate font-bold text-slate-900">{nombre}</div>
        {!misma && tela?.coleccion && <div className="truncate text-[11px] text-slate-500">{tela.coleccion}</div>}
      </div>
    </div>
  );
}

function DocSlot({ icon, titulo, archivos, vacio, mostrarTransportista }: {
  icon: React.ReactNode; titulo: string; vacio: string; mostrarTransportista?: boolean;
  archivos: { id: string; nombre: string; url: string; transportista: string }[];
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
      <div className="mb-1 flex items-center gap-1.5 text-[11px] font-medium text-slate-500">{icon} {titulo}</div>
      {archivos.length === 0 ? (
        <div className="py-1 text-[11px] text-slate-400">{vacio}</div>
      ) : (
        <ul className="space-y-1">
          {archivos.map((a) => (
            <li key={a.id}>
              <a href={a.url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-[13px] font-medium text-blue-600 hover:underline">
                <Download className="h-3.5 w-3.5 shrink-0" />
                <span className="min-w-0 flex-1 truncate">{a.nombre}</span>
                {mostrarTransportista && a.transportista && <span className="rounded bg-slate-200 px-1 py-0.5 text-[10px] uppercase text-slate-600">{a.transportista}</span>}
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

interface PanelArchivoLike { id: string; url: string; }

// Foto (opcional) del acabado, subida por el tapicero vía ruta de servidor.
function FotoTerminado({ pedidoId, fotos, onDone, onZoom }: {
  pedidoId: string; fotos: PanelArchivoLike[]; onDone: () => void; onZoom: (url: string) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [subiendo, setSubiendo] = useState(false);
  async function subir(file: File) {
    setSubiendo(true);
    const ok = await subirFotoTerminado(pedidoId, file);
    setSubiendo(false);
    if (ok) { toast.success("Foto subida ✅"); void onDone(); } else toast.error("No se pudo subir la foto.");
  }
  return (
    <div className="flex items-center gap-2">
      {fotos.map((f) => (
        <button key={f.id} type="button" onClick={() => onZoom(f.url)} className="shrink-0 overflow-hidden rounded-md border border-slate-200">
          <img src={f.url} alt="Producto terminado" loading="lazy" className="h-12 w-12 object-cover" />
        </button>
      ))}
      <button type="button" disabled={subiendo} onClick={() => ref.current?.click()}
        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">
        <Camera className="h-4 w-4" /> {subiendo ? "Subiendo…" : fotos.length ? "Añadir foto" : "Subir foto"}
      </button>
      <input ref={ref} type="file" accept="image/*" capture="environment" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) void subir(f); if (ref.current) ref.current.value = ""; }} />
    </div>
  );
}
