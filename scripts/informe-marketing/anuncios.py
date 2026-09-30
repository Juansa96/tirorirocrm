"""Bloque «Anuncios» del parte: cuánto llevamos gastado, cuánto cuesta cada lead
(CPL), cada venta (CPA) y cada impresión (CPI), qué creatividad funciona mejor
(con su foto) y si hay que invertir más. Lo pidió Juan el 30/09/2026.

Uso:  python3 anuncios.py [anuncios.json]
Lee  anuncios.json (lo monta Claude cada día; formato en INSTRUCCIONES.md,
     ejemplo en anuncios_ejemplo.json) y escribe:
  - anuncios_pagina.html  → se pega tal cual en la página (desplegable abierto)
  - anuncios_email.html   → filas para el email (estilos en línea, miniaturas)
  - anuncios_resumen.json → cifras y veredictos para el titular y los consejos

Todas las reglas (umbrales, veredictos) están aquí para que el parte diga
lo mismo cada día con los mismos datos. No inventa: lo que falta sale como
«pendiente» con el motivo.
"""
import json, sys, html, datetime as dt

MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"]
FOTO_URL = "https://tirorirocrm.lovable.app/api/public/anuncio-foto?id="
OBJ_DEF = {"cpl": 15, "cpa": 40, "coste_chat": 3, "roas": 3, "frecuencia": 3, "subida": 0.2}


def f(n, d=0):
    return f"{n:,.{d}f}".replace(",", "X").replace(".", ",").replace("X", ".")


def eur(n, d=None):
    if n is None:
        return "—"
    if d is None:
        d = 2 if abs(n) < 10 else 0
    return f(n, d) + "\u00a0€"


def pct(n, d=1):
    return "—" if n is None else f(n * 100, d) + "\u00a0%"


def div(a, b):
    return a / b if a is not None and b else None


def e(s):
    return html.escape(str(s or ""), quote=True)


def dia(s):
    s = str(s).replace("-", "")
    return dt.date(int(s[:4]), int(s[4:6]), int(s[6:8]))


# ── Métricas de una campaña o creatividad ───────────────────────────────────
def metricas(x):
    g = x.get("gasto")
    imp = x.get("impresiones")
    cl = x.get("clics_enlace") or x.get("clics")
    leads = x.get("leads")
    chats = x.get("chats")
    ventas = x.get("ventas") or 0
    ingresos = x.get("eur") or 0
    return {
        "gasto": g, "impresiones": imp, "clics": cl, "leads": leads, "chats": chats,
        "ventas": ventas, "eur": ingresos, "visitas": x.get("visitas"),
        "ctr": div(cl, imp),
        "cpc": div(g, cl),
        "cpi": div(g, imp) * 1000 if div(g, imp) is not None else None,  # coste por 1.000 impresiones (CPM)
        "cpl": div(g, leads),
        "coste_chat": div(g, chats),
        "cpa": div(g, ventas),
        "roas": div(ingresos, g),
        "frecuencia": div(imp, x.get("alcance")),
        "conv": div(leads if leads is not None else chats, x.get("visitas")),
    }


