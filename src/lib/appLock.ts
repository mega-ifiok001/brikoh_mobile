// App lock: ask for Face ID / fingerprint / phone passcode when Brikoh opens or returns after a while.
// The on/off switch is stored in SecureStore. Everything runs on the device.
import { useEffect, useState } from "react";
import { Platform } from "react-native";
import * as LocalAuthentication from "expo-local-authentication";
import * as SecureStore from "expo-secure-store";

const KEY = "brikoh_app_lock";
export const LOCK_GRACE_MS = 30_000; // leaving the app for less than this doesn't re-lock it

// Module-level on purpose: it must survive the theme switch, which re-mounts the whole tree.
const state = { loaded: false, enabled: false, unlocked: false };
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

async function persist(on: boolean) {
  try {
    await SecureStore.setItemAsync(KEY, on ? "1" : "0");
  } catch {
    /* best effort */
  }
}

export async function loadAppLock() {
  if (state.loaded) return;
  try {
    state.enabled = Platform.OS !== "web" && (await SecureStore.getItemAsync(KEY)) === "1";
  } catch {
    state.enabled = false;
  }
  state.loaded = true;
  notify();
}
loadAppLock(); // start reading at import time so the lock is ready before the splash ends

export async function isLockSupported(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  try {
    return (await LocalAuthentication.getEnrolledLevelAsync()) !== LocalAuthentication.SecurityLevel.NONE;
  } catch {
    return false;
  }
}

export async function authenticate(reason: string): Promise<boolean> {
  try {
    const r = await LocalAuthentication.authenticateAsync({ promptMessage: reason, cancelLabel: "Cancel" });
    return r.success;
  } catch {
    return false;
  }
}

export async function setAppLockEnabled(on: boolean): Promise<{ ok: boolean; message?: string }> {
  const supported = await isLockSupported();
  if (on && !supported) {
    return { ok: false, message: "Set up a screen lock (PIN, pattern, fingerprint or Face ID) in your phone's settings first." };
  }
  // Prove it works before turning it on (so nobody gets locked out), and prove it's the owner before turning it off.
  if (supported) {
    const ok = await authenticate(on ? "Confirm to turn on app lock" : "Confirm to turn off app lock");
    if (!ok) return { ok: false, message: "Couldn't verify it's you, so app lock wasn't changed." };
  }
  state.enabled = on;
  state.unlocked = true;
  await persist(on);
  notify();
  return { ok: true };
}

/** Used when the phone no longer has any screen lock: the lock can't be passed, so switch it off. */
export async function forceDisableLock() {
  state.enabled = false;
  state.unlocked = true;
  await persist(false);
  notify();
}

export function markLocked() {
  state.unlocked = false;
  notify();
}
export function markUnlocked() {
  if (!state.unlocked) {
    state.unlocked = true;
    notify();
  }
}

export function useAppLockState() {
  const [, force] = useState(0);
  useEffect(() => {
    const l = () => force((n) => n + 1);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  return { loaded: state.loaded, enabled: state.enabled, unlocked: state.unlocked };
}