import { spawnSync } from "node:child_process";
import bcrypt from "bcryptjs";
import sql from "mssql";

const connection = process.env.DATABASE_URL ?? "";
if (process.env.CI !== "true" || !/^sqlserver:\/\/(localhost|127\.0\.0\.1)(:\d+)?;database=barber_local;/i.test(connection)) throw new Error("Platform-admin bootstrap test is restricted to disposable SQL Server barber_local.");
const [, server, portText] = connection.match(/^sqlserver:\/\/([^:]+)(?::(\d+))?/i) ?? [];
const values = Object.fromEntries(connection.split(";").slice(1).filter(Boolean).map(part => { const at = part.indexOf("="); return [part.slice(0, at).toLowerCase(), part.slice(at + 1)]; }));
const username = "platform-bootstrap-ci";
const firstPassword = "CI-only-platform-pass-2026!";
const ignoredPassword = "CI-only-platform-other-2026!";
const recoveredPassword = "CI-only-platform-recover-2026!";
const pool = await new sql.ConnectionPool({ server, port: Number(portText ?? 1433), database: values.database, user: values.user, password: values.password, options: { encrypt: true, trustServerCertificate: values.trustservercertificate === "true" }, connectionTimeout: 15000, requestTimeout: 30000 }).connect();

function run(action, password) {
  const result = spawnSync(process.execPath, ["scripts/platform-admin.mjs"], { cwd: process.cwd(), encoding: "utf8", env: { ...process.env, PLATFORM_ADMIN_ACTION: action, PLATFORM_ADMIN_USERNAME: username, PLATFORM_ADMIN_PASSWORD: password } });
  if (result.status !== 0) throw new Error(`Platform-admin ${action} command failed with exit code ${result.status}.`);
  return result.stdout;
}

try {
  const before = await pool.request().input("username", sql.NVarChar(100), username).query("SELECT id FROM dbo.PlatformAdmin WHERE username=@username;");
  if (before.recordset.length) throw new Error("Disposable test administrator already exists; refusing to modify it.");
  run("bootstrap", firstPassword);
  const original = (await pool.request().input("username", sql.NVarChar(100), username).query("SELECT id,passwordHash,sessionVersion,active FROM dbo.PlatformAdmin WHERE username=@username;")).recordset[0];
  if (!original || !await bcrypt.compare(firstPassword, original.passwordHash) || !original.active || original.sessionVersion !== 1) throw new Error("Bootstrap did not create the expected active owner.");
  run("bootstrap", ignoredPassword);
  const repeated = (await pool.request().input("id", sql.NVarChar(40), original.id).query("SELECT passwordHash,sessionVersion,active FROM dbo.PlatformAdmin WHERE id=@id;")).recordset[0];
  if (repeated.passwordHash !== original.passwordHash || repeated.sessionVersion !== original.sessionVersion || !repeated.active) throw new Error("A repeated bootstrap changed credentials, status, or session version.");
  run("recover", recoveredPassword);
  const recovered = (await pool.request().input("id", sql.NVarChar(40), original.id).query("SELECT passwordHash,sessionVersion,active FROM dbo.PlatformAdmin WHERE id=@id;")).recordset[0];
  if (!await bcrypt.compare(recoveredPassword, recovered.passwordHash) || recovered.sessionVersion !== original.sessionVersion + 1 || !recovered.active) throw new Error("Recovery did not rotate the password and invalidate prior sessions.");
  const audit = await pool.request().input("actorId", sql.NVarChar(40), original.id).query("SELECT action,changesJson FROM dbo.PlatformAudit WHERE actorId=@actorId ORDER BY createdAt;");
  if (audit.recordset.length !== 2 || audit.recordset.some(row => /password|secret|token/i.test(row.changesJson ?? ""))) throw new Error("Bootstrap/recovery audit is missing or contains sensitive values.");
  console.log("PLATFORM_ADMIN_BOOTSTRAP_RECOVERY=PASS");
} finally {
  const owner = await pool.request().input("username", sql.NVarChar(100), username).query("SELECT id FROM dbo.PlatformAdmin WHERE username=@username;");
  if (owner.recordset[0]) {
    await pool.request().input("actorId", sql.NVarChar(40), owner.recordset[0].id).query("DELETE FROM dbo.PlatformAudit WHERE actorId=@actorId;");
    await pool.request().input("id", sql.NVarChar(40), owner.recordset[0].id).query("DELETE FROM dbo.PlatformAdmin WHERE id=@id;");
  }
  await pool.close();
}
