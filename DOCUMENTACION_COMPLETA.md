# Documentación Completa - AlmaiaRD Web Application

**Versión:** 1.0  
**Fecha:** Octubre 2026  
**Autor:** Yrahisa Mateo  
**Repositorio:** https://github.com/AlmaiaRD/AlmaiaRD  
**Rama principal:** `main`  
**Rama de desarrollo:** `paleta-almaia`

---

## 1. RESUMEN EJECUTIVO

### 1.1 Qué es AlmaiaRD
Aplicación web de gestión comercial para distribuidores Amway en República Dominicana. Sistema completo de facturación, inventario, clientes, cotizaciones, recibos, gastos, compras, CRM, reportes y panel de control (dashboard).

### 1.2 Stack Tecnológico Principal

| Capa | Tecnología | Versión |
|------|------------|---------|
| Framework | Next.js | 16.x (App Router) |
| Lenguaje | TypeScript | 5.x |
| Base de datos | Supabase (PostgreSQL) | 15.x |
| Autenticación | Supabase Auth | - |
| Estilos | Tailwind CSS | 3.x |
| UI Components | Lucide React + Custom | - |
| Gráficos | Recharts | 2.x |
| PDF | jsPDF | 2.x (carga dinámica) |
| Testing | Vitest + Testing Library | - |
| Linting | ESLint + Prettier | - |
| Package Manager | npm | 10.x |
| Node.js | 24.21.0 | - |

### 1.3 Características Principales

- **Facturación:** Creación, edición, anulación, PDF, envío WhatsApp
- **Cotizaciones:** Pipeline (lista + tablero kanban), conversión a factura
- **Inventario:** Productos, bundles, movimientos, rotación, stock mínimo
- **Clientes:** CRUD completo, estado de cuenta, seguimientos, tags
- **Recibos:** Efectivo, transferencia, tarjeta, conciliación con facturas
- **Compras:** Órdenes atómicas (RPC `create_purchase_atomic`), proveedores
- **Gastos:** Registro, PDF, categorización
- **CRM:** Seguimientos, comunicaciones, WhatsApp integration
- **Dashboard:** KPIs, gráficos, actividad reciente (auditoría)
- **Reportes:** Ventas, cobros, rentabilidad, comisiones, PV
- **PWA:** Service worker, manifest, instalable

---

## 2. ESTRUCTURA DEL PROYECTO

