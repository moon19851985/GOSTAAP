import { Platform } from "react-native";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { api } from "./api";
import { formatMoney } from "./formatMoney";

export const CAPTAIN_ORDERS_CHANNEL = "captain-orders";

const recentOrderAlerts = new Map<string, number>();
const DEDUP_MS = 12_000;

let handlerConfigured = false;

export type DispatchOfferPayload = {
  orderId?: string;
  deliveryAddress?: string;
  deliveryFee?: number;
  total?: number;
};

export function configureCaptainNotificationHandler() {
  if (handlerConfigured) return;
  handlerConfigured = true;

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

async function ensureAndroidChannel() {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync(CAPTAIN_ORDERS_CHANNEL, {
    name: "طلبات التوصيل",
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 300, 200, 300],
    sound: "default",
    enableVibrate: true,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });
}

function shouldSkipDuplicate(orderId: string) {
  const now = Date.now();
  const last = recentOrderAlerts.get(orderId);
  if (last != null && now - last < DEDUP_MS) return true;
  recentOrderAlerts.set(orderId, now);
  for (const [id, ts] of recentOrderAlerts) {
    if (now - ts > DEDUP_MS * 3) recentOrderAlerts.delete(id);
  }
  return false;
}

function buildOfferBody(payload: DispatchOfferPayload) {
  const parts: string[] = [];
  if (payload.deliveryFee != null) {
    parts.push(`أجرة ${formatMoney(payload.deliveryFee)} ر.س`);
  }
  if (payload.deliveryAddress) {
    parts.push(payload.deliveryAddress.slice(0, 90));
  }
  return parts.length > 0 ? parts.join(" — ") : "اضغط لفتح لوحة الكابتن";
}

async function notifyWeb(payload: DispatchOfferPayload) {
  if (Platform.OS !== "web" || typeof window === "undefined") return;

  const body = buildOfferBody(payload);
  if (typeof Notification !== "undefined") {
    if (Notification.permission === "granted") {
      new Notification("طلب توصيل جديد", { body, tag: payload.orderId });
    } else if (Notification.permission !== "denied") {
      const perm = await Notification.requestPermission();
      if (perm === "granted") {
        new Notification("طلب توصيل جديد", { body, tag: payload.orderId });
      }
    }
  }

  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (Ctx) {
      const ctx = new Ctx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 880;
      gain.gain.value = 0.15;
      osc.start();
      setTimeout(() => {
        osc.stop();
        void ctx.close();
      }, 280);
    }
  } catch {
    /* ignore */
  }
}

/** إشعار محلي فوري + صوت (التطبيق مفتوح أو في الخلفية) */
export async function notifyCaptainNewOrder(payload: DispatchOfferPayload) {
  const orderId = payload.orderId;
  if (!orderId || shouldSkipDuplicate(orderId)) return;

  const body = buildOfferBody(payload);

  if (Platform.OS === "web") {
    await notifyWeb(payload);
    return;
  }

  await ensureAndroidChannel();
  await Notifications.scheduleNotificationAsync({
    content: {
      title: "طلب توصيل جديد",
      body,
      sound: "default",
      priority: Notifications.AndroidNotificationPriority.MAX,
      data: { orderId, screen: "captain" },
      ...(Platform.OS === "android" ? { channelId: CAPTAIN_ORDERS_CHANNEL } : {}),
    },
    trigger: null,
  });
}

/** تسجيل رمز Expo Push على الخادم — للإشعار حتى لو التطبيق مغلق */
export async function registerCaptainPushToken(): Promise<boolean> {
  if (Platform.OS === "web") {
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      await Notification.requestPermission();
    }
    return false;
  }

  if (!Device.isDevice) return false;

  configureCaptainNotificationHandler();
  await ensureAndroidChannel();

  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;
  if (existing !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowBadge: true, allowSound: true },
    });
    finalStatus = status;
  }
  if (finalStatus !== "granted") return false;

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    (Constants as unknown as { easConfig?: { projectId?: string } }).easConfig?.projectId;

  try {
    const tokenData = projectId
      ? await Notifications.getExpoPushTokenAsync({ projectId })
      : await Notifications.getExpoPushTokenAsync();

    await api("/api/captain/push-token", {
      method: "PATCH",
      body: JSON.stringify({ pushToken: tokenData.data }),
    });
    return true;
  } catch {
    return false;
  }
}

export async function unregisterCaptainPushToken() {
  if (Platform.OS === "web") return;
  try {
    await api("/api/captain/push-token", { method: "DELETE" });
  } catch {
    /* ignore */
  }
}
