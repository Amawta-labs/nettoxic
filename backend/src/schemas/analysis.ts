import { z } from "zod";

export const IncomingMessageSchema = z.object({
  id: z.string().optional(),
  source: z.enum(["email", "sms", "manual", "screenshot", "audio", "app_message"]).default("manual"),
  sender: z.string().optional(),
  subject: z.string().optional(),
  content: z.string().min(1)
});

export const REQUIRED_SIGNAL_KEYS = [
  "urgencia_artificial",
  "solicitud_credenciales",
  "dominio_no_oficial",
  "suplantacion_entidad",
  "amenaza_consecuencia",
  "redireccion_sospechosa"
] as const;

export const FraudSignalSchema = z.object({
  key: z.enum(REQUIRED_SIGNAL_KEYS),
  label: z.string(),
  present: z.boolean(),
  evidence: z.string().optional()
});

export const ExternalSignalsSchema = z.object({
  phishtank: z.boolean(),
  cmf: z.boolean(),
  urlhaus: z.boolean(),
  ruleSignalHints: z.array(FraudSignalSchema).optional(),
  embeddingScore: z.number().min(0).max(1),
  embeddingProvider: z.string().optional(),
  embeddingCategory: z.string().nullable().optional(),
  embeddingLabel: z.string().nullable().optional(),
  embeddingEvidence: z.string().nullable().optional(),
  embeddingMatches: z.array(z.string()).optional(),
  urls: z.array(z.string()),
  suspiciousDomains: z.array(z.string()),
  phishtankChecked: z.boolean().optional(),
  phishtankMatches: z.array(z.string()).optional(),
  urlhausChecked: z.boolean().optional(),
  urlhausMatches: z.array(z.string()).optional(),
  cmfChecked: z.boolean().optional(),
  cmfMatches: z.array(z.string()).optional()
});

export const EmbeddingDebugSchema = z.object({
  provider: z.string(),
  score: z.number().min(0).max(1),
  category: z.string().nullable(),
  label: z.string().nullable(),
  evidence: z.string().nullable(),
  matches: z.array(z.string())
});

export const AgentDebugSchema = z.object({
  orchestrator: z.string(),
  modelRole: z.string(),
  execution: z.enum(["parallel", "sequential"]),
  selectedAgents: z.array(z.string()),
  skippedAgents: z.array(z.string()),
  decisions: z.array(z.object({
    agent: z.string(),
    run: z.boolean(),
    reason: z.string(),
    tools: z.array(z.string())
  })),
  tools: z.array(z.object({
    agent: z.string(),
    tool: z.string(),
    status: z.enum(["completed", "skipped", "failed"]),
    reason: z.string().optional(),
    output: z.string().optional()
  })),
  summary: z.array(z.string())
});

export const AnthropicDebugSchema = z.object({
  promptCaching: z.boolean(),
  cacheControl: z.enum(["ephemeral"]),
  cacheCreationInputTokens: z.number().optional(),
  cacheReadInputTokens: z.number().optional()
});

export const AnalysisResultSchema = z
  .object({
    score: z.number().int().min(0).max(100),
    nivel: z.enum(["bajo", "medio", "alto", "critico"]),
    senales_detectadas: z.array(FraudSignalSchema),
    entidad_suplantada: z.string().nullable(),
    explicacion: z.string(),
    pasos: z.array(z.string()),
    fuentes_externas: z.object({
      phishtank: z.boolean(),
      cmf: z.boolean(),
      urlhaus: z.boolean()
    }),
    debug: z
      .object({
        modelRole: z.string().optional(),
        model: z.string(),
        usedClaude: z.boolean(),
        anthropic: AnthropicDebugSchema.optional(),
        urls: z.array(z.string()),
        embedding: EmbeddingDebugSchema.optional(),
        agent: AgentDebugSchema.optional()
      })
      .optional()
  })
  .superRefine((value, ctx) => {
    const keys = value.senales_detectadas.map((signal) => signal.key);
    for (const requiredKey of REQUIRED_SIGNAL_KEYS) {
      if (!keys.includes(requiredKey)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `missing required signal ${requiredKey}`,
          path: ["senales_detectadas"]
        });
      }
    }
  });

export type IncomingMessage = z.infer<typeof IncomingMessageSchema>;
export type FraudSignal = z.infer<typeof FraudSignalSchema>;
export type ExternalSignals = z.infer<typeof ExternalSignalsSchema>;
export type AnalysisResult = z.infer<typeof AnalysisResultSchema>;
export type AgentDebug = z.infer<typeof AgentDebugSchema>;
