import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, FlatList, ScrollView, View } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../src/context/AuthContext";
import { api } from "../../src/lib/api";
import { ago, apiErrorMessage, plural, titleCase } from "../../src/lib/format";
import { Card, Chip, EmptyState, ErrorState, LargeTitle, ListSkeleton, Money, Pill, SearchBar, StatusPill, T } from "../../src/components/ui";
import { C } from "../../src/theme";

const STATUSES = ["ALL", "PENDING", "AWAITING_PAYMENT", "PAID", "SHIPPED", "CANCELLED", "REFUNDED", "FAILED"];
const LABEL: Record<string, string> = { ALL: "All", AWAITING_PAYMENT: "Awaiting payment" };

export default function Orders() {
  const { me } = useAuth();
  const router = useRouter();
  const currency: string = (me.store || {}).currency || "NGN";

  const [items, setItems] = useState<any[]>([]);
  const [next, setNext] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [more, setMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("ALL");
  const [q, setQ] = useState("");
  const reqId = useRef(0);

  const load = useCallback(
    async (cursor?: string | null) => {
      const id = ++reqId.current;
      if (cursor) setMore(true);
      else setLoading(true);
      setError(null);
      try {
        const qs = new URLSearchParams();
        qs.set("limit", "20");
        if (status !== "ALL") qs.set("status", status);
        if (q.trim()) qs.set("q", q.trim());
        if (cursor) qs.set("cursor", cursor);
        const res: any = await api.get(`/api/dashboard/orders?${qs.toString()}`);
        if (id !== reqId.current) return; // a newer request superseded this one
        setItems((prev) => (cursor ? [...prev, ...(res?.items ?? [])] : res?.items ?? []));
        setNext(res?.nextCursor ?? null);
      } catch (e: any) {
        if (id !== reqId.current) return;
        setError(apiErrorMessage(e, "Couldn't load orders."));
      } finally {
        if (id === reqId.current) {
          setLoading(false);
          setMore(false);
        }
      }
    },
    [status, q]
  );

  // Debounce search typing; filter changes fire immediately via the same effect.
  useEffect(() => {
    const t = setTimeout(() => load(), q ? 350 : 0);
    return () => clearTimeout(t);
  }, [load, q]);

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1 }}>
      <LargeTitle title="Orders" />
      <View style={{ paddingHorizontal: 16, gap: 10 }}>
        <SearchBar value={q} onChangeText={setQ} placeholder="Search customer or order #" />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
          {STATUSES.map((s) => (
            <Chip key={s} label={LABEL[s] || titleCase(s)} on={status === s} onPress={() => setStatus(s)} />
          ))}
        </ScrollView>
      </View>

      {error && !items.length ? (
        <ErrorState message={error} onRetry={() => load()} />
      ) : loading && !items.length ? (
        <View style={{ marginTop: 14 }}>
          <ListSkeleton />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(o) => o.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 28, gap: 10 }}
          showsVerticalScrollIndicator={false}
          refreshing={loading}
          onRefresh={() => load()}
          onEndReachedThreshold={0.4}
          onEndReached={() => {
            if (next && !more && !loading) load(next);
          }}
          ListEmptyComponent={<EmptyState icon="receipt-outline" title="No orders found" sub={q || status !== "ALL" ? "Try a different filter." : "Orders from your shop and storefront will show up here."} />}
          ListFooterComponent={more ? <ActivityIndicator color={C.brand} style={{ marginVertical: 14 }} /> : undefined}
          renderItem={({ item: o }) => {
            const awaiting = o.status === "AWAITING_PAYMENT";
            return (
              <Card onPress={() => router.push(`/order/${o.id}`)} style={{ padding: 14, borderColor:awaiting ? C.warnBorder : C.cream200, backgroundColor: awaiting ? C.warnBg : C.white }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <T w="extra" size={14.5} numberOfLines={1} style={{ flex: 1, marginRight: 10 }}>
                    {o.customer?.name || "Walk-in"}
                  </T>
                  <Money v={o.total} currency={currency} size={14.5} />
                </View>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 3 }}>
                  <T w="semi" size={12} color={C.ink400}>
                    {o.orderNumber} · {plural(o.itemCount, "item")} · {ago(o.createdAt)}
                  </T>
                  {o.delivery ? <Ionicons name="bicycle" size={14} color={C.brand} /> : null}
                </View>
                <View style={{ flexDirection: "row", gap: 6, marginTop: 10 }}>
                  <StatusPill status={o.status} />
                  <Pill>{titleCase(o.source)}</Pill>
                  {o.paymentMethod ? <Pill>{titleCase(o.paymentMethod)}</Pill> : null}
                </View>
              </Card>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}
