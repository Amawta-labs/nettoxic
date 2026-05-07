import { StyleSheet, Text, View } from "react-native";
import { colors, radius, typography } from "../theme";
import type { RiskLevel } from "../types";

const levelConfig: Record<RiskLevel, { label: string; color: string; bg: string }> = {
  bajo: { label: "Ok", color: colors.success, bg: "#EAF2EA" },
  medio: { label: "Cuidado", color: colors.warning, bg: "#F7E8C6" },
  alto: { label: "Peligro", color: colors.danger, bg: "#F2D7D2" },
  critico: { label: "Peligro", color: colors.critical, bg: "#EBCAC4" }
};

export function RiskBadge({ level, score, compact = false }: { level: RiskLevel; score?: number; compact?: boolean }) {
  const config = levelConfig[level];
  return (
    <View style={[styles.badge, compact && styles.compact, { borderColor: config.color, backgroundColor: config.bg }]}>
      <Text
        style={[styles.text, compact && styles.compactText, { color: config.color }]}
        numberOfLines={1}
        adjustsFontSizeToFit={compact}
        minimumFontScale={0.82}
      >
        {score === undefined ? config.label : `${config.label} · ${score}`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexShrink: 0,
    alignSelf: "flex-start",
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: 9,
    paddingVertical: 5
  },
  compact: {
    paddingHorizontal: 8,
    paddingVertical: 3
  },
  text: {
    fontFamily: typography.fontFamilyBold,
    fontSize: 12,
    includeFontPadding: false
  },
  compactText: {
    fontSize: 11
  }
});
