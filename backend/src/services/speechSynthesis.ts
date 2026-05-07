import {
  elevenLabsSpeechConfigured,
  generateElevenLabsRiskSpeech,
  type ElevenLabsSpeechResult
} from "./elevenLabsSpeech.js";
import { geminiSpeechConfigured, generateRiskAlertSpeech, type RiskSpeechResult } from "./geminiSpeech.js";

export type SpeechProvider = "elevenlabs" | "gemini";
export type SpeechResult = (ElevenLabsSpeechResult | RiskSpeechResult) & {
  provider: SpeechProvider;
  fallbackFrom?: SpeechProvider;
};

type ProviderPreference = SpeechProvider | "auto";

function providerPreference(): ProviderPreference {
  const preferred = process.env.TTS_PROVIDER?.trim().toLowerCase();
  if (preferred === "elevenlabs" || preferred === "gemini") return preferred;
  return "auto";
}

export function speechConfigured() {
  const preferred = providerPreference();
  if (preferred === "elevenlabs") return elevenLabsSpeechConfigured();
  if (preferred === "gemini") return geminiSpeechConfigured();
  return elevenLabsSpeechConfigured() || geminiSpeechConfigured();
}

export async function generateSpeech(input: { text: string; voice?: string }): Promise<SpeechResult> {
  const preferred = providerPreference();

  if (preferred === "elevenlabs") {
    if (!elevenLabsSpeechConfigured()) throw new Error("elevenlabs_tts_not_configured");
    return { ...(await generateElevenLabsRiskSpeech(input)), provider: "elevenlabs" };
  }

  if (preferred === "gemini") {
    if (!geminiSpeechConfigured()) throw new Error("gemini_tts_not_configured");
    return { ...(await generateRiskAlertSpeech(input)), provider: "gemini" };
  }

  if (elevenLabsSpeechConfigured()) {
    try {
      return { ...(await generateElevenLabsRiskSpeech(input)), provider: "elevenlabs" };
    } catch (error) {
      if (!geminiSpeechConfigured()) throw error;
      return { ...(await generateRiskAlertSpeech(input)), provider: "gemini", fallbackFrom: "elevenlabs" };
    }
  }

  if (geminiSpeechConfigured()) {
    return { ...(await generateRiskAlertSpeech(input)), provider: "gemini" };
  }

  throw new Error("tts_not_configured");
}
