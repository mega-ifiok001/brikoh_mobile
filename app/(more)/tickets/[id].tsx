import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { addTicketMessage, getTicket, type Ticket, type TicketMessage } from "../../../src/lib/tickets";
import { apiErrorMessage, fdt, initialsOf, titleCase } from "../../../src/lib/format";
import { Button, Card, EmptyState, ErrorState, Input, Pill, StatusPill, T, toast } from "../../../src/components/ui";
import { Page } from "../../../src/components/kit";
import { PRIORITY_TONE, authorName, isClosed, isMerchant } from "../../../src/components/tickets/shared";
import { C } from "../../../src/theme";

export default function TicketDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const scroller = useRef<any>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const d = await getTicket(String(id));
      setTicket(d.ticket);
      setMessages(d.messages);
    } catch (e: any) {
      setError(e?.status === 404 ? "That ticket no longer exists." : apiErrorMessage(e, "Couldn't open that ticket."));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const send = async () => {
    if (!ticket || !reply.trim()) return;
    setBusy(true);
    try {
      const m = await addTicketMessage(ticket.id, reply.trim());
      setMessages((prev) => [...prev, m]);
      setReply("");
      toast.success("Message sent.");
      try {
        const d = await getTicket(ticket.id);
        setTicket(d.ticket);
      } catch {
        /* non-fatal */
      }
      setTimeout(() => scroller.current?.scrollToEnd({ animated: true }), 100);
    } catch (e: any) {
      if (e?.code === "TICKET_CLOSED") {
        toast.error("This ticket is closed, so you can't reply to it.");
        try {
          const d = await getTicket(ticket.id);
          setTicket(d.ticket);
        } catch {
          /* ignore */
        }
      } else {
        toast.error(apiErrorMessage(e, "Couldn't send that message."));
      }
    } finally {
      setBusy(false);
    }
  };

  const closed = ticket ? isClosed(ticket) : true;

  return (
    <Page title="Ticket">
      {loading ? (
        <ActivityIndicator color={C.brand} style={{ marginTop: 60 }} />
      ) : error || !ticket ? (
        <ErrorState message={error || "Couldn't open that ticket."} onRetry={load} />
      ) : (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <ScrollView ref={scroller} contentContainerStyle={{ padding: 16, paddingBottom: 20, gap: 14 }} keyboardShouldPersistTaps="handled">
            <View style={{ gap: 8 }}>
              <T w="display" size={20}>
                {ticket.subject || "Ticket"}
              </T>
              <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
                <StatusPill status={String(ticket.status)} />
                <Pill tone={PRIORITY_TONE[String(ticket.priority)] || "neutral"}>{titleCase(String(ticket.priority))}</Pill>
              </View>
              <T w="regular" size={11} color={C.ink300} selectable>
                {ticket.id}
              </T>
            </View>

            {!closed ? (
              <Card style={{ padding: 12, gap: 2, backgroundColor: C.cream50 }}>
                <T w="semi" size={12.5} color={C.ink500}>
                  Assigned to: <T w="bold" size={12.5}>{ticket.assignedAdmin?.name || ticket.assignedAdmin?.email || "Unassigned"}</T>
                </T>
                {ticket.lastMessageAt ? (
                  <T w="semi" size={12.5} color={C.ink500}>
                    Last activity: <T w="bold" size={12.5}>{fdt(ticket.lastMessageAt)}</T>
                  </T>
                ) : null}
              </Card>
            ) : null}

            {messages.length === 0 ? (
              <EmptyState icon="chatbubbles-outline" title="No messages yet" />
            ) : (
              messages.map((m) => {
                const mine = isMerchant(m);
                return (
                  <View key={m.id} style={{ alignItems: mine ? "flex-end" : "flex-start", gap: 4 }}>
                    <View style={{ flexDirection: mine ? "row-reverse" : "row", alignItems: "center", gap: 6 }}>
                      <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: C.brand, alignItems: "center", justifyContent: "center" }}>
                        <T w="extra" size={9} color="#fff">
                          {initialsOf(authorName(m))}
                        </T>
                      </View>
                      <T w="semi" size={12} color={C.ink400}>
                        {authorName(m)}
                        {m.author?.type ? ` · ${titleCase(String(m.author.type))}` : ""}
                      </T>
                    </View>
                    <View
                      style={{
                        maxWidth: "85%",
                        paddingHorizontal: 14,
                        paddingVertical: 10,
                        borderRadius: 18,
                        borderBottomRightRadius: mine ? 4 : 18,
                        borderBottomLeftRadius: mine ? 18 : 4,
                        backgroundColor: mine ? C.brand : C.white,
                        borderWidth: mine ? 0 : 1,
                        borderColor: C.cream200,
                      }}
                    >
                      <T w="semi" size={14} color={mine ? "#fff" : C.ink800} style={{ lineHeight: 20 }} selectable>
                        {m.body}
                      </T>
                    </View>
                    <T w="regular" size={11} color={C.ink300}>
                      {fdt(m.createdAt)}
                    </T>
                  </View>
                );
              })
            )}
          </ScrollView>

          {closed ? (
            <View style={{ padding: 16, borderTopWidth: 1, borderTopColor: C.cream200 }}>
              <T w="semi" size={13} color={C.ink400}>
                This ticket is closed. Open a new one for follow-ups.
              </T>
            </View>
          ) : (
            <View style={{ padding: 12, gap: 8, borderTopWidth: 1, borderTopColor: C.cream200, backgroundColor: C.white }}>
              <Input
                value={reply}
                onChangeText={setReply}
                placeholder="Write a reply to support..."
                multiline
                textAlignVertical="top"
                editable={!busy}
                style={{ height: 90, alignItems: "flex-start", paddingTop: 10 }}
              />
              <Button label="Send" icon="send" onPress={send} busy={busy} disabled={!reply.trim()} small />
            </View>
          )}
        </KeyboardAvoidingView>
      )}
    </Page>
  );
}
