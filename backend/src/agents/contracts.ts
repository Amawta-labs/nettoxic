import { z } from "zod";
import {
  ExternalSignalsSchema,
  FraudSignalSchema,
  IncomingMessageSchema
} from "../schemas/analysis.js";

export const SignalAgentIdSchema = z.enum([
  "url_reputation",
  "entity_intel",
  "embedding_patterns",
  "rule_signals",
  "vision_ocr"
]);

export const SignalToolNameSchema = z.enum([
  "extract_urls",
  "inspect_domains",
  "lookup_urlhaus",
  "lookup_phishtank",
  "detect_chilean_entity",
  "lookup_cmf_alerts",
  "match_pattern_embeddings",
  "detect_security_rules",
  "extract_text_from_screenshot",
  "vision_risk_hints"
]);

export const AgentToolCallContractSchema = z.object({
  agent: SignalAgentIdSchema,
  tool: SignalToolNameSchema,
  status: z.enum(["completed", "skipped", "failed"]),
  reason: z.string().optional(),
  output: z.string().optional()
});

export const AgentDecisionContractSchema = z.object({
  agent: SignalAgentIdSchema,
  run: z.boolean(),
  reason: z.string().min(1),
  tools: z.array(SignalToolNameSchema).min(1)
});

export const AgentPlanContextSchema = z.object({
  urls: z.array(z.string()),
  suspiciousDomains: z.array(z.string()),
  hasImagePayload: z.boolean()
});

export const SignalAgentContextSchema = z.object({
  message: IncomingMessageSchema,
  planContext: AgentPlanContextSchema
});

export const SignalAgentOutputSchema = z.object({
  agent: SignalAgentIdSchema,
  signals: ExternalSignalsSchema.partial().optional(),
  entity: z.string().nullable().optional(),
  ruleSignals: z.array(FraudSignalSchema).optional(),
  toolCalls: z.array(AgentToolCallContractSchema).min(1),
  summary: z.string().optional()
});

export const OrchestratorTraceContractSchema = z.object({
  orchestrator: z.string().min(1),
  modelRole: z.string().min(1),
  execution: z.enum(["parallel", "sequential"]),
  selectedAgents: z.array(SignalAgentIdSchema),
  skippedAgents: z.array(SignalAgentIdSchema),
  decisions: z.array(AgentDecisionContractSchema),
  tools: z.array(AgentToolCallContractSchema),
  summary: z.array(z.string())
});

export const SignalOrchestratorResultSchema = z.object({
  signals: ExternalSignalsSchema,
  entity: z.string().nullable(),
  trace: OrchestratorTraceContractSchema
});

export const AgentDecisionListSchema = z.array(AgentDecisionContractSchema);
export const SignalAgentOutputListSchema = z.array(SignalAgentOutputSchema);
