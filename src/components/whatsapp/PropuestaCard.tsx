import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Check, X, ArrowRight, UserPlus, Search, Sparkles, Ban } from "lucide-react";
import { useStore } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { StageBadge } from "@/components/StageBadge";
import { ClosedWonDialog } from "@/components/ClosedWonDialog";
import { ClosedLostDialog } from "@/components/ClosedLostDialog";
import { useWhatsapp, waActions } from "@/lib/whatsapp/store";
import { TIPO_PROPUESTA_LABEL, CAMPO_LABEL, formatTelefonoWa, tiempoRelativo, type WaPropuesta, type WaConversacion, type ProductoIA } from "@/lib/whatsapp/types";
import { TIPO_LABEL, normalizeTipo } from "@/lib/catalogo";
import { vendorName, type Etapa } from "@/lib/types";
import { formatShortDate } from "@/lib/format";

// ── Una propuesta de la IA con sus botones de Aceptar / Rechazar ────────────
// Aceptar pasa por las mismas acciones del CRM que un cambio a mano (y para
// Closed Won / Closed Lost abre los mismos diálogos que el pipeline).

function describirProductoIA(p: ProductoIA): string {
  const tipo = normalizeTipo(p.tipo) ?? "otro";
  const medidas = [p.ancho, p.alto, p.fondo].filter((n) => n != null).join("×");
  return [TIPO_LABEL[tipo], p.modelo, medidas ? `${medidas} cm` : "", p.tela ? `tela ${p.tela}` : "", p.color ? `color ${p.color}` : "", p.montaje ? (p.montaje === "colgar" ? "colgado" : "apoyado") : "", p.cantidad && p.cantidad > 1 ? `×${p.cantidad}` : "", p.precio ? `${p.precio} €` : ""]
    .filter(Boolean).join(" · ");
}

