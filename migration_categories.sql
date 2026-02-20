-- =====================================================================
-- TovalTech — Migración: sistema de categorías con markup
-- Ejecutar en Azure SQL (Query Editor o Azure Data Studio)
-- =====================================================================

-- 1. Tabla de categorías con markup opcional
IF OBJECT_ID('dbo.tovaltech_categories', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.tovaltech_categories (
    id         INT IDENTITY(1,1) PRIMARY KEY,
    name       NVARCHAR(100) NOT NULL,
    markup_pct DECIMAL(5,2)  NULL,          -- NULL = usa markup global
    created_at DATETIME      DEFAULT GETDATE(),
    updated_at DATETIME      DEFAULT GETDATE(),
    CONSTRAINT UQ_category_name UNIQUE (name)
  );

  -- Seed: importar categorías existentes de los productos
  INSERT INTO dbo.tovaltech_categories (name)
  SELECT DISTINCT LTRIM(RTRIM(category))
  FROM dbo.tovaltech_products
  WHERE category IS NOT NULL AND LTRIM(RTRIM(category)) <> '';

  PRINT 'Tabla tovaltech_categories creada y poblada con categorías existentes.';
END
ELSE
BEGIN
  PRINT 'Tabla tovaltech_categories ya existe — sin cambios.';
END

-- 2. Setting para guardar el resultado del último sync
IF NOT EXISTS (
  SELECT 1 FROM dbo.tovaltech_settings WHERE key_name = 'last_sync_result'
)
BEGIN
  INSERT INTO dbo.tovaltech_settings (key_name, value, description)
  VALUES ('last_sync_result', '{}', 'Resultado del último sync de productos (JSON)');
  PRINT 'Setting last_sync_result creado.';
END

-- Verificar
SELECT 'tovaltech_categories' AS tabla, COUNT(*) AS registros
FROM dbo.tovaltech_categories
UNION ALL
SELECT 'tovaltech_settings', COUNT(*)
FROM dbo.tovaltech_settings;
