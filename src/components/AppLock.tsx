// Full-screen lock shown over the app when app lock is on. Mounted once, in app/_layout.tsx.
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, AppState, Platform, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../context/AuthContext";
import { authenticate, forceDisableLock, isLockSupported, LOCK_GRACE_MS, markLocked, markUnlocked, useAppLockState } from "../lib/appLock";
import { Button, T, toast } from "./ui";
import { C } from "../theme";

export default function AppLock({ active }: { active: boolean }) {
  const { logout } = useAuth();
  const { loaded, enabled, unlocked } = useAppLockState();
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);

  // Signed out / still setting up: nothing to protect, and signing in shouldn't trigger a lock.
  useEffect(() => {
    if (!active) markUnlocked();
  }, [active]);

  // Re-lock after the app has been in the background for a while.
  useEffect(() => {
    if (!active || !enabled || Platform.OS === "web") return undefined;
    let leftAt: number | null = null;
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "background") leftAt = Date.now();
      else if (s === "active" && leftAt !== null) {
        if (Date.now() - leftAt > LOCK_GRACE_MS && !busyRef.current) markLocked();
        leftAt = null;
      }
    });
    return () => sub.remove();
  }, [active, enabled]);

  const visible = active && Platform.OS !== "web" && (!loaded || (enabled && !unlocked));

  const unlock = useCallback(async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      if (!(await isLockSupported())) {
        // The phone's screen lock was removed since the lock was turned on; don't trap the user.
        await forceDisableLock();
        toast.info("App lock was turned off because this phone has no screen lock.");
        return;
      }
      if (await authenticate("Unlock Brikoh")) markUnlocked();
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, []);

  // Prompt automatically as soon as the lock appears.
  useEffect(() => {
    if (!visible || !loaded) return undefined;
    const t = setTimeout(unlock, 350);
    return () => clearTimeout(t);
  }, [visible, loaded, unlock]);

  if (!visible) return null;

  return (
    <View style={[StyleSheet.absoluteFill, { zIndex: 100, backgroundColor: C.night, alignItems: "center", justifyContent: "center", padding: 28 }]}>
      {!loaded ? (
        <ActivityIndicator color={C.brand} />
      ) : (
        <>
          <View style={{ width: 76, height: 76, borderRadius: 26, backgroundColor: C.brand, alignItems: "center", justifyContent: "center" }}>
            <Ionicons name="lock-closed" size={34} color="#fff" />
          </View>
          <T w="display" size={26} color={C.onNight} style={{ marginTop: 20 }}>
            Brikoh is locked
          </T>
          <T w="regular" size={14} color={C.nightMuted} style={{ marginTop: 6, textAlign: "center", lineHeight: 21 }}>
            Use Face ID, your fingerprint or your phone passcode to continue.
          </T>
          <View style={{ width: "100%", maxWidth: 320, marginTop: 28, gap: 6 }}>
            <Button label="Unlock" icon="finger-print" onPress={unlock} busy={busy} />
            <Button label="Sign out instead" variant="ghost" onPress={logout} />
          </View>
        </>
      )}
    </View>
  );
}