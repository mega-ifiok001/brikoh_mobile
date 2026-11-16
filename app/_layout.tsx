import { useEffect } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useFonts } from "expo-font";
import { Manrope_500Medium, Manrope_600SemiBold, Manrope_700Bold, Manrope_800ExtraBold } from "@expo-google-fonts/manrope";
import { BricolageGrotesque_700Bold, BricolageGrotesque_800ExtraBold } from "@expo-google-fonts/bricolage-grotesque";
import { AuthProvider, useAuth } from "../src/context/AuthContext";
import { ToastHost } from "../src/components/ui";
import { C } from "../src/theme";

SplashScreen.preventAutoHideAsync().catch(() => {});

function Gate() {
  const { loading, isAuthed, isOnboarded } = useAuth();

  useEffect(() => {
    if (!loading) SplashScreen.hideAsync().catch(() => {});
  }, [loading]);

  if (loading) return null;

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.cream50 }, animation: "slide_from_right" }}>
      <Stack.Screen name="index" options={{ animation: "fade" }} />
      <Stack.Protected guard={isAuthed && isOnboarded}>
        <Stack.Screen name="(tabs)" options={{ animation: "fade" }} />
        <Stack.Screen name="order/[id]" />
        <Stack.Screen name="wallet" />
        <Stack.Screen name="customers" />
        <Stack.Screen name="(more)" />
      </Stack.Protected>
      <Stack.Protected guard={isAuthed && !isOnboarded}>
        <Stack.Screen name="setup" options={{ animation: "fade" }} />
      </Stack.Protected>
      <Stack.Protected guard={!isAuthed}>
        <Stack.Screen name="(auth)" options={{ animation: "fade" }} />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
    Manrope_800ExtraBold,
    BricolageGrotesque_700Bold,
    BricolageGrotesque_800ExtraBold,
  });

  // Never block the app on fonts forever — fall back to system fonts on error.
  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="dark" />
        <Gate />
        <ToastHost />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
