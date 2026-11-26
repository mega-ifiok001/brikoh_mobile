// Brikoh API client for React Native — same contract as the web app.
// Bearer auth, one-shot refresh on 401, cold-start retry (Render free tier
// sleeps) and normalized errors. Tokens live in the OS keychain/keystore
// (expo-secure-store) with an in-memory copy so requests stay synchronous.
import * as SecureStore from "expo-secure-store";

export const API_BASE = "https://brikoh-backend.onrender.com";

const AT_KEY = "brikoh.at";
const RT_KEY = "brikoh.rt";

let accessToken: string | null = null;
let refreshToken: string | null = null;

export class ApiError extends Error {
  status: number;
  code: string;
  details: any;
  constructor(status: number, message: string, code?: string, details?: any) {
    super(message);
    this.status = status;
    this.code = code || "UNKNOWN";
    this.details = details;
  }
}

/** Call once at app start, before deciding whether the user is signed in. */
export async function loadTokens(): Promise<void> {
  try {
    accessToken = await SecureStore.getItemAsync(AT_KEY);
    refreshToken = await SecureStore.getItemAsync(RT_KEY);
  } catch {
    accessToken = null;
    refreshToken = null;
  }
}

export function getAccessToken() {
  return accessToken;
}
export function getRefreshToken() {
  return refreshToken;
}
export function hasSession() {
  return !!accessToken;
}

export function setTokens(at?: string | null, rt?: string | null) {
  if (at) {
    accessToken = at;
    SecureStore.setItemAsync(AT_KEY, at).catch(() => {});
  }
  if (rt) {
    refreshToken = rt;
    SecureStore.setItemAsync(RT_KEY, rt).catch(() => {});
  }
}

export function clearTokens() {
  accessToken = null;
  refreshToken = null;
  SecureStore.deleteItemAsync(AT_KEY).catch(() => {});
  SecureStore.deleteItemAsync(RT_KEY).catch(() => {});
}

// ---- tiny "signed out" event bus (replaces window events from the web app) --
const signedOutListeners = new Set<(sessionExpired: boolean) => void>();
export function onSignedOut(fn: (sessionExpired: boolean) => void) {
  signedOutListeners.add(fn);
  return () => {
    signedOutListeners.delete(fn);
  };
}
function emitSignedOut(sessionExpired = false) {
  signedOutListeners.forEach((fn) => fn(sessionExpired));
}

// Tokens may arrive under several shapes depending on endpoint.
export function extractTokens(res: any): { at?: string; rt?: string } {
  if (!res || typeof res !== "object") return {};
  const t = res.tokens || res.auth || res.session || {};
  const at =
    res.accessToken ?? t.accessToken ?? res.access_token ?? t.access_token ?? res.at ?? t.at ?? res.token;
  const rt =
    res.refreshToken ?? t.refreshToken ?? res.refresh_token ?? t.refresh_token ?? res.rt ?? t.rt;
  return { at: at || undefined, rt: rt || undefined };
}

let refreshPromise: Promise<RefreshOutcome> | null = null;
let lastAuthFailureAt = 0;
const AUTH_FAILURE_COOLDOWN_MS = 2_000;

export type RefreshOutcome = "refreshed" | "unauthorized" | "unavailable";

function decodeExpiry(token: string | null): number | null {
  if (!token) return null;
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const decoded = atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "="));
    const claims = JSON.parse(decoded);
    return typeof claims.exp === "number" ? claims.exp * 1000 : null;
  } catch { return null; }
}

