# Guía de Gestión de Compras

## Visión General

El módulo de **Gestión de Compras** es esencial para el funcionamiento de Almaia RD. Aquí es donde se registran las compras de productos, se gestionan los proveedores, y se controla el flujo de inventario desde el origen.

## Para Qué Sirve

- **Registrar compras** de productos de proveedores
- **Gestionar proveedores** y relaciones
- **Controlar costos** de adquisición
- **Integrar con inventario** (entrada de stock)
- **Generar reportes de compras** y análisis

## Requisitos Previos

Antes de gestionar compras, asegúrate de:

1. **Tener proveedores creados** en el sistema
2. **Conocer los productos** disponibles en el catálogo
3. **Configurar preferencias de compras** (prefijo, etc.)

## Flujo de Trabajo: Cómo Gestionar Compras

### Paso 1: Acceder al Módulo

1. Haz clic en **"Compras"** en el menú principal
2. La página mostrará una lista de compras existentes
3. Haz clic en el botón **"Nueva Compra"** (ubicado en la esquina superior derecha)

### 2. Ver Compras Existentes

#### Página Principal de Compras
La página principal muestra una tabla con:

| Fecha | Proveedor | Total | Estado | Factura | Items |
|-------|----------|-------|--------|---------|-------|
| 2024-01-15 | Proveedor A | $5,000 | Pagada | COMP-001 | 10 |
| 2024-01-16 | Proveedor B | $3,000 | Pendiente | COMP-002 | 15 |
| 2024-01-17 | Proveedor C | $2,500 | Aprobada | COMP-003 | 20 |

#### Filtros de Búsqueda
1. **Buscar compra:** Escribe el nombre del proveedor o número de factura
2. **Filtrar por proveedor:** Selecciona de la lista
3. **Filtrar por estado:** Pagada, Pendiente, Aprobada, Rechazada
4. **Filtrar por fecha:** Rango de fechas

### 3. Agregar Nueva Compra

#### Información Requerida
Completa la siguiente información obligatoria:

| Campo | Requerido | Tipo | Ejemplo |
|-------|----------|------|---------|
| **Fecha** | Sí | Fecha | "2024-01-15" |
| **Proveedor** | Sí | Selección | "Proveedor A", "Proveedor B" |
| **Total** | Sí | Número | "$5,000" |
| **Estado** | Sí | Selección | "Pagada", "Pendiente", "Aprobada" |
| **Número de factura** | Sí | Texto | "COMP-001" |

#### Información Opcional
Completa la siguiente información adicional (si aplica):

- **Fecha de pago:** Fecha real de pago
- **Método de pago:** Efectivo, Tarjeta, Transferencia, Crédito
- **Notas:** Información adicional relevante
- **Adjuntar:** Subir factura (PDF, JPG)

#### Proceso de Creación

1. **Completar el formulario:** Llena todos los campos requeridos
2. **Seleccionar proveedor:** Elige de la lista desplegable
3. **Ingresar total:** Introduce el monto total
4. **Seleccionar estado:** Elige el estado actual
5. **Guardar:** Haz clic en **"Guardar Compra"**
6. **Confirmar:** El sistema muestra un mensaje de confirmación

#### Resultado

La compra se crea y aparece inmediatamente en la lista de compras. Puedes:

- **Ver detalles:** Haz clic en la compra para ver su información completa
- **Editar:** Modificar la información si es necesario
- **Cambiar estado:** Actualizar el estado de pago
- **Ver factura:** Descargar el archivo adjunto

### 4. Editar una Compra

#### Cuándo Editar
- Información cambiada (nueva fecha, total)
- Proveedor actualizado
- Se necesita ajustar el estado de pago
- Corregir errores en los datos

#### Cómo Editar

1. **Navegar a la lista:** Ve a **Compras** → **Lista de Compras**
2. **Seleccionar compra:** Haz clic en la compra de la lista
3. **Hacer clic en "Editar"**: Botón de lápiz en la página de detalles
4. **Realizar cambios:** Modifica la información necesaria
5. **Guardar cambios:** Haz clic en **"Actualizar"**

