# Maqueta con la tela pegada en perspectiva a escala real sobre el frente.
import numpy as np, math
from PIL import Image, ImageDraw, ImageFilter
from siluetas import FORMAS, W as AW, H as AH
from maqueta import proyector, GROSOR
PXCM=20
def homografia(src, dst):
    A=[];b=[]
    for (x,y),(u,v) in zip(src,dst):
        A.append([x,y,1,0,0,0,-u*x,-u*y]); b.append(u)
        A.append([0,0,0,x,y,1,-v*x,-v*y]); b.append(v)
    return np.linalg.solve(np.array(A,float),np.array(b,float))
import numpy as np
def raya_tile(tela_img):
    if isinstance(tela_img,Image.Image): return tela_img
    from rayas import tile_real2
    return tile_real2(tela_img)[0]
def centro_blanco(tile):
    a=np.asarray(tile.convert("L"),float).mean(axis=0); n=len(a)
    k=max(1,n//60); a=np.convolve(np.concatenate([a[-k:],a,a[:k]]),np.ones(2*k+1)/(2*k+1),mode="same")[k:-k]
    claro=a>(a.min()+0.75*(a.max()-a.min()))
    best=(0,0); i=0
    dbl=np.concatenate([claro,claro])
    run=0; start=0
    for k in range(2*n):
        if dbl[k]:
            if run==0: start=k
            run+=1
            if run>best[0] and run<=n: best=(run,start)
        else: run=0
    return int((best[1]+best[0]/2)%n)
APLANAR=True
def aplanar_fondo(img, sigma_cm=0.22):
    """Iguala el tono del fondo claro de una tela de rayas (quita 'parches' más claros/oscuros que salen al
    juntar trozos de la foto), sin tocar las rayas ni la trama fina. Normaliza por la luz local del fondo."""
    from PIL import ImageFilter
    a=np.asarray(img.convert("RGB"),float); L=a.mean(axis=2)
    med=np.median(L); fondo=(L>med-22).astype(float)            # píxeles de fondo (no raya)
    pad=int(sigma_cm*PXCM*3)
    def blur(x):
        xp=np.pad(x,((pad,pad),(pad,pad)),mode="wrap")
        im=Image.fromarray(np.clip(xp,0,255).astype("uint8")) if x.max()>1.5 else Image.fromarray((xp*255).astype("uint8"))
        r=np.asarray(im.filter(ImageFilter.GaussianBlur(sigma_cm*PXCM)),float)[pad:-pad,pad:-pad]
        return r if x.max()>1.5 else r/255
    num=blur(np.clip(L*fondo/1.0,0,255)); den=blur(fondo)
    loc=num/np.maximum(den,0.05)
    ref=np.median(L[fondo>0])
    f=np.clip(ref/np.maximum(loc,1),0.8,1.25)
    return Image.fromarray(np.clip(a*f[...,None],0,255).astype("uint8"))
def tejido(tela_img, ancho_foto_cm, modo="espejo", lienzo=(int(AW*PXCM),int(AH*PXCM))):
    """Tela repetida en un lienzo de 150x100 cm. ancho_foto_cm = cm reales que abarca la foto.
    modo: espejo (rayas, ikat), periodo (recorta el módulo exacto), liso (color medio)."""
    if modo=="raya":
        tile=raya_tile(tela_img)
        n=max(1,round(AW/ancho_foto_cm)); per=AW/n                  # nº exacto de repeticiones en 150 cm
        tw=round(per*PXCM); tile=tile.resize((tw, max(1,round(tile.height*tw/tile.width))),Image.LANCZOS)
        fase=centro_blanco(tile)                                     # columna en el centro del mayor hueco claro
        tile=Image.fromarray(np.roll(np.asarray(tile),-fase,axis=1))  # el tile empieza en mitad del blanco
        # columna continua en vertical: módulos encadenados con un fundido (sin espejos ni costuras)
        a=np.asarray(tile,float); th=a.shape[0]; ov=max(8,th//6); paso=th-ov
        col=np.zeros((lienzo[1]+th,tw,3)); peso=np.zeros((lienzo[1]+th,1,1))
        ramp=np.ones((th,1,1)); ramp[:ov,0,0]=np.linspace(0,1,ov); ramp[-ov:,0,0]=np.linspace(1,0,ov)
        for y in range(0,lienzo[1]+1,paso):
            h=min(th,col.shape[0]-y); col[y:y+h]+=a[:h]*ramp[:h]; peso[y:y+h]+=ramp[:h]
        col=Image.fromarray(np.clip(col/np.maximum(peso,1e-3),0,255).astype("uint8"))
        if APLANAR: col=aplanar_fondo(col)
        out=Image.new("RGB",lienzo)
        for x in range(0,lienzo[0]+tw,tw): out.paste(col,(x,0))
        out.info["repeticiones"]=n
        return out
    t=Image.open(tela_img).convert("RGB")
    if modo=="espejo":
        bx,by=int(t.width*0.02),int(t.height*0.02); t=t.crop((bx,by,t.width-bx,t.height-by))  # sin bordes (evita la línea al repetir)
    if modo=="liso":
        c=t.resize((1,1),Image.LANCZOS).getpixel((0,0)); return Image.new("RGB",lienzo,c)
    s=ancho_foto_cm*PXCM/t.width
    if modo=="periodo":
        from periodo import analizar
        (py,_),(px,_),k=analizar(tela_img); t=t.crop((0,0,int(px/k),int(py/k)))
    t=t.resize((max(1,round(t.width*s)),max(1,round(t.height*s))),Image.LANCZOS)
    out=Image.new("RGB",lienzo)
    for j,y in enumerate(range(0,lienzo[1]+t.height,t.height)):
        for i,x in enumerate(range(0,lienzo[0]+t.width,t.width)):
            tt=t
            if modo=="espejo":
                if i%2: tt=tt.transpose(Image.FLIP_LEFT_RIGHT)
                if j%2: tt=tt.transpose(Image.FLIP_TOP_BOTTOM)
            out.paste(tt,(x,y))
    # centrar horizontalmente el dibujo
    return out
def maqueta_tela(forma, salida, tela_img, ancho_foto_cm, vivo_rgb, lateral_img=None, modo="espejo", W=900, H=1200, ang=38):
    P=proyector(W,H,ang); pp=lambda p:P(p)[0]
    im=Image.new("RGB",(W,H),(214,190,152)); d=ImageDraw.Draw(im)
    for k in range(-100,420,16):
        a0,z0=P((k,0,0)); a1,z1=P((k,0,-160))
        if z0>0 and z1>0: d.line([a0,a1],fill=(198,172,134),width=1)
    d.polygon([pp((-100,0,0)),pp((420,0,0)),pp((420,400,0)),pp((-100,400,0))],fill=(236,231,222))
    d.polygon([pp((-100,0,-0.5)),pp((420,0,-0.5)),pp((420,8,-0.5)),pp((-100,8,-0.5))],fill=(246,243,237),outline=(210,204,194))
    pts=FORMAS[forma](); zf=-GROSOR-1.5
    front=[(x,y,zf) for x,y in pts]; back=[(x,y,-1.5) for x,y in pts]
    # lateral: color medio de su tela, algo más oscuro (Gemini pone el dibujo)
    lat=Image.open(lateral_img or tela_img).convert("RGB").resize((1,1),Image.LANCZOS).getpixel((0,0))
    lat=tuple(int(c*0.82) for c in lat)
    quads=[]
    for i in range(len(pts)):
        j=(i+1)%len(pts); q=[front[i],front[j],back[j],back[i]]
        quads.append((sum(P(p)[1] for p in q)/4,q))
    for z,q in sorted(quads,reverse=True): d.polygon([pp(p) for p in q],fill=lat)
    # frente con la tela en perspectiva
    tex=tejido(tela_img, ancho_foto_cm, modo)
    TW,TH=tex.size
    esquinas_tex=[(0,TH),(TW,TH),(TW,0),(0,0)]            # (x=0,y=0) abajo-izq ...
    esquinas_img=[pp((0,0,zf)),pp((AW,0,zf)),pp((AW,AH,zf)),pp((0,AH,zf))]
    coef=homografia(esquinas_img, esquinas_tex)           # salida -> entrada
    warped=tex.transform((W,H),Image.PERSPECTIVE,tuple(coef),Image.BICUBIC)
    mask=Image.new("L",(W,H),0); ImageDraw.Draw(mask).polygon([pp(p) for p in front],fill=255)
    im.paste(warped,(0,0),mask)
    d=ImageDraw.Draw(im)
    d.line([pp(p) for p in front]+[pp(front[0])],fill=vivo_rgb,width=5)
    im.save(salida)
if __name__=="__main__":
    for n,cm,m in [("01",75,"espejo"),("02",35,"espejo"),("03-raya-arequipa",30,"espejo"),("04",34,"periodo"),("05",32,"periodo"),("06",35,"periodo"),("07",30,"espejo"),("08",29,"periodo"),("10",34,"espejo"),("14",16,"periodo")]:
        maqueta_tela("calobra",f"tx-{n}.png",f"../telas/{n}.jpg",cm,(200,150,40),modo=m)
