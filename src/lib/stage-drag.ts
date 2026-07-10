import type React from "react";
import { useRef } from "react";

// ─────────────────────────────────────────────────────────────────────────
// Arrastre táctil de tarjetas entre columnas del pipeline con "long-press".
//
// Bug que resuelve: en móvil el tablero se desplaza (scroll horizontal). Con el
// patrón anterior, CUALQUIER toque armaba el arrastre y, al levantar el dedo
// sobre otra columna tras un scroll o un tap, se cambiaba la etapa del lead sin
// querer — típicamente a "On Hold" (columna central). Los leads "se pasaban a
// On Hold solos".
//
// Solución: el arrastre solo se ARMA tras mantener pulsado ~300 ms sin mover el
// dedo. Un tap o un scroll cancela el armado, así que nunca cambia la etapa.
// El objetivo se guarda en el ref (no en el closure) para evitar estados viejos.
// ─────────────────────────────────────────────────────────────────────────

const LONG_PRESS_MS = 300;
const MOVE_CANCEL_PX = 10;

interface TouchDragState {
  id: string | null;
  armed: boolean;
  timer: ReturnType<typeof setTimeout> | null;
  x: number;
  y: number;
  over: string | null;
}

export function useTouchStageDrag<T extends string>(
  setDragOver: (etapa: T | null) => void,
  setDragging: (id: string | null) => void,
  commit: (leadId: string, etapa: T) => void,
) {
  const ref = useRef<TouchDragState>({ id: null, armed: false, timer: null, x: 0, y: 0, over: null });

  function reset() {
    if (ref.current.timer) clearTimeout(ref.current.timer);
    ref.current = { id: null, armed: false, timer: null, x: 0, y: 0, over: null };
    setDragOver(null);
    setDragging(null);
  }

  // Devuelve los handlers táctiles para una tarjeta concreta.
  return (leadId: string, currentEtapa: T) => ({
    onTouchStart: (e: React.TouchEvent) => {
      const t = e.touches[0];
      if (ref.current.timer) clearTimeout(ref.current.timer);
      ref.current = { id: leadId, armed: false, timer: null, x: t.clientX, y: t.clientY, over: null };
      ref.current.timer = setTimeout(() => {
        ref.current.armed = true;
        setDragging(leadId);
      }, LONG_PRESS_MS);
    },
    onTouchMove: (e: React.TouchEvent) => {
      if (!ref.current.id) return;
      const t = e.touches[0];
      if (!ref.current.armed) {
        // Movió antes de armar → es scroll o tap: cancela (no cambia etapa).
        if (Math.abs(t.clientX - ref.current.x) > MOVE_CANCEL_PX || Math.abs(t.clientY - ref.current.y) > MOVE_CANCEL_PX) {
          reset();
        }
        return;
      }
      const el = document.elementFromPoint(t.clientX, t.clientY);
      const over = (el?.closest("[data-etapa]")?.getAttribute("data-etapa") ?? null) as T | null;
      ref.current.over = over;
      setDragOver(over);
    },
    onTouchEnd: () => {
      const { armed, id, over } = ref.current;
      if (armed && id && over && over !== currentEtapa) {
        commit(id, over as T);
      }
      reset();
    },
  });
}
