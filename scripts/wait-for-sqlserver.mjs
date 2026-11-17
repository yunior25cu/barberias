import sql from "mssql";

const connection = process.env.DATABASE_URL ?? "";
const match = connection.match(/^sqlserver:\/\/(localhost|127\.0\.0\.1)(?::(\d+))?;(.*)$/i);
if (!match || !/(?:^|;)database=barber_local(?:;|$)/i.test(connection)) {
  throw new Error("SQL readiness probe requires local SQL Server database barber_local.");
}
if (connection.toLowerCase().includes("barberias.database.windows.net") || /(?:^|;)database=barber_sql(?:;|$)/i.test(connection)) {
  throw new Error("SQL readiness probe refuses the production Azure SQL database.");
}

const parameters = Object.fromEntries(match[3].split(";").filter(Boolean).map((item) => {
  const separator = item.indexOf("=");
  return separator < 0 ? [item.toLowerCase(), ""] : [item.slice(0, separator).toLowerCase(), item.slice(separator + 1)];
}));
if (!parameters.user || !parameters.password || parameters.encrypt?.toLowerCase() !== "true") {
  throw new Error("SQL readiness probe requires a local encrypted SQL-auth connection.");
}

const config = {
  server: match[1],
  port: Number(match[2] ?? 1433),
  database: "master",
  user: parameters.user,
  password: parameters.password,
  options: { encrypt: true, trustServerCertificate: parameters.trustservercertificate?.toLowerCase() === "true" },
  connectionTimeout: 5000,
  requestTimeout: 5000,
  pool: { min: 0, max: 1, idleTimeoutMillis: 1000 },
};

const deadline = Date.now() + 120_000;
let attempt = 0;
let lastCode = "not_connected";
while (Date.now() < deadline) {
  attempt += 1;
  let pool;
  try {
    pool = new sql.ConnectionPool(config);
    await pool.connect();
    await pool.request().query("SELECT 1 AS [ready]");
    console.log("SQL_SERVER_READY=PASS host=localhost database=barber_local");
    process.exitCode = 0;
    break;
  } catch (error) {
    lastCode = error?.code ?? error?.originalError?.code ?? error?.name ?? "unknown";
    const delay = Math.min(1000 + attempt * 500, 5000);
    console.log(`SQL Server not ready (${attempt}; code=${lastCode}); retrying in ${delay} ms.`);
    await new Promise((resolve) => setTimeout(resolve, delay));
  } finally {
    if (pool) await pool.close().catch(() => {});
  }
}

if (process.exitCode !== 0) {
  throw new Error(`SQL_SERVER_READY=FAIL after ${attempt} attempts (last code=${lastCode}).`);
}
