import { View, Text, Pressable, StyleSheet, type ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../theme/colors";

type Props = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  showChevron?: boolean;
  right?: React.ReactNode;
  danger?: boolean;
  style?: ViewStyle;
};

export function MenuRow({
  icon,
  label,
  onPress,
  showChevron = true,
  right,
  danger,
  style,
}: Props) {
  return (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed, style]}
      onPress={onPress}
    >
      <View style={styles.right}>
        {showChevron && !right && (
          <Ionicons name="chevron-back" size={18} color={colors.textDim} />
        )}
        {right}
      </View>
      <View style={styles.center}>
        <Text style={[styles.label, danger && styles.labelDanger]}>{label}</Text>
      </View>
      <View style={[styles.iconWrap, danger && styles.iconDanger]}>
        <Ionicons name={icon} size={20} color={danger ? colors.danger : colors.bg} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row-reverse",
    alignItems: "center",
    backgroundColor: colors.bgCard,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rowPressed: { opacity: 0.85 },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  iconDanger: { backgroundColor: "#FEE2E2" },
  center: { flex: 1, paddingHorizontal: 12 },
  label: { textAlign: "right", color: colors.text, fontWeight: "600", fontSize: 15 },
  labelDanger: { color: colors.danger },
  right: { minWidth: 24, alignItems: "center" },
});
