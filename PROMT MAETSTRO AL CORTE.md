# Al Corte — Prompt maestro de producto e implementación

> **Instrucción para el agente:** toma este documento como especificación de trabajo. Implementa la aplicación en `D:\AlCorte`, desde cero, con calidad de producción para un único local. Trabaja por fases, conserva decisiones y evidencia en el repositorio, y no declares una fase terminada hasta cumplir sus criterios de aceptación. Si el directorio ya contiene archivos, inspecciónalos antes de modificar nada; preserva todo trabajo existente y no sobrescribas datos del usuario.

## 1. Rol y objetivo

Actúa como arquitecto de producto, diseñador UX y desarrollador full-stack senior con experiencia en reservas para pequeños negocios. Construye **Al Corte**, una aplicación web móvil primero para que una peluquería publique disponibilidad, reciba reservas sin intervención manual y administre su agenda desde un panel seguro.

El producto debe ser pequeño, confiable, fácil de mantener y ampliable. Prioriza evitar dobles reservas, proteger datos personales y hacer que una persona con poca experiencia digital pueda reservar. Interfaz en español rioplatense claro (usar “reservá”, “elegí”, “tu hora” de forma consistente), zona horaria `America/Montevideo` y moneda/formato configurables. No construyas un marketplace, una app nativa, pagos, promociones, chat ni multiempresa en el MVP.

## 2. Decisión vinculante sobre WhatsApp

El MVP **no integra WhatsApp Business Platform / Cloud API ni ningún proveedor de mensajería**. No implementar webhooks, bots, envío automatizado, lectura de conversaciones ni cargos de Meta. No agregar Twilio, BSP, SDK de WhatsApp, credenciales ni tarifas de mensajes.

El negocio usa la aplicación **WhatsApp Business** gratuita instalada por su cuenta. El dueño configura desde WhatsApp un mensaje de bienvenida que comparte el enlace público de reservas. La app puede mostrar instrucciones y un texto sugerido para copiar, por ejemplo:

> ¡Hola! Gracias por escribirnos. Para reservar tu hora, elegí el servicio y el horario aquí: [ENLACE PÚBLICO]

El panel debe indicar claramente que el saludo automático depende de las opciones y condiciones de WhatsApp Business (por ejemplo, no necesariamente se envía ante cada mensaje) y que lo configura el dueño en WhatsApp. La aplicación no promete ni controla ese envío.

Confirmaciones, cambios y cancelaciones se muestran en la web y pueden ofrecer un botón/enlace `wa.me` con un mensaje prellenado para que **el dueño o cliente lo envíe manualmente**. No afirmar que un mensaje fue enviado. En el MVP no hay recordatorios automáticos por WhatsApp/SMS/email. Si se agrega una acción manual de WhatsApp, abrir WhatsApp mediante enlace estándar; no transmitir datos sensibles innecesarios en la URL.

## 3. Flujo y requisitos de experiencia

### Reserva del cliente

1. Abre el enlace público desde WhatsApp o navegador, sin instalar nada ni crear cuenta.
2. Elige un servicio.
3. Elige un día disponible.
4. Elige un horario libre.
5. Ingresa nombre y teléfono, revisa y confirma.

Mantén el proceso en **hasta cuatro pantallas/pasos**: (1) servicio, (2) día y hora, (3) datos, (4) confirmación. Debe ser mobile-first, con tipografía legible, controles táctiles amplios (objetivo mínimo 44×44 px), buen contraste, navegación obvia y errores amables. Mostrar progreso y permitir volver sin perder selecciones. No usar lenguaje técnico.

Datos mínimos: nombre, teléfono, servicio, fecha/hora local y consentimiento/aviso de privacidad apropiado. Validar y normalizar teléfono sin exigir formatos difíciles; no solicitar documento, dirección ni cuenta.

Al confirmar, mostrar resumen, identificador/código de reserva, estado y política de cancelación. Facilitar guardar/copiar datos y contactar al local. No dar por confirmada una reserva hasta que la transacción se haya guardado correctamente.

### Panel del dueño

- Acceso protegido para el dueño, sin registro público.
- Agenda de día y semana, legible en móvil y escritorio, con estados diferenciados además de color (texto/ícono).
- Ver datos esenciales de cada reserva.
- Crear, mover/reprogramar y cancelar una reserva; bloquear/desbloquear intervalos; editar servicios, duración/precio informativo, horario de atención, pausas, días cerrados, anticipación mínima/máxima y zona horaria.
- Confirmación antes de acciones destructivas y aviso claro si el nuevo horario dejó de estar disponible.
- Las modificaciones se reflejan inmediatamente en disponibilidad pública. Mostrar cuándo se actualizó la agenda.
- Cambios que requieran avisar al cliente deben ofrecer texto de WhatsApp prellenado/manual, nunca indicar envío automático.

