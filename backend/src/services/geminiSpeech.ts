type GeminiSpeechResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        inlineData?: {
          data?: string;
          mimeType?: string;
        };
      }>;
    };
  }>;
  error?: {
    message?: string;
  };
};

export type RiskSpeechResult = {
  audioBase64: string;
  mediaType: "audio/wav";
  model: string;
  voice: string;
  text: string;
};

const DEFAULT_GEMINI_TTS_MODEL = "gemini-3.1-flash-tts-preview";
const DEFAULT_GEMINI_TTS_VOICE = "Kore";
const GEMINI_TTS_SAMPLE_RATE = 24000;
const GEMINI_TTS_CHANNELS = 1;
const GEMINI_TTS_BITS_PER_SAMPLE = 16;

export function geminiSpeechConfigured() {
  return Boolean(process.env.GEMINI_API_KEY?.trim());
}

function speechModel() {
  return process.env.GEMINI_TTS_MODEL?.trim() || DEFAULT_GEMINI_TTS_MODEL;
}

function speechVoice(input?: string) {
  return input?.trim() || process.env.GEMINI_TTS_VOICE?.trim() || DEFAULT_GEMINI_TTS_VOICE;
}

function normalizeSpeechText(text: string) {
  return text.replace(/\s+/g, " ").trim().slice(0, 240);
}

function riskSpeechPrompt(text: string) {
  return `Read aloud in neutral Latin American Spanish with a calm, urgent accessibility-alert tone: "${text}"`;
}

function wavHeader(dataSize: number) {
  const header = Buffer.alloc(44);
  const byteRate = (GEMINI_TTS_SAMPLE_RATE * GEMINI_TTS_CHANNELS * GEMINI_TTS_BITS_PER_SAMPLE) / 8;
  const blockAlign = (GEMINI_TTS_CHANNELS * GEMINI_TTS_BITS_PER_SAMPLE) / 8;

  header.write("RIFF", 0);
  header.writeUInt32LE(36 + dataSize, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(GEMINI_TTS_CHANNELS, 22);
  header.writeUInt32LE(GEMINI_TTS_SAMPLE_RATE, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(GEMINI_TTS_BITS_PER_SAMPLE, 34);
  header.write("data", 36);
  header.writeUInt32LE(dataSize, 40);
  return header;
}

function pcmBase64ToWavBase64(pcmBase64: string) {
  const pcm = Buffer.from(pcmBase64, "base64");
  return Buffer.concat([wavHeader(pcm.length), pcm]).toString("base64");
}

function extractInlineAudio(payload: GeminiSpeechResponse): { data: string; mimeType?: string } {
  const parts = payload.candidates?.[0]?.content?.parts ?? [];
  const inline = parts.find((part) => part.inlineData?.data)?.inlineData;
  if (!inline?.data) {
    throw new Error(payload.error?.message ?? "gemini_tts_no_audio");
  }
  return { data: inline.data, mimeType: inline.mimeType };
}

export async function generateRiskAlertSpeech(input: { text: string; voice?: string }): Promise<RiskSpeechResult> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) throw new Error("gemini_tts_not_configured");

  const model = speechModel();
  const voice = speechVoice(input.voice);
  const text = normalizeSpeechText(input.text);
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey
    },
    body: JSON.stringify({
      contents: [
        {
          parts: [{ text: riskSpeechPrompt(text) }]
        }
      ],
      generationConfig: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: voice
            }
          }
        }
      },
      model
    })
  });

  const payload = (await response.json()) as GeminiSpeechResponse;
  if (!response.ok) {
    throw new Error(payload.error?.message ?? `gemini_tts_http_${response.status}`);
  }

  const inlineAudio = extractInlineAudio(payload);
  const mediaType = inlineAudio.mimeType?.toLowerCase() ?? "";
  const audioBase64 = mediaType.includes("wav") ? inlineAudio.data : pcmBase64ToWavBase64(inlineAudio.data);
  return { audioBase64, mediaType: "audio/wav", model, voice, text };
}
