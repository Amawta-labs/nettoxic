import type { IncomingMessage } from "../schemas/analysis.js";
import { normalizeSpanish } from "./redaction.js";

const CHILEAN_TARGETS = [
  "BancoEstado",
  "SII",
  "AFP",
  "Correos de Chile",
  "CMF",
  "Falabella",
  "Mercado Libre",
  "Banco de Chile",
  "Santander"
];

type CmfAlertRow = {
  date?: string;
  category: string;
  entity: string;
  urls: string[];
  hosts: string[];
  rawText: string;
};

export type CmfAlertMatch = {
  sourceUrl: string;
  category: string;
  entity: string;
  matchedBy: "domain" | "entity";
  evidence: string;
};

export type CmfLookupResult = {
  checked: boolean;
  matched: boolean;
  matches: CmfAlertMatch[];
  errors: string[];
  sourceUrl: string;
  fetchedAt?: string;
};

const DEFAULT_CMF_ALERTS_URL = "https://www.cmfchile.cl/portal/principal/613/w3-article-49185.html";
const CMF_TIMEOUT_MS = Number(process.env.CMF_TIMEOUT_MS ?? 6000);
const CMF_CACHE_TTL_MS = Number(process.env.CMF_CACHE_TTL_MS ?? 6 * 60 * 60 * 1000);
const URL_LIKE_PATTERN = /\b(?:https?:\/\/|www\.)[^\s<>"')]+/gi;
const DATE_PATTERN = /\b\d{2}\/\d{2}\/\d{4}\b/;

let cmfCache: {
  expiresAt: number;
  fetchedAt: string;
  rows: CmfAlertRow[];
} | null = null;

function cmfAlertsUrl() {
  return process.env.CMF_ALERTS_URL || DEFAULT_CMF_ALERTS_URL;
}

function decodeHtml(text: string) {
  return text
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_match, code: string) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_match, code: string) => String.fromCharCode(Number.parseInt(code, 16)));
}

function stripHtml(html: string) {
  return decodeHtml(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
  ).replace(/\s+/g, " ").trim();
}

function cleanUrlLike(value: string) {
  return value.trim().replace(/[.,;:!?]+$/g, "");
}

