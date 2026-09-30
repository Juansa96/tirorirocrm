# Parte diario de marketing (Tiroriro)

Cada día a las **7:00 (hora de Madrid)** Claude genera el parte de marketing y:

1. actualiza la página con gráficos **https://claude.ai/artifact/17Am89ypvJvFo5jtFFxYDn**
   (republicar siempre en esa misma URL: `Artifact` con `url`),
2. manda el email a **sangradortorresjuan@gmail.com** e **info@tirorirohome.com**.

Lo pidió Juan el 23/09/2026. Lo lee todo el equipo: tiene que entenderse sin saber
de marketing, ser visual y decir **qué hacer**, no solo dar números.

## Periodos

- **Ayer** (comparado con el mismo día de la semana anterior).
- **Semana** = últimos 7 días hasta ayer (comparada con los 7 anteriores).
- **Mes** = del día 1 hasta ayer (comparado con el mismo tramo del mes anterior;
  en septiembre de 2026 no hay comparación porque GA4 empezó a medir bien a finales de agosto).

Qué cuenta como qué (decidido con Juan):
- **Lead** = alguien que deja sus datos o escribe: formulario, WhatsApp, llamada o email. Fuente de verdad: tabla `leads` del CRM.
- **Conversión / venta** = que **pague**: etapa `Closed Won` o `Ganado` (fecha = `venta_fecha`, o si no hay, `fecha_entrada_etapa`; importe = `venta_importe`, o si no hay, `valor`).
- Excluir `tipo = 'INFLUENCER'` de las cifras comerciales.

## Fuentes y cómo leerlas

### 1. Google Analytics 4 (propiedad 543745489)
Credencial «Google Analytics» del entorno (cuenta de servicio de solo lectura; el
proxy pone el token solo). Sin claves en el código.

```
cd scripts/informe-marketing && python3 fetch_ga.py AAAA-MM-DD   # fecha de HOY
```
Genera `ga.json` con: totales y eventos por periodo, canales, fuentes, campañas,
leads por fuente, edad, género, ciudad, dispositivo, páginas de entrada, tiempo por
página, horas, días, embudo, serie diaria de 60 días, **Google Ads con coste real**
(`advertiserAdCost`, clics, impresiones → CTR, CPC, CPM), anuncios por campaña y
creatividad, **WhatsApp por canal, página y botón**, transiciones entre páginas,
scroll y los **3 picos de visitas** del mes (hora y fuente) para explicarlos.

Eventos útiles: `form_start`, `generate_lead` (se dispara dos veces por lead: usar
usuarios, o mejor visitas a `/gracias`), clic a `wa.me` (evento `click` con
`linkDomain = wa.me`).

### 2. CRM (Supabase del proyecto Lovable «Tiroriro Home CRM»)
`mcp__Lovable__query_database` con `project_id = 4c2a37af-cc6b-4584-a4f2-764e4ed2fdc3`.
**Solo SELECT.** Consultas base (cambiar las fechas):

```sql
-- Leads, ventas y facturación por periodo
with l as (select *, (created_at at time zone 'Europe/Madrid')::date d from leads where coalesce(tipo,'B2C')<>'INFLUENCER'),
w as (select *, coalesce(venta_fecha,(fecha_entrada_etapa at time zone 'Europe/Madrid')::date) vd, coalesce(venta_importe,valor) eur
      from leads where etapa in ('Closed Won','Ganado') and coalesce(tipo,'B2C')<>'INFLUENCER')
select (select count(*) from l where d between :a and :b) leads,
       (select count(*) from w where vd between :a and :b) ventas,
       (select coalesce(sum(eur),0) from w where vd between :a and :b) eur;

-- Por origen (leads 30 d, ventas 30 d, €, ticket medio, días hasta cerrar): agrupar por coalesce(nullif(origen,''),'Sin origen')
-- Embudo abierto: etapas distintas de ganado/perdido con count, sum(valor) y días en etapa (now()-fecha_entrada_etapa)
-- Leads con UTM/fbclid/gclid: utm_source, utm_medium, utm_campaign → leads y ventas por campaña (para CPL/CPA)
```

