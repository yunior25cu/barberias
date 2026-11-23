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
- En esa comprobacion inicial no se identifico hosting. La verificacion posterior del recurso `barberweb` y el workflow de Static Web Apps se documenta abajo. No se crearon recursos ni se desplego.
- `AL_CORTE_PRODUCTION=NOT PASS`. Bloqueos originales: inspeccion/migracion remotas, identidad Entra y configuracion de hosting. El workflow App Service descrito en esa etapa se retiro luego; la configuracion actual de SWA esta documentada abajo.
- `RELEASE_RUNNER=PASS` local: the Entra-capable migration runner applied the current SQL file to a fresh temporary SQL Server database; `prisma migrate status` recognized its `_prisma_migrations` row. The temporary database and SQL login were removed afterward. The same runner was idempotent against `barber_local`.

## Preparacion de Azure Static Web Apps Hybrid - 2026-11-17

- El usuario confirmo reutilizar `gentle-sky-060525010` en `barberias` y mantener `KEEP_NEXTJS_AND_ADAPT_DATABASE`.
- GitHub confirma que el workflow especificado existe en `main`; su salida anterior era `output_location: "build"`. La copia local de `main` estaba desactualizada y no tenia ese archivo. El workflow se añadio/preparo en `barber` con `app_location: "/"`, `api_location: ""`, `output_location: ""`; solo escucha `main`/PR a `main`, por lo que `barber` no despliega producción.
- `ci-cd.yml` se convirtió a workflow reutilizable de calidad y se retiró su job anterior de despliegue a App Service. El workflow SWA requiere los gates de calidad antes de iniciar el despliegue.
- Se habilito `.npmrc` para hacer reproducible la instalación Oryx con el lockfile que requiere `legacy-peer-deps`; el build copia assets estáticos a `.next/standalone`.
- `STATIC_WEB_APPS_DEPLOYMENT=NOT RUN`: deliberadamente no se actualizo `main` ni se publicó producción. La ultima lectura de Azure SQL sigue siendo `Paused`, `publicNetworkAccess=Disabled`, y sin Private Endpoint identificado; no se pudo inspeccionar/migrar `barber_sql`. Los comandos Azure actuales tampoco pudieron consultar el control plane debido a permisos de escritura denegados en el log de Azure CLI.
- Azure verifico el recurso `barberweb` existente en `barberias`, SKU `Free`, URL objetivo correcta, repositorio `yunior25cu/barberias` y branch `main`. No se creo ni modifico el recurso. La consulta de nombres de app settings no devolvio claves configuradas; no se leyeron valores secretos.
- `barber_sql` sigue `Paused`, `useFreeLimit=true` y `freeLimitExhaustionBehavior=AutoPause`. La ultima lectura disponible de red es `publicNetworkAccess=Disabled` y no se encontro Private Endpoint; no hay migracion ni prueba de conectividad desde Hybrid. No se cambio overage billing.
- Microsoft documenta Hybrid Next.js en Static Web Apps como Preview. No se valido en Azure un build/deploy con Next.js 16.4.6, el runtime de las Route Handlers, los app settings de produccion ni el acceso de red/runtime a Azure SQL.
- No se configuraron secretos en GitHub/Azure, no se modificó la base remota ni se crearon recursos. `DATABASE_MIGRATION`, conectividad de runtime, `/api/health`, smoke tests de reserva/admin y SHA productivo permanecen sin PASS.
- Gate de salida: `AL_CORTE_PRODUCTION=NOT PASS`. Bloqueo exacto: inspección y migración remotas inaccesibles por el estado/red de SQL; falta validar autenticación/egress del runtime SWA hacia SQL y no se han configurado los settings productivos. No empujar a `main` hasta resolverlo.

## Forense CI/CD - 2026-11-17

### Fallos observados en GitHub Actions

| Run | SHA | Workflow/job | Primer step fallido y mensaje | Causa raíz |
| --- | --- | --- | --- | --- |
| `44020561607` | `16c49d9807961f027a29efdb97d1e8a9c8f01026` | Al Corte CI/CD / `quality-gates` | Browser setup: `ERROR: Playwright does not support chromium on ubuntu26.04-x64` | `ubuntu-latest` se resolvió a Ubuntu 26.04, no soportado por Playwright 1.56.1. |
| `44020515916` | `94e7b430101120dca16667bb290d905cbab77b48` | Al Corte CI/CD / `quality-gates` | Mismo error de Browser setup en Ubuntu 26.04 | Misma causa raíz. |
| `44020450005` | `e03338389ee64e0c709235791f33d8f5233eb7f7` | Al Corte CI/CD / `quality-gates` | Mismo error de Browser setup en Ubuntu 26.04 | Misma causa raíz. |
| `44020341691` | `f6684ee1bf782d142cd618250d1f90999cd3295a` | Al Corte CI/CD / `quality-gates` | Mismo error de Browser setup en Ubuntu 26.04 | Misma causa raíz. |
| `44019389968` | `ce243e2b18c0bcae0d7e72c8e0c0b4812a9779e6` | Al Corte CI/CD / `quality-gates` | Mismo error de Browser setup en Ubuntu 26.04 | Misma causa raíz. Los quality steps previos (SQL, migración, audit, lint/tipos y concurrencia) pasaron; E2E/build se omitieron. |
| `44017600339` | `3ac4ecea4b75f5c4378f95a766712c9b20993600` | Azure Static Web Apps CI/CD / `Build and Deploy Job` | Build And Deploy: `The app build failed to produce artifact folder: 'build'.` | Configuración heredada de React estático: esperaba `/build` después de compilar Next.js. El build Next sí terminó y listó sus Route Handlers antes de la validación de artefacto. |

