// "Get started" checklist for the Home screen. Checks off steps from data the app already loads,
// can be hidden for good, and disappears by itself once everything is done.
import { useCallback, useEffect, useState } from "react";
import { Pressable, Share, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import { getAccess } from "../lib/access";
import { asList } from "../lib/format";
import { getJSON, setJSON, storeKey } from "../lib/localStore";
import { Card, T, tap, type IconName } from "./ui";
import { C } from "../theme";

interface Saved {
  hidden: boolean;
  shared: boolean;
}
interface Item {
  id: string;
  label: string;
  sub: string;
  icon: IconName;
  done: boolean;
  onPress: () => void;
}

export default function GetStartedCard({ hasSale }: { hasSale: boolean }) {
  const { me } = useAuth();
  const router = useRouter();
  const access = getAccess(me);
  const store = me.store || {};
  const key = storeKey("brikoh_get_started", String(store.id ?? "device"));

  const [saved, setSaved] = useState<Saved | null>(null);
  const [hasProduct, setHasProduct] = useState<boolean | null>(null);
  const [hasBank, setHasBank] = useState<boolean | null>(null);

  useEffect(() => {
    getJSON<Saved>(key, { hidden: false, shared: false }).then(setSaved);
  }, [key]);

  const update = (patch: Partial<Saved>) => {
    const next = { ...(saved || { hidden: false, shared: false }), ...patch };
    setSaved(next);
    setJSON(key, next);
  };

  // Re-check whenever Home comes back into view (e.g. after adding a product).
  useFocusEffect(
    useCallback(() => {
      if (saved?.hidden) return;
      if (access.can("products")) {
        api
          .get("/api/dashboard/products?limit=1")
          .then((res: any) => setHasProduct((typeof res?.total === "number" ? res.total : asList(res, "items", "products", "data").length) > 0))
          .catch(() => {});
      }
      if (access.can("settings")) {
        api
          .get("/api/dashboard/settings/bank-accounts")
          .then((res: any) => setHasBank(asList(res, "bankAccounts", "accounts", "items", "data").length > 0))
          .catch(() => {});
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [saved?.hidden, me.store?.id])
  );

  const shareStorefront = async () => {
    try {
      const r = await Share.share({ message: `Shop with us online: https://${store.subdomain}.brikoh.com` });
      if (r.action === Share.sharedAction) update({ shared: true });
    } catch {
      /* user cancelled */
    }
  };

  if (!saved || saved.hidden) return null;

  const items = [
    access.can("products") && hasProduct !== null
      ? { id: "product", label: "Add your first product", sub: "Name, price and how many you have", icon: "cube-outline", done: hasProduct, onPress: () => router.push("/product/new") }
      : null,
    access.can("pos")
      ? { id: "sale", label: "Make your first sale", sub: "Ring it up from the Sell tab", icon: "cart-outline", done: hasSale, onPress: () => router.push("/sell") }
      : null,
    access.can("settings") && hasBank !== null
      ? { id: "bank", label: "Add your bank details", sub: "So customers can pay you by transfer", icon: "business-outline", done: hasBank, onPress: () => router.push("/settings/bank") }
      : null,
    store.subdomain
      ? { id: "share", label: "Share your storefront link", sub: `${store.subdomain}.brikoh.com`, icon: "share-social-outline", done: saved.shared, onPress: shareStorefront }
      : null,
  ].filter(Boolean) as Item[];

  const doneCount = items.filter((i) => i.done).length;
  if (items.length === 0 || doneCount === items.length) return null;

  return (
    <Card style={{ marginHorizontal: 16, marginTop: 14, padding: 14 }}>
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <View style={{ flex: 1 }}>
          <T w="display" size={17}>
            Get started
          </T>
          <T w="semi" size={12} color={C.ink400} style={{ marginTop: 1 }}>
            {doneCount} of {items.length} done
          </T>
        </View>
        <Pressable onPress={() => update({ hidden: true })} hitSlop={10} accessibilityRole="button" accessibilityLabel="Hide get started checklist">
          <T w="extra" size={12.5} color={C.ink400}>
            Hide
          </T>
        </Pressable>
      </View>
      <View style={{ height: 6, borderRadius: 3, backgroundColor: C.cream100, marginTop: 10, overflow: "hidden" }}>
        <View style={{ height: 6, width: `${(doneCount / items.length) * 100}%`, backgroundColor: C.brand, borderRadius: 3 }} />
      </View>
      <View style={{ marginTop: 4 }}>
        {items.map((it, i) => (
          <Pressable
            key={it.id}
            onPress={() => {
              tap();
              it.onPress();
            }}
            style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 11, borderTopWidth: i ? 1 : 0, borderTopColor: C.cream100, opacity: pressed ? 0.6 : 1 })}
          >
            <View style={{ width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: it.done ? C.leaf100 : C.brand50 }}>
              <Ionicons name={it.done ? "checkmark" : it.icon} size={15} color={it.done ? C.leaf500 : C.brand} />
            </View>
            <View style={{ flex: 1 }}>
              <T w="bold" size={13.5} color={it.done ? C.ink400 : C.ink900} style={{ textDecorationLine: it.done ? "line-through" : "none" }}>
                {it.label}
              </T>
              <T w="regular" size={11.5} color={C.ink400}>
                {it.sub}
              </T>
            </View>
            {!it.done && <Ionicons name="chevron-forward" size={17} color={C.ink300} />}
          </Pressable>
        ))}
      </View>
    </Card>
  );
}