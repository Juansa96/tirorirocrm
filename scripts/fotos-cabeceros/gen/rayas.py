# Telas de rayas verticales perfectamente rectas y equidistantes a partir de una foto.
import numpy as np
from PIL import Image, ImageFilter
def periodo_1d(perfil, pmin, pmax):
    p=perfil-perfil.mean(); best=(0,-1)
    for d in range(pmin,pmax):
        a=p[:-d]; b=p[d:]; c=(a*b).sum()/np.sqrt((a*a).sum()*(b*b).sum())
        if c>best[1]: best=(d,c)
    # afinar a subpíxel buscando el mejor múltiplo
    return best
def tile_raya(path, rot=0, recolor=None, pmin_frac=0.08, pmax_frac=0.6, alto=1200):
    """Devuelve un módulo (una repetición horizontal exacta) con rayas verticales rectas + textura de tejido."""
    im=Image.open(path).convert("RGB")
    if rot: im=im.rotate(rot, expand=True)
    a=np.asarray(im,float); H,W,_=a.shape
    lum=a.mean(axis=2); perfil=lum.mean(axis=0)
    d,c=periodo_1d(perfil,int(W*pmin_frac),int(W*pmax_frac))
    # perfil medio de un periodo promediando todas las repeticiones completas
    n=W//d; prof=np.mean([a[:, k*d:(k+1)*d, :].mean(axis=0) for k in range(n)],axis=0)   # (d,3)
    # textura fina del tejido (paso alto) de la foto, sin rayas
    g=Image.fromarray(lum.astype("uint8")); hp=lum-np.asarray(g.filter(ImageFilter.GaussianBlur(2)),float)
    hh=min(H,alto); tex=np.repeat(prof[None,:,:],hh,axis=0)
    hp_t=hp[:hh,:d] if W>=d else hp[:hh]
    tex=tex+hp_t[...,None]*0.7
    if recolor: tex=recolor(tex)
    return Image.fromarray(np.clip(tex,0,255).astype("uint8")), d, c
def verde_arequipa(tex):
    from scipy_free import blur_cols
    base=np.array([236,230,214.]); gris=np.array([108,108,116.]); verde=np.array([26,74,54.])
    lum=tex.mean(axis=2)
    perfil=lum.mean(axis=0)                                   # intensidad por columna (rayas)
    k=np.clip((np.percentile(perfil,85)-perfil)/(np.percentile(perfil,85)-gris.mean()),0,1.2)
    k=np.where(k<0.22,0,k)[None,:,None]                       # fondo blanco limpio y uniforme
    tejido=lum-blur_cols(lum)                                 # solo la trama fina
    return base*(1-k)+verde*k + tejido[...,None]*0.8
if __name__=="__main__":
    import sys
    for nombre,path,rot,rc in [("03-arequipa","../imagenes/6.jpg",90,verde_arequipa),("02-espiga","../telas/02-wb.jpg",0,None),
                               ("04-baqueira","../telas/04.jpg",0,None),("05-cerler","../telas/05.jpg",0,None),("14-anaya","../telas/14.jpg",0,None),
                               ("07-sage","../telas/07.jpg",0,None),("08-castilla","../telas/08.jpg",0,None)]:
        t,d,c=tile_raya(path,rot,rc); t.save(f"tile-{nombre}.png"); print(nombre,"periodo px",d,"corr %.2f"%c, t.size)
def tile_real(path, rot=0, filas=90, pmin_frac=0.2, pmax_frac=0.7, fila0=None):
    """Módulo sacado tal cual de una franja de la foto (conserva trazos discontinuos)."""
    im=Image.open(path).convert("RGB")
    if rot: im=im.rotate(rot, expand=True)
    a=np.asarray(im,float); H,W,_=a.shape
    d,c=periodo_1d(a.mean(axis=2).mean(axis=0),int(W*pmin_frac),int(W*pmax_frac))
    y0=fila0 if fila0 is not None else H//2-filas//2
    return Image.fromarray(a[y0:y0+filas, 0:d].astype("uint8")), d, c
def tile_real2(path, rot=0, pmin_frac=0.08, pmax_frac=0.6):
    """Módulo = una repetición real de la foto, a toda la altura, sin promediar (sin halos),
    con la luz de la foto aplanada (sin degradados)."""
    im=Image.open(path).convert("RGB")
    if rot: im=im.rotate(rot, expand=True)
    a=np.asarray(im,float); H,W,_=a.shape
    d,c=periodo_1d(a.mean(axis=2).mean(axis=0),int(W*pmin_frac),int(W*pmax_frac))
    # enderezar: estimar desplazamiento de la raya arriba vs abajo y cizallar
    top=a[:H//4].mean(axis=2).mean(axis=0); bot=a[-H//4:].mean(axis=2).mean(axis=0)
    tp=top-top.mean(); bp=bot-bot.mean(); best=(0,-1e9)
    for s in range(-d//3,d//3+1):
        v=(np.roll(bp,s)*tp).sum()
        if v>best[1]: best=(s,v)
    sh=best[0]/(H*0.75)
    im2=im.transform(im.size,Image.AFFINE,(1,sh,-sh*H/2,0,1,0),resample=Image.BICUBIC)
    a=np.asarray(im2,float)
    from PIL import ImageFilter
    L=a.mean(axis=2); big=np.asarray(Image.fromarray(np.clip(L,0,255).astype("uint8")).filter(ImageFilter.GaussianBlur(d*1.5)),float)
    a=a*(L.mean()/np.maximum(big,1))[...,None]
    y0=int(H*0.1); y1=int(H*0.9); x0=W//2-d//2
    t=a[y0:y1,x0:x0+d]; th=t.shape[0]
    # enderezado fino y circular: cada fila se desplaza (con vuelta, el módulo es periódico)
    # para que el arriba y el abajo del módulo casen al encadenarlo en vertical
    def prof(rows): p=rows.mean(axis=2).mean(axis=0); return p-p.mean()
    ref=prof(t[:max(4,th//10)])
    def desfase(rows):
        p=prof(rows); up=np.fft.rfft(p); ur=np.fft.rfft(ref)
        cc=np.fft.irfft(up*np.conj(ur),n=d); k=int(np.argmax(cc))
        return k if k<=d//2 else k-d
    pasos=8; ys=np.linspace(0,th-th//10,pasos).astype(int)
    off=np.array([desfase(t[y:y+th//10]) for y in ys],float)
    off=np.unwrap(off*2*np.pi/d)*d/(2*np.pi)
    ofs=np.interp(np.arange(th),ys+th//20,off)
    xs=np.arange(d)
    out=np.stack([np.stack([np.interp((xs+ofs[i])%d, xs, t[i,:,ch], period=d) for ch in range(3)],axis=1) for i in range(th)])
    return Image.fromarray(np.clip(out,0,255).astype("uint8")), d, c