async function doRefresh(): Promise<RefreshOutcome> {
  const rt = refreshToken;
  if (!rt) return "unauthorized";
  try {
    const response = await fetch(`${API_BASE}/api/public/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: rt }),
    });
    let json: any = null;
    try { json = await response.json(); } catch { /* optional response body */ }
    if (response.status === 401 || response.status === 403) return "unauthorized";
    if (!response.ok) return "unavailable";
    const { at, rt: nextRefreshToken } = extractTokens(json);
    if (!at || !nextRefreshToken) return "unavailable";
    setTokens(at, nextRefreshToken);
    return "refreshed";
  } catch { return "unavailable"; }
}

export function refreshSession(): Promise<RefreshOutcome> {
  if (!refreshPromise) refreshPromise = doRefresh().finally(() => { refreshPromise = null; });
  return refreshPromise;
}

/** Renew before expiry when possible; a network outage must never discard credentials. */
export async function keepSessionFresh(): Promise<RefreshOutcome> {
  if (!accessToken || !refreshToken) return "unauthorized";
  const expiresAt = decodeExpiry(accessToken);
  if (expiresAt !== null && expiresAt - Date.now() > 90_000) return "refreshed";
  const outcome = await refreshSession();
  if (outcome === "unauthorized" && Date.now() - lastAuthFailureAt >= AUTH_FAILURE_COOLDOWN_MS) {
    lastAuthFailureAt = Date.now();
    clearTokens();
    emitSignedOut(true);
  }
  return outcome;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface RawOpts {
  method?: string;
  body?: any;
  auth?: boolean;
  headers?: Record<string, string>;
}

async function rawFetch(
  path: string,
  { method = "GET", body, auth = true, headers: extraHeaders }: RawOpts
): Promise<{ status: number; json: any; text: string }> {
  const run = async (): Promise<Response> => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 90_000);
    try {
      const headers: Record<string, string> = { Accept: "application/json" };
      if (body !== undefined) headers["Content-Type"] = "application/json";
      if (auth && accessToken) headers["Authorization"] = `Bearer ${accessToken}`;
      Object.assign(headers, extraHeaders);
      return await fetch(`${API_BASE}${path}`, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: ctrl.signal,
      });
    } finally {
      clearTimeout(timer);
    }
  };

  let resp: Response;
  try {
    resp = await run();
  } catch {
    // network failure or abort — the free instance may be waking up
    await sleep(2200);
    try {
      resp = await run();
    } catch {
      throw new ApiError(0, "Can't reach the Brikoh server. Check your connection and try again.", "NETWORK");
    }
  }

  const text = await resp.text();
  let json: any = null;
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      /* not json */
    }
  }
  return { status: resp.status, json, text };
}

function toApiError(status: number, json: any, text: string): ApiError {
  let message = "";
  let code = "";
  if (json) {
    const e = json.error ?? json;
    if (e && typeof e === "object") {
      message = e.message || e.detail || "";
      code = e.code || "";
    } else if (typeof e === "string") {
      message = e;
    }
    if (!message && typeof json.message === "string") message = json.message;
    if (!message && typeof json.error === "string") message = json.error;
    if (!message && code && /^[A-Z_]{4,}$/.test(code)) {
      message = code.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
    }
  }
  if (!message) {
    message =
      status === 0
        ? "Can't reach the Brikoh server."
        : status === 400
          ? "The server couldn't understand that request."
          : status === 401
            ? "Your session expired. Please sign in again."
            : status === 403
              ? "You don't have permission to do that."
              : status === 404
                ? "That resource wasn't found."
                : status >= 500
                  ? "The server hit a problem. Please try again."
                  : `Request failed (${status}).`;
  }
  return new ApiError(status, message, code || "HTTP_" + status, json ?? text);
}

async function request(path: string, opts: RawOpts = {}): Promise<any> {
  const auth = opts.auth !== false;
  for (let attempt = 0; attempt < 2; attempt++) {
    const { status, json, text } = await rawFetch(path, opts);

    if (status === 401 && auth && accessToken && !path.startsWith("/api/public/auth/")) {
      const outcome = await refreshSession();
      if (outcome === "refreshed") continue;
      if (outcome === "unauthorized") {
        clearTokens();
        emitSignedOut(true);
        throw new ApiError(401, "Your session expired. Please sign in again. Your saved work is still on this device.", "UNAUTHENTICATED");
      }
      throw new ApiError(0, "You’re offline or the server is unavailable. Your session and unsent work are still saved; reconnect and try again.", "REFRESH_UNAVAILABLE");
    }

    if (status === 204) return null;
    if (status >= 400) throw toApiError(status, json, text);
    return json ?? null;
  }
  throw new ApiError(0, "Something went wrong. Please try again.", "RETRY_EXHAUSTED");
}

async function requestText(path: string, opts: RawOpts = {}): Promise<string> {
  const auth = opts.auth !== false;
  for (let attempt = 0; attempt < 2; attempt++) {
    const { status, json, text } = await rawFetch(path, opts);

    if (status === 401 && auth && accessToken && !path.startsWith("/api/public/auth/")) {
      const outcome = await refreshSession();
      if (outcome === "refreshed") continue;
      if (outcome === "unauthorized") {
        clearTokens();
        emitSignedOut(true);
        throw new ApiError(401, "Your session expired. Please sign in again. Your saved work is still on this device.", "UNAUTHENTICATED");
      }
      throw new ApiError(0, "You’re offline or the server is unavailable. Your session and unsent work are still saved; reconnect and try again.", "REFRESH_UNAVAILABLE");
    }

    if (status >= 400) throw toApiError(status, json, text);
    return text;
  }
  throw new ApiError(0, "Something went wrong. Please try again.", "RETRY_EXHAUSTED");
}

export const api = {
  get: (path: string) => request(path, { method: "GET" }),
  getText: (path: string) => requestText(path, { method: "GET" }),
  post: (path: string, body?: any) => request(path, { method: "POST", body: body ?? {} }),
  put: (path: string, body?: any) => request(path, { method: "PUT", body: body ?? {} }),
  patch: (path: string, body?: any, headers?: Record<string, string>) => request(path, { method: "PATCH", body: body ?? {}, headers }),
  del: (path: string) => request(path, { method: "DELETE" }),
  publicGet: (path: string) => request(path, { method: "GET", auth: false }),
  publicPost: (path: string, body?: any) =>
    request(path, { method: "POST", body: body ?? {}, auth: false }),
};
