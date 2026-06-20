-- Seed data de prueba para Almaia RD

-- ============================================================
-- CLIENTES (10)
-- ============================================================
INSERT INTO clients (id, full_name, email, phone, ibo_number, notes, credit_balance) VALUES
  ('a1000000-0000-4000-8000-000000000001', 'María Fernández', 'maria.fernandez@gmail.com', '809-555-0101', 'IBO-001', 'Cliente VIP, compra mensual', 0),
  ('a1000000-0000-4000-8000-000000000002', 'Carlos Jiménez', 'cjimenez@hotmail.com', '809-555-0102', 'IBO-002', 'Distribuidor nivel plata', 0),
  ('a1000000-0000-4000-8000-000000000003', 'Ana Rodríguez', 'arodriguez@gmail.com', '829-555-0103', 'IBO-003', NULL, 0),
  ('a1000000-0000-4000-8000-000000000004', 'Pedro Martínez', 'pedromartinez@yahoo.com', '809-555-0104', 'IBO-004', NULL, 0),
  ('a1000000-0000-4000-8000-000000000005', 'Laura Sánchez', 'laurita.sanchez@icloud.com', '849-555-0105', 'IBO-005', 'Prefiere Nutrilite', 0),
  ('a1000000-0000-4000-8000-000000000006', 'Roberto Pérez', 'robertop@outlook.com', '809-555-0106', 'IBO-006', 'Distribuidor nivel oro', 0),
  ('a1000000-0000-4000-8000-000000000007', 'Diana Castillo', 'dcastillo@gmail.com', '829-555-0107', 'IBO-007', 'Compra para reventa', 0),
  ('a1000000-0000-4000-8000-000000000008', 'José Ramírez', 'jramirez@empresa.com', '809-555-0108', 'IBO-008', 'Empresa', 0),
  ('a1000000-0000-4000-8000-000000000009', 'Carmen López', 'carmen.lopez@gmail.com', '849-555-0109', 'IBO-009', NULL, 0),
  ('a1000000-0000-4000-8000-00000000000a', 'Fernando Torres', 'ftorres@hotmail.com', '809-555-0110', 'IBO-010', 'Nuevo cliente', 0);

-- ============================================================
-- PRODUCTOS (50)
-- ============================================================
-- Nutrilite
INSERT INTO products (id, code, name, description, category_id, subbrand_id, cost, pv, price_30, price_35, active) VALUES
  ('a2000000-0000-4000-8000-000000000001', 'NUT-001', 'Nutrilite Double X', 'Multivitamínico integral con fitonutrientes', 'a4a0cb06-0684-4a88-980d-37dcfaf569a7', '2a0818d6-0d36-4d3b-8c47-55dfdc96af32', 2500, 75, 4200, 4550, true),
  ('a2000000-0000-4000-8000-000000000002', 'NUT-002', 'Nutrilite Proteína de Soja Vainilla', 'Proteína vegetal sabor vainilla 450g', '289d0ae7-e539-4155-b1bd-bdc726dadd5e', '2a0818d6-0d36-4d3b-8c47-55dfdc96af32', 1800, 55, 3200, 3460, true),
  ('a2000000-0000-4000-8000-000000000003', 'NUT-003', 'Nutrilite Vitamina C Plus', 'Vitamina C de liberación prolongada 60 tabs', 'a4a0cb06-0684-4a88-980d-37dcfaf569a7', '2a0818d6-0d36-4d3b-8c47-55dfdc96af32', 900, 28, 1650, 1780, true),
  ('a2000000-0000-4000-8000-000000000004', 'NUT-004', 'Nutrilite Calcio Magnesio D', 'Suplemento de calcio, magnesio y vitamina D', 'a4a0cb06-0684-4a88-980d-37dcfaf569a7', '2a0818d6-0d36-4d3b-8c47-55dfdc96af32', 1200, 35, 2100, 2270, true),
  ('a2000000-0000-4000-8000-000000000005', 'NUT-005', 'Nutrilite B Complex', 'Complejo de vitaminas B 100 tabs', 'a4a0cb06-0684-4a88-980d-37dcfaf569a7', '2a0818d6-0d36-4d3b-8c47-55dfdc96af32', 1100, 32, 1950, 2110, true),
  ('a2000000-0000-4000-8000-000000000006', 'NUT-006', 'Nutrilite Omega 3', 'Ácidos grasos Omega 3 60 caps', 'a4a0cb06-0684-4a88-980d-37dcfaf569a7', '2a0818d6-0d36-4d3b-8c47-55dfdc96af32', 1500, 48, 2800, 3030, true),
  ('a2000000-0000-4000-8000-000000000007', 'NUT-007', 'Nutrilite Bio C Plus', 'Vitamina C con bioflavonoides 90 tabs', 'a4a0cb06-0684-4a88-980d-37dcfaf569a7', '2a0818d6-0d36-4d3b-8c47-55dfdc96af32', 1400, 42, 2500, 2700, true),
  ('a2000000-0000-4000-8000-000000000008', 'NUT-008', 'Nutrilite Proteína de Soja Chocolate', 'Proteína vegetal sabor chocolate 450g', '289d0ae7-e539-4155-b1bd-bdc726dadd5e', '2a0818d6-0d36-4d3b-8c47-55dfdc96af32', 1800, 55, 3200, 3460, true);

