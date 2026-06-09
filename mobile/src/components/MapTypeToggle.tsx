import { Pressable, StyleSheet, Text, View } from "react-native";
import type { MapLayerMode } from "./mapLayerConfig";

type Props = {
  value: MapLayerMode;
  onChange: (mode: MapLayerMode) => void;
};

/** تبديل عادي / قمر صناعي فوق الخريطة (iOS/Android) */
export function MapTypeToggle({ value, onChange }: Props) {
  return (
    <View style={styles.bar} pointerEvents="box-none">
      <Pressable
        style={[styles.btn, value === "satellite" && styles.btnOn]}
        onPress={() => onChange("satellite")}
      >
        <Text style={[styles.btnText, value === "satellite" && styles.btnTextOn]}>قمر صناعي</Text>
      </Pressable>
      <Pressable
        style={[styles.btn, value === "standard" && styles.btnOn]}
        onPress={() => onChange("standard")}
      >
        <Text style={[styles.btnText, value === "standard" && styles.btnTextOn]}>عادي</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: "absolute",
    top: 8,
    right: 8,
    flexDirection: "row",
    gap: 4,
    zIndex: 10,
  },
  btn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
  btnOn: {
    backgroundColor: "#0077B6",
  },
  btnText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#333",
  },
  btnTextOn: {
    color: "#fff",
  },
});
