// Prompts de las dos generaciones automáticas del pedido:
//   · croquis (plano de corte de la madera) → Claude, devuelve un SVG A4 apaisado.
//   · imagen de referencia del acabado       → Gemini, devuelve un PNG.
// Este archivo NO toca ninguna API ni clave: son funciones puras que montan el
// texto a partir de los datos del pedido, para poder afinarlas con ejemplos
// (los croquis e imágenes que le gustan a Juan) sin tocar las rutas.

import { CABECERO_FORMAS, CABECERO_GROSOR_CM, normalizeTipo, displayNombreProducto, modeloDetalle, esDetalleMedida } from "@/lib/catalogo";
import { numeroPedidoLabel, textoHueco, textoPared, type HuecoPedido, type ColocacionPared } from "@/lib/types";

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
  pared: ColocacionPared;  // colocación en la pared (pasos_tapicero["@pared"])
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

export const CROQUIS_SYSTEM = `Eres el delineante de Tiroriro Home, un taller de cabeceros tapizados a medida. Dibujas el CROQUIS de cada pieza: el plano de la madera (tablero) que el carpintero corta y el tapicero monta. Juan quiere EXACTAMENTE el estilo de sus croquis de referencia, que se describen abajo (composición, jerarquía, colores y forma de acotar). Si se adjuntan croquis de ejemplo en PDF, imítalos.

Devuelves SIEMPRE un único documento SVG completo y nada más (sin explicaciones, sin vallas de código).

FORMATO
- A4 apaisado: <svg xmlns="http://www.w3.org/2000/svg" width="297mm" height="210mm" viewBox="0 0 1190 842">. Fondo blanco. font-family="Helvetica, Arial, sans-serif". Sin imágenes, scripts, fuentes ni CSS externos.
- Colores de los ejemplos: franja de cabecera #22333f con texto blanco; madera #d3c4a6 con contorno #1f1f1f de 2 px y, detrás y desplazada unos px hacia arriba-derecha, una copia #b9a37a que sugiere el grosor; cotas generales en azul #1f4e79; enchufes y sus cotas en rojo #c0282d con relleno del marco #f6d9d9; textos secundarios gris #555.

COMPOSICIÓN (como los ejemplos)
1. Franja superior oscura a todo el ancho: título grande "CABECERO A MEDIDA · <nombre de la pieza> · <forma en palabras>" y debajo una línea: "<ancho> ancho × <alto> alto × <grosor> grosor (madera + goma + guata + tela) · <colocación si se conoce> · cotas en cm". A la derecha, "Tiroriro Home · <fecha>" y el nº de pedido y cliente.
2. ALZADO grande (etiqueta "ALZADO 1:N · visto desde la cama" arriba a la izquierda), a escala uniforme, ocupando la mitad superior de la hoja. Eje vertical discontinuo en cabeceros simétricos. Cota del ancho total arriba y del alto total a la derecha, en azul y grandes. Un texto centrado dentro de la madera que describe la forma en una frase en negrita ("FORMA RECTA: rectángulo de 272 × 100, sin curvas ni rebajes en las esquinas") y otra en pequeño con el detalle.
3. Fila inferior, separada por una línea discontinua gris, con hasta tres bloques:
   - "GROSOR · sección a tamaño real (1:1)": sección con la pared a la izquierda y las capas madera (tablero), goma (espuma), guata y tela con su leyenda, cota "N cm en total" y la nota "Madera + goma + guata + tela = N cm de grosor final. El reparto entre capas es orientativo; manda el total."
   - Si hay enchufes o huecos: "ENCHUFES · esquina inferior izquierda a 1:N (la derecha, igual en espejo)" con el detalle ampliado y acotado, y al lado un texto en rojo con las reglas en viñetas (a cuántos cm de cada borde, a qué altura desde el borde inferior, tamaño del marco, nº de huecos, distancia entre marcos).
   - Si se conoce la colocación en la pared: "EN LA PARED · 1:N · centrado / pegado a la derecha…" con la pared, el suelo, el cabecero y los enchufes en rojo, la altura de colgado y los huecos libres; debajo, 2–3 líneas de explicación.
   Si no hay enchufes ni colocación, la fila inferior lleva solo el bloque de grosor (más ancho).

COTAS Y FORMA
- Todas las medidas en cm, con coma decimal (27,5). Líneas de cota finas con flechas o marcas en los extremos y el número centrado encima. Las cotas deben cuadrar: las parciales suman el total (p. ej. 27,5 + 22,2 + 154,6 + 22,2 + 27,5 = 254).
- Cabeceros con forma: a la derecha del alzado, además del alto total, las dos cotas parciales "N" (tramo recto, abajo) y "N (curva)" (tramo curvo, arriba). Reparto por defecto 75 % recto y 25 % curvo. Acota también el ancho de cada tramo curvo y los radios ("r 8").
- Los tramos curvos son <path> con arcos (A) o curvas (C) suaves y tangentes; sin polilíneas dentadas. Comprueba que el contorno cierra.
- Enchufes: cada marco es un rectángulo rojo claro con un círculo por hueco (con un punto en el centro), acotado desde el borde lateral más cercano hasta el marco y desde el borde inferior del cabecero hasta la base del marco, más su ancho. Si no se indican, no inventes ninguno.
- No dibujes telas, estampados, vivo ni avisos comerciales. Sin página a escala 1:1 del alzado.`;

