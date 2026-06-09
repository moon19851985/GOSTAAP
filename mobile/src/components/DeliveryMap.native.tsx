import { useMemo, useState } from "react";
import { View, StyleSheet } from "react-native";
import MapView, { Marker } from "react-native-maps";
import type { MapLocation } from "./deliveryMapShared";
import { CaptainCarTopIcon } from "./CaptainCarTopIcon";
import { MapTypeToggle } from "./MapTypeToggle";
import type { MapLayerMode } from "./mapLayerConfig";

type Props = {
  customer: MapLocation;
  restaurants?: MapLocation[];
  captain?: MapLocation | null;
  height?: number;
};

function CarMarker({ label }: { label?: string }) {
  return (
    <View accessibilityLabel={label ?? "الكابتن"}>
      <CaptainCarTopIcon size={36} />
    </View>
  );
}

export function DeliveryMap({ customer, restaurants = [], captain, height = 220 }: Props) {
  const [mapLayer, setMapLayer] = useState<MapLayerMode>("standard");
  const region = useMemo(
    () => ({
      latitude: customer.lat,
      longitude: customer.lng,
      latitudeDelta: 0.04,
      longitudeDelta: 0.04,
    }),
    [customer.lat, customer.lng]
  );

  return (
    <View style={[styles.wrap, { height }]}>
      <MapView
        style={styles.map}
        initialRegion={region}
        showsUserLocation
        mapType={mapLayer === "satellite" ? "satellite" : "standard"}
      >
        <Marker
          coordinate={{ latitude: customer.lat, longitude: customer.lng }}
          title={customer.label ?? "العميل"}
          pinColor="#E85D04"
        />
        {restaurants.map((r, idx) => (
          <Marker
            key={`r-${idx}`}
            coordinate={{ latitude: r.lat, longitude: r.lng }}
            title={r.label ?? "المطعم"}
            pinColor="#2D6A4F"
          />
        ))}
        {captain && (
          <Marker
            coordinate={{ latitude: captain.lat, longitude: captain.lng }}
            title={captain.label ?? "الكابتن"}
            anchor={{ x: 0.5, y: 0.5 }}
            tracksViewChanges={false}
          >
            <CarMarker label={captain.label} />
          </Marker>
        )}
      </MapView>
      <MapTypeToggle value={mapLayer} onChange={setMapLayer} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: "100%",
    borderRadius: 12,
    overflow: "hidden",
    marginVertical: 10,
    backgroundColor: "#E8F4F8",
    position: "relative",
  },
  map: { width: "100%", height: "100%" },
});

export { MapNavButton, openMapsNavigation } from "./deliveryMapShared";
