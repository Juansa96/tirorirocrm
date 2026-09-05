// ─────────────────────────────────────────────────────────────────────────────
// Correo de entrega al cliente.
//
// Se propone al equipo cuando un pedido pasa a ENTREGADO; nunca sale solo.
// Este módulo no toca la base de datos: genera el asunto y el mensaje personal
// por defecto (que el equipo puede retocar antes de enviar), el HTML del correo
// con la identidad de la web (paleta, tipografías, logo, foto del tipo de
// producto) y la versión para WhatsApp. Lo usan la ficha del pedido (vista
// previa) y la ruta de servidor /api/pedidos/email-entrega (envío).
//
// Decisiones (se cambian aquí, en una línea):
//   · Enlace de reseña: el enlace corto de la ficha de Google Business
//     (abre directamente el cuadro de escribir la reseña).
//   · Premio: 10 % de descuento en el siguiente pedido.
//   · Remitente: hola@notify.tirorirohome.com (dominio ya verificado). El
//     sistema no permite "responder a", así que la dirección de contacto va en
//     el cuerpo.
//   · Imágenes: se sirven desde la web (public/email/*), porque los clientes
//     de correo no pintan SVG en línea ni imágenes incrustadas de forma fiable.
//     Hay una foto por tipo de producto (producto-<tipo>.jpg, 1200×800).
// ─────────────────────────────────────────────────────────────────────────────
import { displayNombreProducto, normalizeTipo } from "./catalogo";

export const ENTREGA_REVIEW_URL = "https://g.page/r/Ces4vVtTbYFGEBM/review";
export const ENTREGA_WHATSAPP = "660 786 453";
export const ENTREGA_WHATSAPP_INTL = "34660786453";
export const ENTREGA_PREMIO = "un 10 % de descuento";
export const ENTREGA_PREMIO_CORTO = "10 %";
export const ENTREGA_CONTACTO = "info@tirorirohome.com";
export const ENTREGA_INSTAGRAM = "https://www.instagram.com/tirorirohome/";
export const ENTREGA_WEB = "https://tirorirohome.com";
export const ENTREGA_IMG_BASE = "https://tirorirohome.com/email";
export const ENTREGA_LOGO_URL = `${ENTREGA_IMG_BASE}/logo-tiroriro.png`;
export const ENTREGA_FROM = "Tiroriro Home <hola@notify.tirorirohome.com>";
export const ENTREGA_SENDER_DOMAIN = "notify.tirorirohome.com";
export const ENTREGA_TEMPLATE = "entrega_cliente"; // etiqueta en email_send_log
// Titular del correo (se cambia aquí).
export const ENTREGA_TITULAR = "Ojalá te guste tanto como a nosotros.";
export const ETIQUETA_RESENA_PEDIDA = "reseña pedida";

// Foto del correo según el tipo de producto entregado.
export function fotoProductoUrl(tipo: string): string {
  const k = normalizeTipo(tipo);
  const archivo: Record<string, string> = {
    cabecero: "producto-cabecero.jpg", banco: "producto-banco.jpg", puf: "producto-puf.jpg",
    mesa: "producto-mesa.jpg", pantalla: "producto-pantalla.jpg", cojin: "producto-almohadon.jpg",
  };
  return `${ENTREGA_IMG_BASE}/${(k && archivo[k]) || "hero-cabecero.jpg"}`;
}

// Paleta de la web (src/index.css de tirorirohome.com), en hex para el correo.
const C = {
  crema: "#F7F4EE",   // --background
  papel: "#FFFFFF",
  tinta: "#133A44",   // --foreground
  teal: "#1A4B5B",    // --accent-warm / --primary
  texto: "#3E4E55",
  suave: "#6F7F86",   // --muted-foreground
  linea: "#E8E4DE",
  arena: "#F5F0E8",   // cajas (misma que el correo de confirmación de la web)
  oro: "#A8824A",     // etiquetas pequeñas
};
const SERIF = "'Cormorant Garamond', Georgia, 'Times New Roman', serif";
const SANS = "Inter, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
const RADIO = "8px";

