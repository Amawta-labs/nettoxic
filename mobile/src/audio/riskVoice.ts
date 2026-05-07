import { Audio } from "expo-av";
import * as FileSystem from "expo-file-system";
import * as Speech from "expo-speech";
import { synthesizeRiskAlertSpeech } from "../api/client";

let activeSound: Audio.Sound | null = null;
let lastText = "";
let lastPlayedAt = 0;

async function unloadActiveSound() {
  if (!activeSound) return;
  const sound = activeSound;
  activeSound = null;
  await sound.unloadAsync().catch(() => undefined);
}

function shouldSkip(text: string) {
  const now = Date.now();
  if (text === lastText && now - lastPlayedAt < 15000) return true;
  lastText = text;
  lastPlayedAt = now;
  return false;
}

export async function playRiskAlertVoice(text?: string | null) {
  const spokenText = text?.trim();
  if (!spokenText || shouldSkip(spokenText)) return;

  try {
    const speech = await synthesizeRiskAlertSpeech(spokenText);
    const extension = speech.mediaType === "audio/mpeg" ? "mp3" : "wav";
    const fileUri = `${FileSystem.cacheDirectory}awki-risk-alert-${Date.now()}.${extension}`;
    await FileSystem.writeAsStringAsync(fileUri, speech.audioBase64, {
      encoding: FileSystem.EncodingType.Base64
    });

    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
      shouldDuckAndroid: true,
      staysActiveInBackground: false
    });
    await unloadActiveSound();

    const { sound } = await Audio.Sound.createAsync({ uri: fileUri }, { shouldPlay: true, volume: 1 });
    activeSound = sound;
    sound.setOnPlaybackStatusUpdate((status) => {
      if (status.isLoaded && status.didJustFinish) {
        unloadActiveSound().catch(() => undefined);
      }
    });
  } catch {
    await unloadActiveSound();
    Speech.stop();
    Speech.speak(spokenText, {
      language: "es-CL",
      pitch: 1,
      rate: 0.92
    });
  }
}
