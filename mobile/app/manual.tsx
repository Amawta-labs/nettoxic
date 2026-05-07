import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { analyzeTextWithMeta } from "../src/api/client";
import { AwkiMark } from "../src/components/AwkiMark";
import { Screen } from "../src/components/Screen";
import { useInbox } from "../src/state/InboxContext";
import { colors, radius, shadow, spacing, typography } from "../src/theme";

const SAMPLE_MESSAGE = "BancoEstado: su cuenta sera suspendida hoy. Verifica tu clave en https://banco-seguro-login.com/";

export default function ManualAnalysisScreen() {
  const router = useRouter();
  const { addItem, mockMode, backendOnline, apiBaseUrl } = useInbox();
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onAnalyze() {
    const trimmed = content.trim();
    if (!trimmed || submitting) return;

    setSubmitting(true);
    setError(null);
    try {
      const { analysis, latencyMs, analyzedAt } = await analyzeTextWithMeta(trimmed);
      const id = `manual-${Date.now()}`;
      addItem({
        id,
        source: "manual",
        sender: "Ingreso manual",
        subject: "Mensaje sospechoso",
        preview: trimmed.slice(0, 220),
        analysis,
        demoEvidence: {
          input: trimmed,
          latencyMs,
          analyzedAt
        }
      });
      router.push(`/analysis/${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo analizar el mensaje");
    } finally {
      setSubmitting(false);
    }
  }

  const disabled = submitting || content.trim().length === 0 || mockMode;

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <View style={styles.topRow}>
            <Pressable style={styles.backButton} onPress={() => router.back()}>
              <MaterialCommunityIcons name="chevron-left" size={26} color={colors.text} />
            </Pressable>
            <Text style={styles.topTitle}>Revisar algo</Text>
            <View style={styles.backButtonPlaceholder} />
          </View>

          <View style={styles.hero}>
            <AwkiMark size={56} />
            <Text style={styles.title}>Analizar antes del clic</Text>
            <Text style={styles.subtitle}>Pega un SMS, correo o enlace sospechoso. Awki lo envía al backend real y devuelve el mismo análisis que usa la bandeja.</Text>
          </View>

          <View style={styles.statusBox}>
            <MaterialCommunityIcons
              name={mockMode ? "alert-circle-outline" : backendOnline ? "check-circle-outline" : "lan-disconnect"}
              size={22}
              color={mockMode || !backendOnline ? colors.warning : colors.success}
            />
            <Text style={styles.statusText}>
              {mockMode ? "Modo mock activo: el analisis manual requiere backend." : backendOnline ? "Backend conectado" : `Backend no confirmado: ${apiBaseUrl}`}
            </Text>
          </View>

          <View style={styles.inputBox}>
            <Text style={styles.label}>Mensaje sospechoso</Text>
            <TextInput
              multiline
              value={content}
              onChangeText={setContent}
              placeholder="Pega aqui el mensaje, enlace o correo..."
              placeholderTextColor={colors.muted}
              style={styles.input}
              textAlignVertical="top"
              autoCapitalize="sentences"
            />
            <View style={styles.inputFooter}>
              <Text style={styles.counter}>{content.trim().length} caracteres</Text>
              <Pressable onPress={() => setContent(SAMPLE_MESSAGE)} disabled={submitting}>
                <Text style={styles.sampleText}>Usar ejemplo</Text>
              </Pressable>
            </View>
          </View>

          {error ? (
            <View style={styles.errorBox}>
              <MaterialCommunityIcons name="alert-outline" size={20} color={colors.danger} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <Pressable style={[styles.primaryButton, disabled && styles.disabledButton]} onPress={onAnalyze} disabled={disabled}>
            {submitting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <MaterialCommunityIcons name="shield-check" size={22} color="#FFFFFF" />
                <Text style={styles.primaryButtonText}>Analizar mensaje</Text>
              </>
            )}
          </Pressable>

          <View style={styles.privacyBox}>
            <MaterialCommunityIcons name="lock-outline" size={20} color={colors.muted} />
            <Text style={styles.privacyText}>Redactamos patrones sensibles antes de llamar al LLM y solo consultamos fuentes externas con URLs extraidas.</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: {
    padding: spacing.xl,
    gap: spacing.lg
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
    gap: spacing.sm
  },
  title: {
    color: colors.text,
    fontFamily: typography.fontFamilyBold,
    fontSize: 28,
    
    lineHeight: 34
  },
  subtitle: {
    color: colors.muted,
    fontFamily: typography.fontFamily,
    fontSize: 15,
    lineHeight: 22
  },
  statusBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    ...shadow
  },
  statusText: {
    flex: 1,
    color: colors.text,
    fontFamily: typography.fontFamily,
    fontSize: 14,
    lineHeight: 20
  },
  inputBox: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.lg,
    gap: spacing.md,
    ...shadow
  },
  label: {
    color: colors.text,
    fontFamily: typography.fontFamilyBold,
    fontSize: 16,
    
  },
  input: {
    minHeight: 180,
    color: colors.text,
    fontFamily: typography.fontFamily,
    fontSize: 16,
    lineHeight: 23,
    padding: spacing.md,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 8,
    backgroundColor: colors.surfaceAlt
  },
  inputFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md
  },
  counter: {
    color: colors.muted,
    fontFamily: typography.fontFamily,
    fontSize: 13
  },
  sampleText: {
    color: colors.primary,
    fontFamily: typography.fontFamilyBold,
    fontSize: 14,
    
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: "#FFF3F2",
    borderColor: "#FDA29B",
    borderWidth: 1,
    borderRadius: radius.sm,
    padding: spacing.md
  },
  errorText: {
    flex: 1,
    color: colors.danger,
    fontFamily: typography.fontFamilyBold,
    fontSize: 14,
    lineHeight: 20,
    
  },
  primaryButton: {
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 15
  },
  disabledButton: {
    opacity: 0.45
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontFamily: typography.fontFamilyBold,
    fontSize: 16,
    
  },
  privacyBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 8,
    padding: spacing.lg
  },
  privacyText: {
    flex: 1,
    color: colors.muted,
    fontFamily: typography.fontFamily,
    fontSize: 14,
    lineHeight: 21
  }
});
