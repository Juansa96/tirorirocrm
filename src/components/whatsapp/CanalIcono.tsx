import { Instagram, Mail, MessageCircle } from "lucide-react";
import { CANAL_LABEL, type Canal } from "@/lib/whatsapp/canales";

// Icono y colores de cada canal de la bandeja de mensajes.
export const CANAL_ESTILO: Record<Canal, { avatar: string; chip: string; burbuja: string; hora: string; icono: string }> = {
  whatsapp: { avatar: "bg-emerald-100 text-emerald-700", chip: "bg-emerald-50 text-emerald-700 ring-emerald-200", burbuja: "bg-emerald-100 text-emerald-950", hora: "text-emerald-700/70", icono: "text-emerald-600" },
  instagram: { avatar: "bg-pink-100 text-pink-700", chip: "bg-pink-50 text-pink-700 ring-pink-200", burbuja: "bg-pink-100 text-pink-950", hora: "text-pink-700/70", icono: "text-pink-600" },
  email: { avatar: "bg-sky-100 text-sky-700", chip: "bg-sky-50 text-sky-700 ring-sky-200", burbuja: "bg-sky-100 text-sky-950", hora: "text-sky-700/70", icono: "text-sky-600" },
};

export function CanalIcono({ canal, className = "h-3.5 w-3.5" }: { canal: Canal; className?: string }) {
  const cls = `${className} ${CANAL_ESTILO[canal].icono}`;
  if (canal === "instagram") return <Instagram className={cls} aria-label="Instagram" />;
  if (canal === "email") return <Mail className={cls} aria-label="Email" />;
  return <MessageCircle className={cls} aria-label="WhatsApp" />;
}

export function CanalChip({ canal }: { canal: Canal }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ${CANAL_ESTILO[canal].chip}`}>
      <CanalIcono canal={canal} className="h-3 w-3" /> {CANAL_LABEL[canal]}
    </span>
  );
}
