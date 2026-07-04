export interface User {
  id: string;
  name: string;
  email: string;
  role: "admin" | "seller" | "assistant";
  created_at: string;
}

export type ClientType = "comprador" | "negocio";

export interface Client {
  id: string;
  full_name: string;
  phone: string;
  email: string;
  ibo_number: string;
  notes: string;
  credit_balance: number;
  client_type: ClientType;
  stage: string;
  qualification_level: string | null;
  closure_result: string | null;
  stage_entered_at: string | null;
  first_contact_date: string | null;
  lead_source: string | null;
  interest: string | null;
  next_followup_date: string | null;
  last_contact_date: string | null;
  birthday: string | null;
  client_type_changed_at: string | null;
  previous_client_type: ClientType | null;
  created_at: string;
  updated_at: string;
  created_by?: string;
  updated_by?: string;
}

export interface ClientCardData extends Client {
  pending_balance: number;
  total_spent: number;
  num_purchases: number;
  last_purchase_date: string | null;
  days_since_last_purchase: number | null;
  avg_ticket: number;
  pv_total: number;
  top_products: { name: string; count: number }[];
  tags: { id: string; name: string }[];
  next_action: { date: string; description: string } | null;
  repurchase_date: string | null;
  days_in_stage: number | null;
}

export interface ClientTag {
  id: string;
  name: string;
}

export interface ClientTagRelation {
  client_id: string;
  tag_id: string;
}

export interface Category {
  id: string;
  name: string;
  active: boolean;
  created_at: string;
}

export interface Subbrand {
  id: string;
  name: string;
  active: boolean;
  created_at: string;
}

export interface Product {
  id: string;
  code: string;
  name: string;
  image_url: string;
  subcategory: string;
  category_id: string;
  subbrand_id: string;
  description: string;
  benefits: string;
  cost: number;
  pv: number;
  price_30: number;
  price_35: number;
  active: boolean;
  apply_itbis: boolean;
  duracion_dias: number | null;
  created_at: string;
  updated_at: string;
}

export interface Inventory {
  id: string;
  product_id: string;
  stock: number;
  minimum_stock: number;
  average_cost: number;
  inventory_value: number;
  pending_return: number;
  updated_at: string;
}

export type MovementType = "PURCHASE" | "SALE" | "ADJUSTMENT" | "RETURN" | "CANCELLATION";

export interface InventoryMovement {
  id: string;
  product_id: string;
  movement_type: MovementType;
  quantity: number;
  reference_type: string;
  reference_id: string;
  notes: string;
  created_at: string;
}

export interface Supplier {
  id: string;
  name: string;
  contact_person?: string;
  phone?: string;
  email?: string;
  city?: string;
  notes?: string;
  created_at: string;
}

export type PurchaseStatus = "DRAFT" | "COMPLETED" | "CANCELLED";

export interface Purchase {
  id: string;
  purchase_number: string;
  supplier_id?: string;
  supplier_name?: string;
  purchase_date: string;
  subtotal: number;
  itbis: number;
  discount_amount: number;
  impuesto_recogida: number;
  cargo_administracion: number;
  total: number;
  notes?: string;
  payment_method?: string;
  bank_account_id?: string;
  status: PurchaseStatus;
  created_at: string;
  created_by?: string;
  updated_by?: string;
}

export interface PurchaseItem {
  id: string;
  purchase_id: string;
  product_id: string;
  quantity: number;
  unit_cost: number;
  line_total: number;
  itbis: boolean;
}

export type InvoiceStatus = "PENDING" | "PARTIAL" | "PAID" | "CANCELLED";

export interface Invoice {
  id: string;
  invoice_number: string;
  client_id: string;
  invoice_date: string;
  status: InvoiceStatus;
  subtotal: number;
  discount_amount: number;
  itbis_total: number;
  total: number;
  amount_paid: number;
  balance_due: number;
  pv_total: number;
  notes?: string;
  bank_account_id?: string;
  margin?: number;
  created_at: string;
  updated_at: string;
  created_by?: string;
  updated_by?: string;
}

