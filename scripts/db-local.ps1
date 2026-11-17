$ErrorActionPreference = 'Stop'

$envFile = Join-Path (Get-Location) '.env'
if (-not (Test-Path -LiteralPath $envFile)) { throw 'Create .env from .env.example and set DATABASE_URL and MSSQL_SA_PASSWORD first.' }
$envLines = Get-Content -LiteralPath $envFile
foreach ($line in $envLines) {
  if ($line -match '^MSSQL_SA_PASSWORD=(.+)$') { $env:MSSQL_SA_PASSWORD = $Matches[1].Trim('"') }
  if ($line -match '^DATABASE_URL=(.+)$') { $env:DATABASE_URL = $Matches[1].Trim('"') }
}
if (-not $env:MSSQL_SA_PASSWORD) { throw 'MSSQL_SA_PASSWORD is required in .env.' }
if ($env:DATABASE_URL -notmatch '^sqlserver://(localhost|127\.0\.0\.1)(:\d+)?;database=barber_local;') {
  throw 'Refusing to initialize: DATABASE_URL must target local database barber_local.'
}

docker compose up -d db
if ($LASTEXITCODE -ne 0) { throw 'Could not start the local SQL Server container.' }
node scripts/wait-for-sqlserver.mjs
if ($LASTEXITCODE -ne 0) { throw 'Local SQL Server did not accept a real SQL query within the readiness timeout.' }

node scripts/create-local-sqlserver-db.mjs
if ($LASTEXITCODE -ne 0) { throw 'Could not inspect/create local barber_local database.' }
npm run db:inspect
if ($LASTEXITCODE -ne 0) { throw 'Local barber_local contains an untracked schema; inspect and reconcile it before migrating.' }
npx prisma migrate deploy
if ($LASTEXITCODE -ne 0) { throw 'Prisma migration deployment failed.' }
