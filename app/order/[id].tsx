import { useCallback, useEffect, useState } from "react";
import { Linking, Pressable, ScrollView, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../src/context/AuthContext";
import { api } from "../../src/lib/api";
import { apiErrorMessage, fd, fdt, fm, rawNum, titleCase } from "../../src/lib/format";
import { Button, Card, ErrorState, Money, Skeleton, StatusPill, T, toast } from "../../src/components/ui";
import { C } from "../../src/theme";

export default function OrderDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { me } = useAuth();
  const currency: string = (me.store || {}).currency || "NGN";

  const [order, setOrder] = useState<any | null>(null);
  const [lines, setLines] = useState<any[]>([]);
  const [repayments, setRepayments] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"confirm" | "reject" | null>(null);

  const apply = (res: any) => {
    setOrder(res?.order ?? null);
    setLines(res?.lineItems ?? []);
    setRepayments(res?.repayments ?? []);
  };

  const load = useCallback(async () => {
    setError(null);
    try {
      apply(await api.get(`/api/dashboard/orders/${id}`));
    } catch (e: any) {
      setError(apiErrorMessage(e, "Couldn't open that order."));
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const confirmPayment = async () => {
    setBusy("confirm");
    try {
      const body = order?.total != null ? { confirmedAmount: Number(order.total) } : {};
      apply(await api.post(`/api/dashboard/orders/${id}/confirm-payment`, body));
      toast.success("Payment confirmed — order marked as paid.");
    } catch (e: any) {
      toast.error(
        apiErrorMessage(e, "Couldn't confirm payment.", {
          AMOUNT_MISMATCH: "The confirmed amount must exactly match the order total.",
          ORDER_NOT_AWAITING_PAYMENT: "This order is no longer awaiting payment.",
          CONFIRM_CONFLICT: "This order was updated by another action. Pull to refresh.",
        })
      );
    } finally {
      setBusy(null);
    }
  };

  const rejectPayment = async () => {
    setBusy("reject");
    try {
      apply(await api.post(`/api/dashboard/orders/${id}/reject-payment`));
      toast.success("Payment claim rejected.");
    } catch (e: any) {
      toast.error(apiErrorMessage(e, "Couldn't reject the payment.", { ORDER_NOT_AWAITING_PAYMENT: "This order is no longer awaiting payment." }));
    } finally {
      setBusy(null);
    }
  };

  const awaiting = order?.status === "AWAITING_PAYMENT";
  const d = order?.delivery;
  const balance = order?.balanceDue ?? (order?.total != null && order?.amountPaid != null ? rawNum(order.total) - rawNum(order.amountPaid) : null);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.cream50 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 8 }}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={{ width: 40, height: 40, borderRadius: 13, backgroundColor: C.white, borderWidth: 1, borderColor: C.cream200, alignItems: "center", justifyContent: "center" }}>
          <Ionicons name="chevron-back" size={20} color={C.ink900} />
        </Pressable>
        <T w="extra" size={15}>
          {order?.orderNumber ? `Order ${order.orderNumber}` : "Order"}
        </T>
        <View style={{ width: 40 }} />
      </View>

      {error ? (
        <ErrorState message={error} onRetry={load} />
      ) : !order ? (
        <View style={{ padding: 16, gap: 12 }}>
          <Skeleton h={130} r={20} />
          <Skeleton h={120} r={18} />
          <Skeleton h={90} r={18} />
        </View>
      ) : (
        <>
          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: awaiting ? 130 : 30, gap: 14 }} showsVerticalScrollIndicator={false}>
            <Card style={{ padding: 18, alignItems: "center", gap: 6 }}>
              <StatusPill status={order.status} />
              <T w="display" size={36} style={{ letterSpacing: -0.8, marginTop: 4 }}>
                {fm(order.total, currency)}
              </T>
              <T w="semi" size={13} color={C.ink500}>
                {order.customer?.name || "Walk-in"}
                {order.customer?.phone ? ` · ${order.customer.phone}` : ""}
              </T>
              <T w="regular" size={12} color={C.ink400}>
                {fdt(order.createdAt)} · {titleCase(order.source)}
                {order.paymentMethod ? ` · ${titleCase(order.paymentMethod)}` : ""}
              </T>
              {order.customer?.phone ? (
                <Pressable onPress={() => Linking.openURL(`tel:${order.customer.phone}`)} style={{ marginTop: 8, flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Ionicons name="call-outline" size={15} color={C.brand} />
                  <T w="extra" size={13} color={C.brand}>
                    Call customer
                  </T>
                </Pressable>
              ) : null}
            </Card>

            {/* Totals */}
            <Card style={{ paddingHorizontal: 16, paddingVertical: 6 }}>
              <Row label="Branch" value={order.branch?.name || "—"} />
              <Row label="Sold by" value={order.soldBy?.name || "—"} />
              {order.discountAmount != null && rawNum(order.discountAmount) > 0 && <Row label="Discount" value={`−${fm(order.discountAmount, currency)}`} />}
              {order.amountPaid != null && <Row label="Paid so far" value={fm(order.amountPaid, currency)} />}
              {balance != null && rawNum(balance) > 0 && <Row label="Balance due" value={fm(balance, currency)} strong />}
            </Card>

            {/* Delivery */}
            {d && (
              <>
                <T w="display" size={17}>
                  Delivery
                </T>
                <Card style={{ paddingHorizontal: 16, paddingVertical: 6 }}>
                  <Row label="Option" value={d.optionName || "—"} />
                  <Row label="Fee" value={fm(d.fee ?? 0, currency)} />
                  <Row label="City / State" value={[d.city, d.state].filter(Boolean).join(", ") || "—"} />
                  {d.address ? <Row label="Address" value={d.address} /> : null}
                  {d.phone ? <Row label="Phone" value={d.phone} /> : null}
                  {d.instructions ? <Row label="Notes" value={d.instructions} /> : null}
                </Card>
              </>
            )}

            {/* Items */}
            <T w="display" size={17}>
              Items
            </T>
            <Card style={{ paddingHorizontal: 16 }}>
              {lines.length === 0 ? (
                <T w="semi" size={13} color={C.ink400} style={{ paddingVertical: 18, textAlign: "center" }}>
                  No line items attached
                </T>
              ) : (
                lines.map((li, i) => (
                  <View key={li.id || i} style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12, borderTopWidth: i ? 1 : 0, borderTopColor: C.cream100 }}>
                    <View style={{ flex: 1 }}>
                      <T w="bold" size={13.5}>
                        {li.productName}
                        {li.variantName ? ` · ${li.variantName}` : ""}
                      </T>
                      <T w="regular" size={11.5} color={C.ink400}>
                        {li.quantity} × {fm(li.unitPriceAtPurchase, currency)}
                      </T>
                    </View>
                    <Money v={li.lineTotal} currency={currency} size={13.5} />
                  </View>
                ))
              )}
            </Card>

            {/* Bank transfer claim */}
            {order.bankDetails && (
              <Card style={{ padding: 16, gap: 4, backgroundColor: "#fffdf7", borderColor: "#f0dcae" }}>
                <T w="extra" size={13} color={C.gold600}>
                  Customer says they paid by bank transfer
                </T>
                {order.paymentReference ? (
                  <T w="semi" size={12.5} color={C.ink500}>
                    Reference: {order.paymentReference}
                  </T>
                ) : null}
                <T w="regular" size={12} color={C.ink400}>
                  Confirm only after you see the money in your account.
                </T>
              </Card>
            )}

            {/* Repayments */}
            {repayments.length > 0 && (
              <>
                <T w="display" size={17}>
                  Repayments
                </T>
                <Card style={{ paddingHorizontal: 16 }}>
                  {repayments.map((r, i) => (
                    <View key={r.id || i} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 12, borderTopWidth: i ? 1 : 0, borderTopColor: C.cream100 }}>
                      <T w="semi" size={13} color={C.ink500}>
                        {fd(r.createdAt || r.paidAt)}
                      </T>
                      <Money v={r.amount} currency={currency} size={13.5} />
                    </View>
                  ))}
                </Card>
              </>
            )}
          </ScrollView>

          {awaiting && (
            <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: 16, paddingBottom: 26, backgroundColor: C.cream50, borderTopWidth: 1, borderTopColor: C.cream200, flexDirection: "row", gap: 10 }}>
              <Button label="Reject" variant="danger" onPress={rejectPayment} busy={busy === "reject"} disabled={busy === "confirm"} style={{ flex: 1 }} />
              <Button label="Confirm payment" onPress={confirmPayment} busy={busy === "confirm"} disabled={busy === "reject"} style={{ flex: 2 }} />
            </View>
          )}
        </>
      )}
    </SafeAreaView>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 14, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: C.cream100 }}>
      <T w="semi" size={13} color={C.ink400}>
        {label}
      </T>
      <T w={strong ? "extra" : "bold"} size={13} style={{ flex: 1, textAlign: "right" }}>
        {value}
      </T>
    </View>
  );
}