`CI_FAILURE_ROOT_CAUSE=Playwright runner incompatibility (ubuntu-latest resolved to ubuntu-26.04)`. `SWA_FAILURE_ROOT_CAUSE=wrong React build artifact path (build instead of Next.js Hybrid empty output location)`.

### Corrección preparada en `barber`

- `ci-cd.yml`: solo push a `barber`, PR hacia `main` y `workflow_call`; main evita una segunda ejecución porque la SWA invoca el reusable workflow. Runner fijado a `ubuntu-24.04`; Node soportado fijado a `>=22 <23`.
- SQL de CI fijado por digest y sin dependencia de la ubicación de `sqlcmd`. El healthcheck de contenedor solo comprueba proceso; `scripts/wait-for-sqlserver.mjs` repite una conexión mssql real a `master`/`SELECT 1` y emite `SQL_SERVER_READY=PASS` antes de crear la base.
- `scripts/assert-ci-database.mjs` acepta exclusivamente `localhost` + `barber_local` en modo SQL y rechaza el hostname/base productivos, autenticación Entra y servidor Azure. Tests y migraciones usan solo el `DATABASE_URL` local efímero del job.
- El workflow SWA solo escucha push a `main`, llama los gates y luego publica con `app_location: "/"`, `api_location: ""`, `output_location: ""`; no despliega desde `barber` ni desde PR.
- Flujo local limpio con SQL Server efímero: `npm ci`, Prisma generate/validate, audit, guard, `SQL_SERVER_READY=PASS`, DB inspect/release/status, seed, lint, tipos, 7/7 unit/integration (incluida concurrencia SQL), E2E 3/3 (incluida concurrencia HTTP), y build standalone: PASS. El contenedor temporal se eliminó.
- Aún falta que GitHub Actions ejecute el nuevo SHA y confirme `BARBER_CI=PASS`; no promover a `main` antes de esa evidencia.
- Build de Next.js Hybrid no necesitó `DATABASE_URL` ni `SESSION_SECRET`: el run SWA 44017600339 completó `npm run build` y solo falló después por la ruta `build`. Las credenciales necesarias en runtime pertenecen a Environment settings de `barberweb`; la consulta de nombres no devolvió settings configurados. No se copian secretos productivos a CI ni al repositorio.

## Multi-tenant desde `4912e53` — rama `integration/multi-tenant` (2026-11-17)

**`MULTITENANT_IMPLEMENTATION=IN_PROGRESS`; `PRODUCTION_CUT=BLOCKED`.** Esta sección reemplaza los reportes iniciales de infraestructura de arriba cuando los datos difieren.

