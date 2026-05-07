import type { PropsWithChildren } from "react";
import { StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, layout } from "../theme";

export function Screen({ children }: PropsWithChildren) {
  return (
    <SafeAreaView style={styles.screen} edges={["top", "left", "right"]}>
      <View pointerEvents="none" style={styles.pattern}>
        <View style={styles.lineOne} />
        <View style={styles.lineTwo} />
        <View style={styles.lineThree} />
      </View>
      {children}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
    paddingBottom: layout.demoDockReservedHeight
  },
  pattern: {
    position: "absolute",
    top: 26,
    left: -30,
    right: -30,
    height: 140,
    opacity: 0.22
  },
  lineOne: {
    position: "absolute",
    top: 28,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: colors.border,
    transform: [{ rotate: "-18deg" }]
  },
  lineTwo: {
    position: "absolute",
    top: 70,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: colors.border,
    transform: [{ rotate: "-18deg" }]
  },
  lineThree: {
    position: "absolute",
    top: 56,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: colors.border,
    transform: [{ rotate: "18deg" }]
  }
});
