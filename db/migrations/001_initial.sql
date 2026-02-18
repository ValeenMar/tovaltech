-- ============================================================
-- TovalTech 2.0 — Migration 001: Schema inicial
-- Motor: Azure SQL (SQL Server 2022 compatible)
-- PK: INT IDENTITY (interno) + public_id UNIQUEIDENTIFIER (API)
-- Convención: snake_case, timestamps en UTC siempre
-- ============================================================

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET NOCOUNT ON;
GO

-- ============================================================
-- 0. TIPOS ENUMERADOS (simulados con CHECK constraints)
-- ============================================================

-- Los ENUMs de SQL Server se hacen con CHECK. Los listamos acá
-- para tener visibilidad. Están embebidos en cada tabla.

-- order_status:
--   RECEIVED | CONFIRMED | PAYMENT_PENDING | PAID_VERIFIED |
--   PROCESSING | INVOICED | SHIPPING_COORDINATION | SHIPPED |
--   DELIVERED | CANCELLED | ON_HOLD | PAYMENT_FAILED |
--   PAYMENT_EXPIRED | REFUNDED | PARTIALLY_SHIPPED | RETURNED

-- invoice_status: DRAFT | ISSUED | VOIDED

-- shipment_status: PENDING | HANDED_TO_CARRIER | IN_TRANSIT |
--                  OUT_FOR_DELIVERY | DELIVERED | FAILED | RETURNED

-- actor_type: system | customer | admin | ops | seller

-- ============================================================
-- 1. CATEGORÍAS
-- ============================================================
CREATE TABLE categories (
    id              INT             IDENTITY(1,1)   PRIMARY KEY,
    public_id       UNIQUEIDENTIFIER                NOT NULL DEFAULT NEWSEQUENTIALID(),
    name            NVARCHAR(100)                   NOT NULL,
    slug            NVARCHAR(100)                   NOT NULL,
    parent_id       INT                             NULL REFERENCES categories(id),
    description     NVARCHAR(500)                   NULL,
    is_active       BIT                             NOT NULL DEFAULT 1,
    sort_order      INT                             NOT NULL DEFAULT 0,
    created_at      DATETIME2                       NOT NULL DEFAULT GETUTCDATE(),
    updated_at      DATETIME2                       NOT NULL DEFAULT GETUTCDATE(),

    CONSTRAINT UQ_categories_slug       UNIQUE (slug),
    CONSTRAINT UQ_categories_public_id  UNIQUE (public_id)
);
GO

-- ============================================================
-- 2. PROVEEDORES
-- ============================================================
CREATE TABLE providers (
    id              INT             IDENTITY(1,1)   PRIMARY KEY,
    public_id       UNIQUEIDENTIFIER                NOT NULL DEFAULT NEWSEQUENTIALID(),
    name            NVARCHAR(200)                   NOT NULL,
    contact_email   NVARCHAR(200)                   NULL,
    contact_phone   NVARCHAR(50)                    NULL,
    notes           NVARCHAR(1000)                  NULL,
    is_active       BIT                             NOT NULL DEFAULT 1,
    created_at      DATETIME2                       NOT NULL DEFAULT GETUTCDATE(),
    updated_at      DATETIME2                       NOT NULL DEFAULT GETUTCDATE(),

    CONSTRAINT UQ_providers_public_id   UNIQUE (public_id)
);
GO

-- ============================================================
-- 3. PRODUCTOS (ficha catálogo — sin precio)
-- ============================================================
CREATE TABLE products (
    id              INT             IDENTITY(1,1)   PRIMARY KEY,
    public_id       UNIQUEIDENTIFIER                NOT NULL DEFAULT NEWSEQUENTIALID(),
    sku             NVARCHAR(100)                   NOT NULL,
    title           NVARCHAR(500)                   NOT NULL,
    brand           NVARCHAR(100)                   NULL,
    category_id     INT                             NULL REFERENCES categories(id),
    description     NVARCHAR(MAX)                   NULL,
    specs_json      NVARCHAR(MAX)                   NULL,   -- { "socket": "AM5", "tdp": "125W" }
    images_json     NVARCHAR(MAX)                   NULL,   -- ["https://...","https://..."]
    tags            NVARCHAR(500)                   NULL,   -- búsqueda full-text auxiliar
    is_active       BIT                             NOT NULL DEFAULT 1,
    created_at      DATETIME2                       NOT NULL DEFAULT GETUTCDATE(),
    updated_at      DATETIME2                       NOT NULL DEFAULT GETUTCDATE(),

    CONSTRAINT UQ_products_sku          UNIQUE (sku),
    CONSTRAINT UQ_products_public_id    UNIQUE (public_id),
    CONSTRAINT CK_products_specs_json   CHECK (specs_json IS NULL OR ISJSON(specs_json) = 1),
    CONSTRAINT CK_products_images_json  CHECK (images_json IS NULL OR ISJSON(images_json) = 1)
);

CREATE INDEX IX_products_category      ON products(category_id) WHERE is_active = 1;
CREATE INDEX IX_products_brand         ON products(brand)       WHERE is_active = 1;
CREATE INDEX IX_products_active        ON products(is_active, created_at DESC);
GO

