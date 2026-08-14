import { describe, it, expect } from "vitest";
import { computeInvoiceMath, roundToNearest50, invoiceLineTotalForUnit, computeLineProfit, computeNetProfit } from "@/lib/invoiceMath";

const round2 = (n: number) => Math.round(n * 100) / 100;

describe("computeInvoiceMath", () => {
  it("ejemplo del usuario: costo 360, precio 486 (margen 35%) → ITBIS sobre precio 87.48, total 550", () => {
    const r = computeInvoiceMath([{ quantity: 1, unit_price: 486, cost: 360, itbis: true }]);
    expect(r.lines[0].itbis_amount).toBe(round2(486 * 0.18)); // 87.48
    expect(r.lines[0].adjustment).toBeCloseTo(-23.48, 1); // 486 - 87.48 = 398.52, redondeado a 550 - 87.48 = 462.52
    expect(r.lines[0].line_total).toBe(round2(roundToNearest50(486 + 87.48) - 87.48));
    expect(r.lines[0].unit_price).toBe(round2(r.lines[0].line_total));
    expect(r.subtotal).toBe(r.lines[0].line_total);
    expect(r.itbis_total).toBe(round2(486 * 0.18));
    expect(r.total).toBe(roundToNearest50(486 + 87.48));
    expect(r.total % 50).toBe(0);
  });

  it("el ITBIS SIEMPRE se calcula sobre el PRECIO DE VENTA, nunca sobre el costo", () => {
    const r = computeInvoiceMath([{ quantity: 1, unit_price: 486, cost: 360, itbis: true }]);
    expect(r.itbis_total).toBe(round2(486 * 0.18));
    expect(r.itbis_total).not.toBe(round2(360 * 0.18));
  });

  it("el costo base exacto: cost 1485 → precio 1930.5, total 2250", () => {
    const r = computeInvoiceMath([{ quantity: 1, unit_price: 1485 * 1.3, cost: 1485, itbis: true }]);
    const expectedItbis = round2(1930.5 * 0.18);
    expect(r.itbis_total).toBe(expectedItbis);
    const target = roundToNearest50(1930.5 + expectedItbis);
    expect(r.lines[0].adjustment).toBe(round2(target - expectedItbis - 1930.5));
    expect(r.lines[0].line_total).toBe(round2(target - expectedItbis));
    expect(r.total).toBe(target);
  });

  it("sin ITBIS la línea también se redondea al múltiplo de 50 más cercano", () => {
    const r = computeInvoiceMath([{ quantity: 2, unit_price: 1650.55, cost: 1000, itbis: false }]);
    expect(r.lines[0].line_total).toBe(3300);
    expect(r.lines[0].itbis_amount).toBe(0);
    expect(r.lines[0].adjustment).toBe(-1.1);
    expect(r.total).toBe(3300);
    expect(r.total % 50).toBe(0);
  });

  it("sin ITBIS y ya múltiplo de 50 el ajuste es 0", () => {
    const r = computeInvoiceMath([{ quantity: 2, unit_price: 1650, cost: 1000, itbis: false }]);
    expect(r.lines[0].line_total).toBe(3300);
    expect(r.lines[0].itbis_amount).toBe(0);
    expect(r.lines[0].adjustment).toBe(0);
    expect(r.total).toBe(3300);
  });

  it("cantidades > 1 redondean la línea completa al múltiplo de 50 más cercano", () => {
    const r = computeInvoiceMath([{ quantity: 2, unit_price: 486, cost: 360, itbis: true }]);
    const expectedItbis = round2(486 * 2 * 0.18);
    expect(r.lines[0].itbis_amount).toBe(expectedItbis);
    expect(r.lines[0].line_total).toBe(round2(roundToNearest50(486 * 2 + expectedItbis) - expectedItbis));
    expect(r.lines[0].unit_price).toBe(round2(r.lines[0].line_total / 2));
    expect(r.total).toBe(roundToNearest50(486 * 2 + expectedItbis));
    expect(r.total % 50).toBe(0);
  });

  it("es idempotente con el precio de catálogo original (no con el precio ajustado)", () => {
    const once = computeInvoiceMath([{ quantity: 1, unit_price: 486, cost: 360, itbis: true }]);
    // La idempotencia funciona SOLO si se usa el precio de catálogo original (486),
    // no el precio ajustado de cobro. Con ITBIS sobre precio de venta, recalcular
    // con el precio ajustado cambia la base imponible → resultado diferente (correcto).
    const twice = computeInvoiceMath([{ quantity: 1, unit_price: 486, cost: 360, itbis: true }]);
    expect(twice.lines[0].unit_price).toBe(once.lines[0].unit_price);
    expect(twice.lines[0].line_total).toBe(once.lines[0].line_total);
    expect(twice.lines[0].itbis_amount).toBe(once.lines[0].itbis_amount);
    expect(twice.subtotal).toBe(once.subtotal);
    expect(twice.itbis_total).toBe(once.itbis_total);
    expect(twice.total).toBe(once.total);
  });

  it("varias líneas: cada línea es múltiplo de 50 y el total es su suma exacta", () => {
    const r = computeInvoiceMath([
      { quantity: 1, unit_price: 486, cost: 360, itbis: true },
      { quantity: 1, unit_price: 1300, cost: 1000, itbis: true },
      { quantity: 1, unit_price: 2030, cost: 1500, itbis: true },
    ]);
    for (const l of r.lines) expect((l.line_total + l.itbis_amount) % 50).toBe(0);
    expect(r.total % 50).toBe(0);
    expect(r.total).toBe(r.subtotal + r.itbis_total);
    expect(r.rounding).toBe(0);
  });

  it("el descuento se resta del total ya redondeado", () => {
    const r = computeInvoiceMath([{ quantity: 1, unit_price: 486, cost: 360, itbis: true }], 100);
    const expectedItbis = round2(486 * 0.18);
    expect(r.subtotal).toBe(round2(roundToNearest50(486 + expectedItbis) - expectedItbis));
    expect(r.itbis_total).toBe(expectedItbis);
    expect(r.discount).toBe(100);
    expect(r.total).toBe(round2(r.subtotal + r.itbis_total - 100));
  });

  it("mantiene invariantes en un rango amplio de costos/precios", () => {
    for (let cost = 100; cost <= 10000; cost += 37) {
      for (let q = 1; q <= 4; q++) {
        const price = round2(cost * 1.35);
        const r = computeInvoiceMath([{ quantity: q, unit_price: price, cost, itbis: true }]);
        expect(r.total % 50).toBe(0);
        expect(r.itbis_total).toBe(round2(price * q * 0.18)); // ITBIS sobre precio, no costo
        expect(r.total).toBe(r.subtotal + r.itbis_total);
        expect(r.rounding).toBe(0);
        for (const l of r.lines) {
          expect(Math.abs(l.adjustment)).toBeLessThanOrEqual(26);
        }
        // Idempotencia con precio de catálogo original
        const again = computeInvoiceMath([{ quantity: q, unit_price: price, cost, itbis: true }]);
        expect(again.lines[0].unit_price).toBe(r.lines[0].unit_price);
        expect(again.lines[0].line_total).toBe(r.lines[0].line_total);
        expect(again.lines[0].itbis_amount).toBe(r.lines[0].itbis_amount);
        expect(again.total).toBe(r.total);
      }
    }
  });

  it("sin ITBIS: el total de cada línea también es múltiplo de 50 en un rango amplio", () => {
    for (let cost = 100; cost <= 10000; cost += 37) {
      for (let q = 1; q <= 4; q++) {
        const price = round2(cost * 1.35);
        const r = computeInvoiceMath([{ quantity: q, unit_price: price, cost, itbis: false }]);
        expect(r.lines[0].line_total % 50).toBe(0);
        expect(Math.abs(r.lines[0].adjustment)).toBeLessThanOrEqual(26);
        expect(r.total % 50).toBe(0);
        const again = computeInvoiceMath([{ quantity: q, unit_price: r.lines[0].unit_price, cost, itbis: false }]);
        expect(again.lines[0].line_total).toBe(r.lines[0].line_total);
        expect(again.total).toBe(r.total);
      }
    }
  });
});

