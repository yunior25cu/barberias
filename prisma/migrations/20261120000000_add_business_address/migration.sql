SET XACT_ABORT ON;

IF OBJECT_ID(N'dbo.Settings', N'U') IS NULL
  THROW 51200, 'Settings table is missing; inspect the database before adding business address.', 1;

IF COL_LENGTH(N'dbo.Settings', N'businessAddress') IS NULL
  ALTER TABLE dbo.Settings ADD businessAddress NVARCHAR(300) NULL;
