# Guía de Gestión de Clientes

## Visión General

El módulo de **Gestión de Clientes** es fundamental para el éxito de Almaia RD. Los clientes son el corazón del negocio y esta guía te enseñará cómo gestionarlos de manera efectiva.

## Para Qué Sirve

- **Crear y mantener** una base de datos de clientes
- **Seguir el historial** de compras y transacciones
- **Gestionar créditos** y límites de pago
- **Enviar comunicaciones** y promociones
- **Generar reportes** de clientes y análisis

## Requisitos Previos

Antes de gestionar clientes, asegúrate de:

1. **Tener una cuenta de usuario** en el sistema
2. **Conocer la información básica** necesaria para crear un cliente
3. **Entender los tipos de clientes** disponibles

## Flujo de Trabajo: Cómo Gestionar Clientes

### Paso 1: Acceder al Módulo

1. Haz clic en **"Clientes"** en el menú principal
2. La página mostrará una lista de clientes existentes
3. Haz clic en el botón **"Nuevo Cliente"** (ubicado en la esquina superior derecha)

### Paso 2: Crear un Nuevo Cliente

#### Información Requerida
Completa la siguiente información obligatoria:

| Campo | Requerido | Tipo | Ejemplo |
|-------|----------|------|---------|
| **Nombre completo** | Sí | Texto | "Juan Pérez González" |
| **Email** | Sí | Email | "juan@ejemplo.com" |
| **Teléfono** | Sí | Teléfono | "809-555-0123" |
| **Tipo de cliente** | Sí | Selección | "Regular", "Mayorista", "VIP" |
| **Límite de crédito** | No | Número | "5000" (opcional) |

#### Información Opcional
Completa la siguiente información adicional (si aplica):

- **Dirección:** Dirección completa
- **Ciudad:** Ciudad de residencia
- **Código postal:** Código postal
- **Notas:** Información adicional relevante
- **Preferencias:** Cómo prefiere ser contactado

#### Proceso de Creación

1. **Completar el formulario:** Llena todos los campos requeridos
2. **Verificar datos:** Revisa que toda la información sea correcta
3. **Guardar:** Haz clic en **"Guardar Cliente"**
4. **Confirmar:** El sistema muestra un mensaje de confirmación

#### Resultado

El cliente se crea y aparece inmediatamente en la lista de clientes. Puedes:

- **Ver detalles:** Haz clic en el cliente para ver su información completa
- **Editar:** Modificar la información si es necesario
- **Agregar contactos:** Añadir teléfonos o emails adicionales
- **Asignar tags:** Categorizar para mejor organización

### 3. Editar un Cliente Existente

#### Cuándo Editar
- Información cambiada (nuevo teléfono, email)
- Tipo de cliente actualizado
- Se necesita ajustar el límite de crédito
- Corregir errores en los datos

#### Cómo Editar

1. **Navegar a la lista:** Ve a **Clientes** → **Lista de Clientes**
2. **Seleccionar cliente:** Haz clic en el cliente de la lista
3. **Hacer clic en "Editar":** Botón de lápiz en la página de detalles
4. **Realizar cambios:** Modifica la información necesaria
5. **Guardar cambios:** Haz clic en **"Actualizar"**

#### Validaciones
El sistema valida automáticamente:
- ✅ **Nombre completo:** Mínimo 2 palabras
- ✅ **Email:** Formato válido
- ✅ **Teléfono:** Formato válido (si se proporciona)
- ✅ **Límite de crédito:** Número positivo (si se proporciona)

### 4. Eliminar un Cliente

#### Restricciones de Eliminación
**No puedes eliminar un cliente si:**
- Tiene facturas asociadas
- Tiene recibos pendientes
- Tiene créditos pendientes
- Ha realizado transacciones en el pasado

#### Cómo Eliminar

1. **Encontrar cliente:** Busca el cliente en la lista
2. **Hacer clic en "Eliminar":** Botón de basura en la página de detalles
3. **Confirmar eliminación:** El sistema muestra una advertencia
4. **Finalizar:** Haz clic en **"Eliminar"** para confirmar

**Importante:** Si necesitas eliminar un cliente con transacciones, contacta soporte técnico para una solución personalizada.

### 5. Buscar y Filtrar Clientes

#### Buscar Clientes

1. **Usar la barra de búsqueda:** Escribe el nombre, email o teléfono
2. **Resultados instantáneos:** El sistema muestra coincidencias en tiempo real
3. **Seleccionar:** Haz clic en el cliente de los resultados

#### Filtrar Clientes

