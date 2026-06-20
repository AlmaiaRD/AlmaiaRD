# Guía de Inicio Rápido para Almaia RD

## Qué es Almaia RD

Almaia RD es un sistema de gestión empresarial completo diseñado específicamente para la distribución Amway en República Dominicana. Combina facturación, inventario, gestión de clientes, y seguimiento de ventas en una sola plataforma integrada.

## Accediendo al Sistema

### URL de Acceso
- **Producción:** https://almaia-rd.vercel.app
- **Desarrollo:** http://localhost:3001 (solo para desarrolladores)

### Credenciales de Inicio de Sesión
- **Usuario:** `admin@almaia.com`
- **Contraseña:** `Admin123!`

### Proceso de Inicio de Sesión
1. Abre el navegador y ve a la URL de producción
2. Haz clic en el botón **"Iniciar Sesión"**
3. Ingresa las credenciales de usuario
4. Serás redirigido al **Dashboard** (Centro de Control)

## Navegación del Sistema

### Menú Principal
El menú de navegación está ubicado en la parte izquierda de la pantalla y contiene los siguientes módulos:

#### Módulos Principales (5 en primera fila)
- **📊 Estadísticas** - Dashboard con KPIs
- **👥 CRM** - Gestión de clientes y seguimientos
- **🧾 Facturas** - Emisión y gestión de facturas
- **📋 Recibos** - Registro de pagos recibidos
- **👤 Clientes** - Base de datos de clientes

#### Módulos Secundarios (5 en segunda fila)
- **📦 Inventario** - Control de stock y movimientos
- **🛍️ Catálogo** - Catálogo completo de productos Amway
- **💸 Gastos** - Registro y categorización de gastos
- **⚙️ Configuración** - Ajustes del negocio
- **📊 Reportes** - Análisis e informes financieros

#### Módulos de Características (5 en segunda fila)
- **🎁 Bonificaciones** - Gestión de bonificaciones y PV
- **📈 PV** - Puntos de Volumen y cálculo
- **📁 Documentos** - Gestión de documentos varios
- **💳 Créditos** - Control de cuentas por cobrar
- **💬 WhatsApp** - Comunicación con clientes
- **🤖 Recomendaciones** - IA para sugerencias de productos

## Dashboard (Centro de Control)

### Visión General
El Dashboard es la página principal que muestra:

#### KPIs Principales (8 métricas)
1. **Ventas del Día** - Total facturado hoy
2. **Ventas del Mes** - Acumulado mensual
3. **Cobros Recibidos** - Efectivo en banco
4. **Ganancias** - Utilidad bruta
5. **Valor de Inventario** - Costo total del stock
6. **Stock Disponible** - Cantidad total de items
7. **Cuentas por Cobrar** - Total pendiente
8. **PV del Mes** - Puntos de Volumen acumulados

