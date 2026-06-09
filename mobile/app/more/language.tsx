import { View, Text, Pressable, StyleSheet } from "react-native";
import { DarkScreen } from "../../src/components/DarkScreen";
import { useSettings, type AppLanguage } from "../../src/store/settings";
import { colors } from "../../src/theme/colors";

const OPTIONS: { key: AppLanguage; label: string }[] = [
  { key: "ar", label: "العربية" },
  { key: "en", label: "English" },
];

export default function LanguageScreen() {
  const language = useSettings((s) => s.language);
  const setLanguage = useSettings((s) => s.setLanguage);

  return (
    <DarkScreen title="اللغة" showBack>
      <View style={styles.content}>
        <Text style={styles.hint}>اختر لغة التطبيق (المحتوى العربي متاح حالياً)</Text>
        {OPTIONS.map((opt) => {
          const active = language === opt.key;
          return (
            <Pressable
              key={opt.key}
              style={[styles.option, active && styles.optionActive]}
              onPress={() => setLanguage(opt.key)}
            >
              <Text style={[styles.optionText, active && styles.optionTextActive]}>
                {opt.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </DarkScreen>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16 },
  hint: { textAlign: "right", color: colors.textMuted, marginBottom: 16, lineHeight: 22 },
  option: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 10,
  },
  optionActive: { borderColor: colors.accent, backgroundColor: "#2A2510" },
  optionText: { textAlign: "right", color: colors.text, fontWeight: "600", fontSize: 16 },
  optionTextActive: { color: colors.accent },
});
