import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Link, useLocalSearchParams, useRouter } from "expo-router";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { reportCase } from "../../src/api/client";
import { AwkiMark } from "../../src/components/AwkiMark";
import { DemoThumbMenu } from "../../src/components/DemoThumbMenu";
import { Screen } from "../../src/components/Screen";
import { useInbox } from "../../src/state/InboxContext";
import { colors, radius, shadow, spacing, typography } from "../../src/theme";
import type { FraudSignal, InboxItem } from "../../src/types";

function sourceLabel(item: InboxItem) {
  if (item.source === "sms") return "ANÁLISIS DEL MENSAJE";
  if (item.source === "manual") return "ANÁLISIS MANUAL";
  return "ANÁLISIS DEL CORREO";
}

function entityLine(item: InboxItem) {
  const entity = item.analysis.entidad_suplantada ?? displayEntity(item);
  return `${entity} · Hoy 19:32`;
}

function displayEntity(item: InboxItem) {
  if (item.analysis.entidad_suplantada) return item.analysis.entidad_suplantada;
  const lower = `${item.sender} ${item.subject ?? ""}`.toLowerCase();
  if (lower.includes("bancoestado") || lower.includes("banco estado")) return "Banco Estado";
  if (lower.includes("correos")) return "Correos Chile";
  if (lower.includes("mercadolibre") || lower.includes("mercado libre")) return "Mercado Libre";
  if (item.sender.includes("@")) return item.sender.split("@")[0]?.replace(/[._-]/g, " ") ?? "Mensaje";
  return item.subject ?? "Mensaje";
}

function signalCard(signal: FraudSignal, item: InboxItem) {
  const key = signal.key;
  if (key === "suplantacion_entidad") {
    return {
      icon: "account-alert-outline",
      title: `Se hace pasar por ${item.analysis.entidad_suplantada ? "tu entidad" : "alguien confiable"}`,
      body: signal.evidence || "El remitente o el mensaje imita una entidad conocida."
    };
  }
  if (key === "urgencia_artificial" || key === "amenaza_consecuencia") {
    return {
      icon: "clock-alert-outline",
      title: "Te están apurando",
      body: signal.evidence || "Usa presión o amenaza para que actúes sin verificar."
    };
  }
  if (key === "solicitud_credenciales") {
    return {
      icon: "shield-key-outline",
      title: "Te pide tu clave",
      body: signal.evidence || "Un banco nunca pedirá tu clave o códigos por correo."
    };
  }
  if (key === "dominio_no_oficial" || key === "redireccion_sospechosa") {
    return {
      icon: "link-variant-alert",
      title: "Te manda a un enlace riesgoso",
      body: signal.evidence || "El dominio no coincide con el canal oficial."
    };
  }
  return {
    icon: "alert-outline",
    title: signal.label,
    body: signal.evidence || "Awki encontró esta señal en el mensaje."
  };
}

function uniqueSignalCards(signals: FraudSignal[], item: InboxItem) {
  const seen = new Set<string>();
  return signals
    .filter((signal) => signal.present)
    .map((signal) => signalCard(signal, item))
    .filter((card) => {
      if (seen.has(card.title)) return false;
      seen.add(card.title);
      return true;
    })
    .slice(0, 4);
}

