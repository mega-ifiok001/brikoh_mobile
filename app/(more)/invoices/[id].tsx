import { useCallback, useEffect, useState } from "react";
import { Linking, Pressable, ScrollView, Share, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useAuth } from "../../../src/context/AuthContext";
import { getAccess } from "../../../src/lib/access";
import { api } from "../../../src/lib/api";
import { apiErrorMessage, fd, fm, rawNum } from "../../../src/lib/format";
import { Button, Card, EmptyState, ErrorState, Money, Skeleton, StatusPill, T, toast } from "../../../src/components/ui";
import { ConfirmSheet, DetailRow, Page, SectionTitle, SwitchRow } from "../../../src/components/kit";
import { PaymentSheet, balanceOf, normalizeShareUrl, useRefreshOnFocus } from "../../../src/components/invoices/shared";
import { C } from "../../../src/theme";

export default function InvoiceDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { me } = useAuth();
  const currency: string = (me.store as any)?.currency || "NGN";
  const allowed = getAccess(me).can("invoices");

  const [inv, setInv] = useState<any | null>(null);
  const [lineItems, setLineItems] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [actionBusy, setActionBusy] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [payBusy, setPayBusy] = useState(false);
  const [voidOpen, setVoidOpen] = useState(false);
  const [delOpen, setDelOpen] = useState(false);
  const [delBusy, setDelBusy] = useState(false);
  const [linkOffOpen, setLinkOffOpen] = useState(false);
  const [linkBusy, setLinkBusy] = useState(false);

  const load = useCallback(
    async (quiet = false) => {
      if (!quiet) setLoading(true);
      setError(null);
      try {
        const res: any = await api.get(`/api/dashboard/invoices/${id}`);
        const i = res?.invoice ?? res;
        setInv(i);
        setLineItems(Array.isArray(res?.lineItems) ? res.lineItems : i?.lineItems || []);
        setPayments(Array.isArray(res?.payments) ? res.payments : i?.payments || []);
      } catch (e: any) {
        setError(apiErrorMessage(e, "Couldn't open the invoice."));
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
      await api.post(`/api/dashboard/invoices/${id}/issue`);
      toast.success("Invoice issued.");
      load(true);
    } catch (e: any) {
      toast.error(apiErrorMessage(e, "Couldn't issue the invoice.", { INVOICE_NOT_DRAFT: "This invoice has already been issued." }));
    } finally {
      setActionBusy(false);
    }
  };

  const recordPayment = async (amount: string, note: string) => {
    setPayBusy(true);
    try {
      const res: any = await api.post(`/api/dashboard/invoices/${id}/payments`, { amount, note: note || undefined });
      toast.success(res?.status === "PAID" ? "Payment recorded. Invoice fully paid." : "Payment recorded.");
      setPayOpen(false);
      load(true);
    } catch (e: any) {
      toast.error(
        apiErrorMessage(e, "Couldn't record the payment.", {
          PAYMENT_EXCEEDS_BALANCE: "Amount exceeds the remaining balance.",
          INVOICE_NOT_ISSUED: "Only issued invoices can receive payments.",
        })
      );
    } finally {
      setPayBusy(false);
    }
  };

  const doVoid = async () => {
    setActionBusy(true);
    try {
      await api.post(`/api/dashboard/invoices/${id}/void`);
      toast.success("Invoice voided.");
      setVoidOpen(false);
      load(true);
    } catch (e: any) {
      toast.error(
        apiErrorMessage(e, "Couldn't void the invoice.", {
          INVOICE_HAS_PAYMENTS: "Invoices with payments can't be voided.",
          INVOICE_NOT_ISSUED: "Only issued invoices can be voided.",
        })
      );
    } finally {
      setActionBusy(false);
    }
  };

  const doDelete = async () => {
    setDelBusy(true);
    try {
      await api.del(`/api/dashboard/invoices/${id}`);
      toast.success("Draft deleted.");
      setDelOpen(false);
      router.back();
    } catch (e: any) {
      toast.error(apiErrorMessage(e, "Couldn't delete the invoice.", { INVOICE_NOT_DRAFT: "Only draft invoices can be deleted. Issued invoices must be voided." }));
    } finally {
      setDelBusy(false);
    }
  };

  const setLinkEnabled = async (enabled: boolean) => {
    setLinkBusy(true);
    try {
      const res: any = await api.post(`/api/dashboard/invoices/${id}/${enabled ? "enable-link" : "disable-link"}`);
      const i = res?.invoice ?? res;
      if (i?.id) setInv(i);
      toast.success(enabled ? "Customer link is live again." : "Customer link turned off.");
      setLinkOffOpen(false);
    } catch (e: any) {
      toast.error(
        apiErrorMessage(e, "Couldn't change the customer link.", {
          INVOICE_NOT_ISSUED: "Only issued invoices have a link to toggle.",
          INVOICE_NOT_FOUND: "That invoice no longer exists.",
        })
      );
    } finally {
      setLinkBusy(false);
    }
  };

  const shareUrl = normalizeShareUrl(inv?.shareUrl);
  const shareLink = async () => {
    if (!shareUrl) return;
    try {
      await Share.share({ message: `Invoice ${inv?.number || ""}: ${shareUrl}`.replace("  ", " "), url: shareUrl });
    } catch {
      toast.error("Couldn't open the share sheet.");
    }
  };

  if (!allowed) {
    return (
      <Page title="Invoice">
        <EmptyState icon="lock-closed-outline" title="No access" sub="Your role doesn't include invoices. Ask the store owner to grant it." />
      </Page>
    );
  }
  if (loading && !inv) {
    return (
      <Page title="Invoice">
        <View style={{ padding: 16, gap: 12 }}>
          <Skeleton h={110} />
          <Skeleton h={140} />
        </View>
      </Page>
    );
  }
  if (error || !inv) {
    return (
      <Page title="Invoice">
        <ErrorState message={error || "Invoice not found."} onRetry={() => load()} />
      </Page>
    );
  }

  const paid = rawNum(inv.amountPaid);
  const balance = balanceOf(inv);
  const custName = inv.customer?.name || inv.customerName || "No customer";
  const linkOn = inv.linkEnabled !== false;

  return (
    <Page title={inv.number || "Draft invoice"}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <Card style={{ padding: 16, gap: 6 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <T w="semi" size={13} color={C.ink400} style={{ flex: 1 }} numberOfLines={1}>
              {custName} · {fd(inv.issuedAt || inv.createdAt)}
            </T>
            <StatusPill status={inv.status} />
          </View>
          <T w="display" size={30} style={{ letterSpacing: -0.5 }}>
            {fm(inv.total, currency)}
          </T>
          <T w="semi" size={12.5} color={balance > 0 && inv.status === "ISSUED" ? C.gold600 : C.ink400}>
            {inv.status === "PAID" ? "Fully paid" : inv.status === "VOID" ? "This invoice has been voided." : `Balance ${fm(balance, currency)}`}
          </T>
        </Card>

        {inv.status === "DRAFT" ? (
          <View style={{ gap: 10 }}>
            <Button label="Issue invoice" icon="send" onPress={issue} busy={actionBusy} />
            <View style={{ flexDirection: "row", gap: 10 }}>
              <Button label="Edit" icon="pencil" variant="outline" onPress={() => router.push(`/invoices/new?id=${inv.id}`)} style={{ flex: 1 }} />
              <Button label="Delete draft" icon="trash-outline" variant="danger" onPress={() => setDelOpen(true)} style={{ flex: 1 }} />
            </View>
          </View>
        ) : null}

        {inv.status === "ISSUED" ? (
          <View style={{ gap: 10 }}>
            <Button label="Record payment" icon="cash-outline" onPress={() => setPayOpen(true)} />
            <Button label="Void invoice" variant="outline" disabled={paid > 0} onPress={() => setVoidOpen(true)} />
            {paid > 0 ? (
              <T w="regular" size={12} color={C.ink400} style={{ textAlign: "center" }}>
                Invoices with payments can't be voided.
              </T>
            ) : null}
          </View>
        ) : null}

        {inv.status !== "DRAFT" ? (
          <Card style={{ padding: 14, gap: 8 }}>
            <T w="bold" size={11} color={C.ink400} style={{ textTransform: "uppercase", letterSpacing: 0.8 }}>
              Customer link
            </T>
            {shareUrl ? (
              <T w="semi" size={13} color={C.ink500} numberOfLines={2} selectable>
                {shareUrl}
              </T>
            ) : (
              <T w="semi" size={13} color={C.ink500}>
                Turned off. The public link now looks like an unknown invoice.
              </T>
            )}
            {shareUrl ? (
              <View style={{ flexDirection: "row", gap: 10 }}>
                <Button label="Share" icon="share-outline" small variant="outline" onPress={shareLink} style={{ flex: 1 }} />
                <Button label="Open" icon="open-outline" small variant="outline" onPress={() => Linking.openURL(shareUrl).catch(() => toast.error("Couldn't open the link."))} style={{ flex: 1 }} />
              </View>
            ) : null}
            <SwitchRow
              label="Link on"
              sub={!linkOn ? "Nothing financial changed. The invoice is still payable and still lists here." : undefined}
              value={linkOn}
              onChange={(v) => {
                if (linkBusy) return;
                if (v) setLinkEnabled(true);
                else setLinkOffOpen(true);
              }}
            />
          </Card>
        ) : null}

        <SectionTitle>Line items</SectionTitle>
        <Card style={{ paddingHorizontal: 14, paddingVertical: 4 }}>
          {lineItems.length === 0 ? (
            <T w="regular" size={13} color={C.ink400} style={{ paddingVertical: 14 }}>
              No line items.
            </T>
          ) : (
            lineItems.map((li: any, i: number) => (
              <View key={li.id || i} style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12, borderBottomWidth: i === lineItems.length - 1 ? 0 : 1, borderBottomColor: C.cream100 }}>
                <View style={{ flex: 1 }}>
                  <T w="bold" size={14} numberOfLines={2}>
                    {li.productName || li.product?.name || "Item"}
                  </T>
                  <T w="regular" size={12} color={C.ink400}>
                    {rawNum(li.quantity)} x {fm(li.unitPriceAtIssue, currency)}
                  </T>
                </View>
                <Money v={li.lineTotal ?? rawNum(li.unitPriceAtIssue) * rawNum(li.quantity)} currency={currency} size={14} />
              </View>
            ))
          )}
        </Card>

        <Card style={{ paddingHorizontal: 14, paddingVertical: 4 }}>
          <DetailRow label="Due date" value={inv.dueDate ? fd(inv.dueDate) : "None"} />
          <DetailRow label="Issued" value={inv.issuedAt ? fd(inv.issuedAt) : "Not issued"} />
          <DetailRow label="Total" value={fm(inv.total, currency)} strong />
          <DetailRow label="Amount paid" value={paid > 0 ? fm(paid, currency) : "None"} />
          <DetailRow label="Balance" value={fm(balance, currency)} strong />
        </Card>

        {payments.length > 0 ? (
          <>
            <SectionTitle>Payments</SectionTitle>
            <Card style={{ paddingHorizontal: 14, paddingVertical: 4 }}>
              {payments.map((p: any, i: number) => (
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
      </ScrollView>

      <PaymentSheet open={payOpen} onClose={() => setPayOpen(false)} title="Record payment" balanceLabel="Balance" balance={balance} currency={currency} busy={payBusy} onSubmit={recordPayment} />

      <ConfirmSheet open={voidOpen} onClose={() => setVoidOpen(false)} onConfirm={doVoid} busy={actionBusy} danger title="Void this invoice?" message="Voiding cancels the invoice. Invoices with recorded payments can't be voided." confirmLabel="Void invoice" />
      <ConfirmSheet
        open={linkOffOpen}
        onClose={() => setLinkOffOpen(false)}
        onConfirm={() => setLinkEnabled(false)}
        busy={linkBusy}
        title="Turn the customer link off?"
        message="The public link stops working immediately and looks like an unknown invoice. Nothing else changes: the invoice stays payable, keeps its payments, and you can switch the link back on at any time."
        confirmLabel="Turn link off"
      />
      <ConfirmSheet open={delOpen} onClose={() => setDelOpen(false)} onConfirm={doDelete} busy={delBusy} danger title="Delete this draft?" message="Only drafts can be deleted. Issued invoices must be voided instead." confirmLabel="Delete draft" />
    </Page>
  );
}
