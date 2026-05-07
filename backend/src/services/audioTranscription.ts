export type AudioTranscriptionResult = {
  provider: "elevenlabs";
  model: string;
  languageCode: string | null;
  languageProbability: number | null;
  text: string;
  wordsCount: number;
};

const DEFAULT_TRANSCRIPTION_MODEL = "scribe_v2";
const DEFAULT_MAX_AUDIO_BYTES = 15 * 1024 * 1024;

const SUPPORTED_AUDIO_MEDIA_TYPES = new Set([
  "audio/aac",
  "audio/ogg",
  "audio/opus",
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/x-wav",
  "audio/webm",
  "audio/flac",
  "audio/x-flac",
  "audio/mp4",
  "audio/x-m4a",
  "audio/m4a"
]);

export function audioTranscriptionConfigured() {
  return Boolean(process.env.ELEVENLABS_API_KEY?.trim());
}

function transcriptionModel() {
  return process.env.ELEVENLABS_STT_MODEL_ID?.trim() || DEFAULT_TRANSCRIPTION_MODEL;
}

function maxAudioBytes() {
  const configured = Number(process.env.AUDIO_TRANSCRIPTION_MAX_BYTES);
  return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_MAX_AUDIO_BYTES;
}

function normalizeMediaType(mediaType: string) {
  return mediaType.split(";")[0]?.trim().toLowerCase() || "";
}

export function decodeAudioBase64(audioBase64: string, mediaType: string) {
  const normalizedMediaType = normalizeMediaType(mediaType);
  if (!SUPPORTED_AUDIO_MEDIA_TYPES.has(normalizedMediaType)) {
    throw new Error("unsupported_audio_media_type");
  }

  const audio = Buffer.from(audioBase64, "base64");
  if (audio.length === 0) throw new Error("empty_audio_payload");
  if (audio.length > maxAudioBytes()) throw new Error("audio_payload_too_large");
  return { audio, mediaType: normalizedMediaType };
}

export async function transcribeAudio(input: {
  audio: Buffer;
  mediaType: string;
  filename?: string;
  languageCode?: string;
}): Promise<AudioTranscriptionResult> {
  const apiKey = process.env.ELEVENLABS_API_KEY?.trim();
  if (!apiKey) throw new Error("elevenlabs_stt_not_configured");

  const model = transcriptionModel();
  const form = new FormData();
  form.append("model_id", model);
  if (input.languageCode?.trim()) {
    form.append("language_code", input.languageCode.trim());
  }
  form.append("file", new Blob([new Uint8Array(input.audio)], { type: input.mediaType }), input.filename ?? "audio-message");

  const response = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
    method: "POST",
    headers: {
      "xi-api-key": apiKey
    },
    body: form
  });

  if (!response.ok) {
    const message = await response.text().catch(() => "");
    throw new Error(message || `elevenlabs_stt_http_${response.status}`);
  }

  const payload = (await response.json()) as {
    language_code?: string | null;
    language_probability?: number | null;
    text?: string;
    words?: unknown[];
  };
  const text = payload.text?.replace(/\s+/g, " ").trim();
  if (!text) throw new Error("empty_transcription");

  return {
    provider: "elevenlabs",
    model,
    languageCode: payload.language_code ?? null,
    languageProbability: payload.language_probability ?? null,
    text,
    wordsCount: Array.isArray(payload.words) ? payload.words.length : 0
  };
}
