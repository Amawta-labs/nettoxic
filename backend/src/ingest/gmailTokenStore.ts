import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

export type GmailAccount = {
  userId: string;
  email?: string;
  historyId?: string;
  watchExpiration?: string;
  tokens: {
    access_token?: string | null;
    refresh_token?: string | null;
    scope?: string;
    token_type?: string | null;
    expiry_date?: number | null;
    id_token?: string | null;
  };
  updatedAt: string;
};

const DEFAULT_TOKEN_FILE = "data/gmail-accounts.json";

function tokenFile() {
  return process.env.GMAIL_TOKEN_STORE_FILE ?? DEFAULT_TOKEN_FILE;
}

async function readAccounts(): Promise<GmailAccount[]> {
  try {
    const raw = await readFile(tokenFile(), "utf8");
    const parsed = JSON.parse(raw) as { accounts?: GmailAccount[] };
    return Array.isArray(parsed.accounts) ? parsed.accounts : [];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

async function writeAccounts(accounts: GmailAccount[]) {
  const file = tokenFile();
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify({ accounts }, null, 2)}\n`, { mode: 0o600 });
}

export async function upsertGmailAccount(account: GmailAccount) {
  const accounts = await readAccounts();
  const next = [
    { ...account, updatedAt: new Date().toISOString() },
    ...accounts.filter((entry) => entry.userId !== account.userId && entry.email !== account.email)
  ];
  await writeAccounts(next);
  return next[0];
}

export async function getGmailAccount(userId: string) {
  return (await readAccounts()).find((account) => account.userId === userId || account.email === userId) ?? null;
}

export async function getGmailAccountByEmail(email: string) {
  return (await readAccounts()).find((account) => account.email?.toLowerCase() === email.toLowerCase()) ?? null;
}

export async function updateGmailCursor(userId: string, update: Partial<Pick<GmailAccount, "email" | "historyId" | "watchExpiration" | "tokens">>) {
  const account = await getGmailAccount(userId);
  if (!account) throw new Error(`Gmail account not found: ${userId}`);
  return upsertGmailAccount({
    ...account,
    ...update,
    tokens: update.tokens ? { ...account.tokens, ...update.tokens } : account.tokens
  });
}

export async function listGmailAccounts() {
  return readAccounts();
}
