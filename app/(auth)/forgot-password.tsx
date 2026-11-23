import { useState } from "react";
import { Pressable } from "react-native";
import { useRouter } from "expo-router";
import AuthShell from "../../src/components/auth/AuthShell";
import { Button, Input, T, toast } from "../../src/components/ui";
import { isValidEmail, requestPasswordReset } from "../../src/lib/authApi";
import { apiErrorMessage } from "../../src/lib/format";

export default function ForgotPassword() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);

  const goBack = () => (router.canGoBack() ? router.back() : router.replace("/login"));

  const submit = async () => {
    const cleanEmail = email.trim().toLowerCase();
    if (!isValidEmail(cleanEmail)) return toast.error("Enter the email you signed up with.");
    setBusy(true);
    try {
      const msg = await requestPasswordReset(cleanEmail);
      toast.success(msg);
      // Go straight to the code screen — no extra "I have a code" step.
      router.push({ pathname: "/reset-password", params: { email: cleanEmail } });
    } catch (err: any) {
      toast.error(apiErrorMessage(err, "Couldn't send the reset code. Please try again."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell title="Forgot your password?" subtitle="Enter your email and we'll send you a 6-digit code to set a new one." onBack={goBack}>
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
        returnKeyType="send"
        onSubmitEditing={submit}
      />
      <Button label="Send reset code" onPress={submit} busy={busy} />
      <Pressable onPress={goBack} hitSlop={10} style={{ alignSelf: "center", paddingTop: 4 }}>
        <T w="semi" size={13} color="#8a7d71">
          Back to sign in
        </T>
      </Pressable>
    </AuthShell>
  );
}