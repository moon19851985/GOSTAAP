import { View, Text, Pressable, StyleSheet } from "react-native";
import { colors } from "../theme/colors";

type Props = {
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function HomeSectionHeader({ title, subtitle, actionLabel, onAction }: Props) {
  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        {actionLabel && onAction ? (
          <Pressable onPress={onAction} hitSlop={8}>
            <Text style={styles.action}>{actionLabel}</Text>
          </Pressable>
        ) : (
          <View />
        )}
        <Text style={styles.title}>{title}</Text>
      </View>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 4 },
  row: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    marginHorizontal: 16,
    marginBottom: 12,
    marginTop: 8,
  },
  title: { fontSize: 17, fontWeight: "800", color: colors.text, textAlign: "right" },
  subtitle: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: "right",
    marginHorizontal: 16,
    marginTop: -6,
    marginBottom: 8,
  },
  action: { fontSize: 13, fontWeight: "600", color: colors.accentOrange },
});
