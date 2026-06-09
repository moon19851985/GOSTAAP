import { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter, useLocalSearchParams } from "expo-router";
import { api } from "../src/lib/api";
import { showAlert } from "../src/lib/alert";
import { LocationPicker } from "../src/components/LocationPicker";

type Role = "CUSTOMER" | "RESTAURANT" | "CAPTAIN" | "ADMIN";

export default function AuthScreen() {
  const router = useRouter();
  const { intent } = useLocalSearchParams<{ intent?: string }>();
  const [mode, setMode] = useState<"login" | "register" | "verify">("login");
  const [role, setRole] = useState<Role>(
    intent === "captain" ? "CAPTAIN" : intent === "restaurant" ? "RESTAURANT" : "CUSTOMER"
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [restaurantName, setRestaurantName] = useState("");
  const [address, setAddress] = useState("الرياض");
  const [restaurantLat, setRestaurantLat] = useState(24.7136);
  const [restaurantLng, setRestaurantLng] = useState(46.6753);
  const [vehicle, setVehicle] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (intent === "captain") setMode("login");
    if (intent === "restaurant") {
      setRole("RESTAURANT");
      setMode("register");
    }
  }, [intent]);

  function validate(): string | null {
    if (mode === "verify") {
      if (code.replace(/\D/g, "").length !== 6) return "أدخل كود التفعيل (6 أرقام)";
      return null;
    }
    if (!email.trim()) return "أدخل البريد الإلكتروني";
    if (!password || password.length < 6) return "كلمة المرور 6 أحرف على الأقل";
    if (mode === "register" && name.trim().length < 2) return "أدخل الاسم (حرفين على الأقل)";
    if (mode === "register") {
      const digits = phone.replace(/\D/g, "");
      if (digits.length < 9) return "أدخل رقم جوال صحيح (مثال: 05xxxxxxxx)";
    }
    return null;
  }

  async function submit() {
    setErrorMsg("");
    const validationError = validate();
    if (validationError) {
      setErrorMsg(validationError);
      showAlert("تنبيه", validationError);
      return;
    }

    setLoading(true);
    try {
      if (mode === "verify") {
        const res = await api<{ token: string; user: { role: Role } }>(
          "/api/auth/verify-email",
          {
            method: "POST",
            body: JSON.stringify({ email: email.trim(), code: code.replace(/\D/g, "") }),
            auth: false,
          }
        );
        await AsyncStorage.setItem("token", res.token);
        routeByRole(res.user.role);
        return;
      }

      if (mode === "login") {
        try {
          const res = await api<{ token: string; user: { role: Role } }>(
            "/api/auth/login",
            {
              method: "POST",
              body: JSON.stringify({ email: email.trim(), password }),
              auth: false,
            }
          );
          await AsyncStorage.setItem("token", res.token);
          routeByRole(res.user.role);
        } catch (e) {
          const msg = e instanceof Error ? e.message : "";
          if (msg.includes("تفعيل")) {
            setMode("verify");
            showAlert("تفعيل مطلوب", "أرسلنا كوداً جديداً إلى بريدك");
          } else {
            throw e;
          }
        }
        return;
      }

      const body: Record<string, unknown> = {
        email: email.trim(),
        password,
        name: name.trim(),
        phone: phone.trim(),
        role,
      };
      if (role === "RESTAURANT") {
        body.restaurant = {
          name: restaurantName.trim() || name.trim(),
          address: address.trim(),
          lat: restaurantLat,
          lng: restaurantLng,
        };
      }
      if (role === "CAPTAIN" && vehicle.trim()) {
        body.captain = { vehicle: vehicle.trim() };
      }

      await api<{ needsVerification: boolean; message: string }>("/api/auth/register", {
        method: "POST",
        body: JSON.stringify(body),
        auth: false,
      });

      setMode("verify");
      showAlert("تحقق من بريدك", "أرسلنا كود التفعيل (6 أرقام) إلى بريدك");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "فشل الطلب";
      setErrorMsg(msg);
      showAlert("خطأ", msg);
    } finally {
      setLoading(false);
    }
  }

  async function resendCode() {
    setErrorMsg("");
    setLoading(true);
    try {
      await api("/api/auth/resend-code", {
        method: "POST",
        body: JSON.stringify({ email: email.trim() }),
        auth: false,
      });
      showAlert("تم", "أُرسل كود جديد إلى بريدك");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "فشل الإرسال";
      setErrorMsg(msg);
      showAlert("خطأ", msg);
    } finally {
      setLoading(false);
    }
  }

  function routeByRole(r: Role) {
    if (r === "ADMIN") router.replace("/admin");
    else if (r === "RESTAURANT") router.replace("/restaurant");
    else if (r === "CAPTAIN") router.replace("/captain");
    else router.replace("/");
  }

  const titles = {
    login: "تسجيل الدخول",
    register: "إنشاء حساب",
    verify: "تفعيل البريد",
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>{titles[mode]}</Text>

      {mode === "login" && intent === "captain" && (
        <Text style={styles.intentHint}>تسجيل دخول كابتن التوصيل</Text>
      )}

      {errorMsg ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{errorMsg}</Text>
        </View>
      ) : null}

      {mode === "verify" && (
        <>
          <Text style={styles.hint}>
            تفعيل حساب ({role === "CUSTOMER" ? "عميل" : role === "CAPTAIN" ? "كابتن" : "مطعم"})
            {"\n"}أدخل الكود المرسل إلى:{"\n"}
            {email}
          </Text>
          <TextInput
            style={[styles.input, styles.codeInput]}
            placeholder="000000"
            keyboardType="number-pad"
            maxLength={6}
            value={code}
            onChangeText={(t) => setCode(t.replace(/\D/g, "").slice(0, 6))}
            textAlign="center"
          />
        </>
      )}

      {mode === "register" && (
        <>
          <View style={styles.roleRow}>
            {(["CUSTOMER", "RESTAURANT", "CAPTAIN"] as Role[]).map((r) => (
              <Pressable
                key={r}
                style={[styles.roleChip, role === r && styles.roleActive]}
                onPress={() => setRole(r)}
              >
                <Text style={role === r ? styles.roleTextActive : undefined}>
                  {r === "CUSTOMER" ? "عميل" : r === "RESTAURANT" ? "مطعم" : "كابتن"}
                </Text>
              </Pressable>
            ))}
          </View>
          <TextInput
            style={styles.input}
            placeholder="الاسم"
            value={name}
            onChangeText={setName}
            textAlign="right"
          />
          <TextInput
            style={styles.input}
            placeholder="رقم الجوال (05xxxxxxxx)"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            textAlign="right"
          />
          {role === "RESTAURANT" && (
            <>
              <TextInput
                style={styles.input}
                placeholder="اسم المطعم"
                value={restaurantName}
                onChangeText={setRestaurantName}
                textAlign="right"
              />
              <TextInput
                style={styles.input}
                placeholder="العنوان (نصي — يظهر للعملاء)"
                value={address}
                onChangeText={setAddress}
                textAlign="right"
              />
              <LocationPicker
                lat={restaurantLat}
                lng={restaurantLng}
                onChange={({ lat, lng }) => {
                  setRestaurantLat(lat);
                  setRestaurantLng(lng);
                }}
              />
            </>
          )}
          {role === "CAPTAIN" && (
            <TextInput
              style={styles.input}
              placeholder="نوع المركبة (اختياري)"
              value={vehicle}
              onChangeText={setVehicle}
              textAlign="right"
            />
          )}
        </>
      )}

      {mode !== "verify" && (
        <>
          <TextInput
            style={styles.input}
            placeholder="البريد"
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
            textAlign="right"
          />
          <TextInput
            style={styles.input}
            placeholder="كلمة المرور"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            textAlign="right"
          />
        </>
      )}

      <Pressable
        style={[styles.btn, loading && styles.btnDisabled]}
        onPress={submit}
        disabled={loading}
      >
        <Text style={styles.btnText}>
          {loading ? "جاري الإرسال..." : mode === "verify" ? "تفعيل الحساب" : "متابعة"}
        </Text>
      </Pressable>

      {mode === "verify" && (
        <Pressable onPress={resendCode} disabled={loading}>
          <Text style={styles.switch}>إعادة إرسال الكود</Text>
        </Pressable>
      )}

      {mode === "verify" && (
        <Pressable onPress={() => setMode("login")}>
          <Text style={styles.link}>رجوع لتسجيل الدخول</Text>
        </Pressable>
      )}

      {mode !== "verify" && (
        <Pressable
          onPress={() => {
            setMode(mode === "login" ? "register" : "login");
            setErrorMsg("");
          }}
        >
          <Text style={styles.switch}>
            {mode === "login" ? "ليس لديك حساب؟ سجّل" : "لديك حساب؟ ادخل"}
          </Text>
        </Pressable>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, paddingTop: 60 },
  title: { fontSize: 24, fontWeight: "700", textAlign: "right", marginBottom: 20 },
  hint: { textAlign: "right", color: "#555", marginBottom: 16, lineHeight: 22 },
  intentHint: {
    textAlign: "right",
    color: "#0077B6",
    fontWeight: "700",
    marginBottom: 12,
    backgroundColor: "#E8F4F8",
    padding: 10,
    borderRadius: 8,
  },
  errorBox: {
    backgroundColor: "#FEE2E2",
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  errorText: { color: "#B91C1C", textAlign: "right", lineHeight: 20 },
  input: {
    borderWidth: 1,
    borderColor: "#DDD",
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
    backgroundColor: "#FFF",
  },
  codeInput: { fontSize: 28, letterSpacing: 12, fontWeight: "700" },
  btn: {
    backgroundColor: "#E85D04",
    padding: 16,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 8,
  },
  btnDisabled: { opacity: 0.7 },
  btnText: { color: "#FFF", fontWeight: "700", fontSize: 16 },
  switch: { textAlign: "center", marginTop: 20, color: "#E85D04", fontWeight: "600" },
  link: { textAlign: "center", marginTop: 12, color: "#666" },
  roleRow: { flexDirection: "row-reverse", gap: 8, marginBottom: 12 },
  roleChip: {
    flex: 1,
    padding: 10,
    borderRadius: 8,
    backgroundColor: "#EEE",
    alignItems: "center",
  },
  roleActive: { backgroundColor: "#E85D04" },
  roleTextActive: { color: "#FFF", fontWeight: "600" },
});