- Referencia verificada: local `main` y `origin/main` parten de `4912e53a84ac8adaf86300f0bbcd71b43aceda6b`. Los runs `44093416892` y `44093910310` fueron verdes para ese SHA. El trabajo está en `integration/multi-tenant`; no se actualizó `main` ni se ejecutó despliegue.
- Azure SQL `barber_sql` está `Online`, Free Tier, con auto-pausa de 60 minutos y `AllowAllWindowsAzureIps`. No se modificó red, capacidad, auto-pausa ni overage. `npm run db:inspect` contra la BD productiva falló por regla de firewall: IP de este equipo no autorizada. Por tanto siguen desconocidos el inventario real, historial/checksums, conteos, constraints y permisos SQL de runtime/migrador; no ejecutar migración productiva hasta repetir esas comprobaciones desde un ejecutor autorizado.
- La migración incremental verifica checksum del baseline SQL Server esperado, esquema/referencias/ocupaciones antes de asignar todo al negocio estable `al-corte`, preserva los datos y añade claves, índices, FKs compuestas e integridad de `Occupancy`. El ensayo automatizado usa SQL Server efímero con datos sintéticos poblados antes de migrar y verifica valores centinela, filas, historial, FKs confiables, trigger y huérfanos.
- Prisma añade `BusinessId` a todas las entidades de negocio, configuración por negocio y administrador activo con versión de sesión. Las APIs `/api/{slug}/...` y páginas `/{slug}/...` comparten handlers con las rutas iniciales; `/` y `/admin` redirigen a `al-corte`. Un repositorio de tenant añade el filtro/ID de negocio incluso dentro de transacciones; SQL limita relaciones y `sp_getapplock` serializa ocupaciones por negocio. El token de gestión permanece fuera de URLs. El runtime SQL no recibe consultas del navegador.
- El workflow CI incluye la rama de integración y crea una base efímera `barber_local`, aplica baseline, carga un fixture legacy sintético, aplica tenant, verifica migración, y ejecuta integración SQL, Playwright y build. El workflow SWA de esta rama no despliega con `push`: exige ejecución manual y `confirm_production=true`, manteniendo el corte bloqueado hasta coordinación. Esto solo protege una futura versión de `main` cuando sea promovida.
- Validaciones locales observadas: `npx prisma validate` PASS, `npm run typecheck` PASS, `npm run lint` PASS sin advertencias, `npm test` 5 PASS / 4 SQL omitidas. No hay Docker disponible para este proceso (acceso al engine denegado), por eso no se ejecutaron CI SQL/E2E/build localmente. No se afirma que la migración ni el aislamiento de runtime estén verificados hasta que pase CI sobre la rama.
- Los endpoints, seeds y fixtures se revisan contra IDs cruzados, usuarios repetidos, idempotencia por tenant, revocación de sesión, reservas sin teléfono y agenda concurrente. El aprovisionamiento del segundo negocio permanece cerrado hasta la validación completa y el corte autorizado.
- Gates actuales: `DATABASE_MIGRATION=NOT PASS` (productiva no inspeccionable y CI pendiente); `DOUBLE_BOOKING_PROTECTION=NOT PASS` para este commit hasta test SQL/HTTP verde; `SECURITY_GATE=NOT PASS` hasta CI/audit completos; `E2E=NOT PASS` (no ejecutado); `AL_CORTE_PRODUCTION=NOT PASS`. No se cambiaron secretos, configuración ni datos productivos.

### Seguimiento CI multi-tenant

- El run `44103760208` ejecutó CI contra `1a5c6f8`. Pasaron SQL Server listo, baseline, seed sintético y audit; la migración tenant detectó `Incorrect syntax near the keyword 'rowCount'`. Se delimitó esa columna en las consultas del archivo SQL. Reejecutar CI antes de cualquier siguiente fase.
- La suite E2E ahora incluye rechazo de slugs desconocidos/anteriores, revocación por `sessionVersion`, intento de relación cruzada sin altas residuales y reserva/reprogramación/cancelación sin teléfono. El E2E con teléfono sigue cubierto. La suite contiene 6 escenarios; falta ejecución verde del runner.
- El run `44104355809` superó el problema `rowCount` y avanzó hasta la verificación de nulidad final, donde SQL Server reportó columna `businessId` no válida en `Occupancy` dentro del mismo batch DDL. La verificación se movió a `sp_executesql` posterior a los ALTER; se conserva la comprobación de todas las tablas y el siguiente run debe validarla.
- Corrección del diagnóstico anterior: el run `44104821424` falló en la referencia `Settings.businessId` de la comprobación `IF NOT EXISTS` al recrear configuración opcional después de quitar la columna singleton. Se sustituye por el conteo previo ya capturado y un INSERT dinámico condicional; el siguiente CI verificará ese camino y la comprobación final de nulidades.
- El run `44105120886` todavía reportó metadatos de `Occupancy.businessId` en la primera validación posterior a la asignación (línea de validación). La asignación y su comprobación preconstraint se ejecutan ahora también con `sp_executesql` para resolver el esquema actualizado al momento de ejecución. Login y logout administrativos además exigen mismo origen.
- Causa raíz del batch: SQL Server no puede enlazar referencias a columnas recién agregadas más adelante en el mismo batch enviado por el driver. La migración ahora separa DDL y DML con `GO`; el runner divide esos batches y los ejecuta dentro de una sola transacción. `#before` conserva los conteos entre batches.
- El run `44106008784` llegó al guard de baseline y detectó que el checksum de Git (`544c9107…`) difiere del checkout Windows (`4f5b6020…`) solo por finales de línea mixtos. El guard ahora admite únicamente ambos hashes del mismo archivo baseline; hashes ajenos continúan bloqueados.
- El run `44106570976` superó el checksum y las validaciones DDL hasta compilar el trigger; falló porque `sp_getapplock` no admite concatenar directamente la expresión en `@Resource`. El trigger ahora construye el recurso en una variable `NVARCHAR(255)` antes de llamar al procedimiento.

## Estado de implementación multi-tenant actualizado — 2026-11-17

**`MULTITENANT_IMPLEMENTATION=PASS` en rama de integración; `PRODUCTION_CUT=BLOCKED`.**

