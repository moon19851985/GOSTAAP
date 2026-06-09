/** طبقات Leaflet (ويب) */
export const LEAFLET_STANDARD =
  "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
export const LEAFLET_SATELLITE =
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";

export type MapLayerMode = "standard" | "satellite";

export const LEAFLET_LAYER_TOGGLE_CSS = `
.map-layer-bar {
  position: absolute;
  z-index: 1000;
  top: 8px;
  right: 8px;
  display: flex;
  gap: 4px;
  direction: rtl;
  font-family: sans-serif;
}
.map-layer-btn {
  padding: 6px 10px;
  border: none;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  background: #fff;
  color: #333;
  box-shadow: 0 1px 4px rgba(0,0,0,.25);
}
.map-layer-btn.on {
  background: #0077B6;
  color: #fff;
}
.map-layer-bar-picker {
  top: auto;
  bottom: 12px;
}
`;

/** تهيئة طبقتين مع أزرار عادي / قمر صناعي داخل iframe */
export function leafletLayersInitScript(): string {
  return `
var _stdLayer = L.tileLayer('${LEAFLET_STANDARD}', { maxZoom: 19, attribution: '&copy; OpenStreetMap' });
var _satLayer = L.tileLayer('${LEAFLET_SATELLITE}', { maxZoom: 19, attribution: '&copy; Esri' });
var _activeLayer = _stdLayer.addTo(map);
var _layerMode = 'standard';
function switchMapLayer(mode) {
  if (_layerMode === mode) return;
  map.removeLayer(_activeLayer);
  _layerMode = mode;
  _activeLayer = mode === 'satellite' ? _satLayer : _stdLayer;
  _activeLayer.addTo(map);
  var bStd = document.getElementById('map-layer-standard');
  var bSat = document.getElementById('map-layer-satellite');
  if (bStd) bStd.classList.toggle('on', mode === 'standard');
  if (bSat) bSat.classList.toggle('on', mode === 'satellite');
}
`;
}

export function leafletLayerToggleHtml(variant?: "picker"): string {
  const extraClass = variant === "picker" ? " map-layer-bar-picker" : "";
  return `<div class="map-layer-bar${extraClass}">
  <button type="button" id="map-layer-satellite" class="map-layer-btn" onclick="switchMapLayer('satellite')">قمر صناعي</button>
  <button type="button" id="map-layer-standard" class="map-layer-btn on" onclick="switchMapLayer('standard')">عادي</button>
</div>`;
}
