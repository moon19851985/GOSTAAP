import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import { Platform } from "react-native";
import { resolveCityFromCoords, type CityDef, SAUDI_CITIES } from "./cities";

const STORAGE_KEY = "customer_location_v2";

export type CustomerLocation = {
  city: string;
  cityKey: string;
  lat: number;
  lng: number;
};

export type LocationDetectResult = {
  location: CustomerLocation | null;
  source: "gps" | "ip" | "cache" | "manual" | null;
  error?: string;
};

export function locationFromCoords(lat: number, lng: number): CustomerLocation {
  const cityDef = resolveCityFromCoords(lat, lng);
  return { city: cityDef.nameAr, cityKey: cityDef.key, lat, lng };
}

export function locationFromCity(city: CityDef): CustomerLocation {
  return {
    city: city.nameAr,
    cityKey: city.key,
    lat: city.lat,
    lng: city.lng,
  };
}

export function webAllowsGps(): boolean {
  if (Platform.OS !== "web" || typeof window === "undefined") return false;
  return window.isSecureContext === true;
}

export async function getBrowserGeolocationPermission(): Promise<
  "granted" | "denied" | "prompt" | "unsupported"
> {
  if (Platform.OS !== "web" || typeof navigator === "undefined" || !navigator.geolocation) {
    return "unsupported";
  }
  try {
    const result = await navigator.permissions.query({
      name: "geolocation" as PermissionName,
    });
    if (result.state === "granted") return "granted";
    if (result.state === "denied") return "denied";
    return "prompt";
  } catch {
    return "prompt";
  }
}

type WebGeoResult =
  | { ok: true; lat: number; lng: number }
  | { ok: false; message: string };

export const WEB_GPS_HTTP_MESSAGE =
  "كروم على http لا يدعم GPS — فايرفوكس أو الخريطة أو التقدير من الشبكة";

function isChromiumBrowser(): boolean {
  if (Platform.OS !== "web" || typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return /Chrome|Chromium|Edg\//.test(ua) && !/Firefox/.test(ua);
}

function webGeolocationErrorMessage(err: GeolocationPositionError): string {
  if (!webAllowsGps()) {
    return isChromiumBrowser()
      ? WEB_GPS_HTTP_MESSAGE
      : "اسمح بالموقع من المتصفح أو استخدم الخريطة";
  }
  if (err.code === 1) {
    return "تم رفض الموقع — من إعدادات المتصفح اختر «سماح» لهذا الموقع ثم أعد المحاولة";
  }
  if (err.code === 2) return "الموقع غير متاح — فعّل GPS على الجهاز";
  if (err.code === 3) return "انتهت مهلة تحديد الموقع — حاول مرة أخرى";
  return "تعذّر تحديد الموقع — جرّب الخريطة";
}

const WEB_GEO_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 20000,
  maximumAge: 0,
};

const WEB_WATCH_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  maximumAge: 8000,
  timeout: 15000,
};

const CAPTAIN_IP_POLL_MS = 30_000;

function movedEnoughMeters(
  prev: { lat: number; lng: number } | null,
  lat: number,
  lng: number,
  minMeters: number
): boolean {
  if (!prev) return true;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(lat - prev.lat);
  const dLng = toRad(lng - prev.lng);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(prev.lat)) * Math.cos(toRad(lat)) * Math.sin(dLng / 2) ** 2;
  const dist = 2 * R * Math.asin(Math.sqrt(a));
  return dist >= minMeters;
}

/**
 * يجب استدعاؤها مباشرة من onPress بدون await قبلها — وإلا لن تظهر نافذة السماح.
 */
export function requestWebGpsOnUserGesture(
  onResult: (result: WebGeoResult) => void
): boolean {
  if (Platform.OS !== "web") return false;
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    onResult({ ok: false, message: "المتصفح لا يدعم تحديد الموقع" });
    return true;
  }
  navigator.geolocation.getCurrentPosition(
    (pos) => onResult({ ok: true, lat: pos.coords.latitude, lng: pos.coords.longitude }),
    (err) => onResult({ ok: false, message: webGeolocationErrorMessage(err) }),
    WEB_GEO_OPTIONS
  );
  return true;
}

