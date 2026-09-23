# Instrucciones para Claude — Tiroriro Home CRM

## Flujo de entrega (IMPORTANTE)

El usuario ve la app en **Lovable**, que sincroniza la rama **`main`**. Por
tanto, cualquier cambio debe **acabar en `main`** para que se vea; si se queda
en una rama aparte, el usuario no lo verá.

Flujo estándar en cada tarea de cambios de código:

1. Desarrollar en la rama de trabajo designada para la sesión y hacer commit.
2. Hacer push de esa rama.
3. Abrir un Pull Request contra `main`.
4. **Fusionar el PR a `main` automáticamente** (squash) para que Lovable recoja
   los cambios — sin pararse a preguntar al usuario cada vez. Este es su deseo
   explícito ("que siempre sea así").

Notas:
- Si el build no se puede ejecutar en el entorno (el registro npm privado puede
  estar bloqueado por el proxy), avisar de ello; Lovable hará su propio build al
  sincronizar.
- Aun así, revisar el código con cuidado antes de fusionar.

## Base de datos / migraciones (IMPORTANTE)

Las migraciones SQL que se suben por GitHub a `supabase/migrations` **NO se
aplican solas** en la base de datos del usuario con el flujo actual (Lovable
sincroniza el código pero no ejecuta esas migraciones de forma fiable). Por eso,
si una funcionalidad depende de una **columna nueva**, se rompe en producción
("Error al actualizar…", "No se pudo guardar…", listas a 0) hasta que alguien
aplica el SQL a mano.

Regla: **evitar añadir columnas nuevas**. Para datos añadidos (marcadores,
flags, estados…) reutilizar columnas que YA existen — en especial el JSONB
`pedidos.pasos_tapicero`, que admite claves libres (usar prefijo `@` para
distinguirlas de las claves de hito; ver `marcadoresTapicero` en
`src/lib/types.ts`). Solo proponer una migración si es imprescindible, y en ese
caso avisar explícitamente al usuario de que hay que aplicarla antes de publicar.

## Stack
React + TypeScript + Tailwind, TanStack Router/Start, backend Lovable Cloud /
Supabase. Gestor de paquetes: `bun` (`bun install`, `bun run build`).

## Croquis para el tapicero (IMPORTANTE)

Cuando Juan pide "el croquis" de un pedido, quiere un **plano de corte de la
madera**, no una ficha de tapizado:

- Solo medidas: ancho, alto, grosor, tramos rectos y curvos del perfil (ancho y
  subida de cada escalón, ancho y flecha del arco…), y, si el pedido lo indica,
  distancias de enchufes, huecos o anclajes.
- Un A4 apaisado con alzado acotado + vista lateral con el grosor. Nada más.
- **Sin** telas, vivo, montaje, notas ni avisos (eso ya está en la ficha del CRM
  y en la imagen de referencia de Gemini). **Sin** página a escala 1:1.
- Cabecera mínima: producto, medidas, nº de pedido y cliente.
- Reparto del alto en cabeceros con forma: **75 % tramo recto, 25 % tramo
  curvo** (p. ej. 100 cm de alto → 75 recto + 25 de perfil). Marcar las dos
  cotas RECTO / CURVA grandes a la izquierda, **con la medida en cm y el
  porcentaje** ("RECTO · 70 cm · 70 %").
- Forma Conta (la que le gusta a Juan): **dos escalones cóncavos en cuarto de
  curva** a cada lado (arrancan horizontales y llegan verticales al siguiente
  nivel) y un **arco de círculo suave** en el centro, poco marcado, sin
  arranque vertical ("sutileza"). El segundo escalón debe llegar **tangente**
  al arco: la unión escalón-arco es redonda, sin esquinas ni "puntas". Anchos: cada escalón 1/6 del ancho
  (25 sobre 150) y el arco central 1/3 (50 sobre 150); Juan prefiere el arco
  estrecho y las curvas anchas, no un arco "gordo". El tramo curvo se
  reparte ≈ 34 % / 38 % / 28 % (escalón 1, escalón 2, arco): el segundo
  escalón algo más marcado que el primero y el arco el más bajo de los tres. Poner también las
  alturas de hombro, escalones y cima. NO hacer el perfil "hombro-pico-cuello"
  del croquis de Bego Gandarias ni una cúpula alta.
- Si varios pedidos son la misma pieza (mismo modelo y medidas), un único
  croquis para todos, indicando los números de pedido y las unidades.

## Croquis e imagen de referencia automáticos (IA)

Desde la ficha del pedido (y solos al crear un pedido) se generan:

- **Croquis** (plano de corte) con **Claude** → `POST /api/pedidos/croquis`
  (`src/routes/api/pedidos/croquis.ts`). Devuelve un SVG A4 apaisado.
- **Imagen de referencia** del acabado con **Gemini** → `POST /api/pedidos/referencia`
  (`src/routes/api/pedidos/referencia.ts`). Método de Juan: se parte de una
  **foto real del producto** (la de la web, `fotoBaseProducto` en `ia-prompts.ts`;
  si la pieza no es de catálogo, la foto de referencia subida a mano por el
  equipo) y se pide cambiar **solo la tela y el vivo**, adjuntando las fotos
  reales de las telas. No inventar la forma desde cero salvo que no haya foto.