**Rastreo de WhatsApp.** Cada botón de la web abre el chat con un texto distinto
(`src/lib/whatsapp.ts` de la web y los componentes que enlazan a `wa.me`). Primer
mensaje entrante de cada conversación → botón:

| Empieza por | Botón |
|---|---|
| `Hola, he diseñado en el configurador:` | botón «Pedir precio de mi diseño» / flotante con diseño (desde 23/09/2026) |
| `Hola, estoy usando el configurador` | botón flotante en el configurador (sin diseño) |
| `Hola, me interesa uno de vuestros productos tapizados` | botón flotante / formulario / página de gracias |
| `Hola, tengo una duda sobre vuestros productos` | menú superior |
| `Hola, tengo dudas sobre las telas` | página de telas |
| `Hola, os escribo desde Instagram` | página /ig (enlace de bio y stories) |
| `raw` con `referral` o `ctwa` | anuncio de Meta «clic a WhatsApp» |
| cualquier otro | escribe directo (Instagram, recomendación, Google Maps, tarjeta…) |

```sql
with first_in as (select distinct on (conversacion_id) conversacion_id, texto, enviado_at, raw
  from whatsapp_mensajes where direccion='entrante' order by conversacion_id, enviado_at)
select /* case con la tabla de arriba */ ..., count(*) filter (where enviado_at >= :desde)
from first_in f join whatsapp_conversaciones c on c.id=f.conversacion_id left join leads l on l.id=c.lead_id group by 1;
```

**Alerta «sin contestar»**: conversaciones cuyo último mensaje entrante tiene más de
24 h (y menos de 10 días), sin mensaje `saliente` posterior, y que no estén en un lead
ganado/perdido. Enseñar nombre (`nombre_wa` o nombre del lead), etapa y fecha. Nunca
copiar el contenido de los mensajes en el informe (datos personales).

### 3. Metricool (marca 7061730 «Tirorirohome», cuenta sangradortorresjuan@gmail.com)
`mcp__Metricool_Social_Media_Management__getAnalyticsDataByMetrics`, fechas con `+02:00`/`+01:00`.

- **Meta Ads** (cuenta act_3757816891176752, conectada bien el 27/09; la act_4413067068940680 «Tiroriro Home Ads» NO es la que paga): campañas `FACA05` nombre, `FACA13` gasto,
  `FACA10` impresiones, `FACA12` alcance, `FACA14` clics, `FACA44` clics en enlace,
  `FACA156`/`FACA157` resultados, `FACA41` leads, `FACA77` conversaciones de mensajería.
  Evolución diaria: `FAEV01`, `FAEV04`, `FAEV05`.
- **Google Ads** (2530700678): usar la red `googleAds` (consultar con
  `getAnalyticsAvailableMetrics`). Si viene vacía, el coste real está en GA4 (`google_ads_*`).
- **Instagram**: evolución `IGEV01` seguidores, `IGEV06` alcance, `IGEV43/44` ganados y
  perdidos. Posts `IGPO02, IGPO03, IGPO06, IGPO14, IGPO28, IGPO12, IGPO15, IGPO27, IGPO29`.
  Reels `IGRE02, IGRE03, IGRE11, IGRE23, IGRE09, IGRE21, IGRE27`. **Stories**
  `IGST02, IGST03, IGST06, IGST10, IGST08, IGST11` (guardadas desde el 23/09/2026).
- **Google Business Profile**: `GMEV18/19` alcance en búsqueda/Maps, `GMEV21` clics a la
  web, `GMEV22` llamadas, `GMEV23` cómo llegar, `GMEV25` mensajes, `GMEV12/13` reseñas,
  `GMKW01/02` búsquedas.

Metricool empezó a importar el 23/09/2026: si algo viene vacío, decirlo en el informe
(«pendiente») y no inventarlo.

## Métricas que siempre deben salir

- **Campañas** (cada una): estado, gasto, impresiones, clics, **CTR**, **CPC**, **CPM**,
  visitas a la web, contactos (formulario + WhatsApp), % conversión, leads en el CRM,
  ventas, **CPL** (gasto ÷ leads), **CPA** (gasto ÷ ventas) y **ROAS** (€ ÷ gasto). Si una
  campaña gasta y lleva 0 leads 3 días → alerta roja.
