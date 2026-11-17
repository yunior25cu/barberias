# Despliegue

Next.js serves the public pages, admin panel, and APIs in one Linux App Service. The build produces `output: standalone` for a reproducible Node package.

GitHub Actions runs all gates on isolated SQL Server. Production deployment is manual from `main`, follows the passing quality job, and uses the protected GitHub environment `production`. Before applying SQL, the workflow lists table names and row counts and stops if an unrecognized application schema is present. It then applies the SQL migration files, provisions the admin without demo data, grants the App Service identity data access, and deploys the standalone artifact.

## GitHub production environment

- Secrets: `SESSION_SECRET`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID`.
- Variables: `AZURE_WEBAPP_NAME`, `AZURE_RESOURCE_GROUP`, `AZURE_SQL_SERVER`, `AZURE_SQL_DATABASE`, `APP_URL`.
- `DATABASE_URL` contains only SQL host, database, and encryption settings; it carries no SQL password. The App Service uses its managed identity for runtime access. The GitHub service principal authenticates migrations and administrator provisioning; an Entra administrator must map it in Azure SQL and grant `db_ddladmin`, `db_datareader`, and `db_datawriter`.
- The workflow assigns the App Service identity only `db_datareader` and `db_datawriter`.
- Secrets are injected into App Service settings and never stored in Git.

## Current production gate

Al Corte has no App Service yet. Azure SQL `barber_sql` is paused, and `barberias.database.windows.net` has `publicNetworkAccess=Disabled`; no private endpoint was found. No hosting was created and nothing was deployed. A permitted network route must be established first. Then inspect the live schema/data and run all gates before production deployment.