-- XS
INSERT INTO products (id, code, name, description, category_id, subbrand_id, cost, pv, price_30, price_35, active) VALUES
  ('a2000000-0000-4000-8000-000000000009', 'XS-001', 'XS Energy Drink Berry', 'Bebida energética sabor berry 250ml', '60a7d141-86bb-400d-bb6f-446c26d48db7', '50532ae5-a3ca-4249-9ea6-a73f0294157d', 80, 3, 150, 162, true),
  ('a2000000-0000-4000-8000-000000000010', 'XS-002', 'XS Energy Drink Citrus', 'Bebida energética sabor citrus 250ml', '60a7d141-86bb-400d-bb6f-446c26d48db7', '50532ae5-a3ca-4249-9ea6-a73f0294157d', 80, 3, 150, 162, true),
  ('a2000000-0000-4000-8000-000000000011', 'XS-003', 'XS Energy Drink Cola', 'Bebida energética sabor cola 250ml', '60a7d141-86bb-400d-bb6f-446c26d48db7', '50532ae5-a3ca-4249-9ea6-a73f0294157d', 80, 3, 150, 162, true),
  ('a2000000-0000-4000-8000-000000000012', 'XS-004', 'XS Sports Protein Bar Chocolate', 'Barra proteica sabor chocolate 55g', '289d0ae7-e539-4155-b1bd-bdc726dadd5e', '50532ae5-a3ca-4249-9ea6-a73f0294157d', 120, 4, 220, 238, true),
  ('a2000000-0000-4000-8000-000000000013', 'XS-005', 'XS Sports Protein Bar Peanut', 'Barra proteica sabor maní 55g', '289d0ae7-e539-4155-b1bd-bdc726dadd5e', '50532ae5-a3ca-4249-9ea6-a73f0294157d', 120, 4, 220, 238, true);

-- Artistry
INSERT INTO products (id, code, name, description, category_id, subbrand_id, cost, pv, price_30, price_35, active) VALUES
  ('a2000000-0000-4000-8000-000000000014', 'ART-001', 'Artistry Renewing Peel', 'Exfoliante renovador nocturno', 'acf20ec9-8d09-4b90-a15f-4e446c7b3b74', 'a37a6635-46dd-4e08-b4d0-dafdd43bad88', 2200, 55, 3800, 4100, true),
  ('a2000000-0000-4000-8000-000000000015', 'ART-002', 'Artistry Hydra-Gel', 'Gel hidratante facial 50ml', 'acf20ec9-8d09-4b90-a15f-4e446c7b3b74', 'a37a6635-46dd-4e08-b4d0-dafdd43bad88', 1800, 48, 3200, 3460, true),
  ('a2000000-0000-4000-8000-000000000016', 'ART-003', 'Artistry Intensive Skincare Set', 'Set completo cuidado facial intensivo', 'acf20ec9-8d09-4b90-a15f-4e446c7b3b74', 'a37a6635-46dd-4e08-b4d0-dafdd43bad88', 4500, 120, 7500, 8100, true),
  ('a2000000-0000-4000-8000-000000000017', 'ART-004', 'Artistry Foundation SPF15', 'Base de maquillaje SPF15 30ml', '94766396-17d7-4f92-8bbb-511fd5139250', 'a37a6635-46dd-4e08-b4d0-dafdd43bad88', 1600, 42, 2900, 3130, true);

