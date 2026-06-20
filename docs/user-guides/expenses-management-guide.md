# Guía de Gestión de Gastos

## Visión General

El módulo de **Gestión de Gastos** es esencial para el control financiero de Almaia RD. Aquí es donde se registran todos los gastos operativos, se categorizan, y se generan reportes para análisis.

## Para Qué Sirve

- **Registrar gastos operativos** (oficina, viajes, suministros)
- **Categorizar gastos** para mejor análisis
- **Controlar presupuestos** y alertas de gastos
- **Generar reportes de gastos** y análisis
- **Gestionar proveedores** y pagos

## Requisitos Previos

Antes de gestionar gastos, asegúrate de:

1. **Tener categorías de gastos** creadas en el sistema
2. **Conocer los tipos de gastos** disponibles
3. **Configurar preferencias de gastos** (moneda, etc.)

## Flujo de Trabajo: Cómo Gestionar Gastos

### Paso 1: Acceder al Módulo

1. Haz clic en **"Gastos"** en el menú principal
2. La página mostrará una lista de gastos existentes
3. Haz clic en el botón **"Nuevo Gasto"** (ubicado en la esquina superior derecha)

### 2. Ver Gastos Existentes

#### Página Principal de Gastos
La página principal muestra una tabla con:

| Fecha | Descripción | Categoría | Monto | Proveedor | Estado |
|-------|-------------|----------|-------|----------|--------|
| 2024-01-15 | Alquiler oficina | Operativo | $5,000 | Arrendadora RD | Pagado |
| 2024-01-16 | Suministros | Oficina | $500 | Office Depot | Pagado |
| 2024-01-17 | Viaje Santo Domingo | Viajes | $2,000 | Aerolínea XYZ | Pendiente |

#### Filtros de Búsqueda
1. **Buscar gasto:** Escribe la descripción o proveedor
2. **Filtrar por categoría:** Selecciona de la lista
3. **Filtrar por estado:** Pagado, Pendiente, Aprobado, Rechazado
4. **Filtrar por fecha:** Rango de fechas

### 3. Agregar Nuevo Gasto

#### Información Requerida
Completa la siguiente información obligatoria:

| Campo | Requerido | Tipo | Ejemplo |
|-------|----------|------|---------|
| **Fecha** | Sí | Fecha | "2024-01-15" |
| **Descripción** | Sí | Texto | "Alquiler oficina enero 2024" |
| **Categoría** | Sí | Selección | "Operativo", "Viajes", "Oficina" |
| **Monto** | Sí | Número | "$5,000" |
| **Proveedor** | Sí | Texto | "Arrendadora RD" |

#### Información Opcional
Completa la siguiente información adicional (si aplica):

- **Número de factura:** Número de factura del proveedor
- **Método de pago:** Efectivo, Tarjeta, Transferencia, etc.
- **Fecha de pago:** Fecha real de pago
- **Notas:** Información adicional relevante
- **Adjuntar:** Subir comprobante (PDF, JPG)

#### Proceso de Creación

1. **Completar el formulario:** Llena todos los campos requeridos
2. **Seleccionar categoría:** Elige de la lista desplegable
3. **Ingresar monto:** Introduce el monto exacto
4. **Guardar:** Haz clic en **"Guardar Gasto"**
5. **Confirmar:** El sistema muestra un mensaje de confirmación

#### Resultado

El gasto se crea y aparece inmediatamente en la lista de gastos. Puedes:

- **Ver detalles:** Haz clic en el gasto para ver su información completa
- **Editar:** Modificar la información si es necesario
- **Cambiar estado:** Actualizar el estado de pago
- **Ver comprobante:** Descargar el archivo adjunto

### 4. Editar un Gasto

#### Cuándo Editar
- Información cambiada (nueva fecha, monto)
- Categoría actualizada
- Se necesita ajustar el estado de pago
- Corregir errores en los datos

#### Cómo Editar