```
AlmaiaRD-Web/
├── .env.local                    # Variables de entorno (NO commitear)
├── .gitignore
├── next.config.mjs
├── package.json
├── tsconfig.json
├── vitest.config.mts
├── tailwind.config.ts
├── postcss.config.mjs
├── middleware.ts                 # Protección de rutas (auth)
├── public/
│   ├── almaia-logo-con-fondo.svg    # Logo principal (SVG con círculo crema)
│   ├── almaia-logo-con-fondo.png    # PNG 880×880 para PDFs (generado desde SVG)
│   ├── favicon.ico
│   ├── manifest.webmanifest
│   └── icons/                       # PWA icons
├── src/
│   ├── app/
│   │   ├── (dashboard)/            # Rutas protegidas (requieren auth)
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx            # Dashboard principal
│   │   │   ├── facturacion/
│   │   │   ├── cotizaciones/
│   │   │   ├── inventario/
│   │   │   ├── clientes/
│   │   │   ├── recibos/
│   │   │   ├── compras/
│   │   │   ├── gastos/
│   │   │   ├── catalogo/
│   │   │   ├── crm/
│   │   │   ├── comunicaciones/
│   │   │   ├── configuracion/
│   │   │   ├── dashboard/
│   │   │   ├── devoluciones/
│   │   │   ├── documentos/
│   │   │   ├── bonificaciones/
│   │   │   ├── aprendizaje/
│   │   │   ├── creditos/
│   │   │   └── cuentas-por-cobrar/
│   │   ├── login/
│   │   │   └── page.tsx            # Login (pública)
│   │   ├── page.tsx                # Landing page (pública desde commit 707f0a5)
│   │   ├── error.tsx               # Error boundary dashboard
│   │   ├── global-error.tsx        # Error boundary global
│   │   ├── layout.tsx              # Root layout
│   │   └── globals.css             # Estilos globales + Tailwind
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Header.tsx          # Header dashboard (logo + Wordmark)
│   │   │   ├── PageContainer.tsx
│   │   │   └── Wordmark.tsx        # Componente "ALMAIA" + tagline
│   │   ├── ui/
│   │   │   ├── Modal.tsx
│   │   │   ├── KpiCard.tsx
│   │   │   ├── Badge.tsx
│   │   │   ├── Pagination.tsx
│   │   │   ├── VirtualTable.tsx
│   │   │   └── Skeleton.tsx
│   │   ├── inventory/
│   │   │   ├── RotationTab.tsx
│   │   │   ├── PurchaseModal.tsx
│   │   │   └── ...
│   │   ├── clients/
│   │   ├── communications/
│   │   └── layout/
│   ├── hooks/
│   │   ├── useAuth.tsx             # Contexto auth (SSR-safe)
│   │   ├── useDarkMode.tsx
│   │   ├── useKeyboardShortcuts.tsx
│   │   └── useDebounce.tsx
│   ├── lib/
│   │   ├── pdf.ts                  # Generación PDFs (jsPDF dinámico)
│   │   ├── utils.ts                # Helpers (formatCurrency, normalize, etc.)
│   │   ├── queries/
│   │   │   └── dashboard.ts        # React Query hooks
│   │   ├── supabase.ts             # Cliente Supabase (browser)
│   │   ├── supabase-server.ts      # Cliente Supabase (server)
│   │   └── fonts/
│   │       ├── italiana.ts         # Fuente Italiana (base64 TTF)
│   │       └── inspiration.ts      # Firma Yrahisa Mateo (base64 TTF)
│   ├── services/
│   │   ├── invoices.ts
│   │   ├── quotes.ts
│   │   ├── products.ts
│   │   ├── clients.ts
│   │   ├── purchases.ts            # RPC create_purchase_atomic + fallback
│   │   ├── inventory.ts
│   │   ├── receipts.ts
│   │   ├── expenses.ts
│   │   ├── dashboard.ts            # getRecentActivity (audit_logs)
│   │   ├── settings.ts
│   │   ├── whatsapp.ts
│   │   ├── preferences.ts
│   │   └── ...
│   ├── types/
│   │   ├── database.ts             # Tipos generados de Supabase
│   │   └── relations.ts            # Tipos con joins
│   └── middleware.ts               # Protección rutas (ver raíz)
├── supabase/
│   └── migrations/
│       ├── 0000_init_schema.sql    # Schema base (RLS, funciones, triggers)
│       ├── 20260812_cotizaciones.sql
│       ├── 20260813_performance_indexes.sql
│       ├── 20260901_security_cleanup_and_hardening.sql
│       ├── 20260910_revoke_function_execution_public.sql
│       ├── 20261011_create_purchase_atomic.sql    # RPC compras atómicas
│       └── 20261011_activate_audit_logs.sql       # Triggers auditoría
├── e2e/
│   ├── _credentials.ts             # Credenciales E2E (leídas de env)
│   └── *.spec.ts
└── node_modules/
```

---

## 3. CONFIGURACIÓN DE ENTORNO

### 3.1 Variables de Entorno (`.env.local`)

```bash
# Supabase (OBLIGATORIO)
NEXT_PUBLIC_SUPABASE_URL=https://rexebvnzgnnrxhxmwayx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_...

# Admin (para scripts/seeds)
ADMIN_EMAIL=rdalmaia@gmail.com
ADMIN_PASSWORD=Admin123!  # CAMBIAR EN PRODUCCIÓN

# E2E Testing
E2E_TEST_EMAIL=test@almaia.do
E2E_TEST_PASSWORD=...

# WhatsApp (opcional)
WHATSAPP_API_URL=...
WHATSAPP_API_TOKEN=...
```

