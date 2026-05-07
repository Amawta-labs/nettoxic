import { useLocalSearchParams, useRouter } from "expo-router";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { reportCase } from "../src/api/client";
import { AwkiMark } from "../src/components/AwkiMark";
import { Screen } from "../src/components/Screen";
import { useInbox } from "../src/state/InboxContext";
import { colors, radius, shadow, spacing, typography } from "../src/theme";

const FALLBACK_STEPS = [
  "No abras enlaces sospechosos.",
  "Verifica por canales oficiales.",
  "Reporta el caso si ya entregaste datos."
];

type ActionIconName = "back" | "block" | "key" | "shield" | "flag" | "next" | "book" | "alert" | "light" | "lock";

const stepIcons: ActionIconName[] = ["block", "key", "shield", "flag"];

function ActionIcon({ name, size = 22, color = colors.text }: { name: ActionIconName; size?: number; color?: string }) {
  const glyphs: Record<ActionIconName, string> = {
    back: "‹",
    block: "!",
    key: "K",
    shield: "✓",
    flag: "⚑",
    next: "›",
    book: "i",
    alert: "!",
    light: "!",
    lock: "L"
  };

  return (
    <Text
      style={[
        styles.actionIconGlyph,
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

export default function ActionScreen() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const id = typeof params.id === "string" ? params.id : null;
  const { getItem, mockMode } = useInbox();
  const item = getItem(id);
  const steps = item?.analysis.pasos?.length ? item.analysis.pasos : FALLBACK_STEPS;
  const embedding = item?.analysis.debug?.embedding;

  async function onReport() {
    if (!id) {
      Alert.alert("Ruta inválida", "No hay mensaje seleccionado para reportar.");
      return;
    }
    if (mockMode) {
      Alert.alert("Reporte de demo", "No se envió al backend porque la app está en modo mock.");
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
        <View style={styles.topRow}>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <ActionIcon name="back" size={31} color={colors.text} />
          </Pressable>
          <Text style={styles.topTitle}>Qué hacer ahora</Text>
          <View style={styles.backButtonPlaceholder} />
        </View>

        <View style={styles.hero}>
          <AwkiMark size={82} />
          <Text style={styles.heroTitle}>Te protegimos antes del clic.</Text>
          <Text style={styles.heroSubtitle}>Sigue estos pasos.</Text>
        </View>

        <View style={styles.steps}>
          {steps.map((step, index) => (
            <View key={`${index}-${step}`} style={styles.stepCard}>
              <View style={[styles.indexCircle, index === 1 && styles.indexAmber, index === 2 && styles.indexGreen]}>
                <Text style={styles.indexText}>{index + 1}</Text>
              </View>
              <View style={styles.stepIcon}>
                <ActionIcon
                  name={stepIcons[index] ?? "alert"}
                  size={index === 0 ? 30 : 28}
                  color={index === 1 ? colors.warning : index === 2 ? colors.success : colors.danger}
                />
              </View>
              <Text style={styles.stepText}>{step}</Text>
              <ActionIcon name="next" size={25} color={colors.muted} />
            </View>
          ))}
        </View>

        <Pressable style={styles.outlineButton} onPress={() => router.back()}>
          <ActionIcon name="book" size={23} color={colors.primary} />
          <Text style={styles.outlineButtonText}>Ver explicación completa</Text>
        </Pressable>

        <Pressable style={styles.primaryButton} onPress={onReport}>
          <ActionIcon name="alert" size={24} color={colors.surface} />
          <Text style={styles.primaryButtonText}>Reportar caso</Text>
        </Pressable>

        {embedding?.label ? (
          <View style={styles.patternCard}>
            <View style={styles.patternIcon}>
              <ActionIcon name="light" size={24} color={colors.warning} />
            </View>
            <View style={styles.patternCopy}>
              <Text style={styles.patternTitle}>Patrón similar a fraudes conocidos</Text>
              <Text style={styles.patternText}>{embedding.label}</Text>
            </View>
            <ActionIcon name="next" size={25} color={colors.muted} />
          </View>
        ) : null}

        <View style={styles.privacyCard}>
          <ActionIcon name="lock" size={22} color={colors.muted} />
          <Text style={styles.privacyText}>Analizamos en privado y priorizamos tu seguridad.</Text>
        </View>
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
  actionIconGlyph: {
    includeFontPadding: false,
    fontFamily: typography.fontFamilyBold,
    textAlign: "center",
    textAlignVertical: "center"
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1
  },
  backButtonPlaceholder: {
    width: 42,
    height: 42
  },
  topTitle: {
    color: colors.text,
    fontFamily: typography.fontFamilyBold,
    fontSize: 22,
    
  },
  hero: {
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.md
  },
  heroTitle: {
    marginTop: spacing.sm,
    color: colors.text,
    fontFamily: typography.fontFamilyBold,
    fontSize: 19,
    
    textAlign: "center"
  },
  heroSubtitle: {
    color: colors.muted,
    fontFamily: typography.fontFamily,
    fontSize: 17,
    textAlign: "center"
  },
  steps: {
    gap: spacing.md
  },
  stepCard: {
    minHeight: 92,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    ...shadow
  },
  indexCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.danger
  },
  indexAmber: {
    backgroundColor: colors.warning
  },
  indexGreen: {
    backgroundColor: colors.success
  },
  indexText: {
    color: colors.surface,
    fontFamily: typography.fontFamilyBold,
    fontSize: 20,
    
  },
  stepIcon: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.border,
    borderWidth: 1
  },
  stepText: {
    flex: 1,
    color: colors.text,
    fontFamily: typography.fontFamilyBold,
    fontSize: 15,
    lineHeight: 21,
    
  },
  outlineButton: {
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    borderRadius: radius.md,
    borderColor: colors.primary,
    borderWidth: 2,
    backgroundColor: colors.surface
  },
  outlineButtonText: {
    color: colors.primary,
    fontFamily: typography.fontFamilyBold,
    fontSize: 16,
    
  },
  primaryButton: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.primary
  },
  primaryButtonText: {
    color: colors.surface,
    fontFamily: typography.fontFamilyBold,
    fontSize: 16,
    
  },
  patternCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderRadius: radius.md,
    borderColor: "#E8C98A",
    borderWidth: 1,
    backgroundColor: "#FFF4D9",
    padding: spacing.md
  },
  patternCopy: {
    flex: 1
  },
  patternIcon: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.sm,
    backgroundColor: "#FFF4D8",
    borderColor: "#E8C56F",
    borderWidth: 1
  },
  patternTitle: {
    color: colors.text,
    fontFamily: typography.fontFamilyBold,
    fontSize: 15,
    
  },
  patternText: {
    marginTop: spacing.xs,
    color: colors.muted,
    fontFamily: typography.fontFamily,
    fontSize: 14,
    lineHeight: 19
  },
  privacyCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderRadius: radius.md,
    borderColor: colors.border,
    borderWidth: 1,
    backgroundColor: colors.surface,
    padding: spacing.lg
  },
  privacyText: {
    flex: 1,
    color: colors.primary,
    fontFamily: typography.fontFamilyBold,
    fontSize: 15,
    lineHeight: 21,
    
  }
});
