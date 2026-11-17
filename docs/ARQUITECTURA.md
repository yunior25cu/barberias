# Arquitectura

`ARCHITECTURE_DECISION=KEEP_NEXTJS_AND_ADAPT_DATABASE`.

Next.js App Router sirve las páginas públicas, el panel administrativo y Route Handlers. Prisma 6 persiste en Azure SQL; no hay Server Actions ni acceso de navegador directo a la base. Zod valida las entradas de las API. El cliente nunca es la autoridad de disponibilidad.

## Persistencia y concurrencia

`DateTimeOffset` conserva instantes y el código aplica las reglas comerciales en `America/Montevideo`. `Occupancy` representa turnos y bloqueos con intervalos semiabiertos `[inicio, fin)`. SQL Server no tiene la exclusión GiST usada por el historial PostgreSQL; la migración SQL Server instala un trigger que serializa por recurso usando `sp_getapplock` y rechaza solapamientos. Las transacciones de reserva pública, gestión por token, administración y bloqueos adquieren el mismo lock antes de consultar y mutar ocupación.

La migración mantiene checks para duración/horarios/intervalos y estado de reserva. La restricción compuesta `(bookingId, blockId)` junto al check de origen evita la limitación de índices únicos sobre valores `NULL` de SQL Server. Las horas deben existir para ofrecer disponibilidad; bloquear un intervalo también participa de la misma exclusión.

## Acceso

El administrador se provisiona desde secretos del entorno con hash bcrypt. La cookie firmada es HttpOnly, SameSite Strict, temporal y Secure en producción. El rate limit usa una transacción y `sp_getapplock` por clave. Los endpoints administrativos verifican autorización en el servidor.

En producción, Azure SQL exige autenticación Microsoft Entra. El runtime usa `@prisma/adapter-mssql` con la identidad administrada de App Service; no guarda usuario ni contraseña SQL. El workflow aplica los mismos archivos SQL con autenticación de principal de servicio y mantiene `_prisma_migrations`, porque `prisma migrate deploy` no usa la identidad administrada de App Service.

## Decisiones

- Next.js + React + TypeScript mantienen UI y API en un único runtime Node.
- Prisma 6 usa el conector SQL Server; el adaptador de `mssql` habilita Microsoft Entra en Azure. Las migraciones PostgreSQL anteriores se conservan archivadas y no forman parte del historial nuevo.
- Azure SQL es el destino acordado; la migración inicial nueva no debe aplicarse hasta inspeccionar la base existente.
- `sp_getapplock` y el trigger forman defensa compartida entre las rutas de escritura y los escritores directos de `Occupancy`.
- WhatsApp permanece como enlace estándar `wa.me` iniciado por la persona.
