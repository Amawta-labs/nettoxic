import { Router } from "express";
import {
  AudioIngestSchema,
  EmailIngestSchema,
  normalizeAudioTranscriptInput,
  normalizeEmailInput,
  normalizeSmsInput,
  SmsIngestSchema
} from "../ingest/normalizer.js";
import { analyzeMessage } from "../services/orchestrator.js";
import { decodeAudioBase64, transcribeAudio } from "../services/audioTranscription.js";
import { recordAnalyzedInboxItem } from "../services/ingestStore.js";
import { notifyRiskItem } from "../services/pushNotifications.js";
import { asyncRoute } from "./asyncRoute.js";

export const ingestRouter = Router();

function authorized(req: { header(name: string): string | undefined }) {
  const expected = process.env.INGEST_API_KEY;
  if (!expected) return true;
  return req.header("x-nettoxic-ingest-key") === expected;
}

ingestRouter.post("/sms", asyncRoute(async (req, res) => {
  if (!authorized(req)) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }

  const parsed = SmsIngestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_sms_ingest", details: parsed.error.flatten() });
    return;
  }

  const message = normalizeSmsInput(parsed.data);
  const analysis = await analyzeMessage(message);
  const item = await recordAnalyzedInboxItem(message, analysis);
  res.json({ item, analysis });
}));

ingestRouter.post("/audio", asyncRoute(async (req, res) => {
  if (!authorized(req)) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }

  const parsed = AudioIngestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_audio_ingest", details: parsed.error.flatten() });
    return;
  }

  let decodedAudio: ReturnType<typeof decodeAudioBase64>;
  try {
    decodedAudio = decodeAudioBase64(parsed.data.audioBase64, parsed.data.mediaType);
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "invalid_audio_payload" });
    return;
  }

  let transcript: Awaited<ReturnType<typeof transcribeAudio>>;
  try {
    transcript = await transcribeAudio({
      audio: decodedAudio.audio,
      mediaType: decodedAudio.mediaType,
      filename: parsed.data.filename,
      languageCode: parsed.data.languageCode ?? "es"
    });
  } catch {
    res.status(503).json({ error: "audio_transcription_unavailable" });
    return;
  }
  const message = normalizeAudioTranscriptInput({ ...parsed.data, transcript: transcript.text });
  const analysis = await analyzeMessage(message);
  const item = await recordAnalyzedInboxItem(message, analysis);
  const push = await notifyRiskItem(item).catch((error) => {
    console.error("Failed to send risk push notification", error);
    return { attempted: 0, sent: 0, skipped: 0, errors: [error instanceof Error ? error.message : "push_error"] };
  });
  res.json({ item, transcript, analysis, push });
}));

ingestRouter.post("/email", asyncRoute(async (req, res) => {
  if (!authorized(req)) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }

  const parsed = EmailIngestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_email_ingest", details: parsed.error.flatten() });
    return;
  }

  const message = normalizeEmailInput(parsed.data);
  const analysis = await analyzeMessage(message);
  const item = await recordAnalyzedInboxItem(message, analysis);
  const push = await notifyRiskItem(item).catch((error) => {
    console.error("Failed to send risk push notification", error);
    return { attempted: 0, sent: 0, skipped: 0, errors: [error instanceof Error ? error.message : "push_error"] };
  });
  res.json({ item, analysis, push });
}));