-- eSpring
INSERT INTO products (id, code, name, description, category_id, subbrand_id, cost, pv, price_30, price_35, active) VALUES
  ('a2000000-0000-4000-8000-000000000018', 'ESP-001', 'eSpring Purificador de Agua', 'Purificador de agua con luz UV', '05af5681-d0e1-4037-b8ec-31eac89b8165', '32180530-d344-40f0-9456-dc0e48b680a9', 28000, 600, 45000, 48600, true),
  ('a2000000-0000-4000-8000-000000000019', 'ESP-002', 'eSpring Cartucho de Repuesto', 'Cartucho de filtro y lámpara UV', '05af5681-d0e1-4037-b8ec-31eac89b8165', '32180530-d344-40f0-9456-dc0e48b680a9', 6000, 150, 10500, 11340, true);

-- Amway Home
INSERT INTO products (id, code, name, description, category_id, subbrand_id, cost, pv, price_30, price_35, active) VALUES
  ('a2000000-0000-4000-8000-000000000020', 'HOG-001', 'L.O.C. Multiusos', 'Limpieza multiusos concentrado 1L', 'fdd1b7b3-55c1-4e12-9a73-ace06fd56b18', '1f27b045-eb06-4300-8cd5-f1c34fc3ced2', 250, 8, 450, 486, true),
  ('a2000000-0000-4000-8000-000000000021', 'HOG-002', 'L.O.C. Jabón de Manos', 'Jabón líquido de manos 500ml', 'fdd1b7b3-55c1-4e12-9a73-ace06fd56b18', '1f27b045-eb06-4300-8cd5-f1c34fc3ced2', 180, 5, 320, 346, true),
  ('a2000000-0000-4000-8000-000000000022', 'HOG-003', 'L.O.C. Limpiador de Vidrios', 'Limpiador de vidrios y superficies 750ml', 'fdd1b7b3-55c1-4e12-9a73-ace06fd56b18', '1f27b045-eb06-4300-8cd5-f1c34fc3ced2', 200, 6, 360, 389, true),
  ('a2000000-0000-4000-8000-000000000023', 'HOG-004', 'L.O.C. Detergente para Ropa', 'Detergente líquido concentrado 1L', 'fdd1b7b3-55c1-4e12-9a73-ace06fd56b18', '1f27b045-eb06-4300-8cd5-f1c34fc3ced2', 350, 10, 620, 670, true),
  ('a2000000-0000-4000-8000-000000000045', 'HOG-005', 'L.O.C. Limpiador de Baño', 'Limpiador concentrado para baño 750ml', 'fdd1b7b3-55c1-4e12-9a73-ace06fd56b18', '1f27b045-eb06-4300-8cd5-f1c34fc3ced2', 220, 7, 400, 432, true),
  ('a2000000-0000-4000-8000-000000000046', 'HOG-006', 'L.O.C. Limpiador de Cocina', 'Limpiador desengrasante para cocina 750ml', 'fdd1b7b3-55c1-4e12-9a73-ace06fd56b18', '1f27b045-eb06-4300-8cd5-f1c34fc3ced2', 220, 7, 400, 432, true);

