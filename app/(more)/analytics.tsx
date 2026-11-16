import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RefreshControl, ScrollView, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../src/context/AuthContext";
import { api } from "../../src/lib/api";
import { getAccess } from "../../src/lib/access";
import { apiErrorMessage, fd, fm, plural, rawNum, titleCase } from "../../src/lib/format";
import { Button, Card, Chip, EmptyState, ErrorState, Pill, Skeleton, T } from "../../src/components/ui";
import { Page, Segmented, StatTile } from "../../src/components/kit";
import { BarList, BucketChart, type Bucket } from "../../src/components/analytics/Charts";
import { C } from "../../src/theme";

// Date-range presets. The contract wants start/end as UTC ISO-8601 with an
// explicit offset, half-open (end exclusive), max 366 days.
const RANGES = [
  { key: "7d", label: "Last 7 days", days: 7 },
  { key: "30d", label: "Last 30 days", days: 30 },
  { key: "90d", label: "Last 90 days", days: 90 },
  { key: "365d", label: "Last 12 months", days: 365 },
] as const;
type RangeKey = (typeof RANGES)[number]["key"];

function rangeFor(key: RangeKey): { start: string; end: string } {
  const days = RANGES.find((r) => r.key === key)?.days ?? 30;
  const now = new Date();
  // end is exclusive: UTC midnight after today so today's orders are included.
  const endUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
  const startUtc = endUtc - days * 86_400_000;
  return { start: new Date(startUtc).toISOString(), end: new Date(endUtc).toISOString() };
}

type Granularity = "daily" | "weekly";
type TabKey = "overview" | "trends" | "staff" | "channels";

// 403 from the advanced endpoints just means "not on this plan" - an upsell state, not an error.
const LOCK_CODES = new Set(["SUBSCRIPTION_INACTIVE", "ADVANCED_ANALYTICS_REQUIRED"]);
interface Locked {
  locked: true;
  code: string;
  message: string;
}
const isLocked = (x: any): x is Locked => !!x && x.locked === true;

async function getAdvanced(path: string): Promise<any | Locked> {
  try {
    return await api.get(path);
  } catch (e: any) {
    if (LOCK_CODES.has(e?.code)) return { locked: true, code: e.code, message: e.message };
    throw e;
  }
}

