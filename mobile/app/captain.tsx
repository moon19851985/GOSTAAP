import { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  RefreshControl,
  Alert,
  Platform,
  Linking,
} from "react-native";
import * as Location from "expo-location";
import { useRouter, useFocusEffect } from "expo-router";
import { io, type Socket } from "socket.io-client";
import { api, API_URL, getToken } from "../src/lib/api";
import { LogoutButton } from "../src/components/LogoutButton";
import { DeliveryMap, MapNavButton } from "../src/components/DeliveryMap";
import { CaptainCarTopIcon } from "../src/components/CaptainCarTopIcon";
import { showAlert } from "../src/lib/alert";
import { formatMoney } from "../src/lib/formatMoney";
import { StatsPeriodFilter } from "../src/components/StatsPeriodFilter";
import {
  defaultDay,
  defaultMonth,
  defaultYear,
  statsQueryString,
  type StatsPeriod,
} from "../src/lib/statsPeriod";
import { formatOrderInvoice } from "../src/lib/orderInvoice";
import { CustomerLocationSheet } from "../src/components/CustomerLocationSheet";
import {
  detectIpLocation,
  requestWebGpsOnUserGesture,
  startCaptainLocationWatch,
  webAllowsGps,
  WEB_GPS_HTTP_MESSAGE,
  type CustomerLocation,
} from "../src/lib/customerLocation";
import {
  notifyCaptainNewOrder,
  registerCaptainPushToken,
  unregisterCaptainPushToken,
  type DispatchOfferPayload,
} from "../src/lib/captainNotifications";

type OrderItem = {
  productName?: string;
  restaurantName?: string;
  product?: { name: string; restaurant: { name: string } };
};

type Order = {
  id: string;
  invoiceNumber?: string | null;
  status?: string;
  paymentMethod?: string | null;
  total: number;
  deliveryAddress: string;
  deliveryLat?: number;
  deliveryLng?: number;
  deliveryFee: number;
  createdAt?: string;
  updatedAt?: string;
  pickedUpAt?: string | null;
  deliveredAt?: string | null;
  items: OrderItem[];
  customer?: { name: string; phone: string };
  restaurants?: { id: string; name: string; lat: number; lng: number }[];
};

function PaymentMethodBadge({ method, total }: { method?: string | null; total: number }) {
  if (method !== "COD") return null;
  return (
    <Text style={styles.codBadge}>
      💵 دفع عند الاستلام — يجمع من العميل {formatMoney(total)} ر.س
    </Text>
  );
}

function orderStatusLabel(order: Pick<Order, "status" | "paymentMethod">) {
  if (order.status === "PAID") {
    return order.paymentMethod === "COD"
      ? "طلب جديد — الدفع عند الاستلام"
      : "طلب جديد — تم الدفع";
  }
  return order.status ? (STATUS_LABEL[order.status] ?? order.status) : "طلب جديد";
}

const STATUS_LABEL: Record<string, string> = {
  PREPARING: "المطعم يحضّر الطلب",
  READY_FOR_PICKUP: "جاهز للاستلام من المطعم",
  CAPTAIN_ASSIGNED: "تم قبولك — توجه للمطعم",
  PICKED_UP: "تم الاستلام من المطعم — في الطريق للعميل",
  DELIVERING: "جاري التوصيل",
};

const NEXT_STATUS: Record<string, { status: string; label: string }> = {
  PICKED_UP: { status: "DELIVERING", label: "خرج لتوصيل" },
  DELIVERING: { status: "DELIVERED", label: "تم تسليم العميل" },
};

function confirmDelete(onConfirm: () => void) {
  const title = "حذف الطلب";
  const message = "هل تريد حذف هذا الطلب من قائمة الطلبات المُسلَّمة؟";
  if (Platform.OS === "web") {
    if (window.confirm(`${title}\n\n${message}`)) onConfirm();
    return;
  }
  Alert.alert(title, message, [
    { text: "إلغاء", style: "cancel" },
    { text: "حذف", style: "destructive", onPress: onConfirm },
  ]);
}

function OrderInvoice({ invoiceNumber }: { invoiceNumber?: string | null }) {
  const label = formatOrderInvoice(invoiceNumber);
  if (!label) return null;
  return <Text style={styles.invoiceRef}>{label}</Text>;
}

function OrderItems({ items }: { items: OrderItem[] }) {
  return (
    <>
      {items.map((i, idx) => (
        <Text key={idx} style={styles.item}>
          {i.productName ?? i.product?.name} — {i.restaurantName ?? i.product?.restaurant?.name}
        </Text>
      ))}
    </>
  );
}

function CustomerContact({ customer }: { customer: { name: string; phone?: string | null } }) {
  return (
    <Text style={styles.customer}>
      {customer.name}
      {customer.phone ? (
        <>
          {" — "}
          <Text
            style={styles.customerPhoneLink}
            onPress={() => Linking.openURL(`tel:${customer.phone}`).catch(() => {})}
          >
            📱 {customer.phone}
          </Text>
        </>
      ) : null}
    </Text>
  );
}

