import type { Promotion } from "./promotion";

export type StarterMeal = Promotion & {
  restaurant: Promotion["restaurant"] & {
    logoUrl?: string | null;
    lat: number;
    lng: number;
  };
};
