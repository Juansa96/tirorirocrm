import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, Download, PackageCheck, Ruler, Calendar, Scissors, Layers, Anchor, StickyNote, ImageOff } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { tipoLabelOf, displayModelo } from "@/lib/catalogo";
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

function FichaPanel() {
  const { id } = Route.useParams();
  const search = Route.useSearch();
  const { esTapicero, esEquipo, tapiceroId: miTapiceroId } = useAuth();
  const viendoId = esTapicero ? miTapiceroId : (search.tapicero ?? "");
  const { pedidos, refetch } = usePanelPedidos(viendoId || null);
  const p = (pedidos ?? []).find((x) => x.id === id);
  const backSearch = esEquipo && viendoId ? { tapicero: viendoId } : {};

  if (pedidos === null) return <div className="min-h-screen bg-slate-50 p-8 text-center text-slate-400">Cargando…</div>;
  if (!p) return (
    <div className="min-h-screen bg-slate-50 p-8 text-center">
      <p className="text-slate-500">Pedido no encontrado.</p>
      <Link to="/panel" search={backSearch} className="mt-4 inline-block text-sm text-blue-600">Volver</Link>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 pb-28">
      <header className="sticky top-0 z-10 flex items-center gap-2 border-b border-slate-200 bg-white px-4 py-3">
        <Link to="/panel" search={backSearch} className="text-slate-500"><ArrowLeft className="h-5 w-5" /></Link>
        <div className="min-w-0 flex-1 truncate text-lg font-bold text-slate-900">{tipoLabelOf(p.tipo)} {displayModelo(p.modelo)}</div>
      </header>

      <main className="mx-auto max-w-2xl space-y-4 px-4 py-4">
        {/* Silueta grande, sin textura */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <SiluetaProducto tipo={p.tipo} modelo={p.modelo} className="mx-auto h-44 w-auto" />
        </div>

        {/* Telas: frontal / lateral / vivo con foto y nombre */}
        <div className="grid grid-cols-1 gap-3">
          <TelaCard rol="Frontal" tela={buscaTela(p.telas, "Frontal")} />
          <TelaCard rol="Lateral" tela={buscaTela(p.telas, "Lateral")} />
          <TelaCard rol="Vivo" tela={buscaTela(p.telas, "Vivo")} />
        </div>

        {/* Detalles de fabricación */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Detalle icon={<Ruler className="h-4 w-4" />} label="Medidas" valor={[p.ancho, p.alto, p.fondo].filter((d): d is number => d != null && d > 0).join(" × ") + " cm"} />
            <Detalle icon={<Calendar className="h-4 w-4" />} label="Entrega" valor={p.fechaLimite ? `${formatShortDate(p.fechaLimite)} (${p.diasRestantes >= 0 ? p.diasRestantes + "d" : Math.abs(p.diasRestantes) + "d tarde"})` : "—"} />
            <Detalle icon={<Layers className="h-4 w-4" />} label="Vivo" valor={p.acabado === "vivo-doble" ? "Doble" : p.acabado === "vivo-simple" ? "Simple" : "—"} />
            <Detalle icon={<Anchor className="h-4 w-4" />} label="Montaje" valor={p.montaje === "colgar" ? "Colgar en pared" : p.montaje === "apoyar" ? "Apoyar en suelo" : "—"} />
            <Detalle icon={<PackageCheck className="h-4 w-4" />} label="Estado tela" valor={p.telaEstado === "recibida" ? "Recibida" : p.telaEstado === "enviada" ? "Enviada" : "Pendiente"} />
            <Detalle icon={<Calendar className="h-4 w-4" />} label="Asignado" valor={p.fechaAsignacion ? formatShortDate(p.fechaAsignacion.slice(0, 10)) : "—"} />
          </div>
          {(p.notasProducto || p.notasPedido) && (
            <div className="mt-3 flex gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
              <StickyNote className="h-4 w-4 shrink-0" />
              <div className="whitespace-pre-wrap">{[p.notasProducto, p.notasPedido].filter(Boolean).join("\n")}</div>
            </div>
          )}
        </div>

        {/* Descargas */}
        {p.archivos.length > 0 && (
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Descargas</div>
            <div className="space-y-2">
              {p.archivos.map((a) => (
                <a key={a.id} href={a.url} target="_blank" rel="noreferrer"
                  className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-medium text-slate-800 active:bg-slate-100">
                  {a.tipo === "plantilla" ? <Scissors className="h-5 w-5 text-slate-500" /> : <Download className="h-5 w-5 text-slate-500" />}
                  <span className="min-w-0 flex-1 truncate">{a.nombre}</span>
                  <span className="text-[11px] text-slate-400">{a.createdAt ? formatShortDate(a.createdAt.slice(0, 10)) : ""}</span>
                  <Download className="h-4 w-4 text-blue-600" />
                </a>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Acciones fijas abajo */}
      <AccionesTapicero p={p} onDone={refetch} />
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

function buscaTela(telas: PanelTela[], rol: string): PanelTela | undefined {
  return telas.find((t) => (t.rol || "").toLowerCase() === rol.toLowerCase());
}

function TelaCard({ rol, tela }: { rol: string; tela: PanelTela | undefined }) {
  const label = rol === "Frontal" ? "Tela frontal" : rol === "Lateral" ? "Tela lateral" : "Tela del vivo";
  const misma = tela?.mismaQueFrontal;
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3">
      {tela?.fotoUrl ? (
        <img src={tela.fotoUrl} alt="" className="h-20 w-20 shrink-0 rounded-xl object-cover" />
      ) : (
        <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-300"><ImageOff className="h-6 w-6" /></div>
      )}
      <div className="min-w-0">
        <div className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</div>
        <div className="truncate text-lg font-bold text-slate-900">
          {misma ? "Misma que el frontal" : (tela?.nombre || "—")}
        </div>
        {tela && !tela.fotoUrl && !misma && <div className="text-[11px] text-amber-600">sin foto</div>}
      </div>
    </div>
  );
}

function Detalle({ icon, label, valor }: { icon: React.ReactNode; label: string; valor: string }) {
  return (
    <div className="flex items-start gap-2">
      <span className="mt-0.5 text-slate-400">{icon}</span>
      <div>
        <div className="text-[11px] uppercase tracking-wide text-slate-400">{label}</div>
        <div className="text-sm font-semibold text-slate-800">{valor || "—"}</div>
      </div>
    </div>
  );
}