- Rama `integration/multi-tenant`, SHA `74b1d8c19c652c34f200b532462823c1997c64cf`; el árbol local quedó limpio después del push. `main` no se actualizó y no se ejecutó despliegue ni migración productiva.
- GitHub Actions run `44115907090`: PASS para inspección/migración sobre SQL Server efímero con fixture legacy sintético, historial y constraints, `npm audit`, lint, typecheck, concurrencia SQL, 6/6 E2E y build.
- `DOUBLE_BOOKING_PROTECTION=PASS` en SQL Server y HTTP concurrente. `SECURITY_GATE=PASS` para la auditoría ejecutada (0 vulnerabilidades en los runs de CI); los E2E administrativos ahora usan una lista permitida de origen que compara contra `APP_URL` configurado o el origen de la petición, exige `Origin` y rechaza `Sec-Fetch-Site: cross-site`.
- Los E2E revelaron y verificaron dos fallos corregidos: origen de login rechazado por el host interno/proxy (403) y reasignación de reserva que violaba la FK compuesta de ocupación (P2003). Las rutas pública y administrativa ahora sustituyen la fila de ocupación y actualizan reserva dentro de la misma transacción; el rollback conserva la cita si alguna sentencia falla.
- `DATABASE_MIGRATION=PASS` únicamente para la migración ensayada sobre base desechable. La base real `barber_sql` no se ha inspeccionado desde el cliente autorizado; su inventario, historial/checksums, conteos, restricciones y permisos siguen pendientes porque la conexión de este equipo está bloqueada por firewall. No extrapolar el resultado sintético a producción ni ejecutar allí migración.
- El corte exige inspección de `barber_sql` desde un ejecutor con acceso autorizado, ensayo representativo, plan de restauración y coordinación con el operador. La rama SWA mantiene despliegue manual con confirmación; no desplegar desde la rama de integración.

**Gates:** `DATABASE_MIGRATION=NOT PASS` para producción; `DOUBLE_BOOKING_PROTECTION=PASS` (CI); `SECURITY_GATE=PASS` (CI audit); `E2E=PASS` (6/6 CI); `BUILD=PASS` (CI); `AL_CORTE_PRODUCTION=NOT PASS`.

## Platform multi-tenant panel - 2026-11-17

Implementation on `main`, starting at `66afbe0348b544715a8f6b07d41b50fc53d7c8a7`. The implementation is recorded in a local commit; its production push, remote migration, and deployment are tracked separately below. Production database `barber_sql` and Azure Static Web Apps were not modified at the time of this entry.

- Added separate platform-owner identity/session, explicit bootstrap/recovery, idempotent business provisioning, single-use activation, paginated list/detail, business name/public phone editing, audit, and active/inactive lifecycle with session revocation. The incremental platform migration was applied to `barber_local`, preserving `Settings.businessName=Al Corte`. Local SQL verification found 4 platform tables, 6 trusted FKs, 7 trusted checks, no business-name default, and no automatically created platform owner or initial tenant owner. Rolled-back migration attempts remain marked rolled back; applied migration checksums match the local history.
- Fixed React Strict Mode replay that removed the activation token from the URL fragment before activation. Widened the per-IP ceiling for per-identifier rate limits to support multiple safe operations behind shared IPs; the per-identifier limit remains enforced. E2E verifies exactly one of two simultaneous activation requests succeeds and the replay is rejected.
- WhatsApp suggested greeting now uses the current business name. E2E covers tenants A/B/C, idempotency/retry, simultaneous slug collision, cookie/origin/tenant isolation, activation/reissue/expiry/concurrent consumption, business name/title/greeting, session revocation, deactivation, and retained business data.
- Local gates after the final fixes: `npm run lint=PASS`; `npm run typecheck=PASS`; `npm test=PASS` (9/9 on local SQL Server); `npm run test:e2e=PASS` (7/7; platform E2E rerun after the final UI change); `npm run build=PASS`; `npm audit --audit-level=moderate=PASS` (0 vulnerabilities); `npx prisma validate=PASS`; `npx prisma migrate status=PASS`.
- `scripts/verify-platform-migration.mjs` and the automated bootstrap/recovery test are wired into CI. They were not run locally because they require SQL authentication and this local SQL Server connection uses Windows integrated authentication. CI still needs to validate the migration against its populated synthetic fixture after the branch is pushed.

**Requested status:** `PLATFORM_PANEL=PASS` (local E2E); `BUSINESS_PROVISIONING=PASS` (A/B/C and idempotency/concurrency); `BUSINESS_NAME_CONFIG=PASS` (admin/platform name, metadata and greeting); `SECURITY_ISOLATION=PASS` (local E2E, origin/session boundaries and audit 0); `REGRESSION_TESTS=PASS` (lint, types, 9 unit/integration tests, 7 E2E, build); `DEPLOYMENT=NOT RUN` (no push, production migration, or deployment). `AL_CORTE_PRODUCTION=NOT PASS` until CI validates the populated migration fixture and an authorized production cut completes with recovery and smoke tests.

## Dominio canónico y estado productivo - 2026-11-17

