import Constants from "expo-constants";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

/** على المتصفح: IP الصفحة. على التطبيق المثبّت: EXPO_PUBLIC_API_URL من الإنتاج. */
function resolveApiUrl(): string {
  const fromConfig = Constants.expoConfig?.extra?.apiUrl as string | undefined;
  const appEnv = Constants.expoConfig?.extra?.appEnv as string | undefined;

  if (appEnv === "production" && fromConfig) {
    return fromConfig;
  }

  if (Platform.OS === "web" && typeof window !== "undefined") {
    const { hostname } = window.location;
    if (hostname && hostname !== "localhost" && hostname !== "127.0.0.1") {
      return `http://${hostname}:4000`;
    }
  }
  return fromConfig ?? "http://localhost:4000";
}

const API_URL = resolveApiUrl();

export async function getToken() {
  return AsyncStorage.getItem("token");
}

function parseError(data: unknown, status?: number): string {
  if (!data || typeof data !== "object") {
    return status ? `خطأ في الطلب (${status})` : "خطأ في الطلب";
  }
  const body = data as { error?: unknown; message?: unknown };
  const err = body.error;
  if (typeof err === "string") return err;
  if (typeof body.message === "string") return body.message;
  if (err && typeof err === "object") {
    const flat = err as { fieldErrors?: Record<string, string[]>; formErrors?: string[] };
    const fields = flat.fieldErrors
      ? Object.entries(flat.fieldErrors)
          .map(([k, v]) => `${k}: ${v?.join(", ")}`)
          .join("\n")
      : "";
    const form = flat.formErrors?.join("\n") ?? "";
    const msg = [form, fields].filter(Boolean).join("\n");
    if (msg) return msg;
  }
  return "خطأ في الطلب";
}

export async function api<T>(
  path: string,
  options: RequestInit & { auth?: boolean } = {}
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (options.auth !== false) {
    const token = await getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);

  try {
    const res = await fetch(`${API_URL}${path}`, {
      ...options,
      headers,
      signal: controller.signal,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (res.status === 401) throw new Error("يجب تسجيل الدخول أولاً");
      if (res.status === 404 && path.includes("delivery-offers")) {
        throw new Error(
          "المسار غير موجود على الخادم — أوقف الخادم ثم شغّله من مجلد backend: npm run dev"
        );
      }
      const serverMsg = parseError(data, res.status);
      if (res.status === 403) {
        throw new Error(serverMsg !== "خطأ في الطلب" ? serverMsg : "ليس لديك صلاحية لهذا الإجراء");
      }
      throw new Error(serverMsg);
    }
    return data as T;
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      throw new Error(
        "انتهت مهلة الاتصال. تأكد أن الخادم يعمل: cd backend && npm run dev"
      );
    }
    if (e instanceof TypeError && e.message.includes("fetch")) {
      throw new Error(
        `لا يمكن الاتصال بالخادم (${API_URL}). شغّل backend على المنفذ 4000`
      );
    }
    throw e;
  } finally {
    clearTimeout(timeout);
  }
}

export { API_URL };
