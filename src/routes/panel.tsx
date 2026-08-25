import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { LogOut, Hammer } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { tapiceroNombre } from "@/lib/types";

export const Route = createFileRoute("/panel")({
  head: () => ({ meta: [{ title: "Mi taller — Tiroriro" }] }),
  component: Panel,
});

// Panel del tapicero. Interfaz propia (sin el CRM) y sin cargar el store del
// equipo. El contenido real —lista de pedidos y ficha— llega en la Fase 3.
function Panel() {
  const { displayName, tapiceroId, signOut } = useAuth();
  const [nombre, setNombre] = useState(displayName);

  useEffect(() => {
    if (!tapiceroId) { setNombre(displayName); return; }
    let active = true;
    void supabase.from("tapiceros").select("nombre, apellido, activo, id, orden").eq("id", tapiceroId).maybeSingle()
      .then(({ data }) => { if (active && data) setNombre(tapiceroNombre(data) || displayName); });
    return () => { active = false; };
  }, [tapiceroId, displayName]);

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
        <div className="flex items-center gap-2 font-bold text-[#1a1f36]">
          <Hammer className="h-5 w-5" /> Mi taller
        </div>
        <button onClick={() => void signOut()} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50">
          <LogOut className="h-4 w-4" /> Salir
        </button>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-10 text-center">
        <h1 className="text-2xl font-bold text-slate-900">Hola{nombre ? `, ${nombre}` : ""} 👋</h1>
        <p className="mt-3 text-slate-500">
          Aquí verás tus pedidos con toda la información (forma, medidas, telas y fechas).
          Estamos terminando esta pantalla — muy pronto disponible.
        </p>
      </main>
    </div>
  );
}
