import { lookupPhishTank } from "../services/phishtankSignals.js";
import { lookupUrlhaus } from "../services/urlhausSignals.js";
import type { SignalAgentContext, SignalAgentOutput } from "./types.js";

export async function runUrlReputationAgent(context: SignalAgentContext): Promise<SignalAgentOutput> {
  const urls = context.planContext.urls;
  const [urlhaus, phishtank] = await Promise.all([
    lookupUrlhaus(urls),
    lookupPhishTank(urls)
  ]);

  return {
    agent: "url_reputation",
    signals: {
      phishtank: phishtank.matched,
      urlhaus: urlhaus.matched,
      urls,
      suspiciousDomains: context.planContext.suspiciousDomains,
      phishtankChecked: phishtank.checked,
      phishtankMatches: phishtank.matches.map((match) =>
        `${match.url}${match.phishId ? ` (#${match.phishId})` : ""}${match.verified ? " verified" : ""}`
      ),
      urlhausChecked: urlhaus.checked,
      urlhausMatches: urlhaus.matches.map((match) => `${match.url} (${match.status}, ${match.threat})`)
    },
    toolCalls: [
      {
        agent: "url_reputation",
        tool: "extract_urls",
        status: "completed",
        output: `${urls.length} url(s)`
      },
      {
        agent: "url_reputation",
        tool: "inspect_domains",
        status: "completed",
        output: context.planContext.suspiciousDomains.join(", ") || "sin dominios sospechosos"
      },
      {
        agent: "url_reputation",
        tool: "lookup_urlhaus",
        status: urlhaus.checked ? "completed" : "skipped",
        reason: urlhaus.checked ? undefined : "URLHAUS_AUTH_KEY no configurado o sin URLs.",
        output: urlhaus.matched ? urlhaus.matches.map((match) => match.url).join(", ") : "sin match"
      },
      {
        agent: "url_reputation",
        tool: "lookup_phishtank",
        status: phishtank.checked ? "completed" : phishtank.errors.length > 0 ? "failed" : "skipped",
        reason: phishtank.checked
          ? undefined
          : phishtank.errors.length > 0
            ? phishtank.errors.join("; ")
            : "Sin URLs para consultar en PhishTank.",
        output: phishtank.matched ? phishtank.matches.map((match) => match.url).join(", ") : "sin match"
      }
    ],
    summary: phishtank.matched
      ? "PhishTank reporto al menos una URL verificada como phishing."
      : urlhaus.matched
        ? "URLhaus reporto al menos una URL activa."
        : context.planContext.suspiciousDomains.length > 0
          ? "Dominio localmente sospechoso, sin match externo confirmado."
          : "URLs sin reputacion externa confirmada."
  };
}
