import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useLocalSearchParams, usePathname, useRouter } from "expo-router";
import { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useInbox } from "../state/InboxContext";
import { colors, layout, radius, shadow, spacing, typography } from "../theme";

type DemoScreen = "login" | "inbox" | "detail" | "action" | "manual";

type DemoThumbMenuProps = {
  active: DemoScreen;
  analysisId?: string | null;
};

type DemoTarget = {
  key: DemoScreen;
  label: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  preview: "inbox" | "detail" | "steps" | "manual";
};

const targets: DemoTarget[] = [
  { key: "login", label: "Conectar", icon: "login", preview: "manual" },
  { key: "inbox", label: "Bandeja", icon: "email-outline", preview: "inbox" },
  { key: "detail", label: "Análisis", icon: "alert-outline", preview: "detail" },
  { key: "action", label: "Pasos", icon: "shield-check-outline", preview: "steps" },
  { key: "manual", label: "Probar", icon: "shield-search", preview: "manual" }
];

function MiniPreview({ type, active, compact = false }: { type: DemoTarget["preview"]; active: boolean; compact?: boolean }) {
  return (
    <View style={[styles.preview, compact && styles.previewCompact, active && styles.previewActive]}>
      {type === "inbox" ? (
        <>
          <View style={[styles.previewHeader, compact && styles.previewHeaderCompact]} />
          <View style={[styles.previewTab, compact && styles.previewTabCompact]} />
          <View style={[styles.previewLine, compact && styles.previewLineCompact, styles.previewLineDanger]} />
          <View style={[styles.previewLine, compact && styles.previewLineCompact]} />
          {!compact ? <View style={styles.previewLineShort} /> : null}
        </>
      ) : null}
      {type === "detail" ? (
        <>
          <View style={[styles.previewDangerBox, compact && styles.previewDangerBoxCompact]} />
          <View style={[styles.previewLine, compact && styles.previewLineCompact, styles.previewLineDanger]} />
          <View style={[styles.previewRow, compact && styles.previewRowCompact]} />
          {!compact ? <View style={styles.previewRow} /> : null}
        </>
      ) : null}
      {type === "steps" ? (
        <>
          <View style={[styles.previewShield, compact && styles.previewShieldCompact]} />
          <View style={[styles.previewStep, compact && styles.previewStepCompact]} />
          <View style={[styles.previewStep, compact && styles.previewStepCompact]} />
          {!compact ? <View style={styles.previewButton} /> : null}
        </>
      ) : null}
      {type === "manual" ? (
        <>
          <View style={[styles.previewHeader, compact && styles.previewHeaderCompact]} />
          <View style={[styles.previewInput, compact && styles.previewInputCompact]} />
          <View style={[styles.previewButton, compact && styles.previewButtonCompact]} />
        </>
      ) : null}
    </View>
  );
}

