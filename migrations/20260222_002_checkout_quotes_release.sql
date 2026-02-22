/*
  Release lifecycle for checkout quotes stock reservations.
  Idempotent migration.
*/

IF COL_LENGTH('dbo.tovaltech_checkout_quotes', 'released_at') IS NULL
BEGIN
  ALTER TABLE dbo.tovaltech_checkout_quotes
  ADD released_at DATETIME2 NULL;
END
GO

IF COL_LENGTH('dbo.tovaltech_checkout_quotes', 'released_reason') IS NULL
BEGIN
  ALTER TABLE dbo.tovaltech_checkout_quotes
  ADD released_reason NVARCHAR(40) NULL;
END
GO

IF NOT EXISTS (
  SELECT 1
  FROM sys.indexes
  WHERE name = 'IX_tovaltech_checkout_quotes_released_at'
    AND object_id = OBJECT_ID(N'[dbo].[tovaltech_checkout_quotes]')
)
BEGIN
  CREATE INDEX IX_tovaltech_checkout_quotes_released_at
    ON dbo.tovaltech_checkout_quotes (released_at);
END
GO