-- ============================================================
-- 4. PRODUCT_OFFERS (precio + stock por proveedor)
-- ============================================================
CREATE TABLE product_offers (
    id              INT             IDENTITY(1,1)   PRIMARY KEY,
    product_id      INT                             NOT NULL REFERENCES products(id),
    provider_id     INT                             NOT NULL REFERENCES providers(id),
    price_usd       DECIMAL(12, 4)                  NOT NULL,
    iva_rate        DECIMAL(5, 4)                   NOT NULL DEFAULT 0.21, -- 21% IVA Argentina
    stock_qty       INT                             NULL,   -- NULL = sin dato / consultar
    lead_time_days  INT                             NULL,   -- NULL = inmediato / sin dato
    is_active       BIT                             NOT NULL DEFAULT 1,
    source          NVARCHAR(100)                   NULL,   -- 'csv_import','manual','api'
    imported_at     DATETIME2                       NULL,
    created_at      DATETIME2                       NOT NULL DEFAULT GETUTCDATE(),
    updated_at      DATETIME2                       NOT NULL DEFAULT GETUTCDATE(),

    CONSTRAINT UQ_product_offers_product_provider UNIQUE (product_id, provider_id),
    CONSTRAINT CK_product_offers_price_positive   CHECK (price_usd > 0),
    CONSTRAINT CK_product_offers_iva_range        CHECK (iva_rate >= 0 AND iva_rate <= 1)
);

CREATE INDEX IX_product_offers_product    ON product_offers(product_id) WHERE is_active = 1;
CREATE INDEX IX_product_offers_provider   ON product_offers(provider_id);
CREATE INDEX IX_product_offers_updated    ON product_offers(updated_at DESC);
GO

-- ============================================================
-- 5. FX RATES (historial de tipo de cambio)
-- ============================================================
CREATE TABLE fx_rates (
    id              INT             IDENTITY(1,1)   PRIMARY KEY,
    rate_ars_per_usd DECIMAL(14, 4) NOT NULL,
    source          NVARCHAR(100)   NOT NULL DEFAULT 'dolarapi_oficial_venta',
    retrieved_at    DATETIME2       NOT NULL DEFAULT GETUTCDATE(),
    is_current      BIT             NOT NULL DEFAULT 0,     -- solo 1 fila con 1

    CONSTRAINT CK_fx_rates_positive CHECK (rate_ars_per_usd > 0)
);

CREATE INDEX IX_fx_rates_retrieved ON fx_rates(retrieved_at DESC);
CREATE INDEX IX_fx_rates_current   ON fx_rates(is_current) WHERE is_current = 1;
GO

-- ============================================================
-- 6. CLIENTES
-- ============================================================
CREATE TABLE customers (
    id              INT             IDENTITY(1,1)   PRIMARY KEY,
    public_id       UNIQUEIDENTIFIER                NOT NULL DEFAULT NEWSEQUENTIALID(),
    external_id     NVARCHAR(200)                   NOT NULL,   -- ID de Microsoft Entra External ID
    email           NVARCHAR(200)                   NOT NULL,
    name            NVARCHAR(200)                   NULL,
    phone           NVARCHAR(50)                    NULL,
    is_active       BIT                             NOT NULL DEFAULT 1,
    created_at      DATETIME2                       NOT NULL DEFAULT GETUTCDATE(),
    updated_at      DATETIME2                       NOT NULL DEFAULT GETUTCDATE(),

    CONSTRAINT UQ_customers_external_id UNIQUE (external_id),
    CONSTRAINT UQ_customers_email       UNIQUE (email),
    CONSTRAINT UQ_customers_public_id   UNIQUE (public_id)
);
GO

-- ============================================================
-- 7. DIRECCIONES DE CLIENTES
-- ============================================================
CREATE TABLE customer_addresses (
    id              INT             IDENTITY(1,1)   PRIMARY KEY,
    customer_id     INT                             NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    label           NVARCHAR(100)                   NOT NULL DEFAULT 'Principal', -- 'Casa','Oficina', etc.
    -- address_json: { street, number, floor, apartment, city, province, postal_code, country }
    address_json    NVARCHAR(MAX)                   NOT NULL,
    is_default      BIT                             NOT NULL DEFAULT 0,
    created_at      DATETIME2                       NOT NULL DEFAULT GETUTCDATE(),

    CONSTRAINT CK_customer_addresses_json CHECK (ISJSON(address_json) = 1)
);

CREATE INDEX IX_customer_addresses_customer ON customer_addresses(customer_id);
GO

