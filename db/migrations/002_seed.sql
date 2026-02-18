-- ============================================================
-- TovalTech 2.0 — Migration 002: Seed inicial
-- Ejecutar SIEMPRE después de 001_initial.sql
-- ============================================================

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET NOCOUNT ON;
GO

-- ============================================================
-- 1. CATEGORÍAS
-- ============================================================
INSERT INTO categories (name, slug, sort_order, description) VALUES
    ('Procesadores',    'procesadores',     1, 'CPUs Intel y AMD para desktop, workstation y servidor'),
    ('Memorias RAM',    'memorias-ram',     2, 'Módulos DDR4 y DDR5 de escritorio y servidor'),
    ('Almacenamiento',  'almacenamiento',   3, 'SSD NVMe, SSD SATA, HDD y unidades enterprise'),
    ('Monitores',       'monitores',        4, 'Monitores para gaming, diseño profesional y trabajo'),
    ('Servidores',      'servidores',       5, 'Servidores rack, torre y blade — nuevos y reacondicionados'),
    ('Networking',      'networking',       6, 'Switches, routers, firewalls y access points'),
    ('Periféricos',     'perifericos',      7, 'Teclados, ratones, headsets, webcams y accesorios'),
    ('Componentes',     'componentes',      8, 'GPUs, motherboards, fuentes de alimentación y cooling');
GO

-- ============================================================
-- 2. PROVEEDORES
-- ============================================================
INSERT INTO providers (name, contact_email, notes) VALUES
    ('Mayorista General A',  'ventas@mayoristaa.com.ar',  'CSV de precios actualizado lunes y jueves'),
    ('Mayorista Tech B',     'precios@techb.com.ar',       'Excel mensual + stock en tiempo real por API'),
    ('Distribuidor IT C',    'b2b@distribuidorc.com',      'Link CSV público actualizado diariamente');
GO

-- ============================================================
-- 3. PRODUCTOS DE EJEMPLO
-- ============================================================

-- Procesadores
INSERT INTO products (sku, title, brand, category_id, description, specs_json, tags, is_active) VALUES
(
    'INT-I9-14900K',
    'Intel Core i9-14900K 24-Core Processor',
    'Intel',
    (SELECT id FROM categories WHERE slug = 'procesadores'),
    'El Intel Core i9-14900K es el procesador de escritorio más potente de la 14ª generación Raptor Lake Refresh. Ideal para workstations de alto rendimiento, renderizado 3D y virtualización.',
    N'{"nucleos":"24 (8P + 16E)","hilos":"32","base_ghz":"3.2","boost_ghz":"6.0","socket":"LGA1700","tdp_w":"125","cache_l3_mb":"36","memoria":"DDR4/DDR5","pcie":"5.0","graficos":"Intel UHD 770","proceso":"Intel 7"}',
    'intel i9 14900k lga1700 raptor lake procesador cpu',
    1
),
(
    'AMD-R9-7900X',
    'AMD Ryzen 9 7900X 12-Core Processor',
    'AMD',
    (SELECT id FROM categories WHERE slug = 'procesadores'),
    'El AMD Ryzen 9 7900X ofrece 12 núcleos Zen 4 en el socket AM5 con soporte DDR5 nativo y PCIe 5.0.',
    N'{"nucleos":"12","hilos":"24","base_ghz":"4.7","boost_ghz":"5.6","socket":"AM5","tdp_w":"170","cache_l3_mb":"64","memoria":"DDR5","pcie":"5.0","proceso":"5nm TSMC"}',
    'amd ryzen 9 7900x am5 zen4 procesador cpu',
    1
),
(
    'INT-I7-14700K',
    'Intel Core i7-14700K 20-Core Processor',
    'Intel',
    (SELECT id FROM categories WHERE slug = 'procesadores'),
    'Intel Core i7-14700K con 20 núcleos (8P+12E), boost hasta 5.6GHz. Excelente relación precio-rendimiento.',
    N'{"nucleos":"20 (8P + 12E)","hilos":"28","base_ghz":"3.4","boost_ghz":"5.6","socket":"LGA1700","tdp_w":"125","cache_l3_mb":"33","memoria":"DDR4/DDR5","pcie":"5.0","graficos":"Intel UHD 770"}',
    'intel i7 14700k lga1700 procesador cpu',
    1
);

