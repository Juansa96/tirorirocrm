import numpy as np
from PIL import Image, ImageFilter
def bordes(im, q=(448,600)):
    g=im.convert("L").resize(q, Image.LANCZOS).filter(ImageFilter.FIND_EDGES).filter(ImageFilter.GaussianBlur(3))
    a=np.asarray(g,float); return (a-a.mean())/(a.std()+1e-6)
def parecido(gen, comp):
    a=bordes(Image.open(gen) if isinstance(gen,str) else gen); b=bordes(Image.open(comp) if isinstance(comp,str) else comp)
    return float((a*b).mean())
