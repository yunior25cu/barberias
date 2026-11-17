# Despliegue

Al Corte conserva Next.js App Router, React, TypeScript y Prisma. El destino es la Static Web App existente `barberweb` (`https://gentle-sky-060525010.4.azurestaticapps.net`), SKU Free, en el grupo `barberias`; está vinculada al repositorio `yunior25cu/barberias` y a `main`. No crear otra SWA ni desplegar un backend separado. Next.js Hybrid admite SSR, App Router y Route Handlers, pero Microsoft lo documenta como preview. El workflow debe mantener `app_location: "/"`, `api_location: ""` y `output_location: ""`; no habilitar `output: "export"`.

El workflow de Static Web Apps llama al workflow reutilizable `ci-cd.yml`. La calidad se ejecuta antes de publicar. Este repo genera salida Next.js standalone y copia los assets estáticos que necesita el servidor. La SWA solo está configurada para el branch `main`; publicar en `barber` no despliega producción.

## Configuración de entorno

Las variables privadas se guardan en el entorno de producción de la Static Web App, fuera del repositorio. La consulta de nombres de settings no devolvió claves configuradas. Al terminar el acceso Azure SQL hay que configurar, como mínimo:

- `AZURE_SQL_AUTH_MODE`, `AZURE_SQL_SERVER`, `AZURE_SQL_DATABASE`.
- Credenciales privadas del principal Entra mapeado en Azure SQL, si el runtime Hybrid no ofrece identidad administrada para la aplicación.
- `SESSION_SECRET` con al menos 32 caracteres aleatorios y `APP_URL=https://gentle-sky-060525010.4.azurestaticapps.net`.
- Credenciales iniciales del administrador solo durante el aprovisionamiento; no mantener su contraseña de bootstrap como variable permanente.
- `DATABASE_URL` solo si el build/runtime realmente lo requiere. `npm run build` no consulta la base; no inyectar una cadena productiva en GitHub Secrets por defecto.

No versionar `.env` ni credenciales. Configurar en GitHub Secrets únicamente datos que un job de CI necesite durante build o migración; preferir federación OIDC para autenticar GitHub Actions en Azure. Los settings de build de Next.js y los settings de ejecución del hosting son ámbitos distintos: configurar ambos solo cuando la variable se use en ambos momentos.

## Gate de base productiva

Antes de migrar, obtener inventario de tablas y conteos de `barber_sql`, confirmar su estado Free Tier y que el overage siga deshabilitado, revisar copias/recuperación y reconciliar cualquier esquema existente. Luego habilitar una ruta aprobada para el principal de migración y probar conectividad. El script `npm run db:release` se detiene ante tablas de aplicación no reconocidas y verifica checksums; no aplicar una migración a ciegas.

## Bloqueo conocido

La última lectura de metadatos disponible indicó `barber_sql` pausada, `publicNetworkAccess=Disabled` y sin endpoint privado encontrado. La base no pudo inspeccionarse ni migrarse. Por tanto, migración, conectividad desde el runtime y smoke tests productivos aún no están demostrados. No hacer push de la release a `main` ni desplegar hasta completar esas verificaciones, mapear la identidad/credencial con permisos mínimos, configurar los settings en la SWA y pasar todas las pruebas concurrentes, de seguridad, E2E y health check.
