// Croquis SVG → PDF A4 apaisado, en el navegador y sin librerías (no se
// pueden añadir dependencias con garantías: el lockfile apunta al registro
// privado de Lovable). El navegador dibuja el SVG en un lienzo a 300 ppp y se
// mete como imagen JPEG en un PDF de una página escrito a mano. El tapicero
// recibe así un PDF que se abre e imprime en cualquier sitio.

const A4_PT = { ancho: 842, alto: 595 };          // A4 apaisado en puntos
const A4_PX = { ancho: 3508, alto: 2480 };        // A4 apaisado a 300 ppp

async function svgALienzo(svg: string): Promise<HTMLCanvasElement> {
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    await img.decode();
    const lienzo = document.createElement("canvas");
    lienzo.width = A4_PX.ancho;
    lienzo.height = A4_PX.alto;
    const ctx = lienzo.getContext("2d");
    if (!ctx) throw new Error("El navegador no deja dibujar el croquis.");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, lienzo.width, lienzo.height);
    // Proporción del viewBox (1190×842 ≈ A4); si no coincide, se centra sin deformar.
    const vb = /viewBox\s*=\s*"([\d.\s-]+)"/i.exec(svg)?.[1]?.trim().split(/\s+/).map(Number);
    const w = vb && vb[2] > 0 ? vb[2] : img.naturalWidth || A4_PX.ancho;
    const h = vb && vb[3] > 0 ? vb[3] : img.naturalHeight || A4_PX.alto;
    const escala = Math.min(lienzo.width / w, lienzo.height / h);
    const dw = w * escala, dh = h * escala;
    ctx.drawImage(img, (lienzo.width - dw) / 2, (lienzo.height - dh) / 2, dw, dh);
    return lienzo;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function lienzoAJpeg(lienzo: HTMLCanvasElement): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    lienzo.toBlob(async (b) => {
      if (!b) { reject(new Error("No se pudo convertir el croquis.")); return; }
      resolve(new Uint8Array(await b.arrayBuffer()));
    }, "image/jpeg", 0.92);
  });
}

// PDF de una página con la imagen a toda la hoja.
function pdfConImagen(jpeg: Uint8Array, px: { ancho: number; alto: number }): Uint8Array {
  const enc = new TextEncoder();
  const partes: Uint8Array[] = [];
  const offsets: number[] = [];
  let pos = 0;
  const add = (p: Uint8Array | string) => { const b = typeof p === "string" ? enc.encode(p) : p; partes.push(b); pos += b.length; };
  const obj = (n: number, cuerpo: () => void) => { offsets[n] = pos; add(`${n} 0 obj\n`); cuerpo(); add("\nendobj\n"); };

  const contenido = `q ${A4_PT.ancho} 0 0 ${A4_PT.alto} 0 0 cm /Im0 Do Q`;
  add("%PDF-1.4\n%âãÏÓ\n");
  obj(1, () => add("<< /Type /Catalog /Pages 2 0 R >>"));
  obj(2, () => add("<< /Type /Pages /Kids [3 0 R] /Count 1 >>"));
  obj(3, () => add(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${A4_PT.ancho} ${A4_PT.alto}] /Resources << /XObject << /Im0 5 0 R >> >> /Contents 4 0 R >>`));
  obj(4, () => add(`<< /Length ${contenido.length} >>\nstream\n${contenido}\nendstream`));
  obj(5, () => {
    add(`<< /Type /XObject /Subtype /Image /Width ${px.ancho} /Height ${px.alto} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`);
    add(jpeg);
    add("\nendstream");
  });
  const xref = pos;
  add(`xref\n0 6\n0000000000 65535 f \n${[1, 2, 3, 4, 5].map((n) => `${String(offsets[n]).padStart(10, "0")} 00000 n \n`).join("")}`);
  add(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);

  const out = new Uint8Array(pos);
  let o = 0;
  for (const p of partes) { out.set(p, o); o += p.length; }
  return out;
}

export async function croquisSvgAPdf(svg: string): Promise<Blob> {
  const lienzo = await svgALienzo(svg);
  const jpeg = await lienzoAJpeg(lienzo);
  const pdf = pdfConImagen(jpeg, { ancho: lienzo.width, alto: lienzo.height });
  return new Blob([pdf.buffer as ArrayBuffer], { type: "application/pdf" });
}
