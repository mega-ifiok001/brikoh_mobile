import { useEffect, useRef } from "react";
import { AppState, Platform } from "react-native";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import * as SecureStore from "expo-secure-store";
import { useRouter } from "expo-router";
import { api } from "./api";
import { asList, fd } from "./format";

const CHANNEL = "default";
const POLL_MS = 45_000;
const SEEN_KEY = "brikoh.notif.lastSeen";

// Show banner + play the default notification sound even while the app is open.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

async function setupChannel() {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync(CHANNEL, {
    name: "Brikoh alerts",
    importance: Notifications.AndroidImportance.MAX,
    sound: "default",
    vibrationPattern: [0, 250, 200, 250],
    lightColor: "#ec6405",
  });
}

async function askPermission(): Promise<boolean> {
  const cur = await Notifications.getPermissionsAsync();
  if (cur.granted) return true;
  if (!cur.canAskAgain) return false;
  const res = await Notifications.requestPermissionsAsync();
  return res.granted;
}

// Registers this phone with the backend so it can send real push notifications.
// Returns true only if the backend accepted the token.
async function registerPushToken(): Promise<boolean> {
  try {
    if (!Device.isDevice) return false;
    const projectId = (Constants.expoConfig as any)?.extra?.eas?.projectId ?? (Constants as any).easConfig?.projectId;
    if (!projectId) return false;
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    await api.post("/api/dashboard/push-tokens", { token, platform: Platform.OS });
    return true;
  } catch {
    return false; // Expo Go on Android, no network, or the backend endpoint doesn't exist yet
  }
}

/* ------------------------- turn a backend alert into text ------------------------- */

function describe(n: any): { title: string; body: string; route?: string } {
  const s = n.snapshot || {};
  switch (n.kind) {
    case "LOW_STOCK":
      return { title: "Low stock", body: `${s.productName ?? "A product"} at ${s.branchName ?? "a branch"} — ${s.quantity ?? n.sentQuantity ?? "?"} left`, route: "/products" };
    case "EXPIRING_SOON":
      return { title: "Expiring soon", body: `${s.productName ?? "A product"} expiring${s.expiryDate ? ` ${fd(s.expiryDate)}` : " soon"}`, route: "/products" };
    case "PAYMENT_RECEIVED":
      return { title: "Payment received", body: s.amount ? `Payment of ${s.amount} received${s.customerName ? ` from ${s.customerName}` : ""}` : "Payment received", route: "/wallet" };
    default:
      return { title: "Brikoh", body: n.message || n.title || "You have a new alert", route: "/more" };
  }
}

/* ------------------------------ the hook used by the app ------------------------------ */

export function usePushNotifications(enabled: boolean) {
  const router = useRouter();
  const pushWorks = useRef(false);

  // Tapping a notification opens the right screen.
  useEffect(() => {
    if (Platform.OS === "web" || !enabled) return;
    const open = (resp: Notifications.NotificationResponse | null) => {
      const d: any = resp?.notification.request.content.data || {};
      const route = d.route || (d.orderId ? `/order/${d.orderId}` : undefined);
      if (route) setTimeout(() => router.push(route as any), 300);
    };
    Notifications.getLastNotificationResponseAsync().then(open).catch(() => {});
    const sub = Notifications.addNotificationResponseReceivedListener(open);
    return () => sub.remove();
  }, [enabled, router]);

  // Permission, channel, push-token registration.
  useEffect(() => {
    if (Platform.OS === "web" || !enabled) return;
    let alive = true;
    (async () => {
      await setupChannel();
      if (!(await askPermission())) return;
      const ok = await registerPushToken();
      if (alive) pushWorks.current = ok;
    })();
    return () => {
      alive = false;
    };
  }, [enabled]);

  // Fallback until the backend sends real pushes: check for new alerts while the app is open
  // and show them as normal phone notifications.
  useEffect(() => {
    if (Platform.OS === "web" || !enabled) return;
    let stopped = false;

    const check = async () => {
      if (stopped || pushWorks.current || AppState.currentState !== "active") return;
      try {
        const res: any = await api.get("/api/dashboard/notifications");
        const list = asList(res, "dispatches", "items", "notifications");
        const stamp = (n: any) => new Date(n.sentAt || n.createdAt || 0).getTime();
        const stored = await SecureStore.getItemAsync(SEEN_KEY).catch(() => null);
        const newest = list.reduce((m: number, n: any) => Math.max(m, stamp(n)), 0);

        if (!stored) {
          // First run: remember where we are, don't announce old alerts.
          await SecureStore.setItemAsync(SEEN_KEY, String(newest || Date.now())).catch(() => {});
          return;
        }
        const last = Number(stored);
        const fresh = list.filter((n: any) => stamp(n) > last).sort((a: any, b: any) => stamp(a) - stamp(b)).slice(-5);
        for (const n of fresh) {
          const d = describe(n);
          await Notifications.scheduleNotificationAsync({
            content: { title: d.title, body: d.body, sound: "default", data: { route: d.route } },
            trigger: Platform.OS === "android" ? { channelId: CHANNEL } : null,
          });
        }
        if (newest > last) await SecureStore.setItemAsync(SEEN_KEY, String(newest)).catch(() => {});
      } catch {}
    };

    const first = setTimeout(check, 4000);
    const timer = setInterval(check, POLL_MS);
    const appSub = AppState.addEventListener("change", (s) => {
      if (s === "active") check();
    });
    return () => {
      stopped = true;
      clearTimeout(first);
      clearInterval(timer);
      appSub.remove();
    };
  }, [enabled]);
}