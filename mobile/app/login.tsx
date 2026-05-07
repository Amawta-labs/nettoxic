import { useRouter } from "expo-router";
import * as ExpoLinking from "expo-linking";
import * as SecureStore from "expo-secure-store";
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, AppState, Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { getCurrentGmailAccount, getGmailAuthUrl, syncGmailInbox, watchGmailInbox } from "../src/api/client";
import { AwkiMark } from "../src/components/AwkiMark";
import { DemoThumbMenu } from "../src/components/DemoThumbMenu";
import { Screen } from "../src/components/Screen";
import { useInbox } from "../src/state/InboxContext";
import { colors, radius, shadow, spacing, typography } from "../src/theme";

const reviewItems = [
  { label: "Quién te escribió", symbol: "@" },
  { label: "El asunto y el remitente", symbol: "✉" },
  { label: "Solo si tú me lo pides", symbol: "✓" }
];

const GMAIL_PENDING_KEY = "awki.gmail.oauth.pending";
const GMAIL_CONNECTED_KEY = "awki.gmail.oauth.connected";

function firstQueryValue(value: undefined | string | string[]) {
  if (Array.isArray(value)) return value[0];
  return value;
}

export default function LoginScreen() {
  const router = useRouter();
  const incomingUrl = ExpoLinking.useURL();
  const { reload } = useInbox();
  const [opening, setOpening] = useState(false);
  const [checking, setChecking] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const handledUrlRef = useRef<string | null>(null);
  const checkingRef = useRef(false);

  const finishGmailConnection = useCallback(
    async ({ silentNotReady = false }: { silentNotReady?: boolean } = {}) => {
      if (checkingRef.current) return;
      checkingRef.current = true;
      setChecking(true);
      setStatus("Confirmando autorización con Gmail...");

      try {
        const account = await getCurrentGmailAccount();
        if (!account) {
          setStatus(silentNotReady ? "Esperando confirmación de Google..." : "No encontré la cuenta conectada.");
          if (!silentNotReady) {
            Alert.alert("Google aún no confirmó", "Termina la autorización en Google y vuelve a Awki.");
          }
          return;
        }

        setStatus("Activando monitoreo automático...");
        await watchGmailInbox();

        setStatus("Sincronizando bandeja...");
        await syncGmailInbox().catch(() => undefined);

        await SecureStore.setItemAsync(
          GMAIL_CONNECTED_KEY,
          JSON.stringify({ userId: account.userId, email: account.email, connectedAt: new Date().toISOString() })
        );
        await SecureStore.deleteItemAsync(GMAIL_PENDING_KEY);
        await reload();
        router.replace("/");
      } catch (error) {
        const message = error instanceof Error ? error.message : "No se pudo finalizar la conexión.";
        setStatus("No pude finalizar la conexión con Gmail.");
        if (!silentNotReady) Alert.alert("No pude activar Gmail", message);
      } finally {
        checkingRef.current = false;
        setChecking(false);
        setOpening(false);
      }
    },
    [reload, router]
  );

  useEffect(() => {
    if (!incomingUrl || handledUrlRef.current === incomingUrl) return;

    const parsed = ExpoLinking.parse(incomingUrl);
    const statusParam = firstQueryValue(parsed.queryParams?.gmail_status);
    if (!statusParam) return;

    handledUrlRef.current = incomingUrl;
    if (statusParam === "connected") {
      finishGmailConnection();
      return;
    }

    SecureStore.deleteItemAsync(GMAIL_PENDING_KEY).catch(() => undefined);
    const reason = firstQueryValue(parsed.queryParams?.gmail_error) ?? "Google no entregó autorización.";
    setStatus("Google no completó la autorización.");
    Alert.alert("No se conectó Gmail", reason);
    setOpening(false);
  }, [finishGmailConnection, incomingUrl]);

  useEffect(() => {
    const checkPendingConnection = async () => {
      const pending = await SecureStore.getItemAsync(GMAIL_PENDING_KEY);
      if (pending === "true") await finishGmailConnection({ silentNotReady: true });
    };

    checkPendingConnection().catch(() => undefined);
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") checkPendingConnection().catch(() => undefined);
    });

    return () => subscription.remove();
  }, [finishGmailConnection]);

  async function connectMail() {
    if (opening || checking) return;
    setOpening(true);
    setStatus("Preparando conexión segura con Google...");
    try {
      const returnUrl = ExpoLinking.createURL("/login", { scheme: "nettoxic", isTripleSlashed: true });
      const url = await getGmailAuthUrl(returnUrl);
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await SecureStore.setItemAsync(GMAIL_PENDING_KEY, "true");
        await Linking.openURL(url);
        setStatus("Completa Google. Awki volverá solo al terminar.");
      } else {
        throw new Error("Android no encontró navegador para abrir Google.");
      }
    } catch (error) {
      Alert.alert("No pude abrir Google", error instanceof Error ? error.message : "Revisa el backend.");
      await SecureStore.deleteItemAsync(GMAIL_PENDING_KEY).catch(() => undefined);
      setStatus(null);
      setOpening(false);
    } finally {
      if (!checkingRef.current) setOpening(false);
    }
  }

  return (
    <Screen>
      <View style={styles.container}>
        <View style={styles.topRow}>
          <View />
          <DemoThumbMenu active="login" />
        </View>

        <View style={styles.brand}>
          <AwkiMark size={72} />
          <Text style={styles.logoText}>Awki</Text>
          <Text style={styles.kicker}>TU ESPÍRITU PROTECTOR</Text>
        </View>

        <View style={styles.copy}>
          <Text style={styles.title}>Te aviso si alguien quiere engañarte.</Text>
          <Text style={styles.subtitle}>Reviso tus correos y mensajes. Si encuentro algo raro, te lo digo.</Text>
        </View>

        <View style={styles.reviewCard}>
          <Text style={styles.cardLabel}>QUÉ VOY A REVISAR</Text>
          {reviewItems.map((item) => (
            <View key={item.label} style={styles.reviewRow}>
              <View style={styles.reviewIcon}>
                <Text style={styles.reviewSymbol}>{item.symbol}</Text>
              </View>
              <Text style={styles.reviewText}>{item.label}</Text>
            </View>
          ))}
        </View>

        <Pressable
          style={[styles.connectButton, (opening || checking) && styles.connectButtonDisabled]}
          onPress={connectMail}
          disabled={opening || checking}
        >
          <Text style={styles.googleDot}>G</Text>
          <Text style={styles.connectText}>
            {checking ? "Conectando Gmail..." : opening ? "Abriendo Google..." : "Conectar mi correo"}
          </Text>
        </Pressable>

        {status ? <Text style={styles.statusText}>{status}</Text> : null}

        <Text style={styles.disclaimer}>No guardo tus correos. Solo los miro un momento para detectar riesgo.</Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
    justifyContent: "center",
    gap: spacing.xl
  },
  topRow: {
    position: "absolute",
    top: spacing.md,
    left: spacing.xl,
    right: spacing.xl,
    flexDirection: "row",
    justifyContent: "space-between"
  },
  brand: {
    alignItems: "center",
    gap: spacing.sm
  },
  logoText: {
    color: colors.primary,
    fontFamily: typography.fontFamilyBold,
    fontSize: 29,
  },
  kicker: {
    color: colors.rust,
    fontFamily: typography.fontFamilyBold,
    fontSize: 11,
    letterSpacing: 1.8
  },
  copy: {
    gap: spacing.sm
  },
  title: {
    color: colors.text,
    fontFamily: typography.fontFamilyBold,
    fontSize: 25,
    lineHeight: 31,
    textAlign: "center"
  },
  subtitle: {
    color: colors.muted,
    fontFamily: typography.fontFamily,
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center"
  },
  reviewCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.lg,
    gap: spacing.sm,
    ...shadow
  },
  cardLabel: {
    color: colors.rust,
    fontFamily: typography.fontFamilyBold,
    fontSize: 11,
    letterSpacing: 1.2
  },
  reviewRow: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderTopColor: colors.border,
    borderTopWidth: 1
  },
  reviewIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceAlt
  },
  reviewSymbol: {
    color: colors.primary,
    fontFamily: typography.fontFamilyBold,
    fontSize: 14,
  },
  reviewText: {
    flex: 1,
    color: colors.text,
    fontFamily: typography.fontFamily,
    fontSize: 14
  },
  connectButton: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    ...shadow
  },
  connectButtonDisabled: {
    opacity: 0.72
  },
  googleDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    overflow: "hidden",
    backgroundColor: colors.surface,
    color: colors.primary,
    fontFamily: typography.fontFamilyBold,
    fontSize: 13,
    lineHeight: 22,
    textAlign: "center"
  },
  connectText: {
    color: colors.surface,
    fontFamily: typography.fontFamilyBold,
    fontSize: 15,
  },
  statusText: {
    color: colors.muted,
    fontFamily: typography.fontFamilyMedium,
    fontSize: 13,
    lineHeight: 19,
    marginTop: -spacing.md,
    textAlign: "center"
  },
  disclaimer: {
    color: colors.subtle,
    fontFamily: typography.fontFamily,
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center"
  }
});
