import type { IncomingMessage } from "../schemas/analysis.js";
import { extractUrls, inspectUrls } from "../services/urlSignals.js";
import { AgentDecisionListSchema, AgentPlanContextSchema } from "./contracts.js";
import type { AgentDecision, AgentPlanContext } from "./types.js";

const ENTITY_HINT_PATTERN = /banco|bancoestado|sii|impuestos|afp|correos|cmf|falabella|mercado|santander|credito|prestamo|inversion/i;

export function buildAgentPlanContext(message: IncomingMessage): AgentPlanContext {
  const urls = extractUrls(message.content);
  const urlInspection = inspectUrls(urls);

  return AgentPlanContextSchema.parse({
    urls,
    suspiciousDomains: urlInspection.suspiciousDomains,
    hasImagePayload: message.source === "screenshot"
  });
}

export function planSignalAgents(message: IncomingMessage, context: AgentPlanContext): AgentDecision[] {
  const hasUrls = context.urls.length > 0;
  const hasEnoughText = message.content.trim().length >= 12;
  const hasEntityHint = ENTITY_HINT_PATTERN.test(`${message.sender ?? ""} ${message.subject ?? ""} ${message.content}`);

  return AgentDecisionListSchema.parse([
    {
      agent: "url_reputation",
      run: hasUrls,
      reason: hasUrls
        ? "El mensaje contiene URL; se requiere reputacion y analisis de dominio."
        : "No hay URL extraida; se omite reputacion externa de enlaces.",
      tools: ["extract_urls", "inspect_domains", "lookup_urlhaus", "lookup_phishtank"]
    },
    {
      agent: "entity_intel",
      run: hasEntityHint,
      reason: hasEntityHint
        ? "Hay indicios de entidad chilena, finanzas, comercio o gobierno."
        : "No hay indicios claros de entidad chilena o financiera.",
      tools: ["detect_chilean_entity", "lookup_cmf_alerts"]
    },
    {
      agent: "embedding_patterns",
      run: hasEnoughText,
      reason: hasEnoughText
        ? "Hay texto suficiente para comparar contra patrones de fraude."
        : "Texto demasiado corto para similitud semantica confiable.",
      tools: ["match_pattern_embeddings"]
    },
    {
      agent: "rule_signals",
      run: hasEnoughText,
      reason: hasEnoughText
        ? "Hay texto suficiente para evaluar reglas de seguridad."
        : "Texto demasiado corto para reglas de seguridad.",
      tools: ["detect_security_rules"]
    },
    {
      agent: "vision_ocr",
      run: false,
      reason: context.hasImagePayload
        ? "Fuente screenshot detectada, pero el MVP aun no recibe binarios de imagen."
        : "La entrada no es screenshot; no se requiere OCR/Vision.",
      tools: ["extract_text_from_screenshot", "vision_risk_hints"]
    }
  ]);
}