-- Body Series / G&H
INSERT INTO products (id, code, name, description, category_id, subbrand_id, cost, pv, price_30, price_35, active) VALUES
  ('a2000000-0000-4000-8000-000000000024', 'BS-001', 'Body Series Shampoo', 'Champú fortificante 300ml', '8757a6b7-c7fe-4edd-8b12-cc142877b349', '120b7fb2-a1b8-48f2-a756-0bb06b9de13e', 350, 10, 620, 670, true),
  ('a2000000-0000-4000-8000-000000000025', 'BS-002', 'Body Series Acondicionador', 'Acondicionador revitalizante 300ml', '8757a6b7-c7fe-4edd-8b12-cc142877b349', '120b7fb2-a1b8-48f2-a756-0bb06b9de13e', 350, 10, 620, 670, true),
  ('a2000000-0000-4000-8000-000000000026', 'BS-003', 'Body Series Gel de Baño', 'Gel de baño hidratante 400ml', '8757a6b7-c7fe-4edd-8b12-cc142877b349', '120b7fb2-a1b8-48f2-a756-0bb06b9de13e', 280, 8, 500, 540, true),
  ('a2000000-0000-4000-8000-000000000027', 'BS-004', 'Body Series Desodorante', 'Desodorante roll-on 50ml', '8757a6b7-c7fe-4edd-8b12-cc142877b349', '120b7fb2-a1b8-48f2-a756-0bb06b9de13e', 200, 6, 360, 389, true),
  ('a2000000-0000-4000-8000-000000000048', 'BS-005', 'Body Series Protector Solar SPF50', 'Protector solar facial SPF50 50ml', '8757a6b7-c7fe-4edd-8b12-cc142877b349', '7cede652-7e54-4a14-9960-c26aacf54056', 650, 18, 1150, 1240, true),
  ('a2000000-0000-4000-8000-000000000049', 'BS-006', 'Body Series Crema de Manos', 'Crema hidratante para manos 75ml', '8757a6b7-c7fe-4edd-8b12-cc142877b349', '7cede652-7e54-4a14-9960-c26aacf54056', 280, 8, 500, 540, true);

-- Glister
INSERT INTO products (id, code, name, description, category_id, subbrand_id, cost, pv, price_30, price_35, active) VALUES
  ('a2000000-0000-4000-8000-000000000028', 'GLI-001', 'Glister Pasta Dental', 'Pasta dental acción multi-beneficio 125g', '8757a6b7-c7fe-4edd-8b12-cc142877b349', 'd50f7b09-d05a-4873-8515-256bea3671b4', 180, 5, 320, 346, true),
  ('a2000000-0000-4000-8000-000000000029', 'GLI-002', 'Glister Enjuague Bucal', 'Enjuague bucal antiséptico 500ml', '8757a6b7-c7fe-4edd-8b12-cc142877b349', 'd50f7b09-d05a-4873-8515-256bea3671b4', 220, 6, 390, 421, true),
  ('a2000000-0000-4000-8000-000000000030', 'GLI-003', 'Glister Cepillo Dental', 'Cepillo dental cerdas suaves', '8757a6b7-c7fe-4edd-8b12-cc142877b349', 'd50f7b09-d05a-4873-8515-256bea3671b4', 120, 3, 220, 238, true),
  ('a2000000-0000-4000-8000-000000000050', 'GLI-004', 'Glister Tiras Blanqueadoras', 'Tiras blanqueadoras dentales 14 unidades', '8757a6b7-c7fe-4edd-8b12-cc142877b349', 'd50f7b09-d05a-4873-8515-256bea3671b4', 900, 25, 1600, 1730, true);

-- Satinique
INSERT INTO products (id, code, name, description, category_id, subbrand_id, cost, pv, price_30, price_35, active) VALUES
  ('a2000000-0000-4000-8000-000000000031', 'SAT-001', 'Satinique Shampoo', 'Champú suave para uso diario 300ml', '8757a6b7-c7fe-4edd-8b12-cc142877b349', 'e1eb8e58-8b6f-40b9-ac7c-a06c1e76ca1a', 380, 11, 680, 735, true),
  ('a2000000-0000-4000-8000-000000000032', 'SAT-002', 'Satinique Acondicionador', 'Acondicionador suave 300ml', '8757a6b7-c7fe-4edd-8b12-cc142877b349', 'e1eb8e58-8b6f-40b9-ac7c-a06c1e76ca1a', 380, 11, 680, 735, true);