1. **Hacer clic en **"Filtros"** (botón de filtro)
2. **Seleccionar criterios:**
   - **Tipo de cliente:** Regular, Mayorista, VIP, etc.
   - **Con crédito:** Sí/No
   - **Con límite:** Sí/No
   - **Fecha de creación:** Rango de fechas
3. **Aplicar filtros:** Haz clic en **"Aplicar"**
4. **Limpiar filtros:** Haz clic en **"Limpiar"** para ver todos los clientes

### 6. Exportar Datos de Clientes

#### Exportar a CSV

1. **Hacer clic en **"Exportar"** (botón verde)
2. **Seleccionar formato:** CSV (Excel)
3. **Elegir campos:**
   - Información básica: Nombre, email, teléfono
   - Información adicional: Dirección, notas
   - Historial: Última compra, total gastado
4. **Descargar:** El archivo se descarga automáticamente

#### Exportar a PDF

1. **Hacer clic en **"Exportar PDF"**
2. **Seleccionar formato:** Reporte de clientes
3. **Personalizar:**
   - **Título:** "Lista de Clientes"
   - **Fecha:** Incluir fecha de exportación
   - **Campos:** Información a incluir
4. **Generar:** El PDF se crea y descarga

## Gestión Avanzada de Clientes

### 1. Seguimientos y Notas

#### Agregar Seguimientos

1. **Ir a la página del cliente:** Haz clic en el cliente
2. **Hacer clic en **"Nuevo Seguimiento"**
3. **Escribir nota:** Describe el seguimiento
4. **Seleccionar tipo:** Reunión, Llamada, Email, etc.
5. **Guardar:** El seguimiento aparece en el historial

#### Tipos de Seguimientos

- **Reunión:** Reunión personal
- **Llamada:** Llamada telefónica
- **Email:** Comunicación por email
- **Cita:** Cita programada
- **Otro:** Tipo personalizado

### 2. Tags y Etiquetas

#### Crear Tags

1. **Ir a **"Tags"** (en el menú de clientes)
2. **Hacer clic en **"Nuevo Tag"**
3. **Completar información:**
   - **Nombre:** "VIP", "Frecuente", "Nuevo"
   - **Color:** Color para identificación visual
   - **Descripción:** Para qué sirve el tag
4. **Guardar:** El tag está disponible para usar

#### Asignar Tags

1. **Seleccionar cliente:** De la lista de clientes
2. **Hacer clic en **"Tags"** (en la página de detalles)
3. **Seleccionar tags:** Marcar los aplicables
4. **Guardar:** Los tags se asignan

### 3. Crédito y Límites

#### Ver Crédito del Cliente

1. **Ir a la página del cliente:** Haz clic en el cliente
2. **Desplazarse hacia abajo:** Hasta la sección **Crédito**
3. **Ver información:**
   - **Límite de crédito:** Monto máximo permitido
   - **Crédito usado:** Monto ya utilizado
   - **Crédito disponible:** Límite - Usado
   - **Próxima renovación:** Fecha de reinicio

#### Ajustar Límite de Crédito

1. **Ir a la página del cliente:** Haz clic en el cliente
2. **Hacer clic en **"Ajustar Crédito"**
3. **Ingresar nuevo límite:** Nuevo monto de crédito
4. **Seleccionar motivo:** Ejemplo: "Buen historial de pago"
5. **Guardar:** El límite se actualiza

**Nota:** Ajustar límites requiere aprobación de un gerente.

### 4. Comunicaciones

#### Enviar Email

1. **Ir a la página del cliente:** Haz clic en el cliente
2. **Hacer clic en **"Enviar Email"**
3. **Escribir mensaje:** Template personalizado
4. **Adjuntar:** Documentos si es necesario
5. **Enviar:** El sistema envía el email

#### Enviar WhatsApp

1. **Ir a la página del cliente:** Haz clic en el cliente
2. **Hacer clic en **"WhatsApp"**
3. **Seleccionar plantilla:** Plantilla predefinida o personalizada
4. **Personalizar:** Agregar variables como `{nombre}`
5. **Enviar:** El sistema envía el mensaje

## Análisis y Reportes de Clientes

### 1. Ver Estadísticas del Cliente

#### Información General
La página de detalles del cliente muestra:

| Sección | Información |
|---------|-------------|
| **Básica** | Nombre, email, teléfono, dirección |
| **Crédito** | Límite, usado, disponible, renovación |
| **Compras** | Total gastado, última compra, frecuencia |
| **Historial** | Lista de todas las transacciones |

### 2. Reporte de Compras

#### Generar Reporte

