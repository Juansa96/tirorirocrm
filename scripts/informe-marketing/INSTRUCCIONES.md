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

- **Meta Ads** (cuenta act_4413067068940680): campañas `FACA05` nombre, `FACA13` gasto,
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

