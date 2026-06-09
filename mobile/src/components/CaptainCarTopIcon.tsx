import { View, StyleSheet } from "react-native";

type Props = {
  size?: number;
};

/** Top-down car marker — bird's-eye view, front pointing up. */
export function CaptainCarTopIcon({ size = 36 }: Props) {
  const scale = size / 36;

  return (
    <View
      style={[styles.outer, { width: 36 * scale, height: 44 * scale }]}
      accessibilityLabel="الكابتن"
    >
      <View style={[styles.inner, { transform: [{ scale }] }]}>
        <View style={styles.body}>
          <View style={styles.hood} />
          <View style={styles.windshield} />
          <View style={styles.roof} />
          <View style={styles.rearWindow} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    alignItems: "center",
    justifyContent: "center",
  },
  inner: {
    width: 36,
    height: 44,
  },
  body: {
    position: "absolute",
    top: 4,
    left: 7,
    width: 22,
    height: 36,
    borderRadius: 9,
    backgroundColor: "#2563EB",
    borderWidth: 1.2,
    borderColor: "#1D4ED8",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 3,
    elevation: 4,
  },
  hood: {
    position: "absolute",
    top: 2,
    left: 2,
    right: 2,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#3B82F6",
  },
  windshield: {
    position: "absolute",
    top: 10,
    left: 2,
    right: 2,
    height: 9,
    borderRadius: 3,
    backgroundColor: "#BFDBFE",
  },
  roof: {
    position: "absolute",
    top: 20,
    left: 3,
    right: 3,
    height: 10,
    borderRadius: 2,
    backgroundColor: "#1D4ED8",
  },
  rearWindow: {
    position: "absolute",
    bottom: 2,
    left: 3,
    right: 3,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#93C5FD",
  },
});
