/*
  User profile columns for buyer account features.
  Idempotent migration.
*/

IF COL_LENGTH('dbo.tovaltech_users', 'phone') IS NULL
BEGIN
  ALTER TABLE dbo.tovaltech_users
  ADD phone NVARCHAR(40) NULL;
END
GO

IF COL_LENGTH('dbo.tovaltech_users', 'zone') IS NULL
BEGIN
  ALTER TABLE dbo.tovaltech_users
  ADD zone NVARCHAR(24) NULL;
END
GO

IF COL_LENGTH('dbo.tovaltech_users', 'address') IS NULL
BEGIN
  ALTER TABLE dbo.tovaltech_users
  ADD address NVARCHAR(200) NULL;
END
GO

IF COL_LENGTH('dbo.tovaltech_users', 'city') IS NULL
BEGIN
  ALTER TABLE dbo.tovaltech_users
  ADD city NVARCHAR(120) NULL;
END
GO

UPDATE dbo.tovaltech_users
SET zone = 'CABA'
WHERE zone IS NULL OR LTRIM(RTRIM(zone)) = '';
GO

