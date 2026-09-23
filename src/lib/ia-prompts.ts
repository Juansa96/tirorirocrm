// Prompts de las dos generaciones automáticas del pedido:
//   · croquis (plano de corte de la madera) → Claude, devuelve un SVG A4 apaisado.
//   · imagen de referencia del acabado       → Gemini, devuelve un PNG.
// Este archivo NO toca ninguna API ni clave: son funciones puras que montan el
// texto a partir de los datos del pedido, para poder afinarlas con ejemplos
// (los croquis e imágenes que le gustan a Juan) sin tocar las rutas.

import { CABECERO_FORMAS, CABECERO_GROSOR_CM, normalizeTipo, displayNombreProducto, modeloDetalle, esDetalleMedida } from "@/lib/catalogo";
import { numeroPedidoLabel, textoHueco, type HuecoPedido } from "@/lib/types";

export interface DatosPedidoIA {
  numero: number | null;
  numeroSufijo: string;
  clienteNombre: string;
  tipo: string;            // cabecero | banco | puf | …
  modelo: string;          // nombre de la forma / variante
  ancho: number | null;    // cm
  alto: number | null;     // cm
  fondo: number | null;    // cm (grosor en cabeceros)
  cantidad: number;
  montaje: string;         // 'colgar' | 'apoyar' | ''
  acabado: string;         // vivo, etc. (texto del producto)
  patas: string;           // extras en texto (montaje, tapetes…)
  huecos: HuecoPedido[];
  telas: { rol: string; nombre: string; coleccion: string }[];
  notaTapicero: string;
  notasProducto: string;
}

// forma key ('recto', 'corona-doble'…) a partir del nombre de modelo ("Conta")
export function formaDeModelo(modelo: string): string | null {
  const m = (modelo || "").trim().toLowerCase();
  for (const [key, name] of Object.entries(CABECERO_FORMAS)) if (name.toLowerCase() === m) return key;
  return null;
}

// Descripción geométrica de cada forma de cabecero para el plano de corte.
// (Las reglas de Conta son las que le gustan a Juan; ver CLAUDE.md.)
const PERFIL_FORMA: Record<string, string> = {
  recto: "Cabecero RECTO (Calobra): rectángulo completo, sin tramo curvo. Todo el alto es tramo recto (100 %). No dibujes cotas RECTO/CURVA: solo ancho, alto y grosor.",
  semicirculo: "Cabecero de SEMICÍRCULO (Pregonda): el tramo curvo superior es un único arco de círculo rebajado, simétrico, de lado a lado, que arranca en los hombros de forma suave (sin arranque vertical) y culmina en el centro. Acota la flecha del arco y las alturas de hombro y cima.",
  "corona-simple": "Cabecero de CORONA SIMPLE (Macarella): a cada lado UN escalón cóncavo en cuarto de curva (arranca horizontal en el hombro y llega vertical al siguiente nivel) y en el centro un arco de círculo suave, poco marcado, sin arranque vertical. El escalón llega TANGENTE al arco: la unión es redonda, sin esquinas ni puntas. Anchos: cada escalón ≈ 1/4 del ancho total y el arco central ≈ 1/2. Del tramo curvo, el escalón sube ≈ 60 % y el arco ≈ 40 %. Acota anchos y subidas de escalón y arco, y las alturas de hombro, escalón y cima.",
  "corona-doble": "Cabecero de CORONA DOBLE (Conta): a cada lado DOS escalones cóncavos en cuarto de curva (cada uno arranca horizontal y llega vertical al siguiente nivel) y en el centro un arco de círculo suave, poco marcado, sin arranque vertical (\"sutileza\"). El segundo escalón llega TANGENTE al arco: la unión escalón-arco es redonda, sin esquinas ni puntas. Anchos: cada escalón 1/6 del ancho total (p. ej. 25 sobre 150) y el arco central 1/3 (50 sobre 150): arco estrecho y curvas anchas, nunca un arco gordo. El tramo curvo se reparte ≈ 34 % / 38 % / 28 % (escalón 1, escalón 2, arco): el segundo escalón algo más marcado que el primero y el arco el más bajo de los tres. Acota el ancho y la subida de cada escalón y del arco, y las alturas de hombro, de cada escalón y de la cima. NO hagas un perfil hombro-pico-cuello ni una cúpula alta.",
  ondas: "Cabecero de ONDAS (Barbaria): borde superior con tres crestas suaves y simétricas separadas por dos valles (la cresta central igual o algo más alta que las laterales), que arrancan en los hombros sin arranque vertical. Acota el ancho de cada onda, la subida de cada cresta y las alturas de hombro, valles y crestas.",
};

