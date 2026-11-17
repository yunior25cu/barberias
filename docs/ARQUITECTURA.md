# Arquitectura

Monolito modular: Next.js App Router reúne páginas públicas, panel y rutas servidor. Prisma modela PostgreSQL y Zod valida entradas. El navegador nunca decide que una hora sigue libre: el servidor verifica horario, servicio, anticipación y ocupación.

## Persistencia y concurrencia

Los instantes se almacenan como `timestamptz` UTC. Para reglas de apertura se transforma a `America/Montevideo`. `Occupancy` representa cada turno o bloqueo por profesional y se protege con `EXCLUDE USING gist (staffId WITH =, tstzrange(startsAt, endsAt, '[)') WITH &&) WHERE active`. Esta restricción de PostgreSQL es la última defensa ante condiciones de carrera. La creación toma además un advisory transaction lock para elegir profesional y escribir reserva+ocupación como una sola unidad. Turnos contiguos son legales porque el intervalo es semiabierto.

La asignación “cualquier profesional” elige un profesional activo que brinda el servicio y tiene horario suficiente. Las pausas/cierres pueden modelarse como bloqueos por profesional. Las jornadas sin filas de horario no ofrecen disponibilidad.

## Acceso

El administrador se provisiona desde variables de entorno con hash bcrypt. La cookie firmada es HttpOnly, SameSite Strict, de duración limitada y Secure en producción. `RateLimit` limita intentos de login. Las mutaciones admin deben conservar autorización del lado servidor y protección de origen.

## ADR

- Next.js/TypeScript: un único despliegue Node sencillo y tipado.
- PostgreSQL + Prisma 6: ORM común con migraciones SQL editables; la restricción GiST se añade en SQL porque no se expresa en el schema Prisma.
- Sin servicio de mensajería. WhatsApp se mantiene como acción voluntaria `wa.me`.
- Configuración temporal para Uruguay no depende del huso del dispositivo. La conversión se hace con `Intl` y persistencia UTC.
