"""Cliente mínimo de la API de datos de GA4. La credencial la inyecta el proxy
(credencial «Google Analytics» del entorno, cuenta de servicio de solo lectura)."""
import json, sys, urllib.request
P="543745489"
def run(body, kind="runReport"):
    req=urllib.request.Request(f"https://analyticsdata.googleapis.com/v1beta/properties/{P}:{kind}",data=json.dumps(body).encode(),headers={"Content-Type":"application/json"})
    return json.load(urllib.request.urlopen(req))
def rows(d):
    out=[]
    for r in d.get("rows",[]):
        out.append([v["value"] for v in r.get("dimensionValues",[])]+[v["value"] for v in r["metricValues"]])
    return out
if __name__=="__main__":
    body=json.loads(sys.argv[1]); 
    for r in rows(run(body)): print(" | ".join(r))