function medidasTexto(d: DatosPedidoIA): string {
  const det = modeloDetalle(d.tipo, d.modelo);
  const partes: string[] = [];
  if (d.ancho != null) partes.push(`ancho ${d.ancho} cm`);
  if (d.alto != null) partes.push(`alto ${d.alto} cm`);
  if (d.fondo != null) partes.push(normalizeTipo(d.tipo) === "cabecero" ? `grosor ${d.fondo} cm` : `fondo ${d.fondo} cm`);
  if (partes.length === 0 && det && esDetalleMedida(det)) partes.push(det);
  return partes.join(" · ");
}

export function tituloPedidoIA(d: DatosPedidoIA): string {
  return `${displayNombreProducto(d.tipo, d.modelo)} · ${medidasTexto(d) || "medidas sin confirmar"}`;
}

// ───────────── Croquis (Claude) ─────────────

export const CROQUIS_SYSTEM = `Eres el delineante de un taller de tapicería (Tiroriro Home, cabeceros tapizados a medida). Dibujas PLANOS DE CORTE de la madera (tablero) de cada pieza para que el carpintero corte la forma exacta. No eres diseñador de interiores: no dibujas telas, ni vivos, ni montaje, ni notas comerciales.

Devuelves SIEMPRE un único documento SVG completo y nada más (sin explicaciones antes ni después, sin bloques de código). Requisitos del SVG:
- A4 apaisado: <svg xmlns="http://www.w3.org/2000/svg" width="297mm" height="210mm" viewBox="0 0 297 210">. Unidades del viewBox = milímetros de papel. Fondo blanco, líneas negras, tipografía sans-serif (font-family="Helvetica, Arial, sans-serif"). Sin imágenes externas, sin scripts, sin fuentes externas, sin CSS externo.
- Contenido: (1) cabecera mínima arriba (producto y forma, medidas, nº de pedido y cliente, unidades si son varias); (2) ALZADO acotado de la pieza vista de frente, a escala uniforme dentro de la hoja, ocupando la mayor parte del papel; (3) VISTA LATERAL pequeña con el grosor acotado; (4) nota "Medidas en cm. Dibujo NO a escala 1:1" en pequeño. Nada más.
- Cotas claras: líneas de cota con extremos, texto de la medida en cm (número + "cm"), centrado y legible (tamaño 4–5 en unidades del viewBox para cotas normales). Ancho total y alto total siempre. En cabeceros con forma: a la IZQUIERDA del alzado dos cotas grandes (tamaño 6–7, negrita) "RECTO · N cm · P %" y "CURVA · N cm · P %" que reparten el alto total en tramo recto (parte baja, rectangular) y tramo curvo (parte alta, con la forma). Reparto por defecto: 75 % recto y 25 % curvo del alto total (redondea a cm enteros y que sumen el alto).
- Los tramos curvos se dibujan con arcos de <path> (comandos A o C) suaves y tangentes, nunca con polilíneas dentadas. La pieza es simétrica respecto a su eje vertical salvo que se indique lo contrario.
- Si el pedido incluye enchufes, huecos o anclajes: dibújalos en el alzado en su posición (rectángulo o círculo pequeño) y acótalos desde el borde IZQUIERDO y desde el borde INFERIOR de la pieza, más su tamaño si se indica. Si no hay, no inventes ninguno.
- No incluyas telas, colores, vivo, montaje, avisos ni logotipos. No hagas página a escala 1:1.
Comprueba mentalmente que el path del contorno cierra, que las cotas coinciden con las medidas del pedido y que todo cabe dentro de 297×210.`;

export function promptCroquis(d: DatosPedidoIA, indicacion?: string): string {
  const forma = formaDeModelo(d.modelo);
  const tipo = normalizeTipo(d.tipo) ?? d.tipo;
  const grosor = d.fondo ?? (tipo === "cabecero" ? CABECERO_GROSOR_CM : null);
  const lineas: string[] = [];
  lineas.push(`PEDIDO ${numeroPedidoLabel(d.numero, d.numeroSufijo)} · Cliente: ${d.clienteNombre || "—"}${d.cantidad > 1 ? ` · ${d.cantidad} unidades iguales` : ""}`);
  lineas.push(`Producto: ${displayNombreProducto(d.tipo, d.modelo)} (tipo: ${tipo}; modelo/forma: ${d.modelo || "sin indicar"})`);
  lineas.push(`Medidas: ${medidasTexto(d) || "sin confirmar"}${grosor != null && d.fondo == null ? ` · grosor ${grosor} cm (estándar)` : ""}`);
  if (tipo === "cabecero") {
    lineas.push(`Perfil: ${forma ? PERFIL_FORMA[forma] : `forma fuera de catálogo descrita como "${d.modelo}". Interprétala con criterio (perfil simétrico, curvas suaves y tangentes) y acótala por tramos.`}`);
  } else {
    lineas.push("No es un cabecero: dibuja el alzado y la vista lateral (o planta, si aporta más) con todas las medidas del pedido acotadas.");
  }
  if (d.huecos.length > 0) {
    lineas.push("Enchufes / huecos / anclajes (posiciones vistas de frente, al CENTRO de cada uno):");
    for (const h of d.huecos) lineas.push(`  - ${textoHueco(h)}`);
  } else {
    lineas.push("Sin enchufes, huecos ni anclajes.");
  }
  if (indicacion?.trim()) lineas.push(`Indicación de quien revisa el croquis (prioritaria): ${indicacion.trim()}`);
  lineas.push("Devuelve solo el SVG.");
  return lineas.join("\n");
}

