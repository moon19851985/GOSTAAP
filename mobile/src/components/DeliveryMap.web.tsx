import { createElement, useEffect, useMemo, useRef } from "react";
import { View, StyleSheet } from "react-native";
import type { MapLocation } from "./deliveryMapShared";
import {
  CAPTAIN_CAR_ICON_HEIGHT,
  CAPTAIN_CAR_ICON_WIDTH,
  captainCarTopIconHtml,
} from "./captainCarTopIcon";
import {
  LEAFLET_LAYER_TOGGLE_CSS,
  leafletLayerToggleHtml,
  leafletLayersInitScript,
} from "./mapLayerConfig";

type Props = {
  customer: MapLocation;
  restaurants?: MapLocation[];
  captain?: MapLocation | null;
  height?: number;
};

function escapeJs(s: string) {
  return s.replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/\n/g, " ");
}

function buildLeafletDoc(customer: MapLocation, restaurants: MapLocation[]) {
  const dotMarkers: { lat: number; lng: number; label: string; color: string }[] = [
    { lat: customer.lat, lng: customer.lng, label: customer.label ?? "العميل", color: "#E85D04" },
    ...restaurants.map((r) => ({
      lat: r.lat,
      lng: r.lng,
      label: r.label ?? "المطعم",
      color: "#2D6A4F",
    })),
  ];

  const dotJs = dotMarkers
    .map(
      (p) =>
        `L.circleMarker([${p.lat}, ${p.lng}], { radius: 10, color: '${p.color}', fillColor: '${p.color}', fillOpacity: 0.85 })
          .addTo(map).bindPopup('${escapeJs(p.label)}');`
    )
    .join("\n");

  const bounds = dotMarkers.map((p) => `[${p.lat}, ${p.lng}]`).join(", ");

  return `<!DOCTYPE html>
<html><head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>
html,body,#map{margin:0;height:100%;width:100%;}
.captain-car-marker{background:transparent;border:none;}
${LEAFLET_LAYER_TOGGLE_CSS}
</style>
</head><body>
${leafletLayerToggleHtml()}
<div id="map"></div>
<script>
var map = L.map('map', { zoomControl: true });
${leafletLayersInitScript()}
${dotJs}
map.fitBounds(L.latLngBounds([${bounds}]), { padding: [28, 28], maxZoom: 16 });

var carIcon = L.divIcon({
  className: 'captain-car-marker',
  html: '${escapeJs(captainCarTopIconHtml())}',
  iconSize: [${CAPTAIN_CAR_ICON_WIDTH}, ${CAPTAIN_CAR_ICON_HEIGHT}],
  iconAnchor: [${CAPTAIN_CAR_ICON_WIDTH / 2}, ${CAPTAIN_CAR_ICON_HEIGHT / 2}]
});
var captainMarker = null;

function setCaptain(lat, lng, label) {
  if (captainMarker) {
    captainMarker.setLatLng([lat, lng]);
    captainMarker.setPopupContent(label || 'الكابتن');
    return;
  }
  captainMarker = L.marker([lat, lng], { icon: carIcon, zIndexOffset: 1000 })
    .addTo(map).bindPopup(label || 'الكابتن');
}

function clearCaptain() {
  if (captainMarker) {
    map.removeLayer(captainMarker);
    captainMarker = null;
  }
}

window.addEventListener('message', function(e) {
  var d = e.data;
  if (!d || !d.type) return;
  if (d.type === 'gostasrv-captain-update' && typeof d.lat === 'number' && typeof d.lng === 'number') {
    setCaptain(d.lat, d.lng, d.label || 'الكابتن');
  } else if (d.type === 'gostasrv-captain-clear') {
    clearCaptain();
  }
});
</script></body></html>`;
}

export function DeliveryMap({ customer, restaurants = [], captain, height = 220 }: Props) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const restaurantsKey = useMemo(
    () => restaurants.map((r) => `${r.lat},${r.lng}`).join("|"),
    [restaurants]
  );

  const srcDoc = useMemo(
    () => buildLeafletDoc(customer, restaurants),
    [customer.lat, customer.lng, restaurantsKey]
  );

  useEffect(() => {
    const win = iframeRef.current?.contentWindow;
    if (!win) return;

    const send = () => {
      if (captain) {
        win.postMessage(
          {
            type: "gostasrv-captain-update",
            lat: captain.lat,
            lng: captain.lng,
            label: captain.label ?? "الكابتن",
          },
          "*"
        );
      } else {
        win.postMessage({ type: "gostasrv-captain-clear" }, "*");
      }
    };

    send();
    const t = setTimeout(send, 400);
    return () => clearTimeout(t);
  }, [captain?.lat, captain?.lng, captain?.label, captain]);

  return (
    <View style={[styles.wrap, { height }]}>
      {createElement("iframe", {
        ref: iframeRef,
        title: "خريطة التوصيل",
        srcDoc,
        style: {
          width: "100%",
          height: "100%",
          border: "none",
          borderRadius: 12,
        },
      })}
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
  },
});

export { MapNavButton, openMapsNavigation } from "./deliveryMapShared";
