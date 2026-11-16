import { Stack } from "expo-router";
import { C } from "../../src/theme";

// Pushed "manage" screens (expenses, invoices, settings…). Reached from the More tab.
export default function MoreLayout() {
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.cream50 }, animation: "slide_from_right" }} />;
}
