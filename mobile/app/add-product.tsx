import { useCallback, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
  Image,
  ActivityIndicator,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter, useFocusEffect, useLocalSearchParams } from "expo-router";
import { api, API_URL, getToken } from "../src/lib/api";
import { showAlert } from "../src/lib/alert";
import { appendImageToForm, resolveImageUrl, type PickedImage } from "../src/lib/upload";
import { colors } from "../src/theme/colors";
import { inputPlaceholderColor } from "../src/theme/restaurantPanel";

type Product = {
  id: string;
  name: string;
  price: number;
  category: string;
  mealType: string;
  imageUrl?: string | null;
};

type MealTypeChoice = "" | "BREAKFAST" | "LUNCH" | "DINNER";

function normalizeMealChoice(raw?: string | null): MealTypeChoice {
  const mt = raw?.trim().toUpperCase() ?? "";
  if (mt === "BREAKFAST" || mt === "LUNCH" || mt === "DINNER") return mt;
  return "";
}

export default function AddProductScreen() {
  const router = useRouter();
  const { id: editProductId } = useLocalSearchParams<{ id?: string }>();
  const isEditing = Boolean(editProductId);
  const [ready, setReady] = useState(false);
  const [checking, setChecking] = useState(true);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [category, setCategory] = useState("برجر");
  const [mealType, setMealType] = useState<MealTypeChoice>("");
  const [existingImageUrl, setExistingImageUrl] = useState<string | null>(null);
  const [pickedImage, setPickedImage] = useState<PickedImage | null>(null);
  const [saving, setSaving] = useState(false);

  const loadProduct = useCallback(async () => {
    if (!editProductId) return;
    const res = await api<{ restaurant: { products: Product[] } }>("/api/restaurant/me");
    const product = res.restaurant?.products?.find((p) => p.id === editProductId);
    if (!product) {
      showAlert("خطأ", "المنتج غير موجود");
      router.replace("/restaurant-products");
      return;
    }
    setName(product.name);
    setPrice(String(product.price));
    setCategory(product.category);
    setMealType(normalizeMealChoice(product.mealType));
    setExistingImageUrl(product.imageUrl ?? null);
  }, [editProductId, router]);

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
            showAlert("حساب غير مناسب", "إضافة المنتجات تتطلب حساب مطعم.");
            router.replace("/account");
            return;
          }
          if (editProductId) {
            await loadProduct();
          } else {
            setMealType("");
          }
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
    }, [router, editProductId, loadProduct])
  );

  async function pickImage() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      showAlert("صلاحية مطلوبة", "اسمح بالوصول للصور لرفع صورة المنتج");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.85,
      allowsEditing: true,
      aspect: [4, 3],
    });

    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];
    const uri = asset.uri;
    const ext = uri.split(".").pop()?.toLowerCase();
    const type =
      ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";

    setPickedImage({
      uri,
      name: `product.${ext === "png" ? "png" : "jpg"}`,
      type,
    });
  }

  async function saveProduct() {
    if (!name.trim() || !price.trim()) {
      showAlert("تنبيه", "أدخل اسم المنتج والسعر");
      return;
    }

    setSaving(true);
    try {
      const token = await AsyncStorage.getItem("token");
      const form = new FormData();
      form.append("name", name.trim());
      form.append("price", price);
      form.append("category", category.trim());
      form.append("mealType", mealType);

      if (pickedImage) {
        await appendImageToForm(form, pickedImage);
      }

      const url = isEditing
        ? `${API_URL}/api/restaurant/products/${editProductId}`
        : `${API_URL}/api/restaurant/products`;
      const res = await fetch(url, {
        method: isEditing ? "PATCH" : "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showAlert(
          "خطأ",
          typeof data.error === "string"
            ? data.error
            : isEditing
              ? "فشل تعديل المنتج"
              : "فشل إضافة المنتج"
        );
        return;
      }

      if (isEditing) {
        showAlert("تم", "تم حفظ التعديلات");
        router.replace("/restaurant-products");
        return;
      }

      setName("");
      setPrice("");
      setMealType("");
      setPickedImage(null);
      showAlert("تم", pickedImage ? "تم حفظ المنتج مع الصورة" : "تم حفظ المنتج بنجاح");
    } finally {
      setSaving(false);
    }
  }

  if (checking) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#E85D04" size="large" />
      </View>
    );
  }

  if (!ready) return null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.topBar}>
        <Pressable
          style={styles.backBtn}
          onPress={() => router.replace(isEditing ? "/restaurant-products" : "/")}
        >
          <Text style={styles.backBtnText}>{isEditing ? "← المنتجات" : "← الرئيسية"}</Text>
        </Pressable>
        <Text style={styles.title}>{isEditing ? "تعديل منتج" : "إضافة منتج"}</Text>
      </View>

      <TextInput
        style={styles.input}
        placeholderTextColor={inputPlaceholderColor}
        placeholderTextColor={inputPlaceholderColor}
        placeholder="اسم المنتج"
        value={name}
        onChangeText={setName}
        textAlign="right"
      />
      <TextInput
        style={styles.input}
        placeholderTextColor={inputPlaceholderColor}
        placeholder="السعر"
        value={price}
        onChangeText={setPrice}
        keyboardType="decimal-pad"
        textAlign="right"
      />
      <TextInput
        style={styles.input}
        placeholderTextColor={inputPlaceholderColor}
        placeholder="الصنف (برجر، شاورما...)"
        value={category}
        onChangeText={setCategory}
        textAlign="right"
      />
      <Text style={styles.mealHint}>وقت الوجبة (اختياري — للظهور في فلتر فطور/غداء/عشاء)</Text>
      <View style={styles.mealRow}>
        <Pressable
          style={[styles.mealChip, mealType === "" && styles.mealActive]}
          onPress={() => setMealType("")}
        >
          <Text style={mealType === "" ? styles.mealTextActive : styles.mealText}>
            بدون تحديد
          </Text>
        </Pressable>
        {(["BREAKFAST", "LUNCH", "DINNER"] as const).map((m) => (
          <Pressable
            key={m}
            style={[styles.mealChip, mealType === m && styles.mealActive]}
            onPress={() => setMealType(m)}
          >
            <Text style={mealType === m ? styles.mealTextActive : styles.mealText}>
              {m === "BREAKFAST" ? "فطور" : m === "LUNCH" ? "غداء" : "عشاء"}
            </Text>
          </Pressable>
        ))}
      </View>

      <Pressable style={styles.imagePicker} onPress={pickImage}>
        {pickedImage ? (
          <Image source={{ uri: pickedImage.uri }} style={styles.preview} resizeMode="cover" />
        ) : existingImageUrl ? (
          <Image
            source={{ uri: resolveImageUrl(existingImageUrl) ?? undefined }}
            style={styles.preview}
            resizeMode="cover"
          />
        ) : (
          <Text style={styles.imagePickerText}>+ اختر صورة المنتج</Text>
        )}
      </Pressable>
      {(pickedImage || existingImageUrl) && (
        <Pressable
          onPress={() => {
            setPickedImage(null);
            setExistingImageUrl(null);
          }}
        >
          <Text style={styles.removeImage}>إزالة الصورة</Text>
        </Pressable>
      )}

      <Pressable style={[styles.btn, saving && styles.btnDisabled]} onPress={saveProduct} disabled={saving}>
        {saving ? (
          <ActivityIndicator color="#FFF" />
        ) : (
          <Text style={styles.btnText}>{isEditing ? "حفظ التعديلات" : "حفظ المنتج"}</Text>
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
    marginBottom: 20,
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
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    backgroundColor: colors.bgCard,
    color: colors.text,
    fontSize: 16,
  },
  mealHint: {
    textAlign: "right",
    color: colors.textMuted,
    fontSize: 13,
    marginBottom: 8,
    lineHeight: 20,
  },
  mealRow: {
    flexDirection: "row-reverse",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },
  mealChip: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: colors.bgCard,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: colors.border,
  },
  mealActive: { backgroundColor: colors.accentOrange, borderColor: colors.accentOrange },
  mealText: { color: colors.textMuted, fontWeight: "600" },
  mealTextActive: { color: "#FFF", fontWeight: "700" },
  imagePicker: {
    height: 160,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.accentOrange,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
    overflow: "hidden",
    backgroundColor: colors.bgElevated,
  },
  imagePickerText: { color: colors.accentOrange, fontWeight: "600", fontSize: 16 },
  preview: { width: "100%", height: "100%" },
  removeImage: { textAlign: "center", color: colors.textDim, marginBottom: 8 },
  btn: {
    backgroundColor: colors.accentOrange,
    padding: 14,
    borderRadius: 10,
    alignItems: "center",
    minHeight: 48,
    justifyContent: "center",
    marginTop: 8,
  },
  btnDisabled: { opacity: 0.7 },
  btnText: { color: "#FFF", fontWeight: "700" },
});
