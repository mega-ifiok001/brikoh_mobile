import { useCallback, useEffect, useRef, useState } from "react";
import { Image, Linking, Pressable, RefreshControl, ScrollView, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../src/context/AuthContext";
import { getAccess } from "../../src/lib/access";
import { api } from "../../src/lib/api";
import { apiErrorMessage, asList, fd, rawNum, titleCase } from "../../src/lib/format";
import { Button, Card, EmptyState, ErrorState, Field, Input, Money, Pill, Skeleton, StatusPill, T, toast } from "../../src/components/ui";
import { ConfirmSheet, ListRow, Page, Segmented, SelectField, StatTile, SwitchRow } from "../../src/components/kit";
import { DateField, ErrorBanner, FormSheet, parseDateInput } from "../../src/components/invoices/shared";
import { C } from "../../src/theme";

type Tab = "branding" | "campaigns" | "payments";

export default function StorefrontStudio() {
  const { me } = useAuth();
  const allowed = getAccess(me).can("storefront");
  const [tab, setTab] = useState<Tab>("branding");

  if (!allowed) {
    return (
      <Page title="Storefront">
        <EmptyState icon="lock-closed-outline" title="No access" sub="Your role doesn't include the storefront. Ask the store owner to grant it." />
      </Page>
    );
  }

  return (
    <Page title="Storefront">
      <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
        <Segmented
          options={[
            { value: "branding", label: "Branding" },
            { value: "campaigns", label: "Campaigns" },
            { value: "payments", label: "Payments" },
          ]}
          value={tab}
          onChange={(v) => setTab(v as Tab)}
        />
      </View>
      <View style={{ flex: 1 }}>{tab === "branding" ? <Studio /> : tab === "campaigns" ? <Campaigns /> : <Payments />}</View>
    </Page>
  );
}

/* ------------------------------ Theme & branding ---------------------------- */

/*
 * The settings endpoint is replace-semantics and validates a strict shape, so every write
 * re-sends the FULL known object: base values from the last GET with branding overrides on top.
 */
function buildSettingsPayload(base: any, overrides: Record<string, any>) {
  const b = base || {};
  return {
    template: overrides.template ?? b.template ?? "CLASSIC",
    tagline: overrides.tagline !== undefined ? overrides.tagline : (b.tagline ?? null),
    heroTitle: overrides.heroTitle !== undefined ? overrides.heroTitle : (b.heroTitle ?? null),
    heroSubtitle: overrides.heroSubtitle !== undefined ? overrides.heroSubtitle : (b.heroSubtitle ?? null),
    accentColor: overrides.accentColor !== undefined ? overrides.accentColor : b.accentColor || "#18181b",
    whatsappButtonEnabled: b.whatsappButtonEnabled ?? false,
    whatsappNumber: b.whatsappNumber ?? null,
    showPoweredByBadge: b.showPoweredByBadge ?? true,
    ga4MeasurementId: b.ga4MeasurementId ?? null,
    socialLinks: b.socialLinks ?? { instagram: null, facebook: null, tiktok: null },
  };
}

/** Maps an applied template onto the public storefront's template enum; null = unrecognised, skip the sync. */
function mapTemplateToSettingsEnum(t: any): string | null {
  const s = `${t?.slug || ""} ${t?.name || ""}`.toLowerCase();
  if (s.includes("modern")) return "MODERN";
  if (s.includes("bold") || s.includes("boutique")) return "BOLD";
  if (s.includes("classic")) return "CLASSIC";
  return null;
}

const ACCENT_SWATCH = ["#18181b", "#16a34a", "#2563eb", "#ea580c", "#db2777", "#7c3aed", "#0d9488", "#dc2626"];

function Studio() {
  const { me } = useAuth();
  const subdomain: string = (me.store as any)?.subdomain || "";
  const previewUrl = subdomain ? `https://${subdomain}.brikoh.com` : "";

  const [templates, setTemplates] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tier, setTier] = useState("STARTER");
  const [visibleCount, setVisibleCount] = useState<number | null>(3);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const [draft, setDraft] = useState({ accentColor: "", heroTitle: "", heroSubtitle: "", tagline: "", logoUrl: "", announcementEnabled: false, announcementText: "" });
  // Snapshot of the last GET /settings/storefront so saves keep WhatsApp, socials, badge and GA4 intact.
  const snapshot = useRef<any>(null);
  const [saving, setSaving] = useState(false);
  const [applying, setApplying] = useState<string | null>(null);

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    setError(null);
    try {
      const [templatesRes, settingsRes]: any[] = await Promise.all([api.get("/api/dashboard/templates"), api.get("/api/dashboard/settings/storefront").catch(() => null)]);
      setTemplates(Array.isArray(templatesRes?.templates) ? templatesRes.templates : asList(templatesRes, "templates", "items"));
      setSelectedId(templatesRes?.selectedTemplateId ?? null);
      setTier(templatesRes?.tier || "STARTER");
      setVisibleCount(templatesRes?.visibleCount ?? null);
      const pub = settingsRes || {};
      snapshot.current = settingsRes ? { ...pub } : null;
      const overlay = templatesRes?.settings || {};
      setDraft({
        accentColor: pub.accentColor || overlay.accentColor || "",
        heroTitle: pub.heroTitle || "",
        heroSubtitle: pub.heroSubtitle || "",
        tagline: pub.tagline || "",
        logoUrl: overlay.logoUrl || "",
        announcementEnabled: !!overlay.announcementBar?.enabled,
        announcementText: overlay.announcementBar?.text || "",
      });
    } catch (e: any) {
      setError(apiErrorMessage(e, "Couldn't load templates."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const applyTemplate = async (t: any) => {
    setApplying(t.id);
    try {
      await api.put("/api/dashboard/templates", { templateId: t.id });
      setSelectedId(t.id);
      toast.success(`Theme "${t.name}" applied.`);
      // Keep the public storefront in sync: it renders from settings.template. Non-fatal on failure.
      try {
        const mapped = mapTemplateToSettingsEnum(t);
        const cur = await api.get("/api/dashboard/settings/storefront");
        if (cur && mapped) {
          await api.put("/api/dashboard/settings/storefront", buildSettingsPayload(cur, { template: mapped }));
          snapshot.current = { ...cur, template: mapped };
        }
      } catch {
        /* the template apply itself succeeded */
      }
    } catch (e: any) {
      toast.error(apiErrorMessage(e, "Couldn't apply that template.", { TEMPLATE_NOT_AVAILABLE: "That template isn't available on your plan." }));
    } finally {
      setApplying(null);
    }
  };

  const save = async () => {
    const accent = draft.accentColor.trim();
    if (accent && !/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(accent)) {
      toast.error("Accent colour must be a hex value like #18181b.");
      return;
    }
    const heroTitle = draft.heroTitle.trim();
    const heroSubtitle = draft.heroSubtitle.trim();
    const tagline = draft.tagline.trim();
    setSaving(true);
    try {
      let settingsSaved = false;
      if (snapshot.current) {
        await api.put(
          "/api/dashboard/settings/storefront",
          buildSettingsPayload(snapshot.current, { accentColor: accent || undefined, heroTitle: heroTitle || null, heroSubtitle: heroSubtitle || null, tagline: tagline || null })
        );
        snapshot.current = { ...snapshot.current, accentColor: accent || snapshot.current.accentColor, heroTitle: heroTitle || null, heroSubtitle: heroSubtitle || null, tagline: tagline || null };
        settingsSaved = true;
      }
      // Template customization overlay (replace semantics: omitted fields are cleared).
      const payload: any = { accentColor: accent || snapshot.current?.accentColor || "#18181b" };
      if (heroTitle) payload.heroText = heroTitle;
      if (heroSubtitle) payload.heroSubtext = heroSubtitle;
      if (draft.logoUrl.trim()) payload.logoUrl = draft.logoUrl.trim();
      if (draft.announcementEnabled && draft.announcementText.trim()) payload.announcementBar = { enabled: true, text: draft.announcementText.trim() };
      await api.put("/api/dashboard/templates/customization", payload);
      toast.success(settingsSaved ? "Branding saved." : "Branding saved to the template overlay.");
    } catch (e: any) {
      toast.error(apiErrorMessage(e, "Couldn't save branding."));
    } finally {
      setSaving(false);
    }
  };

  const openPreview = () => {
    if (previewUrl) Linking.openURL(previewUrl).catch(() => toast.error("Couldn't open the preview."));
  };

  const set = (k: keyof typeof draft) => (v: string) => setDraft((d) => ({ ...d, [k]: v }));

  if (loading) {
    return (
      <View style={{ padding: 16, gap: 12 }}>
        <Skeleton h={70} />
        <Skeleton h={150} />
        <Skeleton h={150} />
      </View>
    );
  }
  if (error) return <ErrorState message={error} onRetry={() => load()} />;

  return (
    <ScrollView
      contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 40 }}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={async () => {
            setRefreshing(true);
            await load(true);
            setRefreshing(false);
          }}
        />
      }
    >
      <Card style={{ padding: 14, gap: 10 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <View style={{ width: 40, height: 40, borderRadius: 13, backgroundColor: C.brand50, alignItems: "center", justifyContent: "center" }}>
            <Ionicons name="storefront-outline" size={20} color={C.brand} />
          </View>
          <View style={{ flex: 1 }}>
            <T w="extra" size={14.5} numberOfLines={1}>
              {subdomain ? `${subdomain}.brikoh.com` : "No subdomain yet"}
            </T>
            <T w="regular" size={12} color={C.ink400}>
              {subdomain ? "Your customers shop here." : "Set one up in Settings, Business."}
            </T>
          </View>
        </View>
        {subdomain ? <Button label="Open preview" icon="open-outline" variant="dark" small onPress={openPreview} /> : null}
      </Card>

      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <T w="display" size={17}>
          Templates
        </T>
        <Pill>
          {titleCase(tier)}
          {visibleCount != null ? ` · first ${visibleCount}` : " · all"}
        </Pill>
      </View>

      {templates.length === 0 ? (
        <Card>
          <EmptyState icon="image-outline" title="No templates published yet" sub="Your storefront runs on the default layout until themes are released." />
        </Card>
      ) : (
        templates.map((t, i) => {
          const active = t.id === selectedId;
          return (
            <Card key={t.id} style={{ padding: 0, overflow: "hidden", borderWidth: active ? 2 : 1, borderColor: active ? C.brand : C.cream200 }}>
              <View style={{ height: 130, backgroundColor: i % 3 === 1 ? C.ink900 : i % 3 === 2 ? C.brand : C.cream100 }}>
                {t.previewUrl ? (
                  <Image source={{ uri: t.previewUrl }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
                ) : (
                  <View style={{ flex: 1, padding: 14, gap: 8 }}>
                    <View style={{ height: 12, width: "60%", borderRadius: 4, backgroundColor: i % 3 === 0 ? C.cream300 : "rgba(255,255,255,0.7)" }} />
                    <View style={{ height: 8, width: "100%", borderRadius: 4, backgroundColor: i % 3 === 0 ? C.cream200 : "rgba(255,255,255,0.4)" }} />
                    <View style={{ flexDirection: "row", gap: 8, marginTop: "auto" }}>
                      {[0, 1, 2].map((n) => (
                        <View key={n} style={{ flex: 1, height: 36, borderRadius: i % 3 === 0 ? 6 : 0, backgroundColor: "rgba(255,255,255,0.9)" }} />
                      ))}
                    </View>
                  </View>
                )}
                {active ? (
                  <View style={{ position: "absolute", left: 10, top: 10, backgroundColor: C.brand, borderRadius: 99, paddingHorizontal: 10, paddingVertical: 4 }}>
                    <T w="extra" size={10} color="#fff" style={{ textTransform: "uppercase" }}>
                      Active
                    </T>
                  </View>
                ) : null}
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10, padding: 14 }}>
                <View style={{ flex: 1 }}>
                  <T w="extra" size={14.5} numberOfLines={1}>
                    {t.name}
                  </T>
                  {t.description ? (
                    <T w="regular" size={12} color={C.ink400} numberOfLines={2}>
                      {t.description}
                    </T>
                  ) : null}
                </View>
                {!active ? <Button label="Apply" small onPress={() => applyTemplate(t)} busy={applying === t.id} disabled={!!applying} /> : null}
              </View>
            </Card>
          );
        })
      )}

      <T w="display" size={17} style={{ marginTop: 6 }}>
        Branding
      </T>
      <T w="regular" size={12.5} color={C.ink400} style={{ marginTop: -8 }}>
        Saved straight to your live storefront: hero copy, tagline, accent colour, logo and announcement bar.
      </T>
      <Field label="Tagline" hint="Small eyebrow line above the hero title.">
        <Input value={draft.tagline} onChangeText={set("tagline")} placeholder="Fresh markets, honest prices" maxLength={60} />
      </Field>
      <Field label="Hero title">
        <Input value={draft.heroTitle} onChangeText={set("heroTitle")} placeholder="Fresh from Lagos" maxLength={80} />
      </Field>
      <Field label="Hero subtitle">
        <Input value={draft.heroSubtitle} onChangeText={set("heroSubtitle")} placeholder="Handpicked goods, delivered daily" maxLength={160} />
      </Field>
      <Field label="Accent colour" hint="Hex value. Tints buttons, prices and the hero.">
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 4 }}>
          {ACCENT_SWATCH.map((c) => {
            const on = draft.accentColor.toLowerCase() === c;
            return (
              <Pressable key={c} onPress={() => set("accentColor")(c)} accessibilityLabel={`Accent ${c}`} style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: c, borderWidth: 3, borderColor: on ? C.brand : C.white, alignItems: "center", justifyContent: "center" }}>
                {on ? <Ionicons name="checkmark" size={17} color="#fff" /> : null}
              </Pressable>
            );
          })}
        </View>
        <Input value={draft.accentColor} onChangeText={set("accentColor")} placeholder="#18181b" autoCapitalize="none" autoCorrect={false} maxLength={7} />
      </Field>
      <Field label="Logo URL" hint="HTTPS URL of your logo image (image upload isn't available in the app yet).">
        <Input value={draft.logoUrl} onChangeText={set("logoUrl")} placeholder="https://..." autoCapitalize="none" autoCorrect={false} keyboardType="url" />
      </Field>
      <Card style={{ paddingHorizontal: 14 }}>
        <SwitchRow label="Announcement bar" sub="A short message pinned to the top of your storefront" value={draft.announcementEnabled} onChange={(v) => setDraft((d) => ({ ...d, announcementEnabled: v }))} />
      </Card>
      {draft.announcementEnabled ? (
        <Field label="Announcement text">
          <Input value={draft.announcementText} onChangeText={set("announcementText")} placeholder="Free delivery on orders over 50,000" maxLength={140} />
        </Field>
      ) : null}
      <Button label="Save branding" icon="checkmark" onPress={save} busy={saving} />

      <Card style={{ paddingHorizontal: 14, marginTop: 6 }}>
        <ListRow icon="car-outline" title="Delivery options" sub="Zones, fees and pickup" onPress={() => router.push("/settings/delivery")} right={<Ionicons name="chevron-forward" size={18} color={C.ink300} />} />
        <ListRow icon="settings-outline" title="More storefront settings" sub="Template, WhatsApp button, social links, analytics" onPress={() => router.push("/settings/storefront")} right={<Ionicons name="chevron-forward" size={18} color={C.ink300} />} last />
      </Card>
    </ScrollView>
  );
}

