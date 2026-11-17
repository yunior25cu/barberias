# Al Corte

Aplicación web móvil primero para reservas de una peluquería. Agenda y reservas son la fuente principal de verdad. WhatsApp solo se abre mediante enlace estándar cuando la persona elige enviarlo; no se integra Cloud API ni se mandan mensajes automáticamente.

## Requisitos

- Node.js 22 LTS o superior compatible con Next.js 16.
- PostgreSQL 14 o superior (la migración usa `btree_gist` y restricciones de exclusión). Compose publica el puerto local `55439` para evitar choques con instalaciones/servicios PostgreSQL del equipo.
- Docker Desktop opcional para iniciar PostgreSQL local.

## Inicio local

1. Copiá `.env.example` a `.env` y configurá una contraseña de administrador de al menos 14 caracteres y un `SESSION_SECRET` aleatorio de 32 caracteres o más.
2. Iniciá la base: `docker compose up -d db`.
3. Instalá dependencias: `npm ci`.
4. Aplicá esquema: `npm run db:deploy` (o `npm run db:migrate` durante desarrollo).
5. Creá el administrador y los datos de ejemplo locales: `npm run db:seed`.
6. Iniciá la aplicación: `npm run dev`; abrí <http://localhost:3000>.

Los datos de ejemplo solo se agregan con `SEED_DEMO_DATA=true` fuera de producción. No existe contraseña predeterminada. Cambiá la muestra por los servicios, profesionales y horarios reales desde la configuración antes de publicar.

## Comandos

| Comando | Acción |
|---|---|
| `npm run dev` | Desarrollo |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript estricto |
| `npm test` | Unit tests; PostgreSQL concurrency suite is skipped unless explicitly enabled |
| `npm run test:e2e` | Playwright |
| `npm run build` | Genera Prisma Client y build de producción |
| `npm run db:deploy` | Aplica migraciones existentes |
| `npm run db:seed` | Provisiona admin desde variables y muestra opcional |

## Configuración segura

`DATABASE_URL`, `SESSION_SECRET`, `ADMIN_USERNAME` y `ADMIN_PASSWORD` son secretos/configuración del entorno. Nunca subas `.env`. Producción requiere HTTPS, `NODE_ENV=production`, copias cifradas y una clave de sesión distinta por entorno. El endpoint `/api/health` comprueba conexión de base sin exponer detalles.

## Arquitectura y operación

- [Arquitectura y decisiones](docs/ARQUITECTURA.md)
- [Privacidad y datos](docs/DATOS-Y-PRIVACIDAD.md)
- [Despliegue](docs/DESPLIEGUE.md)
- [Respaldos y recuperación](docs/OPERACION-Y-RESPALDOS.md)
- [Guía del dueño y WhatsApp Business](docs/GUIA-DUENO.md)
- [Estado por fase y evidencia](docs/ESTADO.md)

## Pruebas de integración y E2E

Las pruebas de concurrencia se restringen a `localhost`/`127.0.0.1` y la base `alcorte`. Iniciá Postgres y ejecutá `npm run db:deploy`; en PowerShell, habilitá la prueba con `$env:RUN_DB_TESTS="1"; npm test`. La restricción `Occupancy.occupancy_no_overlap` combina profesional e intervalo semiabierto `[inicio, fin)`, por lo que la base rechaza superposiciones incluso ante carreras. Para E2E instalá el navegador una vez con `npx playwright install chromium`. Los E2E crean fixtures locales, recorren reserva móvil, login admin y operaciones de agenda, y eliminan esos fixtures al terminar. No los apuntes a datos reales.