#### Widget de Metas Mensuales
- **Barra de progreso** con tres segmentos:
  - **Verde (#86C7A3):** Cobrado
  - **Rosa (#B8837E):** Vendido
  - **Gris (#E8E0D8):** Restante
- **Entrada para fijar meta:** Puedes establecer una meta mensual
- **Reset automático:** Se reinicia al inicio de cada mes

#### Módulos Rápidos
Acceso directo a las características más importantes:
- **Bonificaciones** - Gestión de bonificaciones
- **Puntos de Volumen** - Cálculo de PV
- **Reportes** - Análisis de datos
- **Documentos** - Gestión de documentos

## Guía de Usuarios por Módulo

### 1. Facturación

#### Para Qué Sirve
Genera facturas profesionales para ventas de productos y servicios.

#### Cómo Crear una Factura

**Paso 1: Acceder al Módulo**
1. Haz clic en **"Facturas"** en el menú principal
2. Haz clic en **"Nueva Factura"** (botón azul en la esquina superior derecha)

**Paso 2: Ingresar Datos del Cliente**
1. **Buscar cliente existente:** Escribe el nombre o email en el campo "Cliente"
2. **Crear nuevo cliente:** Haz clic en **"Nuevo Cliente"** si no existe

**Paso 3: Agregar Items**
1. Haz clic en **"Agregar Item"** (múltiples veces si es necesario)
2. Selecciona el producto del catálogo
3. Ingresa la cantidad
4. El sistema calcula automáticamente:
   - Subtotal
   - Descuento (si aplica)
   - ITBIS (18%)
   - Total

**Paso 4: Configurar Pago**
1. Selecciona el método de pago:
   - Efectivo
   - Tarjeta
   - Transferencia
   - Crédito
2. Ingresa el monto pagado (si es crédito, se registra como pendiente)

**Paso 5: Agregar Notas (Opcional)**
- Escribe notas adicionales, términos de pago, etc.

**Paso 6: Generar Factura**
1. Haz clic en **"Generar Factura"**
2. El sistema muestra un resumen
3. Haz clic en **"Confirmar y Generar"**

**Resultado:** La factura se guarda y aparece en la lista de facturas. También puedes:
- **Imprimir** (PDF)
- **Enviar por WhatsApp**
- **Compartir** por email

#### Errores Comunes y Soluciones

| Error | Causa | Solución |
|-------|-------|----------|
| "Cliente no encontrado" | Cliente no existe | Crea un nuevo cliente primero |
| "Producto no disponible" | Producto sin stock | Verifica inventario o ajusta cantidad |
| "Monto mayor que total" | Pago mayor que total de factura | Ajusta el monto de pago |

### 2. Recibos

#### Para Qué Sirve
Registra los pagos recibidos de clientes.

#### Cómo Crear un Recibo

**Paso 1: Acceder al Módulo**
1. Haz clic en **"Recibos"** en el menú principal
2. Haz clic en **"Nuevo Recibo"**

**Paso 2: Seleccionar Cliente**
1. Busca el cliente que realizó el pago
2. Selecciona de la lista

**Paso 3: Ingresar Detalles del Pago**
1. **Fecha del recibo:** Selecciona la fecha
2. **Método de pago:** Efectivo, Tarjeta, Transferencia, etc.
3. **Monto recibido:** Ingresa el monto exacto
4. **Referencia:** Número de factura o concepto

**Paso 4: Agregar Notas (Opcional)**

**Paso 5: Guardar**
1. Haz clic en **"Guardar Recibo"**
2. El recibo aparece en la lista

**Resultado:** El recibo se guarda y actualiza el estado del cliente.

### 3. Clientes

#### Para Qué Sirve
Mantiene una base de datos completa de todos los clientes.

#### Cómo Gestionar Clientes

**Paso 1: Acceder al Módulo**
1. Haz clic en **"Clientes"** en el menú principal

**Paso 2: Crear Nuevo Cliente**
1. Haz clic en **"Nuevo Cliente"** (botón azul)
2. Completa la información:
   - **Nombre completo**
   - **Email**
   - **Teléfono**
   - **Dirección**
   - **Tipo de cliente** (Regular, Mayorista, etc.)
   - **Límite de crédito** (si aplica)
3. Haz clic en **"Guardar"**

**Paso 3: Editar Cliente Existente**
1. Haz clic en el cliente de la lista
2. Haz clic en **"Editar"** (botón de lápiz)
3. Realiza los cambios
4. Haz clic en **"Actualizar"**

**Paso 4: Eliminar Cliente**
1. Haz clic en el cliente de la lista
2. Haz clic en **"Eliminar"** (botón de basura)
3. Confirma la eliminación

**Nota:** No puedes eliminar clientes que tienen facturas o recibos asociados.

### 4. Inventario

#### Para Qué Sirve
Controla el stock de productos y registra todos los movimientos.

#### Cómo Gestionar Inventario

**Paso 1: Acceder al Módulo**
1. Haz clic en **"Inventario"** en el menú principal

**Paso 2: Ver Stock Actual**
1. La página muestra todos los productos con:
   - Nombre del producto
   - Cantidad en stock
   - Precio unitario
   - Valor total

**Paso 3: Agregar Nuevo Producto**
1. Haz clic en **"Nuevo Producto"**
2. Completa la información:
   - **Nombre del producto**
   - **Código/SKU**
   - **Precio de venta**
   - **Precio de costo**
   - **Stock inicial**
   - **Categoría**
3. Haz clic en **"Guardar"**

**Paso 4: Ajustar Stock**
1. Haz clic en el producto de la lista
2. Haz clic en **"Ajustar Stock"**
3. Ingresa la nueva cantidad
4. Selecciona el motivo (Compra, Venta, Daño, etc.)
5. Haz clic en **"Actualizar"**

**Resultado:** El stock se actualiza y se registra un movimiento en el historial.

### 5. Configuración

#### Para Qué Sirve
Personaliza todos los aspectos del negocio.

#### Cómo Configurar el Negocio

**Paso 1: Acceder al Módulo**
1. Haz clic en **"Configuración"** en el menú principal

**Paso 2: Información del Negocio**
1. **Nombre del negocio:** El nombre que aparece en facturas
2. **Logo:** Sube un logo (formato PNG/JPG, recomendado 500x500)
3. **Firma digital:** Sube una imagen de tu firma
4. **Email de contacto:** Para que los clientes se comuniquen
5. **Teléfono:** Número de contacto

**Paso 3: Preferencias de Facturación**
1. **Prefijo de factura:** Ejemplo "FACT-"
2. **Prefijo de recibo:** Ejemplo "REC-"
3. **Prefijo de compra:** Ejemplo "COMP-"
4. **Margen por defecto:** Porcentaje de ganancia
5. **ITBIS:** 18% (no editable)

**Paso 4: Guardar Cambios**
1. Haz clic en **"Guardar Configuración"**
2. Los cambios se aplican inmediatamente

## Características Avanzadas

### 1. WhatsApp Business

#### Para Qué Sirve
Envía mensajes automáticos a clientes a través de WhatsApp.

#### Cómo Enviar un Mensaje

**Paso 1: Acceder al Módulo**
1. Haz clic en **"WhatsApp"** en el menú principal

**Paso 2: Seleccionar Plantilla**
1. Ve a la pestaña **"Plantillas"**
2. Selecciona una plantilla existente o crea una nueva
3. Las plantillas pueden incluir variables:
   - `{nombre}` - Nombre del cliente
   - `{monto}` - Monto de la factura
   - `{fecha}` - Fecha de vencimiento

**Paso 3: Enviar Mensaje**
1. Selecciona el cliente
2. Escribe el mensaje personalizado
3. Haz clic en **"Enviar"**

### 2. Recomendaciones con IA

#### Para Qué Sirve
Recibe sugerencias personalizadas de productos basadas en el historial de compras.

#### Cómo Obtener Recomendaciones

**Paso 1: Acceder al Módulo**
1. Haz clic en **"Recomendaciones"** en el menú principal

**Paso 2: Configurar**
1. Activa la IA (si tienes API key de OpenAI)
2. Selecciona el tipo de recomendación:
   - Por compra anterior
   - Por temporada
   - Por categoría

**Paso 3: Ver Resultados**
1. El sistema muestra productos sugeridos
2. Puedes:
   - Agregar a carrito
   - Ver detalles
   - Guardar como favorito

## Solución de Problemas

### Problemas Comunes y Soluciones

#### 1. No Puedo Iniciar Sesión
**Síntoma:** La página queda cargando o muestra error
**Causas posibles:**
- Internet lento
- Servidor temporalmente no disponible
- Credenciales incorrectas

**Soluciones:**
1. Verifica tu conexión a internet
2. Recarga la página
3. Asegúrate de usar las credenciales correctas
4. Si el problema persiste, contacta al administrador

#### 2. No Puedo Crear una Factura
**Síntoma:** Error al guardar factura
**Causas posibles:**
- Cliente no seleccionado
- Sin items en la factura
- Faltan campos requeridos

**Soluciones:**
1. Asegúrate de seleccionar un cliente
2. Agrega al menos un item
3. Completa todos los campos requeridos
4. Verifica que el producto tenga stock

#### 3. El PDF no Se Genera
**Síntoma:** Botón de descarga no funciona
**Causas posibles:**
- Problemas de permisos
- Configuración de impresión incorrecta

**Soluciones:**
1. Intenta nuevamente
2. Usa el botón "Vista Previa"
3. Si sigue sin funcionar, contacta soporte

## Contacto y Soporte

### ¿Necesitas Ayuda?

#### Canales de Soporte
1. **Email:** `soporte@almaia-rd.vercel.app`
2. **Teléfono:** +1-809-555-0123 (Lunes a Viernes, 9AM - 5PM)
3. **Chat en vivo:** Icono de chat en la esquina inferior derecha

#### Información Requerida para Soporte
Cuando contactes soporte, por favor incluye:
- Tu nombre y email
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

## Actualizaciones y Mantenimiento

### Cómo Mantener el Sistema

#### 1. Respaldos Regulares
- El sistema hace respaldos automáticos diarios
- Puedes descargar respaldos desde **Configuración** → **Respaldos**

#### 2. Actualizaciones Periódicas
- **Actualizaciones menores:** Automáticas (nueva funcionalidad)
- **Actualizaciones mayores:** Mensuales (cambios mayores)

#### 3. Mantención Preventiva
- Limpia caché del navegador regularmente
- Usa contraseñas seguras y cámbialas cada 90 días
- Mantén tus dispositivos actualizados

### Próximas Actualizaciones
- **Versión 2.0:** Módulo de inventario avanzado
- **Versión 2.1:** API para integración con terceros
- **Versión 2.2:** Aplicación móvil nativa

## Consejos y Mejores Prácticas

### 1. Optimiza tu Flujo de Trabajo
- Usa atajos de teclado:
  - `N` - Nuevo documento
  - `S` - Guardar
  - `P` - Imprimir
  - `F` - Buscar

### 2. Mantén tus Datos Actualizados
- Actualiza la información de clientes regularmente
- Verifica el stock semanalmente
- Revisa las facturas pendientes diariamente

### 3. Aprovecha las Características
- Configura plantillas de WhatsApp para comunicación automática
- Usa las recomendaciones de IA para cross-selling
- Configura alertas de stock bajo para evitar desabastecimiento

## Glosario de Términos

| Término | Significado |
|---------|------------|
| **ITBIS** | Impuesto al Valor Agregado (18% en República Dominicana) |
| **PV** | Puntos de Volumen (métrica de Amway) |
| **CRM** | Gestión de Relaciones con Clientes |
| **KPI** | Indicador Clave de Performance |
| **PWA** | Aplicación Web Progresiva (puede instalarse en móvil) |
| **PDF** | Formato de documento portátil (para facturas) |

## Recursos Adicionales

### 1. Centro de Ayuda
Visita `https://almaia-rd.vercel.app/help` para:
- Artículos de ayuda
- videos tutoriales
- preguntas frecuentes

### 2. Comunidad de Usuarios
Únete a nuestra comunidad:
- **Foro:** `community.almaia-rd.vercel.app`
- **Discord:** Servidor de Discord para soporte
- **Twitter:** `@AlmaiaRD` para actualizaciones

### 3. Capacitación y Certificación
- **Almaia Academy:** Cursos gratuitos en línea
- **Certificación:** Examen de certificación para consultores
- **Soporte prioritario:** Para usuarios certificados

## Agradecimientos

Desarrollado con ❤️ para la comunidad Amway en República Dominicana.

**© 2024-2025 Almaia RD - Todos los derechos reservados**

---
*Si tienes alguna pregunta o necesitas ayuda, no dudes en contactarnos. Estamos aquí para ayudarte a tener éxito con Almaia RD!*