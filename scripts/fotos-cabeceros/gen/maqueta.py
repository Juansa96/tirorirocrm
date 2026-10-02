# Maqueta 3D (proyección en perspectiva) de la pieza apoyada en el suelo contra la pared.
import math
from PIL import Image, ImageDraw
from siluetas import FORMAS
GROSOR=8.0
def proyector(W=900,H=1200,ang=38,alt=70,dist=330,focal=1500, centro=(75,48,-4)):
    a=math.radians(ang); cx,cy,cz=centro
    cam=(cx - dist*math.sin(a), alt, cz - dist*math.cos(a))
    fx,fy,fz=cx-cam[0],cy-cam[1],cz-cam[2]; n=math.sqrt(fx*fx+fy*fy+fz*fz); f=(fx/n,fy/n,fz/n)
    r=(f[2],0,-f[0]); rn=math.hypot(r[0],r[2]); r=(r[0]/rn,0,r[2]/rn)
    u=(r[1]*f[2]-r[2]*f[1], r[2]*f[0]-r[0]*f[2], r[0]*f[1]-r[1]*f[0])
    if u[1]<0: u=(-u[0],-u[1],-u[2])
    def P(p):
        d=(p[0]-cam[0],p[1]-cam[1],p[2]-cam[2])
        x=sum(d[i]*r[i] for i in range(3)); y=sum(d[i]*u[i] for i in range(3)); z=sum(d[i]*f[i] for i in range(3))
        return (W/2+focal*x/z*W/900, H/2-focal*y/z*W/900), z
    return P
def maqueta(forma, salida, W=900, H=1200, ang=38):
    P=proyector(W,H,ang)
    im=Image.new("RGB",(W,H),(236,231,222)); d=ImageDraw.Draw(im)
    pp=lambda p: P(p)[0]
    # suelo de tablas (fondo) + pared (z=0) + rodapié
    d.rectangle([0,0,W,H],fill=(214,190,152))
    for k in range(-100,420,16):
        a0,z0=P((k,0,0)); a1,z1=P((k,0,-160))
        if z0>0 and z1>0: d.line([a0,a1],fill=(198,172,134),width=1)
    d.polygon([pp((-100,0,0)),pp((420,0,0)),pp((420,400,0)),pp((-100,400,0))],fill=(236,231,222))
    d.polygon([pp((-100,0,-0.5)),pp((420,0,-0.5)),pp((420,8,-0.5)),pp((-100,8,-0.5))],fill=(246,243,237),outline=(210,204,194))
    pts=FORMAS[forma]()
    front=[(x,y,-GROSOR-1.5) for x,y in pts]; back=[(x,y,-1.5) for x,y in pts]
    quads=[]
    for i in range(len(pts)):
        j=(i+1)%len(pts); q=[front[i],front[j],back[j],back[i]]
        z=sum(P(p)[1] for p in q)/4; quads.append((z,q))
    for z,q in sorted(quads,reverse=True): d.polygon([pp(p) for p in q],fill=(150,140,125))
    d.polygon([pp(p) for p in front],fill=(212,197,169))
    d.line([pp(p) for p in front[1:-1]]+[pp(front[-1])],fill=(200,150,30),width=4)
    d.line([pp(front[-1]),pp(front[0]),pp(front[1])],fill=(200,150,30),width=4)
    im.save(salida)
if __name__=="__main__":
    for k in FORMAS: maqueta(k,f"maqueta-{k}.png")
