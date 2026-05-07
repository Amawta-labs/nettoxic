import { z } from "zod";
import type { IncomingMessage } from "../schemas/analysis.js";

export const SmsIngestSchema = z.object({
  id: z.string().optional(),
  sender: z.string().optional(),
  content: z.string().min(1),
  receivedAt: z.string().optional()
});

export const EmailIngestSchema = z.object({
  id: z.string().optional(),
  sender: z.string().optional(),
  subject: z.string().optional(),
  content: z.string().min(1),
  receivedAt: z.string().optional()
});

export function normalizeSmsInput(input: z.infer<typeof SmsIngestSchema>): IncomingMessage {
  return {
    id: input.id ?? `sms-${Date.now()}`,
    source: "sms",
    sender: input.sender,
    content: input.content
  };
}

export function normalizeEmailInput(input: z.infer<typeof EmailIngestSchema>): IncomingMessage {
  return {
    id: input.id ?? `email-${Date.now()}`,
    source: "email",
    sender: input.sender,
    subject: input.subject,
    content: input.content
  };
}

export function stripHtml(html: string) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_match, code) => String.fromCharCode(Number(code)))
    .replace(/\s+/g, " ")
    .trim();
}
