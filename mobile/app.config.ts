import type { ExpoConfig } from "expo/config";

/**
 * إعدادات التطبيق — للتطوير والإنتاج.
 * للنشر: انسخ .env.production.example إلى .env.production وعدّل EXPO_PUBLIC_API_URL
 */
export default (): ExpoConfig => {
  const apiUrl =
    process.env.EXPO_PUBLIC_API_URL?.trim() || "http://192.168.100.102:4000";

  return {
    name: "قسطاس",
    slug: "gostasrv",
    version: "1.0.0",
    orientation: "portrait",
    scheme: "gostasrv",
    userInterfaceStyle: "light",
    newArchEnabled: true,
    splash: {
      backgroundColor: "#E85D04",
      resizeMode: "contain",
    },
    plugins: [
      "expo-router",
      [
        "expo-image-picker",
        {
          photosPermission: "نحتاج الوصول للصور لرفع صورة المنتج.",
        },
      ],
      [
        "expo-location",
        {
          locationAlwaysAndWhenInUsePermission:
            "نحتاج موقعك لحساب التوصيل وتتبع الطلب.",
        },
      ],
      [
        "expo-notifications",
        {
          color: "#E85D04",
          defaultChannel: "captain-orders",
        },
      ],
      "expo-asset",
      "./plugins/withAndroidReleaseSigning.js",
      "./plugins/withHuaweiAgconnect.js",
    ],
    android: {
      package: "com.gostasrv.app",
      versionCode: 1,
      adaptiveIcon: {
        backgroundColor: "#E85D04",
      },
      permissions: [
        "ACCESS_FINE_LOCATION",
        "ACCESS_COARSE_LOCATION",
        "POST_NOTIFICATIONS",
        "VIBRATE",
        "RECEIVE_BOOT_COMPLETED",
      ],
    },
    ios: {
      bundleIdentifier: "com.gostasrv.app",
      infoPlist: {
        UIBackgroundModes: ["remote-notification"],
      },
    },
    extra: {
      apiUrl,
      appEnv: process.env.APP_ENV ?? "development",
      privacyUrl: process.env.EXPO_PUBLIC_PRIVACY_URL ?? "",
      supportEmail: process.env.EXPO_PUBLIC_SUPPORT_EMAIL ?? "",
      huaweiIapEnabled: process.env.EXPO_PUBLIC_HUAWEI_IAP === "true",
      router: {},
    },
  };
};
