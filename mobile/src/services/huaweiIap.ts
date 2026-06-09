import { Platform } from "react-native";
import { api } from "../lib/api";
import { storeConfig } from "../config/store";

export type HuaweiPurchaseResult = {
  purchaseId: string;
  productId: string;
  purchaseToken?: string;
};

export function isHuaweiIapAvailable() {
  return Platform.OS === "android" && storeConfig.huaweiIapEnabled;
}

/**
 * دفع عبر Huawei IAP (AppGallery).
 * يتطلب: agconnect-services.json + @hmscore/react-native-hms-iap بعد prebuild.
 */
export async function purchaseOrder(
  orderId: string,
  amount: number
): Promise<HuaweiPurchaseResult> {
  const productId = `order_${orderId}`;

  if (isHuaweiIapAvailable()) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { HmsIapModule } = require("@hmscore/react-native-hms-iap") as {
        HmsIapModule?: {
          createPurchaseIntent: (p: { productId: string }) => Promise<{
            returnCode: number;
            inAppPurchaseData?: string;
            inAppDataSignature?: string;
          }>;
        };
      };

      if (HmsIapModule?.createPurchaseIntent) {
        const result = await HmsIapModule.createPurchaseIntent({ productId });
        if (result.returnCode !== 0 || !result.inAppPurchaseData) {
          throw new Error("فشل فتح نافذة الدفع من هواوي");
        }
        const data = JSON.parse(result.inAppPurchaseData) as {
          orderId?: string;
          productId?: string;
          purchaseToken?: string;
        };
        const purchase: HuaweiPurchaseResult = {
          purchaseId: data.orderId ?? `hw_${Date.now()}`,
          productId: data.productId ?? productId,
          purchaseToken: data.purchaseToken,
        };
        await verifyHuaweiPurchase(orderId, purchase);
        return purchase;
      }
    } catch {
      /* HMS غير مثبّت — محاكاة أدناه */
    }
  }

  if (storeConfig.appEnv === "production") {
    throw new Error("الدفع عبر هواوي غير مفعّل — راجع إعدادات النشر");
  }

  await new Promise((r) => setTimeout(r, 800));
  const purchase: HuaweiPurchaseResult = {
    purchaseId: `dev_${Date.now()}`,
    productId,
    purchaseToken: `dev_token_${amount}`,
  };
  await verifyHuaweiPurchase(orderId, purchase);
  return purchase;
}

export async function verifyHuaweiPurchase(orderId: string, purchase: HuaweiPurchaseResult) {
  await api("/api/payment/huawei/verify", {
    method: "POST",
    body: JSON.stringify({
      orderId,
      huaweiPurchaseId: purchase.purchaseId,
      huaweiProductId: purchase.productId,
      purchaseToken: purchase.purchaseToken,
    }),
  });
}
