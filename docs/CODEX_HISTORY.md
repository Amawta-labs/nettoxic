# Codex history - Nettoxic

Fecha de trabajo: 2026-05-05, hora Chile (-04).

## Contexto inicial

Nettoxic es un agente antifraude ciudadano para el hackathon Claude Impact Lab Chile 2026,
linea Ciberseguridad Ciudadana. El objetivo del MVP es correr nativamente en Android y
demostrar analisis de phishing antes del clic.

Restricciones relevantes:

- Entrega tecnica: 2026-05-07 17:00 hora Chile.
- Ventana valida de commits indicada por el equipo: 2026-05-06 00:00 a 2026-05-07 23:59.
- Claude debe ser el motor principal cuando este configurado.
- No recolectar RUT, claves ni datos bancarios.
- No presentar fuentes externas como verificadas si no se consultaron realmente.

## Decisiones tomadas

- App movil: Expo / React Native, porque permite llegar rapido a APK/dev build Android.
- Backend: Node.js / TypeScript / Express.
- Demo en telefono: Android conectado por USB con ADB.
- Conectividad demo: `adb reverse tcp:8787 tcp:8787`, app apuntando por defecto a `http://127.0.0.1:8787`.
- SMS real, Gmail OAuth y screenshots quedaron fuera del primer MVP; se documentan como pendientes.
- Bandeja actual es sintetica, no Gmail real.
- PhishTank, CMF y URLhaus quedan en `false` hasta implementar clientes reales. Las senales actuales son heuristicas locales.

## Scaffold creado

Rutas principales:

- `backend/src/index.ts`: API Express y rutas.
- `backend/src/routes/analyze.ts`: `POST /analyze`.
- `backend/src/routes/inbox.ts`: `GET /inbox` con bandeja demo.
- `backend/src/routes/report.ts`: `POST /report`.
- `backend/src/services/orchestrator.ts`: orquestacion, cache, scoring y fallback.
- `backend/src/services/llmClient.ts`: llamada LLM via Vercel AI SDK, Claude directo/Gateway, timeout, system prompt y redaccion previa.
- `backend/src/services/urlSignals.ts`: extraccion y heuristica de URLs/dominios.
- `backend/src/services/redaction.ts`: normalizacion de espanol y redaccion basica.
- `mobile/app/index.tsx`: bandeja.
- `mobile/app/analysis/[id].tsx`: detalle de analisis.
- `mobile/app/action.tsx`: pasos y reporte.
- `mobile/src/state/InboxContext.tsx`: store compartido para evitar refetch por pantalla.

## Red team ejecutado

Se corrio una revision paralela con subagentes sobre:

1. Backend/API/scoring.
2. Mobile/demo Android/ADB.
3. Privacidad/entregable hackathon.

Hallazgos criticos y correcciones aplicadas:

- Fuentes externas estaban sobreprometidas. Se corrigio para no marcar PhishTank/CMF/URLhaus como matches falsos.
- Fallback mock silencioso en mobile podia simular backend vivo. Se corrigio: mocks solo con `EXPO_PUBLIC_USE_MOCKS=true`; si falla backend, la UI muestra error.
- Cada pantalla reconsultaba `/inbox`. Se agrego `InboxProvider` para cargar una vez y reutilizar estado.
- `fakebancoestado.cl` pasaba como dominio oficial por `endsWith`. Se corrigio con boundary exacto/subdominio.
- Acentos bajaban deteccion (`contraseña`, `suspensión`). Se agrego normalizacion NFD.
- Claude podia recibir PII en bruto. Se agrego redaccion basica antes de enviar a Anthropic.
- Prompt injection: se movio la politica a `system`, se delimito el mensaje como no confiable y se sobreescriben fuentes externas deterministicas tras Claude.
- Schema aceptaba arrays incompletos de senales. Se exige presencia de las seis claves requeridas.
- Screenshot figuraba como soporte parcial pero no existia. Se removio del schema del MVP.

## Verificacion realizada

Backend:

```bash
cd /mnt/kairos-dev/nettoxic/backend
npm install
npm run build
npm test
node dist/index.js
curl -sS http://127.0.0.1:8787/health
curl -sS -X POST http://127.0.0.1:8787/analyze \
  -H 'Content-Type: application/json' \
  -d '{"source":"manual","content":"BancoEstado: valide su clave en https://fakebancoestado.cl/login para evitar bloqueo."}'
```

