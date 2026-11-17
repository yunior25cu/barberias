# Operación, respaldos y recuperación

## Backups

Azure SQL administra los backups de la base. Antes de producción, definir y verificar la retención de recuperación a un punto en el tiempo y copias de largo plazo según la política del negocio. El estado actual reporta retención LTR de cero; debe configurarse antes del lanzamiento si se requieren copias de largo plazo. No usar datos reales en desarrollo.

## Restauración de prueba

Restaurar a una base aislada, inspeccionar el esquema y ejecutar `npm run db:deploy`. Verificar `/api/health`, horarios, reservas y el trigger `TR_Occupancy_NoOverlap`. No restaurar encima de producción durante una prueba.

## Incidentes

Ante una caída, revisar `/api/health`, disponibilidad de Azure SQL y logs del proceso sin copiar datos personales a tickets. Para revocar sesiones, rotar `SESSION_SECRET`; para rotar acceso administrador, actualizar el secreto y volver a ejecutar la provisión controlada. Desplegar migraciones antes de abrir tráfico y verificar salud después.
