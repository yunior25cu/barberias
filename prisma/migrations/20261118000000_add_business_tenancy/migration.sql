SET XACT_ABORT ON;

DECLARE @baselineChecksum CHAR(64) = '544c9107008668fec2d13487321039317767cb96dc603ea2a22f980d8fa334dc';
DECLARE @windowsBaselineChecksum CHAR(64) = '4f5b6020d31e0da72f5c61d8a3801619e02e7b21c3a84e866c5623e053fe27be';
IF OBJECT_ID(N'dbo._prisma_migrations', N'U') IS NULL
  THROW 51100, 'Expected SQL Server migration history is missing; inspect the database before tenant migration.', 1;
IF NOT EXISTS (
  SELECT 1 FROM dbo._prisma_migrations
  WHERE migration_name = N'20261117010000_init_sqlserver'
    AND checksum IN (@baselineChecksum,@windowsBaselineChecksum) AND finished_at IS NOT NULL AND rolled_back_at IS NULL
)
  THROW 51101, 'SQL Server baseline migration or checksum differs from the reviewed source; stop for database reconciliation.', 1;
IF EXISTS (SELECT 1 FROM sys.tables WHERE name=N'Business' AND schema_id=SCHEMA_ID(N'dbo'))
  THROW 51102, 'Business table exists before this migration; inspect existing tenant assignments before proceeding.', 1;
IF OBJECT_ID(N'dbo.AdminUser',N'U') IS NULL OR OBJECT_ID(N'dbo.Settings',N'U') IS NULL
 OR OBJECT_ID(N'dbo.Service',N'U') IS NULL OR OBJECT_ID(N'dbo.Staff',N'U') IS NULL
 OR OBJECT_ID(N'dbo.StaffService',N'U') IS NULL OR OBJECT_ID(N'dbo.BusinessHours',N'U') IS NULL
 OR OBJECT_ID(N'dbo.Booking',N'U') IS NULL OR OBJECT_ID(N'dbo.TimeBlock',N'U') IS NULL
 OR OBJECT_ID(N'dbo.Occupancy',N'U') IS NULL OR OBJECT_ID(N'dbo.RateLimit',N'U') IS NULL
  THROW 51103, 'The expected Al Corte SQL Server schema is incomplete; inspect before migration.', 1;

CREATE TABLE #before ([tableName] SYSNAME PRIMARY KEY, [rowCount] BIGINT NOT NULL);
INSERT INTO #before VALUES
 (N'AdminUser',(SELECT COUNT_BIG(*) FROM dbo.AdminUser)),
 (N'Settings',(SELECT COUNT_BIG(*) FROM dbo.Settings)),
 (N'Service',(SELECT COUNT_BIG(*) FROM dbo.Service)),
 (N'Staff',(SELECT COUNT_BIG(*) FROM dbo.Staff)),
 (N'StaffService',(SELECT COUNT_BIG(*) FROM dbo.StaffService)),
 (N'BusinessHours',(SELECT COUNT_BIG(*) FROM dbo.BusinessHours)),
 (N'Booking',(SELECT COUNT_BIG(*) FROM dbo.Booking)),
 (N'TimeBlock',(SELECT COUNT_BIG(*) FROM dbo.TimeBlock)),
 (N'Occupancy',(SELECT COUNT_BIG(*) FROM dbo.Occupancy));
