# Remate del ribete abajo a la derecha: retoque pequeño con Gemini SOLO de esa esquina; se aprovecha solo el final.
import os, escena, gemini, time, uuid, numpy as np
from PIL import Image, ImageDraw, ImageFilter
from maqueta import GROSOR
TXT="""Image 1 is a close-up of the bottom right corner of an upholstered headboard standing on a wooden floor, seen from the left. Fix ONLY the very end of the piping cord at the bottom of the right vertical edge: like a real upholsterer's finish, only in the last 1 cm above the floor the piping, keeping exactly the same thickness, makes a VERY SMALL, subtle bend inwards (just a few millimetres, barely noticeable; it stays almost straight, right at the edge) and tucks neatly into the upholstery seam, as if sewn into the fabric. It must not travel inwards across the fabric. It must look embedded and finished, NOT cut off, NOT hanging loose. The outer edge of the headboard does NOT move: below the point where the piping tucks in, the same striped upholstery fabric continues right up to the outer edge and down to the floor, with no white gap, no hole and no light patch. Keep everything else pixel-identical: the rest of the piping, its thickness and colour, the fabric and stripes, wall, skirting board, floor, light."""
def retocar(img, S=700):
    img=img.convert("RGB"); W,H=img.size; P=escena.P_(W,H); pp=lambda p:P(p)[0]; zf=-GROSOR-1.5
    cx,cy=pp((150,3,zf)); x0=int(min(max(cx-S*0.6,0),W-S)); y0=int(min(max(cy-S/2,0),H-S))
    crop=img.crop((x0,y0,x0+S,y0+S)); cp=f"prueba/_rd-{uuid.uuid4().hex}.jpg"; crop.save(cp,quality=95)
    for i in range(3):
        if gemini.generar(cp+".png",TXT,[cp],ar="1:1",size="2K"):
            g=Image.open(cp+".png").convert("RGB").resize((S,S),Image.LANCZOS); break
        time.sleep(20)
    else: return img
    # pegar solo la zona del final (últimos ~4 cm) con borde suave
    m=Image.new("L",(W,H),0); d=ImageDraw.Draw(m)
    d.polygon([pp((146.5,-1.2,zf)),pp((152,-1.2,zf)),pp((152,4,zf)),pp((146.5,4,zf))],fill=255)
    m=m.filter(ImageFilter.GaussianBlur(8)).crop((x0,y0,x0+S,y0+S))
    out=img.copy(); out.paste(Image.composite(g,crop,m),(x0,y0)); return out

os.makedirs("prueba",exist_ok=True)