export default function Analytics() {
  const { me } = useAuth();
  const router = useRouter();
  const currency: string = (me.store as any)?.currency || "NGN";
  const allowed = getAccess(me).can("analytics");

  const [planTier, setPlanTier] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    api
      .get("/api/dashboard/subscriptions/usage")
      .then((res: any) => {
        if (!cancelled) setPlanTier(res?.plan?.tier ?? null);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const [rangeKey, setRangeKey] = useState<RangeKey>("30d");
  const [granularity, setGranularity] = useState<Granularity>("daily");
  const [tab, setTab] = useState<TabKey>("overview");

  const { start, end } = useMemo(() => rangeFor(rangeKey), [rangeKey]);
  const qs = `start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`;

  const [summary, setSummary] = useState<any>(null);
  const [timeseries, setTimeseries] = useState<any>(null);
  const [trends, setTrends] = useState<any>(null);
  const [staff, setStaff] = useState<any>(null);
  const [channels, setChannels] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reqId = useRef(0);

  const load = useCallback(async () => {
    const id = ++reqId.current;
    setLoading(true);
    setError(null);
    try {
      const [summaryRes, tsRes, trendsRes, staffRes, channelsRes] = await Promise.all([
        api.get(`/api/dashboard/analytics/summary?${qs}&top=5`),
        api.get(`/api/dashboard/analytics/timeseries?${qs}&granularity=${granularity}`),
        getAdvanced(`/api/dashboard/analytics/trends?${qs}&granularity=${granularity}`),
        getAdvanced(`/api/dashboard/analytics/staff-performance?${qs}`),
        getAdvanced(`/api/dashboard/analytics/channels?${qs}`),
      ]);
      if (id !== reqId.current) return;
      setSummary(summaryRes);
      setTimeseries(tsRes);
      setTrends(trendsRes);
      setStaff(staffRes);
      setChannels(channelsRes);
    } catch (e: any) {
      if (id !== reqId.current) return;
      if (e?.status === 403 && e?.code === "INSUFFICIENT_PERMISSIONS") {
        setError("You need the “manage analytics” permission to see this. Ask an owner to grant it.");
      } else {
        setError(apiErrorMessage(e, "Couldn't load analytics."));
      }
      setSummary(null);
      setTimeseries(null);
      setTrends(null);
      setStaff(null);
      setChannels(null);
    } finally {
      if (id === reqId.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [qs, granularity]);

  useEffect(() => {
    if (allowed) load();
  }, [load, allowed]);

  if (!allowed) {
    return (
      <Page title="Analytics">
        <EmptyState icon="lock-closed-outline" title="Not available for your role" sub="Ask the store owner to grant you the “view profit” permission." />
      </Page>
    );
  }

  const totalSales = rawNum(summary?.totalSales);
  const orderCount: number = summary?.orderCount ?? 0;
  const avgOrderValue = orderCount > 0 ? totalSales / orderCount : 0;
  const bestSellers: any[] = summary?.bestSellers || [];
  const buckets: Bucket[] = timeseries?.buckets || [];

  return (
    <Page title="Analytics" right={planTier ? <Pill tone="brand">{titleCase(planTier)}</Pill> : undefined}>
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 32, gap: 12 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            tintColor={C.brand}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
          />
        }
      >
        <T w="semi" size={12.5} color={C.ink400}>
          {fd(start)} → {fd(end)}
        </T>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {RANGES.map((r) => (
            <Chip key={r.key} label={r.label} on={rangeKey === r.key} onPress={() => setRangeKey(r.key)} />
          ))}
        </ScrollView>
        <Segmented
          value={tab}
          onChange={(v) => setTab(v as TabKey)}
          options={[
            { value: "overview", label: "Overview" },
            { value: "trends", label: "Trends" },
            { value: "staff", label: "Staff" },
            { value: "channels", label: "Channels" },
          ]}
        />

        {error ? (
          <Card>
            <ErrorState message={error} onRetry={load} />
          </Card>
        ) : loading && !summary ? (
          <>
            <Skeleton h={70} r={18} />
            <Skeleton h={220} r={18} />
            <Skeleton h={160} r={18} />
          </>
        ) : !summary ? (
          <Card>
            <EmptyState icon="stats-chart-outline" title="Nothing to analyze yet" sub="Once you record a sale, your analytics come alive here." />
          </Card>
        ) : (
          <View style={{ gap: 12, opacity: loading ? 0.55 : 1 }}>
            {tab === "overview" ? (
              <>
                <View style={{ flexDirection: "row", gap: 10 }}>
                  <StatTile label="Total sales" value={fm(totalSales, currency, { compact: true })} tone="green" />
                  <StatTile label="Orders" value={String(orderCount)} />
                  <StatTile label="Avg. order" value={fm(avgOrderValue, currency, { compact: true })} tone="gold" />
                </View>
                <T w="regular" size={11} color={C.ink400}>
                  Total sales counts PAID + SHIPPED orders.
                </T>
                <Card style={{ padding: 16 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                    <T w="display" size={16}>
                      Sales over time
                    </T>
                    <View style={{ flexDirection: "row", gap: 6 }}>
                      {(["daily", "weekly"] as Granularity[]).map((g) => (
                        <Chip key={g} label={titleCase(g)} on={granularity === g} onPress={() => setGranularity(g)} />
                      ))}
                    </View>
                  </View>
                  <BucketChart buckets={buckets} currency={currency} />
                </Card>
                <Card style={{ padding: 16 }}>
                  <T w="display" size={16}>
                    Best sellers
                  </T>
                  {bestSellers.length === 0 ? (
                    <T w="semi" size={13} color={C.ink400} style={{ marginTop: 14 }}>
                      No sales in this range yet.
                    </T>
                  ) : (
                    <View style={{ marginTop: 14 }}>
                      {bestSellers.map((p: any, i: number) => (
                        <View key={p.productId || i} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 11, borderTopWidth: i ? 1 : 0, borderTopColor: C.cream100 }}>
                          <View style={{ width: 28, height: 28, borderRadius: 9, backgroundColor: i === 0 ? C.brand : C.cream100, alignItems: "center", justifyContent: "center" }}>
                            <T w="extra" size={12.5} color={i === 0 ? "#fff" : C.ink500}>
                              {i + 1}
                            </T>
                          </View>
                          <View style={{ flex: 1 }}>
                            <T w="bold" size={13.5} numberOfLines={1}>
                              {p.name}
                            </T>
                            <T w="regular" size={11.5} color={C.ink400}>
                              {plural(p.units ?? 0, "unit")} sold
                            </T>
                          </View>
                          <T w="extra" size={13.5}>
                            {fm(p.revenue, currency)}
                          </T>
                        </View>
                      ))}
                    </View>
                  )}
                </Card>
              </>
            ) : null}

            {tab === "trends" ? <TrendsTab data={trends} currency={currency} onUpgrade={() => router.push("/settings" as any)} /> : null}
            {tab === "staff" ? <StaffTab data={staff} currency={currency} onUpgrade={() => router.push("/settings" as any)} /> : null}
            {tab === "channels" ? <ChannelsTab data={channels} currency={currency} onUpgrade={() => router.push("/settings" as any)} /> : null}
          </View>
        )}
      </ScrollView>
    </Page>
  );
}

function UpsellCard({ message, onUpgrade }: { message?: string; onUpgrade: () => void }) {
  return (
    <Card style={{ padding: 24, alignItems: "center", gap: 8 }}>
      <View style={{ width: 48, height: 48, borderRadius: 15, backgroundColor: C.brand50, alignItems: "center", justifyContent: "center" }}>
        <Ionicons name="sparkles" size={22} color={C.brand} />
      </View>
      <T w="display" size={16} style={{ textAlign: "center" }}>
        Advanced analytics is a Pro feature
      </T>
      <T w="regular" size={13} color={C.ink400} style={{ textAlign: "center", lineHeight: 19 }}>
        {message || "Upgrade to Pro or Enterprise to unlock trends, staff performance and channel breakdowns."}
      </T>
      <Button label="View plans" icon="sparkles" small onPress={onUpgrade} style={{ marginTop: 8 }} />
    </Card>
  );
}

function TrendsTab({ data, currency, onUpgrade }: { data: any; currency: string; onUpgrade: () => void }) {
  if (isLocked(data)) return <UpsellCard message={data.message} onUpgrade={onUpgrade} />;
  if (!data)
    return (
      <Card>
        <EmptyState icon="stats-chart-outline" title="No trend data" />
      </Card>
    );
  const current = rawNum(data.totals?.totalSales);
  const previous = rawNum(data.previousPeriod?.totalSales);
  const change = data.changePercent;
  const hasChange = typeof change === "number";
  const up = hasChange && change >= 0;
  return (
    <>
      <View style={{ flexDirection: "row", gap: 10 }}>
        <StatTile label="This period" value={fm(current, currency, { compact: true })} tone="green" />
        <StatTile label="Previous" value={fm(previous, currency, { compact: true })} />
        <StatTile label="Change" value={hasChange ? `${up ? "+" : ""}${change.toFixed(1)}%` : "—"} tone={hasChange ? (up ? "green" : "danger") : undefined} />
      </View>
      <T w="regular" size={11.5} color={C.ink400}>
        {plural(data.totals?.orderCount ?? 0, "order")} this period. Previous period: {fd(data.previousPeriod?.start)} → {fd(data.previousPeriod?.end)}.
      </T>
      <Card style={{ padding: 16 }}>
        <T w="display" size={16}>
          Trend
        </T>
        <BucketChart buckets={data.buckets || []} currency={currency} />
      </Card>
    </>
  );
}

function StaffTab({ data, currency, onUpgrade }: { data: any; currency: string; onUpgrade: () => void }) {
  if (isLocked(data)) return <UpsellCard message={data.message} onUpgrade={onUpgrade} />;
  if (!data)
    return (
      <Card>
        <EmptyState icon="people-outline" title="No staff data" />
      </Card>
    );
  const staff: any[] = data.staff || [];
  return (
    <Card style={{ padding: 16 }}>
      <T w="display" size={16}>
        Staff performance
      </T>
      {staff.length === 0 ? (
        <T w="semi" size={13} color={C.ink400} style={{ marginTop: 14 }}>
          No sales or inventory activity attributed to staff in this range.
        </T>
      ) : (
        <View style={{ marginTop: 10 }}>
          {staff.map((s: any, i: number) => {
            const units = s.inventoryActivity?.unitsAdjusted ?? 0;
            return (
              <View key={s.staffMemberId || i} style={{ paddingVertical: 12, borderTopWidth: i ? 1 : 0, borderTopColor: C.cream100, gap: 4 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 10 }}>
                  <T w="bold" size={14} numberOfLines={1} style={{ flex: 1 }}>
                    {s.name}
                  </T>
                  <T w="extra" size={14}>
                    {fm(s.sales?.revenue ?? 0, currency)}
                  </T>
                </View>
                <T w="regular" size={12} color={C.ink400}>
                  {plural(s.sales?.orderCount ?? 0, "order")} · {plural(s.inventoryActivity?.entries ?? 0, "stock entry", "stock entries")} · {units > 0 ? "+" : ""}
                  {units} units adjusted
                </T>
              </View>
            );
          })}
        </View>
      )}
    </Card>
  );
}

function ChannelsTab({ data, currency, onUpgrade }: { data: any; currency: string; onUpgrade: () => void }) {
  if (isLocked(data)) return <UpsellCard message={data.message} onUpgrade={onUpgrade} />;
  if (!data)
    return (
      <Card>
        <EmptyState icon="storefront-outline" title="No channel data" />
      </Card>
    );
  const channels: any[] = data.channels || [];
  return (
    <Card style={{ padding: 16 }}>
      <T w="display" size={16} style={{ marginBottom: 14 }}>
        Revenue by channel
      </T>
      {channels.length === 0 ? (
        <T w="semi" size={13} color={C.ink400}>
          No channel data in this range.
        </T>
      ) : (
        <BarList
          rows={channels.map((c: any, i: number) => ({
            key: String(c.source ?? i),
            label: titleCase(c.source),
            sub: `×${c.orderCount ?? 0}`,
            value: rawNum(c.revenue),
            display: fm(c.revenue, currency),
          }))}
          minPct={4}
        />
      )}
    </Card>
  );
}
