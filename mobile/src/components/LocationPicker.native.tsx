import { useState } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import MapView, { Marker, type MapPressEvent } from "react-native-maps";
import * as Location from "expo-location";
import { MapTypeToggle } from "./MapTypeToggle";
import type { MapLayerMode } from "./mapLayerConfig";

export const DEFAULT_LOCATION = { lat: 24.7136, lng: 46.6753 };

type Props = {
  lat: number;
  lng: number;
  onChange: (loc: { lat: number; lng: number }) => void;
  height?: number;
  hideAutoButton?: boolean;
  label?: string;
};

export function LocationPicker({
  lat,
  lng,
  onChange,
  height = 260,
  hideAutoButton = false,
  label = "📍 حدّد موقع المطعم على الخريطة",
}: Props) {
  const [mapLayer, setMapLayer] = useState<MapLayerMode>("standard");
  const [region, setRegion] = useState({
    latitude: lat,
    longitude: lng,
    latitudeDelta: 0.02,
    longitudeDelta: 0.02,
  });

  function applyPosition(latitude: number, longitude: number) {
    onChange({ lat: latitude, lng: longitude });
    setRegion({
      latitude,
      longitude,
      latitudeDelta: 0.02,
      longitudeDelta: 0.02,
    });
  }

  function onMapPress(e: MapPressEvent) {
    const { latitude, longitude } = e.nativeEvent.coordinate;
    applyPosition(latitude, longitude);
  }

  async function useMyLocation() {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") return;
    const loc = await Location.getCurrentPositionAsync({});
    applyPosition(loc.coords.latitude, loc.coords.longitude);
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.map, { height }]}>
        <MapView style={StyleSheet.absoluteFill} region={region} onPress={onMapPress}>
          <Marker
            coordinate={{ latitude: lat, longitude: lng }}
            title="موقع المطعم"
            pinColor="#E85D04"
            draggable
            onDragEnd={(e) => {
              const { latitude, longitude } = e.nativeEvent.coordinate;
              applyPosition(latitude, longitude);
            }}
          />
        </MapView>
        <MapTypeToggle value={mapLayer} onChange={setMapLayer} />
      </View>
      {!hideAutoButton ? (
        <Pressable style={styles.gpsBtn} onPress={useMyLocation}>
          <Text style={styles.gpsText}>استخدم موقعي الحالي</Text>
        </Pressable>
      ) : (
        <Text style={styles.dragHint}>اسحب العلامة أو اضغط على الخريطة لتحريك الموقع</Text>
      )}
      <Text style={styles.coords}>
        {lat.toFixed(5)}, {lng.toFixed(5)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 12 },
  label: { textAlign: "right", fontWeight: "600", marginBottom: 8, color: "#333" },
  map: {
    width: "100%",
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#E8F4F8",
    borderWidth: 2,
    borderColor: "#E85D04",
    position: "relative",
  },
  gpsBtn: {
    marginTop: 8,
    padding: 10,
    backgroundColor: "#FFF3EB",
    borderRadius: 8,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E85D04",
  },
  gpsText: { color: "#E85D04", fontWeight: "600" },
  dragHint: { color: "#666", fontSize: 12, marginTop: 8, textAlign: "center", lineHeight: 18 },
  coords: { textAlign: "center", color: "#888", fontSize: 12, marginTop: 6 },
});
