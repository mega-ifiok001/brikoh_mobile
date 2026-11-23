import { useEffect, useRef, useState } from "react";
import { Pressable } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import AuthShell from "../src/components/auth/AuthShell";
import OtpInput from "../src/components/auth/OtpInput";
import { Button, Input, T, toast } from "../src/components/ui";
import { useAuth } from "../src/context/AuthContext";
import {
  OTP_LENGTH,
  isValidEmail,
  requestPasswordReset,
  resetPassword,
  verifyResetCode,
} from "../src/lib/authApi";
import { apiErrorMessage } from "../src/lib/format";

type Step = "code" | "password";

const RESEND_COOLDOWN = 30; // seconds

// Two-step reset, reachable signed-in or signed-out:
//   1. 6-digit code (email comes from forgot-password) -> POST /reset-password/verify -> resetToken
//   2. new password                                    -> POST /reset-password (with resetToken)
// The resetToken is short-lived and single-use, so it lives in a ref only —
// never in the URL, rendered state, or storage.
export default function ResetPassword() {
  const router = useRouter();
  const { logout, isAuthed } = useAuth();
  const params = useLocalSearchParams<{ email?: string }>();
  const paramEmail = String((Array.isArray(params.email) ? params.email[0] : params.email) || "")
    .trim()
    .toLowerCase();
  const hasEmailParam = !!paramEmail;

  const [step, setStep] = useState<Step>("code");
  const [email, setEmail] = useState(paramEmail);
  const [code, setCode] = useState("");
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const resetToken = useRef("");

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const cleanEmail = email.trim().toLowerCase();
  const leave = () => router.replace(isAuthed ? "/" : "/login");
  const changeEmail = () => (router.canGoBack() ? router.back() : router.replace("/forgot-password"));

  // Step 1 — trade the emailed code for a resetToken. Called automatically
  // when the last box is filled, or from the Continue button.
  const submitCode = async (c: string = code) => {
    if (busy) return;
    setError(null);
    if (!isValidEmail(cleanEmail)) return toast.error("Enter the email you requested the code for.");
    if (c.length !== OTP_LENGTH) return toast.error(`Enter the ${OTP_LENGTH}-digit code from your email.`);
    setBusy(true);
    try {
      resetToken.current = await verifyResetCode(cleanEmail, c);
      setStep("password");
    } catch (e: any) {
      setError(
        apiErrorMessage(e, "That code is invalid or expired. Request a new code.", {
          OTP_INVALID: "That code is invalid or expired. Request a new code.",
        })
      );
      setCode(""); // codes are single-use
    } finally {
      setBusy(false);
    }
  };

  // Step 2 — set the new password.
  const submitPassword = async () => {
    setError(null);
    if (pw.length < 8) return toast.error("Your password needs at least 8 characters.");
    if (pw !== confirm) return toast.error("The two passwords don't match.");
    setBusy(true);
    try {
      const msg = await resetPassword({
        resetToken: resetToken.current,
        newPassword: pw,
        confirmPassword: confirm,
      });
      resetToken.current = "";
      // The server revoked every refresh session; drop the local one too.
      if (isAuthed) await logout();
      toast.success(msg);
      router.replace("/login");
    } catch (e: any) {
      if (e?.code === "PASSWORD_RESET_INVALID") {
        // The grant expired or was already used — start over with a fresh code.
        resetToken.current = "";
        setPw("");
        setConfirm("");
        setCode("");
        setStep("code");
        setError("This reset session has expired. Request a new code to continue.");
      } else {
        toast.error(apiErrorMessage(e, "Couldn't reset your password. Please try again."));
      }
    } finally {
      setBusy(false);
    }
  };

  const resendCode = async () => {
    if (!isValidEmail(cleanEmail)) return toast.error("Enter your email first.");
    setResending(true);
    try {
      await requestPasswordReset(cleanEmail);
      toast.success("If that email has an account, a new code is on its way.");
      setError(null);
      setCode("");
      setCooldown(RESEND_COOLDOWN);
    } catch (e: any) {
      toast.error(apiErrorMessage(e, "Couldn't send a new code. Try again in a minute."));
    } finally {
      setResending(false);
    }
  };

  if (step === "password") {
    return (
      <AuthShell
        title="Set a new password"
        subtitle="Choose a password you haven't used before. You'll sign in again afterwards."
        onBack={leave}
      >
        <Input
          dark
          value={pw}
          onChangeText={setPw}
          placeholder="New password"
          secureTextEntry={!show}
          autoCapitalize="none"
          autoComplete="new-password"
          textContentType="newPassword"
          right={
            <Pressable onPress={() => setShow((s) => !s)} hitSlop={10}>
              <Ionicons name={show ? "eye-off-outline" : "eye-outline"} size={20} color="#8a7d71" />
            </Pressable>
          }
        />
        <Input
          dark
          value={confirm}
          onChangeText={setConfirm}
          placeholder="Confirm new password"
          secureTextEntry={!show}
          autoCapitalize="none"
          autoComplete="new-password"
          textContentType="newPassword"
          returnKeyType="done"
          onSubmitEditing={submitPassword}
        />
        {error ? (
          <T w="semi" size={13} color="#f08a7e" style={{ lineHeight: 19 }}>
            {error}
          </T>
        ) : null}
        <Button label="Reset password" onPress={submitPassword} busy={busy} />
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Enter your code"
      subtitle={
        hasEmailParam
          ? `We sent a ${OTP_LENGTH}-digit code to ${paramEmail}.`
          : `Enter your email and the ${OTP_LENGTH}-digit code we sent you.`
      }
      onBack={leave}
    >
      {!hasEmailParam && (
        <Input
          dark
          value={email}
          onChangeText={setEmail}
          placeholder="Your email here"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          textContentType="emailAddress"
        />
      )}
      <OtpInput
        value={code}
        onChange={(v) => {
          setCode(v);
          if (error) setError(null);
        }}
        onComplete={(v) => submitCode(v)}
        length={OTP_LENGTH}
        autoFocus={hasEmailParam}
        disabled={busy}
        hasError={!!error}
      />
      {error ? (
        <T w="semi" size={13} color="#f08a7e" style={{ lineHeight: 19 }}>
          {error}
        </T>
      ) : null}
      <Button label="Continue" onPress={() => submitCode()} busy={busy} />
      <Button
        label={cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
        variant="ghost"
        busy={resending}
        disabled={cooldown > 0}
        onPress={resendCode}
      />
      {hasEmailParam ? (
        <Pressable onPress={changeEmail} hitSlop={10} style={{ alignSelf: "center", paddingTop: 4 }}>
          <T w="semi" size={13} color="#8a7d71">
            Wrong email? Go back
          </T>
        </Pressable>
      ) : null}
    </AuthShell>
  );
}