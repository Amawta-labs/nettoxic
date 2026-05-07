export type ElevenLabsSpeechResult = {
  audioBase64: string;
  mediaType: "audio/mpeg";
  model: string;
  voice: string;
  text: string;
};

const DEFAULT_ELEVENLABS_MODEL = "eleven_flash_v2_5";
const DEFAULT_ELEVENLABS_VOICE_ID = "JBFqnCBsd6RMkjVDRZzb";
const DEFAULT_ELEVENLABS_OUTPUT_FORMAT = "mp3_44100_128";

export function elevenLabsSpeechConfigured() {
  return Boolean(process.env.ELEVENLABS_API_KEY?.trim());
}

function elevenLabsModel() {
  return process.env.ELEVENLABS_MODEL_ID?.trim() || DEFAULT_ELEVENLABS_MODEL;
}

function elevenLabsVoice(input?: string) {
  return input?.trim() || process.env.ELEVENLABS_VOICE_ID?.trim() || DEFAULT_ELEVENLABS_VOICE_ID;
}

function elevenLabsOutputFormat() {
  return process.env.ELEVENLABS_OUTPUT_FORMAT?.trim() || DEFAULT_ELEVENLABS_OUTPUT_FORMAT;
}

function normalizeSpeechText(text: string) {
  return text.replace(/\s+/g, " ").trim().slice(0, 160);
}

export async function generateElevenLabsRiskSpeech(input: { text: string; voice?: string }): Promise<ElevenLabsSpeechResult> {
  const apiKey = process.env.ELEVENLABS_API_KEY?.trim();
  if (!apiKey) throw new Error("elevenlabs_tts_not_configured");

  const text = normalizeSpeechText(input.text);
  const model = elevenLabsModel();
  const voice = elevenLabsVoice(input.voice);
  const outputFormat = elevenLabsOutputFormat();
  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voice)}?output_format=${encodeURIComponent(outputFormat)}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "xi-api-key": apiKey
      },
      body: JSON.stringify({
        text,
        model_id: model,
        language_code: "es",
        voice_settings: {
          stability: 0.68,
          similarity_boost: 0.78,
          style: 0,
          use_speaker_boost: true
        }
      })
    }
  );

  if (!response.ok) {
    const message = await response.text().catch(() => "");
    throw new Error(message || `elevenlabs_tts_http_${response.status}`);
  }

  const audio = Buffer.from(await response.arrayBuffer());
  return {
    audioBase64: audio.toString("base64"),
    mediaType: "audio/mpeg",
    model,
    voice,
    text
  };
}
