import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { getNettoxicUserId, registerPushDevice } from "../api/client";

type RegistrationResult =
  | { ok: true; pushToken: string }
  | { ok: false; reason: string };

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    priority: Notifications.AndroidNotificationPriority.MAX
  })
});

function projectId() {
  const extra = Constants.expoConfig?.extra as { eas?: { projectId?: string }; nettoxic?: { easProjectId?: string } } | undefined;
  return process.env.EXPO_PUBLIC_EAS_PROJECT_ID ?? Constants.easConfig?.projectId ?? extra?.eas?.projectId ?? extra?.nettoxic?.easProjectId;
}

async function ensureAndroidChannel() {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync("risk-alerts", {
    name: "Alertas de riesgo",
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: "#E91515",
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC
  });
}

async function permissionStatus(requestPermission: boolean) {
  const existing = await Notifications.getPermissionsAsync();
  if (existing.status === "granted") return existing.status;
  if (!requestPermission) return existing.status;
  const requested = await Notifications.requestPermissionsAsync();
  return requested.status;
}

export async function registerRiskAlerts(requestPermission = true): Promise<RegistrationResult> {
  if (Platform.OS === "web") return { ok: false, reason: "push_no_soportado_en_web" };

  await ensureAndroidChannel();
  const status = await permissionStatus(requestPermission);
  if (status !== "granted") return { ok: false, reason: "permiso_notificaciones_denegado" };

  const expoProjectId = projectId();
  if (!expoProjectId) return { ok: false, reason: "falta_eas_project_id" };

  const token = await Notifications.getExpoPushTokenAsync({ projectId: expoProjectId });
  await registerPushDevice({
    userId: getNettoxicUserId(),
    pushToken: token.data,
    platform: Platform.OS === "android" || Platform.OS === "ios" ? Platform.OS : "unknown",
    appVersion: Constants.expoConfig?.version
  });

  return { ok: true, pushToken: token.data };
}

export async function refreshRiskAlertsIfAlreadyGranted(): Promise<RegistrationResult> {
  return registerRiskAlerts(false);
}

export function routeFromNotification(response: Notifications.NotificationResponse) {
  const data = response.notification.request.content.data;
  const route = data.route;
  if (typeof route === "string" && route.startsWith("/")) return route;

  const itemId = data.itemId;
  if (typeof itemId === "string") return `/analysis/${encodeURIComponent(itemId)}`;
  return null;
}
