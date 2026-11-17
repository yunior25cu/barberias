SET XACT_ABORT ON;

DECLARE @settingsDefault SYSNAME;
DECLARE @dropSettingsDefaultSql NVARCHAR(500);
SELECT @settingsDefault = dc.name
FROM sys.default_constraints dc
JOIN sys.columns c ON c.default_object_id = dc.object_id
WHERE dc.parent_object_id = OBJECT_ID(N'dbo.Settings') AND c.name = N'businessName';
IF @settingsDefault IS NOT NULL
BEGIN
  SET @dropSettingsDefaultSql = N'ALTER TABLE dbo.Settings DROP CONSTRAINT ' + QUOTENAME(@settingsDefault);
  EXEC sys.sp_executesql @dropSettingsDefaultSql;
END;
ALTER TABLE dbo.Settings ALTER COLUMN businessName NVARCHAR(120) NOT NULL;
ALTER TABLE dbo.AdminUser ADD isInitialOwner BIT NOT NULL CONSTRAINT DF_AdminUser_isInitialOwner DEFAULT 0;
CREATE INDEX AdminUser_businessId_isInitialOwner_idx ON dbo.AdminUser(businessId, isInitialOwner);

CREATE TABLE dbo.PlatformAdmin (
  id NVARCHAR(40) NOT NULL CONSTRAINT PK_PlatformAdmin PRIMARY KEY,
  username NVARCHAR(100) NOT NULL,
  passwordHash NVARCHAR(255) NOT NULL,
  active BIT NOT NULL CONSTRAINT DF_PlatformAdmin_active DEFAULT 1,
  sessionVersion INT NOT NULL CONSTRAINT DF_PlatformAdmin_sessionVersion DEFAULT 1,
  createdAt DATETIMEOFFSET NOT NULL CONSTRAINT DF_PlatformAdmin_createdAt DEFAULT SYSDATETIMEOFFSET(),
  updatedAt DATETIMEOFFSET NOT NULL CONSTRAINT DF_PlatformAdmin_updatedAt DEFAULT SYSDATETIMEOFFSET(),
  CONSTRAINT CK_PlatformAdmin_username CHECK (LEN(username) BETWEEN 1 AND 100 AND username COLLATE Latin1_General_100_BIN2 = LOWER(username) COLLATE Latin1_General_100_BIN2),
  CONSTRAINT CK_PlatformAdmin_sessionVersion CHECK (sessionVersion >= 1)
);
CREATE UNIQUE INDEX PlatformAdmin_username_key ON dbo.PlatformAdmin(username);

CREATE TABLE dbo.AdminActivation (
  id NVARCHAR(40) NOT NULL CONSTRAINT PK_AdminActivation PRIMARY KEY,
  businessId NVARCHAR(40) NOT NULL,
  adminUserId NVARCHAR(40) NOT NULL,
  purpose NVARCHAR(32) NOT NULL,
  tokenHash NVARCHAR(64) NOT NULL,
  expiresAt DATETIMEOFFSET NOT NULL,
  consumedAt DATETIMEOFFSET NULL,
  invalidatedAt DATETIMEOFFSET NULL,
  createdAt DATETIMEOFFSET NOT NULL CONSTRAINT DF_AdminActivation_createdAt DEFAULT SYSDATETIMEOFFSET(),
  CONSTRAINT CK_AdminActivation_purpose CHECK (purpose = N'initial-owner'),
  CONSTRAINT CK_AdminActivation_state CHECK (consumedAt IS NULL OR invalidatedAt IS NULL),
  CONSTRAINT CK_AdminActivation_tokenHash CHECK (LEN(tokenHash)=64 AND tokenHash COLLATE Latin1_General_100_BIN2 NOT LIKE N'%[^0-9a-f]%'),
  CONSTRAINT FK_AdminActivation_Business FOREIGN KEY (businessId) REFERENCES dbo.Business(id),
  CONSTRAINT FK_AdminActivation_AdminUser FOREIGN KEY (adminUserId, businessId) REFERENCES dbo.AdminUser(id, businessId)
);
CREATE UNIQUE INDEX AdminActivation_tokenHash_key ON dbo.AdminActivation(tokenHash);
CREATE INDEX AdminActivation_businessId_adminUserId_purpose_expiresAt_idx ON dbo.AdminActivation(businessId, adminUserId, purpose, expiresAt);
CREATE INDEX AdminActivation_tokenHash_expiresAt_consumedAt_idx ON dbo.AdminActivation(tokenHash, expiresAt, consumedAt);

CREATE TABLE dbo.PlatformAudit (
  id NVARCHAR(40) NOT NULL CONSTRAINT PK_PlatformAudit PRIMARY KEY,
  actorId NVARCHAR(40) NOT NULL,
  businessId NVARCHAR(40) NULL,
  action NVARCHAR(60) NOT NULL,
  result NVARCHAR(20) NOT NULL,
  changesJson NVARCHAR(MAX) NULL,
  createdAt DATETIMEOFFSET NOT NULL CONSTRAINT DF_PlatformAudit_createdAt DEFAULT SYSDATETIMEOFFSET(),
  CONSTRAINT CK_PlatformAudit_result CHECK (result IN (N'success',N'failure')),
  CONSTRAINT CK_PlatformAudit_changesJson CHECK (changesJson IS NULL OR ISJSON(changesJson)=1),
  CONSTRAINT FK_PlatformAudit_Actor FOREIGN KEY (actorId) REFERENCES dbo.PlatformAdmin(id),
  CONSTRAINT FK_PlatformAudit_Business FOREIGN KEY (businessId) REFERENCES dbo.Business(id)
);
CREATE INDEX PlatformAudit_businessId_createdAt_idx ON dbo.PlatformAudit(businessId, createdAt);
CREATE INDEX PlatformAudit_actorId_createdAt_idx ON dbo.PlatformAudit(actorId, createdAt);

CREATE TABLE dbo.PlatformProvisioningRequest (
  id NVARCHAR(40) NOT NULL CONSTRAINT PK_PlatformProvisioningRequest PRIMARY KEY,
  actorId NVARCHAR(40) NOT NULL,
  idempotencyKey NVARCHAR(100) NOT NULL,
  requestHash NVARCHAR(64) NOT NULL,
  businessId NVARCHAR(40) NOT NULL,
  createdAt DATETIMEOFFSET NOT NULL CONSTRAINT DF_PlatformProvisioningRequest_createdAt DEFAULT SYSDATETIMEOFFSET(),
  CONSTRAINT CK_PlatformProvisioningRequest_hashes CHECK (LEN(idempotencyKey) BETWEEN 16 AND 100 AND LEN(requestHash)=64 AND requestHash COLLATE Latin1_General_100_BIN2 NOT LIKE N'%[^0-9a-f]%'),
  CONSTRAINT FK_PlatformProvisioningRequest_Actor FOREIGN KEY (actorId) REFERENCES dbo.PlatformAdmin(id),
  CONSTRAINT FK_PlatformProvisioningRequest_Business FOREIGN KEY (businessId) REFERENCES dbo.Business(id)
);
CREATE UNIQUE INDEX PlatformProvisioningRequest_idempotencyKey_key ON dbo.PlatformProvisioningRequest(idempotencyKey);
CREATE INDEX PlatformProvisioningRequest_businessId_createdAt_idx ON dbo.PlatformProvisioningRequest(businessId, createdAt);
