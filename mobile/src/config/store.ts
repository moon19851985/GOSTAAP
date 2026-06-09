import Constants from "expo-constants";

export const ANDROID_PACKAGE = "com.gostasrv.app";

export const storeConfig = {
  packageName: ANDROID_PACKAGE,
  apiUrl: (Constants.expoConfig?.extra?.apiUrl as string) ?? "http://localhost:4000",
  appEnv: (Constants.expoConfig?.extra?.appEnv as string) ?? "development",
  privacyUrl: (Constants.expoConfig?.extra?.privacyUrl as string) ?? "",
  supportEmail: (Constants.expoConfig?.extra?.supportEmail as string) ?? "",
  huaweiIapEnabled: Boolean(Constants.expoConfig?.extra?.huaweiIapEnabled),
};

export function isProductionBuild() {
  return storeConfig.appEnv === "production";
}
