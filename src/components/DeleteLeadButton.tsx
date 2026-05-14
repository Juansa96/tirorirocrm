import { useState } from "react";
import { Trash2 } from "lucide-react";
import { actions } from "@/lib/store";
import { useNavigate } from "@tanstack/react-router";

export function DeleteLeadButton({
  id,
  variant = "button",
  redirectAfter = false,
}: {
  id: string;
  variant?: "button" | "menu";
  redirectAfter?: boolean;
}) {
  const navigate = useNavigate();
  const [confirming, setConfirming] = useState(false);

  async function doDelete(e: React.MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    await actions.deleteLead(id);
    if (redirectAfter) navigate({ to: "/clientes" });
  }

  if (confirming) {
    return (
      <div
        className="flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2 py-1"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="text-xs text-red-700">¿Eliminar?</span>
        <button
          onClick={doDelete}
          className="rounded bg-red-600 px-2 py-0.5 text-xs font-medium text-white hover:bg-red-700"
        >
          Sí
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setConfirming(false);
          }}
          className="rounded px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-100"
        >
          No
        </button>
      </div>
    );
  }

  if (variant === "menu") {
    return (
      <button
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          setConfirming(true);
        }}
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600"
        aria-label="Eliminar lead"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    );
  }

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        setConfirming(true);
      }}
      className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50"
    >
      <Trash2 className="h-4 w-4" /> Eliminar lead
    </button>
  );
}
