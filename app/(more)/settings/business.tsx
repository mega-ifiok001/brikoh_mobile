import { useCallback, useEffect, useState } from "react";
import { api } from "../../../src/lib/api";
import { apiErrorMessage, titleCase } from "../../../src/lib/format";
import { useAuth } from "../../../src/context/AuthContext";
import { Field, Input, toast } from "../../../src/components/ui";
import { SelectField } from "../../../src/components/kit";
import { SaveBar, SettingsScreen } from "../../../src/components/settings/bits";

const BUSINESS_TYPES = ["RETAIL", "FOOD_AND_BEVERAGE", "FASHION_AND_WEARABLES", "HEALTH_AND_BEAUTY", "ELECTRONICS", "PROFESSIONAL_SERVICES", "AGRICULTURE", "OTHER"];
const CURRENCIES = ["NGN", "USD", "GHS", "KES", "ZAR"];

export default function BusinessSettings() {
  const { refresh } = useAuth();
  const [form, setForm] = useState({ name: "", businessType: "RETAIL", location: "", currency: "NGN", businessPhone: "" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res: any = await api.get("/api/dashboard/settings/business");
      setForm({
        name: res.name || "",
        businessType: res.businessType || "RETAIL",
        location: res.location || "",
        currency: res.currency || "NGN",
        businessPhone: res.businessPhone || "",
      });
    } catch (e: any) {
      setError(apiErrorMessage(e, "Couldn't load business settings."));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    if (!form.name.trim() || !form.location.trim() || !form.businessPhone.trim()) {
      toast.error("Store name, location and phone are required.");
      return;
    }
    setBusy(true);
    try {
      await api.put("/api/dashboard/settings/business", {
        name: form.name.trim(),
        businessType: form.businessType,
        location: form.location.trim(),
        currency: form.currency,
        businessPhone: form.businessPhone.trim(),
      });
      toast.success("Business details saved.");
      await refresh();
    } catch (e: any) {
      toast.error(apiErrorMessage(e, "Couldn't save those details."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SettingsScreen title="Business" loading={loading} error={error} onRetry={load}>
      <Field label="Store name">
        <Input value={form.name} onChangeText={(v) => setForm({ ...form, name: v })} />
      </Field>
      <SelectField label="Business type" value={form.businessType} options={BUSINESS_TYPES.map((t) => ({ value: t, label: titleCase(t.replace(/_/g, " ")) }))} onChange={(v) => setForm({ ...form, businessType: v })} />
      <Field label="Location">
        <Input value={form.location} onChangeText={(v) => setForm({ ...form, location: v })} />
      </Field>
      <Field label="Business phone">
        <Input value={form.businessPhone} onChangeText={(v) => setForm({ ...form, businessPhone: v })} keyboardType="phone-pad" />
      </Field>
      <SelectField label="Currency" value={form.currency} options={CURRENCIES.map((c) => ({ value: c, label: c }))} onChange={(v) => setForm({ ...form, currency: v })} />
      <SaveBar label="Save changes" busy={busy} onPress={save} />
    </SettingsScreen>
  );
}