-- ============================================================
-- 8. PEDIDOS
-- ============================================================
CREATE TABLE orders (
    id                      INT             IDENTITY(1,1)   PRIMARY KEY,
    public_id               UNIQUEIDENTIFIER                NOT NULL DEFAULT NEWSEQUENTIALID(),
    -- Número legible: TT-000001 (calculado en app layer, no columna computada para evitar issues)
    order_number            NVARCHAR(20)                    NULL,

    -- Cliente (NULL si guest)
    customer_id             INT                             NULL REFERENCES customers(id),

    -- Datos de contacto guest o snapshot del cliente
    -- { name, email, phone, company, cuit }
    guest_contact_json      NVARCHAR(MAX)                   NULL,

    -- Dirección de entrega (snapshot)
    -- { street, number, city, province, postal_code, country }
    shipping_address_json   NVARCHAR(MAX)                   NULL,

    -- Estado
    status                  NVARCHAR(30)                    NOT NULL DEFAULT 'RECEIVED',

    -- FX Snapshot (congelado al momento del pedido, nunca se recalcula)
    currency_base           CHAR(3)                         NOT NULL DEFAULT 'USD',
    fx_rate_snapshot        DECIMAL(14, 4)                  NOT NULL,
    fx_source               NVARCHAR(100)                   NOT NULL,
    fx_timestamp            DATETIME2                       NOT NULL,

    -- Totales en USD
    subtotal_usd            DECIMAL(14, 4)                  NOT NULL DEFAULT 0,
    tax_usd                 DECIMAL(14, 4)                  NOT NULL DEFAULT 0,
    shipping_cost_usd       DECIMAL(14, 4)                  NOT NULL DEFAULT 0,
    total_usd               DECIMAL(14, 4)                  NOT NULL DEFAULT 0,

    -- Totales en ARS (calculados con fx_rate_snapshot, también congelados)
    subtotal_ars            DECIMAL(18, 2)                  NOT NULL DEFAULT 0,
    tax_ars                 DECIMAL(18, 2)                  NOT NULL DEFAULT 0,
    shipping_cost_ars       DECIMAL(18, 2)                  NOT NULL DEFAULT 0,
    total_ars               DECIMAL(18, 2)                  NOT NULL DEFAULT 0,

    -- Notas del cliente
    customer_notes          NVARCHAR(1000)                  NULL,

    -- Idempotencia
    idempotency_key         NVARCHAR(200)                   NULL,

    -- Canal de origen
    channel                 NVARCHAR(50)                    NOT NULL DEFAULT 'web', -- 'web','whatsapp','admin'

    -- Timestamps
    created_at              DATETIME2                       NOT NULL DEFAULT GETUTCDATE(),
    updated_at              DATETIME2                       NOT NULL DEFAULT GETUTCDATE(),

    CONSTRAINT UQ_orders_public_id          UNIQUE (public_id),
    CONSTRAINT UQ_orders_order_number       UNIQUE (order_number),
    CONSTRAINT UQ_orders_idempotency_key    UNIQUE (idempotency_key),

    CONSTRAINT CK_orders_status CHECK (status IN (
        'RECEIVED', 'CONFIRMED', 'PAYMENT_PENDING', 'PAID_VERIFIED',
        'PROCESSING', 'INVOICED', 'SHIPPING_COORDINATION', 'SHIPPED',
        'DELIVERED', 'CANCELLED', 'ON_HOLD', 'PAYMENT_FAILED',
        'PAYMENT_EXPIRED', 'REFUNDED', 'PARTIALLY_SHIPPED', 'RETURNED'
    )),
    CONSTRAINT CK_orders_fx_positive        CHECK (fx_rate_snapshot > 0),
    CONSTRAINT CK_orders_totals_positive    CHECK (total_usd >= 0 AND total_ars >= 0),
    CONSTRAINT CK_orders_contact           CHECK (
        customer_id IS NOT NULL OR guest_contact_json IS NOT NULL
    ),
    CONSTRAINT CK_orders_guest_json CHECK (
        guest_contact_json IS NULL OR ISJSON(guest_contact_json) = 1
    ),
    CONSTRAINT CK_orders_shipping_json CHECK (
        shipping_address_json IS NULL OR ISJSON(shipping_address_json) = 1
    )
);

CREATE INDEX IX_orders_status          ON orders(status, created_at DESC);
CREATE INDEX IX_orders_customer        ON orders(customer_id) WHERE customer_id IS NOT NULL;
CREATE INDEX IX_orders_created         ON orders(created_at DESC);
CREATE INDEX IX_orders_public_id       ON orders(public_id);
GO

-- ============================================================
-- 9. ORDER ITEMS (siempre snapshot — nunca depende de products)
-- ============================================================
CREATE TABLE order_items (
    id                      INT             IDENTITY(1,1)   PRIMARY KEY,
    order_id                INT                             NOT NULL REFERENCES orders(id) ON DELETE CASCADE,

    -- Referencia débil al producto (puede quedar NULL si se borra/desactiva)
    product_id              INT                             NULL REFERENCES products(id) ON DELETE SET NULL,
    provider_id_snapshot    INT                             NULL,   -- snapshot, sin FK

    -- Snapshot (congelado al momento del pedido)
    sku_snapshot            NVARCHAR(100)                   NOT NULL,
    title_snapshot          NVARCHAR(500)                   NOT NULL,
    brand_snapshot          NVARCHAR(100)                   NULL,

    -- Precio y cantidades
    qty                     INT                             NOT NULL DEFAULT 1,
    unit_price_usd_snapshot DECIMAL(12, 4)                  NOT NULL,
    iva_rate_snapshot       DECIMAL(5, 4)                   NOT NULL DEFAULT 0.21,

    -- Calculado al guardar (no columna computada para poder indexar)
    line_subtotal_usd       DECIMAL(14, 4)                  NOT NULL,   -- qty * unit_price
    line_tax_usd            DECIMAL(14, 4)                  NOT NULL,   -- subtotal * iva_rate
    line_total_usd          DECIMAL(14, 4)                  NOT NULL,   -- subtotal + tax

    -- ARS equivalente con snapshot FX del pedido
    line_total_ars          DECIMAL(18, 2)                  NOT NULL,

    notes                   NVARCHAR(300)                   NULL,
    created_at              DATETIME2                       NOT NULL DEFAULT GETUTCDATE(),

    CONSTRAINT CK_order_items_qty_positive      CHECK (qty > 0),
    CONSTRAINT CK_order_items_price_positive    CHECK (unit_price_usd_snapshot > 0)
);

CREATE INDEX IX_order_items_order ON order_items(order_id);
GO