- **Canales**: personas, % del tráfico, contactos, % conversión, coste por contacto.
- **WhatsApp**: por canal, por botón, por página y chats reales del CRM por botón.
- **Recorrido**: páginas de entrada, siguiente página más habitual, donde más y menos
  tiempo se quedan (mín. 40 personas), embudo (web → productos → configurador →
  formulario → enviado).
- **Instagram**: publicaciones, stories y reels del periodo con alcance, interacciones,
  compartidos y seguidores ganados; **explicar cada pico de visitas** cruzando la hora y
  la fuente de GA4 con lo publicado ese día (qué story/post fue). No dejarlo en «revisad».
- **Ventas**: por origen, % de leads que pagan, ticket medio, días hasta cerrar, embudo abierto.
- **Audiencia**: ciudades, dispositivo (y su conversión), horas, días, edad (GA4 si hay
  datos; si no, la del CRM).
- **Alertas**: campaña gastando sin leads; WhatsApp sin contestar > 24 h.
- **Mejoras**: 3–6 propuestas concretas, ordenadas por impacto, con el porqué en números,
  quién la hace y lo que ganaríamos. Revisar si las del día anterior se hicieron.
- **Objetivos** (propuestos el 23/09, a confirmar por Juan): 55 leads/mes, 22 ventas/mes,
  10.000 €/mes, 8 % de los que configuran contactan, CPL Meta ≤ 15 €, CPA ≤ 40 €.
  Decir si se va por delante o por detrás del ritmo.

## Página (artifact)

`plantilla_pagina.py` es la versión del 23/09/2026 que le gustó a Juan: marca de la web
(Cormorant Garamond + Inter, turquesa `#133A43` sobre crema), fichas con sparklines,
barras horizontales, tarjetas de campaña con cuadrícula de métricas, glosario.
Mantener esa estructura y ese aspecto; cambiar los datos y los textos cada día.
Nombres de clientes abreviados (nombre + inicial).

## Email (corto y ejecutivo: decisión de Juan, 26/09/2026)

El email NO es el informe: es un **resumen de 30 segundos + el enlace a la página**.
Plantilla y aspecto exactos en `email_plantilla.html` (probada a 360 y 390 px):
una columna, máx. 480 px, estilos en línea, sin tablas de datos.

1. Fecha y **un titular** con la noticia del día (no un resumen de todo).
2. **3 cifras** en fichas: leads semana, ventas semana, ventas mes (con su variación
   o el objetivo). Nada más.
3. **«Lo importante»: máximo 3 líneas**, con 🟢 / 🟠 / 🔴. Solo lo que es **nuevo o
   ha cambiado** desde el email de ayer: un lead o una venta que merece nombre, un
   cambio fuerte (±30 % o más), una alerta nueva. **No repetir** frases, datos ni
   avisos que ya salieron el día anterior si no han cambiado (p. ej. no volver a
   decir cada día «falta el gasto de Meta»: solo cuando se resuelva o empeore, o
   como acción si toca).
4. **«Qué hacer hoy»: 3 acciones** concretas, con quién las hace. Es la parte que
   más le gusta a Juan: priorizar y ser concreto (nombre del cliente, anuncio, etc.).
5. Botón a ancho completo **«Ver el informe completo →»** a la página.

Máx. ~150 palabras. Asunto: `📊 Tiroriro DD/MM · <el titular en corto>`.
En el email pueden ir nombres de clientes (va solo al equipo), pero con inicial
del apellido basta.

## Página (qué cambia cada día)

La página conserva la estructura del 23/09, pero **arriba del todo** va lo nuevo del
día; las secciones que no han cambiado se actualizan en silencio (cifras) sin
reescribir los mismos textos ni repetir los mismos avisos día tras día.


## Producto (decisión de Juan, 27/09/2026)

