import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";

export type AppLanguage = "ar" | "en";

type SettingsState = {
  notificationsEnabled: boolean;
  language: AppLanguage;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  setNotifications: (v: boolean) => Promise<void>;
  setLanguage: (lang: AppLanguage) => Promise<void>;
};

const KEY_NOTIF = "settings_notifications";
const KEY_LANG = "settings_language";

export const useSettings = create<SettingsState>((set, get) => ({
  notificationsEnabled: true,
  language: "ar",
  hydrated: false,
  hydrate: async () => {
    const [notif, lang] = await Promise.all([
      AsyncStorage.getItem(KEY_NOTIF),
      AsyncStorage.getItem(KEY_LANG),
    ]);
    set({
      notificationsEnabled: notif !== "0",
      language: lang === "en" ? "en" : "ar",
      hydrated: true,
    });
  },
  setNotifications: async (v) => {
    await AsyncStorage.setItem(KEY_NOTIF, v ? "1" : "0");
    set({ notificationsEnabled: v });
  },
  setLanguage: async (lang) => {
    await AsyncStorage.setItem(KEY_LANG, lang);
    set({ language: lang });
  },
}));