### 3.2 Instalación de Node.js

```bash
# Usar nvm (recomendado)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 24.21.0
nvm use 24.21.0

# Verificar
node --version  # v24.21.0
npm --version   # 10.x
```

### 3.3 Instalación de Dependencias

```bash
cd AlmaiaRD-Web
npm install
```

---

## 4. BASE DE DATOS - SUPABASE

### 4.1 Proyecto Supabase
- **URL:** https://rexebvnzgnnrxhxmwayx.supabase.co
- **Región:** us-east-1
- **Plan:** Free/Pro según uso

### 4.2 Tablas Principales

| Tabla | Descripción | RLS |
|-------|-------------|-----|
| `users` | Usuarios del sistema (perfil + rol) | ✅ |
| `clients` | Clientes | ✅ |
| `products` | Productos y bundles | ✅ |
| `categories` | Categorías de productos | ✅ |
| `subbrands` | Submarcas | ✅ |
| `invoices` | Facturas | ✅ |
| `invoice_items` | Líneas de factura | ✅ |
| `quotes` | Cotizaciones | ✅ |
| `quote_items` | Líneas de cotización | ✅ |
| `receipts` | Recibos de pago | ✅ |
| `purchases` | Compras a proveedores | ✅ |
| `purchase_items` | Líneas de compra | ✅ |
| `expenses` | Gastos | ✅ |
| `inventory` | Stock actual | ✅ |
| `inventory_movements` | Movimientos de stock | ✅ |
| `suppliers` | Proveedores | ✅ |
| `audit_logs` | Auditoría (triggers automáticos) | ✅ |
| `settings` | Configuración general | ✅ |
| `bank_accounts` | Cuentas bancarias | ✅ |
| `communications` | WhatsApp/Email logs | ✅ |
| `followups` | Seguimientos CRM | ✅ |
| `returns` / `return_items` | Devoluciones | ✅ |

### 4.3 Migraciones Críticas (orden de aplicación)

```bash
# 1. Schema base (ejecutar primero)
0000_init_schema.sql

# 2. Índices de performance
20260813_performance_indexes.sql

# 3. Hardening seguridad
20260901_security_cleanup_and_hardening.sql

# 4. Revocación funciones públicas
20260910_revoke_function_execution_public.sql

# 5. Compras atómicas (RPC)
20261011_create_purchase_atomic.sql

# 6. Auditoría (triggers)
20261011_activate_audit_logs.sql
```

### 4.4 Cómo Aplicar Migraciones en Supabase

1. Ir a **SQL Editor** en dashboard de Supabase
2. Crear **New query**
3. Copiar contenido del archivo `.sql` (desde `supabase/migrations/`)
4. Presionar **Run**
5. Repetir para cada migración en orden

### 4.5 Funciones RPC Importantes

| Función | Parámetros | Descripción |
|---------|------------|-------------|
| `create_purchase_atomic` | 13 params | Compra "todo o nada" con lock advisory |
| `add_inventory_stock` | product_id, qty, ... | Suma stock (reutilizada por RPC compra) |
| `fn_audit_log` | trigger | Auditoría automática (no invocar directo) |
| `get_user_role()` | - | Retorna rol del usuario actual |
| `generate_invoice_number()` | - | Correlativo facturas |
| `generate_purchase_number()` | - | Correlativo compras |

### 4.6 Políticas RLS Clave

- **users:** `SELECT` own, `UPDATE` own (no rol), admin full
- **clients/invoices/products/etc:** roles `admin`, `seller`, `assistant` pueden CRUD
- **audit_logs:** `SELECT` solo roles negocio; `INSERT` solo via trigger (SECURITY DEFINER)
- **anon:** acceso DENEGADO a todo (revocado en hardening)

---

## 5. AUTENTICACIÓN Y AUTORIZACIÓN

