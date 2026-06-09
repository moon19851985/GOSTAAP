import { View, Text, Switch, StyleSheet } from "react-native";
import { DarkScreen } from "../../src/components/DarkScreen";
import { useSettings } from "../../src/store/settings";
import { colors } from "../../src/theme/colors";

export default function NotificationsScreen() {
  const enabled = useSettings((s) => s.notificationsEnabled);
  const setNotifications = useSettings((s) => s.setNotifications);

  return (
    <DarkScreen title="الإشعارات" showBack>
      <View style={styles.content}>
        <View style={styles.row}>
          <Switch
            value={enabled}
            onValueChange={setNotifications}
            trackColor={{ false: colors.border, true: colors.accent }}
            thumbColor="#FFF"
          />
          <View style={styles.textBlock}>
            <Text style={styles.label}>تفعيل الإشعارات</Text>
            <Text style={styles.hint}>
              {enabled
                ? "ستصلك تنبيهات الطلبات والعروض"
                : "الإشعارات متوقفة حالياً"}
            </Text>
          </View>
        </View>
      </View>
    </DarkScreen>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16 },
  row: {
    flexDirection: "row-reverse",
    alignItems: "center",
    backgroundColor: colors.bgCard,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 14,
  },
  textBlock: { flex: 1 },
  label: { textAlign: "right", color: colors.text, fontWeight: "700", fontSize: 16 },
  hint: { textAlign: "right", color: colors.textMuted, marginTop: 6, fontSize: 13, lineHeight: 20 },
});