function getWebBrowserPosition(): Promise<WebGeoResult> {
  if (Platform.OS !== "web" || typeof navigator === "undefined" || !navigator.geolocation) {
    return Promise.resolve({ ok: false, message: "المتصفح لا يدعم تحديد الموقع" });
  }
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({ ok: true, lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => resolve({ ok: false, message: webGeolocationErrorMessage(err) }),
      WEB_GEO_OPTIONS
    );
  });
}

async function detectFromExpoGps(): Promise<CustomerLocation | null> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") return null;
    const pos = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });
    return locationFromCoords(pos.coords.latitude, pos.coords.longitude);
  } catch {
    return null;
  }
}

/**
 * طلب الموقع من المتصفح — يُفضّل استدعاؤه من ضغطة زر (سماح المتصفح).
 * على الويب: navigator.geolocation أولاً ثم expo-location.
 */
export async function detectGpsLocation(): Promise<{
  location: CustomerLocation | null;
  error?: string;
}> {
  if (Platform.OS === "web") {
    const web = await getWebBrowserPosition();
    if (web.ok) return { location: locationFromCoords(web.lat, web.lng) };

    const expo = await detectFromExpoGps();
    if (expo) return { location: expo };

    if (!webAllowsGps()) {
      const ip = await detectIpLocation();
      if (ip.location) return { location: ip.location };
      return { location: null, error: ip.error ?? web.message };
    }

    return { location: null, error: web.message };
  }

  const expo = await detectFromExpoGps();
  if (expo) return { location: expo };

  return {
    location: null,
    error: "لم يُمنح إذن الموقع — اسمح من إعدادات الجهاز أو اختر موقعك يدوياً",
  };
}

/**
 * تتبع مستمر لموقع الكابتن على الويب.
 * فايرفوكس على http: GPS عبر watchPosition — كروم على http: تقدير IP كل 30 ثانية.
 */
export function startCaptainLocationWatch(
  onLocation: (lat: number, lng: number) => void,
  options?: { minMeters?: number }
): () => void {
  const minMeters = options?.minMeters ?? 25;
  let last: { lat: number; lng: number } | null = null;
  let stopped = false;
  let gotGps = false;
  let ipInterval: ReturnType<typeof setInterval> | null = null;
  let watchId: number | null = null;

  const emitIfMoved = (lat: number, lng: number) => {
    if (!movedEnoughMeters(last, lat, lng, minMeters)) return;
    last = { lat, lng };
    onLocation(lat, lng);
  };

  const startIpFallback = () => {
    if (ipInterval || stopped) return;
    const pollIp = async () => {
      if (stopped) return;
      const ip = await detectIpLocation();
      if (ip.location) emitIfMoved(ip.location.lat, ip.location.lng);
    };
    void pollIp();
    ipInterval = setInterval(() => void pollIp(), CAPTAIN_IP_POLL_MS);
  };

  if (Platform.OS !== "web") {
    return () => {};
  }

  if (typeof navigator === "undefined" || !navigator.geolocation) {
    startIpFallback();
    return () => {
      stopped = true;
      if (ipInterval) clearInterval(ipInterval);
    };
  }

  watchId = navigator.geolocation.watchPosition(
    (pos) => {
      gotGps = true;
      emitIfMoved(pos.coords.latitude, pos.coords.longitude);
    },
    () => {
      if (!gotGps && !webAllowsGps()) startIpFallback();
    },
    WEB_WATCH_OPTIONS
  );

  if (!webAllowsGps()) {
    setTimeout(() => {
      if (!gotGps && !stopped) startIpFallback();
    }, 4000);
  }

  return () => {
    stopped = true;
    if (watchId != null) navigator.geolocation.clearWatch(watchId);
    if (ipInterval) clearInterval(ipInterval);
  };
}

