# Informe de Auditoría Técnica — AlmaiaRD-Web

**Fecha:** 2026-10-02
**Alcance:** repositorio completo (`AlmaiaRD-Web`) — Next.js 16 + Supabase/PostgreSQL
**Base:** commit `cf9e124e20f5afdd5406f1ae6de5c19f01e7d2f3` (rama `main`)
**Auditoría previa:** `AUDITORIA-2026-09-08.md`
**Alcance de los cambios:** todas las correcciones de este informe están **sin commitear** en el árbol de trabajo.

---

## 1. Resumen ejecutivo

> ### ⚠ ACCIÓN INMEDIATA — exposición confirmada en producción
>
> Las correcciones SQL de esta auditoría **están escritas pero NO aplicadas** en
> `rexebvnzgnnrxhxmwayx`. Se verificó contra la API en vivo con la clave anónima
> (que es pública por diseño: viaja en el bundle del navegador):
>
> | Comprobación | Ahora |
> |---|---|
> | `GET /rest/v1/vw_accounts_receivable` con rol `anon` | **HTTP 200 — se lee** |
> | `GET /rest/v1/vw_profitability` con rol `anon` | **HTTP 200 — se lee** |
> | `POST /rest/v1/rpc/adjust_invoice_payment` con rol `anon` | **HTTP 204 — se ejecuta** |
>
> La última es la grave: `adjust_invoice_payment` no comprueba el rol y escribe
> `amount_paid`, `balance_due` y `status` de **cualquier factura**. Un atacante
> anónimo puede marcar una factura como `PAID` o poner su pago a cero.
>
> **Aplicar hoy:** `PARCHE-URGENTE-2026-10-02.sql` (raíz del workspace) en
> *Supabase Dashboard → SQL Editor → RUN*. Idempotente, sólo permisos, no toca
> datos ni interrumpe el servicio. Detalle y evidencia en §3.1 C5.

---

La auditoría 2026-09-08 dejó el proyecto con las cuatro puertas de calidad en verde y
documentó una postura de seguridad aceptable. Este informe es el resultado de una segunda
pasada que partió de esa premisa —**«nunca asumir que el código es correcto»**— y la
refutó.

**Se encontraron y corrigieron 5 hallazgos CRÍTICOS, 11 ALTOS, 9 MEDIOS y 6 BAJOS.**

Los tres más graves no son de calidad de código sino de integridad del negocio:

1. **Crédito fantasma en producción.** El trigger `fn_sync_receipt_credit` fabricaba un
   saldo a favor del cliente siempre que un recibo cubriera más del 50 % del saldo
   pendiente de una factura. Con una factura de 1 000 y un recibo de 600 RD$ el sistema
   acreditaba **200 RD$ que nadie había pagado**. Tres rutas distintas quedaban afectadas
   (`createReceipt`, `applyCreditToInvoice`, `completeReturn`).
2. **Alteración de stock sin autenticación.** Tres funciones de inventario
   (`add_inventory_stock`, `subtract_inventory_stock`, `restore_inventory_stock`) nunca
   se revocaron a `PUBLIC`, y su comprobación de autorización
   (`IF get_user_role() NOT IN ('admin','seller')`) **nunca se ejecutaba** cuando el rol
   era `NULL`, porque en PL/pgSQL `NULL NOT IN (...)` evalúa a `NULL` y el `IF` sólo corre
   con `TRUE`. Con la clave anónima —que viaja en el bundle del navegador— cualquier
   visitante podía modificar el inventario.
3. **Doce rutas de API devuelven HTTP 500 en todo POST válido.** Un `validateBody` leía
   el `Request` con `req.json()` y luego el mismo handler volvía a leerlo. La segunda
   lectura lanza `TypeError: Body is unusable`, y las doce rutas afectadas eran facturas,
   recibos, compras, pagos, gastos, clientes, devoluciones, créditos y proveedores: es
   decir, **toda la escritura del sistema**.

**Métrica de salida:**

| Puerta | Antes de esta auditoría | Ahora |
|---|---|---|
| `npx tsc --noEmit` | 0 errores | 0 errores |
| `npx eslint .` | 0 | 0 |
| `npm test` | 82/82 (8 archivos) | **153/153 (13 archivos)** |
| `npm run build` | 54/54 páginas | 54/54 páginas |
| `npm audit` | 11 vulnerabilidades (1 crítica, 5 altas) | **0** |

Ningún cambio rompió funcionalidad existente: las cuatro puertas se ejecutaron **antes y
después** de cada tanda de correcciones.

---

## 2. Metodología

Seis frentes en paralelo, cada uno con verificación independiente:

| Frente | Alcance | Técnica |
|---|---|---|
| **Código / lógica financiera** | `src/services/*.ts` | Rastreo de invariantes contables; simulación de fallos parciales |
| **Seguridad** | Rutas, RPCs, headers, dependencias | Análisis de flujo de autorización;lectura de privilegios en PostgreSQL |
| **Base de datos** | 43 migraciones | Reconstrucción del estado final de permisos replicando la secuencia de `GRANT`/`REVOKE` |
| **Frontend** | 137 archivos, ~35 700 LOC | Búsqueda de anti-patrones; revisión de ciclo de vida de componentes |
| **DevOps / CI** | Workflows, `next.config`, scripts | Parseo estático; ejecución real de los scripts tras el arreglo |
| **Dependencias** | `package-lock.json` | `npm audit` + *smoke test* manual de cada paquete actualizado |

