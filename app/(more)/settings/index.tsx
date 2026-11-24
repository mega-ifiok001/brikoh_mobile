import { View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useAuth } from "../../../src/context/AuthContext";
import { getAccess } from "../../../src/lib/access";
import { Avatar, Card, EmptyState, T } from "../../../src/components/ui";
import { ListRow, Page } from "../../../src/components/kit";
import { ScrollView } from "react-native";
import { C } from "../../../src/theme";

export default function SettingsHub() {
  const router = useRouter();
  const { me } = useAuth();
  const access = getAccess(me);

  if (!access.can("settings")) {
    return (
      <Page title="Settings">
        <EmptyState icon="lock-closed-outline" title="Owner access only" sub="Settings are limited to the store owner and admins." />
      </Page>
    );
  }

  const account: any = me.account || {};
  const store: any = me.store || {};
  const name = account.fullName || account.name || [account.firstName, account.lastName].filter(Boolean).join(" ") || account.email || "Your account";
  const chev = <Ionicons name="chevron-forward" size={18} color={C.ink300} />;
  const go = (p: string) => () => router.push(p as any);

  return (
    <Page title="Settings">
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 14 }} showsVerticalScrollIndicator={false}>
        <Card style={{ padding: 16, flexDirection: "row", alignItems: "center", gap: 14 }}>
          <Avatar name={name} size={54} dark />
          <View style={{ flex: 1 }}>
            <T w="display" size={18} numberOfLines={1}>
              {name}
            </T>
            {account.email ? (
              <T w="regular" size={12.5} color={C.ink400} numberOfLines={1}>
                {account.email}
              </T>
            ) : null}
            {store.name ? (
              <T w="bold" size={12.5} color={C.brand} numberOfLines={1} style={{ marginTop: 2 }}>
                {store.name} · {access.label}
              </T>
            ) : null}
          </View>
        </Card>

        <T w="bold" size={12} color={C.ink400} style={{ marginTop: 4, marginLeft: 4 }}>
          STORE
        </T>
        <Card style={{ paddingHorizontal: 14 }}>
          <ListRow icon="business-outline" title="Business" sub="Store name, type, location, currency" right={chev} onPress={go("/settings/business")} />
          <ListRow icon="storefront-outline" title="Storefront" sub="Template, hero, WhatsApp, social links" right={chev} onPress={go("/settings/storefront")} />
          <ListRow icon="bicycle-outline" title="Delivery options" sub="Pickup and delivery choices at checkout" right={chev} onPress={go("/settings/delivery")} />
          <ListRow icon="card-outline" title="Bank accounts" sub="Settlement accounts for bank transfers" right={chev} onPress={go("/settings/bank")} last />
        </Card>

        <T w="bold" size={12} color={C.ink400} style={{ marginTop: 4, marginLeft: 4 }}>
          ACCOUNT
        </T>
        <Card style={{ paddingHorizontal: 14 }}>
          <ListRow icon="notifications-outline" title="Alerts" sub="Email alerts and customer receipts" right={chev} onPress={go("/settings/notifications")} />
          <ListRow icon="keypad-outline" title="PIN sign-in" sub="Set or change your six-digit account PIN" right={chev} onPress={go("/settings/pin")} />
          <ListRow icon="key-outline" title="Account and password" sub="Change password, delete account" right={chev} onPress={go("/settings/account")} />
          <ListRow icon="ribbon-outline" title="Plan and billing" sub="Usage, upgrade, billing history" right={chev} onPress={go("/settings/plan")} last />
        </Card>
      </ScrollView>
    </Page>
  );
}