### 5.1 Flujo de Login

1. Usuario entra a `/login`
2. Credenciales → Supabase Auth (email/password)
3. JWT en cookie httpOnly (Supabase SSR)
4. Middleware valida sesión en cada request protegido
5. `useAuth` hook expone `user`, `signIn`, `signOut`, `loading`

### 5.2 Roles

| Rol | Permisos |
|-----|----------|
| `admin` | Todo (configuración, usuarios, todo CRUD) |
| `seller` | Facturas, cotizaciones, clientes, recibos, inventario |
| `assistant` | Lectura + crear facturas/recibos/cotizaciones |

### 5.3 Middleware (`middleware.ts`)

```typescript
// Rutas públicas: /login, /, assets estáticos
// Todo lo demás: requiere sesión válida
// Redirige a /login si no hay usuario
```

### 5.4 Hook `useAuth` (`src/hooks/useAuth.tsx`)

```typescript
const { user, loading, signIn, signOut } = useAuth();
// loading=true durante verificación inicial (evita hydration mismatch)
```

---

## 6. MÓDULOS PRINCIPALES

### 6.1 Facturación (`/facturacion`)

- **Lista paginada** con filtros (estado, fecha, cliente)
- **Crear/Editar:** Modal con líneas, descuentos, ITBIS, múltiples precios
- **Vista previa HTML** (print) + **PDF** (jsPDF) + **JPG** (html2canvas)
- **Envío WhatsApp** (plantilla con link PDF)
- **Anulación:** Solo admin, registra en auditoría

### 6.2 Cotizaciones (`/cotizaciones`)

- **Pipeline dual:** Lista (default) + Tablero Kanban (opcional)
- **Estados:** BORRADOR → ENVIADA → ACEPTADA/RECHAZADA/EXPIRADA
- **Conversión a factura:** Un clic, pre-llena datos
- **PDF/JPG** igual que facturación

### 6.3 Inventario (`/inventario`)

- **Productos:** CRUD, bundles, imágenes, categorías, submarcas
- **Movimientos:** Entradas/salidas, trazabilidad
- **Rotación:** Días sin venta, último movimiento, sugerencia compra
- **Stock mínimo:** Alertas visuales, edición inline
- **PDF catálogo** y **PDF rotación**

### 6.4 Clientes (`/clientes`)

- **CRUD completo:** Datos fiscales, contacto, dirección
- **Estado de cuenta:** Facturas pendientes, recibos, saldo
- **Tags:** Categorización personalizada
- **Seguimientos:** Notas, recordatorios, historial

### 6.3 Dashboard (`/dashboard`)

- **KPIs:** Ventas día/mes, cobros, tickets, ticket promedio
- **Gráficos:** Ventas 30 días (línea), métodos de pago (pie)
- **Facturas/Recibos recientes:** Últimos 5 con link
- **Actividad reciente:** Tarjeta con `audit_logs` (últimos 10)

### 6.5 Compras (`/compras`)

- **RPC atómica:** `create_purchase_atomic` (todo o nada)
- **Fallback legacy:** Si RPC no existe, usa método anterior
- **Proveedores:** CRUD
- **PDF compra**

### 6.6 Gastos (`/gastos`)

- **CRUD:** Categoría, monto, fecha, comprobante
- **PDF gasto**
- **Filtros por mes/año**

---

## 7. GENERACIÓN DE PDFs

### 7.1 Arquitectura

- **`src/lib/pdf.ts`** - Núcleo central
- **jsPDF carga dinámica** (chunk separado 418 KB, no bloquea carga inicial)
- **Fuentes embebidas:** Italiana (base64) + Inspiration (firma)
- **Logo:** PNG 880×880 (`almaia-logo-con-fondo.png`) - SVG no soportado por jsPDF

### 7.2 Funciones Exportadas