#### Validaciones
El sistema valida automáticamente:
- ✅ **Fecha:** Fecha válida
- ✅ **Proveedor:** Seleccionado
- ✅ **Total:** Número positivo
- ✅ **Estado:** Seleccionado
- ✅ **Número de factura:** Mínimo 3 caracteres

### 5. Eliminar una Compra

#### Restricciones de Eliminación
**No puedes eliminar una compra si:**
- Tiene factura adjunta
- Está asociada a un proveedor
- Tiene items asociados
- Ha sido pagada

#### Cómo Eliminar

1. **Encontrar compra:** Busca la compra en la lista
2. **Hacer clic en "Eliminar"**: Botón de basura en la página de detalles
3. **Confirmar eliminación:** El sistema muestra una advertencia
4. **Finalizar:** Haz clic en **"Eliminar"** para confirmar

**Importante:** Si necesitas eliminar una compra con factura, contacta soporte técnico para una solución personalizada.

### 6. Buscar y Filtrar Compras

#### Buscar Compras

1. **Usar la barra de búsqueda:** Escribe el nombre del proveedor o número de factura
2. **Resultados instantáneos:** El sistema muestra coincidencias en tiempo real
3. **Seleccionar:** Haz clic en la compra de los resultados

#### Filtrar Compras

1. **Hacer clic en **"Filtros"** (botón de filtro)
2. **Seleccionar criterios:**
   - **Proveedor:** Seleccionar de la lista
   - **Estado:** Pagada, Pendiente, Aprobada, Rechazada
   - **Fecha:** Rango de fechas
3. **Aplicar filtros:** Haz clic en **"Aplicar"**
4. **Limpiar filtros:** Haz clic en **"Limpiar"** para ver todas las compras

### 7. Exportar Datos de Compras

#### Exportar a CSV

1. **Hacer clic en **"Exportar"**
2. **Seleccionar formato:** CSV (Excel)
3. **Elegir campos:**
   - Información básica: Fecha, proveedor, total
   - Información adicional: Estado, número de factura
   - Detalles: Items, fecha de pago
4. **Descargar:** El archivo se descarga automáticamente

#### Exportar a PDF

1. **Hacer clic en **"Exportar PDF"**
2. **Seleccionar formato:** Reporte de compras
3. **Personalizar:**
   - **Título:** "Reporte de Compras"
   - **Fecha:** Incluir fecha de exportación
   - **Campos:** Información a incluir
4. **Generar:** El PDF se crea y descarga

### 8. Importar Datos Masivamente

#### Importar Compras

1. **Ir a **"Compras"** → **Importar**
2. **Descargar plantilla:** CSV con estructura correcta
3. **Llenar archivo:** Agregar datos de compras
4. **Subir archivo:** Seleccionar CSV
5. **Mapear campos:** Asignar columnas a campos del sistema
6. **Validar:** Verificar datos antes de importar
7. **Importar:** Procesar archivo

#### Plantilla CSV
```csv
Fecha,Proveedor,Total,Estado,Número de factura,Fecha de pago,Método de pago,Notas
2024-01-15,Proveedor A,$5,000,Pagada,COMP-001,2024-01-15,Efectivo,Compra de inventario
2024-01-16,Proveedor B,$3,000,Pendiente,COMP-002,,Tarjeta,Compra de suministros
2024-01-17,Proveedor C,$2,500,Aprobada,COMP-003,2024-01-17,Transferencia,Compra de equipos
```

## Características Avanzadas

### 1. Aprobación de Compras

#### Flujo de Aprobación

1. **Crear compra:** Crear compra normal
2. **Enviar a aprobación:** Haz clic en **"Enviar a Aprobación"**
3. **Aprobador:** Gerente o administrador
4. **Aprobar/Rechazar:** Tomar decisión
5. **Actualizar estado:** El sistema actualiza el estado

#### Estados de Compras

