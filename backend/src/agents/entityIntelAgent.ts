import { detectImpersonatedEntity, lookupCmfAlerts } from "../services/cmfSignals.js";
import type { SignalAgentContext, SignalAgentOutput } from "./types.js";

export async function runEntityIntelAgent(context: SignalAgentContext): Promise<SignalAgentOutput> {
  const entity = detectImpersonatedEntity([
    context.message.sender,
    context.message.subject,
    context.message.content
  ].filter(Boolean).join(" "));
  const cmf = await lookupCmfAlerts(context.message, context.planContext.urls);

  return {
    agent: "entity_intel",
    entity: entity.entity,
    signals: {
      cmf: cmf.matched,
      cmfChecked: cmf.checked,
      cmfMatches: cmf.matches.map((match) => `${match.entity} (${match.category}, ${match.matchedBy})`)
    },
    toolCalls: [
      {
        agent: "entity_intel",
        tool: "detect_chilean_entity",
        status: "completed",
        output: entity.entity ?? "sin entidad detectada"
      },
      {
        agent: "entity_intel",
        tool: "lookup_cmf_alerts",
        status: cmf.checked ? "completed" : "failed",
        reason: cmf.checked ? undefined : cmf.errors.join("; "),
        output: cmf.matched ? cmf.matches.map((match) => match.evidence).join(" | ") : "sin match"
      }
    ],
    summary: cmf.matched
      ? `CMF alertas: ${cmf.matches.length} match(es).`
      : entity.entity
        ? `Entidad mencionada: ${entity.entity}; sin match CMF.`
        : "Sin entidad chilena detectada ni match CMF."
  };
}
