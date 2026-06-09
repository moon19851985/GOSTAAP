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
import type { Promotion } from "../src/types/promotion";
import { colors } from "../src/theme/colors";
import { restaurantPanel as rp, inputPlaceholderColor } from "../src/theme/restaurantPanel";

type Product = {
  id: string;
  name: string;
  price: number;
  category: string;
};

export default function AddDeliveryOfferScreen() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [checking, setChecking] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [deliveryFee, setDeliveryFee] = useState("0");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const res = await api<{ restaurant: { products: Product[] } }>("/api/restaurant/me");
    setProducts(res.restaurant?.products ?? []);
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

  async function submit() {
    if (!selectedProductId) {
      showAlert("تنبيه", "اختر منتجاً");
      return;
    }
    const fee = Number(deliveryFee);
    if (!Number.isFinite(fee) || fee < 0) {
      showAlert("تنبيه", "أدخل سعر توصيل صالح (0 = مجاني)");
      return;
    }

    setSaving(true);
    try {
      const data = await api<{ promotion: Promotion; message: string }>(
        "/api/restaurant/delivery-offers",
        {
          method: "POST",
          body: JSON.stringify({
            productId: selectedProductId,
            offerDeliveryFee: fee,
          }),
        }
      );
      setSelectedProductId(null);
      setDeliveryFee("0");
      showAlert("تم", data.message ?? "تم نشر عرض التوصيل في العروض اليومية");
    } catch (e) {
      showAlert("خطأ", e instanceof Error ? e.message : "فشل نشر العرض");
    } finally {
      setSaving(false);
    }
  }

  if (checking) {
    return (
      <View style={rp.center}>
        <ActivityIndicator color={colors.accentOrange} size="large" />
      </View>
    );
  }

  if (!ready) return null;

  const selected = products.find((p) => p.id === selectedProductId);

  return (
    <ScrollView style={rp.container} contentContainerStyle={rp.content}>
      <View style={rp.topBar}>
        <Pressable style={rp.backBtn} onPress={() => router.replace("/")}>
          <Text style={rp.backBtnText}>← الرئيسية</Text>
        </Pressable>
        <Text style={rp.title}>عرض توصيل</Text>
      </View>

      <Text style={rp.hint}>
        حدّد منتجاً وسعر توصيل العرض (0 = مجاني). يُضاف تلقائياً إلى العروض اليومية حسب نوع
        المنتج (مشويات، سريعة، …) ويظهر للعميل سعر التوصيل فقط عند وجود عرض.
      </Text>

      <Text style={rp.sectionTitle}>اختر المنتج</Text>
      {products.length === 0 ? (
        <Text style={styles.empty}>لا توجد منتجات — أضف منتجاً أولاً</Text>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
          {products.map((p) => {
            const active = selectedProductId === p.id;
            return (
              <Pressable
                key={p.id}
                style={[rp.chip, active && rp.chipActive]}
                onPress={() => setSelectedProductId(p.id)}
              >
                <Text style={[rp.chipText, active && rp.chipTextActive]}>
                  {p.name}
                </Text>
                <Text style={[rp.chipPrice, active && rp.chipPriceActive]}>
                  {formatMoney(p.price)} ر.س · {p.category}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      )}

      <Text style={rp.sectionTitle}>سعر توصيل العرض (ر.س)</Text>
      <TextInput
        style={rp.input}
        placeholder="0 = توصيل مجاني"
        placeholderTextColor={inputPlaceholderColor}
        value={deliveryFee}
        onChangeText={setDeliveryFee}
        keyboardType="decimal-pad"
        textAlign="right"
      />
      <View style={styles.quickRow}>
        <Pressable style={rp.quickChip} onPress={() => setDeliveryFee("0")}>
          <Text style={rp.quickChipText}>مجاني</Text>
        </Pressable>
        <Pressable style={rp.quickChip} onPress={() => setDeliveryFee("1")}>
          <Text style={rp.quickChipText}>1 ر.س</Text>
        </Pressable>
        <Pressable style={rp.quickChip} onPress={() => setDeliveryFee("5")}>
          <Text style={rp.quickChipText}>5 ر.س</Text>
        </Pressable>
      </View>

      {selected ? (
        <Text style={rp.previewHint}>
          سيظهر «{selected.name}» في قسم العروض اليومية المناسب مع{" "}
          {Number(deliveryFee) <= 0 ? "توصيل مجاني" : `توصيل ${formatMoney(Number(deliveryFee))} ر.س`}
        </Text>
      ) : null}

      <Pressable
        style={[rp.btn, saving && rp.btnDisabled]}
        onPress={submit}
        disabled={saving}
      >
        {saving ? (
          <ActivityIndicator color="#FFF" />
        ) : (
          <Text style={rp.btnText}>نشر في العروض اليومية</Text>
        )}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  empty: { textAlign: "right", color: colors.textDim, marginBottom: 12 },
  chipScroll: { marginBottom: 12, maxHeight: 88 },
  quickRow: { flexDirection: "row-reverse", gap: 8, marginBottom: 12 },
});
