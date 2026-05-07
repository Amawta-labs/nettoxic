import type { AgentDebug, AnalysisResult, ExternalSignals, FraudSignal, IncomingMessage } from "../schemas/analysis.js";
import { AnalysisResultSchema } from "../schemas/analysis.js";
import { runFraudSignalOrchestrator } from "../agents/orchestratorAgent.js";
import { analyzeWithLlm } from "./llmClient.js";
import { normalizeSpanish } from "./redaction.js";

const analysisCache = new Map<string, AnalysisResult>();

function cacheKey(message: IncomingMessage) {
  return JSON.stringify({
    id: message.id,
    source: message.source,
    sender: message.sender,
    subject: message.subject,
    content: message.content
  });
}

function boolSignal(key: FraudSignal["key"], label: string, present: boolean, evidence = ""): FraudSignal {
  return { key, label, present, evidence };
}

function level(score: number): AnalysisResult["nivel"] {
  if (score >= 85) return "critico";
  if (score >= 65) return "alto";
  if (score >= 35) return "medio";
  return "bajo";
}

function embeddingDebug(signals: ExternalSignals) {
  return {
    provider: signals.embeddingProvider ?? "local-pattern-embedding-v1",
    score: signals.embeddingScore,
    category: signals.embeddingCategory ?? null,
    label: signals.embeddingLabel ?? null,
    evidence: signals.embeddingEvidence ?? null,
    matches: signals.embeddingMatches ?? []
  };
}

function fallbackRuleSignals(message: IncomingMessage, signals: ExternalSignals, entity: string | null): FraudSignal[] {
  const text = normalizeSpanish(message.content);
  const urgency = /urgente|hoy|inmediato|24 horas|ultimo aviso|vence|sera suspendida|sera bloqueada/.test(text);
  const credentials = /clave|contrasena|password|token|codigo|pin|rut|datos|identidad|bancari|verifica|valid/.test(text);
  const unofficial = signals.suspiciousDomains.length > 0 || /gmail\.com|hotmail\.com|outlook\.com/.test(message.sender ?? "");
  const threat = /bloque|suspend|suspension|multa|deuda|retencion|cerrada|inhabilitada/.test(text);
  const impersonation = Boolean(entity && (urgency || credentials || unofficial || threat));
  const redirect =
    signals.urls.length > 0 && (signals.suspiciousDomains.length > 0 || /login|secure|verifica|valid|bit\.ly|click/.test(text));

  return [
    boolSignal("urgencia_artificial", "Urgencia artificial", urgency, urgency ? "Presiona a actuar rapido." : ""),
    boolSignal("solicitud_credenciales", "Solicitud de credenciales o datos personales", credentials, credentials ? "Pide validar datos o clave." : ""),
    boolSignal("dominio_no_oficial", "Dominio o remitente no oficial", unofficial, signals.suspiciousDomains.join(", ")),
    boolSignal("suplantacion_entidad", "Suplantacion de entidad chilena", impersonation, impersonation ? (entity ?? "") : ""),
    boolSignal("amenaza_consecuencia", "Amenaza de consecuencia", threat, threat ? "Menciona bloqueo, multa o retencion." : ""),
    boolSignal("redireccion_sospechosa", "Link de redireccion sospechoso", redirect, signals.urls.join(", "))
  ];
}

function heuristicAnalyze(
  message: IncomingMessage,
  signals: ExternalSignals,
  entity: string | null,
  agentTrace: AgentDebug
): AnalysisResult {
  const ruleSignals = signals.ruleSignalHints ?? fallbackRuleSignals(message, signals, entity);
  const present = (key: FraudSignal["key"]) => ruleSignals.find((signal) => signal.key === key)?.present ?? false;
  const urgency = present("urgencia_artificial");
  const credentials = present("solicitud_credenciales");
  const unofficial = present("dominio_no_oficial");
  const impersonation = present("suplantacion_entidad");
  const threat = present("amenaza_consecuencia");
  const redirect = present("redireccion_sospechosa");
  const impersonationEvidence = ruleSignals.find((signal) => signal.key === "suplantacion_entidad")?.evidence;
  const impersonatedEntity = entity ?? (impersonationEvidence || null);
  const knownPattern = signals.embeddingScore >= 0.5;
  const verifiedUrlThreat = signals.phishtank || signals.urlhaus;
  const verifiedCmfAlert = signals.cmf;

  const rawScore =
    Number(urgency) * 12 +
    Number(credentials) * 18 +
    Number(unofficial) * 18 +
    Number(impersonation) * 14 +
    Number(threat) * 14 +
    Number(redirect) * 12 +
    Number(signals.phishtank) * 30 +
    Number(signals.urlhaus) * 30 +
    Number(signals.cmf) * 26 +
    Math.round(signals.embeddingScore * 18) +
    Number(knownPattern) * 6;
  const embeddingRiskFloor = signals.embeddingScore >= 0.85 ? 45 : signals.embeddingScore >= 0.65 ? 35 : 0;
  const externalRiskFloor = verifiedUrlThreat ? 85 : verifiedCmfAlert ? 65 : 0;
  const score = Math.min(100, Math.max(rawScore, embeddingRiskFloor, externalRiskFloor));
  const patternSentence =
    signals.embeddingLabel && signals.embeddingScore >= 0.34
      ? ` Se parece al patron conocido: ${signals.embeddingLabel}.`
      : "";
  const externalSentence = verifiedUrlThreat
    ? " Una fuente externa verifico el enlace como riesgoso."
    : verifiedCmfAlert
      ? " La entidad o dominio aparece en Alertas CMF."
      : "";

  return AnalysisResultSchema.parse({
    score,
    nivel: level(score),
    senales_detectadas: ruleSignals,
    entidad_suplantada: impersonation ? impersonatedEntity : null,
    explicacion:
      score >= 65
        ? `El mensaje combina senales de riesgo.${externalSentence}${patternSentence} No ingreses credenciales ni abras el link desde este mensaje.`
        : score >= 35
          ? `El mensaje tiene algunas senales de riesgo.${patternSentence} Verifica entrando manualmente al sitio oficial de la entidad.`
          : "No aparecen senales fuertes de fraude, pero revisa remitente y enlaces antes de actuar.",
    pasos:
      score >= 65
        ? ["No abras el enlace.", "No entregues claves ni codigos.", "Entra manualmente al sitio oficial o llama al canal verificado.", "Reporta el caso."]
        : ["Revisa el remitente.", "Abre la entidad solo desde su sitio oficial.", "No compartas claves por mensaje."],
    fuentes_externas: {
      phishtank: signals.phishtank,
      cmf: signals.cmf,
      urlhaus: signals.urlhaus
    },
    debug: {
      modelRole: agentTrace.modelRole,
      model: "heuristic-fallback",
      usedClaude: false,
      urls: signals.urls,
      embedding: embeddingDebug(signals),
      agent: agentTrace
    }
  });
}

export async function analyzeMessage(message: IncomingMessage): Promise<AnalysisResult> {
  const key = cacheKey(message);
  const cached = analysisCache.get(key);
  if (cached) return cached;

  const { signals, entity, trace } = await runFraudSignalOrchestrator(message);
  const llmResult = await analyzeWithLlm(message, signals, trace).catch((error) => {
    console.error("LLM analysis failed, using fallback", error);
    return null;
  });

  const result = llmResult ?? heuristicAnalyze(message, signals, entity, trace);
  analysisCache.set(key, result);
  return result;
}
