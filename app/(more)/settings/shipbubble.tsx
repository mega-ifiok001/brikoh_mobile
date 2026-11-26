import { useCallback, useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
import type { ReactNode } from "react";
import { Button, Card, Field, Input, Skeleton, T, toast } from "../../../src/components/ui";
import { Note, SaveBar } from "../../../src/components/settings/bits";
import { Page } from "../../../src/components/kit";
import { api } from "../../../src/lib/api";
import { apiErrorMessage } from "../../../src/lib/format";
import { C } from "../../../src/theme";

type ConfigForm = {
  name: string;
  email: string;
  phone: string;
  address: string;
  categoryId: string;
  length: string;
  width: string;
  height: string;
};

const blank = (): ConfigForm => ({ name: "", email: "", phone: "", address: "", categoryId: "", length: "20", width: "15", height: "10" });

export default function ShipbubbleSettings() {
  const [form, setForm] = useState<ConfigForm>(blank);
  const [configured, setConfigured] = useState(false);
  const [addressCode, setAddressCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res: any = await api.get("/api/dashboard/settings/shipbubble");
      setConfigured(!!res?.configured);
      setAddressCode(res?.senderAddressCode ? String(res.senderAddressCode) : null);
      if (res?.categoryId != null || res?.packageDimension) {
        setForm((current) => ({
          ...current,
          categoryId: res?.categoryId != null ? String(res.categoryId) : current.categoryId,
          length: res?.packageDimension?.length != null ? String(res.packageDimension.length) : current.length,
          width: res?.packageDimension?.width != null ? String(res.packageDimension.width) : current.width,
          height: res?.packageDimension?.height != null ? String(res.packageDimension.height) : current.height,
        }));
      }
    } catch (e: any) {
      setError(apiErrorMessage(e, "Couldn't load Shipbubble settings."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    const categoryId = Number(form.categoryId);
    const length = Number(form.length);
    const width = Number(form.width);
    const height = Number(form.height);
    if (!form.name.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()) || !form.phone.trim() || form.address.trim().length < 5) {
      return toast.error("Enter a sender name, valid email, phone number and full pickup address.");
    }
    if (!Number.isSafeInteger(categoryId) || categoryId <= 0) return toast.error("Enter a valid Shipbubble parcel category ID.");
    if (![length, width, height].every((v) => Number.isFinite(v) && v > 0 && v <= 10000)) return toast.error("Enter positive package dimensions in centimetres.");
    setSaving(true);
    try {
      const res: any = await api.put("/api/dashboard/settings/shipbubble", {
        sender: { name: form.name.trim(), email: form.email.trim(), phone: form.phone.trim(), address: form.address.trim() },
        categoryId,
        packageDimension: { length, width, height },
      });
      setConfigured(!!res?.configured);
      setAddressCode(res?.senderAddressCode ? String(res.senderAddressCode) : null);
      toast.success(res?.formattedAddress ? `Pickup address saved: ${res.formattedAddress}` : "Shipbubble pickup and package settings saved.");
      await load();
    } catch (e: any) {
      toast.error(apiErrorMessage(e, "Couldn't save Shipbubble settings.", {
        SHIPBUBBLE_ADDRESS_VALIDATION_FAILED: "Shipbubble couldn't validate that pickup address. Check the address and try again.",
        SHIPBUBBLE_NOT_CONFIGURED: "Shipbubble isn't configured on the backend yet. Ask the backend team to add its sandbox key.",
      }));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Page title="Shipbubble shipping">
      {error ? (
        <Card style={{ margin: 16, padding: 16, gap: 10 }}>
          <T w="bold" size={13} color={C.danger500}>{error}</T>
          <Button label="Retry" small variant="outline" onPress={load} />
        </Card>
      ) : loading ? (
        <View style={{ padding: 16, gap: 12 }}><Skeleton h={80} r={18} /><Skeleton h={55} r={15} /><Skeleton h={55} r={15} /></View>
      ) : (
        <KeyboardForm>
          <Card style={{ padding: 14, gap: 7 }}>
            <T w="display" size={16}>{configured ? "Shipbubble is configured" : "Configure pickup and parcels"}</T>
            <T w="regular" size={12.5} color={C.ink500} style={{ lineHeight: 19 }}>
              These details are used to validate the pickup address and request courier rates. Product shipping weights are set on each product.
            </T>
            {addressCode ? <T w="semi" size={11.5} color={C.leaf500}>Validated pickup address code · {addressCode}</T> : null}
          </Card>
          <Note>The Shipbubble API key stays on the backend and is never entered or stored in this app. The backend does not return your sender contact details, so enter them again whenever you save changes.</Note>
          <Field label="Pickup contact name"><Input value={form.name} onChangeText={(name) => setForm({ ...form, name })} placeholder="Store or sender name" maxLength={200} /></Field>
          <Field label="Pickup email"><Input value={form.email} onChangeText={(email) => setForm({ ...form, email })} placeholder="store@example.com" keyboardType="email-address" autoCapitalize="none" autoCorrect={false} /></Field>
          <Field label="Pickup phone"><Input value={form.phone} onChangeText={(phone) => setForm({ ...form, phone })} placeholder="+234…" keyboardType="phone-pad" maxLength={30} /></Field>
          <Field label="Pickup street address" hint="Include area, city and state."><Input value={form.address} onChangeText={(address) => setForm({ ...form, address })} placeholder="Street address, Lagos, Nigeria" multiline maxLength={500} style={{ height: 78, alignItems: "flex-start", paddingVertical: 10 }} /></Field>
          <Field label="Parcel category ID" hint="Use a category ID supported by your Shipbubble account."><Input value={form.categoryId} onChangeText={(categoryId) => setForm({ ...form, categoryId: categoryId.replace(/\D/g, "") })} placeholder="e.g. 1" keyboardType="number-pad" /></Field>
          <T w="bold" size={13} color={C.ink500}>Default package dimensions (cm)</T>
          <View style={{ flexDirection: "row", gap: 10 }}>
            {(["length", "width", "height"] as const).map((key) => (
              <View key={key} style={{ flex: 1 }}>
                <Field label={key[0].toUpperCase() + key.slice(1)}>
                  <Input value={form[key]} onChangeText={(v) => setForm({ ...form, [key]: v.replace(/[^0-9.]/g, "") })} keyboardType="decimal-pad" placeholder="cm" />
                </Field>
              </View>
            ))}
          </View>
          <SaveBar label="Save Shipbubble settings" icon="save-outline" busy={saving} onPress={save} />
        </KeyboardForm>
      )}
    </Page>
  );
}

function KeyboardForm({ children }: { children: ReactNode }) {
  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 14 }} keyboardShouldPersistTaps="handled">
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
