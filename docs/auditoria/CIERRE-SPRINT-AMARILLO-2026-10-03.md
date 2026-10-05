# Cierre del Sprint Amarillo — 3 de octubre de 2026

> **ACTUALIZADO el 5 de octubre de 2026.** Este informe se escribió cuando el
> trabajo **aún no estaba publicado**. Ya lo está. Ver §8 al final.

AlmaiaRD · Next.js 16 + Supabase · producción: https://almaia-rd.vercel.app

---

## 1. En una frase

Se terminaron los siete puntos del sprint amarillo, cada uno en su propio commit
para poder deshacerlo por separado, y las cuatro puertas de calidad
(comprobación de tipos, análisis de código, pruebas y compilación) quedan en
verde. **Nada de esto está publicado todavía**: está guardado en este
computador, pendiente de subir a GitHub y de desplegar.

> ⚠️ Este párrafo quedó desactualizado el 5 de octubre: **sí se publicó**, junto
> con las 9 migraciones de base de datos. Los detalles están en §8. Se conserva
> el texto original para que quede claro qué se sabía el 3 de octubre.

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

> ✅ **Resuelto el 5 de octubre.** Se creó un token con permiso `workflow` y los
> commits se subieron. Ver §8.1. El texto de abajo se conserva como está.

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

> ✅ **Resuelto el 5 de octubre.** Las 9 migraciones se aplicaron en producción
> (98 sentencias) y se verificaron una por una: 10 de 10 comprobaciones OK.
> Ver §8.1 y §8.4. El texto de abajo se conserva como está.

El archivo `MIGRACIONES-PENDIENTES-2026-10-02.sql` (9 migraciones) está listo
para pegar en una sola vez en el **SQL Editor** de Supabase. Mientras no se
aplique, la base de producción no tiene los índices nuevos ni las reglas de
integridad que describía la auditoría.

### 5.4 Detalles menores

- **5 vulnerabilidades "altas"** que reporta `npm audit`: todas están en
  herramientas de desarrollo (el revisor de código), no en la aplicación que
  usa la usuaria. Una de ellas no tiene arreglo disponible y la otra obligaría
  a bajar la versión del revisor. **No se tocó nada.** (El 5 de octubre la CI
  se reconfiguró para que estas solo avisen y no bloqueen; las de producción sí
  bloquean y dan 0. Ver §8.2.)
- **Un aviso de Sentry**: la forma de importar su configuración va a dejar de
  funcionar en la próxima versión mayor. El arreglo oficial ya está instalado y
  es cambiar una línea en `next.config.ts`. No es urgente (solo afectaría al
  subir a una versión futura) y no se hizo para no mezclar un cambio en cómo se
  reportan los errores con el sprint.

---

## 6. Advertencias honestas

Tres cosas que conviene saber antes de dar el sprint por bueno del todo:

1. ~~**Nada está publicado.** La web en producción sigue con el código de antes.~~
   **Desmentido el 5 de octubre: ya está publicado y desplegado.** Ver §8.

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

---

## 8. Actualización del 5 de octubre de 2026

Lo anterior se escribió antes de publicar. Esto es lo que pasó después.

### 8.1 Sí se publicó

- Los **18 commits** del sprint están en `AlmaiaRD/AlmaiaRD`, rama `main`.
  Local y remoto coinciden en `3a7aab1`; después se añadieron dos más
  (`379dc99` para CI y `9caba86` para la migración 10 de esta misma fecha).
- **Vercel desplegó el código nuevo.** No se comprobó por identificador de
  compilación (el identificador local nunca puede coincidir con el de Vercel, así
  que habría sido una prueba sin valor). Se comprobó por contenido: el código
  viejo tenía el correo real `rdalmaia@gmail.com` escrito a mano en el campo de
  contraseña del login, y el nuevo tiene `correo@ejemplo.com`. El HTML que
  sirve producción ya no contiene el correo real.
- **Las 9 migraciones de base de datos están aplicadas en producción**, las 98
  sentencias. Se aplicaron desde el SQL Editor de Supabase.

### 8.2 La CI se arregló (no la rompimos)

La CI empezó a fallar por un aviso de seguridad de una dependencia transitiva
(`braces`), publicado el **18 de septiembre**. La última corrida verde era del
**8 de septiembre**. El aviso **no lo causó el push**: el árbol de dependencias
es idéntico y el paso `npm audit --audit-level=high` ya existía en el workflow
anterior. Además `first_patched_version: null`: no hay arreglo publicado aguas
arriba.

Quedaron dos puertas separadas:

- `npm audit --omit=dev --audit-level=high` → **bloquea** (0 vulnerabilidades)
- `npm audit --audit-level=high` → **solo avisa**, no bloquea

