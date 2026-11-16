import { useCallback, useEffect, useState } from "react";
import { ScrollView, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useAuth } from "../../../src/context/AuthContext";
import { getAccess } from "../../../src/lib/access";
import { api } from "../../../src/lib/api";
import { apiErrorMessage, fd, fm, rawNum, titleCase } from "../../../src/lib/format";
import { Button, Card, EmptyState, ErrorState, Field, Input, Money, Skeleton, StatusPill, T, toast } from "../../../src/components/ui";
import { ConfirmSheet, DetailRow, Page, SectionTitle } from "../../../src/components/kit";
import { FormSheet, PaymentSheet, balanceOf, cleanNum, useRefreshOnFocus } from "../../../src/components/invoices/shared";
import { C } from "../../../src/theme";

const remainingOf = (l: any): number => (l.remainingToReceive != null ? rawNum(l.remainingToReceive) : rawNum(l.quantity) - rawNum(l.quantityReceived));
const lineName = (l: any) => `${l.productName || l.product?.name || "Item"}${l.variantName || l.variant?.name ? ` · ${l.variantName || l.variant?.name}` : ""}`;

export default function PurchaseOrderDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { me } = useAuth();
  const currency: string = (me.store as any)?.currency || "NGN";
  const allowed = getAccess(me).can("purchases");

  const [po, setPo] = useState<any | null>(null);
  const [lineItems, setLineItems] = useState<any[]>([]);
  const [receipts, setReceipts] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [actionBusy, setActionBusy] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [delOpen, setDelOpen] = useState(false);
  const [delBusy, setDelBusy] = useState(false);

  const [receiveOpen, setReceiveOpen] = useState(false);
  const [recQty, setRecQty] = useState<Record<string, string>>({});
  const [recNote, setRecNote] = useState("");
  const [recBusy, setRecBusy] = useState(false);

  const [payOpen, setPayOpen] = useState(false);
  const [payBusy, setPayBusy] = useState(false);

  const load = useCallback(
    async (quiet = false) => {
      if (!quiet) setLoading(true);
      setError(null);
      try {
        const res: any = await api.get(`/api/dashboard/purchase-orders/${id}`);
        setPo(res?.purchaseOrder ?? res);
        setLineItems(Array.isArray(res?.lineItems) ? res.lineItems : []);
        setReceipts(Array.isArray(res?.receipts) ? res.receipts : []);
        setPayments(Array.isArray(res?.payments) ? res.payments : []);
      } catch (e: any) {
        setError(apiErrorMessage(e, "Couldn't open that purchase order.", { PURCHASE_ORDER_NOT_FOUND: "That purchase order no longer exists." }));
      } finally {
        setLoading(false);
      }
    },
    [id]
  );

  useEffect(() => {
    if (allowed) load();
  }, [load, allowed]);
  useRefreshOnFocus(() => {
    if (allowed) load(true);
  });

  const issue = async () => {
    setActionBusy(true);
    try {
      await api.post(`/api/dashboard/purchase-orders/${id}/issue`);
      toast.success("Purchase order issued.");
      load(true);
    } catch (e: any) {
      toast.error(
        apiErrorMessage(e, "Couldn't issue the order.", {
          ORDER_NOT_EDITABLE: "This order has already been issued (or received/cancelled), so it can't be issued again.",
          PURCHASE_ORDER_NOT_FOUND: "That purchase order no longer exists.",
        })
      );
    } finally {
      setActionBusy(false);
    }
  };

  const openReceive = () => {
    const initial: Record<string, string> = {};
    lineItems.forEach((l) => {
      const r = remainingOf(l);
      if (r > 0) initial[l.id] = String(r);
    });
    setRecQty(initial);
    setRecNote("");
    setReceiveOpen(true);
  };

  const submitReceive = async () => {
    const lines = lineItems
      .map((l) => {
        const q = parseInt(cleanNum(recQty[l.id] || "0"), 10) || 0;
        return q > 0 ? { lineItemId: l.id, quantityReceived: q } : null;
      })
      .filter(Boolean) as { lineItemId: string; quantityReceived: number }[];
    if (!lines.length) {
      toast.error("Enter how much arrived on at least one line.");
      return;
    }
    setRecBusy(true);
    try {
      await api.post(`/api/dashboard/purchase-orders/${id}/receive`, { note: recNote.trim() || undefined, lineItems: lines });
      toast.success("Receipt recorded. Stock updated.");
      setReceiveOpen(false);
      load(true);
    } catch (e: any) {
      toast.error(
        apiErrorMessage(e, "Couldn't record the receipt.", {
          ORDER_NOT_RECEIVABLE: "This order can't receive stock in its current status.",
          LINE_ITEM_NOT_FOUND: "One of those lines doesn't belong to this order. Reopen it and try again.",
          PURCHASE_ORDER_NOT_FOUND: "That purchase order no longer exists.",
        })
      );
    } finally {
      setRecBusy(false);
    }
  };

  const recordPayment = async (amount: string, note: string) => {
    setPayBusy(true);
    try {
      await api.post(`/api/dashboard/purchase-orders/${id}/payments`, { amount, note: note || undefined });
      toast.success("Payment recorded.");
      setPayOpen(false);
      load(true);
    } catch (e: any) {
      toast.error(
        apiErrorMessage(e, "Couldn't record the payment.", {
          PAYMENT_EXCEEDS_BALANCE: "Amount exceeds the balance due.",
          ORDER_NOT_PAYABLE: "This order can't accept payments in its current status.",
        })
      );
    } finally {
      setPayBusy(false);
    }
  };

  const doCancel = async () => {
    setActionBusy(true);
    try {
      await api.post(`/api/dashboard/purchase-orders/${id}/cancel`);
      toast.success("Purchase order cancelled.");
      setCancelOpen(false);
      load(true);
    } catch (e: any) {
      toast.error(apiErrorMessage(e, "Couldn't cancel the order.", { ORDER_NOT_CANCELLABLE: "Orders that have already received stock can't be cancelled." }));
      setCancelOpen(false);
    } finally {
      setActionBusy(false);
    }
  };

  const doDelete = async () => {
    setDelBusy(true);
    try {
      await api.del(`/api/dashboard/purchase-orders/${id}`);
      toast.success("Draft deleted.");
      setDelOpen(false);
      router.back();
    } catch (e: any) {
      toast.error(
        apiErrorMessage(e, "Couldn't delete the draft.", {
          ORDER_NOT_EDITABLE: "Only drafts can be deleted. An issued order has to be cancelled.",
          PURCHASE_ORDER_NOT_FOUND: "That purchase order no longer exists.",
        })
      );
      setDelOpen(false);
    } finally {
      setDelBusy(false);
    }
  };

  if (!allowed) {
    return (
      <Page title="Purchase order">
        <EmptyState icon="lock-closed-outline" title="No access" sub="Your role doesn't include purchases. Ask the store owner to grant it." />
      </Page>
    );
  }
  if (loading && !po) {
    return (
      <Page title="Purchase order">
        <View style={{ padding: 16, gap: 12 }}>
          <Skeleton h={110} />
          <Skeleton h={140} />
        </View>
      </Page>
    );
  }
  if (error || !po) {
    return (
      <Page title="Purchase order">
        <ErrorState message={error || "Purchase order not found."} onRetry={() => load()} />
      </Page>
    );
  }

  const status: string = po.status;
  const balance = balanceOf(po);
  const supplierName = po.supplier?.name || po.supplierName || "No supplier";
  const canReceive = status === "ORDERED" || status === "PARTIALLY_RECEIVED";
  const canPay = canReceive || status === "RECEIVED";
  const canCancel = canReceive && receipts.length === 0;

  return (
    <Page title={po.number || "Draft purchase order"}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <Card style={{ padding: 16, gap: 6 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
            <T w="semi" size={13} color={C.ink400} style={{ flex: 1 }} numberOfLines={1}>
              {supplierName} · {titleCase(status || "")}
            </T>
            <StatusPill status={status} />
          </View>
          <T w="display" size={30} style={{ letterSpacing: -0.5 }}>
            {fm(po.total, currency)}
          </T>
          <T w="semi" size={12.5} color={balance > 0 && status !== "DRAFT" && status !== "CANCELLED" ? C.gold600 : C.ink400}>
            {status === "DRAFT" ? "Draft. Issue it to stamp a PO number and freeze the lines." : status === "CANCELLED" ? "This order was cancelled." : `Owed ${fm(balance, currency)}`}
          </T>
        </Card>

        {status === "DRAFT" ? (
          <View style={{ gap: 10 }}>
            <Button label="Issue order" icon="send" onPress={issue} busy={actionBusy} />
            <View style={{ flexDirection: "row", gap: 10 }}>
              <Button label="Edit draft" icon="pencil" variant="outline" onPress={() => router.push(`/purchases/new?id=${po.id}`)} style={{ flex: 1 }} />
              <Button label="Delete draft" icon="trash-outline" variant="danger" onPress={() => setDelOpen(true)} style={{ flex: 1 }} />
            </View>
          </View>
        ) : null}

        {canPay ? (
          <View style={{ gap: 10 }}>
            {canReceive ? <Button label="Record delivery" icon="cube-outline" onPress={openReceive} /> : null}
            <Button label="Record payment" icon="cash-outline" variant={canReceive ? "outline" : "primary"} onPress={() => setPayOpen(true)} />
            {canCancel ? <Button label="Cancel order" variant="outline" onPress={() => setCancelOpen(true)} /> : null}
          </View>
        ) : null}

        <SectionTitle>Line items</SectionTitle>
        <Card style={{ paddingHorizontal: 14, paddingVertical: 4 }}>
          {lineItems.length === 0 ? (
            <T w="regular" size={13} color={C.ink400} style={{ paddingVertical: 14 }}>
              No line items.
            </T>
          ) : (
            lineItems.map((li, i) => {
              const remaining = remainingOf(li);
              return (
                <View key={li.id || i} style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12, borderBottomWidth: i === lineItems.length - 1 ? 0 : 1, borderBottomColor: C.cream100 }}>
                  <View style={{ flex: 1 }}>
                    <T w="bold" size={14} numberOfLines={2}>
                      {lineName(li)}
                    </T>
                    <T w="regular" size={12} color={C.ink400}>
                      {rawNum(li.quantity)} x {fm(li.unitCostAtOrder, currency)}
                    </T>
                    {status !== "DRAFT" ? (
                      <T w="semi" size={11.5} color={remaining <= 0 ? C.leaf500 : C.gold600}>
                        {rawNum(li.quantityReceived)} received · {Math.max(remaining, 0)} remaining
                      </T>
                    ) : null}
                  </View>
                  <Money v={rawNum(li.unitCostAtOrder) * rawNum(li.quantity)} currency={currency} size={14} />
                </View>
              );
            })
          )}
        </Card>

        <Card style={{ paddingHorizontal: 14, paddingVertical: 4 }}>
          <DetailRow label="Branch" value={po.branch?.name || "None"} />
          <DetailRow label="Expected" value={po.expectedDeliveryDate ? fd(po.expectedDeliveryDate) : "None"} />
          <DetailRow label="Issued" value={po.orderedAt ? fd(po.orderedAt) : "Not issued"} />
          <DetailRow label="Fully received" value={po.receivedAt ? fd(po.receivedAt) : "Not yet"} />
          <DetailRow label="Total" value={fm(po.total, currency)} strong />
          <DetailRow label="Paid" value={rawNum(po.amountPaid) > 0 ? fm(po.amountPaid, currency) : "None"} />
          <DetailRow label="Owed" value={fm(balance, currency)} strong />
        </Card>

        {po.notes ? (
          <View style={{ backgroundColor: C.gold100, borderRadius: 14, padding: 14 }}>
            <T w="semi" size={13} color={C.gold600}>
              {po.notes}
            </T>
          </View>
        ) : null}

        {payments.length > 0 ? (
          <>
            <SectionTitle>Payments</SectionTitle>
            <Card style={{ paddingHorizontal: 14, paddingVertical: 4 }}>
              {payments.map((p, i) => (
                <View key={p.id || i} style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 11, borderBottomWidth: i === payments.length - 1 ? 0 : 1, borderBottomColor: C.cream100 }}>
                  <T w="regular" size={12.5} color={C.ink500} style={{ flex: 1 }}>
                    {fd(p.createdAt)}
                    {p.note ? ` · ${p.note}` : ""}
                    {p.recordedByName ? ` · ${p.recordedByName}` : ""}
                  </T>
                  <Money v={p.amount} currency={currency} size={13.5} />
                </View>
              ))}
            </Card>
          </>
        ) : null}

        {receipts.length > 0 ? (
          <>
            <SectionTitle>Deliveries</SectionTitle>
            <Card style={{ paddingHorizontal: 14, paddingVertical: 4 }}>
              {receipts.map((r, i) => (
                <View key={r.id || i} style={{ paddingVertical: 11, borderBottomWidth: i === receipts.length - 1 ? 0 : 1, borderBottomColor: C.cream100 }}>
                  <T w="regular" size={12.5} color={C.ink500}>
                    {fd(r.createdAt)}
                    {r.note ? ` · ${r.note}` : ""}
                    {r.recordedByName ? ` · ${r.recordedByName}` : ""}
                  </T>
                </View>
              ))}
            </Card>
          </>
        ) : null}
      </ScrollView>

      <FormSheet
        open={receiveOpen}
        onClose={() => setReceiveOpen(false)}
        title="Record delivery"
        maxHeight={420}
        footer={
          <View style={{ flexDirection: "row", gap: 10 }}>
            <Button label="Cancel" variant="outline" onPress={() => setReceiveOpen(false)} disabled={recBusy} style={{ flex: 1 }} />
            <Button label="Save receipt" icon="checkmark" onPress={submitReceive} busy={recBusy} style={{ flex: 1.6 }} />
          </View>
        }
      >
        <T w="regular" size={13} color={C.ink400}>
          What actually arrived today. Stock moves into the branch as you save.
        </T>
        {lineItems.map((l) => {
          const remaining = remainingOf(l);
          if (remaining <= 0) return null;
          return (
            <View key={l.id} style={{ flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: C.cream100, borderRadius: 14, padding: 12 }}>
              <View style={{ flex: 1 }}>
                <T w="bold" size={13.5} numberOfLines={2}>
                  {lineName(l)}
                </T>
                <T w="regular" size={11.5} color={C.ink400}>
                  {rawNum(l.quantityReceived)}/{rawNum(l.quantity)} in · {remaining} to go
                </T>
              </View>
              <View style={{ width: 90 }}>
                <Input value={recQty[l.id] || ""} onChangeText={(v) => setRecQty((m) => ({ ...m, [l.id]: v.replace(/[^0-9]/g, "") }))} keyboardType="number-pad" placeholder="0" />
              </View>
            </View>
          );
        })}
        <Field label="Note">
          <Input value={recNote} onChangeText={setRecNote} placeholder="e.g. came in 2 boxes, one was dented" />
        </Field>
      </FormSheet>

      <PaymentSheet
        open={payOpen}
        onClose={() => setPayOpen(false)}
        title="Record supplier payment"
        balanceLabel="Owed"
        balance={balance}
        currency={currency}
        busy={payBusy}
        notePlaceholder="e.g. transfer ref"
        onSubmit={recordPayment}
      />

      <ConfirmSheet open={cancelOpen} onClose={() => setCancelOpen(false)} onConfirm={doCancel} busy={actionBusy} danger title="Cancel this purchase order?" message="Only possible while no deliveries have been recorded." confirmLabel="Cancel order" />
      <ConfirmSheet open={delOpen} onClose={() => setDelOpen(false)} onConfirm={doDelete} busy={delBusy} danger title="Delete this draft?" message="Issued orders can't be deleted. Cancel them instead." confirmLabel="Delete draft" />
    </Page>
  );
}
