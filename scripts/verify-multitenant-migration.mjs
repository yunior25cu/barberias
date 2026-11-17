import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import sql from "mssql";

const connection = process.env.DATABASE_URL ?? "";
if (process.env.CI !== "true" || !/^sqlserver:\/\/(localhost|127\.0\.0\.1)(:\d+)?;database=barber_local;/i.test(connection)) {
  throw new Error("Tenant migration verification is restricted to CI's disposable SQL Server database barber_local.");
}
if ((process.env.AZURE_SQL_AUTH_MODE ?? "sql") !== "sql" || ["AZURE_SQL_CLIENT_ID", "AZURE_SQL_CLIENT_SECRET", "AZURE_SQL_TENANT_ID"].some(name => process.env[name])) {
  throw new Error("Tenant migration verification refuses Azure identity credentials.");
}
const [, serverName, portText] = connection.match(/^sqlserver:\/\/([^:]+)(?::(\d+))?/i) ?? [];
const settings = Object.fromEntries(connection.split(";").slice(1).filter(Boolean).map(part => {
  const index = part.indexOf("=");
  return [part.slice(0, index).toLowerCase(), part.slice(index + 1)];
}));
const migrationName = "20261118000000_add_business_tenancy";
const migration = await readFile(join(process.cwd(), "prisma", "migrations", migrationName, "migration.sql"), "utf8");
const expectedChecksum = createHash("sha256").update(migration).digest("hex");
const pool = await new sql.ConnectionPool({
  server: serverName, port: Number(portText ?? 1433), database: settings.database, user: settings.user, password: settings.password,
  options: { encrypt: true, trustServerCertificate: settings.trustservercertificate === "true" },
}).connect();
try {
  const result = await pool.request().query(`
    SELECT
      (SELECT COUNT(*) FROM dbo.Business WHERE id=N'al-corte' AND slug=N'al-corte' AND status=N'active') AS initial_business,
      (SELECT COUNT(*) FROM dbo.Settings WHERE businessId=N'al-corte' AND businessName=N'Al Corte' AND cancellationPolicy=N'CI-only legacy settings') AS settings_preserved,
      (SELECT COUNT(*) FROM dbo.AdminUser WHERE id=N'legacy-ci-admin' AND username=N'legacy-ci-owner' AND passwordHash=N'ci-only-password-hash' AND businessId=N'al-corte' AND active=1 AND sessionVersion=1) AS admin_preserved,
      (SELECT COUNT(*) FROM dbo.Booking WHERE id=N'legacy-ci-booking' AND businessId=N'al-corte' AND phoneNormalized=N'' AND code=N'111111' AND idempotencyKey=N'legacy-ci-idempotency') AS booking_preserved,
      (SELECT COUNT(*) FROM dbo.Occupancy WHERE businessId=N'al-corte') AS occupancy_count,
      (SELECT COUNT(*) FROM dbo.RateLimit WHERE [key]=N'legacy-ci-rate-limit') AS rate_limit_preserved,
      (SELECT COUNT(*) FROM dbo.Business WHERE status=N'active') AS active_business_count,
      (SELECT COUNT(*) FROM dbo._prisma_migrations WHERE migration_name=N'20261118000000_add_business_tenancy' AND checksum=N'${expectedChecksum}' AND finished_at IS NOT NULL AND rolled_back_at IS NULL) AS migration_history_valid,
      (SELECT COUNT(*) FROM sys.foreign_keys WHERE name IN (
        N'FK_AdminUser_Business',N'FK_Service_Business',N'FK_Staff_Business',N'FK_StaffService_Business',N'FK_BusinessHours_Business',
        N'FK_Booking_Business',N'FK_TimeBlock_Business',N'FK_Occupancy_Business',N'FK_Settings_Business',
        N'FK_StaffService_Staff_Tenant',N'FK_StaffService_Service_Tenant',N'FK_BusinessHours_Staff_Tenant',
        N'FK_Booking_Service_Tenant',N'FK_Booking_Staff_Tenant',N'FK_TimeBlock_Staff_Tenant',N'FK_Occupancy_Staff_Tenant',
        N'FK_Occupancy_Booking_TenantStaff',N'FK_Occupancy_TimeBlock_TenantStaff'
      ) AND is_disabled=0 AND is_not_trusted=0) AS validated_tenant_foreign_keys,
      (SELECT COUNT(*) FROM sys.indexes WHERE name IN (
        N'AdminUser_username_businessId_key',N'Booking_code_businessId_key',N'Booking_idempotencyKey_businessId_key',
        N'Business_slug_key',N'Occupancy_businessId_staffId_startsAt_endsAt_idx'
      ) AND is_unique IN (0,1)) AS tenant_indexes,
      (SELECT COUNT(*) FROM sys.triggers WHERE name=N'TR_Occupancy_NoOverlap' AND is_disabled=0
        AND OBJECT_DEFINITION(object_id) LIKE N'%AlCorte:Occupancy:%'
        AND OBJECT_DEFINITION(object_id) LIKE N'%o.businessId=i.businessId%') AS tenant_occupancy_trigger,
      (SELECT COUNT(*) FROM dbo.StaffService ss LEFT JOIN dbo.Staff s ON s.id=ss.staffId AND s.businessId=ss.businessId LEFT JOIN dbo.Service v ON v.id=ss.serviceId AND v.businessId=ss.businessId WHERE s.id IS NULL OR v.id IS NULL)
      + (SELECT COUNT(*) FROM dbo.Booking b LEFT JOIN dbo.Staff s ON s.id=b.staffId AND s.businessId=b.businessId LEFT JOIN dbo.Service v ON v.id=b.serviceId AND v.businessId=b.businessId WHERE s.id IS NULL OR v.id IS NULL)
      + (SELECT COUNT(*) FROM dbo.BusinessHours h LEFT JOIN dbo.Staff s ON s.id=h.staffId AND s.businessId=h.businessId WHERE s.id IS NULL)
      + (SELECT COUNT(*) FROM dbo.TimeBlock t LEFT JOIN dbo.Staff s ON s.id=t.staffId AND s.businessId=t.businessId WHERE s.id IS NULL)
      + (SELECT COUNT(*) FROM dbo.Occupancy o LEFT JOIN dbo.Staff s ON s.id=o.staffId AND s.businessId=o.businessId LEFT JOIN dbo.Booking b ON b.id=o.bookingId AND b.staffId=o.staffId AND b.businessId=o.businessId LEFT JOIN dbo.TimeBlock t ON t.id=o.blockId AND t.staffId=o.staffId AND t.businessId=o.businessId WHERE s.id IS NULL OR (o.bookingId IS NOT NULL AND b.id IS NULL) OR (o.blockId IS NOT NULL AND t.id IS NULL)) AS tenant_orphans;
    SELECT migration_name, checksum, IIF(finished_at IS NOT NULL AND rolled_back_at IS NULL,1,0) AS success
      FROM dbo._prisma_migrations ORDER BY started_at;
    SELECT t.name AS [table], CONVERT(varchar(20),SUM(p.rows)) AS [rows]
      FROM sys.tables t JOIN sys.partitions p ON p.object_id=t.object_id AND p.index_id IN (0,1)
      WHERE t.name IN (N'Business',N'AdminUser',N'Settings',N'Service',N'Staff',N'StaffService',N'BusinessHours',N'Booking',N'TimeBlock',N'Occupancy',N'RateLimit')
      GROUP BY t.name ORDER BY t.name;
  `);
  const checks = result.recordsets[0][0];
  const valid = checks.initial_business === 1 && checks.settings_preserved === 1 && checks.admin_preserved === 1
    && checks.booking_preserved === 1 && checks.occupancy_count === 2 && checks.rate_limit_preserved === 1
    && checks.active_business_count === 1 && checks.migration_history_valid === 1
    && checks.validated_tenant_foreign_keys === 18 && checks.tenant_indexes === 5
    && checks.tenant_occupancy_trigger === 1 && checks.tenant_orphans === 0;
  if (!valid) throw new Error(`Tenant migration verification failed: ${JSON.stringify(checks)}`);
  console.log("TENANT_MIGRATION=PASS");
  console.log("PRESERVED_FIXTURE=PASS (legacy administrator, settings, booking, empty phone, occupancies and rate limit)");
  console.log(`VALIDATED_TENANT_FKS=${checks.validated_tenant_foreign_keys}`);
  console.log("TENANT_ORPHANS=0");
  console.log(JSON.stringify(result.recordsets[2], null, 2));
} finally {
  await pool.close();
}
