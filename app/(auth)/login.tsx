import { useState } from "react";
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../src/context/AuthContext";
import { Button, Input, T, toast } from "../../src/components/ui";
import { apiErrorMessage } from "../../src/lib/format";
import { C } from "../../src/theme";

export default function Login() {
  const { login, loginWithPin } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pin, setPin] = useState("");
  const [usePin, setUsePin] = useState(false);
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!email.trim() || (usePin ? pin.length !== 6 : !password)) {
      toast.error(usePin ? "Enter your email and six-digit PIN." : "Enter your email and password.");
      return;
    }
    setBusy(true);
    try {
      if (usePin) {
        await loginWithPin(email.trim().toLowerCase(), pin);
        setPin("");
      } else {
        await login(email.trim().toLowerCase(), password);
      }
      // The root layout's guards route us to the dashboard (or setup) automatically.
    } catch (e: any) {
      if (usePin) {
        setPin("");
        if (/PIN.*LOCK|LOCK.*PIN/i.test(String(e?.code || ""))) {
          toast.error("PIN sign-in is locked for 15 minutes after five incorrect attempts. You can sign in with your password meanwhile.");
        } else if (e?.status === 429) {
          toast.error("PIN sign-in is temporarily rate limited. Try again later or sign in with your password.");
        } else {
          toast.error(apiErrorMessage(e, "Couldn't sign you in.", { INVALID_CREDENTIALS: "That email or PIN is incorrect." }));
        }
      } else {
        toast.error(apiErrorMessage(e, "Couldn't sign you in.", { INVALID_CREDENTIALS: "That email and password don't match." }));
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.night }}>
      <LinearGradient colors={["rgba(236,100,5,0.28)", "rgba(236,100,5,0)"]} style={{ position: "absolute", top: 0, left: 0, right: 0, height: 360 }} />
      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 24 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Image source={require("../../assets/logo-white.png")} style={{ width: 112, height: 28, marginTop: 14 }} resizeMode="contain" />

            <View style={{ marginTop: 56 }}>
              <T w="display" size={36} color={C.onNight} style={{ lineHeight: 40, letterSpacing: -0.8 }}>
                Run your whole shop from your pocket.
              </T>
              <T w="regular" size={14.5} color={C.nightMuted} style={{ marginTop: 12, lineHeight: 22 }}>
                Sales, stock, orders and your wallet — in one place.
              </T>
            </View>

            <View style={{ flex: 1, minHeight: 36 }} />

            <View style={{ gap: 12, paddingBottom: 10 }}>
              <Input
                dark
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                textContentType="emailAddress"
              />
              {usePin ? (
                <Input
                  dark
                  value={pin}
                  onChangeText={(v) => setPin(v.replace(/\D/g, "").slice(0, 6))}
                  placeholder="Six-digit account PIN"
                  secureTextEntry
                  keyboardType="number-pad"
                  autoComplete="off"
                  maxLength={6}
                  onSubmitEditing={submit}
                />
              ) : (
                <Input
                  dark
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Password"
                  secureTextEntry={!show}
                  autoCapitalize="none"
                  autoComplete="password"
                  textContentType="password"
                  onSubmitEditing={submit}
                  right={
                    <Pressable onPress={() => setShow((s) => !s)} hitSlop={10}>
                      <Ionicons name={show ? "eye-off-outline" : "eye-outline"} size={20} color="#8a7d71" />
                    </Pressable>
                  }
                />
              )}
              <Button label={usePin ? "Sign in with PIN" : "Sign in"} onPress={submit} busy={busy} />
              <View style={{ flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 4, paddingTop: 4 }}>
                <Pressable onPress={() => router.push("/(auth)/forgot-password")} hitSlop={10}>
                  <T w="semi" size={13} color="#8a7d71">
                    Forgot password?
                  </T>
                </Pressable>
                <Pressable onPress={() => router.push("/(auth)/register")} hitSlop={10}>
                  <T w="extra" size={13} color={C.brand}>
                    Create account
                  </T>
                </Pressable>
              </View>
              <Pressable
                onPress={() => {
                  setUsePin((v) => !v);
                  setPin("");
                  setPassword("");
                }}
                hitSlop={8}
                style={{ alignItems: "center", paddingVertical: 8 }}
              >
                <T w="bold" size={13} color={C.brand}>
                  {usePin ? "Use email and password instead" : "Sign in with account PIN"}
                </T>
              </Pressable>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}
