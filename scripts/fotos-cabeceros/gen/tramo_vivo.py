# Tramo del ribete: sube recto por cada lateral desde donde empieza la curva de la esquina de abajo
# (ahí se mete en la costura), recorre el borde superior y baja por el otro lateral hasta su curva.
def tramo(pts, tol=0.12):
    i0=min(range(len(pts)),key=lambda i:pts[i][1]+abs(pts[i][0]-75)*0.001)
    pts=pts[i0:]+pts[:i0]
    W=max(p[0] for p in pts)
    yi=0.15; yd=0.15   # el vivo baja recto hasta abajo del todo
    out=[]
    for x,y in pts:
        if x<W/2 and y<yi: continue
        if x>=W/2 and y<yd: continue
        out.append((x,y))
    return out
