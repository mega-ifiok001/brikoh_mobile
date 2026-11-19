import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, FlatList, ScrollView, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../src/context/AuthContext";
import { api } from "../../src/lib/api";
import { apiErrorMessage, asList, rawNum } from "../../src/lib/format";
import { Button, Card, Chip, EmptyState, ErrorState, LargeTitle, ListSkeleton, Money, Pill, SearchBar, StatusPill, T } from "../../src/components/ui";
import { AddButton } from "../../src/components/kit";
import { getAccess } from "../../src/lib/access";
import { C } from "../../src/theme";

const PAGE = 30;

const stockOf = (p: any) => (p.variants?.length ? p.variants.reduce((a: number, v: any) => a + rawNum(v.quantity), 0) : rawNum(p.quantity));

export default function Products() {
  const { me } = useAuth();
  const currency: string = (me.store || {}).currency || "NGN";
  const router = useRouter();
  const canManage = getAccess(me).can("products");

  const [items, setItems] = useState<any[]>([]);
  const [next, setNext] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [more, setMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "low" | "out" | "hidden">("all");

  const load = useCallback(async (cursor?: string | null) => {
    if (cursor) setMore(true);
    else setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({ limit: String(PAGE) });
      if (cursor) qs.set("cursor", cursor);
      const res: any = await api.get(`/api/dashboard/products?${qs.toString()}`);
      const list = asList(res, "items", "products", "data");
      setItems((prev) => (cursor ? [...prev, ...list] : list));
      setNext(res?.nextCursor ?? null);
      setTotal(typeof res?.total === "number" ? res.total : list.length);
    } catch (e: any) {
      setError(apiErrorMessage(e, "Couldn't load products."));
    } finally {
      setLoading(false);
      setMore(false);
    }
  }, []);

  const first = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (first.current) first.current = false;
      else load();
    }, [load])
  );
  useEffect(() => {
    load();
  }, [load]);

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return items.filter((p) => {
      if (s && !(p.name || "").toLowerCase().includes(s) && !(p.sku || "").toLowerCase().includes(s)) return false;
      const stock = stockOf(p);
      const threshold = rawNum(p.lowStockThreshold ?? 5);
      if (filter === "out") return stock <= 0;
      if (filter === "low") return stock > 0 && stock <= threshold;
      if (filter === "hidden") return p.status !== "PUBLISHED";
      return true;
    });
  }, [items, q, filter]);

  const lowCount = items.filter((p) => {
    const s = stockOf(p);
    return s > 0 && s <= rawNum(p.lowStockThreshold ?? 5);
  }).length;

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1 }}>
      <LargeTitle title="Products" sub={total ? `${total} in your catalogue` : undefined} right={canManage ? <AddButton onPress={() => router.push("/product/new")} /> : undefined} />
      <View style={{ paddingHorizontal: 16, gap: 10 }}>
        <SearchBar value={q} onChangeText={setQ} placeholder="Search by name or SKU" />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
          <Chip label="All" on={filter === "all"} onPress={() => setFilter("all")} />
          <Chip label={`Low stock${lowCount ? ` · ${lowCount}` : ""}`} on={filter === "low"} onPress={() => setFilter("low")} />
          <Chip label="Out of stock" on={filter === "out"} onPress={() => setFilter("out")} />
          <Chip label="Hidden" on={filter === "hidden"} onPress={() => setFilter("hidden")} />
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
          data={shown}
          keyExtractor={(p) => p.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 28, gap: 10 }}
          showsVerticalScrollIndicator={false}
          refreshing={loading}
          onRefresh={() => load()}
          onEndReachedThreshold={0.4}
          onEndReached={() => {
            if (next && !more && !loading) load(next);
          }}
          ListEmptyComponent={<EmptyState
              icon="cube-outline"
              title="No products here"
              sub={q || filter !== "all" ? "Try a different search or filter." : "Add your first product to start selling."}
              action={!q && filter === "all" && canManage ? <Button label="Add a product" icon="add" small onPress={() => router.push("/product/new")} /> : undefined}
            />}
          renderItem={({ item: p }) => {
            const stock = stockOf(p);
            const img = p.coverImageUrl || p.images?.[0];
            const low = stock > 0 && stock <= rawNum(p.lowStockThreshold ?? 5);
            return (
              <Card onPress={() => router.push(`/product/${p.id}`)} style={{ padding: 10, flexDirection: "row", alignItems: "center", gap: 12 }}>
                <View style={{ width: 58, height: 58, borderRadius: 14, backgroundColor: C.cream100, overflow: "hidden", alignItems: "center", justifyContent: "center" }}>
                  {img ? <Image source={{ uri: img }} style={{ width: "100%", height: "100%" }} contentFit="cover" transition={150} /> : <Ionicons name="cube-outline" size={24} color={C.ink300} />}
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <T w="bold" size={14} numberOfLines={1}>
                    {p.name}
                  </T>
                  <T w="regular" size={11.5} color={C.ink400} numberOfLines={1}>
                    {p.sku ? `SKU ${p.sku}` : "No SKU"}
                    {p.variants?.length ? ` · ${p.variants.length} variants` : ""}
                  </T>
                  <Money v={p.discountPrice ?? p.price} currency={currency} size={13} color={C.brand} />
                </View>
                <View style={{ alignItems: "flex-end", gap: 5 }}>
                  <Pill tone={stock <= 0 ? "danger" : low ? "gold" : "green"}>{stock <= 0 ? "Out" : low ? `${stock} left` : String(stock)}</Pill>
                  {p.status && p.status !== "PUBLISHED" ? <StatusPill status={p.status} /> : null}
                </View>
              </Card>
            );
          }}
        />
      )}

    </SafeAreaView>
  );
}