-- Memorias RAM
INSERT INTO products (sku, title, brand, category_id, description, specs_json, tags, is_active) VALUES
(
    'KNG-FB5-32G',
    'Kingston FURY Beast DDR5 32GB Kit (2x16GB) 6000MHz',
    'Kingston',
    (SELECT id FROM categories WHERE slug = 'memorias-ram'),
    'Kit dual channel DDR5 para plataformas Intel y AMD de última generación. XMP 3.0 y EXPO compatible.',
    N'{"capacidad":"32GB","modulos":"2x16GB","tipo":"DDR5","velocidad_mhz":"6000","latencia":"CL36","voltaje":"1.35V","xmp":"3.0","expo":"Si","perfil":"FURY Beast"}',
    'kingston fury beast ddr5 32gb 6000mhz ram memoria',
    1
),
(
    'CRS-VNG-64G',
    'Corsair Vengeance DDR5 64GB Kit (2x32GB) 5200MHz',
    'Corsair',
    (SELECT id FROM categories WHERE slug = 'memorias-ram'),
    'Kit de alto rendimiento para workstations y gaming extremo. CL40, compatible con Intel XMP 3.0.',
    N'{"capacidad":"64GB","modulos":"2x32GB","tipo":"DDR5","velocidad_mhz":"5200","latencia":"CL40","voltaje":"1.25V","xmp":"3.0","perfil":"Vengeance"}',
    'corsair vengeance ddr5 64gb 5200mhz ram memoria kit',
    1
);

-- Almacenamiento
INSERT INTO products (sku, title, brand, category_id, description, specs_json, tags, is_active) VALUES
(
    'SMS-990P-2TB',
    'Samsung 990 Pro 2TB NVMe PCIe 4.0',
    'Samsung',
    (SELECT id FROM categories WHERE slug = 'almacenamiento'),
    'SSD NVMe de alto rendimiento con interfaz PCIe 4.0 x4. Lectura secuencial hasta 7450 MB/s.',
    N'{"capacidad":"2TB","interfaz":"PCIe 4.0 x4","factor_forma":"M.2 2280","lectura_mbs":"7450","escritura_mbs":"6900","tlc":"V-NAND","dram":"Si","garantia":"5 años"}',
    'samsung 990 pro 2tb nvme ssd m2 pcie4',
    1
),
(
    'SGT-EXO-8TB',
    'Seagate Exos X18 8TB Enterprise HDD 7200rpm',
    'Seagate',
    (SELECT id FROM categories WHERE slug = 'almacenamiento'),
    'HDD enterprise SATA 3.5" de 7200 RPM para NAS, servidores y backups. MTBF 2.5M horas.',
    N'{"capacidad":"8TB","interfaz":"SATA 6Gb/s","factor_forma":"3.5\"","rpm":"7200","cache_mb":"256","mtbf_h":"2500000","workload_tb_año":"550","garantia":"5 años"}',
    'seagate exos 8tb enterprise hdd sata servidor nas',
    1
);

-- Servidores
INSERT INTO products (sku, title, brand, category_id, description, specs_json, tags, is_active) VALUES
(
    'DEL-R750-2U',
    'Dell PowerEdge R750 2U Rack Server',
    'Dell',
    (SELECT id FROM categories WHERE slug = 'servidores'),
    'Servidor rack 2U con soporte para dos procesadores Intel Xeon Ice Lake. Hasta 1TB RAM DDR4. Ideal para virtualización, bases de datos y aplicaciones empresariales.',
    N'{"factor":"2U Rack","procesadores":"Hasta 2x Intel Xeon Ice Lake 3rd Gen","ram_max":"1TB DDR4","slots_ram":"32 DIMM","almacenamiento":"12x SFF Hot-Swap","redes":"4x 1GbE + 2x 25GbE","pcie":"4 slots","fuentes":"2x 800W redundantes","raid":"PERC H745"}',
    'dell poweredge r750 servidor rack 2u xeon enterprise',
    1
),
(
    'HPE-DL380-G10',
    'HPE ProLiant DL380 Gen10 2U Rack Server',
    'HPE',
    (SELECT id FROM categories WHERE slug = 'servidores'),
    'Servidor HPE de alto rendimiento con soporte Intel Xeon Scalable. Plataforma de referencia para entornos críticos.',
    N'{"factor":"2U Rack","procesadores":"Hasta 2x Intel Xeon Scalable 2nd/3rd Gen","ram_max":"3TB DDR4","slots_ram":"24 DIMM","almacenamiento":"8x SFF + 2x M.2","redes":"Flexible LOM","fuentes":"2x 800W o 2x 1600W","garantia":"3 años NBD"}',
    'hpe proliant dl380 gen10 servidor rack 2u xeon',
    1
);