// ───────────── Imagen de referencia (Gemini) ─────────────
// Método que le funciona a Juan: partir de una FOTO REAL del producto (la
// forma ya hecha) y pedir a Gemini que cambie SOLO la tela y el vivo. Así la
// forma, las proporciones, la luz y el estilo salen siempre bien. Las fotos
// base son las de la web (repo tiroriro, public/productos-fotos).

export const WEB_FOTOS = "https://tirorirohome.com/productos-fotos";

export interface FotoBase { url: string; descripcion: string }

// Foto base del catálogo para el producto del pedido, o null si es una pieza
// fuera de catálogo (entonces se usa la foto que haya subido el equipo, o se
// genera solo con texto).
export function fotoBaseProducto(tipoRaw: string, modelo: string): FotoBase | null {
  const tipo = normalizeTipo(tipoRaw);
  const m = (modelo || "").toLowerCase();
  if (tipo === "cabecero") {
    const forma = formaDeModelo(modelo);
    const porForma: Record<string, FotoBase> = {
      recto: { url: `${WEB_FOTOS}/cabeceros/calobra-01-800.webp`, descripcion: "cabecero recto rectangular (modelo Calobra)" },
      semicirculo: { url: `${WEB_FOTOS}/cabeceros/pregonda-02-800.webp`, descripcion: "cabecero con el borde superior en arco (modelo Pregonda)" },
      "corona-simple": { url: `${WEB_FOTOS}/cabeceros/macarella-02-800.webp`, descripcion: "cabecero en corona simple (modelo Macarella)" },
      "corona-doble": { url: `${WEB_FOTOS}/cabeceros/conta-01-800.webp`, descripcion: "cabecero en corona doble (modelo Conta)" },
      ondas: { url: `${WEB_FOTOS}/cabeceros/ondas-01-800.webp`, descripcion: "cabecero de ondas (modelo Barbaria)" },
    };
    return forma ? porForma[forma] ?? null : null;
  }
  if (tipo === "banco") return { url: `${WEB_FOTOS}/bancos/oyambre-nuevo-800.webp`, descripcion: "banco tapizado (modelo Oyambre)" };
  if (tipo === "puf") {
    return /redond|ø|cilin/i.test(m)
      ? { url: `${WEB_FOTOS}/puff/monteferro-01-800.webp`, descripcion: "puf redondo (modelo Monteferro)" }
      : { url: `${WEB_FOTOS}/puff/patos-01-800.webp`, descripcion: "puf cuadrado (modelo Patos)" };
  }
  if (tipo === "mesa") return { url: `${WEB_FOTOS}/mesas-centro/cabo-de-palos-800.webp`, descripcion: "mesa de centro tapizada (modelo Cabo de Palos)" };
  if (tipo === "pantalla") {
    if (/tormes|cuadrad/.test(m)) return { url: `${WEB_FOTOS}/pantallas/tormes-01-800.webp`, descripcion: "pantalla de lámpara cuadrada (modelo Tormes)" };
    if (/serrota|rectang/.test(m)) return { url: `${WEB_FOTOS}/pantallas/serrota-01-800.webp`, descripcion: "pantalla de lámpara rectangular (modelo La Serrota)" };
    return { url: `${WEB_FOTOS}/pantallas/almanzor-01-800.webp`, descripcion: "pantalla de lámpara cilíndrica (modelo Almanzor)" };
  }
  if (tipo === "cojin") {
    if (/cilin/.test(m)) return null;
    return /rectang|60|50x30|30x50/.test(m)
      ? { url: `${WEB_FOTOS}/almohadones/covadonga-04-800.webp`, descripcion: "almohadón rectangular" }
      : { url: `${WEB_FOTOS}/almohadones/rodiles-03-800.webp`, descripcion: "almohadón cuadrado" };
  }
  return null;
}