export default function AnalysisScreen() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const id = typeof params.id === "string" ? params.id : null;
  const { getItem, mockMode } = useInbox();
  const item = getItem(id);

  if (!item) {
    return (
      <Screen>
        <View style={styles.missing}>
          <Text style={styles.missingText}>Mensaje no encontrado.</Text>
        </View>
      </Screen>
    );
  }

  const cards = uniqueSignalCards(item.analysis.senales_detectadas, item);
  const isFraud = item.analysis.score >= 65;

  async function onReport() {
    if (!id) return;
    if (mockMode) {
      Alert.alert("Reporte de demo", "Este reporte no se envió porque la app está en modo mock.");
      return;
    }
    try {
      await reportCase(id, true);
      Alert.alert("Reporte recibido", "El caso quedó marcado como fraude confirmado.");
    } catch {
      Alert.alert("No se pudo reportar", "Verifica que el backend esté conectado.");
    }
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.navRow}>
          <Pressable style={styles.navButton} onPress={() => router.back()}>
            <MaterialCommunityIcons name="chevron-left" size={26} color={colors.text} />
          </Pressable>
          <View style={styles.navTitleBlock}>
            <Text style={styles.navLabel}>{sourceLabel(item)}</Text>
            <Text style={styles.navTitle} numberOfLines={1}>{entityLine(item)}</Text>
          </View>
          <DemoThumbMenu active="detail" analysisId={id} />
        </View>

        <View style={[styles.verdictCard, isFraud && styles.verdictDanger]}>
          <View style={styles.verdictTop}>
            <View style={styles.alertIcon}>
              <MaterialCommunityIcons name="alert-outline" size={26} color={colors.surface} />
            </View>
            <View style={styles.verdictCopy}>
              <Text style={styles.awkiSays}>AWKI DICE</Text>
              <Text style={styles.verdictTitle}>{isFraud ? "Esto es una estafa" : "Esto requiere cuidado"}</Text>
            </View>
          </View>
          <Text style={styles.verdictText} numberOfLines={3}>{item.analysis.explicacion}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>QUÉ ENCONTRÉ</Text>
          {cards.length === 0 ? (
            <View style={styles.signalRow}>
              <View style={styles.signalIcon}>
                <MaterialCommunityIcons name="check-circle-outline" size={22} color={colors.success} />
              </View>
              <View style={styles.signalCopy}>
                <Text style={styles.signalTitle}>No hay señales fuertes</Text>
                <Text style={styles.signalBody}>De todos modos, revisa el remitente antes de responder.</Text>
              </View>
            </View>
          ) : (
            cards.map((card) => (
              <View key={card.title} style={styles.signalRow}>
                <View style={styles.signalIcon}>
                  <MaterialCommunityIcons name={card.icon as keyof typeof MaterialCommunityIcons.glyphMap} size={22} color={colors.danger} />
                </View>
                <View style={styles.signalCopy}>
                  <Text style={styles.signalTitle}>{card.title}</Text>
                  <Text style={styles.signalBody}>{card.body}</Text>
                </View>
              </View>
            ))
          )}
        </View>

        <View style={styles.debugStrip}>
          <AwkiMark size={28} />
          <Text style={styles.debugText}>
            Motor: {item.analysis.debug?.usedClaude ? "Claude" : item.analysis.debug?.model ?? "reglas locales"} · Patrón: {item.analysis.debug?.embedding?.label ?? "sin match fuerte"}
          </Text>
        </View>

        <Link href={{ pathname: "/action", params: { id: item.id } }} asChild>
          <Pressable style={styles.primaryButton}>
            <MaterialCommunityIcons name="check" size={22} color={colors.surface} />
            <Text style={styles.primaryButtonText}>Entendido, no voy a responder</Text>
          </Pressable>
        </Link>
        <Pressable style={styles.secondaryButton} onPress={onReport}>
          <Text style={styles.secondaryButtonText}>Reportar esta estafa</Text>
        </Pressable>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.lg
  },
  missing: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl
  },
  missingText: {
    color: colors.text,
    fontFamily: typography.fontFamily,
    fontSize: 16,
  },
  navRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md
  },
  navButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border
  },
  navTitleBlock: {
    flex: 1
  },
  navLabel: {
    color: colors.muted,
    fontFamily: typography.fontFamily,
    fontSize: 11,
  },
  navTitle: {
    marginTop: 2,
    color: colors.text,
    fontFamily: typography.fontFamily,
    fontSize: 13,
  },
  verdictCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    gap: spacing.md,
    ...shadow
  },
  verdictDanger: {
    backgroundColor: colors.dangerSoft,
    borderColor: "#E1A89E"
  },
  verdictTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md
  },
  alertIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.danger
  },
  verdictCopy: {
    flex: 1
  },
  awkiSays: {
    color: colors.rustDark,
    fontFamily: typography.fontFamily,
    fontSize: 11,
  },
  verdictTitle: {
    color: colors.danger,
    fontFamily: typography.fontFamily,
    fontSize: 22,
    lineHeight: 26,
  },
  verdictText: {
    color: colors.text,
    fontFamily: typography.fontFamily,
    fontSize: 14,
    lineHeight: 20,
  },
  section: {
    gap: spacing.sm
  },
  sectionTitle: {
    color: colors.muted,
    fontFamily: typography.fontFamily,
    fontSize: 12,
  },
  signalRow: {
    flexDirection: "row",
    gap: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: spacing.md
  },
  signalIcon: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.sm,
    backgroundColor: colors.surface
  },
  signalCopy: {
    flex: 1
  },
  signalTitle: {
    color: colors.text,
    fontFamily: typography.fontFamily,
    fontSize: 16,
    lineHeight: 21,
  },
  signalBody: {
    marginTop: spacing.xs,
    color: colors.muted,
    fontFamily: typography.fontFamily,
    fontSize: 13,
    lineHeight: 19
  },
  debugStrip: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md
  },
  debugText: {
    flex: 1,
    color: colors.muted,
    fontFamily: typography.fontFamily,
    fontSize: 12,
    lineHeight: 17,
  },
  primaryButton: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md
  },
  primaryButtonText: {
    color: colors.surface,
    fontFamily: typography.fontFamily,
    fontSize: 16,
  },
  secondaryButton: {
    minHeight: 50,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface
  },
  secondaryButtonText: {
    color: colors.muted,
    fontFamily: typography.fontFamily,
    fontSize: 14,
  }
});