/* ---------------------------------- Campaigns ------------------------------- */

const EMPTY_CAMPAIGN = { name: "", bannerTitle: "", bannerSubtitle: "", ctaLabel: "Shop the sale", startsAt: "", endsAt: "", discountId: "", isActive: true };

function Campaigns() {
  const currency = "NGN";
  const [items, setItems] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [discounts, setDiscounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState(EMPTY_CAMPAIGN);
  const [formBusy, setFormBusy] = useState(false);
  const [formErr, setFormErr] = useState("");
  const [delFor, setDelFor] = useState<any | null>(null);
  const [delBusy, setDelBusy] = useState(false);

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    setError(null);
    try {
      const [listRes, statsRes] = await Promise.all([api.get("/api/dashboard/campaigns"), api.get("/api/dashboard/campaigns/stats").catch(() => null)]);
      setItems(asList(listRes, "items", "campaigns", "data"));
      setStats(statsRes);
    } catch (e: any) {
      setError(apiErrorMessage(e, "Couldn't load campaigns."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    api
      .get("/api/dashboard/discounts?limit=100")
      .then((res) => setDiscounts(asList(res, "items", "discounts", "data")))
      .catch(() => setDiscounts([]));
  }, [load]);

  const isLive = (c: any) => {
    if (c.isActive === false) return false;
    const now = Date.now();
    if (c.startsAt && new Date(c.startsAt).getTime() > now) return false;
    if (c.endsAt && new Date(c.endsAt).getTime() < now) return false;
    return true;
  };

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_CAMPAIGN);
    setFormErr("");
    setFormOpen(true);
  };
  const openEdit = (c: any) => {
    setEditing(c);
    setForm({
      name: c.name || "",
      bannerTitle: c.bannerTitle || "",
      bannerSubtitle: c.bannerSubtitle || "",
      ctaLabel: c.ctaLabel || "Shop the sale",
      startsAt: c.startsAt ? String(c.startsAt).slice(0, 10) : "",
      endsAt: c.endsAt ? String(c.endsAt).slice(0, 10) : "",
      discountId: c.discountId || "",
      isActive: c.isActive !== false,
    });
    setFormErr("");
    setFormOpen(true);
  };

  const submit = async () => {
    if (!form.name.trim()) return setFormErr("Give the campaign a name.");
    const s = parseDateInput(form.startsAt);
    if ("error" in s) return setFormErr(`Starts: ${s.error}`);
    const e = parseDateInput(form.endsAt);
    if ("error" in e) return setFormErr(`Ends: ${e.error}`);
    setFormBusy(true);
    setFormErr("");
    const payload: any = {
      name: form.name.trim(),
      isActive: form.isActive,
      bannerTitle: form.bannerTitle.trim() || null,
      bannerSubtitle: form.bannerSubtitle.trim() || null,
      ctaLabel: form.ctaLabel.trim() || null,
      startsAt: "iso" in s ? s.iso : null,
      endsAt: form.endsAt ? new Date(form.endsAt + "T23:59:59.999Z").toISOString() : null,
      discountId: form.discountId || null,
    };
    try {
      if (editing) {
        await api.put(`/api/dashboard/campaigns/${editing.id}`, payload);
        toast.success("Campaign updated.");
      } else {
        await api.post("/api/dashboard/campaigns", payload);
        toast.success("Campaign created.");
      }
      setFormOpen(false);
      load(true);
    } catch (err: any) {
      setFormErr(apiErrorMessage(err, "Couldn't save the campaign."));
    } finally {
      setFormBusy(false);
    }
  };

  const confirmDelete = async () => {
    if (!delFor) return;
    setDelBusy(true);
    try {
      await api.del(`/api/dashboard/campaigns/${delFor.id}`);
      toast.success("Campaign deleted.");
      setDelFor(null);
      load(true);
    } catch (err: any) {
      toast.error(apiErrorMessage(err, "Couldn't delete the campaign."));
      setDelFor(null);
    } finally {
      setDelBusy(false);
    }
  };

  const set = (k: keyof typeof EMPTY_CAMPAIGN) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  if (loading) {
    return (
      <View style={{ padding: 16, gap: 12 }}>
        <Skeleton h={70} />
        <Skeleton h={90} />
        <Skeleton h={90} />
      </View>
    );
  }
  if (error) return <ErrorState message={error} onRetry={() => load()} />;

  const attributed = (stats?.campaigns || []).reduce((a: number, c: any) => a + rawNum(c.attributedRevenue), 0);

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await load(true);
              setRefreshing(false);
            }}
          />
        }
      >
        {stats ? (
          <>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <StatTile label="Campaigns" value={`${stats.totalCampaigns ?? 0} (${stats.activeCampaigns ?? 0} live)`} />
              <StatTile label="Active coupons" value={String(stats.activeCoupons ?? 0)} />
            </View>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <StatTile label="Redemptions" value={String(stats.totalRedemptions ?? 0)} />
              <StatTile label="Attributed revenue" value={`${currency} ${attributed.toLocaleString()}`} tone="green" />
            </View>
          </>
        ) : null}

        <Button label="New campaign" icon="add" onPress={openCreate} />

        {items.length === 0 ? (
          <EmptyState icon="gift-outline" title="No campaigns" sub="A campaign is a promo banner on your storefront, optionally tied to a coupon code." />
        ) : (
          items.map((c) => {
            const perf = (stats?.campaigns || []).find((s: any) => s.id === c.id);
            const live = isLive(c);
            return (
              <Card key={c.id} onPress={() => openEdit(c)} style={{ padding: 14, gap: 6 }}>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                  <T w="extra" size={14.5} style={{ flex: 1 }} numberOfLines={1}>
                    {c.name}
                  </T>
                  <Pill tone={live ? "green" : "neutral"}>{live ? "Live" : "Off"}</Pill>
                </View>
                <T w="semi" size={12.5} color={C.ink500} numberOfLines={2}>
                  {c.bannerTitle || "No banner title"}
                  {c.discountCode ? ` · code ${c.discountCode}` : ""}
                </T>
                <T w="regular" size={11.5} color={C.ink400}>
                  {c.startsAt || c.endsAt ? `${c.startsAt ? fd(c.startsAt) : "Now"} to ${c.endsAt ? fd(c.endsAt) : "no end"}` : "Evergreen"}
                </T>
                {perf ? (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    <T w="regular" size={11.5} color={C.ink400}>
                      {perf.redemptions} redemptions · {perf.attributedOrders} orders ·
                    </T>
                    <Money v={perf.attributedRevenue} currency={currency} size={11.5} />
                  </View>
                ) : null}
              </Card>
            );
          })
        )}
      </ScrollView>

      <FormSheet
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? `Edit ${editing.name}` : "New campaign"}
        maxHeight={440}
        footer={
          <View style={{ gap: 10 }}>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <Button label="Cancel" variant="outline" onPress={() => setFormOpen(false)} disabled={formBusy} style={{ flex: 1 }} />
              <Button label="Save campaign" icon="checkmark" onPress={submit} busy={formBusy} style={{ flex: 1.6 }} />
            </View>
            {editing ? (
              <Button
                label="Delete campaign"
                icon="trash-outline"
                variant="danger"
                disabled={formBusy}
                onPress={() => {
                  setFormOpen(false);
                  setDelFor(editing);
                }}
              />
            ) : null}
          </View>
        }
      >
        <T w="regular" size={13} color={C.ink400}>
          Shown on your storefront while it's live.
        </T>
        <ErrorBanner message={formErr} />
        <Field label="Name">
          <Input value={form.name} onChangeText={set("name")} placeholder="e.g. Eid sale" />
        </Field>
        <SelectField
          label="Linked coupon"
          value={form.discountId}
          placeholder="No coupon"
          hint="Optional. The banner carries this code."
          options={[{ value: "", label: "No coupon" }, ...discounts.map((d) => ({ value: d.id, label: `${d.name}${d.code ? ` (${d.code})` : ""}` }))]}
          onChange={set("discountId")}
        />
        <Field label="Banner title">
          <Input value={form.bannerTitle} onChangeText={set("bannerTitle")} placeholder="Half price this weekend" maxLength={80} />
        </Field>
        <Field label="Banner subtitle">
          <Input value={form.bannerSubtitle} onChangeText={set("bannerSubtitle")} placeholder="On everything over 10,000" maxLength={80} />
        </Field>
        <Field label="Button label">
          <Input value={form.ctaLabel} onChangeText={set("ctaLabel")} maxLength={80} />
        </Field>
        <DateField label="Starts" value={form.startsAt} onChange={set("startsAt")} quickDays={[0, 7]} />
        <DateField label="Ends" value={form.endsAt} onChange={set("endsAt")} quickDays={[7, 14, 30]} />
        <SwitchRow label="Active" value={form.isActive} onChange={(v) => setForm((f) => ({ ...f, isActive: v }))} />
      </FormSheet>

      <ConfirmSheet
        open={!!delFor}
        onClose={() => setDelFor(null)}
        onConfirm={confirmDelete}
        busy={delBusy}
        danger
        title={`Delete "${delFor?.name || ""}"?`}
        message="The banner disappears from your storefront. Linked discount codes stay."
        confirmLabel="Delete campaign"
      />
    </View>
  );
}

