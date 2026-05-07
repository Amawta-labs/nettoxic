# Nettoxic

Agente antifraude ciudadano para detectar phishing financiero chileno antes del clic.

## Estructura

- `backend/`: API Node.js/TypeScript para analisis, bandeja y reportes.
- `mobile/`: app Expo/React Native para correr nativamente en Android.
- `docs/`: prompt, casos de prueba, privacidad y guion de demo.

Estado actual: MVP con bandeja sintetica y analisis de texto. Las fuentes externas se consultan
cuando hay datos y credenciales disponibles; `fuentes_externas` solo queda en `true` cuando hay
match real. El backend ya incluye embeddings locales sobre un corpus de patrones de fraude chileno
para estimar similitud y exponer el patron mas cercano. Claude puede correr via Vercel AI SDK con
structured outputs; si no hay credenciales, el backend usa fallback heuristico para mantener la demo
operativa sin inventar uso de LLM.

## Arquitectura agentica

`POST /analyze` entra por un orquestador de señales:

1. `plannerAgent` revisa canal, texto y URLs, y decide que sub-agentes ejecutar.
2. Los sub-agentes seleccionados corren en paralelo:
   - `url_reputation`: URLs, dominios sospechosos, URLhaus y PhishTank.
   - `entity_intel`: entidad chilena mencionada y Alertas CMF.
   - `embedding_patterns`: similitud contra patrones locales de fraude.
   - `rule_signals`: seis reglas de seguridad del schema.
3. El agregador valida contratos Zod de plan, decisiones, tools, salidas y traza.
4. `fraud_analyzer` es un `ToolLoopAgent` de AI SDK con `Output.object({ schema: AnalysisResultSchema })`.
5. Sin credenciales LLM, cae a fallback heuristico marcado como `heuristic-fallback`.

La traza queda en `debug.agent`: plan, agentes ejecutados/omitidos, herramientas, resultados y rol de modelo.
El archivo `tools.json` expone los contratos `input_schema` y `output_schema` para auditoria.

## Ingest real

Nettoxic recibe señales reales antes del análisis por adaptadores de canal:

- SMS Android: `BroadcastReceiver` nativo versionado en `mobile/native/android/NettoxicSmsReceiver.java`.
  El plugin `mobile/plugins/withNettoxicSmsIngest.js` inyecta permisos, receiver y URL de ingest en Android.
  Al llegar un SMS, el receiver llama `POST /ingest/sms`, recibe el análisis y emite una notificación local si
  el riesgo es medio o superior.
- Gmail: backend con OAuth, `users.watch`, Pub/Sub push y `history.list`.
  El webhook `POST /gmail/pubsub` procesa `emailAddress` + `historyId`, descarga mensajes nuevos, limpia HTML,
  normaliza a `IncomingMessage` y ejecuta el orquestador.
- `/inbox` mezcla bandeja demo con eventos reales persistidos en `INGESTED_INBOX_FILE`.

Ver pasos operativos en `docs/INGEST.md`.

## Primer flujo local

Backend:

```bash
cd backend
npm install
npm run dev
```

Mobile:

```bash
cd mobile
npm install
npx expo start --android
```

Flujo demo en app:

1. Abrir la bandeja.
2. Tocar `Analizar mensaje manual`.
3. Pegar un SMS, correo o enlace sospechoso.
4. Ejecutar el analisis contra `/analyze` y mostrar el detalle.

Para telefono real por USB:

```bash
adb devices
adb reverse tcp:8787 tcp:8787
cd mobile
npx expo run:android
```

Si no usas `adb reverse`, define `EXPO_PUBLIC_API_BASE_URL` con la IP LAN del PC antes de iniciar Expo.
Para SMS real por USB, el receiver nativo usa por defecto `http://127.0.0.1:8787/ingest/sms`, por lo que
tambien requiere `adb reverse tcp:8787 tcp:8787`.

Para usar mocks sin backend:

```bash
EXPO_PUBLIC_USE_MOCKS=true npx expo start --android
```

## Variables Backend

Copiar `backend/.env.example` a `backend/.env` y configurar:

- `LLM_PROVIDER`: `auto`, `anthropic`, `gateway` u `off`.
- `LLM_MODEL`: modelo activo. Ejemplos: `claude-sonnet-4-20250514` para Anthropic directo,
  `anthropic/claude-sonnet-4.5` para Vercel AI Gateway.
- `MODEL_FRAUD_ANALYZER`: modelo para el rol evaluador final. Permite usar hoy un modelo Gateway
  tipo `openai/gpt-5.4` y cambiar luego a `anthropic/claude-sonnet-4.5` sin tocar codigo.
- `LLM_OUTPUT_MODE`: `structured` usa `ToolLoopAgent` + `Output.object`; `json-text` mantiene el
  modo de texto JSON con validacion posterior.
- `REPORTS_FILE`: ruta JSONL local para reportes confirmados. Default: `data/reports.jsonl`.
- `INGESTED_INBOX_FILE`: ruta JSON local para eventos reales analizados. Default: `data/ingested-inbox.json`.
- `INGEST_API_KEY`: opcional. Si esta configurado, `POST /ingest/*` exige `X-Nettoxic-Ingest-Key`.
- `ANTHROPIC_API_KEY`
- `AI_GATEWAY_API_KEY`, solo si se usa Vercel AI Gateway localmente.
- `TTS_PROVIDER`, `auto`, `elevenlabs` o `gemini`. Default efectivo: ElevenLabs si hay key.
- `ELEVENLABS_API_KEY`, para generar audio TTS corto de alertas de accesibilidad.
- `ELEVENLABS_MODEL_ID`, default `eleven_flash_v2_5`.
- `ELEVENLABS_VOICE_ID`, default `JBFqnCBsd6RMkjVDRZzb`.
- `GEMINI_API_KEY`, fallback opcional para generar audio TTS desde el backend.
- `GEMINI_TTS_MODEL`, default `gemini-3.1-flash-tts-preview`.
- `GEMINI_TTS_VOICE`, default `Kore`.
- `URLHAUS_AUTH_KEY`, requerido para consultar URLhaus.
- `PHISHTANK_API_KEY`, opcional para mejorar cuota/atribucion en PhishTank.
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`.
- `GMAIL_PUBSUB_TOPIC`: topic Pub/Sub usado por `users.watch`.
- `GMAIL_PUBSUB_VERIFICATION_TOKEN`: token compartido opcional para `POST /gmail/pubsub?token=...`.
- `GMAIL_TOKEN_STORE_FILE`: archivo local 0600 para refresh tokens Gmail. Default: `data/gmail-accounts.json`.

`LLM_PROVIDER=auto` usa Gateway si `LLM_MODEL` viene como `provider/model` y hay credencial
Gateway; si no, usa Claude directo cuando `ANTHROPIC_API_KEY` existe. Sin credenciales LLM,
`/analyze` cae al fallback heuristico y lo muestra como `heuristic-fallback`.

URLhaus se usa como fuente verificable de URLs de malware. No debe presentarse como una
base general de phishing: `fuentes_externas.urlhaus` solo queda `true` cuando la API fue
consultada con `URLHAUS_AUTH_KEY` y devolvio match.

La capa de embeddings no requiere credenciales externas: genera vectores locales por hashing de
tokens, n-gramas y conceptos de fraude, compara contra patrones como suplantacion bancaria, SII,
paquete retenido, premio falso, soporte falso y transferencia urgente, y devuelve la similitud en
`debug.embedding`.

La voz de alerta usa `POST /speech/risk-alert`: el telefono recibe `speakText` en la push,
solicita audio corto al backend y lo reproduce localmente. Con `TTS_PROVIDER=auto`, el backend
intenta ElevenLabs primero y cae a Gemini si el proveedor rechaza la generacion. Las claves
ElevenLabs/Gemini nunca se exponen en Expo.

## Variables Mobile

Configurar antes de iniciar Expo cuando corresponda:

- `EXPO_PUBLIC_API_BASE_URL`
- `EXPO_PUBLIC_USE_MOCKS`
