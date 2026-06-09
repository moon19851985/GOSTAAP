import { Stack } from "expo-router";
import { colors } from "../../src/theme/colors";

export default function MoreStackLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.bg },
        animation: "slide_from_left",
      }}
    />
  );
}