-- Networking
INSERT INTO products (sku, title, brand, category_id, description, specs_json, tags, is_active) VALUES
(
    'CIS-C9200L-24P',
    'Cisco Catalyst 9200L 24-Port PoE+ Switch Managed',
    'Cisco',
    (SELECT id FROM categories WHERE slug = 'networking'),
    'Switch administrable Layer 2/3 con 24 puertos PoE+ 1GbE y 4 uplinks SFP. Ideal para redes empresariales.',
    N'{"puertos_datos":"24x 1GbE PoE+","uplinks":"4x SFP","poe_budget_w":"370","capa":"L2/L3","throughput_gbps":"128","stacking":"Si","ios_xe":"Si","garantia":"Limitada de por vida"}',
    'cisco catalyst 9200l switch poe managed 24 puertos',
    1
),
(
    'UBQ-USW-PRO-24',
    'Ubiquiti UniFi Switch Pro 24 PoE',
    'Ubiquiti',
    (SELECT id FROM categories WHERE slug = 'networking'),
    'Switch UniFi administrable con 24 puertos PoE y 2x SFP+. Administración centralizada por UniFi Controller.',
    N'{"puertos_datos":"24x 1GbE PoE","uplinks":"2x SFP+ 10G","poe_budget_w":"400","capa":"L2","throughput_gbps":"52","unifi":"Si","ventilacion":"Pasiva"}',
    'ubiquiti unifi switch pro 24 poe sfp managed',
    1
);
GO

-- ============================================================
-- 4. PRODUCT OFFERS (precios por proveedor)
-- ============================================================

-- Los precios están en USD

-- Procesadores
INSERT INTO product_offers (product_id, provider_id, price_usd, iva_rate, stock_qty, lead_time_days, source)
SELECT p.id, pv.id, precio, 0.21, stock, lead, 'seed'
FROM (VALUES
    ('INT-I9-14900K', 'Mayorista General A',  850.00, 5,  0),
    ('INT-I9-14900K', 'Distribuidor IT C',    870.00, 3,  2),
    ('AMD-R9-7900X',  'Mayorista General A',  590.00, 7,  0),
    ('AMD-R9-7900X',  'Mayorista Tech B',     580.00, 4,  3),
    ('INT-I7-14700K', 'Mayorista General A',  420.00, 12, 0),
    ('INT-I7-14700K', 'Mayorista Tech B',     415.00, 8,  0)
) AS t(sku, prov_name, precio, stock, lead)
JOIN products p  ON p.sku = t.sku
JOIN providers pv ON pv.name = t.prov_name;

-- Memorias
INSERT INTO product_offers (product_id, provider_id, price_usd, iva_rate, stock_qty, lead_time_days, source)
SELECT p.id, pv.id, precio, 0.21, stock, lead, 'seed'
FROM (VALUES
    ('KNG-FB5-32G', 'Mayorista General A', 185.00, 15, 0),
    ('KNG-FB5-32G', 'Mayorista Tech B',    180.00, 12, 0),
    ('CRS-VNG-64G', 'Distribuidor IT C',   310.00, 4,  3)
) AS t(sku, prov_name, precio, stock, lead)
JOIN products p  ON p.sku = t.sku
JOIN providers pv ON pv.name = t.prov_name;

