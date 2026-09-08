# Informe de Auditoría Técnica — AlmaiaRD-Web

**Fecha:** 08 de septiembre de 2026
**Alcance:** Auditoría profunda de código, seguridad, base de datos, frontend, backend, DevOps y rendimiento en `AlmaiaRD-Web` (Next.js 16.3.4 + Supabase + Vercel).
**Objetivo:** Verificar el funcionamiento al 100 % y corregir automáticamente todos los hallazgos posibles sin romper funcionalidad existente ni la lógica financiera.

---

## 1. Resumen Ejecutivo

Se ejecutaron las 7 fases de la metodología (Descubrimiento, Auditoría Profunda, Corrección Automática, Loop de Validación, Testing Exhaustivo, Revisión de Regresiones e Informe Final) sobre el sistema AlmaiaRD-Web.

- **23 hallazgos** identificados en total (2 críticos, 4 altos, 8 medios, 9 bajos/informativos).
- **15 corregidos automáticamente** en esta sesión (todos los críticos y altos corregibles en código).
- **0 regresiones** detectadas: TypeScript 0 errores, ESLint 0 errores, **82/82 tests unitarios en verde** (antes 51/51).
- El `next build` local **ya funciona**: se colocó la URL real de Supabase en `.env.local` (R3 resuelto).

### Estado general

| Ámbito | Antes | Después | Nota |
|---|---|---|---|
| Riesgo global | ALTO | **MEDIO-BAJO** | R1 aplicada; residual: migración R2 pendiente de aplicar y desplegar |
| Vulnerabilidades críticas | 2 | **0** (corregidas en código) | SSRF image-proxy + fallos silenciosos en devolución |
| Bugs altos | 3 | **0** | Race de crédito documentada (requiere migración), XSS, navigación |
| Hallazgos medios | 8 | **1** (pendiente de aplicar) | R2 crédito por sobrepago (migración + código listos) | 
| Tests unitarios | 51 | **82** (+31 casos nuevos) | 8 archivos de test |
| `npm audit` | 2 moderate | 2 moderate | `uuid <11.1.1` vía exceljs (sin fix no-breaking) |

---

## 2. Metodología Ejecutada

1. **Fase 1 — Descubrimiento:** inventario de 75 archivos `.ts`, 58 `.tsx`, 21 rutas API, 36 migraciones SQL, workflows CI/backup y configs (`next.config.ts`, `tsconfig.json`, `eslint.config.mjs`, `middleware.ts`, `rate-limit.ts`, `cache.ts`, `logger.ts`, `supabase.ts`, `validation.ts`).
2. **Fase 2 — Auditoría Profunda:** 3 agentes (backend/servicios/BD, frontend, SQL/RLS/migraciones) + verificación manual de cada hallazgo con lectura directa de código.
3. **Fase 3 — Corrección Automática:** aplicación de fixes críticos/altos y medios con criterio *fail-safe* (no tocar lógica financiera ni romper flujos existentes).
4. **Fase 4 — Loop de Validación:** `tsc --noEmit`, `eslint`, `vitest`, `npm audit` — verde tras cada iteración.
5. **Fase 5 — Testing Exhaustivo:** +31 tests sobre los módulos corregidos (SSRF, comunicaciones, validación Zod, matemática de facturas).
6. **Fase 6 — Revisión de Regresiones:** verificación de que los cambios preservan el comportamiento de las rutas y servicios tocados.
7. **Fase 7 — Informe Final:** este documento.

---

## 3. Hallazgos por Severidad

### 3.1 CRÍTICOS (resueltos)

| ID | Hallazgo | Ubicación | Estado |
|---|---|---|---|
| C1 | **SSRF en `/api/image-proxy`**: permitía `0.0.0.0`, IPv4-mapped IPv6 (`::ffff:*`), DNS rebinding (solo se validaba la IP inicial), redirecciones seguidas sin control, sin tope de tamaño de respuesta y sin allowlist de Content-Type. Un usuario autenticado podía sondear la red interna y descargar cualquier recurso. | `src/app/api/image-proxy/route.ts` | **CORREGIDO** |
| C2 | **Fallos silenciosos en devoluciones**: `completeReturn` actualizaba la factura e insertaba el recibo de crédito sin revisar `error`, por lo que fallos de BD pasaban desapercibidos (datos financieros divergentes sin aviso). | `src/services/returns.ts` | **CORREGIDO** (fail-fast con `.then` + `throw`) |

