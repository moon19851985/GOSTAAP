export type PackageItemLine = {
  productId: string;
  productName: string;
  quantity: number;
  productPrice: number;
};

export type RestaurantPackageItem = PackageItemLine & {
  id?: string;
};

export type MealPackage = {
  id: string;
  name: string;
  description?: string | null;
  price: number;
  originalPrice?: number;
  imageUrl?: string | null;
  items: PackageItemLine[] | RestaurantPackageItem[];
  restaurant: {
    id: string;
    name: string;
    logoUrl?: string | null;
  };
};