1. **Navegar a la lista:** Ve a **Gastos** → **Lista de Gastos**
2. **Seleccionar gasto:** Haz clic en el gasto de la lista
3. **Hacer clic en "Editar"**: Botón de lápiz en la página de detalles
4. **Realizar cambios:** Modifica la información necesaria
5. **Guardar cambios:** Haz clic en **"Actualizar"**

#### Validaciones
El sistema valida automáticamente:
- ✅ **Fecha:** Fecha válida
- ✅ **Descripción:** Mínimo 3 caracteres
- ✅ **Categoría:** Seleccionada
- ✅ **Monto:** Número positivo
- ✅ **Proveedor:** Mínimo 2 caracteres

### 5. Eliminar un Gasto

#### Restricciones de Eliminación
**No puedes eliminar un gasto si:**
- Tiene comprobante adjunto
- Está asociado a un proveedor
- Tiene pagos asociados
- Ha sido aprobado

#### Cómo Eliminar

1. **Encontrar gasto:** Busca el gasto en la lista
2. **Hacer clic en "Eliminar"**: Botón de basura en la página de detalles
3. **Confirmar eliminación:** El sistema muestra una advertencia
4. **Finalizar:** Haz clic en **"Eliminar"** para confirmar

**Importante:** Si necesitas eliminar un gasto con comprobante, contacta soporte técnico para una solución personalizada.

### 6. Buscar y Filtrar Gastos

#### Buscar Gastos

1. **Usar la barra de búsqueda:** Escribe la descripción o proveedor
2. **Resultados instantáneos:** El sistema muestra coincidencias en tiempo real
3. **Seleccionar:** Haz clic en el gasto de los resultados

#### Filtrar Gastos

1. **Hacer clic en **"Filtros"** (botón de filtro)
2. **Seleccionar criterios:**
   - **Categoría:** Operativo, Viajes, Oficina, etc.
   - **Estado:** Pagado, Pendiente, Aprobado, Rechazado
   - **Proveedor:** Seleccionar de la lista
   - **Fecha:** Rango de fechas
3. **Aplicar filtros:** Haz clic en **"Aplicar"**
4. **Limpiar filtros:** Haz clic en **"Limpiar"** para ver todos los gastos

### 7. Exportar Datos de Gastos

#### Exportar a CSV

1. **Hacer clic en **"Exportar"**
2. **Seleccionar formato:** CSV (Excel)
3. **Elegir campos:**
   - Información básica: Fecha, descripción, categoría
   - Información adicional: Monto, proveedor, estado
   - Detalles: Número de factura, método de pago
4. **Descargar:** El archivo se descarga automáticamente

#### Exportar a PDF

1. **Hacer clic en **"Exportar PDF"**
2. **Seleccionar formato:** Reporte de gastos
3. **Personalizar:**
   - **Título:** "Reporte de Gastos"
   - **Fecha:** Incluir fecha de exportación
   - **Campos:** Información a incluir
4. **Generar:** El PDF se crea y descarga

### 8. Importar Datos Masivamente

#### Importar Gastos

1. **Ir a **"Gastos"** → **Importar**
2. **Descargar plantilla:** CSV con estructura correcta
3. **Llenar archivo:** Agregar datos de gastos
4. **Subir archivo:** Seleccionar CSV
5. **Mapear campos:** Asignar columnas a campos del sistema
6. **Validar:** Verificar datos antes de importar
7. **Importar:** Procesar archivo

#### Plantilla CSV
```csv
Fecha,Descripción,Categoría,Monto,Proveedor,Número de factura,Método de pago,Fecha de pago,Notas
2024-01-15,Alquiler oficina,Operativo,$5,000,Arrendadora RD,FAC-001,Efectivo,2024-01-15,Pago mensual
2024-01-16,Suministros de oficina,Oficina,$500,Office Depot,FAC-002,Tarjeta,2024-01-16,Compra de supplies
2024-01-17,Viaje Santo Domingo,Viajes,$2,000,Aerolínea XYZ,FAC-003,Transferencia,2024-01-17,Viaje de negocios
```

## Características Avanzadas

### 1. Alertas de Presupuesto

