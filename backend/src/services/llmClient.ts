import { createAnthropic } from "@ai-sdk/anthropic";
import {
  generateText,
  Output,
  stepCountIs,
  ToolLoopAgent,
  type LanguageModel,
  type ProviderMetadata,
  type SystemModelMessage
} from "ai";
import type { AgentDebug, AnalysisResult, ExternalSignals, IncomingMessage } from "../schemas/analysis.js";
import { AnalysisResultSchema } from "../schemas/analysis.js";
import { ANTHROPIC_CACHED_FRAUD_CONTEXT, buildFraudPrompt, FRAUD_DETECTOR_SYSTEM } from "../prompts/fraudDetector.js";
import { redactSensitiveText } from "./redaction.js";

const LLM_TIMEOUT_MS = Number(process.env.LLM_TIMEOUT_MS ?? 20000);
const LLM_MAX_OUTPUT_TOKENS = Number(process.env.LLM_MAX_OUTPUT_TOKENS ?? 1600);
const LLM_OUTPUT_MODE = (process.env.LLM_OUTPUT_MODE ?? "structured").toLowerCase();
const DIRECT_CLAUDE_MODEL = "claude-sonnet-4-6";
const GATEWAY_CLAUDE_MODEL = "anthropic/claude-sonnet-4.6";
const ANTHROPIC_CACHE_CONTROL = {
  anthropic: { cacheControl: { type: "ephemeral" } }
} as const;

type ResolvedModel = {
  model: LanguageModel;
  modelRole: string;
  label: string;
  usedClaude: boolean;
};

function strictJsonPrompt(message: IncomingMessage, signals: ExternalSignals, agentTrace: AgentDebug) {
  return `${buildFraudPrompt(message, signals, agentTrace)}

IMPORTANTE: devuelve JSON estricto valido, sin markdown, sin comentarios, sin trailing commas.`;
}

function systemPromptFor(resolved: ResolvedModel): string | SystemModelMessage {
  if (!resolved.usedClaude) return FRAUD_DETECTOR_SYSTEM;

  return {
    role: "system",
    content: ANTHROPIC_CACHED_FRAUD_CONTEXT,
    providerOptions: ANTHROPIC_CACHE_CONTROL
  };
}

function commonGenerationOptions(resolved: ResolvedModel, message: IncomingMessage, signals: ExternalSignals, agentTrace: AgentDebug) {
  return {
    model: resolved.model,
    system: systemPromptFor(resolved),
    prompt: strictJsonPrompt(message, signals, agentTrace),
    maxOutputTokens: LLM_MAX_OUTPUT_TOKENS,
    temperature: 0,
    timeout: LLM_TIMEOUT_MS
  };
}

function structuredProviderOptions(resolved: ResolvedModel) {
  if (!resolved.usedClaude) return undefined;

  return {
    anthropic: {
      structuredOutputMode: "outputFormat"
    }
  };
}

async function runStructuredFraudAnalyzerAgent(
  resolved: ResolvedModel,
  message: IncomingMessage,
  signals: ExternalSignals,
  agentTrace: AgentDebug
) {
  const agent = new ToolLoopAgent({
    id: "nettoxic-fraud-analyzer",
    model: resolved.model,
    instructions: systemPromptFor(resolved),
    maxOutputTokens: LLM_MAX_OUTPUT_TOKENS,
    temperature: 0,
    timeout: LLM_TIMEOUT_MS,
    stopWhen: stepCountIs(1),
    providerOptions: structuredProviderOptions(resolved),
    output: Output.object({
      schema: AnalysisResultSchema,
      name: "fraud_analysis",
      description: "Nettoxic fixed JSON fraud analysis result"
    })
  });

  return agent.generate({
    prompt: strictJsonPrompt(message, signals, agentTrace)
  });
}