-- ============================================================
-- 10. HISTORIAL DE ESTADOS DE PEDIDO
-- ============================================================
CREATE TABLE order_status_history (
    id              INT             IDENTITY(1,1)   PRIMARY KEY,
    order_id        INT                             NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    from_status     NVARCHAR(30)                    NULL,   -- NULL en el primer registro
    to_status       NVARCHAR(30)                    NOT NULL,
    actor_type      NVARCHAR(20)                    NOT NULL DEFAULT 'system',
    actor_id        NVARCHAR(200)                   NULL,   -- external_id del usuario o 'system'
    reason          NVARCHAR(500)                   NULL,
    metadata_json   NVARCHAR(MAX)                   NULL,   -- info extra si hace falta
    created_at      DATETIME2                       NOT NULL DEFAULT GETUTCDATE(),

    CONSTRAINT CK_order_status_history_actor_type CHECK (
        actor_type IN ('system', 'customer', 'admin', 'ops', 'seller')
    ),
    CONSTRAINT CK_order_status_history_to_status CHECK (to_status IN (
        'RECEIVED', 'CONFIRMED', 'PAYMENT_PENDING', 'PAID_VERIFIED',
        'PROCESSING', 'INVOICED', 'SHIPPING_COORDINATION', 'SHIPPED',
        'DELIVERED', 'CANCELLED', 'ON_HOLD', 'PAYMENT_FAILED',
        'PAYMENT_EXPIRED', 'REFUNDED', 'PARTIALLY_SHIPPED', 'RETURNED'
    ))
);

CREATE INDEX IX_order_status_history_order    ON order_status_history(order_id, created_at DESC);
GO

-- ============================================================
-- 11. PAGOS
-- ============================================================
CREATE TABLE payments (
    id                      INT             IDENTITY(1,1)   PRIMARY KEY,
    public_id               UNIQUEIDENTIFIER                NOT NULL DEFAULT NEWSEQUENTIALID(),
    order_id                INT                             NOT NULL REFERENCES orders(id),
    provider                NVARCHAR(50)                    NOT NULL DEFAULT 'manual',
    status                  NVARCHAR(30)                    NOT NULL DEFAULT 'PENDING',
    amount_usd              DECIMAL(14, 4)                  NOT NULL,
    amount_ars              DECIMAL(18, 2)                  NOT NULL,
    external_payment_id     NVARCHAR(200)                   NULL,   -- ID del procesador externo
    payload_json            NVARCHAR(MAX)                   NULL,   -- webhook completo
    notes                   NVARCHAR(500)                   NULL,
    created_at              DATETIME2                       NOT NULL DEFAULT GETUTCDATE(),
    updated_at              DATETIME2                       NOT NULL DEFAULT GETUTCDATE(),

    CONSTRAINT UQ_payments_external_id  UNIQUE (external_payment_id),  -- idempotencia
    CONSTRAINT UQ_payments_public_id    UNIQUE (public_id),

    CONSTRAINT CK_payments_status CHECK (status IN (
        'PENDING', 'PROCESSING', 'APPROVED', 'REJECTED', 'CANCELLED',
        'REFUNDED', 'PARTIALLY_REFUNDED', 'IN_MEDIATION', 'CHARGED_BACK'
    )),
    CONSTRAINT CK_payments_payload_json CHECK (
        payload_json IS NULL OR ISJSON(payload_json) = 1
    )
);

CREATE INDEX IX_payments_order     ON payments(order_id);
CREATE INDEX IX_payments_status    ON payments(status);
GO

-- ============================================================
-- 12. FACTURAS
-- ============================================================
CREATE TABLE invoices (
    id                  INT             IDENTITY(1,1)   PRIMARY KEY,
    public_id           UNIQUEIDENTIFIER                NOT NULL DEFAULT NEWSEQUENTIALID(),
    order_id            INT                             NOT NULL REFERENCES orders(id),
    status              NVARCHAR(20)                    NOT NULL DEFAULT 'DRAFT',

    -- Payload editable antes de emitir
    invoice_payload_json NVARCHAR(MAX)                  NULL,

    -- Datos del receptor (snapshot)
    recipient_name      NVARCHAR(200)                   NULL,
    recipient_cuit      NVARCHAR(20)                    NULL,
    recipient_address   NVARCHAR(500)                   NULL,

    -- PDF generado (Blob Storage path)
    pdf_blob_path       NVARCHAR(500)                   NULL,
    pdf_blob_url        NVARCHAR(1000)                  NULL,

    -- Integración fiscal futura
    fiscal_number       NVARCHAR(50)                    NULL,   -- CAE, número de factura
    fiscal_response_json NVARCHAR(MAX)                  NULL,

    issued_at           DATETIME2                       NULL,
    voided_at           DATETIME2                       NULL,
    voided_reason       NVARCHAR(300)                   NULL,

    created_by          NVARCHAR(200)                   NULL,   -- actor_id
    created_at          DATETIME2                       NOT NULL DEFAULT GETUTCDATE(),
    updated_at          DATETIME2                       NOT NULL DEFAULT GETUTCDATE(),

    CONSTRAINT UQ_invoices_public_id    UNIQUE (public_id),
    CONSTRAINT CK_invoices_status       CHECK (status IN ('DRAFT', 'ISSUED', 'VOIDED')),
    CONSTRAINT CK_invoices_payload_json CHECK (
        invoice_payload_json IS NULL OR ISJSON(invoice_payload_json) = 1
    )
);

CREATE INDEX IX_invoices_order  ON invoices(order_id);
CREATE INDEX IX_invoices_status ON invoices(status);
GO

