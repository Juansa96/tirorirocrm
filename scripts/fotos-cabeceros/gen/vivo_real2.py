# Rehace el ribete por recortes a más resolución (Gemini ve el cordón más grande = más real).
import escena, gemini, time, math
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from siluetas import FORMAS
from maqueta import GROSOR
TXT="""Image 1 is a close-up crop of a photo of an upholstered headboard. Edit ONLY the piping cord that runs along the edge of the headboard. Make it a REAL handmade fabric piping exactly like the real one in image 2: {desc}. A round cord about 6-7 mm thick covered in MATTE woven cotton-linen with clearly visible fine weave texture, natural slightly irregular surface, soft shading that varies along its length with the light coming from the left (brighter on the lit side, darker in the turns and on the shadow side), a soft dark contact shadow where it meets the upholstery, sitting flush in the seam. The piping is continuous: it never stops, never fades and never turns inwards. NO shine, NO specular highlights, NO uniform flat colour, NO plastic, NO rubber, NO 3D-render look.
Keep EVERYTHING else pixel-identical: fabric, pattern, stripes, side band, wall, floor, light, framing."""
def contorno_px(forma,W,H):
    P=escena.P_(W,H); zf=-GROSOR-1.5; pts=FORMAS[forma.lower()]()
    return [P((x,y,zf))[0] for x,y in pts], pts
def banda(forma,W,H,ancho):
    c,_=contorno_px(forma,W,H); m=Image.new("L",(W,H),0); ImageDraw.Draw(m).line(c+[c[0]],fill=255,width=ancho,joint="curve")
    return m.filter(ImageFilter.GaussianBlur(ancho/5))
def centros(forma,W,H,S):
    c,pts=contorno_px(forma,W,H)
    sel=[p for p,(x,y) in zip(c,pts) if y>=60]            # parte alta y hombros
    cs=[]
    for p in sel:
        if all(max(abs(p[0]-q[0]),abs(p[1]-q[1]))>S*0.72 for q in cs): cs.append(p)
    bl=min(c,key=lambda p:(p[0]-0)**2+(p[1]-H)**2*0.2)     # esquina de abajo a la izquierda
    cs.append((min(c,key=lambda p:p[0])[0]+S*0.3, max(p[1] for p in c)-S*0.3))
    return cs
def refinar(img, forma, ref, desc, S=1280, log=None):
    img=img.convert("RGB"); W,H=img.size; out=img.copy()
    b=banda(forma,W,H,int(W*0.02))
    for k,(cx,cy) in enumerate(centros(forma,W,H,S)):
        x0=int(min(max(cx-S/2,0),W-S)); y0=int(min(max(cy-S/2,0),H-S))
        crop=out.crop((x0,y0,x0+S,y0+S)); import uuid; cp=f"/tmp/claude-0/-home-user/5ee651aa-653b-5ad5-97e4-725dea7f5915/scratchpad/gen/prueba/_crop-{uuid.uuid4().hex}.jpg"; crop.save(cp,quality=95)
        g=None
        for i in range(4):
            if gemini.generar(cp+".gen.png", TXT.format(desc=desc), [cp, ref], ar="1:1", size="2K"): g=Image.open(cp+".gen.png").convert("RGB").resize((S,S),Image.LANCZOS); break
            time.sleep(20)
        if g is None: continue
        m=b.crop((x0,y0,x0+S,y0+S))
        fe=Image.new("L",(S,S),0); ImageDraw.Draw(fe).rectangle([60,60,S-60,S-60],fill=255); fe=fe.filter(ImageFilter.GaussianBlur(30))
        m=Image.fromarray((np.asarray(m,float)*np.asarray(fe,float)/255).astype("uint8"))
        out.paste(Image.composite(g,crop,m),(x0,y0))
    return out