# ── Veredicto: ¿invertir más? ────────────────────────────────────────────────
def veredicto_campana(c, m, obj, dias_activa):
    """Devuelve (clave, etiqueta, motivo). Regla en INSTRUCCIONES.md."""
    g = m["gasto"] or 0
    if c.get("tipo") == "whatsapp":
        coste, meta, que = m["coste_chat"], obj["coste_chat"], "chat"
        resultados = m["chats"] or 0
    else:
        coste, meta, que = m["cpl"], obj["cpl"], "lead"
        resultados = m["leads"] or 0
    if c.get("tipo") == "interaccion":
        return ("info", "No trae leads", "Es de interacción (me gusta, seguidores): no se juzga por coste por lead. Si el objetivo es vender, pasar ese dinero a la de leads.")
    if resultados == 0 and g >= 3 * meta:
        return ("bajar", "Bajar o cambiar", f"Lleva {eur(g)} gastados y ningún {que}. Pausar las creatividades sin resultados y probar otra.")
    if dias_activa < 5 or g < 2 * meta:
        return ("esperar", "Esperar", f"Solo {dias_activa} días y {eur(g)}: aún pocos datos para decidir.")
    if m["frecuencia"] and m["frecuencia"] > obj["frecuencia"]:
        return ("bajar", "Cambiar creatividad", f"La misma gente lo ha visto {f(m['frecuencia'],1)} veces: se está cansando. Nueva foto antes de subir dinero.")
    if coste is not None and coste <= meta:
        ficha = (c.get("mes") or {}).get("con_ficha")
        if que == "chat" and ficha is not None and resultados >= 10 and ficha < 0.2 * resultados:
            return ("mantener", "Mantener", f"Cada chat sale barato ({eur(coste)}), pero {'ninguno' if not ficha else f'solo {ficha}'} de los {resultados} tiene ficha en el CRM. Antes de subir, hay que convertir esos chats en leads (contestar y abrir ficha).")
        if m["ventas"] and m["roas"] is not None and m["roas"] < 1:
            return ("mantener", "Mantener", f"El {que} sale barato ({eur(coste)}), pero de momento vende menos de lo que cuesta (ROAS {f(m['roas'],1)}).")
        extra = f" y ya devuelve {f(m['roas'],1)} € por cada € (ROAS)" if m["ventas"] and m["roas"] else ""
        return ("subir", f"Subir +{int(obj['subida']*100)} %", f"Cada {que} cuesta {eur(coste)}, por debajo del objetivo ({eur(meta)}){extra}.")
    if coste is not None and coste <= 1.5 * meta:
        return ("mantener", "Mantener", f"Cada {que} cuesta {eur(coste)}, algo por encima del objetivo ({eur(meta)}). Quitar la creatividad peor antes de subir.")
    return ("bajar", "Bajar", f"Cada {que} cuesta {eur(coste)}, más de 1,5 veces el objetivo ({eur(meta)}).")


def veredicto_creatividad(cr, m, obj, mejor):
    g = m["gasto"]
    res = m["leads"] if m["leads"] is not None else m["chats"]
    if cr is mejor and res:
        return ("subir", "La mejor")
    if g is not None and g >= 2 * obj["cpl"] and not res:
        return ("bajar", "Pausar")
    if g is None and (m["visitas"] or 0) >= 60 and not res:
        return ("bajar", "Pausar")
    if res:
        return ("mantener", "Mantener")
    return ("esperar", "Pocos datos")


def puntuacion(m):
    """Para ordenar creatividades: resultados por euro si hay gasto; si no, por visita."""
    res = m["leads"] if m["leads"] is not None else (m["chats"] or 0)
    res = res or 0
    if m["gasto"]:
        return (res / m["gasto"], res)
    if m["visitas"]:
        return (res / m["visitas"], res)
    return (0, res)


