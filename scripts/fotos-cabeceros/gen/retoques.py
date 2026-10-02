# Retoques de esquina por separado, guardando candidatos para elegir: python3 retoques.py carpeta pref sufijo forma1 [forma2...] [--izq|--dcha]
import sys, combos, esquinas_ia, remate, remate_dcha
from PIL import Image
from concurrent.futures import ThreadPoolExecutor
carpeta,pref,suf=sys.argv[1:4]; resto=sys.argv[4:]
lados=[a for a in resto if a.startswith("--")] or ["--izq","--dcha"]; formas=[a for a in resto if not a.startswith("--")]
def uno(f):
    i=[x.lower() for x in combos.FORMAS].index(f); b=f"{carpeta}/{pref}__{i+1}-{f}"
    base=Image.open(b+"-base.jpg").convert("RGB")
    if "--izq" in lados:
        r=esquinas_ia.esquinas(base.copy(),f,S=900,lados=("izq",)); remate.combinar(base,r).save(b+f"-izq{suf}.jpg",quality=94)
    if "--dcha" in lados:
        remate_dcha.retocar(base.copy()).save(b+f"-dcha{suf}.jpg",quality=94)
    return f
with ThreadPoolExecutor(3) as ex:
    for r in ex.map(uno,formas): print("hecho",r,flush=True)
