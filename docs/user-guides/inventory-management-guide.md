# Guía de Gestión de Inventario

## Visión General

El módulo de **Gestión de Inventario** es fundamental para el éxito de Almaia RD. Aquí es donde se controla el stock de productos, se registran los movimientos de entrada y salida, y se asegura que nunca haya niveles negativos de inventario.

## Para Qué Sirve

- **Controlar stock** de todos los productos en tiempo real
- **Registrar movimientos** de inventario (compras, ventas, ajustes)
- **Evitar inventario negativo** con alertas automáticas
- **Calcular costo promedio** de los productos
- **Generar reportes de inventario** y análisis

## Requisitos Previos

Antes de gestionar inventario, asegúrate de:

1. **Tener productos creados** en el catálogo
2. **Conocer las categorías** de productos
3. **Configurar preferencias de inventario** (unidad de medida, etc.)

## Flujo de Trabajo: Cómo Gestionar Inventario

### Paso 1: Acceder al Módulo

1. Haz clic en **"Inventario"** en el menú principal
2. La página mostrará una lista de productos con su stock actual
3. Haz clic en el botón **"Nuevo Producto"** (ubicado en la esquina superior derecha)

### Paso 2: Ver Stock Actual

#### Página Principal de Inventario
La página principal muestra una tabla con:

| Producto | Stock | Precio Unitario | Valor Total | Categoría | Estado |
|----------|-------|----------------|-------------|----------|--------|
| Producto 1 | 50 | $100 | $5,000 | Electrónica | ✅ Normal |
| Producto 2 | 0 | $200 | $0 | Ropa | ⚠️ Sin stock |
| Producto 3 | 5 | $50 | $250 | Hogar | ⚠️ Bajo stock |

#### Filtros de Búsqueda
1. **Buscar producto:** Escribe el nombre o código
2. **Filtrar por categoría:** Selecciona de la lista
3. **Filtrar por estado:** Normal, Sin stock, Bajo stock, etc.

### 3. Agregar Nuevo Producto

#### Información Requerida
Completa la siguiente información obligatoria:

| Campo | Requerido | Tipo | Ejemplo |
|-------|----------|------|---------|
| **Nombre del producto** | Sí | Texto | "Smartphone X200" |
| **Código/SKU** | Sí | Texto | "SKU-12345" |
| **Precio de venta** | Sí | Número | "$299.99" |
| **Precio de costo** | Sí | Número | "$200.00" |
| **Stock inicial** | Sí | Número | "10" |
| **Categoría** | Sí | Selección | "Electrónica" |

#### Información Opcional
Completa la siguiente información adicional (si aplica):

- **Subcategoría:** Subcategoría específica
- **Unidad de medida:** Unidad de medida (Unidad, Paquete, etc.)
- **Stock mínimo:** Cantidad mínima permitida
- **Fecha de vencimiento:** Fecha de vencimiento (si aplica)
- **Notas:** Información adicional relevante

#### Proceso de Creación

1. **Completar el formulario:** Llena todos los campos requeridos
2. **Seleccionar categoría:** Elige de la lista desplegable
3. **Ingresar stock:** Introduce el stock inicial
4. **Guardar:** Haz clic en **"Guardar Producto"**
5. **Confirmar:** El sistema muestra un mensaje de confirmación

#### Resultado

El producto se crea y aparece inmediatamente en la lista de inventario. Puedes:

- **Ver detalles:** Haz clic en el producto para ver su información completa
- **Editar:** Modificar la información si es necesario
- **Ajustar stock:** Ajustar el stock inmediatamente
- **Ver historial:** Ver todos los movimientos del producto

### 4. Ajustar Stock

#### Cuándo Ajustar
- **Compra:** Nuevo stock recibido
- **Venta:** Productos vendidos
- **Pérdida:** Productos dañados o perdidos
- **Ajuste:** Corrección de inventario
- **Transferencia:** Movimiento entre ubicaciones

#### Cómo Ajustar Stock

1. **Navegar a la lista:** Ve a **Inventario** → **Lista de Productos**
2. **Seleccionar producto:** Haz clic en el producto de la lista
3. **Hacer clic en "Ajustar Stock"**: Botón en la página de detalles
4. **Seleccionar tipo de movimiento:**
   - **Entrada:** Productos recibidos
   - **Salida:** Productos vendidos
   - **Ajuste:** Corrección de inventario
   - **Transferencia:** Movimiento entre ubicaciones