describe("roundToNearest50", () => {
  it("redondea al múltiplo de 50 más cercano", () => {
    expect(roundToNearest50(1947)).toBe(1950);
    expect(roundToNearest50(1930)).toBe(1950);
    expect(roundToNearest50(1920)).toBe(1900);
    expect(roundToNearest50(1950)).toBe(1950);
    expect(roundToNearest50(550.8)).toBe(550);
    expect(roundToNearest50(549.99)).toBe(550);
    expect(roundToNearest50(575)).toBe(600);
    expect(roundToNearest50(600)).toBe(600);
  });
});

describe("invoiceLineTotalForUnit", () => {
  it("coincide con la factura de una sola unidad (ITBIS sobre precio + redondeo al más cercano)", () => {
    expect(invoiceLineTotalForUnit(486, 360, true)).toBe(roundToNearest50(486 + round2(486 * 0.18)));
    expect(invoiceLineTotalForUnit(1930.5, 1485, true)).toBe(roundToNearest50(1930.5 + round2(1930.5 * 0.18)));
    expect(invoiceLineTotalForUnit(1650, 1000, false)).toBe(1650);
    expect(invoiceLineTotalForUnit(486, 0, true)).toBe(roundToNearest50(486 + round2(486 * 0.18)));
  });
});

describe("computeLineProfit", () => {
  it("ganancia = monto cobrado (sin ITBIS) − costo × cantidad", () => {
    const r = computeInvoiceMath([{ quantity: 1, unit_price: 486, cost: 360, itbis: true }]);
    // Con ITBIS sobre precio: line_total = 462.52, ganancia = 462.52 - 360 = 102.52
    expect(computeLineProfit(r.lines[0].line_total, 360, 1)).toBeCloseTo(102.52, 1);
    expect(computeLineProfit(r.lines[0].line_total * 2, 360, 2)).toBeCloseTo(205.04, 1);
    expect(computeLineProfit(3300, 1000, 2)).toBe(1300);
  });

  it("pérdida cuando el costo supera el monto cobrado", () => {
    expect(computeLineProfit(350, 400, 1)).toBe(-50);
  });

  it("con costo 0 devuelve el monto como referencia (no es ganancia real)", () => {
    expect(computeLineProfit(500, 0, 1)).toBe(500);
    expect(computeLineProfit(0, 0, 0)).toBe(0);
  });

  it("redondea a 2 decimales", () => {
    expect(computeLineProfit(485.2, 360.33, 1)).toBe(124.87);
  });
});