1. **Ir a **"Reportes"** → **Reportes de Clientes**
2. **Seleccionar cliente:** Elegir de la lista
3. **Seleccionar rango:** Desde/hasta fechas
4. **Elegir formato:** PDF, Excel, CSV
5. **Generar:** El reporte se crea

#### Contenido del Reporte
- **Resumen del cliente**
- **Lista de facturas**
- **Totales por período**
- **Productos más comprados**
- **Análisis de tendencias**

### 3. Seguimiento de Clientes

#### Vista de Seguimiento

1. **Ir a **"Seguimientos"** (en el menú principal)
2. **Filtrar por cliente:** Mostrar solo seguimientos de un cliente
3. **Ver historial:** Lista cronológica de todas las interacciones
4. **Agregar nuevo:** Registrar nuevas interacciones

#### Tipos de Seguimiento

- **Venta:** Transacción completada
- **Seguimiento:** Contacto de seguimiento
- **Recordatorio:** Recordatorio de pago
- **Promoción:** Oferta especial
- **Otro:** Información general

## Características Avanzadas

### 1. Importación y Exportación Masiva

#### Importar Clientes

1. **Ir a **"Clientes"** → **Importar**
2. **Descargar plantilla:** CSV con estructura correcta
3. **Llenar archivo:** Agregar datos de clientes
4. **Subir archivo:** Seleccionar CSV
5. **Mapear campos:** Asignar columnas a campos del sistema
6. **Validar:** Verificar datos antes de importar
7. **Importar:** Procesar archivo

#### Exportar Clientes

1. **Hacer clic en **"Exportar"**
2. **Seleccionar formato:** CSV, Excel, PDF
3. **Elegir filtros:** Tipo, fecha, ubicación
4. **Descargar:** Archivo con datos seleccionados

### 2. API para Integración

#### Endpoints Disponibles

##### 1. Listar Clientes (GET)
```
GET /api/clientes

Parámetros de consulta:
- page: Número de página (default: 1)
- limit: Elementos por página (default: 20)
- search: Término de búsqueda
- tipo: Filtrar por tipo

Headers:
Authorization: Bearer token
```

##### 2. Obtener Cliente (GET)
```
GET /api/clientes/{id}

Parámetros:
- id: UUID del cliente

Headers:
Authorization: Bearer token
```

##### 3. Crear Cliente (POST)
```
POST /api/clientes

Body:
{
  "nombre": "Juan Pérez González",
  "email": "juan@ejemplo.com",
  "telefono": "809-555-0123",
  "tipo": "regular",
  "limite_credito": 5000,
  "direccion": "San José, Costa Rica",
  "notas": "Cliente preferido"
}
```

##### 4. Actualizar Cliente (PUT)
```
PUT /api/clientes/{id}

Body:
{
  "nombre": "Juan Pérez González",
  "email": "juan@ejemplo.com",
  "telefono": "809-555-0123",
  "tipo": "regular",
  "limite_credito": 5000
}
```

##### 5. Eliminar Cliente (DELETE)
```
DELETE /api/clientes/{id}

Headers:
Authorization: Bearer token
```

### 3. Integraciones con WhatsApp

#### Enviar Mensaje Masivo

1. **Ir a **"Clientes"** → **WhatsApp Masivo**
2. **Seleccionar lista:** Clientes por tipo o segmento
3. **Elegir plantilla:** Plantilla predefinida
4. **Personalizar:** Variables dinámicas
5. **Enviar:** Programar o enviar inmediatamente

#### Plantillas Predefinidas

- **Bienvenida:** "¡Bienvenido a Almaia RD!"
- **Factura:** "Tu factura #{numero} está lista"
- **Recordatorio:** "Recordatorio de pago para {fecha}"
- **Promoción:** "¡Oferta especial para ti!"

## Solución de Problemas

### Problemas Comunes y Soluciones

#### 1. "Cliente ya existe"
**Causa:** El cliente ya está registrado en el sistema
**Solución:** Buscar en la lista de clientes o usar la función "Encontrar duplicados"

#### 2. "Email inválido"
**Causa:** Formato de email incorrecto
**Solución:** Verificar formato: "nombre@dominio.extensión"

#### 3. "Teléfono inválido"
**Causa:** Formato de teléfono incorrecto
**Solución:** Usar formato: "809-555-0123" o "+1-809-555-0123"

#### 4. "No puedo eliminar cliente"
**Causa:** El cliente tiene transacciones asociadas
**Solución:** Contactar soporte técnico para eliminación segura

## Preguntas Frecuentes

### Q: ¿Cuántos clientes puedo crear?
**R:** No hay límite. El sistema puede manejar miles de clientes.