/* ----------------------------------- Payments -------------------------------- */

function Payments() {
  const [status, setStatus] = useState<any>(null);
  const [settlements, setSettlements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [publicKey, setPublicKey] = useState("");
  const [secretKey, setSecretKey] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res: any = await api.get("/api/dashboard/payments/provider");
      setStatus(res);
      if (res?.publicKey) setPublicKey(res.publicKey);
    } catch (e: any) {
      setError(e?.status === 403 ? "Only the store owner can manage payment keys." : apiErrorMessage(e, "Couldn't load payment settings."));
    }
    try {
      const sRes: any = await api.get("/api/dashboard/payments/settlements");
      setSettlements(Array.isArray(sRes?.settlements) ? sRes.settlements : []);
    } catch {
      setSettlements([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const configured = status?.configured === true;

  const save = async () => {
    if (!publicKey.trim() || !secretKey.trim()) {
      toast.error("Enter both your public and secret keys.");
      return;
    }
    setSaving(true);
    try {
      await api.put("/api/dashboard/payments/provider", { provider: "paystack", publicKey: publicKey.trim(), secretKey: secretKey.trim() });
      toast.success("Payment keys saved. Your storefront can now take card payments.");
      setSecretKey("");
      load();
    } catch (e: any) {
      toast.error(apiErrorMessage(e, "Couldn't save the payment provider."));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={{ padding: 16, gap: 12 }}>
        <Skeleton h={70} />
        <Skeleton h={52} />
        <Skeleton h={52} />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 40 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      <T w="display" size={17}>
        Online payments
      </T>
      <T w="regular" size={12.5} color={C.ink400} style={{ marginTop: -8 }}>
        Bring your own Paystack keys. The secret key is encrypted at rest and never returned in full.
      </T>

      <Card style={{ padding: 14, flexDirection: "row", alignItems: "center", gap: 12 }}>
        <View style={{ width: 40, height: 40, borderRadius: 13, backgroundColor: configured ? "#dcf2e4" : C.gold100, alignItems: "center", justifyContent: "center" }}>
          <Ionicons name={configured ? "checkmark" : "key-outline"} size={19} color={configured ? C.leaf500 : C.gold600} />
        </View>
        <View style={{ flex: 1 }}>
          <T w="extra" size={14}>
            {configured ? "Paystack connected" : "No provider connected yet"}
          </T>
          <T w="regular" size={12} color={C.ink400}>
            {configured ? (status?.secretKeyMasked ? `Secret: ${status.secretKeyMasked}` : "Storefront checkout accepts online payment.") : "Add your Paystack keys to accept card payments online."}
          </T>
        </View>
      </Card>

      {error ? (
        <T w="semi" size={13} color={C.danger500}>
          {error}
        </T>
      ) : (
        <>
          <Field label="Public key">
            <Input value={publicKey} onChangeText={setPublicKey} placeholder="pk_live_... or pk_test_..." autoCapitalize="none" autoCorrect={false} />
          </Field>
          <Field label="Secret key" hint={configured ? "Enter a new secret to replace the current one." : "From Paystack, Settings, API keys."}>
            <Input value={secretKey} onChangeText={setSecretKey} placeholder="sk_live_... or sk_test_..." secureTextEntry autoCapitalize="none" autoCorrect={false} />
          </Field>
          <Button label="Save keys" icon="checkmark" onPress={save} busy={saving} />
        </>
      )}

      <T w="display" size={17} style={{ marginTop: 8 }}>
        Settlements
      </T>
      <T w="regular" size={12.5} color={C.ink400} style={{ marginTop: -8 }}>
        Live from Paystack for paid orders.
      </T>
      <Card style={{ paddingHorizontal: 14, paddingVertical: 4 }}>
        {settlements.length === 0 ? (
          <T w="semi" size={13} color={C.ink400} style={{ textAlign: "center", paddingVertical: 22 }}>
            Paid online orders appear here with their settlement status.
          </T>
        ) : (
          settlements.map((s, i) => (
            <View key={s.orderId || s.reference || i} style={{ paddingVertical: 12, gap: 4, borderBottomWidth: i === settlements.length - 1 ? 0 : 1, borderBottomColor: C.cream100 }}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                <T w="bold" size={12.5} style={{ flex: 1 }} numberOfLines={1}>
                  {s.reference || "No reference"}
                </T>
                <Money v={s.total} currency={s.currency || "NGN"} size={14} />
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                <T w="regular" size={11.5} color={C.ink400}>
                  {fd(s.paidAt)}
                </T>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <StatusPill status={s.transactionStatus || "unknown"} />
                  {s.settlement?.status === "SETTLED" ? <Pill tone="green">Settled</Pill> : <T w="regular" size={11.5} color={C.ink400}>Settlement unavailable</T>}
                </View>
              </View>
            </View>
          ))
        )}
      </Card>
    </ScrollView>
  );
}
