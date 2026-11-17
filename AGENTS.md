# Convenciones del repositorio

- Interfaz y mensajes en español rioplatense claro; zona del negocio `America/Montevideo`.
- TypeScript estricto. Validar todos los datos en servidor; no confiar en disponibilidad del navegador.
- Azure SQL es el destino de producción. Las mutaciones de reservas/bloqueos deben usar transacciones y `sp_getapplock`; la migración SQL conserva una defensa de solapamientos en `Occupancy`.
- Datos de clientes mínimos; no incluir teléfono, nombre ni tokens en logs o URLs.
- Nunca integrar APIs/proveedores de WhatsApp, bots o envío automático. Solo enlaces estándar `wa.me` iniciados por la persona.
- No versionar `.env`, secretos, dumps ni datos reales.
- Antes de cerrar una fase, ejecutar lint, typecheck, pruebas correspondientes y build; registrar resultados reales en `docs/ESTADO.md`.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
