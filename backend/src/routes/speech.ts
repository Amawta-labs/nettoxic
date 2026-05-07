import { Router } from "express";
import { z } from "zod";
import { asyncRoute } from "./asyncRoute.js";
import { generateSpeech, speechConfigured } from "../services/speechSynthesis.js";

const SpeechRequestSchema = z.object({
  text: z.string().min(1).max(160),
  voice: z.string().min(1).max(40).optional()
});

export const speechRouter = Router();

speechRouter.post(
  "/risk-alert",
  asyncRoute(async (req, res) => {
    const parsed = SpeechRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid_speech_payload", details: parsed.error.flatten() });
      return;
    }

    if (!speechConfigured()) {
      res.status(503).json({ error: "tts_not_configured" });
      return;
    }

    try {
      const speech = await generateSpeech(parsed.data);
      res.json(speech);
    } catch {
      res.status(503).json({
        error: "tts_upstream_unavailable",
        deviceFallback: true
      });
    }
  })
);
