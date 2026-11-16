import { useCallback, useEffect, useRef, useState } from "react";
import { RefreshControl, ScrollView, View } from "react-native";
import { useAuth } from "../../src/context/AuthContext";
import { api } from "../../src/lib/api";
import { getAccess } from "../../src/lib/access";
import { apiErrorMessage, asList, fd, fm, pick, plural, rawNum, titleCase } from "../../src/lib/format";
import { Card, Chip, EmptyState, ErrorState, ListSkeleton, Pill, T } from "../../src/components/ui";
import { Page, SectionTitle, Segmented, StatTile } from "../../src/components/kit";
import { BarList } from "../../src/components/analytics/Charts";
import { C } from "../../src/theme";

const PERIODS = [
  { key: "week", label: "This week" },
  { key: "month", label: "This month" },
  { key: "quarter", label: "This quarter" },
  { key: "year", label: "This year" },
] as const;
type PeriodKey = (typeof PERIODS)[number]["key"];
type TabKey = "pnl" | "expenses" | "inventory";

/** Start/end of a period in local time. Week starts on Monday; end is the end of today. */
function rangeFor(period: PeriodKey): { start: string; end: string } {
  const now = new Date();
  const start = new Date(now);
  switch (period) {
    case "week": {
      const day = now.getDay();
      start.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
      break;
    }
    case "month":
      start.setDate(1);
      break;
    case "quarter":
      start.setMonth(Math.floor(now.getMonth() / 3) * 3, 1);
      break;
    case "year":
      start.setMonth(0, 1);
      break;
  }
  start.setHours(0, 0, 0, 0);
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  return { start: start.toISOString(), end: end.toISOString() };
}

function periodQuery(period: PeriodKey): string {
  const { start, end } = rangeFor(period);
  return new URLSearchParams({ period, start, end }).toString();
}