#### Configurar Alertas

1. **Ir a **"Configuración"** → **Alertas de Presupuesto**
2. **Seleccionar categorías:** Elegir categorías específicas
3. **Configurar límites:**
   - **Operativo:** $10,000 mensual
   - **Viajes:** $5,000 mensual
   - **Oficina:** $2,000 mensual
4. **Guardar:** Las alertas están activadas

#### Ver Alertas

1. **Ir a **"Gastos"** → **Alertas**
2. **Ver lista:** El sistema muestra gastos que exceden el presupuesto
3. **Tomar acción:** Aprobar, rechazar o ajustar

### 2. Aprobación de Gastos

#### Flujo de Aprobación

1. **Crear gasto:** Crear gasto normal
2. **Enviar a aprobación:** Haz clic en **"Enviar a Aprobación"**
3. **Aprobador:** Gerente o administrador
4. **Aprobar/Rechazar:** Tomar decisión
5. **Actualizar estado:** El sistema actualiza el estado

#### Estados de Gastos

- **Pendiente:** Creado, esperando aprobación
- **Aprobado:** Aprobado por el gerente
- **Rechazado:** Rechazado por el gerente
- **Pagado:** Pagado en efectivo/transferencia
- **Cancelado:** Eliminado por error

### 3. Gestión de Proveedores

#### Ver Proveedores

1. **Ir a **"Gastos"** → **Proveedores**
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

### 4. Reportes de Gastos

#### Reporte Mensual

1. **Ir a **"Reportes"** → **Gastos**
2. **Seleccionar período:** Mes actual, mes anterior, rango personalizado
3. **Elegir formato:** PDF, Excel, CSV
4. **Generar:** El reporte se crea

#### Contenido del Reporte
- **Resumen del período:** Total de gastos, cantidad de gastos
- **Por categoría:** Desglose por categoría
- **Por proveedor:** Desglose por proveedor
- **Estado de pagos:** Pagados vs pendientes
- **Alertas:** Gastos que exceden el presupuesto

## Solución de Problemas

### Problemas Comunes y Soluciones

#### 1. "Categoría no encontrada"
**Causa:** La categoría no existe en el sistema
**Solución:** Crear la categoría primero o seleccionar una existente

#### 2. "Monto inválido"
**Causa:** Formato de monto incorrecto
**Solución:** Usar formato: "$5,000" o "5000"

#### 3. "Proveedor no encontrado"
**Causa:** El proveedor no existe en el sistema
**Solución:** Crear el proveedor primero o seleccionar uno existente

#### 4. "No puedo eliminar gasto"
**Causa:** El gasto tiene comprobante o está aprobado
**Solución:** Contactar soporte técnico para eliminación segura

## Preguntas Frecuentes

### Q: ¿Cómo veo gastos por categoría?
**R:** Filtra por "Categoría" en los filtros.

### Q: ¿Cómo configuro alertas de presupuesto?
**R:** Ve a **Configuración** → **Alertas de Presupuesto** y configura los límites.

### Q: ¿Puedo importar gastos desde Excel?
**R:** Sí, usa la función de importación masiva.

### Q: ¿Cómo veo gastos pendientes de aprobación?
**R:** Filtra por "Estado: Pendiente" en los filtros.

## Atajos de Teclado

| Atajo | Acción |
|-------|--------|
| `G` | Nuevo gasto |
| `F` | Buscar gasto |
| `E` | Editar gasto |
| `D` | Eliminar gasto |
| `X` | Exportar gastos |
| `I` | Importar gastos |
| `S` | Guardar cambios |
| `A` | Ver alertas |

## Referencias Útiles

### 1. Códigos de Error

| Código | Descripción |
|--------|-------------|
| `400` | Solicitud inválida (datos faltantes) |
| `401` | No autorizado (token inválido) |
| `404` | Gasto no encontrado |
| `409` | Conflicto (proveedor ya existe) |
| `500` | Error interno del servidor |

### 2. Campos Requeridos

