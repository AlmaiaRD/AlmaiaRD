# Auditoría de verificación — Almaia RD

**Fecha:** 2026-10-28
**Alcance:** re-ejecución de las comprobaciones de `AUDITORIA-2026-10-02.md` sobre la base de datos en producción y el árbol de trabajo actual (rama `feature/offline`).
**Modo:** solo lectura. No se modificó ningún dato, política ni configuración.
**Método:** consultas REST con `service_role` (lectura), sondas con la clave `anon` sobre UUID inexistentes (sin escritura), `npm audit`, `tsc --noEmit`, `vitest`, `next build` y `eslint`.

---

## 1. Resumen ejecutivo

| Área | Resultado |
|---|---|
| Seguridad de la API (hallazgos C1/C5 de octubre) | ✅ **Corregida en producción** |
| Integridad de datos financieros | ✅ Sin huérfanos, sin stock negativo, facturas y compras cuadradas |
| Créditos a favor de clientes | ⚠️ **2.161,00 RD$ potencialmente ficticios** |
| Dependencias de producción | ⚠️ **3 críticas, 3 altas, 2 moderadas** |
| TypeScript | ✅ 0 errores |
| Pruebas unitarias | ✅ 220/220 |
| Build de producción | ✅ OK |
| ESLint | ❌ **No arranca (error de configuración)** |
| Secretos versionados | ✅ Ninguno |

**Conclusión:** la corrección de seguridad de la auditoría anterior sí llegó a producción y los datos financieros están íntegros, pero quedan dos frentes reales: **créditos ficticios por 2.161,00 RD$** (heredados del bug C4) y **dependencias con vulnerabilidades críticas**, además de una **puerta de lint rota** que impide ejecutar `npm run verify`.

---

## 2. Hallazgos

### H1 — CRÍTICO — Créditos ficticios por 2.161,00 RD$ (3.015,28 a revisar)

El bug C4 de la auditoría del 2 de octubre (trigger `fn_sync_receipt_credit` fabricando crédito en pagos que no generaban excedente) **dejó datos en producción**.

Créditos actualmente `AVAILABLE` (`credit_balances`), contrastados contra el pago real de cada factura:

| Crédito | Recibo origen | Factura | Pagado | Total factura | Exceso real | Diferencia |
|---:|---|---|---:|---:|---:|---:|
| 50,00 | *(sin recibo)* | FAC-000004 | 2.100,00 | 2.050,00 | 50,00 | 0,00 |
| 844,05 | REC-000006 | FAC-000007 | 5.504,05 | 4.700,00 | 804,05 | **+40,00** |
| 0,23 | REC-000014 | FAC-000020 | 8.293,00 | 8.292,77 | 0,23 | 0,00 |
| **1.000,00** | **REC-000015** | FAC-000019 | 1.000,00 | 1.000,00 | **0,00** | **+1.000,00** |
| **1.121,00** | **REC-000016** | FAC-000014 | 1.121,00 | 1.121,00 | **0,00** | **+1.121,00** |
| **Total** | | | | | | **3.015,28** |

- **Sobrepagos reales:** 854,28 RD$ (50,00 + 804,05 + 0,23) → crédito legítimo.
- **Potencialmente ficticio:** **2.161,00 RD$** (1.000,00 + 1.121,00 + 40,00).
- **Detectados por la consulta de auditoría de la propia migración:** 3 filas, 2.965,05 RD$ (REC-000006, REC-000015 y REC-000016, todas con `credit_excess = 0`).
- El crédito de 50,00 **no tiene recibo asociado** (`receipt_id = NULL`), por lo que la consulta de la migración no lo lista; requiere revisión manual.
- Los 5 créditos están **disponibles** (no consumidos) y `clients.credit_balance` coincide exactamente con su suma en los 38 clientes. Es decir, el sistema los da por buenos y **pueden aplicarse a facturas futuras**, reduciendo las cuentas por cobrar.
- Todos los créditos son anteriores al 2 de octubre; no hay evidencia de créditos nuevos generados por el bug después de la corrección.

**Decisión requerida:** el dueño del negocio debe confirmar cuáles son reales. La migración `20260910_fix_receipt_credit_excess_fallback.sql` incluye la consulta y el procedimiento de limpieza manual (no destructivo).

