# Ingest real

## SMS Android

Artefactos versionados:

- `mobile/plugins/withNettoxicSmsIngest.js`
- `mobile/native/android/NettoxicSmsReceiver.java`
- `mobile/app.json`

Flujo:

1. `npx expo prebuild --platform android --no-install` aplica el plugin.
2. El plugin agrega `RECEIVE_SMS`, `READ_SMS`, `POST_NOTIFICATIONS`, receiver y metadata.
3. La app pide permisos runtime desde `Activar monitoreo SMS`.
4. Al llegar `SMS_RECEIVED`, Android invoca `NettoxicSmsReceiver`.
5. El receiver llama `POST /ingest/sms`.
6. Backend normaliza, ejecuta el orquestador y guarda el resultado en `/inbox`.
7. Si `score >= 35`, el receiver muestra notificacion local.

Para demo por USB:

```bash
adb reverse tcp:8787 tcp:8787
cd mobile
npx expo prebuild --platform android --no-install
npx expo run:android
```

El receiver usa por defecto:

```text
http://127.0.0.1:8787/ingest/sms
```

Para produccion, cambiar `ingestUrl` en `mobile/app.json` a HTTPS.

## Gmail

Artefactos versionados:

- `backend/src/routes/gmail.ts`
- `backend/src/ingest/gmailClient.ts`
- `backend/src/ingest/gmailTokenStore.ts`

Variables:

```bash
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=https://TU_BACKEND/gmail/oauth2/callback
GMAIL_PUBSUB_TOPIC=projects/TU_PROYECTO/topics/nettoxic-gmail
GMAIL_PUBSUB_VERIFICATION_TOKEN=
GMAIL_TOKEN_STORE_FILE=data/gmail-accounts.json
```

Flujo:

1. `GET /gmail/auth-url?userId=...` genera URL OAuth.
2. `/gmail/oauth2/callback` guarda refresh token localmente con modo `0600`.
3. `POST /gmail/watch` registra `users.watch` sobre `INBOX`.
4. Gmail publica en Pub/Sub `emailAddress` + `historyId`.
5. `POST /gmail/pubsub?token=...` recibe el push.
6. Backend usa `history.list`, descarga mensajes nuevos, limpia HTML y ejecuta el orquestador.
7. Si el score supera `PUSH_RISK_THRESHOLD`, backend envia una notificacion push al telefono
   registrado del usuario.

Endpoints auxiliares:

```bash
POST /gmail/sync       # re-sincroniza manualmente por historyId
GET  /gmail/accounts   # lista cuentas sin exponer tokens
```

## Alertas push tipo "antes del clic"

Artefactos versionados:

- `backend/src/routes/devices.ts`
- `backend/src/services/deviceStore.ts`
- `backend/src/services/pushNotifications.ts`
- `mobile/src/notifications/riskAlerts.ts`

Flujo:

1. La app pide permiso de notificaciones desde `Activar alertas automaticas`.
2. Expo entrega un `ExpoPushToken`.
3. La app registra el token en `POST /devices/register`.
4. Gmail/PubSub dispara `/gmail/pubsub`.
5. Backend sincroniza Gmail, analiza el correo y guarda el item.
6. Si `score >= PUSH_RISK_THRESHOLD`, backend envia Expo Push con `itemId`.
7. Al tocar la notificacion, la app abre `analysis/[id]`.

Variables backend:

```bash
DEVICE_TOKEN_STORE_FILE=data/device-tokens.json
PUSH_NOTIFICATIONS_ENABLED=true
PUSH_RISK_THRESHOLD=35
```

Variables mobile:

```bash
EXPO_PUBLIC_API_BASE_URL=http://127.0.0.1:8787
EXPO_PUBLIC_NETTOXIC_USER_ID=daslav
EXPO_PUBLIC_EAS_PROJECT_ID=TU_EAS_PROJECT_ID
```

Nota: para push remoto real en Android se requiere un build con credenciales push/Firebase
configuradas por EAS o equivalente. Sin `EXPO_PUBLIC_EAS_PROJECT_ID`, la app mantiene Gmail/SMS
funcional pero no puede registrar el token remoto.

## Audio / WhatsApp

Artefactos versionados:

- `backend/src/routes/ingest.ts`
- `backend/src/services/audioTranscription.ts`

Flujo:

1. El cliente extrae un archivo de audio autorizado por el usuario, por ejemplo una nota de WhatsApp compartida con Awki.
2. Envía `POST /ingest/audio` con `mediaType`, `filename` y `audioBase64`.
3. El backend transcribe con ElevenLabs Speech to Text (`scribe_v2` por defecto), o acepta `transcript`
   si el cliente ya hizo STT on-device.
4. La transcripción se normaliza como `IncomingMessage` con `source: "audio"`.
5. El orquestador evalúa urgencia, solicitud de datos, suplantación, enlaces, CMF/PhishTank/URLhaus y embeddings.
6. Si supera el umbral de riesgo, se envía push al teléfono registrado.

Payload mínimo:

```json
{
  "id": "wa-audio-1",
  "sender": "WhatsApp",
  "filename": "nota.opus",
  "mediaType": "audio/opus",
  "audioBase64": "<base64>",
  "languageCode": "es"
}
```

Si el proveedor STT está bloqueado o se prefiere privacidad local, el cliente puede enviar:

```json
{
  "id": "wa-audio-1",
  "sender": "WhatsApp",
  "filename": "nota.opus",
  "transcript": "Texto transcrito localmente",
  "languageCode": "es"
}
```