- **fecha:** Fecha del gasto (YYYY-MM-DD)
- **descripcion:** Descripción del gasto
- **categoria:** Categoría del gasto
- **monto:** Monto del gasto (número positivo)
- **proveedor:** Nombre del proveedor

### 3. Códigos de Estado

- **PENDIENTE:** Gasto creado, esperando aprobación
- **APROBADO:** Aprobado por el gerente
- **RECHAZADO:** Rechazado por el gerente
- **PAGADO:** Pagado en efectivo/transferencia
- **CANCELADO:** Eliminado por error

## Mantenimiento y Soporte

### 1. Respaldos de Datos

#### Respaldar Gastos
1. Ve a **Configuración** → **Respaldos**
2. Selecciona **Gastos**
3. Elige el formato: CSV, Excel, JSON
4. Haz clic en **"Descargar Backup"**

#### Restaurar Gastos
1. Ve a **Configuración** → **Respaldos**
2. Haz clic en **"Subir Backup"**
3. Selecciona el archivo de backup
4. Sigue las instrucciones del sistema

### 2. Monitoreo de Rendimiento

#### Métricas Clave
- **Tiempo de respuesta:** < 2 segundos
- **Tasa de éxito:** > 99%
- **Gastos por hora:** Promedio de transacciones
- **Errores por día:** Conteo de errores

#### Alertas
- **Error 500:** Notificación inmediata
- **Tiempo de respuesta > 5s:** Alerta diaria
- **Presupuesto excedido:** Alerta inmediata

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
- ID del gasto (si aplica)
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
- **PDF:** .pdf (para comprobantes)

#### Especificaciones
- **Tamaño máximo:** 10MB por archivo
- **Carácteres permitidos:** UTF-8
- **Separadores:** Coma para CSV

### B. Códigos de Error Detallados

#### Errores de Validación
```
"fecha": "Fecha requerida"
"descripcion": "Descripción requerida"
"categoria": "Categoría requerida"
"monto": "Monto inválido"
"proveedor": "Proveedor requerido"
```

#### Errores de Negocio
```
"categoria_invalida": "La categoría no existe"
"proveedor_invalido": "El proveedor no existe"
"monto_invalido": "El monto debe ser positivo"
"gasto_aprobado": "No se puede eliminar gasto aprobado"
```

### C. Ejemplos de API

#### Ejemplo 1: Listar Gastos
```bash
curl -X GET "https://almaia-rd.vercel.app/api/gastos?page=1&limit=10&search=alquiler" \
  -H "Authorization: Bearer tu-token-aqui"
```

#### Ejemplo 2: Crear Gasto
```bash
curl -X POST "https://almaia-rd.vercel.app/api/gastos" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer tu-token-aqui" \
  -d '{
    "fecha": "2024-01-15",
    "descripcion": "Alquiler oficina enero 2024",
    "categoria": "Operativo",
    "monto": 5000,
    "proveedor": "Arrendadora RD",
    "numero_factura": "FAC-001",
    "metodo_pago": "Efectivo",
    "fecha_pago": "2024-01-15",
    "notas": "Pago mensual"
  }'
```

#### Ejemplo 3: Actualizar Gasto
```bash
curl -X PUT "https://almaia-rd.vercel.app/api/gastos/123e4567-e89b-12d3-a456-426614174000" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer tu-token-aqui" \
  -d '{
    "descripcion": "Alquiler oficina enero 2024 - Actualizado",
    "monto": 5000,
    "estado": "Pagado"
  }'
```

#### Ejemplo 4: Eliminar Gasto
```bash
curl -X DELETE "https://almaia-rd.vercel.app/api/gastos/123e4567-e89b-12d3-a456-426614174000" \
  -H "Authorization: Bearer tu-token-aqui"
```

## Agradecimientos

Desarrollado con ❤️ para la comunidad empresarial de República Dominicana.

**© 2024-2025 Almaia RD - Todos los derechos reservados**

---
*Si tienes alguna pregunta o necesitas ayuda, no dudes en contactarnos. Estamos aquí para ayudarte a tener éxito con Almaia RD!*