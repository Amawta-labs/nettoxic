import { ExternalSignalsSchema, type ExternalSignals, type IncomingMessage } from "../schemas/analysis.js";
import { runEmbeddingPatternAgent } from "./embeddingPatternAgent.js";
import { runEntityIntelAgent } from "./entityIntelAgent.js";
import {
  AgentDecisionListSchema,
  SignalAgentContextSchema,
  SignalAgentOutputSchema,
  SignalOrchestratorResultSchema
} from "./contracts.js";
import { buildAgentPlanContext, planSignalAgents } from "./plannerAgent.js";
import { runRuleSignalAgent } from "./ruleSignalAgent.js";
import { runUrlReputationAgent } from "./urlReputationAgent.js";
import type {
  AgentDecision,
  AgentToolCall,
  SignalAgentContext,
  SignalAgentId,
  SignalAgentOutput,
  SignalOrchestratorResult
} from "./types.js";

const MODEL_ROLE = "fraud_analyzer";

const AGENT_RUNNERS: Partial<Record<SignalAgentId, (context: SignalAgentContext) => Promise<SignalAgentOutput>>> = {
  url_reputation: runUrlReputationAgent,
  entity_intel: runEntityIntelAgent,
  embedding_patterns: runEmbeddingPatternAgent,
  rule_signals: runRuleSignalAgent
};

function baseSignals(context: SignalAgentContext): ExternalSignals {
  return {
    phishtank: false,
    cmf: false,
    urlhaus: false,
    embeddingScore: 0,
    embeddingProvider: "local-pattern-embedding-v1",
    embeddingCategory: null,
    embeddingLabel: null,
    embeddingEvidence: null,
    embeddingMatches: [],
    urls: context.planContext.urls,
    suspiciousDomains: context.planContext.suspiciousDomains,
    phishtankChecked: false,
    phishtankMatches: [],
    urlhausChecked: false,
    urlhausMatches: [],
    cmfChecked: false,
    cmfMatches: []
  };
}

function skippedToolCalls(decisions: AgentDecision[]): AgentToolCall[] {
  const toolCalls = decisions
    .filter((decision) => !decision.run)
    .flatMap((decision) =>
      decision.tools.map((tool) => ({
        agent: decision.agent,
        tool,
        status: "skipped" as const,
        reason: decision.reason
      }))
    );

  return toolCalls;
}

async function runSelectedAgents(context: SignalAgentContext, decisions: AgentDecision[]): Promise<SignalAgentOutput[]> {
  const validatedContext = SignalAgentContextSchema.parse(context);
  const runnable = decisions.filter((decision) => decision.run && AGENT_RUNNERS[decision.agent]);

  return Promise.all(
    runnable.map(async (decision) => {
      const runner = AGENT_RUNNERS[decision.agent];
      if (!runner) {
        const skipped: SignalAgentOutput = {
          agent: decision.agent,
          toolCalls: decision.tools.map((tool) => ({
            agent: decision.agent,
            tool,
            status: "skipped" as const,
            reason: "No hay runner implementado para este agente."
          }))
        };
        return SignalAgentOutputSchema.parse(skipped);
      }

      try {
        return SignalAgentOutputSchema.parse(await runner(validatedContext));
      } catch (error) {
        const failed: SignalAgentOutput = {
          agent: decision.agent,
          toolCalls: decision.tools.map((tool) => ({
            agent: decision.agent,
            tool,
            status: "failed" as const,
            reason: error instanceof Error ? error.message : "Error desconocido"
          })),
          summary: `${decision.agent} fallo; se continua con señales disponibles.`
        };
        return SignalAgentOutputSchema.parse(failed);
      }
    })
  );
}

export async function runFraudSignalOrchestrator(message: IncomingMessage): Promise<SignalOrchestratorResult> {
  const planContext = buildAgentPlanContext(message);
  const context = SignalAgentContextSchema.parse({ message, planContext });
  const decisions = AgentDecisionListSchema.parse(planSignalAgents(message, planContext));
  const outputs = await runSelectedAgents(context, decisions);
  const signals = ExternalSignalsSchema.parse(
    outputs.reduce<ExternalSignals>(
      (accumulator, output) => ({ ...accumulator, ...output.signals }),
      baseSignals(context)
    )
  );
  const entity = outputs.find((output) => output.entity)?.entity ?? null;
  const selectedAgents = decisions.filter((decision) => decision.run).map((decision) => decision.agent);
  const skippedAgents = decisions.filter((decision) => !decision.run).map((decision) => decision.agent);
  const tools = [...outputs.flatMap((output) => output.toolCalls), ...skippedToolCalls(decisions)];
  const summary = outputs.flatMap((output) => output.summary ? [output.summary] : []);

  return SignalOrchestratorResultSchema.parse({
    signals,
    entity,
    trace: {
      orchestrator: "nettoxic-signal-orchestrator-v1",
      modelRole: MODEL_ROLE,
      execution: "parallel",
      selectedAgents,
      skippedAgents,
      decisions,
      tools,
      summary
    }
  });
}