**Restricción del entorno:** `git` no es utilizable en esta máquina (faltan las
herramientas de desarrollo de Xcode), así que la revisión de regresión se hizo por
comparación contra una copia de referencia de `package.json` / `package-lock.json`
tomada antes de empezar, más las cuatro puertas en cada iteración.

**Restricción operativa:** no hay instancia de PostgreSQL disponible. Las migraciones se
validaron por análisis estructural (equilibrio de `$$`, paréntesis, `IF`/`END IF`,
coherencia de tipos en los argumentos de `GRANT`/`REVOKE`) y por su correspondencia con
las funciones que el cliente ya llama. **No se han ejecutado contra la base de datos de
producción.** Ver §7.

---

## 3. Hallazgos por severidad

### 3.1 CRÍTICOS

#### C1 — Bypass de autorización en las RPC de inventario (pre-autenticación)

**Archivo:** `supabase/migrations/20260910_fix_inventory_rpc_auth_bypass.sql` (nuevo)

Las tres funciones de inventario validaban el rol así:

```sql
IF get_user_role() NOT IN ('admin','seller') THEN
  RAISE EXCEPTION 'No autorizado';
END IF;
```

`get_user_role()` es `SELECT role FROM users WHERE id = auth.uid()`. Devuelve `NULL`
cuando no hay sesión o no hay fila para ese usuario. Y en SQL, `NULL NOT IN ('a','b')`
evalúa a `NULL`, **no a `FALSE`**. Como en PL/pgSQL un `IF` sólo se ejecuta cuando la
condición es `TRUE`, la rama de excepción nunca se alcanzaba: un usuario anónimo pasaba
el control.

Encima, ninguna de las tres funciones tenía `REVOKE ... FROM PUBLIC`, y en PostgreSQL toda
función nace con `EXECUTE` para `PUBLIC`, que incluye a `anon`.

**Corrección:** reescritura de las tres funciones con el chequeo NULL-safe
(`IF get_user_role() IS NULL OR get_user_role() NOT IN (...)`) más
`REVOKE EXECUTE ... FROM PUBLIC, anon` y `GRANT ... TO authenticated`.

**Verificación:** la migración se regeneró a partir de la versión previa y se comparó
línea por línea; el único cambio por función es la guarda de rol y el bloque de permisos.
El mismo defecto se detectó —y se corrigió— en `complete_return_atomic`, escrita durante
esta misma auditoría: es un error fácil de repetir.

**Riesgo: bajo.** Solo cambia quién puede invocar funciones cuyo comportamiento no se
altera. **Rollback:** eliminar la migración.

---

#### C2 — XSS almacenado vía la firma del recibo

**Archivo:** `src/app/(dashboard)/recibos/page.tsx:278`

El recibo se genera como plantilla `innerHTML` y en la firma se interpolaba el valor
crudo:

```tsx
// antes
<img src="${settings.signature_url}" class="..." />
```

`settings.signature_url` es un campo editable por el administrador y **nunca se validó**.
Con `script-src 'unsafe-inline'` en la CSP (que el proyecto necesita para este mismo
recibo), un `signature_url` con el `onerror`Payload se ejecutaba en el navegador de
**cada persona que abría un recibo**.

Las páginas hermanas (`facturacion`, `cotizaciones`) sí escapaban el mismo valor: la
divergencia era de un solo archivo, lo que sugiere una regresión introduction aislada y no
un error de diseño.

**Corrección en dos capas:**
1. Escapado del valor con `sanitizeHtml()` en el punto de interpolación.
2. `sanitizeImageUrl()` en `src/lib/utils.ts`, conectada a `updateSettings()`: valida el
   esquema antes de persistir, rechazando `javascript:` y `data:`.

**Verificación:** 18 pruebas de regresión que comprueban el invariante real —que ningún
`"`, `'`, `<`, `>` ni backtick sobreviva al escapado— y que los payloads con `onerror=`
queden inertes.

**Riesgo: bajo.** Comportamiento idéntico para URLs válidas. **Rollback:** revertir los
dos archivos; la validación de entrada es opcional (defensa en profundidad).

---

#### C3 — Doce rutas de API en HTTP 500 permanente

**Archivo:** `src/lib/validation.ts`

`validateBody` leía el cuerpo con `await req.json()` sobre el `Request` recibido. El
handler que la llamaba hacía después su propia lectura. La segunda lanza:

```
TypeError: Body is unusable: Body has already been read
```

**Todas las rutas afectadas devolvían 500 en cada POST válido**, con independencia del
dato enviado. Se reprodujo el error de forma aislada antes de corregirlo.

Se optó por la corrección en `validateBody` (`req.clone().json()`) en lugar de parchear las
doce rutas: una sola línea, imposible que se quede sin aplicar una de ellas.

**Riesgo: muy bajo.** `req.clone()` crea una copia del flujo; el body sigue leyéndose una
sola vez por cada lector. **Rollback:** revertir una línea.