**No verificable con los medios actuales:** si esa migración está aplicada en producción (requiere token de Management API; ver §6).

---

### H2 — CRÍTICO — Dependencias de producción vulnerables

`npm audit --omit=dev`: **11 vulnerabilidades** (3 críticas, 3 altas, 2 moderadas, 3 bajas).

| Paquete | Instalado | Severidad | Corrección |
|---|---|---|---|
| `next` | 16.3.8 | **crítica** | 16.4.3 |
| `@sentry/nextjs` | 10.73.0 | **crítica** | 10.78.0 |
| `dompurify` (vía `jspdf` y `swagger-ui-react`) | 3.4.16 | **crítica** | 3.4.17 |
| `sharp` (vía `next`) | 0.35.4 | alta | 0.35.5 |
| `source-map-js` | 1.2.1 | alta | 1.2.2 |
| `zod` | 4.4.3 | alta | 4.6.7 |
| `fast-uri` (vía Sentry → webpack) | 3.1.8 | moderada | actualizar |
| `nodemailer` | 10.0.13 | moderada | 10.2.1 |
| `deepmerge` / `swagger-ui-react` / `swagger-client` | — | baja | exigiría `swagger-ui-react` 4.1.3 (no recomendado) |

**Avisos críticos de Next.js:**
- `GHSA-2464-fhr4-w9xw` — RCE sin autenticar en la API de optimización de imágenes usando SVG.
- `GHSA-673q-mjm6-r5xr` — RCE en funciones `use cache` que devuelven arrays tipados.

**Mitigantes actuales:** la aplicación **no usa `use cache`** y `next.config.ts` **no habilita** `dangerouslyAllowSVG` en el optimizador. El aviso de Sentry (bypass de middleware con *tunnel route*) tampoco aplica porque no se configura `tunnelRoute`. Aun así, la actualización es de rango compatible y debe hacerse.

`npm audit fix` (sin `--force`) resuelve la mayoría: los rangos declarados (`^16.3.8`, `^4.4.3`, `^10.73.0`, `^10.0.13`) admiten las versiones corregidas. `dompurify`, `sharp` y `source-map-js` son transitivas: se corrigen con `overrides` en `package.json`.

---

### H3 — MEDIO — ESLint no arranca (puerta de calidad rota)

```
A configuration object specifies rule "react-hooks/set-state-in-effect",
but could not find plugin "react-hooks".
```

**Causa:** en `eslint.config.mjs` el objeto propio activa la regla `react-hooks/set-state-in-effect`, pero el plugin solo está declarado en el objeto que aporta `eslint-config-next`. ESLint 9.39 exige que el plugin esté en el **mismo objeto** que la regla.

**Corrección mínima** (añadir el plugin al objeto propio):

```js
import reactHooks from "eslint-plugin-react-hooks";

// ...
{
  plugins: {
    "unused-imports": unusedImports,
    "react-hooks": reactHooks,
  },
  rules: {
    // ...
    "react-hooks/set-state-in-effect": "warn",
  },
}
```

`eslint-plugin-react-hooks@7.1.1` ya está instalado (transitivo); conviene declararlo en `devDependencies`. Alternativa: quitar esa línea y aceptar la severidad `error` que ya impone `eslint-config-next`.

---

### H4 — BAJO — Producto activo sin categoría

`BUN-001 — Bundle of Hygine` está `active = true` y `category_id = NULL`. Es el único de 209 productos en esa situación; puede ser intencional (es un bundle), pero rompe filtros por categoría.

---

### H5 — INFORMATIVO — Credenciales de auditoría inservibles

- `ADMIN_EMAIL` / `ADMIN_PASSWORD` de `.env.local` devuelven **`Invalid login credentials`**. Esto bloquea `audit-financial-integrity.mjs`, `audit-purchases-receipts.mjs`, `_audit_runtime.mjs` y `_audit_verify.mjs`.
- No hay `SUPABASE_ACCESS_TOKEN` ni `~/.supabase/access-token`, por lo que `audit-consistency-check.mjs` y toda verificación SQL (migraciones, `DEFAULT`, políticas, índices, versión de PostgreSQL) no se pueden ejecutar.