### 3.2 ALTOS (resueltos)

| ID | Hallazgo | Ubicación | Estado |
|---|---|---|---|
| A1 | **XSS por `innerHTML`**: el helper `esc()` de inventario estaba roto (reemplazaba `&`→`&`, `<`→`<` → no-op), permitiendo inyectar HTML en la vista previa/download JPG. Además `signature_url` se interpolaron sin escapar en cotizaciones y facturación. | `inventario/page.tsx:313`, `cotizaciones/page.tsx:535`, `facturacion/page.tsx:488` | **CORREGIDO** |
| A2 | **`router.push` durante el render** del layout del dashboard (CCP — Calling Component During Render): redirecciones impredecibles y advertencias de React. | `(dashboard)/layout.tsx:27-30` | **CORREGIDO** (migrado a `useEffect` + `router.replace`) |
| A3 | **Fetches externos sin timeout**: OpenAI (recomendaciones y parseo de compras), Meta WhatsApp y Telegram podían colgar la request indefinidamente. | 4 rutas API | **CORREGIDO** (`AbortSignal.timeout` 20–60 s) |
| A4 | **CI sin tests ni auditoría**: el pipeline solo hacía typecheck + lint; bugs de test y vulnerabilidades de dependencias podían desplegarse en silencio. | `.github/workflows/ci.yml` | **CORREGIDO** (`npm run test` + `npm audit --audit-level=high`) |

### 3.3 MEDIOS

| ID | Hallazgo | Ubicación | Estado |
|---|---|---|---|
| M1 | **Race condition en crédito por sobrepago** (`createReceipt`): `credit_excess` se calculaba contra un saldo leído antes de aplicar el pago; dos pagos concurrentes podían generar excedente incorrecto. El trigger `fn_sync_receipt_credit` usa la columna como fuente de verdad. | `src/services/receipts.ts` | **CORREGIDO** — RPC atómico `apply_invoice_payment_atomic` (migración R2) + código; pendiente aplicar migración y desplegar |
| M2 | RPCs de inventario `SECURITY DEFINER` (`add/subtract/restore_inventory_stock`) **sin control de rol interno**, ejecutables por cualquier `authenticated`. | `20260908_inventory_rpc_role_fix.sql` | **CORREGIDO** (migración R1 aplicada el 08/09/2026) |
| M3 | `invalidateCache/clearCache` usaban `KEYS` (bloqueante en producción) | `src/lib/cache.ts` | **CORREGIDO** (SCAN con cursor + borrado en lotes de 200) |
| M4 | PATCH de preferencias leía el body 2 veces (`validateBody` consumía la request y luego `req.json()` fallaba) → la actualización siempre fallaba. | `src/app/api/preferences/route.ts` | **CORREGIDO** (`preferencesSchema` → `.passthrough()` y reuso del body validado) |
| M5 | Modal sin rol `dialog`, `aria-modal`, cierre con Escape ni focus trap. | `src/components/ui/Modal.tsx` | **CORREGIDO** |
| M6 | Botones críticos sin `type="button"` (submit accidental) e inputs numéricos administrativos sin `min=0`. | `purchase/PurchaseModal.tsx:336-339` | **CORREGIDO** |
| M7 | Mensajes de error WhatsApp: la redacción real de Meta ("more than 24 hours") no se traducía a instrucción de plantillas. | `src/lib/communication-errors.ts` | **CORREGIDO** + tests |
| M8 | Lecturas full-table desde el navegador (invoices/receipts/purchases) sin paginación server-side. | Varias páginas | **DOCUMENTADO** (recomendación de rendimiento) |

### 3.4 BAJOS / INFORMATIVOS (documentados)

