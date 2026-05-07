import type { StoredInboxItem } from "./ingestStore.js";
import { listDevices, type RegisteredDevice } from "./deviceStore.js";

type ExpoPushMessage = {
  to: string;
  sound: "default";
  title: string;
  body: string;
  priority: "high";
  channelId: string;
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

function messageForItem(item: StoredInboxItem): Omit<ExpoPushMessage, "to"> {
  const spokenEntity = item.analysis.entidad_suplantada ?? item.sender ?? "un mensaje sospechoso";
  const pushBody = item.analysis.entidad_suplantada
    ? `No respondas. No abras enlaces. ${item.analysis.entidad_suplantada} no pide claves por mensaje.`
    : "No respondas. No abras enlaces. No compartas claves.";
  const speakText =
    `Alerta Awki. Posible estafa en ${spokenEntity}. ` +
    "No respondas. No abras enlaces. No compartas claves.";
  return {
    sound: "default",
    title: "Awki: posible estafa",
    body: pushBody,
    priority: "high",
    channelId: "risk-alerts",
    data: {
      type: "risk_alert",
      itemId: item.id,
      source: item.source,
      score: item.analysis.score,
      nivel: item.analysis.nivel,
      speakText,
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
