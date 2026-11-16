import { useEffect, useState } from "react";
import { KeyboardAvoidingView, ScrollView, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useAuth } from "../../../src/context/AuthContext";
import { getAccess } from "../../../src/lib/access";
import { api } from "../../../src/lib/api";
import { apiErrorMessage, asList, rawNum } from "../../../src/lib/format";
import { EmptyState, ErrorState, Field, Input, Skeleton, T, toast } from "../../../src/components/ui";
import { Page, SelectField } from "../../../src/components/kit";
import {
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
import { C } from "../../../src/theme";

const costOf = (p: any) => p?.costPrice ?? p?.price;

export default function PurchaseOrderForm() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const editingId = id ? String(id) : null;
  const { me } = useAuth();
  const currency: string = (me.store as any)?.currency || "NGN";
  const allowed = getAccess(me).can("purchases");
  const { products, loading: productsLoading } = useProducts();

  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [supplierId, setSupplierId] = useState("");
  const [supplierName, setSupplierName] = useState("");
  const [branchId, setBranchId] = useState("");
  const [expected, setExpected] = useState("");
  const [notes, setNotes] = useState("");
  const [rows, setRows] = useState<LineRow[]>([newLine()]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const init = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [sRes, bRes, poRes] = await Promise.all([
        api.get("/api/dashboard/suppliers"),
        api.get("/api/dashboard/branches"),
        editingId ? api.get(`/api/dashboard/purchase-orders/${editingId}`) : Promise.resolve(null),
      ]);
      setSuppliers(asList(sRes, "items", "suppliers", "data").filter((s: any) => s.isActive !== false));
      const bl = asList(bRes, "items", "branches", "data");
      setBranches(bl);

      if (poRes) {
        const res: any = poRes;
        const d = res?.purchaseOrder ?? res;
        if (!d || d.status !== "DRAFT") {
          setLoadError("Only draft orders can be edited. An issued order can be received, paid, or cancelled.");
          return;
        }
        const lines: any[] = Array.isArray(res?.lineItems) ? res.lineItems : [];
        setSupplierId(d.supplier?.id || d.supplierId || "");
        setSupplierName(d.supplier?.name || "");
        setBranchId(d.branch?.id || d.branchId || "");
        setExpected(d.expectedDeliveryDate ? String(d.expectedDeliveryDate).slice(0, 10) : "");
        setNotes(d.notes || "");
        setRows(
          lines.length
            ? lines.map((l) =>
                newLine({
                  productId: l.productId || "",
                  productName: l.productName || l.product?.name || "",
                  variantId: l.variantId || "",
                  quantity: String(rawNum(l.quantity) || 1),
                  unitPrice: l.unitCostAtOrder != null ? String(l.unitCostAtOrder) : "",
                })
              )
            : [newLine()]
        );
      } else {
        setBranchId(bl[0]?.id || "");
      }
    } catch (e: any) {
      setLoadError(apiErrorMessage(e, "Couldn't load the form.", { PURCHASE_ORDER_NOT_FOUND: "That purchase order no longer exists." }));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (allowed) init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingId, allowed]);

  const total = linesTotal(rows);

  const submit = async () => {
    setErr("");
    if (!supplierId) return setErr("Pick a supplier.");
    if (!branchId) return setErr("Pick the branch the goods will land in.");
    const selected = rows.filter((r) => r.productId);
    if (!selected.length) return setErr("Add at least one line.");

    const lineItems: { productId: string; variantId?: string; quantity: number; unitCostAtOrder: string }[] = [];
    for (const r of selected) {
      const prod = products.find((p) => p.id === r.productId);
      const hasVariants = (prod?.variants?.length || 0) > 0;
      const label = prod?.name || r.productName || "that line";
      const qty = parseInt(cleanNum(r.quantity), 10);
      if (!Number.isInteger(qty) || qty < 1 || qty > MAX_QTY) return setErr(`Quantity for "${label}" must be a whole number between 1 and ${MAX_QTY.toLocaleString()}.`);
      const cost = parseFloat(cleanNum(r.unitPrice));
      if (!Number.isFinite(cost) || cost <= 0 || cost > MAX_MONEY || Math.round(cost * 100) !== cost * 100) {
        return setErr(`Unit cost for "${label}" must be greater than 0 with at most 2 decimal places.`);
      }
      if (hasVariants && !r.variantId) return setErr(`"${label}" has variants. Pick the exact variant you're ordering.`);
      lineItems.push({ productId: r.productId, variantId: hasVariants ? r.variantId : undefined, quantity: qty, unitCostAtOrder: String(cost) });
    }

    const d = parseDateInput(expected);
    if ("error" in d) return setErr(d.error);

    setBusy(true);
    try {
      const body = {
        supplierId,
        branchId,
        expectedDeliveryDate: "iso" in d ? d.iso : editingId ? null : undefined,
        notes: notes.trim() || undefined,
        lineItems,
      };
      if (editingId) {
        await api.put(`/api/dashboard/purchase-orders/${editingId}`, body);
        toast.success("Draft updated.");
        router.back();
      } else {
        const res: any = await api.post("/api/dashboard/purchase-orders", body);
        toast.success("Draft purchase order saved.");
        const newId = (res?.purchaseOrder ?? res)?.id;
        if (newId) router.replace(`/purchases/${newId}`);
        else router.back();
      }
    } catch (e: any) {
      setErr(
        apiErrorMessage(e, editingId ? "Couldn't update the purchase order." : "Couldn't create the purchase order.", {
          ORDER_NOT_EDITABLE: "This order has already been issued, so it can no longer be edited. Cancel it instead if it will never arrive.",
          SUPPLIER_NOT_FOUND: "That supplier no longer exists.",
          BRANCH_NOT_FOUND: "That branch no longer exists.",
          PRODUCT_NOT_FOUND: "One of the products no longer exists in this store.",
          VARIANT_NOT_FOUND: "One of the variants no longer exists. It may have been retired.",
          PURCHASE_ORDER_NOT_FOUND: "That purchase order no longer exists.",
        })
      );
    } finally {
      setBusy(false);
    }
  };

  const title = editingId ? "Edit draft order" : "New purchase order";

  if (!allowed) {
    return (
      <Page title={title}>
        <EmptyState icon="lock-closed-outline" title="No access" sub="Your role doesn't include purchases. Ask the store owner to grant it." />
      </Page>
    );
  }
  if (loadError) {
    return (
      <Page title={title}>
        <ErrorState message={loadError} onRetry={init} />
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

  // An inactive supplier is filtered from the list, but a draft that names one must still show it.
  const supplierOptions = suppliers.map((s) => ({ value: s.id, label: s.name }));
  if (supplierId && !suppliers.some((s) => s.id === supplierId)) supplierOptions.push({ value: supplierId, label: supplierName || "Current supplier" });

  return (
    <Page title={title}>
      <KeyboardAvoidingView behavior={KAV_BEHAVIOR} style={{ flex: 1 }}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 24 }}>
          <T w="regular" size={13} color={C.ink400}>
            Saved as a draft. Issuing stamps a PO number and freezes the lines; a draft can be changed freely.
          </T>
          <ErrorBanner message={err} />

          <SelectField label="Supplier" value={supplierId} placeholder="Choose a supplier…" options={supplierOptions} onChange={setSupplierId} hint={suppliers.length ? undefined : "No active suppliers. Add one from the Suppliers tab first."} />
          <SelectField label="Goods land in" value={branchId} placeholder="Choose a branch…" options={branches.map((b) => ({ value: b.id, label: b.name }))} onChange={setBranchId} />
          <DateField label="Expected delivery" value={expected} onChange={setExpected} />

          <LineEditor rows={rows} setRows={setRows} products={products} productsLoading={productsLoading} currency={currency} priceLabel="Unit cost" priceOf={costOf} withVariants />

          <Field label="Notes">
            <Input value={notes} onChangeText={setNotes} placeholder="Anything the supplier should know" />
          </Field>
        </ScrollView>
        <TotalBar label="Total cost" total={total} currency={currency} actionLabel={editingId ? "Save changes" : "Save draft"} busy={busy} onPress={submit} />
      </KeyboardAvoidingView>
    </Page>
  );
}
