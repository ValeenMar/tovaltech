/*
  Auth users schema hardening.
  Idempotent migration for buyer auth endpoints.
*/

IF NOT EXISTS (
  SELECT 1
  FROM sys.objects
  WHERE object_id = OBJECT_ID(N'[dbo].[tovaltech_users]')
    AND type = 'U'
)
BEGIN
  CREATE TABLE dbo.tovaltech_users (
    id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    name NVARCHAR(120) NOT NULL,
    last_name NVARCHAR(120) NULL,
    email NVARCHAR(255) NOT NULL,
    password_hash NVARCHAR(255) NOT NULL,
    confirmed BIT NOT NULL CONSTRAINT DF_tovaltech_users_confirmed DEFAULT (1),
    confirm_token NVARCHAR(128) NULL,
    confirm_expires DATETIME2 NULL,
    created_at DATETIME2 NOT NULL CONSTRAINT DF_tovaltech_users_created_at DEFAULT SYSUTCDATETIME(),
    updated_at DATETIME2 NULL
  );
END
GO

IF COL_LENGTH('dbo.tovaltech_users', 'name') IS NULL
BEGIN
  ALTER TABLE dbo.tovaltech_users
  ADD name NVARCHAR(120) NULL;
END
GO

IF COL_LENGTH('dbo.tovaltech_users', 'last_name') IS NULL
BEGIN
  ALTER TABLE dbo.tovaltech_users
  ADD last_name NVARCHAR(120) NULL;
END
GO

IF COL_LENGTH('dbo.tovaltech_users', 'email') IS NULL
BEGIN
  ALTER TABLE dbo.tovaltech_users
  ADD email NVARCHAR(255) NULL;
END
GO

IF COL_LENGTH('dbo.tovaltech_users', 'password_hash') IS NULL
BEGIN
  ALTER TABLE dbo.tovaltech_users
  ADD password_hash NVARCHAR(255) NULL;
END
GO

IF COL_LENGTH('dbo.tovaltech_users', 'confirmed') IS NULL
BEGIN
  ALTER TABLE dbo.tovaltech_users
  ADD confirmed BIT NOT NULL CONSTRAINT DF_tovaltech_users_confirmed_migr DEFAULT (1);
END
GO

IF COL_LENGTH('dbo.tovaltech_users', 'confirm_token') IS NULL
BEGIN
  ALTER TABLE dbo.tovaltech_users
  ADD confirm_token NVARCHAR(128) NULL;
END
GO

IF COL_LENGTH('dbo.tovaltech_users', 'confirm_expires') IS NULL
BEGIN
  ALTER TABLE dbo.tovaltech_users
  ADD confirm_expires DATETIME2 NULL;
END
GO

IF COL_LENGTH('dbo.tovaltech_users', 'created_at') IS NULL
BEGIN
  ALTER TABLE dbo.tovaltech_users
  ADD created_at DATETIME2 NOT NULL CONSTRAINT DF_tovaltech_users_created_at_migr DEFAULT SYSUTCDATETIME();
END
GO

IF COL_LENGTH('dbo.tovaltech_users', 'updated_at') IS NULL
BEGIN
  ALTER TABLE dbo.tovaltech_users
  ADD updated_at DATETIME2 NULL;
END
GO

-- Normalize null flags if old rows exist.
UPDATE dbo.tovaltech_users
SET confirmed = 1
WHERE confirmed IS NULL;
GO

IF NOT EXISTS (
  SELECT 1
  FROM sys.indexes
  WHERE name = 'IX_tovaltech_users_email'
    AND object_id = OBJECT_ID(N'[dbo].[tovaltech_users]')
)
BEGIN
  CREATE INDEX IX_tovaltech_users_email
    ON dbo.tovaltech_users (email);
END
GO

IF NOT EXISTS (
  SELECT 1
  FROM sys.indexes
  WHERE name = 'IX_tovaltech_users_confirm_token'
    AND object_id = OBJECT_ID(N'[dbo].[tovaltech_users]')
)
BEGIN
  CREATE INDEX IX_tovaltech_users_confirm_token
    ON dbo.tovaltech_users (confirm_token);
END
GO