5. **Ingresar nueva cantidad:** Nueva cantidad en stock
6. **Seleccionar motivo:** Ejemplo: "Compra de proveedor"
7. **Agregar notas:** Información adicional (opcional)
8. **Guardar:** El stock se actualiza y se registra el movimiento

#### Validaciones
El sistema valida automáticamente:
- ✅ **Cantidad positiva:** Para entradas
- ✅ **Cantidad no negativa:** Para salidas
- ✅ **Stock mínimo:** Si se excede, se genera alerta
- ✅ **Motivo seleccionado:** Campo requerido

### 5. Ver Historial de Movimientos

#### Acceder al Historial

1. **Ir a la página del producto:** Haz clic en el producto de la lista
2. **Desplazarse hacia abajo:** Hasta la sección **Historial de Movimientos**
3. **Ver lista:** El sistema muestra todos los movimientos

#### Información del Historial
Cada movimiento muestra:

| Campo | Información |
|-------|-------------|
| **Fecha** | Fecha y hora del movimiento |
| **Tipo** | Entrada, Salida, Ajuste, Transferencia |
| **Cantidad** | Cantidad movida |
| **Motivo** | Razón del movimiento |
| **Referencia** | Número de factura, compra, etc. |
| **Usuario** | Quien realizó el movimiento |
| **Notas** | Información adicional (si aplica) |

### 6. Editar un Producto

#### Cuándo Editar
- Información cambiada (nuevo precio, categoría)
- Unidad de medida actualizada
- Se necesita ajustar el stock mínimo
- Corregir errores en los datos

#### Cómo Editar

1. **Navegar a la lista:** Ve a **Inventario** → **Lista de Productos**
2. **Seleccionar producto:** Haz clic en el producto de la lista
3. **Hacer clic en "Editar"**: Botón de lápiz en la página de detalles
4. **Realizar cambios:** Modifica la información necesaria
5. **Guardar cambios:** Haz clic en **"Actualizar"**

#### Validaciones
El sistema valida automáticamente:
- ✅ **Nombre del producto:** Mínimo 2 palabras
- ✅ **Precio de venta:** Número positivo
- ✅ **Precio de costo:** Número positivo
- ✅ **Stock mínimo:** Número positivo (si se proporciona)

### 7. Eliminar un Producto

#### Restricciones de Eliminación
**No puedes eliminar un producto si:**
- Tiene stock actual
- Tiene movimientos históricos
- Está asociado a facturas
- Está asociado a compras

#### Cómo Eliminar

1. **Encontrar producto:** Busca el producto en la lista
2. **Hacer clic en "Eliminar"**: Botón de basura en la página de detalles
3. **Confirmar eliminación:** El sistema muestra una advertencia
4. **Finalizar:** Haz clic en **"Eliminar"** para confirmar

**Importante:** Si necesitas eliminar un producto con stock, primero ajusta el stock a 0.

## Características Avanzadas

### 1. Alertas de Stock Bajo

#### Configurar Alertas

1. **Ir a **"Configuración"** → **Alertas de Inventario**
2. **Seleccionar productos:** Elegir productos específicos
3. **Configurar umbrales:**
   - **Sin stock:** 0 unidades
   - **Bajo stock:** 1-5 unidades
   - **Stock normal:** 6-50 unidades
   - **Alto stock:** > 50 unidades
4. **Guardar:** Las alertas están activadas

#### Ver Alertas

1. **Ir a **"Inventario"** → **Alertas**
2. **Ver lista:** El sistema muestra productos con stock bajo
3. **Tomar acción:** Ajustar stock o reorder

### 2. Cálculo de Costo Promedio

#### Cómo Funciona
El sistema calcula automáticamente el costo promedio:

**Fórmula:** `(Costo anterior × Stock anterior + Costo nuevo × Cantidad nueva) / Stock total`

#### Ver Costo Promedio

1. **Ir a la página del producto:** Haz clic en el producto
2. **Desplazarse hacia abajo:** Hasta la sección **Costo Promedio**
3. **Ver información:**
   - **Costo promedio actual**
   - **Costo de última entrada**
   - **Costo de última salida**
   - **Historial de costos**

### 3. Exportar Datos de Inventario

#### Exportar a CSV

1. **Hacer clic en **"Exportar"**
2. **Seleccionar formato:** CSV (Excel)
3. **Elegir campos:**
   - Información básica: Nombre, código, precio
   - Información adicional: Categoría, stock mínimo
   - Movimientos: Última entrada, última salida