**Impacto:** esta auditoría se hizo con la `service_role` local (solo lectura) y sondas `anon`; no se pudo comprobar el estado de las migraciones.

---

## 3. Verificado correcto

### 3.1 Seguridad de la API (hallazgos C1/C5 de octubre) — ✅ resuelto

Sondas con la clave **anónima** (la que viaja en el bundle):

| Comprobación | Resultado |
|---|---|
| `GET /rest/v1/vw_accounts_receivable` | **401** permission denied ✅ |
| `GET /rest/v1/vw_profitability` | **401** ✅ |
| `GET /rest/v1/vw_pv_summary` | **401** ✅ |
| `GET /rest/v1/settings` | **401** ✅ |
| `GET` de `invoices`, `clients`, `receipts`, `products`, `purchases`, `credit_balances` | 200 con **0 filas** (RLS) ✅ |
| `PATCH`/`DELETE /rest/v1/invoices` (UUID inexistente) | **401** ✅ |
| `rpc/adjust_invoice_payment` | **401** ✅ |
| `rpc/get_whatsapp_configs_public` / `get_telegram_configs_public` | **401** ✅ |

La exposición confirmada en la auditoría anterior **ya no existe**.

### 3.2 Integridad de datos

| Comprobación | Resultado |
|---|---|
| Facturas | 33 · 0 sin ítems · 0 con total o subtotal inconsistente |
| Recibos | 16 · 0 con factura o cliente inexistente · 0 en facturas canceladas |
| Compras | 5 · 0 sin ítems · **todas cuadran**: `total = subtotal + ITBIS + 36 + 200` |
| Devoluciones | 0 |
| Inventario | 36 filas · 0 stock negativo · 0 productos duplicados |
| Movimientos de inventario | 87 · 0 huérfanos |
| Ítems de factura/compra | 64 / 50 · **0 referencias a productos inexistentes** |
| Clientes | 38 · 0 con `credit_balance` negativo · `credit_balance` = suma de créditos disponibles en los 38 |
| Cotizaciones | 3 · 0 pendientes antiguas |
| Códigos de producto eliminados referenciados | 0 |

> Nota: el script `audit-purchases-receipts.mjs` marca las 5 compras como “MISMATCH” porque compara `total` contra la suma de ítems sin sumar ITBIS ni los cargos fijos. Al incluirlos, las 5 cuadran al centavo.

### 3.3 Puertas de calidad

| Puerta | Resultado |
|---|---|
| `npx tsc --noEmit` | ✅ 0 errores |
| `npx vitest run` | ✅ 22 archivos, 220/220 pruebas |
| `npx next build` | ✅ 24 rutas generadas |
| `npx eslint` | ❌ error de configuración (H3) |

### 3.4 Higiene del repositorio

- `.env.local` **no** está versionado.
- No hay JWT, `service_role` reales, `sk-…` ni tokens de GitHub en archivos versionados.
- Las referencias a `service_role` encontradas son `GRANT` legítimos de las migraciones y documentación.

---

## 4. Estado de los pendientes de `AUDITORIA-2026-10-02.md`

| Pendiente | Estado hoy |
|---|---|
| Créditos fantasma (C4) | ⚠️ **Confirmados**: 2.161,00 RD$ potencialmente ficticios |
| Exposición `anon` de vistas y RPC (C5) | ✅ Corregida en producción |
| `settings` / contraseña SMTP | ✅ Bloqueado para `anon` (no verificable para `authenticated` sin token) |
| Migraciones SQL y `security_invoker` | ❓ No verificable sin Management API |
| Semántica de `returns.balance_due` | Sin cambios; tabla vacía (0 devoluciones), sin impacto actual |
| `middleware` → `proxy` (Next 16) | Pendiente: sigue existiendo `src/middleware.ts` |
| CSP con `'unsafe-inline'` y `'unsafe-eval'` | Pendiente |
| Accesibilidad (`htmlFor`) | Pendiente: **2** `htmlFor` frente a **239** `<label>` |
| Duplicación WhatsApp/Telegram | Pendiente: 1.408 + 1.385 = **2.793 líneas** |
| Deriva de esquema en Storage / índices | No verificable sin token |

---

## 5. Acciones recomendadas