// "Cabecero Calobra" → "tu cabecero Calobra"; varias unidades → "tu pedido".
export function nombreProductoParaCliente(tipo: string, modelo: string, cantidad = 1): string {
  if (cantidad > 1) return "tu pedido";
  const n = displayNombreProducto(tipo, modelo);
  if (!n || n === "Producto") return "tu pedido";
  return "tu " + n.charAt(0).toLowerCase() + n.slice(1);
}

// Solo el nombre de pila, para el saludo y el asunto.
export function nombreDePila(nombre: string): string {
  return (nombre || "").trim().split(/\s+/)[0] || "";
}

export interface EmailEntregaDatos { nombre: string; tipo: string; modelo: string; cantidad?: number }
export interface EmailEntregaTexto { asunto: string; mensaje: string }

// Asunto: una pregunta con el nombre y el producto. Personal, concreta, y ya
// apunta a la foto que vamos a pedir.
export function asuntoEmailEntrega(d: EmailEntregaDatos): string {
  const pila = nombreDePila(d.nombre);
  const prod = nombreProductoParaCliente(d.tipo, d.modelo, d.cantidad ?? 1);
  return pila ? `${pila}, ¿cómo luce ${prod} en casa? ✦` : `¿Cómo luce ${prod} en casa? ✦`;
}

// Mensaje personal por defecto (la parte que el equipo puede retocar). El resto
// del correo (pasos, premio, pie) es fijo y va con el diseño de la web.
export function textoEmailEntrega(d: EmailEntregaDatos): EmailEntregaTexto {
  const pila = nombreDePila(d.nombre);
  const prod = nombreProductoParaCliente(d.tipo, d.modelo, d.cantidad ?? 1);
  const Prod = prod.charAt(0).toUpperCase() + prod.slice(1);
  const mensaje = [
    `Hola${pila ? ", " + pila : ""}:`,
    `${Prod} ya ha llegado a su sitio. Ahora viene lo fácil: disfrutarlo.`,
    `Lo hemos hecho a mano y con muchas ganas. Esperamos que cada vez que lo mires pienses que acertaste.`,
  ].join("\n\n");
  return { asunto: asuntoEmailEntrega(d), mensaje };
}

// Versión corta para WhatsApp (la mayoría de clientes no tiene correo en el CRM).
export function textoWhatsAppEntrega(d: EmailEntregaDatos): string {
  const pila = nombreDePila(d.nombre);
  const prod = nombreProductoParaCliente(d.tipo, d.modelo, d.cantidad ?? 1);
  const Prod = prod.charAt(0).toUpperCase() + prod.slice(1);
  return `Hola${pila ? ", " + pila : ""} 👋 ${Prod} ya ha llegado a su sitio, ¡a disfrutarlo! Somos cuatro y acabamos de empezar: si te apetece dejarnos una reseña en Google (${ENTREGA_REVIEW_URL}) y mandarnos una foto ya colocado, tu próximo pedido lleva ${ENTREGA_PREMIO}. Gracias por confiar en nosotros.`;
}

