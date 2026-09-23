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
  (`src/routes/api/pedidos/referencia.ts`). Adjunta la foto real de la tela y el
  dibujo del configurador si existe.

Los prompts viven en `src/lib/ia-prompts.ts` (funciones puras, sin claves): es el
sitio donde afinar el estilo con los ejemplos que pase Juan. La parte común de
servidor (auth del equipo, contexto del pedido, subida) está en
`src/lib/ia-pedido.server.ts`. Se llama a las APIs por HTTP directo (sin SDK): el
lockfile apunta al registro privado de Lovable y no se pueden añadir dependencias
desde aquí con garantías.

- Secrets necesarios en Lovable Cloud: `ANTHROPIC_API_KEY` y `GEMINI_API_KEY`
  (opcionales `ANTHROPIC_MODEL`, `GEMINI_IMAGE_MODEL`). Sin ellos, la ruta
  responde 503 con `noConfigurado: true` y la generación automática se calla.
- El resultado entra en `pedido_archivos` con `subido_por = "@ia:pendiente"`
  (`ARCHIVO_IA_PENDIENTE` en `src/lib/types.ts`). El tapicero NO lo ve hasta que
  alguien del equipo pulsa **Aprobar** (entonces `subido_por` pasa a ser quien
  aprobó). El filtro "qué falta" distingue "croquis" de "croquis por aprobar".
- Los enchufes/huecos/anclajes se guardan en `pasos_tapicero["@huecos"]`
  (`huecosDe` / `conHuecos` en `types.ts`) y se pasan al prompt del croquis.
