import { useCallback, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { api } from "../../src/lib/api";
import { showAlert } from "../../src/lib/alert";
import { LocationPicker } from "../../src/components/LocationPicker";
import { triggerAutoLocation, webAllowsGps } from "../../src/lib/customerLocation";
import { colors } from "../../src/theme/colors";

type Role = "CUSTOMER" | "RESTAURANT" | "CAPTAIN";

type Profile = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: Role;
  restaurant?: {
    name: string;
    description: string | null;
    address: string;
    lat: number;
    lng: number;
  } | null;
  captain?: { vehicle: string | null } | null;
};

const roleLabels: Record<Role, string> = {
  CUSTOMER: "عميل",
  RESTAURANT: "مطعم",
  CAPTAIN: "كابتن توصيل",
};

export default function EditAccountScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [role, setRole] = useState<Role>("CUSTOMER");
  const [email, setEmail] = useState("");

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  const [restaurantName, setRestaurantName] = useState("");
  const [restaurantDesc, setRestaurantDesc] = useState("");
  const [restaurantAddress, setRestaurantAddress] = useState("");
  const [restaurantLat, setRestaurantLat] = useState(24.7136);
  const [restaurantLng, setRestaurantLng] = useState(46.6753);

  const [vehicle, setVehicle] = useState("");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [autoLocating, setAutoLocating] = useState(false);
  const [locHint, setLocHint] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api<{ user: Profile }>("/api/auth/me");
      const u = res.user;
      setRole(u.role);
      setEmail(u.email);
      setName(u.name);
      setPhone(u.phone ?? "");

      if (u.restaurant) {
        setRestaurantName(u.restaurant.name);
        setRestaurantDesc(u.restaurant.description ?? "");
        setRestaurantAddress(u.restaurant.address);
        setRestaurantLat(u.restaurant.lat);
        setRestaurantLng(u.restaurant.lng);
      }

      if (u.captain) {
        setVehicle(u.captain.vehicle ?? "");
      }
    } catch {
      showAlert("خطأ", "تعذر تحميل البيانات");
      router.back();
    } finally {
      setLoading(false);
    }
  }, [router]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  function cancel() {
    router.replace("/account");
  }

  function onAutoRestaurantLocation() {
    if (autoLocating) return;
    setAutoLocating(true);
    setLocHint(null);
    triggerAutoLocation((result) => {
      setAutoLocating(false);
      if (!result.ok) {
        setLocHint(result.message);
        return;
      }
      setRestaurantLat(result.lat);
      setRestaurantLng(result.lng);
      setLocHint(
        result.source === "ip"
          ? "موقع تقريبي — راجع الخريطة ثم اضغط حفظ"
          : "تم التحديد — اضغط حفظ لحفظ التعديلات"
      );
    });
  }

  async function save() {
    if (name.trim().length < 2) {
      showAlert("تنبيه", "أدخل الاسم (حرفين على الأقل)");
      return;
    }
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 9) {
      showAlert("تنبيه", "أدخل رقم جوال صحيح");
      return;
    }

    if (newPassword && newPassword.length < 6) {
      showAlert("تنبيه", "كلمة المرور الجديدة 6 أحرف على الأقل");
      return;
    }
    if (newPassword && !currentPassword) {
      showAlert("تنبيه", "أدخل كلمة المرور الحالية لتغييرها");
      return;
    }

    if (role === "RESTAURANT") {
      if (!restaurantName.trim() || !restaurantAddress.trim()) {
        showAlert("تنبيه", "أدخل اسم المطعم والعنوان");
        return;
      }
    }

    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        name: name.trim(),
        phone: phone.trim(),
      };

      if (newPassword) {
        body.currentPassword = currentPassword;
        body.newPassword = newPassword;
      }

      if (role === "RESTAURANT") {
        body.restaurant = {
          name: restaurantName.trim(),
          description: restaurantDesc.trim() || undefined,
          address: restaurantAddress.trim(),
          lat: restaurantLat,
          lng: restaurantLng,
        };
      }

      if (role === "CAPTAIN") {
        body.captain = { vehicle: vehicle.trim() || undefined };
      }

      const res = await api<{ message: string }>("/api/auth/me", {
        method: "PATCH",
        body: JSON.stringify(body),
      });

      showAlert("تم", res.message ?? "تم حفظ التعديلات");
      router.back();
    } catch (e) {
      showAlert("خطأ", e instanceof Error ? e.message : "فشل الحفظ");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.accentOrange} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>تعديل الحساب</Text>
      <Text style={styles.roleBadge}>{roleLabels[role]}</Text>

      <Text style={styles.label}>البريد (لا يمكن تغييره)</Text>
      <TextInput
        style={[styles.input, styles.inputDisabled]}
        value={email}
        editable={false}
        textAlign="right"
        placeholderTextColor={colors.textDim}
      />

      <Text style={styles.label}>الاسم</Text>
      <TextInput
        style={styles.input}
        value={name}
        onChangeText={setName}
        textAlign="right"
        placeholderTextColor={colors.textDim}
        selectionColor={colors.accent}
      />

      <Text style={styles.label}>رقم الجوال</Text>
      <TextInput
        style={styles.input}
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
        textAlign="right"
        placeholder="05xxxxxxxx"
        placeholderTextColor={colors.textDim}
        selectionColor={colors.accent}
      />

      {role === "RESTAURANT" && (
        <>
          <Text style={styles.section}>بيانات المطعم</Text>
          <Text style={styles.label}>اسم المطعم</Text>
          <TextInput
            style={styles.input}
            value={restaurantName}
            onChangeText={setRestaurantName}
            textAlign="right"
            placeholderTextColor={colors.textDim}
            selectionColor={colors.accent}
          />
          <Text style={styles.label}>وصف (اختياري)</Text>
          <TextInput
            style={styles.input}
            value={restaurantDesc}
            onChangeText={setRestaurantDesc}
            textAlign="right"
            multiline
            placeholderTextColor={colors.textDim}
            selectionColor={colors.accent}
          />
          <Text style={styles.label}>العنوان (نصي)</Text>
          <TextInput
            style={styles.input}
            value={restaurantAddress}
            onChangeText={setRestaurantAddress}
            textAlign="right"
            placeholderTextColor={colors.textDim}
            selectionColor={colors.accent}
          />
          <Pressable
            style={[styles.autoLocBtn, autoLocating && styles.autoLocBtnDisabled]}
            onPress={onAutoRestaurantLocation}
            disabled={autoLocating}
          >
            {autoLocating ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.autoLocBtnText}>
                {webAllowsGps()
                  ? "📍 تحديد موقعي تلقائياً"
                  : "📡 تحديد موقعي تلقائياً (من الشبكة)"}
              </Text>
            )}
          </Pressable>
          {locHint ? <Text style={styles.locHint}>{locHint}</Text> : null}
          <LocationPicker
            lat={restaurantLat}
            lng={restaurantLng}
            onChange={({ lat, lng }) => {
              setRestaurantLat(lat);
              setRestaurantLng(lng);
              setLocHint(null);
            }}
            hideAutoButton
            label="🗺️ اسحب العلامة أو اضغط على الخريطة لتحديد الموقع"
          />
        </>
      )}

      {role === "CAPTAIN" && (
        <>
          <Text style={styles.section}>بيانات الكابتن</Text>
          <Text style={styles.label}>نوع المركبة (اختياري)</Text>
          <TextInput
            style={styles.input}
            value={vehicle}
            onChangeText={setVehicle}
            textAlign="right"
            placeholder="مثال: دراجة نارية، سيارة"
            placeholderTextColor={colors.textDim}
            selectionColor={colors.accent}
          />
        </>
      )}

      <Text style={styles.section}>تغيير كلمة المرور (اختياري)</Text>
      <Text style={styles.label}>كلمة المرور الحالية</Text>
      <TextInput
        style={styles.input}
        value={currentPassword}
        onChangeText={setCurrentPassword}
        secureTextEntry
        textAlign="right"
        placeholderTextColor={colors.textDim}
        selectionColor={colors.accent}
      />
      <Text style={styles.label}>كلمة المرور الجديدة</Text>
      <TextInput
        style={styles.input}
        value={newPassword}
        onChangeText={setNewPassword}
        secureTextEntry
        textAlign="right"
        placeholderTextColor={colors.textDim}
        selectionColor={colors.accent}
      />

      <Pressable style={[styles.saveBtn, saving && styles.disabled]} onPress={save} disabled={saving}>
        {saving ? (
          <ActivityIndicator color="#FFF" />
        ) : (
          <Text style={styles.saveText}>حفظ التعديلات</Text>
        )}
      </Pressable>

      <Pressable style={styles.cancelBtn} onPress={cancel} disabled={saving}>
        <Text style={styles.cancelText}>إلغاء</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 20, paddingTop: 48, paddingBottom: 40 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg },
  title: { fontSize: 22, fontWeight: "700", textAlign: "right", marginBottom: 6, color: colors.text },
  roleBadge: { textAlign: "right", color: colors.accentOrange, fontWeight: "600", marginBottom: 20 },
  section: {
    fontSize: 17,
    fontWeight: "700",
    textAlign: "right",
    marginTop: 20,
    marginBottom: 10,
    color: colors.text,
  },
  label: { textAlign: "right", color: colors.textMuted, marginBottom: 6, fontSize: 14, fontWeight: "600" },
  input: {
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.28)",
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    backgroundColor: colors.bgCard,
    color: colors.text,
    fontSize: 16,
  },
  inputDisabled: { backgroundColor: colors.bgElevated, color: colors.textMuted },
  row: { flexDirection: "row-reverse", gap: 10 },
  half: { flex: 1 },
  saveBtn: {
    backgroundColor: "#E85D04",
    padding: 16,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 24,
    minHeight: 50,
    justifyContent: "center",
  },
  saveText: { color: "#FFF", fontWeight: "700", fontSize: 16 },
  cancelBtn: {
    padding: 16,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 10,
    minHeight: 50,
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.28)",
    backgroundColor: colors.bgCard,
  },
  cancelText: { color: colors.text, fontWeight: "700", fontSize: 16 },
  disabled: { opacity: 0.7 },
  autoLocBtn: {
    backgroundColor: "#2D6A4F",
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
    marginBottom: 8,
    minHeight: 44,
    justifyContent: "center",
  },
  autoLocBtnDisabled: { opacity: 0.7 },
  autoLocBtnText: { color: "#FFF", fontWeight: "700" },
  locHint: {
    color: colors.accentOrange,
    fontSize: 13,
    textAlign: "right",
    marginBottom: 8,
    lineHeight: 20,
  },
});
