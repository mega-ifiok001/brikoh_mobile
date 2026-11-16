import { useCallback, useEffect, useState } from "react";
import { Linking, Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../../src/lib/api";
import { apiErrorMessage, asList, fd, fm, titleCase } from "../../../src/lib/format";
import { TIER_LABEL, isHigherTier, isLowerTier, tierMonthlyPrice, type BillableTier } from "../../../src/lib/pricing";
import { Button, Card, Field, Input, Pill, Sheet, StatusPill, T, toast } from "../../../src/components/ui";
import { ConfirmSheet, DetailRow, Segmented } from "../../../src/components/kit";
import { SettingsScreen } from "../../../src/components/settings/bits";
import { C } from "../../../src/theme";

const TIERS: { id: BillableTier; hint: string }[] = [
  { id: "STARTER", hint: "1 staff · 1 location · 100 products · 1,000 orders" },
  { id: "PRO", hint: "10 staff · 3 locations · 500 products · 5,000 orders · custom domain" },
  { id: "ENTERPRISE", hint: "Unlimited everything · advanced analytics · marketing tools" },
];

const capLabel = (cap: number | null | undefined) => (cap == null ? "Unlimited" : String(cap));

function TierPicker({ tiers, value, onChange }: { tiers: BillableTier[]; value: string; onChange: (t: string) => void }) {
  return (
    <View style={{ gap: 10 }}>
      {tiers.map((id) => {
        const on = value === id;
        const price = tierMonthlyPrice(id);
        return (
          <Pressable key={id} onPress={() => onChange(id)} style={{ flexDirection: "row", gap: 10, padding: 14, borderRadius: 16, borderWidth: 1.5, borderColor: on ? C.brand : C.cream200, backgroundColor: on ? C.brand50 : C.white }}>
            <View style={{ flex: 1 }}>
              <T w="extra" size={14}>
                {TIER_LABEL[id]}
              </T>
              <T w="regular" size={12} color={C.ink400}>
                {TIERS.find((t) => t.id === id)?.hint}
              </T>
              <T w="extra" size={13} style={{ marginTop: 4 }}>
                {price != null ? `${fm(price, "NGN")} /mo` : "Custom pricing"}
              </T>
            </View>
            <Ionicons name={on ? "radio-button-on" : "radio-button-off"} size={22} color={on ? C.brand : C.ink300} />
          </Pressable>
        );
      })}
    </View>
  );
}

export default function PlanSettings() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [domain, setDomain] = useState("");
  const [domainBusy, setDomainBusy] = useState(false);

  const [actionTab, setActionTab] = useState("history");
  const [checkoutTier, setCheckoutTier] = useState("PRO");
  const [upgradeTier, setUpgradeTier] = useState("ENTERPRISE");
  const [downgradeTier, setDowngradeTier] = useState("STARTER");
  const [busy, setBusy] = useState<string | null>(null);
  const [preview, setPreview] = useState<any>(null);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);

  const [payments, setPayments] = useState<any[]>([]);
  const [payLoading, setPayLoading] = useState(true);
  const [selected, setSelected] = useState<any>(null);

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    setError(null);
    try {
      const res: any = await api.get("/api/dashboard/subscriptions/usage");
      setData(res);
      setDomain(res.customDomain || "");
    } catch (e: any) {
      setError(e?.status === 403 || e?.code === "INSUFFICIENT_PERMISSIONS" ? "Only the store owner can view plan usage." : apiErrorMessage(e, "Couldn't load plan usage."));
      setData(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const loadPayments = useCallback(async () => {
    setPayLoading(true);
    try {
      setPayments(asList(await api.get("/api/dashboard/subscriptions/payments"), "items", "payments", "data"));
    } catch {
      setPayments([]);
    } finally {
      setPayLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    loadPayments();
  }, [load, loadPayments]);

  const afterAction = () => {
    load(true);
    loadPayments();
  };

  const plan = data?.plan;
  const currentTier: string = plan?.tier || "STARTER";
  const hasPlan = !!plan;
  const higherTiers = TIERS.map((t) => t.id).filter((t) => isHigherTier(currentTier, t));
  const lowerTiers = TIERS.map((t) => t.id).filter((t) => isLowerTier(currentTier, t));

  useEffect(() => {
    if (higherTiers.length && !higherTiers.includes(upgradeTier as BillableTier)) setUpgradeTier(higherTiers[0]);
    if (lowerTiers.length && !lowerTiers.includes(downgradeTier as BillableTier)) setDowngradeTier(lowerTiers[lowerTiers.length - 1]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTier]);

  useEffect(() => {
    if (actionTab !== "downgrade" || !lowerTiers.length) return;
    let live = true;
    setPreviewBusy(true);
    api
      .get(`/api/dashboard/subscriptions/downgrade/preview?tier=${encodeURIComponent(downgradeTier)}`)
      .then((r: any) => live && setPreview(r))
      .catch(() => live && setPreview(null))
      .finally(() => live && setPreviewBusy(false));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actionTab, downgradeTier, currentTier]);

  const hosted = async (path: string, tier: string, okMsg: string, errMap: Record<string, string>, fallback: string, key: string) => {
    setBusy(key);
    try {
      const res: any = await api.post(path, { tier });
      if (res?.authorizationUrl) {
        await Linking.openURL(res.authorizationUrl);
        toast.info("Complete payment in your browser, then pull to refresh.");
      } else {
        toast.success(okMsg);
        afterAction();
      }
    } catch (e: any) {
      toast.error(apiErrorMessage(e, fallback, errMap));
    } finally {
      setBusy(null);
    }
  };

  const doCheckout = () =>
    hosted("/api/dashboard/subscriptions/checkout", checkoutTier, `Subscription initiated for ${checkoutTier}.`, { ALREADY_SUBSCRIBED: "You already have an active subscription.", PRICING_NOT_CONFIGURED: "This tier isn't available for checkout yet." }, "Couldn't start checkout.", "checkout");

  const doUpgrade = () =>
    hosted(
      "/api/dashboard/subscriptions/upgrade",
      upgradeTier,
      `Upgrade to ${upgradeTier} initiated.`,
      { UPGRADE_NOT_HIGHER: "That tier isn't higher than your current plan.", PRICING_NOT_CONFIGURED: "This tier isn't configured for upgrades yet.", PRORATION_ZERO: "No time left in your billing cycle." },
      "Couldn't start upgrade.",
      "upgrade"
    );

  const doDowngrade = async () => {
    setBusy("downgrade");
    try {
      await api.post("/api/dashboard/subscriptions/downgrade", { tier: downgradeTier });
      toast.success(`Downgrade to ${downgradeTier} scheduled.`);
      afterAction();
    } catch (e: any) {
      toast.error(apiErrorMessage(e, "Couldn't schedule downgrade.", { DOWNGRADE_NOT_LOWER: "That tier isn't lower than your current plan.", PRICING_NOT_CONFIGURED: "This tier isn't configured for downgrades yet." }));
    } finally {
      setBusy(null);
    }
  };

  const doCancel = async () => {
    setBusy("cancel");
    try {
      await api.post("/api/dashboard/subscriptions/cancel");
      toast.success("Subscription cancelled.");
      setCancelOpen(false);
      afterAction();
    } catch (e: any) {
      setCancelOpen(false);
      toast.error(apiErrorMessage(e, "Couldn't cancel subscription.", { NO_SUBSCRIPTION: "You don't have an active subscription to cancel.", NO_PAYSTACK_SUBSCRIPTION: "No Paystack subscription found." }));
    } finally {
      setBusy(null);
    }
  };

  const saveDomain = async () => {
    const value = domain.trim().toLowerCase() || null;
    setDomainBusy(true);
    try {
      await api.put("/api/dashboard/subscriptions/custom-domain", { customDomain: value });
      toast.success(value ? "Custom domain saved." : "Custom domain cleared.");
      load(true);
    } catch (e: any) {
      toast.error(
        apiErrorMessage(e, "Couldn't save the domain.", {
          PLAN_FEATURE_LOCKED: "Custom domains are not included in your plan. Upgrade to unlock.",
          SUBSCRIPTION_INACTIVE: "Your subscription is inactive. Reactivate to use this feature.",
          CUSTOM_DOMAIN_TAKEN: "That domain is already in use by another store.",
        })
      );
    } finally {
      setDomainBusy(false);
    }
  };

  const viewPayment = async (id: string) => {
    try {
      setSelected(await api.get(`/api/dashboard/subscriptions/payments/${id}`));
    } catch (e: any) {
      toast.error(apiErrorMessage(e, "Couldn't load payment details."));
    }
  };

  const usage = data?.usage || {};
  const limits = plan?.limits || {};
  const flags = plan?.featureFlags || {};
  const period = data?.period;
  const status: string = plan?.status || "ACTIVE";
  const pending = data?.pendingDowngrade;

  const usageRows = [
    { label: "Staff", used: usage.staff ?? 0, cap: limits.staffCap },
    { label: "Locations", used: usage.locations ?? 0, cap: limits.locationCap },
    { label: "Products", used: usage.products ?? 0, cap: limits.productCap },
    { label: "Orders (period)", used: usage.orders ?? 0, cap: limits.orderCap },
  ];
  const barColor = (u: number, c: number | null | undefined) => (c == null ? C.leaf500 : u / c >= 1 ? C.danger500 : u / c >= 0.85 ? C.gold600 : C.leaf500);

  const tabs = hasPlan
    ? [
        { value: "history", label: "History" },
        { value: "upgrade", label: "Upgrade" },
        { value: "downgrade", label: "Downgrade" },
        { value: "cancel", label: "Cancel" },
      ]
    : [
        { value: "history", label: "History" },
        { value: "subscribe", label: "Subscribe" },
      ];

  return (
    <SettingsScreen
      title="Plan and billing"
      loading={loading}
      error={error}
      onRetry={() => load()}
      refreshing={refreshing}
      onRefresh={() => {
        setRefreshing(true);
        load(true);
        loadPayments();
      }}
    >
      {pending ? (
        <Card style={{ padding: 14, backgroundColor: C.gold100, borderColor: C.gold100 }}>
          <T w="extra" size={13.5}>
            Downgrade scheduled to {titleCase(pending.tier)}
          </T>
          <T w="regular" size={12} color={C.ink500}>
            Features switch on {fd(pending.effectiveAt)}.
          </T>
        </Card>
      ) : null}

      <Card style={{ padding: 16, gap: 10 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <View style={{ flex: 1 }}>
            <T w="display" size={19}>
              {hasPlan ? `${titleCase(currentTier)} plan` : "No active plan"}
            </T>
            {hasPlan && period?.start && period?.end ? (
              <T w="regular" size={12} color={C.ink400}>
                Period {fd(period.start)} to {fd(period.end)}
              </T>
            ) : null}
            {!hasPlan ? (
              <T w="regular" size={12.5} color={C.ink400}>
                You are running without subscription limits.
              </T>
            ) : null}
          </View>
          {hasPlan ? <Pill tone={status === "ACTIVE" ? "green" : status === "TRIALING" ? "brand" : status === "PAST_DUE" ? "danger" : "neutral"}>{titleCase(status)}</Pill> : null}
        </View>
        {hasPlan ? (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            <Pill tone={flags.customDomain ? "green" : "neutral"}>{`Custom domain ${flags.customDomain ? "on" : "off"}`}</Pill>
            <Pill tone={flags.advancedAnalytics ? "green" : "neutral"}>{`Advanced analytics ${flags.advancedAnalytics ? "on" : "off"}`}</Pill>
            <Pill tone={flags.marketingTools ? "green" : "neutral"}>{`Marketing tools ${flags.marketingTools ? "on" : "off"}`}</Pill>
            <Pill tone="neutral">{`Templates: ${capLabel(limits.templateCap)}`}</Pill>
          </View>
        ) : null}
      </Card>

      {hasPlan ? (
        <Card style={{ padding: 16, gap: 14 }}>
          <View>
            <T w="display" size={16}>
              Usage
            </T>
            <T w="regular" size={12} color={C.ink400}>
              Live counts against your plan caps. Hitting a cap blocks new creates.
            </T>
          </View>
          {usageRows.map((r) => {
            const pct = r.cap == null || r.cap <= 0 ? 8 : Math.max(4, Math.min(100, Math.round((r.used / r.cap) * 100)));
            return (
              <View key={r.label} style={{ gap: 5 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <T w="bold" size={13}>
                    {r.label}
                  </T>
                  <T w="semi" size={13} color={C.ink500}>
                    {r.used} / {capLabel(r.cap)}
                  </T>
                </View>
                <View style={{ height: 9, borderRadius: 6, backgroundColor: C.cream100, overflow: "hidden" }}>
                  <View style={{ width: `${pct}%`, height: "100%", borderRadius: 6, backgroundColor: barColor(r.used, r.cap) }} />
                </View>
              </View>
            );
          })}
        </Card>
      ) : null}

      <Card style={{ padding: 16, gap: 14 }}>
        <View>
          <T w="display" size={16}>
            Subscription
          </T>
          <T w="regular" size={12} color={C.ink400}>
            Subscribe, upgrade, downgrade, or cancel.
          </T>
        </View>
        <Segmented options={tabs} value={actionTab} onChange={setActionTab} />

        {actionTab === "history" ? (
          payLoading ? (
            <T w="semi" size={13} color={C.ink400}>
              Loading billing history...
            </T>
          ) : payments.length === 0 ? (
            <T w="semi" size={13} color={C.ink400} style={{ textAlign: "center", paddingVertical: 16 }}>
              No billing activity yet.
            </T>
          ) : (
            payments.map((p, i) => (
              <Pressable key={p.id || i} onPress={() => viewPayment(p.id)} style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, borderTopWidth: i ? 1 : 0, borderTopColor: C.cream100 }}>
                <View style={{ flex: 1 }}>
                  <T w="bold" size={13.5} numberOfLines={1}>
                    {titleCase(p.tier)} · {titleCase(p.kind)}
                  </T>
                  <T w="regular" size={11.5} color={C.ink400} numberOfLines={1}>
                    {[p.reference, fd(p.createdAt)].filter(Boolean).join(" · ")}
                  </T>
                </View>
                <View style={{ alignItems: "flex-end", gap: 4 }}>
                  <T w="extra" size={13.5}>
                    {fm(p.amount, "NGN")}
                  </T>
                  <StatusPill status={p.status} />
                </View>
              </Pressable>
            ))
          )
        ) : null}

        {actionTab === "subscribe" ? (
          <View style={{ gap: 12 }}>
            <T w="regular" size={12.5} color={C.ink500}>
              Choose a plan. You will be taken to Paystack to pay.
            </T>
            <TierPicker tiers={TIERS.map((t) => t.id)} value={checkoutTier} onChange={setCheckoutTier} />
            <Button label="Start checkout" icon="open-outline" busy={busy === "checkout"} onPress={doCheckout} />
          </View>
        ) : null}

        {actionTab === "upgrade" ? (
          <View style={{ gap: 12 }}>
            <T w="regular" size={12.5} color={C.ink500}>
              Upgrade to a higher tier. A prorated charge applies.
            </T>
            {higherTiers.length === 0 ? (
              <T w="bold" size={13} color={C.gold600}>
                Already on the highest tier.
              </T>
            ) : (
              <>
                <TierPicker tiers={higherTiers} value={upgradeTier} onChange={setUpgradeTier} />
                <Button label="Upgrade now" icon="flash-outline" busy={busy === "upgrade"} onPress={doUpgrade} />
              </>
            )}
          </View>
        ) : null}

        {actionTab === "downgrade" ? (
          <View style={{ gap: 12 }}>
            <T w="regular" size={12.5} color={C.ink500}>
              Downgrade is deferred: you keep your current tier until the period ends.
            </T>
            {lowerTiers.length === 0 ? (
              <T w="bold" size={13} color={C.gold600}>
                Already on the lowest tier.
              </T>
            ) : (
              <>
                <TierPicker tiers={lowerTiers} value={downgradeTier} onChange={setDowngradeTier} />
                {previewBusy ? (
                  <T w="semi" size={12.5} color={C.ink400}>
                    Checking what changes...
                  </T>
                ) : preview?.warnings?.length > 0 ? (
                  <View style={{ backgroundColor: C.gold100, borderRadius: 14, padding: 12, gap: 4 }}>
                    <T w="extra" size={13}>
                      Changes at downgrade
                    </T>
                    {preview.warnings.map((w: any, i: number) => (
                      <T key={i} w="regular" size={12.5} color={C.ink700}>
                        {typeof w === "string" ? w : w.message}
                      </T>
                    ))}
                  </View>
                ) : null}
                <Button label="Schedule downgrade" icon="time-outline" busy={busy === "downgrade"} onPress={doDowngrade} />
              </>
            )}
          </View>
        ) : null}

        {actionTab === "cancel" ? (
          <View style={{ gap: 12 }}>
            <T w="regular" size={12.5} color={C.ink500}>
              Cancels your Paystack recurring subscription. You revert to Starter after the period ends.
            </T>
            <Button label="Cancel subscription" variant="danger" onPress={() => setCancelOpen(true)} />
          </View>
        ) : null}
      </Card>

      {hasPlan ? (
        <Card style={{ padding: 16, gap: 10 }}>
          <T w="display" size={16}>
            Custom domain
          </T>
          {!flags.customDomain ? (
            <T w="regular" size={12.5} color={C.ink500}>
              Custom domains are available on Pro and Enterprise. Upgrade to point your own domain at the storefront.
            </T>
          ) : (
            <>
              <T w="regular" size={12} color={C.ink400}>
                Point a CNAME at your Brikoh storefront, then save the domain here.
              </T>
              <Field label="Domain">
                <Input value={domain} onChangeText={setDomain} placeholder="shop.yourbrand.com" autoCapitalize="none" autoCorrect={false} keyboardType="url" />
              </Field>
              <Button label="Save domain" icon="checkmark" busy={domainBusy} onPress={saveDomain} />
            </>
          )}
        </Card>
      ) : null}

      <T w="regular" size={11.5} color={C.ink400} style={{ textAlign: "center" }}>
        Caps only block new creates. Existing data is never deleted.
      </T>

      <Sheet open={!!selected} onClose={() => setSelected(null)} title="Payment details">
        {selected ? (
          <View style={{ paddingHorizontal: 18, paddingBottom: 8 }}>
            <DetailRow label="Reference" value={selected.reference || "-"} />
            <DetailRow label="Tier" value={titleCase(selected.tier)} />
            <DetailRow label="Type" value={titleCase(selected.kind)} />
            <DetailRow label="Status" value={titleCase(selected.status)} />
            <DetailRow label="Amount" value={fm(selected.amount || "0.00", "NGN")} strong />
            <DetailRow label="Provider ref" value={selected.providerRef || "-"} />
            <DetailRow label="Created" value={fd(selected.createdAt)} />
            <DetailRow label="Paid at" value={selected.paidAt ? fd(selected.paidAt) : "-"} />
            {selected.orphanReason ? (
              <View style={{ marginTop: 10, backgroundColor: C.gold100, borderRadius: 14, padding: 12 }}>
                <T w="extra" size={13}>
                  Orphan (no local effect)
                </T>
                <T w="regular" size={12} color={C.ink700}>
                  {selected.orphanReason}
                </T>
              </View>
            ) : null}
          </View>
        ) : null}
      </Sheet>

      <ConfirmSheet
        open={cancelOpen}
        danger
        busy={busy === "cancel"}
        title="Cancel your subscription?"
        message="This cannot be undone. You revert to Starter after the period ends."
        confirmLabel="Yes, cancel"
        onConfirm={doCancel}
        onClose={() => setCancelOpen(false)}
      />
    </SettingsScreen>
  );
}