const PERFIL_POR_DEFECTO = (modelo: string) => `forma fuera de catálogo descrita como "${modelo}". Interprétala con criterio a partir del nombre y de las notas (perfil simétrico, curvas suaves y tangentes) y acótala por tramos. Si las notas no bastan para saber la forma, dibuja un rectángulo y di en la frase de la forma "forma por confirmar".`;

export function promptCroquis(d: DatosPedidoIA, opts: { fecha: string; indicacion?: string }): string {
  const forma = formaDeModelo(d.modelo);
  const tipo = normalizeTipo(d.tipo) ?? d.tipo;
  const grosor = d.fondo ?? CABECERO_GROSOR_CM;
  const lineas: string[] = [];
  lineas.push(`Fecha: ${opts.fecha}`);
  lineas.push(`Pedido nº ${numeroPedidoLabel(d.numero, d.numeroSufijo) || "—"} · Cliente: ${d.clienteNombre || "—"}${d.cantidad > 1 ? ` · ${d.cantidad} unidades iguales (indícalo en la cabecera)` : ""}`);
  lineas.push(`Pieza: ${d.modelo || displayNombreProducto(d.tipo, d.modelo)} (tipo ${tipo})`);
  lineas.push(`Medidas: ancho ${d.ancho ?? "?"} × alto ${d.alto ?? "?"} × grosor ${grosor} cm${d.fondo == null ? " (grosor estándar)" : ""}`);
  lineas.push(`Forma: ${forma ? PERFIL_FORMA[forma] : PERFIL_POR_DEFECTO(d.modelo)}`);
  const pared = textoPared(d.pared);
  lineas.push(pared ? `Colocación en la pared: ${pared}.` : "Colocación en la pared: no indicada (no dibujes el bloque EN LA PARED salvo que las notas den las medidas).");
  if (d.huecos.length > 0) {
    lineas.push("Enchufes / interruptores / huecos (vistos desde la cama; distancias hasta el MARCO):");
    for (const h of d.huecos) lineas.push(`  - ${textoHueco(h)}`);
  } else {
    lineas.push("Enchufes / huecos: ninguno registrado en el pedido.");
  }
  const notas = [d.notasProducto, d.notaTapicero].map((x) => (x || "").trim()).filter(Boolean);
  if (notas.length) lineas.push(`Notas del pedido (úsalas SOLO para medidas de forma, grosor, enchufes o colocación; no copies lo comercial ni teléfonos): ${notas.join(" | ")}`);
  if (opts.indicacion?.trim()) lineas.push(`Indicación de Juan al revisar (prioritaria): ${opts.indicacion.trim()}`);
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
    const redondo = /redond|ø|cilin/i.test(m);
    return redondo
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