4. **Descargar:** El archivo se descarga automáticamente

#### Exportar a PDF

1. **Hacer clic en **"Exportar PDF"**
2. **Seleccionar formato:** Reporte de inventario
3. **Personalizar:**
   - **Título:** "Reporte de Inventario"
   - **Fecha:** Incluir fecha de exportación
   - **Campos:** Información a incluir
4. **Generar:** El PDF se crea y descarga

### 4. Importar Datos Masivamente

#### Importar Productos

1. **Ir a **"Inventario"** → **Importar**
2. **Descargar plantilla:** CSV con estructura correcta
3. **Llenar archivo:** Agregar datos de productos
4. **Subir archivo:** Seleccionar CSV
5. **Mapear campos:** Asignar columnas a campos del sistema
6. **Validar:** Verificar datos antes de importar
7. **Importar:** Procesar archivo

#### Plantilla CSV
```csv
Nombre del producto,Código/SKU,Precio de venta,Precio de costo,Stock inicial,Categoría,Subcategoría,Unidad de medida,Stock mínimo
Smartphone X200,SKU-12345,$299.99,$200.00,10,Electrónica,Teléfonos Móviles,Unidad,5
Laptop Pro,SKU-67890,$999.99,$700.00,5,Electrónica,Portátiles,Unidad,2
```

## Solución de Problemas

### Problemas Comunes y Soluciones

#### 1. "Producto ya existe"
**Causa:** El producto ya está registrado en el sistema
**Solución:** Buscar en la lista de productos o usar la función "Encontrar duplicados"

#### 2. "Stock negativo no permitido"
**Causa:** Intento de vender más de lo disponible
**Solución:** Verificar el stock disponible o ajustar el stock mínimo

#### 3. "Categoría no encontrada"
**Causa:** La categoría no existe en el sistema
**Solución:** Crear la categoría primero o seleccionar una existente

#### 4. "No puedo eliminar producto"
**Causa:** El producto tiene stock o movimientos
**Solución:** Ajustar el stock a 0 o contactar soporte técnico

## Preguntas Frecuentes

### Q: ¿Cómo veo productos sin stock?
**R:** Filtra por "Estado: Sin stock" en los filtros.

### Q: ¿Cómo configuro alertas de stock bajo?
**R:** Ve a **Configuración** → **Alertas de Inventario** y configura los umbrales.

### Q: ¿Puedo importar productos desde Excel?
**R:** Sí, usa la función de importación masiva.

### Q: ¿Cómo veo el costo promedio de un producto?
**R:** Ve a la página del producto y desplázate hasta la sección "Costo Promedio".

## Atajos de Teclado

| Atajo | Acción |
|-------|--------|
| `I` | Nuevo producto |
| `F` | Buscar producto |
| `E` | Editar producto |
| `D` | Eliminar producto |
| `X` | Exportar inventario |
| `I` | Importar inventario |
| `S` | Guardar cambios |
| `A` | Ver alertas |

## Referencias Útiles

### 1. Códigos de Error

| Código | Descripción |
|--------|-------------|
| `400` | Solicitud inválida (datos faltantes) |
| `401` | No autorizado (token inválido) |
| `404` | Producto no encontrado |
| `409` | Conflicto (código ya existe) |
| `500` | Error interno del servidor |

### 2. Campos Requeridos

- **nombre:** Nombre completo del producto
- **código:** Código único del producto
- **precio_venta:** Precio de venta (número positivo)
- **precio_costo:** Precio de costo (número positivo)
- **stock_inicial:** Stock inicial (número no negativo)
- **categoría:** Categoría del producto

### 3. Códigos de Estado

- **ACTIVO:** Producto activo en el sistema
- **INACTIVO:** Producto inactivo temporalmente
- **AGOTADO:** Producto sin stock
- **BAJO_STOCK:** Producto con stock bajo
- **ALTO_STOCK:** Producto con stock alto

## Mantenimiento y Soporte

### 1. Respaldos de Datos

#### Respaldar Inventario
1. Ve a **Configuración** → **Respaldos**
2. Selecciona **Inventario**
3. Elige el formato: CSV, Excel, JSON
4. Haz clic en **"Descargar Backup"**

#### Restaurar Inventario
1. Ve a **Configuración** → **Respaldos**
2. Haz clic en **"Subir Backup"**
3. Selecciona el archivo de backup
4. Sigue las instrucciones del sistema

