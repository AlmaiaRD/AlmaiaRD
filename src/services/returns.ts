import { supabase } from "@/lib/supabase";
import { auditLog } from "@/lib/audit";
import { getCached, setCache, invalidateCache } from "@/lib/cache";
import { addInventoryStock } from "./inventory";
import { getBundleComponentMap, type BundleComponentInfo } from "./products";
import { nextSequenceNumber, SEQUENCE_DIGITS } from "@/lib/sequences";
import type { Return, ReturnItem } from "@/types/database";

/** Prefijo de los correlativos de devolución. */
const RETURN_PREFIX = "DEV-";

export async function getReturns() {
  const { data, error } = await supabase
    .from("returns")
    .select("*, clients(full_name), invoices(invoice_number)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function getReturn(id: string) {
  const { data, error } = await supabase
    .from("returns")
    .select("*, clients(full_name), invoices(invoice_number)")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data;
}

export async function getReturnItems(returnId: string) {
  const { data, error } = await supabase
    .from("return_items")
    .select("*, products(name, code)")
    .eq("return_id", returnId);
  if (error) throw error;
  return data;
}

/**
 * Cantidad ya devuelta por producto en las devoluciones COMPLETADAS de una
 * factura. Se usa para que la UI de devoluciones no permita devolver más de
 * lo que se facturó ni re-devolver lo que ya se devolvió.
 *
 * Se resuelve con una sola consulta (join `return_items` -> `returns`) para no
 * abrir un N+1: el formulario de devolución pregunta por todas las líneas de
 * la factura a la vez.
 *
 * @returns mapa `product_id` -> unidades ya devueltas.
 */
export async function getReturnedQuantitiesForInvoice(
  invoiceId: string
): Promise<Record<string, number>> {
  const { data, error } = await supabase
    .from("return_items")
    .select("product_id, quantity, returns!inner(invoice_id, status)")
    .eq("returns.invoice_id", invoiceId)
    .eq("returns.status", "COMPLETED");
  if (error) throw error;

  const totals: Record<string, number> = {};
  for (const row of (data ?? []) as Array<{
    product_id: string | null;
    quantity: number | null;
  }>) {
    if (!row.product_id) continue;
    totals[row.product_id] = (totals[row.product_id] ?? 0) + Number(row.quantity ?? 0);
  }
  return totals;
}

export async function getNextReturnNumber() {
  const cached = await getCached<string>("next_return_number");
  if (cached) return cached;

  const { data, error } = await supabase
    .from("returns")
    .select("return_number")
    .order("created_at", { ascending: false })
    .limit(1);

  if (error) throw error;

  const lastNum = data?.[0]?.return_number ?? null;
  // `nextSequenceNumber` devuelve null cuando el valor almacenado no contiene
  // dígitos utilizables. Antes esto se degradaba en silencio a "DEV-000NaN",
  // que quedaba persistido como correlativo real. Ahora es un error visible.
  const next = nextSequenceNumber(lastNum, RETURN_PREFIX, SEQUENCE_DIGITS);
  if (next === null) {
    throw new Error(
      `No se pudo determinar el siguiente numero de devolucion: el ultimo valor ` +
        `almacenado (${JSON.stringify(lastNum)}) no es un correlativo interpretable.`
    );
  }
  await setCache("next_return_number", next, 30_000);
  return next;
}

export async function createReturn(
  ret: Partial<Return>,
  items: Partial<ReturnItem>[]
) {
  const returnNumber = await getNextReturnNumber();

  const { data, error } = await supabase
    .from("returns")
    .insert({ ...ret, return_number: returnNumber })
    .select()
    .single();

  if (error) throw error;

  const returnItems = items.map((item) => ({
    return_id: data.id,
    product_id: item.product_id,
    quantity: item.quantity,
    unit_price: item.unit_price,
    line_total: item.line_total,
    reason: item.reason || null,
  }));

  invalidateCache("next_return_number");
  const { error: itemsError } = await supabase
    .from("return_items")
    .insert(returnItems);

  if (itemsError) throw itemsError;

  // Audit log
  await auditLog('return.created', {
    entityId: data.id,
    entityType: 'return',
    newValue: {
      return_number: data.return_number,
      client_id: ret.client_id,
      invoice_id: ret.invoice_id,
      status: data.status,
      total: ret.total,
    },
    metadata: { itemCount: items.length },
  }).catch(() => {});

  return data as Return;
}

/**
 * Indica que la RPC aún no existe en la base de datos.
 *
 * Mismo criterio que `isMigrationPending()` en `services/settings.ts`: durante
 * el despliegue la aplicación suele subirse antes que la migración, y no
 * queremos que toda la sección de devoluciones quede fuera de servicio.
 */
function isRpcMissing(error: { code?: string; message?: string } | null): boolean {
  return Boolean(
    error?.code === "PGRST202" || /could not find the function/i.test(error?.message || "")
  );
}

export async function completeReturn(id: string) {
  // Camino preferido: una sola transacción en la base de datos.
  const { data, error } = await supabase.rpc("complete_return_atomic", {
    p_return_id: id,
  });

  if (!error) return data as Return;

  if (!isRpcMissing(error)) throw error;

  // La migración 20260910_atomic_complete_return.sql todavía no está aplicada.
  // Se recurre al camino legacy, que conserva el defecto documentado (el estado
  // pasa a COMPLETADA antes de los pasos que pueden fallar) pero que no empeora
  // nada respecto de la situación anterior al despliegue.
  return completeReturnLegacy(id);
}

/**
 * Implementación anterior, mantenida sólo como respaldo durante el despliegue
 * progresivo. Ver `completeReturn` y la cabecera de la migración
 * `20260910_atomic_complete_return.sql` para la descripción del defecto.
 */
async function completeReturnLegacy(id: string) {
  // Idempotente: si ya está COMPLETADA no se vuelve a ajustar
  const { data: current } = await supabase
    .from("returns")
    .select("status, invoice_id")
    .eq("id", id)
    .single();
  if (current?.status === "COMPLETED") return current as Return;
  const invoiceId = current?.invoice_id;

  const { data: items } = await supabase
    .from("return_items")
    .select("product_id, quantity, line_total")
    .eq("return_id", id);

  // Obtener invoice_items para costos y PV reales
  const invoiceItemsMap = new Map<string, { unit_cost: number; pv: number }>();
  if (invoiceId && items && items.length > 0) {
    const productIds = [...new Set(items.map(i => i.product_id).filter(Boolean) as string[])];
    if (productIds.length > 0) {
      const { data: invItems } = await supabase
        .from("invoice_items")
        .select("product_id, unit_cost, pv")
        .eq("invoice_id", invoiceId)
        .in("product_id", productIds);
      if (invItems) {
        for (const ii of invItems) {
          invoiceItemsMap.set(ii.product_id, { unit_cost: Number(ii.unit_cost || 0), pv: Number(ii.pv || 0) });
        }
      }
    }
  }

  const { data, error } = await supabase
    .from("returns")
    .update({ status: "COMPLETED" })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;

  // Reversión financiera en la factura
  if (invoiceId && items && items.length > 0) {
    const returnAmount = items.reduce((sum, item) => sum + Number(item.line_total || 0), 0);
    const returnPv = items.reduce((sum, item) => {
      const ii = invoiceItemsMap.get(item.product_id);
      return sum + (ii?.pv || 0) * Number(item.quantity || 0);
    }, 0);

    // 1) Reducir balance_due y pv_total de la factura
    const { data: inv } = await supabase
      .from("invoices")
      .select("balance_due, pv_total, total, amount_paid")
      .eq("id", invoiceId)
      .single();

    if (inv) {
      const newBalanceDue = Math.max(0, Number(inv.balance_due || 0) - returnAmount);
      const newPvTotal = Math.max(0, Number(inv.pv_total || 0) - returnPv);

      // Si la devolución excede el balance_due, crear crédito
      let excessCredit = 0;
      if (returnAmount > Number(inv.balance_due || 0)) {
        excessCredit = returnAmount - Number(inv.balance_due || 0);
      }

      await supabase
        .from("invoices")
        .update({
          balance_due: newBalanceDue,
          pv_total: newPvTotal,
          status: newBalanceDue <= 0 ? "PAID" : "PARTIAL",
        })
        .eq("id", invoiceId)
        .select("id, client_id, total, amount_paid")
        .single()
        .then((res) => {
          if (res.error) throw res.error;
        });

      // Si hay excedente, crear credit_balance
      if (excessCredit > 0) {
        const { data: ret } = await supabase
          .from("returns")
          .select("client_id")
          .eq("id", id)
          .single();
        if (ret?.client_id) {
          // Crear un recibo tipo CREDIT para el excedente (trigger crea credit_balance)
          // Usamos createReceipt vía RPC directo para evitar dependencia circular
          const { data: settings } = await supabase.from("settings").select("receipt_prefix").single();
          const prefix = settings?.receipt_prefix || "REC-";
          const { data: lastRec } = await supabase
            .from("receipts")
            .select("receipt_number")
            .order("created_at", { ascending: false })
            .limit(1);
          const lastNum = lastRec?.[0]?.receipt_number ?? null;
          const nextNum = nextSequenceNumber(lastNum, prefix, SEQUENCE_DIGITS);
          if (nextNum === null) {
            throw new Error(
              `No se pudo generar el numero de recibo para el credito por ` +
                `devolucion: el ultimo correlativo (${JSON.stringify(lastNum)}) ` +
                `no es interpretable.`
            );
          }
          const receiptNumber = nextNum;

          const { data: sessData } = await supabase.auth.getSession();
          const userId = sessData.session?.user?.id;

          await supabase.from("receipts").insert({
            client_id: ret.client_id,
            invoice_id: invoiceId,
            payment_method: "CREDIT",
            amount: excessCredit,
            amount_in_words: excessCredit.toFixed(2),
            concept: `Crédito por devolución excedente #${id.slice(0, 8)}`,
            receipt_number: receiptNumber,
            created_by: userId,
            credit_excess: excessCredit,
          }).select("id").single().then((res) => {
            if (res.error) throw new Error(`No se pudo crear el crédito excedente: ${res.error.message}`);
          });
        }
      }
    }
  }

  // Reponer inventario con costos reales
  if (items && items.length > 0) {
    const ids = [...new Set(items.map(i => i.product_id).filter(Boolean) as string[])];
    const compMap = ids.length > 0 ? await getBundleComponentMap(ids) : new Map<string, BundleComponentInfo[]>();
    for (const item of items) {
      if (!item.product_id) continue;
      const comps = compMap.get(item.product_id);
      const qty = Number(item.quantity || 0);
      if (qty <= 0) continue;
      const invoiceItem = invoiceItemsMap.get(item.product_id);
      const unitCost = invoiceItem?.unit_cost || 0;
      const lineTotal = unitCost * qty;

      if (comps && comps.length > 0) {
        for (const c of comps) {
          const compInvoiceItem = invoiceItemsMap.get(c.product_id);
          const compUnitCost = compInvoiceItem?.unit_cost || 0;
          await addInventoryStock(c.product_id, qty * c.quantity, compUnitCost, compUnitCost * qty * c.quantity, "RETURN", "return", id);
        }
      } else {
        await addInventoryStock(item.product_id, qty, unitCost, lineTotal, "RETURN", "return", id);
      }
    }
  }

  return data as Return;
}

export async function cancelReturn(id: string) {
  const { data, error } = await supabase
    .from("returns")
    .update({ status: "CANCELLED" })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data as Return;
}
