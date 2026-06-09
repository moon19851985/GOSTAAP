import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { api } from "../src/lib/api";
import { useCart } from "../src/store/cart";
import { showAlert } from "../src/lib/alert";
import { formatMoney } from "../src/lib/formatMoney";

type PayMethod = "VISA" | "MADA" | "COD";

function parsePayMethod(value: string | undefined): PayMethod {
  if (value === "VISA" || value === "MADA" || value === "COD") return value;
  return "COD";
}

function payMethodLabel(method: PayMethod) {
  if (method === "MADA") return "مدى mada";
  if (method === "VISA") return "Visa فيزا";
  return "دفع عند الاستلام";
}

function digitsOnly(value: string) {
  return value.replace(/\D/g, "");
}

function formatCardNumber(value: string) {
  const d = digitsOnly(value).slice(0, 16);
  return d.replace(/(\d{4})(?=\d)/g, "$1 ").trim();
}

function formatExpiry(value: string) {
  const d = digitsOnly(value).slice(0, 4);
  if (d.length <= 2) return d;
  return `${d.slice(0, 2)}/${d.slice(2)}`;
}

function validateCard(method: PayMethod, cardNumber: string, expiry: string, cvv: string, name: string) {
  const num = digitsOnly(cardNumber);
  if (num.length < 16) return "أدخل رقم البطاقة (16 رقم)";
  if (method === "MADA" && !num.startsWith("5")) {
    return "بطاقة مدى تبدأ عادةً بالرقم 5";
  }
  if (method === "VISA" && !num.startsWith("4")) {
    return "بطاقة Visa تبدأ بالرقم 4";
  }

  const exp = digitsOnly(expiry);
  if (exp.length !== 4) return "أدخل تاريخ الانتهاء MM/YY";
  const month = Number(exp.slice(0, 2));
  if (month < 1 || month > 12) return "شهر الانتهاء غير صالح";

  const cvvDigits = digitsOnly(cvv);
  if (cvvDigits.length < 3 || cvvDigits.length > 4) return "أدخل رمز CVV (3–4 أرقام)";
  if (name.trim().length < 2) return "أدخل اسم حامل البطاقة";

  return null;
}

