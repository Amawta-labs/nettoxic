import { google, gmail_v1 } from "googleapis";
import type { IncomingMessage } from "../schemas/analysis.js";
import { stripHtml } from "./normalizer.js";
import type { GmailAccount } from "./gmailTokenStore.js";
import { updateGmailCursor } from "./gmailTokenStore.js";

const GMAIL_SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly"
];

type GmailOAuthState = {
  userId: string;
  returnUrl?: string;
};

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

export function createOAuthClient() {
  const client = new google.auth.OAuth2(
    requireEnv("GOOGLE_CLIENT_ID"),
    requireEnv("GOOGLE_CLIENT_SECRET"),
    requireEnv("GOOGLE_REDIRECT_URI")
  );
  return client;
}

function encodeOAuthState(state: GmailOAuthState) {
  return Buffer.from(JSON.stringify(state), "utf8").toString("base64url");
}

export function decodeGmailOAuthState(value: string | null): GmailOAuthState {
  if (!value) return { userId: "default" };

  try {
    const decoded = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as Partial<GmailOAuthState>;
    if (typeof decoded.userId === "string" && decoded.userId.trim()) {
      return {
        userId: decoded.userId,
        returnUrl: typeof decoded.returnUrl === "string" ? decoded.returnUrl : undefined
      };
    }
  } catch {
    // Existing demo accounts used the plain userId as OAuth state.
  }

  return { userId: value };
}

export function buildGmailAuthUrl(userId: string, returnUrl?: string) {
  const oauth2 = createOAuthClient();
  return oauth2.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: GMAIL_SCOPES,
    state: encodeOAuthState({ userId, returnUrl })
  });
}

export async function exchangeGmailCode(code: string, userId: string): Promise<GmailAccount> {
  const oauth2 = createOAuthClient();
  const { tokens } = await oauth2.getToken(code);
  oauth2.setCredentials(tokens);
  const gmail = google.gmail({ version: "v1", auth: oauth2 });
  const profile = await gmail.users.getProfile({ userId: "me" });

  return {
    userId,
    email: profile.data.emailAddress ?? undefined,
    historyId: profile.data.historyId ?? undefined,
    tokens,
    updatedAt: new Date().toISOString()
  };
}

function gmailForAccount(account: GmailAccount) {
  const oauth2 = createOAuthClient();
  oauth2.setCredentials(account.tokens);
  oauth2.on("tokens", async (tokens) => {
    await updateGmailCursor(account.userId, { tokens }).catch((error) => {
      console.error("Failed to persist refreshed Gmail token", error);
    });
  });
  return google.gmail({ version: "v1", auth: oauth2 });
}

export async function watchGmailAccount(account: GmailAccount) {
  const topicName = requireEnv("GMAIL_PUBSUB_TOPIC");
  const gmail = gmailForAccount(account);
  const response = await gmail.users.watch({
    userId: "me",
    requestBody: {
      topicName,
      labelIds: ["INBOX"]
    }
  });

  return {
    historyId: response.data.historyId ?? account.historyId,
    expiration: response.data.expiration ?? undefined
  };
}

function decodeBase64Url(data?: string | null) {
  if (!data) return "";
  const normalized = data.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(normalized, "base64").toString("utf8");
}

function header(payload: gmail_v1.Schema$MessagePart | undefined, name: string) {
  return payload?.headers?.find((entry) => entry.name?.toLowerCase() === name.toLowerCase())?.value;
}

function collectBodies(part: gmail_v1.Schema$MessagePart | undefined, bodies: { text: string[]; html: string[] }) {
  if (!part) return bodies;
  const mimeType = part.mimeType ?? "";
  const bodyData = decodeBase64Url(part.body?.data);

  if (bodyData && mimeType === "text/plain") bodies.text.push(bodyData);
  if (bodyData && mimeType === "text/html") bodies.html.push(stripHtml(bodyData));

  for (const child of part.parts ?? []) collectBodies(child, bodies);
  return bodies;
}

function isGoogleNotFound(error: unknown) {
  const maybeError = error as { status?: number; code?: number; response?: { status?: number } };
  return maybeError.status === 404 || maybeError.code === 404 || maybeError.response?.status === 404;
}

export async function getGmailMessage(account: GmailAccount, messageId: string): Promise<IncomingMessage | null> {
  const gmail = gmailForAccount(account);
  const response = await gmail.users.messages.get({
    userId: "me",
    id: messageId,
    format: "full"
  }).catch((error) => {
    if (isGoogleNotFound(error)) return null;
    throw error;
  });
  if (!response) return null;

  const message = response.data;
  const bodies = collectBodies(message.payload, { text: [], html: [] });
  const content = [...bodies.text, ...bodies.html].join("\n").trim() || message.snippet || "";
  if (!content) return null;

  return {
    id: `gmail-${message.id}`,
    source: "email",
    sender: header(message.payload, "from") ?? account.email,
    subject: header(message.payload, "subject") ?? "(sin asunto)",
    content
  };
}

function messageIdsFromHistory(history: gmail_v1.Schema$History[]) {
  return Array.from(
    new Set(
      history.flatMap((entry) =>
        (entry.messagesAdded ?? [])
          .map((added) => added.message?.id)
          .filter((id): id is string => Boolean(id))
      )
    )
  );
}

export async function syncGmailHistory(account: GmailAccount, incomingHistoryId?: string) {
  const gmail = gmailForAccount(account);
  const startHistoryId = account.historyId;
  if (!startHistoryId) {
    const profile = await gmail.users.getProfile({ userId: "me" });
    await updateGmailCursor(account.userId, {
      email: profile.data.emailAddress ?? account.email,
      historyId: profile.data.historyId ?? incomingHistoryId
    });
    return [];
  }

  const response = await gmail.users.history.list({
    userId: "me",
    startHistoryId,
    historyTypes: ["messageAdded"]
  });
  const ids = messageIdsFromHistory(response.data.history ?? []);
  const messages = (await Promise.all(ids.map((id) => getGmailMessage(account, id)))).filter(
    (message): message is IncomingMessage => Boolean(message)
  );

  await updateGmailCursor(account.userId, {
    historyId: response.data.historyId ?? incomingHistoryId ?? account.historyId
  });

  return messages;
}
