# Guía de Catálogo y Bundles

## Visión General

El módulo **Catálogo** (`/catalogo`) administra los productos Amway: submarcas, categorías, precios (30% y 35%), costo, PV, imagen y duración estimada. También permite crear **bundles** (combos de varios productos a un precio especial).

## Acceso

Menú principal → **Catálogo** (`/catalogo`)

## Pestaña Productos

### Vista Principal
Cuadrícula de productos con búsqueda por nombre/código y filtros por **submarca**, **categoría** y **archivados**.

| Filtro | Descripción |
|--------|-------------|
| Submarca | Filtra por marca (Nutrilite, Amway Home, Artistry, etc.) |
| Categoría | Filtra por categoría |
| Solo bundles | Muestra únicamente los combos (los bundles NO se agregan como componentes de otro bundle) |
| Ver archivados | Muestra productos descontinuados |

### Precios
Cada producto tiene:
- **Costo** (lo que cuesta adquirirlo)
- **Precio 30%** = costo × 1.30 (margen sugerido estándar)
- **Precio 35%** = costo × 1.35 (margen sugerido recomendado)
- **PV** (Puntos de Volumen)
- **ITBIS:** toggle por producto (si aplica 18% sobre el costo)

### Acciones
- **Editar:** modificar precio, costo, descripción, imagen, duración
- **Archivar/Restaurar:** descontinuar visualmente el producto
- **Eliminar:** solo si no tiene movimientos asociados
- **Imagen:** se admite hasta **5MB**; al eliminar el producto, la imagen se borra del storage

## Bundles (Combos)

### Qué es un Bundle
Es un conjunto de productos que se vende como una sola línea a un **precio especial**, con un código y nombre propios (ej: "Kit de Bienestar"). El bundle no tiene inventario propio: al facturarlo se descuenta el stock de sus **componentes**.

### Crear un Bundle
1. Click en **"Nuevo Bundle"** (en la sección de bundles del catálogo).
2. Llena:
   - **Código:** ej. `BUN-001`
   - **Nombre:** ej. "Kit de Bienestar"
   - **Precio especial (RD$):** precio único que se aplica a ambos márgenes
3. **Buscar productos del catálogo** y agrégalos al bundle. Solo se permiten productos normales (no bundles anidados). Si agregas el mismo producto dos veces, la cantidad se incrementa.
4. Ajusta la **cantidad** de cada componente y elimina los que sobren.
5. El sistema muestra en vivo:
   - **Costo total** y **PV total** del combo
   - **Sugerido 30% con ITBIS** y **Sugerido 35% con ITBIS** (precio recomendado ya incluyendo el ITBIS de 18% sobre el costo, redondeado al múltiplo de 50 superior)
   - **Ganancia:** precio especial − costo total
6. Fija el precio:
   - Botones **"Poner 30%"** / **"Poner 35%"**: aplican el precio sugerido correspondiente
   - Botón **"Recalcular sugeridos"**: recalcula los sugeridos desde los componentes actuales y fija el precio al 35% (con confirmación)
7. Sube una **imagen** (máx. 5MB) si deseas.
8. Click en **"Guardar Bundle"**.

### Vista Previa
Al crear/editar un bundle, el sistema muestra una **vista previa en vivo**: imagen, nombre, código, número de productos, unidades totales, precio especial, costo y resumen de componentes.

### Duplicar un Bundle
1. En la tarjeta del bundle, click en el ícono **Duplicar** (dos cuadrados superpuestos).
2. El sistema abre el modal con el código `XXX-COPIA`, el nombre "(Copia)" y los mismos componentes.
3. Ajusta lo necesario y guarda.

### Editar / Eliminar
- **Editar:** abrir el modal del bundle y modificar componentes, precio o imagen.
- **Eliminar:** el bundle se borra con sus componentes (la imagen del storage también se elimina).

## Notas Importantes

- El **precio especial** del bundle se guarda en `price_30` y `price_35` con el mismo valor, por lo que se aplica sin importar el margen configurado.
- El **ITBIS** del bundle siempre aplica (18% sobre el costo total de los componentes).
- Los bundles **no pueden contener otros bundles**.
- Los bundles **sí se pueden facturar**: ver "Facturar Bundles" en la Guía de Facturación.

---

*© 2024-2026 Almaia RD*
