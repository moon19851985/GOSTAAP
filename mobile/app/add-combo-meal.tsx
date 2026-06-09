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
import type { ComboMeal } from "../src/types/comboMeal";
import {
  OFFER_SLOTS,
  OFFER_SLOT_EMOJI,
  OFFER_SLOT_LABELS,
  type OfferSlot,
} from "../src/types/offerSlot";
import { colors } from "../src/theme/colors";
import { inputPlaceholderColor } from "../src/theme/restaurantPanel";

type Product = { id: string; name: string; price: number; category: string };

function itemsToMap(items: ComboMeal["items"]): Record<string, number> {
  const map: Record<string, number> = {};
  for (const i of items) map[i.productId] = i.quantity;
  return map;
}

export default function AddComboMealScreen() {
  const router = useRouter();
  const { id: editId } = useLocalSearchParams<{ id?: string }>();
  const isEditing = Boolean(editId);
  const [ready, setReady] = useState(false);
  const [checking, setChecking] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [comboMeals, setComboMeals] = useState<ComboMeal[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [category, setCategory] = useState("وجبات");
  const [pickedItems, setPickedItems] = useState<Record<string, number>>({});
  const [pickedImage, setPickedImage] = useState<PickedImage | null>(null);
  const [existingImageUrl, setExistingImageUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [discountMeal, setDiscountMeal] = useState<ComboMeal | null>(null);
  const [discountedPrice, setDiscountedPrice] = useState("");
  const [discountReason, setDiscountReason] = useState("");
  const [offerSlot, setOfferSlot] = useState<OfferSlot | null>(null);
  const [hourStart, setHourStart] = useState("14:00");
  const [hourEnd, setHourEnd] = useState("17:00");
  const [discountSaving, setDiscountSaving] = useState(false);

  const catalogTotal = useMemo(
    () =>
      Object.entries(pickedItems).reduce((sum, [pid, qty]) => {
        const p = products.find((x) => x.id === pid);
        return sum + (p?.price ?? 0) * qty;
      }, 0),
    [pickedItems, products]
  );

  const resetForm = useCallback(() => {
    setName("");
    setDescription("");
    setPrice("");
    setCategory("وجبات");
    setPickedItems({});
    setPickedImage(null);
    setExistingImageUrl(null);
  }, []);

  const fillForm = useCallback((meal: ComboMeal) => {
    setName(meal.name);
    setDescription(meal.description ?? "");
    setPrice(String(meal.price));
    setCategory(meal.category || "وجبات");
    setPickedItems(itemsToMap(meal.items));
    setPickedImage(null);
    setExistingImageUrl(meal.imageUrl ?? null);
  }, []);

  const load = useCallback(async () => {
    const [me, combos] = await Promise.all([
      api<{ restaurant: { products: Product[] } }>("/api/restaurant/me"),
      api<{ comboMeals: ComboMeal[] }>("/api/restaurant/combo-meals"),
    ]);
    setProducts(me.restaurant?.products ?? []);
    setComboMeals(combos.comboMeals);
    return combos.comboMeals;
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
            showAlert("حساب غير مناسب", "إدارة الوجبات للمطاعم فقط.");
            router.replace("/account");
            return;
          }
          const list = await load();
          if (editId) {
            const meal = list.find((m) => m.id === editId);
            if (!meal) {
              showAlert("خطأ", "الوجبة غير موجودة");
              router.replace("/add-combo-meal");
              return;
            }
            fillForm(meal);
          } else {
            resetForm();
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
    }, [editId, fillForm, load, resetForm, router])
  );

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

  async function pickImage() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      showAlert("تنبيه", "اسمح بالوصول للصور");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.85,
      allowsEditing: true,
      aspect: [16, 9],
    });
    if (result.canceled || !result.assets[0]) return;
    const uri = result.assets[0].uri;
    const ext = uri.split(".").pop()?.toLowerCase();
    const type =
      ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
    setPickedImage({
      uri,
      name: `combo.${ext === "png" ? "png" : "jpg"}`,
      type,
    });
  }

  async function submitMeal() {
    if (!name.trim()) {
      showAlert("تنبيه", "أدخل اسم الوجبة");
      return;
    }
    const items = Object.entries(pickedItems).map(([productId, quantity]) => ({
      productId,
      quantity,
    }));
    if (items.length === 0) {
      showAlert("تنبيه", "اختر منتجاً واحداً على الأقل");
      return;
    }
    const mealPrice = Number(price);
    if (!Number.isFinite(mealPrice) || mealPrice <= 0) {
      showAlert("تنبيه", "أدخل سعر الوجبة");
      return;
    }

    setSaving(true);
    try {
      const token = await AsyncStorage.getItem("token");
      const form = new FormData();
      form.append("name", name.trim());
      form.append("description", description.trim());
      form.append("price", String(mealPrice));
      form.append("category", category.trim() || "وجبات");
      form.append("items", JSON.stringify(items));
      if (pickedImage) await appendImageToForm(form, pickedImage);

      const url = isEditing
        ? `${API_URL}/api/restaurant/combo-meals/${editId}`
        : `${API_URL}/api/restaurant/combo-meals`;
      const res = await fetch(url, {
        method: isEditing ? "PUT" : "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showAlert("خطأ", typeof data.error === "string" ? data.error : "فشل حفظ الوجبة");
        return;
      }
      showAlert("تم", data.message ?? "تم نشر الوجبة");
      if (isEditing) router.replace("/add-combo-meal");
      else {
        resetForm();
        await load();
      }
    } finally {
      setSaving(false);
    }
  }

  async function removeMeal(id: string) {
    setDeletingId(id);
    try {
      await api(`/api/restaurant/combo-meals/${id}`, { method: "DELETE" });
      if (editId === id) {
        resetForm();
        router.replace("/add-combo-meal");
      }
      await load();
    } catch (e) {
      showAlert("خطأ", e instanceof Error ? e.message : "تعذّر الحذف");
    } finally {
      setDeletingId(null);
    }
  }

  function openDiscount(meal: ComboMeal) {
    setDiscountMeal(meal);
    setDiscountedPrice(
      meal.promotion?.hasDailyOffer ? String(meal.promotion.discountedPrice) : ""
    );
    setDiscountReason(meal.promotion?.reason ?? "");
    setOfferSlot((meal.promotion?.offerSlot as OfferSlot) ?? "OTHER");
  }

  async function applyDiscount() {
    if (!discountMeal) return;
    const dp = Number(discountedPrice);
    if (!Number.isFinite(dp) || dp <= 0) {
      showAlert("تنبيه", "أدخل سعراً بعد الخصم");
      return;
    }
    if (dp >= discountMeal.price) {
      showAlert("تنبيه", "سعر العرض يجب أن يكون أقل من سعر الوجبة");
      return;
    }
    if (!discountReason.trim()) {
      showAlert("تنبيه", "أدخل سبب العرض");
      return;
    }
    if (!offerSlot) {
      showAlert("تنبيه", "اختر قسم العروض اليومية");
      return;
    }

    setDiscountSaving(true);
    try {
      const data = await api<{ message: string }>(
        `/api/restaurant/combo-meals/${discountMeal.id}/discount`,
        {
          method: "POST",
          body: JSON.stringify({
            discountedPrice: dp,
            reason: discountReason.trim(),
            offerSlot,
            hourStart: offerSlot === "HOURLY" ? hourStart.trim() : undefined,
            hourEnd: offerSlot === "HOURLY" ? hourEnd.trim() : undefined,
          }),
        }
      );
      setDiscountMeal(null);
      await load();
      showAlert("تم", data.message);
    } catch (e) {
      showAlert("خطأ", e instanceof Error ? e.message : "فشل تطبيق الخصم");
    } finally {
      setDiscountSaving(false);
    }
  }

  async function removeDiscount(meal: ComboMeal) {
    try {
      const data = await api<{ message: string }>(
        `/api/restaurant/combo-meals/${meal.id}/discount`,
        { method: "DELETE" }
      );
      await load();
      showAlert("تم", data.message);
    } catch (e) {
      showAlert("خطأ", e instanceof Error ? e.message : "تعذّر إلغاء الخصم");
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

  const previewImg = pickedImage?.uri ?? resolveImageUrl(existingImageUrl);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.topBar}>
        <Pressable
          style={styles.backBtn}
          onPress={() => router.replace(isEditing ? "/add-combo-meal" : "/")}
        >
          <Text style={styles.backBtnText}>
            {isEditing ? "← الوجبات" : "← الرئيسية"}
          </Text>
        </Pressable>
        <Text style={styles.title}>{isEditing ? "تعديل وجبة" : "إدارة الوجبات"}</Text>
      </View>

      <Text style={styles.hint}>
        اختر منتجاتك الفردية وادمجها في وجبة واحدة. تظهر تلقائياً في أصناف المطعم و«وجبات
        تبدأ من». الخصم والعروض اليومية اختياري لاحقاً.
      </Text>

      {!isEditing && comboMeals.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>وجباتك</Text>
          {comboMeals.map((meal) => (
            <View key={meal.id} style={styles.mealCard}>
              <Text style={styles.mealName}>{meal.name}</Text>
              <Text style={styles.mealMeta}>
                {formatMoney(meal.displayPrice)} ر.س
                {meal.promotion?.hasDailyOffer
                  ? ` · عرض ${formatMoney(meal.promotion.discountedPrice)} ر.س`
                  : ""}
              </Text>
              <Text style={styles.mealItems} numberOfLines={2}>
                {meal.items.map((i) => `${i.productName}×${i.quantity}`).join(" · ")}
              </Text>
              <View style={styles.mealActions}>
                <Pressable
                  style={styles.editBtn}
                  onPress={() => router.push(`/add-combo-meal?id=${meal.id}`)}
                >
                  <Text style={styles.editBtnText}>تعديل</Text>
                </Pressable>
                <Pressable style={styles.discountBtn} onPress={() => openDiscount(meal)}>
                  <Text style={styles.discountBtnText}>
                    {meal.promotion?.hasDailyOffer ? "تعديل الخصم" : "إضافة خصم"}
                  </Text>
                </Pressable>
                {meal.promotion?.hasDailyOffer ? (
                  <Pressable style={styles.clearDiscountBtn} onPress={() => removeDiscount(meal)}>
                    <Text style={styles.clearDiscountText}>إلغاء الخصم</Text>
                  </Pressable>
                ) : null}
                <Pressable
                  style={styles.deleteBtn}
                  onPress={() => removeMeal(meal.id)}
                  disabled={deletingId === meal.id}
                >
                  {deletingId === meal.id ? (
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

      {discountMeal ? (
        <View style={styles.discountBox}>
          <Text style={styles.discountTitle}>خصم على «{discountMeal.name}»</Text>
          <Text style={styles.discountSub}>
            السعر الحالي {formatMoney(discountMeal.price)} ر.س — يتغيّر في كل الأقسام
          </Text>
          <TextInput
            style={styles.input}
        placeholderTextColor={inputPlaceholderColor}
            placeholder="السعر بعد الخصم"
            value={discountedPrice}
            onChangeText={setDiscountedPrice}
            keyboardType="decimal-pad"
            textAlign="right"
          />
          <TextInput
            style={styles.input}
        placeholderTextColor={inputPlaceholderColor}
            placeholder="سبب العرض"
            value={discountReason}
            onChangeText={setDiscountReason}
            textAlign="right"
          />
          <Text style={styles.sectionTitle}>قسم العروض اليومية</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.slotRow}>
            {OFFER_SLOTS.map((slot) => (
              <Pressable
                key={slot}
                style={[styles.slotChip, offerSlot === slot && styles.slotChipActive]}
                onPress={() => setOfferSlot(slot)}
              >
                <Text
                  style={[styles.slotChipText, offerSlot === slot && styles.slotChipTextActive]}
                >
                  {OFFER_SLOT_EMOJI[slot]} {OFFER_SLOT_LABELS[slot]}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
          {offerSlot === "HOURLY" ? (
            <View style={styles.hourRow}>
              <TextInput
                style={[styles.input, styles.hourInput]}
                placeholder="من 14:00"
                value={hourStart}
                onChangeText={setHourStart}
                textAlign="right"
              />
              <TextInput
                style={[styles.input, styles.hourInput]}
                placeholder="إلى 17:00"
                value={hourEnd}
                onChangeText={setHourEnd}
                textAlign="right"
              />
            </View>
          ) : null}
          <View style={styles.discountActions}>
            <Pressable style={styles.cancelBtn} onPress={() => setDiscountMeal(null)}>
              <Text style={styles.cancelBtnText}>إلغاء</Text>
            </Pressable>
            <Pressable
              style={[styles.saveDiscountBtn, discountSaving && styles.btnDisabled]}
              onPress={applyDiscount}
              disabled={discountSaving}
            >
              {discountSaving ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.saveDiscountText}>تطبيق الخصم</Text>
              )}
            </Pressable>
          </View>
        </View>
      ) : null}

      <Text style={styles.sectionTitle}>{isEditing ? "تعديل الوجبة" : "وجبة جديدة"}</Text>

      <Pressable style={styles.imagePick} onPress={pickImage}>
        {previewImg ? (
          <Image source={{ uri: previewImg }} style={styles.previewImage} />
        ) : (
          <Text style={styles.imagePickText}>+ صورة الوجبة (اختياري)</Text>
        )}
      </Pressable>

      <TextInput
        style={styles.input}
        placeholderTextColor={inputPlaceholderColor}
        placeholder="اسم الوجبة"
        value={name}
        onChangeText={setName}
        textAlign="right"
      />
      <TextInput
        style={styles.input}
        placeholderTextColor={inputPlaceholderColor}
        placeholder="وصف (اختياري)"
        value={description}
        onChangeText={setDescription}
        textAlign="right"
      />
      <TextInput
        style={styles.input}
        placeholderTextColor={inputPlaceholderColor}
        placeholder="الصنف (مثال: وجبات)"
        value={category}
        onChangeText={setCategory}
        textAlign="right"
      />
      <TextInput
        style={styles.input}
        placeholderTextColor={inputPlaceholderColor}
        placeholder="سعر الوجبة (ر.س)"
        value={price}
        onChangeText={setPrice}
        keyboardType="decimal-pad"
        textAlign="right"
      />
      {catalogTotal > 0 ? (
        <Text style={styles.sumHint}>
          مجموع المنتجات المختارة: {formatMoney(catalogTotal)} ر.س (للمرجع فقط)
        </Text>
      ) : null}

      <Text style={styles.sectionTitle}>مكوّنات الوجبة</Text>
      {products.length === 0 ? (
        <Text style={styles.hint}>أضف منتجات فردية أولاً من «إضافة منتج»</Text>
      ) : (
        products.map((p) => {
          const qty = pickedItems[p.id] ?? 0;
          const selected = qty > 0;
          return (
            <View key={p.id} style={[styles.productRow, selected && styles.productRowOn]}>
              <Pressable style={styles.productMain} onPress={() => toggleProduct(p.id)}>
                <Text style={styles.productName}>{p.name}</Text>
                <Text style={styles.productPrice}>{formatMoney(p.price)} ر.س · {p.category}</Text>
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

      <Pressable
        style={[styles.btn, saving && styles.btnDisabled]}
        onPress={submitMeal}
        disabled={saving}
      >
        {saving ? (
          <ActivityIndicator color="#FFF" />
        ) : (
          <Text style={styles.btnText}>{isEditing ? "حفظ التعديلات" : "نشر الوجبة"}</Text>
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
    marginBottom: 12,
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
  hint: {
    textAlign: "right",
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 16,
  },
  sectionTitle: {
    fontWeight: "800",
    fontSize: 16,
    textAlign: "right",
    marginBottom: 10,
    marginTop: 8,
    color: colors.text,
  },
  mealCard: {
    backgroundColor: colors.bgCard,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  mealName: { fontWeight: "800", textAlign: "right", fontSize: 16, color: colors.text },
  mealMeta: { textAlign: "right", color: colors.textMuted, marginTop: 4 },
  mealItems: { textAlign: "right", color: colors.textDim, fontSize: 12, marginTop: 6 },
  mealActions: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 8, marginTop: 10 },
  editBtn: {
    backgroundColor: colors.bgElevated,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  editBtnText: { color: colors.accent, fontWeight: "700" },
  discountBtn: {
    backgroundColor: "#2A1F18",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.accentOrange,
  },
  discountBtnText: { color: colors.accentOrange, fontWeight: "700" },
  clearDiscountBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  clearDiscountText: { color: colors.textMuted, fontWeight: "600" },
  deleteBtn: {
    backgroundColor: colors.danger,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  deleteBtnText: { color: "#FFF", fontWeight: "700" },
  discountBox: {
    backgroundColor: "#2A1F18",
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.accentOrange,
  },
  discountTitle: { fontWeight: "800", textAlign: "right", fontSize: 16, color: colors.text },
  discountSub: {
    textAlign: "right",
    color: colors.textMuted,
    marginTop: 4,
    marginBottom: 10,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 12,
    backgroundColor: colors.bgCard,
    fontSize: 16,
    marginBottom: 10,
    color: colors.text,
  },
  slotRow: { marginBottom: 10, maxHeight: 44 },
  slotChip: {
    marginLeft: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
  },
  slotChipActive: { backgroundColor: colors.accentOrange, borderColor: colors.accentOrange },
  slotChipText: { fontWeight: "600", color: colors.textMuted },
  slotChipTextActive: { color: "#FFF" },
  hourRow: { flexDirection: "row-reverse", gap: 8 },
  hourInput: { flex: 1 },
  discountActions: { flexDirection: "row-reverse", gap: 10, marginTop: 4 },
  cancelBtn: {
    flex: 1,
    padding: 12,
    borderRadius: 10,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  cancelBtnText: { fontWeight: "700", color: colors.textMuted },
  saveDiscountBtn: {
    flex: 1,
    padding: 12,
    borderRadius: 10,
    alignItems: "center",
    backgroundColor: colors.accentOrange,
    minHeight: 44,
    justifyContent: "center",
  },
  saveDiscountText: { color: "#FFF", fontWeight: "700" },
  imagePick: {
    height: 140,
    borderRadius: 12,
    backgroundColor: colors.bgElevated,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: "dashed",
  },
  previewImage: { width: "100%", height: "100%" },
  imagePickText: { color: colors.textMuted, fontWeight: "600" },
  sumHint: { textAlign: "right", color: colors.accent, marginBottom: 8 },
  productRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    backgroundColor: colors.bgCard,
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  productRowOn: { borderColor: colors.accentOrange, backgroundColor: "#2A1F18" },
  productMain: { flex: 1 },
  productName: { fontWeight: "700", textAlign: "right", color: colors.text },
  productPrice: { fontSize: 12, color: colors.textMuted, textAlign: "right", marginTop: 2 },
  qtyRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  qtyBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: colors.accentOrange,
    alignItems: "center",
    justifyContent: "center",
  },
  qtyBtnText: { color: "#FFF", fontSize: 18, fontWeight: "700" },
  qtyVal: { fontWeight: "800", minWidth: 20, textAlign: "center", color: colors.text },
  btn: {
    backgroundColor: colors.accentOrange,
    padding: 14,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 16,
    minHeight: 48,
    justifyContent: "center",
  },
  btnDisabled: { opacity: 0.7 },
  btnText: { color: "#FFF", fontWeight: "700", fontSize: 16 },
});
