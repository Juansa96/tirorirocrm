import sys, escena, combos
from PIL import Image, ImageDraw, ImageFont
from maqueta import GROSOR
from siluetas import FORMAS
carpeta, pref, titulo = sys.argv[1], sys.argv[2], sys.argv[3]
f=ImageFont.load_default(size=30)
s=Image.new("RGB",(5*400,4*400+50),"white"); d=ImageDraw.Draw(s)
d.text((10,8),titulo+" · 1: arriba izq · 2: arriba dcha · 3: abajo izq · 4: abajo dcha",fill=(0,0,0),font=f)
for i,fm in enumerate(combos.FORMAS):
    im=Image.open(f"{carpeta}/{pref}__{i+1}-{fm.lower()}.jpg"); P=escena.P_(*im.size); pp=lambda p:P(p)[0]; zf=-GROSOR-1.5
    pts=FORMAS[fm.lower()](); yl=max(y for x,y in pts if x<3); yr=max(y for x,y in pts if x>147)
    for k,(x,y) in enumerate(((0,yl),(150,yr),(0,4),(150,4))):
        cx,cy=pp((x,y,zf)); dy=-50 if k<2 else -50
        s.paste(im.crop((int(cx-300),int(cy-300+(150 if k<2 else -50)),int(cx+300),int(cy+300+(150 if k<2 else -50)))).resize((400,400)),(i*400,50+k*400))
s.save(f"{carpeta}/envio/0-detalles.jpg",quality=88)
