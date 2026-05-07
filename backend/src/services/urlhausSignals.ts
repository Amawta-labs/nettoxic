type UrlhausResponse = {
  query_status?: string;
  url_status?: string;
  threat?: string;
  urlhaus_reference?: string;
  host?: string;
  tags?: string[];
};

export type UrlhausLookupResult = {
  checked: boolean;
  matched: boolean;
  matches: Array<{
    url: string;
    status: string;
    threat: string;
    reference?: string;
  }>;
};

const URLHAUS_ENDPOINT = "https://urlhaus-api.abuse.ch/v1/url/";
const URLHAUS_TIMEOUT_MS = 5000;
const lookupCache = new Map<string, UrlhausLookupResult>();

function cacheKey(urls: string[]) {
  return urls.slice().sort().join("\n");
}

async function queryUrlhaus(url: string, authKey: string): Promise<UrlhausResponse | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), URLHAUS_TIMEOUT_MS);

  try {
    const response = await fetch(URLHAUS_ENDPOINT, {
      method: "POST",
      headers: {
        "Auth-Key": authKey,
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "Nettoxic-Hackathon/0.1"
      },
      body: new URLSearchParams({ url }),
      signal: controller.signal
    });

    if (!response.ok) {
      console.warn(`URLhaus lookup failed with HTTP ${response.status}`);
      return null;
    }

    return await response.json() as UrlhausResponse;
  } catch (error) {
    console.warn("URLhaus lookup failed", error);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function lookupUrlhaus(urls: string[]): Promise<UrlhausLookupResult> {
  const uniqueUrls = Array.from(new Set(urls)).slice(0, 5);
  const authKey = process.env.URLHAUS_AUTH_KEY;

  if (uniqueUrls.length === 0 || !authKey) {
    return { checked: false, matched: false, matches: [] };
  }

  const key = cacheKey(uniqueUrls);
  const cached = lookupCache.get(key);
  if (cached) return cached;

  const responses = await Promise.all(
    uniqueUrls.map(async (url) => ({ url, response: await queryUrlhaus(url, authKey) }))
  );

  const matches = responses.flatMap(({ url, response }) => {
    if (response?.query_status !== "ok") return [];
    return [{
      url,
      status: response.url_status ?? "unknown",
      threat: response.threat ?? "unknown",
      reference: response.urlhaus_reference
    }];
  });

  const result = {
    checked: true,
    matched: matches.length > 0,
    matches
  };

  lookupCache.set(key, result);
  return result;
}
