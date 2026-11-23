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
const signedOutListeners = new Set<() => void>();
export function onSignedOut(fn: () => void) {
  signedOutListeners.add(fn);
  return () => {
    signedOutListeners.delete(fn);
  };
}
function emitSignedOut() {
  signedOutListeners.forEach((f) => f());
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

let refreshPromise: Promise<boolean> | null = null;

function doRefresh(): Promise<boolean> {
  const rt = refreshToken;
  if (!rt) return Promise.resolve(false);
  return fetch(`${API_BASE}/api/public/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken: rt }),
  })
    .then(async (r) => {
      let j: any = null;
      try {
        j = await r.json();
      } catch {
        /* no body */
      }
      if (!r.ok) return false;
      const { at, rt: nrt } = extractTokens(j);
      if (!at) return false;
      setTokens(at, nrt ?? refreshToken);
      return true;
    })
    .catch(() => false);
}

export function refreshSession(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = doRefresh().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface RawOpts {
  method?: string;
  body?: any;
  auth?: boolean;
}

async function rawFetch(
  path: string,
  { method = "GET", body, auth = true }: RawOpts
): Promise<{ status: number; json: any; text: string }> {
  const run = async (): Promise<Response> => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 90_000);
    try {
      const headers: Record<string, string> = { Accept: "application/json" };
      if (body !== undefined) headers["Content-Type"] = "application/json";
      if (auth && accessToken) headers["Authorization"] = `Bearer ${accessToken}`;
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
      const ok = await refreshSession();
      if (ok) continue; // retry with the fresh token
      clearTokens();
      emitSignedOut();
      throw new ApiError(401, "Your session expired. Please sign in again.", "UNAUTHENTICATED");
    }

    if (status === 204) return null;
    if (status >= 400) throw toApiError(status, json, text);
    return json ?? null;
  }
  throw new ApiError(0, "Something went wrong. Please try again.", "RETRY_EXHAUSTED");
}

export const api = {
  get: (path: string) => request(path, { method: "GET" }),
  post: (path: string, body?: any) => request(path, { method: "POST", body: body ?? {} }),
  put: (path: string, body?: any) => request(path, { method: "PUT", body: body ?? {} }),
  patch: (path: string, body?: any) => request(path, { method: "PATCH", body: body ?? {} }),
  del: (path: string) => request(path, { method: "DELETE" }),
  publicGet: (path: string) => request(path, { method: "GET", auth: false }),
  publicPost: (path: string, body?: any) =>
    request(path, { method: "POST", body: body ?? {}, auth: false }),
};
