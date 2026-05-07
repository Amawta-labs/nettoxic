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

export async function recordAnalyzedInboxItem(message: IncomingMessage, analysis: AnalysisResult): Promise<StoredInboxItem> {
  const now = new Date().toISOString();
  const id = message.id ?? `${message.source}-${Date.now()}`;
  const item: StoredInboxItem = {
    id,
    source: message.source,
    sender: message.sender ?? "desconocido",
    subject: message.subject,
    preview: message.content.slice(0, 160),
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
    .filter((entry) => entry.source !== "app_message" || entry.analysis.score >= 35)
    .slice(0, limit);
}
