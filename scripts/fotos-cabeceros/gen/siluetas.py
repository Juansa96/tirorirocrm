# Siluetas frontales (alzado) de las 5 formas a 150 x 100 cm: 75 % recto, 25 % curva.
# Geometría sacada de los croquis que le gustan a Juan (Conta nº 69 Iciar, Macarella
# nº 72 Andrea y nº 2 Marta, mini 01).
from PIL import Image, ImageDraw, ImageFont
import math
W,H=150.0,100.0; R=75.0; C=25.0
N=200
def campana(x0,x1,y0,y1,pUnion):
    """Media campana de (x0,y0) (tangente horizontal, cóncava) a (x1,y1) (cima, tangente
    horizontal). A mitad de ancho ha subido pUnion de la altura (unión tangente)."""
    p=math.log(pUnion)/math.log(0.5)
    out=[]
    for i in range(1,N+1):
        u=i/N; f=((1-math.cos(math.pi*u))/2)**p
        out.append((x0+(x1-x0)*u, y0+(y1-y0)*f))
    return out
def mirror(pts): return [(W-x,y) for x,y in reversed(pts)]
def cove(x0,y0,x1,y1):
    # escalón cóncavo en cuarto de elipse: sale horizontal en (x0,y0), llega vertical a (x1,y1)
    cx,cy=x0,y1; rx,ry=x1-x0,y1-y0
    return [(cx+rx*math.sin(t), cy-ry*math.cos(t)) for t in [i/N*math.pi/2 for i in range(1,N+1)]]
def conta():
    y1=R+C*0.34                           # escalón 1: 25 de ancho, sube 34 %
    izq=[(0,R)]+cove(0,R,25,y1)+campana(25,75,y1,H,0.38/0.66)  # escalón 2 + arco en S tangente
    return [(0,0)]+izq+mirror(izq)[1:]+[(W,0)]
def macarella():
    izq=[(0,R)]+campana(0,75,R,H,0.6)     # escalón 1/4 del ancho sube 60 %, arco 40 %, tangente
    return [(0,0)]+izq+mirror(izq)[1:]+[(W,0)]
def calobra(): return [(0,0),(0,H),(W,H),(W,0)]
def pregonda():
    # lados rectos hasta el 75 % y arco rebajado continuo (sin esquinas)
    return [(0,0),(0,R)]+[(75-75*math.cos(t), R+C*math.sin(t)) for t in [i/N*math.pi for i in range(1,N)]]+[(W,R),(W,0)]
def barbaria(n=5, valle=87.0, suave=4.0, expo=0.75, lado=85.0):
    """5 olas suaves (Juan, 29-30/09): crestas redondas, valles anchos y poco profundos, y los extremos
    bajan redondeados hasta el lateral (cuarto de elipse, sin pico)."""
    w=W/n; A=H-valle; M=n*N*2
    xs=[(i+0.5)/M*W for i in range(M)]
    ys=[valle + A*math.sin(math.pi*((x % w)/w))**expo for x in xs]
    k=int(suave*3*M/W); sg=suave*M/W; wts=[math.exp(-0.5*(j/sg)**2) for j in range(-k,k+1)]
    ys2=[sum(wt*ys[min(M-1,max(0,i+j-k))] for j,wt in enumerate(wts))/sum(wts) for i in range(M)]
    h=w/2
    ic=min(range(M),key=lambda i:abs(xs[i]-h)); yc=ys2[ic]
    for i,x in enumerate(xs):
        d=min(x, W-x)
        if d<h:   # medio arco exterior: de (0,lado) vertical a la cresta (h,H) horizontal
            ys2[i]=lado+(yc-lado)*math.sqrt(max(0.0,1-((h-d)/h)**2))
    return [(0,0),(0,lado)]+list(zip(xs,ys2))+[(W,lado),(W,0)]
def redondear(pts, sigma=3.0, paso=0.25):
    """Suaviza TODAS las esquinas (Juan, 01/10: 'nada de picos, todo un poco redondeado').
    Remuestrea el contorno cerrado cada 'paso' cm y aplica un suavizado gaussiano de 'sigma' cm
    a lo largo del contorno; la base sigue apoyada en el suelo (y>=0)."""
    dens=[]
    n=len(pts)
    for i in range(n):
        (x1,y1),(x2,y2)=pts[i],pts[(i+1)%n]
        k=max(1,int(math.hypot(x2-x1,y2-y1)/paso))
        dens+=[(x1+(x2-x1)*j/k, y1+(y2-y1)*j/k) for j in range(k)]
    m=len(dens); r=int(3*sigma/paso); w=[math.exp(-0.5*(j*paso/sigma)**2) for j in range(-r,r+1)]; sw=sum(w)
    out=[]
    for i in range(m):
        x=sum(w[j]*dens[(i+j-r)%m][0] for j in range(2*r+1))/sw
        y=sum(w[j]*dens[(i+j-r)%m][1] for j in range(2*r+1))/sw
        out.append((x,max(0.0,y)))
    return out[::4]
_BASE={"calobra":calobra,"pregonda":pregonda,"macarella":macarella,"conta":conta,"barbaria":barbaria}
def lados_al_suelo(pts):
    """Esquinas de abajo en escuadra: los laterales bajan rectos hasta el suelo (Juan, 01/10: el vivo
    baja recto hasta abajo del todo)."""
    out=[]
    for x,y in pts:
        if y<12 and x<8: x=0.0
        elif y<12 and x>W-8: x=W
        out.append((x,y))
    return [(0.0,0.0)]+[p for p in out if not (p[1]<0.05 and 0<p[0]<W)]+[(W,0.0)] if False else out
FORMAS={k:(lambda f=f: lados_al_suelo(redondear(f()))) for k,f in _BASE.items()}
def dibujar(nombre,escala=8,m=40,rotulo=False):
    pts=FORMAS[nombre]()
    im=Image.new("RGB",(int(W*escala)+2*m,int(H*escala)+2*m),"white"); d=ImageDraw.Draw(im)
    d.polygon([(m+x*escala, m+(H-y)*escala) for x,y in pts], fill=(212,197,169), outline=(40,40,40))
    if rotulo:
        f=ImageFont.load_default(size=44); d.text((m+20,m+H*escala-70),nombre.capitalize(),fill=(40,40,40),font=f)
        yR=m+(H-R)*escala; d.line([(m-20,yR),(m+W*escala+20,yR)],fill=(120,120,200),width=2)
    im.save(f"silueta-{nombre}{'-rot' if rotulo else ''}.png"); return im
if __name__=="__main__":
    for k in FORMAS: dibujar(k); dibujar(k,rotulo=True)
    ims=[Image.open(f'silueta-{k}-rot.png') for k in FORMAS]
    w,h=ims[0].size; s=Image.new('RGB',(w,h*5),'white')
    for i,im in enumerate(ims): s.paste(im,(0,i*h))
    s.resize((w//2,h*5//2)).save('siluetas.png')
