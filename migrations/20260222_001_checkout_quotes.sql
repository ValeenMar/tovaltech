/*
  Checkout quotes for server-side pricing lock.
  Idempotent migration.
*/

IF NOT EXISTS (
  SELECT 1
  FROM sys.objects
  WHERE object_id = OBJECT_ID(N'[dbo].[tovaltech_checkout_quotes]')
    AND type = 'U'
)
BEGIN
  CREATE TABLE dbo.tovaltech_checkout_quotes (
    quote_id NVARCHAR(64) NOT NULL PRIMARY KEY,
    payload_json NVARCHAR(MAX) NOT NULL,
    total_ars INT NOT NULL,
    expires_at DATETIME2 NOT NULL,
    used_at DATETIME2 NULL,
    mp_preference_id NVARCHAR(80) NULL,
    request_fingerprint NVARCHAR(128) NULL,
    created_at DATETIME2 NOT NULL CONSTRAINT DF_tovaltech_checkout_quotes_created_at DEFAULT SYSUTCDATETIME()
  );
END
GO

IF NOT EXISTS (
  SELECT 1
  FROM sys.indexes
  WHERE name = 'IX_tovaltech_checkout_quotes_expires_at'
    AND object_id = OBJECT_ID(N'[dbo].[tovaltech_checkout_quotes]')
)
BEGIN
  CREATE INDEX IX_tovaltech_checkout_quotes_expires_at
    ON dbo.tovaltech_checkout_quotes (expires_at);
END
GO

IF NOT EXISTS (
  SELECT 1
  FROM sys.indexes
  WHERE name = 'IX_tovaltech_checkout_quotes_used_at'
    AND object_id = OBJECT_ID(N'[dbo].[tovaltech_checkout_quotes]')
)
BEGIN
  CREATE INDEX IX_tovaltech_checkout_quotes_used_at
    ON dbo.tovaltech_checkout_quotes (used_at);
END
GO