## 4. Stack recomendado y arquitectura

Antes de fijar versiones, verifica versiones estables vigentes y compatibilidad con la máquina de desarrollo/hosting. Usa versiones LTS o estables soportadas, bloquea dependencias y documenta las elecciones. Si el entorno impide este stack, explica la limitación y propone una alternativa equivalente sencilla, sin introducir servicios pagos obligatorios.

**Recomendación base:**

- Aplicación full-stack TypeScript en un único repositorio: **Next.js (App Router)**, React y TypeScript estricto.
- UI accesible con componentes propios y una librería madura cuando aporte valor; CSS/Tailwind según conveniencia, evitando dependencia de una plantilla compleja.
- **PostgreSQL** como base de datos; ORM con migraciones explícitas (Prisma o Drizzle, justificar elección). Para desarrollo local, Docker Compose opcional; no depender de SQLite en producción.
- Validación compartida de entradas con esquemas tipados (por ejemplo Zod); formularios accesibles.
- Pruebas unitarias/integración y navegador con Vitest y Playwright (o equivalentes mantenidos).
- Despliegue en un proveedor compatible con Node.js y PostgreSQL. Puede ser autohospedado o servicio administrado; documentar costos variables y evitar afirmar que hosting/dominio son gratuitos.

Arquitectura modular de monolito: UI pública y admin, capa de aplicación/servicios, dominio de reservas y persistencia. Toda regla crítica y autorización se valida en servidor. No separar microservicios en el MVP.

### Estructura objetivo del proyecto

Adapta los nombres a la versión final del framework, manteniendo responsabilidades claras:

```text
D:\AlCorte\
├─ README.md
├─ AGENTS.md
├─ .env.example
├─ .gitignore
├─ package.json
├─ lockfile
├─ docker-compose.yml              # opcional para desarrollo local
├─ docs/
│  ├─ PRODUCTO.md
│  ├─ ARQUITECTURA.md
│  ├─ DATOS-Y-PRIVACIDAD.md
│  ├─ OPERACION-Y-RESPALDOS.md
│  ├─ DESPLIEGUE.md
│  └─ decisiones/                   # ADR breves para decisiones relevantes
├─ prisma/ o drizzle/               # esquema y migraciones
├─ public/
├─ src/
│  ├─ app/
│  │  ├─ (public)/                  # reserva, disponibilidad, confirmación
│  │  ├─ admin/                     # panel protegido
│  │  └─ api/                       # solo endpoints necesarios
│  ├─ components/
│  │  ├─ booking/
│  │  ├─ calendar/
│  │  └─ ui/
│  ├─ features/
│  │  ├─ bookings/
│  │  ├─ availability/
│  │  ├─ services/
│  │  └─ settings/
│  ├─ lib/                          # db, auth, validación, fechas, logging
│  └─ styles/
├─ tests/
│  ├─ unit/
│  ├─ integration/
│  └─ e2e/
└─ .github/workflows/               # CI si el repositorio/hosting usa GitHub
```

Mantén secretos fuera del repositorio. `.env.example` solo contiene nombres y valores ficticios.

## 5. Modelo de dominio mínimo

Diseña y documenta un esquema relacional con claves, restricciones, índices y migraciones. Como mínimo:

- `AdminUser`: identidad de acceso del dueño; contraseña almacenada solo como hash fuerte o proveedor OIDC si está disponible.
- `Service`: nombre, descripción breve opcional, duración en minutos, precio informativo opcional, activo/inactivo, orden.
- `BusinessHours`/reglas semanales y excepciones: día, intervalos, pausas, cierres y zona horaria IANA.
- `Booking`: UUID/ID opaco, servicio, nombre, teléfono normalizado, inicio/fin como instantes inequívocos, zona horaria/representación necesaria, estado, timestamps y auditoría mínima.
- `TimeBlock`: intervalo bloqueado y motivo opcional privado.
- `Settings`: parámetros del negocio (nombre, teléfono público, enlace base, anticipación, horizonte, granularidad de horarios, política de cancelación).

Estados claros y transición validada: al menos `confirmed`, `cancelled`; agregar `completed`/`no_show` solo si la UI los usa. Guardar fechas como instantes UTC en DB y renderizar en `America/Montevideo`. Tratar correctamente cambios de horario de verano y entradas ambiguas.

## 6. Disponibilidad y protección contra dobles reservas

La disponibilidad se calcula en el servidor usando servicio/duración, horarios, pausas, cierres, bloques, reservas activas, anticipación y granularidad. No confiar en horas sugeridas por el navegador. Revalidar al confirmar.