Juan quiere que el informe hable **mucho de producto** para ir mejorando productos:
qué se vende en la semana, el mes y 3 meses (modelo, tela, estilo y color de tela,
vivo y su color, colgado/apoyado, ancho y alto del cabecero, colección) y lo que se
pide frente a lo que se compra. Sección interactiva `#producto` (control segmentado
Semana/Mes/3 meses que redibuja todas las barras), justo después de Campañas, y
6–7 conclusiones de producto con números (qué ampliar, qué subir de precio, qué
dejar de promocionar). La plantilla de la sección (`producto_plantilla.html`) se quedó en la sesión antigua y
se perdió: rehacerla con esta descripción y guardarla en esta carpeta.

Datos: `productos_lead` unido a `pedidos` (`pedidos.producto_lead_id`), sin canjes
(`es_canje`). Fecha = `pedidos.fecha_creacion_pedido` (Madrid). Campos: `tipo`,
`modelo` (1.ª palabra = modelo de cabecero), `tela`, `coleccion_tela`, `acabado`
(vivo-simple / vivo-doble / liso), `relleno` (en cabeceros = tela/color del vivo),
`patas` (en cabeceros = montaje: «Colgado a la pared», «Apoyado en el suelo»,
tapetes), `ancho`, `alto`, `cantidad`, `precio_unitario`. Consultas frente a
compras: todos los `productos_lead` del periodo, con o sin pedido.

Email: sin recomendaciones de «contestar a X». Consejos de negocio y marketing,
pensados y con números. Diseño tipo Apple (fondo #F2F2F7, tarjetas blancas
redondeadas, letra del sistema, botón con `bgcolor` en la celda para que se vea en
Gmail del iPhone). Aprobado por Juan el 27/09: plantilla `email_plantilla_v2.html` (en esta carpeta desde el 30/09); sustituye a `email_plantilla.html`. El asunto sigue siendo «📊 Parte de marketing DD/MM · <titular>».

## Creatividades con imagen (Juan, 27/09/2026)

Siempre que se hable de un anuncio (en la página y en el email) va su **captura**.
Fuentes de la foto en la sección «Anuncios» del final (Metricool `FADE` viene vacío:
comprobado el 30/09/2026).
En la página: descargar la miniatura y meterla en el HTML (data URI pequeña o
subida como archivo del artifact), porque los enlaces de fbcdn caducan. En el email:
miniatura de 64–72 px a la izquierda de cada fila de anuncio. Si Metricool no la
devuelve (cuenta de anuncios mal conectada), decirlo en una línea: no inventar ni
poner fotos de la web en su lugar.

## Google Business Profile (comprobado 27/09/2026)

Ya llegan datos por Metricool (ficha «Tiroriro Home»). Usar `GMEV18` búsqueda,
`GMEV19` Maps, `GMEV21` clics a la web, `GMEV22` llamadas, `GMEV23` «cómo llegar»,
`GMEV25` mensajes, `GMRE01/06/09/04` reseñas (fecha, nombre, estrellas, respondida),
`GMID01/02` reparto búsqueda/Maps. `null` = 0. Los últimos 5–6 días llegan
incompletos: comparar semanas cerradas (p. ej. la que acaba 6 días antes). El plan
gratis solo da 30 días. Palabras clave (`GMKW`) aún vacías.
Referencia 28/08–24/09: 304 apariciones (60 % búsqueda, 40 % Maps), 21 clics a la
web, 70 «cómo llegar», 1 llamada, 3 reseñas de 5★.

## Campañas de Meta activas (27/09/2026)

Hay DOS: `ES_Cabeceros_Leads_Sep26` (a la web/configurador, leads) y
`WA_Cabeceros_Oct26` (clic a WhatsApp: 625 clics y 27.089 de alcance en 30 días).
Medir las dos por separado. Los WhatsApp de la segunda llegan sin UTM (suelen empezar
por «vengo del anuncio» o traer `referral`/`ctwa` en `raw`): contarlos como leads de
esa campaña para el CPL.

## Estructura de la página (elegida por Juan el 27/09/2026) — manda sobre lo anterior

Que no sea infinita: arriba lo esencial abierto y el resto en **desplegables**
(`<details class="blk">` con título + una línea de resumen con la cifra clave).
Referencia visual: la página publicada (leerla con `Artifact` `action: "read"` antes de
republicar y mantener su estructura).

