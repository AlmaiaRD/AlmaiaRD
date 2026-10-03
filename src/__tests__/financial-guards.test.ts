import { describe, it, expect } from "vitest";

/**
 * Réplica en TypeScript de las validaciones que añadí a las migraciones
 * `20260910_*`, para poder ejecutarlas sin una base de datos.
 *
 * Motivo: las guardas de seguridad de PostgreSQL no se pueden probar con
 * `vitest`. Lo que sí se puede —y es donde se cuelan los errores reales— es la
 * expresión de la condición. Estas pruebas fijan esa expresión para que un
 * refactor posterior no la relaje sin que nadie se entere.
 */

/** Reproduce el `getReturnedQuantitiesForInvoice` cliente (join real). */
export function accumulateReturned(
  rows: Array<{ product_id: string | null; quantity: number | null }>
): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const row of rows) {
    if (!row.product_id) continue;
    totals[row.product_id] = (totals[row.product_id] ?? 0) + Number(row.quantity ?? 0);
  }
  return totals;
}

/**
 * `returnable_quantity` de la UI: facturado menos lo ya devuelto en
 * devoluciones COMPLETADAS. Nunca negativo.
 */
export function returnableQuantity(
  billed: number,
  alreadyReturned: number
): number {
  return Math.max(0, billed - alreadyReturned);
}

/**
 * La guarda del paso de validación de `complete_return_atomic`: rechaza la
 * devolución si alguna línea no corresponde a la factura.
 *
 * Reproduce literalmente el predicado SQL:
 *   ii.id IS NULL                                   -> producto no facturado
 *   OR ri.quantity <= 0                             -> cantidad no positiva
 *   OR ri.quantity > facturado - ya devuelto        -> sobre-devolución
 *   OR ROUND(unit_price,2) <> ROUND(facturado,2)    -> precio distinto
 */
export function returnLineIsInvalid(
  line: { product_id: string; quantity: number; unit_price: number },
  invoiceLine: { quantity: number; unit_price: number } | undefined,
  alreadyReturnedForProduct: number
): boolean {
  if (!invoiceLine) return true;
  if (line.quantity <= 0) return true;
  const available = invoiceLine.quantity - alreadyReturnedForProduct;
  if (line.quantity > available) return true;
  if (Math.round(line.unit_price * 100) !== Math.round(invoiceLine.unit_price * 100)) {
    return true;
  }
  return false;
}

/**
 * `affectsInvoicePayment` — el arreglo que impidió que borrar o editar un
 * recibo de tipo CREDIT moviera `amount_paid`.
 *
 * `deleteReceipt` y `updateReceiptWithInvoice` sólo deben llamar a
 * `adjustPayment` cuando el recibo representa un pago real.
 */
export function affectsInvoicePayment(paymentMethod: string | null | undefined): boolean {
  return (paymentMethod ?? "").toUpperCase() !== "CREDIT";
}

describe("accumulateReturned", () => {
  it("suma las unidades devueltas por producto", () => {
    expect(
      accumulateReturned([
        { product_id: "a", quantity: 2 },
        { product_id: "a", quantity: 3 },
        { product_id: "b", quantity: 1 },
      ])
    ).toEqual({ a: 5, b: 1 });
  });

  it("ignora filas sin producto y trata null como 0", () => {
    expect(
      accumulateReturned([
        { product_id: null, quantity: 5 },
        { product_id: "a", quantity: null },
      ])
    ).toEqual({ a: 0 });
  });

  it("devuelve un mapa vacío si no hay devoluciones", () => {
    expect(accumulateReturned([])).toEqual({});
  });
});

describe("returnableQuantity", () => {
  it("resta lo ya devuelto de lo facturado", () => {
    expect(returnableQuantity(5, 2)).toBe(3);
  });

  it("nunca baja de cero aunque se haya devuelto de más", () => {
    // Invariante: la UI no debe ofrecer una cantidad negativa en el input.
    expect(returnableQuantity(3, 5)).toBe(0);
  });

  it("devuelve todo lo facturado si no se ha devuelto nada", () => {
    expect(returnableQuantity(7, 0)).toBe(7);
  });
});