```typescript
buildInvoicePdfDoc(invoice)      // Factura completa
buildReceiptPdfDoc(receipt)      // Recibo
generateExpensePdf(expense)      // Gasto
buildQuotePdfDoc(quote)          // Cotización
drawQuotePdfContent(...)         // Contenido cotización (reutilizable)
drawLightHeader(doc, opts)       // Header estándar (logo + marca)
loadAlmaiaLogo()                 // Cachea logo base64
```

### 7.3 Estándares Visuales PDF

- **Papel:** Letter (216mm × 279mm)
- **Márgenes:** 20mm
- **Logo:** 16mm alto, alineado con "ALMAIA"
- **Colores:** Pizarra `#39484F`, Terracota `#BA4A3A`, Musgo `#819E82`, Salvia `#86C7A3`, Crema `#F5EFE9`, Gris `#4C5760`

---

## 8. BRAND GUIDELINES (IDENTIDAD VISUAL)

### 8.1 Logo

| Archivo | Uso |
|---------|-----|
| `public/almaia-logo-con-fondo.svg` | Web (header, login, landing, previews) |
| `public/almaia-logo-con-fondo.png` | PDFs (880×880, generado desde SVG) |

**El logo YA incluye su círculo crema de fondo.** NO aplicar `rounded-full` ni `border-radius: 50%` en contenedores.

### 8.2 Colores Oficiales

| Nombre | Hex | Uso |
|--------|-----|-----|
| **Pizarra** | `#39484F` | Texto principal, headers, bordes oscuros |
| **Terracota** | `#BA4A3A` | Acentos, botones primarios, "comprador", alertas |
| **Verde Musgo** | `#819E82` | Éxito, salud sistema, "creado" en auditoría |
| **Salvia** | `#86C7A3` | Tipo "comprador" (persona), no mezclar con Musgo |
| **Crema** | `#F5EFE9` | Fondos, badge tags |
| **Gris Claro** | `#E0DAD3` | Bordes, divisores, fondos secundarios |
| **Gris Texto** | `#4C5760` | Texto secundario, placeholders |

### 8.3 Tipografía

| Elemento | Fuente | Tamaño | Tracking |
|----------|--------|--------|----------|
| **ALMAIA** (marca) | Italiana (custom) | Variable (escala a tagline) | `tracking-wide` (0.025em) |
| **Bienestar & Salud** | Helvetica | 40% de "ALMAIA" | `tracking-widest` (0.1em) |
| **UI General** | System UI / Inter | - | - |
| **PDFs** | Italiana + Helvetica | - | - |

### 8.4 Espaciados Logo + Marca (CRÍTICO)

| Contexto | Logo ↔ "ALMAIA" | "ALMAIA" ↔ Tagline |
|----------|-----------------|---------------------|
| **Header (dashboard)** | 3px (`gap-[3px]`) | 1px (`gap={1}` en Wordmark) |
| **Landing (/)** | 3px | 1px |
| **Login** | 3px | 1px |
| **Facturación (modales React)** | 3px | 1px |
| **Facturación (preview HTML)** | 3px (`gap:3px`) | 1px (`margin:1px 0 0`) |
| **Recibos (preview HTML)** | 3px | 1px |
| **Cotizaciones (preview HTML)** | 3px | 1px |
| **PDFs (drawLightHeader)** | 16mm logo, gap 6pt | Calculado automáticamente |

**Regla:** El logo tiene la **misma altura** que el texto "ALMAIA" (font-size calculado). El tagline es 40% de ese tamaño.

---

## 9. DESARROLLO LOCAL

### 9.1 Comandos Principales

```bash
# Desarrollo (Turbopack)
npm run dev

# TypeScript check
npx tsc --noEmit
# O con node directo si node no está en PATH:
export PATH="/Users/yrahisamateo/.nvm/versions/node/v24.21.0/bin:$PATH"
node node_modules/typescript/bin/tsc --noEmit

# Lint (solo errores)
node node_modules/eslint/bin/eslint.js src --quiet

# Tests
node node_modules/vitest/vitest.mjs run --config=vitest.config.mts

# Build producción
node node_modules/next/dist/bin/next build

# Preview build
node node_modules/next/dist/bin/next start
```

