import { useCallback, useEffect, useState } from "react";
import { Pressable, RefreshControl, ScrollView, View } from "react-native";
import { useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../src/context/AuthContext";
import { api } from "../../src/lib/api";
import { getAccess } from "../../src/lib/access";
import { ago, apiErrorMessage, asList, fm, pick, plural, rawNum, titleCase } from "../../src/lib/format";
import { Avatar, Card, ErrorState, IconButton, Money, Pill, Skeleton, StatusPill, T, toast } from "../../src/components/ui";
import StockAdjustSheet from "../../src/components/stock/StockAdjustSheet";
import AnnouncementsBanner from "../../src/components/announcements/AnnouncementsBanner";
import { C } from "../../src/theme";

export default function Home() {
  const { me } = useAuth();
  const router = useRouter();
  const access = getAccess(me);
  const store = me.store || {};
  const currency: string = store.currency || "NGN";

  const [ov, setOv] = useState<any | null>(null);
  const [wallet, setWallet] = useState<any | null>(null);
  const [alerts, setAlerts] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Hide/show amounts (remembered between app launches)
  const [hideAmounts, setHideAmounts] = useState(false);

  useEffect(() => {
    SecureStore.getItemAsync("brikoh_hide_amounts")
      .then((v) => setHideAmounts(v === "1"))
      .catch(() => {});
  }, []);

  const toggleAmounts = useCallback(() => {
    setHideAmounts((prev) => {
      const next = !prev;
      SecureStore.setItemAsync("brikoh_hide_amounts", next ? "1" : "0").catch(() => {});
      return next;
    });
  }, []);

  const MASK = "₦ ••••••";

  // Restock straight from the low-stock list: stock only ever moves through the
  // stock-adjustment endpoint, so we need the full product + the branch list.
  const [branches, setBranches] = useState<any[]>([]);
  const [adjustFor, setAdjustFor] = useState<any | null>(null);
  const [adjustBusy, setAdjustBusy] = useState<string | null>(null);

  const openAdjust = useCallback(
    async (productId: string) => {
      if (!productId) return;
      setAdjustBusy(productId);
      try {
        const [pRes, bRes] = await Promise.all([
          api.get(`/api/dashboard/products/${productId}`),
          branches.length ? Promise.resolve(null) : api.get("/api/dashboard/branches").catch(() => null),
        ]);
        if (bRes) setBranches(asList(bRes, "branches", "items", "data"));
        const product = pRes?.product ?? pRes;
        if (!product?.id) throw new Error("Product not found");
        setAdjustFor(product);
      } catch (e: any) {
        toast.error(apiErrorMessage(e, "Couldn't open that product."));
      } finally {
        setAdjustBusy(null);
      }
    },
    [branches.length]
  );

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    setError(null);
    const [o, w, n] = await Promise.allSettled([
      api.get("/api/dashboard/overview"),
      api.get("/api/dashboard/wallet"),
      api.get("/api/dashboard/notifications"),
    ]);
    if (o.status === "fulfilled") setOv(o.value);
    else setError(apiErrorMessage(o.reason, "Couldn't load your dashboard."));
    if (w.status === "fulfilled") setWallet(w.value);
    if (n.status === "fulfilled") setAlerts((n.value?.dispatches ?? []).length > 0);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const kpis = ov?.kpis || {};
  const canViewProfit = "revenue" in kpis;
  const quick = ov?.quickStats || {};
  const lowStock: any[] = ov?.lowStock || [];
  const expiring: any[] = ov?.expiringSoon || [];
  const top: any[] = ov?.topProducts || [];
  const recent: any[] = ov?.recentOrders || [];
  const w = wallet?.wallet ?? wallet;
  const walletBalance = pick(w, ["available", "balance", "availableBalance"]);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const firstName = me.account?.firstName || "";

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1 }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 28 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            tintColor={C.brand}
            onRefresh={() => {
              setRefreshing(true);
              load(true);
            }}
          />
        }
      >
        {/* Store bar */}
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingTop: 6 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
            <View style={{ width: 40, height: 40, borderRadius: 13, backgroundColor: C.solid, alignItems: "center", justifyContent: "center" }}>
              <Ionicons name="storefront" size={18} color={C.onSolid} />
            </View>
            <View style={{ flex: 1 }}>
              <T w="extra" size={14} numberOfLines={1}>
                {store.name || "My store"}
              </T>
              <T w="semi" size={11.5} color={C.ink400} numberOfLines={1}>
                {store.subdomain ? `${store.subdomain}.brikoh.com` : "No subdomain yet"}
              </T>
            </View>
          </View>
          <IconButton name="notifications-outline" badge={alerts} onPress={() => router.push("/more")} />
        </View>

        <View style={{ paddingHorizontal: 16, marginTop: 18 }}>
          <T w="display" size={27} style={{ letterSpacing: -0.6 }}>
            {greeting}
            {firstName ? `, ${firstName}` : ""}
          </T>
          <T w="semi" size={12.5} color={C.ink400} style={{ marginTop: 2 }}>
            {new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </T>
        </View>

        <AnnouncementsBanner />

        {error && !ov ? (
          <ErrorState message={error} onRetry={() => load()} />
        ) : loading && !ov ? (
          <View style={{ padding: 16, gap: 12 }}>
            <Skeleton h={150} r={22} />
            <View style={{ flexDirection: "row", gap: 10 }}>
              <Skeleton h={72} r={16} w="31%" />
              <Skeleton h={72} r={16} w="31%" />
              <Skeleton h={72} r={16} w="31%" />
            </View>
            <Skeleton h={160} r={18} />
          </View>
        ) : (
          <>
            {/* Hero revenue card */}
            <LinearGradient
              colors={[C.night, "#202a24"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ marginHorizontal: 16, marginTop: 16, borderRadius: 24, padding: 18, overflow: "hidden" }}
            >
              <View style={{ position: "absolute", right: -40, top: -40, width: 150, height: 150, borderRadius: 75, backgroundColor: "rgba(236,100,5,0.28)" }} />
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <T w="bold" size={12} color={C.nightMuted}>
                  Revenue · last 30 days
                </T>
                {canViewProfit && (
                  <Pressable
                    onPress={toggleAmounts}
                    hitSlop={12}
                    style={({ pressed }) => ({
                      width: 32,
                      height: 32,
                      borderRadius: 16,
                      backgroundColor: "rgba(255,255,255,0.12)",
                      alignItems: "center",
                      justifyContent: "center",
                      opacity: pressed ? 0.7 : 1,
                    })}
                  >
                    <Ionicons name={hideAmounts ? "eye-off-outline" : "eye-outline"} size={17} color="#fff" />
                  </Pressable>
                )}
              </View>
              <T w="display" size={34} color="#fff" style={{ marginTop: 4, letterSpacing: -0.8 }}>
                {canViewProfit ? (hideAmounts ? MASK : fm(kpis.revenue, currency)) : "Hidden"}
              </T>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 8 }}>
                <T w="semi" size={12.5} color={C.nightMuted}>
                  {canViewProfit
                    ? hideAmounts
                      ? "Avg order ••••"
                      : kpis.avgOrderValue
                        ? `Avg order ${fm(kpis.avgOrderValue, currency, { compact: true })}`
                        : "Avg order —"
                    : "Ask an owner for access"}
                </T>
              </View>
              <View style={{ flexDirection: "row", gap: 8, marginTop: 16 }}>
                {access.can("pos") && (
                  <HeroBtn label="New sale" icon="cart" primary onPress={() => router.push("/sell")} />
                )}
                {access.can("wallet") && <HeroBtn label="Wallet" icon="wallet-outline" onPress={() => router.push("/wallet")} />}
                <HeroBtn label="Orders" icon="receipt-outline" onPress={() => router.push("/orders")} />
              </View>
            </LinearGradient>

            {/* KPI row */}
            <View style={{ flexDirection: "row", gap: 10, paddingHorizontal: 16, marginTop: 12 }}>
              <Kpi label="Orders" value={String(kpis.orders ?? "—")} />
              <Kpi label="Low stock" value={String(lowStock.length)} tone={lowStock.length ? "gold" : undefined} />
              <Kpi label="Credit owed" value={hideAmounts ? "••••" : fm(quick.creditOwing ?? 0, currency, { compact: true })} tone={rawNum(quick.creditOwing) > 0 ? "gold" : undefined} />
            </View>
            {walletBalance !== undefined && access.can("wallet") && (
              <Card onPress={() => router.push("/wallet")} style={{ marginHorizontal: 16, marginTop: 10, padding: 14, flexDirection: "row", alignItems: "center", gap: 12 }}>
                <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: C.brand50, alignItems: "center", justifyContent: "center" }}>
                  <Ionicons name="wallet" size={19} color={C.brand} />
                </View>
                <View style={{ flex: 1 }}>
                  <T w="semi" size={12} color={C.ink400}>
                    Wallet · online sales land here
                  </T>
                  {hideAmounts ? (
                    <T w="extra" size={17}>
                      ₦ ••••••
                    </T>
                  ) : (
                    <Money v={walletBalance} currency="NGN" size={17} />
                  )}
                </View>
                <Ionicons name="chevron-forward" size={18} color={C.ink300} />
              </Card>
            )}

            {/* Recent orders */}
            <SectionHead title="Recent orders" action="See all" onAction={() => router.push("/orders")} />
            <Card style={{ marginHorizontal: 16, paddingHorizontal: 14 }}>
              {recent.length === 0 ? (
                <T w="semi" size={13} color={C.ink400} style={{ paddingVertical: 22, textAlign: "center" }}>
                  No orders yet — make your first sale!
                </T>
              ) : (
                recent.slice(0, 5).map((o, i) => (
                  <View
                    key={o.id}
                    style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12, borderTopWidth: i ? 1 : 0, borderTopColor: C.cream100 }}
                  >
                    <Avatar name={o.customerName || "Walk-in"} />
                    <View style={{ flex: 1 }}>
                      <T w="bold" size={13.5} numberOfLines={1}>
                        {o.customerName || "Walk-in"}
                      </T>
                      <T w="regular" size={11.5} color={C.ink400}>
                        {plural(o.lineItemCount, "item")} · {titleCase(o.source)}
                      </T>
                    </View>
                    <View style={{ alignItems: "flex-end", gap: 4 }}>
                      <Money v={o.total} currency={currency} size={13.5} />
                      <StatusPill status={o.status} />
                    </View>
                  </View>
                ))
              )}
            </Card>

            {/* Low stock */}
            {lowStock.length > 0 && (
              <>
                <SectionHead title="Low stock" action="Products" onAction={() => router.push("/products")} />
                <Card style={{ marginHorizontal: 16, paddingHorizontal: 14 }}>
                  {lowStock.slice(0, 5).map((x, i) => (
                    <View key={(x.productId || "") + (x.branchId || "") + i} style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 11, borderTopWidth: i ? 1 : 0, borderTopColor: C.cream100 }}>
                      <View style={{ flex: 1 }}>
                        <T w="bold" size={13.5} numberOfLines={1}>
                          {x.name}
                        </T>
                        <T w="regular" size={11.5} color={C.ink400}>
                          {x.branchName || "Branch"}
                        </T>
                      </View>
                      <Pill tone={x.quantity <= 0 ? "danger" : "gold"}>{x.quantity <= 0 ? "Out" : `${x.quantity} left`}</Pill>
                      {access.can("products") && (
                        <Pressable onPress={() => openAdjust(x.productId)} disabled={adjustBusy === x.productId} hitSlop={8}>
                          <T w="extra" size={12.5} color={C.brand}>
                            {adjustBusy === x.productId ? "Opening…" : "Restock"}
                          </T>
                        </Pressable>
                      )}
                    </View>
                  ))}
                </Card>
              </>
            )}

            {/* Expiring */}
            {expiring.length > 0 && (
              <>
                <SectionHead title="Expiring soon" />
                <Card style={{ marginHorizontal: 16, paddingHorizontal: 14 }}>
                  {expiring.slice(0, 5).map((x, i) => {
                    const days = Math.ceil((new Date(x.expiryDate).getTime() - Date.now()) / 86400000);
                    return (
                      <View key={(x.productId || "") + i} style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 11, borderTopWidth: i ? 1 : 0, borderTopColor: C.cream100 }}>
                        <View style={{ flex: 1 }}>
                          <T w="bold" size={13.5} numberOfLines={1}>
                            {x.name}
                          </T>
                          <T w="regular" size={11.5} color={C.ink400}>
                            {days < 0 ? "Expired" : days === 0 ? "Expires today" : `Expires in ${days}d`} · {x.quantity} on hand
                          </T>
                        </View>
                        <Pill tone={days <= 3 ? "danger" : "gold"}>{days}d</Pill>
                      </View>
                    );
                  })}
                </Card>
              </>
            )}

            {/* Top products */}
            {top.length > 0 && (
              <>
                <SectionHead title="Top products (30d)" />
                <Card style={{ marginHorizontal: 16, paddingHorizontal: 14 }}>
                  {top.slice(0, 5).map((tp, i) => (
                    <View key={tp.productId || i} style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 11, borderTopWidth: i ? 1 : 0, borderTopColor: C.cream100 }}>
                      <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: C.cream100, alignItems: "center", justifyContent: "center" }}>
                        <T w="extra" size={12} color={C.ink500}>
                          {i + 1}
                        </T>
                      </View>
                      <View style={{ flex: 1 }}>
                        <T w="bold" size={13.5} numberOfLines={1}>
                          {tp.name}
                        </T>
                        <T w="regular" size={11.5} color={C.ink400}>
                          {tp.units} sold
                        </T>
                      </View>
                      {"revenue" in tp && <Money v={tp.revenue} currency={currency} size={13.5} />}
                    </View>
                  ))}
                </Card>
              </>
            )}
            <T w="regular" size={11} color={C.ink300} style={{ textAlign: "center", marginTop: 22 }}>
              Updated {ago(new Date().toISOString())} · pull down to refresh
            </T>
          </>
        )}
      </ScrollView>

      <StockAdjustSheet open={!!adjustFor} onClose={() => setAdjustFor(null)} product={adjustFor} branches={branches} onDone={() => load(true)} />
    </SafeAreaView>
  );
}

function HeroBtn({ label, icon, primary, onPress }: { label: string; icon: any; primary?: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        height: 42,
        borderRadius: 14,
        backgroundColor: primary ? C.brand : "rgba(255,255,255,0.12)",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        opacity: pressed ? 0.8 : 1,
      })}
    >
      <Ionicons name={icon} size={16} color="#fff" />
      <T w="extra" size={12.5} color="#fff">
        {label}
      </T>
    </Pressable>
  );
}

function Kpi({ label, value, tone }: { label: string; value: string; tone?: "gold" }) {
  return (
    <Card style={{ flex: 1, padding: 12 }}>
      <T w="semi" size={11} color={C.ink400}>
        {label}
      </T>
      <T w="display" size={20} color={tone === "gold" ? C.gold600 : C.ink900} style={{ marginTop: 2 }} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </T>
    </Card>
  );
}

function SectionHead({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 18, marginTop: 22, marginBottom: 10 }}>
      <T w="display" size={17}>
        {title}
      </T>
      {action ? (
        <Pressable onPress={onAction} hitSlop={10}>
          <T w="extra" size={12.5} color={C.brand}>
            {action} →
          </T>
        </Pressable>
      ) : null}
    </View>
  );
}