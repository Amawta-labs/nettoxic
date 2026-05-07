# Hackathon Rubric Checklist

## Uso de Claude y arquitectura agentica

Status in repo:

- System prompt exists in `system_prompt.txt` and `backend/src/prompts/fraudDetector.ts`.
- Prompt is domain-specific, over 200 characters, and mentions CMF, SII and Ley 21.719.
- Tool schemas exist in root `tools.json`.
- Local validation command: `cd backend && npm run rubric:check`.
- Runtime orchestration exists in `backend/src/agents/orchestratorAgent.ts`.
- Model abstraction exists in `backend/src/services/llmClient.ts` through Vercel AI SDK.
- Anthropic tool to mark in Bendi: `Prompt Caching`.
  `backend/src/services/llmClient.ts` sends the fixed fraud system prompt with
  `providerOptions.anthropic.cacheControl = { type: "ephemeral" }` whenever the
  resolved model is Claude, and exposes cache metadata under `debug.anthropic`.
- Public-source tools are real and separated from predictions:
  `lookup_phishtank`, `lookup_urlhaus`, `lookup_cmf_alerts`.
- Embeddings are used as a predictive similarity tool only; they do not mutate
  verified-source booleans.

External evidence still required:

- Anthropic Console must show at least three Claude messages inside May 6-7, 2026.
- Capture screenshots from Anthropic Console with timestamps.
- Use `docs/ANTHROPIC_CONSOLE_EVIDENCE.md` for exact messages.
- If using API evidence, run `cd backend && npm run anthropic:evidence` with
  `ANTHROPIC_API_KEY` configured. It writes a local JSONL trace to
  `backend/data/anthropic-evidence.jsonl` and should also create Anthropic
  Console usage entries for the three Messages API calls.
- In the Bendi "Herramientas Anthropic usadas" chips, select `Prompt Caching`.
  Do not select MCP, Agent SDK, Files API, Computer Use, Citations or Extended
  Thinking unless those are added as real runtime integrations.

## Funciona

Current backend demo path:

1. Gmail or SMS event enters the backend.
2. Orchestrator selects signal agents.
3. URL reputation, entity, embeddings and rules run in parallel when applicable.
4. Final evaluator returns fixed JSON.
5. Backend records the inbox item.
6. Expo push notification is sent to the registered phone.

Minimum video flow:

- Show suspicious input arriving or being submitted.
- Show phone notification before click.
- Open the app and show risk score.
- Show signals detected.
- Show recommended actions.
- Show backend JSON or logs proving input to output.