export default function PaymentScreen() {
  const router = useRouter();
  const { clear } = useCart();
  const params = useLocalSearchParams<{
    orderId?: string;
    total?: string;
    method?: string;
  }>();

  const orderId = typeof params.orderId === "string" ? params.orderId : "";
  const total = Number(params.total ?? 0);
  const method = parsePayMethod(params.method);
  const isCod = method === "COD";

  const [cardNumber, setCardNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvv, setCvv] = useState("");
  const [holderName, setHolderName] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  if (!orderId || !Number.isFinite(total) || total <= 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorTitle}>جلسة الدفع غير صالحة</Text>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>العودة للسلة</Text>
        </Pressable>
      </View>
    );
  }

  async function submitPayment() {
    setErrorMsg("");
    if (!isCod) {
      const validationError = validateCard(method, cardNumber, expiry, cvv, holderName);
      if (validationError) {
        setErrorMsg(validationError);
        showAlert("تحقق من البيانات", validationError);
        return;
      }
    }

    setLoading(true);
    try {
      const payRes = await api<{
        transactionId: string;
        invoiceNumber?: string;
        message: string;
      }>("/api/payment/mock", {
        method: "POST",
        body: JSON.stringify({ orderId, method }),
      });

      clear();
      const invoiceLine = payRes.invoiceNumber
        ? `\nرقم الفاتورة: ${payRes.invoiceNumber}`
        : "";
      if (isCod) {
        showAlert(
          "تم تأكيد الطلب",
          `${payRes.message}${invoiceLine}\nرقم المرجع: ${payRes.transactionId}\n\nادفع ${formatMoney(total)} ر.س نقداً عند الاستلام.`
        );
      } else {
        const masked = `**** ${digitsOnly(cardNumber).slice(-4)}`;
        showAlert(
          "تم الدفع بنجاح",
          `${payRes.message}${invoiceLine}\nرقم العملية: ${payRes.transactionId}\nالبطاقة: ${masked}\n\nالطلب وصل للمطعم.`
        );
      }
      router.replace(`/track/${orderId}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : isCod ? "فشل تأكيد الطلب" : "فشل الدفع";
      setErrorMsg(msg);
      showAlert("خطأ", msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View
          style={[
            styles.badge,
            isCod ? styles.badgeCod : method === "MADA" ? styles.badgeMada : styles.badgeVisa,
          ]}
        >
          <Text style={styles.badgeText}>{payMethodLabel(method)}</Text>
        </View>

        {isCod ? (
          <>
            <Text style={styles.title}>تأكيد الدفع عند الاستلام</Text>
            <Text style={styles.subtitle}>
              المبلغ: {formatMoney(total)} ر.س — ستدفعه نقداً للكابتن عند استلام الطلب.
            </Text>
            <Text style={styles.mockNote}>
              بعد التأكيد يُحضّر المطعم طلبك ويصلك الكابتن. تأكد من توفر المبلغ عند التسليم.
            </Text>
          </>
        ) : (
          <>
            <Text style={styles.title}>إدخال بيانات البطاقة</Text>
            <Text style={styles.subtitle}>
              المبلغ: {formatMoney(total)} ر.س — وضع تجريبي (لا يتم خصم حقيقي)
            </Text>

            <View style={styles.field}>
              <Text style={styles.label}>رقم البطاقة</Text>
              <TextInput
                style={styles.input}
                value={cardNumber}
                onChangeText={(t) => setCardNumber(formatCardNumber(t))}
                placeholder={method === "MADA" ? "5xxx xxxx xxxx xxxx" : "4xxx xxxx xxxx xxxx"}
                placeholderTextColor="#AAA"
                keyboardType="number-pad"
                maxLength={19}
                textAlign="right"
              />
            </View>

            <View style={styles.row}>
              <View style={[styles.field, styles.half]}>
                <Text style={styles.label}>CVV</Text>
                <TextInput
                  style={styles.input}
                  value={cvv}
                  onChangeText={(t) => setCvv(digitsOnly(t).slice(0, 4))}
                  placeholder="123"
                  placeholderTextColor="#AAA"
                  keyboardType="number-pad"
                  maxLength={4}
                  secureTextEntry
                  textAlign="right"
                />
              </View>
              <View style={[styles.field, styles.half]}>
                <Text style={styles.label}>تاريخ الانتهاء</Text>
                <TextInput
                  style={styles.input}
                  value={expiry}
                  onChangeText={(t) => setExpiry(formatExpiry(t))}
                  placeholder="MM/YY"
                  placeholderTextColor="#AAA"
                  keyboardType="number-pad"
                  maxLength={5}
                  textAlign="right"
                />
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>اسم حامل البطاقة</Text>
              <TextInput
                style={styles.input}
                value={holderName}
                onChangeText={setHolderName}
                placeholder="كما يظهر على البطاقة"
                placeholderTextColor="#AAA"
                autoCapitalize="words"
                textAlign="right"
              />
            </View>

            <Text style={styles.mockNote}>
              للتجربة: أي بيانات صحيحة الشكل تُقبل. عند النشر على AppGallery سيُستبدل هذا
              بـ Huawei IAP.
            </Text>
          </>
        )}

        {errorMsg ? <Text style={styles.error}>{errorMsg}</Text> : null}

        <Pressable
          style={[styles.payBtn, loading && styles.disabled]}
          onPress={submitPayment}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.payText}>
              {isCod
                ? `تأكيد الطلب — ${formatMoney(total)} ر.س عند الاستلام`
                : `ادفع ${formatMoney(total)} ر.س — ${method === "MADA" ? "مدى" : "Visa"}`}
            </Text>
          )}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 32 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  badge: {
    alignSelf: "flex-end",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    marginBottom: 12,
  },
  badgeMada: { backgroundColor: "#0D4F3C" },
  badgeVisa: { backgroundColor: "#1A1F71" },
  badgeCod: { backgroundColor: "#B45309" },
  badgeText: { color: "#FFF", fontWeight: "700" },
  title: { fontSize: 22, fontWeight: "700", textAlign: "right", marginBottom: 6 },
  subtitle: { textAlign: "right", color: "#666", marginBottom: 20, lineHeight: 22 },
  field: { marginBottom: 14 },
  half: { flex: 1 },
  row: { flexDirection: "row-reverse", gap: 12 },
  label: { textAlign: "right", fontWeight: "600", marginBottom: 6, color: "#333" },
  input: {
    backgroundColor: "#FFF",
    borderWidth: 1,
    borderColor: "#DDD",
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    color: "#111",
  },
  error: {
    textAlign: "right",
    color: "#B45309",
    fontWeight: "600",
    marginBottom: 10,
    lineHeight: 20,
  },
  mockNote: {
    textAlign: "right",
    color: "#888",
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 16,
    marginTop: 4,
  },
  payBtn: {
    backgroundColor: "#E85D04",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    minHeight: 52,
    justifyContent: "center",
  },
  payText: { color: "#FFF", fontWeight: "700", fontSize: 16 },
  disabled: { opacity: 0.5 },
  errorTitle: { fontSize: 18, fontWeight: "700", marginBottom: 16, textAlign: "center" },
  backBtn: {
    backgroundColor: "#E85D04",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
  },
  backBtnText: { color: "#FFF", fontWeight: "700" },
});
