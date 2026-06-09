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
import { api, getToken } from "../src/lib/api";
import { showAlert } from "../src/lib/alert";
import { formatMoney } from "../src/lib/formatMoney";
import { PromotionCompactRow } from "../src/components/PromotionCompactRow";
import type { Promotion } from "../src/types/promotion";
import {
  OFFER_SLOTS,
  OFFER_SLOT_EMOJI,
  OFFER_SLOT_LABELS,
  type OfferSlot,
} from "../src/types/offerSlot";
import { colors } from "../src/theme/colors";
import { inputPlaceholderColor } from "../src/theme/restaurantPanel";

type Product = {
  id: string;
  name: string;
  price: number;
  category: string;
};

export default function AddPromotionScreen() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [checking, setChecking] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [discountedPrice, setDiscountedPrice] = useState("");
  const [reason, setReason] = useState("");
  const [isStarterDeal, setIsStarterDeal] = useState(false);
  const [offerSlot, setOfferSlot] = useState<OfferSlot | null>(null);
  const [hourStart, setHourStart] = useState("14:00");
  const [hourEnd, setHourEnd] = useState("17:00");
  const [saving, setSaving] = useState(false);
  const [togglingStarterId, setTogglingStarterId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [me, promos] = await Promise.all([
      api<{ restaurant: { products: Product[] } }>("/api/restaurant/me"),
      api<{ promotions: Promotion[] }>("/api/restaurant/promotions"),
    ]);
    setProducts(me.restaurant?.products ?? []);
    setPromotions(promos.promotions);
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
            showAlert("حساب غير مناسب", "إضافة العروض تتطلب حساب مطعم.");
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

  const selectedProduct = products.find((p) => p.id === selectedProductId);

  async function submit() {
    if (!selectedProductId) {
      showAlert("تنبيه", "اختر منتجاً للعرض");
      return;
    }
    if (!discountedPrice.trim()) {
      showAlert("تنبيه", "أدخل السعر بعد الخصم");
      return;
    }
    if (!reason.trim()) {
      showAlert("تنبيه", "أدخل سبب العرض");
      return;
    }
    if (!offerSlot) {
      showAlert("تنبيه", "اختر القسم المناسب لعرضك من القائمة أدناه");
      return;
    }
    if (offerSlot === "HOURLY" && (!hourStart.trim() || !hourEnd.trim())) {
      showAlert("تنبيه", "حدّد وقت بداية ونهاية عرض الساعة");
      return;
    }

    const price = Number(discountedPrice);
    if (!Number.isFinite(price) || price <= 0) {
      showAlert("تنبيه", "سعر غير صالح");
      return;
    }
    if (selectedProduct && price >= selectedProduct.price) {
      showAlert("تنبيه", "سعر العرض يجب أن يكون أقل من السعر الأصلي");
      return;
    }

    setSaving(true);
    try {
      await api("/api/restaurant/promotions", {
        method: "POST",
        body: JSON.stringify({
          productId: selectedProductId,
          discountedPrice: price,
          reason: reason.trim(),
          isStarterDeal,
          offerSlot,
          hourStart: offerSlot === "HOURLY" ? hourStart.trim() : undefined,
          hourEnd: offerSlot === "HOURLY" ? hourEnd.trim() : undefined,
        }),
      });
      setDiscountedPrice("");
      setReason("");
      setSelectedProductId(null);
      setIsStarterDeal(false);
      setOfferSlot(null);
      await load();
      const slotLabel = OFFER_SLOT_LABELS[offerSlot];
      showAlert(
        "تم",
        isStarterDeal
          ? `تم النشر في «وجبات ابتداءً من» و«${slotLabel}»`
          : `تم النشر — سيظهر عند الضغط على «${slotLabel}» في العروض اليومية`
      );
    } catch (e) {
      showAlert("خطأ", e instanceof Error ? e.message : "فشل إضافة العرض");
    } finally {
      setSaving(false);
    }
  }

  async function toggleStarterDeal(p: Promotion) {
    setTogglingStarterId(p.id);
    try {
      await api(`/api/restaurant/promotions/${p.id}/starter`, {
        method: "PATCH",
        body: JSON.stringify({ isStarterDeal: !p.isStarterDeal }),
      });
      await load();
    } catch (e) {
      showAlert("خطأ", e instanceof Error ? e.message : "تعذّر التحديث");
    } finally {
      setTogglingStarterId(null);
    }
  }

  async function removePromotion(id: string) {
    setDeletingId(id);
    try {
      await api(`/api/restaurant/promotions/${id}`, { method: "DELETE" });
      await load();
    } catch (e) {
      showAlert("خطأ", e instanceof Error ? e.message : "تعذّر حذف العرض");
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
        <Pressable style={styles.backBtn} onPress={() => router.replace("/")}>
          <Text style={styles.backBtnText}>← الرئيسية</Text>
        </Pressable>
        <Text style={styles.title}>إضافة عرض / وجبة مميزة</Text>
      </View>

      {promotions.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>عروضك الحالية</Text>
          {promotions.map((p) => (
            <View key={p.id} style={styles.manageRow}>
              {p.offerSlot ? (
                <Text style={styles.slotTag}>
                  {OFFER_SLOT_LABELS[p.offerSlot]}
                  {p.offerSlot === "HOURLY" && p.hourStart && p.hourEnd
                    ? ` · ${p.hourStart}–${p.hourEnd}`
                    : ""}
                </Text>
              ) : null}
              <PromotionCompactRow promotion={p} />
              <View style={styles.manageActions}>
                <Pressable
                  style={[styles.starterBtn, p.isStarterDeal && styles.starterBtnActive]}
                  onPress={() => toggleStarterDeal(p)}
                  disabled={togglingStarterId === p.id}
                >
                  {togglingStarterId === p.id ? (
                    <ActivityIndicator color="#FFF" size="small" />
                  ) : (
                    <Text style={styles.starterBtnText}>
                      {p.isStarterDeal ? "✓ في قسم الوجبات" : "+ قسم الوجبات"}
                    </Text>
                  )}
                </Pressable>
                <Pressable
                  style={styles.deleteBtn}
                  onPress={() => removePromotion(p.id)}
                  disabled={deletingId === p.id}
                >
                  {deletingId === p.id ? (
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

      <Text style={styles.sectionTitle}>اختر المنتج</Text>
      {products.length === 0 ? (
        <Text style={styles.hint}>لا توجد منتجات — أضف منتجاً أولاً</Text>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.productRow}>
          {products.map((p) => {
            const active = selectedProductId === p.id;
            return (
              <Pressable
                key={p.id}
                style={[styles.productChip, active && styles.productChipActive]}
                onPress={() => setSelectedProductId(p.id)}
              >
                <Text style={[styles.productChipText, active && styles.productChipTextActive]}>
                  {p.name}
                </Text>
                <Text style={[styles.productChipPrice, active && styles.productChipTextActive]}>
                  {formatMoney(p.price)} ر.س
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      )}

      <TextInput
        style={styles.input}
        placeholderTextColor={inputPlaceholderColor}
        placeholder="السعر بعد الخصم (ر.س)"
        value={discountedPrice}
        onChangeText={setDiscountedPrice}
        keyboardType="decimal-pad"
        textAlign="right"
      />
      {selectedProduct && discountedPrice.trim() ? (
        <Text style={styles.previewHint}>
          التوفير التقريبي:{" "}
          {Math.max(
            0,
            Math.round((1 - Number(discountedPrice) / selectedProduct.price) * 100)
          )}
          %
        </Text>
      ) : null}

      <TextInput
        style={[styles.input, styles.reasonInput]}
        placeholder="سبب العرض — مثال: بمناسبة العيد"
        value={reason}
        onChangeText={setReason}
        textAlign="right"
        multiline
      />

      <Text style={styles.sectionTitle}>أين يظهر في العروض اليومية؟</Text>
      <Text style={styles.slotHint}>
        اختر القسم الأقرب لمنتجك. إن لم يناسب أي قسم، استخدم «عروض أخرى» 🏷️
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.slotScroll}
        nestedScrollEnabled
      >
        {OFFER_SLOTS.map((slot) => {
          const active = offerSlot === slot;
          return (
            <Pressable
              key={slot}
              style={[styles.slotChip, active && styles.slotChipActive]}
              onPress={() => setOfferSlot(slot)}
            >
              <Text style={[styles.slotChipText, active && styles.slotChipTextActive]}>
                {OFFER_SLOT_EMOJI[slot]} {OFFER_SLOT_LABELS[slot]}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {offerSlot === "HOURLY" ? (
        <View style={styles.hourBlock}>
          <Text style={styles.hourBlockTitle}>وقت عرض الساعة (توقيت الرياض)</Text>
          <View style={styles.hourField}>
            <Text style={styles.hourFieldLabel}>من</Text>
            <TextInput
              style={styles.input}
        placeholderTextColor={inputPlaceholderColor}
              placeholder="14:00"
              value={hourStart}
              onChangeText={setHourStart}
              keyboardType="numbers-and-punctuation"
              textAlign="right"
            />
          </View>
          <View style={styles.hourField}>
            <Text style={styles.hourFieldLabel}>إلى</Text>
            <TextInput
              style={styles.input}
        placeholderTextColor={inputPlaceholderColor}
              placeholder="17:00"
              value={hourEnd}
              onChangeText={setHourEnd}
              keyboardType="numbers-and-punctuation"
              textAlign="right"
            />
          </View>
        </View>
      ) : null}

      <Pressable
        style={styles.starterToggle}
        onPress={() => setIsStarterDeal((v) => !v)}
      >
        <View style={[styles.starterCheck, isStarterDeal && styles.starterCheckOn]}>
          {isStarterDeal ? <Text style={styles.starterCheckMark}>✓</Text> : null}
        </View>
        <Text style={styles.starterToggleText}>
          عرض في قسم «وجبات ابتداءً من» (الواجهة الرئيسية)
        </Text>
      </Pressable>

      <Pressable style={[styles.btn, saving && styles.btnDisabled]} onPress={submit} disabled={saving}>
        {saving ? (
          <ActivityIndicator color="#FFF" />
        ) : (
          <Text style={styles.btnText}>نشر العرض</Text>
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
    marginTop: 8,
    color: colors.text,
  },
  hint: { textAlign: "right", color: colors.textDim, marginBottom: 12 },
  productRow: { marginBottom: 12, maxHeight: 72 },
  productChip: {
    marginLeft: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    minWidth: 120,
  },
  productChipActive: { backgroundColor: colors.accentOrange, borderColor: colors.accentOrange },
  productChipText: { fontWeight: "700", textAlign: "right", color: colors.textMuted },
  productChipPrice: { fontSize: 12, textAlign: "right", color: colors.textDim, marginTop: 4 },
  productChipTextActive: { color: "#FFF" },
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
  reasonInput: { minHeight: 72, textAlignVertical: "top" },
  previewHint: { textAlign: "right", color: colors.accentOrange, fontWeight: "600", marginBottom: 8 },
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
  manageRow: { marginBottom: 12, paddingHorizontal: 0 },
  slotTag: {
    textAlign: "right",
    marginHorizontal: 16,
    marginBottom: 4,
    color: colors.accent,
    fontWeight: "700",
    fontSize: 12,
  },
  slotHint: {
    textAlign: "right",
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 10,
  },
  slotScroll: {
    flexDirection: "row-reverse",
    gap: 8,
    paddingBottom: 12,
    paddingHorizontal: 2,
  },
  slotChip: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    maxWidth: 160,
  },
  slotChipActive: { backgroundColor: colors.accentOrange, borderColor: colors.accentOrange },
  slotChipText: { fontWeight: "700", color: colors.textMuted, fontSize: 13 },
  slotChipTextActive: { color: "#FFF" },
  hourBlock: {
    marginBottom: 12,
    padding: 12,
    backgroundColor: colors.bgCard,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  hourBlockTitle: {
    textAlign: "right",
    fontWeight: "700",
    fontSize: 14,
    color: colors.text,
    marginBottom: 10,
  },
  hourField: { marginBottom: 8 },
  hourFieldLabel: {
    textAlign: "right",
    fontWeight: "800",
    fontSize: 15,
    color: colors.text,
    marginBottom: 6,
  },
  manageActions: {
    flexDirection: "row-reverse",
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 4,
  },
  starterBtn: {
    flex: 1,
    backgroundColor: "#2A1F18",
    padding: 10,
    borderRadius: 8,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  starterBtnActive: { backgroundColor: colors.bgElevated, borderColor: colors.accent },
  starterBtnText: { color: colors.text, fontWeight: "700", fontSize: 12 },
  deleteBtn: {
    flex: 1,
    backgroundColor: colors.danger,
    padding: 10,
    borderRadius: 8,
    alignItems: "center",
  },
  deleteBtnText: { color: "#FFF", fontWeight: "700" },
  starterToggle: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
    padding: 12,
    backgroundColor: colors.bgCard,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  starterCheck: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  starterCheckOn: { backgroundColor: colors.accentOrange, borderColor: colors.accentOrange },
  starterCheckMark: { color: "#FFF", fontWeight: "800", fontSize: 14 },
  starterToggleText: {
    flex: 1,
    textAlign: "right",
    fontWeight: "600",
    color: colors.textMuted,
    fontSize: 14,
  },
});
