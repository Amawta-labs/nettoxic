# Privacidad

- No recolectar RUT.
- No recolectar claves, tokens ni datos bancarios.
- Guardar solo texto minimo para analisis y reporte confirmado.
- Los reportes persistidos guardan `messageId`, confirmacion, notas opcionales e instante; no guardan el cuerpo del mensaje.
- Los eventos reales persistidos para `/inbox` guardan remitente, asunto opcional, preview y resultado de analisis; no guardan el cuerpo completo.
- Redactar o resumir evidencia sensible en logs de demo.
- Antes de llamar a Claude, redactar patrones obvios de RUT, tarjetas, codigos y claves.
- Cuando el rol `fraud_analyzer` este habilitado, el texto redactado del mensaje y las señales
  estructuradas se envian via Vercel AI SDK al modelo configurado por `MODEL_FRAUD_ANALYZER`
  o `LLM_MODEL`.
- Cuando `URLHAUS_AUTH_KEY` este configurado, solo las URLs extraidas se envian a URLhaus para lookup de malware URL.
- Los embeddings de patrones se calculan localmente; no envian el mensaje a un proveedor externo.
- Gmail usa OAuth con scope minimo `gmail.readonly` para `users.watch`/history sync. Los refresh tokens se guardan en `GMAIL_TOKEN_STORE_FILE` con modo 0600 y el archivo queda ignorado por git.
- SMS real en Android requiere permisos `RECEIVE_SMS`, `READ_SMS` y `POST_NOTIFICATIONS`. El receiver nativo envia el contenido del SMS al backend configurado para analisis inmediato.
- Alertas push guardan solo `userId`, plataforma, version de app y Expo Push Token en `DEVICE_TOKEN_STORE_FILE` con modo 0600. El cuerpo enviado a Expo contiene score, nivel, asunto/rotulo y `itemId`, no el cuerpo completo del correo.