# ── Render ──────────────────────────────────────────────────────────────────
CSS = """<style>
.ads{display:grid;gap:16px}
.ads-gasto{display:grid;grid-template-columns:repeat(4,1fr);gap:1px;background:var(--line);border:1px solid var(--line);border-radius:10px;overflow:hidden}
.ads-gasto>div{background:var(--surface);padding:12px;display:grid;gap:2px;min-width:0}
.ads-gasto span{font-size:.72rem;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;font-weight:600}
.ads-gasto b{font-size:1.3rem;font-variant-numeric:tabular-nums}
.ads-gasto small{font-size:.76rem;color:var(--ink-2)}
.ads-camp{border:1px solid var(--line);border-radius:12px;padding:14px;display:grid;gap:12px;background:var(--surface)}
.ads-camp-h{display:flex;flex-wrap:wrap;align-items:baseline;gap:6px 12px}
.ads-camp-h h3{margin:0;font-size:1rem;overflow-wrap:anywhere}
.ads-camp-h .t{font-size:.78rem;color:var(--muted)}
.ads-ver{display:grid;grid-template-columns:auto 1fr;gap:4px 12px;align-items:start;padding:10px 12px;border-radius:10px;background:var(--soft)}
.ads-ver p{margin:0;font-size:.9rem;color:var(--ink-2)}
.ads-pill{display:inline-block;font-size:.72rem;font-weight:700;letter-spacing:.04em;padding:3px 10px;border-radius:99px;white-space:nowrap}
.ads-pill.subir{background:var(--good-bg);color:var(--good)}
.ads-pill.mantener,.ads-pill.esperar,.ads-pill.info{background:var(--warn-bg);color:var(--warn)}
.ads-pill.esperar,.ads-pill.info{background:var(--soft);color:var(--ink-2);border:1px solid var(--line)}
.ads-pill.bajar{background:var(--bad-bg);color:var(--bad)}
.ads-kpi{display:grid;grid-template-columns:repeat(4,1fr);gap:1px;background:var(--line);border:1px solid var(--line);border-radius:10px;overflow:hidden}
.ads-kpi>div{background:var(--surface);padding:10px 10px 8px;display:grid;gap:1px;min-width:0}
.ads-kpi span{font-size:.68rem;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;font-weight:600}
.ads-kpi b{font-size:1.1rem;font-variant-numeric:tabular-nums}
.ads-kpi b.ok{color:var(--good)} .ads-kpi b.ko{color:var(--bad)}
.ads-kpi small{font-size:.72rem;color:var(--muted)}
.ads-cre{display:grid;gap:10px}
.ads-cr{display:grid;grid-template-columns:96px 1fr;gap:12px;align-items:start;padding:10px;border:1px solid var(--line);border-radius:10px}
.ads-cr.top{border-color:var(--good);box-shadow:0 0 0 1px var(--good) inset}
.ads-cr img,.ads-cr .sinfoto{width:96px;height:96px;border-radius:8px;object-fit:cover;background:var(--soft);display:grid;place-items:center;font-size:.7rem;color:var(--muted);text-align:center;padding:4px}
.ads-cr .nm{display:flex;flex-wrap:wrap;gap:4px 8px;align-items:center;min-width:0}
.ads-cr .nm b{overflow-wrap:anywhere}
.ads-cr .rk{font-size:.74rem;color:var(--muted);font-variant-numeric:tabular-nums}
.ads-cr dl{display:grid;grid-template-columns:repeat(auto-fill,minmax(84px,1fr));gap:4px 10px;margin:6px 0 0}
.ads-cr dl div{min-width:0} .ads-cr dt{font-size:.68rem;color:var(--muted);text-transform:uppercase;letter-spacing:.05em}
.ads-cr dd{margin:0;font-weight:600;font-variant-numeric:tabular-nums;font-size:.92rem}
.ads-note{font-size:.8rem;color:var(--muted);margin:0}
@media (max-width:720px){.ads-gasto,.ads-kpi{grid-template-columns:1fr 1fr}.ads-cr{grid-template-columns:64px minmax(0,1fr);gap:10px;padding:8px}.ads-cr img,.ads-cr .sinfoto{width:64px;height:64px}.ads-cr dl{grid-template-columns:repeat(3,minmax(0,1fr))}.ads-camp{padding:12px}}
</style>"""


def kpi(label, valor, sub="", clase=""):
    return f'<div><span>{label}</span><b class="{clase}">{valor}</b>{f"<small>{sub}</small>" if sub else ""}</div>'


def semaforo(v, meta, menor_mejor=True):
    if v is None or meta is None:
        return ""
    return "ok" if (v <= meta if menor_mejor else v >= meta) else "ko"


