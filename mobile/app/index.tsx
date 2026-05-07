import { Link, useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useMemo, useState } from "react";
import { ActivityIndicator, Alert, FlatList, PermissionsAndroid, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { AwkiMark } from "../src/components/AwkiMark";
import { DemoThumbMenu } from "../src/components/DemoThumbMenu";
import { RiskBadge } from "../src/components/RiskBadge";
import { Screen } from "../src/components/Screen";
import { registerRiskAlerts } from "../src/notifications/riskAlerts";
import { useInbox } from "../src/state/InboxContext";
import { colors, radius, shadow, spacing, typography } from "../src/theme";
import type { InboxItem } from "../src/types";

type InboxTab = "email" | "sms";

function displaySender(item: InboxItem) {
  const raw = (item.sender || item.subject || item.source).replace(/["']/g, "").trim();
  const name = raw.includes("<") ? raw.split("<")[0]?.trim() ?? raw : raw;
  const lower = raw.toLowerCase();
  if (lower.includes("bancoestado") || lower.includes("banco estado")) return "BANCO ESTADO CHILE";
  if (lower.includes("correos")) return "CORREOS CHILE";
  if (lower.includes("mercadolibre") || lower.includes("mercado libre")) return "MERCADO LIBRE";
  if (lower.includes("firebase")) return "FIREBASE";
  if (lower.includes("claude")) return "CLAUDE TEAM";
  if (raw.includes("@")) return raw.split("@")[0]?.replace(/[._-]/g, " ").toUpperCase();
  if (raw.startsWith("+")) return "MENSAJE SMS";
  return name.toUpperCase();
}

function itemTime(item: InboxItem) {
  if (item.source === "sms") return "Hoy, 09:41";
  if (item.id.includes("002")) return "Ayer, 18:14";
  if (item.id.includes("003")) return "Lun, 09:05";
  return "Hoy, 19:32";
}

function riskCount(items: InboxItem[]) {
  return items.filter((item) => item.analysis.score >= 35).length;
}

function displaySubject(item: InboxItem) {
  return item.subject?.replace(/\s+/g, " ").trim() || item.preview.replace(/\s+/g, " ").trim();
}

export default function InboxScreen() {
  const router = useRouter();
  const { items, loading, error, backendOnline, mockMode, apiBaseUrl, reload } = useInbox();
  const [tab, setTab] = useState<InboxTab>("email");
  const riskyCount = riskCount(items);
  const filteredItems = useMemo(
    () => items.filter((item) => (tab === "email" ? item.source !== "sms" : item.source === "sms")),
    [items, tab]
  );
  const firstAnalysisId = useMemo(() => items.find((item) => item.analysis.score >= 35)?.id ?? items[0]?.id, [items]);

  async function enableSmsProtection() {
    if (Platform.OS !== "android") {
      Alert.alert("Solo Android", "La intercepción de SMS requiere permisos nativos de Android.");
      return;
    }

    const permissions: Parameters<typeof PermissionsAndroid.requestMultiple>[0] = [
      PermissionsAndroid.PERMISSIONS.RECEIVE_SMS,
      PermissionsAndroid.PERMISSIONS.READ_SMS
    ];
    const notificationPermission = (PermissionsAndroid.PERMISSIONS as Record<string, string | undefined>).POST_NOTIFICATIONS as
      | (typeof permissions)[number]
      | undefined;
    if (notificationPermission) permissions.push(notificationPermission);

    const result = await PermissionsAndroid.requestMultiple(permissions);
    const permissionResult = result as Record<string, string>;
    const smsGranted =
      permissionResult[PermissionsAndroid.PERMISSIONS.RECEIVE_SMS] === PermissionsAndroid.RESULTS.GRANTED &&
      permissionResult[PermissionsAndroid.PERMISSIONS.READ_SMS] === PermissionsAndroid.RESULTS.GRANTED;
    const notificationsGranted = !notificationPermission || permissionResult[notificationPermission] === PermissionsAndroid.RESULTS.GRANTED;

    if (smsGranted) {
      Alert.alert(
        "Monitoreo SMS activado",
        notificationsGranted
          ? "Awki analizará SMS entrantes y mostrará alertas de riesgo."
          : "Awki analizará SMS entrantes. Activa notificaciones para ver alertas inmediatas."
      );
    } else {
      Alert.alert("Permiso requerido", "Para interceptar SMS sospechosos debes conceder RECEIVE_SMS y READ_SMS.");
    }
  }

  async function enableEmailAlerts() {
    try {
      const result = await registerRiskAlerts(true);
      if (result.ok) {
        Alert.alert("Alertas activadas", "Awki avisará cuando Gmail detecte un mensaje riesgoso.");
        return;
      }

      const copy =
        result.reason === "falta_eas_project_id"
          ? "Falta configurar EXPO_PUBLIC_EAS_PROJECT_ID o extra.eas.projectId para emitir push reales."
          : "No se pudo activar la alerta push. Revisa permisos de notificación.";
      Alert.alert("Configuración pendiente", copy);
    } catch (registrationError) {
      Alert.alert("No se pudo registrar el teléfono", registrationError instanceof Error ? registrationError.message : "Error desconocido");
    }
  }

  function renderItem({ item }: { item: InboxItem }) {
    const risky = item.analysis.score >= 65;
    const cautious = item.analysis.score >= 35 && item.analysis.score < 65;

    return (
      <Pressable
        style={[styles.mailCard, risky && styles.mailCardDanger, cautious && styles.mailCardWarn]}
        onPress={() => router.push(`/analysis/${item.id}`)}
      >
        <View style={[styles.mailAccent, risky && styles.mailAccentDanger, cautious && styles.mailAccentWarn]} />
        <View style={styles.mailContent}>
          <View style={styles.mailHeader}>
            <Text style={styles.senderLabel} numberOfLines={1}>{displaySender(item)}</Text>
            <RiskBadge level={item.analysis.nivel} compact />
          </View>
          <Text style={styles.mailSubject} numberOfLines={2}>
            {displaySubject(item)}
          </Text>
          <Text style={styles.mailTime}>{itemTime(item)}</Text>
        </View>
      </Pressable>
    );
  }

  return (
    <Screen>
      <FlatList
        data={loading || error ? [] : filteredItems}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <View style={styles.headerBlock}>
            <View style={styles.brandRow}>
              <View style={styles.brandLeft}>
                <AwkiMark size={38} />
                <Text style={styles.brandName}>Awki</Text>
              </View>
              <View style={styles.headerActions}>
                <DemoThumbMenu active="inbox" analysisId={firstAnalysisId} />
                <Pressable style={styles.avatar} onPress={reload}>
                  <Text style={styles.avatarText}>L</Text>
                </Pressable>
              </View>
            </View>

            <Text style={styles.greeting}>Buenos días, Lissette</Text>
            <Text style={styles.headline}>
              Encontré <Text style={styles.headlineDanger}>{riskyCount}</Text> {riskyCount === 1 ? "cosa rara" : "cosas raras"}{"\n"}en tus correos.
            </Text>
            <View style={styles.metaRow}>
              <MaterialCommunityIcons name="clock-outline" size={14} color={colors.subtle} />
              <Text style={styles.metaText}>
                {mockMode ? "Datos de demo" : backendOnline ? "Revisé hace 2 minutos" : `Sin backend: ${apiBaseUrl}`} · {items.length} correos
              </Text>
            </View>

            <View style={styles.tabs}>
              <Pressable style={[styles.tab, tab === "email" && styles.tabActive]} onPress={() => setTab("email")}>
                <MaterialCommunityIcons name="email-outline" size={17} color={tab === "email" ? colors.surface : colors.muted} />
                <Text style={[styles.tabText, tab === "email" && styles.tabTextActive]}>Correos</Text>
                <View style={styles.tabCount}>
                  <Text style={styles.tabCountText}>{riskCount(items.filter((item) => item.source !== "sms"))}</Text>
                </View>
              </Pressable>
              <Pressable style={[styles.tab, tab === "sms" && styles.tabActive]} onPress={() => setTab("sms")}>
                <MaterialCommunityIcons name="message-outline" size={17} color={tab === "sms" ? colors.surface : colors.muted} />
                <Text style={[styles.tabText, tab === "sms" && styles.tabTextActive]}>Mensajes</Text>
              </Pressable>
            </View>

            {loading ? (
              <View style={styles.stateCard}>
                <ActivityIndicator color={colors.primary} />
                <Text style={styles.stateText}>Awki está revisando tus mensajes.</Text>
              </View>
            ) : error ? (
              <View style={styles.stateCard}>
                <Text style={styles.stateTitle}>No pude revisar la bandeja</Text>
                <Text style={styles.stateText}>{error}</Text>
                <Pressable style={styles.smallButton} onPress={reload}>
                  <Text style={styles.smallButtonText}>Reintentar</Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          loading || error ? null : (
            <View style={styles.stateCard}>
              <Text style={styles.stateTitle}>Nada raro por ahora</Text>
              <Text style={styles.stateText}>Cuando llegue un correo o SMS sospechoso, lo vas a ver acá.</Text>
            </View>
          )
        }
        ListFooterComponent={
          <View style={styles.footer}>
            <View style={styles.protectionCard}>
              <AwkiMark size={34} />
              <View style={styles.protectionCopy}>
                <Text style={styles.protectionTitle}>Automático cuando es posible</Text>
                <Text style={styles.protectionText}>Manual cuando sea necesario</Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={24} color={colors.muted} />
            </View>

            <View style={styles.bottomNav}>
              <Pressable style={styles.bottomItem} onPress={() => setTab("email")}>
                <MaterialCommunityIcons name="email-outline" size={24} color={tab === "email" ? colors.primary : colors.muted} />
                <Text style={[styles.bottomText, tab === "email" && styles.bottomTextActive]}>Correos</Text>
              </Pressable>
              <Pressable style={styles.bottomItem} onPress={() => setTab("sms")}>
                <MaterialCommunityIcons name="message-outline" size={24} color={tab === "sms" ? colors.primary : colors.muted} />
                <Text style={[styles.bottomText, tab === "sms" && styles.bottomTextActive]}>Mensajes</Text>
              </Pressable>
              <Link href="/manual" asChild>
                <Pressable style={styles.bottomItem}>
                  <MaterialCommunityIcons name="camera-outline" size={24} color={colors.muted} />
                  <Text style={styles.bottomText}>Foto</Text>
                </Pressable>
              </Link>
              <Pressable style={styles.bottomItem} onPress={tab === "sms" ? enableSmsProtection : enableEmailAlerts}>
                <MaterialCommunityIcons name="cog-outline" size={24} color={colors.muted} />
                <Text style={styles.bottomText}>Ajustes</Text>
              </Pressable>
            </View>
          </View>
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    gap: spacing.md
  },
  headerBlock: {
    gap: spacing.sm
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  brandLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm
  },
  brandName: {
    color: colors.primary,
    fontFamily: typography.fontFamilyBold,
    fontSize: 18,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary
  },
  avatarText: {
    color: colors.surface,
    fontFamily: typography.fontFamilyBold,
  },
  greeting: {
    marginTop: spacing.xs,
    color: colors.muted,
    fontFamily: typography.fontFamily,
    fontSize: 13
  },
  headline: {
    color: colors.text,
    fontFamily: typography.fontFamilyBold,
    fontSize: 22,
    lineHeight: 27,
  },
  headlineDanger: {
    color: colors.danger
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs
  },
  metaText: {
    flex: 1,
    color: colors.subtle,
    fontFamily: typography.fontFamily,
    fontSize: 12
  },
  tabs: {
    marginTop: spacing.sm,
    flexDirection: "row",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 5,
    gap: 5
  },
  tab: {
    minHeight: 42,
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    borderRadius: radius.sm
  },
  tabActive: {
    backgroundColor: colors.primary
  },
  tabText: {
    color: colors.muted,
    fontFamily: typography.fontFamilyBold,
    fontSize: 13,
  },
  tabTextActive: {
    color: colors.surface
  },
  tabCount: {
    minWidth: 20,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.rust
  },
  tabCountText: {
    color: colors.surface,
    fontFamily: typography.fontFamilyBold,
    fontSize: 11,
  },
  mailCard: {
    position: "relative",
    alignSelf: "stretch",
    minHeight: 104,
    overflow: "hidden",
    backgroundColor: "#FFF9ED",
    borderColor: "#CDBBA3",
    borderWidth: 1.5,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingRight: spacing.md,
    paddingLeft: 24,
    marginBottom: spacing.sm,
    ...shadow
  },
  mailCardDanger: {
    borderColor: "#E8BBB1"
  },
  mailCardWarn: {
    borderColor: "#E5C78E"
  },
  mailAccent: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 5,
    backgroundColor: colors.success
  },
  mailAccentDanger: {
    backgroundColor: colors.danger
  },
  mailAccentWarn: {
    backgroundColor: colors.warning
  },
  mailContent: {
    minWidth: 0,
    flex: 1
  },
  mailHeader: {
    minHeight: 25,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm
  },
  senderLabel: {
    flex: 1,
    minWidth: 0,
    color: colors.muted,
    fontFamily: typography.fontFamilyBold,
    fontSize: 11,
  },
  mailSubject: {
    marginTop: spacing.sm,
    color: colors.text,
    fontFamily: typography.fontFamilyBold,
    fontSize: 15,
    lineHeight: 20,
  },
  mailTime: {
    marginTop: spacing.xs,
    color: colors.subtle,
    fontFamily: typography.fontFamily,
    fontSize: 12
  },
  stateCard: {
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.lg,
    ...shadow
  },
  stateTitle: {
    color: colors.text,
    fontFamily: typography.fontFamilyBold,
    fontSize: 16,
    
    textAlign: "center"
  },
  stateText: {
    color: colors.muted,
    fontFamily: typography.fontFamily,
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center"
  },
  smallButton: {
    marginTop: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm
  },
  smallButtonText: {
    color: colors.surface,
    fontFamily: typography.fontFamilyBold,
    
  },
  footer: {
    gap: spacing.md
  },
  protectionCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md
  },
  protectionCopy: {
    flex: 1
  },
  protectionTitle: {
    color: colors.text,
    fontFamily: typography.fontFamilyBold,
    fontSize: 15,
    
  },
  protectionText: {
    marginTop: 2,
    color: colors.muted,
    fontFamily: typography.fontFamily,
    fontSize: 13
  },
  bottomNav: {
    minHeight: 68,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.sm,
    ...shadow
  },
  bottomItem: {
    minWidth: 64,
    alignItems: "center",
    gap: 3
  },
  bottomText: {
    color: colors.muted,
    fontFamily: typography.fontFamilyBold,
    fontSize: 11,
    
  },
  bottomTextActive: {
    color: colors.primary
  }
});
