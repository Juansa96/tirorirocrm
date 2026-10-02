import v6, combos, esquinas_ia, sys, os, escena
from PIL import Image, ImageDraw, ImageFont
from maqueta import GROSOR
from concurrent.futures import ThreadPoolExecutor
pref, carpeta = sys.argv[1], sys.argv[2]
os.makedirs(carpeta, exist_ok=True)
c=[x for x in combos.C if x["id"].startswith(pref)][0]
def uno(i_f):
    i,f=i_f; out=f"{carpeta}/{c['id']}__{i+1}-{f.lower()}"
    p,s=v6.hacer(c,f,out,intentos=2,reusar=True)
    if False and c["vivo_rgb"] is not None:   # retoques de esquina con Gemini desactivados (01/10): ribete determinista
        base_img=Image.open(p).copy(); r=esquinas_ia.esquinas(base_img,f,S=900,lados=("izq",))
        import remate, remate_dcha; r2=remate.combinar(base_img,r); r2=remate_dcha.retocar(r2); r2.save(out+".jpg",quality=94)
    return out,s
with ThreadPoolExecutor(3) as ex:
    for r in ex.map(uno,enumerate(combos.FORMAS)): print("HECHA",r,flush=True)
# envío: fotos grandes + hoja de esquinas
os.makedirs(carpeta+"/envio",exist_ok=True); f=ImageFont.load_default(size=34)
s=Image.new("RGB",(5*400,2*400+50),"white"); d=ImageDraw.Draw(s); d.text((10,8),c["id"]+" · esquinas de abajo (izq arriba, dcha abajo)",fill=(0,0,0),font=f)
for i,fm in enumerate(combos.FORMAS):
    im=Image.open(f"{carpeta}/{c['id']}__{i+1}-{fm.lower()}.jpg")
    im.resize((1792,2400),Image.LANCZOS).save(f"{carpeta}/envio/{i+1}-{fm.lower()}.jpg",quality=90)
    P=escena.P_(*im.size); pp=lambda p:P(p)[0]; zf=-GROSOR-1.5
    for k,x in enumerate((0,150)):
        cx,cy=pp((x,4,zf)); s.paste(im.crop((int(cx-300),int(cy-350),int(cx+300),int(cy+250))).resize((400,400)),(i*400,50+k*400))
s.save(f"{carpeta}/envio/0-esquinas.jpg",quality=90)
