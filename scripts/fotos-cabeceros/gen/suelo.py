# Limpia, junto a las esquinas de abajo, lo que Gemini dejó por debajo del borde inferior del frente
# (el ribete que doblaba por la base): se rellena con el suelo de justo debajo y una sombra de contacto suave.
import numpy as np, escena
from PIL import Image, ImageDraw, ImageFilter
from maqueta import GROSOR
def limpiar(img, tramos=((-0.6,150.6),), alto_cm=0.8):
    img=img.convert("RGB"); W,H=img.size; P=escena.P_(W,H); pp=lambda p:P(p)[0]; zf=-GROSOR-1.5
    a=np.asarray(img,float); out=a.copy()
    zb=-1.5
    bordes=[[pp((x,0,zf)) for x in np.linspace(x0,x1,40)] for x0,x1 in tramos]
    for borde in bordes:
        x0,x1=0,1
        h=int(round(pp((75,-alto_cm,zf))[1]-pp((75,0,zf))[1])); h=max(4,h)
        bajo=np.roll(a,-h,axis=0)                       # el suelo que hay justo debajo de la franja
        m=Image.new("L",(W,H),0); d=ImageDraw.Draw(m)
        sh=Image.new("L",(W,H),255); ds=ImageDraw.Draw(sh)
        for k in range(h,-1,-1):   # sombra de contacto: más oscura pegada al borde
            v=int(255*(0.74+0.26*(k/h)**0.8))
            ds.line([(x,y+k) for x,y in borde],fill=v,width=2)
        d.polygon(borde+[(x,y+h) for x,y in borde[::-1]],fill=255)
        # extremos del tramo fundidos
        m=m.filter(ImageFilter.GaussianBlur(1.5))
        M=np.asarray(m,float)/255
        S=np.asarray(sh.filter(ImageFilter.GaussianBlur(1)),float)/255
        nuevo=bajo*S[...,None]
        out=out*(1-M[...,None])+nuevo*M[...,None]
    return Image.fromarray(np.clip(out,0,255).astype("uint8"))
