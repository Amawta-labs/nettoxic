import { Link, useLocalSearchParams, useRouter } from "expo-router";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { reportCase } from "../../src/api/client";
import { AwkiMark } from "../../src/components/AwkiMark";
import { DemoThumbMenu } from "../../src/components/DemoThumbMenu";
import { Screen } from "../../src/components/Screen";
import { useInbox } from "../../src/state/InboxContext";
import { colors, radius, shadow, spacing, typography } from "../../src/theme";
import type { FraudSignal, InboxItem } from "../../src/types";

type DetailIconName = "back" | "alert" | "check" | "entity" | "urgency" | "key" | "link";

function DetailIcon({ name, size = 22, color = colors.danger }: { name: DetailIconName; size?: number; color?: string }) {
  const glyphs: Record<DetailIconName, string> = {
    back: "‹",
    alert: "!",
    check: "✓",
    entity: "ID",
    urgency: "24",
    key: "K",
    link: "↗"
  };

  return (
    <Text
      style={[
        styles.detailIconGlyph,
        {
          color,
          fontSize: size,
          lineHeight: Math.round(size * 1.08)
        }
      ]}
      numberOfLines={1}
    >
      {glyphs[name]}
    </Text>
  );
}

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
      icon: "entity" as const,
      title: `Se hace pasar por ${item.analysis.entidad_suplantada ? "tu entidad" : "alguien confiable"}`,
      body: signal.evidence || "El remitente o el mensaje imita una entidad conocida."
    };
  }
  if (key === "urgencia_artificial" || key === "amenaza_consecuencia") {
    return {
      icon: "urgency" as const,
      title: "Te están apurando",
      body: signal.evidence || "Usa presión o amenaza para que actúes sin verificar."
    };
  }
  if (key === "solicitud_credenciales") {
    return {
      icon: "key" as const,
      title: "Te pide tu clave",
      body: signal.evidence || "Un banco nunca pedirá tu clave o códigos por correo."
    };
  }
  if (key === "dominio_no_oficial" || key === "redireccion_sospechosa") {
    return {
      icon: "link" as const,
      title: "Te manda a un enlace riesgoso",
      body: signal.evidence || "El dominio no coincide con el canal oficial."
    };
  }
  return {
    icon: "alert" as const,
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

function formatLatency(latencyMs?: number) {
  if (typeof latencyMs !== "number") return "no medida";
  const seconds = latencyMs / 1000;
  return `${seconds < 10 ? seconds.toFixed(1) : Math.round(seconds)}s`;
}

function liveDemoInput(item: InboxItem) {
  return item.demoEvidence?.input || item.preview;
}

function modelLabel(item: InboxItem) {
  const debug = item.analysis.debug;
  if (debug?.usedClaude) return "Claude real";
  return debug?.model ? "Fallback local" : "Reglas locales";
}

function modelDetail(item: InboxItem) {
  const debug = item.analysis.debug;
  if (!debug?.model) return "sin modelo reportado";
  return debug.model.replace("anthropic:", "");
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
  const debug = item.analysis.debug;
  const latencyOk = typeof item.demoEvidence?.latencyMs === "number" && item.demoEvidence.latencyMs < 30000;
  const completedTools = debug?.agent?.tools.filter((tool) => tool.status === "completed").length ?? 0;
  const selectedAgents = debug?.agent?.selectedAgents.join(", ") || "orquestador";

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
            <DetailIcon name="back" size={31} color={colors.text} />
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
              <DetailIcon name="alert" size={32} color={colors.surface} />
            </View>
            <View style={styles.verdictCopy}>
              <Text style={styles.awkiSays}>AWKI DICE</Text>
              <Text style={styles.verdictTitle}>{isFraud ? "Esto es una estafa" : "Esto requiere cuidado"}</Text>
            </View>
          </View>
          <Text style={styles.verdictText} numberOfLines={3}>{item.analysis.explicacion}</Text>
        </View>

        <View style={styles.demoCard}>
          <View style={styles.demoHeader}>
            <View>
              <Text style={styles.demoEyebrow}>DEMO EN VIVO</Text>
              <Text style={styles.demoTitle}>Input y output del agente</Text>
            </View>
            <View style={[styles.latencyPill, latencyOk ? styles.latencyPillOk : styles.latencyPillMuted]}>
              <Text style={[styles.latencyText, latencyOk ? styles.latencyTextOk : styles.latencyTextMuted]}>
                {formatLatency(item.demoEvidence?.latencyMs)}
              </Text>
            </View>
          </View>

          <View style={styles.demoBlock}>
            <Text style={styles.demoLabel}>INPUT</Text>
            <Text style={styles.demoBody} numberOfLines={4}>{liveDemoInput(item)}</Text>
          </View>

          <View style={styles.demoBlock}>
            <Text style={styles.demoLabel}>OUTPUT</Text>
            <Text style={styles.demoOutputLine}>
              Riesgo {item.analysis.score}/100 · {item.analysis.nivel.toUpperCase()}
            </Text>
            <Text style={styles.demoBody} numberOfLines={2}>{item.analysis.explicacion}</Text>
          </View>

          <View style={styles.proofGrid}>
            <View style={styles.proofCell}>
              <Text style={styles.proofLabel}>LLM</Text>
              <Text style={styles.proofValue}>{modelLabel(item)}</Text>
              <Text style={styles.proofMeta} numberOfLines={1}>{modelDetail(item)}</Text>
            </View>
            <View style={styles.proofCell}>
              <Text style={styles.proofLabel}>ORQUESTADOR</Text>
              <Text style={styles.proofValue}>{completedTools} tools</Text>
              <Text style={styles.proofMeta} numberOfLines={1}>{selectedAgents}</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>QUÉ ENCONTRÉ</Text>
          {cards.length === 0 ? (
            <View style={styles.signalRow}>
              <View style={[styles.signalIcon, styles.signalIconSafe]}>
                <DetailIcon name="check" size={24} color={colors.success} />
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
                  <DetailIcon name={card.icon} size={card.icon === "link" ? 24 : 21} color={colors.danger} />
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
            <DetailIcon name="check" size={23} color={colors.surface} />
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
    fontSize: 16
  },
  detailIconGlyph: {
    includeFontPadding: false,
    color: colors.danger,
    fontFamily: typography.fontFamilyBold,
    textAlign: "center",
    textAlignVertical: "center"
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
    fontSize: 11
  },
  navTitle: {
    marginTop: 2,
    color: colors.text,
    fontFamily: typography.fontFamily,
    fontSize: 13
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
    fontSize: 11
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
    lineHeight: 20
  },
  demoCard: {
    gap: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: "#F5F8F1",
    padding: spacing.md,
    ...shadow
  },
  demoHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.md
  },
  demoEyebrow: {
    color: colors.primary,
    fontFamily: typography.fontFamilyBold,
    fontSize: 11
  },
  demoTitle: {
    marginTop: 2,
    color: colors.text,
    fontFamily: typography.fontFamilyBold,
    fontSize: 16,
    lineHeight: 20
  },
  latencyPill: {
    minWidth: 70,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    alignItems: "center"
  },
  latencyPillOk: {
    backgroundColor: "#EAF2EA",
    borderColor: "#BFD9C7"
  },
  latencyPillMuted: {
    backgroundColor: colors.surface,
    borderColor: colors.border
  },
  latencyText: {
    fontFamily: typography.fontFamilyBold,
    fontSize: 12
  },
  latencyTextOk: {
    color: colors.success
  },
  latencyTextMuted: {
    color: colors.muted
  },
  demoBlock: {
    gap: spacing.xs,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.md
  },
  demoLabel: {
    color: colors.muted,
    fontFamily: typography.fontFamilyBold,
    fontSize: 10
  },
  demoOutputLine: {
    color: colors.text,
    fontFamily: typography.fontFamilyBold,
    fontSize: 14,
    lineHeight: 19
  },
  demoBody: {
    color: colors.text,
    fontFamily: typography.fontFamily,
    fontSize: 13,
    lineHeight: 18
  },
  proofGrid: {
    flexDirection: "row",
    gap: spacing.sm
  },
  proofCell: {
    flex: 1,
    minWidth: 0,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.md
  },
  proofLabel: {
    color: colors.muted,
    fontFamily: typography.fontFamilyBold,
    fontSize: 9
  },
  proofValue: {
    marginTop: 3,
    color: colors.primary,
    fontFamily: typography.fontFamilyBold,
    fontSize: 14,
    lineHeight: 18
  },
  proofMeta: {
    marginTop: 2,
    color: colors.muted,
    fontFamily: typography.fontFamily,
    fontSize: 10,
    lineHeight: 14
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
    backgroundColor: "#F7E9E5",
    borderColor: "#E6BDB4",
    borderWidth: 1
  },
  signalIconSafe: {
    backgroundColor: "#EAF2EA",
    borderColor: "#BFD9C7"
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