export function PropuestaCard({ p, conv, mostrarCliente = false }: { p: WaPropuesta; conv?: WaConversacion; mostrarCliente?: boolean }) {
  const { leads, productos } = useStore();
  const { email } = useAuth();
  const { config } = useWhatsapp();
  const [busy, setBusy] = useState(false);
  const [dialogo, setDialogo] = useState<"won" | "lost" | null>(null);
  const [buscar, setBuscar] = useState("");
  const usuario = email ?? "";
  const lead = p.leadId ? leads.find((l) => l.id === p.leadId) : undefined;
  const pl = p.payload;

  const candidatosBusqueda = useMemo(() => {
    const q = buscar.trim().toLowerCase();
    if (q.length < 2) return [];
    return leads.filter((l) => l.nombre.toLowerCase().includes(q) || l.telefono.toLowerCase().includes(q) || l.email.toLowerCase().includes(q)).slice(0, 6);
  }, [buscar, leads]);

  async function run(extra: Record<string, unknown> = {}) {
    setBusy(true);
    try { await waActions.aceptar(p, usuario, extra); } finally { setBusy(false); }
  }

  async function aceptar() {
    if (p.tipo === "cambiar_etapa") {
      const etapa = String(pl.etapa) as Etapa;
      if (etapa === "Closed Won") { setDialogo("won"); return; }
      if (etapa === "Closed Lost") { setDialogo("lost"); return; }
      return run();
    }
    if (p.tipo === "producto" && pl.accion === "editar") {
      const productoActual = productos.find((x) => x.id === String(pl.productoId));
      return run({ productoActual });
    }
    if (p.tipo === "tarea") return run({ vendedor: lead?.vendedor || usuario });
    return run();
  }

  async function rechazar() {
    setBusy(true);
    try { await waActions.rechazar(p, usuario); } finally { setBusy(false); }
  }

  async function crearNuevo() {
    if (!conv) return;
    setBusy(true);
    try { await waActions.crearCliente(conv, config?.vendedorDefecto || usuario); } finally { setBusy(false); }
  }

  const resuelta = p.estado !== "pendiente";

  let cuerpo: React.ReactNode = null;
  switch (p.tipo) {
    case "cambiar_etapa": {
      const desde = String(pl.desde ?? lead?.etapa ?? "");
      const etapa = String(pl.etapa) as Etapa;
      cuerpo = (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          {desde && <StageBadge etapa={desde as Etapa} />}
          <ArrowRight className="h-3.5 w-3.5 text-slate-400" />
          <StageBadge etapa={etapa} />
          {pl.venta_importe != null && <span className="text-xs text-slate-500">· {Number(pl.venta_importe)} €</span>}
          {pl.razon != null && <span className="text-xs text-slate-500">· {String(pl.razon)}</span>}
        </div>
      );
      break;
    }
    case "actualizar_campo":
      cuerpo = (
        <p className="text-sm text-slate-700">
          <span className="font-medium">{CAMPO_LABEL[String(pl.campo)] ?? String(pl.campo)}:</span>{" "}
          <span className="text-slate-400 line-through">{String(pl.actual ?? "—")}</span>{" "}
          <ArrowRight className="inline h-3.5 w-3.5 text-slate-400" /> <span className="font-semibold">{String(pl.nuevo ?? "")}</span>
        </p>
      );
      break;
    case "producto": {
      const prod = (pl.producto ?? {}) as ProductoIA;
      if (pl.accion === "crear") {
        cuerpo = <p className="text-sm text-slate-700"><span className="font-medium">Crear producto:</span> {describirProductoIA(prod)}</p>;
      } else {
        const cambios = (pl.cambios ?? {}) as Record<string, { de: unknown; a: unknown }>;
        const existe = productos.some((x) => x.id === String(pl.productoId));
        cuerpo = (
          <div className="text-sm text-slate-700">
            <span className="font-medium">Corregir producto:</span>
            <ul className="mt-1 space-y-0.5">
              {Object.entries(cambios).map(([k, v]) => (
                <li key={k}><span className="capitalize">{k}</span>: <span className="text-slate-400 line-through">{v.de == null || v.de === "" ? "—" : String(v.de)}</span> <ArrowRight className="inline h-3 w-3 text-slate-400" /> <span className="font-semibold">{String(v.a)}</span></li>
              ))}
            </ul>
            {!existe && !resuelta && <p className="mt-1 text-xs text-rose-600">El producto ya no existe en la ficha.</p>}
          </div>
        );
      }
      break;
    }
    case "tarea":
      cuerpo = <p className="text-sm text-slate-700"><span className="font-medium">Tarea:</span> {String(pl.descripcion ?? "")}{pl.fecha ? <span className="text-slate-500"> · {formatShortDate(String(pl.fecha))}</span> : null}</p>;
      break;
    case "nuevo_encargo":
      cuerpo = <p className="text-sm text-slate-700"><span className="font-medium">Nuevo encargo</span> de un cliente ya entregado: se crearía una ficha nueva con sus datos, en Discovery.</p>;
      break;
    case "vincular_lead": {
      const cands = (Array.isArray(pl.candidatos) ? pl.candidatos : []) as Array<{ id: string; nombre: string; etapa: string; ciudad: string; telefono: string }>;
      cuerpo = resuelta ? null : (
        <div className="space-y-2">
          {cands.length > 0 && (
            <ul className="space-y-1">
              {cands.map((c) => (
                <li key={c.id}>
                  <button disabled={busy} onClick={() => run({ leadId: c.id })} className="flex w-full flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-sm hover:border-emerald-400 hover:bg-emerald-50 disabled:opacity-50">
                    <Check className="h-3.5 w-3.5 text-emerald-600" />
                    <span className="font-medium">{c.nombre}</span>
                    {c.etapa && <StageBadge etapa={c.etapa as Etapa} />}
                    {c.ciudad && <span className="text-xs text-slate-500">{c.ciudad}</span>}
                    {c.telefono && <span className="text-xs text-slate-400">{c.telefono}</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <input value={buscar} onChange={(e) => setBuscar(e.target.value)} placeholder="Buscar otro cliente por nombre, teléfono o email…" className="w-full rounded-lg border border-slate-200 py-2 pl-8 pr-2 text-sm" />
          </div>
          {candidatosBusqueda.length > 0 && (
            <ul className="space-y-1">
              {candidatosBusqueda.map((l) => (
                <li key={l.id}>
                  <button disabled={busy} onClick={() => run({ leadId: l.id })} className="flex w-full flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-sm hover:border-emerald-400 hover:bg-emerald-50 disabled:opacity-50">
                    <span className="font-medium">{l.nombre}</span>
                    <StageBadge etapa={l.etapa} />
                    {l.ciudad && <span className="text-xs text-slate-500">{l.ciudad}</span>}
                    {l.telefono && <span className="text-xs text-slate-400">{l.telefono}</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {conv && (
            <button disabled={busy} onClick={() => void crearNuevo()} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">
              <UserPlus className="h-3.5 w-3.5" /> Es otra persona: crear cliente nuevo
            </button>
          )}
        </div>
      );
      break;
    }
  }

  return (
    <div className={`rounded-xl border p-3 ${resuelta ? "border-slate-100 bg-slate-50/60" : "border-amber-200 bg-amber-50/40"}`}>
      {dialogo === "won" && (
        <ClosedWonDialog
          importeInicial={pl.venta_importe == null ? undefined : Number(pl.venta_importe)}
          onCancel={() => setDialogo(null)}
          onConfirm={(ventaImporte, ventaFecha) => { setDialogo(null); void run({ ventaImporte, ventaFecha }); }}
        />
      )}
      {dialogo === "lost" && (
        <ClosedLostDialog
          onCancel={() => setDialogo(null)}
          onConfirm={(razon, comentario) => { setDialogo(null); void run({ razon, comentario }); }}
        />
      )}
      <div className="mb-1.5 flex flex-wrap items-center gap-2">
        <Sparkles className={`h-3.5 w-3.5 ${resuelta ? "text-slate-400" : "text-amber-500"}`} />
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">{TIPO_PROPUESTA_LABEL[p.tipo] ?? p.tipo}</span>
        {mostrarCliente && lead && (
          <Link to="/clientes/$id" params={{ id: lead.id }} className="text-xs font-medium text-[#1a4b5b] hover:underline">{lead.nombre}</Link>
        )}
        {mostrarCliente && !lead && conv && <span className="text-xs text-slate-500">{conv.nombreWa || formatTelefonoWa(conv.telefono)}</span>}
        <span className="ml-auto text-[11px] text-slate-400">{tiempoRelativo(p.createdAt)}</span>
      </div>
      {cuerpo}
      {p.motivo && <p className="mt-1.5 text-xs italic text-slate-500">“{p.motivo}”</p>}
      {resuelta ? (
        <p className="mt-2 text-[11px] text-slate-400">
          {p.estado === "aceptada" ? "Aceptada" : "Rechazada"}{p.resueltaPor ? ` por ${vendorName(p.resueltaPor)}` : ""}{p.resueltaAt ? ` · ${tiempoRelativo(p.resueltaAt)}` : ""}
        </p>
      ) : (
        <div className="mt-2 flex flex-wrap gap-2">
          {p.tipo !== "vincular_lead" && (
            <button disabled={busy} onClick={() => void aceptar()} className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
              <Check className="h-3.5 w-3.5" /> Aceptar
            </button>
          )}
          <button disabled={busy} onClick={() => void rechazar()} className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50">
            {p.tipo === "vincular_lead" ? <Ban className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />} {p.tipo === "vincular_lead" ? "Dejarlo así" : "Rechazar"}
          </button>
        </div>
      )}
    </div>
  );
}
