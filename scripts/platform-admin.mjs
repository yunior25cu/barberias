import { randomUUID } from "node:crypto";
import { execSync } from "node:child_process";
import bcrypt from "bcryptjs";
import sql from "mssql";

if (process.argv.length > 2) throw new Error("Do not pass credentials or actions as command-line arguments; use environment variables.");
const action = process.env.PLATFORM_ADMIN_ACTION;
const username = process.env.PLATFORM_ADMIN_USERNAME?.trim().toLowerCase();
const password = process.env.PLATFORM_ADMIN_PASSWORD;
if (!new Set(["bootstrap", "recover"]).has(action)) throw new Error("Set PLATFORM_ADMIN_ACTION to bootstrap or recover.");
if (!username || username.length > 100 || /[\r\n]/.test(username)) throw new Error("Set a valid PLATFORM_ADMIN_USERNAME in the environment.");
if (!password || password.length < 14 || password.length > 200) throw new Error("Set PLATFORM_ADMIN_PASSWORD to a private password of 14 to 200 characters.");

const mode = process.env.AZURE_SQL_AUTH_MODE ?? "sql";
let server = process.env.AZURE_SQL_SERVER;
let database = process.env.AZURE_SQL_DATABASE;
let authentication;
let user;
let sqlPassword;
let port = 1433;
if (mode === "sql") {
  const [hostText, ...parts] = (process.env.DATABASE_URL ?? "").split(";");
  const host = hostText?.match(/^sqlserver:\/\/([^:]+)(?::(\d+))?$/i);
  const values = Object.fromEntries(parts.filter(Boolean).map(item => { const at = item.indexOf("="); return [item.slice(0, at).toLowerCase(), item.slice(at + 1)]; }));
  if (!host?.[1] || !values.database || !values.user || !values.password || values.encrypt?.toLowerCase() !== "true") throw new Error("SQL auth requires an encrypted SQL Server DATABASE_URL.");
  if (server && server.toLowerCase() !== host[1].toLowerCase() || database && database !== values.database) throw new Error("DATABASE_URL does not match the configured Azure SQL destination.");
  server = host[1]; port = Number(host[2] ?? 1433); database = values.database; user = values.user; sqlPassword = values.password;
} else if (mode === "azure-cli") {
  if (!server || !database) throw new Error("Azure CLI auth requires AZURE_SQL_SERVER and AZURE_SQL_DATABASE.");
  const accessToken = execSync("az account get-access-token --resource https://database.windows.net/ --query accessToken --output tsv", { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  authentication = { type: "azure-active-directory-access-token", options: { token: accessToken } };
} else if (mode === "service-principal") {
  const { AZURE_SQL_CLIENT_ID: clientId, AZURE_SQL_CLIENT_SECRET: clientSecret, AZURE_SQL_TENANT_ID: tenantId } = process.env;
  if (!server || !database || !clientId || !clientSecret || !tenantId) throw new Error("Service principal SQL configuration is incomplete.");
  authentication = { type: "azure-active-directory-service-principal-secret", options: { clientId, clientSecret, tenantId } };
} else throw new Error("AZURE_SQL_AUTH_MODE must be sql, azure-cli, or service-principal.");
if (!server || !database) throw new Error("SQL Server and database must be configured.");

const pool = await new sql.ConnectionPool({ server, port, database, ...(authentication ? { authentication } : {}), ...(mode === "sql" ? { user, password: sqlPassword } : {}), options: { encrypt: true, trustServerCertificate: mode === "sql" && (process.env.DATABASE_URL ?? "").includes("trustServerCertificate=true") }, connectionTimeout: 15000, requestTimeout: 30000 }).connect();
try {
  const tx = new sql.Transaction(pool);
  await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
  try {
    const lock = await new sql.Request(tx).input("resource", sql.NVarChar(255), `AlCorte:PlatformAdmin:${username}`).query(`DECLARE @r int; EXEC @r=sys.sp_getapplock @Resource=@resource,@LockMode='Exclusive',@LockOwner='Transaction',@LockTimeout=15000; SELECT @r AS result;`);
    if (lock.recordset[0].result < 0) throw new Error("Could not acquire the platform-admin lock.");
    const found = await new sql.Request(tx).input("username", sql.NVarChar(100), username).query("SELECT id,active FROM dbo.PlatformAdmin WHERE username=@username;");
    const passwordHash = await bcrypt.hash(password, 12);
    if (action === "bootstrap") {
      if (found.recordset.length) {
        await tx.rollback();
        console.log("PLATFORM_ADMIN_BOOTSTRAP=NO_CHANGE (account already exists; use the explicit recovery action if needed)");
      } else {
        const id = randomUUID();
        await new sql.Request(tx).input("id", sql.NVarChar(40), id).input("username", sql.NVarChar(100), username).input("passwordHash", sql.NVarChar(255), passwordHash).query("INSERT INTO dbo.PlatformAdmin(id,username,passwordHash,active,sessionVersion,createdAt,updatedAt) VALUES(@id,@username,@passwordHash,1,1,SYSDATETIMEOFFSET(),SYSDATETIMEOFFSET());");
        await new sql.Request(tx).input("id", sql.NVarChar(40), randomUUID()).input("actorId", sql.NVarChar(40), id).query("INSERT INTO dbo.PlatformAudit(id,actorId,businessId,action,result,changesJson,createdAt) VALUES(@id,@actorId,NULL,N'platform_admin.bootstrapped',N'success',N'{\"active\":true}',SYSDATETIMEOFFSET());");
        await tx.commit();
        console.log("PLATFORM_ADMIN_BOOTSTRAP=PASS");
      }
    } else {
      if (!found.recordset.length) throw new Error("The platform administrator does not exist; bootstrap it explicitly first.");
      const updated = await new sql.Request(tx).input("id", sql.NVarChar(40), found.recordset[0].id).input("passwordHash", sql.NVarChar(255), passwordHash).query("UPDATE dbo.PlatformAdmin SET passwordHash=@passwordHash, active=1, sessionVersion=sessionVersion+1, updatedAt=SYSDATETIMEOFFSET() OUTPUT inserted.sessionVersion WHERE id=@id;");
      await new sql.Request(tx).input("id", sql.NVarChar(40), randomUUID()).input("actorId", sql.NVarChar(40), found.recordset[0].id).input("changes", sql.NVarChar(500), JSON.stringify({ active: { from: Boolean(found.recordset[0].active), to: true }, sessionVersion: updated.recordset[0].sessionVersion })).query("INSERT INTO dbo.PlatformAudit(id,actorId,businessId,action,result,changesJson,createdAt) VALUES(@id,@actorId,NULL,N'platform_admin.recovered',N'success',@changes,SYSDATETIMEOFFSET());");
      await tx.commit();
      console.log("PLATFORM_ADMIN_RECOVERY=PASS");
    }
  } catch (cause) {
    if (tx._aborted !== true) await tx.rollback().catch(() => undefined);
    throw cause;
  }
} finally {
  await pool.close();
}