-- ============================================================
-- 13. ENVÍOS
-- ============================================================
CREATE TABLE shipments (
    id                  INT             IDENTITY(1,1)   PRIMARY KEY,
    public_id           UNIQUEIDENTIFIER                NOT NULL DEFAULT NEWSEQUENTIALID(),
    order_id            INT                             NOT NULL REFERENCES orders(id),
    status              NVARCHAR(30)                    NOT NULL DEFAULT 'PENDING',
    carrier             NVARCHAR(100)                   NULL,   -- 'OCA','Andreani','Correo Argentino'
    tracking_code       NVARCHAR(200)                   NULL,
    tracking_url        NVARCHAR(500)                   NULL,
    shipping_cost_usd   DECIMAL(12, 4)                  NULL,
    shipping_cost_ars   DECIMAL(14, 2)                  NULL,
    estimated_delivery  DATE                            NULL,
    shipped_at          DATETIME2                       NULL,
    delivered_at        DATETIME2                       NULL,
    notes               NVARCHAR(500)                   NULL,
    created_by          NVARCHAR(200)                   NULL,
    created_at          DATETIME2                       NOT NULL DEFAULT GETUTCDATE(),
    updated_at          DATETIME2                       NOT NULL DEFAULT GETUTCDATE(),

    CONSTRAINT UQ_shipments_public_id   UNIQUE (public_id),
    CONSTRAINT CK_shipments_status      CHECK (status IN (
        'PENDING', 'HANDED_TO_CARRIER', 'IN_TRANSIT',
        'OUT_FOR_DELIVERY', 'DELIVERED', 'FAILED', 'RETURNED'
    ))
);

CREATE INDEX IX_shipments_order     ON shipments(order_id);
CREATE INDEX IX_shipments_tracking  ON shipments(tracking_code) WHERE tracking_code IS NOT NULL;
GO

-- ============================================================
-- 14. NOTAS INTERNAS (admin)
-- ============================================================
CREATE TABLE admin_notes (
    id              INT             IDENTITY(1,1)   PRIMARY KEY,
    order_id        INT                             NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    note            NVARCHAR(2000)                  NOT NULL,
    actor_id        NVARCHAR(200)                   NOT NULL,   -- email del admin
    created_at      DATETIME2                       NOT NULL DEFAULT GETUTCDATE()
);

CREATE INDEX IX_admin_notes_order ON admin_notes(order_id, created_at DESC);
GO

-- ============================================================
-- 15. AUDIT LOG (cambios de entidades críticas)
-- ============================================================
CREATE TABLE audit_log (
    id              BIGINT          IDENTITY(1,1)   PRIMARY KEY,
    entity          NVARCHAR(50)                    NOT NULL,   -- 'order','invoice','shipment'
    entity_id       INT                             NOT NULL,
    action          NVARCHAR(50)                    NOT NULL,   -- 'CREATE','UPDATE','DELETE','STATE_CHANGE'
    before_json     NVARCHAR(MAX)                   NULL,
    after_json      NVARCHAR(MAX)                   NULL,
    actor_type      NVARCHAR(20)                    NOT NULL DEFAULT 'system',
    actor_id        NVARCHAR(200)                   NULL,
    ip_address      NVARCHAR(50)                    NULL,
    correlation_id  NVARCHAR(100)                   NULL,       -- X-Correlation-Id
    created_at      DATETIME2                       NOT NULL DEFAULT GETUTCDATE()
);

CREATE INDEX IX_audit_entity     ON audit_log(entity, entity_id, created_at DESC);
CREATE INDEX IX_audit_actor      ON audit_log(actor_id, created_at DESC);
CREATE INDEX IX_audit_created    ON audit_log(created_at DESC);
GO

-- ============================================================
-- 16. FUENTES DE IMPORTACIÓN (CSV/Excel de proveedores)
-- ============================================================
CREATE TABLE import_sources (
    id              INT             IDENTITY(1,1)   PRIMARY KEY,
    provider_id     INT                             NOT NULL REFERENCES providers(id),
    name            NVARCHAR(200)                   NOT NULL,
    type            NVARCHAR(20)                    NOT NULL,   -- 'csv_url','xlsx_url','manual'
    url             NVARCHAR(1000)                  NULL,
    -- JSON con mapeo de columnas: {"title":"Product Name","price_usd":"List Price",...}
    column_mapping_json NVARCHAR(MAX)               NULL,
    -- JSON con config: {"separator":";","encoding":"utf-8","skip_rows":1}
    config_json     NVARCHAR(MAX)                   NULL,
    sync_frequency  NVARCHAR(20)                    NOT NULL DEFAULT 'manual',   -- 'manual','daily','weekly'
    is_active       BIT                             NOT NULL DEFAULT 1,
    last_synced_at  DATETIME2                       NULL,
    created_at      DATETIME2                       NOT NULL DEFAULT GETUTCDATE(),

    CONSTRAINT CK_import_sources_type          CHECK (type IN ('csv_url','xlsx_url','manual','api')),
    CONSTRAINT CK_import_sources_frequency     CHECK (sync_frequency IN ('manual','daily','weekly')),
    CONSTRAINT CK_import_sources_mapping_json  CHECK (column_mapping_json IS NULL OR ISJSON(column_mapping_json) = 1),
    CONSTRAINT CK_import_sources_config_json   CHECK (config_json IS NULL OR ISJSON(config_json) = 1)
);
GO

-- ============================================================
-- 17. LOG DE IMPORTACIONES
-- ============================================================
CREATE TABLE import_logs (
    id                  INT             IDENTITY(1,1)   PRIMARY KEY,
    import_source_id    INT                             NOT NULL REFERENCES import_sources(id),
    status              NVARCHAR(20)                    NOT NULL,   -- 'SUCCESS','FAILED','PARTIAL'
    rows_total          INT                             NOT NULL DEFAULT 0,
    rows_inserted       INT                             NOT NULL DEFAULT 0,
    rows_updated        INT                             NOT NULL DEFAULT 0,
    rows_failed         INT                             NOT NULL DEFAULT 0,
    errors_json         NVARCHAR(MAX)                   NULL,
    duration_ms         INT                             NULL,
    started_at          DATETIME2                       NOT NULL DEFAULT GETUTCDATE(),
    finished_at         DATETIME2                       NULL,

    CONSTRAINT CK_import_logs_status CHECK (status IN ('SUCCESS','FAILED','PARTIAL','RUNNING'))
);