Resultados observados:

- `npm run build`: OK.
- `npm test`: OK fuera del sandbox, porque `tsx` necesita crear un pipe IPC en `/tmp`.
- `fakebancoestado.cl`: score alto, dominio no oficial detectado.
- Texto con acentos y `contraseña`: critico tras normalizacion.
- `/health`: `{"ok":true,"service":"nettoxic-backend"}`.

Mobile:

```bash
cd /mnt/kairos-dev/nettoxic/mobile
npm install
npm run typecheck
```

Resultado observado:

- `npm run typecheck`: OK.
- `npm install` de Expo reporto vulnerabilidades transitivas; no se ejecuto `npm audit fix --force` para no romper versiones.

## Comandos para demo Android

Terminal 1:

```bash
cd /mnt/kairos-dev/nettoxic/backend
npm run build
node dist/index.js
```

Terminal 2:

```bash
adb devices
adb reverse tcp:8787 tcp:8787
cd /mnt/kairos-dev/nettoxic/mobile
npx expo run:android
```

Modo mock explicito, solo si se quiere demo sin backend:

```bash
cd /mnt/kairos-dev/nettoxic/mobile
EXPO_PUBLIC_USE_MOCKS=true npx expo start --android
```

## Pendientes prioritarios

1. Integrar al menos una fuente real verificable: URLhaus es la mas directa para demo.
2. Agregar vista/input manual en mobile para probar un mensaje en vivo contra `/analyze`.
3. Agregar persistencia minima para `/report` o renombrarlo como acknowledgement local.
4. Preparar APK/dev build y probar en telefono real con ADB.
5. Decidir si se implementa OAuth Gmail minimo o se declara bandeja sintetica para demo tecnica.
6. Restaurar o revisar `/mnt/kairos-dev/README.md`, que quedo sobrescrito accidentalmente durante el primer patch fuera de `nettoxic`.

## Actualizacion LLM - 2026-05-06

- Se reemplazo el cliente Anthropic directo por Vercel AI SDK en `backend/src/services/llmClient.ts`.
- Variables nuevas: `LLM_PROVIDER` y `LLM_MODEL`.
- Modos soportados:
  - `LLM_PROVIDER=anthropic`: Claude directo con `ANTHROPIC_API_KEY`.
  - `LLM_PROVIDER=gateway`: Vercel AI Gateway con modelos tipo `anthropic/claude-sonnet-4.6`.
  - `LLM_PROVIDER=auto`: selecciona Gateway si hay modelo `provider/model` y credencial Gateway; si no, Claude directo con `ANTHROPIC_API_KEY`; si no hay credenciales, fallback heuristico.
- Se mantiene la regla de no inventar Claude: `debug.usedClaude` solo queda `true` para modelos Claude/Anthropic.
- `backend/src/services/llmClient.ts` usa `claude-sonnet-4-6` por defecto para Anthropic directo y timeout configurable por `LLM_TIMEOUT_MS`.
- `LLM_OUTPUT_MODE=json-text` es el modo estable de demo: Claude genera JSON estricto via AI SDK y el backend lo valida con Zod. `structured` queda disponible por env.

## Actualizacion URLhaus - 2026-05-06

- Se agrego `backend/src/services/urlhausSignals.ts`.
- URLhaus se consulta contra `https://urlhaus-api.abuse.ch/v1/url/` usando `URLHAUS_AUTH_KEY`.
- Si no hay `URLHAUS_AUTH_KEY`, `urlhaus` queda en `false` y `urlhausChecked=false`; no se presenta como match verificado.
- Alcance honesto: URLhaus verifica URLs asociadas a distribucion de malware; no es una base general de phishing. PhishTank sigue pendiente para phishing puro.

## Actualizacion input manual - 2026-05-06

- Se agrego `mobile/app/manual.tsx`.
- La home enlaza a "Analizar mensaje manual".
- La pantalla manual llama al endpoint real `/analyze` via `analyzeText()`, inserta el resultado en `InboxProvider` y navega al detalle existente.
- En `EXPO_PUBLIC_USE_MOCKS=true`, el analisis manual queda deshabilitado para no simular un backend real.

## Actualizacion reportes - 2026-05-06

