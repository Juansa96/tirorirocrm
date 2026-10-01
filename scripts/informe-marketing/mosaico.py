"""Mosaico de creatividades para adjuntar al email del parte (Juan, 01/10/2026).

La herramienta de envío de Gmail borra las imágenes del HTML, así que las fotos de
los anuncios van en UNA imagen JPG adjunta (adjunto normal, no en línea): todas las
creatividades de cada campaña, de mejor a peor, con su foto, cifras y etiqueta.

Uso:  python3 mosaico.py [anuncios.json] [anuncios_resumen.json]
      (después de anuncios.py) → escribe anuncios_mosaico.jpg
Necesita Pillow; si no está, intenta instalarlo con pip.
"""
import base64, io, json, subprocess, sys

try:
    from PIL import Image, ImageDraw, ImageFont
except ImportError:
    subprocess.run([sys.executable, "-m", "pip", "install", "-q", "pillow"], check=False)
    from PIL import Image, ImageDraw, ImageFont

ANCHO, M, FOTO, FILA = 1080, 40, 150, 178
FUENTES = "/usr/share/fonts/truetype/liberation/LiberationSans-{}.ttf"
TINTA, GRIS, LINEA, FONDO = "#1c1c1e", "#8e8e93", "#e5e5ea", "#f2f2f7"
COLOR = {"subir": "#248a3d", "mantener": "#b25000", "bajar": "#c93400", "esperar": "#8e8e93", "info": "#8e8e93"}
ETIQ = {"La mejor": "#248a3d", "Mantener": "#8e8e93", "Pausar": "#c93400", "Pocos datos": "#8e8e93"}


def fuente(tam, negrita=False):
    try:
        return ImageFont.truetype(FUENTES.format("Bold" if negrita else "Regular"), tam)
    except OSError:
        return ImageFont.load_default()


def f(n, d=0):
    return f"{n:,.{d}f}".replace(",", "X").replace(".", ",").replace("X", ".")


def eur(n):
    return "—" if n is None else f(n, 2 if abs(n) < 10 else 0) + " €"


def foto(data_uri):
    if not data_uri or "," not in data_uri:
        return None
    try:
        im = Image.open(io.BytesIO(base64.b64decode(data_uri.split(",", 1)[1]))).convert("RGB")
    except Exception:
        return None
    lado = min(im.size)  # recorte cuadrado centrado
    x, y = (im.width - lado) // 2, (im.height - lado) // 2
    return im.crop((x, y, x + lado, y + lado)).resize((FOTO, FOTO))


def pastilla(d, x, y, texto, color, fnt):
    w = d.textlength(texto, font=fnt)
    d.rounded_rectangle((x, y, x + w + 24, y + 32), radius=16, fill=color)
    d.text((x + 12, y + 6), texto, fill="white", font=fnt)
    return x + w + 24


def cifras(c):
    if c.get("leads") is not None:
        partes = [f"{f(c['leads'])} lead{'' if c['leads'] == 1 else 's'}"]
        if c.get("cpl") is not None:
            partes.append(f"CPL {eur(c['cpl'])}")
    else:
        partes = [f"{f(c.get('chats') or 0)} chats"]
        if c.get("coste_chat") is not None:
            partes.append(f"{eur(c['coste_chat'])}/chat")
    if c.get("gasto") is not None:
        partes.insert(0, f"{eur(c['gasto'])} gastados")
    if c.get("visitas"):
        partes.append(f"{f(c['visitas'])} visitas")
    if c.get("ventas"):
        partes.append(f"{f(c['ventas'])} venta{'s' if c['ventas'] != 1 else ''} · {eur(c.get('eur'))}")
    return " · ".join(partes)


def main(path="anuncios.json", resumen="anuncios_resumen.json", salida="anuncios_mosaico.jpg"):
    D, R = json.load(open(path)), json.load(open(resumen))
    fotos = {(c.get("campana"), c.get("nombre")): c.get("foto") for c in D.get("creatividades", [])}
    camps = [c for c in R["campanas"] if c.get("tipo") != "interaccion" and c.get("creatividades")]
    alto = M + 70 + sum(90 + FILA * len(c["creatividades"]) + 20 for c in camps) + M
    img = Image.new("RGB", (ANCHO, alto), FONDO)
    d = ImageDraw.Draw(img)
    f_tit, f_cam, f_nom, f_txt, f_pil = fuente(40, True), fuente(32, True), fuente(30, True), fuente(26), fuente(20, True)
    dia = D.get("hoy", "")[8:10] + "/" + D.get("hoy", "")[5:7]
    d.text((M, M), f"Anuncios · {dia} · de mejor a peor", fill=TINTA, font=f_tit)
    y = M + 70
    for c in camps:
        n = len(c["creatividades"])
        d.rounded_rectangle((M - 16, y, ANCHO - M + 16, y + 90 + FILA * n), radius=28, fill="white")
        d.text((M + 8, y + 24), c["nombre"], fill=TINTA, font=f_cam)
        x = M + 8 + d.textlength(c["nombre"], font=f_cam) + 16
        pastilla(d, x, y + 26, c["veredicto"], COLOR.get(c.get("clave"), GRIS), f_pil)
        y += 90
        for i, cr in enumerate(c["creatividades"]):
            if i:
                d.line((M + 8, y, ANCHO - M - 8, y), fill=LINEA, width=2)
            ft = foto(fotos.get((c["nombre"], cr["nombre"])))
            if ft:
                mask = Image.new("L", (FOTO, FOTO), 0)
                ImageDraw.Draw(mask).rounded_rectangle((0, 0, FOTO, FOTO), radius=18, fill=255)
                img.paste(ft, (M + 8, y + 14), mask)
            else:
                d.rounded_rectangle((M + 8, y + 14, M + 8 + FOTO, y + 14 + FOTO), radius=18, fill=FONDO)
                d.text((M + 40, y + 76), "sin foto", fill=GRIS, font=f_txt)
            tx = M + 8 + FOTO + 24
            d.text((tx, y + 30), f"{cr['puesto']}.º {cr['nombre']}", fill=TINTA, font=f_nom)
            pastilla(d, tx, y + 74, cr["veredicto"], ETIQ.get(cr["veredicto"], GRIS), f_pil)
            d.text((tx, y + 120), cifras(cr), fill=GRIS, font=f_txt)
            y += FILA
        y += 20
    img.save(salida, "JPEG", quality=82, optimize=True)
    print(salida, img.size)


if __name__ == "__main__":
    main(*sys.argv[1:])
