import numpy as np
from PIL import Image
def periodo(g, eje, minf=0.12, maxf=0.9):
    n=g.shape[eje]; best=None
    res=[]
    for d in range(int(n*minf), int(n*maxf)):
        a=g[:n-d] if eje==0 else g[:,:n-d]; b=g[d:] if eje==0 else g[:,d:]
        a=a-a.mean(); b=b-b.mean()
        c=(a*b).sum()/np.sqrt((a*a).sum()*(b*b).sum()); res.append((d,c))
    # primer pico alto (>= 0.9 del máximo)
    mx=max(c for d,c in res)
    for i in range(1,len(res)-1):
        d,c=res[i]
        if c>=0.9*mx and c>=res[i-1][1] and c>=res[i+1][1]: return d,c
    return max(res,key=lambda r:r[1])
def analizar(path):
    im=Image.open(path).convert("L"); s=400/max(im.size); im=im.resize((int(im.width*s),int(im.height*s)))
    g=np.asarray(im,float)
    return periodo(g,0), periodo(g,1), s
if __name__=="__main__":
    import glob
    for f in sorted(glob.glob("../telas/*.jpg")): print(f, analizar(f))
