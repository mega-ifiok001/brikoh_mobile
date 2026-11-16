import { useCallback, useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../../src/lib/api";
import { apiErrorMessage, titleCase } from "../../../src/lib/format";
import { Card, Field, Input, T, toast } from "../../../src/components/ui";
import { SelectField, SwitchRow } from "../../../src/components/kit";
import { SaveBar, SettingsScreen } from "../../../src/components/settings/bits";
import { C } from "../../../src/theme";

const TEMPLATES = ["CLASSIC", "MODERN", "BOLD"];
const ACCENT_SWATCH = ["#18181b", "#16a34a", "#2563eb", "#ea580c", "#db2777", "#7c3aed", "#0d9488", "#dc2626"];

export default function StorefrontSettings() {
  const [form, setForm] = useState({
    template: "CLASSIC",
    tagline: "",
    heroTitle: "",
    heroSubtitle: "",
    accentColor: "#18181b",
    whatsappButtonEnabled: false,
    whatsappNumber: "",
    showPoweredByBadge: true,
    ga4MeasurementId: "",
    instagram: "",
    facebook: "",
    tiktok: "",
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res: any = await api.get("/api/dashboard/settings/storefront");
      setForm({
        template: res.template || "CLASSIC",
        tagline: res.tagline || "",
        heroTitle: res.heroTitle || "",
        heroSubtitle: res.heroSubtitle || "",
        accentColor: res.accentColor || "#18181b",
        whatsappButtonEnabled: !!res.whatsappButtonEnabled,
        whatsappNumber: res.whatsappNumber || "",
        showPoweredByBadge: res.showPoweredByBadge !== false,
        ga4MeasurementId: res.ga4MeasurementId || "",
        instagram: res.socialLinks?.instagram || "",
        facebook: res.socialLinks?.facebook || "",
        tiktok: res.socialLinks?.tiktok || "",
      });
    } catch (e: any) {
      setError(apiErrorMessage(e, "Couldn't load storefront settings."));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    setBusy(true);
    try {
      await api.put("/api/dashboard/settings/storefront", {
        template: form.template,
        tagline: form.tagline.trim() || null,
        heroTitle: form.heroTitle.trim() || null,
        heroSubtitle: form.heroSubtitle.trim() || null,
        accentColor: form.accentColor,
        whatsappButtonEnabled: form.whatsappButtonEnabled,
        whatsappNumber: form.whatsappNumber.trim() || null,
        showPoweredByBadge: form.showPoweredByBadge,
        ga4MeasurementId: form.ga4MeasurementId.trim() || null,
        socialLinks: {
          instagram: form.instagram.trim() || null,
          facebook: form.facebook.trim() || null,
          tiktok: form.tiktok.trim() || null,
        },
      });
      toast.success("Storefront settings saved.");
    } catch (e: any) {
      toast.error(apiErrorMessage(e, "Couldn't save storefront settings."));
    } finally {
      setBusy(false);
    }
  };

  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <SettingsScreen title="Storefront" loading={loading} error={error} onRetry={load}>
      <SelectField label="Template" value={form.template} options={TEMPLATES.map((t) => ({ value: t, label: titleCase(t) }))} onChange={set("template")} />
      <Field label="Tagline">
        <Input value={form.tagline} onChangeText={set("tagline")} placeholder="Short line under your store name" maxLength={80} />
      </Field>
      <Field label="Hero title">
        <Input value={form.heroTitle} onChangeText={set("heroTitle")} placeholder="e.g. Fresh goods, daily" maxLength={60} />
      </Field>
      <Field label="Hero subtitle">
        <Input value={form.heroSubtitle} onChangeText={set("heroSubtitle")} placeholder="A little more about what you sell" maxLength={120} />
      </Field>
      <Field label="Accent color">
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
          {ACCENT_SWATCH.map((c) => {
            const on = form.accentColor === c;
            return (
              <Pressable key={c} onPress={() => set("accentColor")(c)} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: c, borderWidth: 3, borderColor: on ? C.brand : C.white, alignItems: "center", justifyContent: "center" }}>
                {on ? <Ionicons name="checkmark" size={18} color="#fff" /> : null}
              </Pressable>
            );
          })}
        </View>
      </Field>
      <Card style={{ paddingHorizontal: 14 }}>
        <SwitchRow label="WhatsApp button" sub="Show a chat button on the storefront" value={form.whatsappButtonEnabled} onChange={(v) => setForm({ ...form, whatsappButtonEnabled: v })} />
        <SwitchRow label={'"Powered by Brikoh" badge'} sub="Shown in the storefront footer" value={form.showPoweredByBadge} onChange={(v) => setForm({ ...form, showPoweredByBadge: v })} />
      </Card>
      {form.whatsappButtonEnabled ? (
        <Field label="WhatsApp number">
          <Input value={form.whatsappNumber} onChangeText={set("whatsappNumber")} placeholder="+2348012345678" keyboardType="phone-pad" />
        </Field>
      ) : null}
      <Field label="Google Analytics 4 ID" hint="Optional, e.g. G-ABCDE12345">
        <Input value={form.ga4MeasurementId} onChangeText={set("ga4MeasurementId")} placeholder="G-XXXXXXXX" autoCapitalize="characters" autoCorrect={false} />
      </Field>
      <T w="display" size={15}>
        Social links
      </T>
      <Field label="Instagram">
        <Input value={form.instagram} onChangeText={set("instagram")} placeholder="https://instagram.com/..." autoCapitalize="none" keyboardType="url" />
      </Field>
      <Field label="Facebook">
        <Input value={form.facebook} onChangeText={set("facebook")} placeholder="https://facebook.com/..." autoCapitalize="none" keyboardType="url" />
      </Field>
      <Field label="TikTok">
        <Input value={form.tiktok} onChangeText={set("tiktok")} placeholder="https://tiktok.com/@..." autoCapitalize="none" keyboardType="url" />
      </Field>
      <SaveBar label="Save storefront" busy={busy} onPress={save} />
    </SettingsScreen>
  );
}
