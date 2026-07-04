# Guía de Solución de Problemas Comunes

## 1. La IA no responde o da error

**Síntoma:** El chat de recomendaciones, el análisis de inventario o el resumen de clientes muestra error.

**Causa:** Ollama no está corriendo en `localhost:11434`.

**Solución:**
```bash
bash ~/Desktop/AMWAY/Sistema\ de\ Facturacion/iniciar-ollama.sh
```
Verificar que el servidor esté activo:
```bash
curl http://localhost:11434/api/tags
```

## 2. No se envía el correo electrónico

**Síntoma:** Error al enviar factura/recibo por email.

**Causas posibles:**
- SMTP no configurado en Configuración → SMTP
- Contraseña incorrecta
- Puerto bloqueado por el ISP
- Gmail: requiere App Password (no la contraseña normal)

**Solución:** Ir a Configuración → SMTP, verificar los datos. Para Gmail, generar App Password en `https://myaccount.google.com/apppasswords`.

## 3. Los cambios no se reflejan después de actualizar

**Síntoma:** La interfaz sigue mostrando datos antiguos.

**Solución:** Hard-refresh: `Cmd+Shift+R` (Mac) o `Ctrl+Shift+R` (Windows). Vercel cachea archivos estáticos agresivamente.

## 4. Error al eliminar un producto

**Síntoma:** "No se puede eliminar el producto porque tiene movimientos asociados".

**Solución:** Abrir el modal de detalle del producto y usar el botón **"Forzar eliminación"**. Esto borra el producto junto con sus movimientos de inventario, facturas y compras asociados.

## 5. El stock no se actualiza al crear una factura

**Causa:** La factura se creó pero el stock no se descontó (error raro de concurrencia).

**Solución:** Verificar en Inventario → Rotación si el producto aparece como vendido. Si no, hacer un ajuste manual de stock.

## 6. La página de Pipeline está lenta

**Causa:** Muchos clientes con joins pesados (facturas, items, seguimientos).

**Solución:** Usar los filtros por etapa o nombre. El sistema carga todos los datos al abrir la página.

## 7. No encuentro un producto en Inventario

**Posibles causas:**
- El producto está **oculto** → activar toggle "Ver ocultos (N)"
- El producto nunca tuvo stock registrado → revisar en Catálogo
- El producto fue eliminado

## 8. Error "No se pudo conectar con Supabase"

**Solución:**
1. Verificar conexión a internet
2. Verificar que el proyecto Supabase esté activo en `https://supabase.com`
3. Verificar las claves en `.env.local`

## 9. Las recomendaciones del chat IA no son precisas

**Causa:** El modelo `llama3.2:1b` es pequeño. Las respuestas pueden ser genéricas.

**Solución:** Ser más específico en la descripción. Incluir detalles como: presupuesto, si es para uso personal o regalo, síntomas o necesidades concretas.

## 10. Error al desplegar en Vercel

**Síntoma:** Build falla con errores de TypeScript.

**Solución:** Correr `npm run build` localmente para identificar errores antes de pushear a `main`. Vercel despliega automáticamente desde la rama `main`.

---

*¿No encuentras tu problema? Contacta a soporte técnico.*
