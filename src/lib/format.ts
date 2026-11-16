// Formatting + defensive data helpers (ported from the web app).
// API money values are strings (Decimal) so everything funnels through rawNum.

export function rawNum(v: any): number {
  if (typeof v === "number") return isFinite(v) ? v : 0;
  if (typeof v === "string") {
    const n = parseFloat(v);
    return isFinite(n) ? n : 0;
  }
  return 0;
}

const SYMBOLS: Record<string, string> = {
  NGN: "₦",
  USD: "$",
  GHS: "GH₵",
  KES: "KSh ",
  ZAR: "R",
};

function group(n: number, maxDecimals: number): string {
  const fixed = Math.abs(n).toFixed(maxDecimals);
  let [int, dec] = fixed.split(".");
  int = int.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  if (dec) dec = dec.replace(/0+$/, "");
  return dec ? `${int}.${dec}` : int;
}

/** Money formatter. Written by hand so it never depends on Intl support. */
export function fm(v: any, currency = "NGN", opts: { compact?: boolean } = {}): string {
  const n = rawNum(v);
  const sym = SYMBOLS[currency] ?? `${currency} `;
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);

  if (opts.compact && abs >= 1000) {
    const units: Array<[number, string]> = [
      [1e9, "B"],
      [1e6, "M"],
      [1e3, "K"],
    ];
    for (const [d, s] of units) {
      if (abs >= d) {
        const x = abs / d;
        const body = x >= 100 ? x.toFixed(0) : x.toFixed(2).replace(/\.?0+$/, "");
        return `${sign}${sym}${body}${s}`;
      }
    }
  }
  return `${sign}${sym}${group(abs, abs >= 1000 ? 0 : 2)}`;
}

export function fd(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export function fdt(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ago(iso?: string | null): string {
  if (!iso) return "—";
  const t = new Date(iso).getTime();
  if (isNaN(t)) return "—";
  const s = Math.max(0, (Date.now() - t) / 1000);
  if (s < 45) return "just now";
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  if (s < 7 * 86400) return `${Math.round(s / 86400)}d ago`;
  return fd(iso);
}

// First defined value among candidate keys — the server's field naming
// varies between modules, so every read goes through this.
export function pick<T = any>(obj: any, keys: string[]): T | undefined {
  if (!obj || typeof obj !== "object") return undefined;
  for (const k of keys) {
    if (obj[k] !== undefined && obj[k] !== null) return obj[k] as T;
  }
  return undefined;
}

export function asList(res: any, ...keys: string[]): any[] {
  if (Array.isArray(res)) return res;
  if (!res || typeof res !== "object") return [];
  for (const k of keys) {
    if (Array.isArray(res[k])) return res[k];
  }
  for (const k of keys) {
    const v = res[k];
    if (v && typeof v === "object" && Array.isArray(v.items)) return v.items;
  }
  return [];
}

export function initialsOf(name?: string | null): string {
  const parts = (name || "?").trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() || "").join("") || "?";
}

const ACRONYMS = new Set(["POS", "SKU", "NGN", "USD", "VAT", "ID"]);

export function titleCase(s?: string | null): string {
  if (!s) return "—";
  return String(s)
    .replace(/[_-]+/g, " ")
    .split(" ")
    .map((w) => (ACRONYMS.has(w.toUpperCase()) ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()))
    .join(" ");
}

export function plural(n: number | string | null | undefined, one: string, many = one + "s"): string {
  return `${n ?? "—"} ${Number(n) === 1 ? one : many}`;
}

export function apiErrorMessage(e: any, fallback: string, extra?: Record<string, string>): string {
  const code = e?.code;
  if (code === "RATE_LIMITED") return "Too many requests — please slow down and try again.";
  if (extra && code && extra[code]) return extra[code];
  return e?.message || fallback;
}

/** Local date as YYYY-MM-DD (what the API's date filters / form fields expect). */
export function toISODate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
