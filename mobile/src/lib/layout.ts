import { useWindowDimensions } from "react-native";

const H_PAD = 12;

export function useMobileLayout() {
  const { width, height } = useWindowDimensions();
  const isPhone = width < 768;

  return {
    width,
    height,
    isPhone,
    horizontalPad: H_PAD,
    /** عرض بطاقة العرض — casi full width على الجوال */
    promoCardWidth: width - H_PAD * 2,
    /** ارتفاع بطاقة العرض — كل المحتوى على الصورة */
    promoImageHeight: Math.round(Math.min(width * 0.78, isPhone ? 340 : 400)),
    promoImageHeightCompact: Math.round(Math.min(width * 0.62, 260)),
    /** بطاقات المنتجات في القائمة الأفقية */
    productCardWidth: Math.round(Math.min(152, width * 0.42)),
    productImageHeight: Math.round(Math.min(112, width * 0.28)),
    /** بطاقات البكجات — عرض أكبر للكاروسيل */
    packageCardWidth: Math.round(Math.min(300, width * 0.82)),
    packageImageHeight: Math.round(Math.min(180, width * 0.45)),
  };
}

export { H_PAD };
