# Administración de negocios

El panel de plataforma vive en `/plataforma` y usa la identidad separada `PlatformAdmin`. El responsable de un local sigue usando `/{slug}/admin`; las sesiones de ambos ámbitos son cookies distintas, llevan audiencia firmada distinta y se validan contra la versión de sesión activa en SQL Server.

## Preparar el esquema

1. Inspeccioná la base y su historial antes de migrar. No apliques esta migración a producción hasta tener una copia de recuperación restaurable y una ventana de cambio definida.
2. Probá el cambio primero en la base desechable `barber_local`. `npm run db:release` aplica migraciones incrementales y verifica el historial conocido.
3. `20261119000000_platform_panel` conserva el nombre guardado, quita el default histórico `Al Corte` de `Settings.businessName` y crea entidades de propietario, activación, auditoría e idempotencia. No crea un propietario automáticamente.

## Crear el propietario de plataforma

Ejecutá el comando desde el entorno que tiene acceso a SQL Server. Las credenciales se reciben solo por variables de entorno privadas; no las pongas en argumentos, archivos versionados, tickets o logs.

```powershell
$env:PLATFORM_ADMIN_ACTION = 'bootstrap'
$env:PLATFORM_ADMIN_USERNAME = 'propietario'
$secret = Read-Host 'Contraseña de al menos 14 caracteres' -AsSecureString
$pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secret)
try { $env:PLATFORM_ADMIN_PASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer); npm run platform:admin }
finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer); $env:PLATFORM_ADMIN_PASSWORD = $null; Remove-Variable secret }
```

En automatización, cargá el secreto desde un almacén seguro del entorno y asignalo como variable de proceso sin mostrarlo. El bootstrap solo inserta si el usuario todavía no existe; repetirlo no cambia contraseña, estado ni sesiones.

Para recuperar una cuenta existente, usá `PLATFORM_ADMIN_ACTION=recover` y el mismo usuario. Esa acción administrativa explícita cambia el hash, reactiva la identidad del propietario, incrementa la versión de sesión y agrega auditoría. No uses el seed ordinario para crear o resetear al propietario.

## Dar de alta un negocio

1. Entrá a `/plataforma` con la identidad del propietario.
2. Ingresá el nombre visible, slug, usuario del responsable, teléfono público opcional y moneda.
3. Confirmá el slug normalizado. El nombre y la moneda se pueden editar; el slug queda fijo.
4. Copiá el enlace de activación y compartilo manualmente por un canal confiable. No se envía automáticamente. El token vive en el fragmento `#token=`, vence a las 24 horas, se guarda solo como hash y se puede consumir una sola vez.
5. El responsable define una contraseña de al menos 14 caracteres y configura los servicios, profesionales y horarios en su panel. El negocio nace activo con el catálogo vacío.

El alta usa una transacción SQL, una clave idempotente persistente, unicidad de slug, un responsable inicial pendiente y una entrada de auditoría. Un reintento de la misma solicitud devuelve el negocio existente, pero no recupera un token en claro. Si el enlace se perdió, el propietario puede emitir uno nuevo; la acción invalida el anterior, desactiva la cuenta hasta la activación y revoca las sesiones.

## Cambios y recuperación

- La edición del nombre o teléfono público desde el panel actualiza `Settings` y registra una auditoría sin teléfono de clientes, reservas ni agenda.
- Desactivar conserva los datos y reservas, incrementa las versiones de sesión, invalida activaciones pendientes y bloquea la página y APIs del negocio. No cancela turnos ni manda avisos.
- La desactivación toma `sp_getapplock` sobre el mismo recurso que usan reservas y vuelve a validar el estado dentro de la transacción. La reactivación no revive cookies; el responsable inicia sesión de nuevo.
- Zona operativa admitida: `America/Montevideo`. La moneda usa el formato de tres letras validado por el panel de Ajustes.

## Despliegue

La migración productiva se ejecuta antes del código que consulta las nuevas tablas. Revisá inventario, historial, filas y recuperación; aplicá la migración con credenciales administradas fuera de Git; verificá constraints y datos; desplegá desde el workflow aprobado; luego comprobá login de plataforma, creación/activación sintética y aislamiento entre dos negocios. No declares la funcionalidad productiva por pruebas locales o sintéticas.
