import { Stack, router } from "expo-router";
import { I18nManager } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useEffect } from "react";
import * as Notifications from "expo-notifications";
import { colors } from "../src/theme/colors";
import { useSettings } from "../src/store/settings";
import { configureCaptainNotificationHandler } from "../src/lib/captainNotifications";

if (!I18nManager.isRTL) {
  I18nManager.allowRTL(true);
  I18nManager.forceRTL(true);
}

export default function RootLayout() {
  const hydrate = useSettings((s) => s.hydrate);

  useEffect(() => {
    hydrate();
    configureCaptainNotificationHandler();

    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as { screen?: string };
      if (data?.screen === "captain") {
        router.push("/captain");
      }
    });
    return () => sub.remove();
  }, [hydrate]);

  return (
    <SafeAreaProvider>
      <Stack
        screenOptions={{
          headerTitleAlign: "center",
          headerBackTitle: "رجوع",
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.text,
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="more" options={{ headerShown: false }} />
        <Stack.Screen name="auth" options={{ headerShown: false }} />
        <Stack.Screen name="cart" options={{ title: "السلة", presentation: "modal" }} />
        <Stack.Screen name="payment" options={{ title: "الدفع", presentation: "modal" }} />
        <Stack.Screen name="admin" options={{ headerShown: false }} />
        <Stack.Screen name="restaurant" options={{ headerShown: false }} />
        <Stack.Screen name="restaurant-products" options={{ headerShown: false }} />
        <Stack.Screen name="restaurant-logo" options={{ headerShown: false }} />
        <Stack.Screen name="add-product" options={{ headerShown: false }} />
        <Stack.Screen name="add-promotion" options={{ headerShown: false }} />
        <Stack.Screen name="add-delivery-offer" options={{ headerShown: false }} />
        <Stack.Screen name="add-package" options={{ headerShown: false }} />
        <Stack.Screen name="add-combo-meal" options={{ headerShown: false }} />
        <Stack.Screen name="captain" options={{ headerShown: false }} />
        <Stack.Screen name="coffee-sweets" options={{ headerShown: false }} />
        <Stack.Screen name="daily-offers/[slot]" options={{ headerShown: false }} />
        <Stack.Screen name="fast-delivery" options={{ headerShown: false }} />
        <Stack.Screen name="menu/[restaurantId]" options={{ title: "قائمة المطعم" }} />
        <Stack.Screen name="track/[orderId]" options={{ title: "تتبع الطلب" }} />
        <Stack.Screen name="account" options={{ headerShown: false }} />
        <Stack.Screen name="orders/index" options={{ headerShown: false }} />
      </Stack>
    </SafeAreaProvider>
  );
}
