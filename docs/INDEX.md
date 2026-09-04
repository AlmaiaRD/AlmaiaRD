# Índice de Documentación de Almaia RD

## Visión General

Sistema de gestión empresarial para distribución Amway en República Dominicana. Combina facturación, inventario, CRM, pipeline de ventas, comunicaciones, y análisis con IA local (Ollama).

## Navegación del Sistema

El menú se organiza en dos filas:

### Fila 1
| Módulo | Ruta | Descripción |
|--------|------|-------------|
| **📊 Estadísticas** | `/dashboard` | KPIs, metas, acceso rápido a módulos |
| **🧾 Facturas** | `/facturacion` | Emisión, gestión y envío de facturas |
| **📋 Recibos** | `/recibos` | Registro de pagos recibidos |
| **💸 Gastos** | `/gastos` | Registro y categorización de gastos |
| **📚 Catálogo** | `/catalogo` | Productos Amway con submarcas y duración |
| **🤖 Recomendaciones IA** | `/recomendaciones` | Asistente IA conversacional + recomendaciones |

### Fila 2
| Módulo | Ruta | Descripción |
|--------|------|-------------|
| **📦 Inventario** | `/inventario` | Stock, rotación, movimientos, análisis IA |
| **📅 CRM** | `/crm` | Calendario de actividades y seguimiento |
| **👥 Clientes** | `/clientes` | Base de datos completa de clientes |
| **🔀 Pipeline** | `/pipeline` | Dos pipelines: Compradores (ventas) y Negocio (reclutamiento). Drag & drop, batch actions, alertas de estancamiento |
| **✉️ Comunicaciones** | `/comunicaciones` | Historial de emails/WhatsApp enviados |
| **📓 Aprendizaje** | `/aprendizaje` | Notas de aprendizaje localStorage |
| **⚙️ Configuración** | `/configuracion` | SMTP, plantillas, prompts IA, WhatsApp |

## Estructura de la Documentación

### 1. Guías de Usuario
- **Guía de Inicio Rápido** — Introducción completa al sistema
- **Guía de Facturación** — Gestión de facturas
- **Guía de Catálogo y Bundles** — Productos, precios 30/35, combos
- **Guía de Gestión de Clientes** — CRUD y perfiles de clientes
- **Guía de Gestión de Inventario** — Stock, rotación, movimientos
- **Guía de Gestión de Gastos** — Registro y categorización
- **Guía de CRM y Pipeline** — Seguimiento, etapas, riesgos

### 2. Guías Detalladas
- **Guía de Compras** — Compras y proveedores
- **Guía de Créditos** — Cuentas por cobrar
- **Guía de Bonificaciones** — Sistema de bonificaciones y PV
- **Guía de PV** — Puntos de Volumen
- **Guía de Reportes** — Análisis e informes
- **Guía de Documentos** — Gestión de documentos varios

### 3. Guías de Características
- **WhatsApp Business** — Comunicación con clientes
- **Recomendaciones con IA** — Asistente conversacional + sugerencias
- **Comunicaciones** — Historial centralizado
- **Aprendizaje** — Notas personales
- **Configuración** — SMTP, plantillas, prompts IA

### 4. Guías de Procesos
- **Crear Factura**
- **Registrar Gasto**
- **Gestionar Cliente**
- **Mover Inventario**
- **Enviar WhatsApp**
- **Generar Reporte**

### 5. Capacitación
- **Almaia Academy** — Cursos en línea
- **Guía para Nuevos Usuarios**
- **Guía para Gerentes**

### 6. Solución de Problemas
- **Problemas Comunes**
- **Contacto y Soporte**
- **Actualizaciones y Mantenimiento**

### 7. Operaciones
- **Credenciales** — Inventario de servicios y contraseñas (confidencial)

## Formato de las Guías

Cada guía sigue: Visión General → Requisitos Previos → Flujo de Trabajo → Características Avanzadas → Solución de Problemas → Preguntas Frecuentes.

---

*Última actualización: 01 septiembre 2026*

### Estado Actual (Auditoría Septiembre 2026)
- ✅ **9/9 Tests E2E passing** (login, auth, api-docs x2, catalog-pdf x2, quotes-to-invoice)
- ✅ **51 Tests unitarios passing** (invoiceMath, utils, constants, preferences, openapi)
- ✅ **TypeScript: 0 errores** | **ESLint: 0 errores** (562 warnings preexistentes)
- ✅ **Seguridad hardenada**: RLS role-based en las 30 tablas, triggers seguros, secrets protegidos
- ✅ **Re-auditoría (03/09/2026)**: habilitado RLS en 6 tablas que tenían políticas pero RLS desactivado (categories, subbrands, client_tags, client_tag_relations, returns, return_items) + REVOKE SELECT anon en tablas sensibles
- ✅ **Rate-limit distribuido** (Upstash Redis) + fallback dev
- ✅ **CSP headers** + **Sourcemaps Sentry** habilitados
- ✅ **Validación Zod** en 18 API routes
- ✅ **Swagger/OpenAPI** generado desde Zod en `/docs`
- ✅ **Migración de limpieza**: REVOKE anon, DROP pol_*, CHECK constraints RPCs, RLS post-auditoría