La operación de reservar debe ser atómica. Impedir solapamientos también ante dos solicitudes simultáneas. Preferir una restricción/exclusion de rangos en PostgreSQL (o estrategia equivalente transaccional con bloqueo y aislamiento adecuado) para intervalos de reservas activas; documentar cómo se aplica también a bloqueos. Una simple comprobación previa en código no basta. Devolver un conflicto entendible y permitir elegir otra hora.

Aplicar idempotencia o protección contra doble envío para que reintentos no creen reservas duplicadas. Asegurar que reprogramaciones y bloqueos pasen por la misma protección transaccional.

## 7. Seguridad, privacidad y operación

- Autenticación admin segura; cookies `HttpOnly`, `Secure` en producción y `SameSite`; protección CSRF cuando corresponda; límites de intentos de login y rate limiting a endpoints públicos.
- Validación del lado servidor, consultas parametrizadas/ORM, escape de salida y controles de autorización por recurso.
- Protección frente a fuerza bruta, spam y abuso de disponibilidad. No crear CAPTCHA intrusivo salvo evidencia de abuso; definir mitigación gradual.
- Cabeceras de seguridad, HTTPS obligatorio en producción, política CSP razonable, dependencias actualizadas y revisión de vulnerabilidades.
- No exponer datos personales en páginas públicas, logs, analytics o URLs. El identificador de reserva debe ser impredecible; la consulta/cancelación pública requiere token opaco de alta entropía o un flujo seguro.
- Minimizar y limitar retención de datos; documentar finalidad, acceso, exportación/borrado y política de privacidad. No afirmar cumplimiento legal sin revisión local.
- Secretos por variables de entorno/secret manager. Nunca incluir credenciales reales en ejemplos, logs ni commits.
- Logs estructurados sin teléfono/nombre salvo necesidad operativa explícita; auditoría de acciones admin sin contenido sensible innecesario.
- Respaldos automáticos de PostgreSQL, cifrados, con retención definida; probar restauración y documentarla. Monitoreo de errores y alertas operativas sin PII.
- Procedimiento para caída, restauración, actualización de esquema y recuperación de acceso admin.

## 8. Fases de trabajo obligatorias

Trabaja en orden. Al final de cada fase actualiza `docs/ESTADO.md` (crear), indicando realizado, decisiones, comandos ejecutados, resultado y pendientes. No inventes resultados. Mantén el producto ejecutable al final de cada fase que modifique código.

### Fase 0 — Inspección y plan

Inspecciona `D:\AlCorte`, herramientas instaladas y restricciones de hosting/desarrollo. No borres archivos. Crea repositorio/estructura solo si corresponde. Registra supuestos, riesgos y decisiones en `docs/ESTADO.md` y ADRs. Elige stack y versiones compatibles verificadas.

**Aceptación:** alcance y stack documentados; estructura inicial; comandos de desarrollo reproducibles.

### Fase 1 — Base técnica y diseño

Configura TypeScript estricto, lint/format, variables de entorno validadas, conexión a PostgreSQL, migraciones, diseño base accesible y CI básica si aplica. Define sistema de fechas/zona horaria y manejo centralizado de errores.

**Aceptación:** instalación limpia documentada; migraciones aplicables; página inicial usable en móvil; secretos no versionados.

### Fase 2 — Configuración del local y admin

Implementa autenticación/admin, gestión de servicios, horarios, pausas, excepciones y bloqueos. Sembrado de datos de desarrollo no debe ser credencial real ni habilitar contraseña por defecto en producción.

**Aceptación:** solo admin autenticado modifica ajustes; formularios validan en cliente y servidor; horarios se muestran en hora local.

### Fase 3 — Reserva pública y concurrencia

Construye los cuatro pasos de reserva, consulta dinámica de días/horas, validaciones, persistencia transaccional, idempotencia y manejo de conflicto. Añade confirmación y enlace manual a WhatsApp opcional.

**Aceptación:** reserva completa desde móvil sin cuenta; una hora no puede reservarse dos veces incluso bajo concurrencia; errores permiten recuperarse sin perder todo el progreso; nunca se confirma antes del commit.

### Fase 4 — Agenda y operaciones

Implementa vista día/semana, detalle, cambio de estado, reprogramación, cancelación y bloqueo. Ofrece compartir enlace público y texto sugerido para mensaje de bienvenida de WhatsApp Business App; explica que se configura manualmente y puede no enviarse ante cada mensaje.

**Aceptación:** agenda y disponibilidad coinciden; el dueño puede operar las tareas principales desde teléfono; cambios/cancelaciones no se comunican como enviados automáticamente.

### Fase 5 — Endurecimiento y preparación de producción