-- HYMM
INSERT INTO products (id, code, name, description, category_id, subbrand_id, cost, pv, price_30, price_35, active) VALUES
  ('a2000000-0000-4000-8000-000000000033', 'HYM-001', 'HYMM Fragancia Floral', 'Perfume femenino floral 50ml', '6e3fb1cc-c323-4991-bbc5-da53491bd422', 'eddd7db8-80d9-418e-b6c0-03c263850294', 3200, 80, 5500, 5940, true),
  ('a2000000-0000-4000-8000-000000000034', 'HYM-002', 'HYMM Fragancia Amaderada', 'Perfume masculino amaderado 50ml', '6e3fb1cc-c323-4991-bbc5-da53491bd422', 'eddd7db8-80d9-418e-b6c0-03c263850294', 3200, 80, 5500, 5940, true),
  ('a2000000-0000-4000-8000-000000000035', 'HYM-003', 'HYMM Colonia Fresca', 'Colonia fresca unisex 100ml', '6e3fb1cc-c323-4991-bbc5-da53491bd422', 'eddd7db8-80d9-418e-b6c0-03c263850294', 1500, 40, 2600, 2810, true);

-- Más Nutrilite
INSERT INTO products (id, code, name, description, category_id, subbrand_id, cost, pv, price_30, price_35, active) VALUES
  ('a2000000-0000-4000-8000-000000000036', 'NUT-009', 'Nutrilite Zinc Plus', 'Zinc con vitamina C 60 tabs', 'a4a0cb06-0684-4a88-980d-37dcfaf569a7', '2a0818d6-0d36-4d3b-8c47-55dfdc96af32', 600, 18, 1100, 1190, true),
  ('a2000000-0000-4000-8000-000000000037', 'NUT-010', 'Nutrilite Hierro', 'Suplemento de hierro con vitamina C', 'a4a0cb06-0684-4a88-980d-37dcfaf569a7', '2a0818d6-0d36-4d3b-8c47-55dfdc96af32', 750, 22, 1350, 1460, true),
  ('a2000000-0000-4000-8000-000000000038', 'NUT-011', 'Nutrilite Proteína de Soja Natural', 'Proteína vegetal sabor natural 450g', '289d0ae7-e539-4155-b1bd-bdc726dadd5e', '2a0818d6-0d36-4d3b-8c47-55dfdc96af32', 1700, 52, 3000, 3240, true),
  ('a2000000-0000-4000-8000-000000000039', 'NUT-012', 'Nutrilite Vitamina E', 'Vitamina E natural 60 caps', 'a4a0cb06-0684-4a88-980d-37dcfaf569a7', '2a0818d6-0d36-4d3b-8c47-55dfdc96af32', 950, 28, 1700, 1840, true),
  ('a2000000-0000-4000-8000-000000000040', 'NUT-013', 'Nutrilite GLA', 'Ácido gamma-linolénico 60 caps', 'a4a0cb06-0684-4a88-980d-37dcfaf569a7', '2a0818d6-0d36-4d3b-8c47-55dfdc96af32', 1300, 38, 2300, 2490, true);

-- Más Artistry
INSERT INTO products (id, code, name, description, category_id, subbrand_id, cost, pv, price_30, price_35, active) VALUES
  ('a2000000-0000-4000-8000-000000000041', 'ART-005', 'Artistry Lipstick Ruby', 'Labial color rubí 4g', '94766396-17d7-4f92-8bbb-511fd5139250', 'a37a6635-46dd-4e08-b4d0-dafdd43bad88', 800, 22, 1450, 1570, true),
  ('a2000000-0000-4000-8000-000000000042', 'ART-006', 'Artistry Lipstick Nude', 'Labial color nude 4g', '94766396-17d7-4f92-8bbb-511fd5139250', 'a37a6635-46dd-4e08-b4d0-dafdd43bad88', 800, 22, 1450, 1570, true),
  ('a2000000-0000-4000-8000-000000000043', 'ART-007', 'Artistry Mascara Volumen', 'Máscara de pestañas volumen extremo', '94766396-17d7-4f92-8bbb-511fd5139250', 'a37a6635-46dd-4e08-b4d0-dafdd43bad88', 1100, 30, 2000, 2160, true);