function esc(s: string): string {
  return (s || "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));
}

const P = `margin:0 0 14px;font-family:${SANS};font-size:16px;line-height:1.65;font-weight:300;color:${C.texto}`;
const ETIQUETA = `font-family:${SANS};font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:${C.oro};font-weight:500`;

function parrafosHtml(mensaje: string): string {
  return mensaje.replace(/\r\n/g, "\n").split(/\n{2,}/).map((p) => p.trim()).filter(Boolean)
    .map((p) => `<p style="${P}">${esc(p).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

// Botón: ancho completo en móvil (clase .btn), ajustado al texto en escritorio.
function boton(href: string, texto: string): string {
  return `<table role="presentation" class="btn" cellpadding="0" cellspacing="0" border="0" style="margin:14px 0 0"><tr><td bgcolor="${C.teal}" style="border-radius:${RADIO};background:${C.teal};text-align:center">
    <a href="${href}" style="display:block;padding:13px 24px;font-family:${SANS};font-size:13px;font-weight:500;letter-spacing:.06em;text-transform:uppercase;color:#ffffff;text-decoration:none">${texto}</a>
  </td></tr></table>`;
}

function paso(numero: string, titulo: string, texto: string, botonHtml: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 12px"><tr>
    <td bgcolor="${C.arena}" class="caja" style="background:${C.arena};border-radius:${RADIO};padding:20px 22px">
      <div style="${ETIQUETA};margin:0 0 6px">Paso ${numero}</div>
      <div style="font-family:${SERIF};font-size:24px;line-height:1.2;font-weight:500;color:${C.tinta};margin:0 0 6px">${titulo}</div>
      <div style="font-family:${SANS};font-size:15px;line-height:1.6;font-weight:300;color:${C.texto}">${texto}</div>
      ${botonHtml}
    </td>
  </tr></table>`;
}

// HTML completo del correo, con la identidad de la web. Pensado para móvil:
// una columna, márgenes de 24 px, botones a todo el ancho, logo pequeño.
export function htmlEmailEntrega(d: EmailEntregaDatos, mensaje: string): string {
  const prod = nombreProductoParaCliente(d.tipo, d.modelo, d.cantidad ?? 1);
  const preheader = `Gracias por confiar en nosotros. Un pequeño favor y ${ENTREGA_PREMIO} para tu próximo pedido.`;
  const waHref = `https://wa.me/${ENTREGA_WHATSAPP_INTL}?text=${encodeURIComponent("Hola, os mando la foto de " + prod + " ya en su sitio 🙂")}`;
  const lado = `border-left:1px solid ${C.linea};border-right:1px solid ${C.linea}`;
  return `<!doctype html>
<html lang="es"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="x-apple-disable-message-reformat">
<title>${esc(asuntoEmailEntrega(d))}</title>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500&family=Inter:wght@300;400;500&display=swap" rel="stylesheet">
<style>
  .btn{width:100%}
  @media only screen and (min-width:600px){ .btn{width:auto} .pad{padding-left:40px!important;padding-right:40px!important} .h1{font-size:38px!important} }
</style>
</head>
<body style="margin:0;padding:0;background:${C.crema};-webkit-font-smoothing:antialiased">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${C.crema}">${esc(preheader)}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.crema}" style="background:${C.crema}">
<tr><td align="center" style="padding:22px 12px 36px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px">

    <tr><td align="center" style="padding:4px 0 18px">
      <a href="${ENTREGA_WEB}" style="text-decoration:none"><img src="${ENTREGA_LOGO_URL}" width="120" alt="Tiroriro" style="display:block;width:120px;height:auto;border:0"></a>
    </td></tr>

    <tr><td>
      <img src="${fotoProductoUrl(d.tipo)}" width="600" alt="" style="display:block;width:100%;height:auto;border:0;border-radius:${RADIO} ${RADIO} 0 0">
    </td></tr>

    <tr><td class="pad" bgcolor="${C.papel}" style="background:${C.papel};padding:30px 24px 6px;${lado}">
      <div style="${ETIQUETA};margin:0 0 10px">Entregado</div>
      <div class="h1" style="font-family:${SERIF};font-size:32px;line-height:1.1;font-weight:400;color:${C.tinta};margin:0 0 18px">${esc(ENTREGA_TITULAR)}</div>
      ${parrafosHtml(mensaje)}
    </td></tr>

    <tr><td class="pad" bgcolor="${C.papel}" style="background:${C.papel};padding:8px 24px 4px;${lado}">
      <div style="height:1px;background:${C.linea};margin:0 0 24px"></div>
      <div style="font-family:${SERIF};font-size:24px;line-height:1.2;font-weight:500;color:${C.tinta};margin:0 0 6px">Somos cuatro y acabamos de empezar.</div>
      <p style="${P};margin-bottom:18px">Hay dos cosas que nos ayudan más que cualquier anuncio, y las dos te llevan menos de cinco minutos.</p>
      ${paso("1", "Una reseña en Google", "Dos frases bastan; cuentan más de lo que parece.", boton(ENTREGA_REVIEW_URL, "Escribir la reseña"))}
      ${paso("2", "Una foto en su sitio", `Para nuestro Instagram. Nos la mandas por WhatsApp o a ${ENTREGA_CONTACTO}.`, boton(waHref, "Enviar la foto por WhatsApp"))}
    </td></tr>

    <tr><td class="pad" bgcolor="${C.papel}" style="background:${C.papel};padding:12px 24px 30px;${lado};border-bottom:1px solid ${C.linea};border-radius:0 0 ${RADIO} ${RADIO}">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
        <td bgcolor="${C.arena}" style="background:${C.arena};border-radius:${RADIO};padding:20px 22px;text-align:center">
          <div style="${ETIQUETA};margin:0 0 6px">Si haces las dos</div>
          <div style="font-family:${SERIF};font-size:28px;line-height:1.15;font-weight:500;color:${C.tinta};margin:0 0 6px">${ENTREGA_PREMIO_CORTO} en tu próximo pedido</div>
          <div style="font-family:${SANS};font-size:14px;line-height:1.6;font-weight:300;color:${C.texto}">Nos lo dices al hacer el pedido y lo aplicamos.</div>
        </td>
      </tr></table>
      <p style="margin:26px 0 0;font-family:${SERIF};font-size:21px;line-height:1.4;font-weight:400;font-style:italic;color:${C.tinta}">Gracias por confiar en nosotros cuando todavía éramos casi un secreto.</p>
      <p style="margin:12px 0 0;font-family:${SANS};font-size:15px;line-height:1.6;font-weight:400;color:${C.texto}">Bea, Rocío, Iñaki y Juan</p>
      <p style="margin:4px 0 0;${ETIQUETA};color:${C.suave};letter-spacing:.3em">Tiro·Riro</p>
    </td></tr>

    <tr><td align="center" style="padding:22px 16px 0">
      <p style="margin:0 0 6px;font-family:${SANS};font-size:12px;line-height:1.8;color:${C.suave}">
        <a href="${ENTREGA_WEB}" style="color:${C.teal};text-decoration:none">tirorirohome.com</a> &nbsp;·&nbsp;
        <a href="${ENTREGA_INSTAGRAM}" style="color:${C.teal};text-decoration:none">Instagram</a> &nbsp;·&nbsp;
        <a href="mailto:${ENTREGA_CONTACTO}" style="color:${C.teal};text-decoration:none">${ENTREGA_CONTACTO}</a><br>
        WhatsApp ${ENTREGA_WHATSAPP}
      </p>
      <p style="margin:0;font-family:${SANS};font-size:11px;line-height:1.6;color:#9AA6AB">Cabeceros y tapizados a medida, hechos a mano en España. Te escribimos porque acabamos de entregarte un pedido.</p>
    </td></tr>

  </table>
</td></tr>
</table>
</body></html>`;
}

// Texto plano alternativo (clientes de correo sin HTML).
export function plainEmailEntrega(d: EmailEntregaDatos, mensaje: string): string {
  const prod = nombreProductoParaCliente(d.tipo, d.modelo, d.cantidad ?? 1);
  return [
    mensaje.trim(),
    "Somos cuatro y acabamos de empezar. Hay dos cosas que nos ayudan más que cualquier anuncio, y las dos te llevan menos de cinco minutos:",
    `1. Una reseña en Google. Dos frases bastan; cuentan más de lo que parece.\n   Escribir la reseña: ${ENTREGA_REVIEW_URL}`,
    `2. Una foto de ${prod} en su sitio, para nuestro Instagram. Nos la mandas por WhatsApp al ${ENTREGA_WHATSAPP} o a ${ENTREGA_CONTACTO}.`,
    `Si haces las dos, tu próximo pedido lleva ${ENTREGA_PREMIO}. Nos lo dices al hacer el pedido y lo aplicamos.`,
    "Gracias por confiar en nosotros cuando todavía éramos casi un secreto.",
    "Bea, Rocío, Iñaki y Juan\nTIRO·RIRO",
    `— ${ENTREGA_WEB} · ${ENTREGA_CONTACTO} · WhatsApp ${ENTREGA_WHATSAPP}`,
  ].join("\n\n");
}
