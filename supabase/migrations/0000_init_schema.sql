-- ============================================================
-- ALMAIA RD - Esquema base (baseline autogenerado de la BD viva)
-- Generado: 2026-08-11T18:28:25.531Z
-- NO editar manualmente; regenerar con scripts/dump-live-schema.mjs
-- ============================================================

CREATE TABLE IF NOT EXISTS public.audit_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    action text NOT NULL,
    entity text NOT NULL,
    entity_id uuid,
    description text,
    created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.bank_accounts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bank_name text NOT NULL,
    account_type text NOT NULL,
    account_number text NOT NULL,
    holder_name text NOT NULL,
    is_default boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    id_number text,
    email text
);

CREATE TABLE IF NOT EXISTS public.bonuses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bonus_date date NOT NULL,
    bonus_type text NOT NULL,
    description text,
    amount numeric(12,2) NOT NULL,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.bundle_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bundle_id uuid NOT NULL,
    product_id uuid NOT NULL,
    quantity integer DEFAULT 1 NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.categories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.client_tag_relations (
    client_id uuid NOT NULL,
    tag_id uuid NOT NULL
);

CREATE TABLE IF NOT EXISTS public.client_tags (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL
);

CREATE TABLE IF NOT EXISTS public.clients (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    full_name text NOT NULL,
    phone text,
    email text,
    ibo_number text,
    notes text,
    credit_balance numeric(12,2) DEFAULT 0,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    stage text DEFAULT 'lead'::text,
    first_contact_date date,
    lead_source text,
    interest text,
    next_followup_date date,
    last_contact_date date,
    qualification_level text,
    closure_result text,
    stage_entered_at timestamp with time zone,
    client_type text DEFAULT 'comprador'::text,
    birthday date,
    client_type_changed_at timestamp with time zone,
    previous_client_type text,
    deleted_at timestamp with time zone
);

CREATE TABLE IF NOT EXISTS public.communications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    client_id uuid,
    type text NOT NULL,
    direction text DEFAULT 'outgoing'::text NOT NULL,
    subject text,
    body text,
    document_type text,
    document_id uuid,
    status text DEFAULT 'draft'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    sent_at timestamp with time zone
);

CREATE TABLE IF NOT EXISTS public.credit_balances (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    client_id uuid,
    receipt_id uuid,
    amount numeric(12,2) NOT NULL,
    status text DEFAULT 'AVAILABLE'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    balance numeric(12,2),
    updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.expenses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    expense_date date NOT NULL,
    category text NOT NULL,
    concept text NOT NULL,
    amount numeric(12,2) NOT NULL,
    comments text,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    payment_method text DEFAULT 'Efectivo'::text NOT NULL,
    beneficiary text,
    receipt_number text,
    subcategory text,
    is_deductible boolean DEFAULT false,
    branch text,
    is_recurring boolean DEFAULT false,
    recurring_period text
);

CREATE TABLE IF NOT EXISTS public.followups (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    client_id uuid,
    contact_date date NOT NULL,
    next_followup date,
    comments text,
    status text DEFAULT 'PENDING'::text NOT NULL
);

CREATE TABLE IF NOT EXISTS public.inventory (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    product_id uuid,
    stock integer DEFAULT 0,
    minimum_stock integer DEFAULT 3,
    average_cost numeric(12,2) DEFAULT 0,
    inventory_value numeric(12,2) DEFAULT 0,
    updated_at timestamp with time zone DEFAULT now(),
    pending_return integer DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.inventory_movements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    product_id uuid,
    movement_type text NOT NULL,
    quantity integer NOT NULL,
    reference_type text,
    reference_id uuid,
    notes text,
    created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.invoice_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    invoice_id uuid,
    product_id uuid,
    quantity integer NOT NULL,
    unit_price numeric(12,2) NOT NULL,
    unit_cost numeric(12,2) NOT NULL,
    pv numeric(10,2) DEFAULT 0,
    line_total numeric(12,2) NOT NULL,
    itbis boolean DEFAULT false,
    itbis_amount numeric(12,2) DEFAULT 0,
    custom_name text
);

CREATE TABLE IF NOT EXISTS public.invoices (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    invoice_number text NOT NULL,
    client_id uuid,
    invoice_date date NOT NULL,
    status text DEFAULT 'PENDING'::text NOT NULL,
    subtotal numeric(12,2) DEFAULT 0,
    discount_amount numeric(12,2) DEFAULT 0,
    total numeric(12,2) DEFAULT 0,
    amount_paid numeric(12,2) DEFAULT 0,
    balance_due numeric(12,2) DEFAULT 0,
    pv_total numeric(12,2) DEFAULT 0,
    bank_account_id uuid,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    notes text,
    margin integer DEFAULT 30,
    itbis_total numeric(12,2) DEFAULT 0,
    delivery_address text,
    delivery_instructions text,
    currency text,
    show_all_bank_accounts boolean DEFAULT false NOT NULL
);

CREATE TABLE IF NOT EXISTS public.products (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    image_url text,
    subcategory text,
    category_id uuid,
    subbrand_id uuid,
    description text,
    benefits text,
    cost numeric(12,2) DEFAULT 0,
    pv numeric(10,2) DEFAULT 0,
    price_30 numeric(12,2) DEFAULT 0,
    price_35 numeric(12,2) DEFAULT 0,
    active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    apply_itbis boolean DEFAULT true,
    duracion_dias integer,
    is_bundle boolean DEFAULT false NOT NULL
);

CREATE TABLE IF NOT EXISTS public.purchase_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    purchase_id uuid,
    product_id uuid,
    quantity integer NOT NULL,
    unit_cost numeric(12,2) NOT NULL,
    line_total numeric(12,2) NOT NULL,
    line_itbis numeric(12,2) DEFAULT 0,
    itbis boolean DEFAULT true,
    itbis_amount numeric(12,2) DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.purchases (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    purchase_number text NOT NULL,
    supplier_id uuid,
    purchase_date date NOT NULL,
    subtotal numeric(12,2) DEFAULT 0,
    total numeric(12,2) DEFAULT 0,
    status text DEFAULT 'DRAFT'::text NOT NULL,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    itbis numeric(12,2) DEFAULT 0,
    supplier_name text,
    notes text,
    discount_amount numeric(12,2) DEFAULT 0,
    payment_method text DEFAULT 'Efectivo'::text,
    bank_account_id uuid,
    impuesto_recogida numeric(12,2) DEFAULT 36,
    cargo_administracion numeric(12,2) DEFAULT 200
);

CREATE TABLE IF NOT EXISTS public.receipts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    receipt_number text NOT NULL,
    client_id uuid,
    invoice_id uuid,
    bank_account_id uuid,
    payment_method text NOT NULL,
    amount numeric(12,2) NOT NULL,
    amount_in_words text,
    concept text,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    receipt_date date,
    updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.return_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    return_id uuid NOT NULL,
    product_id uuid NOT NULL,
    quantity integer NOT NULL,
    unit_price numeric(12,2) NOT NULL,
    line_total numeric(12,2) NOT NULL,
    reason text,
    created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.returns (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    return_number text NOT NULL,
    invoice_id uuid NOT NULL,
    client_id uuid NOT NULL,
    return_date date NOT NULL,
    subtotal numeric(12,2) DEFAULT 0,
    total numeric(12,2) DEFAULT 0,
    reason text,
    status text DEFAULT 'DRAFT'::text NOT NULL,
    notes text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    business_name text DEFAULT 'Almaia RD'::text,
    logo_url text,
    signature_url text,
    default_margin numeric DEFAULT 30,
    invoice_prefix text DEFAULT 'FAC-'::text,
    receipt_prefix text DEFAULT 'REC-'::text,
    purchase_prefix text DEFAULT 'COM-'::text,
    created_at timestamp with time zone DEFAULT now(),
    email text,
    phone text,
    nutrilite_itbis_enabled boolean DEFAULT false,
    sender_name text DEFAULT ''::text,
    email_template text,
    whatsapp_template text,
    smtp_host text,
    smtp_port integer DEFAULT 587,
    smtp_user text,
    smtp_pass text,
    smtp_secure boolean DEFAULT false,
    ai_client_prompt text,
    ai_learning_prompt text,
    address text,
    updated_at timestamp with time zone DEFAULT now(),
    currency text DEFAULT 'DOP'::text
);

