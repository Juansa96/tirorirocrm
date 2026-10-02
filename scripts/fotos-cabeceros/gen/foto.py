# Una foto final: fondo fijo + pieza con su tela -> Gemini -> se restaura el fondo fuera de la pieza.
import sys, os
from PIL import Image, ImageFilter, ImageChops, ImageDraw
import escena, gemini
FONDO="fondo.png"
FORMA_TXT={
 "Calobra":"Calobra is a plain RECTANGLE, 150 cm wide x 100 cm high: a perfectly straight horizontal top edge, straight vertical sides and four square corners (only softly rounded by the upholstery). NO steps, NO notches, NO curves, NO shaping at the corners.",
 "Barbaria":"Barbaria has 5 SOFT, gentle waves along the top, like a calm sea: rounded crests and wide, shallow, ROUNDED U-shaped valleys (only about 13 cm deep), exactly as the mock-up. The piping follows one smooth continuous wavy line. NO V-shaped notches, NO pointed dips, NO cuts, NO steps between the waves. Below the waves the sides are straight.",
 "_":"150 cm wide x 100 cm high; the lower 75 % has straight vertical sides and only the top 25 % is shaped, exactly as the mock-up."}
def prompt(forma, tela, vivo, lateral=None, doble=False, rep=None):
    lat=(f"The side band (the 8 cm thick edge all around) is upholstered in a DIFFERENT fabric: {lateral} (see the last image), exactly as textured on the mock-up." if lateral
         else "The side band (the 8 cm thick edge all around) is upholstered in the SAME fabric as the front, exactly as textured on the mock-up: along the top its pattern lines up with the front; down the sides the fabric simply continues with the same pattern and the same spacing as on the front.")
    rayas=(extra_filas if (extra_filas:="") else "")+(f" The front shows EXACTLY {rep} stripe repeats across its 150 cm width, all evenly spaced like the mock-up, with the same white space before the piping on both side edges (piping, white space, stripe ... stripe, white space, piping). Do not add, remove, merge or shift any stripe." if rep else "")
    piping=(f"TWO piping cords in {vivo}: one along the front edge and one along the back edge of the side band, both following the whole outline."
            if doble else f"ONE single piping cord (about 6 mm thick) in {vivo}, ONLY along the front edge, following the whole outline. NO piping on the back edge.")
    return f"""Image 1 is a real photo of our photo studio with a flat 3D mock-up of a headboard pasted in. Edit ONLY the headboard so it becomes a real, photorealistic upholstered headboard standing on the floor and resting against the wall.

DO NOT CHANGE ANYTHING ELSE: the wall, skirting board, floor, light, colours, framing and camera must stay exactly as in image 1. Keep the headboard exactly where it is, with exactly the same outline ("{forma}"), size and perspective. {FORMA_TXT.get(forma, FORMA_TXT["_"])} The fabric on the mock-up is already at its REAL SCALE and orientation: keep the same pattern size, count and placement.

The headboard is SOLID and fully OPAQUE everywhere (front, side band, piping, bottom edge): nothing of the wall or floor shows through it. It is ONE single padded panel: no inner frame, no second layer, no raised border, no holes, no extra seams.

PRODUCT: hand-made upholstered headboard, 8 cm thick, padded with foam and wadding, gently rounded upholstered edges, taut fabric, crisp tailoring, subtle realistic fabric sheen and softness.
- FRONT FABRIC: {tela}.{rayas} Image 2 is a close-up photo of the real fabric: match its colours, weave texture and motif details exactly. Make it one continuous piece of fabric with no seams. Stripes must be perfectly STRAIGHT, crisp and EVENLY spaced exactly as in the mock-up; sharp, high-definition weave, no pixelation, no blur, no stains or spots on the fabric.
- {lat}
- PIPING: {piping} In image 1 the cord along the outline is the piping: make it a REAL fabric-covered piping cord (visible weave, soft natural highlight and a tiny shadow), not a smooth plastic or 3D-render look.
- Add soft, realistic contact shadows where the headboard touches the floor and a soft shadow on the wall behind it, consistent with the soft daylight coming from the left. No window visible. No other objects."""
def componer(forma, tela_img, ancho_cm, vivo_rgb, lateral_img=None, modo="espejo", vivo_cm=0.9, tile=None, lateral_cm=10, lateral_modo="tile"):
    f=Image.open(FONDO).convert("RGB"); W,H=f.size
    capa2=escena.pieza(forma, tela_img, ancho_cm, vivo_rgb, W*2, H*2, lateral_img, modo, vivo_cm, tile, lateral_cm, lateral_modo)
    rep=capa2.info.get("repeticiones"); capa=capa2.resize((W,H), Image.LANCZOS); capa.info["repeticiones"]=rep   # supermuestreo: sin muaré
    comp=f.copy(); comp.paste(capa,(0,0),capa)
    a=capa.split()[3]; a.info['repeticiones']=capa.info.get('repeticiones')
    return comp, a