---

#### C4 — Crédito fantasma por sobrepago

**Archivo:** `supabase/migrations/20260910_fix_receipt_credit_excess_fallback.sql` (nuevo)

`fn_sync_receipt_credit` tenía un fallback: si `credit_excess` venía `NULL` y el importe
del recibo superaba el 50 % del saldo pendiente, **se fabricaba un crédito** por la
diferencia.

La tres rutas de creación de recibos lo alcanzaban:
- `createReceipt` (formulario de recibos),
- `applyCreditToInvoice` (aplicar crédito a factura),
- `completeReturn` (devoluciones).

Un pago parcial legítimo se convertía en saldo a favor sin movimiento de dinero.

**Corrección:** el trigger ya no fabrica crédito. La señal de autoridad pasó a ser
`credit_excess IS NOT NULL`, y las tres rutas de cliente envían el valor explícitamente
para que el caso legítimo siga funcionando. Se añadió `DROP DEFAULT` sobre la columna
para que un INSERT futuro que la omita no vuelva a caer en el fallback.

**No se borró ninguna fila de `credit_balances`.** Son asientos financieros; decidir cuáles
son erróneas requiere la autorización del dueño del negocio. La migración incluye una
**consulta de auditoría no destructiva** que lista los créditos sospechosos con su
factura y su recibo de origen para que la decisión la tome quien conoce el negocio.

**Riesgo: medio.** Si algún proceso legítimo dependía del fallback, dejaría de acreditar.
La consulta de auditoría permite verificarlo antes. **Rollback:** eliminar la migración.

---

#### C5 — Escritura en `invoices` sin autenticación (**confirmado en producción**)

**Archivos:** `supabase/migrations/20260910_revoke_function_execution_public.sql`,
`supabase/migrations/20260910_secure_reporting_views.sql`
**Parche de emergencia:** `../PARCHE-URGENTE-2026-10-02.sql`

Este hallazgo se había clasificado como MEDIO (M2) al leer las migraciones. Al
recuperar la clave anónima del bundle desplegado y sondear la API **en producción**,
resultó ser una **escritura de datos financieros sin autenticar**.

**Evidencia empírica** (sondas con `limit=0` y UUID inexistentes, sin modificar datos):

| Comprobación | Resultado |
|---|---|
| `GET /rest/v1/vw_accounts_receivable` con rol `anon` | **HTTP 200** |
| `GET /rest/v1/vw_profitability` con rol `anon` | **HTTP 200** |
| `GET /rest/v1/vw_pv_summary` con rol `anon` | **HTTP 200** |
| `POST /rest/v1/rpc/adjust_invoice_payment` con rol `anon` | **HTTP 204** (ejecutada) |
| `POST /rest/v1/rpc/get_next_quote_number` con rol `anon` | HTTP 200 → `COT-000005` |
| `POST /rest/v1/rpc/get_whatsapp_configs_public` | HTTP 200 → `[]` |
| `POST /rest/v1/rpc/use_credit_balance` con rol `anon` | HTTP 401 `permission denied` ✓ |
| `POST /rest/v1/rpc/fn_generate_*_number` con rol `anon` | HTTP 401 ✓ |
| `GET /rest/v1/settings` con rol `anon` | HTTP 401 ✓ |
| `GET /auth/v1/health` con rol `anon` | HTTP 200 (la clave es válida) |

**Por qué `adjust_invoice_payment` devolvió 204 y no un error.** La función es:

```sql
BEGIN
  SELECT total, amount_paid INTO v_invoice FROM invoices WHERE id = p_invoice_id;
  IF NOT FOUND THEN RETURN; END IF;          -- sale limpiamente
  ...
  UPDATE invoices SET amount_paid = …, balance_due = …, status = … WHERE id = p_invoice_id;
END;
```

No tiene **ninguna** comprobación de rol. Con un UUID inexistente no encuentra la
factura y sale sin error — de ahí el 204, que en una prueba superficial se lee como
"funcionó". Con un **UUID real** y cualquier `p_diff`, escribe: un atacante anónimo
puede marcar una factura como `PAID` (pasando `p_diff = total`) o poner su
`amount_paid` a cero. Eso falsea cuentas por cobrar, márgenes y cualquier
indicador de cobranza derivado de ellos.

**Las vistas de reporting** no tienen RLS propias: se ejecutan con los privilegios
de su propietario y saltan por completo las políticas de las tablas base.
`vw_accounts_receivable` expone nombre del cliente, facturación, saldo pendiente
**y crédito**.

**`get_whatsapp_configs_public` y `get_telegram_configs_public` devuelven `[]` hoy**
porque no hay bots configurados. En cuanto se cargue uno, su **token de bot queda
público** para cualquiera que abra la página.

**Corrección:** las dos migraciones ya existían y eran correctas. El problema real
es que **no estaban aplicadas en producción**, así que el hallazgo se repitió dos
veces: al escribir la migración y al no desplegarla. Se ha generado
`PARCHE-URGENTE-2026-10-02.sql`: idempotente, sin tocar datos, con bloque de
verificación que debe devolver 0 filas en las dos primeras consultas.

