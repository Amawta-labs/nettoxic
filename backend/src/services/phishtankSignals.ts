type PhishTankResult = {
  url?: string;
  in_database?: boolean | string;
  phish_id?: number | string;
  phish_detail_page?: string;
  verified?: boolean | string;
  valid?: boolean | string;
};

type PhishTankResponse = {
  results?: PhishTankResult;
};

export type PhishTankLookupResult = {
  checked: boolean;
  matched: boolean;
  matches: Array<{
    url: string;
    phishId?: string;
    detailUrl?: string;
    verified: boolean;
    valid: boolean;
  }>;
  errors: string[];
};

const PHISHTANK_ENDPOINT = "https://checkurl.phishtank.com/checkurl/";
const PHISHTANK_TIMEOUT_MS = 5000;
const lookupCache = new Map<string, PhishTankLookupResult>();

function cacheKey(urls: string[]) {
  return urls.slice().sort().join("\n");
}

function isAffirmative(value: unknown) {
  return value === true || value === "true" || value === "y" || value === "yes" || value === "1";
}

async function queryPhishTank(url: string, appKey?: string): Promise<PhishTankResponse> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PHISHTANK_TIMEOUT_MS);
  const body = new URLSearchParams({ url, format: "json" });
  if (appKey) body.set("app_key", appKey);

  try {
    const response = await fetch(PHISHTANK_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": process.env.PHISHTANK_USER_AGENT ?? "phishtank/nettoxic"
      },
      body,
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`phishtank_http_${response.status}`);
    }

    return await response.json() as PhishTankResponse;
  } finally {
    clearTimeout(timeout);
  }
}

export async function lookupPhishTank(urls: string[]): Promise<PhishTankLookupResult> {
  const uniqueUrls = Array.from(new Set(urls)).slice(0, 5);
  if (uniqueUrls.length === 0) {
    return { checked: false, matched: false, matches: [], errors: [] };
  }

  const key = cacheKey(uniqueUrls);
  const cached = lookupCache.get(key);
  if (cached) return cached;

  const appKey = process.env.PHISHTANK_API_KEY || undefined;
  const responses = await Promise.all(
    uniqueUrls.map(async (url) => {
      try {
        return { url, response: await queryPhishTank(url, appKey) };
      } catch (error) {
        return {
          url,
          error: error instanceof Error ? error.message : "phishtank_lookup_failed"
        };
      }
    })
  );

  const matches = responses.flatMap(({ url, response }) => {
    const result = response?.results;
    if (!isAffirmative(result?.in_database) || !isAffirmative(result.valid)) return [];
    return [{
      url,
      phishId: result.phish_id ? String(result.phish_id) : undefined,
      detailUrl: result.phish_detail_page,
      verified: isAffirmative(result.verified),
      valid: isAffirmative(result.valid)
    }];
  });
  const errors = responses.flatMap((entry) => entry.error ? [`${entry.url}: ${entry.error}`] : []);
  const checked = responses.some((entry) => entry.response);
  const result = {
    checked,
    matched: matches.length > 0,
    matches,
    errors
  };

  lookupCache.set(key, result);
  return result;
}