CREATE INDEX IX_import_logs_source ON import_logs(import_source_id, started_at DESC);
GO

-- ============================================================
-- 18. TRIGGERS
-- ============================================================

-- updated_at automático para tablas que lo requieren
CREATE TRIGGER TR_categories_updated_at
ON categories AFTER UPDATE AS
BEGIN
    SET NOCOUNT ON;
    UPDATE categories SET updated_at = GETUTCDATE()
    FROM categories c INNER JOIN inserted i ON c.id = i.id;
END;
GO

CREATE TRIGGER TR_products_updated_at
ON products AFTER UPDATE AS
BEGIN
    SET NOCOUNT ON;
    UPDATE products SET updated_at = GETUTCDATE()
    FROM products p INNER JOIN inserted i ON p.id = i.id;
END;
GO

CREATE TRIGGER TR_product_offers_updated_at
ON product_offers AFTER UPDATE AS
BEGIN
    SET NOCOUNT ON;
    UPDATE product_offers SET updated_at = GETUTCDATE()
    FROM product_offers po INNER JOIN inserted i ON po.id = i.id;
END;
GO

CREATE TRIGGER TR_orders_updated_at
ON orders AFTER UPDATE AS
BEGIN
    SET NOCOUNT ON;
    UPDATE orders SET updated_at = GETUTCDATE()
    FROM orders o INNER JOIN inserted i ON o.id = i.id;
END;
GO

CREATE TRIGGER TR_invoices_updated_at
ON invoices AFTER UPDATE AS
BEGIN
    SET NOCOUNT ON;
    UPDATE invoices SET updated_at = GETUTCDATE()
    FROM invoices inv INNER JOIN inserted i ON inv.id = i.id;
END;
GO

CREATE TRIGGER TR_shipments_updated_at
ON shipments AFTER UPDATE AS
BEGIN
    SET NOCOUNT ON;
    UPDATE shipments SET updated_at = GETUTCDATE()
    FROM shipments s INNER JOIN inserted i ON s.id = i.id;
END;
GO

-- Trigger: al cambiar estado de un pedido, auto-registrar historial
CREATE TRIGGER TR_orders_status_history
ON orders AFTER UPDATE AS
BEGIN
    SET NOCOUNT ON;
    INSERT INTO order_status_history (order_id, from_status, to_status, actor_type, actor_id)
    SELECT i.id, d.status, i.status, 'system', 'trigger'
    FROM inserted i
    INNER JOIN deleted d ON i.id = d.id
    WHERE i.status <> d.status;
END;
GO

-- ============================================================
-- 19. STORED PROCEDURES
-- ============================================================

-- SP: Cambiar estado de pedido con validación de transición
CREATE PROCEDURE sp_ChangeOrderStatus
    @order_id       INT,
    @new_status     NVARCHAR(30),
    @actor_type     NVARCHAR(20)    = 'admin',
    @actor_id       NVARCHAR(200)   = NULL,
    @reason         NVARCHAR(500)   = NULL,
    @correlation_id NVARCHAR(100)   = NULL
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRANSACTION;

    DECLARE @current_status NVARCHAR(30);
    DECLARE @order_number   NVARCHAR(20);

    SELECT @current_status = status, @order_number = order_number
    FROM orders
    WHERE id = @order_id;

    IF @current_status IS NULL
    BEGIN
        ROLLBACK;
        THROW 50001, 'Pedido no encontrado', 1;
    END

    -- Validar que el nuevo estado existe (la constraint del CHECK lo valida en UPDATE)
    -- Validar transiciones inválidas (estados terminales)
    IF @current_status IN ('DELIVERED', 'REFUNDED', 'RETURNED') AND @new_status NOT IN ('CANCELLED')
    BEGIN
        ROLLBACK;
        THROW 50002, 'No se puede cambiar desde un estado terminal', 1;
    END

    -- Actualizar estado
    UPDATE orders
    SET status = @new_status
    WHERE id = @order_id;

    -- Registrar en historial (el trigger también lo hace, pero acá agregamos actor real)
    -- Eliminamos el del trigger para este caso (el trigger usa 'system'/'trigger')
    -- Insertamos uno con el actor real
    INSERT INTO order_status_history
        (order_id, from_status, to_status, actor_type, actor_id, reason)
    VALUES
        (@order_id, @current_status, @new_status, @actor_type, @actor_id, @reason);

    -- Audit log
    INSERT INTO audit_log
        (entity, entity_id, action, before_json, after_json, actor_type, actor_id, correlation_id)
    VALUES
        ('order', @order_id, 'STATE_CHANGE',
         JSON_OBJECT('status': @current_status),
         JSON_OBJECT('status': @new_status),
         @actor_type, @actor_id, @correlation_id);

    COMMIT;

    -- Retornar pedido actualizado
    SELECT id, public_id, order_number, status, updated_at
    FROM orders WHERE id = @order_id;
END;
GO

