import json, datetime as dt
g=json.load(open('ga.json'))
def f(n,d=0):
    s=f"{n:,.{d}f}".replace(",","X").replace(".",",").replace("X",".")
    return s
def bars(items, unit="", maxv=None, color="s1", fmtv=None, note=None):
    """items: list of (label, value, extra_html)"""
    mx=maxv or max(v for _,v,*_ in items) or 1
    out='<div class="bars">'
    for it in items:
        lab,v=it[0],it[1]; ex=it[2] if len(it)>2 else ""
        w=max(v/mx*100,0.8)
        out+=f'<div class="br"><div class="bl">{lab}{("<small>"+ex+"</small>") if ex else ""}</div><div class="bt"><div class="bb {color}" style="width:{w:.1f}%"></div></div><div class="bv">{fmtv(v) if fmtv else f(v)}{unit}</div></div>'
    return out+'</div>'
def spark(vals, cls="s1", w=120, h=34):
    mx=max(vals) or 1; n=len(vals)
    pts=[(i*(w-4)/(n-1)+2, h-3-(v/mx)*(h-8)) for i,v in enumerate(vals)]
    d=" ".join(f"{'M' if i==0 else 'L'}{x:.1f},{y:.1f}" for i,(x,y) in enumerate(pts))
    a=d+f" L{pts[-1][0]:.1f},{h} L{pts[0][0]:.1f},{h} Z"
    return f'<svg class="spark" viewBox="0 0 {w} {h}" aria-hidden="true"><path d="{a}" class="sa {cls}"/><path d="{d}" class="sl {cls}"/><circle cx="{pts[-1][0]:.1f}" cy="{pts[-1][1]:.1f}" r="2.6" class="sd {cls}"/></svg>'
