import base64, json, time, urllib.request
MODELO="gemini-3.1-flash-image"
def part(path):
    mt="image/png" if path.endswith(".png") else ("image/webp" if path.endswith(".webp") else "image/jpeg")
    return {"inline_data":{"mime_type":mt,"data":base64.b64encode(open(path,"rb").read()).decode()}}
def cuerpo(texto, imagenes, ar="3:4", size="2K"):
    return {"contents":[{"parts":[{"text":texto}]+[part(p) for p in imagenes]}],
            "generationConfig":{"responseModalities":["IMAGE"],"imageConfig":{"aspectRatio":ar,"imageSize":size}}}
def generar(salida, texto, imagenes, ar="3:4", size="2K", modelo=MODELO):
    req=urllib.request.Request(f"https://generativelanguage.googleapis.com/v1beta/models/{modelo}:generateContent",
        data=json.dumps(cuerpo(texto,imagenes,ar,size)).encode(),headers={"Content-Type":"application/json"})
    t=time.time()
    try: r=json.load(urllib.request.urlopen(req,timeout=300))
    except urllib.error.HTTPError as e: print("HTTP",e.code,e.read().decode()[:500]); return False
    for c in r.get("candidates",[]):
        for p in c.get("content",{}).get("parts",[]):
            if "inlineData" in p:
                open(salida,"wb").write(base64.b64decode(p["inlineData"]["data"])); print("ok",salida,f"{time.time()-t:.0f}s"); return True
    print("sin imagen", json.dumps(r)[:500]); return False