export default function Reports() {
  const { me } = useAuth();
  const currency: string = (me.store as any)?.currency || "NGN";
  const allowed = getAccess(me).can("reports");

  const [period, setPeriod] = useState<PeriodKey>("week");
  const [tab, setTab] = useState<TabKey>("pnl");
  const [pnl, setPnl] = useState<any>(null);
  const [byCategory, setByCategory] = useState<any[]>([]);
  const [grandTotal, setGrandTotal] = useState<string>("0.00");
  const [inventory, setInventory] = useState<any>(null);
  const [invoicePayments, setInvoicePayments] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reqId = useRef(0);

  const load = useCallback(async () => {
    const id = ++reqId.current;
    setLoading(true);
    setError(null);
    try {
      const qs = periodQuery(period);
      const [pnlRes, expRes, invRes]: any[] = await Promise.all([
        api.get(`/api/dashboard/reports/pnl?${qs}`),
        api.get(`/api/dashboard/reports/expenses-by-category?${qs}`),
        api.get(`/api/dashboard/reports/inventory-valuation`).catch(() => null),
      ]);
      if (id !== reqId.current) return;
      setPnl(pnlRes);
      setByCategory(Array.isArray(expRes?.categories) ? expRes.categories : []);
      setGrandTotal(expRes?.grandTotal ?? "0.00");
      setInventory(invRes);

      // Invoice payments received: sum amountPaid across PAID/ISSUED invoices (all-time; the list API has no date filter).
      try {
        let cursor: string | null = null;
        let total = 0;
        do {
          const iq = new URLSearchParams({ limit: "100" });
          if (cursor) iq.set("cursor", cursor);
          const res: any = await api.get(`/api/dashboard/invoices?${iq.toString()}`);
          for (const inv of asList(res, "items", "invoices", "data")) {
            if (inv.status === "PAID" || inv.status === "ISSUED") total += rawNum(inv.amountPaid);
          }
          cursor = pick(res, ["nextCursor", "after", "cursor", "next"]) ?? null;
        } while (cursor);
        if (id === reqId.current) setInvoicePayments(total);
      } catch {
        if (id === reqId.current) setInvoicePayments(0);
      }
    } catch (e: any) {
      if (id !== reqId.current) return;
      if (e?.status === 403 || e?.code === "INSUFFICIENT_PERMISSIONS") {
        setError("You need the “view profit” permission to see these reports. Ask an owner to grant it.");
      } else {
        setError(apiErrorMessage(e, "Couldn't load reports."));
      }
      setPnl(null);
      setByCategory([]);
      setInventory(null);
      setInvoicePayments(0);
    } finally {
      if (id === reqId.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [period]);

  useEffect(() => {
    if (allowed) load();
  }, [load, allowed]);

  if (!allowed) {
    return (
      <Page title="Reports">
        <EmptyState icon="lock-closed-outline" title="Not available for your role" sub="Ask the store owner to grant you the “view profit” permission." />
      </Page>
    );
  }

  const periodLabel = PERIODS.find((p) => p.key === period)?.label || period;
  const revenue = rawNum(pnl?.revenue);
  const cogs = rawNum(pnl?.cogs);
  const expenses = rawNum(pnl?.expenses);
  const netProfit = rawNum(pnl?.netProfit);
  const unpriced: number = pnl?.cogsUnpricedLineItems ?? 0;
  const rangeLabel = pnl?.period ? `${fd(pnl.period.start)} → ${fd(pnl.period.end)}` : "";

  return (
    <Page title="Reports">
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 32, gap: 12 }}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
            tintColor={C.brand}
          />
        }
      >
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {PERIODS.map((p) => (
            <Chip key={p.key} label={p.label} on={period === p.key} onPress={() => setPeriod(p.key)} />
          ))}
        </ScrollView>

        <Segmented
          options={[
            { value: "pnl", label: "P&L" },
            { value: "expenses", label: "Expenses" },
            { value: "inventory", label: "Inventory" },
          ]}
          value={tab}
          onChange={(v) => setTab(v as TabKey)}
        />

        {loading && !refreshing ? (
          <ListSkeleton rows={4} />
        ) : error ? (
          <ErrorState message={error} onRetry={load} />
        ) : !pnl ? (
          <EmptyState icon="bar-chart-outline" title="Nothing to report yet" sub="Once you make a sale and record an expense, your P&L comes alive here." />
        ) : tab === "pnl" ? (
          <>
            <T w="semi" size={12} color={C.ink400}>
              Profit & loss · {periodLabel}
              {rangeLabel ? ` · ${rangeLabel}` : ""}
            </T>
            {unpriced > 0 ? (
              <View style={{ backgroundColor: C.gold100, borderRadius: 14, padding: 12 }}>
                <T w="semi" size={13} color={C.gold600} style={{ lineHeight: 19 }}>
                  {plural(unpriced, "item")} sold this period {unpriced === 1 ? "has" : "have"} no recorded cost price, so profit may be overstated. Set cost prices on your products to fix this.
                </T>
              </View>
            ) : null}
            <Card style={{ padding: 16, borderColor: netProfit < 0 ? C.danger100 : C.cream200 }}>
              <T w="bold" size={11} color={C.ink400} style={{ textTransform: "uppercase", letterSpacing: 0.6 }}>
                Net profit
              </T>
              <T w="display" size={28} color={netProfit < 0 ? C.danger500 : C.ink900} style={{ marginTop: 4 }} numberOfLines={1} adjustsFontSizeToFit>
                {fm(netProfit, currency)}
              </T>
              <T w="regular" size={12} color={C.ink400} style={{ marginTop: 2 }}>
                {revenue > 0 ? `${((netProfit / revenue) * 100).toFixed(1)}% margin` : "No revenue yet"}
              </T>
            </Card>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <StatTile label="Revenue (paid + shipped)" value={fm(revenue, currency, { compact: true })} tone="green" />
              <StatTile label={unpriced > 0 ? `Cost of goods (${unpriced} unpriced)` : "Cost of goods"} value={fm(cogs, currency, { compact: true })} />
            </View>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <StatTile label={`Expenses (${plural(byCategory.length, "category", "categories")})`} value={fm(expenses, currency, { compact: true })} tone="gold" />
              <StatTile label="Invoice payments received" value={fm(invoicePayments, currency, { compact: true })} />
            </View>
            <T w="regular" size={11} color={C.ink300}>
              Invoice payments cover all-time payments recorded on issued and paid invoices.
            </T>
          </>
        ) : tab === "expenses" ? (
          <>
            <SectionTitle>Expenses by category</SectionTitle>
            <T w="semi" size={12} color={C.ink400}>
              {periodLabel} · Total {fm(grandTotal, currency)}
            </T>
            <Card style={{ padding: 16 }}>
              {byCategory.length === 0 ? (
                <T w="semi" size={13} color={C.ink400}>
                  No expenses recorded in this period.
                </T>
              ) : (
                <BarList
                  rows={byCategory.map((c: any) => ({
                    key: String(c.category),
                    label: titleCase(c.category),
                    sub: `x${c.count}`,
                    value: rawNum(c.total),
                    display: fm(c.total, currency),
                  }))}
                />
              )}
            </Card>
          </>
        ) : !inventory ? (
          <EmptyState icon="cube-outline" title="Inventory valuation unavailable" sub="Pull down to try again." />
        ) : (
          <>
            <SectionTitle>Inventory valuation</SectionTitle>
            <T w="semi" size={12} color={C.ink400}>
              Snapshot · {fd(inventory.generatedAt)}
            </T>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <StatTile label="At cost" value={fm(inventory.totals?.atCost, currency, { compact: true })} />
              <StatTile label="At retail" value={fm(inventory.totals?.atRetail, currency, { compact: true })} tone="green" />
            </View>
            {inventory.unpricedProducts > 0 ? (
              <View style={{ alignSelf: "flex-start" }}>
                <Pill tone="gold">{inventory.unpricedProducts} without cost</Pill>
              </View>
            ) : null}
            {Array.isArray(inventory.items) && inventory.items.length > 0 ? (
              <Card style={{ paddingVertical: 4, paddingHorizontal: 14 }}>
                {inventory.items.slice(0, 50).map((item: any, i: number, arr: any[]) => (
                  <View
                    key={String(item.productId ?? i)}
                    style={{ paddingVertical: 12, gap: 4, borderBottomWidth: i === arr.length - 1 ? 0 : 1, borderBottomColor: C.cream100 }}
                  >
                    <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 10 }}>
                      <T w="bold" size={14} numberOfLines={1} style={{ flex: 1 }}>
                        {item.name}
                      </T>
                      <T w="extra" size={14}>
                        {fm(item.valueAtRetail, currency)}
                      </T>
                    </View>
                    <T w="regular" size={12} color={C.ink400}>
                      {item.sku ? `${item.sku} · ` : ""}Qty {item.quantity} · Cost {item.costPrice != null ? fm(item.costPrice, currency) : "not set"} · Retail {fm(item.price, currency)}
                    </T>
                    <T w="regular" size={12} color={C.ink400}>
                      Value at cost {fm(item.valueAtCost, currency)}
                    </T>
                  </View>
                ))}
                {inventory.items.length > 50 ? (
                  <T w="regular" size={12} color={C.ink400} style={{ paddingVertical: 10 }}>
                    Showing first 50 of {inventory.items.length} products.
                  </T>
                ) : null}
              </Card>
            ) : (
              <T w="semi" size={13} color={C.ink400} style={{ textAlign: "center", paddingVertical: 24 }}>
                No products in stock yet.
              </T>
            )}
          </>
        )}
      </ScrollView>
    </Page>
  );
}
