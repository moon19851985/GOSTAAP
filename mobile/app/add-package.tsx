import { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Image,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter, useFocusEffect, useLocalSearchParams } from "expo-router";
import { api, API_URL, getToken } from "../src/lib/api";
import { showAlert } from "../src/lib/alert";
import { appendImageToForm, resolveImageUrl, type PickedImage } from "../src/lib/upload";
import { formatMoney } from "../src/lib/formatMoney";
import type { MealPackage } from "../src/types/package";
import { colors } from "../src/theme/colors";
import { inputPlaceholderColor } from "../src/theme/restaurantPanel";

type Product = { id: string; name: string; price: number };

type DraftItem = { productId: string; quantity: number };

function itemsToMap(items: MealPackage["items"]): Record<string, number> {
  const map: Record<string, number> = {};
  for (const i of items) {
    map[i.productId] = i.quantity;
  }
  return map;
}

export default function AddPackageScreen() {
  const router = useRouter();
  const { id: editPackageId } = useLocalSearchParams<{ id?: string }>();
  const isEditing = Boolean(editPackageId);
  const [ready, setReady] = useState(false);
  const [checking, setChecking] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [packages, setPackages] = useState<MealPackage[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [pickedItems, setPickedItems] = useState<Record<string, number>>({});
  const [pickedImage, setPickedImage] = useState<PickedImage | null>(null);
  const [existingImageUrl, setExistingImageUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const resetForm = useCallback(() => {
    setName("");
    setDescription("");
    setPrice("");
    setPickedItems({});
    setPickedImage(null);
    setExistingImageUrl(null);
  }, []);

  const fillForm = useCallback((pkg: MealPackage) => {
    setName(pkg.name);
    setDescription(pkg.description ?? "");
    setPrice(String(pkg.price));
    setPickedItems(itemsToMap(pkg.items));
    setPickedImage(null);
    setExistingImageUrl(pkg.imageUrl ?? null);
  }, []);

  const load = useCallback(async () => {
    const [me, pkgs] = await Promise.all([
      api<{ restaurant: { products: Product[] } }>("/api/restaurant/me"),
      api<{ packages: MealPackage[] }>("/api/restaurant/packages"),
    ]);
    setProducts(me.restaurant?.products ?? []);
    setPackages(pkgs.packages);
    return pkgs.packages;
  }, []);

  const loadPackageForEdit = useCallback(
    async (packagesList: MealPackage[]) => {
      if (!editPackageId) return;
      const pkg = packagesList.find((p) => p.id === editPackageId);
      if (!pkg) {
        showAlert("خطأ", "البكج غير موجود");
        router.replace("/add-package");
        return;
      }
      fillForm(pkg);
    },
    [editPackageId, fillForm, router]
  );

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
            showAlert("حساب غير مناسب", "إدارة البكجات تتطلب حساب مطعم.");
            router.replace("/account");
            return;
          }
          const list = await load();
          if (editPackageId) await loadPackageForEdit(list);
          else resetForm();
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
    }, [load, loadPackageForEdit, editPackageId, resetForm, router])
  );

  const catalogTotal = useMemo(() => {
    return Object.entries(pickedItems).reduce((sum, [pid, qty]) => {
      const p = products.find((x) => x.id === pid);
      return sum + (p ? p.price * qty : 0);
    }, 0);
  }, [pickedItems, products]);

  const previewUri = pickedImage?.uri ?? resolveImageUrl(existingImageUrl);

  function toggleProduct(productId: string) {
    setPickedItems((prev) => {
      const next = { ...prev };
      if (next[productId]) delete next[productId];
      else next[productId] = 1;
      return next;
    });
  }

  function changeQty(productId: string, delta: number) {
    setPickedItems((prev) => {
      const q = (prev[productId] ?? 0) + delta;
      if (q <= 0) {
        const next = { ...prev };
        delete next[productId];
        return next;
      }
      return { ...prev, [productId]: q };
    });
  }

  function startEdit(pkg: MealPackage) {
    router.replace(`/add-package?id=${pkg.id}`);
  }

  function cancelEdit() {
    resetForm();
    router.replace("/add-package");
  }

  async function pickImage() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      showAlert("تنبيه", "نحتاج إذن الوصول للصور");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.85,
      allowsEditing: true,
      aspect: [16, 9],
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    const uri = asset.uri;
    const ext = uri.split(".").pop()?.toLowerCase();
    const type =
      ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
    setPickedImage({
      uri,
      name: `package.${ext === "png" ? "png" : "jpg"}`,
      type,
    });
  }

  async function submit() {
    if (!name.trim()) {
      showAlert("تنبيه", "أدخل اسم البكج");
      return;
    }
    const items: DraftItem[] = Object.entries(pickedItems).map(([productId, quantity]) => ({
      productId,
      quantity,
    }));
    if (items.length === 0) {
      showAlert("تنبيه", "اختر منتجاً واحداً على الأقل");
      return;
    }
    const packagePrice = Number(price);
    if (!Number.isFinite(packagePrice) || packagePrice <= 0) {
      showAlert("تنبيه", "أدخل سعر البكج");
      return;
    }
    if (packagePrice >= catalogTotal) {
      showAlert("تنبيه", "سعر البكج يجب أن يكون أقل من مجموع أسعار المنتجات");
      return;
    }

    setSaving(true);
    try {
      const token = await AsyncStorage.getItem("token");
      const form = new FormData();
      form.append("name", name.trim());
      form.append("description", description.trim());
      form.append("price", String(packagePrice));
      form.append("items", JSON.stringify(items));
      if (pickedImage) await appendImageToForm(form, pickedImage);

      const url = isEditing
        ? `${API_URL}/api/restaurant/packages/${editPackageId}`
        : `${API_URL}/api/restaurant/packages`;
      const res = await fetch(url, {
        method: isEditing ? "PUT" : "POST",
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
              ? "فشل تعديل البكج"
              : "فشل إضافة البكج"
        );
        return;
      }

      if (isEditing) {
        showAlert("تم", "تم حفظ تعديلات البكج");
        router.replace("/add-package");
        return;
      }

      resetForm();
      await load();
      showAlert("تم", "تم نشر البكج — سيظهر للعملاء في الصفحة الرئيسية");
    } finally {
      setSaving(false);
    }
  }

  async function removePackage(id: string) {
    setDeletingId(id);
    try {
      await api(`/api/restaurant/packages/${id}`, { method: "DELETE" });
      if (editPackageId === id) {
        resetForm();
        router.replace("/add-package");
      }
      await load();
    } catch (e) {
      showAlert("خطأ", e instanceof Error ? e.message : "تعذّر حذف البكج");
    } finally {
      setDeletingId(null);
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
          onPress={() => router.replace(isEditing ? "/add-package" : "/")}
        >
          <Text style={styles.backBtnText}>
            {isEditing ? "← إدارة البكجات" : "← الرئيسية"}
          </Text>
        </Pressable>
        <Text style={styles.title}>{isEditing ? "تعديل البكج" : "إدارة البكجات"}</Text>
      </View>

      {!isEditing && packages.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>بكجاتك المنشورة</Text>
          {packages.map((pkg) => (
            <View key={pkg.id} style={styles.pkgCard}>
              <Text style={styles.pkgName}>{pkg.name}</Text>
              <Text style={styles.pkgMeta}>
                {formatMoney(pkg.price)} ر.س
                {pkg.originalPrice ? ` · كان ${formatMoney(pkg.originalPrice)} ر.س` : ""}
              </Text>
              <Text style={styles.pkgItems} numberOfLines={2}>
                {pkg.items.map((i) => `${i.productName}×${i.quantity}`).join(" · ")}
              </Text>
              <View style={styles.pkgActions}>
                <Pressable style={styles.editBtn} onPress={() => startEdit(pkg)}>
                  <Text style={styles.editBtnText}>تعديل</Text>
                </Pressable>
                <Pressable
                  style={styles.deleteBtn}
                  onPress={() => removePackage(pkg.id)}
                  disabled={deletingId === pkg.id}
                >
                  {deletingId === pkg.id ? (
                    <ActivityIndicator color="#FFF" size="small" />
                  ) : (
                    <Text style={styles.deleteBtnText}>حذف</Text>
                  )}
                </Pressable>
              </View>
            </View>
          ))}
        </>
      )}

      <Text style={styles.sectionTitle}>{isEditing ? "تعديل البكج" : "بكج جديد"}</Text>
      {isEditing ? (
        <Pressable style={styles.cancelEditBtn} onPress={cancelEdit}>
          <Text style={styles.cancelEditText}>إلغاء التعديل</Text>
        </Pressable>
      ) : null}

      <TextInput
        style={styles.input}
        placeholderTextColor={inputPlaceholderColor}
        placeholder="اسم البكج — مثال: بكج عائلي"
        value={name}
        onChangeText={setName}
        textAlign="right"
      />
      <TextInput
        style={[styles.input, styles.descInput]}
        placeholder="وصف مختصر (اختياري)"
        value={description}
        onChangeText={setDescription}
        textAlign="right"
        multiline
      />

      <Pressable style={styles.imageBtn} onPress={pickImage}>
        <Text style={styles.imageBtnText}>
          {pickedImage
            ? "✓ تم اختيار صورة جديدة"
            : existingImageUrl
              ? "📷 تغيير صورة البكج"
              : "📷 صورة البكج (اختياري)"}
        </Text>
      </Pressable>
      {previewUri ? (
        <Image source={{ uri: previewUri }} style={styles.preview} resizeMode="cover" />
      ) : null}

      <Text style={styles.sectionTitle}>منتجات البكج</Text>
      {products.length === 0 ? (
        <Text style={styles.hint}>أضف منتجات أولاً من «إضافة منتج»</Text>
      ) : (
        products.map((p) => {
          const qty = pickedItems[p.id];
          const selected = qty != null && qty > 0;
          return (
            <View key={p.id} style={[styles.productRow, selected && styles.productRowActive]}>
              <Pressable style={styles.productTap} onPress={() => toggleProduct(p.id)}>
                <Text style={styles.productName}>{p.name}</Text>
                <Text style={styles.productPrice}>{formatMoney(p.price)} ر.س</Text>
              </Pressable>
              {selected ? (
                <View style={styles.qtyRow}>
                  <Pressable style={styles.qtyBtn} onPress={() => changeQty(p.id, -1)}>
                    <Text style={styles.qtyBtnText}>−</Text>
                  </Pressable>
                  <Text style={styles.qtyVal}>{qty}</Text>
                  <Pressable style={styles.qtyBtn} onPress={() => changeQty(p.id, 1)}>
                    <Text style={styles.qtyBtnText}>+</Text>
                  </Pressable>
                </View>
              ) : null}
            </View>
          );
        })
      )}

      {catalogTotal > 0 ? (
        <Text style={styles.catalogHint}>مجموع المنتجات: {formatMoney(catalogTotal)} ر.س</Text>
      ) : null}

      <TextInput
        style={styles.input}
        placeholderTextColor={inputPlaceholderColor}
        placeholder="سعر البكج للعميل (ر.س)"
        value={price}
        onChangeText={setPrice}
        keyboardType="decimal-pad"
        textAlign="right"
      />

      <Pressable style={[styles.btn, saving && styles.btnDisabled]} onPress={submit} disabled={saving}>
        {saving ? (
          <ActivityIndicator color="#FFF" />
        ) : (
          <Text style={styles.btnText}>{isEditing ? "حفظ التعديلات" : "نشر البكج"}</Text>
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
  sectionTitle: {
    fontWeight: "800",
    fontSize: 16,
    textAlign: "right",
    marginBottom: 10,
    marginTop: 12,
    color: colors.text,
  },
  hint: { textAlign: "right", color: colors.textDim, marginBottom: 12 },
  pkgCard: {
    backgroundColor: colors.bgCard,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pkgName: { fontWeight: "800", textAlign: "right", fontSize: 15, color: colors.text },
  pkgMeta: { textAlign: "right", color: colors.accentOrange, marginTop: 4, fontWeight: "600" },
  pkgItems: { textAlign: "right", color: colors.textMuted, fontSize: 12, marginTop: 4 },
  pkgActions: {
    flexDirection: "row-reverse",
    gap: 8,
    marginTop: 10,
  },
  editBtn: {
    flex: 1,
    backgroundColor: colors.bgElevated,
    padding: 10,
    borderRadius: 8,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.accent,
  },
  editBtnText: { color: colors.accent, fontWeight: "700" },
  cancelEditBtn: {
    alignSelf: "flex-end",
    marginBottom: 8,
    paddingVertical: 6,
  },
  cancelEditText: { color: colors.textMuted, fontWeight: "600", fontSize: 13 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    backgroundColor: colors.bgCard,
    fontSize: 15,
    color: colors.text,
  },
  descInput: { minHeight: 64, textAlignVertical: "top" },
  imageBtn: {
    borderWidth: 1,
    borderColor: colors.accentOrange,
    borderRadius: 10,
    padding: 12,
    alignItems: "center",
    marginBottom: 8,
    backgroundColor: "#2A1F18",
  },
  imageBtnText: { color: colors.accentOrange, fontWeight: "700" },
  preview: { width: "100%", height: 140, borderRadius: 12, marginBottom: 12 },
  productRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.bgCard,
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  productRowActive: { borderColor: colors.accentOrange, backgroundColor: "#2A1F18" },
  productTap: { flex: 1 },
  productName: { fontWeight: "700", textAlign: "right", color: colors.text },
  productPrice: { textAlign: "right", color: colors.textMuted, fontSize: 12, marginTop: 2 },
  qtyRow: { flexDirection: "row-reverse", alignItems: "center", gap: 8 },
  qtyBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: colors.accentOrange,
    alignItems: "center",
    justifyContent: "center",
  },
  qtyBtnText: { color: "#FFF", fontWeight: "800", fontSize: 18 },
  qtyVal: { fontWeight: "800", minWidth: 24, textAlign: "center", color: colors.text },
  catalogHint: { textAlign: "right", color: colors.textMuted, marginBottom: 8, fontWeight: "600" },
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
  deleteBtn: {
    flex: 1,
    backgroundColor: colors.danger,
    padding: 10,
    borderRadius: 8,
    alignItems: "center",
  },
  deleteBtnText: { color: "#FFF", fontWeight: "700" },
});
