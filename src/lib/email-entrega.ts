// ─────────────────────────────────────────────────────────────────────────────
// Correo de entrega al cliente ("ya está en casa").
//
// Se propone al equipo cuando un pedido pasa a ENTREGADO; nunca sale solo.
// Este módulo no toca la base de datos: genera el asunto y el mensaje personal
// por defecto (que el equipo puede retocar antes de enviar), el HTML del correo
// con la identidad de la web (paleta, tipografías, logo) y la versión para
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
//   · Imágenes: se sirven desde la web (public/email/*), porque los clientes
//     de correo no pintan SVG en línea ni imágenes incrustadas de forma fiable.
// ─────────────────────────────────────────────────────────────────────────────
import { displayNombreProducto } from "./catalogo";

export const ENTREGA_REVIEW_URL = "https://www.google.com/search?q=Tiroriro+Home+opiniones";
export const ENTREGA_WHATSAPP = "660 786 453";
export const ENTREGA_WHATSAPP_INTL = "34660786453";
export const ENTREGA_PREMIO = "un 10 % de descuento";
export const ENTREGA_PREMIO_CORTO = "10 %";
export const ENTREGA_CONTACTO = "info@tirorirohome.com";
export const ENTREGA_INSTAGRAM = "https://www.instagram.com/tirorirohome/";
export const ENTREGA_WEB = "https://tirorirohome.com";
export const ENTREGA_LOGO_URL = "https://tirorirohome.com/email/logo-tiroriro.png";
export const ENTREGA_HERO_URL = "https://tirorirohome.com/email/hero-cabecero.jpg";
export const ENTREGA_FROM = "Tiroriro Home <hola@notify.tirorirohome.com>";
export const ENTREGA_SENDER_DOMAIN = "notify.tirorirohome.com";
export const ENTREGA_TEMPLATE = "entrega_cliente"; // etiqueta en email_send_log
export const ETIQUETA_RESENA_PEDIDA = "reseña pedida";

// Paleta de la web (src/index.css de tirorirohome.com), en hex para el correo.
const C = {
  crema: "#F7F4EE",      // --background
  papel: "#FFFFFF",
  tinta: "#133A44",      // --foreground
  teal: "#1A4B5B",       // --accent-warm / --primary
  texto: "#3E4E55",
  suave: "#6F7F86",      // --muted-foreground
  linea: "#E8E4DE",
  arena: "#F5F0E8",      // cajas de pasos (misma que la confirmación de contacto)
  oroFondo: "#FDF9F2",
  oroBorde: "#EAD9BD",
  oro: "#A8824A",
  oroBoton: "#C4956A",
};
const SERIF = "'Cormorant Garamond', Georgia, 'Times New Roman', serif";
const SANS = "Inter, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

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

// "un cabecero" / "una mesa": artículo según el género del sustantivo.
function conArticulo(prod: string): string {
  const palabra = prod.replace(/^tu /, "").split(" ")[0];
  if (palabra === "pedido") return "una caja";
  return (/a$/.test(palabra) ? "una " : "un ") + palabra;
}

export interface EmailEntregaDatos { nombre: string; tipo: string; modelo: string; cantidad?: number }
export interface EmailEntregaTexto { asunto: string; mensaje: string }

// Asunto: nombre de pila + producto. Personal y concreto, que es lo que abre.
export function asuntoEmailEntrega(d: EmailEntregaDatos): string {
  const pila = nombreDePila(d.nombre);
  const prod = nombreProductoParaCliente(d.tipo, d.modelo, d.cantidad ?? 1);
  const Prod = prod.charAt(0).toUpperCase() + prod.slice(1);
  return pila ? `${pila}, ${prod} ya está en casa ✦` : `${Prod} ya está en casa ✦`;
}

// Mensaje personal por defecto (la parte que el equipo puede retocar). El resto
// del correo (pasos, premio, pie) es fijo y va con el diseño de la web.
export function textoEmailEntrega(d: EmailEntregaDatos): EmailEntregaTexto {
  const pila = nombreDePila(d.nombre);
  const prod = nombreProductoParaCliente(d.tipo, d.modelo, d.cantidad ?? 1);
  const Prod = prod.charAt(0).toUpperCase() + prod.slice(1);
  const mensaje = [
    `Hola${pila ? ", " + pila : ""}:`,
    `${Prod} ya está en casa. A partir de aquí la parte difícil es tuya: disfrutarlo.`,
    `Lo hemos hecho a mano, con calma y con bastantes más ganas de las que caben en ${conArticulo(prod)}. Esperamos que cada vez que lo mires pienses que acertaste.`,
  ].join("\n\n");
  return { asunto: asuntoEmailEntrega(d), mensaje };
}

