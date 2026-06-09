import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { api } from "../../src/lib/api";
import { isLoggedIn } from "../../src/lib/session";
import { showAlert } from "../../src/lib/alert";
import { triggerAutoLocation, webAllowsGps } from "../../src/lib/customerLocation";
import { LogoutButton } from "../../src/components/LogoutButton";
import { MapNavButton } from "../../src/components/DeliveryMap";
import { LocationPicker } from "../../src/components/LocationPicker";
import { colors } from "../../src/theme/colors";
import { formatOrderInvoice } from "../../src/lib/orderInvoice";

type Me = {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  role: "CUSTOMER" | "RESTAURANT" | "CAPTAIN";
  restaurantId?: string;
  captainId?: string;
  restaurant?: {
    name: string;
    address: string;
    lat: number;
    lng: number;
  } | null;
};

type CustomerOrder = {
  id: string;
  invoiceNumber?: string | null;
  status: string;
  total: number;
  deliveryAddress: string;
  createdAt: string;
  captain?: { name: string; phone: string | null; vehicle: string | null } | null;
};

const roleLabels = {
  CUSTOMER: "عميل",
  RESTAURANT: "مطعم",
  CAPTAIN: "كابتن توصيل",
};

const STATUS_AR: Record<string, string> = {
  PAID: "تم الدفع",
  PREPARING: "قيد التحضير",
  READY_FOR_PICKUP: "جاهز للاستلام",
  CAPTAIN_ASSIGNED: "الكابتن في الطريق",
  PICKED_UP: "تم الاستلام",
  DELIVERING: "جاري التوصيل",
  DELIVERED: "تم التسليم",
};

const TRACKABLE = new Set([
  "PAID",
  "PREPARING",
  "READY_FOR_PICKUP",
  "CAPTAIN_ASSIGNED",
  "PICKED_UP",
  "DELIVERING",
]);

