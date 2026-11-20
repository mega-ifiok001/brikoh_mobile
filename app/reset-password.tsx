import { useState } from "react";
import { Pressable } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import AuthShell from "../src/components/auth/AuthShell";
import { Button, Input, T, toast } from "../src/components/ui";
import { useAuth } from "../src/context/AuthContext";
import { RESET_PREFIX, extractToken, resetPassword } from "../src/lib/authApi";
import { apiErrorMessage } from "../src/lib/format";

// Reachable signed-in or signed-out, so the deep link brikoh://reset-password?token=rst_...
// works whatever state the app is in.
export default function ResetPassword() {
  const router = useRouter();
  const { logout, isAuthed } = useAuth();
  const params = useLocalSearchParams<{ token?: string }>();
  const linkToken = extractToken(Array.isArray(params.token) ? params.token[0] : params.token, RESET_PREFIX);

  const [tokenInput, setTokenInput] = useState("");
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null); // invalid/expired token → offer a new link

  const token = linkToken || extractToken(tokenInput, RESET_PREFIX);

  const leave = () => router.replace(isAuthed ? "/" : "/login");

  const submit = async () => {
    setError(null);
    if (!token) return toast.error("Paste the reset code from your email (it starts with rst_).");
    if (pw.length < 8) return toast.error("Your password needs at least 8 characters.");
    if (pw !== confirm) return toast.error("The two passwords don't match.");
    setBusy(true);
    try {
      const msg = await resetPassword({ token, newPassword: pw, confirmPassword: confirm });
      // The server revoked every refresh session; drop the local one too.
      if (isAuthed) await logout();
      toast.success(msg);
      router.replace("/login");
    } catch (e: any) {
      if (e?.code === "PASSWORD_RESET_INVALID") setError(e.message);
      toast.error(apiErrorMessage(e, "Couldn't reset your password. Please try again."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell title="Set a new password" subtitle="Choose a password you haven't used before. You'll sign in again afterwards." onBack={leave}>
      {!linkToken && (
        <Input
          dark
          value={tokenInput}
          onChangeText={setTokenInput}
          placeholder="Reset code (rst_…)"
          autoCapitalize="none"
          autoCorrect={false}
        />
      )}
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
        onSubmitEditing={submit}
      />
      {error ? (
        <T w="semi" size={13} color="#f08a7e" style={{ lineHeight: 19 }}>
          {error}
        </T>
      ) : null}
      <Button label="Reset password" onPress={submit} busy={busy} />
      {error ? <Button label="Request a new link" variant="ghost" onPress={() => router.replace("/forgot-password")} /> : null}
    </AuthShell>
  );
}