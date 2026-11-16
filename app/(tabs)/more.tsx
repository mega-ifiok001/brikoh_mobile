import { useCallback, useEffect, useState } from "react";
import { Linking, Pressable, ScrollView, View } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../src/context/AuthContext";
import { useTheme, type ThemePref } from "../../src/context/ThemeContext";
import { Segmented } from "../../src/components/kit";
import { api } from "../../src/lib/api";
import { getAccess, type Feature } from "../../src/lib/access";
import { ago, fd, titleCase } from "../../src/lib/format";
import { Avatar, Card, LargeTitle, Pill, T, tap, toast, type IconName } from "../../src/components/ui";
import { C } from "../../src/theme";

interface Item {
  label: string;
  icon: IconName;
  feature: Feature;
  route?: string; // live in the app
  web?: string; // open on the web dashboard
}
interface Group {
  title: string;
  items: Item[];
}

const GROUPS: Group[] = [
  {
    title: "Customers",
    items: [
      { label: "Customers", icon: "people-outline", feature: "customers", route: "/customers" },
      { label: "Invoices", icon: "document-text-outline", feature: "invoices", route: "/invoices" },
      { label: "Discounts", icon: "pricetag-outline", feature: "discounts", route: "/discounts" },
    ],
  },
  {
    title: "Money",
    items: [
      { label: "Wallet", icon: "wallet-outline", feature: "wallet", route: "/wallet" },
      { label: "Expenses", icon: "cash-outline", feature: "expenses", route: "/expenses" },
      { label: "Analytics", icon: "stats-chart-outline", feature: "analytics", route: "/analytics" },
      { label: "Reports", icon: "library-outline", feature: "reports", route: "/reports" },
    ],
  },
  {
    title: "Inventory",
    items: [
      { label: "Branches", icon: "business-outline", feature: "branches", route: "/branches" },
      { label: "Purchases", icon: "bus-outline", feature: "purchases", route: "/purchases" },
      { label: "Storefront studio", icon: "storefront-outline", feature: "storefront", route: "/storefront" },
    ],
  },
  {
    title: "Manage",
    items: [
      { label: "Staff", icon: "person-outline", feature: "staff", route: "/staff" },
      { label: "Support tickets", icon: "help-buoy-outline", feature: "tickets", route: "/tickets" },
      { label: "Settings & billing", icon: "settings-outline", feature: "settings", route: "/settings" },
    ],
  },
];

const KIND: Record<string, { icon: IconName; label: string }> = {
  LOW_STOCK: { icon: "alert-circle-outline", label: "Low stock" },
  EXPIRING_SOON: { icon: "time-outline", label: "Expiring soon" },
  PAYMENT_RECEIVED: { icon: "wallet-outline", label: "Payment received" },
};

function alertText(n: any): string {
  const s = n.snapshot || {};
  switch (n.kind) {
    case "LOW_STOCK":
      return `${s.productName ?? "A product"} at ${s.branchName ?? "a branch"} — ${s.quantity ?? n.sentQuantity ?? "?"} left`;
    case "EXPIRING_SOON":
      return `${s.productName ?? "A product"} expiring${s.expiryDate ? ` ${fd(s.expiryDate)}` : " soon"}`;
    case "PAYMENT_RECEIVED":
      return s.amount ? `Payment of ${s.amount} received${s.customerName ? ` from ${s.customerName}` : ""}` : "Payment received";
    default:
      return titleCase(n.refType || "");
  }
}