-- Almacenamiento
INSERT INTO product_offers (product_id, provider_id, price_usd, iva_rate, stock_qty, lead_time_days, source)
SELECT p.id, pv.id, precio, 0.21, stock, lead, 'seed'
FROM (VALUES
    ('SMS-990P-2TB', 'Mayorista General A', 250.00, 3, 0),
    ('SMS-990P-2TB', 'Mayorista Tech B',    245.00, 5, 0),
    ('SGT-EXO-8TB',  'Mayorista Tech B',    380.00, 6, 2),
    ('SGT-EXO-8TB',  'Distribuidor IT C',   390.00, 8, 3)
) AS t(sku, prov_name, precio, stock, lead)
JOIN products p  ON p.sku = t.sku
JOIN providers pv ON pv.name = t.prov_name;

-- Servidores
INSERT INTO product_offers (product_id, provider_id, price_usd, iva_rate, stock_qty, lead_time_days, source)
SELECT p.id, pv.id, precio, 0.21, stock, lead, 'seed'
FROM (VALUES
    ('DEL-R750-2U',   'Mayorista Tech B',    4200.00, 2, 7),
    ('DEL-R750-2U',   'Distribuidor IT C',   4350.00, 1, 10),
    ('HPE-DL380-G10', 'Mayorista Tech B',    3800.00, 1, 14)
) AS t(sku, prov_name, precio, stock, lead)
JOIN products p  ON p.sku = t.sku
JOIN providers pv ON pv.name = t.prov_name;

-- Networking
INSERT INTO product_offers (product_id, provider_id, price_usd, iva_rate, stock_qty, lead_time_days, source)
SELECT p.id, pv.id, precio, 0.21, stock, lead, 'seed'
FROM (VALUES
    ('CIS-C9200L-24P', 'Mayorista General A', 1100.00, 6, 0),
    ('CIS-C9200L-24P', 'Distribuidor IT C',   1150.00, 8, 0),
    ('UBQ-USW-PRO-24', 'Mayorista Tech B',     420.00, 10, 0),
    ('UBQ-USW-PRO-24', 'Distribuidor IT C',    410.00, 12, 0)
) AS t(sku, prov_name, precio, stock, lead)
JOIN products p  ON p.sku = t.sku
JOIN providers pv ON pv.name = t.prov_name;
GO

-- ============================================================
-- 5. FX RATE INICIAL (placeholder — el timer lo actualizará)
-- ============================================================
INSERT INTO fx_rates (rate_ars_per_usd, source, is_current)
VALUES (1030.00, 'seed_placeholder', 1);
GO

-- ============================================================
-- 6. IMPORT SOURCES (fuentes de CSV de proveedores)
-- ============================================================
INSERT INTO import_sources (provider_id, name, type, url, column_mapping_json, sync_frequency)
SELECT pv.id, fuente, tipo, url, mapeo, freq
FROM (VALUES
    (
        'Mayorista General A',
        'Lista precios semanal CSV',
        'csv_url',
        'https://mayoristaa.com.ar/precios/lista-precios.csv',
        N'{"sku":"Codigo","title":"Descripcion","price_usd":"Precio USD","stock_qty":"Stock","brand":"Marca"}',
        'weekly'
    ),
    (
        'Mayorista Tech B',
        'Catalogo mensual XLSX',
        'xlsx_url',
        'https://techb.com.ar/catalogo/catalogo.xlsx',
        N'{"sku":"Part Number","title":"Product Name","price_usd":"List Price USD","stock_qty":"Qty","brand":"Brand"}',
        'manual'
    ),
    (
        'Distribuidor IT C',
        'Feed diario CSV publico',
        'csv_url',
        'https://distribuidorc.com/api/feed/precios.csv',
        N'{"sku":"code","title":"name","price_usd":"price","stock_qty":"available","lead_time_days":"leadtime"}',
        'daily'
    )
) AS t(prov_name, fuente, tipo, url, mapeo, freq)
JOIN providers pv ON pv.name = t.prov_name;
GO

-- ============================================================
-- Verificación final
-- ============================================================
SELECT 'categories'     AS tabla, COUNT(*) AS filas FROM categories       UNION ALL
SELECT 'providers',                COUNT(*) FROM providers                 UNION ALL
SELECT 'products',                 COUNT(*) FROM products                  UNION ALL
SELECT 'product_offers',           COUNT(*) FROM product_offers            UNION ALL
SELECT 'fx_rates',                 COUNT(*) FROM fx_rates                  UNION ALL
SELECT 'import_sources',           COUNT(*) FROM import_sources;
GO