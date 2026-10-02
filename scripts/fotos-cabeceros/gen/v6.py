# Tubería v6: maqueta (formas redondeadas, vivo completo) -> Gemini 4K -> fondo fijo -> tela exacta en el
# frente (rayas/dibujos) -> ribete real por recortes -> control de encuadre.
import os, json, time, numpy as np
import combos, foto, gemini, vivo_real2, escena
from PIL import Image
TRANSFER={"02","03","04","05","07","08","09","10","13","14"}
VIVO_DESC={"01":"matte mustard yellow (mostaza) linen","02":"deep burgundy (granate) linen","03":"bottle green cotton",
 "04":"solid black cotton, THIN (about 5 mm)","05":"soft mid blue cotton","06":"deep burgundy (granate) linen","07":"sage green linen",
 "08":"grey-green (verde grisaceo) linen","09":"light blue matching the fabric","10":"blue-grey matching the fabric","11":"deep burgundy (granate) linen",
 "12":"soft verde agua (sea green) linen","13":"slate blue matching the fabric","14":"mid blue matching the stripes"}
EXTRA=(" Do NOT add any text, letters or captions. Do NOT add extra seams, extra piping or panels. Keep EXACTLY the camera angle, orientation and position of image 1 (the headboard's left side band is visible, seen from the left)."
       " The two vertical sides go STRAIGHT down to the floor (square bottom corners, no rounding at the bottom). The piping runs STRAIGHT down each vertical side all the way to the floor and ends right there, at the very bottom, tucking under the headboard. It does NOT turn the corner: there is NO piping along the bottom edge.")
def iou(gen_path, mask2k, fondo2k="fondo.png"):
    q=(896,1200)
    g=np.asarray(Image.open(gen_path).convert("RGB").resize(q),float); b=np.asarray(Image.open(fondo2k).convert("RGB").resize(q),float)
    ch=(np.abs(g-b).mean(axis=2)>14); m=np.asarray(mask2k.resize(q))>128
    return (ch&m).sum()/max(1,(ch|m).sum())
def hacer(c, forma, out, intentos=2, vivo=True, reusar=False):
    comp,mask=foto.componer_c(forma,c); cp=out+"-comp.jpg"; comp.save(cp,quality=90)
    imgs=[cp, c.get("tela_ref",c["tela_img"])]+([c["lateral_img"]] if c.get("lateral_img") else [])+([c["vivo_ref"]] if c.get("vivo_ref") else [])
    txt=foto.prompt(forma,c["tela"],c["vivo"],c.get("lateral"),rep=mask.info.get("repeticiones"))+EXTRA
    best=None
    import glob as _g
    if reusar:
        import qa
        for gp in sorted(_g.glob(out+"-gen*.png")):
            sc=qa.parecido(gp,cp)
            if best is None or sc>best[0]: best=(sc,gp)
        if best and best[0]>0.95: intentos=0
    if intentos==0 and best is None: return None, 0.0
    for k in range(intentos):
        gp=f"{out}-gen{k+len(_g.glob(out+'-gen*.png'))}.png"
        for i in range(4):
            if gemini.generar(gp,txt,imgs,size="4K"): break
            time.sleep(25)
        import qa; s=qa.parecido(gp,cp); print(os.path.basename(out),"intento",k,"parecido",round(s,3),flush=True)
        if best is None or s>best[0]: best=(s,gp)
        if s>0.95: break
    img=foto.restaurar4k(best[1],mask,out+".jpg") or Image.open(out+".jpg")
    n=c["id"][:2]
    if n in TRANSFER: img=foto.transferir_frente(img,c,forma,margen_cm=0.3,abajo=True)
    if not c.get("lateral_img") or c["id"][:2]=='09': img=foto.transferir_canto(img,c,forma)
    if vivo and c["vivo_rgb"] is not None:
        import vivo_det
        # ribete de color: también el lateral derecho lo dibujamos nosotros, encima del de Gemini y recto
        # hasta el suelo (como en la serie aprobada de Baqueira misma tela, 01/10): sin retoques de esquina.
        img=foto.pared_dcha(img,forma)   # fuera el ribete de Gemini; el nuestro va en el borde real (02/10)
        img=vivo_det.aplicar(img,forma,c["vivo_rgb"],c.get("vivo_cm",0.75),dcha=True,escala_dcha=1.0)
    elif vivo:   # ribete de la misma tela: rayas alineadas con el canto izquierdo y el de arriba
        import vivo_misma
        img=foto.pared_dcha(img,forma)
        img=vivo_misma.aplicar(img,c,forma,c.get("vivo_cm",0.75),en_borde=True)
    import suelo; img=suelo.limpiar(img)
    img.save(out+".jpg",quality=94); return out+".jpg", best[0]
