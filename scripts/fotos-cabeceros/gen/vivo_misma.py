# Ribete de la MISMA tela: se dibuja con la tela del canto en la misma coordenada (longitud de arco) que usa
# escena.pieza, así las rayas del ribete siguen exactamente las del lateral izquierdo y las de arriba (Juan, 01/10).
import math, numpy as np, escena, combos, tramo_vivo, vivo_det
from PIL import Image, ImageDraw
from siluetas import FORMAS, W as AW, H as AH
from maqueta import GROSOR
from textura import tejido, PXCM
def _coords(forma):
    pts0=FORMAS[forma.lower()](); pts=[]
    for i in range(len(pts0)):
        (x1,y1),(x2,y2)=pts0[i],pts0[(i+1)%len(pts0)]; n=max(1,int(math.hypot(x2-x1,y2-y1)/0.25))
        pts+=[(x1+(x2-x1)*k/n, y1+(y2-y1)*k/n) for k in range(n)]
    n=len(pts); ic=min(range(n),key=lambda k:abs(pts[k][0]-AW/2)-pts[k][1]*0.001)
    U=[0.0]*n; U[ic]=pts[ic][0]
    for k in range(1,n):
        a=(ic-k)%n; b=(a+1)%n; U[a]=U[b]-math.hypot(pts[b][0]-pts[a][0],pts[b][1]-pts[a][1])
        if a==(ic+1)%n: break
    for k in range(1,n):
        a=(ic+k)%n; b=(a-1)%n; U[a]=U[b]+math.hypot(pts[a][0]-pts[b][0],pts[a][1]-pts[b][1])
        if a==(ic-1)%n: break
    return pts,U
def aplicar(img, c, forma, ancho_cm=0.75, en_borde=False):
    img=img.convert("RGB"); W,H=img.size; P=escena.P_(W,H); pp=lambda p:P(p)[0]; zf=-GROSOR-1.5
    tile=combos.tile_de(c); tex=tejido(tile if tile is not None else c["tela_img"], c["ancho_cm"], c["modo"])
    ltex=tejido(c["lateral_img"],c.get("lateral_cm",10),c.get("lateral_modo","tile")) if c.get("lateral_img") else tex
    rep=ltex.info.get("repeticiones"); TW=ltex.size[0]; per=(TW/rep) if rep else TW
    lt=np.asarray(ltex.convert("RGB"),float); LH=lt.shape[0]
    pts,_=_coords(forma); A=np.array(pts); FR=escena.franjas_de(tex)
    # lateral derecho: fase que deja el remate de abajo sin raya (Juan, 02/10: 'el cuadrado' abajo a la dcha)
    lt0=np.asarray(ltex.convert("L"),float); med=np.median(lt0)
    def oscuro(U):
        sel=[k for k in range(len(pts)) if pts[k][0]>149 and pts[k][1]<3.4]
        return sum(max(0.0,med-lt0[min(lt0.shape[0]-1,int(max(0,(AH-pts[k][1])*PXCM))), int((U[k]*PXCM)%per)%TW]) for k in sel)
    U=escena.coords_u(pts,franjas=FR)
    if oscuro(U)>0:
        mejor=min(np.arange(0,per/PXCM,0.25),key=lambda d:oscuro(escena.coords_u(pts,dcha_desfase=float(d),franjas=FR)))
        U=escena.coords_u(pts,dcha_desfase=float(mejor),franjas=FR)
    borde=tramo_vivo.tramo(pts); fino=[]
    for i in range(len(borde)-1):
        (x,y),(x2,y2)=borde[i],borde[i+1]; k=max(1,int(math.hypot(x2-x,y2-y)/0.05))
        fino+=[(x+(x2-x)*j/k,y+(y2-y)*j/k) for j in range(k)]
    fino.append(borde[-1])
    fino,_,orig=vivo_det.remate_pts(fino)   # remate: se mete un poco abajo (el color sigue el punto original)
    # U de cada punto fino: interpolado sobre el tramo del contorno más cercano
    Ua=np.array(U); cols=[]
    for x,y in orig:
        i=int(np.argmin((A[:,0]-x)**2+(A[:,1]-y)**2)); best=None
        for a_,b_ in (((i-1)%len(pts),i),(i,(i+1)%len(pts))):   # el tramo correcto: el de la proyección más cercana
            if abs(Ua[b_]-Ua[a_])>=5: continue
            sg_=A[b_]-A[a_]; t=float(np.clip(((x,y)-A[a_])@sg_/max(1e-9,sg_@sg_),0,1))
            dd=float(np.sum((A[a_]+t*sg_-(x,y))**2))
            if best is None or dd<best[0]: best=(dd,Ua[a_]+t*(Ua[b_]-Ua[a_]))
        u=best[1] if best else Ua[i]
        uu=int((u*PXCM)%per); v=int(min(max(0,(AH-y)*PXCM), LH-GROSOR*PXCM-1))+2
        cols.append(lt[min(LH-1,v), uu%TW])
    cols=[(np.array(cols[k])+np.array(cols[min(k+1,len(cols)-1)]))/2 for k in range(len(cols))]
    cm=Image.new("RGB",(W,H),(0,0,0)); d=ImageDraw.Draw(cm)
    b0=pp((75,50,zf)); b1=pp((76,50,zf)); w=max(4,int(ancho_cm*abs(b1[0]-b0[0])*1.8))
    des=(lambda x,y:0.0) if en_borde else vivo_det.desfase_dcha(img, ancho_cm, 1.2)
    L=np.array([(pp((x,y,zf))[0]+des(x,y),pp((x,y,zf))[1]) for x,y in fino],float)
    # franjas perpendiculares al recorrido (sin solapes): cada trozo lleva exactamente su color
    t=np.gradient(L,axis=0); t/=np.maximum(1e-9,np.linalg.norm(t,axis=1))[:,None]; nrm=np.stack([-t[:,1],t[:,0]],1)*w/2
    for k in range(len(L)-1):
        cc=tuple(int(v) for v in cols[k])
        q=[tuple(L[k]+nrm[k]),tuple(L[k+1]+nrm[k+1]),tuple(L[k+1]-nrm[k+1]),tuple(L[k]-nrm[k])]
        d.polygon(q,fill=cc)
    for k in (0,len(L)-1):   # remates: que el cordón no quede sin color en los extremos
        cc=tuple(int(v) for v in cols[min(k,len(cols)-1)]); r=w/2
        d.ellipse([L[k][0]-r,L[k][1]-r,L[k][0]+r,L[k][1]+r],fill=cc)
    for k in range(len(L)-1):
        cc=tuple(int(v) for v in cols[k]); d.polygon([tuple(L[k]+nrm[k]),tuple(L[k+1]+nrm[k+1]),tuple(L[k+1]-nrm[k+1]),tuple(L[k]-nrm[k])],fill=cc)
    return vivo_det.aplicar(img, forma, (0,0,0), ancho_cm, colmap=cm, dcha=True, desfase=des, escala_dcha=1.2)