function extractUrlLikes(text: string) {
  const hrefs = Array.from(text.matchAll(/href=["']([^"']+)["']/gi), (match) => match[1])
    .filter((href) => /^https?:\/\//i.test(href) || /^www\./i.test(href));
  const inline = text.match(URL_LIKE_PATTERN) ?? [];
  return Array.from(new Set([...hrefs, ...inline].map(cleanUrlLike)));
}

function hostFromUrlLike(rawUrl: string) {
  const normalized = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;
  try {
    return new URL(normalized).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

function parseCmfRows(html: string): CmfAlertRow[] {
  const rows: CmfAlertRow[] = [];
  const sections = html.split(/<h2[^>]*>/i).slice(1);

  for (const section of sections) {
    const headingEnd = section.search(/<\/h2>/i);
    if (headingEnd < 0) continue;

    const category = stripHtml(section.slice(0, headingEnd));
    const body = section.slice(headingEnd);
    const tableRows = body.match(/<tr[\s\S]*?<\/tr>/gi) ?? [];

    for (const rowHtml of tableRows) {
      const cellHtml = Array.from(rowHtml.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi), (match) => match[1]);
      if (cellHtml.length < 3) continue;

      const cells = cellHtml.map(stripHtml);
      const entity = cells[2]?.trim();
      if (!entity) continue;

      const linkedCells = [cellHtml[1], cellHtml[4] ?? ""].join(" ");
      const urls = extractUrlLikes(linkedCells);
      const hosts = Array.from(new Set(urls.map(hostFromUrlLike).filter((host): host is string => Boolean(host))));
      const rawText = cells.join(" ");

      rows.push({
        date: rawText.match(DATE_PATTERN)?.[0],
        category,
        entity,
        urls,
        hosts,
        rawText
      });
    }
  }

  return rows;
}

async function fetchCmfAlertRows(): Promise<{ rows: CmfAlertRow[]; fetchedAt: string }> {
  if (cmfCache && cmfCache.expiresAt > Date.now()) {
    return { rows: cmfCache.rows, fetchedAt: cmfCache.fetchedAt };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CMF_TIMEOUT_MS);

  try {
    const response = await fetch(cmfAlertsUrl(), {
      headers: {
        "User-Agent": "Nettoxic-Hackathon/0.1 (+https://nettoxic.ai)"
      },
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`cmf_http_${response.status}`);
    }

    const html = await response.text();
    const rows = parseCmfRows(html);
    const fetchedAt = new Date().toISOString();
    cmfCache = {
      expiresAt: Date.now() + CMF_CACHE_TTL_MS,
      fetchedAt,
      rows
    };
    return { rows, fetchedAt };
  } finally {
    clearTimeout(timeout);
  }
}

function messageHosts(message: IncomingMessage, urls: string[]) {
  const combined = [message.sender, message.subject, message.content, ...urls].filter(Boolean).join(" ");
  return Array.from(new Set(extractUrlLikes(combined).map(hostFromUrlLike).filter((host): host is string => Boolean(host))));
}

function domainMatches(messageHost: string, listedHost: string) {
  return messageHost === listedHost || messageHost.endsWith(`.${listedHost}`);
}

function entityVariants(entity: string) {
  const normalized = normalizeSpanish(entity)
    .replace(/[^\w\s.-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const stripped = normalized
    .replace(/\b(aplicacion|aplicaciones|app|apps|imitadora de|imitadora|falsa empresa de cobranza de|falsa empresa de cobranza|sociedad anonima|s\.?a\.?|ltda|limitada|ltd)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return Array.from(new Set([normalized, stripped].filter((variant) => variant.length >= 6)));
}

function containsPhrase(text: string, phrase: string) {
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`).test(text);
}

function entityMatches(messageText: string, entity: string) {
  const riskContext = /\b(credito|prestamo|inversion|rentabilidad|deposito|transferencia|asesor|whatsapp|telegram|bloqueo|multa|deuda|pago)\b/.test(messageText);

  return entityVariants(entity).some((variant) => {
    const oneToken = !variant.includes(" ");
    if (oneToken && variant.length < 8 && !riskContext) return false;
    return containsPhrase(messageText, variant);
  });
}

export function detectImpersonatedEntity(text: string): { entity: string | null } {
  const normalized = normalizeSpanish(text);
  const found = CHILEAN_TARGETS.find((target) =>
    normalized.includes(normalizeSpanish(target))
  );

  return {
    entity: found ?? null
  };
}

export async function lookupCmfAlerts(message: IncomingMessage, urls: string[] = []): Promise<CmfLookupResult> {
  const sourceUrl = cmfAlertsUrl();

  try {
    const { rows, fetchedAt } = await fetchCmfAlertRows();
    const hosts = messageHosts(message, urls);
    const normalizedMessage = normalizeSpanish([message.sender, message.subject, message.content].filter(Boolean).join(" "));
    const matches: CmfAlertMatch[] = [];

    for (const row of rows) {
      const hostMatch = hosts.find((messageHost) => row.hosts.some((listedHost) => domainMatches(messageHost, listedHost)));
      if (hostMatch) {
        matches.push({
          sourceUrl,
          category: row.category,
          entity: row.entity,
          matchedBy: "domain",
          evidence: `${hostMatch} listado por CMF${row.date ? ` el ${row.date}` : ""}`
        });
        continue;
      }

      if (entityMatches(normalizedMessage, row.entity)) {
        matches.push({
          sourceUrl,
          category: row.category,
          entity: row.entity,
          matchedBy: "entity",
          evidence: `${row.entity} aparece en Alertas CMF${row.date ? ` (${row.date})` : ""}`
        });
      }
    }

    const uniqueMatches = Array.from(new Map(matches.map((match) => [`${match.matchedBy}:${match.entity}:${match.evidence}`, match])).values()).slice(0, 5);

    return {
      checked: true,
      matched: uniqueMatches.length > 0,
      matches: uniqueMatches,
      errors: [],
      sourceUrl,
      fetchedAt
    };
  } catch (error) {
    return {
      checked: false,
      matched: false,
      matches: [],
      errors: [error instanceof Error ? error.message : "cmf_lookup_failed"],
      sourceUrl
    };
  }
}
