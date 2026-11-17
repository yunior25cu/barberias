const connection = process.env.DATABASE_URL ?? "";
const lowerConnection = connection.toLowerCase();
const mode = process.env.AZURE_SQL_AUTH_MODE ?? "sql";

if (lowerConnection.includes("barberias.database.windows.net") || lowerConnection.includes("database=barber_sql")) {
  throw new Error("CI database guard rejected the production Azure SQL target.");
}

if (!/^sqlserver:\/\/(localhost|127\.0\.0\.1)(:\d+)?;database=barber_local;/i.test(connection)) {
  throw new Error("CI database guard requires localhost SQL Server database barber_local.");
}

if (mode !== "sql") {
  throw new Error("CI database guard requires SQL authentication for the disposable local SQL Server.");
}

if (["AZURE_SQL_CLIENT_ID", "AZURE_SQL_CLIENT_SECRET", "AZURE_SQL_TENANT_ID"].some((name) => process.env[name])) {
  throw new Error("CI database guard refuses Azure SQL service-principal credentials.");
}

const configuredAzureServer = process.env.AZURE_SQL_SERVER?.toLowerCase();
if (configuredAzureServer && configuredAzureServer !== "localhost" && configuredAzureServer !== "127.0.0.1") {
  throw new Error("CI database guard rejected a non-local AZURE_SQL_SERVER value.");
}

console.log("CI_DATABASE_TARGET=PASS host=localhost database=barber_local; Azure SQL is prohibited.");
