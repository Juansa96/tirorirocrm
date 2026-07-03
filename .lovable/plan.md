## Resumen de cambios — Pipeline B2B (filtros + ordenación)

Sin tocar B2C, sin duplicar registros, sin romper el drag-and-drop.

### 1. Modelo de datos (migración mínima, no destructiva)

- Añadir columna opcional `provincia TEXT` a la tabla `leads` (nullable, sin default, sin borrar nada). Reutiliza `ciudad` existente como "municipio".
- Actualizar `src/lib/types.ts` → `Lead.provincia: string` (default `""`) y mapear en `src/lib/store.ts`.
- No se rellenan municipios/provincias existentes: los que estén vacíos se agrupan como "Sin municipio" / "Sin provincia".

### 2. Ficha del cliente (`src/routes/clientes.$id.tsx`)

- Campo `ciudad` ya es editable → lo etiquetamos como "Municipio" en la vista B2B.
- Añadir campo editable `provincia` en la ficha (solo cuando `tipo === "B2B"`, para no ensuciar B2C).

### 3. Pipeline B2B (`src/routes/pipeline.tsx`, sub-tab B2B)

Barra de filtros nueva encima del Kanban B2B (no aparece en B2C):

- Select **Municipio** — opciones dinámicas desde los leads B2B, orden alfabético, entrada final "Sin municipio".
- Select **Provincia** — igual, dinámico.
- Input **Buscar** — filtra por `razonSocial`/`contactoNombre` y por `ciudad` (case + acentos insensibles).
- Select **Ordenar por**: Fecha ↓ (default), Fecha ↑, Municipio A-Z / Z-A, Nombre A-Z / Z-A. Comparación con `localeCompare("es", { sensitivity: "base" })`.
- Botón **Limpiar filtros**.

Comportamiento:

- Filtros combinables (AND).
- Estado persistido en los **search params de la ruta** (`?tab=b2b&municipio=...&provincia=...&q=...&sort=...`), así sobreviven al drag-and-drop, refrescos y navegación interna, y no afectan al sub-tab B2C.
- Filtrado/ordenación **client-side** sobre los datos ya cargados (volumen actual ~14 registros).
- Los leads sin municipio siguen apareciendo (agrupados al final por el orden) salvo que se filtre explícitamente por un municipio concreto.

### 4. Fuera de alcance

- B2C intacto (columnas, filtros por vendedor y `PaidBadge` no cambian).
- Sin cambios en pedidos, notas, pipeline de particulares ni rutas B2B standalone.

Antes de aplicar la migración (solo `ALTER TABLE leads ADD COLUMN provincia TEXT`) te la muestro para aprobar. ¿Sigo?
