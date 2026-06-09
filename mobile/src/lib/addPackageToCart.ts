import type { MealPackage } from "../types/package";
import type { CartItem } from "../store/cart";

export function packageToCartLines(pkg: MealPackage): Omit<CartItem, "quantity">[] {
  const catalogTotal = pkg.items.reduce(
    (s, i) => s + i.productPrice * i.quantity,
    0
  );
  if (catalogTotal <= 0) return [];

  return pkg.items.map((item) => {
    const share = (item.productPrice * item.quantity) / catalogTotal;
    const lineTotal = pkg.price * share;
    const unitPrice = Math.round((lineTotal / item.quantity) * 100) / 100;
    return {
      productId: item.productId,
      name: `${item.productName} (${pkg.name})`,
      price: unitPrice,
      restaurantId: pkg.restaurant.id,
      restaurantName: pkg.restaurant.name,
      imageUrl: pkg.imageUrl,
    };
  });
}