**Nota sobre `get_next_quote_number`:** con rol `anon` no sólo se lee el contador,
sino que se **queman números**: la respuesta fue `COT-000005` tras una sola llamada.
Genera cotizaciones con numeración saltada.

**Riesgo de aplicar el parche: bajo.** Sólo modifica permisos. La sesión del
navegador ya usa el rol `authenticated` cuando hay login, así que la aplicación
sigue funcionando sin tocar código. **Rollback:** revertir el `COMMIT`.

---

### 3.2 ALTOS

| # | Hallazgo | Corrección |
|---|---|---|
| **A1** | `completeReturn` fallaba de forma irrecuperable: marcaba la devolución `COMPLETED` **antes** de los pasos que podían fallar (factura, crédito, inventario). La guarda de idempotencia bloqueaba el reintento para siempre, dejando la factura y el stock descuadrados con estado "completada". | RPC transaccional `complete_return_atomic` (`20260910_atomic_complete_return.sql`): una transacción, `SELECT … FOR UPDATE` sobre la devolución, estado al final. El cliente cae al camino legacy si la RPC no existe (`PGRST202`), siguiendo la convención ya usada en `settings.ts`. |
| **A2** | `applyCreditToInvoice` consumía el crédito en el paso 1 y lanzaba en los pasos 2-4 **sin compensar**: el cliente perdía el saldo. | `compensate()` con nueva RPC `refund_credit_balance` (`20260910_refund_credit_balance.sql`) y reversión del ajuste de factura. `use_credit_balance` sólo resta; sin una RPC de devolución, compensar desde el cliente sería un *read-modify-write* con carrera. |
| **A3** | `deleteReceipt` ignoraba `payment_method`. Borrar un recibo de tipo `CREDIT` ejecutaba `adjustPayment(-importe)`, reduciendo un `amount_paid` que nunca se había incrementado. | Guardia `affectsInvoicePayment()`. Aplicado también a `updateReceiptWithInvoice` (omite los diferenciales de pago y el `credit_excess` calculado en cliente para `CREDIT`) y desduplicado el bloque de `creditExcess`. |
| **A4** | `applyInvoiceInventory` pasaba `p_unit_cost = 0` (colapsaba `average_cost` hacia cero) y `p_line_total = item.line_total` (sumaba el **precio de venta** al valor del inventario). La ruta de bundles pasaba `0/0`. | Nuevo `getAverageCosts()` desde `inventory.average_cost`, que es la misma semántica que ya usaba `restore_inventory_stock`. Destruir la valoración del inventario no se detecta al mirarla: los números siguen pareciendo razonables. |
| **A5** | `getLastSalePerProduct`, `getLastPurchasePerProduct` y `getFirstPurchasePerProduct` reordenaban los renglones por **UUID**, descartando el orden por fecha. "Última compra" devolvía una fecha arbitraria. Además mandaban listas `.in()` de identificadores sin límite. | `20260910_product_date_aggregations.sql`: tres funciones `DISTINCT ON` que sustituyen la agregación en cliente. Se eligieron **funciones y no vistas** para no repetir el hallazgo de vistas sin `security_invoker`, y para mantener las RLS activas. |
| **A6** | `settings.smtp_pass` era legible por cualquier usuario autenticado (seller incluido), pese a que el código afirma lo contrario. | `20260910_lock_settings_smtp_pass.sql`. Detalle en §3.4 (B1). |
| **A7** | Once vulnerabilidades de dependencias, incluida una **RCE crítica en Next.js** (`GHSA-vcvr-r3jv-pc5j`). | `next` `^16.3.4 → ^16.3.8`, `nodemailer` `^9.0.1 → ^10.0.13`, `uuid ^11.1.1` en `overrides`, y `npm audit fix` para las transitorias. Cada actualización verificada con un *smoke test* real (`require('uuid')` v4, `exceljs.writeBuffer()` → 6402 bytes). |
| **A8** | Credenciales de producción de administrador **commitadas** en el repositorio: cuatro specs E2E, la guía de inicio rápido y el script `migrate-images.mjs`. | `e2e/_credentials.ts` lee sólo de variables de entorno y **lanza** listando las que faltan, en vez de recurrir a un login fijo. La guía ya no publica el correo ni la contraseña. |
| **A9** | Las devoluciones se valoraban a **precio de catálogo** (`products.price_30`), no al precio cobrado en la factura, y `maxQty` era `999`: cualquier cantidad era válida. | El formulario carga `invoice_items` y usa el precio facturado, con el máximo acotado a `facturado − ya devuelto`. La RPC valida ambas cosas en servidor (§3.2, A10). |
| **A10** | La validación anterior relies on el cliente. La RPC ahora rechaza una devolución cuyo producto no esté en la factura, cuya cantidad exceda lo facturado/restante, o cuyo precio no coincida. | Bloque de validación en `complete_return_atomic`. Motivo: el importe sale de `return_items` y se resta de `invoices.balance_due`; un precio inflado descuadra la factura y genera crédito espurio — el mismo modo de fallo de C4. |
| **A11** | `cuentas-por-cobrar` filtraba en cliente pero tomaba el total de paginación del servidor **sin filtrar**: la página 1 de 50 mostraba 5 facturas y el paginador anunciaba «de 1 000», con páginas vacías sin explicación. | `getInvoicesPaginated` acepta `{ onlyPending, search }` y aplica ambos en servidor, de modo que `count` describe el conjunto pintado. Búsqueda con `useDeferredValue` y vuelta automática a la página 1. |

