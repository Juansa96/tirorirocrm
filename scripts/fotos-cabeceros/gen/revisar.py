# Revisión antes de enseñar una tanda (ver REGLAS-FOTOS.md §8): hojas de cerca + comprobaciones automáticas.
# Uso: python3 revisar.py <carpeta> <id del combo>
import sys, os, subprocess, numpy as np, escena, combos, vivo_misma
from PIL import Image
from maqueta import GROSOR
from textura import tejido
carpeta, cid = sys.argv[1], sys.argv[2]
c=[x for x in combos.C if x["id"]==cid][0]
os.makedirs(carpeta+"/envio",exist_ok=True)
subprocess.run(["python3","detalles.py",carpeta,cid,cid])
subprocess.run(["python3","esq_hoja.py",carpeta,cid,"",carpeta+"/envio/0-remate-abajo.jpg"])
out=Image.new("RGB",(2500,500))
for j,f in enumerate(combos.FORMAS):
    im=Image.open(f"{carpeta}/{cid}__{j+1}-{f.lower()}.jpg"); P=escena.P_(*im.size); cx,cy=P((0,35,-GROSOR-1.5))[0]
    out.paste(im.crop((int(cx-90),int(cy-90),int(cx+90),int(cy+90))).resize((500,500),Image.LANCZOS),(j*500,0))
out.save(carpeta+"/envio/0-ribete-cerca.jpg",quality=90)
# rayas del frente que tocan el borde y no casan con lateral/ribete
tex=tejido(combos.tile_de(c) or c["tela_img"], c["ancho_cm"], c["modo"]); FR=escena.franjas_de(tex)
avisos=[]
if FR:
    for f in combos.FORMAS:
        pts,_=vivo_misma._coords(f.lower()); U=np.array(escena.coords_u(pts,franjas=FR)); P_=np.array(pts); n=len(P_)
        mis=[tuple(np.round(P_[i],1)) for i in range(n) if P_[i][1]>20 and FR[1](P_[i][0]) and abs(U[i]-P_[i][0])>0.05]
        salto=[tuple(np.round(P_[i],1)) for i in range(n) if abs(U[(i+1)%n]-U[i])>1.6 and max(P_[i][1],P_[(i+1)%n][1])>=0.01]
        if mis: avisos.append(f"{f}: {len(mis)} puntos con raya del frente sin casar, p. ej. {mis[:3]}")
        if salto: avisos.append(f"{f}: saltos en el lateral en {salto[:3]}")
print("\n".join(avisos) if avisos else "Rayas frente/lateral/ribete: OK en las 5 formas")
print("Hojas en",carpeta+"/envio: 0-detalles, 0-remate-abajo, 0-ribete-cerca. Mirarlas TODAS antes de enviar.")