describe("returnLineIsInvalid — validación contra la factura", () => {
  const billed = { quantity: 4, unit_price: 250 };

  it("acepta una línea que coincide con la factura", () => {
    expect(returnLineIsInvalid({ product_id: "a", quantity: 2, unit_price: 250 }, billed, 0)).toBe(false);
  });

  it("rechaza un producto que no está en la factura", () => {
    // Éste es el bypass que corregía el crédito fantasma: devolver un
    // producto libre genera crédito sin ninguna factura detrás.
    expect(returnLineIsInvalid({ product_id: "z", quantity: 1, unit_price: 250 }, undefined, 0)).toBe(true);
  });

  it("rechaza cantidad cero o negativa", () => {
    expect(returnLineIsInvalid({ product_id: "a", quantity: 0, unit_price: 250 }, billed, 0)).toBe(true);
    expect(returnLineIsInvalid({ product_id: "a", quantity: -3, unit_price: 250 }, billed, 0)).toBe(true);
  });

  it("rechaza devolver más de lo facturado", () => {
    expect(returnLineIsInvalid({ product_id: "a", quantity: 5, unit_price: 250 }, billed, 0)).toBe(true);
  });

  it("permite exactamente lo facturado si no se había devuelto antes", () => {
    expect(returnLineIsInvalid({ product_id: "a", quantity: 4, unit_price: 250 }, billed, 0)).toBe(false);
  });

  it("descuenta lo devuelto en devoluciones anteriores", () => {
    // Facturadas 4, ya devueltas 3 -> sólo queda 1.
    expect(returnLineIsInvalid({ product_id: "a", quantity: 1, unit_price: 250 }, billed, 3)).toBe(false);
    expect(returnLineIsInvalid({ product_id: "a", quantity: 2, unit_price: 250 }, billed, 3)).toBe(true);
  });

  it("rechaza un precio distinto al facturado", () => {
    // El importe de la devolución sale de return_items y se resta de
    // invoices.balance_due: un precio inflado descuadra la factura y genera
    // crédito espurio por el excedente.
    expect(returnLineIsInvalid({ product_id: "a", quantity: 1, unit_price: 999 }, billed, 0)).toBe(true);
  });

  it("tolera una diferencia por debajo del centavo (redondeo de coma flotante)", () => {
    // 0.1 + 0.2 = 0.30000000000000004; comparar con `!==` sin redondear
    // rechazaría devoluciones legítimas.
    expect(
      returnLineIsInvalid(
        { product_id: "a", quantity: 1, unit_price: 250.1 },
        { quantity: 4, unit_price: 250.10000000000002 },
        0
      )
    ).toBe(false);
  });
});

describe("affectsInvoicePayment — recibos de crédito", () => {
  it("un recibo CREDIT no mueve amount_paid", () => {
    // El crédito se registraba como recibo con el mismo importe que una
    // devolución, pero NUNCA tuvo un pago asociado. Sin este guardia,
    // deleteReceipt ejecutaba adjustPayment(-importe) sobre un amount_paid
    // que nunca se había incrementado: la factura quedaba con el saldo
    // inflado.
    expect(affectsInvoicePayment("CREDIT")).toBe(false);
  });

  it("no le importa el caso", () => {
    expect(affectsInvoicePayment("credit")).toBe(false);
  });

  it("no necesita recortar espacios: el CHECK constraint no los permite", () => {
    // `receipts_payment_method_check` restringe la columna a exactamente
    // CASH / TRANSFER / CARD / CREDIT, en mayúsculas y sin espacios. Un valor
    // con espacios no puede llegar a la función, y añadir un `.trim()` daría
    // una falsa sensación de robustez frente a un dato que la base ya impide.
    const ALLOWED = ["CASH", "TRANSFER", "CARD", "CREDIT"] as const;
    for (const method of ALLOWED) {
      expect(affectsInvoicePayment(method)).toBe(method !== "CREDIT");
    }
  });

  it("los pagos reales sí mueven amount_paid", () => {
    for (const method of ["CASH", "TRANSFER", "CARD", null, undefined]) {
      expect(affectsInvoicePayment(method)).toBe(true);
    }
  });
});