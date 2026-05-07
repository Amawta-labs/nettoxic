import { Router, type Response } from "express";
import { z } from "zod";
import {
  buildGmailAuthUrl,
  decodeGmailOAuthState,
  exchangeGmailCode,
  syncGmailHistory,
  watchGmailAccount
} from "../ingest/gmailClient.js";
import { getGmailAccount, getGmailAccountByEmail, listGmailAccounts, updateGmailCursor, upsertGmailAccount } from "../ingest/gmailTokenStore.js";
import { analyzeMessage } from "../services/orchestrator.js";
import { recordAnalyzedInboxItem } from "../services/ingestStore.js";
import { notifyRiskItem } from "../services/pushNotifications.js";
import { asyncRoute } from "./asyncRoute.js";

export const gmailRouter = Router();

const WatchRequestSchema = z.object({
  userId: z.string().min(1)
});

const PubSubEnvelopeSchema = z.object({
  message: z.object({
    data: z.string(),
    messageId: z.string().optional(),
    publishTime: z.string().optional()
  }),
  subscription: z.string().optional()
});

function assertPubSubAuthorized(token: unknown) {
  const expected = process.env.GMAIL_PUBSUB_VERIFICATION_TOKEN;
  if (!expected) return true;
  return token === expected;
}

function decodePubSubData(data: string): { emailAddress?: string; historyId?: string } {
  return JSON.parse(Buffer.from(data, "base64").toString("utf8")) as { emailAddress?: string; historyId?: string };
}

function safeMobileReturnUrl(value: string | undefined) {
  if (!value) return null;
  try {
    const url = new URL(value);
    const protocol = url.protocol.toLowerCase();
    if (protocol === "nettoxic:" || protocol === "exp:" || protocol === "exps:") return url;
  } catch {
    return null;
  }
  return null;
}

function redirectToMobile(
  res: Response,
  returnUrl: string | undefined,
  params: Record<string, string>
) {
  const url = safeMobileReturnUrl(returnUrl);
  if (!url) return false;
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  res.redirect(302, url.toString());
  return true;
}

async function analyzeAndStoreMessages(messages: Awaited<ReturnType<typeof syncGmailHistory>>, userId?: string) {
  const items = [];
  for (const message of messages) {
    const analysis = await analyzeMessage(message);
    const item = await recordAnalyzedInboxItem(message, analysis);
    await notifyRiskItem(item, { userId }).catch((error) => {
      console.error("Failed to send risk push notification", error);
    });
    items.push(item);
  }
  return items;
}

gmailRouter.get("/auth-url", asyncRoute((req, res) => {
  const userId = typeof req.query.userId === "string" ? req.query.userId : "default";
  const returnUrl = typeof req.query.returnUrl === "string" ? req.query.returnUrl : undefined;
  res.json({ url: buildGmailAuthUrl(userId, returnUrl), userId });
}));

gmailRouter.get("/oauth2/callback", asyncRoute(async (req, res) => {
  const code = typeof req.query.code === "string" ? req.query.code : null;
  const state = decodeGmailOAuthState(typeof req.query.state === "string" ? req.query.state : null);
  if (!code) {
    if (redirectToMobile(res, state.returnUrl, { gmail_status: "error", gmail_error: "missing_code" })) return;
    res.status(400).json({ error: "missing_code" });
    return;
  }

  const account = await exchangeGmailCode(code, state.userId);
  const stored = await upsertGmailAccount(account);
  if (
    redirectToMobile(res, state.returnUrl, {
      gmail_status: "connected",
      userId: stored.userId,
      email: stored.email ?? ""
    })
  ) {
    return;
  }

  res.json({
    ok: true,
    userId: stored.userId,
    email: stored.email,
    historyId: stored.historyId
  });
}));

gmailRouter.post("/watch", asyncRoute(async (req, res) => {
  const parsed = WatchRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_watch_request", details: parsed.error.flatten() });
    return;
  }

  const account = await getGmailAccount(parsed.data.userId);
  if (!account) {
    res.status(404).json({ error: "gmail_account_not_found" });
    return;
  }

  const watch = await watchGmailAccount(account);
  const stored = await updateGmailCursor(account.userId, {
    historyId: watch.historyId,
    watchExpiration: watch.expiration
  });

  res.json({
    ok: true,
    email: stored.email,
    historyId: stored.historyId,
    watchExpiration: stored.watchExpiration
  });
}));

gmailRouter.post("/sync", asyncRoute(async (req, res) => {
  const parsed = WatchRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_sync_request", details: parsed.error.flatten() });
    return;
  }

  const account = await getGmailAccount(parsed.data.userId);
  if (!account) {
    res.status(404).json({ error: "gmail_account_not_found" });
    return;
  }

  const messages = await syncGmailHistory(account);
  const items = await analyzeAndStoreMessages(messages, account.userId);
  res.json({ ok: true, count: items.length, items });
}));

gmailRouter.post("/pubsub", asyncRoute(async (req, res) => {
  if (!assertPubSubAuthorized(req.query.token)) {
    res.status(401).json({ error: "unauthorized_pubsub" });
    return;
  }

  const parsed = PubSubEnvelopeSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_pubsub_envelope", details: parsed.error.flatten() });
    return;
  }

  const notification = decodePubSubData(parsed.data.message.data);
  if (!notification.emailAddress || !notification.historyId) {
    res.status(400).json({ error: "invalid_gmail_notification" });
    return;
  }

  const account = await getGmailAccountByEmail(notification.emailAddress);
  if (!account) {
    res.status(202).json({ ok: false, reason: "account_not_registered", email: notification.emailAddress });
    return;
  }

  const messages = await syncGmailHistory(account, notification.historyId);
  const items = await analyzeAndStoreMessages(messages, account.userId);
  res.json({ ok: true, email: notification.emailAddress, historyId: notification.historyId, count: items.length, items });
}));

gmailRouter.get("/accounts", asyncRoute(async (_req, res) => {
  const accounts = await listGmailAccounts();
  res.json({
    accounts: accounts.map((account) => ({
      userId: account.userId,
      email: account.email,
      historyId: account.historyId,
      watchExpiration: account.watchExpiration,
      updatedAt: account.updatedAt
    }))
  });
}));
