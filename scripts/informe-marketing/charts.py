import json, datetime as dt
g=json.load(open('ga.json'))
def fmt(n): return f"{int(round(n)):,}".replace(",",".")
# --- serie diaria: total vs Meta pago
tot={r[0]:int(r[1]) for r in g['serie']}
pago={}
for d,c,s in g['serie_pago']:
    if 'Sep26' in c or 'meta' in c.lower() or c.startswith('ES_'): pago[d]=pago.get(d,0)+int(s)
days=sorted(tot)
days=days[-45:]
W,H,L,R,T,B=720,240,40,16,16,30
mx=max(tot[d] for d in days); ymax=((mx//100)+1)*100
def X(i): return L+(W-L-R)*i/(len(days)-1)
def Y(v): return T+(H-T-B)*(1-v/ymax)
grid="".join(f'<line x1="{L}" x2="{W-R}" y1="{Y(v):.1f}" y2="{Y(v):.1f}" class="grid"/><text x="{L-6}" y="{Y(v)+4:.1f}" class="ax" text-anchor="end">{v}</text>' for v in range(0,ymax+1,100))
def path(key):
    return " ".join(f"{'M' if i==0 else 'L'}{X(i):.1f},{Y(key.get(d,0)):.1f}" for i,d in enumerate(days))
area=path(tot)+f" L{X(len(days)-1):.1f},{Y(0):.1f} L{X(0):.1f},{Y(0):.1f} Z"
ticks=""
for i,d in enumerate(days):
    dd=dt.date(int(d[:4]),int(d[4:6]),int(d[6:]))
    if dd.day in (1,8,15,22) :
        ticks+=f'<text x="{X(i):.1f}" y="{H-10}" class="ax" text-anchor="middle">{dd.day} {["","ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"][dd.month]}</text>'
hits=""
step=(W-L-R)/(len(days)-1)
for i,d in enumerate(days):
    dd=dt.date(int(d[:4]),int(d[4:6]),int(d[6:]))
    hits+=f'<rect x="{X(i)-step/2:.1f}" y="{T}" width="{step:.1f}" height="{H-T-B}" class="hit" data-t="{dd.day}/{dd.month}" data-a="{tot.get(d,0)}" data-b="{pago.get(d,0)}"/>'
li=len(days)-1
serie=f'''<svg viewBox="0 0 {W} {H}" class="chart" role="img" aria-label="Visitas diarias a la web y visitas desde anuncios de Meta, últimos 45 días">
{grid}<path d="{area}" class="area"/><path d="{path(tot)}" class="l1"/><path d="{path(pago)}" class="l2"/>
<circle cx="{X(li):.1f}" cy="{Y(tot[days[li]]):.1f}" r="4" class="d1"/>
{ticks}<line class="xh" x1="0" x2="0" y1="{T}" y2="{H-B}" hidden/>{hits}</svg>'''
# --- embudo
emb=g['embudo_d30']; base=emb[0][1]
rows=""
for name,v in emb:
    pct=v/base*100
    rows+=f'<div class="frow"><div class="flab">{name}</div><div class="ftrack"><div class="fbar" style="width:{max(pct,0.6):.1f}%"></div></div><div class="fval"><b>{fmt(v)}</b> <span>{pct:.1f}%</span></div></div>'
# --- canales mes: sesiones
can=[r for r in g['canales_mes'] if int(r[1])>=10]
names={"Organic Social":"Instagram orgánico","Paid Social":"Anuncios Meta","Organic Search":"Google (orgánico)","Direct":"Directo","Paid Search":"Google Ads","AI Assistant":"ChatGPT y otras IA","Referral":"Otras webs"}
mxc=max(int(r[1]) for r in can)
crow="".join(f'<div class="brow"><div class="blab">{names.get(r[0],r[0])}</div><div class="btrack"><div class="bbar" style="width:{int(r[1])/mxc*100:.1f}%"></div></div><div class="bval">{fmt(int(r[1]))}</div></div>' for r in can)
json.dump({"serie":serie,"embudo":rows,"canales":crow},open("charts.json","w"))
print("ok", ymax, len(days))