export default function AccountScreen() {
  const router = useRouter();
  const [user, setUser] = useState<Me | null>(null);
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [locating, setLocating] = useState(false);
  const [savingMap, setSavingMap] = useState(false);
  const [mapPos, setMapPos] = useState<{ lat: number; lng: number } | null>(null);

  const goHome = () => router.replace("/");

  const load = useCallback(async () => {
    setLoading(true);
    const loggedIn = await isLoggedIn();
    if (!loggedIn) {
      router.replace("/auth");
      return;
    }
    try {
      const res = await api<{ user: Me }>("/api/auth/me");
      setUser(res.user);
      if (res.user.role === "CUSTOMER") {
        const ordersRes = await api<{ orders: CustomerOrder[] }>("/api/orders/my");
        setOrders(
          ordersRes.orders
            .filter((o) => TRACKABLE.has(o.status) || o.status === "DELIVERED")
            .slice(0, 10)
        );
      } else {
        setOrders([]);
      }
    } catch {
      router.replace("/auth");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  useEffect(() => {
    if (user?.restaurant) {
      setMapPos({ lat: user.restaurant.lat, lng: user.restaurant.lng });
    }
  }, [user?.restaurant?.lat, user?.restaurant?.lng]);

  const mapDirty =
    user?.restaurant &&
    mapPos &&
    (Math.abs(mapPos.lat - user.restaurant.lat) > 0.00001 ||
      Math.abs(mapPos.lng - user.restaurant.lng) > 0.00001);

  const saveMapPosition = useCallback(async () => {
    if (!user?.restaurant || !mapPos || savingMap) return;
    setSavingMap(true);
    try {
      await api("/api/auth/me", {
        method: "PATCH",
        body: JSON.stringify({
          restaurant: {
            name: user.restaurant.name,
            address: user.restaurant.address,
            lat: mapPos.lat,
            lng: mapPos.lng,
          },
        }),
      });
      await load();
      showAlert("تم", "تم حفظ موقع المطعم على الخريطة");
    } catch (e) {
      showAlert("خطأ", e instanceof Error ? e.message : "تعذّر حفظ الموقع");
    } finally {
      setSavingMap(false);
    }
  }, [user, mapPos, savingMap, load]);

  const onAutoRestaurantLocation = useCallback(() => {
    if (!user?.restaurant || locating) return;
    const restaurant = user.restaurant;
    setLocating(true);
    triggerAutoLocation((result) => {
      if (!result.ok) {
        setLocating(false);
        showAlert("الموقع", result.message);
        return;
      }
      setMapPos({ lat: result.lat, lng: result.lng });
      void (async () => {
        try {
          await api("/api/auth/me", {
            method: "PATCH",
            body: JSON.stringify({
              restaurant: {
                name: restaurant.name,
                address: restaurant.address,
                lat: result.lat,
                lng: result.lng,
              },
            }),
          });
          await load();
          showAlert(
            "تم",
            result.source === "ip"
              ? "تم تقدير موقع المطعم (تقريبي) — يمكنك تصحيحه من تعديل بياناتي"
              : "تم تحديث موقع المطعم"
          );
        } catch (e) {
          showAlert("خطأ", e instanceof Error ? e.message : "تعذّر حفظ الموقع");
        } finally {
          setLocating(false);
        }
      })();
    });
  }, [user, locating, load]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#E85D04" size="large" />
      </View>
    );
  }

  if (!user) return null;

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <View style={styles.topBar}>
        <Pressable onPress={goHome} hitSlop={8}>
          <Text style={styles.homeLink}>الرئيسية</Text>
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.name}>{user.name}</Text>
        <Text style={styles.email}>{user.email}</Text>
        {user.phone ? <Text style={styles.phone}>📱 {user.phone}</Text> : null}
        <Text style={styles.role}>{roleLabels[user.role]}</Text>
      </View>

      {user.role === "CAPTAIN" ? (
        <>
          <Pressable style={styles.captainMainBtn} onPress={() => router.push("/captain")}>
            <Text style={styles.captainMainBtnText}>🛵 لوحة الكابتن — الطلبات والإحصائيات</Text>
          </Pressable>
          <Pressable style={styles.linkBtn} onPress={() => router.push("/account/edit")}>
            <Text style={styles.linkText}>✏️ تعديل بياناتي</Text>
          </Pressable>
        </>
      ) : user.role === "RESTAURANT" ? (
        <>
          <Pressable style={styles.restaurantMainBtn} onPress={() => router.push("/restaurant")}>
            <Text style={styles.restaurantMainBtnText}>🍽️ لوحة المطعم — الطلبات والإحصائيات</Text>
          </Pressable>
          <Pressable style={styles.linkBtn} onPress={() => router.push("/account/edit")}>
            <Text style={styles.linkText}>✏️ تعديل بياناتي</Text>
          </Pressable>
        </>
      ) : (
        <Pressable style={styles.linkBtn} onPress={() => router.push("/account/edit")}>
          <Text style={styles.linkText}>✏️ تعديل بياناتي</Text>
        </Pressable>
      )}

      {user.role === "CUSTOMER" && (
        <>
          <Pressable style={styles.cartBtn} onPress={() => router.push("/cart")}>
            <Text style={styles.cartBtnText}>🛒 السلة والدفع</Text>
          </Pressable>

          {orders.length > 0 && (
            <>
              <Text style={styles.ordersTitle}>طلباتي — تتبع الكابتن</Text>
              {orders.map((o) => (
                <Pressable
                  key={o.id}
                  style={styles.orderCard}
                  onPress={() => router.push(`/track/${o.id}`)}
                >
                  {formatOrderInvoice(o.invoiceNumber) ? (
                    <Text style={styles.orderInvoice}>{formatOrderInvoice(o.invoiceNumber)}</Text>
                  ) : null}
                  <Text style={styles.orderStatus}>{STATUS_AR[o.status] ?? o.status}</Text>
                  <Text style={styles.orderAddr}>{o.deliveryAddress}</Text>
                  {o.captain && (
                    <Text style={styles.orderCaptain}>
                      🛵 {o.captain.name}
                      {o.captain.phone ? ` — 📱 ${o.captain.phone}` : ""}
                    </Text>
                  )}
                  <Text style={styles.orderTotal}>
                    {o.total} ر.س — تتبع على الخريطة ←
                  </Text>
                </Pressable>
              ))}
            </>
          )}
        </>
      )}

      {user.role === "RESTAURANT" && user.restaurant ? (
        <View style={styles.mapCard}>
          <Text style={styles.mapTitle}>📍 موقع المطعم</Text>
          <Text style={styles.mapRestaurantName}>{user.restaurant.name}</Text>
          <Text style={styles.mapAddress}>{user.restaurant.address}</Text>
          <Pressable
            style={[styles.autoLocBtn, locating && styles.autoLocBtnDisabled]}
            onPress={onAutoRestaurantLocation}
            disabled={locating}
          >
            {locating ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.autoLocBtnText}>
                {webAllowsGps()
                  ? "📍 تحديد موقعي تلقائياً"
                  : "📡 تحديد موقعي تلقائياً (من الشبكة)"}
              </Text>
            )}
          </Pressable>
          {mapPos ? (
            <LocationPicker
              lat={mapPos.lat}
              lng={mapPos.lng}
              onChange={({ lat, lng }) => setMapPos({ lat, lng })}
              height={280}
              hideAutoButton
              label="🗺️ موقع المطعم — اسحب العلامة أو اضغط على الخريطة"
            />
          ) : null}
          {mapDirty ? (
            <Pressable
              style={[styles.saveMapBtn, savingMap && styles.autoLocBtnDisabled]}
              onPress={() => void saveMapPosition()}
              disabled={savingMap}
            >
              {savingMap ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.saveMapBtnText}>💾 حفظ الموقع بعد السحب</Text>
              )}
            </Pressable>
          ) : null}
          <MapNavButton
            lat={mapPos?.lat ?? user.restaurant.lat}
            lng={mapPos?.lng ?? user.restaurant.lng}
            label="🧭 فتح موقع المطعم في الخرائط"
          />
        </View>
      ) : null}

      <LogoutButton style={styles.logout} redirectTo="/auth" />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 20, paddingTop: 48, paddingBottom: 40 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg },
  topBar: {
    flexDirection: "row",
    justifyContent: "center",
    marginBottom: 16,
  },
  homeLink: {
    color: colors.accentOrange,
    fontWeight: "700",
    fontSize: 16,
    textAlign: "center",
  },
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: 12,
    padding: 20,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  name: { fontSize: 20, fontWeight: "700", textAlign: "right", color: colors.text },
  email: { color: colors.textMuted, textAlign: "right", marginTop: 6 },
  phone: { color: colors.textMuted, textAlign: "right", marginTop: 6, fontWeight: "600" },
  role: {
    color: colors.accent,
    fontWeight: "600",
    textAlign: "right",
    marginTop: 8,
  },
  linkBtn: {
    backgroundColor: colors.bgCard,
    padding: 14,
    borderRadius: 10,
    marginBottom: 10,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  linkText: { color: colors.accentOrange, fontWeight: "600" },
  captainMainBtn: {
    backgroundColor: "#0077B6",
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    alignItems: "center",
  },
  captainMainBtnText: { color: "#FFF", fontWeight: "700", fontSize: 16 },
  mapCard: {
    backgroundColor: colors.bgCard,
    borderRadius: 12,
    padding: 14,
    marginTop: 20,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  mapTitle: {
    fontWeight: "700",
    fontSize: 16,
    textAlign: "right",
    color: colors.text,
    marginBottom: 6,
  },
  mapRestaurantName: {
    fontWeight: "600",
    textAlign: "right",
    color: "#2D6A4F",
    marginBottom: 4,
  },
  mapAddress: {
    textAlign: "right",
    color: colors.textMuted,
    fontSize: 13,
    marginBottom: 10,
    lineHeight: 20,
  },
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
  saveMapBtn: {
    backgroundColor: "#E85D04",
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
    marginBottom: 8,
    minHeight: 44,
    justifyContent: "center",
  },
  saveMapBtnText: { color: "#FFF", fontWeight: "700" },
  restaurantMainBtn: {
    backgroundColor: "#E85D04",
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    alignItems: "center",
  },
  restaurantMainBtnText: { color: "#FFF", fontWeight: "700", fontSize: 16 },
  cartBtn: {
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.accentOrange,
    padding: 14,
    borderRadius: 10,
    marginBottom: 12,
    alignItems: "center",
  },
  cartBtnText: { color: "#E85D04", fontWeight: "700" },
  ordersTitle: {
    fontWeight: "700",
    textAlign: "right",
    marginTop: 4,
    marginBottom: 10,
    fontSize: 16,
  },
  orderCard: {
    backgroundColor: "#FFF",
    padding: 14,
    borderRadius: 10,
    marginBottom: 8,
    borderRightWidth: 3,
    borderRightColor: "#0077B6",
  },
  orderInvoice: {
    fontWeight: "700",
    fontSize: 15,
    color: colors.accentOrange,
    textAlign: "right",
    marginBottom: 4,
  },
  orderStatus: { fontWeight: "700", textAlign: "right", color: "#0077B6" },
  orderAddr: { textAlign: "right", color: "#666", marginTop: 4, fontSize: 13 },
  orderCaptain: { textAlign: "right", color: "#0077B6", marginTop: 4, fontWeight: "600", fontSize: 13 },
  orderTotal: { textAlign: "right", color: "#E85D04", marginTop: 6, fontWeight: "600" },
  logout: { alignSelf: "center", marginTop: 24, paddingHorizontal: 32, paddingVertical: 12 },
});
