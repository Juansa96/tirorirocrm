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

## Stack
React + TypeScript + Tailwind, TanStack Router/Start, backend Lovable Cloud /
Supabase. Gestor de paquetes: `bun` (`bun install`, `bun run build`).
