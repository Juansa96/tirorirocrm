Voy a agrupar los cambios por área. Antes de tocar datos (punto 3) te mostraré exactamente qué filas voy a borrar/actualizar.

## 1. Vendedor por defecto = Rocío
- `src/routes/api/public/lead-form.ts`: eliminar `randomVendedor()` y forzar `vendedor = "rocionavarreteurdiales98@gmail.com"`.
- El selector de vendedor en la ficha del lead sigue igual → editable manualmente.

## 2. Dashboard

### 2.1 Nuevo campo "cobrado" en leads
Migración: añadir a `leads`:
- `cobrado boolean not null default false`
- `fecha_cobro date null`

Se rellena solo cuando `etapa = 'Closed Won'`. Se ignora en el resto de etapas.
Tras la migración, todos los Closed Won existentes quedarán como "pendiente de cobro" hasta que los marques.

### 2.2 KPIs superiores (rediseño)
Reemplazar las 4 tarjetas por:

1. **Total Leads (activos)** — grande: leads que no están en `Closed Lost` ni en `Closed Won cobrado`. Pequeño a la derecha: total histórico (todos los estados, incluido Closed Lost).
2. **Valor Pipeline** (se queda).
3. **Ganado — Pendiente de cobro** — suma de `valor` de Closed Won con `cobrado = false`.
4. **Ganado — Ya cobrado** — suma de `valor` de Closed Won con `cobrado = true`.

Quito "Tasa de conversión" para dejar sitio (ya está en 4 columnas). Si prefieres mantenerla en una 5ª, dímelo.

### 2.3 Pipeline visual (gráfico + columna Closed Won)
- Gráfico de barras se queda como está (una barra por etapa).
- En la vista de columna Closed Won del pipeline (`src/routes/pipeline.tsx`), cada tarjeta de lead muestra un badge:
  - `Pagado` (verde) si `cobrado = true`
  - `Pendiente de cobro` (ámbar) si `cobrado = false`
- Toggle "Cobrado" + fecha en la ficha del lead (`clientes.$id.tsx`), solo visible cuando `etapa = Closed Won`.

### 2.4 Widget "Tareas Pendientes"
Filtrar `tareasPendientes` para excluir tareas cuyo lead esté en `Closed Won` u `On Hold`. Las tareas siguen intactas en la ficha del lead.

### 2.5 Rendimiento por vendedor
Recalcular sumando solo leads con `etapa = 'Closed Won'` (cobrados y no cobrados). Hoy suma todo → lo cambio.

## 3. Limpieza de duplicados (con confirmación previa)

He verificado en BD y estos son los productos a **borrar** (todos ya marcados `[posible-duplicado]` o son claros duplicados de importación Excel):

**Diego** (vendedora Rocío) — 1 borrar:
- `de2a1387` Conta 190×120, 445€, sin tela, `[mig-excel-v1] [posible-duplicado]` → borrar. Se queda `3eedfd01` (Conta 190×120 445€ "Rayas Espiga verde").

**Cris Sanz** — 4 borrar:
- `a25c67f3` Pregonda 140×80 346€ mig-dup → borrar (queda `d06f9661` real con tela).
- `6553fdbd` Almohadón 30×50 40€ mig-dup → borrar.
- `a1acc058` Almohadón 40×60 50€ mig-dup → borrar.
- `51c71562` Almohadón 30×50 40€ mig → borrar (equivalente a los reales `4985dc45` 50x30cm cant=2 y `2e24d952` 60x40cm cant=2).
- `c5d83cf7` Almohadón 40×60 50€ mig → borrar.
- Queda: Pregonda cabecero, Mesa personalizada (0€), Almohadón 50x30 x2 (40€), Almohadón 60x40 x2 (50€).

**Alicia Mascort** — 4 borrar:
- `cd3ae1b9` Macarella 100×100 242,5€ mig-dup → borrar.
- `fbb0d477` Macarella 100×100 242,5€ mig-dup → borrar.
- `c014987c` Cubrecanapé liso 90×190 50€ mig-dup → borrar.
- `e82e9595` Cubrecanapé liso 90×190 50€ mig → borrar.
- Queda: Macarella 100×100 cant=2 (242,5€), Cubrecanapés cant=2 (50€).

Antes de borrar comprobaré para cada fila que **no tenga `pedidos` enlazados**; si los tuviera, re-apunto el pedido a la fila que se queda (política ya usada en la limpieza anterior).

Revisión general: escanearé el resto de leads con productos marcados `[posible-duplicado]` y te enseñaré la lista antes de tocar nada más.

Los totales del lead (`valor_producto`, `valor`) se recalculan automáticamente por el trigger `tg_productos_lead_recalc` — no hay que tocarlos a mano.

## 4. Filtro por etapa en Clientes
En `src/routes/clientes.index.tsx`: añadir chips (Todas / Discovery / Primer Contacto / Negotiation / On Hold / Closed Won / Closed Lost) que filtran el listado. Combinable con el filtro de vendedor existente.

## 5. Banco Oyambre

Insertar en `catalogo_productos`:
- Tipo: `Banco`, modelo: `Oyambre`, activo, precio_desde: 200.

Añadir mapping en `src/lib/types.ts`:
- `CATALOG_TO_INTERNAL["Banco"] = "banco"`, `INTERNAL_TO_CATALOG["banco"] = "Banco"`.

En `src/components/ProductoForm.tsx`, añadir bloque `f.tipo === "banco"` con:
- Selector de medida (radio/select):
  - 60 cm → 200€
  - 60 cm doble → 370€
  - 90 cm → 250€
  - 120 cm → 300€
  - 150 cm → 350€
  - Mis medidas → 0€ + nota "A consultar"
- Alto 45 y fondo 33 fijos (guardados en `notas_producto`, no editables).
- Selector de tela (reutiliza el patrón de cabecero) para asiento/lateral/vivo.
- `precio_unitario` se autorellena con la tabla de arriba.

En `src/lib/product-schema.ts` (formulario web público): actualizar `BANCO_VARIANTES` para reflejar Oyambre con las 6 opciones y el precio fijo. No aplicar fórmulas por cm.

## Orden de ejecución

1. Migración: campo `cobrado` + fila catálogo `Banco Oyambre` (una sola migración).
2. Código: puntos 1, 2, 4, 5 en paralelo.
3. Punto 3: te enseño la lista final de duplicados detectados en toda la base y **espero tu OK explícito** antes de ejecutar los DELETE.

## Notas
- No toco la estructura de leads más allá de las dos columnas nuevas.
- Todos los Closed Won existentes tendrán `cobrado = false` inicialmente → tendrás que marcar manualmente los que ya cobraste.
- La lógica de "Total Leads activos" excluye Closed Won cobrado; los pendientes de cobro sí cuentan como activos (tienes trabajo pendiente con ellos).

¿Le doy caña?
