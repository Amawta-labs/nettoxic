import type { FraudSignal } from "../schemas/analysis.js";
import { detectImpersonatedEntity } from "../services/cmfSignals.js";
import { normalizeSpanish } from "../services/redaction.js";
import type { SignalAgentContext, SignalAgentOutput } from "./types.js";

function boolSignal(key: FraudSignal["key"], label: string, present: boolean, evidence = ""): FraudSignal {
  return { key, label, present, evidence };
}

export function detectRuleSignals(context: SignalAgentContext): FraudSignal[] {
  const message = context.message;
  const text = normalizeSpanish(message.content);
  const entity = detectImpersonatedEntity(message.content).entity;
  const urgency = /urgente|hoy|inmediato|24 horas|ultimo aviso|vence|sera suspendida|sera bloqueada/.test(text);
  const credentials = /clave|contrasena|password|token|codigo|pin|rut|datos|identidad|bancari|verifica|valid/.test(text);
  const unofficial =
    context.planContext.suspiciousDomains.length > 0 ||
    /gmail\.com|hotmail\.com|outlook\.com/.test(message.sender ?? "");
  const threat = /bloque|suspend|suspension|multa|deuda|retencion|cerrada|inhabilitada/.test(text);
  const impersonation = Boolean(entity && (urgency || credentials || unofficial || threat));
  const redirect =
    context.planContext.urls.length > 0 &&
    (context.planContext.suspiciousDomains.length > 0 || /login|secure|verifica|valid|bit\.ly|click/.test(text));

  return [
    boolSignal("urgencia_artificial", "Urgencia artificial", urgency, urgency ? "Presiona a actuar rapido." : ""),
    boolSignal("solicitud_credenciales", "Solicitud de credenciales o datos personales", credentials, credentials ? "Pide validar datos o clave." : ""),
    boolSignal("dominio_no_oficial", "Dominio o remitente no oficial", unofficial, context.planContext.suspiciousDomains.join(", ")),
    boolSignal("suplantacion_entidad", "Suplantacion de entidad chilena", impersonation, impersonation ? (entity ?? "") : ""),
    boolSignal("amenaza_consecuencia", "Amenaza de consecuencia", threat, threat ? "Menciona bloqueo, multa o retencion." : ""),
    boolSignal("redireccion_sospechosa", "Link de redireccion sospechoso", redirect, context.planContext.urls.join(", "))
  ];
}

export async function runRuleSignalAgent(context: SignalAgentContext): Promise<SignalAgentOutput> {
  const ruleSignals = detectRuleSignals(context);
  const presentCount = ruleSignals.filter((signal) => signal.present).length;

  return {
    agent: "rule_signals",
    ruleSignals,
    signals: {
      ruleSignalHints: ruleSignals
    },
    toolCalls: [
      {
        agent: "rule_signals",
        tool: "detect_security_rules",
        status: "completed",
        output: `${presentCount} de ${ruleSignals.length} senales presentes`
      }
    ],
    summary: `${presentCount} senal(es) de reglas locales.`
  };
}
