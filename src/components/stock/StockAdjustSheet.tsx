// Signed stock movement — port of the web StockAdjustModal
// (`POST /api/dashboard/products/:productId/stock-adjustments`).
// SALE is deliberately not offered: sale movements originate from order fulfilment only.
import { useEffect, useMemo, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
import { api } from "../../lib/api";
import { apiErrorMessage, rawNum, titleCase } from "../../lib/format";
import { Button, Field, Input, Sheet, T, toast } from "../ui";
import { Segmented, SelectField } from "../kit";
import { C } from "../../theme";

const REASONS = ["MANUAL_ADJUSTMENT", "RESTOCK", "REFUND", "WRITE_OFF"] as const;
type Reason = (typeof REASONS)[number];

const REASON_HINT: Record<Reason, string> = {
  MANUAL_ADJUSTMENT: "Correcting the count after a physical stock take.",
  RESTOCK: "Stock arriving outside a purchase order.",
  REFUND: "Goods a customer brought back, going onto the shelf again.",
  WRITE_OFF: "Damaged, expired or lost stock leaving the shelf.",
};

const MAX_QTY = 1_000_000;

function defaultBranchId(branches: any[]): string {
  return branches.find((b: any) => b.isDefault)?.id || branches[0]?.id || "";
}

export default function StockAdjustSheet({
  open,
  onClose,
  product,
  branches,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  product: any | null;
  branches: any[];
  onDone?: (result: any) => void;
}) {
  const [branchId, setBranchId] = useState("");
  const [variantId, setVariantId] = useState("");
  const [mode, setMode] = useState<"add" | "remove">("add");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState<Reason>("MANUAL_ADJUSTMENT");
  const [referenceId, setReferenceId] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const variants: any[] = useMemo(() => (Array.isArray(product?.variants) ? product.variants : []), [product]);
  const hasVariants = variants.length > 0;

  useEffect(() => {
    if (!open) return;
    setBranchId(defaultBranchId(branches));
    setVariantId("");
    setMode("add");
    setAmount("");
    setReason("MANUAL_ADJUSTMENT");
    setReferenceId("");
    setErr("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, product?.id]);

  useEffect(() => {
    if (open && !branchId && branches.length > 0) setBranchId(defaultBranchId(branches));
  }, [open, branchId, branches]);

  const selectedVariant = variants.find((v: any) => v.id === variantId) || null;
  const currentQty = hasVariants ? rawNum(selectedVariant?.quantity) : rawNum(product?.quantity);
  const targetPicked = !hasVariants || !!variantId;
  const signed = (parseInt(amount, 10) || 0) * (mode === "remove" ? -1 : 1);

  const submit = async () => {
    if (!product?.id) return;
    if (!branchId) return setErr("Pick the branch this movement happens in.");
    const abs = parseInt(amount, 10);
    if (!Number.isInteger(abs) || abs < 1 || abs > MAX_QTY) {
      return setErr(`Enter a whole number between 1 and ${MAX_QTY.toLocaleString()}.`);
    }
    if (hasVariants && !variantId) {
      return setErr("This product has variants, so it has no product-level stock — pick the variant that moved.");
    }
    setBusy(true);
    setErr("");
    try {
      const body: Record<string, unknown> = { branchId, quantityChange: signed, reason };
      if (hasVariants) body.variantId = variantId;
      if (referenceId.trim()) body.referenceId = referenceId.trim();
      const res: any = await api.post(`/api/dashboard/products/${product.id}/stock-adjustments`, body);
      toast.success(`Stock updated — that branch now holds ${rawNum(res?.branchStockAfter).toLocaleString()}.`);
      onDone?.(res);
      onClose();
    } catch (e: any) {
      setErr(
        apiErrorMessage(e, "Couldn't adjust the stock.", {
          INSUFFICIENT_STOCK: "That would drive the branch's stock below zero, so nothing was changed.",
          VARIANT_REQUIRED: "This product has variants — pick the variant that moved.",
          INVALID_STOCK_REASON: "That reason can't be used here. Sales only enter stock through the order flow.",
          BRANCH_NOT_FOUND: "That branch no longer exists.",
          VARIANT_NOT_FOUND: "That variant no longer exists.",
          NOT_FOUND: "That product no longer exists.",
        })
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Adjust stock"
      footer={
        <Button
          label={mode === "remove" ? "Remove stock" : "Add stock"}
          icon={mode === "remove" ? "remove" : "add"}
          variant={mode === "remove" ? "danger" : "primary"}
          busy={busy}
          onPress={submit}
        />
      }
    >
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView style={{ maxHeight: 460 }} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 18, gap: 14, paddingBottom: 8 }}>
          {product?.name ? (
            <T w="bold" size={13} color={C.ink500} numberOfLines={1}>
              {product.name}
            </T>
          ) : null}
          {err ? (
            <View style={{ backgroundColor: C.danger100, borderRadius: 14, padding: 12 }}>
              <T w="bold" size={12.5} color={C.danger500}>
                {err}
              </T>
            </View>
          ) : null}

          <View style={{ backgroundColor: C.cream50, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: C.cream200 }}>
            <T w="bold" size={11} color={C.ink400}>
              {(hasVariants ? selectedVariant?.name || "No variant picked yet" : "Product stock").toUpperCase()}
            </T>
            <T w="display" size={22} style={{ marginTop: 2 }}>
              {currentQty.toLocaleString()}
            </T>
            <T w="regular" size={11.5} color={C.ink400} style={{ marginTop: 2 }}>
              {hasVariants ? "in this variant" : "cached product total"}. Stock is tracked per branch — the server returns the named branch's own count after the move.
            </T>
          </View>

          <SelectField
            label="Branch"
            value={branchId}
            onChange={setBranchId}
            placeholder={branches.length === 0 ? "No branches yet" : "Pick a branch"}
            options={branches.map((b: any) => ({ value: b.id, label: b.name, sub: b.isDefault ? "Default" : undefined }))}
          />

          {hasVariants ? (
            <SelectField
              label="Variant"
              value={variantId}
              onChange={setVariantId}
              placeholder="Pick a variant…"
              hint="Retired (archived) variants still hold real stock, so they can still be adjusted — e.g. to write stock off."
              options={variants.map((v: any) => ({
                value: v.id,
                label: `${v.name}${v.archivedAt ? " (archived)" : ""}`,
                sub: `${rawNum(v.quantity).toLocaleString()} in stock`,
              }))}
            />
          ) : null}

          <Field label="Direction">
            <Segmented
              options={[
                { value: "add", label: "Add" },
                { value: "remove", label: "Remove" },
              ]}
              value={mode}
              onChange={(v) => setMode(v as "add" | "remove")}
            />
          </Field>

          <Field label="Quantity" hint={`1 – ${MAX_QTY.toLocaleString()}`}>
            <Input value={amount} onChangeText={(t) => setAmount(t.replace(/[^0-9]/g, ""))} keyboardType="number-pad" placeholder="e.g. 12" />
          </Field>

          {signed !== 0 && branchId && targetPicked ? (
            <T w="semi" size={12} color={C.ink500}>
              {mode === "add" ? "Adding" : "Removing"} {Math.abs(signed).toLocaleString()} → about {(currentQty + signed).toLocaleString()} (the exact per-branch figure is returned by the server)
            </T>
          ) : null}

          <SelectField
            label="Reason"
            value={reason}
            onChange={(v) => setReason(v as Reason)}
            hint={REASON_HINT[reason]}
            options={REASONS.map((r) => ({ value: r, label: titleCase(r) }))}
          />

          <Field label="Reference" hint="Optional — a free-form pointer to whatever caused this, e.g. a purchase order id or a note.">
            <Input value={referenceId} onChangeText={setReferenceId} placeholder="Optional" />
          </Field>
        </ScrollView>
      </KeyboardAvoidingView>
    </Sheet>
  );
}
