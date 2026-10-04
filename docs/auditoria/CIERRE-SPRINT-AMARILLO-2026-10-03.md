# Cierre del Sprint Amarillo — 3 de octubre de 2026

AlmaiaRD · Next.js 16 + Supabase · producción: https://almaia-rd.vercel.app

---

## 1. En una frase

Se terminaron los siete puntos del sprint amarillo, cada uno en su propio commit
para poder deshacerlo por separado, y las cuatro puertas de calidad
(comprobación de tipos, análisis de código, pruebas y compilación) quedan en
verde. **Nada de esto está publicado todavía**: está guardado en este
computador, pendiente de subir a GitHub y de desplegar.

---

## 2. Qué se hizo, en palabras sencillas

| # | Punto | Qué cambió para la usuaria |
|---|-------|---------------------------|
| 1 | **Tabla de inventario** | La lista de productos ya no se dibuja de golpe. Alundreds de filas ya no atascan el navegador. |
| 2 | **Tabla de facturación** | Lo mismo en la lista de facturas. |
| 3 | **Datos que no se recargan solos** | El panel, la lista de clientes y el catálogo dejan de preguntar a la base de datos cada vez que se vuelve a entrar a la pantalla. Se sienten más rápidos. |
| 4 | **Límite de peticiones** | Se arreglaron dos problemas reales: unas pantallas aceptaban 5 veces más de lo previsto y otras se bloqueaban antes de tiempo. Y, si falta una configuración, la aplicación ya no se cae entera. |
| 5 | **Prueba automática del camino principal** | Ahora hay una prueba que hace el recorrido completo: dar de alta un cliente, facturarle y anotar el pago. |
| 6 | **Tipos de datos ordenados** | Se quitaron seis copias del mismo tipo que estaban repartidas por las pantallas. |
| 7 | **Fotos de producto** | Las fotos ya se descargan en tamaño pequeño y solo cuando se ven. Antes, abrir el catálogo con 100 productos descargaba las 100 fotos completas de golpe. |

---

## 3. Los tres problemas de fondo que aparecieron

No estaban en la lista, y son más importantes que los siete puntos.

### 3.1 El límite de peticiones no hacía nada de lo que se le pedía

`src/lib/rate-limit.ts` tenía **un solo limitador, fijo en 10 peticiones por
minuto**, y las 13 rutas que lo usan le pasaban su propio límite, que se
ignoraba por completo. En la práctica:

- La copia de seguridad pedía 2 y admitía 10.
- Los avisos por Telegram pedían 30 y se cortaban en la décima: con dos
  personas trabajando a la vez, se bloqueaban sin motivo.

Además, si faltaban las dos variables de configuración de Upstash en
producción, `checkRateLimit` lanzaba un error y **tumbaba la ruta entera**.
Perder dos variables de entorno convertía un problema de configuración en una
caída total del servicio. Ahora avisa a Sentry y sigue funcionando.

### 3.2 El tipo `Product` mentía, y por eso estaba duplicado seis veces

En `src/types/database.ts`, `image_url`, `category_id`, `subbrand_id`,
`description`, `benefits` y `apply_itbis` estaban declaradas como **obligatorias**
cuando en la base de datos admiten estar vacías. Al ser un tipo falso, cada
pantalla se veía obligada a escribir su propia versión correcta: seis copias de
lo mismo.

Se corrigió en el origen. **No hubo ni un solo uso que dependiera de la
mentira**: el comprobador de tipos quedó en cero errores sin tocar nada más,
lo que confirma que era un error y no una decisión.

### 3.3 Las pruebas automáticas se saltaban solas… y a la vez rompían

Al escribir la prueba nueva aparecieron dos fallos que ya venían de antes:

1. **Sin credenciales, la suite fallaba en vez de saltarse.** La función que
   lee las credenciales lanzaba un error dentro del `beforeEach`, y la línea que
   dice "si no hay credenciales, esta prueba se salta" nunca llegaba a
   ejecutarse. Un CI al que le faltaran los secretos se ponía en rojo con un
   error que parecía un fallo de la aplicación.

2. **Los archivos de prueba no los revisaba nadie.** `tsconfig.json` solo
   incluye `src/`, así que un error de tipos en una prueba E2E no lo veía
   *nadie* y solo aparecía al ejecutarla. Se añadió la puerta `typecheck:e2e`
   para que las pruebas entrar en la verificación como el resto del código. Al
   añadirla, apareció un error real que llevaba semanas escondido.

---

## 4. Estado de las puertas

Ejecutado con `npm run verify`, resultado **0** (todo correcto):

| Puerta | Resultado |
|--------|-----------|
| Tipos (código de la app) | 0 errores |
| Tipos (pruebas E2E) | 0 errores *(puerta nueva)* |
| Análisis de código | 0 errores, 1 aviso informativo |
| Pruebas automáticas | **198 pruebas en 18 archivos, todas en verde** (antes: 178 en 15) |
| Compilación | 54 de 54 páginas generadas |

Sobre el único aviso que queda: dice que una librería externa
(`useVirtualizer`, del paquete `@tanstack/react-virtual`) no se puede
optimizar automáticamente. Es informativo, no un fallo, y es esperado en esa
librería.

Las 12 pruebas de navegador se cargan correctamente: 3 pasan (las que no
necesitan sesión) y 9 se saltan con un mensaje claro, sin errores.

---

## 5. Lo que falta por hacer

Nada de esto está en manos del código; son decisiones y pasos de configuración.

