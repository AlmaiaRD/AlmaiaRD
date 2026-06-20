# Guía Detallada: Facturación

## Visión General

El módulo de **Facturación** es el corazón del sistema Almaia RD. Aquí es donde se registran las ventas, se generan facturas profesionales, y se procesan los pagos.

## Para Qué Sirve

- **Generar facturas profesionales** con logo y firma digital
- **Calcular impuestos automáticamente** (ITBIS 18%)
- **Manejar múltiples métodos de pago** (Efectivo, Tarjeta, Transferencia, Crédito)
- **Enviar facturas por WhatsApp** a los clientes
- **Generar reportes de ventas** y análisis

## Requisitos Previos

Antes de crear facturas, asegúrate de:

1. **Tener clientes creados** en el sistema
2. **Contar con productos en inventario** con precios actualizados
3. **Configurar preferencias de facturación** (prefijos, márgenes)

## Flujo de Trabajo: Cómo Crear una Factura

### Paso 1: Acceder al Módulo

1. Haz clic en **"Facturas"** en el menú principal
2. La página mostrará una lista de facturas existentes
3. Haz clic en el botón **"Nueva Factura"** (ubicado en la esquina superior derecha)

### Paso 2: Ingresar Datos del Cliente

#### Opción A: Buscar Cliente Existente
1. Haz clic en el campo **"Cliente"**
2. Escribe el nombre o email del cliente
3. Selecciona el cliente de la lista de sugerencias
4. El sistema muestra los datos del cliente (teléfono, dirección, límite de crédito)

#### Opción B: Crear Nuevo Cliente
1. Haz clic en **"Nuevo Cliente"** (botón en el formulario de cliente)
2. Completa la información requerida:
   - **Nombre completo:** Ejemplo: "Juan Pérez González"
   - **Email:** Ejemplo: "juan@ejemplo.com"
   - **Teléfono:** Ejemplo: "809-555-0123"
   - **Dirección:** Dirección completa
   - **Tipo de cliente:** Regular, Mayorista, VIP, etc.
   - **Límite de crédito:** Monto máximo que puede comprar a crédito
3. Haz clic en **"Guardar Cliente"**

### Paso 3: Agregar Items a la Factura

#### Agregar un Item
1. Haz clic en el botón **"Agregar Item"** (ubicado debajo del formulario de cliente)
2. El sistema muestra un formulario para el item

#### Seleccionar Producto
1. **Buscar producto:** Escribe el nombre o código del producto
2. **Seleccionar:** Haz clic en el producto de la lista
3. **Ingresar cantidad:** Escribe la cantidad deseada
4. El sistema calcula automáticamente:
   - **Subtotal:** Cantidad × Precio unitario
   - **Descuento:** Si aplica (basado en márgenes)
   - **ITBIS:** Subtotal × 18%
   - **Total:** Subtotal + ITBIS - Descuento

#### Agregar Múltiples Items
1. Repite el proceso de "Agregar Item" para cada producto
2. El sistema muestra un resumen acumulado

