import { haversineKm, restaurantDeliveryMeta } from "./deliveryFee";

/** نطاق «توصيل أسرع» — مطاعم ضمن هذه الدائرة من موقع العميل */
export const FAST_DELIVERY_RADIUS_KM = 3;

export type RestaurantCoords = {
  id: string;
  name: string;
  logoUrl?: string | null;
  lat: number;
  lng: number;
  address?: string;
  productCount?: number;
};

export type NearbyRestaurant = RestaurantCoords & {
  distanceKm: number;
  eta: string;
  feeLabel: string;
};

export function filterRestaurantsWithinKm(
  restaurants: RestaurantCoords[],
  customerLat: number,
  customerLng: number,
  maxKm: number = FAST_DELIVERY_RADIUS_KM
): NearbyRestaurant[] {
  return restaurants
    .map((r) => {
      const distanceKm = haversineKm(customerLat, customerLng, r.lat, r.lng);
      const meta = restaurantDeliveryMeta(r.lat, r.lng, customerLat, customerLng);
      return { ...r, distanceKm, eta: meta.eta, feeLabel: meta.feeLabel };
    })
    .filter((r) => r.distanceKm <= maxKm)
    .sort((a, b) => a.distanceKm - b.distanceKm);
}