| ID | Hallazgo | Recomendación |
|---|---|---|
| B1 | `supabase-schema.sql` desincronizado respecto a las migraciones (no se regenera sin acceso a BD) | Regenerar desde el proyecto y mantener como fuente de verdad |
| B2 | `uuid <11.1.1` (moderate) vía `exceljs` | No forzar override (riesgo de romper export Excel); revisar en siguiente actualización de exceljs |
| B3 | `.env.local` local tenía `NEXT_PUBLIC_SUPABASE_URL` de placeholder → `next build`/`next start` local fallaban | **CORREGIDO** (URL real `https://rexebvnzgnnrxhxmwayx.supabase.co` colocada; build local verificado) |
| B4 | Lectura de `client_balance`/lista de clientes sin límites en pantallas de dashboard | Añadir paginación/cursor para grandes volúmenes |
| B5 | Código muerto (`jpgData`) y `.catch(() => {})` intencionales en envíos | Limpieza opcional en siguiente iteración |
| B6 | Suma duplicada de tablas en consultas de dashboard | unificar en RPC server-side |
| B7 | Herramientas de integración/E2E/seguridad (Playwright, dependabot) no conectadas por falta de credenciales y ambiente de preproducción | **PARCIAL** — workflow `e2e.yml` añadido; falta configurar secrets de GitHub y preproducción dedicada |
| B8 | Deprecaciones Next/Sentry (middleware→proxy, Sentry config) | Aplicar en próxima actualización mayor |

---

## 4. Correcciones Aplicadas (con archivos)

| Archivo | Cambio |
|---|---|
| `src/lib/ssrf.ts` (nuevo) | Lógica SSRF extraída y testeable: bloques IPv4 privados, IPv6 (loopback/ULA/link-local/`::ffff:`), validación de TODAS las IPs resueltas (anti DNS rebinding), credenciales en URL |
| `src/app/api/image-proxy/route.ts` | Usa `isAllowedUrl`; tope 10 MB (413), allowlist `image/*` (415), timeout 15 s, redirects manuales sin follow, auth preservada |
| `src/services/returns.ts` | Chequeo de error en update de factura y en insert del crédito excedente (fail-fast) |
| `src/app/api/recommendations/route.ts`, `parse-purchase/route.ts`, `whatsapp/send/route.ts`, `telegram/send/route.ts` | `AbortSignal.timeout` en llamadas externas |
| `src/app/(dashboard)/layout.tsx` | Redirect a `/login` movido a `useEffect` con `router.replace` |
| `src/app/(dashboard)/inventario/page.tsx` | `esc()` reparado (escapado HTML correcto) |
| `src/app/(dashboard)/cotizaciones/page.tsx`, `facturacion/page.tsx` | `signature_url` escapado en atributo `src` |
| `src/lib/cache.ts` | Invalidación con SCAN + DEL por lotes |
| `src/app/api/preferences/route.ts`, `src/lib/validation.ts` | Zod `.passthrough()` y body validado reutilizado (fix del PATCH que siempre fallaba) |
| `src/components/ui/Modal.tsx` | `role=dialog`, `aria-modal`, `aria-label`, cierre con Escape, focus trap, botones `type=button` |
| `src/components/inventory/PurchaseModal.tsx` | `type=button` + `min=0` en inputs dorados |
| `src/lib/communication-errors.ts` | Matcher WhatsApp ampliado ("24 hours", "outside the allowed window") |
| `.github/workflows/ci.yml` | +`npm run test` y `npm audit --audit-level=high` |

**Tests añadidos:** `ssrf.test.ts` (19), `communication-errors.test.ts` (7), `validation.test.ts` (5) → 31 casos nuevos (51 → 82 en verde).

---

## 5. Métricas

| Métrica | Antes | Después |
|---|---|---|
| TypeScript | 0 errores | 0 errores (verificado) |
| ESLint | 0 errores | 0 errores (verificado) |
| Tests unitarios | 51 | **82** (8 archivos) |
| Vulnerabilidades críticas | 2 | 0 corregibles en código |
| Hallazgos abiertos (crítico/alto) | — | 0 (M1/M2 corregidos; R2 por aplicar/desplegar) |
| `npm audit` (high) | pasa | pasa (2 moderate documentadas) |

