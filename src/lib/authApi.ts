// Account-security endpoints: email verification, password reset, resend.
// All paths/bodies match the Brikoh OpenAPI "Account security" group.
import { api } from "./api";

export const VERIFY_PREFIX = "vrf_";
export const RESET_PREFIX = "rst_";

/**
 * Pull a token out of whatever the user pasted: the bare token, or the whole
 * link from the email (e.g. https://brikoh.com/#/verify?token=vrf_abc...).
 * Returns "" when nothing token-shaped is found.
 */
export function extractToken(input: string | null | undefined, prefix: string): string {
  if (!input) return "";
  let s = String(input).trim();
  try {
    s = decodeURIComponent(s);
  } catch {
    /* keep raw */
  }
  const m = s.match(new RegExp(`${prefix}[A-Za-z0-9_\\-]+`));
  return m ? m[0] : "";
}

/** POST /api/public/auth/verify → { verified: true } */
export async function verifyEmail(token: string): Promise<{ verified: boolean }> {
  const res = await api.publicPost("/api/public/auth/verify", { token });
  return { verified: !!res?.verified };
}

/** POST /api/public/auth/forgot-password → 202, same reply for known/unknown emails. */
export async function requestPasswordReset(email: string): Promise<string> {
  const res = await api.publicPost("/api/public/auth/forgot-password", { email });
  return res?.message || "If an account exists for that email, password reset instructions will be sent.";
}

/** POST /api/public/auth/reset-password → { ok: true, message }. Revokes all refresh sessions. */
export async function resetPassword(p: {
  token: string;
  newPassword: string;
  confirmPassword: string;
}): Promise<string> {
  const res = await api.publicPost("/api/public/auth/reset-password", p);
  return res?.message || "Your password has been reset. Please sign in.";
}

/** POST /api/dashboard/resend-verification (signed in) → { sent: boolean } */
export async function resendVerification(): Promise<boolean> {
  const res = await api.post("/api/dashboard/resend-verification");
  return res?.sent !== false;
}