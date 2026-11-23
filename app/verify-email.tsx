import { useEffect, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import AuthShell from "../src/components/auth/AuthShell";
import { Button, Input, T, toast } from "../src/components/ui";
import { useAuth } from "../src/context/AuthContext";
import { OTP_LENGTH, cleanOtp, isValidEmail, resendVerification, verifyEmail } from "../src/lib/authApi";
import { apiErrorMessage } from "../src/lib/format";
import { C } from "../src/theme";

const RESEND_COOLDOWN = 30; // seconds

// Reachable signed-in or signed-out. The email comes from the signed-in account,
// an ?email= param, or (if neither) the user types it. The 6-digit code is
// single-use, so a wrong guess clears the field.
export default function VerifyEmail() {
  const router = useRouter();
  const { isAuthed, me, refresh } = useAuth();
  const params = useLocalSearchParams<{ email?: string }>();
  const paramEmail = Array.isArray(params.email) ? params.email[0] : params.email;
  const knownEmail = String(paramEmail || me.account?.email || "").trim().toLowerCase();

  const [emailInput, setEmailInput] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  const email = knownEmail || emailInput.trim().toLowerCase();

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const leave = () => router.replace(isAuthed ? "/" : "/login");

  const submit = async () => {
    setError(null);
    if (!isValidEmail(email)) return toast.error("Enter the email you signed up with.");
    if (code.length !== OTP_LENGTH) return toast.error(`Enter the ${OTP_LENGTH}-digit code from your email.`);
    setBusy(true);
    try {
      await verifyEmail(email, code);
      setDone(true);
      if (isAuthed) await refresh(); // pick up emailVerifiedAt
    } catch (e: any) {
      setError(
        apiErrorMessage(e, "That code is invalid or expired. Request a new code.", {
          OTP_INVALID: "That code is invalid or expired. Request a new code.",
        })
      );
      setCode("");
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    setResending(true);
    try {
      const sent = await resendVerification();
      if (sent) {
        toast.success("A new code is on its way. Check your inbox.");
        setCooldown(RESEND_COOLDOWN);
      } else {
        toast.success("Your email is already verified.");
        await refresh();
      }
    } catch (e: any) {
      toast.error(apiErrorMessage(e, "Couldn't send the email. Try again in a minute."));
    } finally {
      setResending(false);
    }
  };

  if (done) {
    return (
      <AuthShell title="Email verified" subtitle="Thanks — your email address is confirmed.">
        <Ionicons name="checkmark-circle" size={56} color={C.brand} style={{ marginBottom: 8 }} />
        <Button label={isAuthed ? "Continue" : "Sign in"} onPress={leave} />
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Verify your email"
      subtitle={
        knownEmail
          ? `We sent a ${OTP_LENGTH}-digit code to ${knownEmail}. Enter it below.`
          : `Enter your email and the ${OTP_LENGTH}-digit code we sent you.`
      }
      onBack={leave}
    >
      {!knownEmail && (
        <Input
          dark
          value={emailInput}
          onChangeText={setEmailInput}
          placeholder="Your email here"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          textContentType="emailAddress"
        />
      )}
      <Input
        dark
        value={code}
        onChangeText={(v) => setCode(cleanOtp(v))}
        placeholder={`${OTP_LENGTH}-digit code`}
        keyboardType="number-pad"
        maxLength={OTP_LENGTH}
        autoCorrect={false}
        textContentType="oneTimeCode"
        autoComplete="one-time-code"
        returnKeyType="done"
        onSubmitEditing={submit}
      />
      {error ? (
        <T w="semi" size={13} color="#f08a7e" style={{ lineHeight: 19 }}>
          {error}
        </T>
      ) : null}
      <Button label="Verify email" onPress={submit} busy={busy} />
      {isAuthed ? (
        <Button
          label={cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
          variant="ghost"
          busy={resending}
          disabled={cooldown > 0}
          onPress={resend}
        />
      ) : (
        <T w="regular" size={12.5} color={C.nightMuted} style={{ textAlign: "center" }}>
          Need a new code? Sign in, then request one from Settings → Account.
        </T>
      )}
    </AuthShell>
  );
}