function numericMetadata(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function recordMetadata(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;
}

function anthropicDebugMetadata(resolved: ResolvedModel, providerMetadata: ProviderMetadata | undefined) {
  if (!resolved.usedClaude) return undefined;

  const anthropic = recordMetadata(providerMetadata?.anthropic);
  const usage = recordMetadata(anthropic?.usage);

  return {
    promptCaching: true,
    cacheControl: "ephemeral" as const,
    cacheCreationInputTokens: numericMetadata(
      anthropic?.cacheCreationInputTokens ?? usage?.cache_creation_input_tokens
    ),
    cacheReadInputTokens: numericMetadata(usage?.cache_read_input_tokens)
  };
}

function parseJsonObject(text: string) {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  if (firstBrace < 0 || lastBrace < firstBrace) {
    throw new Error("llm_json_not_found");
  }

  return JSON.parse(cleaned.slice(firstBrace, lastBrace + 1));
}

function asObjectOutput(output: unknown): Record<string, unknown> {
  if (!output || typeof output !== "object" || Array.isArray(output)) {
    throw new Error("llm_output_not_object");
  }

  return output as Record<string, unknown>;
}

function hasGatewayAuth() {
  return Boolean(process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN);
}

function isClaudeModel(model: string) {
  return model.includes("claude") || model.startsWith("anthropic/");
}

function gatewayModel(configuredModel?: string) {
  return configuredModel?.includes("/") ? configuredModel : GATEWAY_CLAUDE_MODEL;
}

function directAnthropicModel(configuredModel?: string) {
  return configuredModel && !configuredModel.includes("/") ? configuredModel : DIRECT_CLAUDE_MODEL;
}

function roleModelEnvKey(modelRole: string) {
  return `MODEL_${modelRole.toUpperCase().replace(/[^A-Z0-9]+/g, "_")}`;
}

function configuredModelForRole(modelRole: string) {
  return process.env[roleModelEnvKey(modelRole)] ?? process.env.LLM_MODEL ?? process.env.ANTHROPIC_MODEL;
}

function resolveModel(modelRole: string): ResolvedModel | null {
  const provider = (process.env.LLM_PROVIDER ?? "auto").toLowerCase();
  if (provider === "off" || provider === "offline" || provider === "none") return null;

  const configuredModel = configuredModelForRole(modelRole);

  if (provider === "gateway") {
    if (!hasGatewayAuth()) return null;
    const model = gatewayModel(configuredModel);
    return { model: model as LanguageModel, modelRole, label: `gateway:${model}`, usedClaude: isClaudeModel(model) };
  }

  if (provider === "anthropic") {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return null;
    const model = directAnthropicModel(configuredModel);
    return {
      model: createAnthropic({ apiKey })(model),
      modelRole,
      label: `anthropic:${model}`,
      usedClaude: true
    };
  }

  if (hasGatewayAuth() && configuredModel?.includes("/")) {
    return {
      model: configuredModel as LanguageModel,
      modelRole,
      label: `gateway:${configuredModel}`,
      usedClaude: isClaudeModel(configuredModel)
    };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (apiKey) {
    const model = directAnthropicModel(configuredModel);
    return {
      model: createAnthropic({ apiKey })(model),
      modelRole,
      label: `anthropic:${model}`,
      usedClaude: true
    };
  }

  if (hasGatewayAuth()) {
    const model = gatewayModel(configuredModel);
    return { model: model as LanguageModel, modelRole, label: `gateway:${model}`, usedClaude: isClaudeModel(model) };
  }

  return null;
}

export async function analyzeWithLlm(
  message: IncomingMessage,
  signals: ExternalSignals,
  agentTrace: AgentDebug
): Promise<AnalysisResult | null> {
  const resolved = resolveModel(agentTrace.modelRole);
  if (!resolved) return null;

  const redactedMessage = {
    ...message,
    content: redactSensitiveText(message.content)
  };

  let output: unknown;
  let providerMetadata: ProviderMetadata | undefined;
  if (LLM_OUTPUT_MODE === "structured") {
    try {
      const structured = await runStructuredFraudAnalyzerAgent(resolved, redactedMessage, signals, agentTrace);
      output = structured.output;
      providerMetadata = structured.providerMetadata;
    } catch (error) {
      console.warn("Structured LLM output failed, retrying JSON text mode", error instanceof Error ? error.message : error);
      const textResult = await generateText(commonGenerationOptions(resolved, redactedMessage, signals, agentTrace));
      output = parseJsonObject(textResult.text);
      providerMetadata = textResult.providerMetadata;
    }
  } else {
    const textResult = await generateText(commonGenerationOptions(resolved, redactedMessage, signals, agentTrace));
    output = parseJsonObject(textResult.text);
    providerMetadata = textResult.providerMetadata;
  }

  return AnalysisResultSchema.parse({
    ...asObjectOutput(output),
    fuentes_externas: {
      phishtank: signals.phishtank,
      cmf: signals.cmf,
      urlhaus: signals.urlhaus
    },
    debug: {
      modelRole: resolved.modelRole,
      model: resolved.label,
      usedClaude: resolved.usedClaude,
      anthropic: anthropicDebugMetadata(resolved, providerMetadata),
      urls: signals.urls,
      embedding: {
        provider: signals.embeddingProvider ?? "local-pattern-embedding-v1",
        score: signals.embeddingScore,
        category: signals.embeddingCategory ?? null,
        label: signals.embeddingLabel ?? null,
        evidence: signals.embeddingEvidence ?? null,
        matches: signals.embeddingMatches ?? []
      },
      agent: agentTrace
    }
  });
}
