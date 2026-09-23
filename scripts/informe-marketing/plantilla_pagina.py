from helpers import *
c=json.load(open('charts.json'))
visits30=[int(r[1]) for r in g['serie'][-30:]]
leads30=[0,0,3,2,0,0,1,7,3,0,1,3,0,1,2,1,0,2,2,1,0,1,1,2,3,0,1,4,2,2]
css=open('estilos_base.html').read().split('<style>')[1].split('</style>')[0]
extra_css='''
.nav{display:flex;flex-wrap:wrap;gap:6px;margin-top:6px}
.nav a{font-size:.78rem;color:var(--ink-2);text-decoration:none;padding:4px 10px;border:1px solid var(--line);border-radius:99px;background:var(--surface)}
.nav a:hover,.nav a:focus-visible{border-color:var(--s1);color:var(--ink);outline:none}
.tiles{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}
.tile{background:var(--surface);border:1px solid var(--line);border-radius:10px;padding:14px 14px 10px;display:grid;gap:4px;align-content:start}
.tile .k{font-size:.74rem;color:var(--muted);text-transform:uppercase;letter-spacing:.08em;font-weight:600}
.tile .v{font-family:var(--serif);font-size:2.2rem;line-height:1;font-weight:500}
.tile .d{font-size:.8rem;font-weight:600} .tile .d.p{color:var(--good)} .tile .d.n{color:var(--bad)} .tile .d.z{color:var(--muted)}
.tile .s{font-size:.76rem;color:var(--muted)}
.spark{width:100%;height:34px;display:block;margin-top:4px}
.spark .sa.s1{fill:var(--area)} .spark .sl.s1{fill:none;stroke:var(--s1);stroke-width:1.6}
.spark .sd.s1{fill:var(--s1)} .spark .sa.s2{fill:rgba(194,122,44,.14)} .spark .sl.s2{fill:none;stroke:var(--s2);stroke-width:1.6} .spark .sd.s2{fill:var(--s2)}
.bars{display:grid;gap:8px}
.br{display:grid;grid-template-columns:minmax(96px,170px) 1fr max-content;gap:12px;align-items:center;font-size:.87rem}
.bl small{display:block;font-size:.74rem;color:var(--muted);line-height:1.3}
.bt{height:14px;background:var(--soft);border-radius:4px;overflow:hidden}
.bb{height:100%;border-radius:0 4px 4px 0} .bb.s1{background:var(--s1)} .bb.s2{background:var(--s2)} .bb.bad{background:var(--bad)} .bb.good{background:var(--good)}
.bv{text-align:right;font-variant-numeric:tabular-nums;font-weight:600} .bv span{font-weight:400;color:var(--muted);font-size:.78rem}
.card{background:var(--surface);border:1px solid var(--line);border-radius:10px;padding:18px;display:grid;gap:12px;align-content:start}
.card h3{margin:0;font-size:1rem}
.card .sub{font-size:.8rem;color:var(--muted);margin-top:-8px}
.metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:1px;background:var(--line);border:1px solid var(--line);border-radius:10px;overflow:hidden}
.m{background:var(--surface);padding:12px 12px 10px;display:grid;gap:2px}
.m b{font-size:1.25rem;font-variant-numeric:tabular-nums}
.m span{font-size:.72rem;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;font-weight:600}
.m small{font-size:.74rem;color:var(--ink-2)}
.m.miss b{color:var(--muted)}
.camp{display:grid;gap:12px}
.camp-h{display:flex;flex-wrap:wrap;gap:8px 14px;align-items:baseline}
.camp-h h3{margin:0;font-size:1.05rem}
.grade{font-weight:700;font-size:.72rem;letter-spacing:.06em;padding:3px 9px;border-radius:99px}
.imp{display:grid;gap:14px;counter-reset:n}
.imp li{list-style:none;background:var(--surface);border:1px solid var(--line);border-radius:10px;padding:16px 18px;display:grid;gap:6px}
.imp .tag{display:flex;gap:8px;flex-wrap:wrap}
.imp h3{margin:0;font-size:1.02rem}
.imp p{font-size:.92rem;color:var(--ink-2)}
.imp .why{font-size:.84rem;color:var(--ink)}
.gl{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px 22px;margin:0}
.gl div{font-size:.86rem} .gl dt{font-weight:600} .gl dd{margin:0;color:var(--ink-2)}
.post{display:grid;grid-template-columns:70px 1fr auto;gap:12px;align-items:center;padding:10px 0;border-bottom:1px solid var(--line);font-size:.86rem}
.post:last-child{border-bottom:0}
.post .dt{color:var(--muted);font-variant-numeric:tabular-nums}
.post .tx{color:var(--ink);overflow:hidden;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
.post .nm{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
.post .nm small{display:block;color:var(--muted)}
a{color:var(--s1)}
@media (max-width:720px){.tiles{grid-template-columns:1fr 1fr}.metrics{grid-template-columns:1fr 1fr}.br{grid-template-columns:96px 1fr max-content;gap:8px}.post{grid-template-columns:52px 1fr}.post .nm{grid-column:2;text-align:left}}
'''
H=[]
H.append(f'<title>Parte de marketing Tiroriro</title>\n<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;1,400&family=Inter:wght@400;500;600;700&display=swap">\n<style>{css}{extra_css}</style>')
H.append('<div class="wrap">')
# HEADER
H.append('''<header>
<div class="eyebrow">Parte de marketing · miércoles 23 de septiembre de 2026</div>
<h1>La web crece sola; ahora hay que convertir a los que diseñan su cabecero</h1>
<p>Qué ha pasado ayer, esta semana y este mes en la web, Instagram, las campañas y el CRM, y qué hacemos con ello. «Ayer» es el lunes 22; la semana, del 16 al 22; el mes, del 1 al 22 de septiembre.</p>
<nav class="nav" aria-label="Secciones"><a href="#resumen">Resumen</a><a href="#campanas">Campañas y costes</a><a href="#whatsapp">WhatsApp</a><a href="#recorrido">Recorrido por la web</a><a href="#instagram">Instagram</a><a href="#ventas">Ventas</a><a href="#audiencia">Audiencia</a><a href="#mejoras">Mejoras</a><a href="#glosario">Glosario</a></nav>
</header>''')
# TILES
H.append(f'''<section id="resumen">
<div class="tiles">
 <div class="tile"><div class="k">Visitas · semana</div><div class="v num">974</div><div class="d p">▲ 32 % vs semana anterior</div>{spark(visits30)}<div class="s">últimos 30 días</div></div>
 <div class="tile"><div class="k">Leads · semana</div><div class="v num">14</div><div class="d p">▲ 100 % (eran 7)</div>{spark(leads30,"s2")}<div class="s">entradas en el CRM, 30 días</div></div>
 <div class="tile"><div class="k">Ventas · semana</div><div class="v num">1.190 €</div><div class="d n">▼ 69 % (eran 3.885 €)</div><div class="s">3 ventas · 15 en el mes (6.505 €)</div></div>
 <div class="tile"><div class="k">Conversión web</div><div class="v num">2,3 %</div><div class="d z">de cada 100 visitas, 2,3 contactan</div><div class="s">formulario + WhatsApp, 30 días</div></div>
</div>
<ul class="verdict">
 <li><span class="chip up">BIEN</span><p><b>Tráfico gratis al alza:</b> +27 % de personas esta semana. Instagram orgánico aporta el 60 % de las visitas, y Google y ChatGPT, las de más calidad.</p></li>
 <li><span class="chip up">BIEN</span><p><b>El doble de leads:</b> 14 en el CRM (7 la semana anterior). WhatsApp cierra 1 de cada 2.</p></li>
 <li><span class="chip down">MAL</span><p><b>Ventas a la baja esta semana</b> (3 frente a 7). Hay 32 clientes en negociación, valorados en 8.963 €, esperando cierre.</p></li>
 <li><span class="chip down">PARADO</span><p><b>Publicidad:</b> Meta parada desde el 9 de septiembre y Google Ads desde el 6. Ahora mismo no se invierte nada.</p></li>
 <li><span class="chip flat">FRENO</span><p><b>Configurador:</b> 1.278 personas diseñaron algo en 30 días y solo contactó el 5 %. Ahí está el mayor margen de mejora.</p></li>
</ul>
<div class="tbl"><table>
<thead><tr><th></th><th>Ayer</th><th>vs lun. 15</th><th>Semana</th><th>vs anterior</th><th>Mes</th></tr></thead>
<tbody>
<tr><td>Personas en la web</td><td>52</td><td class="up-t">+41 %</td><td>738</td><td>+27 %</td><td>1.911</td></tr>
<tr><td>Visitas</td><td>77</td><td>+54 %</td><td>974</td><td>+32 %</td><td>2.589</td></tr>
<tr><td>Páginas vistas por visita</td><td>8,0</td><td>−13 %</td><td>8,9</td><td>−5 %</td><td>8,9</td></tr>
<tr><td>Tiempo medio por visita</td><td>4:38</td><td>−7 %</td><td>3:47</td><td>+14 %</td><td>3:37</td></tr>
<tr><td>Formularios enviados</td><td>0</td><td>−1</td><td>7</td><td>+133 %</td><td>13</td></tr>
<tr><td>Clics a WhatsApp</td><td>0</td><td>−2</td><td>14</td><td>0 %</td><td>42</td></tr>
<tr><td>Leads en el CRM</td><td>2</td><td>+1</td><td>14</td><td>+100 %</td><td>32</td></tr>
<tr><td>Ventas</td><td>1 · 80 €</td><td>+1</td><td>3 · 1.190 €</td><td>−69 % €</td><td>15 · 6.505 €</td></tr>
<tr><td>Ticket medio</td><td>80 €</td><td>—</td><td>397 €</td><td>−28 %</td><td>434 €</td></tr>
</tbody></table></div>
<p class="note">Analytics solo cuenta a quien acepta las cookies (aprox. 6 de cada 10). Por eso los leads y las ventas reales salen del CRM. El mes no se compara con agosto porque Analytics empezó a medir bien a finales de agosto.</p>
</section>''')
# CAMPAÑAS
H.append('''<section id="campanas">
<div class="eyebrow">Campañas y costes</div>
<h2>Google Ads trae clics muy baratos que no convierten; de Meta falta el gasto</h2>
<div class="card camp">
 <div class="camp-h"><h3>Google Ads · «Búsqueda – Cabeceros a medida»</h3><span class="pill">Pausada desde el 6 sep</span><span class="grade down">NO CONVIRTIÓ</span></div>
 <div class="sub">Activa del 31 de agosto al 6 de septiembre (7 días) · aterrizaba en la portada</div>
 <div class="metrics">
  <div class="m"><span>Gasto</span><b>59,37 €</b><small>8,48 € al día</small></div>
  <div class="m"><span>Impresiones</span><b>2.101</b><small>veces que se vio</small></div>
  <div class="m"><span>Clics</span><b>140</b><small>20 al día</small></div>
  <div class="m"><span>CTR</span><b>6,7 %</b><small>muy bueno (media ≈ 4 %)</small></div>
  <div class="m"><span>CPC</span><b>0,42 €</b><small>muy barato</small></div>
  <div class="m"><span>CPM</span><b>28,26 €</b><small>por mil impresiones</small></div>
  <div class="m"><span>Contactos</span><b>0</b><small>ni formulario ni WhatsApp</small></div>
  <div class="m"><span>CPL / CPA</span><b>—</b><small>sin leads ni ventas</small></div>
 </div>
 <p><b>Lectura:</b> el anuncio funcionaba (la gente pinchaba mucho y barato), pero <b>mandaba a la portada</b> y nadie contactó. Si se reactiva, que lleve directamente a <b>Cabeceros</b> o al <b>configurador</b>, con WhatsApp a la vista.</p>
</div>
<div class="card camp">
 <div class="camp-h"><h3>Meta · «ES_Cabeceros_Leads_Sep26»</h3><span class="chip down">Parada desde el 9 sep</span><span class="grade up">SÍ CONVIRTIÓ</span></div>
 <div class="sub">Activa del 3 al 8 de septiembre (6 días) · un único anuncio, «IMG_BuenosDias_Copy1» · aterrizaba en /productos</div>
 <div class="metrics">
  <div class="m miss"><span>Gasto</span><b>pendiente</b><small>ver nota</small></div>
  <div class="m miss"><span>Impresiones</span><b>pendiente</b></div>
  <div class="m miss"><span>Clics / CTR / CPC</span><b>pendiente</b></div>
  <div class="m"><span>Visitas a la web</span><b>432</b><small>72 al día · 3:25 por visita</small></div>
  <div class="m"><span>Formularios</span><b>4</b><small>5 leads en el CRM</small></div>
  <div class="m"><span>Clics WhatsApp</span><b>12</b><small>de 334 personas</small></div>
  <div class="m"><span>Conversión</span><b>4,8 %</b><small>solo Google orgánico convierte más</small></div>
  <div class="m"><span>Ventas atribuidas</span><b>1 · 60 €</b><small>de momento</small></div>
 </div>
 <p><b>Lectura:</b> de todo lo que trae volumen, solo Google orgánico convierte mejor: 16 contactos de 334 personas, <b>1 de cada 21</b>. Merece la pena reactivarlo. Falta el gasto para calcular el <b>CPL</b> (coste por lead) y el <b>CPA</b> (coste por venta): Metricool aún está importando la cuenta publicitaria. Con una captura del Administrador de anuncios lo completo hoy mismo.</p>
</div>
<div class="tbl"><table>
<thead><tr><th>Canal</th><th>Coste</th><th>Personas</th><th>Contactan</th><th>% conversión</th><th>Coste por contacto</th></tr></thead>
<tbody>
<tr><td>Anuncios Meta</td><td>pendiente</td><td>334</td><td>16</td><td>4,8 %</td><td>pendiente</td></tr>
<tr><td>ChatGPT y otras IA</td><td>0 €</td><td>42</td><td>4</td><td>9,5 %</td><td>0 €</td></tr>
<tr><td>Google orgánico</td><td>0 €</td><td>190</td><td>11</td><td>5,8 %</td><td>0 €</td></tr>
<tr><td>Instagram orgánico</td><td>0 €</td><td>1.155</td><td>21</td><td>1,8 %</td><td>0 €</td></tr>
<tr><td>Directo</td><td>0 €</td><td>158</td><td>3</td><td>1,9 %</td><td>0 €</td></tr>
<tr><td>Google Ads</td><td>59 €</td><td>54</td><td>0</td><td>0 %</td><td>∞</td></tr>
</tbody></table></div>
</section>''')
# WHATSAPP
wa_btn=[("Botón flotante verde",27),("Botón del configurador",14),("Menú superior",4),("Página de telas",2),("Página /ig (Instagram)",2)]
wa_src=[("Instagram orgánico",20),("Anuncios Meta",12),("Google orgánico",6),("Directo",4),("ChatGPT",3)]
wa_pg=[("Configurador",14),("Portada",11),("Telas",6),("Fichas de producto",6),("Productos",5),("Página /ig",3)]
crm_wa=[("Escriben sin pasar por la web",37,"≈ 20 son consultas nuevas; el resto, clientes en curso"),("Botón flotante / formulario",14),("Botón del configurador",5),("Página de telas",1),("Menú superior",1),("Página /ig",0)]
H.append(f'''<section id="whatsapp">
<div class="eyebrow">Rastreo de WhatsApp · últimos 30 días</div>
<h2>Por dónde llega la gente al WhatsApp</h2>
<p>Cada botón de WhatsApp de la web deja un mensaje distinto al abrir el chat («Hola, estoy usando el configurador…», «Hola, os escribo desde Instagram»…). Cruzando esos mensajes con los chats que entran en el CRM y con los clics medidos en Analytics sale el mapa completo.</p>
<div class="two">
 <div class="card"><h3>Desde qué canal venían</h3><div class="sub">clics a WhatsApp en la web, según Analytics</div>{bars(wa_src)}</div>
 <div class="card"><h3>En qué botón pulsaron</h3><div class="sub">clics a WhatsApp en la web, según Analytics</div>{bars(wa_btn,color="s2")}</div>
</div>
<div class="two">
 <div class="card"><h3>En qué página estaban</h3><div class="sub">clics a WhatsApp en la web, según Analytics</div>{bars(wa_pg)}</div>
 <div class="card"><h3>Chats nuevos que llegaron de verdad</h3><div class="sub">WhatsApp del CRM, según el mensaje con el que empiezan</div>{bars([(a,b,(x[0] if (x:=r[2:]) else "")) for r in crm_wa for a,b in [r[:2]]],color="s2")}</div>
</div>
<ul class="facts">
 <li><b>1 de cada 3 WhatsApp de la web sale del configurador.</b> Es donde más interés hay, así que ahí conviene poner el mejor botón.</li>
 <li><b>Instagram manda más gente al WhatsApp que ningún otro canal</b>, pero casi siempre pasando por la web. El botón directo de la página /ig casi no se usa (2 clics).</li>
 <li><b>Más de la mitad de los chats nuevos no pasan por la web:</b> son clientes que escriben directamente desde Instagram, una tarjeta, una recomendación o Google Maps.</li>
 <li><b>Google Business Profile (la ficha de Google Maps) todavía no se puede medir.</b> Las visitas que manda a la web cuentan como «Google orgánico», y los chats que abre desde Maps entran como «escriben directo». Para verlo por separado, mira la mejora 5.</li>
 <li><b>Ningún chat vino de un anuncio de «clic a WhatsApp»</b> de Meta: la campaña llevaba a la web, no directamente al chat.</li>
</ul>
</section>''')
# RECORRIDO
land=[("/ig · enlace de Instagram",1144,"1,0 páginas antes de seguir"),("Portada",599,""),("Productos",442,""),("Configurador",313,""),("Telas",46,""),("Cabeceros",43,"")]
top=[("Configurador",66),("Portada",59),("Telas",55),("Nosotros",45),("Guía de medidas",42),("Cabecero Conta",36),("Cabecero Macarella",31)]
low=[("Página /ig",5),("Mesa Cabo de Palos",13),("Cabecero Calobra",14),("Banco Oyambre",14),("Cojines",17),("Puf Patos",18),("Cabecero Pregonda",20)]
nxt=[("Cabeceros → Configurador",411),("Productos (desde Instagram) → Configurador",339),("Productos → Configurador",255),("Productos (desde Instagram) → Cabeceros",243),("Productos → Cabeceros",230),("Portada → Productos",213),("Configurador → Portada",81),("Configurador → Productos",61)]
H.append(f'''<section id="recorrido">
<div class="eyebrow">Recorrido por la web · últimos 30 días</div>
<h2>Entran por Instagram, van directos al configurador… y ahí se quedan sin preguntar</h2>
<div class="two">
 <div class="card"><h3>Por dónde entran</h3><div class="sub">primera página de la visita</div>{bars(land)}</div>
 <div class="card"><h3>Qué hacen después</h3><div class="sub">paso más habitual de una página a otra (personas)</div>{bars(nxt,color="s2")}</div>
</div>
<div class="two">
 <div class="card"><h3>Donde más se quedan</h3><div class="sub">tiempo medio por persona, en segundos</div>{bars(top,unit=" s",color="good")}</div>
 <div class="card"><h3>Donde menos se quedan</h3><div class="sub">tiempo medio por persona, en segundos (páginas con más de 40 personas)</div>{bars(low,unit=" s",maxv=66,color="bad")}</div>
</div>
<div class="figure stack"><div class="eyebrow">Embudo de 30 días</div>{c["embudo"]}</div>
<div class="callout">
 <h3>El freno: después de diseñar, no hay un siguiente paso claro</h3>
 <p>El configurador es la página donde más tiempo pasa la gente (66 s de media y casi 4 vistas por persona). Pero de las 1.278 personas que lo usan, <b>solo 33 empiezan el formulario, y de esas solo 18 lo terminan (55 %)</b>. Además, 142 vuelven a la portada o a productos en lugar de pedir precio.</p>
 <p>Las fichas de producto individuales (Calobra, Oyambre, Cabo de Palos) se miran menos de 15 segundos: <b>la gente no las lee, salta al configurador</b>. La página /ig es solo un paso intermedio (5 s), pero el 99 % de quienes llegan a ella siguen navegando, así que funciona bien.</p>
</div>
</section>''')
# INSTAGRAM
posts=[("22 sep","Pufs Patos · foto de clienta (@pilisot)",936,2802,55,4,0),("19 sep","Cabecero Conta + almohadones · foto de clienta",1749,5417,119,9,1),("15 sep","Banco · fotos de Rocío (clienta)",2193,6277,168,11,4),("12 sep","Pufs Patos · proyecto @alejandra.blanc.interiorismo",1985,5392,113,6,1),("10 sep","Puf Patos · foto de clienta (@arancarnero)",2038,5391,85,2,3),("06 sep","Almohadones · @alejandra.blanc.interiorismo",1951,4459,55,1,1),("03 sep","Proyecto @alejandra.blanc.interiorismo",3941,7366,125,6,4),("02 sep","Reel · cómo hacer un vivo (con Bea)",2538,3827,75,5,0),("01 sep","Cabeceros Calobra · casa del norte",2261,5524,141,16,4),("30 ago","Dormitorio @alejandra.blanc.interiorismo",5482,11108,236,14,6),("28 ago","Pufs Patos · @alejandra.blanc.interiorismo",3240,6797,124,2,16)]
prow="".join(f'<div class="post"><div class="dt">{d}</div><div class="tx">{t}</div><div class="nm"><b>{f(r)}</b> alcance<small>{i} interacciones · {s} compartidos · +{fo} seguidores</small></div></div>' for d,t,r,v,i,s,fo in posts)
H.append(f'''<section id="instagram">
<div class="eyebrow">Instagram · 4.490 seguidores</div>
<h2>Lo que más funciona: proyectos de interiorista. Lo que más visitas trae: stories con enlace</h2>
<div class="metrics">
 <div class="m"><span>Publicaciones</span><b>11</b><small>en 30 días (≈ 3 por semana)</small></div>
 <div class="m"><span>Alcance medio</span><b>2.570</b><small>personas por publicación</small></div>
 <div class="m"><span>Seguidores</span><b>+116</b><small>últimos 5 días (−5)</small></div>
 <div class="m"><span>Visitas a la web</span><b>1.155</b><small>60 % de toda la web</small></div>
</div>
<div class="figure" id="serie"><div class="legend"><span style="--c:var(--s1)">Visitas totales a la web</span><span style="--c:var(--s2)">Desde el anuncio de Meta</span></div>{c["serie"]}</div>
<div class="callout ok">
 <h3>Los dos picos del mes vinieron de stories con enlace, no de publicaciones</h3>
 <p><b>12 de septiembre: 404 visitas</b> (347 desde Instagram). <b>17 de septiembre: 307 visitas.</b> En los dos casos el tráfico empezó <b>a las 9:00 de la mañana</b> y entró por el enlace <b>/ig</b>, el de stories y bio. La publicación del 12 salió a las 19:38 y el 17 no hubo publicación. Así que casi seguro fueron <b>stories con enlace publicadas por la mañana</b>: un solo día de stories así trae tanto como 4–5 días de anuncio.</p>
 <p class="note">Instagram no deja recuperar stories anteriores a hoy. Desde ahora Metricool las guarda, y el informe dirá qué story concreta generó cada pico.</p>
</div>
<div class="card"><h3>Publicaciones de los últimos 30 días</h3><div class="sub">de más reciente a más antigua</div><div>{prow}</div></div>
<ul class="facts">
 <li><b>Top 3 en alcance: proyectos de @alejandra.blanc.interiorismo</b> (5.482, 3.941 y 3.240 personas). Los espacios completos de interiorista funcionan casi el doble que las fotos de clientes.</li>
 <li><b>Lo que más seguidores trae:</b> los pufs Patos en proyecto de interiorista (+16 seguidores en una sola publicación).</li>
 <li><b>Lo que más se comparte:</b> el cabecero Calobra en la casa del norte (16 compartidos). La gente comparte los dormitorios completos.</li>
 <li><b>El alcance baja en las últimas publicaciones</b> (936 la del 22 sep): tres fotos de clientas seguidas pierden fuerza. Conviene alternarlas con proyectos.</li>
</ul>
</section>''')
# VENTAS
H.append(f'''<section id="ventas">
<div class="eyebrow">Ventas · CRM, últimos 30 días</div>
<h2>WhatsApp y los referidos son los que cierran</h2>
<div class="two">
 <div class="card"><h3>Facturación por origen del lead</h3><div class="sub">ventas cerradas en 30 días</div>{bars([("WhatsApp",3510,"7 ventas"),("Referido",2848,"6"),("Formulario web",2065,"2"),("Configurador",2040,"4"),("Instagram (DM)",540,"1")],unit=" €",color="good")}</div>
 <div class="card"><h3>% de leads que acaban pagando</h3><div class="sub">histórico completo del CRM</div>{bars([("Referido",53),("WhatsApp",39),("Instagram (DM)",25),("Configurador",21),("Formulario web",21)],unit=" %",maxv=100)}</div>
</div>
<div class="tbl"><table>
<thead><tr><th>Origen</th><th>Leads 30 d</th><th>Ventas 30 d</th><th>Facturado</th><th>Ticket medio</th><th>Días hasta cerrar</th></tr></thead>
<tbody>
<tr><td>WhatsApp</td><td>14</td><td>7</td><td>3.510 €</td><td>455 €</td><td>24</td></tr>
<tr><td>Configurador</td><td>13</td><td>4</td><td>2.040 €</td><td>489 €</td><td>13</td></tr>
<tr><td>Referido</td><td>10</td><td>6</td><td>2.848 €</td><td>348 €</td><td>6</td></tr>
<tr><td>Formulario web</td><td>5</td><td>2</td><td>2.065 €</td><td>795 €</td><td>46</td></tr>
<tr><td>Instagram (DM)</td><td>2</td><td>1</td><td>540 €</td><td>585 €</td><td>15</td></tr>
</tbody></table></div>
<div class="two">
 <div class="card"><h3>Embudo de ventas abierto</h3><div class="sub">leads sin cerrar, con su valor</div>{bars([("Negociación",32,"8.963 € · 28 días de media"),("Cliente potencial",19,"82 días parados"),("On Hold",15,"4.180 €"),("Primer contacto",9,"715 €"),("Discovery",4,"120 €")],color="s2")}</div>
 <div class="card"><h3>Qué productos se piden</h3><div class="sub">leads B2C, histórico completo</div>{bars([("Cabecero",79,"26 vendidos"),("Puf",19,"11 vendidos"),("Pantalla de lámpara",9,"3"),("Mesa de centro",7,"0"),("Banco",6,"2")])}</div>
</div>
<p class="note">Los pufs cierran el 58 % de las veces; los cabeceros, el 33 %; las mesas de centro, ninguna de 7. Revisad por qué no se venden las mesas (¿precio? ¿plazo?).</p>
</section>''')
# AUDIENCIA
horas=dict((int(h),int(s)) for h,s in g['hora_mes'])
hb=[(f"{h}:00",horas.get(h,0)) for h in range(7,24)]
dias=dict((int(d),int(s)) for d,s in g['diasem_mes']); nm=["Domingo","Lunes","Martes","Miércoles","Jueves","Viernes","Sábado"]
H.append(f'''<section id="audiencia">
<div class="eyebrow">Audiencia · 1–22 sep</div>
<h2>Madrid, desde el móvil y por la noche</h2>
<div class="two">
 <div class="card"><h3>Ciudades</h3><div class="sub">personas</div>{bars([("Madrid",643),("Sevilla",135),("Valencia",120),("Barcelona",106),("Bilbao",51),("Málaga",32),("Valladolid",26),("Zaragoza",24)])}</div>
 <div class="card"><h3>Dispositivo</h3><div class="sub">personas · % que contacta</div>{bars([("Móvil",1779,"0,6 % contacta"),("Ordenador",104,"2,9 % contacta"),("Tablet",29,"")])}
 <h3>Días de la semana</h3>{bars([(nm[i],dias.get(i,0)) for i in [1,2,3,4,5,6,0]],color="s2")}</div>
</div>
<div class="card"><h3>Horas con más visitas</h3><div class="sub">visitas por hora del día (mes)</div>{bars(hb)}</div>
<ul class="facts">
 <li><b>Madrid es un tercio de todo</b>, y en el CRM también es la ciudad con más ventas. Si se hace publicidad, que Madrid tenga su propio presupuesto.</li>
 <li><b>Hora punta: de 20:00 a 22:00</b>, con otro pico a las 14:00–15:00. Es cuando conviene publicar, subir stories y tener a alguien atento al WhatsApp.</li>
 <li><b>Edad:</b> Google empezará a mostrarla en los próximos días (Google Signals está recién activado). En el CRM solo hay edad en 28 leads, y 16 de ellos tienen menos de 30 años.</li>
</ul>
</section>''')
# ALERTAS
H.append('''<section id="alertas">
<div class="eyebrow">Alertas</div>
<div class="callout"><h3>Publicidad parada</h3><p>Meta sin gasto desde el 9 de septiembre y Google Ads desde el 6. Ninguna campaña está gastando sin traer leads, porque ninguna está gastando.</p></div>
<div class="callout"><h3>WhatsApp en los que el cliente escribió lo último hace más de 24 h</h3>
<div class="tbl"><table><thead><tr><th>Cliente</th><th>Etapa</th><th>Último mensaje del cliente</th></tr></thead><tbody>
<tr><td>Cliente A.</td><td>Sin ficha en el CRM</td><td>22 sep · 15:55</td></tr><tr><td>Cliente B.</td><td>Negociación</td><td>21 sep · 22:11</td></tr><tr><td>Cliente C.</td><td>Negociación</td><td>17 sep · 10:47</td></tr><tr><td>Sin nombre</td><td>Sin ficha</td><td>17 sep · 11:18</td></tr><tr><td>Sin nombre</td><td>Sin ficha</td><td>16 sep · 10:52</td></tr><tr><td>Cliente D.</td><td>Sin ficha</td><td>14 sep · 11:05</td></tr>
</tbody></table></div><p class="note">Algunas pueden ser un simple «gracias». (ejemplo: resumir en una línea qué pregunta el cliente, sin copiar el mensaje).</p></div>
</section>''')
# MEJORAS
H.append('''<section id="mejoras">
<div class="eyebrow">Propuestas de mejora, por impacto</div>
<h2>Seis cambios, qué ganamos y quién los hace</h2>
<ol class="imp">
<li><div class="tag"><span class="chip down">IMPACTO ALTO</span><span class="pill">Web · lo puede hacer Claude</span></div>
<h3>1. Botón «Pedir precio de este diseño» al final del configurador, fijo en el móvil</h3>
<p>Que abra WhatsApp con el diseño ya escrito: modelo, medidas, tela y ribete. El cliente no tiene que explicar nada, el equipo recibe la consulta completa y queda rastreado.</p>
<p class="why"><b>Por qué:</b> 1.278 personas configuran y solo contacta el 5 %. Subir al 8 % son <b>≈ 38 contactos más al mes</b>. Con la tasa de cierre de WhatsApp (39 %), podrían ser <b>hasta ≈ 15 ventas más al mes</b>.</p></li>
<li><div class="tag"><span class="chip down">IMPACTO ALTO</span><span class="pill">Instagram · Bea / equipo</span></div>
<h3>2. Stories con enlace a la web 3 veces por semana, a las 9:00 y a las 20:00</h3>
<p>Mismo formato que las del 12 y el 17 de septiembre: enlace a tirorirohome.com/ig, a ser posible a un proyecto de interiorista o a un producto concreto.</p>
<p class="why"><b>Por qué:</b> cada una trajo 300–400 visitas gratis, más que 4 días de anuncio. Tres a la semana pueden duplicar el tráfico de Instagram.</p></li>
<li><div class="tag"><span class="chip down">IMPACTO ALTO</span><span class="pill">Meta · Juan</span></div>
<h3>3. Reactivar Meta con objetivo «mensajes de WhatsApp» y creatividades de proyectos de interiorista</h3>
<p>Usar como anuncio la publicación del dormitorio de Alejandra Blanc (5.482 personas de alcance orgánico). Dos versiones: una a la web (/productos) y otra directa al WhatsApp. 10–15 € al día, con Madrid por separado.</p>
<p class="why"><b>Por qué:</b> Meta fue el canal de pago que mejor convirtió (4,8 %, casi como Google orgánico) y WhatsApp es el que mejor cierra (39 %). Así sabremos el CPL real de cada vía en 2 semanas.</p></li>
<li><div class="tag"><span class="chip flat">IMPACTO MEDIO</span><span class="pill">Web · lo puede hacer Claude</span></div>
<h3>4. Formulario más corto en el móvil</h3>
<p>Dejar solo nombre, WhatsApp, producto y un comentario. El resto se pregunta después por WhatsApp.</p>
<p class="why"><b>Por qué:</b> de 33 personas que lo empiezan, 15 lo abandonan a medias (45 %). Recuperar la mitad son ≈ 7 leads más al mes, y son los de ticket más alto (795 €).</p></li>
<li><div class="tag"><span class="chip flat">IMPACTO MEDIO</span><span class="pill">Google · Juan (5 min)</span></div>
<h3>5. Medir la ficha de Google Maps (Google Business Profile)</h3>
<p>a) Conectarla en Metricool (botón «Connect a Google Business Profile account», gratis): veremos búsquedas, llamadas, clics a la web y mensajes. b) En la ficha, cambiar el enlace de la web por <code>tirorirohome.com/?utm_source=google&amp;utm_medium=maps</code>.</p>
<p class="why"><b>Por qué:</b> ahora mismo no sabemos cuánta gente llega por Maps; se mezcla con Google orgánico y con los que escriben directo.</p></li>
<li><div class="tag"><span class="chip flat">IMPACTO MEDIO</span><span class="pill">Google Ads · Juan</span></div>
<h3>6. Si se reactiva Google Ads, que no lleve a la portada</h3>
<p>Mandar a /productos/cabeceros o al configurador, con los mismos textos de anuncio (su CTR del 6,7 % es muy bueno).</p>
<p class="why"><b>Por qué:</b> 140 clics a 0,42 € y cero contactos: el anuncio atrae, pero la portada no convierte a quien busca «cabeceros a medida».</p></li>
</ol>
</section>''')
# OBJETIVOS + GLOSARIO
H.append('''<section id="objetivos">
<div class="eyebrow">Objetivos que te propongo</div>
<div class="tbl"><table><thead><tr><th>Indicador</th><th>Ritmo de septiembre</th><th>Objetivo mensual</th></tr></thead><tbody>
<tr><td>Leads en el CRM</td><td>≈ 44</td><td>55</td></tr><tr><td>Ventas</td><td>≈ 20</td><td>22</td></tr><tr><td>Facturación</td><td>≈ 9.000 €</td><td>10.000 €</td></tr>
<tr><td>% de los que configuran que contactan</td><td>5 %</td><td>8 %</td></tr><tr><td>CPL en Meta (coste por lead)</td><td>pendiente</td><td>≤ 15 €</td></tr><tr><td>CPA (coste por venta)</td><td>pendiente</td><td>≤ 40 €</td></tr>
</tbody></table></div>
</section>
<section id="glosario">
<div class="eyebrow">Glosario para el equipo</div>
<dl class="gl">
<div><dt>Impresiones</dt><dd>Veces que se ha mostrado un anuncio (una persona puede verlo varias veces).</dd></div>
<div><dt>CTR</dt><dd>De cada 100 que ven el anuncio, cuántos pinchan. Por encima del 2 % en Meta o del 4 % en Google está bien.</dd></div>
<div><dt>CPC</dt><dd>Lo que cuesta cada clic en el anuncio.</dd></div>
<div><dt>CPM</dt><dd>Lo que cuesta que el anuncio se vea 1.000 veces.</dd></div>
<div><dt>CPL</dt><dd>Coste por lead: gasto ÷ contactos conseguidos.</dd></div>
<div><dt>CPA</dt><dd>Coste por venta: gasto ÷ ventas cerradas. Es el número que importa.</dd></div>
<div><dt>ROAS</dt><dd>Euros facturados por cada euro invertido en publicidad.</dd></div>
<div><dt>Conversión</dt><dd>% de visitas que acaban en contacto (formulario o WhatsApp).</dd></div>
</dl>
</section>
<footer><div>Fuentes: Google Analytics 4 (Tiroriro Home) · Google Ads vía Analytics · CRM Tiroriro · WhatsApp del CRM · Metricool (Instagram). Generado el 23/09/2026.</div></footer>
</div>''')
H.append(open('estilos_base.html').read().split('</footer>\n</div>')[1])  # script
open('parte-marketing.html','w').write("\n".join(H)); print("ok")