Siempre abierto:
1. **Resumen**: 4 fichas (leads semana, ventas semana, ventas mes, visitas semana)
   + 3 novedades del día. Dentro, un desplegable **Comparativas**: ayer frente al
   día anterior, semana frente a la anterior, mes (1–N) frente a los mismos días de
   agosto y julio (visitas, personas, formularios, clics a WhatsApp, leads, ventas).
2. **Qué haría yo**: 3–4 consejos de negocio/marketing con números.

Desplegables, en este orden: Anuncios de Meta (con foto de cada creatividad) ·
Producto · Ventas · De dónde llega el WhatsApp · Instagram · Google (ficha de Maps) ·
La web: el freno y el recorrido · Gráfica de visitas · Audiencia.

Fuera: objetivos (Juan aún no los ha fijado), glosario y alertas de «sin contestar».

## Producto: primero categorías, luego modelos (Juan, 27/09/2026)

Al hablar de producto (página, email y consejos) se habla primero por **categoría**:
cabeceros, pufs, bancos, almohadones, pantallas de lámpara, mesas… Los modelos
(Conta, Macarella, Pregonda, Calobra…) van **dentro** de su categoría, como segundo
nivel (desplegable o sub-lista), nunca mezclados con las categorías en el mismo
gráfico ni en el titular.

## Parte v4: diario de 1 minuto + resumen semanal los lunes (Juan, 27/09/2026) — manda sobre todo lo anterior

### Cada día (martes a domingo): solo 5 cosas
1. **Leads de ayer**: cuántos, de dónde (origen/UTM/campaña) y si hay alguno grande (valor ≥ 400 €).
2. **Ventas**: cerradas ayer y el mes (1–N) frente a los mismos días del mes anterior.
3. **Anuncios**: gasto de ayer y del mes, CPL / CPA / CPI de cada campaña (web y WhatsApp
   por separado), la creatividad que mejor funciona **con su foto** y el veredicto
   «¿invertir más?». Todo sale de `anuncios.py` (ver «Anuncios» al final, manda sobre esto).
   Alarma roja si una campaña gasta 3 días sin leads.
4. **Dinero en juego**: € en presupuestos abiertos (Primer Contacto, Discovery,
   Negotiation, Propuesta, On Hold) y si sube o baja frente a ayer; cuánto lleva más de
   14 días parado; cuánto pasó a perdido esta semana.
5. **Una sola decisión del día**, la más importante, con su número.
Debajo, en desplegables: las 5 secciones nuevas (abajo) cuando tengan algo que decir.

### Los lunes: además, el resumen semanal (semana cerrada lunes–domingo)
Audiencia · la web (solo el freno: llegan al configurador → piden precio) · WhatsApp por
canal/botón/página · Producto completo (categorías y dentro modelos) · Ficha de Google
(semana ya cerrada) · Instagram (solo lo que trae visitas, WhatsApp y leads).

### Secciones nuevas
- **Dinero en juego** (CRM): por etapa abierta `count`, `sum(valor)`, parados
  (`fecha_entrada_etapa` < hoy−14), entradas de la semana y € que pasaron a Closed Lost.
  Referencia 27/09: 15.462 € abiertos (8.572 € en Negotiation), 8.887 € parados > 14 días,
  875 € perdidos esta semana.
- **Cuánto devuelve cada euro de anuncio (ROAS)**: gasto Meta (Metricool, por campaña)
  frente a ventas cerradas de leads con `utm_source` meta + leads de WhatsApp de la
  campaña WA (`raw` con `referral`/`ctwa` o primer mensaje «vengo del anuncio»). Si Juan
  da márgenes por categoría, calcular beneficio y no solo ventas.
- **Semáforo de taller** (tabla `pedidos`, sin canjes): en curso (`not entregado`),
  retrasados (`fecha_limite` < hoy), vencen en 7 días, nuevos de la semana; plazo
  prometido (`dias_plazo`) frente a real (`coalesce(fecha_entrega_real, entregado_fecha)`
  − fecha del pedido) y % entregados tarde. Verde / ámbar / rojo según retrasos y lo que
  vence en 7 días. Referencia 27/09: 31 en curso, 6 retrasados, 16 vencen en 7 días; en 60
  días 41 entregados, 27 días reales de media frente a 30 prometidos, 17 tarde (41 %).
