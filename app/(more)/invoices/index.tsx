import { useState } from "react";
import { FlatList, ScrollView, View } from "react-native";
import { router } from "expo-router";
import { useAuth } from "../../../src/context/AuthContext";
import { getAccess } from "../../../src/lib/access";
import { usePaged } from "../../../src/lib/usePaged";
import { fd, rawNum, titleCase } from "../../../src/lib/format";
import { Button, Card, Chip, EmptyState, ErrorState, ListSkeleton, Money, SearchBar, StatusPill, T } from "../../../src/components/ui";
import { AddButton, Page } from "../../../src/components/kit";
import { useRefreshOnFocus } from "../../../src/components/invoices/shared";
import { C } from "../../../src/theme";

const STATUSES = ["ALL", "DRAFT", "ISSUED", "PAID", "VOID"] as const;

export default function InvoicesList() {
  const { me } = useAuth();
  const currency: string = (me.store as any)?.currency || "NGN";
  const allowed = getAccess(me).can("invoices");

  const [statusF, setStatusF] = useState<(typeof STATUSES)[number]>("ALL");
  const [q, setQ] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const { items, loading, loadingMore, error, hasMore, refresh, loadMore } = usePaged(
    "/api/dashboard/invoices",
    { status: statusF === "ALL" ? undefined : statusF, q: q.trim() || undefined },
    ["items", "invoices", "data"],
    { limit: 24 }
  );

  useRefreshOnFocus(() => {
    if (allowed) refresh();
  });

  if (!allowed) {
    return (
      <Page title="Invoices">
        <EmptyState icon="lock-closed-outline" title="No access" sub="Your role doesn't include invoices. Ask the store owner to grant it." />
      </Page>
    );
  }

  const custName = (i: any) => i.customer?.name || i.customerName || "No customer";

  const header = (
    <View style={{ gap: 12, marginBottom: 4 }}>
      <SearchBar value={q} onChangeText={setQ} placeholder="Search customer name or phone" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }} keyboardShouldPersistTaps="handled">
        {STATUSES.map((s) => (
          <Chip key={s} label={s === "ALL" ? "All" : titleCase(s)} on={statusF === s} onPress={() => setStatusF(s)} />
        ))}
      </ScrollView>
    </View>
  );

  if (error && !items.length) {
    return (
      <Page title="Invoices" right={<AddButton onPress={() => router.push("/invoices/new")} />}>
        <ErrorState message={error} onRetry={refresh} />
      </Page>
    );
  }

  return (
    <Page title="Invoices" right={<AddButton onPress={() => router.push("/invoices/new")} />}>
      <FlatList
        data={loading ? [] : items}
        keyExtractor={(i) => String(i.id)}
        contentContainerStyle={{ padding: 16, paddingBottom: 30, gap: 10 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshing={refreshing}
        onRefresh={async () => {
          setRefreshing(true);
          await refresh();
          setRefreshing(false);
        }}
        onEndReachedThreshold={0.4}
        onEndReached={() => {
          if (hasMore && !loadingMore && !loading) loadMore();
        }}
        ListHeaderComponent={header}
        ListEmptyComponent={
          loading ? (
            <View style={{ marginHorizontal: -16 }}>
              <ListSkeleton rows={5} />
            </View>
          ) : (
            <EmptyState
              icon="document-text-outline"
              title={q || statusF !== "ALL" ? "No invoices match" : "No invoices yet"}
              sub={q || statusF !== "ALL" ? "Try a different filter or search." : "Invoice a customer on account: issue it, then record payments until it's settled."}
              action={q || statusF !== "ALL" ? undefined : <Button label="Create an invoice" icon="add" small onPress={() => router.push("/invoices/new")} />}
            />
          )
        }
        ListFooterComponent={loadingMore ? <ListSkeleton rows={1} /> : undefined}
        renderItem={({ item: i }) => {
          const paid = rawNum(i.amountPaid);
          return (
            <Card onPress={() => router.push(`/invoices/${i.id}`)} style={{ padding: 14, gap: 8 }}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                <T w="extra" size={14.5} style={{ flex: 1 }} numberOfLines={1}>
                  {i.number || "Draft"}
                </T>
                <StatusPill status={i.status} />
              </View>
              <T w="semi" size={13} color={C.ink500} numberOfLines={1}>
                {custName(i)}
              </T>
              <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" }}>
                <View>
                  <T w="regular" size={11.5} color={C.ink400}>
                    {i.issuedAt ? `Issued ${fd(i.issuedAt)}` : "Not issued"}
                    {i.dueDate ? ` · Due ${fd(i.dueDate)}` : ""}
                  </T>
                  {paid > 0 ? (
                    <T w="semi" size={11.5} color={C.leaf500}>
                      Paid {paid.toLocaleString()}
                    </T>
                  ) : null}
                </View>
                <Money v={i.total} currency={currency} size={15} />
              </View>
            </Card>
          );
        }}
      />
    </Page>
  );
}
