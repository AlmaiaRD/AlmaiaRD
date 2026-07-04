# Guía de Inicio Rápido — Almaia RD

## Acceso al Sistema

| | |
|---|---|
| **URL Producción** | `https://almaia-rd.vercel.app` |
| **Usuario** | `admin@almaia.com` |
| **Contraseña** | `Admin123!` |

## Navegación

El menú se divide en dos filas en escritorio (una columna en móvil):

**Fila 1:** Estadísticas · Facturas · Recibos · Gastos · Catálogo · Recomendaciones IA

**Fila 2:** Inventario · CRM · Clientes · Pipeline · Comunicaciones · Aprendizaje · Configuración

## Módulos Principales

### Dashboard (`/dashboard`)
KPIs del día/mes: ventas, cobros, ganancias, valor inventario, cuentas por cobrar, PV. Incluye barra de meta mensual y accesos rápidos a Bonificaciones, PV, Reportes, Documentos.

### Facturación (`/facturacion`)
- **Nueva factura:** seleccionar cliente → agregar items del catálogo → método de pago (efectivo/tarjeta/transferencia/crédito) → generar
- **Acciones:** imprimir PDF, enviar por WhatsApp o email, ver detalle

### Catálogo (`/catalogo`)
Productos con submarca, código, precio, costo. Cada producto tiene `duración_días` para calcular fecha de recompra. Vista en cuadrícula con búsqueda y filtro por submarca.

### Inventario (`/inventario`)
Dos pestañas principales:

**Stock:** Tabla de productos con stock actual, stock mínimo, capital invertido. Botones para ocultar/mostrar productos. Modal de detalle con historial de movimientos y opción de forzar eliminación.

**Rotación:** KPIs (total productos, rotación alta/media/baja, próximos a agotarse, capital inmovilizado), tabla con velocidad de venta (`díasDesdePrimeraCompra / unidadesVendidas`) y proyección de agotamiento (color: rojo <30d, amarillo <60d, verde ≥60d). Incluye filtros (submarca, rango de días, estado), exportación PDF/CSV, recomendaciones automáticas y análisis IA.

### Recomendaciones IA (`/recomendaciones`)
Asistente conversacional: escribe una situación en lenguaje natural (ej: "madre lactante con estrés") y la IA local (Ollama) responde con productos sugeridos del catálogo. También incluye pestañas de Productos, Clientes y Temporada.

### CRM (`/crm`)
Calendario con actividades y seguimiento de clientes. Vista de 5 columnas con eventos por día y panel lateral de actividades.

### Pipeline (`/pipeline`)
Dos pipelines separados:

**Compradores:** Prospecto → Calificación → Contacto Inicial → Propuesta → Negociación → Cierre

**Negocio:** Prospecto → Demo/Invitación → Seguimiento Post-Demo → Presentación del Negocio → Decisión → Inscripción

Funcionalidades: drag & drop entre etapas, batch actions, alertas de estancamiento (7+ días), sub-calificaciones, auto-progresión al crear factura, botón "Agregar al Pipeline" directo.

### Comunicaciones (`/comunicaciones`)
Historial centralizado de todos los emails y WhatsApp enviados. Búsqueda y filtro por cliente/tipo. Modal de detalle con edición inline y reenvío.

### Aprendizaje (`/aprendizaje`)
Notas personales guardadas en el navegador (localStorage). Crear, editar, eliminar con búsqueda y filtro por etiquetas.

### Configuración (`/configuracion`)
Pestañas: Negocio (logo, nombre, prefijos), SMTP (host, puerto, usuario, contraseña), Plantillas (email/WhatsApp con variables `{nombre}`, `{monto}`, `{fecha}`), Prompts IA (personalizar prompt de resumen de cliente y de aprendizaje), WhatsApp (configuración de API).

## Características Transversales

### IA Local (Ollama)
Motor de IA corriendo en `localhost:11434` con modelo `llama3.2:1b`. Se usa para:
- Chat de recomendaciones (`/api/ai-chat`)
- Análisis de rotación (`/api/inventory-analysis`)
- Resumen de clientes (`/api/client-summary`)

Para iniciar:
```bash
bash ~/Desktop/AMWAY/Sistema\ de\ Facturacion/iniciar-ollama.sh
```

### Ocultar/Mostrar Productos
En las tablas de Stock y Rotación, cada producto tiene un botón de texto "Ocultar" que lo archiva visualmente sin eliminarlo. Un toggle "Ver ocultos (N)" muestra los archivados con botón "Mostrar" para restaurarlos. Los IDs ocultos se guardan en `localStorage` con claves separadas por pestaña.

### Duración de Producto (`duracion_dias`)
Cada producto en el catálogo tiene un campo de duración estimada (7, 15, 30, 60, 90 días). Se usa para calcular la fecha de recompra sugerida para cada cliente.

## Solución de Problemas Comunes

| Problema | Causa | Solución |
|----------|-------|----------|
| IA no responde | Ollama no está corriendo | Ejecutar `iniciar-ollama.sh` |
| Error al enviar email | SMTP no configurado | Ir a Configuración → SMTP |
| Producto no se elimina | Tiene movimientos asociados | Usar "Forzar eliminación" en el modal de detalle |
| Stock no se actualiza | Caché del navegador | Hard-refresh (Cmd+Shift+R) |
| Pipeline lento | Muchos datos | Los join de clientes pueden ser pesados |

---

*© 2024-2026 Almaia RD*
