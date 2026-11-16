import { useCallback, useRef, useState } from "react";
import { ActivityIndicator, FlatList, RefreshControl, ScrollView, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { apiErrorMessage, fdt } from "../../../src/lib/format";
import { listTickets, type Ticket } from "../../../src/lib/tickets";
import { Button, Card, Chip, EmptyState, ErrorState, ListSkeleton, Pill, StatusPill, T } from "../../../src/components/ui";
import { AddButton, Page } from "../../../src/components/kit";
import { PRIORITIES, PRIORITY_TONE, STATUSES, isClosed } from "../../../src/components/tickets/shared";
import { titleCase } from "../../../src/lib/format";
import { C } from "../../../src/theme";

export default function TicketsList() {
  const router = useRouter();
  const [items, setItems] = useState<Ticket[]>([]);
  const [next, setNext] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("ALL");
  const [priority, setPriority] = useState<string>("ALL");
  const reqId = useRef(0);

  const load = useCallback(
    async (cursor?: string | null) => {
      const id = ++reqId.current;
      if (cursor) setLoadingMore(true);
      else if (!refreshing) setLoading(true);
      setError(null);
      try {
        const page = await listTickets({
          status: status === "ALL" ? undefined : status,
          priority: priority === "ALL" ? undefined : priority,
          cursor: cursor ?? undefined,
          limit: 20,
        });
        if (id !== reqId.current) return;
        setItems((prev) => (cursor ? [...prev, ...page.items] : page.items));
        setNext(page.nextCursor);
      } catch (e: any) {
        if (id !== reqId.current) return;
        setError(apiErrorMessage(e, "Couldn't load support tickets."));
      } finally {
        if (id === reqId.current) {
          setLoading(false);
          setLoadingMore(false);
          setRefreshing(false);
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [status, priority]
  );

  // Reload when focused (e.g. after creating a ticket) and when filters change.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  return (
    <Page title="Support tickets" right={<AddButton onPress={() => router.push("/tickets/new")} />}>
      <FlatList
        data={items}
        keyExtractor={(t) => t.id}
        contentContainerStyle={{ padding: 16, paddingBottom: 32, gap: 10 }}
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
        onEndReachedThreshold={0.4}
        onEndReached={() => {
          if (next && !loadingMore && !loading) load(next);
        }}
        ListHeaderComponent={
          <View style={{ gap: 8, marginBottom: 6 }}>
            <T w="regular" size={13} color={C.ink400}>
              Conversations with the Brikoh support team.
            </T>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {STATUSES.map((s) => (
                <Chip key={s} label={s === "ALL" ? "All statuses" : titleCase(s)} on={status === s} onPress={() => setStatus(s)} />
              ))}
            </ScrollView>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {PRIORITIES.map((p) => (
                <Chip key={p} label={p === "ALL" ? "All priorities" : titleCase(p)} on={priority === p} onPress={() => setPriority(p)} />
              ))}
            </ScrollView>
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <ListSkeleton rows={6} />
          ) : error ? (
            <ErrorState message={error} onRetry={() => load()} />
          ) : (
            <EmptyState
              icon="help-buoy-outline"
              title="No tickets found"
              sub="Questions you send to Brikoh support will show up here."
              action={<Button label="Open a ticket" icon="add" onPress={() => router.push("/tickets/new")} small />}
            />
          )
        }
        ListFooterComponent={loadingMore ? <ActivityIndicator color={C.brand} style={{ marginVertical: 12 }} /> : undefined}
        renderItem={({ item: t }) => (
          <Card onPress={() => router.push(`/tickets/${t.id}`)} style={{ padding: 14, gap: 8 }}>
            <T w="extra" size={14.5} numberOfLines={2}>
              {t.subject || "Untitled"}
            </T>
            <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
              <StatusPill status={String(t.status)} />
              <Pill tone={PRIORITY_TONE[String(t.priority)] || "neutral"}>{titleCase(String(t.priority))}</Pill>
            </View>
            <T w="regular" size={12} color={C.ink400}>
              {t.assignedAdmin?.name || t.assignedAdmin?.email || (isClosed(t) ? "Closed" : "Unassigned")} · Updated {fdt(t.updatedAt ?? t.lastMessageAt)}
            </T>
          </Card>
        )}
      />
    </Page>
  );
}
