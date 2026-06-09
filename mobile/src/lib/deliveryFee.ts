import { formatMoney } from "./formatMoney";

const RATE_PER_KM = 2.5;
const MIN_FEE = 5;
const MAX_FEE = 150;

export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function estimateRestaurantDeliveryFee(
  restaurantLat: number,
  restaurantLng: number,
  customerLat: number,
  customerLng: number
): number {
  const km = haversineKm(restaurantLat, restaurantLng, customerLat, customerLng);
  const fee = Math.max(MIN_FEE, km * RATE_PER_KM);
  return Math.min(Math.round(fee * 100) / 100, MAX_FEE);
}

export function estimateEtaMinutes(
  restaurantLat: number,
  restaurantLng: number,
  customerLat: number,
  customerLng: number
): number {
  const km = haversineKm(restaurantLat, restaurantLng, customerLat, customerLng);
  return Math.min(55, Math.max(15, Math.round(12 + km * 4)));
}

export function formatDeliveryFeeLabel(fee: number): string {
  return `${formatMoney(fee)} ر.س`;
}

export function formatEtaLabel(minutes: number): string {
  return `${minutes} دقيقة`;
}

export function formatDistanceKm(
  restaurantLat: number,
  restaurantLng: number,
  customerLat: number,
  customerLng: number
): string {
  const km = haversineKm(restaurantLat, restaurantLng, customerLat, customerLng);
  return `${km.toFixed(1)} كم`;
}

export function restaurantDeliveryMeta(
  restaurantLat: number,
  restaurantLng: number,
  customerLat: number | null,
  customerLng: number | null
): { eta: string; feeLabel: string } {
  if (customerLat == null || customerLng == null) {
    return { eta: "—", feeLabel: "حدّد موقعك" };
  }
  const fee = estimateRestaurantDeliveryFee(restaurantLat, restaurantLng, customerLat, customerLng);
  const minutes = estimateEtaMinutes(restaurantLat, restaurantLng, customerLat, customerLng);
  return {
    eta: formatEtaLabel(minutes),
    feeLabel: formatDeliveryFeeLabel(fee),
  };
}
