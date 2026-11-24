import { useCallback, useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { api } from "../../../src/lib/api";
import { apiErrorMessage } from "../../../src/lib/format";
import { Card, ErrorState, Field, Input, Skeleton, T, toast } from "../../../src/components/ui";
import { Note, SaveBar } from "../../../src/components/settings/bits";
import { Page } from "../../../src/components/kit";
import { C } from "../../../src/theme";

export default function PinSettings() {
  const [configured, setConfigured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res: any = await api.get("/api/dashboard/settings/pin");
      setConfigured(!!res?.configured);
    } catch (e: any) {
      setError(apiErrorMessage(e, "Couldn't load PIN settings."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    if (!/^\d{6}$/.test(pin)) return toast.error("PIN must contain exactly six digits.");
    if (pin !== confirmPin) return toast.error("The PINs don't match.");
    if (configured && !currentPassword) return toast.error("Enter your account password to change your PIN.");
    setBusy(true);
    try {
      const body: { pin: string; currentPassword?: string } = { pin };
      if (configured) body.currentPassword = currentPassword;
      const res: any = await api.put("/api/dashboard/settings/pin", body);
      if (res?.ok === false) throw new Error("The PIN was not saved.");
      setConfigured(true);
      setPin("");
      setConfirmPin("");
      setCurrentPassword("");
      toast.success(configured ? "PIN changed." : "PIN sign-in is ready.");
    } catch (e: any) {
      toast.error(apiErrorMessage(e, "Couldn't save your PIN.", {
        INVALID_CREDENTIALS: "The account password is incorrect.",
        INVALID_PIN: "PIN must contain exactly six digits.",
      }));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Page title="PIN sign-in">
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        {error ? <ErrorState message={error} onRetry={load} /> : (
          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 14 }} keyboardShouldPersistTaps="handled">
            {loading ? <><Skeleton h={90} r={18} /><Skeleton h={52} r={16} /><Skeleton h={52} r={16} /></> : <>
              <Card style={{ padding: 16, gap: 8 }}>
                <T w="display" size={16}>{configured ? "PIN is configured" : "Set up PIN sign-in"}</T>
                <T w="regular" size={13} color={C.ink500} style={{ lineHeight: 19 }}>
                  Use your email and six-digit account PIN to sign in. This account PIN is separate from your phone's device lock.
                </T>
              </Card>

              <Field label={configured ? "New six-digit PIN" : "Six-digit PIN"}>
                <Input
                  value={pin}
                  onChangeText={(v) => setPin(v.replace(/\D/g, "").slice(0, 6))}
                  placeholder="••••••"
                  secureTextEntry
                  keyboardType="number-pad"
                  autoComplete="off"
                  maxLength={6}
                />
              </Field>
              <Field label="Confirm PIN">
                <Input
                  value={confirmPin}
                  onChangeText={(v) => setConfirmPin(v.replace(/\D/g, "").slice(0, 6))}
                  placeholder="••••••"
                  secureTextEntry
                  keyboardType="number-pad"
                  autoComplete="off"
                  maxLength={6}
                  onSubmitEditing={save}
                />
              </Field>
              {configured ? (
                <Field label="Account password" hint="Required to replace your current PIN.">
                  <Input
                    value={currentPassword}
                    onChangeText={setCurrentPassword}
                    placeholder="Current account password"
                    secureTextEntry
                    autoCapitalize="none"
                    autoComplete="current-password"
                    textContentType="password"
                  />
                </Field>
              ) : (
                <Note>Your PIN is sent securely to Brikoh and stored as a bcrypt hash. It is not saved on this device. Five consecutive incorrect sign-in attempts lock PIN sign-in for 15 minutes.</Note>
              )}
              {configured ? (
                <Note>Changing an existing PIN requires your account password. Google-only accounts can set an initial PIN, but cannot replace it until password reauthentication is supported. If you no longer have the password, reset it and sign in again first.</Note>
              ) : null}
              <SaveBar label={configured ? "Change PIN" : "Set PIN"} icon="key-outline" busy={busy} onPress={save} />
            </>}
          </ScrollView>
        )}
      </KeyboardAvoidingView>
    </Page>
  );
}