- **Radar de producto**: por categoría, consultas (`productos_lead`) frente a compras
  (con pedido); lo que se pide fuera de carta (medidas/modelos personalizados, telas «que
  manda ella»); búsquedas de Google (`GMKW`). No hay campo de motivo de pérdida: si el
  equipo lo apunta en `etiquetas` («Perdido: precio», «Perdido: plazo»…), usarlo.
- **Motor gratis**: leads con origen «Referido» (cuántos, % que paga, € ) y reseñas
  nuevas de Google (`GMRE`). Aún no hay campo de «quién recomienda».

### Fuera del informe
Google Ads (salvo que se reactive) · «Personas» (repite visitas) · seguidores y alcance
de Instagram · tiempo por página y páginas de entrada · telas por nombre exacto (dejar
estilo, color y las 3 telas top).

El email sigue el mismo orden: las 5 cosas del día; los lunes, 3 líneas del resumen semanal.

## Ajustes del 27/09 (tarde)

- **Datos «ganadores»**: a Juan le sirven los datos que destapan un problema de negocio
  con un porcentaje claro (p. ej. «el 41 % de los pedidos llegó tarde»). Buscar uno así
  cada día; mejor uno bueno que diez tibios.
- **Recomendados**: origen «Referido» + «Boca a boca». Dar las dos lecturas: % de todos
  sus leads que paga (27/09: 16 de 32 = 50 %) y % de los ya decididos (84 %).
  Hay 22 leads «Sin origen»: decirlo si crece.
- **Margen / ROAS**: primero por categoría y luego, dentro, por modelo.
- **Presupuestos que no cierran** (sección semanal, dentro de «Dinero en juego»): leads
  en Negotiation / On Hold / Propuesta parados > 14 días. Solo con cifras, sin leer notas
  ni mensajes (Juan no lo autorizó): €, nº de mensajes, quién escribió el último (nosotros
  o el cliente), días sin hablar, categoría, origen; comparar con ganados y perdidos.
  Referencia 27/09 (leads desde junio): 22 parados = 6.017 €; en 13 el último mensaje es
  nuestro (enviamos presupuesto y el cliente se calla), 9 días de media sin hablar; su
  ticket (mediana 412 €) y su implicación (55 mensajes) son casi los de los ganados
  (435 €, 66), así que no es el precio: se enfrían después del presupuesto. Los perdidos
  son otra cosa: ticket bajo (mediana 200 €) y pocos mensajes (21), se van pronto.

## Anuncios: gasto, CPL / CPA / CPI, creatividades con foto y «¿invertir más?» (Juan, 30/09/2026) — manda sobre lo anterior

Juan se quejó (30/09) de que el parte no enseñaba las fotos de las creatividades ni cuál
funciona mejor, no daba CPL, CPA ni CPI, y no decía cuánto llevamos gastado ni si hay que
invertir más. Desde ahora el bloque de anuncios es **siempre el mismo** y lo genera
`anuncios.py`; Claude solo junta los datos en `anuncios.json` y pega lo que sale.

### Qué sale (cada día, arriba del desplegable «Anuncios de Meta», abierto)
- **Gasto**: ayer · mes en curso · previsión a fin de mes (media de los últimos 7 días con
  gasto × días que faltan) · desde que empezaron las campañas (y por campaña). Si Juan fija
  un `presupuesto_mes`, el % gastado.
- **Por campaña**: veredicto (Subir +20 % / Mantener / Bajar / Cambiar creatividad /
  Esperar) con su motivo en una frase, y la rejilla: gasto, leads (CRM) o chats,
  **CPL** (gasto ÷ leads), **CPA** (gasto ÷ ventas), **ROAS** (€ vendidos ÷ gasto),
  **CPI** (coste por cada 1.000 impresiones, lo que Meta llama CPM), **CPC** y **CTR**
  (+ frecuencia). En verde / rojo frente al objetivo.
