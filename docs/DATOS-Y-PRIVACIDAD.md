# Datos y privacidad

La reserva solicita nombre, teléfono, servicio e instante solicitado; no pide email, documento ni dirección. El teléfono se normaliza a dígitos con prefijo `+`. El token de administración de la reserva es aleatorio de 256 bits y solo se almacena como hash. No se pone en enlaces ni URLs. El código corto sirve para identificar ante el local, no autoriza consulta ni cambios.

El uso de datos se limita a coordinar el turno. La pantalla informa ese propósito y pide aceptación del aviso. El dueño debe facilitar canales para acceso/corrección/borrado conforme a la normativa uruguaya aplicable; este documento no es dictamen legal. Definir un plazo operativo de retención y borrar/anonomizar datos históricos cuando ya no sean necesarios. Los logs técnicos no incluyen los campos de cliente.

Producción debe usar HTTPS, secretos del proveedor, backups cifrados y acceso restringido. Revisar las obligaciones aplicables ante asesoramiento local antes de operar con clientes reales.