-- eSpring repuesto, más XS
INSERT INTO products (id, code, name, description, category_id, subbrand_id, cost, pv, price_30, price_35, active) VALUES
  ('a2000000-0000-4000-8000-000000000044', 'ESP-003', 'eSpring Lámpara UV Repuesto', 'Lámpara UV de repuesto', '05af5681-d0e1-4037-b8ec-31eac89b8165', '32180530-d344-40f0-9456-dc0e48b680a9', 2000, 55, 3600, 3890, true),
  ('a2000000-0000-4000-8000-000000000047', 'XS-006', 'XS Energy Drink Tropical', 'Bebida energética sabor tropical 250ml', '60a7d141-86bb-400d-bb6f-446c26d48db7', '50532ae5-a3ca-4249-9ea6-a73f0294157d', 80, 3, 150, 162, true);

-- ============================================================
-- INVENTARIO INICIAL
-- ============================================================
INSERT INTO inventory (product_id, stock, minimum_stock, average_cost)
SELECT id,
  CASE
    WHEN code LIKE 'NUT%' THEN floor(random() * 30 + 10)::int
    WHEN code LIKE 'XS%' THEN floor(random() * 100 + 50)::int
    WHEN code LIKE 'ART%' THEN floor(random() * 15 + 5)::int
    WHEN code LIKE 'ESP%' THEN floor(random() * 8 + 2)::int
    WHEN code LIKE 'HOG%' THEN floor(random() * 25 + 10)::int
    WHEN code LIKE 'BS%' THEN floor(random() * 20 + 10)::int
    WHEN code LIKE 'GLI%' THEN floor(random() * 30 + 15)::int
    WHEN code LIKE 'SAT%' THEN floor(random() * 15 + 5)::int
    WHEN code LIKE 'HYM%' THEN floor(random() * 10 + 3)::int
    ELSE floor(random() * 20 + 5)::int
  END,
  5,
  cost
FROM products;

-- ============================================================
-- PROVEEDORES (2)
-- ============================================================
INSERT INTO suppliers (id, name, phone, email, notes) VALUES
  ('a6000000-0000-4000-8000-000000000001', 'Distribuidora Amway RD', '809-555-8000', 'pedidos@amwayrd.com', 'Proveedor principal de productos Amway'),
  ('a6000000-0000-4000-8000-000000000002', 'Importadora Salud y Bienestar', '829-555-8001', 'ventas@saludybienestar.com', 'Importador de suplementos');

-- ============================================================
-- FACTURAS (5)
-- ============================================================

-- FAC-0001: María Fernández (pagada)
INSERT INTO invoices (id, invoice_number, client_id, invoice_date, status, subtotal, discount_amount, total, amount_paid, balance_due, pv_total, created_by)
VALUES ('a3000000-0000-4000-8000-000000000001', 'FAC-0001', 'a1000000-0000-4000-8000-000000000001', '2026-06-01', 'PAID', 9320, 0, 9320, 9320, 0, 158, 'b96cc6cb-12a6-4315-9360-84b9a270e0e6');

INSERT INTO invoice_items (invoice_id, product_id, quantity, unit_price, unit_cost, pv, line_total)
VALUES
  ('a3000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000002', 1, 3200, 1800, 55, 3200),
  ('a3000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000003', 2, 1650, 900, 56, 3300),
  ('a3000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000004', 1, 2100, 1200, 35, 2100),
  ('a3000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000036', 1, 1100, 600, 18, 1100);

INSERT INTO receipts (id, receipt_number, client_id, invoice_id, payment_method, amount, concept, created_by)
VALUES ('a4000000-0000-4000-8000-000000000001', 'REC-0001', 'a1000000-0000-4000-8000-000000000001', 'a3000000-0000-4000-8000-000000000001', 'TRANSFER', 9320, 'Pago completo FAC-0001', 'b96cc6cb-12a6-4315-9360-84b9a270e0e6');