- **Por creatividad, de mejor a peor**, con su **foto**: visitas, leads, chats, conversión,
  ventas, CPL/CPA/CTR/CPI si hay gasto por anuncio, y etiqueta (La mejor / Mantener /
  Pausar / Pocos datos). Orden: resultados por € si hay gasto por anuncio; si no, por visita.
- En el **email**, por campaña: gasto, CPL (o €/chat), CPA, CPI y el veredicto, y debajo
  **todas** sus creatividades activas de mejor a peor, cada una con su foto (Juan, 30/09:
  «quiero ver todas las creatividades»). Cabecera «ANUNCIOS · X € EN <MES> · …».
- En «La decisión de hoy» / «Qué haría yo»: si alguna campaña sale «Subir», decir cuánto
  (`si_subimos` de `anuncios_resumen.json`: € más por semana y leads/chats que traería al
  mismo coste, **como estimación**). Si sale «Bajar», qué creatividad pausar.

### Reglas del veredicto (en `anuncios.py`; objetivos por defecto: CPL 15 €, CPA 40 €,
### 3 € por chat, ROAS 3, frecuencia 3 — se cambian en `objetivos` si Juan los fija)
1. Interacción (me gusta/seguidores): no se juzga por leads («No trae leads»).
2. 0 resultados y gasto ≥ 3 × objetivo → **Bajar o cambiar**.
3. Menos de 5 días o gasto < 2 × objetivo → **Esperar**.
4. Frecuencia > 3 → **Cambiar creatividad** (la gente se cansa).
5. Coste ≤ objetivo → **Subir +20 %** (salvo WhatsApp con < 20 % de chats con ficha, o
   ROAS < 1 con ventas → **Mantener** y decir por qué).
6. Coste ≤ 1,5 × objetivo → **Mantener** (quitar la creatividad peor). Más → **Bajar**.
Creatividad «Pausar»: gasto ≥ 2 × CPL objetivo sin leads, o ≥ 60 visitas sin ningún lead.

### De dónde sale cada dato → `anuncios.json` (formato: `anuncios_ejemplo.json`, datos reales del 29/09)
- `campanas[]` (Metricool, red Meta Ads, `FACA05` nombre, `FACA03` inicio, `FACA13` gasto,
  `FACA10` impresiones, `FACA12` alcance, `FACA14` clics, `FACA44` clics en enlace,
  `FACA36` leads del píxel). Dos consultas: `mes` (del día 1 a ayer) y `total` (desde el
  1/08/2026 hasta ayer, para «desde que empezaron»). `tipo`: `web` (ES_…Leads), `whatsapp`
  (WA_…), `interaccion` (IG_Publicacion…). En `mes` se añaden del CRM: `leads`, `ventas`,
  `eur` (web: leads con `utm_campaign` = la campaña; WhatsApp: chats de anuncio, abajo) y
  `visitas` (GA4 `creatividades_mes.visitas` sumadas por campaña). WhatsApp: `chats` y
  `con_ficha`.
- `gasto_diario`: Metricool `FAEV01, FAEV04, FAEV05` (usar `FAEV04` = gasto) de los últimos
  10 días. Los 1–2 últimos días pueden venir a 0 (Metricool va con retraso): no son «0 €».
- `creatividades[]` de la campaña web: una por `utm_content` (= nombre del anuncio),
  **todas** las que tengan visitas en GA4 en el mes aunque no tengan leads.
  `visitas` de GA4 (`creatividades_mes.visitas` de `fetch_ga.py`), `leads`/`ventas`/`eur`
  del CRM:
  ```sql
  select utm_campaign campana, utm_content nombre, count(*) leads,
    count(*) filter (where etapa in ('Closed Won','Ganado')) ventas,
    coalesce(sum(coalesce(venta_importe,valor)) filter (where etapa in ('Closed Won','Ganado')),0) eur
  from leads where utm_source='meta' and coalesce(tipo,'B2C')<>'INFLUENCER'
    and (created_at at time zone 'Europe/Madrid')::date between :desde and :ayer group by 1,2;
  ```
  Si Metricool algún día devuelve el detalle por anuncio (`FADE04` nombre, `FADE13` gasto,
  `FADE15` impresiones, `FADE37` clics en enlace, `FADE16` alcance, `FADE147` miniatura),
  añadir `gasto`, `impresiones`, `clics_enlace`, `alcance` y `foto` a cada creatividad.
