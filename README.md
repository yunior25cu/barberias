# Al Corte

Aplicación web móvil para reservas de una peluquería. Next.js contiene las páginas y la API; Prisma usa SQL Server. WhatsApp se abre únicamente mediante enlaces `wa.me` iniciados por la persona.

## Requisitos

- Node.js 22 LTS o superior, compatible con Next.js 16.
- Docker Desktop para SQL Server 2022 Developer local.
- Azure SQL Database para producción.

## Inicio local

1. Copiá `.env.example` a `.env`. Configurá contraseñas locales, `SESSION_SECRET` aleatorio de 32 caracteres o más y el usuario administrador.
2. Ejecutá `npm run db:local`. Inicia SQL Server, crea `barber_local` solo si no existe, inspecciona sus tablas y aplica migraciones.
3. Instalá dependencias con `npm ci --legacy-peer-deps`.
4. Creá el administrador local con `npm run db:seed`.
5. Ejecutá `npm run dev` y abrí <http://localhost:3000>.

La base SQL local usa el volumen `alcorte_sql`. El inicializador no elimina ni reemplaza su contenido. En producción no se cargan datos de ejemplo.

## Comandos

| Comando | Acción |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript estricto |
| `npm test` | Unitarias e integración concurrente si `RUN_DB_TESTS=1` |
| `npm run test:e2e` | Flujos HTTP y navegador con Playwright |
| `npm run build` | Prisma Client y build de producción standalone |
| `npm run db:inspect` | Lista tablas/conteos; bloquea tablas sin historial de migración SQL Server reconocido |
| `npm run db:local` | Prepara e inspecciona `barber_local`, luego aplica migraciones |
| `npm run db:release` | Inspecciona Azure SQL y aplica archivos migratorios con el principal de servicio Entra |
| `npm run db:deploy` | Aplica migraciones Prisma SQL Server |
| `npm run db:seed` | Provisiona el administrador y opcionalmente datos locales de muestra |

## Concurrencia

Las escrituras de reservas y bloqueos usan `sp_getapplock` con propietario `Transaction`. La migración instala además un trigger de `Occupancy` que toma el mismo lock y rechaza intervalos que se solapan. Los intervalos son semiabiertos `[inicio, fin)`, de modo que dos turnos contiguos son válidos. Las pruebas reales de base y HTTP corren en CI sobre SQL Server.

Para correr la prueba de integración en PowerShell: `$env:RUN_DB_TESTS="1"; npm test`. Para preparar Chromium: `npx playwright install chromium`.

## Configuración segura y producción

`DATABASE_URL`, `SESSION_SECRET`, `ADMIN_USERNAME` y `ADMIN_PASSWORD` son secretos del entorno y nunca van a Git. La cadena de conexión debe usar cifrado. El endpoint `/api/health` comprueba la base sin exponer detalles.

GitHub Actions ejecuta auditoría, inspección de base, migraciones, pruebas, E2E y build. El despliegue es manual desde `main`, protegido por el entorno `production` y condicionado a todos los gates verdes. Antes de aplicar migraciones en `barber_sql`, el workflow imprime los nombres y conteos de tablas; se detiene ante tablas de aplicación existentes.

La sesión actual no puede leer `barber_sql`: está pausada y el servidor SQL tiene acceso público deshabilitado, sin endpoint privado accesible desde el runner. El despliegue y la migración remota quedan bloqueados hasta disponer de una ruta de acceso autorizada y completar la inspección.

## Documentación

- [Arquitectura](docs/ARQUITECTURA.md)
- [Privacidad y datos](docs/DATOS-Y-PRIVACIDAD.md)
- [Despliegue](docs/DESPLIEGUE.md)
- [Operación y respaldos](docs/OPERACION-Y-RESPALDOS.md)
- [Guía del dueño y WhatsApp Business](docs/GUIA-DUENO.md)
- [Estado de gates](docs/ESTADO.md)
