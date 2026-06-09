import { useCallback, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { DarkScreen } from "../../src/components/DarkScreen";
import { MenuRow } from "../../src/components/MenuRow";
import { useSettings } from "../../src/store/settings";
import { api } from "../../src/lib/api";
import { isLoggedIn } from "../../src/lib/session";

export default function MoreTab() {
  const router = useRouter();
  const hydrate = useSettings((s) => s.hydrate);
  const [isCaptain, setIsCaptain] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useFocusEffect(
    useCallback(() => {
      hydrate();
      (async () => {
        const loggedIn = await isLoggedIn();
        if (!loggedIn) {
          setIsCaptain(false);
          setIsAdmin(false);
          return;
        }
        try {
          const res = await api<{ user: { role: string } }>("/api/auth/me");
          setIsCaptain(res.user.role === "CAPTAIN");
          setIsAdmin(res.user.role === "ADMIN");
        } catch {
          setIsCaptain(false);
          setIsAdmin(false);
        }
      })();
    }, [hydrate])
  );

  return (
    <DarkScreen title="المزيد">
      <ScrollView contentContainerStyle={styles.content}>
        {isAdmin && (
          <MenuRow
            icon="grid-outline"
            label="لوحة الإدارة — المتابعة المالية"
            onPress={() => router.push("/admin")}
          />
        )}
        {isCaptain && (
          <MenuRow
            icon="bicycle-outline"
            label="لوحة الكابتن — الطلبات والإحصائيات"
            onPress={() => router.push("/captain")}
          />
        )}
        <MenuRow
          icon="person-outline"
          label="الملف الشخصي"
          onPress={() => router.push("/account")}
        />
        <MenuRow
          icon="document-text-outline"
          label="الفواتير المدفوعة"
          onPress={() => router.push("/more/invoices")}
        />
        <MenuRow
          icon="language-outline"
          label="اللغة"
          onPress={() => router.push("/more/language")}
        />
        <MenuRow
          icon="notifications-outline"
          label="الإشعارات"
          onPress={() => router.push("/more/notifications")}
        />
        <MenuRow
          icon="heart-outline"
          label="المفضّل"
          onPress={() => router.push("/more/favorites")}
        />
        <MenuRow
          icon="shield-checkmark-outline"
          label="سياسة الخصوصية"
          onPress={() => router.push("/more/privacy")}
        />
        <View style={styles.spacer} />
        <MenuRow
          icon="headset-outline"
          label="خدمة العملاء"
          onPress={() => router.push("/more/support")}
        />
      </ScrollView>
    </DarkScreen>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 32 },
  spacer: { height: 8 },
});
