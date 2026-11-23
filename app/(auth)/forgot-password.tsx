import { useState } from "react";
import { Pressable } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import AuthShell from "../../src/components/auth/AuthShell";
import { Button, Input, T, toast } from "../../src/components/ui";
import { requestPasswordReset } from "../../src/lib/authApi";
import { apiErrorMessage } from "../../src/lib/format";
import { C } from "../../src/theme";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ForgotPassword() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<string | null>(null); // server's (deliberately vague) confirmation

  const goBack = () => (router.canGoBack() ? router.back() : router.replace("/login"));

  const submit = async () => {
    const e = email.trim().toLowerCase();
    if (!EMAIL_RE.test(e)) return toast.error("Enter the email you signed up with.");
    setBusy(true);
    try {
      setSent(await requestPasswordReset(e));
    } catch (err: any) {
      toast.error(apiErrorMessage(err, "Couldn't send the reset email. Please try again."));
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <AuthShell title="Check your email" subtitle={sent} onBack={goBack}>
        <Ionicons name="mail-open-outline" size={44} color={C.brand} style={{ marginBottom: 8 }} />
        <T w="regular" size={13.5} color={C.nightMuted} style={{ lineHeight: 20 }}>
          The link expires in 1 hour and works once. Open it on this phone, or copy the reset code from the email.
        </T>
        <Button label="I have a reset code" onPress={() => router.push("/reset-password")} />
        <Button label="Back to sign in" variant="ghost" onPress={() => router.replace("/login")} />
        <Pressable onPress={() => setSent(null)} hitSlop={10} style={{ alignSelf: "center", paddingTop: 4 }}>
          <T w="semi" size={13} color="#8a7d71">
            Use a different email
          </T>
        </Pressable>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Forgot your password?" subtitle="Enter your email and we'll send you a link to set a new one." onBack={goBack}>
      <Input
        dark
        value={email}
        onChangeText={setEmail}
        placeholder="Your email here"
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        textContentType="emailAddress"
        returnKeyType="send"
        onSubmitEditing={submit}
      />
      <Button label="Send reset link" onPress={submit} busy={busy} />
      <Pressable onPress={goBack} hitSlop={10} style={{ alignSelf: "center", paddingTop: 4 }}>
        <T w="semi" size={13} color="#8a7d71">
          Back to sign in
        </T>
      </Pressable>
    </AuthShell>
  );
}