Completa políticas de seguridad, límites de uso, privacidad, respaldos/restauración, observabilidad, accesibilidad y pruebas de regresión. Cierra defectos críticos/altos antes de despliegue.

**Aceptación:** criterios de seguridad revisados; restauración probada en entorno de prueba; procedimiento operativo completo; sin secretos ni PII en logs.

### Fase 6 — Despliegue y entrega

Documenta e implementa despliegue reproducible en entorno elegido, dominio/HTTPS, variables seguras, migraciones, usuario admin inicial seguro, backups, monitoreo y rollback. No publiques ni migres datos reales sin autorización explícita del dueño. Si no hay credenciales o hosting disponible, deja instrucciones y configuración preparadas, declara el bloqueo concretamente y entrega una ejecución local funcional.

**Aceptación:** URL de producción accesible si las credenciales/hosting existen; checklist de verificación pasada; guía de operación y recuperación entregada.

## 9. Pruebas requeridas

Escribe y ejecuta pruebas; reporta exactamente qué corrió y su resultado. No ocultes fallos ni sustituyas pruebas por afirmaciones manuales.

- Unitarias: generación de horarios, duración, límites, excepciones, pausas, formatos y zona horaria.
- Integración con PostgreSQL real o de prueba: migraciones, creación, cancelación, reprogramación y restricciones anti-solapamiento.
- Concurrencia: dos solicitudes simultáneas al mismo horario; exactamente una triunfa.
- E2E móvil: reserva completa; servicio inactivo; día cerrado; conflicto por carrera; validaciones; agenda admin; reprogramación; cancelación; bloqueo.
- Seguridad: rutas admin anónimas, autorización, rate limiting, entradas malformadas, token público no enumerable y no exposición de PII.
- Accesibilidad básica automatizada y revisión manual de teclado, foco, etiquetas, contraste y tamaños táctiles.
- Comandos estándar `lint`, `typecheck`, pruebas y build documentados en README/CI.

## 10. Criterios globales de salida

El MVP se considera listo solo cuando:

1. El cliente puede reservar sin cuenta en móvil en hasta cuatro pasos.
2. El servidor calcula disponibilidad y PostgreSQL impide solapamientos bajo concurrencia.
3. El dueño puede ver y administrar reservas, horarios, pausas, bloqueos y servicios.
4. La zona horaria local se aplica consistentemente y las horas almacenadas son inequívocas.
5. El admin está protegido; endpoints públicos están validados y limitados.
6. Existe política de privacidad y retención documentada para los datos mínimos recogidos.
7. No existe integración Cloud API/BSP/Twilio ni envío automático de mensajes. WhatsApp Business App es una configuración manual del dueño y el producto deja explícita esa limitación.
8. Migraciones, respaldos, restauración, despliegue y operación están documentados.
9. Pruebas automatizadas, lint, tipado y build pasan; fallos pendientes están enumerados sin ocultarlos.
10. Un operador puede instalar, configurar, iniciar, desplegar y recuperar el sistema siguiendo el README.

## 11. Entregables del agente

En `D:\AlCorte`, deja:

- aplicación ejecutable y estructura de código mantenible;
- `README.md` con prerequisitos, instalación, variables, migración, desarrollo, pruebas, despliegue y recuperación;
- `AGENTS.md` con convenciones del repo, comandos y reglas de seguridad;
- documentación bajo `docs/`, incluyendo decisiones de arquitectura, datos/privacidad, operación, respaldo/restauración, despliegue y `ESTADO.md`;
- `.env.example` sin secretos reales;
- migraciones y datos de ejemplo seguros para desarrollo;
- suite de pruebas y resultado real de ejecución;
- checklist de lanzamiento del dueño, incluyendo configuración manual del mensaje de bienvenida de WhatsApp Business App y verificación del enlace público.

## 12. Forma de colaboración y límites

- No te detengas tras producir un plan: implementa todas las fases posibles con las capacidades disponibles.
- Resuelve decisiones rutinarias con criterio y anota las relevantes. Pregunta solo si falta una decisión externa que bloquee trabajo, por ejemplo proveedor/credenciales de producción o política comercial no definida.
- No inventes nombre del local, precios, horarios, teléfono, credenciales, políticas legales ni URL de producción. Usa configuración editable y placeholders claramente identificados.
- No cobres, compres dominio, crees cuentas, publiques contenido ni uses credenciales externas sin autorización explícita.
- No agregues analítica invasiva, publicidad ni funciones fuera del MVP.
- Mantén todo el material del proyecto dentro de `D:\AlCorte`; no modifiques archivos ajenos al proyecto.
- Al terminar, entrega resumen en español: funciones implementadas, cómo ejecutar, pruebas realizadas, estado del despliegue y cualquier bloqueo concreto.