-- SP: Buscar productos con filtros (server-side pagination)
CREATE PROCEDURE sp_SearchProducts
    @q          NVARCHAR(300)   = NULL,
    @category   NVARCHAR(100)   = NULL,     -- slug
    @brand      NVARCHAR(100)   = NULL,
    @min_usd    DECIMAL(12,4)   = NULL,
    @max_usd    DECIMAL(12,4)   = NULL,
    @in_stock   BIT             = NULL,      -- NULL = todos
    @sort       NVARCHAR(30)    = 'created_desc',
    @page       INT             = 1,
    @page_size  INT             = 20
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @offset INT = (@page - 1) * @page_size;

    -- Precio mínimo de offer para cada producto
    ;WITH ProductPrices AS (
        SELECT
            po.product_id,
            MIN(po.price_usd) AS min_price_usd,
            MAX(po.stock_qty) AS max_stock,
            STRING_AGG(CAST(po.provider_id AS NVARCHAR), ',') AS provider_ids
        FROM product_offers po
        WHERE po.is_active = 1
        GROUP BY po.product_id
    ),
    FilteredProducts AS (
        SELECT
            p.id, p.public_id, p.sku, p.title, p.brand,
            p.images_json, p.created_at,
            c.name AS category_name, c.slug AS category_slug,
            pp.min_price_usd,
            pp.max_stock,
            COUNT(*) OVER() AS total_count
        FROM products p
        LEFT JOIN categories c      ON c.id = p.category_id
        LEFT JOIN ProductPrices pp  ON pp.product_id = p.id
        WHERE
            p.is_active = 1
            AND (@q IS NULL OR (
                p.title LIKE '%' + @q + '%'
                OR p.brand LIKE '%' + @q + '%'
                OR p.sku   LIKE '%' + @q + '%'
                OR p.tags  LIKE '%' + @q + '%'
            ))
            AND (@category IS NULL OR c.slug = @category)
            AND (@brand    IS NULL OR p.brand = @brand)
            AND (@min_usd  IS NULL OR pp.min_price_usd >= @min_usd)
            AND (@max_usd  IS NULL OR pp.min_price_usd <= @max_usd)
            AND (@in_stock IS NULL
                OR (@in_stock = 1 AND pp.max_stock > 0)
                OR (@in_stock = 0 AND (pp.max_stock IS NULL OR pp.max_stock = 0))
            )
    )
    SELECT *
    FROM FilteredProducts
    ORDER BY
        CASE WHEN @sort = 'price_asc'     THEN min_price_usd  END ASC,
        CASE WHEN @sort = 'price_desc'    THEN min_price_usd  END DESC,
        CASE WHEN @sort = 'title_asc'     THEN title          END ASC,
        CASE WHEN @sort = 'created_desc'  THEN created_at     END DESC,
        id DESC
    OFFSET @offset ROWS FETCH NEXT @page_size ROWS ONLY;
END;
GO

-- SP: Crear pedido en transacción
CREATE PROCEDURE sp_CreateOrder
    @customer_id            INT             = NULL,
    @guest_contact_json     NVARCHAR(MAX)   = NULL,
    @shipping_address_json  NVARCHAR(MAX)   = NULL,
    @fx_rate_snapshot       DECIMAL(14,4),
    @fx_source              NVARCHAR(100),
    @fx_timestamp           DATETIME2,
    @customer_notes         NVARCHAR(1000)  = NULL,
    @channel                NVARCHAR(50)    = 'web',
    @idempotency_key        NVARCHAR(200)   = NULL,
    @items_json             NVARCHAR(MAX),  -- [{"product_id":1,"qty":2,"offer_id":5},...]
    @correlation_id         NVARCHAR(100)   = NULL
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRANSACTION;

    -- Check idempotency
    IF @idempotency_key IS NOT NULL
    BEGIN
        DECLARE @existing_id INT;
        SELECT @existing_id = id FROM orders WHERE idempotency_key = @idempotency_key;
        IF @existing_id IS NOT NULL
        BEGIN
            COMMIT;
            SELECT id, public_id, order_number, status, total_usd, total_ars, created_at
            FROM orders WHERE id = @existing_id;
            RETURN;
        END
    END

    -- Parsear items (requiere OPENJSON)
    DECLARE @items TABLE (
        product_id  INT         NOT NULL,
        offer_id    INT         NULL,
        qty         INT         NOT NULL
    );

    INSERT INTO @items (product_id, offer_id, qty)
    SELECT
        CAST(JSON_VALUE(value, '$.product_id') AS INT),
        CAST(JSON_VALUE(value, '$.offer_id')   AS INT),
        CAST(JSON_VALUE(value, '$.qty')        AS INT)
    FROM OPENJSON(@items_json);

    -- Obtener datos de cada offer
    DECLARE @order_lines TABLE (
        product_id          INT,
        offer_id            INT,
        qty                 INT,
        sku                 NVARCHAR(100),
        title               NVARCHAR(500),
        brand               NVARCHAR(100),
        provider_id         INT,
        price_usd           DECIMAL(12,4),
        iva_rate            DECIMAL(5,4),
        line_subtotal_usd   DECIMAL(14,4),
        line_tax_usd        DECIMAL(14,4),
        line_total_usd      DECIMAL(14,4),
        line_total_ars      DECIMAL(18,2)
    );

    INSERT INTO @order_lines
    SELECT
        it.product_id,
        po.id,
        it.qty,
        p.sku,
        p.title,
        p.brand,
        po.provider_id,
        po.price_usd,
        po.iva_rate,
        it.qty * po.price_usd,                              -- line_subtotal_usd
        it.qty * po.price_usd * po.iva_rate,                -- line_tax_usd
        it.qty * po.price_usd * (1 + po.iva_rate),         -- line_total_usd
        it.qty * po.price_usd * (1 + po.iva_rate) * @fx_rate_snapshot  -- line_total_ars
    FROM @items it
    JOIN products p         ON p.id = it.product_id
    JOIN product_offers po  ON po.product_id = it.product_id
        AND (it.offer_id IS NULL OR po.id = it.offer_id)
        AND po.is_active = 1;

    -- Validar que tenemos líneas
    IF NOT EXISTS (SELECT 1 FROM @order_lines)
    BEGIN
        ROLLBACK;
        THROW 50010, 'No se encontraron offers activas para los productos solicitados', 1;
    END

    -- Calcular totales
    DECLARE @subtotal_usd   DECIMAL(14,4);
    DECLARE @tax_usd        DECIMAL(14,4);
    DECLARE @total_usd      DECIMAL(14,4);
    DECLARE @subtotal_ars   DECIMAL(18,2);
    DECLARE @total_ars      DECIMAL(18,2);

    SELECT
        @subtotal_usd = SUM(line_subtotal_usd),
        @tax_usd      = SUM(line_tax_usd),
        @total_usd    = SUM(line_total_usd),
        @total_ars    = SUM(line_total_ars)
    FROM @order_lines;

    SET @subtotal_ars = @subtotal_usd * @fx_rate_snapshot;

    -- Generar número de pedido
    DECLARE @new_id INT;
    DECLARE @order_number NVARCHAR(20);

    -- Insertar pedido
    INSERT INTO orders (
        customer_id, guest_contact_json, shipping_address_json,
        status, currency_base,
        fx_rate_snapshot, fx_source, fx_timestamp,
        subtotal_usd, tax_usd, total_usd,
        subtotal_ars, tax_ars, total_ars,
        customer_notes, channel, idempotency_key
    )
    VALUES (
        @customer_id, @guest_contact_json, @shipping_address_json,
        'RECEIVED', 'USD',
        @fx_rate_snapshot, @fx_source, @fx_timestamp,
        @subtotal_usd, @tax_usd, @total_usd,
        @subtotal_ars, @tax_usd * @fx_rate_snapshot, @total_ars,
        @customer_notes, @channel, @idempotency_key
    );

    SET @new_id = SCOPE_IDENTITY();
    SET @order_number = 'TT-' + RIGHT('000000' + CAST(@new_id AS NVARCHAR), 6);

    UPDATE orders SET order_number = @order_number WHERE id = @new_id;

    -- Insertar items
    INSERT INTO order_items (
        order_id, product_id, provider_id_snapshot,
        sku_snapshot, title_snapshot, brand_snapshot,
        qty, unit_price_usd_snapshot, iva_rate_snapshot,
        line_subtotal_usd, line_tax_usd, line_total_usd, line_total_ars
    )
    SELECT
        @new_id, product_id, provider_id,
        sku, title, brand,
        qty, price_usd, iva_rate,
        line_subtotal_usd, line_tax_usd, line_total_usd, line_total_ars
    FROM @order_lines;

    -- Historial inicial
    INSERT INTO order_status_history (order_id, from_status, to_status, actor_type, actor_id)
    VALUES (@new_id, NULL, 'RECEIVED', 'system', 'sp_CreateOrder');

    -- Audit
    INSERT INTO audit_log (entity, entity_id, action, after_json, actor_type, correlation_id)
    VALUES ('order', @new_id, 'CREATE',
            JSON_OBJECT('order_number': @order_number, 'status': 'RECEIVED', 'total_usd': CAST(@total_usd AS NVARCHAR)),
            'system', @correlation_id);

    COMMIT;

    -- Retornar datos del pedido creado
    SELECT
        o.id, o.public_id, o.order_number, o.status,
        o.total_usd, o.total_ars,
        o.fx_rate_snapshot, o.fx_source, o.fx_timestamp,
        o.created_at
    FROM orders o WHERE o.id = @new_id;
