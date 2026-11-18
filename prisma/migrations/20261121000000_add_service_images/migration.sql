SET XACT_ABORT ON;

IF OBJECT_ID(N'dbo.Service', N'U') IS NULL
  THROW 51300, 'Service table is missing; inspect the database before adding service images.', 1;

IF COL_LENGTH(N'dbo.Service', N'imageBlobName') IS NULL
  ALTER TABLE dbo.Service ADD imageBlobName NVARCHAR(300) NULL;
