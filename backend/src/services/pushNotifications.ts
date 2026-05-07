import type { StoredInboxItem } from "./ingestStore.js";
import { listDevices, type RegisteredDevice } from "./deviceStore.js";

type ExpoPushMessage = {
  to: string;
  sound: "default";
  title: string;
  body: string;
  priority: "high";
  channelId: string;
  categoryId: string;
  data: Record<string, string | number | boolean | null>;
};

type PushSendResult = {
  attempted: number;
  sent: number;
  skipped: number;
  errors: string[];
};

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

function riskThreshold() {
  return Number(process.env.PUSH_RISK_THRESHOLD ?? 35);
}

function expoPushEnabled() {
  return process.env.PUSH_NOTIFICATIONS_ENABLED !== "false";
}

function isExpoPushToken(token: string) {
  return /^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]+\]$/.test(token);
}

function chunks<T>(items: T[], size: number) {
  const grouped: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    grouped.push(items.slice(index, index + size));
  }
  return grouped;
}

function riskLabel(score: number) {
  if (score >= 85) return "riesgo crítico";
  if (score >= 65) return "riesgo alto";
  if (score >= 35) return "revisar";
  return "riesgo bajo";
}

function sourceLabel(item: StoredInboxItem) {
  if (item.source === "email") return "Correo";
  if (item.source === "sms") return "SMS";
  if (item.source === "app_message") return item.sender || "Mensaje";
  if (item.source === "audio") return "Audio";
  return "Mensaje";
}

function compactText(value: string | undefined, fallback: string, maxLength = 42) {
  const clean = (value ?? "").replace(/[<>"']/g, "").replace(/\s+/g, " ").trim();
  const text = clean || fallback;
  return text.length > maxLength ? `${text.slice(0, maxLength - 1).trim()}…` : text;
}

function notificationBody(item: StoredInboxItem) {
  const source = sourceLabel(item);
  const subject = compactText(item.subject, item.analysis.entidad_suplantada ?? item.preview ?? "mensaje sospechoso");
  return `${source} · ${subject} · ${riskLabel(item.analysis.score)}`;
}

function messageForItem(item: StoredInboxItem): Omit<ExpoPushMessage, "to"> {
  const spokenEntity = item.analysis.entidad_suplantada ?? item.sender ?? "un mensaje sospechoso";
  const speakText =
    `Alerta Awki. Posible estafa en ${spokenEntity}. ` +
    "No respondas. No abras enlaces. No compartas claves.";
  return {
    sound: "default",
    title: "Awki: revisa antes de abrir",
    body: notificationBody(item),
    priority: "high",
    channelId: "risk-alerts",
    categoryId: "risk-alert",
    data: {
      type: "risk_alert",
      itemId: item.id,
      source: item.source,
      score: item.analysis.score,
      nivel: item.analysis.nivel,
      speakText,
      categoryId: "risk-alert",
      route: `/analysis/${item.id}`
    }
  };
}

async function sendExpoPushMessages(messages: ExpoPushMessage[]): Promise<PushSendResult> {
  const result: PushSendResult = { attempted: messages.length, sent: 0, skipped: 0, errors: [] };
  if (messages.length === 0) return result;

  for (const batch of chunks(messages, 100)) {
    const response = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Accept-Encoding": "gzip, deflate",
        "Content-Type": "application/json"
      },
      body: JSON.stringify(batch)
    });

    if (!response.ok) {
      result.errors.push(`expo_push_http_${response.status}`);
      continue;
    }

    const payload = (await response.json()) as { data?: Array<{ status?: string; message?: string }> };
    for (const ticket of payload.data ?? []) {
      if (ticket.status === "ok") {
        result.sent += 1;
      } else {
        result.errors.push(ticket.message ?? "expo_push_error");
      }
    }
  }

  return result;
}

function pushMessagesForDevices(devices: RegisteredDevice[], item: StoredInboxItem): ExpoPushMessage[] {
  const base = messageForItem(item);
  return devices
    .filter((device) => isExpoPushToken(device.pushToken))
    .map((device) => ({
      ...base,
      to: device.pushToken
    }));
}

export async function notifyRiskItem(item: StoredInboxItem, options: { userId?: string } = {}): Promise<PushSendResult> {
  if (!expoPushEnabled() || item.analysis.score < riskThreshold()) {
    return { attempted: 0, sent: 0, skipped: 1, errors: [] };
  }

  const devices = await listDevices(options.userId);
  const messages = pushMessagesForDevices(devices, item);
  const invalidTokens = devices.length - messages.length;
  const result = await sendExpoPushMessages(messages);
  return {
    ...result,
    skipped: result.skipped + invalidTokens
  };
}