Esta entrada supersede los estados de planificación antiguos de este documento para el hosting, la base y el despliegue:

- Dominio canónico: `https://reservas.balaxys.com`. Azure Static Web Apps reportó el custom domain `Ready`; el endpoint `/api/health` respondió `200` con `database: ok`.
- `APP_URL` en Azure debe apuntar al dominio canónico para generar enlaces de activación. Los valores secretos no se registran aquí ni en Git.
- `barber_sql` está Online en General Purpose serverless, con límite Free y `AutoPause`. La migración `20261119000000_platform_panel` fue aplicada luego de inspeccionar tablas e historial.
- La rama `main` está desplegada por el workflow aprobado; el login del administrador de plataforma y su sesión fueron comprobados vía HTTPS.
- El hostname predeterminado de Azure sigue identificando la misma Static Web App, pero ya no es la URL canónica ni debe usarse en enlaces/documentación nuevos.

## Landing comercial en raíz — 2026-11-17

- La portada `/` ahora presenta el producto **Reserva**; **Al Corte** se mantiene como negocio/tenant inicial en `/al-corte/reservar`. Las rutas por tenant no se cambiaron.
- Incluye presentación comercial, funciones, pasos, FAQ, acceso por slug validado y CTA de demo. El contacto confirmado por el propietario es `+598 94448249`; el botón abre WhatsApp con mensaje prellenado, que el usuario revisa antes de enviar.
- La landing es renderizada estáticamente y no importa Prisma ni consulta APIs. Metadatos canonical/Open Graph/Twitter usan `https://reservas.balaxys.com`; imagen en `/marketing/og.svg`.
- Verificado localmente: `npm run build`, `npm run lint`, `npm run typecheck`, `npm test` (5 pasan; 4 omitidos porque falta SQL local), `npm audit --omit=dev --audit-level=moderate` (0 vulnerabilidades), `npm run test:e2e:landing:static` (2/2), `git diff --check`.
- Se revisaron capturas standalone en 320, 390 y 1440 CSS px. La navegación y FAQ se probaron con teclado; falta auditoría automatizada de contraste/axe.
- Suites que requieren SQL y regresión de tenants deben ejecutarse mediante CI con su SQL efímero. Aún no se ha hecho push ni despliegue. Capturas locales: `test-results/` (no versionadas).

**Gates de esta fase:** `LANDING=PASS`; `CTA=PASS`; `SEO=PASS`; `ACCESSIBILITY=PARTIAL` (axe/contraste pendientes); `TENANT_REGRESSION=NOT RUN` (CI/SQL pendiente); `CI=NOT RUN`; `DEPLOYMENT=NOT RUN`.

## Google Maps y direccion por negocio - 2026-11-18

- Se agrego `Settings.businessAddress` nullable (NVARCHAR(300)) mediante la migracion incremental `20261120000000_add_business_address`. El administrador la guarda desde Ajustes; el endpoint publico del tenant solo expone su propia direccion.
- El paso 3 de la reserva presenta la direccion, un mapa interactivo de Google Maps Embed API en modo Place y un enlace universal de indicaciones. Sin clave configurada se conserva la direccion y el enlace, y el mapa muestra una indicacion de configuracion pendiente.
- El workflow CI aplica la migracion despues del panel de plataforma. El workflow SWA lee `GOOGLE_MAPS_EMBED_KEY` de GitHub Secrets y la entrega al build como `NEXT_PUBLIC_GOOGLE_MAPS_EMBED_KEY`; la clave del navegador sera visible para los usuarios y debe tener restricciones de HTTP referrer y de API.
- Verificaciones locales: `npx prisma validate=PASS` (URL local ficticia); `npm run typecheck=PASS`; `npm run lint=PASS`; `npm test=PASS` (5 pasan, 4 SQL omitidas); `npm run build=PASS`; `git diff --check=PASS`.
- `npm run test:e2e` no pudo iniciar: falta `DATABASE_URL` local de `barber_local`. La migracion aun no fue aplicada a una base local ni productiva y los E2E completos quedan pendientes de CI con SQL Server.
- No se configuro Google Cloud, no se agrego ninguna clave, no se cambio `barber_sql`, no hubo push ni despliegue. Para habilitar el mapa se requiere configurar Maps Embed API y el secreto `GOOGLE_MAPS_EMBED_KEY` siguiendo las instrucciones de entrega.

**Gates:** `GOOGLE_MAPS_IMPLEMENTATION=PASS`; `LOCAL_E2E=NOT RUN` (sin SQL local); `GOOGLE_MAPS_CREDENTIAL=BLOCKED` (requiere configuracion externa); `DATABASE_MIGRATION=NOT RUN`; `DEPLOYMENT=NOT RUN`.

## Imágenes de servicios con Azure Blob - 2026-11-18

