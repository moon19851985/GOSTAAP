import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api, getToken } from "../src/lib/api";
import { useCart } from "../src/store/cart";
import { showAlert } from "../src/lib/alert";
import { formatMoney } from "../src/lib/formatMoney";
import {
  requestCustomerLocation,
  type CustomerLocation,
} from "../src/lib/customerLocation";
import { CustomerLocationSheet } from "../src/components/CustomerLocationSheet";

type PayMethod = "VISA" | "MADA" | "COD";

/** رسوم توصيل أعلى من هذا غالباً بسبب موقع خاطئ (مثل الرياض الافتراضي) */
const SUSPICIOUS_DELIVERY_FEE = 40;
const LEGACY_CART_COORDS_KEY = "cart_delivery_coords";

export default function CartScreen() {
  const router = useRouter();
  const { items, updateQty, remove } = useCart();
  const [estimate, setEstimate] = useState<{
    subtotal: number;
    deliveryFee: number;
    total: number;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [deliveryCity, setDeliveryCity] = useState<string | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationSheetOpen, setLocationSheetOpen] = useState(false);
  const [payMethod, setPayMethod] = useState<PayMethod>("COD");
  const [canPay, setCanPay] = useState(false);
  const [checking, setChecking] = useState(true);
  const clearedLegacyCoords = useRef(false);

  const cartLineSubtotal = useMemo(
    () => items.reduce((sum, i) => sum + i.price * i.quantity, 0),
    [items]
  );

  const resolveCoords = useCallback(async (forceRefresh = false) => {
    setLocating(true);
    setLocationError(null);
    try {
      const result = await requestCustomerLocation({ force: forceRefresh });
      if (result.location) {
        setCoords({ lat: result.location.lat, lng: result.location.lng });
        setDeliveryCity(result.location.city);
        return true;
      }
      setCoords(null);
      setDeliveryCity(null);
      setLocationError(
        result.error ?? "تعذر تحديد موقع التوصيل — اسمح بالموقع ثم اضغط تحديث"
      );
      return false;
    } finally {
      setLocating(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        setChecking(true);
        const token = await getToken();
        if (!token) {
          showAlert("تسجيل مطلوب", "سجّل دخول كـ عميل لإتمام الدفع");
          router.replace("/auth?intent=customer");
          return;
        }
        try {
          const res = await api<{ user: { role: string } }>("/api/auth/me");
          if (res.user.role !== "CUSTOMER") {
            showAlert(
              "حساب غير مناسب",
              "الدفع متاح للعملاء فقط.\n\nسجّل خروج ثم ادخل بحساب عميل."
            );
            router.replace("/account");
            return;
          }
          setCanPay(true);
          if (!clearedLegacyCoords.current) {
            clearedLegacyCoords.current = true;
            await AsyncStorage.removeItem(LEGACY_CART_COORDS_KEY);
          }
          await resolveCoords();
        } catch {
          router.replace("/auth?intent=customer");
        } finally {
          setChecking(false);
        }
      })();
    }, [router, resolveCoords])
  );

  useEffect(() => {
    if (!canPay || !coords || items.length === 0) {
      setEstimate(null);
      return;
    }
    let cancelled = false;
    api<{ subtotal: number; deliveryFee: number; total: number }>("/api/orders/estimate", {
      method: "POST",
      body: JSON.stringify({
        items: items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
        deliveryLat: coords.lat,
        deliveryLng: coords.lng,
        deliveryAddress: deliveryCity ? `توصيل — ${deliveryCity}` : "موقع العميل",
      }),
    })
      .then((data) => {
        if (!cancelled) setEstimate(data);
      })
      .catch(() => {
        if (!cancelled) setEstimate(null);
      });
    return () => {
      cancelled = true;
    };
  }, [items, coords, canPay, deliveryCity]);

  const priceNote =
    estimate &&
    Math.abs(estimate.subtotal - cartLineSubtotal) > 0.01
      ? "المجموع يشمل أسعار العروض النشطة إن وُجدت"
      : null;

  const suspiciousFee =
    estimate != null && estimate.deliveryFee >= SUSPICIOUS_DELIVERY_FEE;

  const byRestaurant = items.reduce(
    (acc, item) => {
      if (!acc[item.restaurantName]) acc[item.restaurantName] = [];
      acc[item.restaurantName].push(item);
      return acc;
    },
    {} as Record<string, typeof items>
  );

  function applyDeliveryLocation(loc: CustomerLocation) {
    setCoords({ lat: loc.lat, lng: loc.lng });
    setDeliveryCity(loc.city);
    setLocationError(null);
  }

  async function checkout() {
    if (!coords || items.length === 0 || !canPay) {
      showAlert("الموقع مطلوب", "حدّد موقع التوصيل أولاً ثم أعد المحاولة.");
      return;
    }
    if (suspiciousFee) {
      showAlert(
        "تحقق من الموقع",
        "رسوم التوصيل مرتفعة — قد يكون الموقع غير دقيق. اضغط «تحديث موقع التوصيل» ثم راجع المبلغ."
      );
      return;
    }
    setLoading(true);
    try {
      const orderRes = await api<{ order: { id: string; total: number } }>(
        "/api/orders/checkout",
        {
          method: "POST",
          body: JSON.stringify({
            items: items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
            deliveryLat: coords.lat,
            deliveryLng: coords.lng,
            deliveryAddress: deliveryCity ? `توصيل — ${deliveryCity}` : "موقع العميل",
          }),
        }
      );

      router.push({
        pathname: "/payment",
        params: {
          orderId: orderRes.order.id,
          total: String(orderRes.order.total),
          method: payMethod,
        },
      });
    } catch (e) {
      showAlert("خطأ", e instanceof Error ? e.message : "فشل الدفع");
    } finally {
      setLoading(false);
    }
  }

  if (checking) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#E85D04" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
      <Text style={styles.title}>السلة — مطاعم متعددة</Text>

      {items.length === 0 ? (
        <Text style={styles.empty}>السلة فارغة</Text>
      ) : (
        Object.entries(byRestaurant).map(([restaurant, list]) => (
          <View key={restaurant} style={styles.group}>
            <Text style={styles.groupTitle}>{restaurant}</Text>
            {list.map((item) => (
              <View key={item.productId} style={styles.row}>
                <Pressable
                  style={styles.removeBtn}
                  onPress={() => remove(item.productId)}
                  accessibilityLabel={`حذف ${item.name}`}
                  hitSlop={8}
                >
                  <Ionicons name="close" size={20} color="#999" />
                </Pressable>
                <Text style={styles.itemName}>
                  {item.name} × {item.quantity}
                </Text>
                <View style={styles.qtyRow}>
                  <Pressable onPress={() => updateQty(item.productId, item.quantity - 1)}>
                    <Text style={styles.qtyBtn}>−</Text>
                  </Pressable>
                  <Pressable onPress={() => updateQty(item.productId, item.quantity + 1)}>
                    <Text style={styles.qtyBtn}>+</Text>
                  </Pressable>
                </View>
                <Text style={styles.linePrice}>
                  {formatMoney(item.price * item.quantity)} ر.س
                </Text>
              </View>
            ))}
          </View>
        ))
      )}

      {estimate && (
        <View style={styles.summary}>
          <Text style={styles.summaryLine}>
            المجموع: {formatMoney(estimate.subtotal)} ر.س
          </Text>
          <Text style={styles.summaryLine}>
            التوصيل: {formatMoney(estimate.deliveryFee)} ر.س
            {deliveryCity ? ` (${deliveryCity})` : ""}
          </Text>
          <Text style={styles.total}>الإجمالي: {formatMoney(estimate.total)} ر.س</Text>
          {priceNote ? <Text style={styles.feeNote}>{priceNote}</Text> : null}
          {suspiciousFee ? (
            <Text style={styles.warnNote}>
              رسوم التوصيل مرتفعة — حدّث موقعك أدناه وتأكد من السماح بالموقع في المتصفح
            </Text>
          ) : (
            <Text style={styles.feeNote}>
              رسوم التوصيل من موقعك الحالي — تُثبت عند الدفع ولا تتغير بعدها
            </Text>
          )}
        </View>
      )}

      {!coords && locationError ? (
        <Text style={styles.warnNote}>{locationError}</Text>
      ) : null}

      <Pressable
        style={[styles.locBtn, locating && styles.disabled]}
        onPress={() => setLocationSheetOpen(true)}
        disabled={locating}
      >
        {locating ? (
          <ActivityIndicator color="#0077B6" />
        ) : (
          <Text style={styles.locBtnText}>
            {deliveryCity
              ? `📍 تحديث موقع التوصيل (${deliveryCity})`
              : "📍 تحديد موقع التوصيل لحساب الأجرة"}
          </Text>
        )}
      </Pressable>

      <Text style={styles.payTitle}>طريقة الدفع</Text>
      <View style={styles.payMethods}>
        <Pressable
          style={[styles.methodBtn, payMethod === "COD" && styles.methodActive]}
          onPress={() => setPayMethod("COD")}
        >
          <Text style={[styles.methodText, payMethod === "COD" && styles.methodTextActive]}>
            عند الاستلام
          </Text>
        </Pressable>
        <Pressable
          style={[styles.methodBtn, payMethod === "MADA" && styles.methodActive]}
          onPress={() => setPayMethod("MADA")}
        >
          <Text style={[styles.methodText, payMethod === "MADA" && styles.methodTextActive]}>
            مدى mada
          </Text>
        </Pressable>
        <Pressable
          style={[styles.methodBtn, payMethod === "VISA" && styles.methodActive]}
          onPress={() => setPayMethod("VISA")}
        >
          <Text style={[styles.methodText, payMethod === "VISA" && styles.methodTextActive]}>
            Visa فيزا
          </Text>
        </Pressable>
      </View>

      <Pressable
        style={[
          styles.payBtn,
          (loading || items.length === 0 || !canPay || !coords || suspiciousFee) &&
            styles.disabled,
        ]}
        onPress={checkout}
        disabled={loading || items.length === 0 || !canPay || !coords || suspiciousFee}
      >
        {loading ? (
          <ActivityIndicator color="#FFF" />
        ) : (
          <Text style={styles.payText}>
            {payMethod === "COD" ? "تأكيد الطلب" : "متابعة الدفع"}{" "}
            {estimate ? `${formatMoney(estimate.total)} ر.س` : ""}
            {payMethod === "COD"
              ? " — عند الاستلام"
              : ` — ${payMethod === "MADA" ? "مدى" : "Visa"}`}
          </Text>
        )}
      </Pressable>

      <Text style={styles.note}>
        {payMethod === "COD"
          ? "بعد التأكيد يصل الطلب للمطعم — ادفع نقداً عند الاستلام"
          : "بعد الدفع يُرسل إيصال إلى بريدك ويصل الطلب للمطعم"}
      </Text>

      <CustomerLocationSheet
        visible={locationSheetOpen}
        onClose={() => setLocationSheetOpen(false)}
        onSaved={(loc) => {
          applyDeliveryLocation(loc);
        }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 16 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 22, fontWeight: "700", textAlign: "right", marginBottom: 16 },
  empty: { textAlign: "center", color: "#888", marginBottom: 16 },
  group: {
    backgroundColor: "#FFF",
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  groupTitle: { fontWeight: "700", textAlign: "right", marginBottom: 8, color: "#E85D04" },
  row: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
    gap: 6,
  },
  removeBtn: { padding: 4 },
  itemName: { flex: 1, textAlign: "right" },
  qtyRow: { flexDirection: "row", gap: 12 },
  qtyBtn: { fontSize: 20, fontWeight: "700", color: "#E85D04" },
  linePrice: { fontWeight: "600", minWidth: 72, textAlign: "left" },
  summary: { backgroundColor: "#FFF", padding: 16, borderRadius: 12, marginVertical: 12 },
  summaryLine: { textAlign: "right", marginBottom: 4 },
  total: { fontWeight: "700", fontSize: 18, marginTop: 8, textAlign: "right" },
  feeNote: { textAlign: "right", color: "#888", fontSize: 12, marginTop: 8, lineHeight: 18 },
  warnNote: {
    textAlign: "right",
    color: "#B45309",
    fontSize: 13,
    marginTop: 8,
    lineHeight: 20,
    fontWeight: "600",
  },
  locBtn: {
    backgroundColor: "#E8F4F8",
    padding: 12,
    borderRadius: 10,
    alignItems: "center",
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#0077B6",
    minHeight: 44,
    justifyContent: "center",
  },
  locBtnText: { color: "#0077B6", fontWeight: "600", textAlign: "center" },
  payTitle: { fontWeight: "700", textAlign: "right", marginBottom: 10, fontSize: 16 },
  payMethods: { flexDirection: "row-reverse", gap: 10, marginBottom: 16 },
  methodBtn: {
    flex: 1,
    padding: 14,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#DDD",
    backgroundColor: "#FFF",
    alignItems: "center",
  },
  methodActive: { borderColor: "#E85D04", backgroundColor: "#FFF3EB" },
  methodText: { fontWeight: "700", color: "#666" },
  methodTextActive: { color: "#E85D04" },
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
  note: { textAlign: "center", color: "#888", marginTop: 12, fontSize: 13 },
});