- **Pendiente:** Creada, esperando aprobación
- **Aprobada:** Aprobada por el gerente
- **Rechazada:** Rechazada por el gerente
- **Pagada:** Pagada en efectivo/transferencia
- **Cancelada:** Eliminada por error

### 2. Gestión de Proveedores

#### Ver Proveedores

1. **Ir a **"Compras"** → **Proveedores**
2. **Ver lista:** El sistema muestra todos los proveedores
3. **Filtrar:** Buscar por nombre, categoría, etc.

#### Agregar Proveedor

1. **Hacer clic en **"Nuevo Proveedor"**
2. **Completar información:**
   - **Nombre:** Nombre del proveedor
   - **Contacto:** Persona de contacto
   - **Email:** Email de contacto
   - **Teléfono:** Teléfono de contacto
   - **Dirección:** Dirección del proveedor
   - **Categoría:** Categoría del proveedor
3. **Guardar:** El proveedor se crea

### 3. Integración con Inventario

#### Movimiento Automático de Inventario

Cuando se crea una compra:

1. **Se crea la compra:** Con los items y cantidades
2. **Se actualiza el inventario:** Se agrega el stock automáticamente
3. **Se registra el movimiento:** Se crea un movimiento de inventario
4. **Se actualiza el costo promedio:** Se calcula el nuevo costo promedio

#### Ver Movimientos de Inventario

1. **Ir a **"Inventario"** → **Movimientos**
2. **Filtrar por compra:** Mostrar solo movimientos de una compra
3. **Ver detalles:** Información completa del movimiento

### 4. Reportes de Compras

#### Reporte Mensual

1. **Ir a **"Reportes"** → **Compras**
2. **Seleccionar período:** Mes actual, mes anterior, rango personalizado
3. **Elegir formato:** PDF, Excel, CSV
4. **Generar:** El reporte se crea

#### Contenido del Reporte
- **Resumen del período:** Total de compras, cantidad de compras
- **Por proveedor:** Desglose por proveedor
- **Estado de pagos:** Pagados vs pendientes
- **Items comprados:** Desglose de productos
- **Costo promedio:** Análisis de costos

## Solución de Problemas

### Problemas Comunes y Soluciones

#### 1. "Proveedor no encontrado"
**Causa:** El proveedor no existe en el sistema
**Solución:** Crear el proveedor primero o seleccionar uno existente

#### 2. "Total inválido"
**Causa:** Formato de total incorrecto
**Solución:** Usar formato: "$5,000" o "5000"

#### 3. "Número de factura inválido"
**Causa:** Formato de factura incorrecto
**Solución:** Usar formato: "COMP-001", "FACT-002", etc.

#### 4. "No puedo eliminar compra"
**Causa:** La compra tiene factura o está aprobada
**Solución:** Contactar soporte técnico para eliminación segura

## Preguntas Frecuentes

### Q: ¿Cómo veo compras por proveedor?
**R:** Filtra por "Proveedor" en los filtros.

### Q: ¿Cómo configuro alertas de compras?
**R:** Ve a **Configuración** → **Alertas de Compras** y configura los límites.

### Q: ¿Puedo importar compras desde Excel?
**R:** Sí, usa la función de importación masiva.

### Q: ¿Cómo veo compras pendientes de aprobación?
**R:** Filtra por "Estado: Pendiente" en los filtros.

## Atajos de Teclado

| Atajo | Acción |
|-------|--------|
| `C` | Nueva compra |
| `F` | Buscar compra |
| `E` | Editar compra |
| `D` | Eliminar compra |
| `X` | Exportar compras |
| `I` | Importar compras |
| `S` | Guardar cambios |
| `A` | Ver alertas |

## Referencias Útiles

### 1. Códigos de Error

| Código | Descripción |
|--------|-------------|
| `400` | Solicitud inválida (datos faltantes) |
| `401` | No autorizado (token inválido) |
| `404` | Compra no encontrada |
| `409` | Conflicto (número de factura ya existe) |
| `500` | Error interno del servidor |

