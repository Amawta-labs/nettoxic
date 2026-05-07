import { mockInbox } from "../data/mockInbox";
import type { AnalysisResult, InboxItem } from "../types";

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8787";
const USE_MOCKS = process.env.EXPO_PUBLIC_USE_MOCKS === "true";
const USER_ID = process.env.EXPO_PUBLIC_NETTOXIC_USER_ID ?? "daslav";
const REQUEST_TIMEOUT_MS = 28000;

export type GmailAccountSummary = {
  userId: string;
  email?: string;
  historyId?: string;
  watchExpiration?: string;
  updatedAt?: string;
};

export class ApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ApiError";
  }
}

export function getApiBaseUrl() {
  return API_BASE_URL;
}

export function isMockMode() {
  return USE_MOCKS;
}

export function getNettoxicUserId() {
  return USER_ID;
}

function assertAnalysisResult(value: unknown): AnalysisResult {
  const candidate = value as Partial<AnalysisResult>;
  if (
    !candidate ||
    typeof candidate.score !== "number" ||
    typeof candidate.nivel !== "string" ||
    !Array.isArray(candidate.senales_detectadas) ||
    !candidate.fuentes_externas ||
    !Array.isArray(candidate.pasos)
  ) {
    throw new ApiError("Respuesta /analyze invalida");
  }
  return candidate as AnalysisResult;
}

function assertInboxResponse(value: unknown): InboxItem[] {
  const candidate = value as { items?: unknown };
  if (!candidate || !Array.isArray(candidate.items)) {
    throw new ApiError("Respuesta /inbox invalida");
  }

  return candidate.items.map((item) => {
    const entry = item as Partial<InboxItem>;
    if (!entry.id || !entry.sender || !entry.preview || !entry.analysis) {
      throw new ApiError("Item de bandeja invalido");
    }
    return { ...entry, analysis: assertAnalysisResult(entry.analysis) } as InboxItem;
  });
}

async function fetchJson(path: string, init?: RequestInit) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      signal: controller.signal
    });
    if (!response.ok) throw new ApiError(`HTTP ${response.status}`);
    return response.json();
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new ApiError("Tiempo agotado: la respuesta supero 28s");
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

export async function getInbox(): Promise<InboxItem[]> {
  if (USE_MOCKS) {
    return mockInbox;
  }

  const data = await fetchJson("/inbox");
  return assertInboxResponse(data);
}

export async function getHealth(): Promise<boolean> {
  if (USE_MOCKS) return false;
  const data = await fetchJson("/health");
  return Boolean((data as { ok?: boolean }).ok);
}

export async function getGmailAuthUrl(returnUrl?: string): Promise<string> {
  const params = new URLSearchParams({ userId: USER_ID });
  if (returnUrl) params.set("returnUrl", returnUrl);
  const data = await fetchJson(`/gmail/auth-url?${params.toString()}`);
  const url = (data as { url?: unknown }).url;
  if (typeof url !== "string") throw new ApiError("Respuesta /gmail/auth-url invalida");
  return url;
}

export async function getCurrentGmailAccount(): Promise<GmailAccountSummary | null> {
  const data = await fetchJson("/gmail/accounts");
  const accounts = (data as { accounts?: unknown }).accounts;
  if (!Array.isArray(accounts)) throw new ApiError("Respuesta /gmail/accounts invalida");

  return (
    accounts
      .map((account) => account as Partial<GmailAccountSummary>)
      .find((account) => account.userId === USER_ID) ?? null
  ) as GmailAccountSummary | null;
}

export async function watchGmailInbox() {
  return fetchJson("/gmail/watch", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId: USER_ID })
  });
}

export async function syncGmailInbox() {
  return fetchJson("/gmail/sync", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId: USER_ID })
  });
}

export async function analyzeText(content: string): Promise<AnalysisResult> {
  const data = await fetchJson("/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ source: "manual", content })
  });
  return assertAnalysisResult(data);
}

export async function analyzeTextWithMeta(content: string): Promise<{
  analysis: AnalysisResult;
  latencyMs: number;
  analyzedAt: string;
}> {
  const startedAt = Date.now();
  const analysis = await analyzeText(content);
  return {
    analysis,
    latencyMs: Date.now() - startedAt,
    analyzedAt: new Date().toISOString()
  };
}

export async function reportCase(messageId: string, confirmedFraud: boolean) {
  return fetchJson("/report", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messageId, confirmedFraud })
  });
}

export async function registerPushDevice(input: {
  userId: string;
  pushToken: string;
  platform: "android" | "ios" | "web" | "unknown";
  appVersion?: string;
}) {
  return fetchJson("/devices/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input)
  });
}