// Versión corta para WhatsApp (la mayoría de clientes no tiene correo en el CRM).
export function textoWhatsAppEntrega(d: EmailEntregaDatos): string {
  const pila = nombreDePila(d.nombre);
  const prod = nombreProductoParaCliente(d.tipo, d.modelo, d.cantidad ?? 1);
  const Prod = prod.charAt(0).toUpperCase() + prod.slice(1);
  return `Hola${pila ? ", " + pila : ""} 👋 ${Prod} ya está en casa, ¡a disfrutarlo! Somos cuatro y acabamos de empezar: si te apetece dejarnos una reseña en Google (${ENTREGA_REVIEW_URL}) y mandarnos una foto ya colocado, tu próximo pedido lleva ${ENTREGA_PREMIO}. Gracias por confiar en nosotros.`;
}

function esc(s: string): string {
  return (s || "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));
}

function parrafosHtml(mensaje: string): string {
  return mensaje.replace(/\r\n/g, "\n").split(/\n{2,}/).map((p) => p.trim()).filter(Boolean)
    .map((p) => `<p style="margin:0 0 16px;font-family:${SANS};font-size:16px;line-height:1.7;font-weight:300;color:${C.texto}">${esc(p).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

function boton(href: string, texto: string, fondo: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:14px 0 0"><tr><td bgcolor="${fondo}" style="border-radius:6px;background:${fondo}">
    <a href="${href}" style="display:inline-block;padding:12px 26px;font-family:${SANS};font-size:13px;font-weight:500;letter-spacing:.06em;text-transform:uppercase;color:#ffffff;text-decoration:none">${texto}</a>
  </td></tr></table>`;
}

function paso(numero: string, titulo: string, texto: string, botonHtml: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 12px"><tr>
    <td bgcolor="${C.arena}" style="background:${C.arena};border-radius:8px;padding:22px 24px">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
        <td valign="top" style="padding-right:14px">
          <div style="width:30px;height:30px;line-height:30px;border-radius:15px;background:${C.teal};color:#ffffff;text-align:center;font-family:${SERIF};font-size:17px;font-weight:500">${numero}</div>
        </td>
        <td valign="top">
          <div style="font-family:${SERIF};font-size:24px;line-height:1.2;font-weight:500;color:${C.tinta};margin:2px 0 6px">${titulo}</div>
          <div style="font-family:${SANS};font-size:14.5px;line-height:1.65;font-weight:300;color:${C.texto}">${texto}</div>
          ${botonHtml}
        </td>
      </tr></table>
    </td>
  </tr></table>`;
}

// HTML completo del correo, con la identidad de la web.
export function htmlEmailEntrega(d: EmailEntregaDatos, mensaje: string): string {
  const prod = nombreProductoParaCliente(d.tipo, d.modelo, d.cantidad ?? 1);
  const preheader = `Gracias por confiar en nosotros. Un pequeño favor, y ${ENTREGA_PREMIO} para tu próximo pedido.`;
  const waHref = `https://wa.me/${ENTREGA_WHATSAPP_INTL}?text=${encodeURIComponent("Hola, os mando la foto de " + prod + " ya en casa 🙂")}`;
  return `<!doctype html>
<html lang="es"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="x-apple-disable-message-reformat">
<title>${esc(asuntoEmailEntrega(d))}</title>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400;500&family=Inter:wght@300;400;500&display=swap" rel="stylesheet">
<style>
  @media only screen and (max-width:620px){ .wrap{width:100%!important} .pad{padding-left:20px!important;padding-right:20px!important} .h1{font-size:34px!important} }
</style>
</head>
<body style="margin:0;padding:0;background:${C.crema};-webkit-font-smoothing:antialiased">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${C.crema}">${esc(preheader)}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.crema}" style="background:${C.crema}">
<tr><td align="center" style="padding:28px 12px 40px">
  <table role="presentation" class="wrap" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px">

    <tr><td align="center" style="padding:6px 0 22px">
      <a href="${ENTREGA_WEB}" style="text-decoration:none"><img src="${ENTREGA_LOGO_URL}" width="190" alt="Tiroriro" style="display:block;width:190px;height:auto;border:0"></a>
    </td></tr>

    <tr><td style="border-radius:10px 10px 0 0;overflow:hidden">
      <img src="${ENTREGA_HERO_URL}" width="600" alt="" style="display:block;width:100%;height:auto;border:0;border-radius:10px 10px 0 0">
    </td></tr>

    <tr><td class="pad" bgcolor="${C.papel}" style="background:${C.papel};padding:38px 44px 8px;border-left:1px solid ${C.linea};border-right:1px solid ${C.linea}">
      <div style="font-family:${SANS};font-size:11px;letter-spacing:.22em;text-transform:uppercase;color:${C.oro};font-weight:500;margin:0 0 12px">Entregado</div>
      <div class="h1" style="font-family:${SERIF};font-size:40px;line-height:1.08;font-weight:300;color:${C.tinta};margin:0 0 22px">Ya está en casa.</div>
      ${parrafosHtml(mensaje)}
    </td></tr>

    <tr><td class="pad" bgcolor="${C.papel}" style="background:${C.papel};padding:10px 44px 6px;border-left:1px solid ${C.linea};border-right:1px solid ${C.linea}">
      <div style="height:1px;background:${C.linea};margin:0 0 26px"></div>
      <div style="font-family:${SERIF};font-size:26px;line-height:1.2;font-weight:400;color:${C.tinta};margin:0 0 8px">Somos cuatro y acabamos de empezar.</div>
      <p style="margin:0 0 20px;font-family:${SANS};font-size:15px;line-height:1.7;font-weight:300;color:${C.texto}">Hay dos cosas que nos ayudan más que cualquier anuncio, y las dos te llevan menos de cinco minutos.</p>
      ${paso("1", "Una reseña en Google", "Dos frases bastan; cuentan más de lo que parece.", boton(ENTREGA_REVIEW_URL, "Escribir la reseña", C.teal))}
      ${paso("2", "Una foto ya colocado", `Para nuestro Instagram. Nos la mandas por WhatsApp al ${ENTREGA_WHATSAPP} o respondiendo a ${ENTREGA_CONTACTO}.`, boton(waHref, "Enviar la foto", C.oroBoton))}
    </td></tr>

    <tr><td class="pad" bgcolor="${C.papel}" style="background:${C.papel};padding:14px 44px 36px;border-left:1px solid ${C.linea};border-right:1px solid ${C.linea};border-bottom:1px solid ${C.linea};border-radius:0 0 10px 10px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
        <td bgcolor="${C.oroFondo}" style="background:${C.oroFondo};border:1px solid ${C.oroBorde};border-radius:8px;padding:20px 24px;text-align:center">
          <div style="font-family:${SANS};font-size:11px;letter-spacing:.22em;text-transform:uppercase;color:${C.oro};font-weight:500;margin:0 0 6px">Si haces las dos</div>
          <div style="font-family:${SERIF};font-size:30px;line-height:1.15;font-weight:400;color:${C.tinta};margin:0 0 6px">${ENTREGA_PREMIO_CORTO} en tu próximo pedido</div>
          <div style="font-family:${SANS};font-size:13.5px;line-height:1.6;font-weight:300;color:${C.suave}">Sin letra pequeña: nos lo recuerdas al pedir y ya está.</div>
        </td>
      </tr></table>
      <p style="margin:28px 0 0;font-family:${SERIF};font-size:20px;line-height:1.5;font-weight:400;font-style:italic;color:${C.tinta}">Gracias por confiar en nosotros cuando todavía éramos casi un secreto.</p>
      <p style="margin:14px 0 0;font-family:${SANS};font-size:14px;line-height:1.6;font-weight:400;color:${C.texto}">Bea, Rocío, Iñaki y Juan</p>
      <p style="margin:4px 0 0;font-family:${SANS};font-size:11px;letter-spacing:.32em;color:${C.suave}">TIRO·RIRO</p>
    </td></tr>

    <tr><td align="center" style="padding:24px 20px 0">
      <p style="margin:0 0 6px;font-family:${SANS};font-size:12px;line-height:1.7;color:${C.suave}">
        <a href="${ENTREGA_WEB}" style="color:${C.teal};text-decoration:none">tirorirohome.com</a> &nbsp;·&nbsp;
        <a href="${ENTREGA_INSTAGRAM}" style="color:${C.teal};text-decoration:none">Instagram</a> &nbsp;·&nbsp;
        <a href="mailto:${ENTREGA_CONTACTO}" style="color:${C.teal};text-decoration:none">${ENTREGA_CONTACTO}</a> &nbsp;·&nbsp;
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
    `2. Una foto de ${prod} ya colocado, para nuestro Instagram. Nos la mandas por WhatsApp al ${ENTREGA_WHATSAPP} o respondiendo a ${ENTREGA_CONTACTO}.`,
    `Si haces las dos, tu próximo pedido lleva ${ENTREGA_PREMIO}. Sin letra pequeña: nos lo recuerdas al pedir y ya está.`,
    "Gracias por confiar en nosotros cuando todavía éramos casi un secreto.",
    "Bea, Rocío, Iñaki y Juan\nTIRO·RIRO",
    `— ${ENTREGA_WEB} · ${ENTREGA_CONTACTO} · WhatsApp ${ENTREGA_WHATSAPP}`,
  ].join("\n\n");
}
