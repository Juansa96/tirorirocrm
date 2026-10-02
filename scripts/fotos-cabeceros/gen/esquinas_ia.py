# Retoque con Gemini SOLO de las dos esquinas de abajo (recorte 2K): el ribete baja recto y se mete
# en la costura justo antes de la curva; la esquina redonda queda solo con la tela. Se pega solo la esquina.
import os, escena, gemini, time, tramo_vivo, uuid
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from siluetas import FORMAS, W as AW
from maqueta import GROSOR
TXT="""Image 1 is a close-up of the bottom corner of an upholstered headboard standing on a wooden floor. Fix ONLY the piping cord at this corner: the piping runs STRAIGHT down the front vertical edge all the way to the floor and simply ENDS there, at the floor. It must NOT turn the corner: there is NO piping along the bottom of the side band (the thickness going back towards the wall) and NO piping along the bottom of the front. The side band and the bottom are just the upholstery fabric, with the same pattern and stripes, touching the floor with a soft contact shadow. Keep everything else pixel-identical: fabric pattern and stripes, side band, wall, skirting board, floor, light."""
def esquinas(img, forma, S=1100, lados=("izq",)):
    img=img.convert("RGB"); W,H=img.size; P=escena.P_(W,H); pp=lambda p:P(p)[0]; zf=-GROSOR-1.5
    pts=FORMAS[forma.lower()](); t=tramo_vivo.tramo(pts); out=img.copy()
    for (x,y) in [p for p,l in ((t[0],"izq"),(t[-1],"dch")) if l in lados]:
        cx,cy=pp((x,2.0,zf)); x0=int(min(max(cx-S/2,0),W-S)); y0=int(min(max(cy-S/2,0),H-S))
        crop=out.crop((x0,y0,x0+S,y0+S)); cp=f"prueba/_esq-{uuid.uuid4().hex}.jpg"; crop.save(cp,quality=95)
        g=None
        for i in range(3):
            if gemini.generar(cp+".png",TXT,[cp],ar="1:1",size="2K"): g=Image.open(cp+".png").convert("RGB").resize((S,S),Image.LANCZOS); break
            time.sleep(20)
        if g is None: continue
        # pegar solo dentro de un círculo alrededor de la esquina, con borde suave
        m=Image.new("L",(S,S),0); r=S*0.40; ImageDraw.Draw(m).ellipse([S/2-r,S/2-r,S/2+r,S/2+r],fill=255); m=m.filter(ImageFilter.GaussianBlur(S*0.06))
        out.paste(Image.composite(g,crop,m),(x0,y0))
    return out

os.makedirs("prueba",exist_ok=True)