-- FAC-0002: Roberto Pérez (pendiente)
INSERT INTO invoices (id, invoice_number, client_id, invoice_date, status, subtotal, discount_amount, total, amount_paid, balance_due, pv_total, created_by)
VALUES ('a3000000-0000-4000-8000-000000000002', 'FAC-0002', 'a1000000-0000-4000-8000-000000000006', '2026-06-05', 'PENDING', 17400, 1740, 15660, 0, 15660, 265, 'b96cc6cb-12a6-4315-9360-84b9a270e0e6');

INSERT INTO invoice_items (invoice_id, product_id, quantity, unit_price, unit_cost, pv, line_total)
VALUES
  ('a3000000-0000-4000-8000-000000000002', 'a2000000-0000-4000-8000-000000000014', 1, 3800, 2200, 55, 3800),
  ('a3000000-0000-4000-8000-000000000002', 'a2000000-0000-4000-8000-000000000015', 1, 3200, 1800, 48, 3200),
  ('a3000000-0000-4000-8000-000000000002', 'a2000000-0000-4000-8000-000000000016', 1, 7500, 4500, 120, 7500),
  ('a3000000-0000-4000-8000-000000000002', 'a2000000-0000-4000-8000-000000000017', 1, 2900, 1600, 42, 2900);

-- FAC-0003: Carlos Jiménez (pendiente)
INSERT INTO invoices (id, invoice_number, client_id, invoice_date, status, subtotal, discount_amount, total, amount_paid, balance_due, pv_total, created_by)
VALUES ('a3000000-0000-4000-8000-000000000003', 'FAC-0003', 'a1000000-0000-4000-8000-000000000002', '2026-06-10', 'PENDING', 7800, 390, 7410, 0, 7410, 111, 'b96cc6cb-12a6-4315-9360-84b9a270e0e6');

INSERT INTO invoice_items (invoice_id, product_id, quantity, unit_price, unit_cost, pv, line_total)
VALUES
  ('a3000000-0000-4000-8000-000000000003', 'a2000000-0000-4000-8000-000000000009', 12, 150, 80, 36, 1800),
  ('a3000000-0000-4000-8000-000000000003', 'a2000000-0000-4000-8000-000000000010', 12, 150, 80, 36, 1800),
  ('a3000000-0000-4000-8000-000000000003', 'a2000000-0000-4000-8000-000000000001', 1, 4200, 2500, 75, 4200);

-- FAC-0004: Laura Sánchez (parcial)
INSERT INTO invoices (id, invoice_number, client_id, invoice_date, status, subtotal, discount_amount, total, amount_paid, balance_due, pv_total, created_by)
VALUES ('a3000000-0000-4000-8000-000000000004', 'FAC-0004', 'a1000000-0000-4000-8000-000000000005', '2026-06-12', 'PARTIAL', 6300, 0, 6300, 3000, 3300, 110, 'b96cc6cb-12a6-4315-9360-84b9a270e0e6');

INSERT INTO invoice_items (invoice_id, product_id, quantity, unit_price, unit_cost, pv, line_total)
VALUES
  ('a3000000-0000-4000-8000-000000000004', 'a2000000-0000-4000-8000-000000000001', 1, 4200, 2500, 75, 4200),
  ('a3000000-0000-4000-8000-000000000004', 'a2000000-0000-4000-8000-000000000004', 1, 2100, 1200, 35, 2100);

INSERT INTO receipts (id, receipt_number, client_id, invoice_id, payment_method, amount, concept, created_by)
VALUES ('a4000000-0000-4000-8000-000000000002', 'REC-0002', 'a1000000-0000-4000-8000-000000000005', 'a3000000-0000-4000-8000-000000000004', 'CASH', 3000, 'Abono parcial FAC-0004', 'b96cc6cb-12a6-4315-9360-84b9a270e0e6');