Los prompts viven en `src/lib/ia-prompts.ts` (funciones puras, sin claves): es el
sitio donde afinar el estilo con los ejemplos que pase Juan. La parte común de
servidor (auth del equipo, contexto del pedido, subida) está en
`src/lib/ia-pedido.server.ts`. Se llama a las APIs por HTTP directo (sin SDK): el
lockfile apunta al registro privado de Lovable y no se pueden añadir dependencias
desde aquí con garantías.

- Claves: el croquis necesita `ANTHROPIC_API_KEY` (opcional `ANTHROPIC_MODEL`).
  La imagen usa `GEMINI_API_KEY` si existe; si no, la pasarela de IA de Lovable
  con `LOVABLE_API_KEY` (créditos de Lovable; modelo en `LOVABLE_IMAGE_MODEL`).
  Sin claves, la ruta responde con `noConfigurado: true` y la generación
  automática se calla.
- El resultado entra en `pedido_archivos` con `subido_por = "@ia:pendiente"`
  (`ARCHIVO_IA_PENDIENTE` en `src/lib/types.ts`). El tapicero NO lo ve hasta que
  alguien del equipo pulsa **Aprobar** (entonces `subido_por` pasa a ser quien
  aprobó). El filtro "qué falta" distingue "croquis" de "croquis por aprobar".
- Los enchufes/huecos/anclajes se guardan en `pasos_tapicero["@huecos"]`
  (`huecosDe` / `conHuecos` en `types.ts`) y se pasan al prompt del croquis.

## WhatsApp → CRM (IMPORTANTE)

El número de WhatsApp Business está conectado al CRM por **coexistencia** (la
app del móvil sigue igual y, además, un proveedor —Dualhook— reenvía cada
mensaje por webhook). Todo el código vive en `src/lib/whatsapp/` y
`src/routes/api/whatsapp/`; la bandeja es `/whatsapp` y la ficha del cliente
enseña su sección "WhatsApp". Tablas: `whatsapp_config`, `whatsapp_conversaciones`,
`whatsapp_mensajes`, `whatsapp_propuestas`, `whatsapp_eventos` (ya creadas en
producción el 23/09/2026 desde la sesión; la migración está en
`supabase/migrations/20260923120000_whatsapp_integracion.sql`).

Reglas de negocio (decididas con Juan, no cambiarlas sin preguntarle):

- La IA (pasarela de Lovable, `LOVABLE_API_KEY`, modelo en `whatsapp_config.modelo`)
  **solo extrae**; las reglas están en `procesar.server.ts`.
- **Hace sola**: enlazar por teléfono (un único lead), rellenar campos VACÍOS,
  dejar una nota con novedades. **Nunca** cambia la etapa ni sobreescribe datos.
- **NUNCA crea clientes** (decisión de Juan, 23/09/2026: los leads los crean
  Rocío, Juan, Bea o Iñaki). Si escribe alguien nuevo, deja la propuesta
  "crear cliente" con los datos y los **posibles duplicados** por nombre/email
  (la misma persona entra por formulario web, Instagram y WhatsApp).
- **Propone** (Aceptar/Rechazar en `/whatsapp` o en la ficha): crear cliente,
  etapa, dato distinto, producto nuevo o corregido, tarea, con qué cliente
  enlazar, nuevo encargo. Closed Won/Lost abren los mismos diálogos que el pipeline.
- El nombre que se enseña es el del chat o el de la **agenda del móvil**
  (`smb_app_state_sync` → `nombre_wa`), nunca el número si hay nombre.
- **No toca pedidos** ni leads cerrados (solo nota + tarea + nuevo encargo).
  El traspaso a Rocío es la etapa Closed Won: a partir del pedido, la IA es
  solo "secretaria" que anota.
- El historial anterior a la conexión solo se enlaza y resume: ni crea
  clientes ni propone nada.
- Análisis: cron de la BD (`pg_cron` + `pg_net`) llama a `/api/whatsapp/procesar`
  cada 2 minutos con la cabecera `x-whatsapp-token`; también desde "Analizar
  ahora". Debounce de 2 min desde el último mensaje. Sin secretos nuevos en
  Lovable: los tokens están en `whatsapp_config` (se ven en la configuración
  de `/whatsapp`, solo admin).
- Los mensajes de WhatsApp se guardan tal cual (datos personales): no
  exponerlos fuera del equipo (RLS `es_equipo()`), no mandarlos a servicios
  nuevos sin avisar a Juan.

## Parte diario de marketing

Todos los días a las 7:00 (Madrid) se genera un informe de marketing (GA4 + CRM +
WhatsApp + Metricool) que se publica en una página y se manda por email a Juan e
info@. El cómo, las consultas y el formato están en
`scripts/informe-marketing/INSTRUCCIONES.md`. Si cambias el texto de un botón de
WhatsApp de la web, actualiza la tabla de rastreo de ese archivo.