export type AutoLocationResult =
  | { ok: true; lat: number; lng: number; source: "gps" | "ip" }
  | { ok: false; message: string };

/** من onPress — GPS (فايرفوكس/https) أو تقدير IP (كروم/http). */
export function triggerAutoLocation(onResult: (result: AutoLocationResult) => void): void {
  if (Platform.OS === "web") {
    requestWebGpsOnUserGesture((gps) => {
      if (gps.ok) {
        onResult({ ok: true, lat: gps.lat, lng: gps.lng, source: "gps" });
        return;
      }
      void detectIpLocation().then((ip) => {
        if (ip.location) {
          onResult({ ok: true, lat: ip.location.lat, lng: ip.location.lng, source: "ip" });
        } else {
          onResult({ ok: false, message: ip.error ?? gps.message });
        }
      });
    });
    return;
  }

  void detectGpsLocation().then((gps) => {
    if (gps.location) {
      onResult({ ok: true, lat: gps.location.lat, lng: gps.location.lng, source: "gps" });
    } else {
      onResult({ ok: false, message: gps.error ?? "تعذّر تحديد الموقع" });
    }
  });
}

/** تقدير الموقع من عنوان IP — يعمل في المتصفح على http لكنه تقريبي (مستوى المدينة). */
export async function detectIpLocation(): Promise<{
  location: CustomerLocation | null;
  error?: string;
}> {
  const loc = await detectFromIp();
  if (loc) return { location: loc };
  return { location: null, error: "تعذّر تقدير الموقع من الشبكة — استخدم الخريطة" };
}

async function detectFromIp(): Promise<CustomerLocation | null> {
  const endpoints = [
    "https://ipwho.is/",
    "https://get.geojs.io/v1/ip/geo.json",
  ];
  for (const url of endpoints) {
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const data = (await res.json()) as {
        latitude?: number | string;
        longitude?: number | string;
        lat?: number | string;
        lng?: number | string;
      };
      const lat = parseFloat(String(data.latitude ?? data.lat ?? ""));
      const lng = parseFloat(String(data.longitude ?? data.lng ?? ""));
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        return locationFromCoords(lat, lng);
      }
    } catch {
      /* جرّب المصدر التالي */
    }
  }
  return null;
}

export async function getStoredCustomerLocation(): Promise<CustomerLocation | null> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as CustomerLocation;
  } catch {
    return null;
  }
}

export async function saveCustomerLocation(loc: CustomerLocation) {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(loc));
}

export async function applyCustomerLocation(loc: CustomerLocation): Promise<CustomerLocation> {
  await saveCustomerLocation(loc);
  return loc;
}

export async function requestCustomerLocation(options?: {
  force?: boolean;
  /** تقدير من IP — غير دقيق وقد يظهر الرياض بالخطأ */
  allowIpEstimate?: boolean;
}): Promise<LocationDetectResult> {
  const force = options?.force ?? false;
  const allowIpEstimate = options?.allowIpEstimate ?? false;
  let lastError: string | undefined;

  const gps = await detectGpsLocation();
  if (gps.location) {
    await saveCustomerLocation(gps.location);
    return { location: gps.location, source: "gps" };
  }
  lastError = gps.error;

  if (!force) {
    const stored = await getStoredCustomerLocation();
    if (stored) return { location: stored, source: "cache" };
  }

  if (allowIpEstimate) {
    const ip = await detectFromIp();
    if (ip) {
      await saveCustomerLocation(ip);
      return { location: ip, source: "ip" };
    }
  }

  return {
    location: null,
    source: null,
    error:
      lastError ??
      "حدّد موقع التوصيل من الخريطة أو اختر مدينتك.",
  };
}

export async function refreshCustomerLocation(force = false): Promise<CustomerLocation | null> {
  const result = await requestCustomerLocation({ force, allowIpEstimate: false });
  return result.location;
}

export { SAUDI_CITIES };
