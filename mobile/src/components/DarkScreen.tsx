import { View, Text, Pressable, StyleSheet, type ViewProps } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../theme/colors";

type Props = ViewProps & {
  title: string;
  showBack?: boolean;
  children: React.ReactNode;
};

export function DarkScreen({ title, showBack, children, style, ...rest }: Props) {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <View style={[styles.root, { paddingTop: insets.top + 8 }, style]} {...rest}>
      <View style={styles.header}>
        {showBack ? (
          <Pressable style={styles.backBtn} onPress={() => router.back()} hitSlop={8}>
            <Ionicons name="arrow-forward" size={22} color={colors.text} />
          </Pressable>
        ) : (
          <View style={styles.backPlaceholder} />
        )}
        <Text style={styles.title}>{title}</Text>
        <View style={styles.backPlaceholder} />
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  title: {
    flex: 1,
    fontSize: 18,
    fontWeight: "800",
    color: colors.text,
    textAlign: "center",
  },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  backPlaceholder: { width: 40 },
});
