// Hook compartido con la lógica de BORRADOR + GUARDADO EXPLÍCITO de un pedido.
// Extraído de la ficha del pedido (pedidos.$id.tsx) para poder reutilizar la
// misma edición de "asignación / producción" desde la ficha del cliente
// (clientes.$id.tsx) sin duplicar la lógica de guardado.
import { useCallback, useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { useStore, actions } from "@/lib/store";
import type { Pedido } from "@/lib/types";
import { telaToDraft, diffPedido, telasCambiadas, type TelaDraft } from "@/lib/pedido-form";
import { toast } from "sonner";

export interface PedidoDraftApi {
  pedido: Pedido;
  leadId: string | undefined;
  productoId: string | undefined;
  draft: Pedido;
  setDraft: Dispatch<SetStateAction<Pedido>>;
  patch: (p: Partial<Pedido>) => void;
  telasDraft: TelaDraft[];
  setTelasDraft: Dispatch<SetStateAction<TelaDraft[]>>;
  baseP: Pedido;
  dirty: boolean;
  saving: boolean;
  guardar: () => Promise<void>;
  descartar: () => void;
  guardarNumero: (v: string) => void;
  guardarSufijo: (v: string) => void;
}

// Devuelve null si el pedido no existe (borrado). El llamante debe manejarlo.
export function usePedidoDraft(pedidoId: string): PedidoDraftApi | null {
  const { pedidos, leads, productos, pedidoTelas } = useStore();

  const pedido = pedidos.find((p) => p.id === pedidoId);
  const lead = leads.find((l) => l.id === pedido?.leadId);
  const producto = productos.find((pr) => pr.id === pedido?.productoLeadId);
  const telasStore = useMemo(
    () => pedidoTelas.filter((t) => t.pedidoId === pedidoId).sort((a, b) => a.orden - b.orden),
    [pedidoTelas, pedidoId],
  );

  const [draft, setDraft] = useState<Pedido>(() => pedido as Pedido);
  const [telasDraft, setTelasDraft] = useState<TelaDraft[]>(() => telasStore.map(telaToDraft));
  const [baseP, setBaseP] = useState<Pedido>(() => pedido as Pedido);
  const [baseT, setBaseT] = useState<TelaDraft[]>(() => telasStore.map(telaToDraft));
  const [saving, setSaving] = useState(false);

  const patch = useCallback((p: Partial<Pedido>) => setDraft((prev) => ({ ...prev, ...p })), []);

  const pedidoDirty = useMemo(
    () => Object.keys(diffPedido(baseP, draft)).length > 0 || draft.numero !== baseP.numero || (draft.numeroSufijo ?? "") !== (baseP.numeroSufijo ?? ""),
    [baseP, draft],
  );
  const telasDirty = useMemo(() => telasCambiadas(baseT, telasDraft), [baseT, telasDraft]);
  const dirty = pedidoDirty || telasDirty;

  // Refresca desde el store (cambios externos) SOLO cuando no hay cambios sin
  // guardar, para no pisar lo que el usuario está editando.
  useEffect(() => {
    if (dirty || !pedido) return;
    const freshT = telasStore.map(telaToDraft);
    if (JSON.stringify(pedido) !== JSON.stringify(baseP) || JSON.stringify(freshT) !== JSON.stringify(baseT)) {
      setBaseP(pedido); setDraft(pedido);
      setBaseT(freshT); setTelasDraft(freshT);
    }
  }, [pedido, telasStore, dirty, baseP, baseT]);

  // Aviso al cerrar/recargar la pestaña con cambios sin guardar.
  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);

  const guardarNumero = useCallback((v: string) => {
    const n = parseInt(v, 10);
    if (Number.isFinite(n) && n > 0) setDraft((prev) => ({ ...prev, numero: n }));
  }, []);

  const guardarSufijo = useCallback((v: string) => {
    const suf = v.replace(/[^a-zA-Z]/g, "").slice(0, 2).toUpperCase();
    setDraft((prev) => ({ ...prev, numeroSufijo: suf }));
  }, []);

  const guardar = useCallback(async () => {
    if (saving || !pedido) return;
    setSaving(true);
    try {
      // 1) Número (validación de duplicado). No se permite dejarlo vacío desde aquí.
      if ((draft.numero !== baseP.numero || (draft.numeroSufijo ?? "") !== (baseP.numeroSufijo ?? "")) && draft.numero != null) {
        const ok = await actions.actualizarNumeroPedido(pedidoId, draft.numero, draft.numeroSufijo ?? "");
        if (!ok) { setDraft((prev) => ({ ...prev, numero: baseP.numero, numeroSufijo: baseP.numeroSufijo })); setSaving(false); return; }
      }
      // 2) Resto de campos del pedido
      const patchP = diffPedido(baseP, draft) as Record<string, unknown>;
      if (patchP.telaEstado !== undefined) {
        patchP.telaEstadoPor = "equipo";
        patchP.telaEstadoFecha = new Date().toISOString();
      }
      if (patchP.terminadoTapicero === false) {
        patchP.terminadoTapiceroPor = "";
        patchP.terminadoTapiceroFecha = "";
      }
      if (Object.keys(patchP).length > 0) await actions.updatePedido(pedidoId, patchP as Partial<Pedido>);
      // 3) Telas (diff create/update/delete)
      if (telasCambiadas(baseT, telasDraft)) {
        const ok = await actions.guardarTelasPedido(pedidoId, telasDraft);
        if (!ok) { setSaving(false); return; }
      }
      // 4) Nueva base = lo guardado
      setBaseP({ ...draft });
      setBaseT(telasDraft.map((t) => ({ ...t })));
      toast.success("Pedido guardado.");
    } finally {
      setSaving(false);
    }
  }, [saving, pedido, draft, baseP, baseT, telasDraft, pedidoId]);

  const descartar = useCallback(() => {
    setDraft(baseP);
    setTelasDraft(baseT.map((t) => ({ ...t })));
  }, [baseP, baseT]);

  if (!pedido) return null;

  return {
    pedido, leadId: lead?.id, productoId: producto?.id,
    draft, setDraft, patch, telasDraft, setTelasDraft, baseP,
    dirty, saving, guardar, descartar, guardarNumero, guardarSufijo,
  };
}