CREATE TABLE IF NOT EXISTS public.subbrands (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.suppliers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    phone text,
    email text,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    contact_person text,
    city text
);

CREATE TABLE IF NOT EXISTS public.users (
    id uuid NOT NULL,
    name text NOT NULL,
    email text NOT NULL,
    role text DEFAULT 'admin'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    preferences jsonb DEFAULT '{}'::jsonb NOT NULL
);

CREATE TABLE IF NOT EXISTS public.whatsapp_configs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    label text NOT NULL,
    phone_number_id text NOT NULL,
    access_token text NOT NULL,
    verify_token text,
    business_account_id text,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.whatsapp_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    config_id uuid,
    recipient text NOT NULL,
    message_type text NOT NULL,
    template_name text,
    status text DEFAULT 'sent'::text,
    message_id text,
    error text,
    created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE ONLY public.audit_logs ADD CONSTRAINT audit_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id);
ALTER TABLE ONLY public.audit_logs ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.bank_accounts ADD CONSTRAINT bank_accounts_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.bonuses ADD CONSTRAINT bonuses_bonus_type_check CHECK ((bonus_type = ANY (ARRAY['BONIFICACIÓN'::text, 'INCENTIVO'::text, 'PREMIO'::text, 'REEMBOLSO'::text])));
ALTER TABLE ONLY public.bonuses ADD CONSTRAINT bonuses_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id);
ALTER TABLE ONLY public.bonuses ADD CONSTRAINT bonuses_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES users(id);
ALTER TABLE ONLY public.bonuses ADD CONSTRAINT bonuses_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.bundle_items ADD CONSTRAINT bundle_items_quantity_check CHECK ((quantity > 0));
ALTER TABLE ONLY public.bundle_items ADD CONSTRAINT bundle_items_bundle_id_fkey FOREIGN KEY (bundle_id) REFERENCES products(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.bundle_items ADD CONSTRAINT bundle_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.bundle_items ADD CONSTRAINT bundle_items_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.categories ADD CONSTRAINT categories_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.categories ADD CONSTRAINT categories_name_key UNIQUE (name);
ALTER TABLE ONLY public.client_tag_relations ADD CONSTRAINT client_tag_relations_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.client_tag_relations ADD CONSTRAINT client_tag_relations_tag_id_fkey FOREIGN KEY (tag_id) REFERENCES client_tags(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.client_tag_relations ADD CONSTRAINT client_tag_relations_pkey PRIMARY KEY (client_id, tag_id);
ALTER TABLE ONLY public.client_tags ADD CONSTRAINT client_tags_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.client_tags ADD CONSTRAINT client_tags_name_key UNIQUE (name);
ALTER TABLE ONLY public.clients ADD CONSTRAINT clients_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id);
ALTER TABLE ONLY public.clients ADD CONSTRAINT clients_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES users(id);
ALTER TABLE ONLY public.clients ADD CONSTRAINT clients_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.communications ADD CONSTRAINT communications_direction_check CHECK ((direction = ANY (ARRAY['outgoing'::text, 'incoming'::text])));
ALTER TABLE ONLY public.communications ADD CONSTRAINT communications_document_type_check CHECK ((document_type = ANY (ARRAY['invoice'::text, 'receipt'::text])));
ALTER TABLE ONLY public.communications ADD CONSTRAINT communications_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'sent'::text, 'failed'::text])));
ALTER TABLE ONLY public.communications ADD CONSTRAINT communications_type_check CHECK ((type = ANY (ARRAY['email'::text, 'whatsapp'::text])));
ALTER TABLE ONLY public.communications ADD CONSTRAINT communications_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.communications ADD CONSTRAINT communications_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.credit_balances ADD CONSTRAINT credit_balances_status_check CHECK ((status = ANY (ARRAY['AVAILABLE'::text, 'USED'::text, 'EXPIRED'::text])));
ALTER TABLE ONLY public.credit_balances ADD CONSTRAINT credit_balances_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id);
ALTER TABLE ONLY public.credit_balances ADD CONSTRAINT credit_balances_receipt_id_fkey FOREIGN KEY (receipt_id) REFERENCES receipts(id);
ALTER TABLE ONLY public.credit_balances ADD CONSTRAINT credit_balances_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.expenses ADD CONSTRAINT expenses_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id);
ALTER TABLE ONLY public.expenses ADD CONSTRAINT expenses_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES users(id);
ALTER TABLE ONLY public.expenses ADD CONSTRAINT expenses_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.followups ADD CONSTRAINT followups_status_check CHECK ((status = ANY (ARRAY['PENDING'::text, 'COMPLETED'::text, 'OVERDUE'::text])));
ALTER TABLE ONLY public.followups ADD CONSTRAINT followups_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.followups ADD CONSTRAINT followups_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.inventory ADD CONSTRAINT inventory_stock_check CHECK ((stock >= 0));
ALTER TABLE ONLY public.inventory ADD CONSTRAINT inventory_product_id_fkey FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.inventory ADD CONSTRAINT inventory_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.inventory ADD CONSTRAINT inventory_product_id_key UNIQUE (product_id);
ALTER TABLE ONLY public.inventory_movements ADD CONSTRAINT inventory_movements_movement_type_check CHECK ((movement_type = ANY (ARRAY['PURCHASE'::text, 'SALE'::text, 'ADJUSTMENT'::text, 'RETURN'::text, 'CANCELLATION'::text])));
ALTER TABLE ONLY public.inventory_movements ADD CONSTRAINT inventory_movements_product_id_fkey FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.inventory_movements ADD CONSTRAINT inventory_movements_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.invoice_items ADD CONSTRAINT invoice_items_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.invoice_items ADD CONSTRAINT invoice_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES products(id);
ALTER TABLE ONLY public.invoice_items ADD CONSTRAINT invoice_items_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.invoices ADD CONSTRAINT invoices_status_check CHECK ((status = ANY (ARRAY['PENDING'::text, 'PARTIAL'::text, 'PAID'::text, 'CANCELLED'::text])));
ALTER TABLE ONLY public.invoices ADD CONSTRAINT invoices_bank_account_id_fkey FOREIGN KEY (bank_account_id) REFERENCES bank_accounts(id);
ALTER TABLE ONLY public.invoices ADD CONSTRAINT invoices_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id);
ALTER TABLE ONLY public.invoices ADD CONSTRAINT invoices_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id);
ALTER TABLE ONLY public.invoices ADD CONSTRAINT invoices_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES users(id);
ALTER TABLE ONLY public.invoices ADD CONSTRAINT invoices_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.invoices ADD CONSTRAINT invoices_invoice_number_key UNIQUE (invoice_number);
ALTER TABLE ONLY public.products ADD CONSTRAINT products_category_id_fkey FOREIGN KEY (category_id) REFERENCES categories(id);
ALTER TABLE ONLY public.products ADD CONSTRAINT products_subbrand_id_fkey FOREIGN KEY (subbrand_id) REFERENCES subbrands(id);
ALTER TABLE ONLY public.products ADD CONSTRAINT products_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.products ADD CONSTRAINT products_code_key UNIQUE (code);
ALTER TABLE ONLY public.purchase_items ADD CONSTRAINT purchase_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES products(id);
ALTER TABLE ONLY public.purchase_items ADD CONSTRAINT purchase_items_purchase_id_fkey FOREIGN KEY (purchase_id) REFERENCES purchases(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.purchase_items ADD CONSTRAINT purchase_items_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.purchases ADD CONSTRAINT purchases_status_check CHECK ((status = ANY (ARRAY['DRAFT'::text, 'COMPLETED'::text, 'CANCELLED'::text])));
ALTER TABLE ONLY public.purchases ADD CONSTRAINT purchases_bank_account_id_fkey FOREIGN KEY (bank_account_id) REFERENCES bank_accounts(id);
ALTER TABLE ONLY public.purchases ADD CONSTRAINT purchases_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id);
ALTER TABLE ONLY public.purchases ADD CONSTRAINT purchases_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES suppliers(id);
ALTER TABLE ONLY public.purchases ADD CONSTRAINT purchases_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES users(id);
ALTER TABLE ONLY public.purchases ADD CONSTRAINT purchases_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.purchases ADD CONSTRAINT purchases_purchase_number_key UNIQUE (purchase_number);
ALTER TABLE ONLY public.receipts ADD CONSTRAINT receipts_payment_method_check CHECK ((payment_method = ANY (ARRAY['CASH'::text, 'TRANSFER'::text, 'CARD'::text])));
ALTER TABLE ONLY public.receipts ADD CONSTRAINT receipts_bank_account_id_fkey FOREIGN KEY (bank_account_id) REFERENCES bank_accounts(id);
ALTER TABLE ONLY public.receipts ADD CONSTRAINT receipts_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id);
ALTER TABLE ONLY public.receipts ADD CONSTRAINT receipts_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id);
ALTER TABLE ONLY public.receipts ADD CONSTRAINT receipts_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES invoices(id);
ALTER TABLE ONLY public.receipts ADD CONSTRAINT receipts_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES users(id);
ALTER TABLE ONLY public.receipts ADD CONSTRAINT receipts_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.receipts ADD CONSTRAINT receipts_receipt_number_key UNIQUE (receipt_number);
ALTER TABLE ONLY public.return_items ADD CONSTRAINT return_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES products(id);
ALTER TABLE ONLY public.return_items ADD CONSTRAINT return_items_return_id_fkey FOREIGN KEY (return_id) REFERENCES returns(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.return_items ADD CONSTRAINT return_items_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.returns ADD CONSTRAINT returns_status_check CHECK ((status = ANY (ARRAY['DRAFT'::text, 'COMPLETED'::text, 'CANCELLED'::text])));
ALTER TABLE ONLY public.returns ADD CONSTRAINT returns_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id);
ALTER TABLE ONLY public.returns ADD CONSTRAINT returns_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id);
ALTER TABLE ONLY public.returns ADD CONSTRAINT returns_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES invoices(id);
ALTER TABLE ONLY public.returns ADD CONSTRAINT returns_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.returns ADD CONSTRAINT returns_return_number_key UNIQUE (return_number);
ALTER TABLE ONLY public.settings ADD CONSTRAINT settings_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.subbrands ADD CONSTRAINT subbrands_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.subbrands ADD CONSTRAINT subbrands_name_key UNIQUE (name);
ALTER TABLE ONLY public.suppliers ADD CONSTRAINT suppliers_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.users ADD CONSTRAINT users_role_check CHECK ((role = ANY (ARRAY['admin'::text, 'seller'::text, 'assistant'::text])));
ALTER TABLE ONLY public.users ADD CONSTRAINT users_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.whatsapp_configs ADD CONSTRAINT whatsapp_configs_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.whatsapp_logs ADD CONSTRAINT whatsapp_logs_config_id_fkey FOREIGN KEY (config_id) REFERENCES whatsapp_configs(id);
ALTER TABLE ONLY public.whatsapp_logs ADD CONSTRAINT whatsapp_logs_pkey PRIMARY KEY (id);

