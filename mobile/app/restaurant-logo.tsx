import { useCallback, useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  Image,
  ActivityIndicator,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter, useFocusEffect } from "expo-router";
import { api, API_URL, getToken } from "../src/lib/api";
import { showAlert } from "../src/lib/alert";
import { appendImageToForm, resolveImageUrl, type PickedImage } from "../src/lib/upload";
import { colors } from "../src/theme/colors";

export default function RestaurantLogoScreen() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [checking, setChecking] = useState(true);
  const [restaurantName, setRestaurantName] = useState("");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [pickedImage, setPickedImage] = useState<PickedImage | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const res = await api<{ restaurant: { name: string; logoUrl?: string | null } }>(
      "/api/restaurant/me"
    );
    setRestaurantName(res.restaurant.name);
    setLogoUrl(res.restaurant.logoUrl ?? null);
    setPickedImage(null);
  }, []);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        setChecking(true);
        const token = await getToken();
        if (!token) {
          router.replace("/auth?intent=restaurant");
          return;
        }
        try {
          const res = await api<{ user: { role: string } }>("/api/auth/me");
          if (cancelled) return;
          if (res.user.role !== "RESTAURANT") {
            showAlert("حساب غير مناسب", "هذه الصفحة للمطاعم فقط.");
            router.replace("/account");
            return;
          }
          await load();
          setReady(true);
        } catch {
          if (!cancelled) router.replace("/auth?intent=restaurant");
        } finally {
          if (!cancelled) setChecking(false);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [load, router])
  );

  async function pickImage() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      showAlert("صلاحية مطلوبة", "اسمح بالوصول للصور لرفع شعار المتجر");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.9,
      allowsEditing: true,
      aspect: [1, 1],
    });

    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];
    const uri = asset.uri;
    const ext = uri.split(".").pop()?.toLowerCase();
    const type =
      ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";

    setPickedImage({
      uri,
      name: `logo.${ext === "png" ? "png" : "jpg"}`,
      type,
    });
  }

  async function saveLogo() {
    if (!pickedImage && !logoUrl) {
      showAlert("تنبيه", "اختر صورة الشعار أولاً");
      return;
    }
    if (!pickedImage) {
      showAlert("تنبيه", "لم تُختر صورة جديدة");
      return;
    }

    setSaving(true);
    try {
      const token = await AsyncStorage.getItem("token");
      const form = new FormData();
      await appendImageToForm(form, pickedImage);

      const res = await fetch(`${API_URL}/api/restaurant/logo`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showAlert("خطأ", typeof data.error === "string" ? data.error : "فشل رفع الشعار");
        return;
      }

      setLogoUrl(data.logoUrl ?? null);
      setPickedImage(null);
      showAlert("تم", "تم حفظ شعار المتجر — سيظهر للعملاء في العروض والقوائم");
    } finally {
      setSaving(false);
    }
  }

  if (checking) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accentOrange} size="large" />
      </View>
    );
  }

  if (!ready) return null;

  const preview = pickedImage?.uri ?? resolveImageUrl(logoUrl);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.topBar}>
        <Pressable style={styles.backBtn} onPress={() => router.replace("/")}>
          <Text style={styles.backBtnText}>← الرئيسية</Text>
        </Pressable>
        <Text style={styles.title}>شعار المتجر</Text>
      </View>

      <Text style={styles.restaurantName}>{restaurantName}</Text>
      <Text style={styles.hint}>
        يظهر الشعار للعملاء بجانب عروضك وفي قوائم المطاعم. يُفضّل صورة مربعة واضحة.
      </Text>

      <Pressable style={styles.logoBox} onPress={pickImage}>
        {preview ? (
          <Image source={{ uri: preview }} style={styles.logoImage} resizeMode="cover" />
        ) : (
          <View style={styles.logoPlaceholder}>
            <Text style={styles.logoPlaceholderEmoji}>🏪</Text>
            <Text style={styles.logoPlaceholderText}>اضغط لاختيار الشعار</Text>
          </View>
        )}
      </Pressable>

      <Pressable style={styles.secondaryBtn} onPress={pickImage}>
        <Text style={styles.secondaryBtnText}>
          {preview ? "تغيير الصورة" : "اختيار من المعرض"}
        </Text>
      </Pressable>

      <Pressable
        style={[styles.btn, (saving || !pickedImage) && styles.btnDisabled]}
        onPress={saveLogo}
        disabled={saving || !pickedImage}
      >
        {saving ? (
          <ActivityIndicator color="#FFF" />
        ) : (
          <Text style={styles.btnText}>حفظ الشعار</Text>
        )}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, paddingTop: 48, paddingBottom: 40 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg },
  topBar: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  title: { fontSize: 22, fontWeight: "700", textAlign: "right", flex: 1, color: colors.text },
  backBtn: {
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.accentOrange,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  backBtnText: { color: colors.accentOrange, fontWeight: "700" },
  restaurantName: {
    textAlign: "right",
    fontSize: 18,
    fontWeight: "800",
    color: colors.text,
    marginBottom: 8,
  },
  hint: {
    textAlign: "right",
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 20,
  },
  logoBox: {
    alignSelf: "center",
    width: 160,
    height: 160,
    borderRadius: 20,
    overflow: "hidden",
    backgroundColor: colors.bgElevated,
    borderWidth: 2,
    borderColor: colors.border,
    marginBottom: 16,
  },
  logoImage: { width: "100%", height: "100%" },
  logoPlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 12,
  },
  logoPlaceholderEmoji: { fontSize: 48, marginBottom: 8 },
  logoPlaceholderText: {
    textAlign: "center",
    color: colors.textDim,
    fontWeight: "600",
    fontSize: 13,
  },
  secondaryBtn: {
    alignItems: "center",
    padding: 12,
    marginBottom: 12,
  },
  secondaryBtnText: { color: colors.accentOrange, fontWeight: "700", fontSize: 15 },
  btn: {
    backgroundColor: colors.accentOrange,
    padding: 14,
    borderRadius: 10,
    alignItems: "center",
    minHeight: 48,
    justifyContent: "center",
  },
  btnDisabled: { opacity: 0.55 },
  btnText: { color: "#FFF", fontWeight: "700" },
});
