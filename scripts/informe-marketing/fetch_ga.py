"""Descarga de Google Analytics 4 todo lo que usa el parte diario -> ga.json.
Uso: python3 fetch_ga.py [AAAA-MM-DD]   (fecha de HOY; "ayer" es el día anterior)
"""
import json, datetime as dt
from ga import run, rows
today=dt.date.fromisoformat(__import__("sys").argv[1]) if len(__import__("sys").argv)>1 else dt.date.today()
y=today-dt.timedelta(1)
def iso(d): return d.isoformat()
P={
 "ayer":(y,y), "ayer_prev":(y-dt.timedelta(7),y-dt.timedelta(7)),
 "sem":(y-dt.timedelta(6),y), "sem_prev":(y-dt.timedelta(13),y-dt.timedelta(7)),
 "mes":(y.replace(day=1),y),
}
pm_end=(y.replace(day=1)-dt.timedelta(1)); 
P["mes_prev"]=(pm_end.replace(day=1), pm_end.replace(day=min(y.day,pm_end.day)))
P["d30"]=(y-dt.timedelta(29),y)
out={"hoy":iso(today),"periodos":{k:[iso(a),iso(b)] for k,(a,b) in P.items()}}
TOT=["activeUsers","newUsers","sessions","engagedSessions","engagementRate","averageSessionDuration","screenPageViews"]
def dr(k): a,b=P[k]; return {"startDate":iso(a),"endDate":iso(b)}
EV={"filter":{"fieldName":"eventName","inListFilter":{"values":["generate_lead","form_start","ads_conversion_Contact_Us_1","click"]}}}
out["totales"]={}; out["eventos"]={}
for k in P:
    r=rows(run({"dateRanges":[dr(k)],"metrics":[{"name":m} for m in TOT]}))
    out["totales"][k]=dict(zip(TOT,[float(x) for x in r[0]])) if r else {}
    ev=rows(run({"dateRanges":[dr(k)],"dimensions":[{"name":"eventName"},{"name":"linkDomain"}],"metrics":[{"name":"eventCount"},{"name":"totalUsers"}],"dimensionFilter":EV}))
    e={"form_start":0,"generate_lead_users":0,"whatsapp_clicks":0,"instagram_clicks":0,"gracias":0}
    for n,dom,c,u in ev:
        if n=="form_start": e["form_start"]+=int(u)
        if n=="generate_lead": e["generate_lead_users"]+=int(u)
        if n=="click" and dom=="wa.me": e["whatsapp_clicks"]+=int(u)
        if n=="click" and "instagram" in dom: e["instagram_clicks"]+=int(u)
    g=rows(run({"dateRanges":[dr(k)],"dimensions":[{"name":"pagePath"}],"metrics":[{"name":"totalUsers"}],"dimensionFilter":{"filter":{"fieldName":"pagePath","stringFilter":{"value":"/gracias"}}}}))
    e["gracias"]=int(g[0][1]) if g else 0
    out["eventos"][k]=e
def tab(k,dims,mets,limit=15,order=None,flt=None):
    b={"dateRanges":[dr(k)],"dimensions":[{"name":d} for d in dims],"metrics":[{"name":m} for m in mets],"limit":limit,
       "orderBys":[{"metric":{"metricName":order or mets[0]},"desc":True}]}
    if flt: b["dimensionFilter"]=flt
    return rows(run(b))
M=["sessions","totalUsers","engagementRate","averageSessionDuration"]
for k in ["sem","mes","ayer"]:
    out[f"canales_{k}"]=tab(k,["sessionDefaultChannelGroup"],M)
    out[f"fuentes_{k}"]=tab(k,["sessionSourceMedium"],M,20)
    out[f"campanas_{k}"]=tab(k,["sessionCampaignName","sessionSourceMedium"],M,15)
    out[f"leads_fuente_{k}"]=tab(k,["sessionSourceMedium","eventName"],["totalUsers"],30,flt={"filter":{"fieldName":"eventName","inListFilter":{"values":["generate_lead","form_start"]}}})
    out[f"wa_fuente_{k}"]=tab(k,["sessionSourceMedium"],["totalUsers"],20,flt={"andGroup":{"expressions":[{"filter":{"fieldName":"eventName","stringFilter":{"value":"click"}}},{"filter":{"fieldName":"linkDomain","stringFilter":{"value":"wa.me"}}}]}})