export interface InvoiceItem {
  id: string;
  invoice_id: string;
  product_id?: string;
  custom_name?: string;
  quantity: number;
  unit_price: number;
  unit_cost: number;
  pv: number;
  line_total: number;
  itbis: boolean;
  itbis_amount: number;
}

export type PaymentMethod = "CASH" | "TRANSFER" | "CARD";

export interface Receipt {
  id: string;
  receipt_number: string;
  client_id: string;
  invoice_id: string;
  bank_account_id?: string;
  payment_method: PaymentMethod;
  amount: number;
  amount_in_words: string;
  concept: string;
  receipt_date?: string;
  created_at: string;
  created_by?: string;
  updated_by?: string;
}

export type CreditStatus = "AVAILABLE" | "USED" | "EXPIRED";

export interface CreditBalance {
  id: string;
  client_id: string;
  receipt_id: string;
  amount: number;
  status: CreditStatus;
  created_at: string;
}

export type FollowupStatus = "PENDING" | "COMPLETED" | "OVERDUE";

export interface Followup {
  id: string;
  client_id: string;
  contact_date: string;
  next_followup: string;
  comments: string;
  status: FollowupStatus;
}

export interface Expense {
  id: string;
  expense_date: string;
  category: string;
  concept: string;
  amount: number;
  payment_method: string;
  beneficiary?: string;
  receipt_number?: string;
  subcategory?: string;
  is_deductible: boolean;
  branch?: string;
  is_recurring: boolean;
  recurring_period?: string;
  comments?: string;
  created_at: string;
  created_by?: string;
  updated_by?: string;
}

export type BonusType = "BONIFICACIÓN" | "INCENTIVO" | "PREMIO" | "REEMBOLSO";

export interface Bonus {
  id: string;
  bonus_date: string;
  bonus_type: BonusType;
  description: string;
  amount: number;
  created_at: string;
  created_by?: string;
  updated_by?: string;
}

export interface BankAccount {
  id: string;
  bank_name: string;
  account_type: string;
  account_number: string;
  holder_name: string;
  id_number: string;
  email: string;
  is_default: boolean;
  created_at: string;
}

export interface Settings {
  id: string;
  business_name: string;
  logo_url: string;
  signature_url: string;
  default_margin: number;
  invoice_prefix: string;
  receipt_prefix: string;
  purchase_prefix: string;
  email: string;
  phone: string;
  sender_name: string;
  email_template: string;
  whatsapp_template: string;
  smtp_host: string;
  smtp_port: number;
  smtp_user: string;
  smtp_pass: string;
  smtp_secure: boolean;
  nutrilite_itbis_enabled?: boolean;
  ai_client_prompt: string;
  ai_learning_prompt: string;
  created_at: string;
}

export type AuditAction =
  | "CLIENT_CREATED"
  | "CLIENT_UPDATED"
  | "INVOICE_CREATED"
  | "INVOICE_UPDATED"
  | "INVOICE_CANCELLED"
  | "PAYMENT_REGISTERED"
  | "RECEIPT_DELETED"
  | "PRODUCT_CREATED"
  | "PRODUCT_UPDATED"
  | "PURCHASE_CREATED"
  | "PURCHASE_UPDATED"
  | "PURCHASE_CANCELLED";

export interface AuditLog {
  id: string;
  user_id: string;
  action: AuditAction;
  entity: string;
  entity_id: string;
  description: string;
  created_at: string;
}

export type CommunicationType = "email" | "whatsapp";
export type CommunicationDirection = "outgoing" | "incoming";
export type CommunicationStatus = "draft" | "sent" | "failed";

export interface Communication {
  id: string;
  client_id: string;
  type: CommunicationType;
  direction: CommunicationDirection;
  subject: string;
  body: string;
  document_type: "invoice" | "receipt" | null;
  document_id: string;
  status: CommunicationStatus;
  created_at: string;
  sent_at: string | null;
}

export interface LearningNote {
  id: string;
  title: string;
  content: string;
  tags: string;
  created_at: string;
  updated_at: string;
}
