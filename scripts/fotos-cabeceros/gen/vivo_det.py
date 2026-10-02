# Ribete dibujado de forma determinista sobre la foto final: cordón con volumen, trama de tela al bies,
# sombra de contacto y la luz local de la foto de Gemini. Continuo por todo el borde (también abajo).
import numpy as np, escena
from PIL import Image, ImageDraw, ImageFilter
from siluetas import FORMAS
from maqueta import GROSOR
_TRAMA=None
# Remate abajo (Juan, 01/10: "que se meta un poco"): en el último REMATE_CM el cordón se curva hacia dentro
# REMATE_DENTRO cm, adelgaza y se mete en la costura; termina a REMATE_FIN cm del suelo. REMATE_CM=0 -> recto al suelo.
REMATE_CM=2.2; REMATE_FIN=0.0; REMATE_FUNDIDO=0.12; REMATE_ANCHO=0.7   # 02/10: llega hasta el suelo
# Juan, 02/10: el cordón NO se despega del borde (si se va hacia dentro del frente "vuela"). Se queda pegado a la
# costura frente/lateral y se hunde en ella: adelgaza desde el lado del frente, con el borde exterior fijo.
def remate_xy(x, y):
    if REMATE_CM<=0 or y>=REMATE_CM or 1.0<=x<=149.0: return x, 1.0
    t=(REMATE_CM-y)/(REMATE_CM-REMATE_FIN); t=min(1.0,max(0.0,t))
    s_=t*t*(3-2*t)
    fac=1.0-0.55*s_
    hacia_fuera=(1-fac)*REMATE_ANCHO/2          # el borde exterior del cordón no se mueve
    return (x-hacia_fuera if x<75 else x+hacia_fuera), fac
def remate_pts(pts):
    """Aplica el remate a una lista de puntos del ribete: devuelve (puntos, factor de grosor, puntos originales)."""
    out=[]; fac=[]; orig=[]
    if REMATE_CM>0 and pts:   # que llegue hasta el mismo suelo
        if pts[0][1]>0 and (pts[0][0]<1 or pts[0][0]>149): pts=[(pts[0][0],0.0)]+list(pts)
        if pts[-1][1]>0 and (pts[-1][0]<1 or pts[-1][0]>149): pts=list(pts)+[(pts[-1][0],0.0)]
    for x,y in pts:
        if REMATE_CM>0 and y<REMATE_FIN and (x<1 or x>149): continue
        nx,f=remate_xy(x,y); out.append((nx,y)); fac.append(f); orig.append((x,y))
    return out, fac, orig
