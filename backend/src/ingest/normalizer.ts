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

export const AudioIngestSchema = z.object({
  id: z.string().optional(),
  sender: z.string().optional(),
  subject: z.string().optional(),
  filename: z.string().min(1).max(180).optional(),
  mediaType: z.string().min(1).max(80).optional(),
  audioBase64: z.string().min(1).optional(),
  transcript: z.string().min(1).optional(),
  receivedAt: z.string().optional(),
  languageCode: z.string().min(2).max(8).optional()
}).superRefine((value, ctx) => {
  if (!value.audioBase64 && !value.transcript) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "audioBase64 or transcript is required",
      path: ["audioBase64"]
    });
  }
  if (value.audioBase64 && !value.mediaType) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "mediaType is required when audioBase64 is present",
      path: ["mediaType"]
    });
  }
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

export function normalizeAudioTranscriptInput(
  input: Pick<z.infer<typeof AudioIngestSchema>, "id" | "sender" | "subject" | "filename"> & { transcript: string }
): IncomingMessage {
  const subject = input.subject ?? input.filename ?? "Audio sospechoso";
  return {
    id: input.id ?? `audio-${Date.now()}`,
    source: "audio",
    sender: input.sender,
    subject,
    content: input.transcript
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
