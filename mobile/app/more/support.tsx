import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { DarkScreen } from "../../src/components/DarkScreen";
import { colors } from "../../src/theme/colors";

export default function SupportScreen() {
  return (
    <DarkScreen title="خدمة العملاء" showBack>
      <View style={styles.content}>
        <View style={styles.iconWrap}>
          <Ionicons name="headset" size={48} color={colors.accent} />
        </View>
        <Text style={styles.title}>قريباً</Text>
        <Text style={styles.hint}>
          سنوفر لك محادثة مباشرة ودعم فني على مدار الساعة. ترقّب التحديث القادم.
        </Text>
      </View>
    </DarkScreen>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1, padding: 24, alignItems: "center", justifyContent: "center" },
  iconWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.bgCard,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: { color: colors.text, fontSize: 22, fontWeight: "800", marginBottom: 12 },
  hint: { textAlign: "center", color: colors.textMuted, lineHeight: 24, fontSize: 15 },
});