CREATE INDEX IF NOT EXISTS idx_bundle_items_bundle_id ON public.bundle_items USING btree (bundle_id);
CREATE INDEX IF NOT EXISTS idx_bundle_items_product_id ON public.bundle_items USING btree (product_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_bundle_items_unique ON public.bundle_items USING btree (bundle_id, product_id);
CREATE UNIQUE INDEX IF NOT EXISTS categories_name_key ON public.categories USING btree (name);
CREATE UNIQUE INDEX IF NOT EXISTS client_tags_name_key ON public.client_tags USING btree (name);
CREATE INDEX IF NOT EXISTS idx_clients_created_by ON public.clients USING btree (created_by);
CREATE INDEX IF NOT EXISTS idx_clients_deleted_at ON public.clients USING btree (deleted_at);
CREATE INDEX IF NOT EXISTS idx_communications_client_id ON public.communications USING btree (client_id);
CREATE INDEX IF NOT EXISTS idx_credit_balances_client_id ON public.credit_balances USING btree (client_id);
CREATE INDEX IF NOT EXISTS idx_followups_client_id ON public.followups USING btree (client_id);
CREATE UNIQUE INDEX IF NOT EXISTS inventory_product_id_key ON public.inventory USING btree (product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_product_id ON public.inventory_movements USING btree (product_id);
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice_id ON public.invoice_items USING btree (invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_items_product_id ON public.invoice_items USING btree (product_id);
CREATE INDEX IF NOT EXISTS idx_invoices_bank_account_id ON public.invoices USING btree (bank_account_id);
CREATE INDEX IF NOT EXISTS idx_invoices_client_id ON public.invoices USING btree (client_id);
CREATE INDEX IF NOT EXISTS idx_invoices_created_by ON public.invoices USING btree (created_by);
CREATE UNIQUE INDEX IF NOT EXISTS invoices_invoice_number_key ON public.invoices USING btree (invoice_number);
CREATE UNIQUE INDEX IF NOT EXISTS products_code_key ON public.products USING btree (code);
CREATE INDEX IF NOT EXISTS idx_purchase_items_product_id ON public.purchase_items USING btree (product_id);
CREATE INDEX IF NOT EXISTS idx_purchase_items_purchase_id ON public.purchase_items USING btree (purchase_id);
CREATE INDEX IF NOT EXISTS idx_purchases_supplier_id ON public.purchases USING btree (supplier_id);
CREATE UNIQUE INDEX IF NOT EXISTS purchases_purchase_number_key ON public.purchases USING btree (purchase_number);
CREATE INDEX IF NOT EXISTS idx_receipts_bank_account_id ON public.receipts USING btree (bank_account_id);
CREATE INDEX IF NOT EXISTS idx_receipts_client_id ON public.receipts USING btree (client_id);
CREATE INDEX IF NOT EXISTS idx_receipts_invoice_id ON public.receipts USING btree (invoice_id);
CREATE UNIQUE INDEX IF NOT EXISTS receipts_receipt_number_key ON public.receipts USING btree (receipt_number);
CREATE INDEX IF NOT EXISTS idx_return_items_product_id ON public.return_items USING btree (product_id);
CREATE INDEX IF NOT EXISTS idx_return_items_return_id ON public.return_items USING btree (return_id);
CREATE INDEX IF NOT EXISTS idx_returns_client_id ON public.returns USING btree (client_id);
CREATE INDEX IF NOT EXISTS idx_returns_invoice_id ON public.returns USING btree (invoice_id);
CREATE INDEX IF NOT EXISTS idx_returns_status ON public.returns USING btree (status);
CREATE UNIQUE INDEX IF NOT EXISTS returns_return_number_key ON public.returns USING btree (return_number);
CREATE UNIQUE INDEX IF NOT EXISTS subbrands_name_key ON public.subbrands USING btree (name);

CREATE OR REPLACE VIEW public.vw_accounts_receivable AS SELECT c.id AS client_id,
    c.full_name AS client_name,
    COALESCE(sum(i.total), (0)::numeric) AS total_invoiced,
    COALESCE(sum(i.amount_paid), (0)::numeric) AS total_paid,
    COALESCE(sum(i.balance_due), (0)::numeric) AS total_pending,
    c.credit_balance
   FROM (clients c
     LEFT JOIN invoices i ON (((i.client_id = c.id) AND (i.status <> 'CANCELLED'::text))))
  GROUP BY c.id, c.full_name, c.credit_balance;;

CREATE OR REPLACE VIEW public.vw_inventory_value AS SELECT p.id AS product_id,
    p.name AS product_name,
    p.code,
    COALESCE(i.stock, 0) AS stock,
    COALESCE(i.average_cost, (0)::numeric) AS average_cost,
    COALESCE(i.inventory_value, (0)::numeric) AS total_value,
        CASE
            WHEN (COALESCE(i.stock, 0) = 0) THEN 'AGOTADO'::text
            WHEN (COALESCE(i.stock, 0) <= COALESCE(i.minimum_stock, 3)) THEN 'BAJO'::text
            ELSE 'SUFICIENTE'::text
        END AS stock_status
   FROM (products p
     LEFT JOIN inventory i ON ((i.product_id = p.id)))
  WHERE (p.active = true);;

CREATE OR REPLACE VIEW public.vw_profitability AS SELECT COALESCE(sum(i.total), (0)::numeric) AS total_sales,
    COALESCE(sum((ii.unit_cost * (ii.quantity)::numeric)), (0)::numeric) AS total_costs,
    COALESCE(( SELECT sum(expenses.amount) AS sum
           FROM expenses
          WHERE (expenses.expense_date >= date_trunc('month'::text, (CURRENT_DATE)::timestamp with time zone))), (0)::numeric) AS total_expenses,
    COALESCE(( SELECT sum(bonuses.amount) AS sum
           FROM bonuses
          WHERE (bonuses.bonus_date >= date_trunc('month'::text, (CURRENT_DATE)::timestamp with time zone))), (0)::numeric) AS total_bonuses,
    (COALESCE(sum(i.total), (0)::numeric) - COALESCE(sum((ii.unit_cost * (ii.quantity)::numeric)), (0)::numeric)) AS gross_profit,
    (((COALESCE(sum(i.total), (0)::numeric) - COALESCE(sum((ii.unit_cost * (ii.quantity)::numeric)), (0)::numeric)) - COALESCE(( SELECT sum(expenses.amount) AS sum
           FROM expenses
          WHERE (expenses.expense_date >= date_trunc('month'::text, (CURRENT_DATE)::timestamp with time zone))), (0)::numeric)) - COALESCE(( SELECT sum(bonuses.amount) AS sum
           FROM bonuses
          WHERE (bonuses.bonus_date >= date_trunc('month'::text, (CURRENT_DATE)::timestamp with time zone))), (0)::numeric)) AS real_profit
   FROM (invoices i
     JOIN invoice_items ii ON ((ii.invoice_id = i.id)))
  WHERE ((i.status <> 'CANCELLED'::text) AND (i.invoice_date >= date_trunc('month'::text, (CURRENT_DATE)::timestamp with time zone)));;

CREATE OR REPLACE VIEW public.vw_pv_summary AS SELECT COALESCE(sum(pv_total), (0)::numeric) AS pv_month,
    COALESCE(sum(pv_total) FILTER (WHERE (invoice_date >= date_trunc('year'::text, (CURRENT_DATE)::timestamp with time zone))), (0)::numeric) AS pv_year
   FROM invoices
  WHERE ((status <> 'CANCELLED'::text) AND (invoice_date >= date_trunc('month'::text, (CURRENT_DATE)::timestamp with time zone)));;

CREATE OR REPLACE VIEW public.vw_sales_summary AS SELECT count(*) AS total_invoices,
    COALESCE(sum(total), (0)::numeric) AS total_sales,
    COALESCE(sum(total) FILTER (WHERE (invoice_date = CURRENT_DATE)), (0)::numeric) AS sales_today,
    COALESCE(sum(total) FILTER (WHERE (invoice_date >= date_trunc('week'::text, (CURRENT_DATE)::timestamp with time zone))), (0)::numeric) AS sales_week,
    COALESCE(sum(total) FILTER (WHERE (invoice_date >= date_trunc('month'::text, (CURRENT_DATE)::timestamp with time zone))), (0)::numeric) AS sales_month,
    COALESCE(sum(total) FILTER (WHERE (invoice_date >= date_trunc('year'::text, (CURRENT_DATE)::timestamp with time zone))), (0)::numeric) AS sales_year
   FROM invoices
  WHERE (status <> 'CANCELLED'::text);;

CREATE OR REPLACE VIEW public.vw_top_clients AS SELECT c.id AS client_id,
    c.full_name AS client_name,
    count(DISTINCT i.id) AS total_purchases,
    COALESCE(sum(i.total), (0)::numeric) AS total_invoiced
   FROM (clients c
     JOIN invoices i ON (((i.client_id = c.id) AND (i.status <> 'CANCELLED'::text))))
  GROUP BY c.id, c.full_name
  ORDER BY COALESCE(sum(i.total), (0)::numeric) DESC;;

CREATE OR REPLACE VIEW public.vw_top_products AS SELECT p.id AS product_id,
    p.name AS product_name,
    p.code,
    sum(ii.quantity) AS total_sold,
    sum(ii.line_total) AS total_revenue
   FROM ((invoice_items ii
     JOIN products p ON ((p.id = ii.product_id)))
     JOIN invoices i ON (((i.id = ii.invoice_id) AND (i.status <> 'CANCELLED'::text))))
  GROUP BY p.id, p.name, p.code
  ORDER BY (sum(ii.quantity)) DESC;;

CREATE OR REPLACE FUNCTION public.add_inventory_stock(p_product_id uuid, p_quantity numeric, p_unit_cost numeric, p_line_total numeric)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_existing RECORD;
  v_pending NUMERIC;
  v_fulfill NUMERIC;
BEGIN
  SELECT stock, average_cost, inventory_value, pending_return INTO v_existing
  FROM inventory WHERE product_id = p_product_id;
  
  IF FOUND THEN
    v_pending := COALESCE(v_existing.pending_return, 0);
    v_fulfill := LEAST(v_pending, p_quantity);
    
    UPDATE inventory SET
      stock = v_existing.stock + (p_quantity - v_fulfill),
      pending_return = v_pending - v_fulfill,
      average_cost = CASE WHEN v_existing.stock > 0 
        THEN ROUND(((v_existing.average_cost * v_existing.stock) + (p_quantity * p_unit_cost)) / (v_existing.stock + p_quantity), 2)
        ELSE p_unit_cost END,
      inventory_value = COALESCE(v_existing.inventory_value, 0) + p_line_total,
      updated_at = NOW()
    WHERE product_id = p_product_id;
  ELSE
    INSERT INTO inventory (product_id, stock, pending_return, average_cost, inventory_value)
    VALUES (p_product_id, p_quantity, 0, p_unit_cost, p_line_total);
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.add_inventory_stock(p_product_id uuid, p_quantity numeric, p_unit_cost numeric, p_line_total numeric, p_movement_type text DEFAULT 'PURCHASE'::text, p_reference_type text DEFAULT NULL::text, p_reference_id uuid DEFAULT NULL::uuid)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_existing RECORD;
  v_pending NUMERIC;
  v_fulfill NUMERIC;
BEGIN
  SELECT stock, average_cost, inventory_value, pending_return INTO v_existing
  FROM inventory WHERE product_id = p_product_id;

  IF FOUND THEN
    v_pending := COALESCE(v_existing.pending_return, 0);
    v_fulfill := LEAST(v_pending, p_quantity);

    UPDATE inventory SET
      stock = v_existing.stock + (p_quantity - v_fulfill),
      pending_return = v_pending - v_fulfill,
      average_cost = CASE WHEN v_existing.stock > 0
        THEN ROUND(((v_existing.average_cost * v_existing.stock) + (p_quantity * p_unit_cost)) / (v_existing.stock + p_quantity), 2)
        ELSE p_unit_cost END,
      inventory_value = COALESCE(v_existing.inventory_value, 0) + p_line_total,
      updated_at = NOW()
    WHERE product_id = p_product_id;
  ELSE
    INSERT INTO inventory (product_id, stock, pending_return, average_cost, inventory_value)
    VALUES (p_product_id, p_quantity, 0, p_unit_cost, p_line_total);
  END IF;

  INSERT INTO inventory_movements (product_id, movement_type, quantity, reference_type, reference_id)
  VALUES (p_product_id, p_movement_type, ROUND(p_quantity)::INTEGER, p_reference_type, p_reference_id);
END;
$function$;

CREATE OR REPLACE FUNCTION public.adjust_invoice_payment(p_invoice_id uuid, p_diff numeric)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_invoice RECORD;
  v_new_paid NUMERIC;
  v_new_balance NUMERIC;
BEGIN
  SELECT total, amount_paid INTO v_invoice
  FROM invoices WHERE id = p_invoice_id;
  
  v_new_paid := COALESCE(v_invoice.amount_paid, 0) + p_diff;
  v_new_balance := v_invoice.total - v_new_paid;
  
  UPDATE invoices SET
    amount_paid = v_new_paid,
    balance_due = GREATEST(v_new_balance, 0),
    status = CASE
      WHEN v_new_balance <= 0 THEN 'PAID'
      WHEN v_new_paid > 0 THEN 'PARTIAL'
      ELSE 'PENDING'
    END
  WHERE id = p_invoice_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_calculate_invoice_totals()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.pv_total := COALESCE(
    (SELECT SUM(ii.pv * ii.quantity) FROM invoice_items ii WHERE ii.invoice_id = NEW.id), 0
  );
  NEW.balance_due := NEW.total - NEW.amount_paid;
  IF NEW.balance_due = 0 AND NEW.amount_paid > 0 THEN
    NEW.status := 'PAID';
  ELSIF NEW.amount_paid > 0 THEN
    NEW.status := 'PARTIAL';
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_calculate_product_prices()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_itbis_mult NUMERIC;
BEGIN
  v_itbis_mult := CASE WHEN NEW.apply_itbis IS NOT FALSE THEN 1.18 ELSE 1 END;
  IF NEW.price_30 IS NULL OR NEW.price_30 = 0 THEN
    NEW.price_30 := CEIL(NEW.cost * v_itbis_mult * 1.30 / 50) * 50;
  END IF;
  IF NEW.price_35 IS NULL OR NEW.price_35 = 0 THEN
    NEW.price_35 := CEIL(NEW.cost * v_itbis_mult * 1.35 / 50) * 50;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_generate_invoice_number()
 RETURNS text
 LANGUAGE plpgsql
AS $function$
DECLARE
  prefix TEXT;
  next_num INTEGER;
BEGIN
  SELECT COALESCE(invoice_prefix, 'FAC-') INTO prefix FROM settings LIMIT 1;
  SELECT COALESCE(MAX(CAST(REPLACE(invoice_number, prefix, '') AS INTEGER)), 0) + 1
    INTO next_num FROM invoices WHERE invoice_number LIKE prefix || '%';
  RETURN prefix || LPAD(next_num::TEXT, 6, '0');
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_generate_purchase_number()
 RETURNS text
 LANGUAGE plpgsql
AS $function$
DECLARE
  prefix TEXT;
  next_num INTEGER;
BEGIN
  SELECT COALESCE(purchase_prefix, 'COM-') INTO prefix FROM settings LIMIT 1;
  SELECT COALESCE(MAX(CAST(REPLACE(purchase_number, prefix, '') AS INTEGER)), 0) + 1
    INTO next_num FROM purchases WHERE purchase_number LIKE prefix || '%';
  RETURN prefix || LPAD(next_num::TEXT, 6, '0');
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_generate_receipt_number()
 RETURNS text
 LANGUAGE plpgsql
AS $function$
DECLARE
  prefix TEXT;
  next_num INTEGER;
BEGIN
  SELECT COALESCE(receipt_prefix, 'REC-') INTO prefix FROM settings LIMIT 1;
  SELECT COALESCE(MAX(CAST(REPLACE(receipt_number, prefix, '') AS INTEGER)), 0) + 1
    INTO next_num FROM receipts WHERE receipt_number LIKE prefix || '%';
  RETURN prefix || LPAD(next_num::TEXT, 6, '0');
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_handle_excess_payment()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  invoice_total NUMERIC(12,2);
  excess NUMERIC(12,2);
BEGIN
  SELECT total INTO invoice_total FROM invoices WHERE id = NEW.invoice_id;
  IF NEW.amount > invoice_total THEN
    excess := NEW.amount - invoice_total;
    INSERT INTO credit_balances (client_id, receipt_id, amount, status)
    VALUES (NEW.client_id, NEW.id, excess, 'AVAILABLE');
    UPDATE clients SET credit_balance = COALESCE(credit_balance, 0) + excess
    WHERE id = NEW.client_id;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_public_functions()
 RETURNS TABLE(fn_name text)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT p.proname::TEXT AS fn_name
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
  GROUP BY p.proname
  ORDER BY p.proname;
$function$;

CREATE OR REPLACE FUNCTION public.get_user_role()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $function$ SELECT role FROM public.users WHERE id = auth.uid(); $function$;

CREATE OR REPLACE FUNCTION public.restore_inventory_stock(p_product_id uuid, p_quantity numeric, p_movement_type text DEFAULT 'CANCELLATION'::text, p_reference_type text DEFAULT NULL::text, p_reference_id uuid DEFAULT NULL::uuid)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_existing RECORD;
  v_pending NUMERIC;
  v_fulfill NUMERIC;
BEGIN
  SELECT stock, pending_return INTO v_existing
  FROM inventory WHERE product_id = p_product_id;

  IF FOUND THEN
    v_pending := COALESCE(v_existing.pending_return, 0);
    v_fulfill := LEAST(v_pending, p_quantity);

    UPDATE inventory SET
      stock = v_existing.stock + (p_quantity - v_fulfill),
      pending_return = v_pending - v_fulfill,
      updated_at = NOW()
    WHERE product_id = p_product_id;
  ELSE
    INSERT INTO inventory (product_id, stock, pending_return, minimum_stock, inventory_value)
    VALUES (p_product_id, p_quantity, 0, 3, 0);
  END IF;

  INSERT INTO inventory_movements (product_id, movement_type, quantity, reference_type, reference_id)
  VALUES (p_product_id, p_movement_type, ROUND(p_quantity)::INTEGER, p_reference_type, p_reference_id);
END;
$function$;

CREATE OR REPLACE FUNCTION public.restore_inventory_stock(p_product_id uuid, p_quantity numeric)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_existing RECORD;
  v_pending NUMERIC;
  v_fulfill NUMERIC;
BEGIN
  SELECT stock, pending_return INTO v_existing
  FROM inventory WHERE product_id = p_product_id;
  
  IF FOUND THEN
    v_pending := COALESCE(v_existing.pending_return, 0);
    v_fulfill := LEAST(v_pending, p_quantity);
    
    UPDATE inventory SET
      stock = v_existing.stock + (p_quantity - v_fulfill),
      pending_return = v_pending - v_fulfill,
      updated_at = NOW()
    WHERE product_id = p_product_id;
  ELSE
    INSERT INTO inventory (product_id, stock, pending_return, minimum_stock, inventory_value)
    VALUES (p_product_id, p_quantity, 0, 3, 0);
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.subtract_inventory_stock(p_product_id uuid, p_quantity numeric)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_existing RECORD;
  v_new_stock NUMERIC;
  v_shortfall NUMERIC;
BEGIN
  SELECT stock, inventory_value, pending_return INTO v_existing
  FROM inventory WHERE product_id = p_product_id;
  
  IF FOUND THEN
    v_new_stock := GREATEST(0, v_existing.stock - p_quantity);
    v_shortfall := p_quantity - (v_existing.stock - v_new_stock);
    
    UPDATE inventory SET
      stock = v_new_stock,
      pending_return = COALESCE(v_existing.pending_return, 0) + v_shortfall,
      updated_at = NOW()
    WHERE product_id = p_product_id;
  ELSE
    INSERT INTO inventory (product_id, stock, pending_return, inventory_value, minimum_stock)
    VALUES (p_product_id, 0, p_quantity, 0, 3);
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.subtract_inventory_stock(p_product_id uuid, p_quantity numeric, p_movement_type text DEFAULT 'SALE'::text, p_reference_type text DEFAULT NULL::text, p_reference_id uuid DEFAULT NULL::uuid)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_existing RECORD;
  v_new_stock NUMERIC;
  v_shortfall NUMERIC;
BEGIN
  SELECT stock, inventory_value, pending_return INTO v_existing
  FROM inventory WHERE product_id = p_product_id;

  IF FOUND THEN
    v_new_stock := GREATEST(0, v_existing.stock - p_quantity);
    v_shortfall := p_quantity - (v_existing.stock - v_new_stock);

    UPDATE inventory SET
      stock = v_new_stock,
      pending_return = COALESCE(v_existing.pending_return, 0) + v_shortfall,
      updated_at = NOW()
    WHERE product_id = p_product_id;
  ELSE
    INSERT INTO inventory (product_id, stock, pending_return, inventory_value, minimum_stock)
    VALUES (p_product_id, 0, p_quantity, 0, 3);
  END IF;

  INSERT INTO inventory_movements (product_id, movement_type, quantity, reference_type, reference_id)
  VALUES (p_product_id, p_movement_type, ROUND(p_quantity)::INTEGER, p_reference_type, p_reference_id);
END;
$function$;

CREATE OR REPLACE FUNCTION public.use_credit_balance(p_credit_id uuid, p_amount numeric)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  UPDATE credit_balances
  SET balance = balance - p_amount, updated_at = now()
  WHERE id = p_credit_id AND balance >= p_amount;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Crédito no encontrado o saldo insuficiente';
  END IF;
END;
$function$;

CREATE TRIGGER trg_calculate_prices BEFORE INSERT OR UPDATE OF cost, apply_itbis ON products FOR EACH ROW EXECUTE FUNCTION fn_calculate_product_prices();
CREATE TRIGGER trg_excess_payment AFTER INSERT ON receipts FOR EACH ROW EXECUTE FUNCTION fn_handle_excess_payment();

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bonuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bundle_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.followups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit_logs_select" ON public.audit_logs FOR SELECT TO public USING ((get_user_role() = ANY (ARRAY['admin'::text, 'seller'::text, 'assistant'::text])));
CREATE POLICY "pol_audit_logs" ON public.audit_logs TO public USING ((auth.role() = 'authenticated'::text)) WITH CHECK ((auth.role() = 'authenticated'::text));
CREATE POLICY "bank_accounts_delete" ON public.bank_accounts FOR DELETE TO public USING ((get_user_role() = 'admin'::text));
CREATE POLICY "bank_accounts_insert" ON public.bank_accounts FOR INSERT TO public WITH CHECK ((get_user_role() = 'admin'::text));
CREATE POLICY "bank_accounts_select" ON public.bank_accounts FOR SELECT TO public USING ((get_user_role() = ANY (ARRAY['admin'::text, 'seller'::text, 'assistant'::text])));
CREATE POLICY "bank_accounts_update" ON public.bank_accounts FOR UPDATE TO public USING ((get_user_role() = 'admin'::text)) WITH CHECK ((get_user_role() = 'admin'::text));
CREATE POLICY "bonuses_delete" ON public.bonuses FOR DELETE TO public USING ((get_user_role() = 'admin'::text));
CREATE POLICY "bonuses_insert" ON public.bonuses FOR INSERT TO public WITH CHECK ((get_user_role() = ANY (ARRAY['admin'::text, 'seller'::text])));
CREATE POLICY "bonuses_select" ON public.bonuses FOR SELECT TO public USING ((get_user_role() = ANY (ARRAY['admin'::text, 'seller'::text, 'assistant'::text])));
CREATE POLICY "bonuses_update" ON public.bonuses FOR UPDATE TO public USING ((get_user_role() = ANY (ARRAY['admin'::text, 'seller'::text]))) WITH CHECK ((get_user_role() = ANY (ARRAY['admin'::text, 'seller'::text])));
CREATE POLICY "pol_bonuses" ON public.bonuses TO public USING ((auth.role() = 'authenticated'::text)) WITH CHECK ((auth.role() = 'authenticated'::text));
CREATE POLICY "bundle_items_delete" ON public.bundle_items FOR DELETE TO public USING ((auth.role() = 'authenticated'::text));
CREATE POLICY "bundle_items_insert" ON public.bundle_items FOR INSERT TO public WITH CHECK ((auth.role() = 'authenticated'::text));
CREATE POLICY "bundle_items_select" ON public.bundle_items FOR SELECT TO public USING ((auth.role() = 'authenticated'::text));
CREATE POLICY "bundle_items_update" ON public.bundle_items FOR UPDATE TO public USING ((auth.role() = 'authenticated'::text)) WITH CHECK ((auth.role() = 'authenticated'::text));
CREATE POLICY "categories_delete" ON public.categories FOR DELETE TO public USING ((get_user_role() = 'admin'::text));
CREATE POLICY "categories_insert" ON public.categories FOR INSERT TO public WITH CHECK ((get_user_role() = ANY (ARRAY['admin'::text, 'seller'::text])));
CREATE POLICY "categories_select" ON public.categories FOR SELECT TO public USING ((get_user_role() = ANY (ARRAY['admin'::text, 'seller'::text, 'assistant'::text])));
CREATE POLICY "categories_update" ON public.categories FOR UPDATE TO public USING ((get_user_role() = ANY (ARRAY['admin'::text, 'seller'::text]))) WITH CHECK ((get_user_role() = ANY (ARRAY['admin'::text, 'seller'::text])));
CREATE POLICY "client_tag_relations_delete" ON public.client_tag_relations FOR DELETE TO public USING ((get_user_role() = ANY (ARRAY['admin'::text, 'seller'::text])));
CREATE POLICY "client_tag_relations_insert" ON public.client_tag_relations FOR INSERT TO public WITH CHECK ((get_user_role() = ANY (ARRAY['admin'::text, 'seller'::text])));
CREATE POLICY "client_tag_relations_select" ON public.client_tag_relations FOR SELECT TO public USING ((get_user_role() = ANY (ARRAY['admin'::text, 'seller'::text, 'assistant'::text])));
CREATE POLICY "client_tags_delete" ON public.client_tags FOR DELETE TO public USING ((get_user_role() = 'admin'::text));
CREATE POLICY "client_tags_insert" ON public.client_tags FOR INSERT TO public WITH CHECK ((get_user_role() = ANY (ARRAY['admin'::text, 'seller'::text])));
CREATE POLICY "client_tags_select" ON public.client_tags FOR SELECT TO public USING ((get_user_role() = ANY (ARRAY['admin'::text, 'seller'::text, 'assistant'::text])));
CREATE POLICY "client_tags_update" ON public.client_tags FOR UPDATE TO public USING ((get_user_role() = ANY (ARRAY['admin'::text, 'seller'::text]))) WITH CHECK ((get_user_role() = ANY (ARRAY['admin'::text, 'seller'::text])));
CREATE POLICY "clients_delete" ON public.clients FOR DELETE TO public USING ((get_user_role() = 'admin'::text));
CREATE POLICY "clients_insert" ON public.clients FOR INSERT TO public WITH CHECK ((get_user_role() = ANY (ARRAY['admin'::text, 'seller'::text])));
CREATE POLICY "clients_select" ON public.clients FOR SELECT TO public USING ((get_user_role() = ANY (ARRAY['admin'::text, 'seller'::text, 'assistant'::text])));
CREATE POLICY "clients_update" ON public.clients FOR UPDATE TO public USING ((get_user_role() = ANY (ARRAY['admin'::text, 'seller'::text]))) WITH CHECK ((get_user_role() = ANY (ARRAY['admin'::text, 'seller'::text])));
CREATE POLICY "communications_delete" ON public.communications FOR DELETE TO public USING ((get_user_role() = ANY (ARRAY['admin'::text, 'seller'::text])));
CREATE POLICY "communications_insert" ON public.communications FOR INSERT TO public WITH CHECK ((get_user_role() = ANY (ARRAY['admin'::text, 'seller'::text, 'assistant'::text])));
CREATE POLICY "communications_select" ON public.communications FOR SELECT TO public USING ((get_user_role() = ANY (ARRAY['admin'::text, 'seller'::text, 'assistant'::text])));
CREATE POLICY "communications_update" ON public.communications FOR UPDATE TO public USING ((get_user_role() = ANY (ARRAY['admin'::text, 'seller'::text, 'assistant'::text]))) WITH CHECK ((get_user_role() = ANY (ARRAY['admin'::text, 'seller'::text, 'assistant'::text])));
CREATE POLICY "credit_balances_insert" ON public.credit_balances FOR INSERT TO public WITH CHECK ((get_user_role() = ANY (ARRAY['admin'::text, 'seller'::text])));
CREATE POLICY "credit_balances_select" ON public.credit_balances FOR SELECT TO public USING ((get_user_role() = ANY (ARRAY['admin'::text, 'seller'::text, 'assistant'::text])));
CREATE POLICY "credit_balances_update" ON public.credit_balances FOR UPDATE TO public USING ((get_user_role() = ANY (ARRAY['admin'::text, 'seller'::text]))) WITH CHECK ((get_user_role() = ANY (ARRAY['admin'::text, 'seller'::text])));
CREATE POLICY "pol_credit_balances" ON public.credit_balances TO public USING ((auth.role() = 'authenticated'::text)) WITH CHECK ((auth.role() = 'authenticated'::text));
CREATE POLICY "expenses_delete" ON public.expenses FOR DELETE TO public USING ((get_user_role() = 'admin'::text));
CREATE POLICY "expenses_insert" ON public.expenses FOR INSERT TO public WITH CHECK ((get_user_role() = ANY (ARRAY['admin'::text, 'seller'::text])));
CREATE POLICY "expenses_select" ON public.expenses FOR SELECT TO public USING ((get_user_role() = ANY (ARRAY['admin'::text, 'seller'::text, 'assistant'::text])));
CREATE POLICY "expenses_update" ON public.expenses FOR UPDATE TO public USING ((get_user_role() = ANY (ARRAY['admin'::text, 'seller'::text]))) WITH CHECK ((get_user_role() = ANY (ARRAY['admin'::text, 'seller'::text])));
CREATE POLICY "pol_expenses" ON public.expenses TO public USING ((auth.role() = 'authenticated'::text)) WITH CHECK ((auth.role() = 'authenticated'::text));
CREATE POLICY "followups_delete" ON public.followups FOR DELETE TO public USING ((get_user_role() = ANY (ARRAY['admin'::text, 'seller'::text])));
CREATE POLICY "followups_insert" ON public.followups FOR INSERT TO public WITH CHECK ((get_user_role() = ANY (ARRAY['admin'::text, 'seller'::text, 'assistant'::text])));
CREATE POLICY "followups_select" ON public.followups FOR SELECT TO public USING ((get_user_role() = ANY (ARRAY['admin'::text, 'seller'::text, 'assistant'::text])));
CREATE POLICY "followups_update" ON public.followups FOR UPDATE TO public USING ((get_user_role() = ANY (ARRAY['admin'::text, 'seller'::text, 'assistant'::text]))) WITH CHECK ((get_user_role() = ANY (ARRAY['admin'::text, 'seller'::text, 'assistant'::text])));
CREATE POLICY "pol_followups" ON public.followups TO public USING ((auth.role() = 'authenticated'::text)) WITH CHECK ((auth.role() = 'authenticated'::text));
CREATE POLICY "inventory_insert" ON public.inventory FOR INSERT TO public WITH CHECK ((get_user_role() = ANY (ARRAY['admin'::text, 'seller'::text])));
CREATE POLICY "inventory_select" ON public.inventory FOR SELECT TO public USING ((get_user_role() = ANY (ARRAY['admin'::text, 'seller'::text, 'assistant'::text])));
CREATE POLICY "inventory_update" ON public.inventory FOR UPDATE TO public USING ((get_user_role() = ANY (ARRAY['admin'::text, 'seller'::text]))) WITH CHECK ((get_user_role() = ANY (ARRAY['admin'::text, 'seller'::text])));
CREATE POLICY "pol_inventory" ON public.inventory TO public USING ((auth.role() = 'authenticated'::text)) WITH CHECK ((auth.role() = 'authenticated'::text));
CREATE POLICY "inventory_movements_delete" ON public.inventory_movements FOR DELETE TO public USING ((get_user_role() = 'admin'::text));
CREATE POLICY "inventory_movements_insert" ON public.inventory_movements FOR INSERT TO public WITH CHECK ((get_user_role() = ANY (ARRAY['admin'::text, 'seller'::text])));
CREATE POLICY "inventory_movements_select" ON public.inventory_movements FOR SELECT TO public USING ((get_user_role() = ANY (ARRAY['admin'::text, 'seller'::text, 'assistant'::text])));
CREATE POLICY "pol_inventory_movements" ON public.inventory_movements TO public USING ((auth.role() = 'authenticated'::text)) WITH CHECK ((auth.role() = 'authenticated'::text));
CREATE POLICY "invoice_items_delete" ON public.invoice_items FOR DELETE TO public USING ((get_user_role() = 'admin'::text));
CREATE POLICY "invoice_items_insert" ON public.invoice_items FOR INSERT TO public WITH CHECK ((get_user_role() = ANY (ARRAY['admin'::text, 'seller'::text])));
CREATE POLICY "invoice_items_select" ON public.invoice_items FOR SELECT TO public USING ((get_user_role() = ANY (ARRAY['admin'::text, 'seller'::text, 'assistant'::text])));
CREATE POLICY "pol_invoice_items" ON public.invoice_items TO public USING ((auth.role() = 'authenticated'::text)) WITH CHECK ((auth.role() = 'authenticated'::text));
CREATE POLICY "invoices_delete" ON public.invoices FOR DELETE TO public USING ((get_user_role() = 'admin'::text));
CREATE POLICY "invoices_insert" ON public.invoices FOR INSERT TO public WITH CHECK ((get_user_role() = ANY (ARRAY['admin'::text, 'seller'::text])));
CREATE POLICY "invoices_select" ON public.invoices FOR SELECT TO public USING ((get_user_role() = ANY (ARRAY['admin'::text, 'seller'::text, 'assistant'::text])));
CREATE POLICY "invoices_update" ON public.invoices FOR UPDATE TO public USING ((get_user_role() = ANY (ARRAY['admin'::text, 'seller'::text]))) WITH CHECK ((get_user_role() = ANY (ARRAY['admin'::text, 'seller'::text])));
CREATE POLICY "pol_products" ON public.products TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "products_delete" ON public.products FOR DELETE TO public USING ((get_user_role() = 'admin'::text));
CREATE POLICY "products_insert" ON public.products FOR INSERT TO public WITH CHECK ((get_user_role() = ANY (ARRAY['admin'::text, 'seller'::text])));
CREATE POLICY "products_select" ON public.products FOR SELECT TO public USING ((get_user_role() = ANY (ARRAY['admin'::text, 'seller'::text, 'assistant'::text])));
CREATE POLICY "products_update" ON public.products FOR UPDATE TO public USING ((get_user_role() = ANY (ARRAY['admin'::text, 'seller'::text]))) WITH CHECK ((get_user_role() = ANY (ARRAY['admin'::text, 'seller'::text])));
CREATE POLICY "pol_purchase_items" ON public.purchase_items TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "purchase_items_delete" ON public.purchase_items FOR DELETE TO public USING ((get_user_role() = 'admin'::text));
CREATE POLICY "purchase_items_insert" ON public.purchase_items FOR INSERT TO public WITH CHECK ((get_user_role() = ANY (ARRAY['admin'::text, 'seller'::text])));
CREATE POLICY "purchase_items_select" ON public.purchase_items FOR SELECT TO public USING ((get_user_role() = ANY (ARRAY['admin'::text, 'seller'::text, 'assistant'::text])));
CREATE POLICY "pol_purchases" ON public.purchases TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "purchases_delete" ON public.purchases FOR DELETE TO public USING ((get_user_role() = 'admin'::text));
CREATE POLICY "purchases_insert" ON public.purchases FOR INSERT TO public WITH CHECK ((get_user_role() = ANY (ARRAY['admin'::text, 'seller'::text])));
CREATE POLICY "purchases_select" ON public.purchases FOR SELECT TO public USING ((get_user_role() = ANY (ARRAY['admin'::text, 'seller'::text, 'assistant'::text])));
CREATE POLICY "purchases_update" ON public.purchases FOR UPDATE TO public USING ((get_user_role() = ANY (ARRAY['admin'::text, 'seller'::text]))) WITH CHECK ((get_user_role() = ANY (ARRAY['admin'::text, 'seller'::text])));
CREATE POLICY "pol_receipts" ON public.receipts TO public USING ((auth.role() = 'authenticated'::text)) WITH CHECK ((auth.role() = 'authenticated'::text));
CREATE POLICY "receipts_insert" ON public.receipts FOR INSERT TO public WITH CHECK ((get_user_role() = ANY (ARRAY['admin'::text, 'seller'::text])));
CREATE POLICY "receipts_select" ON public.receipts FOR SELECT TO public USING ((get_user_role() = ANY (ARRAY['admin'::text, 'seller'::text, 'assistant'::text])));
CREATE POLICY "receipts_update" ON public.receipts FOR UPDATE TO public USING ((get_user_role() = ANY (ARRAY['admin'::text, 'seller'::text]))) WITH CHECK ((get_user_role() = ANY (ARRAY['admin'::text, 'seller'::text])));
CREATE POLICY "return_items_delete" ON public.return_items FOR DELETE TO public USING ((get_user_role() = 'admin'::text));
CREATE POLICY "return_items_insert" ON public.return_items FOR INSERT TO public WITH CHECK ((get_user_role() = ANY (ARRAY['admin'::text, 'seller'::text])));
CREATE POLICY "return_items_select" ON public.return_items FOR SELECT TO public USING ((get_user_role() = ANY (ARRAY['admin'::text, 'seller'::text, 'assistant'::text])));
CREATE POLICY "return_items_update" ON public.return_items FOR UPDATE TO public USING ((get_user_role() = ANY (ARRAY['admin'::text, 'seller'::text]))) WITH CHECK ((get_user_role() = ANY (ARRAY['admin'::text, 'seller'::text])));
CREATE POLICY "returns_delete" ON public.returns FOR DELETE TO public USING ((get_user_role() = 'admin'::text));
CREATE POLICY "returns_insert" ON public.returns FOR INSERT TO public WITH CHECK ((get_user_role() = ANY (ARRAY['admin'::text, 'seller'::text])));
CREATE POLICY "returns_select" ON public.returns FOR SELECT TO public USING ((get_user_role() = ANY (ARRAY['admin'::text, 'seller'::text, 'assistant'::text])));
CREATE POLICY "returns_update" ON public.returns FOR UPDATE TO public USING ((get_user_role() = ANY (ARRAY['admin'::text, 'seller'::text]))) WITH CHECK ((get_user_role() = ANY (ARRAY['admin'::text, 'seller'::text])));
CREATE POLICY "settings_delete" ON public.settings FOR DELETE TO public USING ((get_user_role() = 'admin'::text));
CREATE POLICY "settings_insert" ON public.settings FOR INSERT TO public WITH CHECK ((get_user_role() = 'admin'::text));
CREATE POLICY "settings_select" ON public.settings FOR SELECT TO public USING ((get_user_role() = ANY (ARRAY['admin'::text, 'seller'::text, 'assistant'::text])));
CREATE POLICY "settings_update" ON public.settings FOR UPDATE TO public USING ((get_user_role() = 'admin'::text)) WITH CHECK ((get_user_role() = 'admin'::text));
CREATE POLICY "subbrands_delete" ON public.subbrands FOR DELETE TO public USING ((get_user_role() = 'admin'::text));
CREATE POLICY "subbrands_insert" ON public.subbrands FOR INSERT TO public WITH CHECK ((get_user_role() = ANY (ARRAY['admin'::text, 'seller'::text])));
CREATE POLICY "subbrands_select" ON public.subbrands FOR SELECT TO public USING ((get_user_role() = ANY (ARRAY['admin'::text, 'seller'::text, 'assistant'::text])));
CREATE POLICY "subbrands_update" ON public.subbrands FOR UPDATE TO public USING ((get_user_role() = ANY (ARRAY['admin'::text, 'seller'::text]))) WITH CHECK ((get_user_role() = ANY (ARRAY['admin'::text, 'seller'::text])));
CREATE POLICY "pol_suppliers" ON public.suppliers TO public USING ((auth.role() = 'authenticated'::text)) WITH CHECK ((auth.role() = 'authenticated'::text));
CREATE POLICY "suppliers_delete" ON public.suppliers FOR DELETE TO public USING ((get_user_role() = 'admin'::text));
CREATE POLICY "suppliers_insert" ON public.suppliers FOR INSERT TO public WITH CHECK ((get_user_role() = ANY (ARRAY['admin'::text, 'seller'::text])));
CREATE POLICY "suppliers_select" ON public.suppliers FOR SELECT TO public USING ((get_user_role() = ANY (ARRAY['admin'::text, 'seller'::text, 'assistant'::text])));
CREATE POLICY "suppliers_update" ON public.suppliers FOR UPDATE TO public USING ((get_user_role() = ANY (ARRAY['admin'::text, 'seller'::text]))) WITH CHECK ((get_user_role() = ANY (ARRAY['admin'::text, 'seller'::text])));
CREATE POLICY "Users can insert own data" ON public.users FOR INSERT TO public WITH CHECK ((auth.uid() = id));
CREATE POLICY "users_select_own" ON public.users FOR SELECT TO public USING ((auth.uid() = id));
CREATE POLICY "whatsapp_configs_delete" ON public.whatsapp_configs FOR DELETE TO public USING ((get_user_role() = 'admin'::text));
CREATE POLICY "whatsapp_configs_insert" ON public.whatsapp_configs FOR INSERT TO public WITH CHECK ((get_user_role() = 'admin'::text));
CREATE POLICY "whatsapp_configs_select" ON public.whatsapp_configs FOR SELECT TO public USING ((get_user_role() = ANY (ARRAY['admin'::text, 'seller'::text, 'assistant'::text])));
CREATE POLICY "whatsapp_configs_update" ON public.whatsapp_configs FOR UPDATE TO public USING ((get_user_role() = 'admin'::text)) WITH CHECK ((get_user_role() = 'admin'::text));
CREATE POLICY "whatsapp_logs_insert" ON public.whatsapp_logs FOR INSERT TO public WITH CHECK ((get_user_role() = ANY (ARRAY['admin'::text, 'seller'::text, 'assistant'::text])));
CREATE POLICY "whatsapp_logs_select" ON public.whatsapp_logs FOR SELECT TO public USING ((get_user_role() = ANY (ARRAY['admin'::text, 'seller'::text, 'assistant'::text])));

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.audit_logs TO anon;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.audit_logs TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.audit_logs TO service_role;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.bank_accounts TO anon;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.bank_accounts TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.bank_accounts TO service_role;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.bonuses TO anon;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.bonuses TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.bonuses TO service_role;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.bundle_items TO anon;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.bundle_items TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.bundle_items TO service_role;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.categories TO anon;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.categories TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.categories TO service_role;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.client_tag_relations TO anon;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.client_tag_relations TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.client_tag_relations TO service_role;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.client_tags TO anon;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.client_tags TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.client_tags TO service_role;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.clients TO anon;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.clients TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.clients TO service_role;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.communications TO anon;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.communications TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.communications TO service_role;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.credit_balances TO anon;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.credit_balances TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.credit_balances TO service_role;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.expenses TO anon;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.expenses TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.expenses TO service_role;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.followups TO anon;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.followups TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.followups TO service_role;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.inventory TO anon;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.inventory TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.inventory TO service_role;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.inventory_movements TO anon;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.inventory_movements TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.inventory_movements TO service_role;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.invoice_items TO anon;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.invoice_items TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.invoice_items TO service_role;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.invoices TO anon;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.invoices TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.invoices TO service_role;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.products TO anon;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.products TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.products TO service_role;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.purchase_items TO anon;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.purchase_items TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.purchase_items TO service_role;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.purchases TO anon;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.purchases TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.purchases TO service_role;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.receipts TO anon;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.receipts TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.receipts TO service_role;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.return_items TO anon;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.return_items TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.return_items TO service_role;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.returns TO anon;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.returns TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.returns TO service_role;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.settings TO anon;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.settings TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.settings TO service_role;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.subbrands TO anon;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.subbrands TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.subbrands TO service_role;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.suppliers TO anon;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.suppliers TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.suppliers TO service_role;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.users TO anon;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.users TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.users TO service_role;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.vw_accounts_receivable TO anon;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.vw_accounts_receivable TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.vw_accounts_receivable TO service_role;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.vw_inventory_value TO anon;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.vw_inventory_value TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.vw_inventory_value TO service_role;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.vw_profitability TO anon;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.vw_profitability TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.vw_profitability TO service_role;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.vw_pv_summary TO anon;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.vw_pv_summary TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.vw_pv_summary TO service_role;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.vw_sales_summary TO anon;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.vw_sales_summary TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.vw_sales_summary TO service_role;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.vw_top_clients TO anon;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.vw_top_clients TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.vw_top_clients TO service_role;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.vw_top_products TO anon;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.vw_top_products TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.vw_top_products TO service_role;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.whatsapp_configs TO anon;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.whatsapp_configs TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.whatsapp_configs TO service_role;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.whatsapp_logs TO anon;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.whatsapp_logs TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.whatsapp_logs TO service_role;