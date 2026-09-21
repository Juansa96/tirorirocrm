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
- Reparto del alto en cabeceros con forma: **80 % tramo recto, 20 % tramo
  curvo** (p. ej. 100 cm de alto → 80 recto + 20 de perfil). Marcar las dos
  cotas RECTO / CURVA bien visibles. El reparto interno del tramo curvo
  (escalones, arco) sigue las proporciones del configurador de la web
  (`ProductSVGPreview.tsx` en el repo `tiroriro`), redondeado a 0,5 cm.
- Si varios pedidos son la misma pieza (mismo modelo y medidas), un único
  croquis para todos, indicando los números de pedido y las unidades.
