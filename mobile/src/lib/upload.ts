import { Platform } from "react-native";
import { API_URL } from "./api";

export type PickedImage = {
  uri: string;
  name: string;
  type: string;
};

/** يحوّل رابط الصورة من API إلى URL يعمل على الجهاز الحالي (IP الشبكة / localhost) */
export function resolveImageUrl(url?: string | null): string | null {
  if (!url) return null;
  const base = API_URL.replace(/\/$/, "");

  if (url.startsWith("http://") || url.startsWith("https://")) {
    try {
      const parsed = new URL(url);
      const path = `${parsed.pathname}${parsed.search}`;
      if (path.startsWith("/uploads/")) {
        return `${base}${path}`;
      }
      if (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1") {
        return `${base}${path}`;
      }
    } catch {
      return url;
    }
    return url;
  }

  return `${base}${url.startsWith("/") ? url : `/${url}`}`;
}

export async function appendImageToForm(form: FormData, image: PickedImage) {
  const name = image.name || "photo.jpg";
  const type = image.type || "image/jpeg";

  if (Platform.OS === "web") {
    const res = await fetch(image.uri);
    const blob = await res.blob();
    form.append("image", blob, name);
    return;
  }

  form.append("image", {
    uri: image.uri,
    name,
    type,
  } as unknown as Blob);
}