for k in ["mes","d30"]:
    out[f"edad_{k}"]=tab(k,["userAgeBracket"],["totalUsers","engagementRate"],10)
    out[f"genero_{k}"]=tab(k,["userGender"],["totalUsers"],5)
    out[f"ciudad_{k}"]=tab(k,["city"],["totalUsers","sessions","engagementRate"],15)
    out[f"region_{k}"]=tab(k,["region"],["totalUsers"],12)
    out[f"pais_{k}"]=tab(k,["country"],["totalUsers"],6)
    out[f"disp_{k}"]=tab(k,["deviceCategory"],["totalUsers","engagementRate","averageSessionDuration"],5)
    out[f"landing_{k}"]=tab(k,["landingPage"],["sessions","engagementRate","averageSessionDuration","bounceRate"],15)
    out[f"paginas_{k}"]=tab(k,["pagePath"],["totalUsers","screenPageViews","userEngagementDuration"],20,order="totalUsers")
    out[f"hora_{k}"]=tab(k,["hour"],["sessions"],24)
    out[f"diasem_{k}"]=tab(k,["dayOfWeek"],["sessions"],7)
    out[f"leads_edad_{k}"]=tab(k,["userAgeBracket","eventName"],["totalUsers"],20,flt={"filter":{"fieldName":"eventName","inListFilter":{"values":["generate_lead","form_start"]}}})
    out[f"leads_disp_{k}"]=tab(k,["deviceCategory","eventName"],["totalUsers"],10,flt={"filter":{"fieldName":"eventName","inListFilter":{"values":["generate_lead","form_start"]}}})
# serie diaria 60 dias
a=y-dt.timedelta(59)
out["serie"]=rows(run({"dateRanges":[{"startDate":iso(a),"endDate":iso(y)}],"dimensions":[{"name":"date"}],"metrics":[{"name":"sessions"},{"name":"totalUsers"}],"orderBys":[{"dimension":{"dimensionName":"date"}}],"limit":100}))
out["serie_pago"]=rows(run({"dateRanges":[{"startDate":iso(a),"endDate":iso(y)}],"dimensions":[{"name":"date"},{"name":"sessionCampaignName"}],"metrics":[{"name":"sessions"}],"dimensionFilter":{"filter":{"fieldName":"sessionMedium","stringFilter":{"matchType":"CONTAINS","value":"paid"}}},"orderBys":[{"dimension":{"dimensionName":"date"}}],"limit":500}))
out["serie_leads"]=rows(run({"dateRanges":[{"startDate":iso(a),"endDate":iso(y)}],"dimensions":[{"name":"date"}],"metrics":[{"name":"totalUsers"}],"dimensionFilter":{"filter":{"fieldName":"pagePath","stringFilter":{"value":"/gracias"}}},"limit":100}))
# embudo 30d: usuarios que ven cada paso
steps={"Cualquier página":None,"Productos":"/productos","Configurador":"/configurador","Empieza formulario":"form_start","Lead (gracias)":"/gracias"}
emb=[]
for name,v in steps.items():
    if v is None: r=rows(run({"dateRanges":[dr("d30")],"metrics":[{"name":"totalUsers"}]}))
    elif v=="form_start": r=rows(run({"dateRanges":[dr("d30")],"metrics":[{"name":"totalUsers"}],"dimensionFilter":{"filter":{"fieldName":"eventName","stringFilter":{"value":"form_start"}}}}))
    else: r=rows(run({"dateRanges":[dr("d30")],"metrics":[{"name":"totalUsers"}],"dimensionFilter":{"filter":{"fieldName":"pagePath","stringFilter":{"matchType":"BEGINS_WITH","value":v}}}}))
    emb.append([name,int(r[0][0]) if r else 0])
out["embudo_d30"]=emb

