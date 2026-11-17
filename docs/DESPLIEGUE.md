# Despliegue

La aplicación requiere un host Node.js compatible con Next.js 16 y PostgreSQL administrado o autohospedado. Hosting, dominio, correo operativo y almacenamiento de backups pueden tener costo; no hay servicios pagos de mensajería requeridos.

1. Crear PostgreSQL y habilitar `btree_gist` (la migración lo solicita).
2. Configurar `DATABASE_URL`, `SESSION_SECRET`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `APP_URL` en el gestor de secretos.
3. Ejecutar `npm ci`, `npm run db:deploy`, `npm run db:seed` durante el aprovisionamiento seguro.
4. Ejecutar `npm run build`; iniciar con `npm start` detrás de HTTPS.
5. Configurar backups, alertas del proceso y verificar `/api/health`.
6. Revisar el flujo en móvil, agenda, política de privacidad y datos del local antes de compartir el enlace.

No hay URL ni credenciales de producción en este repositorio. No se ha desplegado ni publicado el sistema.
