# Política de Rotación de Secretos - AlmaiaRD

## Resumen
Este documento define la política y procedimiento para la rotación periódica de secretos y credenciales del sistema AlmaiaRD.

---

## Secretos Críticos (Rotar cada 90 días)

| Secreto | Dónde se usa | Cómo rotar | Responsable |
|---------|--------------|------------|-------------|
| `ADMIN_PASSWORD` | Login admin, scripts de BD | Supabase Dashboard → Authentication → Users → Edit | DevOps |
| `SUPABASE_SERVICE_ROLE_KEY` | Scripts admin, migraciones, CI | Supabase Dashboard → Settings → API → Regenerate | DevOps |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Frontend, API routes | Se regenera con service_role (son pares) | DevOps |
| `GROQ_API_KEY` | IA gratuita (parse-purchase, chat) | Console Groq → API Keys → Regenerate | Dev Team |
| `OPENAI_API_KEY` | IA pagada (opcional) | Platform OpenAI → API Keys → Regenerate | Dev Team |

---

## Secretos de Integración (Rotar cada 180 días)

| Secreto | Dónde se usa | Cómo rotar | Responsable |
|---------|--------------|------------|-------------|
| `TWILIO_AUTH_TOKEN` | WhatsApp Business API | Twilio Console → Regenerate | Dev Team |
| `TELEGRAM_BOT_TOKEN` | Bot de Telegram | BotFather → /revoke + /newbot | Dev Team |
| `SMTP_PASSWORD` | Envío de correos (Gmail App Password) | Google Account → Security → App Passwords | DevOps |

---

## Procedimiento de Rotación

### 1. Preparación (1 día antes)
```bash
# 1. Crear nuevo secreto en el proveedor
# 2. Actualizar en .env.local (desarrollo)
# 3. Actualizar en Vercel Dashboard → Settings → Environment Variables
# 4. Actualizar en GitHub Secrets (si aplica)
# 5. Actualizar en Supabase Vault (si aplica)
```

### 2. Rotación (ventana de mantenimiento)
```bash
# 1. Desplegar con nuevo secreto (Vercel redeploy automático al cambiar env var)
# 2. Verificar logs: npm run build && npm run test
# 3. Probar funcionalidad crítica: login, factura, cobro, IA
# 4. Revocar secreto antiguo en proveedor
```

### 3. Post-rotación
```bash
# 1. Confirmar que no hay errores 401/403 en logs (Sentry/Vercel)
# 2. Actualizar este documento con fecha de rotación
# 2. Notificar al equipo en Slack/Email
```

---

## Variables de Entorno por Entorno

### Desarrollo (`.env.local`)
```bash
# Solo valores de desarrollo - NUNCA usar producción
NEXT_PUBLIC_SUPABASE_URL=https://dev-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
ADMIN_PASSWORD=dev-only-password
GROQ_API_KEY=gsk_dev_...
```

### Staging (Vercel Preview)
```bash
# Variables inyectadas por Vercel desde GitHub Secrets
NEXT_PUBLIC_SUPABASE_URL=https://staging-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
ADMIN_PASSWORD=${{ secrets.ADMIN_PASSWORD_STAGING }}
GROQ_API_KEY=${{ secrets.GROQ_API_KEY }}
```

### Producción (Vercel Production)
```bash
# Variables inyectadas por Vercel desde GitHub Secrets
NEXT_PUBLIC_SUPABASE_URL=https://prod-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
ADMIN_PASSWORD=${{ secrets.ADMIN_PASSWORD_PROD }}
GROQ_API_KEY=${{ secrets.GROQ_API_KEY_PROD }}
SUPABASE_SERVICE_ROLE_KEY=${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
```

---

## Auditoría y Cumplimiento

| Frecuencia | Acción | Herramienta |
|------------|--------|-------------|
| Diaria | Verificar alertas de Sentry/Vercel | Sentry Dashboard |
| Semanal | Revisar Dependabot PRs | GitHub Security |
| Mensual | Revisar logs de acceso anómalo | Supabase Logs / Vercel Logs |
| Trimestral | Rotación completa + auditoría | Checklist manual |
| Anual | Revisión de política | Equipo completo |

---

## Contactos de Emergencia

| Rol | Contacto | Canal |
|-----|----------|-------|
| DevOps Lead | [nombre] | Slack #devops + Tel |
| Security Lead | [nombre] | Slack #security + Tel |
| CTO | [nombre] | Email + Tel |

---

## Historial de Rotaciones

| Fecha | Secreto | Responsable | Notas |
|-------|---------|-------------|-------|
| 2026-10-03 | ADMIN_PASSWORD, SERVICE_ROLE_KEY | [usuario] | Rotación inicial post-auditoría |
| | | | |
| | | | |

---

**Última actualización:** 2026-10-03  
**Próxima revisión:** 2027-01-03  
**Versión:** 1.0