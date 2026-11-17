# Estado de implementación

Actualizado: 2026-11-17

## Fase 0 — Inspección y plan

**PHASE_0=PASS**

- La carpeta inicial tenía solo `PROMT MAETSTRO AL CORTE.md`; se leyó completo y se conservó.
- Node 22.22.0, npm 10.9.4, Git 2.49.0 y Docker 29.8.0 disponibles.
- El puerto 5432 ya estaba usado por PostgreSQL del equipo; Compose publica su DB de desarrollo en 55439 para no interferir.
- Stack fijado en `package.json`/lockfile: Next.js 16.4.6, React 19.3.1, TypeScript 5.9.3, Prisma 6.19.3, PostgreSQL 17.12, Vitest 4.0.8 y Playwright 1.56.1.

## Fase 1 — Base técnica y diseño

**PHASE_1=PASS**

- Next App Router, TypeScript estricto, ESLint, configuración de entorno, cabeceras de seguridad, CSP de producción, logs JSON con request ID y `/api/health`.
- Dos migraciones Prisma aplicadas correctamente al PostgreSQL local. La primera crea el modelo relacional y la restricción de exclusión GiST; la segunda añade moneda configurable.
- `docker compose up -d db` inicia PostgreSQL. Instalación, lint, tipado, pruebas y build están documentados.
- Verificación: `npx prisma validate` PASS; `npm run db:deploy` PASS (2 migraciones); `npm run build` PASS.

## Fase 2 — Configuración y admin

**PHASE_2=PASS para el alcance implementado**

- Login admin con bcrypt, cookie HttpOnly/SameSite Strict, Secure en producción y limitador persistente de intentos.
- Panel protegido con agenda diaria/semanal, reserva manual, mover/reasignar, cancelar, completar y no-show.
- ABM de servicios (nombre, duración, precio, activar/pausar); equipo y servicios por profesional; horarios semanales/cierres; pausas/bloqueos; configuración de negocio, moneda, anticipación y granularidad.
- Enlace público y texto de bienvenida copiables desde ajustes. La interfaz explica que WhatsApp Business App se configura a mano y decide cuándo muestra el saludo.
- E2E móvil comprobó acceso anónimo rechazado, login, servicio/equipo, horario, bloqueo, reserva manual y movimiento.

## Fase 3 — Reserva pública y concurrencia

**PHASE_3=PASS para los flujos cubiertos**

- Flujo de cuatro pasos sin cuenta, selección opcional de profesional o “Cualquier profesional disponible”, teléfono normalizado, consentimiento, duración real y hora de Montevideo.
- Persistencia transaccional, clave idempotente y constraint PostgreSQL de intervalos semiabiertos sobre cada profesional. Reserva y bloqueos compiten por el mismo recurso.
- Token de gestión aleatorio de 256 bits almacenado como hash; cancelación y reprogramación sin token en URL. Enlace `wa.me` manual, sin envío automatizado.
- Evidencia de concurrencia real: dos transacciones simultáneas para el mismo recurso/período; exactamente una reservó.
- E2E en viewport iPhone recorrió reserva, reprogramación y cancelación.

## Fase 4 — Agenda y operaciones

**PHASE_4=PASS para el alcance del MVP especificado**

- Agenda de día/semana, tareas manuales, cambios de estado, movimiento/reasignación y bloqueos modifican la misma fuente de verdad que usa la disponibilidad pública.
- Pruebas E2E también verifican la configuración administrativa necesaria para operar la agenda.

## Fase 5 — Endurecimiento y producción

**PHASE_5=NOT PASS — endurecimiento parcial**

- Incluido: validación de servidor con Zod, rate limits de disponibilidad/reservas/login/gestión, cookies seguras, cabeceras/CSP, logs sin PII, health check, auditoría `npm audit` sin vulnerabilidades.
- Backup/restauración probada localmente: `pg_dump -Fc`, restauración en base temporal y confirmación de 11 tablas y `occupancy_no_overlap`; base temporal y dump eliminados al terminar.
- Pendiente: matriz amplia de pruebas de abuso/CSRF/tokens, revisión manual WCAG/teclado/contraste, retención automatizada de datos, monitoreo/alertas y simulacro de caída/rollback en entorno de despliegue.

## Fase 6 — Despliegue y entrega

**PHASE_6=NOT PASS — no hay entorno externo autorizado/configurado**

- README y guía de despliegue están preparados; no se inventó dominio, proveedor ni credenciales y no se publicó la aplicación.
- Para completar esta fase hace falta elegir/proveer el host PostgreSQL/Node, dominio y secretos de producción. El sistema sí puede ejecutarse localmente.

## Verificación consolidada más reciente

