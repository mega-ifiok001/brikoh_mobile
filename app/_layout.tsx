import { useEffect, useState } from "react";
import { View } from "react-native";
import { Stack, usePathname, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useFonts } from "expo-font";
import { Manrope_500Medium, Manrope_600SemiBold, Manrope_700Bold, Manrope_800ExtraBold } from "@expo-google-fonts/manrope";
import { BricolageGrotesque_700Bold, BricolageGrotesque_800ExtraBold } from "@expo-google-fonts/bricolage-grotesque";
import { AuthProvider, useAuth } from "../src/context/AuthContext";
import { ThemeBoundary, ThemeProvider, useTheme } from "../src/context/ThemeContext";
import { ToastHost, toast } from "../src/components/ui";
import { BrandSplash } from "../src/components/Loader";
import { C, themeSwitch } from "../src/theme";
import { usePushNotifications } from "../src/lib/notifications";
import { hasLaunchedBefore, markLaunched } from "../src/lib/launch";
import OfflineBanner from "../src/components/OfflineBanner";
import AppLock from "../src/components/AppLock";

SplashScreen.preventAutoHideAsync().catch(() => {});

const MIN_SPLASH_MS = 3200; // first launch only: long enough for the logo to roll in and the name to be typed out
const RETURNING_SPLASH_MS = 1200; // every launch after that

function Gate() {
  const { loading, isAuthed, isOnboarded, sessionExpired } = useAuth();
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
      let alive = true;
    let t: ReturnType<typeof setTimeout> | undefined;
    hasLaunchedBefore().then((seen) => {
      if (!alive) return;
      t = setTimeout(() => setMinDone(true), seen ? RETURNING_SPLASH_MS : MIN_SPLASH_MS);
      markLaunched();
    });
    return () => {
      alive = false;
      if (t) clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!themeSwitch.pending && pathname && pathname !== "/") themeSwitch.path = pathname;
  }, [pathname]);

  useEffect(() => {
    if (sessionExpired) toast.info("Your session expired. Please sign in again. Your current unsaved work may need to be re-entered.");
  }, [sessionExpired]);

  if (loading || !minDone) {
    return (
      <>
        <StatusBar style="light" />
        <BrandSplash />
      </>
    );
  }

  // The login screen is dark in both themes.
 const lightIcons =
  resolved === "dark" ||
  ["/login", "/welcome", "/forgot-password", "/reset-password", "/verify-email"].includes(pathname);

  return (
    <>
      <StatusBar style={lightIcons ? "light" : "dark"} />
            <View style={{ flex: 1 }}>
        <OfflineBanner />
        <View style={{ flex: 1 }}>
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
              </View>
        <AppLock active={isAuthed && isOnboarded} />
      </View>
      
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