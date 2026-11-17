import { PrismaClient } from "@prisma/client";
import { readdir } from "node:fs/promises";
import { join } from "node:path";

const db = new PrismaClient();
try {
  const tables = await db.$queryRaw`
    SELECT s.name AS [schema], t.name AS [table], CONVERT(varchar(20), SUM(p.rows)) AS [rows]
    FROM sys.tables AS t
    INNER JOIN sys.schemas AS s ON s.schema_id = t.schema_id
    INNER JOIN sys.partitions AS p ON p.object_id = t.object_id AND p.index_id IN (0, 1)
    GROUP BY s.name, t.name
    ORDER BY s.name, t.name;
  `;
  console.log("SQL Server user-table inventory (names and row counts only):");
  console.log(JSON.stringify(tables, null, 2));
  const applicationTables = tables.filter(table => table.table !== "_prisma_migrations");
  const migrationTable = await db.$queryRaw`SELECT OBJECT_ID(N'dbo._prisma_migrations', N'U') AS [id]`;
  const names = new Set((await readdir(join(process.cwd(), "prisma", "migrations"), { withFileTypes: true }))
    .filter(entry => entry.isDirectory()).map(entry => entry.name));
  const history = migrationTable[0].id == null ? [] : await db.$queryRaw`SELECT [migration_name], [finished_at], [rolled_back_at] FROM [dbo].[_prisma_migrations]`;
  const recognizedHistory = history.some(row => names.has(row.migration_name) && row.finished_at && !row.rolled_back_at);
  if (applicationTables.length && !recognizedHistory) {
    console.error("STOP: application tables exist without a completed migration from this SQL Server history. Reconcile the current schema/data before applying the fresh initial migration.");
    process.exitCode = 2;
  } else if (applicationTables.length) {
    console.log("Existing application tables have a completed migration in this SQL Server history; continuing with the migration deploy check.");
  } else {
    console.log("No application tables exist; safe to evaluate the fresh initial migration.");
  }
} finally {
  await db.$disconnect();
}