### 2. Monitoreo de Rendimiento

#### Métricas Clave
- **Tiempo de respuesta:** < 2 segundos
- **Tasa de éxito:** > 99%
- **Productos por hora:** Promedio de transacciones
- **Errores por día:** Conteo de errores

#### Alertas
- **Error 500:** Notificación inmediata
- **Tiempo de respuesta > 5s:** Alerta diaria
- **Stock bajo:** Alerta inmediata

### 3. Actualizaciones

#### Actualizaciones Menores
- **Nuevas características:** Cada 2 semanas
- **Corrección de bugs:** Según sea necesario
- **Mejoras de rendimiento:** Mensual

#### Actualizaciones Mayores
- **Nueva versión principal:** Cada 6 meses
- **Cambio de esquema:** Requiere migración manual
- **API breaking:** Documentación completa

## Contacto y Soporte Técnico

### ¿Necesitas Ayuda?

#### Canales de Soporte
1. **Email:** `soporte@almaia-rd.vercel.app`
2. **Teléfono:** +1-809-555-0123 (Lunes a Viernes, 9AM - 5PM)
3. **Chat en vivo:** Icono de chat en la esquina inferior derecha

#### Información Requerida
Cuando contactes soporte, por favor incluye:
- Tu nombre y email
- ID del producto (si aplica)
- Descripción del problema
- Pasos que ya intentaste
- Captura de pantalla (si es posible)

### Horario de Soporte
- **Soporte técnico:** 24/7 para problemas críticos
- **Asistencia estándar:** Lunes a Viernes, 9AM - 5PM (EST)
- **Tiempo de respuesta:**
  - Crítico: < 1 hora
  - Estándar: < 4 horas
  - No crítico: < 24 horas

## Anexos

### A. Formatos de Archivo

#### Formatos Aceptados
- **CSV:** Separado por comas, UTF-8
- **Excel:** .xlsx, .xls
- **JSON:** .json

#### Especificaciones
- **Tamaño máximo:** 10MB por archivo
- **Carácteres permitidos:** UTF-8
- **Separadores:** Coma para CSV

### B. Códigos de Error Detallados

#### Errores de Validación
```
"nombre": "Nombre del producto requerido"
"codigo": "Código del producto requerido"
"precio_venta": "Precio de venta inválido"
"precio_costo": "Precio de costo inválido"
"stock_inicial": "Stock inicial inválido"
"categoria": "Categoría requerida"
```

#### Errores de Negocio
```
"codigo_duplicado": "Ya existe un producto con este código"
"stock_negativo": "No se permite stock negativo"
"categoria_invalida": "La categoría no existe"
"producto_con_facturas": "No se puede eliminar producto con facturas asociadas"
```

### C. Ejemplos de API

#### Ejemplo 1: Listar Productos
```bash
curl -X GET "https://almaia-rd.vercel.app/api/inventario?page=1&limit=10&search=smartphone" \
  -H "Authorization: Bearer tu-token-aqui"
```

#### Ejemplo 2: Crear Producto
```bash
curl -X POST "https://almaia-rd.vercel.app/api/inventario" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer tu-token-aqui" \
  -d '{
    "nombre": "Smartphone X200",
    "codigo": "SKU-12345",
    "precio_venta": 299.99,
    "precio_costo": 200.00,
    "stock_inicial": 10,
    "categoria": "Electrónica",
    "subcategoria": "Teléfonos Móviles",
    "unidad_medida": "Unidad",
    "stock_minimo": 5
  }'
```

#### Ejemplo 3: Actualizar Producto
```bash
curl -X PUT "https://almaia-rd.vercel.app/api/inventario/123e4567-e89b-12d3-a456-426614174000" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer tu-token-aqui" \
  -d '{
    "precio_venta": 299.99,
    "precio_costo": 200.00,
    "stock_inicial": 15,
    "stock_minimo": 5
  }'
```

#### Ejemplo 4: Eliminar Producto
```bash
curl -X DELETE "https://almaia-rd.vercel.app/api/inventario/123e4567-e89b-12d3-a456-426614174000" \
  -H "Authorization: Bearer tu-token-aqui"
```

## Agradecimientos

Desarrollado con ❤️ para la comunidad empresarial de República Dominicana.

**© 2024-2025 Almaia RD - Todos los derechos reservados**

---
*Si tienes alguna pregunta o necesitas ayuda, no dudes en contactarnos. Estamos aquí para ayudarte a tener éxito con Almaia RD!*