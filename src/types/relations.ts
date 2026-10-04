/**
 * Tipos de las relaciones que devuelve Supabase al hacer joins.
 *
 * Antes cada pantalla declaraba su propia versión de "un cliente con su
 * nombre" y de "una factura con su cliente", escribiendo a mano las mismas
 * cinco propiedades en facturacion, recibos, creditos, cuentas-por-cobrar,
 * dashboard y catalogo. Con seis copias, cambiar un campo obligaba a tocar
 * seis sitios y era facil olvidar uno.
 *
 * Aqui vive una sola version de cada referencia, con la regla de que todos los
 * campos son opcionales: Supabase devuelve `null` en la relacion cuando la
 * consulta no trae el join, y devuelve solo las columnas pedidas en el
 * `select`, no la fila entera. Ponerlos obligatorios obligaba a mentir con
 * `as` en cada uso.
 *
 * PENDIENTE DE HACER BIEN
 * El cliente de Supabase de src/lib/supabase.ts se crea sin el tipo `Database`
 * que genera Postgres, asi que los resultados de las consultas llegan sin
 * tipar y por eso hacen falta estas interfaces. Tipar el cliente eliminaria
 * esta indireccion de raiz, pero exige que los 31 tipos de
 * src/types/database.ts coincidan columna por columna con el esquema real, y
 * un desajuste ahi rompe todas las consultas de la app de golpe. Es un trabajo
 * de una sesion entera con las cuatro puertas en verde, no un refactor
 * escondido dentro de otro.
 */

import type { BundleItem, Client, CreditBalance, Invoice, Product, Receipt } from "@/types/database";

// ── Referencias minimas ───────────────────────────────────────────────────────

/** Referencia minima a un cliente. */
export interface ClientRef {
  id?: string;
  full_name?: string | null;
  phone?: string | null;
  email?: string | null;
  id_number?: string | null;
}

/** Referencia minima a una cuenta bancaria. */
export interface BankAccountRef {
  id?: string;
  holder_name?: string | null;
  id_number?: string | null;
  email?: string | null;
  bank_name?: string | null;
  account_type?: string | null;
  account_number?: string | null;
}

export interface SubbrandRef {
  id?: string;
  name?: string | null;
}

export interface CategoryRef {
  id?: string;
  name?: string | null;
}

export interface ProductRef {
  id?: string;
  name?: string | null;
  is_bundle?: boolean | null;
  subbrands?: SubbrandRef | null;
  categories?: CategoryRef | null;
}

export interface ReceiptRef {
  id?: string;
  receipt_number?: string | null;
  receipt_date?: string | null;
}

/**
 * Linea de factura con su producto.
 *
 * No extiende `InvoiceItem` a proposito: aqui todos los campos son
 * opcionales. Cuando la consulta trae joins anidados (`invoice_items(*,
 * products(*, subbrands(name)))`) el cliente no puede decir que columnas
 * vienen, y las pantallas pintan cada linea con `?? 0` por si falta alguna.
 * Con campos obligatorios habia que mentir con `as` en cada sitio.
 */
export interface InvoiceLineWithProduct {
  id?: string;
  product_id?: string | null;
  quantity?: number | null;
  unit_price?: number | null;
  unit_cost?: number | null;
  line_total?: number | null;
  pv?: number | null;
  itbis?: boolean | null;
  itbis_amount?: number | null;
  custom_name?: string | null;
  products?: ProductRef | null;
  bundle_items?: BundleItem[] | null;
}

// ── Composiciones que usan varias pantallas ───────────────────────────────────

/** Referencia a la factura que trae un recibo, con su cliente y sus lineas. */
export interface InvoiceRef {
  id?: string;
  invoice_number?: string | null;
  invoice_date?: string | null;
  total?: number | null;
  amount_paid?: number | null;
  status?: string | null;
  client_id?: string | null;
  clients?: ClientRef | null;
  invoice_items?: InvoiceLineWithProduct[] | null;
}

export type InvoiceWithClient = Invoice & { clients?: ClientRef | null };

/** Factura con sus lineas, su cliente y su banco: el detalle completo. */
export type InvoiceFull = InvoiceWithClient & {
  invoice_items?: InvoiceLineWithProduct[] | null;
  bank_accounts?: BankAccountRef | null;
  bundle_items?: BundleItem[] | null;
};

export type ReceiptWithRelations = Receipt & {
  clients?: ClientRef | null;
  invoices?: InvoiceRef | null;
  bank_accounts?: BankAccountRef | null;
};

/**
 * Producto del catalogo con submarca, categoria y, si es un bundle, sus
 * componentes. Es recursivo a proposito: un bundle puede contener otro bundle,
 * y por eso `CatalogBundleItem` vuelve a apuntar aqui.
 */
export interface CatalogBundleItem extends Omit<BundleItem, "products"> {
  products?: CatalogProduct | null;
}

export interface CatalogProduct extends Product {
  subbrands?: SubbrandRef | null;
  categories?: CategoryRef | null;
  bundle_items?: CatalogBundleItem[] | null;
}

/** El mismo tipo con otro nombre, para el codigo que ya lo tenia asi. */
export type ProductWithRelations = CatalogProduct;

export type CreditWithRelations = CreditBalance & {
  clients?: ClientRef | null;
  receipts?: ReceiptRef | null;
};

/**
 * El servicio de clientes devuelve `credit_balance` como texto (viene de una
 * funcion de Postgres) y anade `pending_balance`. Aqui ambos quedan como
 * numero para que `formatCurrency` no reciba un string.
 */
export type ClientWithBalances = Omit<Client, "credit_balance"> & {
  pending_balance?: number;
  credit_balance?: number;
};
