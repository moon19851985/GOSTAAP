import { createElement, useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { requestWebGpsOnUserGesture, webAllowsGps } from "../lib/customerLocation";
import {
  LEAFLET_LAYER_TOGGLE_CSS,
  leafletLayerToggleHtml,
  leafletLayersInitScript,
} from "./mapLayerConfig";

export const DEFAULT_LOCATION = { lat: 24.7136, lng: 46.6753 };

type Props = {
  lat: number;
  lng: number;
  onChange: (loc: { lat: number; lng: number }) => void;
  height?: number;
  hideAutoButton?: boolean;
  label?: string;
};

function buildPickerDoc(lat: number, lng: number) {
  return `<!DOCTYPE html>
<html><head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>
html,body,#map{margin:0;height:100%;width:100%;}
.hint{position:absolute;z-index:1000;top:8px;left:8px;right:8px;background:#fff;padding:8px;border-radius:8px;font-family:sans-serif;font-size:13px;text-align:center;box-shadow:0 1px 4px rgba(0,0,0,.2);}
${LEAFLET_LAYER_TOGGLE_CSS}
</style>
</head><body>
<div class="hint">اضغط على الخريطة لتحديد موقعك — أو اسحب العلامة</div>
${leafletLayerToggleHtml("picker")}
<div id="map"></div>
<script>
var pos = { lat: ${lat}, lng: ${lng} };
var map = L.map('map').setView([pos.lat, pos.lng], 15);
${leafletLayersInitScript()}
var marker = L.marker([pos.lat, pos.lng], { draggable: true }).addTo(map);
function send() {
  var ll = marker.getLatLng();
  parent.postMessage({ type: 'gostasrv-location', lat: ll.lat, lng: ll.lng }, '*');
}
marker.on('dragend', send);
map.on('click', function(e) {
  marker.setLatLng(e.latlng);
  send();
});
</script></body></html>`;
}

export function LocationPicker({
  lat,
  lng,
  onChange,
  height = 260,
  hideAutoButton = false,
  label = "📍 حدّد موقعك على الخريطة",
}: Props) {
  const [display, setDisplay] = useState({ lat, lng });
  const [gpsHint, setGpsHint] = useState<string | null>(null);
  const [mapKey, setMapKey] = useState(0);
  const skipRemount = useRef(false);

  useEffect(() => {
    if (skipRemount.current) {
      skipRemount.current = false;
      setDisplay({ lat, lng });
      return;
    }
    setDisplay({ lat, lng });
    setMapKey((k) => k + 1);
  }, [lat, lng]);

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      const data = e.data as { type?: string; lat?: number; lng?: number };
      if (data?.type === "gostasrv-location" && typeof data.lat === "number" && typeof data.lng === "number") {
        skipRemount.current = true;
        setDisplay({ lat: data.lat, lng: data.lng });
        onChange({ lat: data.lat, lng: data.lng });
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [onChange]);

  const srcDoc = buildPickerDoc(display.lat, display.lng);

  function useMyLocation() {
    setGpsHint(null);
    requestWebGpsOnUserGesture((result) => {
      if (!result.ok) {
        setGpsHint(result.message);
        return;
      }
      setGpsHint(null);
      const next = { lat: result.lat, lng: result.lng };
      setDisplay(next);
      onChange(next);
      setMapKey((k) => k + 1);
    });
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.map, { height }]} key={mapKey}>
        {createElement("iframe", {
          title: "اختيار الموقع",
          srcDoc,
          style: { width: "100%", height: "100%", border: "none", borderRadius: 12 },
        })}
      </View>
      {!hideAutoButton && webAllowsGps() ? (
        <>
          <Pressable style={styles.gpsBtn} onPress={useMyLocation}>
            <Text style={styles.gpsText}>📍 السماح بتحديد موقعي تلقائياً</Text>
          </Pressable>
          {gpsHint ? <Text style={styles.gpsHint}>{gpsHint}</Text> : null}
        </>
      ) : !hideAutoButton ? (
        <Text style={styles.gpsHint}>اضغط على الخريطة أو اسحب العلامة لتحديد موقعك</Text>
      ) : (
        <Text style={styles.dragHint}>اسحب العلامة 🟠 أو اضغط على الخريطة لتحريك الموقع</Text>
      )}
      <Text style={styles.coords}>
        {display.lat.toFixed(5)}, {display.lng.toFixed(5)}
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
  gpsHint: { color: "#B91C1C", fontSize: 12, marginTop: 6, textAlign: "center", lineHeight: 18 },
  dragHint: { color: "#666", fontSize: 12, marginTop: 6, textAlign: "center", lineHeight: 18 },
  coords: { textAlign: "center", color: "#888", fontSize: 12, marginTop: 6 },
});