### P0 — Dinero
1. Revisar los 3 créditos marcados por la consulta de la migración y el crédito huérfano de 50,00.
2. Confirmar con el dueño del negocio cuáles son ficticios y limpiarlos con el procedimiento de `20260910_fix_receipt_credit_excess_fallback.sql` (borra el crédito y recalcula `clients.credit_balance`).
3. Verificar que la migración del trigger corregido está aplicada.

### P1 — Seguridad de dependencias
4. `npm update next zod @sentry/nextjs nodemailer` (rangos compatibles).
5. Añadir `overrides` para `dompurify ^3.4.17`, `sharp ^0.35.5` y `source-map-js ^1.2.2`.
6. `npm audit` hasta dejar 0 críticas/altas.

### P2 — Puertas de calidad
7. Corregir `eslint.config.mjs` (H3) y declarar `eslint-plugin-react-hooks` en `devDependencies`.
8. Ejecutar `npm run verify` completo.

### P3 — Menores
9. Asignar categoría a `BUN-001` o desactivarlo.
10. Renovar `ADMIN_PASSWORD` en `.env.local` (o usar un usuario de auditoría) y guardar un token de Management API para las verificaciones SQL.
11. Migrar `src/middleware.ts` a `proxy.ts` antes de la próxima mayor de Next.

---

## 6. Limitaciones

- No se ejecutó `_audit_runtime.mjs` / `_audit_verify.mjs` (navegador) porque las credenciales de admin de `.env.local` son inválidas.
- No se pudo inspeccionar el esquema (`DEFAULT`, triggers, políticas, índices, versión de PostgreSQL) ni confirmar qué migraciones están aplicadas: hace falta `SUPABASE_ACCESS_TOKEN` o `supabase login`.
- Las comprobaciones de datos se hicieron contra producción en modo lectura con `service_role`.

---

## 7. Reproducción

```bash
# Integridad de datos (requieren credenciales de admin válidas en .env.local;
# hoy fallan con "Invalid login credentials")
node scripts/audit-financial-integrity.mjs
node scripts/audit-purchases-receipts.mjs

# Puertas de calidad
npx tsc --noEmit
npx vitest run --config=vitest.config.mts
npx next build
npx eslint

# Dependencias
npm audit --omit=dev

# SQL / migraciones (requiere token)
SUPABASE_ACCESS_TOKEN=... node scripts/audit-consistency-check.mjs
```

---

## 8. Actualización — correcciones aplicadas (2026-10-28)

Se aplicaron las correcciones de H2 y H3:

| Hallazgo | Estado | Detalle |
|---|---|---|
| H2 — Dependencias | ✅ **Resuelto** | `next` 16.4.3 · `@sentry/nextjs` 10.78.0 · `zod` 4.6.7 · `nodemailer` 10.2.1 · `vitest` 4.1.12. Overrides: `dompurify` 3.4.17 · `sharp` 0.35.5 · `source-map-js` 1.2.2 · `fast-uri` 3.1.9. |
| H3 — ESLint | ✅ **Resuelto** | `react-hooks` declarado en el mismo objeto que la regla; `*.cjs` añadido a `globalIgnores` para los helpers locales no versionados. |

`npm audit --omit=dev` tras los cambios: **0 críticas, 0 altas, 0 moderadas, 3 bajas** (`deepmerge`, `swagger-client`, `swagger-ui-react`; solo se corrigen degradando `swagger-ui-react` a 4.1.3, un cambio mayor que no se recomienda).

Verificación posterior:

| Puerta | Resultado |
|---|---|
| `tsc --noEmit` | ✅ 0 errores |
| `tsc` e2e | ✅ 0 errores |
| `eslint` | ✅ 0 errores · 16 warnings preexistentes |
| `vitest` | ✅ 220/220 |
| `next build` | ✅ OK |
| Smoke test (`/login`, `/manifest.webmanifest`, `/sw.js`) | ✅ 200 / 200 / 200 |

Archivos modificados: `package.json`, `package-lock.json`, `eslint.config.mjs`, `.gitignore`.

Sigue pendiente H1 (créditos ficticios: decisión del negocio), H4 (`BUN-001`) y H5 (renovar credenciales de auditoría).