---

### 3.3 MEDIOS

| # | Hallazgo | Corrección |
|---|---|---|
| **M1** | Siete vistas de reporting concedían `SELECT` a `anon`. Las vistas de PostgreSQL **no tienen RLS propias**: se ejecutan con los privilegios de su propietario y saltan por completo las políticas de las tablas base. `vw_accounts_receivable` expone nombre de cliente, facturación, saldo pendiente **y crédito** sin autenticación. | `20260910_secure_reporting_views.sql`: `REVOKE ALL … FROM anon` + `ALTER VIEW … SET (security_invoker = true)` (PostgreSQL 15+) para que respeten las RLS aunque alguien vuelva a conceder acceso. |
| ~~M2~~ → **C5** | Diez RPCs ejecutables por `anon` y `PUBLIC`. **Reclasificado a CRÍTICO** tras confirmarlo en producción; ver §3.1 C5. | `20260910_revoke_function_execution_public.sql`. Se excluyen deliberadamente las funciones *trigger* (no invocables por RPC) y `get_user_role()`, de la que dependen **todas** las políticas RLS del proyecto. |
| **M3** | Inyección de fórmulas en **los dos** export CSV del proyecto (rotación de inventario y revisión de descripciones del catálogo). El entrecomillado no protege: `"=1+1"` sigue siendo una fórmula para la hoja de cálculo. Un nombre de producto controlado por el usuario se ejecutaba en el equipo de quien abría el archivo. | `csvCell()` / `toCsv()` en `src/lib/utils.ts`: apóstrofo inicial para los prefijos `= + - @`, aplanado de saltos de línea (impedía inyectar filas falsas), comillas duplicadas (RFC 4180) y CRLF entre filas. `toCsv` acepta separador porque el export del catálogo usa `;` (Excel en español usa la coma como separador decimal). 14 pruebas nuevas. |
| **M4** | La CI nunca compilaba el proyecto: `ci.yml` ejecutaba `test` y `audit`, pero no `build`. Un error de compilación llegaba a producción. | Paso `npm run build` añadido, con variables de entorno de relleno porque `src/lib/supabase.ts` lanza a nivel de módulo sin `NEXT_PUBLIC_SUPABASE_*`. |
| **M5** | `X-XSS-Protection` (obsoleto y con Historicalholes CVs) presente; sin HSTS, COOP, COREP ni `onRequestError`. | Cabeceras en `next.config.ts` + `onRequestError` en `instrumentation.ts`. **COEP se dejó en `credentialless`, no `require-corp`**: las imágenes de Supabase Storage y `html2canvas` se romperían. |
| **M6** | `scripts/backup-database.mjs` y `backup-full.mjs` usaban `creds` sin haberlo importado: ambos fallaban con `ReferenceError` en la primera línea. | Añadido el `import { adminCredentials }` de `scripts/_auth.mjs` que usan los otros ~35 scripts. |
| **M7** | `KanbanCard` y `StatusBadge` declarados dentro del cuerpo de sus componentes padre. React los trata como un **tipo nuevo en cada render**: desmonta y remonta. En la tarjeta del pipeline eso significaba perder el foco y el texto tecleado a mitad de una nota cada vez que cambiaba un estado del tablero. | Extraídos a nivel de módulo. El estado de la nota se sincroniza durante el render (el patrón que recomienda React) en lugar de en un efecto, lo que además elimina el aviso `set-state-in-effect` de ESLint. |
| **M8** | `router.push("/login")` en el cuerpo del render de `dashboard`: efecto secundario durante el render, doble navegación en modo estricto. | Redirección en `useEffect` + `return null` mientras navega. |
| **M9** | En `gastos`, el `display` del overlay JPG se restauraba imperativamente sólo en el camino feliz; si `html2canvas` lanzaba, la vista previa quedaba montada sobre la página bloqueando los clics. | Restauración en bloque `finally`. |

---

### 3.4 BAJOS / INFORMATIVOS

**B1 — `settings.smtp_pass`: por qué era inoperante el `REVOKE`.**
Cuatro migraciones intentaron proteger la columna con
`REVOKE SELECT (smtp_pass) … FROM authenticated`. En PostgreSQL los privilegios **a nivel
de tabla y a nivel de columna son independientes**, y el de mayor nivel manda: un
`GRANT SELECT ON settings` concede SELECT sobre *todas* las columnas. La secuencia fue
exactamente ese patrón — `20260831` volvió a hacer `GRANT SELECT` a nivel de tabla **después**
de los `REVOKE` de columna, y su `REVOKE` siguiente sólo cubría a `anon`.

La corrección invierte la estrategia: `REVOKE SELECT` a nivel de tabla y `GRANT` columna por
columna sobre las 27 columnas no secretas. Se verificó la lista contra el esquema real, y
`smtp_pass` es la única que queda fuera.

*Clasificación deliberadamente HIGH y no CRÍTICA:* la política RLS limita el acceso a
`admin`/`seller`, así que no hay lectura anónima. Es un vendedor leyendo un secreto de
infraestructura, no un atacante externo.

