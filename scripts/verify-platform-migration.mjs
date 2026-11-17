import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import sql from "mssql";

const connection = process.env.DATABASE_URL ?? "";
if (process.env.CI !== "true" || !/^sqlserver:\/\/(localhost|127\.0\.0\.1)(:\d+)?;database=barber_local;/i.test(connection)) throw new Error("Platform migration checks are restricted to disposable SQL Server barber_local.");
if ((process.env.AZURE_SQL_AUTH_MODE ?? "sql") !== "sql" || ["AZURE_SQL_CLIENT_ID", "AZURE_SQL_CLIENT_SECRET", "AZURE_SQL_TENANT_ID"].some(name => process.env[name])) throw new Error("Platform migration verification refuses Azure credentials.");
const [, server, portText] = connection.match(/^sqlserver:\/\/([^:]+)(?::(\d+))?/i) ?? [];
const values = Object.fromEntries(connection.split(";").slice(1).filter(Boolean).map(part => { const at = part.indexOf("="); return [part.slice(0, at).toLowerCase(), part.slice(at + 1)]; }));
const migrationName = "20261119000000_platform_panel";
const text = await readFile(join(process.cwd(), "prisma", "migrations", migrationName, "migration.sql"), "utf8");
const expectedChecksum = createHash("sha256").update(text).digest("hex");
const pool = await new sql.ConnectionPool({ server, port: Number(portText ?? 1433), database: values.database, user: values.user, password: values.password, options: { encrypt: true, trustServerCertificate: values.trustservercertificate === "true" }, connectionTimeout: 15000, requestTimeout: 30000 }).connect();
try {
  const result = await pool.request().query(`
    SELECT
      (SELECT COUNT(*) FROM sys.tables WHERE schema_id=SCHEMA_ID(N'dbo') AND name IN (N'PlatformAdmin',N'AdminActivation',N'PlatformAudit',N'PlatformProvisioningRequest')) AS platform_tables,
      (SELECT COUNT(*) FROM sys.foreign_keys WHERE parent_object_id IN (OBJECT_ID(N'dbo.AdminActivation'),OBJECT_ID(N'dbo.PlatformAudit'),OBJECT_ID(N'dbo.PlatformProvisioningRequest')) AND is_disabled=0 AND is_not_trusted=0) AS trusted_fks,
      (SELECT COUNT(*) FROM sys.check_constraints WHERE parent_object_id IN (OBJECT_ID(N'dbo.PlatformAdmin'),OBJECT_ID(N'dbo.AdminActivation'),OBJECT_ID(N'dbo.PlatformAudit')) AND is_disabled=0 AND is_not_trusted=0) AS trusted_checks,
      (SELECT COUNT(*) FROM sys.indexes WHERE object_id=OBJECT_ID(N'dbo.PlatformAdmin') AND name=N'PlatformAdmin_username_key' AND is_unique=1) AS username_unique,
      (SELECT COUNT(*) FROM sys.indexes WHERE object_id=OBJECT_ID(N'dbo.AdminActivation') AND name=N'AdminActivation_tokenHash_key' AND is_unique=1) AS activation_token_unique,
      (SELECT COUNT(*) FROM sys.indexes WHERE object_id=OBJECT_ID(N'dbo.PlatformProvisioningRequest') AND name=N'PlatformProvisioningRequest_idempotencyKey_key' AND is_unique=1) AS idempotency_unique,
      (SELECT COUNT(*) FROM sys.default_constraints dc JOIN sys.columns c ON c.default_object_id=dc.object_id WHERE dc.parent_object_id=OBJECT_ID(N'dbo.Settings') AND c.name=N'businessName') AS settings_name_defaults,
      (SELECT COUNT(*) FROM dbo.PlatformAdmin) AS platform_admins,
      (SELECT COUNT(*) FROM dbo._prisma_migrations WHERE migration_name=N'${migrationName}' AND checksum=N'${expectedChecksum}' AND finished_at IS NOT NULL AND rolled_back_at IS NULL) AS migration_history;
  `);
  const row = result.recordset[0];
  if (row.platform_tables !== 4 || row.trusted_fks < 5 || row.trusted_checks < 3 || row.username_unique !== 1 || row.activation_token_unique !== 1 || row.idempotency_unique !== 1 || row.settings_name_defaults !== 0 || row.platform_admins !== 0 || row.migration_history !== 1) throw new Error(`Platform migration verification failed: ${JSON.stringify(row)}`);
  console.log("PLATFORM_MIGRATION=PASS");
  console.log("PLATFORM_ADMIN_AUTOCREATED=0");
} finally {
  await pool.close();
}
