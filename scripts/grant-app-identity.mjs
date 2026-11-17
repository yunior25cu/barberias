import sql from "mssql";

const { AZURE_SQL_SERVER: server, AZURE_SQL_DATABASE: database, AZURE_SQL_CLIENT_ID: clientId, AZURE_SQL_CLIENT_SECRET: clientSecret, AZURE_SQL_TENANT_ID: tenantId, AZURE_SQL_APP_IDENTITY_NAME: identityName } = process.env;
if (!server || !database || !clientId || !clientSecret || !tenantId || !identityName) {
  throw new Error("Azure SQL, migration service-principal, and App Service identity settings are required.");
}
const pool = await new sql.ConnectionPool({
  server,
  port: 1433,
  database,
  authentication: { type: "azure-active-directory-service-principal-secret", options: { clientId, clientSecret, tenantId } },
  options: { encrypt: true, trustServerCertificate: false },
  connectionTimeout: 15000,
}).connect();
try {
  await pool.request()
    .input("identityName", sql.NVarChar(128), identityName)
    .query(`
      IF NOT EXISTS (SELECT 1 FROM sys.database_principals WHERE [name] = @identityName)
      BEGIN
        DECLARE @createUser nvarchar(max) = N'CREATE USER ' + QUOTENAME(@identityName) + N' FROM EXTERNAL PROVIDER;';
        EXEC sys.sp_executesql @createUser;
      END;
      IF NOT EXISTS (
        SELECT 1 FROM sys.database_role_members rm
        INNER JOIN sys.database_principals r ON r.principal_id = rm.role_principal_id AND r.name = N'db_datareader'
        INNER JOIN sys.database_principals u ON u.principal_id = rm.member_principal_id AND u.name = @identityName
      )
      BEGIN
        DECLARE @reader nvarchar(max) = N'ALTER ROLE [db_datareader] ADD MEMBER ' + QUOTENAME(@identityName) + N';';
        EXEC sys.sp_executesql @reader;
      END;
      IF NOT EXISTS (
        SELECT 1 FROM sys.database_role_members rm
        INNER JOIN sys.database_principals r ON r.principal_id = rm.role_principal_id AND r.name = N'db_datawriter'
        INNER JOIN sys.database_principals u ON u.principal_id = rm.member_principal_id AND u.name = @identityName
      )
      BEGIN
        DECLARE @writer nvarchar(max) = N'ALTER ROLE [db_datawriter] ADD MEMBER ' + QUOTENAME(@identityName) + N';';
        EXEC sys.sp_executesql @writer;
      END;
    `);
  console.log("App Service managed identity has least-privilege read/write database roles.");
} finally {
  await pool.close();
}