_TF=None
def trama_fina(W,H):
    """Trama de tejido fina e isótropa (sin vetas en diagonal), en [-1,1]."""
    global _TF
    if _TF is not None and _TF.shape==(H,W): return _TF
    rng=np.random.default_rng(7); t=rng.normal(0,1,(512,512)).astype(np.float32)
    im=Image.fromarray(np.clip(128+t*40,0,255).astype("uint8")).filter(ImageFilter.GaussianBlur(0.8))
    a=(np.asarray(im,float)-128)/40; a=np.clip(a/max(1e-6,a.std())/2.5,-1,1)
    _TF=np.tile(a,(H//512+1,W//512+1))[:H,:W]; return _TF
def trama(W,H):
    global _TRAMA
    if _TRAMA is not None and _TRAMA.shape==(H,W): return _TRAMA
    src=Image.open("../imagenes/6.jpg").convert("L").rotate(45,resample=Image.BICUBIC).crop((180,180,620,620))
    a=np.asarray(src,float); hp=a-np.asarray(src.filter(ImageFilter.GaussianBlur(3)),float)
    t=Image.fromarray(np.clip(128+hp*3,0,255).astype("uint8"))
    big=Image.new("L",(W,H)); [big.paste(t,(x,y)) for x in range(0,W,t.width) for y in range(0,H,t.height)]
    _TRAMA=(np.asarray(big,float)-128)/128; return _TRAMA
def ajustar_derecha(img, pts, linea, pp, zf):
    """En el lateral derecho (x≈150, y<75) busca en cada fila el borde real tela/pared y mueve ahí el ribete."""
    a=np.asarray(img.convert("RGB"),float); H,W,_=a.shape
    pxcm=abs(pp((76,50,zf))[0]-pp((75,50,zf))[0]); R=int(2.5*pxcm)
    offs=[]
    for (x,y),(px,py) in zip(pts,linea):
        if x>149 and y<75:
            r=int(py); x0=int(px)
            pared=a[max(0,r-3):r+4, min(W-1,x0+R):min(W,x0+R+12)].reshape(-1,3).mean(axis=0)
            fila=a[r, max(0,x0-R):min(W,x0+R)]
            d=np.abs(fila-pared).mean(axis=1)
            tela=np.where(d>18)[0]
            offs.append((max(0,x0-R)+tela.max()-x0) if len(tela) else 0)
        else: offs.append(None)
    idx=[i for i,o in enumerate(offs) if o is not None]
    if not idx: return linea
    o=np.array([offs[i] for i in idx],float)
    o=np.median(np.lib.stride_tricks.sliding_window_view(np.pad(o,15,mode='edge'),31),axis=1)
    o=np.convolve(np.pad(o,30,mode="edge"),np.ones(61)/61,mode="valid")   # trazo liso, sin escalones
    out=list(linea)
    for k,i in enumerate(idx):
        # transición suave hacia arriba (y 60..75) para no romper la esquina superior
        y=pts[i][1]; f=1.0 if y<60 else max(0.0,(75-y)/15)
        out[i]=(linea[i][0]+o[k]*f-1, linea[i][1])
    return out
def aplicar(img, forma, color, ancho_cm=0.75, solo_izq=False, escala_dcha=0.72, colmap=None, dcha=False, desfase=None):
    img=img.convert("RGB"); W,H=img.size
    P=escena.P_(W,H); pp=lambda p:P(p)[0]; zf=-GROSOR-1.5
    import tramo_vivo
    pts,fac,_=remate_pts(tramo_vivo.tramo(FORMAS[forma.lower()]())); linea=[pp((x,y,zf)) for x,y in pts]
    # lateral derecho: se queda el ribete de Gemini (liso, grosor constante y remate natural en el suelo)
    sel=[(p,l,f) for p,l,f in zip(pts,linea,fac) if dcha or not (p[0]>148.5 and p[1]<80)]
    pts=[p for p,l,f in sel]; linea=[l for p,l,f in sel]; fac=[f for p,l,f in sel]
    if desfase is not None: linea=[(l[0]+desfase(p[0],p[1]),l[1]) for p,l in zip(pts,linea)]
    if solo_izq:   # repaso del lateral izquierdo con grosor constante, hasta justo antes del remate del suelo
        sel=[(p,l,f) for p,l,f in zip(pts,linea,fac) if p[0]<0.5 and 1.2<=p[1]<=70]
        if not sel: return img
        pts=[p for p,l,f in sel]; linea=[l for p,l,f in sel]; fac=[f for p,l,f in sel]
    a0=pp((75,50,zf)); a1=pp((76,50,zf)); pxcm=abs(a1[0]-a0[0]); w=max(6,int(ancho_cm*pxcm))
    # grosor local según la perspectiva (lo lejano, más fino)
    def wloc(x,y):
        b0=pp((x,y,zf)); b1=pp((x+1,y,zf)); k=escala_dcha if (x>149.5 and y<75) else (1-(1-escala_dcha)*max(0,min(1,(x-140)/10)) if x>140 and y<85 else 1.0)
        return max(3,int(ancho_cm*abs(b1[0]-b0[0])*k))
    # perfil de altura del cordón (cúpula)
    h=Image.new("L",(W,H),0); d=ImageDraw.Draw(h)
    for f in np.linspace(1.0,0.08,14):      # perfil de cilindro: altura sqrt(1-r^2)
        val=int(255*np.sqrt(max(0.0,1-f*f))*0.92+20)
        for k in range(len(linea)-1):
            ww=max(1,int(wloc(*pts[k])*fac[k]*f)); d.line([linea[k],linea[k+1]],fill=val,width=ww)
            r=ww/2; d.ellipse([linea[k][0]-r,linea[k][1]-r,linea[k][0]+r,linea[k][1]+r],fill=val)
    h=h.filter(ImageFilter.GaussianBlur(w/12)); H_=np.asarray(h,float)/255
    m=Image.new("L",(W,H),0); dm=ImageDraw.Draw(m)
    for k in range(len(linea)-1):
        if REMATE_CM<=0 or pts[k][1]>=REMATE_FIN+REMATE_FUNDIDO or 1.0<=pts[k][0]<=149.0: al=255
        else:
            u=max(0.0,min(1.0,(pts[k][1]-REMATE_FIN)/REMATE_FUNDIDO)); al=int(255*u*u*(3-2*u))   # se hunde poco a poco
        ww=max(2,int(wloc(*pts[k])*fac[k])); dm.line([linea[k],linea[k+1]],fill=al,width=ww); r=ww/2; dm.ellipse([linea[k][0]-r,linea[k][1]-r,linea[k][0]+r,linea[k][1]+r],fill=al)
    m=m.filter(ImageFilter.GaussianBlur(max(1.2,w/9)))   # borde blando: sin contorno de dibujo
    M=np.asarray(m,float)/255
    # luz desde arriba a la izquierda: diferencia con el perfil desplazado
    sh=max(1,w//4)
    Hs=np.roll(np.roll(H_,sh,axis=0),sh,axis=1)
    luz=np.clip(0.76+0.22*H_+0.55*(H_-Hs),0.64,1.04)   # cilindro mate: redondo pero sin brillo de plástico (02/10)
    # luz local de la foto de Gemini (sombra general, zona de abajo más oscura...)
    g=np.asarray(img,float); gl=g.mean(axis=2)
    loc=np.asarray(Image.fromarray(np.clip(gl,0,255).astype("uint8")).resize((W//16,H//16)).filter(ImageFilter.GaussianBlur(3)).resize((W,H)),float)
    loc=np.clip(loc/np.percentile(loc[M>0.5],80),0.7,1.08)
    T=trama_fina(W,H)
    if colmap is not None:   # ribete de la misma tela: color punto a punto (casa con el canto)
        cm=np.asarray(colmap,float); tin=(g[M>0.5].mean(axis=0)+1)/(cm[M>0.5].mean(axis=0)+1)
        col=cm*np.clip(tin,0.8,1.2)[None,None,:]*(luz*loc*(1+0.05*T))[...,None]
    else:
        col=np.array(color,float)[None,None,:]*(luz*loc*(1+0.06*T))[...,None]
    # sombra de contacto sobre la tela alrededor del cordón
    s=Image.new("L",(W,H),0); dsh=ImageDraw.Draw(s)
    for k in range(len(linea)-1): dsh.line([linea[k],linea[k+1]],fill=255,width=int(wloc(*pts[k])*fac[k]*1.9))
    if REMATE_CM>0:   # la costura donde se hunde el cordón: una sombra suave que sigue el final del recorrido
        for k in range(len(linea)-1):
            y=pts[k][1]
            if y<REMATE_FIN+REMATE_FUNDIDO and not (1.0<=pts[k][0]<=149.0):
                u=1-max(0.0,min(1.0,(y-REMATE_FIN)/REMATE_FUNDIDO)); v=int(150*u)
                dsh.line([linea[k],linea[k+1]],fill=v,width=max(2,int(wloc(*pts[k])*0.6)))
    s=s.filter(ImageFilter.GaussianBlur(w/2.2))
    S=np.asarray(s,float)/255*0.16
    out=g*(1-S[...,None])
    out=out*(1-M[...,None])+np.clip(col,0,255)*M[...,None]
    return Image.fromarray(np.clip(out,0,255).astype("uint8"))

def desfase_dcha(img, ancho_cm=0.75, escala_dcha=1.0):
    """Lateral derecho: el ribete de Gemini queda un poco por fuera del contorno de la maqueta. Se mide dónde
    acaban sus rayitas oscuras (borde exterior real) y se coloca nuestro ribete encima, tapándolo del todo.
    Devuelve f(x,y) -> desplazamiento en píxeles."""
    a=np.asarray(img.convert("L"),float); H,W=a.shape
    P=escena.P_(W,H); pp=lambda p:P(p)[0]; zf=-GROSOR-1.5
    res=[]
    for y in np.arange(2,78,0.25):
        x0,py=pp((150,y,zf)); r=int(py); x0=int(round(x0))
        dk=np.where(a[r, x0-12:x0+20]<130)[0]; dk=dk[dk>=8]
        if len(dk): res.append(dk.max()-12)
    ext=float(np.median(res))+1 if len(res)>10 else 4.0
    b0=pp((150,40,zf)); b1=pp((151,40,zf)); wl=ancho_cm*abs(b1[0]-b0[0])*escala_dcha
    d=ext-wl/2
    def f(x,y):
        if x<=148.5 or y>80: return 0.0
        k=1.0 if y<62 else max(0.0,(80-y)/18)
        return d*k*min(1.0,(x-148.5)/1.0)
    return f