export default function More() {
  const { me, logout } = useAuth();
    const { pref, setPref } = useTheme();
  const router = useRouter();
  const access = getAccess(me);
  const store = me.store || {};
  const account = me.account || {};
  const name = [account.firstName, account.lastName].filter(Boolean).join(" ") || account.email || "Account";
  const [alerts, setAlerts] = useState<any[]>([]);

  const loadAlerts = useCallback(async () => {
    try {
      const res: any = await api.get("/api/dashboard/notifications");
      setAlerts((res?.dispatches ?? []).slice(0, 6));
    } catch {
      setAlerts([]);
    }
  }, []);

  useEffect(() => {
    loadAlerts();
  }, [loadAlerts]);

  const open = (it: Item) => {
    tap();
    if (it.route) router.push(it.route as any);
    else if (it.web) {
      Linking.openURL(it.web).catch(() => toast.error("Couldn't open the web dashboard."));
    }
  };

  const visible = GROUPS.map((g) => ({ ...g, items: g.items.filter((i) => access.can(i.feature)) })).filter((g) => g.items.length);

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1 }}>
      <LargeTitle title="More" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 30, gap: 8 }} showsVerticalScrollIndicator={false}>
        <Card style={{ padding: 14, flexDirection: "row", alignItems: "center", gap: 12 }}>
          <Avatar name={name} size={48} dark />
          <View style={{ flex: 1 }}>
            <T w="extra" size={15} numberOfLines={1}>
              {name}
            </T>
            <T w="semi" size={12} color={C.ink400} numberOfLines={1}>
              {access.label} · {store.name || "My store"}
            </T>
          </View>
          <Pill tone="brand">{titleCase(me.subscription?.tier || me.subscription?.plan?.tier || "Starter")}</Pill>
        </Card>

        {store.subdomain ? (
          
          <Card onPress={() => Linking.openURL(`https://${store.subdomain}.brikoh.com`)} style={{ padding: 14, flexDirection: "row", alignItems: "center", gap: 12, marginTop: 2 }}>
            <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: C.solid, alignItems: "center", justifyContent: "center" }}>
              <Ionicons name="globe-outline" size={19} color={C.onSolid} />
            </View>
            <View style={{ flex: 1 }}>
              <T w="bold" size={14}>
                View storefront
              </T>
              <T w="regular" size={12} color={C.ink400}>
                {store.subdomain}.brikoh.com
              </T>
            </View>
            <Ionicons name="open-outline" size={18} color={C.ink300} />
          </Card>
        ) : null}

        {alerts.length > 0 && (
          <>
            <SectionLabel>Alerts</SectionLabel>
            <Card style={{ paddingHorizontal: 14 }}>
              {alerts.map((n, i) => {
                const meta = KIND[n.kind] || { icon: "notifications-outline" as IconName, label: "Alert" };
                return (
                  <View key={n.id || i} style={{ flexDirection: "row", gap: 12, paddingVertical: 12, borderTopWidth: i ? 1 : 0, borderTopColor: C.cream100 }}>
                    <View style={{ width: 34, height: 34, borderRadius: 11, backgroundColor: C.brand50, alignItems: "center", justifyContent: "center" }}>
                      <Ionicons name={meta.icon} size={17} color={C.brand} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <T w="bold" size={13}>
                        {meta.label}
                      </T>
                      <T w="regular" size={12} color={C.ink500} numberOfLines={2}>
                        {alertText(n)}
                      </T>
                      <T w="semi" size={11} color={C.ink300} style={{ marginTop: 2 }}>
                        {ago(n.sentAt)}
                      </T>
                    </View>
                  </View>
                );
              })}
            </Card>
          </>
        )}

        {visible.map((g) => (
          <View key={g.title} style={{ gap: 8 }}>
            <SectionLabel>{g.title}</SectionLabel>
            <Card style={{ paddingHorizontal: 14 }}>
              {g.items.map((it, i) => (
                <Pressable
                  key={it.label}
                  onPress={() => open(it)}
                  style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 13, borderTopWidth: i ? 1 : 0, borderTopColor: C.cream100, opacity: pressed ? 0.6 : 1 })}
                >
                  <Ionicons name={it.icon} size={20} color={C.brand} />
                  <T w="bold" size={14} style={{ flex: 1 }}>
                    {it.label}
                  </T>
                  {it.web ? (
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                      <T w="semi" size={11} color={C.ink300}>
                        Web
                      </T>
                      <Ionicons name="open-outline" size={14} color={C.ink300} />
                    </View>
                  ) : (
                    <Ionicons name="chevron-forward" size={18} color={C.ink300} />
                  )}
                </Pressable>
              ))}
            </Card>
          </View>
        ))}
        <View style={{ gap: 8 }}>
          <SectionLabel>Appearance</SectionLabel>
          <Card style={{ padding: 10 }}>
            <Segmented
              options={[
                { value: "system", label: "System" },
                { value: "light", label: "Light" },
                { value: "dark", label: "Dark" },
              ]}
              value={pref}
              onChange={(v) => setPref(v as ThemePref)}
            />
          </Card>
        </View>
        <Card
          onPress={async () => {
            await logout();
            toast.info("Signed out. See you soon.");
          }}
          style={{ marginTop: 14, padding: 14, flexDirection: "row", alignItems: "center", gap: 12 }}
        >
          <Ionicons name="log-out-outline" size={20} color={C.danger500} />
          <T w="extra" size={14} color={C.danger500}>
            Sign out
          </T>
        </Card>
        <T w="regular" size={11} color={C.ink300} style={{ textAlign: "center", marginTop: 10 }}>
          Brikoh · all-in-one commerce for your store
        </T>
      </ScrollView>
    </SafeAreaView>
  );
}

function SectionLabel({ children }: { children: string }) {
  return (
    <T w="extra" size={10.5} color={C.ink300} style={{ letterSpacing: 1.4, textTransform: "uppercase", marginTop: 12, marginLeft: 4 }}>
      {children}
    </T>
  );
}
