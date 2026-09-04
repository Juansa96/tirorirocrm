// ─────────────────────────────────────────────────────────────────────────────
// Correo de entrega al cliente ("ya está en casa").
//
// Se propone al equipo cuando un pedido pasa a ENTREGADO; nunca sale solo.
// Este módulo no toca la base de datos: genera el texto por defecto (que el
// equipo puede retocar antes de enviar), el HTML del correo y la versión para
// WhatsApp. Lo usan la ficha del pedido (vista previa) y la ruta de servidor
// /api/pedidos/email-entrega (envío), así que los dos ven exactamente lo mismo.
//
// Decisiones (se cambian aquí, en una línea):
//   · Enlace de reseña: el mismo que usa la web. Cuando exista el enlace corto
//     de Google Business (g.page/r/…/review), va aquí.
//   · Premio: 10 % de descuento en el siguiente pedido.
//   · Remitente: hola@notify.tirorirohome.com (dominio ya verificado). El
//     sistema no permite "responder a", así que la dirección de contacto va en
//     el cuerpo.
// ─────────────────────────────────────────────────────────────────────────────
import { displayNombreProducto } from "./catalogo";

export const ENTREGA_REVIEW_URL = "https://www.google.com/search?q=Tiroriro+Home+opiniones";
export const ENTREGA_WHATSAPP = "660 786 453";
export const ENTREGA_WHATSAPP_INTL = "34660786453";
export const ENTREGA_PREMIO = "un 10 % de descuento";
export const ENTREGA_CONTACTO = "info@tirorirohome.com";
export const ENTREGA_FROM = "Tiroriro Home <hola@notify.tirorirohome.com>";
export const ENTREGA_SENDER_DOMAIN = "notify.tirorirohome.com";
export const ENTREGA_TEMPLATE = "entrega_cliente"; // etiqueta en email_send_log
export const ETIQUETA_RESENA_PEDIDA = "reseña pedida";

// "Cabecero Calobra" → "tu cabecero Calobra"; varias unidades → "tu pedido".
export function nombreProductoParaCliente(tipo: string, modelo: string, cantidad = 1): string {
  if (cantidad > 1) return "tu pedido";
  const n = displayNombreProducto(tipo, modelo);
  if (!n || n === "Producto") return "tu pedido";
  return "tu " + n.charAt(0).toLowerCase() + n.slice(1);
}

// Solo el nombre de pila, para el saludo.
export function nombreDePila(nombre: string): string {
  return (nombre || "").trim().split(/\s+/)[0] || "";
}

// "tu mesa de centro" → "una mesa"; "tu cabecero Calobra" → "un cabecero".
function enUno(prod: string): string {
  if (prod === "tu pedido") return "una caja";
  const palabra = prod.replace(/^tu /, "").split(" ")[0];
  return (/a$/.test(palabra) ? "una " : "un ") + palabra;
}

export interface EmailEntregaTexto { asunto: string; texto: string; }

// Texto por defecto en texto plano. Los párrafos van separados por línea en
// blanco; "[Escribir la reseña]" se convierte en botón en el HTML.
export function textoEmailEntrega(opts: { nombre: string; tipo: string; modelo: string; cantidad?: number }): EmailEntregaTexto {
  const pila = nombreDePila(opts.nombre);
  const prod = nombreProductoParaCliente(opts.tipo, opts.modelo, opts.cantidad ?? 1);
  const Prod = prod.charAt(0).toUpperCase() + prod.slice(1);
  const asunto = "Ya está en casa. Ahora, a disfrutarlo.";
  const texto = [
    `Hola${pila ? ", " + pila : ""}:`,
    `${Prod} ya está en casa. A partir de aquí la parte difícil es tuya: disfrutarlo.`,
    `Lo hemos hecho a mano, con calma y con bastantes más ganas de las que caben en ${enUno(prod)}. Esperamos que cada vez que lo mires pienses que acertaste.`,
    `Somos cuatro y acabamos de empezar. Hay dos cosas que nos ayudan más que cualquier anuncio, y las dos te llevan menos de cinco minutos:`,
    `1. Una reseña en Google. Dos frases bastan; cuentan más de lo que parece.\n[Escribir la reseña]`,
    `2. Una foto bonita de ${prod} ya colocado, para nuestro Instagram. Nos la mandas respondiendo a ${ENTREGA_CONTACTO} o por WhatsApp al ${ENTREGA_WHATSAPP}.`,
    `Si haces las dos, tu próximo pedido lleva ${ENTREGA_PREMIO}. Sin letra pequeña: nos lo recuerdas al pedir y ya está.`,
    `Gracias por confiar en nosotros cuando todavía éramos casi un secreto.`,
    `Bea, Rocío, Iñaki y Juan\nTIRO·RIRO`,
  ].join("\n\n");
  return { asunto, texto };
}

