# Guía de Gestión de Clientes

## Visión General

El módulo de **Clientes** (`/clientes`) es la base de datos central de todos los clientes y prospectos de Almaia RD. Desde aquí puedes crear, editar, eliminar y ver el historial completo de cada persona.

## Tipos de Cliente

| Tipo | Descripción | Pipeline |
|------|-------------|----------|
| **Cliente Comprador** | Persona que compra productos Amway | Pipeline de Ventas |
| **Prospecto de Negocio** | Posible IBO, persona para demo o reclutamiento | Pipeline de Reclutamiento |

## Acceso

Menú principal → **Clientes** (`/clientes`)

## Crear un Cliente

### Desde Clientes
1. Click en **"Añadir"** (botón morado, esquina superior derecha)
2. Seleccionar **Tipo de Cliente**:
   - **Cliente Comprador** — Para personas que compran productos
   - **Prospecto de Negocio** — Para posibles IBOs o demos
3. Completar información:
   - **Nombre completo** (requerido)
   - **Teléfono**
   - **Email**
   - **Número IBO** (opcional, para prospectos de negocio)
   - **Notas**
4. Click en **"Guardar"**

### Desde Pipeline (recomendado)
1. Ir a **Pipeline**
2. Click en **"Agregar al Pipeline"**
3. Seleccionar tipo y etapa inicial
4. Completar datos
5. Click en **"Agregar"**

El cliente se crea automáticamente en la base de datos.

## Ver Detalle de un Cliente

1. Click en el nombre del cliente en la lista
2. Se abre un modal con pestañas:

### Pestaña Información
- Notas del cliente
- Total facturado vs total pagado
- Saldo pendiente

### Pestaña Facturas
- Lista de todas las facturas del cliente
- Número, fecha, monto, estado

### Pestaña Pagos
- Lista de todos los recibos/pagos
- Número, fecha, método, monto

### Pestaña Créditos
- Saldos a favor disponibles
- Estado: Disponible / Usado / Vencido

### Pestaña Seguimiento
- Historial de actividades de seguimiento
- Agregar nueva actividad
- Marcar como completada/pendiente

## Editar un Cliente

1. Click en el ícono de **lápiz** (✏️) junto al cliente
2. Modificar la información necesaria
3. Click en **"Guardar"**

## Eliminar un Cliente

1. Click en el ícono de **basura** (🗑️) junto al cliente
2. Confirmar la eliminación
3. El cliente se elimina permanentemente

**Nota:** Si el cliente tiene facturas asociadas, usa la eliminación forzada desde el panel de administración.

## Selector de Etapa del Pipeline

Desde la tarjeta del cliente en la lista, hay un **dropdown** que permite cambiar la etapa del pipeline directamente:

1. Seleccionar la etapa deseada del dropdown
2. La etapa se actualiza automáticamente
3. El badge de etapa se refleja al instante

## Buscar Clientes

 Usa la barra de búsqueda para encontrar clientes por:
- Nombre
- Teléfono
- Email
- Número IBO

## Panel de Estado de Cuenta

En el panel lateral derecho:
- **Cartera total (pendiente):** Suma de todos los saldos pendientes
- **Saldos a favor:** Total de créditos disponibles
- **Accesos rápidos:** Links a Saldos a Favor y Seguimiento

## Características Avanzadas

### Tags y Etiquetas
- Asignar tags para categorizar clientes
- Tags visibles en las tarjetas del pipeline
- Filtrar por tag en el pipeline

### Créditos
- Los clientes pueden tener saldos a favor
- Los créditos se crean cuando pagan de más
- Se pueden usar en compras futuras

### Seguimiento
- Registrar actividades de seguimiento
- Marcar como completadas o pendientes
- Historial cronológico

### VIP
- **Automático:** Cuando `total_gastado ≥ RD$50,000`
- Badge especial en la tarjeta

### Inactivo
- **Automático:** Cuando `días_sin_compra > 90`
- Badge de advertencia en el pipeline

## Solución de Problemas

| Problema | Solución |
|----------|----------|
| No puedo eliminar un cliente | Verificar que no tenga facturas asociadas |
| El pipeline no se actualiza | Hard-refresh (Cmd+Shift+R) |
| No aparece el tipo de cliente | Ejecutar migración SQL en Supabase |
| La etapa no se guarda | Verificar conexión a internet |

---

*© 2024-2026 Almaia RD*