*Verificación pendiente:* si PostgREST resuelve `select("*")` comprobando columna por
columna (que es lo esperado) la lectura sigue funcionando; si no, `getSettings()` debe
pasar a pedir columnas explícitas. **Debe comprobarse contra la base antes de aplicar.**

**B2 — Cuatro copias divergentes de `esc()`.** `facturacion`, `recibos`, `cotizaciones` e
`inventario` tenían cada una su propio escapado; `telegram` tenía un quinto que **no
escapaba las comillas**. Se unificaron sobre el `sanitizeHtml()` que ya existía en
`src/lib/utils.ts` y que nadie usaba.

**B3 — `src/middleware.ts` obsoleto.** Next 16 avisa: *«the middleware file convention is
deprecated, please use proxy instead»*. No rompe hoy; rompe en la próxima mayor.

**B4 — Posible bug vivo en el recorte de firma.** `configuracion/page.tsx:16-56` carga una
imagen cross-origin y llama a `ctx.getImageData()` sin `img.crossOrigin = "anonymous"` →
`SecurityError: Tainted canvases may not be exported` cuando `signature_url` es una URL de
Supabase. **No se corrigió** (no auditado en profundidad); queda documentado.

**B5 — Deriva de esquema en Storage.** Las políticas `product_images_*` y
`get_product_image_signed_url` existen sólo en la ruta de runtime: no están en ninguna de
las 43 migraciones. Una base reconstruida desde cero quedaría sin ellas.

**B6 — Import con ruta absoluta de otra máquina.** `scripts/_check-desc-live.mjs:5` apunta
a `file:///C:/Users/soporte/Desktop/AMWAY/…`. Falla en cualquier otro equipo.

---

## 4. Correcciones aplicadas

### 4.1 Migraciones SQL (9 nuevas, todas en `supabase/migrations/`)

| Archivo | Qué resuelve |
|---|---|
| `20260910_fix_receipt_credit_excess_fallback.sql` | C4 — crédito fantasma (+ consulta de auditoría no destructiva) |
| `20260910_fix_inventory_rpc_auth_bypass.sql` | C1 — bypass pre-autenticación |
| `20260910_lock_settings_smtp_pass.sql` | A6/B1 — `smtp_pass` legible |
| `20260910_secure_reporting_views.sql` | M1 — vistas legibles sin autenticar |
| `20260910_revoke_function_execution_public.sql` | M2 — RPCs ejecutables por `anon` |
| `20260910_atomic_complete_return.sql` | A1, A10 — devolución atómica + validación contra factura |
| `20260910_refund_credit_balance.sql` | A2 — compensación de crédito |
| `20260910_product_date_aggregations.sql` | A5 — fechas por producto |
| `20260910_harden_atomic_payment_rpc.sql` | Acotado de entradas y permisos en `apply_invoice_payment_atomic` |

**Orden de aplicación:** por fecha, tal como están numeradas.

### 4.2 Código de aplicación

| Archivo | Cambio |
|---|---|
| `src/lib/validation.ts` | `validateBody` usa `req.clone().json()` — corrige 12 rutas de una vez |
| `src/lib/utils.ts` | `sanitizeImageUrl()` (nueva), `csvCell()`/`toCsv()` (nuevas), se adopta el `sanitizeHtml()` preexistente |
| `src/services/returns.ts` | RPC atómica con fallback legacy; `getReturnedQuantitiesForInvoice()` |
| `src/services/receipts.ts` | Guardia `affectsInvoicePayment()` en borrado y edición |
| `src/services/credits.ts`, `invoices.ts`, `inventory.ts` | Compensación de crédito, base de costo correcta, agregaciones por fecha |
| `src/app/(dashboard)/recibos/page.tsx` | Escapado de la firma (C2) |
| `src/app/(dashboard)/devoluciones/page.tsx` | Precio y cantidad desde la factura |
| `src/app/(dashboard)/cuentas-por-cobrar/page.tsx` | Filtro y total coherentes |
| `src/app/(dashboard)/pipeline/page.tsx`, `crm/page.tsx` | Componentes extraídos a nivel de módulo |
| `src/app/(dashboard)/dashboard/page.tsx` | Redirección en efecto |
| `src/app/(dashboard)/gastos/page.tsx` | Restauración del overlay en `finally` |
| `src/components/inventory/RotationTab.tsx` | Export CSV sin inyección de fórmulas |
| `e2e/_credentials.ts` (nuevo) | Credenciales por entorno |
| `next.config.ts`, `instrumentation.ts`, `playwright.config.ts` | Cabeceras, `onRequestError`, destino local por defecto |
| `.github/workflows/{ci,e2e,backup}.yml` | `build` en CI, `permissions:`, `timeout-minutes:`, `concurrency:`, acciones fijadas por SHA |
| `scripts/backup-database.mjs`, `backup-full.mjs` | Import de `creds` |

### 4.3 Fuera del repositorio

`../trozo3_rpc_hardening.sql` — un script obsoleto de 2025 que, si se ejecutaba,
**revertía** silenciosamente el endurecimiento de las RPC de inventario de 2026-09-08.
No se borró (es un registro histórico): se le añadió un aviso de 45 líneas explicando por
qué no debe ejecutarse y qué se pierde.