def main(path="anuncios.json"):
    D = json.load(open(path))
    obj = {**OBJ_DEF, **(D.get("objetivos") or {})}
    hoy = dia(D["hoy"])
    ayer = hoy - dt.timedelta(1)
    periodo = D.get("periodo_texto", "este mes")

    # ── Gasto acumulado y ritmo
    diario = sorted(((dia(d), float(v or 0)) for d, v in D.get("gasto_diario", [])), key=lambda r: r[0])
    ult7 = [v for d, v in diario if ayer - dt.timedelta(6) <= d <= ayer]
    con_dato = [v for v in ult7 if v > 0]
    media7 = sum(con_dato) / len(con_dato) if con_dato else 0
    gasto_ayer = next((v for d, v in diario if d == ayer), None)
    campanas = D.get("campanas", [])
    gasto_mes = sum((c.get("mes") or {}).get("gasto") or 0 for c in campanas)
    gasto_total = sum((c.get("total") or {}).get("gasto") or 0 for c in campanas)
    import calendar
    dias_mes = calendar.monthrange(ayer.year, ayer.month)[1]
    prevision = gasto_mes + media7 * (dias_mes - ayer.day)
    presupuesto = obj.get("presupuesto_mes")

    H = [CSS, '<div class="ads">']
    sub_prev = f"de {eur(presupuesto)} de presupuesto ({pct(div(prevision, presupuesto),0)})" if presupuesto else "a este ritmo"
    H.append('<div class="ads-gasto">'
             + kpi("Gastado ayer", eur(gasto_ayer) if gasto_ayer else "pendiente", "Metricool va 1–2 días tarde" if not gasto_ayer else "")
             + kpi(f"Gastado en {MESES[ayer.month - 1]}", eur(gasto_mes, 0), f"{f(media7,0)} €/día de media (7 días)")
             + kpi("Previsión fin de mes", eur(prevision, 0), sub_prev)
             + kpi("Desde que empezaron", eur(gasto_total, 0), " · ".join(f"{e(c['nombre'].split('_')[0])} {eur((c.get('total') or {}).get('gasto') or 0,0)}" for c in campanas))
             + '</div>')

    resumen = {"gasto_ayer": gasto_ayer, "gasto_mes": round(gasto_mes, 2), "gasto_total": round(gasto_total, 2),
               "media_diaria_7d": round(media7, 2), "prevision_mes": round(prevision, 2), "campanas": []}
    email = []

    for c in campanas:
        mm = c.get("mes") or {}
        m = metricas(mm)
        inicio = dia(c["inicio"]) if c.get("inicio") else None
        dias_activa = (ayer - inicio).days + 1 if inicio else 0
        clave, etiqueta, motivo = veredicto_campana(c, m, obj, dias_activa)
        tipo_txt = {"web": "a la web · leads", "whatsapp": "clic a WhatsApp", "interaccion": "interacción"}.get(c.get("tipo"), "")
        H.append(f'<div class="ads-camp"><div class="ads-camp-h"><h3>{e(c["nombre"])}</h3><span class="t">{tipo_txt} · desde {inicio.strftime("%d/%m") if inicio else "?"} · {dias_activa} días</span></div>')
        H.append(f'<div class="ads-ver"><span class="ads-pill {clave}">{e(etiqueta)}</span><p>{e(motivo)}</p></div>')
        if c.get("tipo") == "interaccion":
            H.append(f'<p class="ads-note">{eur(m["gasto"],0)} · {f(m["impresiones"] or 0)} impresiones · CPI {eur(m["cpi"])} · {f(m["clics"] or 0)} clics (CPC {eur(m["cpc"])}) · CTR {pct(m["ctr"])}</p></div>')
            resumen["campanas"].append({"nombre": c["nombre"], "tipo": "interaccion", "dias": dias_activa, "veredicto": etiqueta, "clave": clave, "motivo": motivo,
                                        **{k: (round(v, 2) if isinstance(v, float) else v) for k, v in m.items()}, "creatividades": []})
            email.append(f'<tr><td style="padding:12px 0;border-bottom:1px solid #e5e5ea;font-size:13px;line-height:18px;color:#8e8e93">{e(c["nombre"])}: {eur(m["gasto"],0)} en interacción (me gusta, seguidores), sin leads.</td></tr>')
            continue
        if c.get("tipo") == "whatsapp":
            res_lbl, res_val, res_sub = "Chats", m["chats"], f"{mm.get('con_ficha', 0)} con ficha en el CRM"
            coste_lbl, coste_val, coste_meta = "Coste por chat", m["coste_chat"], obj["coste_chat"]
        else:
            res_lbl, res_val, res_sub = "Leads (CRM)", m["leads"], f"{mm['leads_pixel']} según Meta" if mm.get("leads_pixel") is not None else ""
            coste_lbl, coste_val, coste_meta = "CPL · coste por lead", m["cpl"], obj["cpl"]
        H.append('<div class="ads-kpi">'
                 + kpi(f"Gasto {periodo}", eur(m["gasto"], 0), f"total {eur((c.get('total') or {}).get('gasto'), 0)}")
                 + kpi(res_lbl, "—" if res_val is None else f(res_val), res_sub)
                 + kpi(coste_lbl, eur(coste_val), f"objetivo ≤ {eur(coste_meta)}", semaforo(coste_val, coste_meta))
                 + kpi("CPA · coste por venta", eur(m["cpa"]) if m["ventas"] else "sin ventas", f"{f(m['ventas'])} venta{'s' if m['ventas'] != 1 else ''} · objetivo ≤ {eur(obj['cpa'])}", semaforo(m["cpa"], obj["cpa"]) if m["ventas"] else "")
                 + kpi("ROAS", f(m["roas"], 1) if m["ventas"] else "—", f"{eur(m['eur'],0)} vendidos" if m["ventas"] else "€ vendidos ÷ gasto", semaforo(m["roas"], obj["roas"], False) if m["ventas"] else "")
                 + kpi("CPI · 1.000 impresiones", eur(m["cpi"]), f"{f(m['impresiones'] or 0)} impresiones")
                 + kpi("CPC · coste por clic", eur(m["cpc"]), f"{f(m['clics'] or 0)} clics")
                 + kpi("CTR", pct(m["ctr"]), f"frecuencia {f(m['frecuencia'],1)}" if m["frecuencia"] else "")
                 + '</div>')

        # Creatividades de esta campaña, de mejor a peor
        cres = [cr for cr in D.get("creatividades", []) if cr.get("campana") == c["nombre"]]
        ms = [(cr, metricas(cr)) for cr in cres]
        ms.sort(key=lambda t: puntuacion(t[1]), reverse=True)
        mejor = ms[0][0] if ms and puntuacion(ms[0][1])[1] else None
        cres_res = []
        if ms:
            H.append('<div class="ads-cre">')
            for i, (cr, cm) in enumerate(ms, 1):
                vk, vl = veredicto_creatividad(cr, cm, obj, mejor)
                foto = cr.get("foto")
                img = f'<img src="{e(foto)}" alt="Creatividad {e(cr.get("nombre"))}" loading="lazy">' if foto else f'<div class="sinfoto">sin foto<br>{e(cr.get("motivo_sin_foto") or "")}</div>'
                datos = []
                if cm["gasto"] is not None:
                    datos.append(("Gasto", eur(cm["gasto"], 0)))
                if cm["visitas"] is not None:
                    datos.append(("Visitas", f(cm["visitas"])))
                if cm["leads"] is not None:
                    datos.append(("Leads", f(cm["leads"])))
                if cm["chats"] is not None:
                    datos.append(("Chats", f(cm["chats"])))
                if cm["cpl"] is not None:
                    datos.append(("CPL", eur(cm["cpl"])))
                if cm["coste_chat"] is not None:
                    datos.append(("€/chat", eur(cm["coste_chat"])))
                if cm["conv"] is not None and cm["visitas"]:
                    datos.append(("Conversión", pct(cm["conv"])))
                datos.append(("Ventas", f"{f(cm['ventas'])}" + (f" · {eur(cm['eur'],0)}" if cm["ventas"] else "")))
                if cm["cpa"] is not None:
                    datos.append(("CPA", eur(cm["cpa"])))
                if cm["ctr"] is not None:
                    datos.append(("CTR", pct(cm["ctr"])))
                if cm["cpi"] is not None:
                    datos.append(("CPI", eur(cm["cpi"])))
                dl = "".join(f"<div><dt>{k}</dt><dd>{v}</dd></div>" for k, v in datos)
                H.append(f'<div class="ads-cr{" top" if cr is mejor else ""}">{img}<div><div class="nm"><span class="rk">{i}.º</span><b>{e(cr.get("nombre"))}</b><span class="ads-pill {vk}">{vl}</span></div>'
                         + (f'<p class="ads-note">{e(cr["nota"])}</p>' if cr.get("nota") else "") + f"<dl>{dl}</dl></div></div>")
                cres_res.append({"nombre": cr.get("nombre"), "puesto": i, "veredicto": vl, "foto": bool(foto),
                                 **{k: (round(v, 2) if isinstance(v, float) else v) for k, v in cm.items()}})
            H.append("</div>")
            if not any(cm["gasto"] is not None for _, cm in ms):
                H.append('<p class="ads-note">Gasto por creatividad: pendiente (Metricool no da el detalle por anuncio). Se ordenan por leads por visita.</p>')
        H.append("</div>")

        # Una simulación honesta de «si subimos»: mismo coste por resultado.
        subir = None
        if clave == "subir" and media7 and (coste_val or 0) > 0:
            extra_sem = media7 * obj["subida"] * 7 * ((m["gasto"] or 0) / gasto_mes if gasto_mes else 0)
            subir = {"extra_semana_eur": round(extra_sem, 2), "resultados_extra_semana": round(extra_sem / coste_val, 1)}
        resumen["campanas"].append({"nombre": c["nombre"], "tipo": c.get("tipo"), "dias": dias_activa, "veredicto": etiqueta, "clave": clave, "motivo": motivo,
                                    "si_subimos": subir, **{k: (round(v, 2) if isinstance(v, float) else v) for k, v in m.items()},
                                    "creatividades": cres_res})

        # Email (estilo v2): cabecera de la campaña y debajo TODAS sus creatividades,
        # de mejor a peor, cada una con su foto. Gmail no enseña imágenes data: ni
        # adjuntos en línea de la herramienta de envío: la foto va por URL pública
        # del CRM (/api/public/anuncio-foto?id=…) o por `foto_url` si se da.
        color = {"subir": "#248a3d", "mantener": "#b25000", "bajar": "#c93400"}.get(clave, "#8e8e93")
        coste_txt = f"{'€/chat' if c.get('tipo') == 'whatsapp' else 'CPL'} {eur(coste_val)}"
        cpa_txt = f" · CPA {eur(m['cpa'])}" if m["ventas"] else " · sin ventas"
        email.append(f'<tr><td style="padding:14px 0 6px;border-bottom:1px solid #e5e5ea;font-size:15px;line-height:20px;color:#1c1c1e"><b>{e(c["nombre"])}</b> '
                     f'<span style="display:inline-block;padding:1px 8px;border-radius:99px;background-color:{color};color:#ffffff;font-size:12px;line-height:18px;font-weight:600">{e(etiqueta)}</span><br>'
                     f'<span style="font-size:13px;line-height:18px;color:#8e8e93">{eur(m["gasto"],0)} · {coste_txt}{cpa_txt} · CPI {eur(m["cpi"])}</span></td></tr>')
        for i, (cr, cm) in enumerate(ms, 1):
            vk, vl = veredicto_creatividad(cr, cm, obj, mejor)
            url = cr.get("foto_url") or (f"{FOTO_URL}{cr['ad_id']}" if cr.get("ad_id") and cr.get("foto") else "")
            thumb = (f'<img src="{e(url)}" width="56" height="56" alt="" style="display:block;width:56px;height:56px;border-radius:8px;object-fit:cover">'
                     if url else '<div style="width:56px;height:56px;border-radius:8px;background-color:#e5e5ea;font-size:9px;line-height:56px;text-align:center;color:#8e8e93">sin foto</div>')
            res = f"{f(cm['leads'])} leads" if cm["leads"] is not None else f"{f(cm['chats'] or 0)} chats"
            extra = []
            if cm["visitas"]:
                extra.append(f"{f(cm['visitas'])} visitas")
            if cm["conv"] is not None and cm["visitas"]:
                extra.append(f"conv. {pct(cm['conv'])}")
            if cm["cpl"] is not None:
                extra.append(f"CPL {eur(cm['cpl'])}")
            if cm["ventas"]:
                extra.append(f"{f(cm['ventas'])} venta{'s' if cm['ventas'] != 1 else ''} · {eur(cm['eur'],0)}")
            pc = {"subir": "#248a3d", "mantener": "#8e8e93", "bajar": "#c93400"}.get(vk, "#8e8e93")
            email.append(f'<tr><td style="padding:8px 0;border-bottom:1px solid #f2f2f7"><table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>'
                         f'<td width="66" valign="top">{thumb}</td>'
                         f'<td valign="top" style="font-size:14px;line-height:19px;color:#1c1c1e">{i}.º <b>{e(cr.get("nombre"))}</b> '
                         f'<span style="font-size:12px;font-weight:600;color:{pc}">{e(vl)}</span><br>'
                         f'<span style="font-size:13px;line-height:18px;color:#8e8e93">{res}{" · " + " · ".join(extra) if extra else ""}</span></td>'
                         f'</tr></table></td></tr>')

    H.append('<p class="ads-note">CPL = gasto ÷ leads · CPA = gasto ÷ ventas · CPI = coste por cada 1.000 impresiones (CPM) · CPC = gasto ÷ clics · CTR = clics ÷ impresiones · ROAS = € vendidos ÷ gasto. '
             f'Veredicto «Subir» si el coste por lead está por debajo de {eur(obj["cpl"])} (o el chat por debajo de {eur(obj["coste_chat"])}) con al menos 5 días de datos y la gente no lo ha visto más de {f(obj["frecuencia"])} veces.</p>')
    H.append("</div>")
    open("anuncios_pagina.html", "w").write("\n".join(H))
    if email:  # la última fila sin línea de separación
        email[-1] = email[-1].replace("border-bottom:1px solid #f2f2f7", "", 1).replace("border-bottom:1px solid #e5e5ea", "", 1)
    sub = f"{eur(gasto_mes,0)} en {MESES[ayer.month - 1]} · ayer {eur(gasto_ayer,0) if gasto_ayer else 'pendiente'} · previsión {eur(prevision,0)}"
    open("anuncios_email.html", "w").write(
        '<tr><td style="padding:24px 8px 6px;font-size:13px;line-height:18px;font-weight:600;color:#8e8e93">ANUNCIOS · ' + sub.upper() + '</td></tr>'
        '<tr><td bgcolor="#FFFFFF" style="background-color:#ffffff;border-radius:16px;padding:0 16px">'
        '<table width="100%" cellpadding="0" cellspacing="0" border="0">' + "".join(email) + '</table></td></tr>')
    json.dump(resumen, open("anuncios_resumen.json", "w"), ensure_ascii=False, indent=1)
    print(json.dumps({k: v for k, v in resumen.items() if k != "campanas"}, ensure_ascii=False))
    for c in resumen["campanas"]:
        print(f"- {c['nombre']}: {c['veredicto']} · {c['motivo']}")


if __name__ == "__main__":
    main(*sys.argv[1:])
