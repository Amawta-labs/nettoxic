# Nettoxic Remote Demo Runbook

## Backend

Railway service:

- Project: `observant-adaptation`
- Service: `nettoxic-backend`
- Public base URL: `https://nettoxic-backend-production.up.railway.app`
- Health endpoint: `GET /health`

The backend deploy is configured in `backend/railway.json`.

Required Railway variables are configured in the service environment. Do not
commit secrets. Railway injects `PORT`; the app listens on `0.0.0.0:$PORT`.

For the accessibility voice alert, configure these backend-only variables in
Railway:

- `TTS_PROVIDER=auto`
- `ELEVENLABS_API_KEY`
- `ELEVENLABS_MODEL_ID=eleven_flash_v2_5`
- `ELEVENLABS_VOICE_ID=JBFqnCBsd6RMkjVDRZzb`
- `ELEVENLABS_OUTPUT_FORMAT=mp3_44100_128`
- `ELEVENLABS_STT_MODEL_ID=scribe_v2`
- `AUDIO_TRANSCRIPTION_MAX_BYTES=15728640`
- `GEMINI_API_KEY` as optional fallback
- `GEMINI_TTS_MODEL=gemini-3.1-flash-tts-preview`
- `GEMINI_TTS_VOICE=Kore`

With `TTS_PROVIDER=auto`, production tries ElevenLabs first and falls back to
Gemini if ElevenLabs rejects the request, keeping the live demo audible.

## External Signals

The orchestrator treats public sources and predictions as different evidence
classes:

- PhishTank: exact URL lookup through the free check URL API. `PHISHTANK_API_KEY`
  is optional and only raises rate limits.
- URLhaus: exact URL lookup through abuse.ch URLhaus. `URLHAUS_AUTH_KEY` is a
  free key but is required by the official API.
- CMF: public Alertas CMF list at
  `https://www.cmfchile.cl/portal/principal/613/w3-article-49185.html`, cached
  by `CMF_CACHE_TTL_MS`. Matches are conservative: domain or listed entity name.
- Embeddings: local semantic similarity against fraud patterns. This is a
  predictive signal and never turns on `phishtank`, `urlhaus` or `cmf`.

## Gmail Push

Google Pub/Sub subscription:

- Project: `project-7959db32-f61b-415f-833`
- Topic: `projects/project-7959db32-f61b-415f-833/topics/nettoxic-gmail`
- Subscription: `nettoxic-gmail-push`
- Push endpoint: `https://nettoxic-backend-production.up.railway.app/gmail/pubsub?token=<redacted>`

The OAuth redirect URI that must be authorized in Google Cloud is:

```text
https://nettoxic-backend-production.up.railway.app/gmail/oauth2/callback
```

After OAuth succeeds, call:

```bash
POST https://nettoxic-backend-production.up.railway.app/gmail/watch
{ "userId": "daslav" }
```

This tells Gmail to publish new inbox changes to Pub/Sub.

## Mobile Build

The remote APK uses the `preview` EAS profile.

Public build-time values are in `mobile/eas.json`:

- `EXPO_PUBLIC_API_BASE_URL`
- `EXPO_PUBLIC_SMS_INGEST_URL`
- `EXPO_PUBLIC_NETTOXIC_USER_ID`
- `EXPO_PUBLIC_EAS_PROJECT_ID`

`google-services.json` is intentionally not committed. EAS receives it through
the `GOOGLE_SERVICES_JSON` file environment variable.

Build:

```bash
cd mobile
npx eas-cli build --platform android --profile preview --non-interactive
```

Local fallback build:

```bash
cd mobile
npx expo prebuild --platform android --clean --npm
cd android
./gradlew assembleRelease
```

Local APK output:

```text
mobile/android/app/build/outputs/apk/release/app-release.apk
```

After installing the APK, open the app once and activate alerts so the Expo push
token is registered against the Railway backend.

## Current Persistence Note

The hackathon backend stores Gmail accounts, device tokens and inbox records in
JSON files. This is enough for a single demo deployment, but a production
deployment should move these stores to Postgres/Supabase or a Railway volume
before relying on redeploy-safe persistence.
