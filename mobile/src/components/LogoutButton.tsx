import { Pressable, Text, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { logout } from "../lib/session";
import { showAlert } from "../lib/alert";

type Props = {
  redirectTo?: string;
  label?: string;
  style?: object;
};

export function LogoutButton({
  redirectTo = "/auth",
  label = "تسجيل خروج",
  style,
}: Props) {
  const router = useRouter();

  async function handleLogout() {
    await logout();
    showAlert("تم", "تم تسجيل الخروج");
    router.replace(redirectTo);
  }

  return (
    <Pressable style={[styles.btn, style]} onPress={handleLogout}>
      <Text style={styles.text}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    backgroundColor: "#FFF",
    borderWidth: 1,
    borderColor: "#DC2626",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  text: { color: "#DC2626", fontWeight: "700", fontSize: 13 },
});
