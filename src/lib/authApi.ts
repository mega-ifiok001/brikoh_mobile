// Account-security endpoints: email verification (email + 6-digit code),
// password reset (code -> resetToken -> new password), resend, change password.
// All paths/bodies match the Brikoh OpenAPI "Account security" group.
import { api } from "./api";

export const OTP_LENGTH = 6;
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const isValidEmail = (v: string) => EMAIL_RE.test(v.trim());

/** Keep digits only and cap at 6 — use as the onChangeText handler for code inputs. */
export const cleanOtp = (v: string) => v.replace(/\D/g, "").slice(0, OTP_LENGTH);

/** POST /api/public/auth/verify → { verified: true } */
export async function verifyEmail(email: string, code: string): Promise<boolean> {
  const res = await api.publicPost("/api/public/auth/verify", {
    email: email.trim().toLowerCase(),
    code,
  });
  return !!res?.verified;
}

/** POST /api/public/auth/forgot-password → 202, same reply for known/unknown emails. */
export async function requestPasswordReset(email: string): Promise<string> {
  const res = await api.publicPost("/api/public/auth/forgot-password", {
    email: email.trim().toLowerCase(),
  });
  return res?.message || "If an account exists for that email, a password reset code will be sent.";
}

/**
 * POST /api/public/auth/reset-password/verify → { resetToken }
 * Consumes the single-use OTP and returns a short-lived, single-use resetToken.
 * Keep it in memory only and pass it straight to resetPassword().
 */
export async function verifyResetCode(email: string, code: string): Promise<string> {
  const res = await api.publicPost("/api/public/auth/reset-password/verify", {
    email: email.trim().toLowerCase(),
    code,
  });
  const token = res?.resetToken;
  if (!token) throw new Error("The server did not return a reset token. Please try again.");
  return String(token);
}

/** POST /api/public/auth/reset-password → { ok: true, message }. Revokes all refresh sessions. */
export async function resetPassword(p: {
  resetToken: string;
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

/** POST /api/dashboard/settings/password (signed in) → { ok: true } */
export async function changePassword(p: {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}): Promise<boolean> {
  const res = await api.post("/api/dashboard/settings/password", p);
  return res?.ok !== false;
}