- Se agrego `backend/src/services/reportStore.ts`.
- `POST /report` ahora persiste reportes minimos en JSONL local (`REPORTS_FILE`, default `data/reports.jsonl`).
- `GET /report` lista reportes recientes para inspeccion tecnica.
- Los JSONL generados quedan ignorados por git; no se guarda el cuerpo del mensaje reportado.

## Actualizacion embeddings - 2026-05-06

- Se reemplazo la similitud Jaccard de 5 frases por `local-pattern-embedding-v1`.
- El backend genera vectores locales por hashing de tokens, n-gramas y conceptos de fraude.
- El corpus cubre suplantacion bancaria, SII/multa, paquete retenido, premio falso, soporte falso,
  transferencia urgente, comercio/marketplace y prestamos/inversiones no autorizadas.
- `/analyze` incorpora la similitud al scoring y expone trazabilidad en `debug.embedding`.
- La app muestra el patron similar en la pantalla de detalle y en "Que hacer ahora".
- Esta capa no requiere credenciales ni envia el mensaje a proveedores externos.

## Actualizacion arquitectura agentica - 2026-05-06

- Se agrego `backend/src/agents/` con planner, orquestador y sub-agentes especializados.
- `plannerAgent` decide que correr segun canal, URLs, texto e indicios de entidad.
- Sub-agentes actuales: `url_reputation`, `entity_intel`, `embedding_patterns` y `rule_signals`.
- Los sub-agentes seleccionados se ejecutan en paralelo y el agregador produce señales estructuradas.
- El modelo evaluador final queda desacoplado como rol `fraud_analyzer`.
- Variable nueva: `MODEL_FRAUD_ANALYZER`, con fallback a `LLM_MODEL`.
- `debug.agent` expone plan, agentes ejecutados/omitidos, herramientas y resultados para demo/pitch.

## Actualizacion CMF real - 2026-05-06

- `backend/src/services/cmfSignals.ts` ahora consulta el listado publico de Alertas CMF.
- `entity_intel.lookup_cmf_alerts` marca `cmf=true` solo con match verificable por dominio o entidad listada.
- Se agregaron `cmfChecked` y `cmfMatches` para distinguir "consultado sin match" de "fuente no disponible".
- Los embeddings quedan como prediccion semantica independiente y no modifican `phishtank`, `urlhaus` ni `cmf`.

## Actualizacion ingest real - 2026-05-06

- Se agrego `POST /ingest/sms` y `POST /ingest/email`, con normalizacion a `IncomingMessage`.
- Se agrego persistencia de eventos reales analizados en `INGESTED_INBOX_FILE`; `/inbox` los muestra junto a la bandeja demo.
- Se agrego Gmail real: OAuth URL/callback, `POST /gmail/watch`, `POST /gmail/pubsub` y `POST /gmail/sync`.
- Gmail procesa Pub/Sub `emailAddress` + `historyId`, usa `history.list`, descarga correos nuevos y limpia HTML.
- Se agrego `mobile/plugins/withNettoxicSmsIngest.js` para inyectar permisos Android, receiver y URL de ingest durante prebuild.
- Se agrego receiver nativo Android `NettoxicSmsReceiver.java`: escucha `SMS_RECEIVED`, llama `/ingest/sms` y notifica riesgo medio/alto.
- La home movil pide permisos runtime de SMS/notificaciones con `Activar monitoreo SMS`.

## Actualizacion contratos agenticos - 2026-05-06

- Se agrego `backend/src/agents/contracts.ts` con contratos Zod runtime para agentes, tools, decisiones, contexto, salida de sub-agentes y traza del orquestador.
- `runFraudSignalOrchestrator` valida entradas/salidas antes de entregar señales al evaluador final.
- `fraud_analyzer` ahora corre como `ToolLoopAgent` de Vercel AI SDK con `Output.object({ schema: AnalysisResultSchema })`.
- `LLM_OUTPUT_MODE=structured` queda como default; `json-text` sigue disponible como respaldo.
- `tools.json` ahora declara `input_schema` y `output_schema` para PhishTank, URLhaus, CMF, embeddings y reglas locales.

## Nota sobre historial crudo

Existe historial global de Codex en `/home/daslav/.codex/history.jsonl`, pero no se copio al repo
porque contiene contexto global de la maquina y puede mezclar informacion ajena a Nettoxic.
Este archivo es el historial curado del trabajo relevante para el proyecto.
