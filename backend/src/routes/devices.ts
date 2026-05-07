import { Router } from "express";
import { z } from "zod";
import { upsertDevice, listDevices } from "../services/deviceStore.js";
import { asyncRoute } from "./asyncRoute.js";

export const devicesRouter = Router();

const RegisterDeviceSchema = z.object({
  userId: z.string().min(1),
  pushToken: z.string().min(1),
  platform: z.enum(["android", "ios", "web", "unknown"]).default("unknown"),
  appVersion: z.string().optional()
});

function maskToken(token: string) {
  if (token.length <= 18) return "***";
  return `${token.slice(0, 14)}...${token.slice(-6)}`;
}

devicesRouter.post("/register", asyncRoute(async (req, res) => {
  const parsed = RegisterDeviceSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_device_registration", details: parsed.error.flatten() });
    return;
  }

  const device = await upsertDevice(parsed.data);
  res.json({
    ok: true,
    device: {
      userId: device.userId,
      platform: device.platform,
      appVersion: device.appVersion,
      pushToken: maskToken(device.pushToken),
      updatedAt: device.updatedAt
    }
  });
}));

devicesRouter.get("/", asyncRoute(async (req, res) => {
  const userId = typeof req.query.userId === "string" ? req.query.userId : undefined;
  const devices = await listDevices(userId);
  res.json({
    devices: devices.map((device) => ({
      userId: device.userId,
      platform: device.platform,
      appVersion: device.appVersion,
      pushToken: maskToken(device.pushToken),
      updatedAt: device.updatedAt
    }))
  });
}));

