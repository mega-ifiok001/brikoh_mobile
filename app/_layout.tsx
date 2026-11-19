import { useEffect, useState } from "react";
import { Stack, usePathname, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useFonts } from "expo-font";
import { Manrope_500Medium, Manrope_600SemiBold, Manrope_700Bold, Manrope_800ExtraBold } from "@expo-google-fonts/manrope";
import { BricolageGrotesque_700Bold, BricolageGrotesque_800ExtraBold } from "@expo-google-fonts/bricolage-grotesque";
import { AuthProvider, useAuth } from "../src/context/AuthContext";
import { ThemeBoundary, ThemeProvider, useTheme } from "../src/context/ThemeContext";
import { ToastHost } from "../src/components/ui";
import { BrandSplash } from "../src/components/Loader";
import { C, themeSwitch } from "../src/theme";
import { usePushNotifications } from "../src/lib/notifications";

SplashScreen.preventAutoHideAsync().catch(() => {});

const MIN_SPLASH_MS = 3200; // long enough for the logo to roll in and the name to be typed out

function Gate() {
  const { loading, isAuthed, isOnboarded } = useAuth();
  const { resolved } = useTheme();
  const router = useRouter();
  const pathname = usePathname();
    usePushNotifications(isAuthed && isOnboarded);
  // After a theme switch the tree re-mounts: skip the launch animation and go back to where the user was.
  const [minDone, setMinDone] = useState(themeSwitch.pending);

  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});
    if (themeSwitch.pending) {
      const t = setTimeout(() => {
        router.replace(themeSwitch.path as any);
        themeSwitch.pending = false;
      }, 60);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setMinDone(true), MIN_SPLASH_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!themeSwitch.pending && pathname && pathname !== "/") themeSwitch.path = pathname;
  }, [pathname]);

  if (loading || !minDone) {
    return (
      <>
        <StatusBar style="light" />
        <BrandSplash />
      </>
    );
  }

  // The login screen is dark in both themes.
  const lightIcons = resolved === "dark" || pathname === "/login" || pathname === "/welcome";

  return (
    <>
      <StatusBar style={lightIcons ? "light" : "dark"} />
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
    </>
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
      <ThemeProvider>
        <AuthProvider>
          <ThemeBoundary>
            <Gate />
            <ToastHost />
          </ThemeBoundary>
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}