- `npm run lint`: PASS, sin advertencias.
- `npm run typecheck`: PASS.
- `npm test` con `RUN_DB_TESTS=1` y PostgreSQL local: 6 PASS (5 unitarias + 1 integración de concurrencia).
- `npm run test:e2e`: 2 PASS en Chromium con emulación de iPhone.
- `npm run build`: PASS.
- `npm audit`: 0 vulnerabilidades.
- `npx prisma validate` y `npm run db:deploy`: PASS; 2 migraciones aplicadas.

## Criterio global

**AL_CORTE_MVP=NOT PASS** hasta terminar Fase 5 y desplegar de forma autorizada en Fase 6. La agenda, el flujo móvil y la protección contra dobles reservas tienen evidencia real local; no hay URL de producción ni alertas operativas.

## Auditoría de publicación y despliegue — 2026-11-17

**AL_CORTE_PRODUCTION=NOT PASS.** No se publicó código ni se modificó infraestructura productiva.

- `AZURE_SUBSCRIPTION_VERIFIED=PASS`: la suscripción activa coincide con `d7752f9c-fd50-4d17-baa2-2168e2a26d52` y el tenant esperado.
- El grupo `barberias` contiene el servidor SQL `barberias` y la base `barber_sql`; las consultas de App Service y Static Web Apps no devolvieron recursos. No hay destinos de frontend/backend provisionados allí.
- `barber_sql` reporta `useFreeLimit=true`, `freeLimitExhaustionBehavior=AutoPause`, nivel General Purpose serverless Gen5 de 2 vCores y estado `Paused`. La retención de backups de largo plazo está desactivada. No se intentó conectar/despertar la base ni se verificaron sus tablas, datos o conectividad.
- Incompatibilidad de plataforma: este repositorio es Next.js + Prisma + PostgreSQL; no contiene proyectos .NET, React/Vite, EF Core ni migraciones SQL Server. No se aplicaron migraciones a Azure SQL.
- El repositorio GitHub indicado existe, es público y está vacío (`main`); la conexión GitHub disponible informa `push=false`. El repositorio local no tiene remoto configurado y su rama es `master`. No se intentó publicar.
- No existen workflows de GitHub Actions. El barrido de secretos no encontró tokens ni claves privadas; no existe `.env` versionado y `.env.example` contiene solo marcadores de configuración.
- Tras `npm ci`, `npm run lint`, `npm run typecheck`, `npm test` (6 pruebas), `npm run build` y `npm run test:e2e` (2 pruebas) pasaron. La auditoría actual de npm reportó 6 avisos (1 crítico, 4 altos, 1 moderado); se dejan para la fase de endurecimiento pendiente, sin aplicar actualizaciones.
- `LOCAL_RELEASE_VALIDATION=NOT PASS` para el destino indicado: faltan todos los proyectos y pruebas .NET/EF Core requeridos y el análisis de dependencias presenta avisos pendientes.
- `GITHUB_MAIN_PUSH=NOT PASS`; `DATABASE_MIGRATION=NOT RUN`; `PRE_MIGRATION_RECOVERY_CHECK=NOT PASS`; `BACKEND_DEPLOYMENT=NOT RUN`; `FRONTEND_DEPLOYMENT=NOT RUN`; `CI/CD=NOT CONFIGURADO`.
- No se crearon recursos, no se cambió el nivel ni el comportamiento de facturación de SQL y no se configuró una API paga de WhatsApp.

Para continuar esta fase hace falta resolver el destino de despliegue: alinear el proyecto con Azure SQL + .NET/React/Vite, o confirmar un hosting compatible con la arquitectura existente; habilitar escritura al repo GitHub; y provisionar los destinos frontend/backend requeridos. El endurecimiento de seguridad permanece diferido según la instrucción del usuario.

## Fase Azure SQL y preparacion de produccion - 2026-11-17 (actualiza el estado anterior)

