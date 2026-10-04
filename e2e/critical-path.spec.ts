/**
 * Camino crítico del negocio: cliente → factura → cobro.
 *
 * Por qué esta prueba y no otra
 * -----------------------------
 * Las pruebas E2E que había cubrían login, cotización → factura y el catálogo
 * PDF. Faltaba justo el recorrido que le importa a la usuaria todos los días:
 * dar de alta a quien compra, facturarle y anotar lo que pagó. Si eso se rompe,
 * se puede entrar a la aplicación, se ven los datos y aun así no se puede
 * cobrar: el sistema parece sano mientras no sirve de nada.
 *
 * Por qué usa producto manual y no el catálogo
 * ---------------------------------------------
 * Una factura necesita al menos una línea. Si la prueba cogiera un producto
 * del catálogo, dependería de que ese producto siga existiendo, tenga stock y
 * no esté archivado: tres cosas que cambian sin que nadie toque esta prueba.
 * Con "Manual" la línea la crea la propia prueba, así que el resultado depende
 * solo de la aplicación.
 *
 * Por qué lee el saldo pendiente en vez de escribir 1500
 * -----------------------------------------------------
 * El total de la factura no es 1500 necesariamente: depende del ITBIS, de los
 * descuentos y de los cargos. Si la prueba escribiera un monto fijo y no
 * coincidiera con el total, la factura quedaría en estado "Parcial" y la
 * comprobación final de "Pagada" fallaría por un motivo que no es un fallo de
 * la aplicación. Leyendo el saldo que muestra la propia pantalla, la prueba
 * cobra siempre lo que se debe, que es lo que haría una persona.
 *
 * Por qué se limpia al terminar
 * -----------------------------
 * La prueba escribe en la base de datos de verdad. Sin el bloque de
 * `test.afterAll` de abajo, cada ejecución en CI dejaría un cliente, una
 * factura y un recibo basura, y en unas semanas la base estaría llena de
 * "Cliente E2E-XXXX". El borrado va de hijos a padres porque hay claves
 * foráneas: los recibos y las líneas apuntan a la factura, y la factura al
 * cliente. Al revés, el borrado falla y el cliente se queda.
 *
 * AVISO: ejecutar esto ESCRIBE DATOS REALES mientras dura la prueba. En el CI
 * corre con las credenciales de E2E contra la base de pruebas. No lo ejecutes a
 * mano contra el proyecto de producción: ensuciaría la base con facturas
 * falsas, y la limpieza por API depende de RLS que en producción puede estar
 * más restrictiva.
 */

import { test, expect, type Page, type APIRequestContext } from "@playwright/test";
import { getE2ECredentials, hasE2ECredentials } from "./_credentials";

/** Marca única por ejecución: permite reconocer y borrar lo que deja la prueba. */
const SUFIJO = `E2E${Date.now().toString(36).toUpperCase().slice(-6)}`;
const NOMBRE_CLIENTE = `Cliente ${SUFIJO}`;
const PRODUCTO = `Servicio ${SUFIJO}`;
const PRECIO_UNITARIO = "1500.00";

async function login(page: Page) {
  const { email, password } = getE2ECredentials();
  await page.goto("/login");
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/(dashboard|cotizaciones|catalogo)/, { timeout: 10_000 }).catch(() => {});
}