def restaurar(gen_path, mascara, salida, margen=70, pluma=45):
    f=Image.open(FONDO).convert("RGB"); g=Image.open(gen_path).convert("RGB")
    if g.size!=f.size: g=g.resize(f.size, Image.LANCZOS)
    m=mascara.filter(ImageFilter.MaxFilter(3))
    for _ in range(margen//10): m=m.filter(ImageFilter.MaxFilter(21))
    m=m.filter(ImageFilter.GaussianBlur(pluma))
    Image.composite(g,f,m).save(salida, quality=93)
def hacer(nombre, forma, tela_img, tela, vivo, vivo_rgb, ancho_cm, lateral=None, lateral_img=None, doble=False, modo="espejo", carpeta="out"):
    os.makedirs(carpeta, exist_ok=True)
    comp,mask=componer(forma, tela_img, ancho_cm, vivo_rgb, lateral_img, modo)
    cp=f"{carpeta}/{nombre}-comp.jpg"; comp.save(cp, quality=92)
    imgs=[cp, tela_img]+([lateral_img] if lateral_img else [])
    gp=f"{carpeta}/{nombre}-gen.png"
    if not gemini.generar(gp, prompt(forma,tela,vivo,lateral,doble), imgs): return False
    restaurar(gp, mask, f"{carpeta}/{nombre}.jpg"); return True
if __name__=="__main__":
    hacer("conta-ikat","Conta","../telas/01.jpg","Ikat Verde Agua (off-white ikat with sea-green / verde agua flame-diamond motif)","mustard yellow (mostaza) linen",(200,150,40),75,carpeta="prueba")

import os as _os
FONDO4K="fondo4k-cc.png" if _os.path.exists("fondo4k-cc.png") else "fondo4k-cc.jpg"   # en el repo va en JPG
def restaurar4k(gen_path, mascara2k, salida, fondo=None, fondo2k="fondo.png"):
    """Deja la pieza (y su sombra) 100 % de Gemini y el resto 100 % fondo fijo.
    La zona de Gemini = unión de la maqueta y de lo que Gemini cambió respecto al fondo, con margen."""
    import numpy as np
    f=Image.open(fondo or FONDO4K).convert("RGB"); g=Image.open(gen_path).convert("RGB")
    if g.size!=f.size: g=g.resize(f.size, Image.LANCZOS)
    q=(f.size[0]//4, f.size[1]//4)
    gq=np.asarray(g.resize(q,Image.BILINEAR),float); bq=np.asarray(Image.open(fondo2k).convert("RGB").resize(q,Image.BILINEAR),float)
    dif=np.abs(gq-bq).mean(axis=2)
    cambio=Image.fromarray(((dif>10)*255).astype("uint8")).filter(ImageFilter.MinFilter(3)).filter(ImageFilter.MaxFilter(5))
    mq=mascara2k.resize(q,Image.BILINEAR).point(lambda v:255 if v>20 else 0)
    cerca=mq
    for _ in range(4): cerca=cerca.filter(ImageFilter.MaxFilter(9))     # ~ +4 cm alrededor de la pieza
    cambio=Image.fromarray((np.asarray(cambio)&np.asarray(cerca)).astype("uint8"))
    zona=Image.fromarray(np.maximum(np.asarray(cambio),np.asarray(mq)).astype("uint8"))
    for _ in range(3): zona=zona.filter(ImageFilter.MaxFilter(7))        # ~ +36 px a 4K
    zona=zona.filter(ImageFilter.GaussianBlur(4))                        # borde suave ~16 px, fuera de la pieza
    Image.composite(g,f,zona.resize(f.size,Image.BILINEAR)).save(salida, quality=94)

def componer_c(forma, c):
    import combos
    escena.VIVO_MATE=bool(c.get("vivo_mate"))
    return componer(forma, c["tela_img"], c["ancho_cm"], c["vivo_rgb"], c.get("lateral_img"), c["modo"],
                    c.get("vivo_cm",0.9), combos.tile_de(c), c.get("lateral_cm",10), c.get("lateral_modo","tile"))

def transferir_frente(img, c, forma, margen_cm=0.9, margen_dcha=None, abajo=False):
    """Pone en el frente la tela EXACTA (a escala, rayas equidistantes) y conserva de Gemini solo
    la luz y el volumen: resultado = tela · (sombreado de Gemini)."""
    import numpy as np, combos
    from textura import tejido, homografia, PXCM
    from siluetas import FORMAS, W as AW, H as AH
    from maqueta import GROSOR
    img=img.convert("RGB"); W,H=img.size
    P=escena.P_(W,H); pp=lambda p:P(p)[0]; zf=-GROSOR-1.5
    tex=tejido(combos.tile_de(c) or c["tela_img"], c["ancho_cm"], c["modo"]); TW,TH=tex.size
    a0=pp((75,50,zf)); a1=pp((76,50,zf)); pxcm=abs(a1[0]-a0[0])
    if PXCM/pxcm>1.3: tex=tex.filter(ImageFilter.GaussianBlur(0.45*PXCM/pxcm))
    pad=int(3*PXCM); t2=Image.new("RGB",(TW+2*pad,TH)); t2.paste(tex,(pad,0)); t2.paste(tex.crop((TW-pad,0,TW,TH)),(0,0)); t2.paste(tex.crop((0,0,pad,TH)),(TW+pad,0)); tex=t2
    coef=homografia([pp((-3,0,zf)),pp((AW+3,0,zf)),pp((AW+3,AH,zf)),pp((-3,AH,zf))],[(0,TH),(TW+2*pad,TH),(TW+2*pad,0),(0,0)])
    wt=np.asarray(tex.transform((W,H),Image.PERSPECTIVE,tuple(coef),Image.BICUBIC),float)
    g=np.asarray(img,float)
    # sombreado: luminancia muy suavizada (más ancha que el dibujo) de Gemini / de la tela exacta
    per_px=max(2.5, 1.2*c["ancho_cm"])*pxcm
    def blur(a,s): return np.asarray(Image.fromarray(np.clip(a,0,255).astype("uint8")).filter(ImageFilter.GaussianBlur(s)),float)
    m=Image.new("L",(W,H),0); ImageDraw.Draw(m).polygon([pp((x,y,zf)) for x,y in FORMAS[forma.lower()]()],fill=255)
    ma=np.asarray(m)>0
    mi=np.asarray(m.filter(ImageFilter.MinFilter(21)),float)/255
    def nblur(a,s):
        q=(W//8,H//8); A=Image.fromarray(np.clip(a*mi,0,255).astype("uint8")).resize(q,Image.BILINEAR).filter(ImageFilter.GaussianBlur(s/8))
        M=Image.fromarray((mi*255).astype("uint8")).resize(q,Image.BILINEAR).filter(ImageFilter.GaussianBlur(s/8))
        r=np.asarray(A,float)/np.maximum(np.asarray(M,float)/255,0.05)
        return np.asarray(Image.fromarray(np.clip(r,0,255).astype("uint8")).resize((W,H),Image.BILINEAR),float)
    gl=g.mean(axis=2); tl=wt.mean(axis=2)
    som=np.clip((nblur(gl,per_px)+1)/(nblur(tl,per_px)+1),0.5,1.25)
    tinte=(g[ma].mean(axis=0)+1)/(wt[ma].mean(axis=0)+1); tinte=tinte/tinte.mean()
    res=np.clip(wt*som[...,None]*tinte,0,255)
    # solo dentro del frente, lejos del vivo (margen), con borde suave
    e=int(margen_cm*pxcm)
    mm=m.filter(ImageFilter.MinFilter(3))
    if e<10: mm=mm.filter(ImageFilter.MinFilter(2*max(1,e//2)+1))   # margen fino (ribete de la misma tela)
    else:
        for _ in range(max(1,e//10)): mm=mm.filter(ImageFilter.MinFilter(21))
    mm=mm.filter(ImageFilter.GaussianBlur(e/3))
    if margen_dcha is not None:   # lateral derecho recto: se respeta el ribete de Gemini (margen mayor)
        m2=transferir_mascara(m, margen_dcha*pxcm)
        zona=Image.new("L",(W,H),0); zd=ImageDraw.Draw(zona)
        zd.polygon([pp((146,-1,zf)),pp((153,-1,zf)),pp((153,76,zf)),pp((146,76,zf))],fill=255)
        zona=zona.filter(ImageFilter.GaussianBlur(pxcm))
        mm=Image.composite(m2, mm, zona)
    if abajo:   # esquinas de abajo: tela exacta hasta el mismo borde (el ribete se mete ahí y deja ver la tela)
        m0=m.filter(ImageFilter.GaussianBlur(1))
        zona=Image.new("L",(W,H),0); zd=ImageDraw.Draw(zona)
        for xa,xb in ((-1,3.0),(147.0,151)):
            zd.polygon([pp((xa,-1,zf)),pp((xb,-1,zf)),pp((xb,2.2,zf)),pp((xa,2.2,zf))],fill=255)
        zona=zona.filter(ImageFilter.GaussianBlur(pxcm*0.4))
        mm=Image.composite(m0, mm, zona)
    return Image.composite(Image.fromarray(res.astype("uint8")), img, mm)

def transferir_mascara(m, e):
    e=int(e); mm=m.filter(ImageFilter.MinFilter(3))
    if e<10: mm=mm.filter(ImageFilter.MinFilter(2*max(1,e//2)+1))
    else:
        for _ in range(max(1,e//10)): mm=mm.filter(ImageFilter.MinFilter(21))
    return mm.filter(ImageFilter.GaussianBlur(e/3))

def transferir_canto(img, c, forma, ref_arco=False):
    """Pone en el canto izquierdo la tela exacta de la maqueta (rayas continuas, sin huecos) con la luz de Gemini."""
    import numpy as np, combos
    from maqueta import GROSOR
    from siluetas import FORMAS
    img=img.convert("RGB"); W,H=img.size; P=escena.P_(W,H); pp=lambda p:P(p)[0]; zf=-GROSOR-1.5
    capa=escena.pieza(forma, c["tela_img"], c["ancho_cm"], None, W, H, c.get("lateral_img"), c["modo"], 0.0, combos.tile_de(c), c.get("lateral_cm",10), c.get("lateral_modo","tile"))
    al=np.asarray(capa.split()[3],float)/255
    fr=Image.new("L",(W,H),0); ImageDraw.Draw(fr).polygon([pp((x,y,zf)) for x,y in FORMAS[forma.lower()]()],fill=255)
    fr=fr.filter(ImageFilter.MaxFilter(9))
    M=al*(1-np.asarray(fr,float)/255)
    # todo el canto visible (lateral izquierdo y parte de arriba)
    M=np.asarray(Image.fromarray((M*255).astype("uint8")).filter(ImageFilter.MinFilter(5)).filter(ImageFilter.GaussianBlur(1.5)),float)/255
    if M.sum()<100: return img
    ex=np.asarray(capa.convert("RGB"),float); g=np.asarray(img,float)
    ref=ex
    if ref_arco:   # la foto de Gemini se hizo con el reparto antiguo: la luz se mide contra esa maqueta
        escena.ARCO=True
        try: ref=np.asarray(escena.pieza(forma, c["tela_img"], c["ancho_cm"], None, W, H, c.get("lateral_img"), c["modo"], 0.0, combos.tile_de(c), c.get("lateral_cm",10), c.get("lateral_modo","tile")).convert("RGB"),float)
        finally: escena.ARCO=False
    def nblur(a,s):
        q=(W//8,H//8); A=Image.fromarray(np.clip(a*M,0,255).astype("uint8")).resize(q,Image.BILINEAR).filter(ImageFilter.GaussianBlur(s/8))
        B=Image.fromarray((M*255).astype("uint8")).resize(q,Image.BILINEAR).filter(ImageFilter.GaussianBlur(s/8))
        r=np.asarray(A,float)/np.maximum(np.asarray(B,float)/255,0.05)
        return np.asarray(Image.fromarray(np.clip(r,0,255).astype("uint8")).resize((W,H),Image.BILINEAR),float)
    som=np.clip((nblur(g.mean(axis=2),60)+1)/(nblur(ref.mean(axis=2),60)+1),0.4,1.3)
    tinte=(g[M>0.5].mean(axis=0)+1)/(ref[M>0.5].mean(axis=0)+1); tinte=tinte/tinte.mean()
    res=np.clip(ex*som[...,None]*tinte,0,255)
    return Image.fromarray(np.clip(g*(1-M[...,None])+res*M[...,None],0,255).astype("uint8"))

def pared_dcha(img, forma, ancho_cm=1.4):
    """Lateral derecho recto: quita lo que Gemini dejó por fuera del borde de la tela (su ribete, un poco más
    ancho) poniendo la pared/zócalo/suelo de un poco más a la derecha. Luego el ribete se dibuja en el borde."""
    import numpy as np
    from siluetas import FORMAS
    from maqueta import GROSOR
    img=img.convert("RGB"); W,H=img.size; P=escena.P_(W,H); pp=lambda p:P(p)[0]; zf=-GROSOR-1.5
    pts=FORMAS[forma.lower()](); ytop=max(y for x,y in pts if x>149.95)-1.0
    a=np.asarray(img,float)
    src=np.asarray(Image.open(FONDO4K).convert("RGB").resize((W,H)),float)   # el mismo fondo fijo de todas
    # igualar el tono al de la pared de Gemini justo al lado (suave)
    lado=Image.new("L",(W,H),0); ImageDraw.Draw(lado).polygon([pp((150+ancho_cm,y,zf)) for y in (0,40)]+[pp((150+ancho_cm+2,y,zf)) for y in (40,0)],fill=255)
    L=np.asarray(lado)>0
    if L.sum()>50: src=src*np.clip((a[L].mean(axis=0)+1)/(src[L].mean(axis=0)+1),0.85,1.15)
    m=Image.new("L",(W,H),0); d=ImageDraw.Draw(m)
    ys=np.linspace(-0.8,ytop,60)
    d.polygon([pp((150.02,y,zf)) for y in ys]+[pp((150+ancho_cm,y,zf)) for y in ys[::-1]],fill=255)
    # arriba se funde (allí empieza la curva y manda la silueta)
    fz=Image.new("L",(W,H),0); ImageDraw.Draw(fz).rectangle([0,pp((150,ytop-3,zf))[1],W,H],fill=255)
    fz=fz.filter(ImageFilter.GaussianBlur(abs(pp((150,ytop,zf))[1]-pp((150,ytop-3,zf))[1])/2))
    M=(np.asarray(m.filter(ImageFilter.GaussianBlur(1)),float)/255)*(np.asarray(fz,float)/255)
    return Image.fromarray(np.clip(a*(1-M[...,None])+src*M[...,None],0,255).astype("uint8"))
