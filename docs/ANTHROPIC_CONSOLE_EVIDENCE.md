# Anthropic Console Evidence

The rubric requires at least three Anthropic Console messages inside the valid
event window: May 6, 2026 00:00 through May 7, 2026 23:59 Chile time.

These messages must be executed in the Anthropic Console with Claude selected.
Do not fabricate screenshots or timestamps. Capture the console view showing
the timestamp and the response.

## API Evidence Runner

If the Console accepts API activity as usage evidence, run the three calls from
the backend with the same production path used by the app:

```bash
cd backend
export ANTHROPIC_API_KEY
npm run anthropic:evidence
```

The command forces `LLM_PROVIDER=anthropic` and `LLM_OUTPUT_MODE=structured`,
uses the `fraud_analyzer` `ToolLoopAgent`, validates the fixed JSON contract,
and writes a local trace to `backend/data/anthropic-evidence.jsonl`.
That JSONL is ignored by git because it is event evidence, not source code.
Still capture Anthropic Console screenshots showing the three API calls and
timestamps inside May 6-7, 2026.

## Message 1

Use `system_prompt.txt` as the system prompt and send:

```text
SMS recibido:
BancoEstado informa bloqueo preventivo. Valida tu clave hoy en https://bancoestado-seguro.click/login para evitar suspension.
```

Expected result: JSON with high or critical risk, BancoEstado impersonation,
urgency, credential request, suspicious domain and unsafe link.

## Message 2

Use `system_prompt.txt` as the system prompt and send:

```text
Correo recibido:
SII informa multa pendiente. Regularice hoy ingresando con su clave tributaria en https://sii-pagos.xyz
```

Expected result: JSON with SII impersonation, threat, credential request and
suspicious link.

## Message 3

Use `system_prompt.txt` as the system prompt and send:

```text
Mensaje recibido:
Correos de Chile: paquete retenido por pago pendiente. Pague despacho en https://correos-verifica.xyz
```

Expected result: JSON with Correos de Chile impersonation, payment pressure and
suspicious link.

## Screenshot Checklist

- Console is Anthropic Console, not our app logs.
- Claude model name is visible or clearly implied by the console.
- Timestamp falls within May 6-7, 2026.
- At least three separate user messages are visible.
- The system prompt or prompt setup is visible in at least one screenshot.
- Save screenshots for the technical delivery packet.

## Anthropic Tool Chip

For "Herramientas Anthropic usadas", mark `Prompt Caching`.
The backend applies Anthropic cache control to the fixed fraud system prompt
when the resolved model is Claude. Runtime evidence appears in API responses
under `debug.anthropic.promptCaching`.