test.describe("Camino crítico: cliente → factura → cobro", () => {
  // En serie: los tres pasos dependen del anterior. Si el alta de cliente
  // falla, ejecutar la parte de factura daría un falso error en otra parte.
  test.describe.configure({ mode: "serial" });

  test.beforeEach(async ({ page }) => {
    // El salto va ANTES de login(). Si no, getE2ECredentials() lanza dentro
    // del beforeEach y la prueba falla con un error de variables de entorno
    // en vez de saltarse: justo lo que pasaba antes de este arreglo, y lo que
    // hacía que un CI sin secretos se pusiera rojo sin motivo.
    test.skip(
      !hasE2ECredentials(),
      "Faltan E2E_TEST_EMAIL / E2E_TEST_PASSWORD: define las credenciales de E2E para correr esta prueba."
    );
    await login(page);
  });

  test("registra un cliente nuevo y aparece en el listado", async ({ page }) => {
    test.skip(page.url().includes("/login"), "Login falló - credenciales ausentes o inválidas");

    await page.goto("/clientes");
    await page.getByRole("button", { name: "Añadir" }).click();
    await expect(page.getByRole("heading", { name: "Nuevo Cliente" })).toBeVisible();

    await page.getByPlaceholder("Nombre y apellidos").fill(NOMBRE_CLIENTE);
    await page.getByPlaceholder("809-000-0000").fill("809-555-0101");
    await page
      .getByPlaceholder("correo@ejemplo.com")
      .fill(`cliente-${SUFIJO.toLowerCase()}@example.com`);
    await page.getByPlaceholder("Información adicional del cliente...").fill("Alta de la prueba E2E");

    await page.getByRole("button", { name: /Guardar/ }).click();

    // Que el modal se cierre es la señal más fiable de que el servidor
    // aceptó: el listado se repinta con la consulta de React Query y el
    // cliente puede no caber en la página 1 si hay muchos.
    await expect(page.getByRole("heading", { name: "Nuevo Cliente" })).toBeHidden({ timeout: 10_000 });

    // Y una vez guardado, al buscarlo por su marca debe salir. El buscador es
    // del lado del servidor y va con rebote, de ahí la espera.
    await page.getByPlaceholder("Buscar cliente por nombre, teléfono o correo...").fill(SUFIJO);
    await expect(page.getByText(NOMBRE_CLIENTE).first()).toBeVisible({ timeout: 10_000 });
  });

  test("crea una factura a nombre del cliente", async ({ page }) => {
    test.skip(page.url().includes("/login"), "Login falló - credenciales ausentes o inválidas");

    await page.goto("/facturacion");
    await page.getByRole("button", { name: "Nueva Factura" }).click();
    await expect(page.getByRole("heading", { name: "Nueva Factura" })).toBeVisible();

    // Por etiqueta visible y no por posición: si el select se reordena, la
    // prueba sigue escogiendo al cliente correcto.
    await page
      .locator("select")
      .filter({ hasText: "Seleccionar cliente..." })
      .selectOption({ label: NOMBRE_CLIENTE });

    // Línea manual, para no depender de qué hay hoy en el catálogo.
    await page.getByRole("button", { name: "Manual", exact: true }).click();
    await page.getByPlaceholder("Ej: Envío, flete, cargo adicional...").fill(PRODUCTO);

    const numeros = page.locator('input[type="number"]');
    await numeros.first().fill("1");
    await numeros.nth(1).fill(PRECIO_UNITARIO);

    await page.getByRole("button", { name: "Guardar Factura" }).click();
    await expect(page.getByRole("heading", { name: "Nueva Factura" })).toBeHidden({ timeout: 15_000 });

    // La factura existe y es del cliente de esta ejecución.
    await page.getByPlaceholder("Buscar factura por número o cliente...").fill(SUFIJO);
    await expect(page.getByText(NOMBRE_CLIENTE).first()).toBeVisible({ timeout: 15_000 });
  });

  test("registra el cobro y la factura queda pagada", async ({ page }) => {
    test.skip(page.url().includes("/login"), "Login falló - credenciales ausentes o inválidas");

    await page.goto("/recibos");
    await page.getByRole("button", { name: "Registrar Pago" }).click();
    await expect(page.getByRole("heading", { name: "Registrar Pago" })).toBeVisible();

    // El desplegable lista las facturas pendientes con el número y el nombre
    // del cliente. Se busca la opción cuyo texto contenga a este cliente y se
    // selecciona por su valor, no por posición: si la factura no está en la
    // lista de pendientes, el fallo dice exactamente por qué.
    const selectFactura = page.locator("select").filter({ hasText: "Seleccionar factura..." });
    const valueFactura = await selectFactura
      .locator("option")
      .evaluateAll(
        (opciones, nombre) => {
          const opcionesHtml = opciones as HTMLOptionElement[];
          return (
            opcionesHtml.find((o) => (o.textContent ?? "").includes(nombre as string))?.value ?? ""
          );
        },
        NOMBRE_CLIENTE
      );

    expect(valueFactura, `no apareció la factura de ${NOMBRE_CLIENTE} entre las pendientes`).not.toBe("");
    await selectFactura.selectOption(valueFactura);

    // Al elegirla, la pantalla muestra el saldo pendiente. Se cobra eso.
    const filaSaldo = page.locator("div", { hasText: /^Saldo pendiente/ }).last();
    await expect(filaSaldo).toBeVisible({ timeout: 10_000 });
    const saldo = await filaSaldo.locator("span").last().innerText();
    const monto = saldo.replace(/[^\d.]/g, "");

    expect(Number(monto)).toBeGreaterThan(0);

    await page.locator('input[type="number"]').first().fill(monto);
    await page.getByRole("button", { name: "Registrar Pago" }).last().click();
    await expect(page.getByRole("heading", { name: "Registrar Pago" })).toBeHidden({ timeout: 15_000 });

    // La comprobación de fondo: la factura debe verse pagada en el listado.
    // "Pagada" es lo que la usuaria mira para saber a quién le debe.
    await page.goto("/facturacion");
    await page.getByPlaceholder("Buscar factura por número o cliente...").fill(SUFIJO);
    await expect(page.getByText("Pagada").first()).toBeVisible({ timeout: 15_000 });
  });

  test.afterAll(async ({ request }) => {
    let creds: { email: string; password: string };
    try {
      creds = getE2ECredentials();
    } catch {
      test.info().annotations.push({
        type: "limpieza omitida",
        description: "Faltan E2E_TEST_EMAIL / E2E_TEST_PASSWORD",
      });
      return;
    }

    const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!base || !anon) {
      // Deliberadamente ruidoso. Sin estas dos variables la limpieza no se
      // puede hacer, y el fallo silencioso es el peor: el informe de Playwright
      // diría "todo verde" mientras la base se queda con facturas falsas de
      // cada ejecución. Mejor que se note aquí que meses después.
      test.info().annotations.push({
        type: "limpieza OMITIDA",
        description:
          "Faltan NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY. " +
          "La prueba dejó un cliente, una factura y un recibo en la base.",
      });
      return;
    }

    const token = await obtenerToken(request, base, anon, creds.email, creds.password);
    if (!token) {
      test.info().annotations.push({
        type: "limpieza OMITIDA",
        description: "No se pudo iniciar sesión en la API de Supabase para borrar lo creado.",
      });
      return;
    }

    const headers = {
      apikey: anon,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };

    const clientes = await idsConMarca(request, `${base}/rest/v1/clients`, headers, "id");
    for (const cliente of clientes) {
      const facturas = await idsConMarca(
        request,
        `${base}/rest/v1/invoices?client_id=eq.${cliente}`,
        headers,
        "id"
      );
      // Hijos antes que padres: hay claves foráneas hacia la factura.
      for (const factura of facturas) {
        for (const tabla of ["receipts", "invoice_items"]) {
          await request.delete(`${base}/rest/v1/${tabla}?invoice_id=eq.${factura}`, { headers });
        }
        await request.delete(`${base}/rest/v1/invoices?id=eq.${factura}`, { headers });
      }
      await request.delete(`${base}/rest/v1/clients?id=eq.${cliente}`, { headers });
    }
  });
});

async function obtenerToken(
  request: APIRequestContext,
  base: string,
  anon: string,
  email: string,
  password: string
): Promise<string | null> {
  const res = await request.post(`${base}/auth/v1/token?grant_type=password`, {
    headers: { apikey: anon, "Content-Type": "application/json" },
    data: { email, password },
  });
  if (!res.ok()) return null;
  const body = (await res.json()) as { access_token?: string };
  return body.access_token ?? null;
}

/** Ids de las filas cuyo texto contiene la marca de esta ejecución. */
async function idsConMarca(
  request: APIRequestContext,
  url: string,
  headers: Record<string, string>,
  columna: string
): Promise<string[]> {
  const res = await request.get(url, { headers });
  if (!res.ok()) return [];
  const filas = (await res.json()) as Record<string, unknown>[];
  return filas
    .filter((fila) => Object.values(fila).some((v) => typeof v === "string" && v.includes(SUFIJO)))
    .map((fila) => fila[columna])
    .filter((v): v is string => typeof v === "string");
}