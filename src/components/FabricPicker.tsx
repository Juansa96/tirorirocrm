import { useMemo, useState, useRef } from "react";
import { Search, Upload, X, ImageOff, Check } from "lucide-react";
import { useStore, actions } from "@/lib/store";
import { normNombreTela, type TelaBiblioteca } from "@/lib/types";

export interface TelaSel {
  nombreTela: string;
  telaFotoUrl: string;
  telaBibliotecaId: string;
  telaColeccion?: string;
}

// Selector de tela: busca en la biblioteca (web + subidas) y permite subir una
// nueva con foto. La foto se comprime antes de subir. Sin foto no bloquea.
export function FabricPicker({ label, value, onSelect }: {
  label: string;
  value: TelaSel | null;
  onSelect: (t: TelaSel) => void;
}) {
  const { telasWeb, telasBiblioteca } = useStore();
  const [abierto, setAbierto] = useState(false);
  const [q, setQ] = useState("");

  // Une web + biblioteca, sin duplicar por nombre normalizado (gana la subida).
  const todas = useMemo(() => {
    const map = new Map<string, TelaBiblioteca>();
    for (const t of telasWeb) map.set(normNombreTela(t.nombre), t);
    for (const t of telasBiblioteca) map.set(normNombreTela(t.nombre), t); // subidas pisan a web
    const arr = [...map.values()];
    const ql = normNombreTela(q);
    return (ql ? arr.filter((t) => normNombreTela(t.nombre).includes(ql)) : arr)
      .sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [telasWeb, telasBiblioteca, q]);

  function elegir(t: TelaBiblioteca) {
    onSelect({ nombreTela: t.nombre, telaFotoUrl: t.fotoUrl, telaBibliotecaId: t.origen === "subida" ? t.id : "", telaColeccion: t.coleccion ?? "" });
    setAbierto(false); setQ("");
  }

  return (
    <div>
      <div className="mb-1 text-xs font-medium text-slate-500">{label}</div>
      <button type="button" onClick={() => setAbierto(true)} className="flex w-full items-center gap-3 rounded-lg border border-slate-300 bg-white p-2 text-left hover:border-slate-400">
        {value?.telaFotoUrl ? (
          <img src={value.telaFotoUrl} alt="" className="h-12 w-12 shrink-0 rounded object-cover" />
        ) : (
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded bg-slate-100 text-slate-300"><ImageOff className="h-5 w-5" /></span>
        )}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-slate-800">{value?.nombreTela || "Elegir tela…"}</span>
          {value?.nombreTela && !value.telaFotoUrl && <span className="text-[11px] text-amber-600">sin foto</span>}
        </span>
      </button>

      {abierto && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 px-3 pt-[8vh]" onClick={() => setAbierto(false)}>
          <div className="flex max-h-[80vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
              <Search className="h-4 w-4 text-slate-400" />
              <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar tela por nombre…" className="flex-1 text-sm outline-none" />
              <button onClick={() => setAbierto(false)} className="text-slate-400 hover:text-slate-600"><X className="h-4 w-4" /></button>
            </div>
            <SubirTela onSubida={elegir} />
            <div className="grid grid-cols-3 gap-2 overflow-y-auto p-3 sm:grid-cols-4">
              {todas.map((t) => (
                <button key={t.id} onClick={() => elegir(t)} className="group flex flex-col items-center gap-1 rounded-lg border border-slate-100 p-1.5 hover:border-slate-300">
                  {t.fotoUrl ? (
                    <img src={t.fotoUrl} alt="" className="aspect-square w-full rounded object-cover" />
                  ) : (
                    <span className="flex aspect-square w-full items-center justify-center rounded bg-slate-100 text-slate-300"><ImageOff className="h-4 w-4" /></span>
                  )}
                  <span className="line-clamp-2 text-center text-[11px] leading-tight text-slate-600">{t.nombre}</span>
                </button>
              ))}
              {todas.length === 0 && <div className="col-span-full py-8 text-center text-sm text-slate-400">Sin resultados. Súbela arriba.</div>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SubirTela({ onSubida }: { onSubida: (t: TelaBiblioteca) => void }) {
  const [nombre, setNombre] = useState("");
  const [subiendo, setSubiendo] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function subir(conFoto: boolean) {
    if (!nombre.trim()) return;
    const file = conFoto ? fileRef.current?.files?.[0] ?? null : null;
    setSubiendo(true);
    let blob: Blob | null = null;
    if (file) { const { compressImage } = await import("@/lib/img"); blob = await compressImage(file); }
    const t = await actions.subirTela(nombre.trim(), blob);
    setSubiendo(false);
    if (t) { setNombre(""); if (fileRef.current) fileRef.current.value = ""; onSubida(t); }
  }

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 bg-slate-50 px-3 py-2">
      <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre de tela nueva" className="min-w-[120px] flex-1 rounded border border-slate-300 px-2 py-1.5 text-sm" />
      <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={() => void subir(true)} />
      <button type="button" disabled={!nombre.trim() || subiendo} onClick={() => fileRef.current?.click()} className="inline-flex items-center gap-1 rounded-lg bg-[#1a1f36] px-2.5 py-1.5 text-xs font-medium text-white disabled:opacity-40">
        <Upload className="h-3.5 w-3.5" /> {subiendo ? "Subiendo…" : "Foto"}
      </button>
      <button type="button" disabled={!nombre.trim() || subiendo} onClick={() => void subir(false)} title="Guardar sin foto" className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 disabled:opacity-40">
        <Check className="h-3.5 w-3.5" /> Sin foto
      </button>
    </div>
  );
}
