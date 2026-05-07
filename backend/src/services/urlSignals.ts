const URL_PATTERN = /\bhttps?:\/\/[^\s<>"')]+/gi;

const SUSPICIOUS_TLDS = new Set(["top", "xyz", "click", "live", "monster", "shop"]);
const SHORTENERS = new Set(["bit.ly", "tinyurl.com", "t.co", "cutt.ly", "is.gd"]);
const OFFICIAL_DOMAINS = [
  "bancoestado.cl",
  "sii.cl",
  "cmfchile.cl",
  "falabella.com",
  "mercadolibre.cl"
];

function isOfficialDomain(host: string) {
  return OFFICIAL_DOMAINS.some((domain) => host === domain || host.endsWith(`.${domain}`));
}

export function extractUrls(text: string): string[] {
  return Array.from(new Set(text.match(URL_PATTERN) ?? []));
}

export function inspectUrls(urls: string[]) {
  const suspiciousDomains: string[] = [];

  for (const rawUrl of urls) {
    try {
      const parsed = new URL(rawUrl);
      const host = parsed.hostname.replace(/^www\./, "").toLowerCase();
      const tld = host.split(".").at(-1) ?? "";
      const looksBankLike = /banco|estado|sii|afp|falabella|mercado/.test(host);
      const isOfficial = isOfficialDomain(host);

      if (SHORTENERS.has(host) || SUSPICIOUS_TLDS.has(tld) || (looksBankLike && !isOfficial)) {
        suspiciousDomains.push(host);
      }
    } catch {
      suspiciousDomains.push(rawUrl);
    }
  }

  return {
    urls,
    suspiciousDomains
  };
}
