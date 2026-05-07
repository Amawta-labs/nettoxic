import { mkdir, readFile, appendFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { randomUUID } from "node:crypto";

export type StoredReport = {
  id: string;
  messageId?: string;
  confirmedFraud: boolean;
  notes?: string;
  receivedAt: string;
};

function reportsFile() {
  return resolve(process.cwd(), process.env.REPORTS_FILE ?? "data/reports.jsonl");
}

export async function saveReport(input: Omit<StoredReport, "id" | "receivedAt">): Promise<StoredReport> {
  const report = {
    id: randomUUID(),
    ...input,
    receivedAt: new Date().toISOString()
  };
  const file = reportsFile();
  await mkdir(dirname(file), { recursive: true });
  await appendFile(file, `${JSON.stringify(report)}\n`, "utf8");
  return report;
}

export async function listRecentReports(limit = 20): Promise<StoredReport[]> {
  try {
    const file = await readFile(reportsFile(), "utf8");
    return file
      .trim()
      .split("\n")
      .filter(Boolean)
      .slice(-limit)
      .map((line) => JSON.parse(line) as StoredReport)
      .reverse();
  } catch {
    return [];
  }
}
