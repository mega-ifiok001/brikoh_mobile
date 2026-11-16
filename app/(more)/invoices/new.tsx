import { useEffect, useState } from "react";
import { KeyboardAvoidingView, ScrollView, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useAuth } from "../../../src/context/AuthContext";
import { getAccess } from "../../../src/lib/access";
import { api } from "../../../src/lib/api";
import { apiErrorMessage, rawNum, toISODate } from "../../../src/lib/format";
import { EmptyState, ErrorState, Field, Input, Skeleton, T, toast } from "../../../src/components/ui";
import { Page } from "../../../src/components/kit";
import {
  CustomerPickerSheet,
  DateField,
  ErrorBanner,
  KAV_BEHAVIOR,
  LineEditor,
  MAX_MONEY,
  MAX_QTY,
  TotalBar,
  cleanNum,
  linesTotal,
  newLine,
  parseDateInput,
  useProducts,
  type LineRow,
} from "../../../src/components/invoices/shared";
import { Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { C } from "../../../src/theme";

const priceOf = (p: any) => p?.discountPrice ?? p?.price;

export default function InvoiceForm() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const editingId = id ? String(id) : null;
  const { me } = useAuth();
  const currency: string = (me.store as any)?.currency || "NGN";
  const allowed = getAccess(me).can("invoices");
  const { products, loading: productsLoading } = useProducts();

  const [customer, setCustomer] = useState<{ id: string; name: string } | null>(null);
  const [pickCustomer, setPickCustomer] = useState(false);
  const [dueDate, setDueDate] = useState("");
  const [rows, setRows] = useState<LineRow[]>([newLine()]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(!!editingId);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadDraft = async () => {
    if (!editingId) return;
    setLoading(true);
    setLoadError(null);
    try {
      const res: any = await api.get(`/api/dashboard/invoices/${editingId}`);
      const inv = res?.invoice ?? res;
      const lis: any[] = Array.isArray(res?.lineItems) ? res.lineItems : inv?.lineItems || [];
      if (inv?.status && inv.status !== "DRAFT") {
        setLoadError("This invoice is no longer a draft and can't be edited.");
        return;
      }
      setCustomer({ id: inv.customer?.id || inv.customerId || "", name: inv.customer?.name || inv.customerName || "Customer" });
      setDueDate(inv.dueDate ? String(inv.dueDate).slice(0, 10) : "");
      setRows(
        lis.length
          ? lis.map((li) =>
              newLine({
                productId: li.productId,
                productName: li.productName || li.product?.name || "",
                quantity: String(rawNum(li.quantity) || 1),
                unitPrice: String(li.unitPriceAtIssue ?? ""),
              })
            )
          : [newLine()]
      );
    } catch (e: any) {
      setLoadError(apiErrorMessage(e, "Couldn't open the invoice."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDraft();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingId]);

  const total = linesTotal(rows);

  const submit = async () => {
    const cleaned = rows.filter((r) => r.productId);
    if (!cleaned.length) return setErr("Add at least one line.");
    for (const r of cleaned) {
      const qty = parseInt(cleanNum(r.quantity), 10);
      const price = parseFloat(cleanNum(r.unitPrice));
      if (!Number.isInteger(qty) || qty < 1 || qty > MAX_QTY) return setErr(`Quantity must be between 1 and ${MAX_QTY.toLocaleString()}.`);
      if (!(price > 0) || price > MAX_MONEY) return setErr(`Price must be greater than 0 and at most ${MAX_MONEY.toLocaleString()}.`);
    }
    if (!editingId && !customer?.id) return setErr("Pick a customer.");
    const d = parseDateInput(dueDate);
    if ("error" in d) return setErr(d.error);
    const lineItems = cleaned.map((r) => ({
      productId: r.productId,
      quantity: parseInt(cleanNum(r.quantity), 10),
      unitPriceAtIssue: String(parseFloat(cleanNum(r.unitPrice))),
    }));
    const dueIso = "iso" in d ? d.iso : editingId ? null : undefined; // PUT allows explicit null to clear

    setBusy(true);
    setErr("");
    try {
      if (editingId) {
        await api.put(`/api/dashboard/invoices/${editingId}`, { dueDate: dueIso, lineItems });
        toast.success("Draft updated.");
        router.back();
      } else {
        const res: any = await api.post("/api/dashboard/invoices", { customerId: customer!.id, dueDate: dueIso, lineItems });
        toast.success("Draft invoice saved. Issue it when you're ready.");
        const newId = (res?.invoice ?? res)?.id;
        if (newId) router.replace(`/invoices/${newId}`);
        else router.back();
      }
    } catch (e: any) {
      setErr(
        apiErrorMessage(e, editingId ? "Couldn't update the invoice." : "Couldn't create the invoice.", {
          INVOICE_NOT_DRAFT: "This invoice is no longer a draft and can't be edited.",
          PRODUCT_NOT_FOUND: "One of the selected products no longer exists.",
          CUSTOMER_NOT_FOUND: "That customer no longer exists.",
        })
      );
    } finally {
      setBusy(false);
    }
  };

  const title = editingId ? "Edit draft" : "New invoice";

  if (!allowed) {
    return (
      <Page title={title}>
        <EmptyState icon="lock-closed-outline" title="No access" sub="Your role doesn't include invoices. Ask the store owner to grant it." />
      </Page>
    );
  }
  if (loadError) {
    return (
      <Page title={title}>
        <ErrorState message={loadError} onRetry={loadDraft} />
      </Page>
    );
  }
  if (loading) {
    return (
      <Page title={title}>
        <View style={{ padding: 16, gap: 12 }}>
          <Skeleton h={60} />
          <Skeleton h={160} />
        </View>
      </Page>
    );
  }

  return (
    <Page title={title}>
      <KeyboardAvoidingView behavior={KAV_BEHAVIOR} style={{ flex: 1 }}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 24 }}>
          <T w="regular" size={13} color={C.ink400}>
            {editingId ? "Line items and due date only. The customer can't be changed on a draft." : "Saved as a draft. Issue it to stamp a number."}
          </T>
          <ErrorBanner message={err} />

          <Field label="Customer">
            <Pressable
              disabled={!!editingId}
              onPress={() => setPickCustomer(true)}
              style={{ height: 48, borderRadius: 14, backgroundColor: editingId ? C.cream100 : C.white, borderWidth: 1.5, borderColor: C.cream300, flexDirection: "row", alignItems: "center", paddingHorizontal: 12, gap: 8 }}
            >
              <T w="semi" size={14} color={customer ? C.ink900 : C.ink300} style={{ flex: 1 }} numberOfLines={1}>
                {customer?.name || "Choose a customer…"}
              </T>
              {!editingId ? <Ionicons name="chevron-down" size={16} color={C.ink400} /> : null}
            </Pressable>
          </Field>

          <DateField label="Due date" value={dueDate} onChange={setDueDate} />

          <LineEditor rows={rows} setRows={setRows} products={products} productsLoading={productsLoading} currency={currency} priceLabel="Price" priceOf={priceOf} />
        </ScrollView>
        <TotalBar label="Total" total={total} currency={currency} actionLabel={editingId ? "Save changes" : "Save draft"} busy={busy} onPress={submit} />
      </KeyboardAvoidingView>

      <CustomerPickerSheet
        open={pickCustomer}
        onClose={() => setPickCustomer(false)}
        onPick={(c) => {
          setCustomer(c);
          setPickCustomer(false);
        }}
      />
    </Page>
  );
}
