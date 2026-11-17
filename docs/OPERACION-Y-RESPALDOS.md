# Operación, respaldos y recuperación

## Respaldo

En producción, configurar `pg_dump -Fc` diario, cifrar el archivo antes de transferirlo a almacenamiento privado separado de la base y conservar 30 copias diarias más 12 mensuales. Restringir acceso y definir quién custodia la clave. No usar datos reales en desarrollo.

Ejemplo manual (ejecutar con variables seguras en el host; nunca poner contraseña en la línea de comandos):

```sh
pg_dump --format=custom --no-owner "$DATABASE_URL" > alcorte-$(date -u +%F).dump
```

## Restauración de prueba

Crear una base vacía aislada y restaurar el dump con `pg_restore --clean --if-exists --no-owner --dbname "$RESTORE_URL" archivo.dump`. Ejecutar `npm run db:deploy`, comprobar `GET /api/health`, recuentos operativos y que la restricción `occupancy_no_overlap` exista. Hacer este simulacro al menos trimestralmente y registrar fecha, duración y resultado. No restaurar encima de producción durante una prueba.

## Incidentes

Ante caída, revisar `/api/health`, disponibilidad de PostgreSQL y logs del proceso sin copiar datos personales a tickets. Para recuperar acceso admin, usar el flujo seguro de provisión y rotar contraseña/`SESSION_SECRET`; cambiar la clave invalida sesiones activas. Para actualizar, respaldar primero, desplegar migraciones y verificar salud antes de reabrir reservas.
