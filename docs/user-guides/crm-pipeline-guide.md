# Guía de CRM y Pipeline de Ventas

## Visión General

El CRM y Pipeline de Almaia RD permiten hacer seguimiento estructurado a clientes potenciales y existentes, con **dos pipelines separados**: uno para compradores de productos y otro para prospectos de negocio (IBO/Demo).

## Pipeline de Ventas (`/pipeline`)

### Dos Tipos de Clientes

| Tipo | Descripción | Pipeline |
|------|-------------|----------|
| **Cliente Comprador** | Persona que compra productos Amway | Pipeline de Ventas |
| **Prospecto de Negocio** | Posible IBO o persona para demostración | Pipeline de Reclutamiento |

### Pipeline de Ventas (Compradores)

| Etapa | Descripción | Color |
|-------|-------------|-------|
| 📋 **Prospecto** | Cliente nuevo, sin contacto | Azul |
| 📞 **Calificación** | Evaluando si es viable (submenu: Interesado, Calificado, No Calificado, En Espera) | Púrpura |
| 💬 **Contacto Inicial** | Primer contacto formal realizado | Naranja |
| 📄 **Propuesta** | Cotización enviada | Verde azulado |
| 🤝 **Negociación** | En proceso de cierre | Índigo |
| ✅ **Cierre** | Decisión final (submenu: Ganado, Perdido, Pospuesto) | Verde |

### Pipeline de Reclutamiento (Negocio)

| Etapa | Descripción | Color |
|-------|-------------|-------|
| 📋 **Prospecto** | Persona identificada | Azul |
| 📊 **Demo / Invitación** | Invitado a demostración | Púrpura |
| 📞 **Seguimiento Post-Demo** | Después de la demo | Naranja |
| 💼 **Presentación del Negocio** | Se le presentó el plan | Verde azulado |
| ❓ **Decisión** | Evaluando unirse o no | Índigo |
| ✅ **Inscripción** | Resultado (submenu: Inscrito, Rechazado, Pendiente) | Verde |

### Cómo Agregar Clientes al Pipeline

#### Opción 1: Desde el Pipeline (recomendado)
1. Click en **"Agregar al Pipeline"** (botón morado)
2. Seleccionar tipo: **Cliente Comprador** o **Prospecto de Negocio**
3. Elegir etapa inicial
4. Completar nombre, teléfono, email
5. Click en **"Agregar"**

El cliente se guarda automáticamente en la base de datos.

#### Opción 2: Desde Clientes
1. Ir a **Clientes** → **Añadir**
2. Seleccionar **Tipo de Cliente** (Comprador / Negocio)
3. Completar información
4. Guardar
5. Ir a Pipeline y mover a la etapa deseada

### Funcionalidades del Pipeline

#### Drag & Drop
- Arrastra clientes entre etapas para cambiar su estado
- El cursor cambia al pasar sobre una tarjeta

#### Batch Actions (Acciones en Lote)
1. Click en **"Seleccionar"** (botón inferior)
2. Marca los clientes a mover
3. Selecciona la etapa destino en el dropdown
4. Se mueven todos de una vez

#### Alertas de Estancamiento
- Si un cliente lleva **7+ días** sin movimiento en una etapa, aparece un badge amarillo: ⚠ Estancado (Xd)
- En el modal de detalle aparece una alerta llamativa

#### Quick Links
- **WhatsApp:** Click en el teléfono para abrir WhatsApp directo
- **Email:** Click en el email para enviar

### Tarjeta de Cliente
Cada tarjeta muestra:
- Nombre + badge de etapa + tags
- Teléfono (click para WhatsApp) + email
- **Compradores:** Total gastado, compras, días en etapa, PV
- **Negocio:** Días en etapa, fecha registro, número IBO, interés
- Selector de etapa rápido (dropdown)
- Badge de estancamiento si aplica

### Sub-Calificaciones

#### En "Calificación" (Compradores)
Al abrir el modal de un cliente en esta etapa, aparecen 4 opciones:
- **Interesado:** Muestra interés genuino
- **Calificado:** Tiene necesidad + capacidad de compra
- **No Calificado:** No es el perfil adecuado
- **En Espera:** Quiere pero no puede ahora

#### En "Cierre" (Compradores)
- **Ganado:** Compró 🎉
- **Perdido:** No compró
- **Pospuesto:** "Vuelvo en X meses"

#### En "Inscripción" (Negocio)
- **Inscrito:** Se unió al negocio
- **Rechazado:** No se interesó
- **Pendiente:** Aún decidiendo

### Auto-Progresión
- Al crear la **1ra factura** para un cliente en etapa pre-venta → se mueve automáticamente a **Cierre (Ganado)**
- Si tiene 3+ pagos → también se mueve a Cierre (Ganado)

### Filtros
- **Buscar:** Por nombre, teléfono o email
- **Filtrar por etapa:** Dropdown con todas las etapas
- **Filtrar por tipo:** Botones "Todos", "Compradores", "Negocio"

### Resumen IA
Cada cliente puede tener un resumen generado por Ollama que analiza:
- Historial de compras y pagos
- Riesgo de pérdida
- Próximos pasos sugeridos
- Productos recomendados

El prompt del resumen se personaliza en Configuración → Prompts IA.

### Análisis de Riesgo
Score calculado según:
- Días sin compra
- Deuda pendiente
- Frecuencia de compra
- Monto promedio

### Cross-Selling
Productos sugeridos basados en compras anteriores de clientes similares.

## CRM (`/crm`)

Vista de calendario para seguimiento de actividades:

### Calendario
- Diseño de 5 columnas (días laborales)
- Muestra eventos y actividades programadas por día
- Los eventos se crean desde el modal de cliente o directamente en el calendario

### Panel de Actividades
Lista lateral con las actividades más recientes y próximas:
- Tipo: llamada, reunión, recordatorio, seguimiento
- Cliente asociado
- Fecha y hora
- Estado (pendiente/completada)

## Gestión de Clientes (`/clientes`)

Base de datos completa con:
- **Búsqueda:** por nombre, email, teléfono o código
- **Tipo:** Comprador o Prospecto de Negocio
- **Etapa del pipeline:** Selector rápido desde la tarjeta
- **VIP:** automático cuando `total_gastado ≥ RD$50,000`
- **Historial:** facturas, recibos, créditos, seguimiento

### Tarjeta de Cliente en /clientes
- Badge de etapa del pipeline
- Badge de tipo (Negocio en púrpura)
- Selector de etapa rápido (dropdown)
- Saldo pendiente / a favor

## Comunicaciones con Clientes

### Envío de Facturas/Recibos
Desde la factura o recibo:
- **WhatsApp:** abre WhatsApp Web con mensaje predefinido
- **Email:** envía por SMTP configurado

### Historial Centralizado (`/comunicaciones`)
Todas las comunicaciones enviadas se registran:
- Cliente, tipo (email/WhatsApp), fecha, contenido
- Búsqueda y filtro por cliente
- Detalle con edición inline
- Reenvío directo desde el historial

## Aprendizaje (`/aprendizaje`)

Notas personales sobre clientes guardadas en el navegador (`localStorage`):
- Título, contenido, etiquetas
- Búsqueda y filtro por etiqueta

---

*© 2024-2026 Almaia RD*
