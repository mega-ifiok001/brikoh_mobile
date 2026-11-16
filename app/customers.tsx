import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Linking, Pressable, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../src/lib/api";
import { apiErrorMessage, asList, pick } from "../src/lib/format";
import { Avatar, Card, EmptyState, ErrorState, ListSkeleton, SearchBar, T } from "../src/components/ui";
import { AddButton } from "../src/components/kit";
import { useAuth } from "../src/context/AuthContext";
import { getAccess } from "../src/lib/access";
import { C } from "../src/theme";

export default function Customers() {
  const router = useRouter();
  const { me } = useAuth();
  const canManage = getAccess(me).can("customers");
  const [items, setItems] = useState<any[]>([]);
  const [next, setNext] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [more, setMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reqId = useRef(0);

  const load = useCallback(
    async (cursor?: string | null) => {
      const id = ++reqId.current;
      if (cursor) setMore(true);
      else setLoading(true);
      setError(null);
      try {
        const qs = new URLSearchParams({ limit: "24" });
        if (q.trim()) qs.set("q", q.trim());
        if (cursor) qs.set("cursor", cursor);
        const res: any = await api.get(`/api/dashboard/customers?${qs.toString()}`);
        if (id !== reqId.current) return;
        const list = asList(res, "items", "customers", "data");
        setItems((prev) => (cursor ? [...prev, ...list] : list));
        setNext(pick(res, ["nextCursor", "after", "cursor", "next"]) ?? null);
      } catch (e: any) {
        if (id === reqId.current) setError(apiErrorMessage(e, "Couldn't load customers."));
      } finally {
        if (id === reqId.current) {
          setLoading(false);
          setMore(false);
        }
      }
    },
    [q]
  );

  useEffect(() => {
    const t = setTimeout(() => load(), 350);
    return () => clearTimeout(t);
  }, [load]);

  // Refresh when returning from the detail / create screen.
  const first = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (first.current) first.current = false;
      else load();
    }, [load])
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.cream50 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 8 }}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={{ width: 40, height: 40, borderRadius: 13, backgroundColor: C.white, borderWidth: 1, borderColor: C.cream200, alignItems: "center", justifyContent: "center" }}>
          <Ionicons name="chevron-back" size={20} color={C.ink900} />
        </Pressable>
        <T w="extra" size={15}>
          Customers
        </T>
        {canManage ? <AddButton onPress={() => router.push("/customer/new")} /> : <View style={{ width: 40 }} />}
      </View>
      <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
        <SearchBar value={q} onChangeText={setQ} placeholder="Search name, phone or email" />
      </View>

      {error && !items.length ? (
        <ErrorState message={error} onRetry={() => load()} />
      ) : loading && !items.length ? (
        <ListSkeleton />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(c) => c.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 28, gap: 10 }}
          showsVerticalScrollIndicator={false}
          refreshing={loading}
          onRefresh={() => load()}
          onEndReachedThreshold={0.4}
          onEndReached={() => {
            if (next && !more && !loading) load(next);
          }}
          ListEmptyComponent={<EmptyState icon="people-outline" title="No customers yet" sub={q ? "No one matches your search." : "Tap + to add your first customer."} />}
          ListFooterComponent={more ? <ActivityIndicator color={C.brand} style={{ marginVertical: 14 }} /> : undefined}
          renderItem={({ item: c }) => (
            <Card onPress={() => router.push(`/customer/${c.id}`)} style={{ padding: 12, flexDirection: "row", alignItems: "center", gap: 12 }}>
              <Avatar name={c.name} size={44} />
              <View style={{ flex: 1 }}>
                <T w="bold" size={14} numberOfLines={1}>
                  {c.name || "Unnamed"}
                </T>
                <T w="regular" size={12} color={C.ink400} numberOfLines={1}>
                  {[c.phone, c.email].filter(Boolean).join(" · ") || "No contact details"}
                </T>
              </View>
              {c.phone ? (
                <Pressable onPress={() => Linking.openURL(`tel:${c.phone}`)} hitSlop={8} style={{ width: 38, height: 38, borderRadius: 13, backgroundColor: C.brand50, alignItems: "center", justifyContent: "center" }}>
                  <Ionicons name="call" size={17} color={C.brand} />
                </Pressable>
              ) : null}
            </Card>
          )}
        />
      )}
    </SafeAreaView>
  );
}
