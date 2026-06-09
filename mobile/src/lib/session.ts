import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCart } from "../store/cart";

export async function logout() {
  await AsyncStorage.removeItem("token");
  useCart.getState().clear();
}

export async function isLoggedIn() {
  const token = await AsyncStorage.getItem("token");
  return Boolean(token);
}