### Q: ¿Cómo busco un cliente rápidamente?
**R:** Usa la barra de búsqueda. Puedes buscar por nombre, email o teléfono.

### Q: ¿Qué tipos de cliente existen?
**R:** Regular, Mayorista, VIP, Corporativo, Gobierno.

### Q: ¿Cómo veo clientes con crédito?
**R:** Filtra por "Con crédito: Sí" en los filtros.

### Q: ¿Puedo importar clientes desde Excel?
**R:** Sí, usa la función de importación masiva.

## Atajos de Teclado

| Atajo | Acción |
|-------|--------|
| `C` | Nuevo cliente |
| `F` | Buscar cliente |
| `E` | Editar cliente |
| `D` | Eliminar cliente |
| `X` | Exportar clientes |
| `I` | Importar clientes |
| `S` | Guardar cambios |

## Referencias Útiles

### 1. Códigos de Error

| Código | Descripción |
|--------|-------------|
| `400` | Solicitud inválida (datos faltantes) |
| `401` | No autorizado (token inválido) |
| `404` | Cliente no encontrado |
| `409` | Conflicto (email ya existe) |
| `500` | Error interno del servidor |

### 2. Campos Requeridos

- **nombre:** Nombre completo del cliente
- **email:** Email válido
- **telefono:** Número de teléfono
- **tipo:** Uno de: regular, mayorista, vip, corporativo, gobierno

### 3. Códigos de Estado

- **ACTIVO:** Cliente activo en el sistema
- **INACTIVO:** Cliente inactivo temporalmente
- **SUSPENDIDO:** Cliente suspendido por incumplimiento
- **ARCHIVADO:** Cliente archivado (no visible por defecto)

## Mantenimiento y Soporte

### 1. Respaldos de Datos

#### Respaldar Clientes
1. Ve a **Configuración** → **Respaldos**
2. Selecciona **Clientes**
3. Elige el formato: CSV, Excel, JSON
4. Haz clic en **"Descargar Backup"**

#### Restaurar Clientes
1. Ve a **Configuración** → **Respaldos**
2. Haz clic en **"Subir Backup"**
3. Selecciona el archivo de backup
4. Sigue las instrucciones del sistema

### 2. Monitoreo de Calidad de Datos

#### Validaciones
- **Email único:** Verificar que no haya emails duplicados
- **Teléfono válido:** Verificar formato
- **Nombre completo:** Mínimo 2 palabras

#### Alertas
- **Email duplicado:** Alerta inmediata
- **Teléfono inválido:** Alerta diaria
- **Cliente sin transacciones:** Alerta semanal

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
- ID del cliente (si aplica)
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
"nombre": "Nombre completo requerido"
"email": "Email inválido o duplicado"
"telefono": "Teléfono inválido"
"tipo": "Tipo de cliente inválido"
```

#### Errores de Negocio
```
"email_duplicado": "Ya existe un cliente con este email"
"telefono_duplicado": "Ya existe un cliente con este teléfono"
"limite_credito_invalido": "El límite de crédito debe ser un número positivo"
```

### C. Ejemplos de API

#### Ejemplo 1: Listar Clientes
```bash
curl -X GET "https://almaia-rd.vercel.app/api/clientes?page=1&limit=10&search=juan" \
  -H "Authorization: Bearer tu-token-aqui"
```

#### Ejemplo 2: Crear Cliente
```bash
curl -X POST "https://almaia-rd.vercel.app/api/clientes" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer tu-token-aqui" \
  -d '{
    "nombre": "Juan Pérez González",
    "email": "juan@ejemplo.com",
    "telefono": "809-555-0123",
    "tipo": "regular",
    "limite_credito": 5000,
    "direccion": "San José, Costa Rica"
  }'
```

#### Ejemplo 3: Actualizar Cliente
```bash
curl -X PUT "https://almaia-rd.vercel.app/api/clientes/123e4567-e89b-12d3-a456-426614174000" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer tu-token-aqui" \
  -d '{
    "telefono": "809-999-9999",
    "direccion": "Nueva dirección"
  }'
```

#### Ejemplo 4: Eliminar Cliente
```bash
curl -X DELETE "https://almaia-rd.vercel.app/api/clientes/123e4567-e89b-12d3-a456-426614174000" \
  -H "Authorization: Bearer tu-token-aqui"
```

## Agradecimientos

Desarrollado con ❤️ para la comunidad empresarial de República Dominicana.

**© 2024-2025 Almaia RD - Todos los derechos reservados**

---
*Si tienes alguna pregunta o necesitas ayuda, no dudes en contactarnos. Estamos aquí para ayudarte a tener éxito con Almaia RD!*