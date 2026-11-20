import { useState } from "react";
import { KeyboardAvoidingView, Linking, Platform, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../src/context/AuthContext";
import { api } from "../src/lib/api";
import { useRouter } from "expo-router";
import { resendVerification } from "../src/lib/authApi";
import { apiErrorMessage, titleCase } from "../src/lib/format";
import { Button, Field, Input, T, toast } from "../src/components/ui";
import { SelectField } from "../src/components/kit";
import { C } from "../src/theme";

// POST /api/dashboard/onboarding — creates the Store + Owner for this account (once only).
// The server derives the subdomain from the store name; it must never be sent from here.
const ONBOARD_ENDPOINT = "/api/dashboard/onboarding";

const BUSINESS_TYPES = ["RETAIL", "FOOD_AND_BEVERAGE", "FASHION_AND_WEARABLES", "HEALTH_AND_BEAUTY", "ELECTRONICS", "PROFESSIONAL_SERVICES", "AGRICULTURE", "OTHER"];
const CURRENCIES = ["NGN", "USD", "GHS", "KES", "ZAR"];

// Shown when you're signed in but no store exists on the account yet.
// New users create their store right here instead of being sent to the website.
export default function Setup() {
  const { me, refresh, logout } = useAuth();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [resending, setResending] = useState(false);
  // Set when the server says the email isn't verified yet (403 VERIFICATION_REQUIRED).
  const [needsVerify, setNeedsVerify] = useState(false);
  const [form, setForm] = useState({
    name: "",
    businessType: "RETAIL",
    location: "",
    currency: "NGN",
    businessPhone: me.account?.phone || "",
  });

  const resend = async () => {
    setResending(true);
    try {
           const sent = await resendVerification();
      if (sent) {
        toast.success("Verification email sent. Check your inbox.");
      } else {
        setNeedsVerify(false);
        await refresh();
        toast.success("Your email is already verified. Tap Create my store.");
      }
    } catch (e: any) {
      if (e?.code === "ALREADY_VERIFIED") {
        setNeedsVerify(false);
        toast.success("Your email is already verified. Tap Create my store.");
      } else {
        toast.error(apiErrorMessage(e, "Couldn't send the email. Try again in a minute."));
      }
    } finally {
      setResending(false);
    }
  };

  const submit = async () => {
    const name = form.name.trim();
    const location = form.location.trim();
    const phone = form.businessPhone.trim();
    // Same rules as the server: letters and single spaces only, 1-120 chars.
    if (!/^[A-Za-z]+( [A-Za-z]+)*$/.test(name) || name.length > 120) {
      toast.error("Store name can only use letters and single spaces (no numbers or symbols).");
      return;
    }
    if (location.length < 2) {
      toast.error("Please enter your location, e.g. Lagos, Nigeria.");
      return;
    }
    if (phone.length < 7 || phone.length > 17) {
      toast.error("Enter a valid business phone number (7-17 characters).");
      return;
    }
    setBusy(true);
    try {
      await api.post(ONBOARD_ENDPOINT, {
        name,
        businessType: form.businessType,
        location,
        currency: form.currency,
        businessPhone: phone,
      });
      await refresh(); // loads the new store; the app then moves on to the dashboard
      toast.success("Your store is ready!");
    } catch (e: any) {
      if (e?.code === "VERIFICATION_REQUIRED") {
        setNeedsVerify(true);
        toast.error("Please verify your email first.");
      } else if (e?.code === "ALREADY_ONBOARDED") {
        await refresh(); // the store already exists, just load it
      } else {
        toast.error(
          apiErrorMessage(e, "Couldn't create your store. Please try again.", {
            SUBDOMAIN_RESERVED: "That store name is reserved. Please pick a different name.",
            SUBDOMAIN_TOO_SHORT: "That store name is too short. Please use a longer name.",
          })
        );
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.cream50 }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 40, gap: 14 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={{ alignItems: "center", gap: 8, marginTop: 8 }}>
            <View style={{ width: 72, height: 72, borderRadius: 24, backgroundColor: C.brand50, alignItems: "center", justifyContent: "center" }}>
              <Ionicons name="storefront-outline" size={32} color={C.brand} />
            </View>
            <T w="display" size={24} style={{ textAlign: "center" }}>
              Set up your store
            </T>
            <T w="regular" size={14} color={C.ink500} style={{ textAlign: "center", lineHeight: 21, maxWidth: 320 }}>
              Tell us a bit about your business to get started. You can change these later in Settings.
            </T>
          </View>

          {needsVerify && (
            <View style={{ backgroundColor: C.brand50, borderRadius: 16, padding: 14, gap: 10 }}>
              <T w="bold" size={13.5}>
                Verify your email first
              </T>
              <T w="regular" size={13} color={C.ink500} style={{ lineHeight: 19 }}>
                We sent a verification link to {me.account?.email || "your email"}. Open it, then come back here and tap Create my store.
              </T>
              <Button label="Resend verification email" variant="outline" small busy={resending} onPress={resend} />
              <Button label="I have a verification code" variant="ghost" small onPress={() => router.push("/verify-email")} />
            </View>
          )}

          <Field label="Store name" hint="Letters and spaces only. Your store link is made from this.">
            <Input value={form.name} onChangeText={(v) => setForm({ ...form, name: v })} placeholder="Adaeze's Boutique" />
          </Field>
          <SelectField
            label="Business type"
            value={form.businessType}
            options={BUSINESS_TYPES.map((t) => ({ value: t, label: titleCase(t.replace(/_/g, " ")) }))}
            onChange={(v) => setForm({ ...form, businessType: v })}
          />
          <Field label="Location">
            <Input value={form.location} onChangeText={(v) => setForm({ ...form, location: v })} placeholder="Lagos, Nigeria" />
          </Field>
          <Field label="Business phone">
            <Input value={form.businessPhone} onChangeText={(v) => setForm({ ...form, businessPhone: v })} placeholder="+234 800 000 0000" keyboardType="phone-pad" />
          </Field>
          <SelectField label="Currency" value={form.currency} options={CURRENCIES.map((c) => ({ value: c, label: c }))} onChange={(v) => setForm({ ...form, currency: v })} />

          <Button label="Create my store" busy={busy} onPress={submit} style={{ marginTop: 8 }} />
          <Button label="Finish on brikoh.com instead" variant="outline" onPress={() => Linking.openURL("https://brikoh.com/#/onboarding")} />
          <Button label="Sign out" variant="ghost" onPress={logout} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}