function formatCaptainDateTime(iso?: string) {
  if (!iso) return null;
  return new Date(iso).toLocaleString("ar-SA", { timeZone: "Asia/Riyadh" });
}

function OrderTimestamps({
  order,
}: {
  order: Pick<Order, "createdAt" | "updatedAt" | "pickedUpAt" | "deliveredAt" | "status">;
}) {
  const orderTime = formatCaptainDateTime(order.createdAt);
  const pickupTime = formatCaptainDateTime(order.pickedUpAt ?? undefined);
  const isDelivered = order.status === "DELIVERED";
  const deliveryTime = isDelivered
    ? formatCaptainDateTime(order.deliveredAt ?? order.updatedAt)
    : null;

  return (
    <View style={styles.orderDates}>
      {orderTime ? <Text style={styles.orderDate}>🕐 وقت الطلب: {orderTime}</Text> : null}
      {pickupTime ? (
        <Text style={styles.orderDatePickup}>🏪 وقت الاستلام من المطعم: {pickupTime}</Text>
      ) : (
        <Text style={styles.orderDatePending}>وقت الاستلام من المطعم: لم يُستلم بعد</Text>
      )}
      {isDelivered && deliveryTime ? (
        <Text style={styles.orderDateDelivered}>✓ وقت استلام العميل: {deliveryTime}</Text>
      ) : (
        <Text style={styles.orderDatePending}>وقت استلام العميل: لم يُسلَّم بعد</Text>
      )}
    </View>
  );
}

function OrderLocationMap({
  order,
  captainPos,
  showCaptain,
}: {
  order: Order;
  captainPos: { lat: number; lng: number } | null;
  showCaptain?: boolean;
}) {
  const lat = order.deliveryLat;
  const lng = order.deliveryLng;
  if (lat == null || lng == null) return null;

  return (
    <>
      <Text style={styles.mapLabel}>📍 موقع العميل على الخريطة</Text>
      <DeliveryMap
        customer={{ lat, lng, label: order.customer?.name ?? "العميل" }}
        restaurants={(order.restaurants ?? []).map((r) => ({
          lat: r.lat,
          lng: r.lng,
          label: r.name,
        }))}
        captain={showCaptain && captainPos ? { ...captainPos, label: "موقعك" } : null}
        height={240}
      />
      <View style={styles.legend}>
        <Text style={styles.legendItem}>🟠 العميل</Text>
        <Text style={styles.legendItem}>🟢 المطعم</Text>
        {showCaptain && captainPos && (
          <View style={styles.legendRow}>
            <CaptainCarTopIcon size={18} />
            <Text style={styles.legendItem}>الكابتن</Text>
          </View>
        )}
      </View>
      <MapNavButton lat={lat} lng={lng} />
    </>
  );
}

type DispatchOffer = {
  order: Order;
  priorityEndsAt: string | null;
};

