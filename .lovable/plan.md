Amplío el CRM con B2B reutilizando el motor actual. Nada se borra ni se rehace.

## 1. Migración (una sola, idempotente)

```sql
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS tipo TEXT NOT NULL DEFAULT 'B2C',
  ADD COLUMN IF NOT EXISTS razon_social TEXT,
  ADD COLUMN IF NOT EXISTS nif TEXT,
  ADD COLUMN IF NOT EXISTS contacto_nombre TEXT,
  ADD COLUMN IF NOT EXISTS contacto_apellidos TEXT,
  ADD COLUMN IF NOT EXISTS contacto_cargo TEXT,
  ADD COLUMN IF NOT EXISTS direccion TEXT,
  ADD COLUMN IF NOT EXISTS web TEXT,
  ADD COLUMN IF NOT EXISTS instagram TEXT,
  ADD COLUMN IF NOT EXISTS notas_b2b TEXT,
  ADD COLUMN IF NOT EXISTS asignados TEXT[] NOT NULL DEFAULT '{}',
  ADD CONSTRAINT leads_tipo_check CHECK (tipo IN ('B2C','B2B'));

-- Back-fill idempotente: la columna nace con DEFAULT 'B2C' y NOT NULL, así que
-- los registros existentes ya quedan como B2C sin UPDATE adicional.
-- Índices únicos parciales para evitar duplicados B2B:
CREATE UNIQUE INDEX IF NOT EXISTS leads_b2b_nif_uniq
  ON leads (LOWER(nif)) WHERE tipo='B2B' AND nif IS NOT NULL AND nif <> '';
CREATE UNIQUE INDEX IF NOT EXISTS leads_b2b_razon_social_uniq
  ON leads (LOWER(razon_social))
  WHERE tipo='B2B' AND (nif IS NULL OR nif='') AND razon_social IS NOT NULL AND razon_social <> '';

ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES leads(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS pedidos_empresa_id_idx ON pedidos(empresa_id);
```

Los `vendedor`, `email`, `telefono` ya existen en `leads` — se reutilizan para B2B (email/telefono de contacto). No se duplican.

Las etapas B2B ("Cliente potencial", "Propuesta", "Ganado", "Perdido") se guardan en la MISMA columna `etapa`. No hay CHECK constraint sobre etapa hoy, así que conviven sin migración de datos. La validación por tipo se hace en el frontend.

## 2. Formulario web (`/api/public/lead-form.ts`)
Fuerzo `tipo='B2C'` en el insert. Sin más cambios.

## 3. Navegación
Renombro label "Clientes" → "B2C" en `AppLayout`. Añado ruta y label "B2B".

Rutas nuevas (reutilizando componentes existentes con parámetro `tipo`):
- `/b2b` → listado (clona `clientes.index` filtrando tipo)
- `/b2b/nuevo` → alta manual con campos B2B
- `/b2b/:id` → ficha (mismo `clientes.$id.tsx`, ya sirve para ambos)
- `/pipeline-b2b` → pipeline con las 4 etapas B2B

En lugar de duplicar ficheros, refactorizo mínimo:
- `clientes.index.tsx` y `pipeline.tsx` aceptan un prop/loader `tipo` y filtran.
- Rutas B2B son wrappers finos que pasan `tipo='B2B'`.
- La ficha detecta `tipo` del lead y muestra bloques distintos (datos empresa vs particular, etapas correspondientes, multiselección de asignados).

## 4. Pipeline
- B2C: etapas actuales intactas.
- B2B: `ETAPAS_B2B = ["Cliente potencial","Propuesta","Ganado","Perdido"]`. Colores propios.
- El componente pipeline recibe la lista de etapas según `tipo`.

## 5. Alta B2B (`/b2b/nuevo`)
Campos: razón social, NIF, contacto (nombre/apellidos/cargo), dirección, teléfono, email, web, instagram, notas, asignados (multi: Iñaki/Juan/Rocío/Bea).
Validación: al menos uno de {razón social, contacto_nombre, instagram}. Chequeo previo de duplicado por NIF / razón social (además del índice único que actúa de red).
Título de ficha: `razon_social || contacto_nombre`.

## 6. Asignados (solo B2B)
Multiselect cerrado con las 4 personas. Sin default. Chip "Sin asignar" cuando vacío. Filtro por persona en `/b2b`.

## 7. Pedidos
- En `pedidos.index.tsx` renombro la sub-pestaña "Alejandra Blanc" → "B2B".
- El filtro actual (probablemente por `lead_id` o `cliente_nombre_libre` de Alejandra) se mantiene: los pedidos existentes de Alejandra siguen apareciendo tal cual porque cumplen ese filtro. **Nuevo criterio de la pestaña B2B**: `empresa_id IS NOT NULL` OR (filtro actual de Alejandra).
- Botón "Nuevo pedido B2B" con desplegable de empresas (`leads WHERE tipo='B2B'`). Guarda `empresa_id`.
- Resto de pestañas y esquema de pedidos intactos.

## 8. UX
- Confirmación antes de borrar (ya existe en DeleteLeadButton, se reutiliza).
- Estados vacíos: "Aún no hay empresas B2B" con CTA a `/b2b/nuevo`.
- Colores/badges consistentes con el resto.

## Ficheros a tocar
Migración + estos ficheros de código:
- `src/lib/types.ts` — añadir `TipoLead`, `ETAPAS_B2B`, `ASIGNADOS_B2B`, campos B2B en interface Lead.
- `src/lib/store.ts` — mapear nuevas columnas en `leadFromRow`/`leadToRow`.
- `src/integrations/supabase/types.ts` — se regenera solo tras la migración.
- `src/components/AppLayout.tsx` — labels y nav B2B.
- `src/routes/clientes.index.tsx` — filtro por tipo (default B2C).
- `src/routes/clientes.$id.tsx` — bloques condicionales B2B (empresa, asignados).
- `src/routes/pipeline.tsx` — etapas según tipo.
- `src/routes/api/public/lead-form.ts` — forzar `tipo='B2C'`.
- Nuevos: `src/routes/b2b.index.tsx`, `src/routes/b2b.nuevo.tsx`, `src/routes/pipeline-b2b.tsx` (wrappers finos).
- `src/routes/pedidos.index.tsx` — renombrar pestaña, añadir criterio empresa_id, alta con desplegable.

## Qué NO cambia
- Datos existentes: todos los leads actuales quedan como B2C automáticamente.
- Pedidos de Alejandra: intactos, siguen apareciendo en la pestaña (ahora llamada B2B).
- Formulario web público: mismo flujo, solo se marca tipo='B2C'.
- Etapas B2C, pipeline B2C, ficha, notas, buscador: sin cambios funcionales.

¿Le doy caña con la migración primero? Cuando la apruebes ejecuto el código.