### 2. Campos Requeridos

- **fecha:** Fecha de la compra (YYYY-MM-DD)
- **proveedor:** Nombre del proveedor
- **total:** Total de la compra (número positivo)
- **estado:** Estado de la compra
- **numero_factura:** Número de factura

### 3. Códigos de Estado

- **PENDIENTE:** Compra creada, esperando aprobación
- **APROBADA:** Aprobada por el gerente
- **RECHAZADA:** Rechazada por el gerente
- **PAGADA:** Pagada en efectivo/transferencia
- **CANCELADA:** Eliminada por error

## Mantenimiento y Soporte

### 1. Respaldos de Datos

#### Respaldar Compras
1. Ve a **Configuración** → **Respaldos**
2. Selecciona **Compras**
3. Elige el formato: CSV, Excel, JSON
4. Haz clic en **"Descargar Backup"**

#### Restaurar Compras
1. Ve a **Configuración** → **Respaldos**
2. Haz clic en **"Subir Backup"**
3. Selecciona el archivo de backup
4. Sigue las instrucciones del sistema

### 2. Monitoreo de Rendimiento

#### Métricas Clave
- **Tiempo de respuesta:** < 2 segundos
- **Tasa de éxito:** > 99%
- **Compras por hora:** Promedio de transacciones
- **Errores por día:** Conteo de errores

#### Alertas
- **Error 500:** Notificación inmediata
- **Tiempo de respuesta > 5s:** Alerta diaria
- **Compra pendiente:** Alerta inmediata

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
- ID de la compra (si aplica)
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
- **PDF:** .pdf (para facturas)

#### Especificaciones
- **Tamaño máximo:** 10MB por archivo
- **Carácteres permitidos:** UTF-8
- **Separadores:** Coma para CSV

### B. Códigos de Error Detallados

#### Errores de Validación
```
"fecha": "Fecha requerida"
"proveedor": "Proveedor requerido"
"total": "Total inválido"
"estado": "Estado requerido"
"numero_factura": "Número de factura requerido"
```

#### Errores de Negocio
```
"proveedor_invalido": "El proveedor no existe"
"total_invalido": "El total debe ser positivo"
"numero_factura_invalido": "El número de factura no es válido"
"compra_aprobada": "No se puede eliminar compra aprobada"
```

### C. Ejemplos de API

#### Ejemplo 1: Listar Compras
```bash
curl -X GET "https://almaia-rd.vercel.app/api/compras?page=1&limit=10&search=proveedor" \
  -H "Authorization: Bearer tu-token-aqui"
```

#### Ejemplo 2: Crear Compra
```bash
curl -X POST "https://almaia-rd.vercel.app/api/compras" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer tu-token-aqui" \
  -d '{
    "fecha": "2024-01-15",
    "proveedor": "Proveedor A",
    "total": 5000,
    "estado": "Pagada",
    "numero_factura": "COMP-001",
    "fecha_pago": "2024-01-15",
    "metodo_pago": "Efectivo",
    "notas": "Compra de inventario"
  }'
```

#### Ejemplo 3: Actualizar Compra
```bash
curl -X PUT "https://almaia-rd.vercel.app/api/compras/123e4567-e89b-12d3-a456-426614174000" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer tu-token-aqui" \
  -d '{
    "total": 5000,
    "estado": "Pagada",
    "fecha_pago": "2024-01-15"
  }'
```

#### Ejemplo 4: Eliminar Compra
```bash
curl -X DELETE "https://almaia-rd.vercel.app/api/compras/123e4567-e89b-12d3-a456-426614174000" \
  -H "Authorization: Bearer tu-token-aqui"
```

## Agradecimientos

Desarrollado con ❤️ para la comunidad empresarial de República Dominicana.

**© 2024-2025 Almaia RD - Todos los derechos reservados**

---
*Si tienes alguna pregunta o necesitas ayuda, no dudes en contactarnos. Estamos aquí para ayudarte a tener éxito con Almaia RD!*