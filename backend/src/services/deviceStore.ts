import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

export type RegisteredDevice = {
  userId: string;
  pushToken: string;
  platform: "android" | "ios" | "web" | "unknown";
  appVersion?: string;
  createdAt: string;
  updatedAt: string;
};

const DEFAULT_STORE_FILE = "data/device-tokens.json";

function storeFile() {
  return process.env.DEVICE_TOKEN_STORE_FILE ?? DEFAULT_STORE_FILE;
}

async function readDevices(): Promise<RegisteredDevice[]> {
  try {
    const raw = await readFile(storeFile(), "utf8");
    const parsed = JSON.parse(raw) as { devices?: RegisteredDevice[] };
    return Array.isArray(parsed.devices) ? parsed.devices : [];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

async function writeDevices(devices: RegisteredDevice[]) {
  const file = storeFile();
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify({ devices }, null, 2)}\n`, { mode: 0o600 });
}

export async function upsertDevice(input: {
  userId: string;
  pushToken: string;
  platform: RegisteredDevice["platform"];
  appVersion?: string;
}): Promise<RegisteredDevice> {
  const now = new Date().toISOString();
  const devices = await readDevices();
  const existing = devices.find((device) => device.pushToken === input.pushToken);
  const next: RegisteredDevice = {
    userId: input.userId,
    pushToken: input.pushToken,
    platform: input.platform,
    appVersion: input.appVersion,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now
  };

  await writeDevices([next, ...devices.filter((device) => device.pushToken !== input.pushToken)]);
  return next;
}

export async function listDevices(userId?: string): Promise<RegisteredDevice[]> {
  const devices = await readDevices();
  return userId ? devices.filter((device) => device.userId === userId) : devices;
}