- Decision confirmada: `ARCHITECTURE_DECISION=KEEP_NEXTJS_AND_ADAPT_DATABASE`.
- `barber_local` en SQL Server Express se inspecciono antes de migrar: estaba `ONLINE` y sin tablas. `prisma migrate deploy` aplico la migracion SQL Server; `prisma migrate status` confirmo esquema actualizado.
- `DOUBLE_BOOKING_PROTECTION=PASS` en local: dos transacciones concurrentes con el lock de aplicacion y dos inserciones directas concurrentes protegidas por el trigger SQL aceptaron una sola ocupacion cada vez.
- Pruebas HTTP concurrentes: `PASS` para cliente publico contra reserva manual admin y para dos reprogramaciones concurrentes al mismo destino.
- `E2E=PASS`: 3/3 escenarios. Incluye reserva publica/cancelacion, servicios/profesionales/horarios/bloqueos/agenda y colisiones HTTP. El estado de horarios inicializa seleccion y valores de forma atomica para evitar la carrera anterior.
- `LINT=PASS`, `TYPECHECK=PASS`, `BUILD=PASS`, `UNIT_AND_INTEGRATION=PASS` (7/7), `NPM_AUDIT=PASS` (0 vulnerabilidades). Zod quedo en 4.6.6, Vitest en 4.1.12 y `deepmerge-ts` 8.0.0 se fija por override; se anadio el adaptador Prisma para autenticacion Entra.
- Prisma usa `provider=mssql`, `DateTimeOffset`, cadenas de estado con check SQL y limites de longitud. Las migraciones PostgreSQL quedaron archivadas fuera del historial activo. Rate limit y todos los escritores de ocupacion usan `sp_getapplock`; el trigger SQL es la defensa final contra solapamientos.
- Runtime planeado para Azure SQL usa identidad administrada de App Service. El job de migracion aplica el mismo SQL con autenticacion Entra de principal de servicio, registra en `_prisma_migrations` e inspecciona nombres/conteos antes de migrar.
- `barber_sql` se consulto a nivel de metadatos Azure: `Paused`, `useFreeLimit=true`, `publicNetworkAccess=Disabled`, servidor AzureAdOnly. La inspeccion de tablas/datos no se pudo completar porque no hay ruta publica ni endpoint privado accesible; no se aplico ni se intento aplicar una migracion remota.
- No hay App Service/SWA de Al Corte. Los recursos web hallados en la suscripcion son de otros proyectos y no se reutilizan. No se crearon recursos ni se desplego.
- `AL_CORTE_PRODUCTION=NOT PASS`. Bloqueos: inspeccion y migracion remotas sin acceso a SQL; registro/mapeo de los principales Entra de despliegue y runtime en la base aun no verificado; hosting Al Corte y sus settings aun no existen. El workflow `ci-cd.yml` solo habilita produccion manualmente desde `main`, tras gates verdes, y se detiene ante esquema no reconciliado.
- `RELEASE_RUNNER=PASS` local: the Entra-capable migration runner applied the current SQL file to a fresh temporary SQL Server database; `prisma migrate status` recognized its `_prisma_migrations` row. The temporary database and SQL login were removed afterward. The same runner was idempotent against `barber_local`.

## Preparacion de Azure Static Web Apps Hybrid - 2026-11-17

- El usuario confirmo reutilizar `gentle-sky-060525010` en `barberias` y mantener `KEEP_NEXTJS_AND_ADAPT_DATABASE`.
- GitHub confirma que el workflow especificado existe en `main`; su salida anterior era `output_location: "build"`. La copia local de `main` estaba desactualizada y no tenia ese archivo. El workflow se añadio/preparo en `barber` con `app_location: "/"`, `api_location: ""`, `output_location: ""`; solo escucha `main`/PR a `main`, por lo que `barber` no despliega producción.
- `ci-cd.yml` se convirtió a workflow reutilizable de calidad y se retiró su job anterior de despliegue a App Service. El workflow SWA requiere los gates de calidad antes de iniciar el despliegue.
- Se habilito `.npmrc` para hacer reproducible la instalación Oryx con el lockfile que requiere `legacy-peer-deps`; el build copia assets estáticos a `.next/standalone`.
- `STATIC_WEB_APPS_DEPLOYMENT=NOT RUN`: deliberadamente no se actualizo `main` ni se publicó producción. La ultima lectura de Azure SQL sigue siendo `Paused`, `publicNetworkAccess=Disabled`, y sin Private Endpoint identificado; no se pudo inspeccionar/migrar `barber_sql`. Los comandos Azure actuales tampoco pudieron consultar el control plane debido a permisos de escritura denegados en el log de Azure CLI.
- Microsoft documenta Hybrid Next.js en Static Web Apps como Preview. El SKU de la SWA existente, ajustes de entorno, compatibilidad operativa con esta version concreta de Next.js y acceso del runtime a Azure SQL no se pudieron comprobar desde esta sesión.
- No se configuraron secretos en GitHub/Azure, no se modificó la base remota ni se crearon recursos. `DATABASE_MIGRATION`, conectividad de runtime, `/api/health`, smoke tests de reserva/admin y SHA productivo permanecen sin PASS.
- Gate de salida: `AL_CORTE_PRODUCTION=NOT PASS`. Bloqueo exacto: inspección y migración remotas inaccesibles por el estado/red de SQL; falta validar autenticación/egress del runtime SWA hacia SQL y no se han configurado los settings productivos. No empujar a `main` hasta resolverlo.