### 9.2 Git Workflow

```bash
# Rama de desarrollo: paleta-almaia
git checkout paleta-almaia

# Hacer cambios, commitear
git add -A
git commit -m "tipo(ámbito): descripción"

# Push a rama desarrollo
git push origin paleta-almaia

# Merge a main (cuando listo)
git checkout main
git merge paleta-almaia --no-edit
git push origin main
git checkout paleta-almaia
```

### 9.3 Convenciones de Commits

```
tipo(ámbito): descripción corta

Tipos: feat, fix, perf, refactor, docs, chore, test, build
Ámbitos: logo, brand, pdf, auth, db, ui, facturacion, inventario, etc.
```

---

## 10. DESPLIEGUE (VERCEL)

### 10.1 Configuración Vercel

- **Framework:** Next.js (auto-detectado)
- **Build Command:** `npm run build` (o `next build`)
- **Output Directory:** `.next`
- **Install Command:** `npm install`
- **Node Version:** 24.x

### 10.2 Variables de Entorno en Vercel

Copiar **exactamente** las de `.env.local`:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD` (cambiar a segura)
- `E2E_TEST_EMAIL`
- `E2E_TEST_PASSWORD`

### 10.3 Post-Deploy

1. Vercel build + deploy (~1-2 min)
2. **Limpiar cache navegador:** `Cmd+Shift+R` (Mac) / `Ctrl+Shift+R` (Win)
3. Verificar login, dashboard, facturación, PDFs

---

## 11. REINSTALACIÓN DESDE CERO (PASO A PASO)

### En nuevo ordenador:

```bash
# 1. Clonar repo
git clone https://github.com/AlmaiaRD/AlmaiaRD.git
cd AlmaiaRD/AlmaiaRD-Web

# 2. Instalar Node.js 24.21.0
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.bashrc  # o ~/.zshrc
nvm install 24.21.0
nvm use 24.21.0

# 3. Instalar dependencias
npm install

# 4. Crear .env.local con variables (ver sección 3.1)

# 5. Verificar que compila
export PATH="/Users/tu-usuario/.nvm/versions/node/v24.21.0/bin:$PATH"
node node_modules/typescript/bin/tsc --noEmit
node node_modules/next/dist/bin/next build

# 6. Aplicar migraciones en Supabase (ver sección 4.4)
#    - Ir a Supabase Dashboard → SQL Editor
#    - Ejecutar las 6 migraciones en orden

# 7. Desarrollo local
npm run dev
# Abrir http://localhost:3000

