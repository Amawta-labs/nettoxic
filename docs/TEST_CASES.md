# Casos de prueba

Casos ejecutables hoy con `cd backend && npm test`:

1. BancoEstado falso con dominio `.click`, urgencia y solicitud de clave.
2. SII falso con amenaza de multa y dominio `.xyz`.
3. Email legitimo Mercado Libre sin link sospechoso.
4. Dominio adversarial tipo `fakebancoestado.cl`.
5. Texto con acentos: `contraseña`, `suspensión`, `retención`.
6. Correos falso con paquete retenido y pago pendiente.
7. Premio/bono falso con validacion de identidad.
8. Soporte falso con acceso remoto.
9. Transferencia urgente o pago retenido.

Casos pendientes para ampliar antes de entrega:

10. Mensaje manual benigno sin entidad financiera.
11. Mensaje real anonimizando datos sensibles.

La salida de cada caso incluye `debug.embedding`, que muestra el motor local, score de similitud,
patron mas cercano y top matches. Esta senal es predictiva/local, no una fuente externa verificada.