### 5.1 Subir a GitHub — requiere un clic tuyo

Los 16 commits están guardados y comprobados en este computador, pero GitHub no
los acepta con la llave actual:

> `refusing to allow a Personal Access Token to create or update workflow
> .github/workflows/backup.yml without workflow scope`

Tres de los commits tocan los archivos que mandan hacer las copias de seguridad
y correr las pruebas. Para tocar esos archivos, GitHub pide un permiso especial
que la llave actual no tiene. **No es un problema del código ni del
computador.**

Dejé preparado el archivo `SUBIR-A-GITHUB.command` en la carpeta `AMWAY 2`.
Tiene las instrucciones dentro y hace los dos pasos que siempre dan problemas
(borrar la llave vieja del llavero, que es lo que hacía que los tokens nuevos
no surtieran efecto).

**Guía paso a paso:**

1. Abre esta página en el navegador:
   **https://github.com/settings/tokens/new**
2. Baja hasta donde dice **Scope** y marca **las dos** casillas:
   - `[x]` **repo**
   - `[x]` **workflow** ← esta es la que faltaba
3. Abajo del todo, pulsa **Generate token** y copia el texto que empieza por
   `ghp_`. Cópialo de una vez: luego no se vuelve a ver.
4. Abre la carpeta `AMWAY 2` y **haz doble clic** en `SUBIR-A-GITHUB.command`.
5. Cuando pida `Password:`, pega la llave con **Cmd+V** y dale Enter.
   - *En una ventana de Terminal la palabra "Password:" no muestra nada al
     escribir. Es normal, no está fallando.*

### 5.2 Rotar los 4 tokens de GitHub que quedaron al descubierto

Es lo más importante de esta lista. Cuatro llaves de acceso quedaron
escritas dentro del historial de la conversación y del proyecto. Están
rechazadas por GitHub y ya no sirven, pero **hay que revocarlas igual** en
https://github.com/settings/tokens y crear una nueva con los permisos de la
sección 5.1.

### 5.3 Las 9 migraciones de la base de datos siguen sin aplicar

El archivo `MIGRACIONES-PENDIENTES-2026-10-02.sql` (9 migraciones) está listo
para pegar en una sola vez en el **SQL Editor** de Supabase. Mientras no se
aplique, la base de producción no tiene los índices nuevos ni las reglas de
integridad que describía la auditoría.

### 5.4 Detalles menores

- **5 vulnerabilidades "altas"** que reporta `npm audit`: todas están en
  herramientas de desarrollo (el revisor de código), no en la aplicación que
  usa la usuaria. Una de ellas no tiene arreglo disponible y la otra obligaría
  a bajar la versión del revisor. **No se tocó nada.**
- **Un aviso de Sentry**: la forma de importar su configuración va a dejar de
  funcionar en la próxima versión mayor. El arreglo oficial ya está instalado y
  es cambiar una línea en `next.config.ts`. No es urgente (solo afectaría al
  subir a una versión futura) y no se hizo para no mezclar un cambio en cómo se
  reportan los errores con el sprint.

---

## 6. Advertencias honestas

Tres cosas que conviene saber antes de dar el sprint por bueno del todo:

1. **Nada está publicado.** La web en producción sigue con el código de antes.
   Hasta que se suban los commits y Vercel despliegue, la usuaria no ve ninguno
   de estos cambios.

2. **La prueba nueva del camino principal nunca se ha ejecutado de principio a
   fin**, porque no hay credenciales de prueba configuradas en este computador.
   Lo que sí se comprobó: que el archivo carga, que los tipos están correctos y
   que sin credenciales se salta limpiamente en vez de dar error. La primera
   vez que corra de verdad puede necesitar un ajuste: algún texto de botón
   podría haber cambiado y la prueba lo avisará.

3. **Los cambios de las pantallas (datos y fotos) se comprobaron con las cuatro
   puertas, no navegando la aplicación con datos reales.** Para verificarlos de
   verdad habría que entrar con una sesión y recorrer catálogo, clientes y panel.

---

## 7. Los 16 commits

Cada punto del sprint es un commit aparte, para poder deshacerlo sin tocar los
demás (`git revert <número>`).

```
451e0c9  test(e2e): cubrir el camino cliente → factura → cobro
b5ad336  refactor(types): una sola version de los tipos de relaciones
9715d60  perf(img): redimensionar y cargar de forma perezosa las fotos de producto
9330146  fix(rate-limit): respetar el limite de cada ruta y no caer sin Upstash
215256e  perf(data): React Query en dashboard, clientes y catalogo
ec9185d  perf(ui): virtualizar las tablas de inventario y facturacion
0fdb8e1  fix(ai): cablear la capa multi-proveedor en los 4 endpoints
92ef2d0  feat(virtual): tabla virtualizada para inventario con @tanstack/react-virtual
61ace3a  feat(audit): logging estructurado Sentry en 5 puntos críticos
d4c48b0  docs(security): política de rotación de secretos (SECURITY.md)
f351cf5  chore(ci): cache npm + dependabot semanal
d793aff  fix(canvas): crossOrigin=anonymous en firma digital
27f87b9  fix(db): índices FK + constraint credit_excess + función quote limpia
190dbc8  chore(infra): endurecer CI, cabeceras de seguridad, deps y documentacion
45ce2f0  fix(app): remediacion de 5 CRITICAL, 11 HIGH y 9 MEDIUM en codigo y tests
d6b9ad9  fix(db): 9 migraciones de remediacion de la auditoria 2026-10-02
```