END;
GO

-- ============================================================
-- 20. VISTAS
-- ============================================================

-- Vista: Producto con precio mínimo de offer
CREATE VIEW vw_products_catalog AS
SELECT
    p.id,
    p.public_id,
    p.sku,
    p.title,
    p.brand,
    p.images_json,
    p.specs_json,
    p.tags,
    p.is_active,
    p.created_at,
    c.id        AS category_id,
    c.name      AS category_name,
    c.slug      AS category_slug,
    -- Precio mínimo entre offers activos
    (SELECT MIN(po2.price_usd)
     FROM product_offers po2
     WHERE po2.product_id = p.id AND po2.is_active = 1) AS min_price_usd,
    -- IVA del offer con menor precio
    (SELECT TOP 1 po3.iva_rate
     FROM product_offers po3
     WHERE po3.product_id = p.id AND po3.is_active = 1
     ORDER BY po3.price_usd ASC) AS iva_rate,
    -- Stock total (suma de todos los offers activos con stock conocido)
    (SELECT SUM(po4.stock_qty)
     FROM product_offers po4
     WHERE po4.product_id = p.id AND po4.is_active = 1 AND po4.stock_qty IS NOT NULL) AS total_stock,
    -- Cantidad de proveedores que tienen este producto
    (SELECT COUNT(*)
     FROM product_offers po5
     WHERE po5.product_id = p.id AND po5.is_active = 1) AS provider_count
FROM products p
LEFT JOIN categories c ON c.id = p.category_id
WHERE p.is_active = 1;
GO

-- Vista: Pedidos con resumen para inbox admin
CREATE VIEW vw_orders_inbox AS
SELECT
    o.id,
    o.public_id,
    o.order_number,
    o.status,
    o.channel,
    o.total_usd,
    o.total_ars,
    o.fx_rate_snapshot,
    o.created_at,
    o.updated_at,
    -- Cliente
    COALESCE(cu.name,  JSON_VALUE(o.guest_contact_json, '$.name'))  AS customer_name,
    COALESCE(cu.email, JSON_VALUE(o.guest_contact_json, '$.email')) AS customer_email,
    JSON_VALUE(o.guest_contact_json, '$.company') AS customer_company,
    -- Conteo de items
    (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id) AS item_count,
    -- Último estado registrado (puede diferir temporalmente del disparador)
    (SELECT TOP 1 created_at FROM order_status_history
     WHERE order_id = o.id ORDER BY created_at DESC)               AS last_status_at
FROM orders o
LEFT JOIN customers cu ON cu.id = o.customer_id;
GO