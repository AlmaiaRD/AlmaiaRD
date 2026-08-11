import { describe, it, expect } from "vitest";
import { computeInvoiceMath, roundToNearest50, invoiceLineTotalForUnit } from "@/lib/invoiceMath";

const round2 = (n: number) => Math.round(n * 100) / 100;

describe("computeInvoiceMath", () => {
  it("ejemplo del usuario: costo 360, precio 486 (margen 35%) → ITBIS fijo 64.80, total 550 (múltiplo de 50 más cercano, no 600)", () => {
    const r = computeInvoiceMath([{ quantity: 1, unit_price: 486, cost: 360, itbis: true }]);
    expect(r.lines[0].itbis_amount).toBe(64.8);
    expect(r.lines[0].adjustment).toBe(-0.8);
    expect(r.lines[0].line_total).toBe(485.2);
    expect(r.lines[0].unit_price).toBe(485.2);
    expect(r.subtotal).toBe(485.2);
    expect(r.itbis_total).toBe(64.8);
    expect(r.total).toBe(550);
    expect(r.total % 50).toBe(0);
  });

  it("el ITBIS SIEMPRE se calcula sobre el COSTO, nunca sobre el margen", () => {
    const r = computeInvoiceMath([{ quantity: 1, unit_price: 486, cost: 360, itbis: true }]);
    expect(r.itbis_total).toBe(round2(360 * 0.18));
    expect(r.itbis_total).not.toBe(round2(486 * 0.18));
  });

  it("el costo base exacto: cost 1485 → precio 1930.5, total 2200", () => {
    const r = computeInvoiceMath([{ quantity: 1, unit_price: 1485 * 1.3, cost: 1485, itbis: true }]);
    expect(r.itbis_total).toBe(267.3);
    expect(r.lines[0].adjustment).toBe(2.2);
    expect(r.lines[0].line_total).toBe(1932.7);
    expect(r.total).toBe(2200);
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
    expect(r.lines[0].itbis_amount).toBe(129.6);
    expect(r.lines[0].line_total).toBe(970.4);
    expect(r.lines[0].unit_price).toBe(485.2);
    expect(r.total).toBe(1100);
    expect(r.total % 50).toBe(0);
  });

  it("es idempotente (re-calcular con el precio ajustado no lo cambia)", () => {
    const once = computeInvoiceMath([{ quantity: 1, unit_price: 486, cost: 360, itbis: true }]);
    const twice = computeInvoiceMath([{ quantity: 1, unit_price: once.lines[0].unit_price, cost: 360, itbis: true }]);
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
    expect(r.subtotal).toBe(485.2);
    expect(r.itbis_total).toBe(64.8);
    expect(r.discount).toBe(100);
    expect(r.total).toBe(450);
  });

  it("mantiene invariantes en un rango amplio de costos/precios", () => {
    for (let cost = 100; cost <= 10000; cost += 37) {
      for (let q = 1; q <= 4; q++) {
        const price = round2(cost * 1.35);
        const r = computeInvoiceMath([{ quantity: q, unit_price: price, cost, itbis: true }]);
        expect(r.total % 50).toBe(0);
        expect(r.itbis_total).toBe(round2(cost * q * 0.18));
        expect(r.total).toBe(r.subtotal + r.itbis_total);
        expect(r.rounding).toBe(0);
        for (const l of r.lines) {
          expect(Math.abs(l.adjustment)).toBeLessThanOrEqual(26);
        }
        const again = computeInvoiceMath([{ quantity: q, unit_price: r.lines[0].unit_price, cost, itbis: true }]);
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
  it("coincide con la factura de una sola unidad (ITBIS sobre costo + redondeo al más cercano)", () => {
    expect(invoiceLineTotalForUnit(486, 360, true)).toBe(550);
    expect(invoiceLineTotalForUnit(1930.5, 1485, true)).toBe(2200);
    expect(invoiceLineTotalForUnit(1650, 1000, false)).toBe(1650);
    expect(invoiceLineTotalForUnit(486, 0, true)).toBe(500);
  });
});