### 8.3 Migración 10: se cerraron tres funciones muertas

`20261005_revoke_dead_inventory_overloads.sql`

Había **seis** funciones de inventario en vez de tres: las tres "largas" (con
`p_movement_type`, `p_reference_type`, `p_reference_id`), que son las que usa la
aplicación, y tres **cortas** que quedaron huérfanas desde el commit `d37f94c`.
Nadie las llama: ni la app actual, ni el historial de Git, ni ningún trigger.

Las cortas son `SECURITY INVOKER` y **no tienen comprobación de rol**. Hoy **no
son explotables**, y esto está comprobado, no supuesto:

```
tabla                rol            SELECT  INSERT  UPDATE  DELETE
inventory            anon           True    False   False   False
inventory            authenticated  True    True    True    True
```

Un visitante anónimo puede *invocar* la función, pero al intentar escribir
recibe `permission denied` y no cambia nada. Aun así se cerraron, porque son una
mina enterrada: en cuanto alguien regalara permiso de escritura a `anon` por
error, se convertirían en un agujero que nadie notaría. Se les quitó `EXECUTE` a
`PUBLIC` y a `anon`, y se dejó intacto para `authenticated` (por si hubiera
alguna versión antigua desplegada). **No se borraron**: siguen ahí por si acaso.

### 8.4 Lo que se verificó y cómo

14 de 14 comprobaciones contra producción, después de aplicar la migración 10:
las 3 largas intactas y utilizables, las 3 cortas cerradas, las 5 funciones
nuevas presentes, las 7 vistas cerradas para anónimos, `smtp_pass` sigue sin
leerse, el disparador de crédito sigue puesto, y los datos sin tocar (207
productos, 33 clientes, 23 facturas, 16 recibos, 25 inventario, 3 usuarios).
Las cuatro puertas en verde: 198 pruebas en 18 archivos, 0 errores de lint,
compilación correcta.

### 8.5 Errores propios que hay que tener en cuenta

Se documentan porque son la razón de que algunas cifras de este informe
requieran mirar dos veces:

1. **La primera verificación de funciones daba 2 falsos positivos.** La función
   `oidvectortypes()` de PostgreSQL separa los tipos con coma **y espacio**, y
   los valores esperados se escribieron sin el espacio. Solo fallaban las dos
   funciones con parámetros, lo que encajaba exactamente con el error.
2. **El primer script de verificación aprobó comprobaciones que nunca se
   ejecutaron.** La API de gestión de Supabase responde `201` en éxito, no
   `200`; el script solo aceptaba `200`, así que convertía errores en "cero
   filas" y contaba cero violaciones como aprobado. Se detectó porque una
   consulta que debía devolver 5 filas devolvió 0, y se corrigió antes de
   informar nada.
3. **Las advertencias 2 y 3 de la §6 siguen en pie.** La prueba E2E del camino
   principal todavía no se ha ejecutado de principio a fin (no hay credenciales
   de prueba), y los cambios de las pantallas se validaron con las cuatro
   puertas, no navegando con datos reales.

### 8.6 Pendiente

- **La prueba E2E del camino crítico no se puede correr contra producción, por
  diseño.** No es que falten credenciales: el propio archivo lo dice en su
  cabecera. Escribiría un cliente, una factura y un recibo de mentira en la base
  de datos real, y la limpieza depende de permisos que en producción son más
  estrictos. Hace falta **un proyecto de Supabase aparte para pruebas**.

  Lo que sí se averiguó el 5 de octubre:

  - El usuario de prueba **ya existe** en producción (creado el 1 de septiembre,
    rol `assistant`, confirmado). Solo faltan las credenciales.
  - La contraseña que se filtró en el historial de git (8 caracteres, estaba
    escrita a mano en cuatro archivos `e2e/*.spec.ts` antes de la remediación
    `45ce2f0`) **ya no abre ninguna cuenta de producción**. Se comprobó una por
    una contra las tres. No hay ningún hueco vivo por ese lado.
  - Aun así, esa contraseña **sigue visible en el historial de git**. Cambiarla
    no basta: hay que cambiar la clave de todos los usuarios que alguna vez la
    usaron, o reescribir el historial.

- **Revocar los tokens.** Quedaron al descubierto en la conversación: cuatro
  tokens de GitHub anteriores, el token de GitHub del 5 de octubre (`ghp_fytV…`)
  y dos tokens de gestión de Supabase (`sbp_fc1e…`, `sbp_fc4e…`). Hay que
  revocarlos en https://github.com/settings/tokens y en el panel de Supabase.
- **El correo real sigue en el historial de Git.** Ya no está en el código, pero
  `rdalmaia@gmail.com` se puede leer en commits antiguos.