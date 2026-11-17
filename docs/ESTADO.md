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
