import { useEffect, useState } from "react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// Diálogo de confirmación del CRM, en sustitución de los `confirm()` / `prompt()`
// nativos del navegador (24 repartidos por la app, cada uno con su estilo y sin
// botón de tamaño táctil). Uso, desde cualquier manejador:
//
//   if (!(await confirmar({ titulo: "¿Eliminar este pedido?", peligroso: true }))) return;
//
// `pedirTexto` abre el mismo diálogo con un campo (p. ej. una contraseña) y
// devuelve el texto o null. Un solo host, montado en la raíz de la app.
export interface OpcionesConfirmar {
  titulo: string;
  texto?: string;
  aceptar?: string;      // etiqueta del botón principal (por defecto "Aceptar")
  cancelar?: string;     // etiqueta del secundario (por defecto "Cancelar")
  peligroso?: boolean;   // botón principal en rojo (borrar, revocar…)
}
interface OpcionesTexto extends OpcionesConfirmar {
  placeholder?: string;
  tipo?: "text" | "password";
  minimo?: number;       // longitud mínima del texto
}

type Peticion =
  | { kind: "confirm"; opts: OpcionesConfirmar; resolve: (ok: boolean) => void }
  | { kind: "prompt"; opts: OpcionesTexto; resolve: (v: string | null) => void };

let abrir: ((p: Peticion) => void) | null = null;

export function confirmar(opts: OpcionesConfirmar): Promise<boolean> {
  // Sin host montado (tests, SSR) cae al confirm nativo para no bloquear.
  if (!abrir) return Promise.resolve(typeof window !== "undefined" ? window.confirm([opts.titulo, opts.texto].filter(Boolean).join("\n\n")) : false);
  return new Promise((resolve) => abrir!({ kind: "confirm", opts, resolve }));
}
export function pedirTexto(opts: OpcionesTexto): Promise<string | null> {
  if (!abrir) return Promise.resolve(typeof window !== "undefined" ? window.prompt([opts.titulo, opts.texto].filter(Boolean).join("\n\n")) : null);
  return new Promise((resolve) => abrir!({ kind: "prompt", opts, resolve }));
}

export function ConfirmarHost() {
  const [pet, setPet] = useState<Peticion | null>(null);
  const [texto, setTexto] = useState("");
  useEffect(() => {
    abrir = (p) => { setTexto(""); setPet(p); };
    return () => { abrir = null; };
  }, []);
  if (!pet) return null;
  const o = pet.opts;
  const cerrar = (ok: boolean) => {
    if (pet.kind === "confirm") pet.resolve(ok);
    else pet.resolve(ok ? texto : null);
    setPet(null);
  };
  const minimo = pet.kind === "prompt" ? (pet.opts.minimo ?? 1) : 0;
  const puedeAceptar = pet.kind === "confirm" || texto.trim().length >= minimo;
  return (
    <AlertDialog open onOpenChange={(v) => { if (!v) cerrar(false); }}>
      <AlertDialogContent className="max-w-md rounded-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-base">{o.titulo}</AlertDialogTitle>
          {o.texto && <AlertDialogDescription className="whitespace-pre-line text-sm text-slate-600">{o.texto}</AlertDialogDescription>}
        </AlertDialogHeader>
        {pet.kind === "prompt" && (
          <input
            autoFocus
            type={pet.opts.tipo ?? "text"}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && puedeAceptar) cerrar(true); }}
            placeholder={pet.opts.placeholder}
            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-base focus:border-slate-500 focus:outline-none"
          />
        )}
        <AlertDialogFooter className="gap-2">
          <AlertDialogCancel onClick={() => cerrar(false)} className="min-h-11 rounded-lg">{o.cancelar ?? "Cancelar"}</AlertDialogCancel>
          <AlertDialogAction
            disabled={!puedeAceptar}
            onClick={() => cerrar(true)}
            className={`min-h-11 rounded-lg ${o.peligroso ? "bg-rose-600 text-white hover:bg-rose-700" : "bg-[#1a1f36] text-white hover:bg-[#2a2f46]"}`}
          >
            {o.aceptar ?? "Aceptar"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
