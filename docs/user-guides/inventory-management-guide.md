# Guía de Gestión de Inventario

## Visión General

El módulo de Inventario controla el stock de productos, registra movimientos de entrada/salida y analiza la rotación para optimizar las compras y evitar desabastecimientos.

## Acceso

Menú principal → **Inventario** (`/inventario`)

## Pestaña Stock

### Vista Principal
Tabla con todos los productos que tienen inventario registrado:

| Columna | Descripción |
|---------|-------------|
| Producto | Nombre + submarca + código |
| Stock | Cantidad actual disponible |
| Stock Mín. | Mínimo configurado (editable desde el modal de detalle) |
| Capital | Stock × costo promedio |
| Submarca | Filtro por submarca |
| Estado | Indicador visual de nivel de stock |

### Acciones por Producto
- **Ver detalle:** Click en la fila → modal con información completa, historial de movimientos, capital invertido
- **Editar stock mínimo:** Campo editable en el modal
- **Ocultar:** Archiva visualmente el producto (sin eliminarlo). Los ocultos se guardan en `localStorage`
- **Mostrar:** Con el toggle "Ver ocultos (N)" activado, los productos ocultos aparecen con botón "Mostrar"
- **Eliminar:** Solo si no tiene movimientos asociados. Si los tiene, aparece opción **"Forzar eliminación"** que borra inventario + movimientos + referencias en facturas/compras

### Capital Inmovilizado
Panel informativo que muestra el capital total en productos con más de 30, 60 y 90 días sin movimiento.

## Pestaña Rotación

### KPIs (tarjetas superiores)
| KPI | Descripción |
|-----|-------------|
| **Total Productos** | Cantidad de productos en inventario |
| **Rotación Alta** | < 15 días en inventario |
| **Rotación Media** | 15-60 días |
| **Rotación Baja** | > 60 días |
| **Próximos a agotarse** | Stock estimado < 30 días de duración |
| **Capital >90d** | Total inmovilizado en productos sin rotación |

### Tabla de Rotación

Cada fila incluye:

| Columna | Descripción |
|---------|-------------|
| Producto | Nombre + código |
| Stock | Cantidad actual |
| Vendido | Unidades vendidas (histórico total) |
| Comprado | Unidades compradas (histórico total) |
| Primer Venta | Fecha de la primera venta |
| Velocidad (días) | `díasDesdePrimeraCompra / unidadesVendidas` — días que tarda en venderse 1 unidad |
| Proy. Agot. | `velocidadDias × stock` — días estimados hasta agotar stock. **Color:** rojo <30d, amarillo <60d, verde ≥60d |
| Días en Inv. | Días desde la primera compra |
| Estado | Bueno / Agotado / Próximo a agotar / Sin movimientos |

### Filtros
- **Submarca:** Filtra por submarca específica
- **Rango de días:** Mínimo y máximo de días en inventario
- **Estado:** Bueno, Agotado, Próximo a agotar, Sin movimientos

### Acciones
- **Ocultar/Mostrar:** Ícono de ojo por fila. Los ocultos tienen localStorage separado de la pestaña Stock
- **Ver detalle:** Click en fila → modal con resumen, gráfico de timeline (primer última compra/venta), lista de movimientos

### Exportar
- **PDF:** Descarga la tabla actual con filtros aplicados
- **CSV:** Exporta datos a formato compatible con Excel

### Recomendaciones Automáticas
Panel que analiza los datos y sugiere:
- **Liquidar:** Productos con >90 días sin movimiento
- **Reponer:** Productos próximos a agotarse (<30 días de stock)

### Análisis IA
Botón que envía un resumen de rotación a Ollama y devuelve recomendaciones estratégicas en lenguaje natural. Si Ollama no responde, genera un análisis estructurado localmente.

## Gestión de Productos

### Crear Producto
Desde Catálogo (`/catalogo`): formulario con nombre, código, submarca, categoría, precios, stock inicial, **duración estimada** (7/15/30/60/90 días).

### Forzar Eliminación
Cuando un producto tiene movimientos asociados y no se puede eliminar normalmente:
1. Abrir modal de detalle del producto
2. Click en "Eliminar producto"
3. El sistema muestra el uso del producto (facturas, compras, movimientos)
4. Click en "Forzar eliminación" → confirma → elimina registros en cascada

### Ocultar vs Eliminar
| Acción | Efecto | Reversible |
|--------|--------|:----------:|
| Ocultar | Desaparece de la vista normal | Sí (toggle + botón Mostrar) |
| Eliminar | Borra permanentemente | No |

Los productos ocultos usan `localStorage` con claves separadas: `hiddenStockIds` para Stock, `hiddenRotationIds` para Rotación.

---

*© 2024-2026 Almaia RD*
