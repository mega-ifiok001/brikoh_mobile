import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import AuthShell from "../src/components/auth/AuthShell";
import { Button, Input, T, toast } from "../src/components/ui";
import { useAuth } from "../src/context/AuthContext";
import { VERIFY_PREFIX, extractToken, resendVerification, verifyEmail } from "../src/lib/authApi";
import { apiErrorMessage } from "../src/lib/format";
import { C } from "../src/theme";

type Phase = "input" | "verifying" | "done" | "failed";

// Reachable signed-in or signed-out. Opening brikoh://verify-email?token=vrf_... verifies
// straight away; otherwise the user can paste the token (or the whole link) from the email.
export default function VerifyEmail() {
  const router = useRouter();
  const { isAuthed, refresh } = useAuth();
  const params = useLocalSearchParams<{ token?: string }>();
  const linkToken = extractToken(Array.isArray(params.token) ? params.token[0] : params.token, VERIFY_PREFIX);

  const [tokenInput, setTokenInput] = useState("");
  const [phase, setPhase] = useState<Phase>(linkToken ? "verifying" : "input");
  const [message, setMessage] = useState("");
  const [resending, setResending] = useState(false);
  const tried = useRef<string>(""); // tokens are single-use: never submit the same one twice

  const verify = useCallback(
    async (token: string) => {
      if (!token) return toast.error("Paste the verification code from your email (it starts with vrf_).");
      if (tried.current === token) return;
      tried.current = token;
      setPhase("verifying");
      try {
        await verifyEmail(token);
        setPhase("done");
        if (isAuthed) await refresh(); // pick up emailVerifiedAt
      } catch (e: any) {
        setMessage(apiErrorMessage(e, "This verification link is invalid or has expired."));
        setPhase("failed");
      }
    },
    [isAuthed, refresh]
  );

  useEffect(() => {
    if (linkToken) verify(linkToken);
  }, [linkToken, verify]);

  const resend = async () => {
    setResending(true);
    try {
      const sent = await resendVerification();
      toast.success(sent ? "Verification email sent. Check your inbox." : "Nothing to send — your email may already be verified.");
      if (!sent) await refresh();
    } catch (e: any) {
      toast.error(apiErrorMessage(e, "Couldn't send the email. Try again in a minute."));
    } finally {
      setResending(false);
    }
  };

  const leave = () => router.replace(isAuthed ? "/" : "/login");

  if (phase === "verifying") {
    return (
      <AuthShell title="Verifying your email…">
        <ActivityIndicator color={C.brand} size="large" style={{ marginVertical: 24 }} />
      </AuthShell>
    );
  }

  if (phase === "done") {
    return (
      <AuthShell title="Email verified" subtitle="Thanks — your email address is confirmed.">
        <Ionicons name="checkmark-circle" size={56} color={C.brand} style={{ marginBottom: 8 }} />
        <Button label={isAuthed ? "Continue" : "Sign in"} onPress={leave} />
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title={phase === "failed" ? "Couldn't verify" : "Verify your email"}
      subtitle={phase === "failed" ? message : "Open the link in the email we sent you, or paste the verification code here."}
      onBack={leave}
    >
      <Input
        dark
        value={tokenInput}
        onChangeText={setTokenInput}
        placeholder="Verification code (vrf_…)"
        autoCapitalize="none"
        autoCorrect={false}
        onSubmitEditing={() => verify(extractToken(tokenInput, VERIFY_PREFIX))}
      />
      <Button label="Verify email" onPress={() => verify(extractToken(tokenInput, VERIFY_PREFIX))} />
      {isAuthed ? <Button label="Resend verification email" variant="ghost" busy={resending} onPress={resend} /> : null}
    </AuthShell>
  );
}