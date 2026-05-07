import { Router } from "express";
import { z } from "zod";
import { asyncRoute } from "./asyncRoute.js";
import { geminiSpeechConfigured, generateRiskAlertSpeech } from "../services/geminiSpeech.js";

const SpeechRequestSchema = z.object({
  text: z.string().min(1).max(240),
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

    if (!geminiSpeechConfigured()) {
      res.status(503).json({ error: "gemini_tts_not_configured" });
      return;
    }

    const speech = await generateRiskAlertSpeech(parsed.data);
    res.json(speech);
  })
);
