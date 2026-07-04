# Guía de Configuración

## Acceso

Menú principal → **Configuración** (`/configuracion`)

## Pestañas

### 1. Negocio
| Campo | Descripción |
|-------|-------------|
| **Nombre del negocio** | Aparece en facturas y recibos |
| **Logo** | Imagen PNG/JPG (recomendado 500×500px) |
| **Firma digital** | Imagen para facturas |
| **Email de contacto** | Para que los clientes respondan |
| **Teléfono** | Número de contacto |

### 2. Facturación
| Campo | Descripción |
|-------|-------------|
| **Prefijo factura** | Ej: "FACT-" → FACT-0001 |
| **Prefijo recibo** | Ej: "REC-" → REC-0001 |
| **Prefijo compra** | Ej: "COMP-" → COMP-0001 |
| **Margen por defecto** | % de ganancia sugerido |
| **ITBIS** | 18% (fijo, no editable) |

### 3. SMTP (Correo Electrónico)
Configuración para enviar facturas/recibos por email:

| Campo | Descripción |
|-------|-------------|
| **Host** | Ej: `smtp.gmail.com` |
| **Puerto** | `587` (TLS) o `465` (SSL) |
| **Usuario** | Dirección de correo completa |
| **Contraseña** | Contraseña del correo o App Password |
| **SSL** | Activar para puerto 465 |

> **Para Gmail:** Usa una "App Password" de 16 caracteres (no la contraseña normal). Se genera en `https://myaccount.google.com/apppasswords`.

### 4. Plantillas
Variables disponibles en plantillas de email y WhatsApp:
- `{nombre}` → Nombre del cliente
- `{monto}` → Monto de factura/recibo
- `{fecha}` → Fecha actual

### 5. Prompts IA
Personaliza los prompts que se envían a Ollama:
- **Prompt de resumen de cliente:** Define cómo la IA analiza cada cliente
- **Prompt de aprendizaje:** Personaliza el enfoque de las notas de aprendizaje

Variables disponibles en prompts:
- `{cliente_nombre}` → Nombre del cliente
- `{cliente_email}` → Email
- `{cliente_telefono}` → Teléfono
- `{total_gastado}` → Total histórico
- `{ultima_compra}` → Fecha de última compra
- `{dias_sin_compra}` → Días desde última compra
- `{deuda}` → Deuda pendiente
- `{etiquetas}` → Tags del cliente

### 6. WhatsApp
Configuración de la API de WhatsApp Cloud (Meta):
- Crear, editar y eliminar configuraciones
- Cada configuración incluye: `phone_number_id`, `access_token`, `verify_token`, `business_account_id`
- Se almacena en la tabla `whatsapp_configs` de Supabase

## Persistencia
Toda la configuración se guarda en la tabla `settings` de Supabase (no en localStorage ni archivos).

---

*© 2024-2026 Almaia RD*
