import { ScrollView, Text, StyleSheet } from "react-native";
import { DarkScreen } from "../../src/components/DarkScreen";
import { colors } from "../../src/theme/colors";

export default function PrivacyScreen() {
  return (
    <DarkScreen title="سياسة الخصوصية" showBack>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.paragraph}>
          نحن في تطبيق قسطاس نحترم خصوصيتك. تُستخدم بياناتك (الاسم، البريد، الهاتف، عنوان
          التوصيل) فقط لتقديم خدمة الطلب والتوصيل.
        </Text>
        <Text style={styles.paragraph}>
          لا نشارك معلوماتك مع أطراف ثالثة إلا لإتمام الطلب (المطعم، الكابتن، بوابة الدفع).
        </Text>
        <Text style={styles.paragraph}>
          يمكنك طلب حذف حسابك أو تعديل بياناتك من الملف الشخصي. للاستفسارات تواصل مع خدمة
          العملاء.
        </Text>
        <Text style={styles.updated}>آخر تحديث: مايو 2026</Text>
      </ScrollView>
    </DarkScreen>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 32 },
  paragraph: {
    textAlign: "right",
    color: colors.textMuted,
    lineHeight: 24,
    marginBottom: 16,
    fontSize: 15,
  },
  updated: { textAlign: "right", color: colors.textDim, fontSize: 12, marginTop: 8 },
});