#### Eliminar Items
1. Haz clic en el **ícono de basura** (") junto a cada item
2. Confirma la eliminación

### Paso 4: Configurar Pago

#### Seleccionar Método de Pago
1. Haz clic en el campo **"Método de Pago"**
2. Selecciona de las opciones:
   - **Efectivo:** Pago inmediato en efectivo
   - **Tarjeta:** Pago con tarjeta de crédito/débito
   - **Transferencia:** Pago por transferencia bancaria
   - **Crédito:** Venta a crédito (se registra como pendiente)

#### Ingresar Monto Pagado
1. **Para pagos completos:** Ingresa el monto total de la factura
2. **Para pagos parciales:** Ingresa el monto recibido
3. El sistema muestra el monto pendiente (si aplica)

#### Configurar Términos de Crédito (si aplica)
1. **Días de crédito:** Número de días para pagar
2. **Fecha de vencimiento:** Calculada automáticamente
3. **Interés:** Si aplica (opcional)

### Paso 5: Agregar Notas y Observaciones

#### Notas Adicionales
1. Haz clic en el campo **"Notas"** (debajo del método de pago)
2. Escribe cualquier información adicional:
   - Términos y condiciones
   - Instrucciones especiales
   - Referencias de pago
   - Mensajes para el cliente

#### Campos Específicos
- **Referencia de pago:** Número de cheque, número de transferencia, etc.
- **Vendedor:** Quien realizó la venta
- **Descuento especial:** Porcentaje o monto
- **Observaciones:** Cualquier otra información relevante

### Paso 6: Revisar y Confirmar

#### Revisar Resumen
El sistema muestra un resumen completo de la factura:

| Campo | Valor |
|-------|-------|
| **Número de Factura** | AUTO-GENERADO |
| **Cliente** | Nombre del cliente |
| **Fecha** | Fecha actual |
| **Items** | Cantidad de items |
| **Subtotal** | $XXX.XX |
| **ITBIS (18%)** | $XX.XX |
| **Total** | $XXX.XX |
| **Pagado** | $XXX.XX |
| **Pendiente** | $0.00 (si aplica) |

#### Validaciones
El sistema valida automáticamente:
- ✅ **Cliente seleccionado**
- ✅ **Al menos un item**
- ✅ **Monto pagado ≤ Total**
- ✅ **Datos requeridos completados**

### Paso 7: Generar Factura

#### Confirmar Acción
1. Haz clic en el botón **"Generar Factura"**
2. El sistema muestra un mensaje de confirmación
3. Haz clic en **"Sí, Generar Factura"** para continuar

#### Resultado Inmediato
1. **Factura creada:** Se asigna un número de factura único
2. **Actualización de inventario:** Se reduce el stock de los productos
3. **Registro de pago:** Se crea un registro de pago asociado
4. **Redirección:** El sistema te redirige a la página de detalles de la factura

#### Acciones Disponibles Después de la Creación

| Acción | Descripción | Icono |
|--------|-------------|-------|
| **👁️ Ver** | Ver detalles completos | Ojo |
| **🖨️ Imprimir** | Descargar como PDF | Impresora |
| **📤 Enviar** | Enviar por WhatsApp | WhatsApp |
| **✎ Editar** | Modificar la factura | Lápiz |
| **🗑️ Eliminar** | Eliminar la factura | Basura |

## Gestión de Facturas Existentes

### 1. Ver Detalles de una Factura

1. Haz clic en el **título de la factura** en la lista
2. La página muestra:
   - Información completa de la factura
   - Lista de items
   - Historial de pagos
   - Botones de acción

### 2. Editar una Factura

#### Cuándo Editar
- Factura no generada aún
- Errores menores en los items
- Cambios en cantidades o precios

#### Cómo Editar
1. Haz clic en el **botón "Editar"** (botón de lápiz)
2. Realiza los cambios necesarios
3. Haz clic en **"Actualizar"**
4. El sistema valida los cambios
5. Haz clic en **"Guardar"**

**Nota:** No se puede editar una factura que ya ha sido pagada parcialmente o completamente.

### 3. Eliminar una Factura

#### Restricciones de Eliminación
No se puede eliminar una factura si:
- Ya ha sido pagada
- Tiene pagos asociados
- Ha sido enviada al cliente

#### Cómo Eliminar
1. Haz clic en el **botón "Eliminar"** (botón de basura)
2. El sistema muestra una ventana de confirmación
3. Haz clic en **"Eliminar"** para confirmar

### 4. Duplicar una Factura

#### Para Qué Sirve
Crear una nueva factura basada en una existente (útil para pedidos repetitivos)

#### Cómo Duplicar
1. Haz clic en el **botón "Duplicar"**
2. El sistema crea una copia
3. Puedes modificar los detalles
4. Haz clic en **"Generar"** para crear la nueva factura

## Características Avanzadas

### 1. Envío por WhatsApp

#### Configurar Plantilla de WhatsApp
1. Ve a **Facturas** → **Configuración de WhatsApp**
2. Selecciona una plantilla predefinida o crea una nueva
3. Las plantillas pueden incluir variables:
   - `{numero_factura}` - Número de factura
   - `{nombre_cliente}` - Nombre del cliente
   - `{total}` - Monto total
   - `{fecha_vencimiento}` - Fecha de vencimiento
   - `{items}` - Lista de items

#### Enviar Factura
1. En la página de detalles de la factura, haz clic en **"Enviar por WhatsApp"**
2. Selecciona el número de WhatsApp del cliente
3. El sistema envía automáticamente:
   - Mensaje con resumen de la factura
   - PDF adjunto
   - Enlace de pago (si aplica)

### 2. Generación de PDF

#### Personalizar PDF
1. Haz clic en **"Imprimir"** → **"Configurar PDF"**
2. Ajusta:
   - **Logo:** Subir logo personalizado
   - **Firma:** Subir imagen de firma
   - **Términos:** Agregar términos y condiciones
   - **Notas:** Agregar notas adicionales
3. Haz clic en **"Aplicar"**

#### Descargar PDF
1. Haz clic en **"Descargar PDF"**
2. El sistema genera el PDF con la configuración seleccionada
3. El archivo se descarga automáticamente

### 3. Aplicación de Descuentos

#### Descuentos por Cantidad
1. Haz clic en el **ícono de descuento** (") junto a un item
2. Selecciona el nivel de descuento:
   - **5%** para 5-9 unidades
   - **10%** para 10-24 unidades
   - **15%** para 25-49 unidades
   - **20%** para 50+ unidades

#### Cupones de Descuento
1. Ve a **Facturas** → **Cupones**
2. Crea cupones con:
   - **Código:** Ejemplo: "DESCUENTO15"
   - **Tipo:** Porcentaje o Monto fijo
   - **Monto:** 15% o $100
   - **Vigencia:** Fecha de inicio y fin
3. Aplica al ingresar el código en la factura

## Solución de Problemas

### Problemas Comunes y Soluciones

#### 1. "Cliente no encontrado"
**Causa:** El cliente no existe en el sistema
**Solución:** Crea un nuevo cliente antes de generar la factura

#### 2. "Producto sin stock"
**Causa:** El producto no tiene inventario disponible
**Solución:** Verifica el inventario o ajusta la cantidad

#### 3. "Monto mayor que total"
**Causa:** El monto pagado es mayor que el total de la factura
**Solución:** Ajusta el monto de pago o elimina el exceso

#### 4. "Error al generar PDF"
**Causa:** Problemas con la configuración de impresión
**Solución:** Intenta nuevamente o contacta soporte técnico

## Preguntas Frecuentes

### Q: ¿Puedo crear una factura sin cliente?
**R:** No. El sistema requiere un cliente para crear una factura.

### Q: ¿Qué pasa si el cliente tiene crédito?
**R:** La factura se crea normalmente. El crédito del cliente se reduce automáticamente.

### Q: ¿Cómo veo facturas no pagadas?
**R:** Ve a **Facturas** → **Cuentas por Cobrar** para ver todas las facturas pendientes.

### Q: ¿Puedo editar después de enviar por WhatsApp?
**R:** Sí, pero ten en cuenta que el cliente ya recibió la factura.

### Q: ¿Cómo imprimo múltiples facturas?
**R:** Selecciona las facturas en la lista y haz clic en **"Imprimir Seleccionadas"**.

## Atajos de Teclado

| Atajo | Acción |
|-------|--------|
| `N` | Nueva factura |
| `S` | Guardar factura |
| `P` | Imprimir PDF |
| `F` | Buscar cliente |
| `E` | Editar factura |
| `D` | Eliminar factura |
| `C` | Ver carrito (items no guardados) |

## API para Integración

### Endpoints Disponibles

#### 1. Crear Factura (POST)
```
POST /api/facturas

Body:
{
  "cliente_id": "uuid-del-cliente",
  "items": [
    {
      "producto_id": "uuid-del-producto",
      "cantidad": 2,
      "precio_unitario": 100
    }
  ],
  "metodo_pago": "efectivo",
  "monto_pagado": 200,
  "notas": "Venta normal"
}
```

#### 2. Obtener Factura (GET)
```
GET /api/facturas/{id}

Headers:
Authorization: Bearer token
```

#### 3. Actualizar Factura (PUT)
```
PUT /api/facturas/{id}

Body:
{
  "items": [...],
  "metodo_pago": "efectivo",
  "monto_pagado": 200
}
```

#### 4. Eliminar Factura (DELETE)
```
DELETE /api/facturas/{id}

Headers:
Authorization: Bearer token
```

## Referencias Útiles

### 1. Códigos de Error

| Código | Descripción |
|--------|-------------|
| `400` | Solicitud inválida (datos faltantes) |
| `401` | No autorizado (token inválido) |
| `404` | Factura no encontrada |
| `409` | Conflicto (factura ya pagada) |
| `500` | Error interno del servidor |

### 2. Campos Requeridos

- **cliente_id:** UUID del cliente
- **items:** Array no vacío de items
- **metodo_pago:** Uno de: efectivo, tarjeta, transferencia, crédito
- **monto_pagado:** Número decimal

### 3. Códigos de Estado

- **BORRADOR:** Factura creada pero no generada
- **GENERADA:** Factura generada, pendiente de pago
- **PAGADA:** Factura completamente pagada
- **CANCELADA:** Factura cancelada
- **VENCIDA:** Factura vencida

## Mantenimiento y Soporte

### 1. Respaldos de Datos

#### Respaldar Facturas
1. Ve a **Configuración** → **Respaldos**
2. Selecciona **Facturas**
3. Elige el rango de fechas
4. Haz clic en **"Descargar Backup"**

#### Restaurar Facturas
1. Ve a **Configuración** → **Respaldos**
2. Haz clic en **"Subir Backup"**
3. Selecciona el archivo de backup
4. Sigue las instrucciones del sistema

### 2. Monitoreo de Rendimiento

#### Métricas Clave
- **Tiempo de respuesta:** < 2 segundos
- **Tasa de éxito:** > 99%
- **Facturas por hora:** Promedio de transacciones
- **Errores por día:** Conteo de errores

#### Alertas
- **Error 500:** Notificación inmediata
- **Tiempo de respuesta > 5s:** Alerta diaria
- **Facturas por hora < 10:** Alerta semanal

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
- Número de factura (si aplica)
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
- **Imágenes:** PNG, JPG, JPEG (máximo 5MB)
- **Documentos:** PDF, DOCX (máximo 10MB)
- **Hojas de cálculo:** XLSX (máximo 10MB)

#### Especificaciones
- **Logo:** 500x500px, fondo transparente
- **Firma:** 300x150px, fondo blanco
- **PDF:** A4, 300 DPI

### B. Códigos de Error Detallados

#### Errores de Validación
```
"cliente_id": "Cliente no encontrado"
"items": "Array de items requerido"
"metodo_pago": "Método de pago inválido"
"monto_pagado": "Monto pagado debe ser mayor a 0"
```

#### Errores de Negocio
```
"stock_insuficiente": "Producto sin stock suficiente"
"credito_insuficiente": "Límite de crédito excedido"
"factura_pagada": "Factura ya pagada completamente"
```

### C. Preguntas de Configuración Común

| Pregunta | Respuesta |
|----------|----------|
| ¿Cómo cambio el ITBIS? | El ITBIS es fijo en 18% para República Dominicana |
| ¿Puedo usar mi propio prefijo? | Sí, en Configuración → Preferencias de Facturación |
| ¿Cómo agrego impuestos adicionales? | Contacta soporte técnico para configuración personalizada |
| ¿Dónde veo los reportes de impuestos? | En Reportes → Impuestos |

### D. Ejemplos de API

#### Ejemplo 1: Crear Factura Completa
```bash
curl -X POST https://almaia-rd.vercel.app/api/facturas \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer tu-token-aqui" \
  -d '{
    "cliente_id": "550e8400-e29b-41d4-a716-446655440000",
    "items": [
      {
        "producto_id": "550e8400-e29b-41d4-a716-446655440001",
        "cantidad": 2,
        "precio_unitario": 100
      }
    ],
    "metodo_pago": "efectivo",
    "monto_pagado": 200,
    "notas": "Venta normal, gracias"
  }'
```

#### Ejemplo 2: Obtener Factura
```bash
curl -X GET https://almaia-rd.vercel.app/api/facturas/123e4567-e89b-12d3-a456-426614174000 \
  -H "Authorization: Bearer tu-token-aqui"
```

#### Ejemplo 3: Actualizar Factura
```bash
curl -X PUT https://almaia-rd.vercel.app/api/facturas/123e4567-e89b-12d3-a456-426614174000 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer tu-token-aqui" \
  -d '{
    "items": [
      {
        "producto_id": "550e8400-e29b-41d4-a716-446655440001",
        "cantidad": 3,
        "precio_unitario": 100
      }
    ],
    "metodo_pago": "tarjeta",
    "monto_pagado": 300
  }'
```

## Agradecimientos

Desarrollado con ❤️ para la comunidad empresarial de República Dominicana.

**© 2024-2025 Almaia RD - Todos los derechos reservados**

---
*Si tienes alguna pregunta o necesitas ayuda, no dudes en contactarnos. Estamos aquí para ayudarte a tener éxito con Almaia RD!*