import { createContext, Fragment, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Platform, useColorScheme } from "react-native";
import * as SecureStore from "expo-secure-store";
import { applyMode, themeSwitch, type Mode } from "../theme";

export type ThemePref = "system" | "light" | "dark";
const KEY = "brikoh.theme";

async function readPref(): Promise<string | null> {
  try {
    if (Platform.OS === "web") return (globalThis as any).localStorage?.getItem(KEY) ?? null;
    return await SecureStore.getItemAsync(KEY);
  } catch {
    return null;
  }
}
async function writePref(v: ThemePref) {
  try {
    if (Platform.OS === "web") (globalThis as any).localStorage?.setItem(KEY, v);
    else await SecureStore.setItemAsync(KEY, v);
  } catch {}
}

interface Ctx {
  pref: ThemePref;
  resolved: Mode;
  setPref: (p: ThemePref) => void;
}
const ThemeCtx = createContext<Ctx>({ pref: "system", resolved: "light", setPref: () => {} });

export function useTheme() {
  return useContext(ThemeCtx);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const [pref, setPrefState] = useState<ThemePref>("system");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    readPref()
      .then((v) => {
        if (v === "light" || v === "dark" || v === "system") setPrefState(v);
      })
      .finally(() => setReady(true));
  }, []);

  const resolved: Mode = pref === "system" ? (system === "dark" ? "dark" : "light") : pref;
  // Swap the palette before any child renders.
  applyMode(resolved);

  const setPref = useCallback((p: ThemePref) => {
    setPrefState(p);
    writePref(p);
  }, []);

  const value = useMemo(() => ({ pref, resolved, setPref }), [pref, resolved, setPref]);
  if (!ready) return null;
  return <ThemeCtx.Provider value={value}>{children}</ThemeCtx.Provider>;
}

// Re-mounts everything inside it when the theme flips, so every screen picks up the new colours.
export function ThemeBoundary({ children }: { children: ReactNode }) {
  const { resolved } = useTheme();
  const prev = useRef<Mode | null>(null);
  if (prev.current !== null && prev.current !== resolved) themeSwitch.pending = true;
  prev.current = resolved;
  return <Fragment key={resolved}>{children}</Fragment>;
}
