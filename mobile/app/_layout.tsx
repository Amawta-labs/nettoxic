import { Stack } from "expo-router";
import { useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Font from "expo-font";
import * as Notifications from "expo-notifications";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { LogBox, Text, TextInput } from "react-native";
import { InboxProvider } from "../src/state/InboxContext";
import {
  refreshRiskAlertsIfAlreadyGranted,
  routeFromNotification,
  speechTextFromNotification
} from "../src/notifications/riskAlerts";
import { playRiskAlertVoice } from "../src/audio/riskVoice";
import { colors } from "../src/theme";

LogBox.ignoreAllLogs(true);

type Defaultable = {
  defaultProps?: Record<string, unknown>;
};

function lockReadableTextScale(Component: Defaultable) {
  Component.defaultProps = {
    ...Component.defaultProps,
    allowFontScaling: false,
    maxFontSizeMultiplier: 1
  };
}

lockReadableTextScale(Text as unknown as Defaultable);
lockReadableTextScale(TextInput as unknown as Defaultable);

function NotificationBridge() {
  const router = useRouter();

  useEffect(() => {
    refreshRiskAlertsIfAlreadyGranted().catch(() => undefined);
  }, []);

  useEffect(() => {
    const openFromNotification = (response: Notifications.NotificationResponse) => {
      playRiskAlertVoice(speechTextFromNotification(response.notification.request.content)).catch(() => undefined);
      const route = routeFromNotification(response);
      if (route) router.push(route);
    };

    Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        if (response) openFromNotification(response);
      })
      .catch(() => undefined);

    const receivedSubscription = Notifications.addNotificationReceivedListener((notification) => {
      playRiskAlertVoice(speechTextFromNotification(notification.request.content)).catch(() => undefined);
    });
    const responseSubscription = Notifications.addNotificationResponseReceivedListener(openFromNotification);
    return () => {
      receivedSubscription.remove();
      responseSubscription.remove();
    };
  }, [router]);

  return null;
}

export default function RootLayout() {
  const [fontsReady, setFontsReady] = useState(false);

  useEffect(() => {
    Promise.all([
      Font.loadAsync({
        "NotoSans-Regular": require("../assets/fonts/NotoSans-Regular.ttf"),
        "NotoSans-Medium": require("../assets/fonts/NotoSans-Medium.ttf"),
        "NotoSans-Bold": require("../assets/fonts/NotoSans-Bold.ttf")
      }),
      MaterialCommunityIcons.loadFont()
    ])
      .catch(() => undefined)
      .finally(() => setFontsReady(true));
  }, []);

  if (!fontsReady) return null;

  return (
    <InboxProvider>
      <NotificationBridge />
      <StatusBar style="dark" backgroundColor={colors.background} translucent={false} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background }
        }}
      >
        <Stack.Screen name="login" options={{ title: "Login" }} />
        <Stack.Screen name="index" options={{ title: "Awki" }} />
        <Stack.Screen name="manual" options={{ title: "Analisis manual" }} />
        <Stack.Screen name="analysis/[id]" options={{ title: "Analisis" }} />
        <Stack.Screen name="action" options={{ title: "Que hacer ahora" }} />
      </Stack>
    </InboxProvider>
  );
}
