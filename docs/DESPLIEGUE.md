# Despliegue

Al Corte usa Next.js App Router, React, TypeScript y Prisma en modo Next.js Hybrid sobre la Static Web App existente `barberweb`, en el grupo `barberias`. El dominio canónico público es `https://reservas.balaxys.com`; Azure confirmó el dominio personalizado en estado `Ready` el 17 de noviembre de 2026. El hostname predeterminado de Azure identifica el mismo recurso, pero las direcciones públicas y los enlaces generados deben usar el dominio canónico.

La aplicación está vinculada al repositorio `yunior25cu/barberias` y la rama `main`. El workflow `.github/workflows/azure-static-web-apps-gentle-sky-060525010.yml` conserva `app_location: "/"`, `api_location: ""` y `output_location: ""`, y espera los quality gates antes de desplegar. No crear otra Static Web App ni exportar el sitio de forma estática: Next.js SSR y los Route Handlers son parte del runtime.

## Configuración de entorno

Los application settings se guardan en Azure Static Web Apps, fuera de Git. `APP_URL` debe ser `https://reservas.balaxys.com`; el runtime lo usa para generar enlaces de activación y validar el origen. La configuración productiva incluye la conexión/autenticación de Azure SQL y `SESSION_SECRET`. No mostrar ni versionar sus valores. Las credenciales de los administradores se gestionan mediante bootstrap explícito y no se mantienen como settings permanentes.

El endpoint `https://reservas.balaxys.com/api/health` respondió `200` con `database: ok` durante la validación del dominio. La base `barber_sql` usa SQL Server serverless General Purpose con límite Free y comportamiento `AutoPause`; no cambiar el nivel ni habilitar overage como parte de un despliegue.

## Base y release

Antes de aplicar migraciones, inspeccionar inventario, conteos, historial y checksums. `npm run db:release` rechaza tablas o migraciones no reconocidas y aplica únicamente las migraciones pendientes. La migración `20261119000000_platform_panel` quedó aplicada y el administrador de plataforma fue aprovisionado y validado mediante login y sesión HTTPS.

El flujo productivo es: push a `main` → quality gates; luego workflow dispatch de Static Web Apps con `confirm_production=true` → build y deployment. No desplegar saltando GitHub Actions. Confirmar el SHA, estado del deployment y health check por el dominio canónico.

## Inventario de URLs

- Dominio canónico de aplicación y enlaces absolutos: `https://reservas.balaxys.com`.
- Reserva de Al Corte: `/al-corte/reservar`.
- Administración de Al Corte: `/al-corte/admin`.
- Panel de plataforma: `/plataforma`.
- Los negocios usan enlaces relativos `/{slug}/reservar` y `/{slug}/admin`; no incluir el hostname de Azure en código.
- El hostname predeterminado de Azure puede seguir resolviendo al mismo recurso, pero no se usa para compartir enlaces ni generar activaciones.