# 8. Deploy a Vercel (conectar repo, agregar env vars, deploy)
```

---

## 12. SOLUCIÓN DE PROBLEMAS COMUNES

| Problema | Causa | Solución |
|----------|-------|----------|
| `node: not found` | Node no en PATH | `export PATH="/Users/.../v24.21.0/bin:$PATH"` |
| Hydration mismatch en `new Date()` | SSR vs cliente | `suppressHydrationWarning` en copyright year |
| Logo se ve con "cuadrado" detrás | Contenedor con `bg-[#BA4A3A]/10` | Quitar fondo contenedor (logo ya trae círculo) |
| PDF no genera / jsPDF error | Carga estática jsPDF | Verificar `await import("jspdf")` dinámico |
| "Volver" en login no hace nada | Landing protegida por middleware | Hacer `/` pública en middleware (commit 707f0a5) |
| Auditoría vacía | Triggers no aplicados | Ejecutar `20261011_activate_audit_logs.sql` |
| Compras no atómicas | RPC no existe en BD | Ejecutar `20261011_create_purchase_atomic.sql` |
| Código producto duplicado | Validación solo frontend | Ya fix: `productCodeExists()` en servicio |
| Build falla en Vercel | Env vars faltantes | Verificar todas en Vercel Project Settings |

---

## 13. TESTING

### 13.1 Ejecutar Tests

```bash
node node_modules/vitest/vitest.mjs run --config=vitest.config.mts
```

### 13.2 Cobertura Actual

- **20 test files** / **203 tests** passing
- Cobertura: servicios, hooks, utils, componentes críticos
- E2E: login, navegación básica (configurado en `e2e/`)

---

## 14. ARCHIVOS CLAVE PARA REVISAR

| Archivo | Por qué es importante |
|---------|----------------------|
| `middleware.ts` | Protección rutas, define qué es público |
| `src/hooks/useAuth.tsx` | Auth context, loading state |
| `src/lib/pdf.ts` | Núcleo PDFs, logo, fuentes, layout |
| `src/services/purchases.ts` | RPC atómica + fallback legacy |
| `src/services/dashboard.ts` | `getRecentActivity` (auditoría) |
| `src/components/layout/Wordmark.tsx` | Marca "ALMAIA" + tagline auto-escalable |
| `src/components/layout/Header.tsx` | Header principal con logo+marca |
| `supabase/migrations/20261011_activate_audit_logs.sql` | Triggers auditoría |
| `supabase/migrations/20261011_create_purchase_atomic.sql` | Compras atómicas |
| `tailwind.config.ts` | Colores marca, fuentes, breakpoints |

---

## 15. HISTORIAL DE CAMBIOS CRÍTICOS (ÚLTIMOS)

| Commit | Fecha | Descripción |
|--------|-------|-------------|
| `45c2973` | 11/10/2026 | ALMAIA↔tagline 1px en TODOS lados |
| `7d45470` | 11/10/2026 | Wordmark gap 1px (Header, Landing, Login) |
| `4038f3d` | 11/10/2026 | Logo↔trademark 3px, Wordmark gap configurable |
| `a94fb34` | 11/10/2026 | Distancia logo↔trademark ~1mm (3-4px) |
| `2928391` | 11/10/2026 | Unifica logo (quita recorte circular extra) |
| `feeb713` | 11/10/2026 | Nuevo logotipo en TODOS lados (SVG + PNG) |
| `7db524d` | 11/10/2026 | Elimina "cuadrado" detrás del logo |
| `707f0a5` | 11/10/2026 | Landing pública + botón "Volver" funcional |
| `d06f201` | 11/10/2026 | Evita código producto duplicado |
| `66fdeee` | 11/10/2026 | Quita botón "Volver" muerto (revertido después) |
| `78f5070` | 11/10/2026 | jsPDF bajo demanda + auditoría activa |
| `5bbdcfc` | 11/10/2026 | Pantalla error + compras atómicas + hydration |
| `f9a5ef4` | 11/10/2026 | Logo con fondo unificado en PDFs |

---

## 16. CHECKLIST PRE-DEPLOY

- [ ] `tsc --noEmit` pasa
- [ ] `eslint src --quiet` 0 errores
- [ ] 203 tests pasan
- [ ] `next build` compila sin errores
- [ ] Migraciones aplicadas en Supabase (6 archivos)
- [ ] Variables de entorno en Vercel actualizadas
- [ ] `ADMIN_PASSWORD` cambiado a seguro
- [ ] Favicon y manifest.webmanifest en `public/`
- [ ] Logo SVG y PNG correctos en `public/`
- [ ] PWA instalable (service worker registrado)

---

## 17. CONTACTOS Y RECURSOS

- **Repositorio:** https://github.com/AlmaiaRD/AlmaiaRD
- **Supabase Dashboard:** https://supabase.com/dashboard/project/rexebvnzgnnrxhxmwayx
- **Vercel Dashboard:** https://vercel.com/.../almaia-rd
- **Documentación Next.js v16:** `node_modules/next/dist/docs/`
- **Supabase Docs:** https://supabase.com/docs

---

**FIN DEL DOCUMENTO**

*Este documento debe mantenerse actualizado con cada cambio significativo en la arquitectura, base de datos, identidad visual o proceso de despliegue.*