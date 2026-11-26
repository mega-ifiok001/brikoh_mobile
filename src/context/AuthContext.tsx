import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { AppState } from "react-native";
import {
  api,
  clearTokens,
  extractTokens,
  hasSession,
  loadTokens,
  onSignedOut,
  keepSessionFresh,
  setTokens,
} from "../lib/api";
import { pick } from "../lib/format";

export interface Me {
  account: any;
  store: any;
  subscription: any;
  staff: any;
}

const EMPTY: Me = { account: {}, store: null, subscription: null, staff: null };

// The /me payload nests differently across backend versions; funnel
// everything through pick() so the UI never crashes on a renamed field.
export function normalizeMe(res: any): Me {
  if (!res || typeof res !== "object") return { ...EMPTY, account: res || {} };

  const rawAccount = pick(res, ["account", "user", "profile", "me"]) ?? (res.email ? res : {});
  const rawStore = pick(res, ["store", "business", "tenant"]) ?? null;
  const subscription =
    pick(res, ["subscription", "plan", "subscriptionInfo", "billing"]) ??
    (rawStore ? rawStore.subscription ?? null : null);
  const staff = pick(res, ["staffMember", "staff", "membership"]) ?? null;

  const account = {
    ...(rawAccount || {}),
    emailVerifiedAt:
      rawAccount?.emailVerifiedAt || (rawAccount?.verified ? new Date().toISOString() : undefined),
  };

  const store =
    rawStore ||
    (rawAccount?.storeId
      ? { id: rawAccount.storeId, name: rawAccount.storeName, subdomain: rawAccount.subdomain }
      : null);

  return { account, store, subscription: subscription || null, staff: staff || null };
}

interface AuthCtxType {
  me: Me;
  loading: boolean;
  sessionExpired: boolean;
  isAuthed: boolean;
  isOnboarded: boolean;
  login: (email: string, password: string) => Promise<Me>;
  loginWithPin: (email: string, pin: string) => Promise<Me>;
  register: (p: {
    email: string;
    password: string;
    confirmPassword: string;
    firstName: string;
    lastName: string;
    phone: string;
  }) => Promise<Me>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthCtx = createContext<AuthCtxType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [authed, setAuthed] = useState(false);
  const [sessionExpired, setSessionExpired] = useState(false);

  const loadMe = useCallback(async (tokens?: { at?: string; rt?: string }): Promise<Me> => {
    if (tokens) setTokens(tokens.at, tokens.rt);
    if (!hasSession()) {
      setMe(EMPTY);
      setAuthed(false);
      return EMPTY;
    }
    try {
      const res = await api.get("/api/dashboard/me");
      const n = normalizeMe(res);
      setMe(n);
      setAuthed(true);
      return n;
    } catch (e: any) {
      // A hard auth failure already cleared the tokens in the api client.
      if (!hasSession()) {
        setMe(EMPTY);
        setAuthed(false);
        return EMPTY;
      }
      // Network trouble: keep the session, let the user pull to retry.
      setAuthed(true);
      return EMPTY;
    }
  }, []);

  // Boot: read tokens from secure storage, then fetch the profile.
  useEffect(() => {
    let alive = true;
    (async () => {
      await loadTokens();
      if (hasSession()) await loadMe();
      if (alive) setLoading(false);
    })();
    const off = onSignedOut((expired) => {
      setMe(EMPTY);
      setAuthed(false);
      setSessionExpired(expired);
    });
    return () => {
      alive = false;
      off();
    };
  }, [loadMe]);

  const login = useCallback(
    async (email: string, password: string) => {
      setSessionExpired(false);
      const res = await api.publicPost("/api/public/auth/login", { email, password });
      const t = extractTokens(res);
      if (!t.at) throw new Error("Login did not return a session token.");
      return loadMe(t);
    },
    [loadMe]
  );

  const loginWithPin = useCallback(
    async (email: string, pin: string) => {
      const res = await api.publicPost("/api/public/auth/pin-login", { email, pin });
      const t = extractTokens(res);
      if (!t.at) throw new Error("PIN sign-in did not return a session token.");
      return loadMe(t);
    },
    [loadMe]
  );

  const register = useCallback<AuthCtxType["register"]>(
    async (p) => {
      const res = await api.publicPost("/api/public/auth/register", p);
      const t = extractTokens(res);
      if (t.at) setTokens(t.at, t.rt);
      return loadMe(t.at ? t : undefined);
    },
    [loadMe]
  );

  const logout = useCallback(async () => {
    try {
      await api.post("/api/public/auth/logout");
    } catch {
      /* best effort */
    }
    clearTokens();
    setMe(EMPTY);
    setAuthed(false);
  }, []);

  const refresh = useCallback(async () => {
    if (!hasSession()) return;
    await loadMe();
  }, [loadMe]);

  // Keep short-lived access tokens renewed while the app is open and immediately on resume.
  useEffect(() => {
    if (!authed) return undefined;
    const renew = () => {
      if (AppState.currentState === "active") void keepSessionFresh();
    };
    renew();
    const interval = setInterval(renew, 60_000);
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") renew();
    });
    return () => {
      clearInterval(interval);
      subscription.remove();
    };
  }, [authed]);

  return (
    <AuthCtx.Provider
      value={{
        me,
        loading,
        sessionExpired,
        isAuthed: authed,
        isOnboarded: !!me.store?.id,
        login,
        loginWithPin,
        register,
        logout,
        refresh,
      }}
    >
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth(): AuthCtxType {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
