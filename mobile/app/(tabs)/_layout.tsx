import { useEffect, useMemo, useState } from "react";
import { Platform } from "react-native";
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "../../src/lib/api";
import { isLoggedIn } from "../../src/lib/session";
import { colors } from "../../src/theme/colors";

function useTabBarBottomInset() {
  const insets = useSafeAreaInsets();
  return useMemo(() => {
    if (Platform.OS !== "web") return Math.max(insets.bottom, 8);
    const mobileWeb =
      typeof window !== "undefined" &&
      Math.min(window.innerWidth, window.innerHeight) < 768;
    return Math.max(insets.bottom, mobileWeb ? 24 : 12);
  }, [insets.bottom]);
}

export default function TabsLayout() {
  const [role, setRole] = useState<string | null>(null);
  const tabBarBottom = useTabBarBottomInset();
  const tabBarHeight = 52 + tabBarBottom;

  useEffect(() => {
    (async () => {
      if (!(await isLoggedIn())) {
        setRole("GUEST");
        return;
      }
      try {
        const res = await api<{ user: { role: string } }>("/api/auth/me");
        setRole(res.user.role);
      } catch {
        setRole("GUEST");
      }
    })();
  }, []);

  const isCaptain = role === "CAPTAIN";
  const isRestaurant = role === "RESTAURANT";

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.bg,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: tabBarHeight,
          paddingBottom: tabBarBottom,
          paddingTop: 8,
        },
        tabBarActiveTintColor: colors.tabActive,
        tabBarInactiveTintColor: colors.tabInactive,
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600", marginBottom: 2 },
        tabBarIconStyle: { marginTop: 2 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "الرئيسية",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: "الطلبات",
          href: isCaptain || isRestaurant ? null : undefined,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="receipt-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="offers"
        options={{
          title: "العروض",
          href: isCaptain ? null : undefined,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="pricetag-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: "المزيد",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="menu-outline" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