// Versión corta para WhatsApp (la mayoría de clientes no tiene correo en el CRM).
export function textoWhatsAppEntrega(opts: { nombre: string; tipo: string; modelo: string; cantidad?: number }): string {
  const pila = nombreDePila(opts.nombre);
  const prod = nombreProductoParaCliente(opts.tipo, opts.modelo, opts.cantidad ?? 1);
  const Prod = prod.charAt(0).toUpperCase() + prod.slice(1);
  return `Hola${pila ? ", " + pila : ""} 👋 ${Prod} ya está en casa, ¡a disfrutarlo! Somos cuatro y acabamos de empezar: si te apetece dejarnos una reseña en Google (${ENTREGA_REVIEW_URL}) y mandarnos una foto ya colocado, tu próximo pedido lleva ${ENTREGA_PREMIO}. Gracias por confiar en nosotros.`;
}

function esc(s: string): string {
  return (s || "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));
}

// HTML del correo a partir del texto (por defecto o retocado por el equipo).
export function htmlEmailEntrega(texto: string): string {
  const parrafos = texto.replace(/\r\n/g, "\n").split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const cuerpo = parrafos.map((p) => {
    const lineas = p.split("\n").map((l) => {
      if (/^\[escribir la reseña\]$/i.test(l.trim())) {
        return `<a href="${ENTREGA_REVIEW_URL}" style="display:inline-block;margin-top:10px;background:#1a4b5b;color:#ffffff;text-decoration:none;padding:11px 20px;border-radius:999px;font-family:-apple-system,'Segoe UI',Roboto,sans-serif;font-size:15px;font-weight:600">Escribir la reseña</a>`;
      }
      if (/^TIRO·RIRO$/.test(l.trim())) return `<span style="letter-spacing:0.3em;font-size:12px;color:#7a8391;font-family:-apple-system,'Segoe UI',Roboto,sans-serif">TIRO·RIRO</span>`;
      return esc(l);
    });
    const firma = /^Bea, Rocío/.test(p);
    return `<p style="margin:0 0 18px;font-size:${firma ? 16 : 17}px;line-height:1.55;color:${firma ? "#4a5361" : "#1b2230"}">${lineas.join("<br>")}</p>`;
  }).join("");
  return `<!doctype html><html lang="es"><body style="margin:0;background:#f6f7f5;padding:24px 12px">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #dde1e4;border-radius:10px;padding:32px 28px;font-family:Georgia,'Times New Roman',serif">
    ${cuerpo}
    <p style="margin:26px 0 0;padding-top:14px;border-top:1px solid #ebeef0;font-family:-apple-system,'Segoe UI',Roboto,sans-serif;font-size:12.5px;line-height:1.5;color:#7a8391">Tiroriro Home · cabeceros y tapizados a medida, hechos a mano en España · <a href="https://tirorirohome.com" style="color:#1a4b5b">tirorirohome.com</a><br>¿Nos respondes? Escríbenos a <a href="mailto:${ENTREGA_CONTACTO}" style="color:#1a4b5b">${ENTREGA_CONTACTO}</a> o por WhatsApp al ${ENTREGA_WHATSAPP}.</p>
  </div></body></html>`;
}

// Texto plano alternativo (clientes de correo sin HTML).
export function plainEmailEntrega(texto: string): string {
  return texto.replace(/\[Escribir la reseña\]/gi, `Escribir la reseña: ${ENTREGA_REVIEW_URL}`) + `\n\n— Tiroriro Home · ${ENTREGA_CONTACTO} · WhatsApp ${ENTREGA_WHATSAPP}`;
}
