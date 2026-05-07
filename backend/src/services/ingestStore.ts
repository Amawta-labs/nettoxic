import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { AnalysisResult, IncomingMessage } from "../schemas/analysis.js";

export type StoredInboxItem = {
  id: string;
  source: IncomingMessage["source"];
  sender: string;
  subject?: string;
  preview: string;
  receivedAt: string;
  analysis: AnalysisResult;
};

const DEFAULT_STORE_FILE = "data/ingested-inbox.json";
const MAX_ITEMS = 100;
const SECRET_PLACEHOLDER = "[secreto oculto]";

function storeFile() {
  return process.env.INGESTED_INBOX_FILE ?? DEFAULT_STORE_FILE;
}

async function readItems(): Promise<StoredInboxItem[]> {
  try {
    const raw = await readFile(storeFile(), "utf8");
    const parsed = JSON.parse(raw) as { items?: StoredInboxItem[] };
    return Array.isArray(parsed.items) ? parsed.items : [];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

async function writeItems(items: StoredInboxItem[]) {
  const file = storeFile();
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify({ items: items.slice(0, MAX_ITEMS) }, null, 2)}\n`, { mode: 0o600 });
}

function redactSensitiveText(text: string) {
  return text
    .replace(/sk-ant-api[0-9A-Za-z_-]+/g, SECRET_PLACEHOLDER)
    .replace(/GOCSPX-[0-9A-Za-z_-]+/g, SECRET_PLACEHOLDER)
    .replace(/AIza[0-9A-Za-z_-]{20,}/g, SECRET_PLACEHOLDER)
    .replace(/sk_[0-9A-Za-z]{20,}/g, SECRET_PLACEHOLDER);
}

function shouldExposeInboxItem(entry: StoredInboxItem) {
  if (entry.source !== "app_message") return true;
  if (/visible chat|accessibility/i.test(entry.subject ?? "")) return false;
  return entry.analysis.score >= 35;
}

export async function recordAnalyzedInboxItem(message: IncomingMessage, analysis: AnalysisResult): Promise<StoredInboxItem> {
  const now = new Date().toISOString();
  const id = message.id ?? `${message.source}-${Date.now()}`;
  const preview = redactSensitiveText(message.content).slice(0, 160);
  const item: StoredInboxItem = {
    id,
    source: message.source,
    sender: message.sender ?? "desconocido",
    subject: message.subject,
    preview,
    receivedAt: now,
    analysis
  };
  if (message.source === "app_message" && analysis.score < 35) {
    return item;
  }
  const existing = await readItems();
  const withoutDuplicate = existing.filter((entry) => entry.id !== id);
  await writeItems([item, ...withoutDuplicate]);
  return item;
}

export async function listAnalyzedInboxItems(limit = 50): Promise<StoredInboxItem[]> {
  return (await readItems())
    .filter(shouldExposeInboxItem)
    .slice(0, limit);
}
