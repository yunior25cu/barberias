SET XACT_ABORT ON;

IF OBJECT_ID(N'dbo.Settings', N'U') IS NULL
  THROW 51310, 'Settings table is missing; inspect the database before adding calendar mode.', 1;

IF COL_LENGTH(N'dbo.Settings', N'calendarMode') IS NULL
  ALTER TABLE dbo.Settings
    ADD [calendarMode] NVARCHAR(16) NOT NULL
      CONSTRAINT [DF_Settings_calendarMode] DEFAULT N'fixed';

IF NOT EXISTS (
  SELECT 1 FROM sys.check_constraints
  WHERE [name] = N'CK_Settings_calendarMode' AND [parent_object_id] = OBJECT_ID(N'dbo.Settings')
)
  EXEC(N'ALTER TABLE dbo.Settings WITH CHECK ADD CONSTRAINT [CK_Settings_calendarMode] CHECK ([calendarMode] IN (N''fixed'', N''dynamic''));');