-- FAC-0005: José Ramírez (pagada)
INSERT INTO invoices (id, invoice_number, client_id, invoice_date, status, subtotal, discount_amount, total, amount_paid, balance_due, pv_total, created_by)
VALUES ('a3000000-0000-4000-8000-000000000005', 'FAC-0005', 'a1000000-0000-4000-8000-000000000008', '2026-06-15', 'PAID', 58710, 0, 58710, 58710, 0, 828, 'b96cc6cb-12a6-4315-9360-84b9a270e0e6');

INSERT INTO invoice_items (invoice_id, product_id, quantity, unit_price, unit_cost, pv, line_total)
VALUES
  ('a3000000-0000-4000-8000-000000000005', 'a2000000-0000-4000-8000-000000000018', 1, 45000, 28000, 600, 45000),
  ('a3000000-0000-4000-8000-000000000005', 'a2000000-0000-4000-8000-000000000019', 1, 10500, 6000, 150, 10500),
  ('a3000000-0000-4000-8000-000000000005', 'a2000000-0000-4000-8000-000000000020', 5, 450, 250, 40, 2250),
  ('a3000000-0000-4000-8000-000000000005', 'a2000000-0000-4000-8000-000000000021', 3, 320, 180, 15, 960);

INSERT INTO receipts (id, receipt_number, client_id, invoice_id, payment_method, amount, concept, created_by)
VALUES ('a4000000-0000-4000-8000-000000000003', 'REC-0003', 'a1000000-0000-4000-8000-000000000008', 'a3000000-0000-4000-8000-000000000005', 'TRANSFER', 58710, 'Pago completo FAC-0005', 'b96cc6cb-12a6-4315-9360-84b9a270e0e6');

-- ============================================================
-- COMPRAS (2)
-- ============================================================
INSERT INTO purchases (id, purchase_number, supplier_id, purchase_date, subtotal, total, status, created_by)
VALUES ('a8000000-0000-4000-8000-000000000001', 'COM-0001', 'a6000000-0000-4000-8000-000000000001', '2026-06-01', 40500, 40500, 'COMPLETED', 'b96cc6cb-12a6-4315-9360-84b9a270e0e6');

INSERT INTO purchase_items (purchase_id, product_id, quantity, unit_cost, line_total)
VALUES
  ('a8000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000018', 1, 28000, 28000),
  ('a8000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000019', 2, 6000, 12000),
  ('a8000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000001', 2, 2500, 5000);

-- ============================================================
-- GASTOS (4)
-- ============================================================
INSERT INTO expenses (id, expense_date, category, concept, amount, comments, created_by) VALUES
  ('a5000000-0000-4000-8000-000000000001', '2026-06-01', 'alquiler', 'Alquiler local junio', 25000, NULL, 'b96cc6cb-12a6-4315-9360-84b9a270e0e6'),
  ('a5000000-0000-4000-8000-000000000002', '2026-06-05', 'servicios', 'Luz', 4500, NULL, 'b96cc6cb-12a6-4315-9360-84b9a270e0e6'),
  ('a5000000-0000-4000-8000-000000000003', '2026-06-05', 'servicios', 'Internet', 2800, NULL, 'b96cc6cb-12a6-4315-9360-84b9a270e0e6'),
  ('a5000000-0000-4000-8000-000000000004', '2026-06-10', 'oficina', 'Material de oficina', 3200, NULL, 'b96cc6cb-12a6-4315-9360-84b9a270e0e6');

-- ============================================================
-- SEGUIMIENTO / CRM
-- ============================================================
INSERT INTO followups (id, client_id, contact_date, next_followup, comments, status) VALUES
  ('a7000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000002', '2026-06-10', '2026-06-25', 'Recordatorio de pago factura FAC-0003', 'PENDING'),
  ('a7000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000005', '2026-06-10', '2026-06-15', 'Llamar para ofrecer nuevos productos Nutrilite', 'COMPLETED'),
  ('a7000000-0000-4000-8000-000000000003', 'a1000000-0000-4000-8000-000000000006', '2026-06-12', '2026-06-22', 'Visita para presentar línea Artistry', 'PENDING');
