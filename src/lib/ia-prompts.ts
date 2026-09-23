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

const TIPO_ESCENA: Record<string, string> = {
  cabecero: "un cabecero de cama tapizado, montado en la pared detrás de una cama de matrimonio hecha con ropa de cama lisa en tonos neutros, en un dormitorio luminoso y sereno",
  banco: "un banco pie de cama tapizado, colocado a los pies de una cama hecha con ropa de cama lisa en tonos neutros, en un dormitorio luminoso",
  puf: "un puf tapizado en un salón o dormitorio luminoso, sobre suelo de madera clara",
  cojin: "un almohadón / cojín tapizado sobre una cama o sofá de tonos neutros",
  mesa: "una mesa de centro tapizada en un salón luminoso con sofá de tonos neutros",
  pantalla: "una pantalla de lámpara tapizada en tela, sobre una lámpara de mesa encendida en una mesilla, en un dormitorio luminoso",
  otro: "la pieza tapizada en un dormitorio luminoso y sereno",
};

export function promptReferencia(d: DatosPedidoIA, opts: { hayFotoTela: boolean; hayDibujo: boolean; indicacion?: string }): string {
  const tipo = normalizeTipo(d.tipo) ?? "otro";
  const forma = formaDeModelo(d.modelo);
  const lineas: string[] = [];
  lineas.push(`Fotografía realista de producto, estilo catálogo de interiorismo, de ${TIPO_ESCENA[tipo] ?? TIPO_ESCENA.otro}.`);
  lineas.push(`Pieza: ${displayNombreProducto(d.tipo, d.modelo)}${medidasTexto(d) ? ` (${medidasTexto(d)})` : ""}. Respeta las proporciones reales de las medidas.`);
  if (tipo === "cabecero") {
    if (forma) lineas.push(`Forma del borde superior: ${{
      recto: "recto, rectangular",
      semicirculo: "un único arco suave de lado a lado (semicírculo rebajado)",
      "corona-simple": "corona simple: un escalón cóncavo suave a cada lado y un arco bajo en el centro",
      "corona-doble": "corona doble: dos escalones cóncavos suaves a cada lado y un arco bajo y estrecho en el centro",
      ondas: "ondas suaves (tres crestas)",
    }[forma]}.`);
    else if (d.modelo) lineas.push(`Forma: ${d.modelo}.`);
    if (d.montaje === "colgar") lineas.push("Va colgado en la pared, sin patas, con la base a la altura del colchón.");
    if (d.montaje === "apoyar") lineas.push("Va apoyado en el suelo con patas bajas discretas.");
  }
  const frontal = d.telas.find((t) => /frontal|principal/i.test(t.rol)) ?? d.telas[0];
  const lateral = d.telas.find((t) => /lateral/i.test(t.rol));
  const vivo = d.telas.find((t) => /vivo|ribete/i.test(t.rol));
  if (frontal?.nombre) lineas.push(`Tela principal: "${frontal.nombre}"${frontal.coleccion ? ` (colección ${frontal.coleccion})` : ""}.${opts.hayFotoTela ? " Usa EXACTAMENTE la tela de la imagen adjunta: mismo estampado, escala del dibujo, color y textura, tapizada tensa y lisa sobre la pieza (sin capitoné)." : ""}`);
  if (lateral?.nombre && lateral.nombre !== frontal?.nombre) lineas.push(`Laterales/canto en tela "${lateral.nombre}".`);
  if (vivo?.nombre) lineas.push(`Con vivo (ribete) perimetral en tela "${vivo.nombre}".`);
  else if (d.acabado && /liso|sin vivo/i.test(d.acabado)) lineas.push("Sin vivo: acabado liso.");
  if (opts.hayDibujo) lineas.push("La silueta de la pieza debe seguir el dibujo adjunto (silueta del configurador): misma forma y proporciones.");
  lineas.push("Vista frontal ligeramente elevada, luz natural suave, colores fieles, sin personas, sin texto, sin logotipos ni marcas de agua. Formato horizontal.");
  if (opts.indicacion?.trim()) lineas.push(`Indicación adicional de quien revisa (prioritaria): ${opts.indicacion.trim()}`);
  return lineas.join("\n");
}