export function DemoThumbMenu({ active, analysisId }: DemoThumbMenuProps) {
  const router = useRouter();
  const { items } = useInbox();
  const [open, setOpen] = useState(false);
  const selectedAnalysisId = analysisId ?? items.find((item) => item.analysis.score >= 35)?.id ?? items[0]?.id ?? null;

  function go(target: DemoScreen) {
    setOpen(false);
    if (target === "inbox") {
      router.push("/");
      return;
    }
    if (target === "login") {
      router.push("/login");
      return;
    }
    if (target === "detail" && selectedAnalysisId) {
      router.push(`/analysis/${selectedAnalysisId}`);
      return;
    }
    if (target === "action") {
      router.push({ pathname: "/action", params: selectedAnalysisId ? { id: selectedAnalysisId } : {} });
      return;
    }
    if (target === "manual") {
      router.push("/manual");
      return;
    }
  }

  return (
    <>
      <Pressable style={styles.trigger} onPress={() => setOpen(true)} hitSlop={8}>
        <View style={styles.triggerGrid}>
          <View style={styles.triggerCell} />
          <View style={styles.triggerCell} />
          <View style={styles.triggerCell} />
          <View style={styles.triggerCell} />
        </View>
      </Pressable>

      <Modal animationType="fade" transparent visible={open} onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.scrim} onPress={() => setOpen(false)}>
          <Pressable style={styles.sheet} onPress={(event) => event.stopPropagation()}>
            <View style={styles.sheetHeader}>
              <View style={styles.sheetTitleBlock}>
                <Text style={styles.sheetTitle}>Navegación demo</Text>
                <Text style={styles.sheetSubtitle}>Toca un thumbnail para saltar de pantalla.</Text>
              </View>
              <Pressable style={styles.closeButton} onPress={() => setOpen(false)}>
                <View style={styles.closeGlyph}>
                  <View style={[styles.closeLine, styles.closeLineA]} />
                  <View style={[styles.closeLine, styles.closeLineB]} />
                </View>
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={styles.grid} showsVerticalScrollIndicator={false}>
              {targets.map((target) => {
                const isActive = target.key === active;
                const disabled = (target.key === "detail" || target.key === "action") && !selectedAnalysisId;
                return (
                  <Pressable
                    key={target.key}
                    style={[styles.thumbCard, isActive && styles.thumbCardActive, disabled && styles.thumbCardDisabled]}
                    onPress={() => go(target.key)}
                    disabled={disabled}
                  >
                    <MiniPreview type={target.preview} active={isActive} />
                    <View style={styles.thumbFooter}>
                      <View style={[styles.thumbDot, isActive && styles.thumbDotActive]} />
                      <Text style={[styles.thumbLabel, isActive && styles.thumbLabelActive]} numberOfLines={1}>
                        {target.label}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

function activeFromPath(pathname: string): DemoScreen {
  if (pathname.startsWith("/login")) return "login";
  if (pathname.startsWith("/analysis")) return "detail";
  if (pathname.startsWith("/action")) return "action";
  if (pathname.startsWith("/manual")) return "manual";
  return "inbox";
}

export function StickyDemoThumbNav() {
  const pathname = usePathname();
  const params = useLocalSearchParams();
  const router = useRouter();
  const { items } = useInbox();
  const insets = useSafeAreaInsets();
  const active = activeFromPath(pathname);
  const idParam = typeof params.id === "string" ? params.id : null;
  const selectedAnalysisId = idParam ?? items.find((item) => item.analysis.score >= 35)?.id ?? items[0]?.id ?? null;

  function go(target: DemoScreen) {
    if (target === "inbox") {
      router.push("/");
      return;
    }
    if (target === "login") {
      router.push("/login");
      return;
    }
    if (target === "detail" && selectedAnalysisId) {
      router.push(`/analysis/${selectedAnalysisId}`);
      return;
    }
    if (target === "action") {
      router.push({ pathname: "/action", params: selectedAnalysisId ? { id: selectedAnalysisId } : {} });
      return;
    }
    if (target === "manual") {
      router.push("/manual");
    }
  }

  return (
    <View pointerEvents="box-none" style={[styles.dockOverlay, { paddingBottom: Math.max(insets.bottom, spacing.sm) }]}>
      <View style={styles.dockShell}>
        <View style={styles.dockTrack}>
          {targets.map((target) => {
            const isActive = target.key === active;
            const disabled = (target.key === "detail" || target.key === "action") && !selectedAnalysisId;
            return (
              <Pressable
                key={target.key}
                style={[styles.dockItem, isActive && styles.dockItemActive, disabled && styles.dockItemDisabled]}
                onPress={() => go(target.key)}
                disabled={disabled}
              >
                <MiniPreview type={target.preview} active={isActive} compact />
                <View style={styles.dockLabelRow}>
                  <MaterialCommunityIcons name={target.icon} size={12} color={isActive ? colors.primary : colors.muted} />
                  <Text style={[styles.dockLabel, isActive && styles.dockLabelActive]} numberOfLines={1}>
                    {target.label}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  dockOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 50,
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.sm
  },
  dockShell: {
    minHeight: layout.demoDockReservedHeight - spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "rgba(255, 252, 244, 0.97)",
    paddingVertical: spacing.sm,
    paddingHorizontal: 6,
    ...shadow
  },
  dockTrack: {
    flexDirection: "row",
    gap: 4
  },
  dockItem: {
    flex: 1,
    minWidth: 0,
    minHeight: 82,
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: "transparent",
    padding: 4,
    gap: 4
  },
  dockItemActive: {
    backgroundColor: "#F5EFE0",
    borderColor: colors.primary
  },
  dockItemDisabled: {
    opacity: 0.45
  },
  dockLabelRow: {
    minHeight: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 3
  },
  dockLabel: {
    maxWidth: 42,
    color: colors.muted,
    fontFamily: typography.fontFamilyBold,
    fontSize: 9
  },
  dockLabelActive: {
    color: colors.primary
  },
  trigger: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1
  },
  triggerGrid: {
    width: 18,
    height: 18,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4
  },
  triggerCell: {
    width: 7,
    height: 7,
    borderRadius: 2,
    backgroundColor: colors.primary
  },
  scrim: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(34, 31, 28, 0.34)",
    padding: spacing.md
  },
  sheet: {
    maxHeight: "84%",
    borderRadius: radius.xl,
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderWidth: 1,
    padding: spacing.lg,
    gap: spacing.md,
    ...shadow
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  sheetTitleBlock: {
    flex: 1,
    paddingRight: spacing.md
  },
  sheetTitle: {
    color: colors.text,
    fontFamily: typography.fontFamilyBold,
    fontSize: 16,
    
  },
  sheetSubtitle: {
    marginTop: 3,
    color: colors.muted,
    fontFamily: typography.fontFamily,
    fontSize: 12,
    lineHeight: 16
  },
  closeButton: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 17,
    backgroundColor: colors.surface
  },
  closeGlyph: {
    width: 16,
    height: 16
  },
  closeLine: {
    position: "absolute",
    top: 7,
    left: 1,
    right: 1,
    height: 2,
    borderRadius: 1,
    backgroundColor: colors.muted
  },
  closeLineA: {
    transform: [{ rotate: "45deg" }]
  },
  closeLineB: {
    transform: [{ rotate: "-45deg" }]
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md
  },
  thumbCard: {
    width: "47.8%",
    minHeight: 132,
    borderRadius: radius.md,
    borderColor: colors.border,
    borderWidth: 1,
    backgroundColor: colors.surface,
    padding: spacing.sm,
    gap: spacing.sm
  },
  thumbCardActive: {
    borderColor: colors.primary,
    borderWidth: 2
  },
  thumbCardDisabled: {
    opacity: 0.55
  },
  preview: {
    height: 82,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 8,
    gap: 6
  },
  previewCompact: {
    alignSelf: "stretch",
    width: "100%",
    height: 46,
    padding: 4,
    gap: 3,
    borderRadius: 9
  },
  previewActive: {
    backgroundColor: "#F5EFE0"
  },
  previewHeader: {
    width: 34,
    height: 12,
    borderRadius: 4,
    backgroundColor: colors.primary
  },
  previewHeaderCompact: {
    width: 24,
    height: 8,
    borderRadius: 3
  },
  previewTab: {
    width: "100%",
    height: 15,
    borderRadius: 5,
    backgroundColor: colors.primary
  },
  previewTabCompact: {
    height: 8,
    borderRadius: 4
  },
  previewLine: {
    width: "88%",
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.border
  },
  previewLineCompact: {
    height: 4,
    borderRadius: 2
  },
  previewLineDanger: {
    backgroundColor: "#D87A69"
  },
  previewLineShort: {
    width: "62%",
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.border
  },
  previewDangerBox: {
    height: 25,
    borderRadius: 7,
    backgroundColor: colors.dangerSoft,
    borderColor: "#E1A89E",
    borderWidth: 1
  },
  previewDangerBoxCompact: {
    height: 15,
    borderRadius: 5
  },
  previewRow: {
    height: 13,
    borderRadius: 6,
    backgroundColor: colors.surface
  },
  previewRowCompact: {
    height: 7,
    borderRadius: 4
  },
  previewShield: {
    alignSelf: "center",
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: colors.primary
  },
  previewShieldCompact: {
    width: 18,
    height: 18,
    borderRadius: 7
  },
  previewStep: {
    height: 13,
    borderRadius: 6,
    backgroundColor: colors.surface
  },
  previewStepCompact: {
    height: 7,
    borderRadius: 4
  },
  previewInput: {
    height: 44,
    borderRadius: 8,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1
  },
  previewInputCompact: {
    height: 22,
    borderRadius: 6
  },
  previewButton: {
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.primary
  },
  previewButtonCompact: {
    height: 6,
    borderRadius: 3
  },
  thumbFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs
  },
  thumbDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.border
  },
  thumbDotActive: {
    backgroundColor: colors.primary
  },
  thumbLabel: {
    color: colors.muted,
    fontFamily: typography.fontFamilyBold,
    fontSize: 12,
    
  },
  thumbLabelActive: {
    color: colors.primary
  }
});
