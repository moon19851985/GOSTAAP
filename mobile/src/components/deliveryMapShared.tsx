import { Platform, Pressable, StyleSheet, Text, Linking } from "react-native";

export type MapLocation = {
  lat: number;
  lng: number;
  label?: string;
};

export function openMapsNavigation(lat: number, lng: number) {
  const url =
    Platform.OS === "ios"
      ? `maps://app?daddr=${lat},${lng}`
      : Platform.OS === "android"
        ? `google.navigation:q=${lat},${lng}`
        : `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;

  Linking.openURL(url).catch(() => {
    Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`);
  });
}

export function MapNavButton({
  lat,
  lng,
  label = "🧭 توجيه GPS لموقع العميل",
}: {
  lat: number;
  lng: number;
  label?: string;
}) {
  return (
    <Pressable style={styles.navBtn} onPress={() => openMapsNavigation(lat, lng)}>
      <Text style={styles.navBtnText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  navBtn: {
    backgroundColor: "#FFF3EB",
    borderWidth: 1,
    borderColor: "#E85D04",
    padding: 10,
    borderRadius: 8,
    alignItems: "center",
    marginBottom: 4,
  },
  navBtnText: { color: "#E85D04", fontWeight: "700" },
});
