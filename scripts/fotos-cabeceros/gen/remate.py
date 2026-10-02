# Combina: foto con ribete continuo (grosor constante) + SOLO el remate final de la esquina retocada por Gemini.
import escena
from PIL import Image, ImageDraw, ImageFilter
from maqueta import GROSOR
def combinar(base, retocada, alto_cm=1.3):
    W,H=base.size; P=escena.P_(W,H); pp=lambda p:P(p)[0]; zf=-GROSOR-1.5
    pxcm=abs(pp((1,1,zf))[0]-pp((0,1,zf))[0])
    m=Image.new("L",(W,H),0); d=ImageDraw.Draw(m)
    poly=[pp((-1.3,-1.0,zf)),pp((1.1,-1.0,zf)),pp((1.1,alto_cm,zf)),pp((-1.3,alto_cm,zf))]
    d.polygon(poly,fill=255); m=m.filter(ImageFilter.GaussianBlur(pxcm*0.25))
    return Image.composite(retocada.convert("RGB"), base.convert("RGB"), m)

def combinar_dcha(base, retocada, vivo_rgb, alto_cm=1.6):
    """Remate de abajo a la derecha: SOLO el final del ribete de la esquina retocada (si allí hay ribete)."""
    import numpy as np
    W,H=base.size; P=escena.P_(W,H); pp=lambda p:P(p)[0]; zf=-GROSOR-1.5
    pxcm=abs(pp((150,1,zf))[0]-pp((149,1,zf))[0])
    m=Image.new("L",(W,H),0); d=ImageDraw.Draw(m)
    poly=[pp((148.6,-1.0,zf)),pp((151.6,-1.0,zf)),pp((151.6,alto_cm,zf)),pp((148.6,alto_cm,zf))]
    d.polygon(poly,fill=255)
    a=np.asarray(retocada.convert("RGB"),float); M=np.asarray(m)>0
    hay=((np.abs(a-np.array(vivo_rgb,float)).mean(axis=2)<50)&M).sum()
    if hay<30: return base.convert("RGB"), False
    m=m.filter(ImageFilter.GaussianBlur(pxcm*0.6))   # empalme más largo y suave
    return Image.composite(retocada.convert("RGB"), base.convert("RGB"), m), True
