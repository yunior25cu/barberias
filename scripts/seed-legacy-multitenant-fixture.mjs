import sql from "mssql";

const connection = process.env.DATABASE_URL ?? "";
if (process.env.CI !== "true" || !/^sqlserver:\/\/(localhost|127\.0\.0\.1)(:\d+)?;database=barber_local;/i.test(connection)) {
  throw new Error("Legacy tenant migration fixtures are restricted to CI's disposable SQL Server database barber_local.");
}
if ((process.env.AZURE_SQL_AUTH_MODE ?? "sql") !== "sql" || ["AZURE_SQL_CLIENT_ID", "AZURE_SQL_CLIENT_SECRET", "AZURE_SQL_TENANT_ID"].some(name => process.env[name])) {
  throw new Error("Legacy tenant fixtures refuse Azure identity credentials.");
}
const [, serverName, portText] = connection.match(/^sqlserver:\/\/([^:]+)(?::(\d+))?/i) ?? [];
const settings = Object.fromEntries(connection.split(";").slice(1).filter(Boolean).map(part => {
  const index = part.indexOf("=");
  return [part.slice(0, index).toLowerCase(), part.slice(index + 1)];
}));
if (!serverName || !settings.user || !settings.password) throw new Error("Invalid disposable SQL Server connection.");

const pool = await new sql.ConnectionPool({
  server: serverName,
  port: Number(portText ?? 1433),
  database: settings.database,
  user: settings.user,
  password: settings.password,
  options: { encrypt: true, trustServerCertificate: settings.trustservercertificate === "true" },
}).connect();
try {
  const start = new Date(Date.now() + 3 * 86_400_000);
  start.setUTCSeconds(0, 0);
  start.setUTCHours(12, 0, 0, 0);
  const end = new Date(start.getTime() + 30 * 60_000);
  const blockStart = new Date(start.getTime() + 2 * 60 * 60_000);
  const blockEnd = new Date(blockStart.getTime() + 30 * 60_000);
  await pool.request()
    .input("bookingStart", sql.DateTimeOffset, start)
    .input("bookingEnd", sql.DateTimeOffset, end)
    .input("blockStart", sql.DateTimeOffset, blockStart)
    .input("blockEnd", sql.DateTimeOffset, blockEnd)
    .query(`
      INSERT INTO dbo.AdminUser (id, username, passwordHash) VALUES (N'legacy-ci-admin', N'legacy-ci-owner', N'ci-only-password-hash');
      INSERT INTO dbo.Settings (id, businessName, publicPhone, timezone, currency, minAdvanceMinutes, maxAdvanceDays, slotStepMinutes, cancellationPolicy)
        VALUES (1, N'Al Corte', NULL, N'America/Montevideo', N'UYU', 60, 60, 15, N'CI-only legacy settings');
      INSERT INTO dbo.Service (id, name, description, durationMinutes, priceCents, active, sortOrder)
        VALUES (N'legacy-ci-service', N'Legacy CI service', NULL, 30, 2500, 1, 1);
      INSERT INTO dbo.Staff (id, name, active) VALUES (N'legacy-ci-staff', N'Legacy CI professional', 1);
      INSERT INTO dbo.StaffService (staffId, serviceId) VALUES (N'legacy-ci-staff', N'legacy-ci-service');
      INSERT INTO dbo.BusinessHours (id, staffId, weekday, startMinute, endMinute)
        VALUES (N'legacy-ci-hours', N'legacy-ci-staff', 3, 540, 1080);
      INSERT INTO dbo.Booking (id, code, serviceId, staffId, customerName, phoneNormalized, startsAt, endsAt, status, manageTokenHash, idempotencyKey, createdAt, updatedAt)
        VALUES (N'legacy-ci-booking', N'111111', N'legacy-ci-service', N'legacy-ci-staff', N'CI customer', N'', @bookingStart, @bookingEnd, N'confirmed', REPLICATE(N'a',64), N'legacy-ci-idempotency', SYSUTCDATETIME(), SYSUTCDATETIME());
      INSERT INTO dbo.TimeBlock (id, staffId, startsAt, endsAt, reason, active)
        VALUES (N'legacy-ci-block', N'legacy-ci-staff', @blockStart, @blockEnd, N'CI-only fixture', 1);
      INSERT INTO dbo.Occupancy (id, staffId, bookingId, blockId, startsAt, endsAt, active)
        VALUES (N'legacy-ci-booking-occupancy', N'legacy-ci-staff', N'legacy-ci-booking', NULL, @bookingStart, @bookingEnd, 1);
      INSERT INTO dbo.Occupancy (id, staffId, bookingId, blockId, startsAt, endsAt, active)
        VALUES (N'legacy-ci-block-occupancy', N'legacy-ci-staff', NULL, N'legacy-ci-block', @blockStart, @blockEnd, 1);
      INSERT INTO dbo.RateLimit ([key], hits, resetAt) VALUES (N'legacy-ci-rate-limit', 1, DATEADD(hour,1,SYSUTCDATETIME()));
    `);
  console.log("LEGACY_TENANT_FIXTURE=READY (synthetic records only)");
} finally {
  await pool.close();
}

