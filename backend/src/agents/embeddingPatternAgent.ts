import { fraudPatternEmbeddingMatch } from "../services/embeddingSignals.js";
import type { SignalAgentContext, SignalAgentOutput } from "./types.js";

export async function runEmbeddingPatternAgent(context: SignalAgentContext): Promise<SignalAgentOutput> {
  const embedding = fraudPatternEmbeddingMatch(context.message.content);

  return {
    agent: "embedding_patterns",
    signals: {
      embeddingScore: embedding.score,
      embeddingProvider: embedding.provider,
      embeddingCategory: embedding.category,
      embeddingLabel: embedding.label,
      embeddingEvidence: embedding.evidence,
      embeddingMatches: embedding.matches.map((match) => `${match.label} (${match.score})`)
    },
    toolCalls: [
      {
        agent: "embedding_patterns",
        tool: "match_pattern_embeddings",
        status: "completed",
        output: embedding.label ? `${embedding.label} (${embedding.score})` : `sin patron fuerte (${embedding.score})`
      }
    ],
    summary: embedding.label
      ? `Patron similar: ${embedding.label} (${Math.round(embedding.score * 100)}%).`
      : "Sin patron de fraude fuerte por embeddings."
  };
}