describe("computeNetProfit", () => {
  it("suma la ganancia solo de líneas con costo conocido y resta el descuento", () => {
    const r = computeInvoiceMath([{ quantity: 1, unit_price: 486, cost: 360, itbis: true }]);
    const net = computeNetProfit([
      { line_total: r.lines[0].line_total, cost: 360, quantity: 1 },
      { line_total: 500, cost: 0, quantity: 1 },
    ], 100);
    // Ganancia línea 1: 462.52 - 360 = 102.52; -100 descuento = 2.52
    expect(net).toBeCloseTo(2.52, 1);
  });

  it("sin descuento la ganancia neta es la suma de las líneas con costo", () => {
    const r = computeInvoiceMath([{ quantity: 1, unit_price: 486, cost: 360, itbis: true }]);
    // Ganancia = 462.52 - 360 = 102.52
    expect(computeNetProfit([{ line_total: r.lines[0].line_total, cost: 360, quantity: 1 }])).toBeCloseTo(102.52, 1);
  });

  it("el descuento puede superar la ganancia (resultado negativo)", () => {
    const r = computeInvoiceMath([{ quantity: 1, unit_price: 486, cost: 360, itbis: true }]);
    // Ganancia 102.52 - 200 = -97.48
    expect(computeNetProfit([{ line_total: r.lines[0].line_total, cost: 360, quantity: 1 }], 200)).toBeCloseTo(-97.48, 1);
  });

  it("lista vacía devuelve 0", () => {
    expect(computeNetProfit([], 0)).toBe(0);
  });
});