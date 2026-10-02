import math
# Escena fija para las 80 fotos: misma cámara, mismo fondo.
from PIL import Image, ImageDraw
from maqueta import proyector, GROSOR
from siluetas import FORMAS, W as AW, H as AH
from textura import tejido, homografia
CAM=dict(ang=38, alt=60, dist=280, focal=1500, centro=(64,40,-4))
def P_(W,H):
    c=CAM; return proyector(W,H,c["ang"],c["alt"],c["dist"],c["focal"],c["centro"])
def fondo_maqueta(W,H):
    P=P_(W,H); pp=lambda p:P(p)[0]
    im=Image.new("RGB",(W,H),(214,190,152)); d=ImageDraw.Draw(im)
    for k in range(-100,420,16):
        a0,z0=P((k,0,0)); a1,z1=P((k,0,-160))
        if z0>0 and z1>0: d.line([a0,a1],fill=(198,172,134),width=max(1,W//900))
    d.polygon([pp((-100,0,0)),pp((420,0,0)),pp((420,400,0)),pp((-100,400,0))],fill=(236,231,222))
    d.polygon([pp((-100,0,-0.5)),pp((420,0,-0.5)),pp((420,8,-0.5)),pp((-100,8,-0.5))],fill=(246,243,237),outline=(210,204,194))
    return im
def _quad_textura(capa, tex, dst, src, oscurecer=0.9):
    """Pega en 'capa' el rectángulo src=(u0,v0,u1,v1) de 'tex' deformado sobre el cuadrilátero dst (4 puntos)."""
    xs=[p[0] for p in dst]; ys=[p[1] for p in dst]
    x0,y0=int(min(xs))-1,int(min(ys))-1; x1,y1=int(max(xs))+2,int(max(ys))+2
    if x1-x0<1 or y1-y0<1: return
    u0,v0,u1,v1=src
    d=[(x-x0,y-y0) for x,y in dst]
    try: coef=homografia(d,[(u0,v0),(u1,v0),(u1,v1),(u0,v1)])
    except Exception: return
    parche=tex.transform((x1-x0,y1-y0),Image.PERSPECTIVE,tuple(coef),Image.BILINEAR)
    if oscurecer!=1: parche=parche.point(lambda v:int(v*oscurecer))
    m=Image.new("L",parche.size,0); ImageDraw.Draw(m).polygon(d,fill=255)
    capa.paste(parche.convert("RGBA"),(x0,y0),m)
VIVO_MATE=False
def _vivo(d, puntos, col, ancho):
    """Cordón con volumen: borde oscuro, cuerpo y brillo (mate: sin brillo, sombra suave)."""
    if VIVO_MATE:
        osc=tuple(int(c*0.78) for c in col[:3])+(255,)
        d.line(puntos,fill=osc,width=ancho+1,joint="curve"); d.line(puntos,fill=tuple(col[:3])+(255,),width=max(1,int(ancho*0.8)),joint="curve"); return
    osc=tuple(int(c*0.62) for c in col[:3])+(255,); luz=tuple(min(255,int(c*1.25+18)) for c in col[:3])+(255,)
    d.line(puntos,fill=osc,width=ancho+2,joint="curve")
    d.line(puntos,fill=tuple(col[:3])+(255,),width=max(1,int(ancho*0.72)),joint="curve")
    d.line([(x-ancho*0.12,y-ancho*0.18) for x,y in puntos],fill=luz,width=max(1,int(ancho*0.22)),joint="curve")

ARCO=False   # True: reparto antiguo (longitud de arco desde el centro), el de las maquetas hechas antes del 01/10
def coords_arco(pts):
    import math as _m
    n=len(pts); ic=min(range(n),key=lambda k:abs(pts[k][0]-AW/2)-pts[k][1]*0.001)
    U=[0.0]*n; U[ic]=pts[ic][0]
    for k in range(1,n):
        a=(ic-k)%n; b=(a+1)%n; U[a]=U[b]-_m.hypot(pts[b][0]-pts[a][0],pts[b][1]-pts[a][1])
        if a==(ic+1)%n: break
    for k in range(1,n):
        a=(ic+k)%n; b=(a-1)%n; U[a]=U[b]+_m.hypot(pts[a][0]-pts[b][0],pts[a][1]-pts[b][1])
        if a==(ic-1)%n: break
    return U

def franjas_de(tex):
    """Rayas verticales del frente: (periodo en cm, función x->True si en x hay raya (con margen))."""
    import numpy as np
    from textura import PXCM
    rep=tex.info.get("repeticiones")
    if not rep: return None
    a=np.asarray(tex.convert("L"),float).mean(axis=0); per=tex.size[0]/rep
    col=a[:int(round(per))]; med=np.median(col); mn=col.min()
    if med-mn<25: return None
    oscuro=col<(med+mn)/2
    marg=int(0.35*PXCM); o=oscuro.copy()
    for d in range(1,marg+1): o|=np.roll(oscuro,d)|np.roll(oscuro,-d)
    per_cm=per/PXCM
    def en(x): return bool(o[int(round((x%per_cm)*PXCM))%len(o)])
    return per_cm, en
def coords_u(pts, ang0=40.0, ang1=72.0, dcha_desfase=None, franjas=None):
    """Coordenada de la tela a lo largo del canto/ribete. Arriba (también en curvas y olas) u=x: la raya del
    frente sigue igual por el ribete y por el canto (Juan, 01/10). En los laterales que bajan al suelo pasa a
    longitud de arco (rayas horizontales sin huecos). El paso se hace SIEMPRE en un hueco sin raya del frente
    (Juan, 02/10: en la Pregonda una raya del frente no casaba): u=x hasta la última raya que toca el borde y,
    ya en el hueco, du/ds sube suavemente hasta 1."""
    import math as _m
    n=len(pts); X=[p[0] for p in pts]; Y=[p[1] for p in pts]
    def theta(k):
        a=pts[(k-2)%n]; b=pts[(k+2)%n]; dx=b[0]-a[0]; dy=b[1]-a[1]
        return _m.degrees(_m.atan2(abs(dy),abs(dx)+1e-9))
    U=[float(x) for x in X]
    Wd=max(X)
    for lado in ("izq","dcha"):
        cand=[k for k in range(n) if (X[k]<Wd/2 if lado=="izq" else X[k]>=Wd/2) and Y[k]>=1.0]
        k0=min(cand,key=lambda k:Y[k])           # arranque del lateral, junto al suelo
        up=1 if Y[(k0+1)%n]>Y[(k0-1)%n] else -1
        run=[k0]; k=k0
        while True:
            k2=(k+up)%n
            if theta(k2)<min(ang0,25.0) or len(run)>n//2: break
            run.append(k2); k=k2
        sg=-1 if lado=="izq" else 1
        # factor de avance du/ds para cada punto del tramo (de arriba hacia abajo)
        orden=run[::-1]          # de arriba (pendiente suave) a abajo (vertical)
        g=[0.0]*len(orden)
        if franjas:
            per_cm,en=franjas
            # último punto (bajando) que aún pisa una raya del frente con el borde no vertical
            ult=-1
            for i,kk in enumerate(orden):
                if theta(kk)<86 and en(X[kk]): ult=i
            s_acum=0.0
            for i,kk in enumerate(orden):
                c=abs(_m.cos(_m.radians(theta(kk))))
                if i<=ult: g[i]=c; continue
                if i>0: s_acum+=_m.hypot(X[kk]-X[orden[i-1]],Y[kk]-Y[orden[i-1]])
                t=min(1.0,s_acum/1.2); t=t*t*(3-2*t)       # en ~1,2 cm de hueco pasa a longitud de arco
                g[i]=t
        else:
            for i,kk in enumerate(orden):
                th=theta(kk); t=min(1.0,max(0.0,(th-ang0)/(ang1-ang0))); t=t*t*(3-2*t)
                g[i]=(1-t)*abs(_m.cos(_m.radians(th)))+t
        lim=ult if franjas else -1
        for i in range(1,len(orden)):
            a_,b_=orden[i],orden[i-1]
            if i<=lim: U[a_]=X[a_]; continue          # sobre las rayas del frente: exactamente u=x
            dx_=abs(X[a_]-X[b_]); ds_=_m.hypot(X[a_]-X[b_],Y[a_]-Y[b_])
            U[a_]=U[b_]+sg*((1-g[i])*dx_/max(ds_,1e-9)*ds_+g[i]*ds_ if franjas else ds_*g[i]) if franjas else U[b_]+sg*ds_*g[i]
        k=k0
        while True:
            k2=(k-up)%n
            if k2 in run: break
            U[k2]=U[k]+sg*_m.hypot(X[k2]-X[k],Y[k2]-Y[k]); k=k2
            if Y[k2]<0.01: break
    if franjas:
        # Rayas del lateral y del ribete con su ANCHO REAL (Juan, 02/10: "demasiado gordas" en las curvas): en cada
        # cruce de una raya del frente con el borde, u avanza a ritmo 1 (longitud de arco) alrededor del centro del
        # cruce y queda en u=x en sus extremos; así la raya casa en posición y no se ensancha aunque la curva suba.
        per_cm,en=franjas
        S=[0.0]*n
        for k in range(1,n): S[k]=S[k-1]+_m.hypot(X[k]-X[k-1],Y[k]-Y[k-1])
        arriba=[abs(U[k]-X[k])<1e-6 and Y[k]>=1.0 for k in range(n)]
        k=0
        while k<n:
            if not (arriba[k] and en(X[k])): k+=1; continue
            j=k
            while j+1<n and arriba[j+1] and en(X[j+1]): j+=1
            if j>k:
                xc=(X[k]+X[j])/2; h=abs(X[j]-X[k])/2; sgn=1 if X[j]>=X[k] else -1
                c=min(range(k,j+1),key=lambda q:abs(X[q]-xc))
                for q in range(k,j+1):
                    U[q]=xc+sgn*max(-h,min(h,S[q]-S[c]))
            k=j+1
    if dcha_desfase:   # lateral derecho (no se ve su canto): desplaza la fase abajo para que no caiga raya en el remate
        for k in range(n):
            if X[k]>Wd-1.0 and Y[k]<60:
                t=min(1.0,max(0.0,(60-Y[k])/25)); U[k]+=dcha_desfase*t*t*(3-2*t)
    return U

def pieza(forma, tela_img, ancho_cm, vivo_rgb, W, H, lateral_img=None, modo="espejo", vivo_cm=0.9, tile=None,
          lateral_cm=10, lateral_modo="tile"):
    """Capa RGBA del cabecero: frente con la tela a escala, canto con TELA REAL (la misma, o la lateral),
    arriba casando con el frente; vivo con volumen (de color, o de la misma tela casando con la raya)."""
    from textura import PXCM
    P=P_(W,H); pp=lambda p:P(p)[0]
    capa=Image.new("RGBA",(W,H),(0,0,0,0))
    pts0=FORMAS[forma.lower()](); zf=-GROSOR-1.5; zb=-1.5
    pts=[]
    for i in range(len(pts0)):
        (x1,y1),(x2,y2)=pts0[i],pts0[(i+1)%len(pts0)]
        n=max(1,int(math.hypot(x2-x1,y2-y1)/0.25))
        pts+=[(x1+(x2-x1)*k/n, y1+(y2-y1)*k/n) for k in range(n)]
    tex=tejido(tile if tile is not None else tela_img, ancho_cm, modo); TW,TH=tex.size
    ltex=tejido(lateral_img, lateral_cm, lateral_modo) if lateral_img else tex
    a0=pp((75,50,zf)); a1=pp((76,50,zf)); pxcm=abs(a1[0]-a0[0])
    if PXCM/pxcm>1.3:
        from PIL import ImageFilter
        r=0.45*PXCM/pxcm; tex=tex.filter(ImageFilter.GaussianBlur(r)); ltex=ltex.filter(ImageFilter.GaussianBlur(r)) if lateral_img else tex
    # canto: tramos de ~2 cm con la tela deformada; arriba u=x (casa con el frente), en los lados u=y (rayas cruzan el canto)
    quads=[]
    # coordenada continua a lo largo del canto: longitud de arco medida desde el punto más alto del centro,
    # así en los tramos horizontales u=x (casa con el frente) y en curvas y lados la tela sigue sin saltos
    import math as _m
    tex=tejido(tile if tile is not None else tela_img, ancho_cm, modo)
    U=coords_arco(pts) if ARCO else coords_u(pts, franjas=franjas_de(tex))
    for i in range(len(pts)):
        j=(i+1)%len(pts); (x,y),(x2,y2)=pts[i],pts[j]
        if max(y,y2)<0.01: continue              # base apoyada en el suelo (no se ve); el canto llega hasta el suelo
        dst=[pp((x,y,zf)),pp((x2,y2,zf)),pp((x2,y2,zb)),pp((x,y,zb))]
        u0,u1=U[i]*PXCM,U[j]*PXCM
        if abs(u1-u0)>AW*PXCM*0.5: continue        # tramo de cierre (base)
        rep=ltex.info.get("repeticiones") if ltex is not tex else tex.info.get("repeticiones")
        per=(TW/rep) if rep else TW
        k=_m.floor(min(u0,u1)/per); u0-=k*per; u1-=k*per          # la tela se repite: sin salirse del lienzo
        if abs(u1-u0)<1.0: u1=u0+(1.0 if u1>=u0 else -1.0)          # tramo con u casi constante: nunca ancho 0 (salía negro)
        v0=min((AH-max(y,y2))*PXCM, ltex.size[1]-GROSOR*PXCM-1); v0=max(0,v0); src=(u0,v0,u1,v0+GROSOR*PXCM)
        quads.append((sum(P(p)[1] for p in [(x,y,zf),(x2,y2,zb)])/2,dst,src))
    lw=Image.new("RGB",(ltex.size[0]*2,ltex.size[1])); lw.paste(ltex,(0,0)); lw.paste(ltex,(ltex.size[0],0))   # lienzo doble: nunca se sale
    for z,dst,src in sorted(quads,key=lambda q:-q[0]): _quad_textura(capa,lw,dst,src,0.88)
    # frente
    front=[(x,y,zf) for x,y in pts]
    coef=homografia([pp((0,0,zf)),pp((AW,0,zf)),pp((AW,AH,zf)),pp((0,AH,zf))],[(0,TH),(TW,TH),(TW,0),(0,0)])
    warped=tex.transform((W,H),Image.PERSPECTIVE,tuple(coef),Image.BICUBIC).convert("RGBA")
    m=Image.new("L",(W,H),0); ImageDraw.Draw(m).polygon([pp(p) for p in front],fill=255)
    capa.paste(warped,(0,0),m)
    # vivo con volumen en el borde delantero (sin la base)
    ancho=max(3,round(vivo_cm*pxcm)); d=ImageDraw.Draw(capa); tp=tex.load()
    import tramo_vivo
    borde=tramo_vivo.tramo(pts)   # recto por los lados; se mete en la costura antes de la curva de abajo (Juan, 01/10)
    if vivo_rgb is not None:
        _vivo(d,[pp((x,y,zf)) for x,y in borde],vivo_rgb,ancho)
    else:
        fino=[]
        for i in range(len(borde)-1):
            (x,y),(x2,y2)=borde[i],borde[i+1]; k=max(1,int(math.hypot(x2-x,y2-y)/0.25))
            fino+=[(x+(x2-x)*j/k,y+(y2-y)*j/k) for j in range(k)]
        fino.append(borde[-1]); borde=fino
        for i in range(len(borde)-1):
            (x,y),(x2,y2)=borde[i],borde[i+1]
            c=tp[min(TW-1,int(x*PXCM)), min(TH-1,max(0,int((AH-y+0.4)*PXCM)))] if (abs(y2-y)<=abs(x2-x)*1.5 or max(y,y2)>=74) else tp[min(TW-1,int(y*PXCM)),int(50*PXCM)]
            _vivo(d,[pp((x,y,zf)),pp((x2,y2,zf))],c,ancho)
    capa.info["repeticiones"]=tex.info.get("repeticiones")
    return capa
if __name__=="__main__":
    W,H=900,1200
    f=fondo_maqueta(W,H); c=pieza("conta","../telas/01.jpg",75,(200,150,40),W,H)
    f.paste(c,(0,0),c); f.save("encuadre.png")