- Se añadió `Service.imageBlobName` nullable y la migración incremental SQL Server `20261121000000_add_service_images`; inspecciona `dbo.Service` y agrega únicamente la columna si todavía falta. La actualización local del 2026-11-18 se registra abajo; `barber_sql` no fue modificada.
- El formulario de servicios permite cargar/reemplazar/quitar imagen. El navegador convierte JPEG/PNG/WebP a WebP, limita entrada a 12 MiB/24 MP y salida a 500 KiB/1440 px por lado. Los bytes van directo al contenedor Blob privado; SQL conserva solo el nombre del objeto.
- El servidor emite SAS por objeto con vida corta para creación de un nuevo blob y lectura limitada; valida en Blob el MIME, WebP real, resolución y tamaño, limita la clave al tenant/servicio y elimina el objeto anterior tras reemplazo. Las URLs usan claves únicas para evitar caché obsoleta. Los endpoints públicos no exponen nombres internos de blob.
- La reserva presenta miniatura sobre la card sin agregar flujo ni alterar sus dimensiones; un diálogo accesible permite ampliar sin salir del proceso. El flujo E2E incluye crear, reemplazar, descargar/verificar formato, bloquear overwrite con SAS de creación, aislamiento por tenant, modal móvil y eliminación.
- CI crea Azurite y un contenedor aislado con CORS para Playwright; el workflow aplica la migración nueva antes de la suite E2E. `.env.example` solo contiene un placeholder; no se incluyó ninguna clave real.
- Comprobaciones locales: `npm run lint=PASS` (sin errores ni advertencias); `npm run typecheck=PASS`; `npm test=PASS` (5 pasan, 4 SQL omitidas); `npx prisma validate=PASS`; `npm audit --omit=dev --audit-level=moderate=PASS` (0 vulnerabilidades); `npm run build=PASS`; `git diff --check=PASS`.
- `npm run test:e2e=NOT RUN`: el entorno local no tiene `DATABASE_URL` para `barber_local`; el setup exige esa base y Azurite local. Los E2E de imágenes están incorporados para CI, aún no ejecutados localmente.
- Azure no fue modificado por esta implementación. El propietario informó que ya configuró la cuenta Blob, CORS y settings de SWA; esa configuración externa no fue verificada desde el entorno. No se hizo push ni despliegue durante la implementación.

**Gates de implementación:** `IMAGE_UPLOAD_IMPLEMENTATION=PASS`; `LOCAL_E2E=NOT RUN`; `CI_E2E=NOT RUN`; `DATABASE_MIGRATION_LOCAL=PASS`; `AZURE_BLOB_CONFIGURATION=OWNER_REPORTED_CONFIGURED, NOT VERIFIED`; `DEPLOYMENT=NOT RUN`.

### Migración local aplicada - 2026-11-18

- Se inspeccionó `barber_local` antes de migrar: 1 negocio y 1 fila de ajustes; 26 claves foráneas y 18 constraints CHECK confiables y habilitadas. El historial tenía aplicadas la base, tenancy y plataforma; dirección e imagen faltaban. Había intentos previos revertidos de migraciones anteriores, sin cambiar los registros completados.
- Usando `prisma migrate deploy` sobre la instancia local SQL Server `SQLEXPRESS`, se aplicaron `20261120000000_add_business_address` y `20261121000000_add_service_images`. No se creó una segunda base ni se tocó `barber_sql`.
- Verificación posterior: `prisma migrate status=PASS` (las 5 migraciones del repositorio registradas y schema up to date); `Settings.businessAddress=NVARCHAR(300)`; `Service.imageBlobName=NVARCHAR(300)`; se conservaron 1 fila de negocio y 1 de ajustes; todos los FKs y CHECKs permanecen confiables y habilitados.
- La cadena integrada de conexión se usó solo en el proceso de migración y no se guardó en archivos del repositorio.

**Resultado:** `BARBER_LOCAL_MIGRATIONS=PASS`; `BARBER_SQL=NOT MODIFIED`.

## Dos políticas de disponibilidad por negocio — 2026-11-22

- Se añadió `Settings.calendarMode` con valores `fixed` y `dynamic`. La migración SQL Server `20261122000000_add_calendar_mode` agrega la columna con valor predeterminado `fixed`, preservando el comportamiento de los negocios existentes.
- En modo fijo se conservan los inicios cada `slotStepMinutes`, anclados a la apertura de cada jornada. En modo dinámico, además, se ofrecen finales locales de reservas y bloqueos activos, siempre que el nuevo servicio quepa dentro de la jornada y no se superponga. Cancelar desactiva la ocupación; la próxima consulta recalcula y deja de usar ese final como candidato.
- Reserva pública y reprogramación pública verifican la misma regla bajo el bloqueo transaccional de agenda. La comprobación de solapamientos y la duración real del servicio se mantienen en el servidor.
- Verificación local de código: `npx prisma validate=PASS`; `npm run lint=PASS`; `npm run typecheck=PASS`; `npm test=PASS` (11 pasan, 4 omitidas); `npm run build=PASS`.
- La migración local no quedó aplicada. Se inspeccionó `barber_local` y se confirmó que el `DATABASE_URL` de runtime usa `alcorte_local_app`, sin permiso `ALTER` en `dbo.Settings`. Los intentos fallidos se marcaron como revertidos y se verificó que `calendarMode` no existe en esa base. No se modificaron datos ni permisos.
- `npm run test:e2e=NOT RUN`: requiere la nueva columna local. Los E2E que migran la base SQL efímera de CI están añadidos, incluyendo 10:30 (30 min), 11:00 (45 min), disponibilidad 11:45, reprogramación dinámica, cancelación y modo fijo.
- No se hizo commit, push, migración productiva ni despliegue.

