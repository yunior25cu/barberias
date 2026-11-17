CREATE TABLE [AdminUser] (
  [id] NVARCHAR(40) NOT NULL, [username] NVARCHAR(100) NOT NULL,
  [passwordHash] NVARCHAR(255) NOT NULL, [createdAt] DATETIME2 NOT NULL CONSTRAINT [DF_AdminUser_createdAt] DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT [PK_AdminUser] PRIMARY KEY CLUSTERED ([id])
);
CREATE UNIQUE INDEX [AdminUser_username_key] ON [AdminUser]([username]);

CREATE TABLE [Service] (
  [id] NVARCHAR(40) NOT NULL, [name] NVARCHAR(120) NOT NULL, [description] NVARCHAR(500),
  [durationMinutes] INT NOT NULL, [priceCents] INT, [active] BIT NOT NULL CONSTRAINT [DF_Service_active] DEFAULT 1,
  [sortOrder] INT NOT NULL CONSTRAINT [DF_Service_sortOrder] DEFAULT 0,
  CONSTRAINT [PK_Service] PRIMARY KEY CLUSTERED ([id]),
  CONSTRAINT [CK_Service_duration] CHECK ([durationMinutes] BETWEEN 5 AND 480)
);
CREATE TABLE [Staff] (
  [id] NVARCHAR(40) NOT NULL, [name] NVARCHAR(120) NOT NULL,
  [active] BIT NOT NULL CONSTRAINT [DF_Staff_active] DEFAULT 1,
  CONSTRAINT [PK_Staff] PRIMARY KEY CLUSTERED ([id])
);
CREATE TABLE [StaffService] (
  [staffId] NVARCHAR(40) NOT NULL, [serviceId] NVARCHAR(40) NOT NULL,
  CONSTRAINT [PK_StaffService] PRIMARY KEY CLUSTERED ([staffId], [serviceId]),
  CONSTRAINT [FK_StaffService_Staff] FOREIGN KEY ([staffId]) REFERENCES [Staff]([id]) ON DELETE CASCADE,
  CONSTRAINT [FK_StaffService_Service] FOREIGN KEY ([serviceId]) REFERENCES [Service]([id]) ON DELETE CASCADE
);
CREATE TABLE [BusinessHours] (
  [id] NVARCHAR(40) NOT NULL, [staffId] NVARCHAR(40) NOT NULL, [weekday] INT NOT NULL,
  [startMinute] INT NOT NULL, [endMinute] INT NOT NULL,
  CONSTRAINT [PK_BusinessHours] PRIMARY KEY CLUSTERED ([id]),
  CONSTRAINT [FK_BusinessHours_Staff] FOREIGN KEY ([staffId]) REFERENCES [Staff]([id]) ON DELETE CASCADE,
  CONSTRAINT [CK_BusinessHours_weekday] CHECK ([weekday] BETWEEN 0 AND 6),
  CONSTRAINT [CK_BusinessHours_minutes] CHECK ([startMinute] BETWEEN 0 AND 1439 AND [endMinute] BETWEEN 1 AND 1440 AND [endMinute] > [startMinute])
);
CREATE INDEX [BusinessHours_staffId_weekday_idx] ON [BusinessHours]([staffId], [weekday]);

CREATE TABLE [Booking] (
  [id] NVARCHAR(40) NOT NULL, [code] NVARCHAR(20) NOT NULL, [serviceId] NVARCHAR(40) NOT NULL,
  [staffId] NVARCHAR(40) NOT NULL, [customerName] NVARCHAR(160) NOT NULL, [phoneNormalized] NVARCHAR(32) NOT NULL,
  [startsAt] DATETIMEOFFSET NOT NULL, [endsAt] DATETIMEOFFSET NOT NULL,
  [status] NVARCHAR(20) NOT NULL CONSTRAINT [DF_Booking_status] DEFAULT N'confirmed',
  [manageTokenHash] NVARCHAR(64) NOT NULL, [idempotencyKey] NVARCHAR(100) NOT NULL,
  [createdAt] DATETIME2 NOT NULL CONSTRAINT [DF_Booking_createdAt] DEFAULT CURRENT_TIMESTAMP,
  [updatedAt] DATETIME2 NOT NULL,
  CONSTRAINT [PK_Booking] PRIMARY KEY CLUSTERED ([id]),
  CONSTRAINT [FK_Booking_Service] FOREIGN KEY ([serviceId]) REFERENCES [Service]([id]),
  CONSTRAINT [FK_Booking_Staff] FOREIGN KEY ([staffId]) REFERENCES [Staff]([id]),
  CONSTRAINT [CK_Booking_interval] CHECK ([endsAt] > [startsAt]),
  CONSTRAINT [CK_Booking_status] CHECK ([status] IN (N'confirmed',N'cancelled',N'completed',N'no_show'))
);
CREATE UNIQUE INDEX [Booking_code_key] ON [Booking]([code]);
CREATE UNIQUE INDEX [Booking_manageTokenHash_key] ON [Booking]([manageTokenHash]);
CREATE UNIQUE INDEX [Booking_idempotencyKey_key] ON [Booking]([idempotencyKey]);
CREATE INDEX [Booking_startsAt_status_idx] ON [Booking]([startsAt], [status]);