export default function CaptainScreen() {
  const router = useRouter();
  const [incomingOffers, setIncomingOffers] = useState<DispatchOffer[]>([]);
  const [offerTick, setOfferTick] = useState(0);
  const [isOnline, setIsOnline] = useState(false);
  const [hasLocation, setHasLocation] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [locationSheetOpen, setLocationSheetOpen] = useState(false);
  const [active, setActive] = useState<Order[]>([]);
  const [completed, setCompleted] = useState<Order[]>([]);
  const [orderTab, setOrderTab] = useState<"current" | "delivered">("current");
  const [completedLoading, setCompletedLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [stats, setStats] = useState({ deliveredCount: 0, totalDeliveryFees: 0 });
  const [statsPeriod, setStatsPeriod] = useState<StatsPeriod>("all");
  const [statsMonth, setStatsMonth] = useState(defaultMonth);
  const [statsYear, setStatsYear] = useState(defaultYear);
  const [statsDate, setStatsDate] = useState(defaultDay);
  const [ready, setReady] = useState(false);
  const [checking, setChecking] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [captainPos, setCaptainPos] = useState<{ lat: number; lng: number } | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const prevOffersCount = useRef(0);
  const autoLocationTried = useRef(false);
  const browserOnHttp = Platform.OS === "web" && !webAllowsGps();

  const loadStats = useCallback(async () => {
    try {
      const qs = statsQueryString(statsPeriod, statsMonth, statsYear, statsDate);
      const res = await api<{ deliveredCount: number; totalDeliveryFees: number }>(
        `/api/orders/captain/stats?${qs}`
      );
      setStats({
        deliveredCount: res.deliveredCount,
        totalDeliveryFees: Number(formatMoney(res.totalDeliveryFees)),
      });
    } catch {
      /* تجاهل */
    }
  }, [statsPeriod, statsMonth, statsYear, statsDate]);

  const loadOffer = useCallback(async () => {
    try {
      const res = await api<{
        offers?: Array<{
          offer: Order;
          expiresAt?: string | null;
          secondsLeft?: number;
        }>;
      }>("/api/orders/captain/offer");
      const list = (res.offers ?? [])
        .filter((item) => item.offer)
        .map((item) => ({
          order: item.offer,
          priorityEndsAt: item.expiresAt ?? null,
        }))
        .sort((a, b) => {
          const aTime = a.order.createdAt ? new Date(a.order.createdAt).getTime() : 0;
          const bTime = b.order.createdAt ? new Date(b.order.createdAt).getTime() : 0;
          return bTime - aTime;
        });
      setIncomingOffers(list);
    } catch {
      setIncomingOffers([]);
    }
  }, []);

  const pushCaptainLocationToServer = useCallback(
    async (lat: number, lng: number) => {
      setCaptainPos({ lat, lng });
      setHasLocation(true);
      setLocationError(null);
      try {
        socketRef.current?.emit("captain:location", { lat, lng });
        await api("/api/captain/location", {
          method: "PATCH",
          body: JSON.stringify({ lat, lng }),
        });
        void loadOffer();
      } catch {
        setLocationError("تعذر حفظ الموقع على الخادم — أعد المحاولة");
      }
    },
    [loadOffer]
  );

  const loadStatus = useCallback(async () => {
    try {
      const res = await api<{ isOnline: boolean; hasLocation: boolean }>("/api/captain/status");
      setIsOnline(res.isOnline);
      setHasLocation(res.hasLocation);
    } catch {
      setIsOnline(false);
      setHasLocation(false);
    }
  }, []);

  const setCaptainOnline = useCallback(async (online: boolean) => {
    try {
      await api("/api/captain/online", {
        method: "PATCH",
        body: JSON.stringify({ isOnline: online }),
      });
      setIsOnline(online);
      if (online) {
        await registerCaptainPushToken();
      } else {
        await unregisterCaptainPushToken();
      }
    } catch {
      /* تجاهل */
    }
  }, []);

  const load = useCallback(async () => {
    const [, activeRes] = await Promise.all([
      loadOffer(),
      api<{ orders: Order[] }>("/api/orders/captain/active"),
    ]);
    setActive(activeRes.orders);
    await loadStats();
    await loadStatus();
  }, [loadStats, loadOffer, loadStatus]);

  const loadCompleted = useCallback(async () => {
    setCompletedLoading(true);
    try {
      const res = await api<{ orders: Order[] }>("/api/orders/captain/completed");
      setCompleted(res.orders);
    } catch {
      setCompleted([]);
    } finally {
      setCompletedLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        setChecking(true);
        const token = await getToken();
        if (!token) {
          router.replace("/auth?intent=captain");
          return;
        }
        try {
          const res = await api<{ user: { role: string } }>("/api/auth/me");
          if (cancelled) return;
          if (res.user.role !== "CAPTAIN") {
            showAlert("حساب غير مناسب", "صفحة الكابتن تتطلب حساب كابتن توصيل.");
            router.replace("/account");
            return;
          }
          setReady(true);
          await setCaptainOnline(true);
          await load();
        } catch {
          if (!cancelled) router.replace("/auth?intent=captain");
        } finally {
          if (!cancelled) setChecking(false);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [load, router, setCaptainOnline])
  );

  useEffect(() => {
    if (!ready) return;
    return () => {
      void setCaptainOnline(false);
    };
  }, [ready, setCaptainOnline]);

  useEffect(() => {
    if (!ready) return;

    let mounted = true;
    (async () => {
      const token = await getToken();
      if (!token || !mounted) return;

      const socket = io(API_URL, { auth: { token } });
      socketRef.current = socket;

      const refreshOrders = () => {
        load().catch(() => {});
      };

      socket.on("dispatch:offer", (payload: DispatchOfferPayload) => {
        void notifyCaptainNewOrder(payload);
        refreshOrders();
      });
      socket.on("dispatch:withdrawn", (payload: { orderId?: string }) => {
        if (payload?.orderId) {
          setIncomingOffers((prev) => prev.filter((o) => o.order.id !== payload.orderId));
        }
        refreshOrders();
      });
      socket.on("order:paid", () => {
        refreshOrders();
      });
      socket.on(
        "order:update",
        (payload: { orderId: string; status?: string; captainId?: string | null }) => {
          if (payload?.status) {
            setActive((prev) =>
              prev.map((o) => (o.id === payload.orderId ? { ...o, status: payload.status! } : o))
            );
          }
          refreshOrders();
        }
      );
    })();

    return () => {
      mounted = false;
      socketRef.current?.disconnect();
      socketRef.current = null;
    };
  }, [ready, load]);

  useEffect(() => {
    if (incomingOffers.length === 0) return;
    const tickId = setInterval(() => setOfferTick((t) => t + 1), 1000);
    const syncId = setInterval(() => void loadOffer(), 8000);
    return () => {
      clearInterval(tickId);
      clearInterval(syncId);
    };
  }, [incomingOffers.length, loadOffer]);

  useEffect(() => {
    if (incomingOffers.length > prevOffersCount.current) {
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    }
    prevOffersCount.current = incomingOffers.length;
  }, [incomingOffers.length]);

  useEffect(() => {
    if (ready && orderTab === "delivered") loadCompleted();
  }, [ready, orderTab, loadCompleted]);

  useEffect(() => {
    if (ready) loadStats();
  }, [ready, statsPeriod, statsMonth, statsYear, statsDate, loadStats]);

  useEffect(() => {
    if (!ready || !isOnline) return;

    let cancelled = false;
    let stopWebWatch: (() => void) | null = null;
    let watchSub: Location.LocationSubscription | null = null;

    const pushCaptainLocation = (lat: number, lng: number) => {
      if (cancelled) return;
      void pushCaptainLocationToServer(lat, lng);
    };

    const stopTracking = () => {
      stopWebWatch?.();
      stopWebWatch = null;
      if (watchSub) {
        try {
          watchSub.remove();
        } catch {
          /* expo-location على الويب قد يفشل عند الإيقاف */
        }
        watchSub = null;
      }
    };

    if (Platform.OS === "web") {
      stopWebWatch = startCaptainLocationWatch((lat, lng) => {
        pushCaptainLocation(lat, lng);
      });
    } else {
      void (async () => {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted" || cancelled) {
          if (!cancelled) {
            setLocationError("لم يُسمح بالموقع — فعّله من إعدادات الجهاز");
          }
          return;
        }

        watchSub = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.High, distanceInterval: 25 },
          (loc) => {
            pushCaptainLocation(loc.coords.latitude, loc.coords.longitude);
          }
        );
      })();
    }

    return () => {
      cancelled = true;
      stopTracking();
    };
  }, [ready, isOnline, pushCaptainLocationToServer]);

  useEffect(() => {
    if (!ready || !isOnline || !hasLocation) return;
    const id = setInterval(() => {
      void loadOffer();
    }, 5000);
    return () => clearInterval(id);
  }, [ready, isOnline, hasLocation, loadOffer]);

  const tryIpAutoLocation = useCallback(async () => {
    setGpsLoading(true);
    setLocationError(null);
    try {
      const { location, error } = await detectIpLocation();
      if (location) {
        setLocationError("تم تقدير موقعك تلقائياً (تقريبي) — يمكنك تصحيحه من الخريطة");
        await pushCaptainLocationToServer(location.lat, location.lng);
        return;
      }
      setLocationError(error ?? "تعذّر التحديد التلقائي — استخدم الخريطة");
    } finally {
      setGpsLoading(false);
    }
  }, [pushCaptainLocationToServer]);

  useEffect(() => {
    if (!ready || !isOnline || hasLocation || !browserOnHttp || autoLocationTried.current) return;
    autoLocationTried.current = true;
    void tryIpAutoLocation();
  }, [ready, isOnline, hasLocation, browserOnHttp, tryIpAutoLocation]);

  function applyCaptainLocation(loc: CustomerLocation) {
    void pushCaptainLocationToServer(loc.lat, loc.lng);
  }

  function requestCaptainGpsAuto() {
    setGpsLoading(true);
    setLocationError(null);

    if (Platform.OS === "web") {
      const started = requestWebGpsOnUserGesture((result) => {
        setGpsLoading(false);
        if (result.ok) {
          void pushCaptainLocationToServer(result.lat, result.lng);
          return;
        }
        setLocationError(result.message);
        if (result.message === WEB_GPS_HTTP_MESSAGE) {
          setLocationSheetOpen(true);
        }
      });
      if (started) return;
    }

    void (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          setLocationError("لم يُسمح بالموقع — فعّله من إعدادات الجهاز");
          return;
        }
        const pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });
        await pushCaptainLocationToServer(pos.coords.latitude, pos.coords.longitude);
      } catch {
        setLocationError("تعذّر تحديد الموقع — جرّب تحديده من الخريطة");
      } finally {
        setGpsLoading(false);
      }
    })();
  }

  async function onRefresh() {
    setRefreshing(true);
    try {
      if (orderTab === "delivered") await Promise.all([loadCompleted(), loadStats()]);
      else await load();
    } catch (e) {
      showAlert("خطأ", e instanceof Error ? e.message : "فشل تحديث الطلبات");
    } finally {
      setRefreshing(false);
    }
  }

  async function deleteCompleted(orderId: string) {
    setDeletingId(orderId);
    try {
      await api(`/api/orders/captain/${orderId}`, { method: "DELETE" });
      setCompleted((prev) => prev.filter((o) => o.id !== orderId));
      await loadStats();
    } catch (e) {
      showAlert("خطأ", e instanceof Error ? e.message : "تعذّر حذف الطلب");
    } finally {
      setDeletingId(null);
    }
  }

  async function accept(orderId: string) {
    if (acceptingId) return;
    setAcceptingId(orderId);
    try {
      const res = await api<{ message?: string }>(`/api/orders/captain/${orderId}/accept`, {
        method: "POST",
      });
      setIncomingOffers((prev) => prev.filter((o) => o.order.id !== orderId));
      showAlert("تم", res.message ?? "تم قبول الطلب — توجه للمطعم");
      await load();
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    } catch (e) {
      showAlert("خطأ", e instanceof Error ? e.message : "فشل القبول");
    } finally {
      setAcceptingId(null);
    }
  }

  async function rejectOffer(orderId: string) {
    if (acceptingId) return;
    setAcceptingId(orderId);
    try {
      await api(`/api/orders/captain/${orderId}/reject`, { method: "POST" });
      setIncomingOffers((prev) => prev.filter((o) => o.order.id !== orderId));
      await loadOffer();
    } catch (e) {
      showAlert("خطأ", e instanceof Error ? e.message : "فشل الرفض");
    } finally {
      setAcceptingId(null);
    }
  }

  function offerSecondsLeft(priorityEndsAt: string | null) {
    void offerTick;
    if (!priorityEndsAt) return 0;
    const ms = new Date(priorityEndsAt).getTime() - Date.now();
    if (!Number.isFinite(ms)) return 0;
    return Math.max(0, Math.ceil(ms / 1000));
  }

  async function advanceStatus(orderId: string, currentStatus: string) {
    const next = NEXT_STATUS[currentStatus];
    if (!next || updatingId) return;

    setUpdatingId(orderId);
    try {
      await api(`/api/orders/captain/${orderId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: next.status }),
      });
      showAlert("تم", next.status === "DELIVERED" ? "تم إنهاء التوصيل" : "تم تحديث حالة الطلب");
      await load();
    } catch (e) {
      showAlert("خطأ", e instanceof Error ? e.message : "فشل تحديث الحالة");
    } finally {
      setUpdatingId(null);
    }
  }

  if (checking) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#0077B6" />
        <Text style={styles.checkingText}>جاري التحقق من الحساب...</Text>
      </View>
    );
  }

  if (!ready) return null;

  return (
    <ScrollView
      ref={scrollRef}
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.headerCenter}>
        <Pressable onPress={() => router.replace("/")} hitSlop={8}>
          <Text style={styles.homeLink}>الرئيسية</Text>
        </Pressable>
      </View>

      <View style={styles.topBar}>
        <LogoutButton redirectTo="/auth" />
        <Pressable style={styles.refreshBtn} onPress={onRefresh}>
          <Text style={styles.refreshBtnText}>تحديث</Text>
        </Pressable>
        {orderTab === "delivered" ? (
          <Pressable
            style={styles.mainMenuBtn}
            onPress={() => {
              setOrderTab("current");
              scrollRef.current?.scrollTo({ y: 0, animated: true });
            }}
          >
            <Text style={styles.mainMenuBtnText}>← القائمة الرئيسية</Text>
          </Pressable>
        ) : null}
      </View>

      <Text style={styles.title}>لوحة الكابتن</Text>

      <View style={[styles.onlineBadge, isOnline ? styles.onlineOn : styles.onlineOff]}>
        <Text style={styles.onlineBadgeText}>
          {isOnline
            ? hasLocation
              ? "● متصل — تصلك الطلبات"
              : "● متصل — حدّد موقعك لاستلام الطلبات"
            : "○ غير متصل"}
        </Text>
      </View>

      {isOnline && !hasLocation ? (
        <View style={styles.locationWarn}>
          <Text style={styles.locationWarnText}>
            {browserOnHttp
              ? "جاري تقدير موقعك من الشبكة تلقائياً (تقريبي). للدقة استخدم الخريطة."
              : "حدّد موقعك لاستلام الطلبات — GPS تلقائي أو من الخريطة."}
          </Text>
          {browserOnHttp ? (
            <Pressable
              style={[styles.locationBtn, gpsLoading && styles.locationBtnDisabled]}
              onPress={() => void tryIpAutoLocation()}
              disabled={gpsLoading}
            >
              {gpsLoading ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.locationBtnText}>📡 تحديد موقعي تلقائياً (من الشبكة)</Text>
              )}
            </Pressable>
          ) : (
            <Pressable
              style={[styles.locationBtn, gpsLoading && styles.locationBtnDisabled]}
              onPress={requestCaptainGpsAuto}
              disabled={gpsLoading}
            >
              {gpsLoading ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.locationBtnText}>📍 السماح بتحديد موقعي تلقائياً</Text>
              )}
            </Pressable>
          )}
          <Pressable
            style={[styles.locationBtn, styles.locationBtnOutline]}
            onPress={() => setLocationSheetOpen(true)}
          >
            <Text style={styles.locationBtnOutlineText}>🗺️ تصحيح الموقع على الخريطة</Text>
          </Pressable>
          {locationError ? (
            <Text style={styles.locationErrorText}>{locationError}</Text>
          ) : null}
        </View>
      ) : null}

      <View style={styles.statsCard}>
        <Text style={styles.statsTitle}>إحصائيات التوصيل</Text>
        <StatsPeriodFilter
          period={statsPeriod}
          onPeriodChange={setStatsPeriod}
          month={statsMonth}
          year={statsYear}
          date={statsDate}
          onMonthChange={setStatsMonth}
          onYearChange={setStatsYear}
          onDateChange={setStatsDate}
          theme="captain"
        />
        <View style={styles.statsRow}>
          <Text style={styles.statsLabel}>عدد الطلبات المُسلَّمة</Text>
          <Text style={styles.statsValue}>{stats.deliveredCount}</Text>
        </View>
        <View style={styles.statsRow}>
          <Text style={styles.statsLabel}>إجمالي أجور التوصيل</Text>
          <Text style={styles.statsValue}>{formatMoney(stats.totalDeliveryFees)} ر.س</Text>
        </View>
      </View>

      {orderTab === "delivered" ? (
        <>
          <Pressable style={styles.switchBtnOutline} onPress={() => setOrderTab("current")}>
            <Text style={styles.switchBtnOutlineText}>← القائمة الرئيسية</Text>
          </Pressable>

          <Text style={styles.subtitle}>الطلبات المُسلَّمة للعميل</Text>

          {completedLoading ? (
            <ActivityIndicator color="#0077B6" style={{ marginVertical: 24 }} />
          ) : completed.length === 0 ? (
            <Text style={styles.empty}>لا توجد طلبات مُسلَّمة</Text>
          ) : (
            completed.map((item) => (
              <View key={item.id} style={[styles.card, styles.cardDone]}>
                <OrderInvoice invoiceNumber={item.invoiceNumber} />
                <Text style={styles.doneBadge}>✓ تم التسليم للعميل</Text>
                <OrderTimestamps order={item} />
                <Text style={styles.addr}>{item.deliveryAddress}</Text>
                {item.customer && (
                  <Text style={styles.customer}>
                    {item.customer.name} — 📱 {item.customer.phone}
                  </Text>
                )}
                <OrderItems items={item.items} />
                <Text style={styles.fee}>أجرة التوصيل: {formatMoney(item.deliveryFee)} ر.س</Text>
                <Pressable
                  style={[styles.btnDelete, deletingId === item.id && styles.disabled]}
                  disabled={deletingId === item.id}
                  onPress={() => confirmDelete(() => deleteCompleted(item.id))}
                >
                  <Text style={styles.btnDeleteText}>
                    {deletingId === item.id ? "جاري الحذف..." : "🗑️ حذف من القائمة"}
                  </Text>
                </Pressable>
              </View>
            ))
          )}
        </>
      ) : (
        <>
          <Text style={styles.subtitle}>عرض طلب — أقرب كابتن (30 ثانية أولوية)</Text>
          {!isOnline ? (
            <Text style={styles.empty}>يجب أن تكون متصلاً لاستلام العروض.</Text>
          ) : !hasLocation ? (
            <Text style={styles.empty}>
              حدّد موقعك أولاً من الزر أعلاه ليصلك الطلب.
            </Text>
          ) : incomingOffers.length > 0 ? (
            incomingOffers.map((incomingOffer) => {
              const secondsLeft = offerSecondsLeft(incomingOffer.priorityEndsAt);
              return (
                <View key={incomingOffer.order.id} style={[styles.card, styles.cardOffer]}>
                  {secondsLeft > 0 ? (
                    <View style={styles.countdownRow}>
                      <Text style={styles.countdownNumber}>{secondsLeft}</Text>
                      <Text style={styles.countdownLabel}>
                        ثانية — أولوية لك ثم يُعرض على كابتن آخر{"\n"}
                        (يمكنك القبول الآن)
                      </Text>
                    </View>
                  ) : (
                    <Text style={styles.offerTimer}>
                      يمكنك قبول الطلب — يختفي إذا قبله كابتن آخر
                    </Text>
                  )}
                  <OrderInvoice invoiceNumber={incomingOffer.order.invoiceNumber} />
                  <Text style={styles.statusBadge}>{orderStatusLabel(incomingOffer.order)}</Text>
                  <OrderTimestamps order={incomingOffer.order} />
                  <PaymentMethodBadge
                    method={incomingOffer.order.paymentMethod}
                    total={incomingOffer.order.total}
                  />
                  <Text style={styles.fee}>
                    أجرة التوصيل: {formatMoney(incomingOffer.order.deliveryFee)} ر.س
                  </Text>
                  <Text style={styles.addr}>{incomingOffer.order.deliveryAddress}</Text>
                  {incomingOffer.order.customer && (
                    <CustomerContact customer={incomingOffer.order.customer} />
                  )}
                  <OrderItems items={incomingOffer.order.items} />
                  <OrderLocationMap order={incomingOffer.order} captainPos={captainPos} />
                  <View style={styles.offerActions}>
                    <Pressable
                      style={[
                        styles.btn,
                        styles.btnReject,
                        acceptingId === incomingOffer.order.id && styles.disabled,
                      ]}
                      onPress={() => rejectOffer(incomingOffer.order.id)}
                      disabled={acceptingId === incomingOffer.order.id}
                    >
                      <Text style={styles.btnRejectText}>رفض</Text>
                    </Pressable>
                    <Pressable
                      style={[
                        styles.btn,
                        styles.btnAccept,
                        acceptingId === incomingOffer.order.id && styles.disabled,
                      ]}
                      onPress={() => accept(incomingOffer.order.id)}
                      disabled={acceptingId === incomingOffer.order.id}
                    >
                      {acceptingId === incomingOffer.order.id ? (
                        <ActivityIndicator color="#FFF" />
                      ) : (
                        <Text style={styles.btnText}>✓ قبول</Text>
                      )}
                    </Pressable>
                  </View>
                </View>
              );
            })
          ) : (
            <Text style={styles.empty}>
              لا يوجد عرض حالياً.{"\n"}سيُرسل الطلب تلقائياً إذا كنت الأقرب ومتصلاً.
            </Text>
          )}

          {active.length > 0 && (
            <>
              <Text style={styles.subtitle}>طلباتي الحالية (المقبولة)</Text>
              {active.map((item) => {
                const next = item.status ? NEXT_STATUS[item.status] : undefined;
                return (
                  <View key={item.id} style={[styles.card, styles.cardActive]}>
                    <OrderInvoice invoiceNumber={item.invoiceNumber} />
                    <Text style={styles.activeBadge}>{orderStatusLabel(item)}</Text>
                    <OrderTimestamps order={item} />
                    <PaymentMethodBadge method={item.paymentMethod} total={item.total} />
                    <Text style={styles.fee}>أجرة التوصيل: {formatMoney(item.deliveryFee)} ر.س</Text>
                    <Text style={styles.addr}>{item.deliveryAddress}</Text>
                    {item.customer && <CustomerContact customer={item.customer} />}
                    <OrderItems items={item.items} />
                    <OrderLocationMap order={item} captainPos={captainPos} showCaptain />
                    {next && (
                      <Pressable
                        style={[styles.btn, styles.btnGreen, updatingId === item.id && styles.disabled]}
                        onPress={() => item.status && advanceStatus(item.id, item.status)}
                        disabled={updatingId === item.id}
                      >
                        {updatingId === item.id ? (
                          <ActivityIndicator color="#FFF" />
                        ) : (
                          <Text style={styles.btnText}>{next.label}</Text>
                        )}
                      </Pressable>
                    )}
                  </View>
                );
              })}
            </>
          )}

          <Pressable
            style={styles.switchBtn}
            onPress={() => {
              setOrderTab("delivered");
              loadCompleted();
            }}
          >
            <Text style={styles.switchBtnText}>📦 الطلبات المُسلَّمة للعميل</Text>
          </Pressable>
        </>
      )}
      <CustomerLocationSheet
        visible={locationSheetOpen}
        onClose={() => setLocationSheetOpen(false)}
        onSaved={applyCaptainLocation}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingTop: 48, paddingBottom: 32 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  checkingText: { color: "#666" },
  headerCenter: {
    flexDirection: "row",
    justifyContent: "center",
    marginBottom: 12,
  },
  homeLink: {
    color: "#0077B6",
    fontWeight: "700",
    fontSize: 16,
    textAlign: "center",
  },
  topBar: {
    flexDirection: "row-reverse",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
    alignItems: "center",
  },
  refreshBtn: {
    backgroundColor: "#0077B6",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  refreshBtnText: { color: "#FFF", fontWeight: "700" },
  mainMenuBtn: {
    backgroundColor: "#E8F4F8",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#0077B6",
  },
  mainMenuBtnText: { color: "#0077B6", fontWeight: "700", fontSize: 13 },
  title: { fontSize: 22, fontWeight: "700", textAlign: "center", marginBottom: 8 },
  onlineBadge: {
    padding: 10,
    borderRadius: 10,
    marginBottom: 12,
    alignItems: "center",
  },
  onlineOn: { backgroundColor: "#D1FAE5", borderWidth: 1, borderColor: "#059669" },
  onlineOff: { backgroundColor: "#F3F4F6", borderWidth: 1, borderColor: "#9CA3AF" },
  onlineBadgeText: { fontWeight: "700", textAlign: "center", fontSize: 14 },
  locationWarn: {
    backgroundColor: "#FEF3C7",
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#F59E0B",
  },
  locationWarnText: {
    textAlign: "right",
    color: "#92400E",
    lineHeight: 20,
    marginBottom: 10,
    fontWeight: "600",
  },
  locationBtn: {
    backgroundColor: "#0077B6",
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
    marginBottom: 8,
    minHeight: 44,
    justifyContent: "center",
  },
  locationBtnDisabled: { opacity: 0.7 },
  locationBtnText: { color: "#FFF", fontWeight: "700" },
  locationErrorText: {
    color: "#B91C1C",
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 8,
    textAlign: "center",
  },
  locationBtnOutline: {
    backgroundColor: "#FFF",
    borderWidth: 1,
    borderColor: "#0077B6",
    marginBottom: 0,
  },
  locationBtnOutlineText: { color: "#0077B6", fontWeight: "700" },
  cardOffer: { borderWidth: 2, borderColor: "#0077B6", marginBottom: 12 },
  countdownRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 12,
    marginBottom: 10,
    backgroundColor: "#E8F4F8",
    borderRadius: 10,
    padding: 12,
  },
  countdownNumber: {
    fontSize: 36,
    fontWeight: "800",
    color: "#0077B6",
    minWidth: 48,
    textAlign: "center",
  },
  countdownLabel: {
    flex: 1,
    textAlign: "right",
    color: "#334155",
    lineHeight: 20,
    fontWeight: "600",
    fontSize: 13,
  },
  offerTimer: {
    textAlign: "center",
    fontWeight: "800",
    fontSize: 16,
    color: "#B45309",
    marginBottom: 10,
  },
  offerActions: { flexDirection: "row-reverse", gap: 10, marginTop: 8 },
  btnReject: {
    flex: 1,
    backgroundColor: "#FFF",
    borderWidth: 2,
    borderColor: "#DC2626",
  },
  btnRejectText: { color: "#DC2626", fontWeight: "700", textAlign: "center" },
  statsCard: {
    backgroundColor: "#E8F4F8",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#0077B6",
  },
  statsTitle: {
    fontWeight: "700",
    fontSize: 16,
    textAlign: "right",
    color: "#0077B6",
    marginBottom: 10,
  },
  statsRow: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  statsLabel: { color: "#444", fontSize: 15, textAlign: "right" },
  statsValue: { fontWeight: "700", fontSize: 18, color: "#1A1A1A" },
  subtitle: { fontSize: 16, fontWeight: "600", textAlign: "right", marginBottom: 10, marginTop: 8, color: "#444" },
  card: {
    backgroundColor: "#FFF",
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderRightWidth: 4,
    borderRightColor: "#0077B6",
  },
  cardActive: { borderRightColor: "#2D6A4F" },
  cardDone: { borderRightColor: "#6B7280" },
  switchBtn: {
    backgroundColor: "#E8F4F8",
    padding: 14,
    borderRadius: 10,
    marginTop: 4,
    marginBottom: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#0077B6",
  },
  switchBtnText: { color: "#0077B6", fontWeight: "700" },
  switchBtnOutline: {
    backgroundColor: "#FFF",
    padding: 14,
    borderRadius: 10,
    marginBottom: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E85D04",
  },
  switchBtnOutlineText: { color: "#E85D04", fontWeight: "700" },
  doneBadge: { fontWeight: "700", color: "#2D6A4F", textAlign: "right", marginBottom: 4 },
  orderDates: { marginBottom: 6, gap: 2 },
  orderDate: { textAlign: "right", color: "#666", fontSize: 12 },
  orderDatePickup: { textAlign: "right", color: "#0077B6", fontSize: 12, fontWeight: "600" },
  orderDateDelivered: { textAlign: "right", color: "#2D6A4F", fontSize: 12, fontWeight: "600" },
  orderDatePending: { textAlign: "right", color: "#999", fontSize: 12 },
  btnDelete: {
    backgroundColor: "#FEE2E2",
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#DC2626",
  },
  btnDeleteText: { color: "#DC2626", fontWeight: "700" },
  invoiceRef: {
    fontWeight: "700",
    fontSize: 15,
    color: "#0077B6",
    textAlign: "right",
    marginBottom: 6,
  },
  statusBadge: { fontWeight: "700", color: "#E85D04", textAlign: "right", marginBottom: 6 },
  activeBadge: { fontWeight: "700", color: "#0077B6", textAlign: "right", marginBottom: 6 },
  fee: { fontWeight: "700", color: "#E85D04", textAlign: "right" },
  codBadge: {
    fontWeight: "700",
    color: "#B45309",
    textAlign: "right",
    marginBottom: 6,
    lineHeight: 20,
  },
  addr: { textAlign: "right", marginVertical: 8 },
  customer: { textAlign: "right", color: "#333", fontWeight: "600", marginBottom: 6 },
  customerPhoneLink: { color: "#0077B6", textDecorationLine: "underline" },
  item: { textAlign: "right", color: "#444" },
  mapLabel: { fontWeight: "700", textAlign: "right", marginTop: 8, color: "#333" },
  legend: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 12, marginBottom: 4 },
  legendRow: { flexDirection: "row-reverse", alignItems: "center", gap: 4 },
  legendItem: { fontSize: 12, color: "#666" },
  btn: {
    backgroundColor: "#0077B6",
    padding: 14,
    borderRadius: 8,
    marginTop: 12,
    alignItems: "center",
    minHeight: 48,
    justifyContent: "center",
  },
  btnAccept: { backgroundColor: "#0077B6" },
  btnGreen: { backgroundColor: "#2D6A4F" },
  btnText: { color: "#FFF", fontWeight: "700", fontSize: 16 },
  disabled: { opacity: 0.6 },
  empty: { textAlign: "center", marginVertical: 24, color: "#888", lineHeight: 22 },
});
