import { Image, StyleSheet, View } from "react-native";

const awkiLogo = require("../../assets/brand/awki-logo.png");

export function AwkiMark({ size = 38 }: { size?: number }) {
  const markSize = Math.max(28, size);

  return (
    <View style={[styles.mark, { width: markSize, height: markSize, borderRadius: Math.round(markSize * 0.24) }]}>
      <Image source={awkiLogo} style={styles.image} resizeMode="cover" />
    </View>
  );
}

const styles = StyleSheet.create({
  mark: {
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden"
  },
  image: {
    width: "100%",
    height: "100%"
  }
});