**Gates:** `FIXED_MODE=IMPLEMENTED`; `DYNAMIC_MODE=IMPLEMENTED`; `LOCAL_E2E=BLOCKED_BY_LOCAL_MIGRATION_PERMISSION`; `CI_E2E=NOT RUN`; `PRODUCTION=NOT DEPLOYED`.

## Disponibilidad frente a auto-pausa de Azure SQL Free Tier — 2026-11-23

- Forense de producción: cuatro eventos `NextBusinessPageRenderError` para `GET /[slug]/admin` con el digest reportado `3909498040`, en dos ráfagas (17:11 y 17:55 UTC). La pila en los cuatro es `tarn/PendingOperation.js`; el mensaje fue `operation timed out for an unknown reason`.
- Correlación de Azure: `barber_sql` inició reanudación a las 17:11:15 y 17:54:41 UTC; las finalizó a las 17:11:45 y 17:55:41. Azure Resource Health registró dos indisponibilidades iniciadas por plataforma (17:14–17:16 y 17:58–18:00, granularidad de dos minutos). El mismo período tiene 15 conexiones fallidas, 14 exitosas y cero fallos atribuidos a firewall o error de usuario. El contador de uso gratuito aún mostraba 14,088 unidades al final de la ventana; no era agotamiento del límite mensual.
- Causa raíz demostrada: la base Free Tier se pausa por inactividad y el runtime no tolera suficientemente la ventana de reanudación. Azure documenta que Free Tier pausa después de 15 minutos y que el primer intento de conexión al reanudar puede fallar. El pool del adaptador `mssql` conservaba 30 segundos para adquirir/crear conexiones, menos que la ventana de reanudación observada.
- Fix en `src/lib/db.ts`: el pool usa adquisición/creación acotadas a 90 segundos, reintento de apertura cada 1 segundo y `propagateCreateError=false`. Solo se reintenta abrir una conexión; nunca se reejecuta una consulta ni mutación. Se preservan Free Tier, `AutoPause` y timeouts de consulta; Azure no fue modificado.
- Verificación local real: `npm run lint=PASS`; `npm run typecheck=PASS`; `npm test=PASS` (11 pasan, 4 omitidos por dependencias de SQL); `npm run build=PASS`; `git diff --check=PASS`.
- `barber_local` no se modificó porque le falta la migración `calendarMode`. CI `45240757918` para `dfbcec2` pasó E2E HTTP/funcional, concurrencia SQL, seguridad y build con SQL efímero. No se pausó producción para simular el despertar.
- Deploy de producción: run `45241947726` completó gates, Static Web Apps Hybrid y smoke configurado en el SHA `dfbcec28f60409c6ad38c7566fda1e036c28581a`.
- Smoke manual posterior: 5 rondas de solo lectura; `/api/health` fue HTTP 200 con `status=ok,database=ok`; `/alcorte/admin` y `/alcorte/reservar` fueron HTTP 200 en todas. Latencias observadas: 223–1,205 ms para health y 250–586 ms para las páginas. No se creó ninguna reserva.
- App Insights no registró nuevos `NextBusinessPageRenderError` para la ruta/digest desde 18:45 UTC hasta 18:56 UTC. La instrumentación estándar de requests/dependencias no está habilitada, por lo que esta consulta solo acredita los eventos personalizados existentes. CI ejecutó login/gestión admin E2E con datos sintéticos; no se usaron credenciales reales de producción.

**Gates:** `ROOT_CAUSE=CONFIRMED`; `LOCAL_QUALITY=PASS`; `CI_E2E=PASS (run 45240757918)`; `PRODUCTION_DEPLOYMENT=PASS (run 45241947726)`; `PRODUCTION_HEALTH_AND_ROUTES=PASS`; `REAL_ADMIN_LOGIN=NOT TESTED`; `PRODUCTION_FIX=REOPENED_AFTER_COLD_REQUEST`.
## Seguimiento de handshake frío de Azure SQL — 2026-11-23