# --- Google Ads (coste real vía GA4, cuenta vinculada)
out["google_ads_d30"]=rows(run({"dateRanges":[dr("d30")],"dimensions":[{"name":"sessionGoogleAdsCampaignName"}],"metrics":[{"name":"advertiserAdCost"},{"name":"advertiserAdClicks"},{"name":"advertiserAdImpressions"},{"name":"sessions"}]}))
out["google_ads_sem"]=rows(run({"dateRanges":[dr("sem")],"dimensions":[{"name":"sessionGoogleAdsCampaignName"}],"metrics":[{"name":"advertiserAdCost"},{"name":"advertiserAdClicks"},{"name":"advertiserAdImpressions"},{"name":"sessions"}]}))
out["google_ads_ayer"]=rows(run({"dateRanges":[dr("ayer")],"dimensions":[{"name":"sessionGoogleAdsCampaignName"}],"metrics":[{"name":"advertiserAdCost"},{"name":"advertiserAdClicks"},{"name":"advertiserAdImpressions"},{"name":"sessions"}]}))
# --- anuncios (Meta y demás) según Analytics: campaña y creatividad
out["anuncios_d30"]=rows(run({"dateRanges":[dr("d30")],"dimensions":[{"name":"sessionCampaignName"},{"name":"sessionManualAdContent"},{"name":"sessionSourceMedium"}],"metrics":[{"name":"sessions"},{"name":"totalUsers"}],"dimensionFilter":{"filter":{"fieldName":"sessionMedium","stringFilter":{"matchType":"CONTAINS","value":"paid"}}},"limit":30}))
# --- WhatsApp: clics por canal, página y botón (texto del enlace)
WA={"andGroup":{"expressions":[{"filter":{"fieldName":"eventName","stringFilter":{"value":"click"}}},{"filter":{"fieldName":"linkDomain","stringFilter":{"value":"wa.me"}}}]}}
for k in ["d30","sem"]:
    out[f"wa_canal_{k}"]=tab(k,["sessionSourceMedium"],["totalUsers","eventCount"],20,flt=WA)
    out[f"wa_pagina_{k}"]=tab(k,["pagePath"],["totalUsers","eventCount"],20,flt=WA)
    out[f"wa_boton_{k}"]=tab(k,["linkUrl"],["eventCount"],20,order="eventCount",flt=WA)
# --- recorrido: paso de una página a otra y scroll hasta el final
out["transiciones_d30"]=tab("d30",["pageReferrer","pagePath"],["totalUsers"],40,flt={"andGroup":{"expressions":[{"filter":{"fieldName":"eventName","stringFilter":{"value":"page_view"}}},{"filter":{"fieldName":"pageReferrer","stringFilter":{"matchType":"CONTAINS","value":"tirorirohome"}}}]}})
out["scroll_d30"]=tab("d30",["pagePath"],["totalUsers"],20,flt={"filter":{"fieldName":"eventName","stringFilter":{"value":"scroll"}}})
# --- picos: fuente y hora de los 3 días con más visitas de los últimos 30
top=sorted([r for r in out["serie"][-30:]],key=lambda r:-int(r[1]))[:3]
out["picos"]={}
for d,_s,_u in top:
    iso_d=f"{d[:4]}-{d[4:6]}-{d[6:]}"
    out["picos"][iso_d]={"hora_fuente":rows(run({"dateRanges":[{"startDate":iso_d,"endDate":iso_d}],"dimensions":[{"name":"hour"},{"name":"sessionSourceMedium"}],"metrics":[{"name":"sessions"}],"limit":8,"orderBys":[{"metric":{"metricName":"sessions"},"desc":True}]})),
      "landing":rows(run({"dateRanges":[{"startDate":iso_d,"endDate":iso_d}],"dimensions":[{"name":"landingPage"}],"metrics":[{"name":"sessions"}],"limit":5,"orderBys":[{"metric":{"metricName":"sessions"},"desc":True}]}))}
json.dump(out,open("ga.json","w"),ensure_ascii=False,indent=1)
print("ok", len(json.dumps(out)))
