import type { z } from "zod";
import type {
  AgentDecisionContractSchema,
  AgentPlanContextSchema,
  AgentToolCallContractSchema,
  SignalAgentContextSchema,
  SignalAgentIdSchema,
  SignalAgentOutputSchema,
  SignalOrchestratorResultSchema
} from "./contracts.js";

export type SignalAgentId = z.infer<typeof SignalAgentIdSchema>;
export type AgentToolCall = z.infer<typeof AgentToolCallContractSchema>;
export type AgentDecision = z.infer<typeof AgentDecisionContractSchema>;
export type AgentPlanContext = z.infer<typeof AgentPlanContextSchema>;
export type SignalAgentContext = z.infer<typeof SignalAgentContextSchema>;
export type SignalAgentOutput = z.infer<typeof SignalAgentOutputSchema>;
export type SignalOrchestratorResult = z.infer<typeof SignalOrchestratorResultSchema>;
