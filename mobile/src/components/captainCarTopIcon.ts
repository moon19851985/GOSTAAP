export const CAPTAIN_CAR_ICON_WIDTH = 36;
export const CAPTAIN_CAR_ICON_HEIGHT = 44;

/** Top-down car SVG — bird's-eye view, front pointing up (north). */
export const CAPTAIN_CAR_TOP_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="44" viewBox="0 0 36 44" aria-hidden="true">
  <rect x="7" y="4" width="22" height="36" rx="9" fill="#2563EB" stroke="#1D4ED8" stroke-width="1.2"/>
  <rect x="9" y="6" width="18" height="7" rx="4" fill="#3B82F6"/>
  <rect x="9" y="14" width="18" height="9" rx="3" fill="#BFDBFE"/>
  <rect x="10" y="24" width="16" height="10" rx="2" fill="#1D4ED8"/>
  <rect x="10" y="34" width="16" height="4" rx="2" fill="#93C5FD"/>
</svg>`;

export function captainCarTopIconHtml(): string {
  return `<div style="width:${CAPTAIN_CAR_ICON_WIDTH}px;height:${CAPTAIN_CAR_ICON_HEIGHT}px;line-height:0;filter:drop-shadow(0 2px 3px rgba(0,0,0,0.35));">${CAPTAIN_CAR_TOP_SVG}</div>`;
}
