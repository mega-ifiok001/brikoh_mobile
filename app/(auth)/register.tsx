
import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../src/context/AuthContext";
import { Button, Field, Input, T, toast } from "../../src/components/ui";
import { apiErrorMessage } from "../../src/lib/format";
import { C } from "../../src/theme";

export default function Register() {
  const { register } = useAuth();
  const router = useRouter();

  const [f, setF] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
  });

  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const set = (k: keyof typeof f) => (v: string) =>
    setF((s) => ({ ...s, [k]: v }));

  
const submit = async () => {
  if (
    !f.firstName.trim() ||
    !f.lastName.trim() ||
    !f.email.trim() ||
    !f.phone.trim()
  ) {
    toast.error("Please fill in all the fields.");
    return;
  }

  if (f.password.length < 8) {
    toast.error("Your password needs at least 8 characters.");
    return;
  }

  if (f.password !== f.confirmPassword) {
    toast.error("The two passwords don't match.");
    return;
  }

  setBusy(true);

  try {
    await register({
      ...f,
      email: f.email.trim().toLowerCase(),
      firstName: f.firstName.trim(),
      lastName: f.lastName.trim(),
      phone: f.phone.trim(),
    });

    toast.success("Registration successful. Please verify your email.");

    router.replace("/verify-email");
  } catch (e: any) {
    toast.error(
      apiErrorMessage(e, "Couldn't create your account.", {
        EMAIL_TAKEN: "An account with that email already exists.",
      })
    );
  } finally {
    setBusy(false);
  }
};


  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.cream50 }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={{ padding: 20, paddingBottom: 40, gap: 16 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Pressable
            onPress={() => router.back()}
            hitSlop={12}
            style={{
              width: 40,
              height: 40,
              borderRadius: 13,
              backgroundColor: C.white,
              borderWidth: 1,
              borderColor: C.cream200,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="chevron-back" size={20} color={C.ink900} />
          </Pressable>

          <View>
            <T w="display" size={30} style={{ letterSpacing: -0.6 }}>
              Create your account
            </T>
            <T w="regular" size={14} color={C.ink500} style={{ marginTop: 4 }}>
              Start selling in minutes.
            </T>
          </View>

          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Field label="First name">
                <Input
                  value={f.firstName}
                  onChangeText={set("firstName")}
                  placeholder="Adaeze"
                  autoComplete="given-name"
                />
              </Field>
            </View>

            <View style={{ flex: 1 }}>
              <Field label="Last name">
                <Input
                  value={f.lastName}
                  onChangeText={set("lastName")}
                  placeholder="Okafor"
                  autoComplete="family-name"
                />
              </Field>
            </View>
          </View>

          <Field label="Email">
            <Input
              value={f.email}
              onChangeText={set("email")}
              placeholder="you@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
            />
          </Field>

          <Field label="Phone" hint="Shown to customers on your storefront.">
            <Input
              value={f.phone}
              onChangeText={set("phone")}
              placeholder="+234 800 000 0000"
              keyboardType="phone-pad"
              autoComplete="tel"
            />
          </Field>

          <Field label="Password">
            <View style={{ position: "relative", justifyContent: "center" }}>
              <Input
                value={f.password}
                onChangeText={set("password")}
                placeholder="At least 8 characters"
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                style={{ paddingRight: 50 }}
              />

              <Pressable
                onPress={() => setShowPassword((prev) => !prev)}
                hitSlop={10}
                style={{
                  position: "absolute",
                  right: 15,
                  height: "100%",
                  justifyContent: "center",
                }}
              >
                <Ionicons
                  name={showPassword ? "eye-off-outline" : "eye-outline"}
                  size={21}
                  color={C.ink500}
                />
              </Pressable>
            </View>
          </Field>

          <Field label="Confirm password">
            <View style={{ position: "relative", justifyContent: "center" }}>
              <Input
                value={f.confirmPassword}
                onChangeText={set("confirmPassword")}
                placeholder="Same password again"
                secureTextEntry={!showConfirmPassword}
                autoCapitalize="none"
                onSubmitEditing={submit}
                style={{ paddingRight: 50 }}
              />

              <Pressable
                onPress={() => setShowConfirmPassword((prev) => !prev)}
                hitSlop={10}
                style={{
                  position: "absolute",
                  right: 15,
                  height: "100%",
                  justifyContent: "center",
                }}
              >
                <Ionicons
                  name={showConfirmPassword ? "eye-off-outline" : "eye-outline"}
                  size={21}
                  color={C.ink500}
                />
              </Pressable>
            </View>
          </Field>

          <Button
            label="Create account"
            onPress={submit}
            busy={busy}
            style={{ marginTop: 6 }}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