- Tras la primera promoción, un request de solo lectura a /api/health devolvió HTTP 500; requests posteriores a health, /alcorte/admin y /alcorte/reservar dieron 200. La primera falla no quedó en App Insights porque onRequestError filtraba todas las rutas /api/*.
- Correlación de Azure SQL: auto-pausa a las 19:25:46 UTC; auto-reanudación iniciada a las 20:08:04 y completada a las 20:08:47, con duración reportada de 43.2 segundos. Estado Free/AutoPause se mantuvo.
- Inspección del adaptador instalado confirmó la limitación: PrismaMssql.connect() llama ConnectionPool.connect() antes de construir el pool tarn; por eso aumentar acquireTimeoutMillis no cubre el primer handshake tras la pausa.
- Seguimiento local en src/lib/db.ts: reintento acotado del handshake del adaptador ante códigos transitorios SQL, máximo 9 aperturas y backoff de 1, 2, 4 y hasta 8 segundos. No reintenta consultas ni mutaciones. src/lib/instrumentation.ts registra errores de Route Handlers con ruta, método, clase y código seguro; excluye mensaje, stack, datos del cliente y query string.
- Pruebas unitarias nuevas: éxito luego de 40613, sin reintento de error de login y límite máximo de intentos. Verificación local: lint/typecheck/build PASS; 14 pruebas pasan y 4 se omiten por SQL local.
- Este seguimiento aún no se había enviado ni desplegado al cerrar la verificación local inicial. No se modificó la configuración Azure ni la base.

Gates previos al cierre: COLD_START_ROOT_CAUSE=CONFIRMED; FOLLOWUP_LOCAL=PASS; FOLLOWUP_CI=NOT RUN; FOLLOWUP_PRODUCTION=NOT DEPLOYED.

### Cierre de recuperación de conexión fría - 2026-11-23

- La segunda inspección del adaptador confirmó que el handshake inicial de `PrismaMssql.connect()` ocurre antes del pool `tarn`; por eso los límites ampliados del pool no protegían el primer `ConnectionPool.connect()` después de `AutoPause`.
- Fix `63e01704f7fc57e8557586122eb32af9afe01f75`: reintento acotado únicamente del handshake para códigos SQL/transporte transitorios; errores de credenciales y consultas no se reintentan. App Insights ahora incluye eventos sanitizados de Route Handlers `/api/*`, sin mensajes, stacks, query strings ni datos de clientes.
- Evidencia de CI: `barber` run `45259855619=SUCCESS`; prueba unitaria del 40613 y límites de intentos, lint, typecheck, SQL Server concurrency/E2E y build pasaron. La promoción en `main` run `45260584155=SUCCESS`, con gates, deploy Hybrid y smoke de salud/catálogo.
- Evidencia productiva posterior al deploy del SHA anterior: cinco rondas de solo lectura devolvieron HTTP 200 en `/api/health` (`status=ok,database=ok`), `/alcorte/admin` y `/alcorte/reservar`. No se crearon reservas ni se usaron credenciales reales. La consulta de App Insights posterior al deploy no encontró eventos `NextApiRouteError` ni `NextBusinessPageRenderError`.
- La base permanece en Free Tier con `AutoPause`; no se modificó su configuración, red, capacidad o facturación. No se forzó una pausa en producción. Por eso queda sin demostrar un despertar natural posterior a este SHA, aunque el handshake transitorio está cubierto por la prueba unitaria y el smoke HTTP actual.
- Prueba natural posterior (2026-11-23 21:34 UTC): tras más de 50 minutos sin consultar producción, el primer `GET /api/health` respondió HTTP 200 con `status=ok,database=ok` en 36.1 s. Azure SQL registró una conexión fallida por error de sistema en cada minuto 21:34 y 21:35, consistente con el handshake frío; cinco rondas siguientes de health, administración y reserva dieron 15/15 HTTP 200 (0.20–0.99 s para health; 0.22–0.49 s para páginas). App Insights no mostró errores API ni SSR en la ventana consultada.
- Seguimiento de CI: el run `45263577958` del commit documental `a6e702f` falló únicamente en `tests/e2e/booking.spec.ts:323` (el test de calendario dinámico esperaba `11:45`, ausente de la respuesta); el job de deploy se omitió. El mismo código de aplicación en `63e0170` pasó CI (`45259855619`) y se desplegó (`45260584155`). Este fallo de calendario queda registrado como gate pendiente independiente; no se atribuye sin evidencia a la incidencia de conexión.

**Gates finales:** `ROOT_CAUSE=CONFIRMED`; `LOCAL_QUALITY=PASS`; `BARBER_CI=PASS (45259855619)`; `DEPLOYED_CODE_CI_AND_DEPLOY=PASS (45260584155, SHA 63e01704f7fc57e8557586122eb32af9afe01f75)`; `PRODUCTION_HTTP_SMOKE=PASS (5/5 rondas + despertar natural)`; `LATEST_MAIN_CI=FAIL (45263577958, E2E calendario dinámico)`; `REAL_ADMIN_LOGIN=NOT TESTED`.