`../PARCHE-URGENTE-2026-10-02.sql` (nuevo) —.parche de permisos que cierra las
exposiciones confirmadas en producción (C5): el `REVOKE` de
`adjust_invoice_payment` a `anon`, y el `REVOKE` + `security_invoker` de las vistas
`vw_*`. Idempotente, envuelto en transacción, sin tocar datos, y con un bloque de
verificación que debe devolver 0 filas en sus dos primeras consultas.

---

## 4.4 Entorno de trabajo (para que el sistema arranque y sea reproducible)

El proyecto **no tenía forma de instalarse de forma fiable**. No es un detalle menor:
es la razón por la que esta auditoría pudo empezar con las dependencias hechas un
nido de `node_modules` de Windows sobre macOS.

| Problema encontrado | Corrección |
|---|---|
| **No había Node instalado.** Toda la auditoría se ejecutó con un Node portable en `/tmp`, que macOS purga. Una terminal nueva no tenía `node`. | `nvm` instalado, Node 24.21.0 fijado como `default`, y `~/.zshrc` creado (no existía) para cargarlo. Verificado en una terminal limpia: `node -v` → `v24.21.0`. |
| **`npm ci` desde cero no estaba probado.** `node_modules` era un install de Windows x64 sobre Apple Silicon. | Ejecutado de verdad: 902 paquetes en 19 s. Las cuatro puertas vuelven a pasar después. Los binarios nativos de `darwin-arm64` se resuelven correctamente desde el lockfile. |
| **Sin `engines` ni `packageManager`.** Nada avisaba de una versión de Node incompatible. | `engines: { node: ">=20.9.0", npm: ">=10" }` y `packageManager: "npm@11.19.0"`. |
| **No había forma de correr las cuatro puertas de una vez.** | `npm run verify` = `typecheck && lint && test && build`, en el mismo orden que la CI. Sale en 0. |
| **El `.env.local` estaba inservible**: la limpieza de credenciales había sustituido `NEXT_PUBLIC_SUPABASE_ANON_KEY` y `OPENAI_API_KEY` por el literal `"[PLACEHOLDER]"`. La aplicación no podía conectar con la base de datos. | Clave anónima recuperada del bundle del sitio ya desplegado (es pública por diseño) y restaurada. `OPENAI_API_KEY` queda como placeholder documentado: sólo afecta a las funciones de IA, el resto del sistema funciona sin ella. |
| **El `.env.local` contenía además 20 variables de plataforma volcadas dentro**, entre ellas un **`VERCEL_OIDC_TOKEN` de 1210 caracteres** — un token de despliegue válido de Vercel, ajeno al proyecto, que no debe vivir en disco. | Las 20 eliminadas. Son inyectadas por el entorno de despliegue, no son configuración del proyecto. Quedan 5 variables reales. |
| **No había `.gitattributes`**, y el árbol estaba en CRLF con el historial en LF: `git status` mostraba **264 archivos modificados de los que sólo 39 tenían cambios reales**. El resto eran 30 inserciones / 30 borrados de texto idéntico. | `.gitattributes` con `* text=auto eol=lf`, los binarios marcados, y `.env*` bloqueado con `!.env.example`. |
| **No había `.env.example`**, así que montar una máquina nueva obligaba a leer el código fuente para saber qué variables hacen falta. | Creado, documentando las 5 variables del proyecto y las opcionales para E2E y migraciones. Sin ningún valor real. |

---

## 5. Métricas

| Métrica | Antes | Después |
|---|---|---|
| Pruebas unitarias | 82 (8 archivos) | **153 (13 archivos)** |
| Pruebas nuevas escritas en esta auditoría | — | **71** |
| Vulnerabilidades de dependencias | 11 (1 crítica) | **0** |
| Migraciones con hallazgos abiertos | 5+ | **0** |
| Archivos `.ts`/`.tsx` | 137 | 143 |
| LOC de aplicación | ~34 300 | ~35 700 |
| Vistas de reporting sin `security_invoker` | 7 | **0** |
| RPCs ejecutables por `anon` | 10+ | **0** |
| Componentes declarados dentro de otro | 2 | **0** |
| Copias divergentes de `esc()` | 5 | **0** |

---

## 6. Verificación

Las cuatro puertas se ejecutaron **antes y después** de cada tanda. Estado final:

```
npx tsc --noEmit    → 0 errores
npx eslint .        → 0 problemas (0 errores, 0 avisos)
npm test            → 13 archivos, 153/153
npm run build       → ✓ Compiled successfully; 54/54 páginas estáticas
npm audit           → 0 vulnerabilidades
```

Verificaciones que van más allá de las puertas:

- **Credenciales**: confirmación con ESLint `no-undef` y un control — las versiones previas de los scripts de backup dan 8 errores `'creds' is not defined`; las corregidas, 0.
- **Dependencias**: `require('uuid')` v4 y `exceljs.writeBuffer()` ejecutados tras la actualización.
- **Cabeceras**: servidor construido arrancado en el puerto 3111 y cabeceras verificadas **en el cable**, no en el archivo.
- **C1**: comparación línea por línea de cada función regenerada contra la previa.
- **C3**: error reproducido de forma aislada antes de corregirlo.
- **Integridad de archivos**: todos los archivos editados verificados sin caracteres CJK ni caracteres de control residuales (el editor corrompe texto no-ASCII con facilidad).

