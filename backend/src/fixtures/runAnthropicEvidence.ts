import "dotenv/config";
import { appendFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import type { IncomingMessage } from "../schemas/analysis.js";

const OUTPUT_FILE = resolve(import.meta.dirname, "../../data/anthropic-evidence.jsonl");
const EVENT_START_MS = Date.parse("2026-05-06T00:00:00-04:00");
const EVENT_END_MS = Date.parse("2026-05-07T23:59:59-04:00");

const evidenceCases: Array<{ id: string; input: IncomingMessage }> = [
  {
    id: "bancoestado-blocked-account",
    input: {
      source: "sms",
      sender: "BancoEstado",
      subject: "SMS recibido",
      content: "BancoEstado informa bloqueo preventivo. Valida tu clave hoy en https://bancoestado-seguro.click/login para evitar suspension."
    }
  },
  {
    id: "sii-tax-fine",
    input: {
      source: "email",
      sender: "notificaciones@sii-pagos.xyz",
      subject: "Correo recibido",
      content: "SII informa multa pendiente. Regularice hoy ingresando con su clave tributaria en https://sii-pagos.xyz"
    }
  },
  {
    id: "correos-package-held",
    input: {
      source: "sms",
      sender: "Correos de Chile",
      subject: "Mensaje recibido",
      content: "Correos de Chile: paquete retenido por pago pendiente. Pague despacho en https://correos-verifica.xyz"
    }
  }
];

function chileTimestamp(date: Date) {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "America/Santiago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).format(date);
}

function assertAnthropicConfigured() {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY no configurado. Define la variable sin guardarla en git y vuelve a correr npm run anthropic:evidence.");
  }
}

async function main() {
  assertAnthropicConfigured();
  process.env.LLM_PROVIDER = "anthropic";
  process.env.LLM_OUTPUT_MODE = "structured";
  process.env.MODEL_FRAUD_ANALYZER = process.env.MODEL_FRAUD_ANALYZER || process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";

  const { analyzeMessage } = await import("../services/orchestrator.js");
  await mkdir(resolve(import.meta.dirname, "../../data"), { recursive: true });

  for (const item of evidenceCases) {
    const startedAt = new Date();
    const result = await analyzeMessage(item.input);
    const record = {
      id: item.id,
      executedAt: startedAt.toISOString(),
      executedAtChile: chileTimestamp(startedAt),
      withinEventWindow: startedAt.getTime() >= EVENT_START_MS && startedAt.getTime() <= EVENT_END_MS,
      model: result.debug?.model,
      usedClaude: result.debug?.usedClaude,
      anthropic: result.debug?.anthropic,
      score: result.score,
      nivel: result.nivel,
      senales: result.senales_detectadas.map((signal) => ({
        key: signal.key,
        present: signal.present
      })),
      fuentes_externas: result.fuentes_externas,
      agent: {
        orchestrator: result.debug?.agent?.orchestrator,
        execution: result.debug?.agent?.execution,
        selectedAgents: result.debug?.agent?.selectedAgents,
        toolCount: result.debug?.agent?.tools.length,
        tools: result.debug?.agent?.tools.map((tool) => `${tool.agent}.${tool.tool}:${tool.status}`)
      }
    };

    if (!record.usedClaude) {
      throw new Error(`El caso ${item.id} no uso Claude. Revisa LLM_PROVIDER, MODEL_FRAUD_ANALYZER y ANTHROPIC_API_KEY.`);
    }

    await appendFile(OUTPUT_FILE, `${JSON.stringify(record)}\n`, { encoding: "utf8" });
    console.log(JSON.stringify(record, null, 2));
  }

  console.log(`Evidencia local escrita en ${OUTPUT_FILE}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
