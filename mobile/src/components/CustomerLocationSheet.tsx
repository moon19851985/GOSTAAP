import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  Modal,
  Pressable,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LocationPicker } from "./LocationPicker";
import { colors } from "../theme/colors";
import {
  applyCustomerLocation,
  detectGpsLocation,
  getStoredCustomerLocation,
  locationFromCity,
  locationFromCoords,
  SAUDI_CITIES,
  type CustomerLocation,
} from "../lib/customerLocation";
import { showAlert } from "../lib/alert";

type Props = {
  visible: boolean;
  onClose: () => void;
  onSaved: (loc: CustomerLocation) => void;
};

export function CustomerLocationSheet({ visible, onClose, onSaved }: Props) {
  const insets = useSafeAreaInsets();
  const [pickLat, setPickLat] = useState(24.7136);
  const [pickLng, setPickLng] = useState(46.6753);
  const [gpsLoading, setGpsLoading] = useState(false);

  useEffect(() => {
    if (!visible) return;
    void (async () => {
      const stored = await getStoredCustomerLocation();
      if (stored) {
        setPickLat(stored.lat);
        setPickLng(stored.lng);
      }
    })();
  }, [visible]);

  const saveCoords = useCallback(
    async (lat: number, lng: number) => {
      const loc = locationFromCoords(lat, lng);
      await applyCustomerLocation(loc);
      onSaved(loc);
      onClose();
    },
    [onClose, onSaved]
  );

  const useGps = useCallback(async () => {
    setGpsLoading(true);
    try {
      const { location, error } = await detectGpsLocation();
      if (location) {
        setPickLat(location.lat);
        setPickLng(location.lng);
        await applyCustomerLocation(location);
        onSaved(location);
        onClose();
        return;
      }
      showAlert(
        "تعذر تحديد الموقع تلقائياً",
        error ??
          "اختر موقعك على الخريطة أو من قائمة المدن، أو اسمح بالموقع من إعدادات المتصفح."
      );
    } finally {
      setGpsLoading(false);
    }
  }, [onClose, onSaved]);

  const pickCity = useCallback(
    async (city: (typeof SAUDI_CITIES)[number]) => {
      const loc = locationFromCity(city);
      await applyCustomerLocation(loc);
      onSaved(loc);
      onClose();
    },
    [onClose, onSaved]
  );

  const needsHttpsHint =
    Platform.OS === "web" &&
    typeof window !== "undefined" &&
    !window.isSecureContext;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View
          style={[
            styles.sheet,
            { paddingBottom: insets.bottom + 16, maxHeight: "92%" },
          ]}
        >
          <View style={styles.header}>
            <Pressable onPress={onClose} hitSlop={12}>
              <Text style={styles.closeBtn}>✕</Text>
            </Pressable>
            <Text style={styles.title}>موقع التوصيل</Text>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
            nestedScrollEnabled
          >
            <Pressable
              style={styles.gpsBtn}
              onPress={() => void useGps()}
              disabled={gpsLoading}
            >
              {gpsLoading ? (
                <ActivityIndicator color={colors.accentOrange} />
              ) : (
                <Text style={styles.gpsBtnText}>📍 استخدم موقعي الحالي (GPS)</Text>
              )}
            </Pressable>

            {needsHttpsHint ? (
              <Text style={styles.hint}>
                الرابط الحالي ليس https — GPS قد لا يعمل. حدّد موقعك على الخريطة أو اختر
                مدينتك.
              </Text>
            ) : null}

            <Text style={styles.sectionLabel}>حدّد على الخريطة</Text>
            <LocationPicker
              lat={pickLat}
              lng={pickLng}
              height={220}
              onChange={({ lat, lng }) => {
                setPickLat(lat);
                setPickLng(lng);
              }}
            />
            <Pressable style={styles.confirmBtn} onPress={() => void saveCoords(pickLat, pickLng)}>
              <Text style={styles.confirmBtnText}>تأكيد هذا الموقع</Text>
            </Pressable>

            <Text style={styles.sectionLabel}>أو اختر مدينة</Text>
            <View style={styles.cityGrid}>
              {SAUDI_CITIES.map((c) => (
                <Pressable
                  key={c.key}
                  style={styles.cityChip}
                  onPress={() => void pickCity(c)}
                >
                  <Text style={styles.cityChipText}>{c.nameAr}</Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 12,
    paddingHorizontal: 16,
  },
  header: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  title: { fontSize: 18, fontWeight: "800", color: colors.text },
  closeBtn: { fontSize: 22, color: colors.textMuted, padding: 4 },
  scrollContent: { paddingBottom: 24 },
  gpsBtn: {
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.accentOrange,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginBottom: 10,
  },
  gpsBtnText: { color: colors.accentOrange, fontWeight: "700", fontSize: 15 },
  hint: {
    color: colors.textMuted,
    fontSize: 12,
    textAlign: "right",
    marginBottom: 12,
    lineHeight: 18,
  },
  sectionLabel: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.text,
    textAlign: "right",
    marginBottom: 8,
    marginTop: 8,
  },
  confirmBtn: {
    backgroundColor: colors.accentOrange,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 8,
    marginBottom: 8,
  },
  confirmBtnText: { color: "#FFF", fontWeight: "800", fontSize: 15 },
  cityGrid: {
    flexDirection: "row-reverse",
    flexWrap: "wrap",
    gap: 8,
    justifyContent: "flex-start",
  },
  cityChip: {
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  cityChipText: { color: colors.text, fontWeight: "600", fontSize: 14 },
});