CREATE TABLE [TimeBlock] (
  [id] NVARCHAR(40) NOT NULL, [staffId] NVARCHAR(40) NOT NULL, [startsAt] DATETIMEOFFSET NOT NULL,
  [endsAt] DATETIMEOFFSET NOT NULL, [reason] NVARCHAR(250),
  [active] BIT NOT NULL CONSTRAINT [DF_TimeBlock_active] DEFAULT 1,
  CONSTRAINT [PK_TimeBlock] PRIMARY KEY CLUSTERED ([id]),
  CONSTRAINT [FK_TimeBlock_Staff] FOREIGN KEY ([staffId]) REFERENCES [Staff]([id]) ON DELETE CASCADE,
  CONSTRAINT [CK_TimeBlock_interval] CHECK ([endsAt] > [startsAt])
);
CREATE TABLE [Occupancy] (
  [id] NVARCHAR(40) NOT NULL, [staffId] NVARCHAR(40) NOT NULL, [bookingId] NVARCHAR(40), [blockId] NVARCHAR(40),
  [startsAt] DATETIMEOFFSET NOT NULL, [endsAt] DATETIMEOFFSET NOT NULL,
  [active] BIT NOT NULL CONSTRAINT [DF_Occupancy_active] DEFAULT 1,
  CONSTRAINT [PK_Occupancy] PRIMARY KEY CLUSTERED ([id]),
  CONSTRAINT [FK_Occupancy_Staff] FOREIGN KEY ([staffId]) REFERENCES [Staff]([id]),
  CONSTRAINT [FK_Occupancy_Booking] FOREIGN KEY ([bookingId]) REFERENCES [Booking]([id]) ON DELETE CASCADE,
  CONSTRAINT [FK_Occupancy_TimeBlock] FOREIGN KEY ([blockId]) REFERENCES [TimeBlock]([id]) ON DELETE CASCADE,
  CONSTRAINT [CK_Occupancy_interval] CHECK ([endsAt] > [startsAt]),
  CONSTRAINT [CK_Occupancy_source] CHECK (([bookingId] IS NULL AND [blockId] IS NOT NULL) OR ([bookingId] IS NOT NULL AND [blockId] IS NULL))
);


CREATE UNIQUE INDEX [Occupancy_bookingId_blockId_key] ON [Occupancy]([bookingId],[blockId]);
CREATE INDEX [Occupancy_staffId_startsAt_endsAt_idx] ON [Occupancy]([staffId], [startsAt], [endsAt]);
EXEC(N'CREATE TRIGGER [TR_Occupancy_NoOverlap] ON [Occupancy]
AFTER INSERT, UPDATE
AS
BEGIN
  SET NOCOUNT ON;
  DECLARE @lockResult int;
  EXEC @lockResult = sys.sp_getapplock
    @Resource = N''AlCorte:Occupancy'', @LockMode = ''Exclusive'',
    @LockOwner = ''Transaction'', @LockTimeout = 15000;
  IF @lockResult < 0 THROW 51000, ''Could not lock appointment occupancy.'', 1;
  IF EXISTS (
    SELECT 1 FROM inserted AS i
    INNER JOIN [Occupancy] AS o ON o.[staffId] = i.[staffId]
      AND o.[active] = 1 AND i.[active] = 1
      AND o.[startsAt] < i.[endsAt] AND o.[endsAt] > i.[startsAt]
      AND o.[id] <> i.[id]
  ) THROW 51001, ''Overlapping appointment occupancy is not allowed.'', 1;
END;');
CREATE TABLE [Settings] (
  [id] INT NOT NULL CONSTRAINT [DF_Settings_id] DEFAULT 1,
  [businessName] NVARCHAR(120) NOT NULL CONSTRAINT [DF_Settings_businessName] DEFAULT N'Al Corte',
  [publicPhone] NVARCHAR(32), [timezone] NVARCHAR(64) NOT NULL CONSTRAINT [DF_Settings_timezone] DEFAULT N'America/Montevideo',
  [currency] NVARCHAR(3) NOT NULL CONSTRAINT [DF_Settings_currency] DEFAULT N'UYU',
  [minAdvanceMinutes] INT NOT NULL CONSTRAINT [DF_Settings_minAdvanceMinutes] DEFAULT 60,
  [maxAdvanceDays] INT NOT NULL CONSTRAINT [DF_Settings_maxAdvanceDays] DEFAULT 60,
  [slotStepMinutes] INT NOT NULL CONSTRAINT [DF_Settings_slotStepMinutes] DEFAULT 15,
  [cancellationPolicy] NVARCHAR(500) NOT NULL CONSTRAINT [DF_Settings_cancellationPolicy] DEFAULT N'Cancelá o cambiá tu hora con anticipación contactando al local.',
  CONSTRAINT [PK_Settings] PRIMARY KEY CLUSTERED ([id]), CONSTRAINT [CK_Settings_singleton] CHECK ([id] = 1)
);
CREATE TABLE [RateLimit] (
  [key] NVARCHAR(100) NOT NULL, [hits] INT NOT NULL, [resetAt] DATETIMEOFFSET NOT NULL,
  CONSTRAINT [PK_RateLimit] PRIMARY KEY CLUSTERED ([key])
);