- `creatividades[]` de la campaña de WhatsApp: una por anuncio (`referral.source_id`), con
  `chats`, `ventas`, `eur` y su **foto**, que guarda el CRM solo (desde el 30/09/2026,
  `src/lib/whatsapp/anuncios.server.ts`) en `raw._anuncio` del mensaje:
  ```sql
  with r as (select distinct on (m.conversacion_id) m.conversacion_id, m.raw->'referral'->>'source_id' ad, m.enviado_at
    from whatsapp_mensajes m where m.direccion='entrante' and m.raw->'referral'->>'source_type'='ad'
    order by m.conversacion_id, m.enviado_at)
  select r.ad, count(*) chats, count(*) filter (where r.enviado_at >= :desde) chats_periodo, count(c.lead_id) con_ficha,
    count(*) filter (where l.etapa in ('Closed Won','Ganado')) ventas,
    coalesce(sum(coalesce(l.venta_importe,l.valor)) filter (where l.etapa in ('Closed Won','Ganado')),0) eur
  from r join whatsapp_conversaciones c on c.id=r.conversacion_id left join leads l on l.id=c.lead_id group by 1;
  -- foto, título y texto de cada anuncio
  select distinct on (raw->'_anuncio'->>'id') raw->'_anuncio'->>'id' ad, raw->'_anuncio'->>'texto' texto,
    raw->'_anuncio'->>'foto' foto
  from whatsapp_mensajes where raw->'_anuncio'->>'estado'='ok' order by raw->'_anuncio'->>'id', enviado_at desc;
  ```
  Nombre de la creatividad: las primeras palabras de `texto` entre comillas + los 4
  últimos dígitos del id («Dos pufs y el salón…» (…5520)).
- **Fotos de la campaña web**: Metricool `FADE147` si llega. Si no, la creatividad sale
  con «sin foto» y el motivo (`motivo_sin_foto`): **no** poner fotos de la web ni
  inventarlas. Mientras falte, en el email una línea (solo el primer día o si cambia):
  «Las fotos de los anuncios de la web necesitan el detalle por anuncio en Metricool».

### Ejecutar
```
python3 anuncios.py anuncios.json   # → anuncios_pagina.html, anuncios_email.html,
                                    #   anuncios_resumen.json
```
- Página: pegar `anuncios_pagina.html` dentro del desplegable «Anuncios de Meta», que va
  **abierto** (`<details class="blk" open>`), con resumen «X € este mes · CPL web Y € ·
  veredicto». Las fotos van como data URI (los enlaces de fbcdn caducan y el artifact
  no carga imágenes de fuera).
- Email: pegar `anuncios_email.html` donde marca la plantilla. Las fotos van por URL
  pública del CRM: `https://tirorirocrm.lovable.app/api/public/anuncio-foto?id=<ad_id>`
  (poner `ad_id` en cada creatividad de WhatsApp) o `foto_url` si la foto está en otro
  sitio. Gmail NO enseña imágenes `data:` y la herramienta de envío cambia el Content-ID
  de los adjuntos en línea (probado el 30/09: la foto salió como adjunto suelto), así que
  nada de `cid:` ni `attachments`.

### Email con el bloque de anuncios (30/09/2026)
`anuncios_email.html` son filas con el estilo de `email_plantilla_v2.html`: van entre
«LAS 5 DE HOY» y «LA DECISIÓN DE HOY» (hay un comentario que marca el sitio). La fila
«Anuncios» de las 5 de hoy lleva el gasto del mes y, debajo, gasto de ayer + CPL web +
€/chat. Prueba real enviada a Juan el 30/09 con la miniatura como adjunto en línea.
En la página, la foto va como data URI (la de `raw._anuncio`); en el email, por la URL
pública del CRM (ver «Ejecutar»).
