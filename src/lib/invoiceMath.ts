import { ITBIS_RATE } from "@/lib/constants";

export const round2 = (n: number) => {
  const r = Math.round(n * 100) / 100;
  return r === 0 ? 0 : r;
};

export function roundToNearest50(value: number): number {
  return Math.round(value / 50) * 50;
}

export interface InvoiceMathItem {
  quantity: number;
  unit_price: number;
  cost?: number;
  itbis: boolean;
}

export interface InvoiceMathLine {
  quantity: number;
  unit_price: number;
  line_total: number;
  itbis_amount: number;
  adjustment: number;
}

export interface InvoiceMathResult {
  lines: InvoiceMathLine[];
  subtotal: number;
  itbis_total: number;
  discount: number;
  rounding: number;
  total: number;
}

/**
 * Total por línea de una sola unidad: precio + ITBIS (18% del precio),
 * redondeado al múltiplo de 50 MÁS CERCANO. El ITBIS se calcula sobre
 * el precio de venta (unit_price * quantity), según normativa DGII.
 */
export function invoiceLineTotalForUnit(unitPrice: number, cost: number, itbis: boolean): number {
  const itbisAmount = itbis ? round2(round2(Number(unitPrice) || 0) * ITBIS_RATE) : 0;
  return roundToNearest50(round2(round2(Number(unitPrice) || 0) + itbisAmount));
}

/**
 * Ganancia bruta de una línea de factura: monto cobrado (sin ITBIS) − costo.
 * Con costo 0 o desconocido la ganancia no es calculable; se devuelve el monto
 * total como referencia y quien la consume decide si mostrarla.
 */
export function computeLineProfit(lineTotal: number, cost: number, quantity: number): number {
  return round2((Number(lineTotal) || 0) - round2((Number(cost) || 0) * (Number(quantity) || 0)));
}

/**
 * Ganancia neta de la factura: suma de las ganancias de las líneas con costo
 * conocido, menos el descuento aplicado.
 */
export function computeNetProfit(
  lines: Array<{ line_total: number; cost: number; quantity: number }>,
  discount = 0,
): number {
  const gross = lines.reduce(
    (sum, line) => sum + (line.cost > 0 ? computeLineProfit(line.line_total, line.cost, line.quantity) : 0),
    0,
  );
  return round2(gross - (Number(discount) || 0));
}

/**
 * Calcula los totales de una factura con el esquema de precios de Almaia:
 *  - El ITBIS SIEMPRE se calcula sobre el PRECIO DE VENTA (unit_price * quantity)
 *    (18% exacto), según normativa DGII. El ITBIS se calcula sobre el precio
 *    de catálogo original y queda FIJO durante el redondeo (no cambia al ajustar
 *    el precio de cobro para llegar a múltiplo de 50).
 *  - El total de CADA línea se redondea al múltiplo de 50 MÁS CERCANO; la
 *    diferencia se absorbe ajustando el precio de cobro (el ITBIS queda
 *    intacto, sin tocar el precio del catálogo).
 *
 * Ejemplo: costo 360, precio 486 (margen 35%), qty 1:
 *   ITBIS = 486 × 0.18 = 87.48 (fijo sobre precio catálogo); 486 + 87.48 = 573.48 → total 550
 *   (múltiplo de 50 más cercano); ajuste −23.48 → precio de cobro 462.52.
 */
export function computeInvoiceMath(items: InvoiceMathItem[], discount = 0): InvoiceMathResult {
  const lines = items.map((item) => {
    const quantity = item.quantity || 0;
    const catalogPrice = round2(Number(item.unit_price || 0));
    const cost = round2(Number(item.cost) || 0);
    const rawPrice = round2(quantity * catalogPrice);
    // ITBIS sobre precio de catálogo ORIGINAL (fijo, no cambia en el guard loop)
    const itbisAmount = item.itbis && catalogPrice > 0 && quantity > 0 ? round2(catalogPrice * quantity * ITBIS_RATE) : 0;
    const rawTotal = round2(rawPrice + itbisAmount);

    // El total de la línea SIEMPRE se redondea al múltiplo de 50 más cercano.
    // Con ITBIS: line_total = target − itbis (el ITBIS queda intacto).
    // Sin ITBIS: line_total = target.
    const target = quantity > 0 ? Math.max(roundToNearest50(rawTotal), itbisAmount) : 0;
    const lineTotal = quantity > 0 ? round2(target - itbisAmount) : 0;
    let displayPrice = quantity > 0 ? round2(lineTotal / quantity) : 0;

    // Estabilidad al re-calcular una factura guardada: el precio unitario se
    // guarda con 2 decimales, y precio × qty debe volver al MISMO múltiplo de
    // 50 (no cruzar la frontera por el redondeo del precio).
    // IMPORTANTE: usamos el ITBIS FIJO (sobre catálogo), no recalculamos ITBIS
    // sobre displayPrice, para evitar dependencia circular.
    const checkTotal = (lt: number) => lt + itbisAmount;
    let guard = 0;
    while (guard < 500) {
      const recomputed = roundToNearest50(checkTotal(round2(displayPrice * quantity)));
      if (recomputed === target) break;
      displayPrice = round2((displayPrice * 100 + (recomputed > target ? -1 : 1)) / 100);
      guard++;
    }

    return {
      quantity,
      unit_price: displayPrice,
      line_total: lineTotal,
      itbis_amount: itbisAmount,
      adjustment: round2(lineTotal - rawPrice),
    };
  });

  const subtotal = round2(lines.reduce((s, l) => s + l.line_total, 0));
  const itbis_total = round2(lines.reduce((s, l) => s + l.itbis_amount, 0));
  const discountR = round2(Math.max(0, Number(discount) || 0));
  const total = round2(Math.max(0, subtotal + itbis_total - discountR));
  const rounding = round2(total - subtotal - itbis_total + discountR);

  return { lines, subtotal, itbis_total, discount: discountR, rounding, total };
}
