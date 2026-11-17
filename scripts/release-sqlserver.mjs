import { createHash, randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import sql from "mssql";

const mode = process.env.AZURE_SQL_AUTH_MODE ?? "sql";
let server = process.env.AZURE_SQL_SERVER;
let database = process.env.AZURE_SQL_DATABASE;
let authentication;
let user;
let password;
let port = 1433;
if (mode === "service-principal") {
  const { AZURE_SQL_CLIENT_ID: clientId, AZURE_SQL_CLIENT_SECRET: clientSecret, AZURE_SQL_TENANT_ID: tenantId } = process.env;
  if (!server || !database || !clientId || !clientSecret || !tenantId) throw new Error("Azure SQL server, database, and service-principal credentials are required.");
  authentication = { type: "azure-active-directory-service-principal-secret", options: { clientId, clientSecret, tenantId } };
} else if (mode === "sql") {
  const connection = process.env.DATABASE_URL ?? "";
  const parts = connection.split(";");
  const host = parts.shift()?.match(/^sqlserver:\/\/([^:]+)(?::(\d+))?$/i);
  const parameters = Object.fromEntries(parts.filter(Boolean).map(part => {
    const index = part.indexOf("=");
    return index < 0 ? [part, ""] : [part.slice(0, index).toLowerCase(), part.slice(index + 1)];
  }));
  if (!host?.[1] || !parameters.database || !parameters.user || !parameters.password || parameters.encrypt?.toLowerCase() !== "true") {
    throw new Error("SQL migration mode requires a SQL Server DATABASE_URL with user, password, and encryption.");
  }
  if (server && server.toLowerCase() !== host[1].toLowerCase() || database && database !== parameters.database) {
    throw new Error("DATABASE_URL does not match AZURE_SQL_SERVER/AZURE_SQL_DATABASE.");
  }
  server = host[1];
  port = Number(host[2] ?? 1433);
  database = parameters.database;
  user = parameters.user;
  password = parameters.password;
} else {
  throw new Error("Migrations support AZURE_SQL_AUTH_MODE=sql or service-principal.");
}

const pool = await new sql.ConnectionPool({
  server,
  port,
  database,
  ...(authentication ? { authentication } : {}),
  ...(mode === "sql" ? { user, password } : {}),
  options: { encrypt: true, trustServerCertificate: mode === "sql" && process.env.DATABASE_URL?.includes("trustServerCertificate=true") },
  connectionTimeout: 15000,
  requestTimeout: 60000,
}).connect();

try {
  const inventoryResult = await pool.request().query(`
    SELECT s.name AS [schema], t.name AS [table], CONVERT(varchar(20), SUM(p.rows)) AS [rows]
    FROM sys.tables AS t
    INNER JOIN sys.schemas AS s ON s.schema_id = t.schema_id
    INNER JOIN sys.partitions AS p ON p.object_id = t.object_id AND p.index_id IN (0, 1)
    GROUP BY s.name, t.name
    ORDER BY s.name, t.name;
  `);
  const inventory = inventoryResult.recordset;
  console.log("Azure SQL table inventory (names and row counts only):");
  console.log(JSON.stringify(inventory, null, 2));

  await pool.request().query(`
    IF OBJECT_ID(N'dbo._prisma_migrations', N'U') IS NULL
    BEGIN
      CREATE TABLE [dbo].[_prisma_migrations] (
        [id] VARCHAR(36) NOT NULL CONSTRAINT [PK__prisma_migrations] PRIMARY KEY,
        [checksum] VARCHAR(64) NOT NULL,
        [finished_at] DATETIMEOFFSET,
        [migration_name] NVARCHAR(500) NOT NULL,
        [logs] NVARCHAR(MAX),
        [rolled_back_at] DATETIMEOFFSET,
        [started_at] DATETIMEOFFSET NOT NULL,
        [applied_steps_count] INT NOT NULL
      );
    END;
  `);

  const migrationsPath = join(process.cwd(), "prisma", "migrations");
  const names = (await readdir(migrationsPath, { withFileTypes: true }))
    .filter(entry => entry.isDirectory())
    .map(entry => entry.name)
    .sort();
  const records = (await pool.request().query("SELECT [migration_name], [checksum], [finished_at], [rolled_back_at] FROM [dbo].[_prisma_migrations]")).recordset;
  const successful = records.filter(row => row.finished_at && !row.rolled_back_at);
  const unknownHistory = successful.filter(row => !names.includes(row.migration_name));
  if (unknownHistory.length) throw new Error(`Unknown migration history found: ${unknownHistory.map(row => row.migration_name).join(", ")}. Stop and reconcile before deployment.`);
  const untrackedTables = inventory.filter(row => row.table !== "_prisma_migrations");
  if (untrackedTables.length && successful.length === 0) {
    throw new Error("User tables exist without a completed SQL Server migration baseline. Stop and reconcile the current schema/data before applying the fresh initial migration.");
  }
  const incomplete = records.filter(row => !row.finished_at && !row.rolled_back_at);
  if (incomplete.length) throw new Error(`An incomplete migration exists (${incomplete.map(row => row.migration_name).join(", ")}); resolve it before deployment.`);

  for (const name of names) {
    const migrationSql = await readFile(join(migrationsPath, name, "migration.sql"), "utf8");
    const checksum = createHash("sha256").update(migrationSql).digest("hex");
    const existing = successful.find(row => row.migration_name === name);
    if (existing) {
      if (existing.checksum !== checksum) throw new Error(`Checksum mismatch for ${name}; stop and reconcile migration history.`);
      console.log(`Already applied: ${name}`);
      continue;
    }

    const id = randomUUID();
    await pool.request()
      .input("id", sql.VarChar(36), id)
      .input("checksum", sql.VarChar(64), checksum)
      .input("migrationName", sql.NVarChar(500), name)
      .input("startedAt", sql.DateTimeOffset, new Date())
      .query(`INSERT INTO [dbo].[_prisma_migrations] ([id],[checksum],[migration_name],[started_at],[applied_steps_count]) VALUES (@id,@checksum,@migrationName,@startedAt,0);`);

    const transaction = new sql.Transaction(pool);
    try {
      await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
      await transaction.request().batch(migrationSql);
      await transaction.request()
        .input("id", sql.VarChar(36), id)
        .input("finishedAt", sql.DateTimeOffset, new Date())
        .query(`UPDATE [dbo].[_prisma_migrations] SET [finished_at]=@finishedAt,[applied_steps_count]=1 WHERE [id]=@id;`);
      await transaction.commit();
      console.log(`Applied: ${name}`);
    } catch (error) {
      await transaction.rollback().catch(() => undefined);
      await pool.request()
        .input("id", sql.VarChar(36), id)
        .input("logs", sql.NVarChar(sql.MAX), error instanceof Error ? error.message.slice(0, 4000) : "Migration failed.")
        .query(`UPDATE [dbo].[_prisma_migrations] SET [logs]=@logs WHERE [id]=@id;`);
      throw error;
    }
  }
} finally {
  await pool.close();
}
