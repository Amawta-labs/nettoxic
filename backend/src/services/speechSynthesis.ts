import {
  elevenLabsSpeechConfigured,
  generateElevenLabsRiskSpeech,
  type ElevenLabsSpeechResult
} from "./elevenLabsSpeech.js";
import { geminiSpeechConfigured, generateRiskAlertSpeech, type RiskSpeechResult } from "./geminiSpeech.js";

export type SpeechProvider = "elevenlabs" | "gemini";
export type SpeechResult = (ElevenLabsSpeechResult | RiskSpeechResult) & {
  provider: SpeechProvider;
};

function configuredProvider(): SpeechProvider | null {
  const preferred = process.env.TTS_PROVIDER?.trim().toLowerCase();
  if (preferred === "elevenlabs" && elevenLabsSpeechConfigured()) return "elevenlabs";
  if (preferred === "gemini" && geminiSpeechConfigured()) return "gemini";
  if (elevenLabsSpeechConfigured()) return "elevenlabs";
  if (geminiSpeechConfigured()) return "gemini";
  return null;
}

export function speechConfigured() {
  return Boolean(configuredProvider());
}

export async function generateSpeech(input: { text: string; voice?: string }): Promise<SpeechResult> {
  const provider = configuredProvider();
  if (provider === "elevenlabs") {
    return { ...(await generateElevenLabsRiskSpeech(input)), provider };
  }
  if (provider === "gemini") {
    return { ...(await generateRiskAlertSpeech(input)), provider };
  }
  throw new Error("tts_not_configured");
}
