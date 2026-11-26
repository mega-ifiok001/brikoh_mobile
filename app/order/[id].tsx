import { useCallback, useEffect, useState } from "react";
import { Linking, Pressable, ScrollView, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../src/context/AuthContext";
import { api } from "../../src/lib/api";
import { apiErrorMessage, fd, fdt, fm, rawNum, titleCase } from "../../src/lib/format";
import { shareReceiptPdf, shareReceiptText, type ReceiptData } from "../../src/lib/receipt";
import { Button, Card, ErrorState, Field, Input, Money, Pill, Sheet, Skeleton, StatusPill, T, toast } from "../../src/components/ui";
import { ConfirmSheet } from "../../src/components/kit";
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
  const [shareBusy, setShareBusy] = useState<"text" | "pdf" | null>(null);
  const [fulfillment, setFulfillment] = useState<any>(null);
  const [fulfillmentError, setFulfillmentError] = useState("");
  const [fulfillmentBusy, setFulfillmentBusy] = useState(false);
  const [shipbubbleBusy, setShipbubbleBusy] = useState<"book" | "cancel" | null>(null);
  const [shipbubbleCancelConfirm, setShipbubbleCancelConfirm] = useState(false);
  const [fulfillmentSheet, setFulfillmentSheet] = useState(false);
  const [nextFulfillmentStatus, setNextFulfillmentStatus] = useState("");
  const [fulfillmentForm, setFulfillmentForm] = useState({ courierName: "", courierPhone: "", shipmentReference: "", trackingUrl: "", note: "" });
  const d = order?.delivery;

  const apply = (res: any) => {
    setOrder(res?.order ?? null);
    setLines(res?.lineItems ?? []);
    setRepayments(res?.repayments ?? []);
  };

  const load = useCallback(async () => {
    setError(null);
    try {
      const res: any = await api.get(`/api/dashboard/orders/${id}`);
      apply(res);
      const loadedOrder = res?.order;
      if (loadedOrder?.delivery) {
        try {
          const f: any = await api.get(`/api/dashboard/orders/${id}/fulfillment`);
          setFulfillment(f?.fulfillment ?? f);
          setFulfillmentError("");
        } catch (e: any) {
          setFulfillment(null);
          setFulfillmentError(apiErrorMessage(e, "Couldn't load fulfilment status."));
        }
      } else {
        setFulfillment(null);
        setFulfillmentError("");
      }
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

  const fulfillmentTransitions: Record<string, string[]> = {
    ORDER_RECEIVED: ["CONFIRMED", "CANCELLED"],
    CONFIRMED: ["PREPARING", "CANCELLED"],
    PREPARING: d?.kind === "PICKUP" ? ["READY_FOR_PICKUP", "CANCELLED"] : ["READY_FOR_DISPATCH", "CANCELLED"],
    READY_FOR_DISPATCH: ["DISPATCHED", "DELIVERY_FAILED", "CANCELLED"],
    DISPATCHED: ["DELIVERED", "DELIVERY_FAILED"],
    DELIVERY_FAILED: ["READY_FOR_DISPATCH", "CANCELLED"],
    READY_FOR_PICKUP: ["COLLECTED", "CANCELLED"],
    DELIVERED: [],
    COLLECTED: [],
    CANCELLED: [],
  };
  const availableFulfillmentStatuses = fulfillment?.provider === "shipbubble"
    ? fulfillment?.status === "ORDER_RECEIVED" ? ["CONFIRMED"] : fulfillment?.status === "CONFIRMED" ? ["PREPARING"] : []
    : fulfillmentTransitions[fulfillment?.status] || [];

  const openFulfillmentUpdate = (status: string) => {
    setNextFulfillmentStatus(status);
    setFulfillmentForm({
      courierName: fulfillment?.courierName || "",
      courierPhone: fulfillment?.courierPhone || "",
      shipmentReference: fulfillment?.shipmentReference || "",
      trackingUrl: fulfillment?.trackingUrl || "",
      note: "",
    });
    setFulfillmentSheet(true);
  };

  const saveFulfillment = async () => {
    if (!nextFulfillmentStatus) return;
    const trackingUrl = fulfillmentForm.trackingUrl.trim();
    if (trackingUrl && !/^https:\/\//i.test(trackingUrl)) return toast.error("Tracking links must start with https://.");
    setFulfillmentBusy(true);
    try {
      const body: any = { status: nextFulfillmentStatus };
      if (fulfillment?.provider !== "shipbubble") {
        body.courierName = fulfillmentForm.courierName.trim() || null;
        body.courierPhone = fulfillmentForm.courierPhone.trim() || null;
        body.shipmentReference = fulfillmentForm.shipmentReference.trim() || null;
        body.trackingUrl = trackingUrl || null;
      }
      if (fulfillmentForm.note.trim()) body.note = fulfillmentForm.note.trim();
      const key = `${Date.now()}-${Math.random().toString(36).slice(2, 14)}`;
      const res: any = await api.patch(`/api/dashboard/orders/${id}/fulfillment`, body, { "Idempotency-Key": key });
      setFulfillment(res?.fulfillment ?? res);
      setFulfillmentError("");
      setFulfillmentSheet(false);
      toast.success(`Fulfilment updated to ${titleCase(nextFulfillmentStatus.replace(/_/g, " "))}.`);
    } catch (e: any) {
      toast.error(apiErrorMessage(e, "Couldn't update fulfilment.", {
        ORDER_NOT_PAID: "Confirm payment before advancing fulfilment.",
        FULFILLMENT_NOT_CONFIGURED: "This order has no delivery or pickup option.",
        FULFILLMENT_TRANSITION_INVALID: "That fulfilment step is no longer available. Refresh and try again.",
        FULFILLMENT_STATUS_INVALID: "That status doesn't match this order's delivery or pickup option.",
        FULFILLMENT_CHANGED: "Fulfilment changed elsewhere. Refresh the order and try again.",
        PROVIDER_MANAGED_FULFILLMENT: "This shipment is managed by its delivery provider.",
      }));
      load();
    } finally {
      setFulfillmentBusy(false);
    }
  };

  const bookShipbubble = async () => {
    setShipbubbleBusy("book");
    try {
      await api.post(`/api/dashboard/orders/${id}/shipbubble/book`);
      await load();
      toast.success("Shipbubble shipment booked.");
    } catch (e: any) {
      toast.error(apiErrorMessage(e, "Couldn't book the Shipbubble shipment.", {
        ORDER_NOT_PAID: "Confirm payment before booking shipment.",
        SHIPBUBBLE_NOT_SELECTED: "This order does not use Shipbubble delivery.",
        SHIPBUBBLE_QUOTE_MISSING: "The order has no saved Shipbubble quote.",
        SHIPBUBBLE_BOOKING_PENDING: "A booking attempt needs reconciliation. Check again before retrying.",
        SHIPBUBBLE_BOOKING_FAILED: "Shipbubble couldn't book this shipment.",
      }));
      load();
    } finally {
      setShipbubbleBusy(null);
    }
  };

  const cancelShipbubble = async () => {
    setShipbubbleBusy("cancel");
    try {
      const res: any = await api.post(`/api/dashboard/orders/${id}/shipbubble/cancel`);
      setShipbubbleCancelConfirm(false);
      await load();
      toast.success(res?.refundIssued === false ? "Shipment cancelled. No payment refund was issued." : "Shipment cancelled.");
    } catch (e: any) {
      toast.error(apiErrorMessage(e, "Couldn't cancel the Shipbubble shipment.", {
        SHIPBUBBLE_CANCELLATION_UNAVAILABLE: "This shipment can no longer be cancelled before dispatch.",
        SHIPBUBBLE_CANCELLATION_FAILED: "Shipbubble couldn't cancel this shipment; it may already be in transit.",
      }));
      load();
    } finally {
      setShipbubbleBusy(null);
    }
  };

    const shareReceipt = async (kind: "text" | "pdf") => {
    if (!order) return;
    const data: ReceiptData = {
      storeName: me.store?.name || "Brikoh store",
      number: order.orderNumber || String(order.id || "").slice(0, 8).toUpperCase(),
      date: order.createdAt,
      currency,
      lines: lines.map((li) => ({
        name: li.variantName ? `${li.productName} · ${li.variantName}` : li.productName,
        qty: rawNum(li.quantity),
        unit: rawNum(li.unitPriceAtPurchase),
        total: rawNum(li.lineTotal),
      })),
      total: rawNum(order.total),
      method: order.paymentMethod,
      outstanding: rawNum(order.balanceDue ?? 0),
    };
    setShareBusy(kind);
    try {
      if (kind === "text") await shareReceiptText(data);
      else await shareReceiptPdf(data);
    } catch (e: any) {
      toast.error(e?.message || "Couldn't share the receipt.");
    } finally {
      setShareBusy(null);
    }
  };

  const awaiting = order?.status === "AWAITING_PAYMENT";
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
                  {d.kind === "PICKUP" ? "Pickup" : "Delivery"}
                </T>
                <Card style={{ paddingHorizontal: 16, paddingVertical: 6 }}>
                  <Row label="Option" value={d.optionName || "—"} />
                  <Row label="Fee" value={fm(d.fee ?? 0, currency)} />
                  <Row label="City / State" value={[d.city, d.state].filter(Boolean).join(", ") || "—"} />
                  {d.address ? <Row label="Address" value={d.address} /> : null}
                  {d.phone ? <Row label="Phone" value={d.phone} /> : null}
                  {d.instructions ? <Row label="Notes" value={d.instructions} /> : null}
                </Card>

                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 4 }}>
                  <T w="display" size={17}>Fulfilment</T>
                  {fulfillment?.status ? <Pill tone={fulfillment.status === "DELIVERED" || fulfillment.status === "COLLECTED" ? "green" : fulfillment.status === "CANCELLED" ? "danger" : "brand"}>{titleCase(String(fulfillment.status).replace(/_/g, " "))}</Pill> : null}
                </View>
                <Card style={{ padding: 16, gap: 10 }}>
                  {fulfillmentError ? (
                    <View style={{ gap: 8 }}>
                      <T w="semi" size={12.5} color={C.danger500}>{fulfillmentError}</T>
                      <Button label="Retry fulfilment status" variant="outline" small onPress={load} />
                    </View>
                  ) : !fulfillment ? (
                    <Skeleton h={54} r={14} />
                  ) : (
                    <>
                      {fulfillment.provider ? <T w="regular" size={11.5} color={C.ink400}>Provider: {titleCase(fulfillment.provider)}</T> : null}
                      {fulfillment.courierName ? <Row label="Courier" value={fulfillment.courierName} /> : null}
                      {fulfillment.courierPhone ? (
                        <Pressable onPress={() => Linking.openURL(`tel:${fulfillment.courierPhone}`)}>
                          <Row label="Courier phone" value={fulfillment.courierPhone} />
                        </Pressable>
                      ) : null}
                      {fulfillment.shipmentReference ? <Row label="Shipment reference" value={fulfillment.shipmentReference} /> : null}
                      {fulfillment.trackingUrl ? (
                        <Pressable onPress={() => Linking.openURL(fulfillment.trackingUrl)}>
                          <Row label="Tracking link" value="Open tracking page" />
                        </Pressable>
                      ) : null}
                      {order.status !== "PAID" ? (
                        <T w="semi" size={12} color={C.ink400}>Confirm payment before advancing fulfilment.</T>
                      ) : fulfillment.provider === "shipbubble" && fulfillment.status === "PREPARING" ? (
                        <View style={{ gap: 8, marginTop: 4 }}>
                          <T w="regular" size={12} color={C.ink400}>The order is prepared. Book the saved Shipbubble quote to dispatch it.</T>
                          <Button label="Book Shipbubble shipment" icon="bicycle-outline" onPress={bookShipbubble} busy={shipbubbleBusy === "book"} />
                        </View>
                      ) : fulfillment.provider === "shipbubble" && fulfillment.status === "READY_FOR_DISPATCH" ? (
                        <View style={{ gap: 8, marginTop: 4 }}>
                          <T w="regular" size={12} color={C.ink400}>Shipbubble will send status updates as the shipment moves.</T>
                          <Button label="Cancel shipment" icon="close-circle-outline" variant="danger" small onPress={() => setShipbubbleCancelConfirm(true)} busy={shipbubbleBusy === "cancel"} />
                        </View>
                      ) : fulfillment.provider === "shipbubble" && availableFulfillmentStatuses.length > 0 ? (
                        <View style={{ gap: 8, marginTop: 4 }}>
                          <T w="bold" size={12} color={C.ink500}>Order preparation</T>
                          {availableFulfillmentStatuses.map((status) => (
                            <Button key={status} label={titleCase(status.replace(/_/g, " "))} icon="arrow-forward-outline" variant="outline" small onPress={() => openFulfillmentUpdate(status)} />
                          ))}
                        </View>
                      ) : fulfillment.provider === "shipbubble" ? (
                        <T w="semi" size={12} color={C.ink400}>Shipbubble shipment updates are managed by the provider.</T>
                      ) : availableFulfillmentStatuses.length > 0 ? (
                        <View style={{ gap: 8, marginTop: 4 }}>
                          <T w="bold" size={12} color={C.ink500}>Update fulfilment status</T>
                          {availableFulfillmentStatuses.map((status) => (
                            <Button
                              key={status}
                              label={titleCase(status.replace(/_/g, " "))}
                              icon={status === "CANCELLED" ? "close-circle-outline" : "arrow-forward-outline"}
                              variant={status === "CANCELLED" ? "danger" : "outline"}
                              small
                              onPress={() => openFulfillmentUpdate(status)}
                            />
                          ))}
                        </View>
                      ) : (
                        <T w="semi" size={12} color={C.ink400}>This fulfilment is complete.</T>
                      )}
                    </>
                  )}
                </Card>

                {Array.isArray(fulfillment?.events) && fulfillment.events.length > 0 ? (
                  <>
                    <T w="display" size={16}>Fulfilment history</T>
                    <Card style={{ paddingHorizontal: 14 }}>
                      {fulfillment.events.map((event: any, index: number) => (
                        <View key={event.id || index} style={{ flexDirection: "row", gap: 10, paddingVertical: 12, borderTopWidth: index ? 1 : 0, borderTopColor: C.cream100 }}>
                          <View style={{ width: 9, height: 9, borderRadius: 6, backgroundColor: C.brand, marginTop: 5 }} />
                          <View style={{ flex: 1, gap: 3 }}>
                            <T w="bold" size={13}>{titleCase(String(event.status || "").replace(/_/g, " "))}</T>
                            <T w="regular" size={11.5} color={C.ink400}>{fdt(event.createdAt)}{event.source ? ` · ${titleCase(event.source)}` : ""}</T>
                            {event.note ? <T w="regular" size={12} color={C.ink500}>{event.note}</T> : null}
                            {event.courierName ? <T w="regular" size={11.5} color={C.ink400}>Courier: {event.courierName}</T> : null}
                            {event.shipmentReference ? <T w="regular" size={11.5} color={C.ink400}>Reference: {event.shipmentReference}</T> : null}
                          </View>
                        </View>
                      ))}
                    </Card>
                  </>
                ) : null}
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

                        {!awaiting && order.status !== "CANCELLED" && order.status !== "FAILED" && (
              <View style={{ flexDirection: "row", gap: 10 }}>
                <Button label="Send receipt" icon="share-outline" variant="outline" small busy={shareBusy === "text"} disabled={!!shareBusy} onPress={() => shareReceipt("text")} style={{ flex: 1 }} />
                <Button label="PDF receipt" icon="document-text-outline" variant="outline" small busy={shareBusy === "pdf"} disabled={!!shareBusy} onPress={() => shareReceipt("pdf")} style={{ flex: 1 }} />
              </View>
            )}

            {/* Bank transfer claim */}
            {order.bankDetails && (
              <Card style={{ padding: 16, gap: 4, backgroundColor: C.warnBg, borderColor: C.warnBorder }}>
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
      <Sheet
        open={fulfillmentSheet}
        onClose={() => setFulfillmentSheet(false)}
        title={`Update to ${titleCase(nextFulfillmentStatus.replace(/_/g, " "))}`}
        footer={<Button label={nextFulfillmentStatus === "CANCELLED" ? "Confirm fulfilment cancellation" : "Save update"} variant={nextFulfillmentStatus === "CANCELLED" ? "danger" : "primary"} onPress={saveFulfillment} busy={fulfillmentBusy} />}
      >
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 18, gap: 12, paddingBottom: 10 }}>
          {nextFulfillmentStatus === "CANCELLED" ? (
            <Card style={{ padding: 12, backgroundColor: C.warnBg, borderColor: C.warnBorder }}>
              <T w="semi" size={12.5} color={C.gold600}>This cancels fulfilment only. It does not refund or change the payment.</T>
            </Card>
          ) : null}
          <Field label="Courier name" hint="Optional">
            <Input value={fulfillmentForm.courierName} onChangeText={(v) => setFulfillmentForm({ ...fulfillmentForm, courierName: v })} placeholder="Courier or rider name" maxLength={200} />
          </Field>
          <Field label="Courier phone" hint="Optional">
            <Input value={fulfillmentForm.courierPhone} onChangeText={(v) => setFulfillmentForm({ ...fulfillmentForm, courierPhone: v })} placeholder="+234…" keyboardType="phone-pad" maxLength={30} />
          </Field>
          <Field label="Shipment reference" hint="Optional">
            <Input value={fulfillmentForm.shipmentReference} onChangeText={(v) => setFulfillmentForm({ ...fulfillmentForm, shipmentReference: v })} placeholder="Rider or package reference" maxLength={200} />
          </Field>
          <Field label="Tracking URL" hint="Optional · must start with https://">
            <Input value={fulfillmentForm.trackingUrl} onChangeText={(v) => setFulfillmentForm({ ...fulfillmentForm, trackingUrl: v })} placeholder="https://…" autoCapitalize="none" keyboardType="url" maxLength={2000} />
          </Field>
          <Field label="Update note" hint="Optional · added to fulfilment history">
            <Input value={fulfillmentForm.note} onChangeText={(v) => setFulfillmentForm({ ...fulfillmentForm, note: v })} placeholder="Add a note for this status change" multiline maxLength={500} style={{ height: 88, alignItems: "flex-start", paddingVertical: 10 }} />
          </Field>
        </ScrollView>
      </Sheet>
      <ConfirmSheet
        open={shipbubbleCancelConfirm}
        title="Cancel Shipbubble shipment?"
        message="This cancels the courier shipment before dispatch. It does not refund or change the customer's payment."
        confirmLabel="Cancel shipment"
        danger
        busy={shipbubbleBusy === "cancel"}
        onConfirm={cancelShipbubble}
        onClose={() => setShipbubbleCancelConfirm(false)}
      />
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