// `enTela`: cómo nombrar la tela del vivo ("en la tela de la imagen 3 (\"Lino\")"), o "" si no hay.
function textoVivo(acabado: string, enTela: string): string {
  const a = (acabado || "").toLowerCase();
  if (a === "liso" || /sin vivo/.test(a)) return "SIN vivo: quita el ribete del borde si la foto lo tiene; el borde queda liso, en la misma tela.";
  const tipoVivo = a.includes("doble") ? "Vivo DOBLE (dos ribetes paralelos)" : "Vivo (ribete) sencillo";
  if (enTela) return `${tipoVivo} en todo el perímetro, ${enTela}.`;
  if (a.startsWith("vivo")) return `${tipoVivo} en todo el perímetro, en la misma tela que la pieza.`;
  return "Mantén el borde como en la foto.";
}

export interface ImagenesReferencia {
  base: "catalogo" | "equipo" | null;   // de dónde sale la foto base (1ª imagen)
  baseDescripcion: string;
  telaPrincipal: boolean;                // hay foto de la tela principal
  telaLateral: boolean;
  telaVivo: boolean;
  dibujo: boolean;                       // dibujo del configurador (última)
}

// El orden de las imágenes adjuntas es: [base] [tela principal] [tela lateral] [tela vivo] [dibujo].
export function promptReferencia(d: DatosPedidoIA, im: ImagenesReferencia, indicacion?: string): string {
  const tipo = normalizeTipo(d.tipo) ?? "otro";
  const frontal = d.telas.find((t) => /frontal|principal/i.test(t.rol)) ?? d.telas[0];
  const lateral = d.telas.find((t) => /lateral/i.test(t.rol));
  const vivo = d.telas.find((t) => /vivo|ribete/i.test(t.rol));
  const lineas: string[] = [];
  let n = 0;
  const idx: Record<string, number> = {};
  if (im.base) idx.base = ++n;
  if (im.telaPrincipal) idx.principal = ++n;
  if (im.telaLateral) idx.lateral = ++n;
  if (im.telaVivo) idx.vivo = ++n;
  if (im.dibujo) idx.dibujo = ++n;

  if (im.base) {
    lineas.push(`Edita la imagen ${idx.base} (${im.base === "catalogo" ? `foto real de nuestro ${im.baseDescripcion}` : "foto de referencia del pedido"}).`);
    lineas.push("Mantén EXACTAMENTE la misma pieza: misma forma y silueta, mismas proporciones, mismo encuadre, misma habitación, muebles, ropa de cama, luz y sombras. No cambies nada más que lo que se pide aquí.");
  } else {
    const nombre = displayNombreProducto(d.tipo, d.modelo);
    lineas.push(`Fotografía realista de producto, estilo catálogo de interiorismo, de un ${nombre.toLowerCase()} tapizado en un dormitorio luminoso y sereno, con ropa de cama lisa en tonos neutros.${d.modelo ? ` Forma: ${d.modelo}.` : ""}`);
    if (im.dibujo) lineas.push(`La silueta debe seguir el dibujo de la imagen ${idx.dibujo}.`);
  }

  if (frontal?.nombre) {
    lineas.push(idx.principal
      ? `${im.base ? "Cambia la tela de la pieza por" : "Tapiza la pieza con"} la tela de la imagen ${idx.principal} ("${frontal.nombre}"): mismo estampado, misma escala del dibujo, mismo color y textura. Tapizado tenso y liso, sin capitoné, con el estampado recto y centrado.`
      : `${im.base ? "Cambia la tela de la pieza por" : "Tapiza la pieza con"} la tela "${frontal.nombre}".`);
  }
  if (lateral?.nombre && lateral.nombre !== frontal?.nombre && tipo !== "pantalla") {
    lineas.push(idx.lateral ? `Los laterales / cantos, en la tela de la imagen ${idx.lateral} ("${lateral.nombre}").` : `Los laterales / cantos, en tela "${lateral.nombre}".`);
  }
  const enTelaVivo = idx.vivo ? `en la tela de la imagen ${idx.vivo}${vivo?.nombre ? ` ("${vivo.nombre}")` : ""}` : vivo?.nombre ? `en tela "${vivo.nombre}"` : "";
  if (tipo !== "pantalla" && tipo !== "mesa") lineas.push(textoVivo(d.acabado, enTelaVivo));
  if (tipo === "cabecero" && d.montaje === "apoyar") lineas.push("El cabecero va apoyado en el suelo.");
  lineas.push("Resultado: fotografía realista, colores fieles a las telas, sin texto, sin logotipos ni marcas de agua, sin personas.");
  if (indicacion?.trim()) lineas.push(`Indicación adicional de quien revisa (prioritaria): ${indicacion.trim()}`);
  return lineas.join("\n");
}