IF (SELECT [rowCount] FROM #before WHERE [tableName]=N'Settings')>1
  THROW 51112, 'More than one legacy Settings row exists; inspect before tenant migration.', 1;

IF EXISTS (
 SELECT 1 FROM dbo.Occupancy o
 LEFT JOIN dbo.Booking b ON b.id=o.bookingId
 LEFT JOIN dbo.TimeBlock t ON t.id=o.blockId
 WHERE (o.bookingId IS NOT NULL AND (b.id IS NULL OR b.staffId<>o.staffId))
    OR (o.blockId IS NOT NULL AND (t.id IS NULL OR t.staffId<>o.staffId))
    OR ((o.bookingId IS NULL AND o.blockId IS NULL) OR (o.bookingId IS NOT NULL AND o.blockId IS NOT NULL))
)
  THROW 51104, 'Occupancy source and staff assignment is ambiguous; stop before tenant migration.', 1;

CREATE TABLE dbo.Business (
 [id] NVARCHAR(40) NOT NULL,
 [slug] NVARCHAR(63) NOT NULL,
 [status] NVARCHAR(16) NOT NULL CONSTRAINT DF_Business_status DEFAULT N'active',
 [createdAt] DATETIME2 NOT NULL CONSTRAINT DF_Business_createdAt DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT PK_Business PRIMARY KEY CLUSTERED ([id]),
 CONSTRAINT CK_Business_slug CHECK (
   [slug] COLLATE Latin1_General_100_BIN2 = LOWER([slug]) COLLATE Latin1_General_100_BIN2
   AND [slug] COLLATE Latin1_General_100_BIN2 NOT LIKE N'%[^a-z0-9-]%'
   AND [slug] NOT LIKE N'-%' AND [slug] NOT LIKE N'%-' AND [slug] NOT LIKE N'%--%'
   AND LEN([slug]) BETWEEN 1 AND 63
 ),
 CONSTRAINT CK_Business_status CHECK ([status] IN (N'active',N'inactive'))
);
CREATE UNIQUE INDEX Business_slug_key ON dbo.Business([slug]);
INSERT INTO dbo.Business ([id],[slug],[status]) VALUES (N'al-corte',N'al-corte',N'active');

ALTER TABLE dbo.AdminUser ADD [businessId] NVARCHAR(40) NULL;
ALTER TABLE dbo.AdminUser ADD [active] BIT NOT NULL CONSTRAINT DF_AdminUser_active DEFAULT 1 WITH VALUES;
ALTER TABLE dbo.AdminUser ADD [sessionVersion] INT NOT NULL CONSTRAINT DF_AdminUser_sessionVersion DEFAULT 1 WITH VALUES;
ALTER TABLE dbo.Settings ADD [businessId] NVARCHAR(40) NULL;
ALTER TABLE dbo.Service ADD [businessId] NVARCHAR(40) NULL;
ALTER TABLE dbo.Staff ADD [businessId] NVARCHAR(40) NULL;
ALTER TABLE dbo.StaffService ADD [businessId] NVARCHAR(40) NULL;
ALTER TABLE dbo.BusinessHours ADD [businessId] NVARCHAR(40) NULL;
ALTER TABLE dbo.Booking ADD [businessId] NVARCHAR(40) NULL;
ALTER TABLE dbo.TimeBlock ADD [businessId] NVARCHAR(40) NULL;
ALTER TABLE dbo.Occupancy ADD [businessId] NVARCHAR(40) NULL;
GO

UPDATE dbo.AdminUser SET businessId=N'al-corte';
UPDATE dbo.Settings SET businessId=N'al-corte';
UPDATE dbo.Service SET businessId=N'al-corte';
UPDATE dbo.Staff SET businessId=N'al-corte';
UPDATE dbo.StaffService SET businessId=N'al-corte';
UPDATE dbo.BusinessHours SET businessId=N'al-corte';
UPDATE dbo.Booking SET businessId=N'al-corte';
UPDATE dbo.TimeBlock SET businessId=N'al-corte';
EXEC sys.sp_executesql N'UPDATE dbo.Occupancy SET businessId=N''al-corte'';';

IF EXISTS (SELECT 1 FROM dbo.StaffService ss LEFT JOIN dbo.Staff s ON s.id=ss.staffId LEFT JOIN dbo.Service v ON v.id=ss.serviceId WHERE s.id IS NULL OR v.id IS NULL)
  THROW 51105, 'A staff-service relation has no valid source row; stop before tenant migration.', 1;
IF EXISTS (SELECT 1 FROM dbo.Booking b LEFT JOIN dbo.Staff s ON s.id=b.staffId LEFT JOIN dbo.Service v ON v.id=b.serviceId WHERE s.id IS NULL OR v.id IS NULL)
  THROW 51106, 'A booking has no valid staff or service; stop before tenant migration.', 1;
IF EXISTS (SELECT 1 FROM dbo.BusinessHours h LEFT JOIN dbo.Staff s ON s.id=h.staffId WHERE s.id IS NULL)
  THROW 51107, 'A business-hours row has no valid staff; stop before tenant migration.', 1;
IF EXISTS (SELECT 1 FROM dbo.TimeBlock t LEFT JOIN dbo.Staff s ON s.id=t.staffId WHERE s.id IS NULL)
  THROW 51108, 'A time block has no valid staff; stop before tenant migration.', 1;
EXEC sys.sp_executesql N'
IF EXISTS (SELECT 1 FROM dbo.Occupancy o WHERE o.businessId<>N''al-corte'')
  THROW 51109, ''Legacy occupancy could not be assigned unambiguously to the initial business.'', 1;';

ALTER TABLE dbo.StaffService DROP CONSTRAINT FK_StaffService_Staff;
ALTER TABLE dbo.StaffService DROP CONSTRAINT FK_StaffService_Service;
ALTER TABLE dbo.BusinessHours DROP CONSTRAINT FK_BusinessHours_Staff;
ALTER TABLE dbo.Booking DROP CONSTRAINT FK_Booking_Service;
ALTER TABLE dbo.Booking DROP CONSTRAINT FK_Booking_Staff;
ALTER TABLE dbo.TimeBlock DROP CONSTRAINT FK_TimeBlock_Staff;
ALTER TABLE dbo.Occupancy DROP CONSTRAINT FK_Occupancy_Staff;
ALTER TABLE dbo.StaffService DROP CONSTRAINT PK_StaffService;

DROP INDEX AdminUser_username_key ON dbo.AdminUser;
DROP INDEX Booking_code_key ON dbo.Booking;
DROP INDEX Booking_idempotencyKey_key ON dbo.Booking;
DROP INDEX Occupancy_bookingId_blockId_key ON dbo.Occupancy;

ALTER TABLE dbo.Settings DROP CONSTRAINT CK_Settings_singleton;
ALTER TABLE dbo.Settings DROP CONSTRAINT PK_Settings;
ALTER TABLE dbo.Settings DROP CONSTRAINT DF_Settings_id;
ALTER TABLE dbo.Settings DROP COLUMN [id];
IF (SELECT [rowCount] FROM #before WHERE [tableName]=N'Settings')=0
  EXEC sys.sp_executesql N'INSERT INTO dbo.Settings ([businessId],[businessName]) VALUES (N''al-corte'',N''Al Corte'');';

ALTER TABLE dbo.AdminUser ALTER COLUMN businessId NVARCHAR(40) NOT NULL;
ALTER TABLE dbo.Service ALTER COLUMN businessId NVARCHAR(40) NOT NULL;
ALTER TABLE dbo.Staff ALTER COLUMN businessId NVARCHAR(40) NOT NULL;
ALTER TABLE dbo.StaffService ALTER COLUMN businessId NVARCHAR(40) NOT NULL;
ALTER TABLE dbo.BusinessHours ALTER COLUMN businessId NVARCHAR(40) NOT NULL;
ALTER TABLE dbo.Booking ALTER COLUMN businessId NVARCHAR(40) NOT NULL;
ALTER TABLE dbo.TimeBlock ALTER COLUMN businessId NVARCHAR(40) NOT NULL;
ALTER TABLE dbo.Occupancy ALTER COLUMN businessId NVARCHAR(40) NOT NULL;
ALTER TABLE dbo.Settings ALTER COLUMN businessId NVARCHAR(40) NOT NULL;
ALTER TABLE dbo.RateLimit DROP CONSTRAINT PK_RateLimit;
ALTER TABLE dbo.RateLimit ALTER COLUMN [key] NVARCHAR(160) NOT NULL;
ALTER TABLE dbo.RateLimit ADD CONSTRAINT PK_RateLimit PRIMARY KEY CLUSTERED ([key]);

ALTER TABLE dbo.Settings ADD CONSTRAINT PK_Settings PRIMARY KEY CLUSTERED ([businessId]);
ALTER TABLE dbo.AdminUser ADD CONSTRAINT FK_AdminUser_Business FOREIGN KEY ([businessId]) REFERENCES dbo.Business([id]);
ALTER TABLE dbo.Service ADD CONSTRAINT FK_Service_Business FOREIGN KEY ([businessId]) REFERENCES dbo.Business([id]);
ALTER TABLE dbo.Staff ADD CONSTRAINT FK_Staff_Business FOREIGN KEY ([businessId]) REFERENCES dbo.Business([id]);
ALTER TABLE dbo.StaffService ADD CONSTRAINT FK_StaffService_Business FOREIGN KEY ([businessId]) REFERENCES dbo.Business([id]);
ALTER TABLE dbo.BusinessHours ADD CONSTRAINT FK_BusinessHours_Business FOREIGN KEY ([businessId]) REFERENCES dbo.Business([id]);
ALTER TABLE dbo.Booking ADD CONSTRAINT FK_Booking_Business FOREIGN KEY ([businessId]) REFERENCES dbo.Business([id]);
ALTER TABLE dbo.TimeBlock ADD CONSTRAINT FK_TimeBlock_Business FOREIGN KEY ([businessId]) REFERENCES dbo.Business([id]);
ALTER TABLE dbo.Occupancy ADD CONSTRAINT FK_Occupancy_Business FOREIGN KEY ([businessId]) REFERENCES dbo.Business([id]);
ALTER TABLE dbo.Settings ADD CONSTRAINT FK_Settings_Business FOREIGN KEY ([businessId]) REFERENCES dbo.Business([id]);

CREATE UNIQUE INDEX AdminUser_username_businessId_key ON dbo.AdminUser([username],[businessId]);
CREATE UNIQUE INDEX AdminUser_id_businessId_key ON dbo.AdminUser([id],[businessId]);
CREATE UNIQUE INDEX Service_id_businessId_key ON dbo.Service([id],[businessId]);
CREATE UNIQUE INDEX Staff_id_businessId_key ON dbo.Staff([id],[businessId]);
ALTER TABLE dbo.StaffService ADD CONSTRAINT PK_StaffService PRIMARY KEY CLUSTERED ([businessId],[staffId],[serviceId]);
CREATE UNIQUE INDEX Booking_code_businessId_key ON dbo.Booking([code],[businessId]);
CREATE UNIQUE INDEX Booking_idempotencyKey_businessId_key ON dbo.Booking([idempotencyKey],[businessId]);
CREATE UNIQUE INDEX Booking_id_businessId_key ON dbo.Booking([id],[businessId]);
CREATE UNIQUE INDEX Booking_id_staffId_businessId_key ON dbo.Booking([id],[staffId],[businessId]);
CREATE UNIQUE INDEX TimeBlock_id_businessId_key ON dbo.TimeBlock([id],[businessId]);
CREATE UNIQUE INDEX TimeBlock_id_staffId_businessId_key ON dbo.TimeBlock([id],[staffId],[businessId]);
CREATE UNIQUE INDEX Occupancy_bookingId_blockId_businessId_key ON dbo.Occupancy([bookingId],[blockId],[businessId]);

CREATE INDEX AdminUser_businessId_active_idx ON dbo.AdminUser([businessId],[active]);
CREATE INDEX Service_businessId_active_sortOrder_idx ON dbo.Service([businessId],[active],[sortOrder]);
CREATE INDEX Staff_businessId_active_name_idx ON dbo.Staff([businessId],[active],[name]);
CREATE INDEX StaffService_businessId_serviceId_idx ON dbo.StaffService([businessId],[serviceId]);
CREATE INDEX BusinessHours_businessId_staffId_weekday_idx ON dbo.BusinessHours([businessId],[staffId],[weekday]);
CREATE INDEX Booking_businessId_startsAt_status_idx ON dbo.Booking([businessId],[startsAt],[status]);
CREATE INDEX TimeBlock_businessId_staffId_startsAt_endsAt_idx ON dbo.TimeBlock([businessId],[staffId],[startsAt],[endsAt]);
CREATE INDEX Occupancy_businessId_staffId_startsAt_endsAt_idx ON dbo.Occupancy([businessId],[staffId],[startsAt],[endsAt]);

ALTER TABLE dbo.StaffService ADD CONSTRAINT FK_StaffService_Staff_Tenant FOREIGN KEY ([staffId],[businessId]) REFERENCES dbo.Staff([id],[businessId]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE dbo.StaffService ADD CONSTRAINT FK_StaffService_Service_Tenant FOREIGN KEY ([serviceId],[businessId]) REFERENCES dbo.Service([id],[businessId]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE dbo.BusinessHours ADD CONSTRAINT FK_BusinessHours_Staff_Tenant FOREIGN KEY ([staffId],[businessId]) REFERENCES dbo.Staff([id],[businessId]) ON DELETE CASCADE;
ALTER TABLE dbo.Booking ADD CONSTRAINT FK_Booking_Service_Tenant FOREIGN KEY ([serviceId],[businessId]) REFERENCES dbo.Service([id],[businessId]);
ALTER TABLE dbo.Booking ADD CONSTRAINT FK_Booking_Staff_Tenant FOREIGN KEY ([staffId],[businessId]) REFERENCES dbo.Staff([id],[businessId]) ON UPDATE NO ACTION;
ALTER TABLE dbo.TimeBlock ADD CONSTRAINT FK_TimeBlock_Staff_Tenant FOREIGN KEY ([staffId],[businessId]) REFERENCES dbo.Staff([id],[businessId]) ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE dbo.Occupancy ADD CONSTRAINT FK_Occupancy_Staff_Tenant FOREIGN KEY ([staffId],[businessId]) REFERENCES dbo.Staff([id],[businessId]);
ALTER TABLE dbo.Occupancy ADD CONSTRAINT FK_Occupancy_Booking_TenantStaff FOREIGN KEY ([bookingId],[staffId],[businessId]) REFERENCES dbo.Booking([id],[staffId],[businessId]);
ALTER TABLE dbo.Occupancy ADD CONSTRAINT FK_Occupancy_TimeBlock_TenantStaff FOREIGN KEY ([blockId],[staffId],[businessId]) REFERENCES dbo.TimeBlock([id],[staffId],[businessId]);

DECLARE @after TABLE ([tableName] SYSNAME PRIMARY KEY, [rowCount] BIGINT NOT NULL);
INSERT INTO @after VALUES
 (N'AdminUser',(SELECT COUNT_BIG(*) FROM dbo.AdminUser)),
 (N'Settings',(SELECT COUNT_BIG(*) FROM dbo.Settings)),
 (N'Service',(SELECT COUNT_BIG(*) FROM dbo.Service)),
 (N'Staff',(SELECT COUNT_BIG(*) FROM dbo.Staff)),
 (N'StaffService',(SELECT COUNT_BIG(*) FROM dbo.StaffService)),
 (N'BusinessHours',(SELECT COUNT_BIG(*) FROM dbo.BusinessHours)),
 (N'Booking',(SELECT COUNT_BIG(*) FROM dbo.Booking)),
 (N'TimeBlock',(SELECT COUNT_BIG(*) FROM dbo.TimeBlock)),
 (N'Occupancy',(SELECT COUNT_BIG(*) FROM dbo.Occupancy));
IF EXISTS (SELECT [tableName],[rowCount] FROM #before WHERE [tableName]<>N'Settings' EXCEPT SELECT [tableName],[rowCount] FROM @after WHERE [tableName]<>N'Settings')
 OR EXISTS (SELECT [tableName],[rowCount] FROM @after WHERE [tableName]<>N'Settings' EXCEPT SELECT [tableName],[rowCount] FROM #before WHERE [tableName]<>N'Settings')
 OR (SELECT [rowCount] FROM @after WHERE [tableName]=N'Settings')<>1
  THROW 51110, 'The tenant migration changed application row counts; transaction must roll back.', 1;
EXEC sys.sp_executesql N'
IF EXISTS (SELECT 1 FROM dbo.AdminUser WHERE businessId IS NULL)
 OR EXISTS (SELECT 1 FROM dbo.Settings WHERE businessId IS NULL)
 OR EXISTS (SELECT 1 FROM dbo.Service WHERE businessId IS NULL)
 OR EXISTS (SELECT 1 FROM dbo.Staff WHERE businessId IS NULL)
 OR EXISTS (SELECT 1 FROM dbo.StaffService WHERE businessId IS NULL)
 OR EXISTS (SELECT 1 FROM dbo.BusinessHours WHERE businessId IS NULL)
 OR EXISTS (SELECT 1 FROM dbo.Booking WHERE businessId IS NULL)
 OR EXISTS (SELECT 1 FROM dbo.TimeBlock WHERE businessId IS NULL)
 OR EXISTS (SELECT 1 FROM dbo.Occupancy WHERE businessId IS NULL)
  THROW 51111, ''Tenant assignment left orphaned rows; transaction must roll back.'', 1;';

EXEC(N'CREATE OR ALTER TRIGGER dbo.TR_Occupancy_NoOverlap ON dbo.Occupancy
AFTER INSERT, UPDATE
AS
BEGIN
 SET NOCOUNT ON;
 DECLARE @businessId NVARCHAR(40), @lockResult INT, @resource NVARCHAR(255);
 IF EXISTS (SELECT 1 FROM inserted i JOIN deleted d ON d.id=i.id WHERE d.businessId<>i.businessId)
   THROW 51002, ''Occupancy business assignment cannot be changed.'', 1;
 DECLARE business_locks CURSOR LOCAL FAST_FORWARD FOR
   SELECT DISTINCT businessId FROM inserted ORDER BY businessId;
 OPEN business_locks;
 FETCH NEXT FROM business_locks INTO @businessId;
 WHILE @@FETCH_STATUS=0
 BEGIN
   SET @resource=N''AlCorte:Occupancy:''+@businessId;
   EXEC @lockResult=sys.sp_getapplock
     @Resource=@resource,
     @LockMode=''Exclusive'', @LockOwner=''Transaction'', @LockTimeout=15000;
   IF @lockResult<0 THROW 51000, ''Could not lock appointment occupancy.'', 1;
   FETCH NEXT FROM business_locks INTO @businessId;
 END;
 CLOSE business_locks;
 DEALLOCATE business_locks;
 IF EXISTS (
   SELECT 1 FROM inserted i
   INNER JOIN dbo.Occupancy o ON o.businessId=i.businessId AND o.staffId=i.staffId
     AND o.active=1 AND i.active=1
     AND o.startsAt<i.endsAt AND o.endsAt>i.startsAt AND o.id<>i.id
 ) THROW 51001, ''Overlapping appointment occupancy is not allowed.'', 1;
END;');

DROP TABLE #before;

SELECT N'AL_CORTE_TENANT_MIGRATION' AS [event], N'al-corte' AS [businessId], N'al-corte' AS [slug];
