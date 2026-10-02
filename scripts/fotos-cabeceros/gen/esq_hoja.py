import escena, sys, combos
from PIL import Image
from maqueta import GROSOR
carpeta,pref,suf,dest=sys.argv[1:5]
out=Image.new("RGB",(2500,1000),"white")
for i,f in enumerate(combos.FORMAS):
    im=Image.open(f"{carpeta}/{pref}__{i+1}-{f.lower()}{suf}.jpg"); P=escena.P_(*im.size)
    for k,x in enumerate((0,150)):
        cx,cy=P((x,0,-GROSOR-1.5))[0]
        out.paste(im.crop((int(cx-150),int(cy-220),int(cx+150),int(cy+80))).resize((500,500)),(i*500,k*500))
out.save(dest,quality=90)