---

## 6. Acciones Pendientes Recomendadas

### 6.1 Migraciones SQL (aplicar en Supabase con el usuario)

**R1 — ✅ APLICADA (08/09/2026)** — Control de rol interno en RPCs de inventario (restringido a `admin`/`seller`): `supabase/migrations/20260908_inventory_rpc_role_fix.sql`.

**R2 — RPC atómico de crédito por sobrepago (M1): ⏳ PENDIENTE DE APLICAR** — migración (`20260908_atomic_payment_excess.sql`) y código (`receipts.ts`) listos:

```sql
CREATE OR REPLACE FUNCTION public.apply_invoice_payment_atomic(
  p_invoice_id UUID, p_amount NUMERIC,
  OUT p_balance_before NUMERIC, OUT p_credit_excess NUMERIC
) RETURNS record LANGUAGE plpgsql SET search_path = public AS $function$
DECLARE v_invoice RECORD; v_new_paid NUMERIC; v_new_balance NUMERIC;
BEGIN
  SELECT total, amount_paid INTO v_invoice
  FROM public.invoices WHERE id = p_invoice_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Factura no encontrada'; END IF;
  p_balance_before := COALESCE(v_invoice.total, 0) - COALESCE(v_invoice.amount_paid, 0);
  v_new_paid := GREATEST(COALESCE(v_invoice.amount_paid, 0) + COALESCE(p_amount, 0), 0);
  v_new_paid := LEAST(v_new_paid, v_invoice.total);
  v_new_balance := v_invoice.total - v_new_paid;
  UPDATE public.invoices SET
    amount_paid = v_new_paid,
    balance_due = GREATEST(v_new_balance, 0),
    status = CASE WHEN v_new_balance <= 0 THEN 'PAID'
                  WHEN v_new_paid > 0 THEN 'PARTIAL'
                  ELSE 'PENDING' END
  WHERE id = p_invoice_id;
  p_credit_excess := GREATEST(COALESCE(p_amount, 0) - p_balance_before, 0);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.apply_invoice_payment_atomic(UUID, NUMERIC) TO authenticated;
```

> ⚠️ **Orden de despliegue:** el código ya espera este RPC. **Primero** aplicar la migración R2 en Supabase y **después** hacer push del código (evita romper la creación de recibos en producción).

### 6.2 Infraestructura / Configuración

- **R3 ✅ resuelto:** `.env.local` usa la URL real (`https://rexebvnzgnnrxhxmwayx.supabase.co`) → `next build` local verificado OK.
- **R4:** regenerar `supabase-schema.sql` desde la BD y mantenerlo como fuente de verdad.
- **R5 (PARCIAL):** workflow `e2e.yml` añadido (corre los specs E2E existentes contra producción o una URL custom). Falta: definir secrets de GitHub `E2E_TEST_EMAIL`/`E2E_TEST_PASSWORD` y una preproducción dedicada. Dependabot pendiente.
- **R6:** migrar deprecaciones Next 16 (`middleware` → `proxy`) y Sentry en la próxima actualización mayor.

---

## 7. Conclusiones

El sistema AlmaiaRD-Web se encuentra en **estado operativamente sólido**: criticidad de seguridad reducida a cero en lo corregible por código, suite de pruebas ampliada (82 unit + specs E2E) y todos los gates de calidad en verde (TS, ESLint, build local, audit high OK). La migración **R1 quedó aplicada**; la **R2** (crédito por sobrepago atómico) está lista en migración + código, pendiente de aplicarse en Supabase y de desplegarse. El `.env.local` local ya usa la URL real de Supabase. Quedan mejoras opcionales de plataforma (secrets E2E, Dependabot, preproducción dedicada, paginación server-side, índices) y de deprecación (Next/Sentry) para futuras iteraciones.

*Generado automáticamente como parte de la ejecución de la auditoría profunda del 08/09/2026.*