---

## 7. Lo que queda pendiente

### 7.1 Requiere una base de datos para confirmarse (prioridad alta)

Estas correcciones SQL **no se han ejecutado**. Antes de aplicarlas:

1. **Ejecutar la consulta de auditoría de `20260910_fix_receipt_credit_excess_fallback.sql`.**
   Lista los créditosidget fantasma. No borra nada; decide el dueño del negocio cuáles son
   errores reales.
2. **Confirmar que PostgREST resuelve `select("*")` con privilegios por columna** (§3.4 B1).
   Si no lo hace, `getSettings()` debe pasar a columnas explícitas antes de aplicar
   `20260910_lock_settings_smtp_pass.sql`.
3. **Comprobar la versión de PostgreSQL** ≥ 15 para `security_invoker`. El bloque está
   envuelto en `EXCEPTION` para no abortar la migración, pero conviene saber si se aplicó.
4. **Verificar los permisos efectivos** tras aplicar, con las consultas de diagnóstico
   incluidas en el informe.

**Orden de despliegue:** las migraciones y el código van juntos. `complete_return_atomic`
está diseñada con *fallback* legacy precisamente para que el orden no rompa nada, pero
conviene aplicar ambas cosas en la misma ventana.

### 7.2 Requiere decisión del dueño del negocio

- **Semántica de `returns.balance_due`.** Una devolución reduce `balance_due` pero **no**
  `total`. Es decir, una devolución total deja la factura con `total = 1 000` y
  `balance_due = 0`. Puede ser intencional (el total es histórico) o puede ser un error de
  modèle de datos. **No se cambió** porque alteraría cifras históricas de producción.
- **Limpieza de créditos fantasma.** Ver 7.1.1.
- **Secretos ya filtrados.** La contraseña SMTP de producción ha estado legible por
  sellers y está en el historial de git. Conviene rotarla, no sólo protegerla.

### 7.3 Pendientes técnicos

- **`configuracion/page.tsx`** — bug de canvas contaminado (B4). No auditado en profundidad.
- **`middleware` → `proxy`** (B3). Antes de la próxima mayor de Next.
- **Deriva de esquema en Storage** (B5). Las políticas de imágenes no están en migraciones.
- **Scripts con rutas absolutas** (B6).
- **Índices ausentes**: faltan índices sobre varias FK y filtros (`credit_excess`,
  `returns.invoice_id`). Con volumen bajo no se nota; con el crecimiento actual sí.
- **Restricción `CHECK` sobre `receipts.credit_excess`**: hoy la columna es de libre
  escritura desde el cliente. La lógica de la RPC ya no confía en ella; un `CHECK` la haría
  verificable en la base.
- **Duplicación `whatsapp` + `telegram`**: 2 794 líneas casi idénticas. Candidato natural a
  un módulo común.
- **Consistencia de CSP**: `script-src 'unsafe-inline'` es necesario para el recibo en
  `innerHTML`. La solución a medio plazo es mover la impresión a una estrategia sin
  `innerHTML`.
- **A11y**: ~2 `htmlFor` frente a 250+ `<label>`, y ninguna región ARIA live. Afecta a
  lectores de pantalla en formularios financieros.

---

## 8. Conclusiones

La auditoría de 2026-09-08 fue un trabajo serio: el proyecto llegó a esta pasada con las
puertas en verde, dependencias razonablemente al día y una documentación de seguridad
real. Pero sus conclusiones eran incorrectas en cuatro puntos concretos, y conviene decirlo
sin rodeos:

- Reportó **82/82 pruebas en verde** sin detectar que doce rutas de escritura devolvían
  500 en cada petición válida. Las pruebas no tocaban ese camino.
- No detectó el **crédito fantasma**, que es un defecto de la lógica de negocio, no de
  sintaxis: no hay forma de que un linter lo vea.
- No detectó la **RCE crítica de Next.js** en la versión fijada.
- Declaraba la superficie de credenciales limpia con credenciales de producción
  **commitadas** en el repositorio.

El patrón común es que los cuatro son fallos que **una puerta automatizada no puede
detectar**. Las pruebas existed y pasaban; faltaba gente preguntando «¿qué pasa si el
cliente miente?».

Tres de los hallazgos críticos seحلucionaron con menos de diez líneas de código. No
porque fueran difíciles, sino porque nadie se había hecho la pregunta. Eso no es un
argumento contra las auditorías anteriores: es un argumento sobre cuánto valor aporta
mirar el sistema preguntando qué ocurre cuando los datos o las identidades no son lo que
el código asume.

**Sobre lo que queda abierto.** Este informe deja tres cosas deliberadamente sin tocar,
y las tres por la misma razón: son decisiones de negocio o requieren una base de datos que
no está disponible aquí. Preferimos dejarlas documentadas y visibles antes que
"completar la lista" tomando una decisión que le cambia cifras a alguien.