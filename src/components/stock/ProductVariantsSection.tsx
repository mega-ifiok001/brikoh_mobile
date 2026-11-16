// Post-create variant management — port of the web ProductVariantsPanel:
//   PUT   /products/:id/options                      reconcile dimensions + regenerate the grid
//   POST  /products/:id/variants                     add one variant
//   PATCH /products/:id/variants/:variantId          rename / re-price / re-SKU
//   POST  /products/:id/variants/:variantId/archive|restore
// Variants are never hard-deleted (order/ledger history references them) — they are archived.
import { useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../lib/api";
import { apiErrorMessage, rawNum } from "../../lib/format";
import { Button, Card, Field, Input, Pill, Sheet, T, toast } from "../ui";
import { C } from "../../theme";

export const MAX_VARIANTS = 50;
export const MAX_OPTIONS = 2;
export const MAX_OPTION_NAME = 40;
const MAX_VARIANT_NAME = 80;
const MAX_SKU = 64;
const MAX_MONEY = 99999999.99;
const MAX_STOCK = 1_000_000;

interface DimDraft {
  key: number;
  name: string;
  values: string;
}

/** Split the comma-separated value box, trimming and de-duplicating case-insensitively. */
export function parseValues(raw: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of raw.split(",")) {
    const v = part.trim();
    if (!v) continue;
    const k = v.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(v);
  }
  return out;
}

const productOf = (res: any): any | null => res?.product ?? (res && res.id ? res : null);

/** null = clear the override, "invalid" = rejected, number = the value. */
function validPrice(raw: string): number | null | "invalid" {
  const t = raw.trim();
  if (!t) return null;
  const n = Number(t);
  if (!Number.isFinite(n) || n < 0 || n > MAX_MONEY || Math.round(n * 100) !== n * 100) return "invalid";
  return n;
}

const decimal = (t: string) => t.replace(/[^0-9.]/g, "");

function Err({ text }: { text: string }) {
  if (!text) return null;
  return (
    <View style={{ backgroundColor: C.danger100, borderRadius: 14, padding: 12 }}>
      <T w="bold" size={12.5} color={C.danger500}>
        {text}
      </T>
    </View>
  );
}

export default function ProductVariantsSection({
  product,
  currency,
  onChanged,
}: {
  product: any;
  currency: string;
  onChanged: (next: any) => void;
}) {
  const options: any[] = Array.isArray(product?.options) ? product.options : [];
  const variants: any[] = Array.isArray(product?.variants) ? product.variants : [];

  const dimSig = options.map((o: any) => `${o.name}[${(o.values || []).map((v: any) => v.value).join(",")}]`).join("|");

  const [dims, setDims] = useState<DimDraft[]>([]);
  const [dimErr, setDimErr] = useState("");
  const [dimBusy, setDimBusy] = useState(false);
  const [wipeArmed, setWipeArmed] = useState(false);

  const [addOpen, setAddOpen] = useState(false);
  const [nv, setNv] = useState({ name: "", sellingPrice: "", sku: "", initialStock: "" });
  const [nvOpts, setNvOpts] = useState<Record<string, string>>({});
  const [addBusy, setAddBusy] = useState(false);
  const [addErr, setAddErr] = useState("");

  const [editId, setEditId] = useState<string | null>(null);
  const [edit, setEdit] = useState({ name: "", sellingPrice: "", sku: "" });
  const [rowBusy, setRowBusy] = useState(false);
  const [archiveArmed, setArchiveArmed] = useState<string | null>(null);

  useEffect(() => {
    setDims(options.map((o: any, i: number) => ({ key: i, name: o.name || "", values: (o.values || []).map((v: any) => v.value).join(", ") })));
    setDimErr("");
    setWipeArmed(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dimSig, product?.id]);

  const cleanDims = dims.map((d) => ({ name: d.name.trim(), values: parseValues(d.values) })).filter((d) => d.name || d.values.length > 0);
  const gridSize = cleanDims.reduce((a, d) => a * Math.max(d.values.length, 1), cleanDims.length ? 1 : 0);

  const applyProduct = (res: any) => {
    const next = productOf(res);
    if (next) onChanged(next);
  };

  const saveDimensions = async () => {
    setDimErr("");
    if (cleanDims.length > MAX_OPTIONS) return setDimErr(`A product can have at most ${MAX_OPTIONS} dimensions.`);
    for (const d of cleanDims) {
      if (!d.name) return setDimErr("Every dimension needs a name — e.g. Colour or Size.");
      if (d.name.length > MAX_OPTION_NAME) return setDimErr(`"${d.name}" is too long — dimensions are ${MAX_OPTION_NAME} characters or fewer.`);
      if (d.values.length === 0) return setDimErr(`Add at least one value for "${d.name}".`);
      for (const v of d.values) {
        if (v.length > MAX_OPTION_NAME) return setDimErr(`The value "${v}" is too long — values are ${MAX_OPTION_NAME} characters or fewer.`);
      }
    }
    if (cleanDims.length === 0 && options.length > 0 && !wipeArmed) {
      setWipeArmed(true);
      return;
    }
    if (gridSize > MAX_VARIANTS) return setDimErr(`That grid works out at ${gridSize} variants — the limit is ${MAX_VARIANTS} per product.`);
    setDimBusy(true);
    try {
      const res: any = await api.put(`/api/dashboard/products/${product.id}/options`, { options: cleanDims });
      applyProduct(res);
      toast.success(cleanDims.length === 0 ? "Dimensions removed — every variant was archived." : "Options saved — the variant grid was reconciled.");
      setWipeArmed(false);
    } catch (e: any) {
      setDimErr(
        apiErrorMessage(e, "Couldn't save the options.", {
          VARIANT_LIMIT_REACHED: `That grid would exceed ${MAX_VARIANTS} variants.`,
          VALIDATION_ERROR: "The server rejected those dimensions — check for empty or duplicated values.",
          NOT_FOUND: "That product no longer exists.",
        })
      );
    } finally {
      setDimBusy(false);
    }
  };

  const addVariant = async () => {
    setAddErr("");
    const price = validPrice(nv.sellingPrice);
    if (price === "invalid") return setAddErr("Enter a valid selling price with at most 2 decimals.");
    if (nv.name.trim().length > MAX_VARIANT_NAME) return setAddErr(`Variant names are ${MAX_VARIANT_NAME} characters or fewer.`);
    if (nv.sku.trim().length > MAX_SKU) return setAddErr(`SKUs are ${MAX_SKU} characters or fewer.`);
    const stock = nv.initialStock.trim() ? Number(nv.initialStock) : null;
    if (stock != null && (!Number.isInteger(stock) || stock < 1 || stock > MAX_STOCK)) {
      return setAddErr(`Opening stock must be between 1 and ${MAX_STOCK.toLocaleString()}.`);
    }
    if (variants.length + 1 > MAX_VARIANTS) return setAddErr(`A product can have at most ${MAX_VARIANTS} variants.`);
    const optionValues = options.map((o: any) => ({ option: o.name, value: (nvOpts[o.name] || "").trim() })).filter((x) => x.value);
    setAddBusy(true);
    try {
      const body: Record<string, unknown> = {};
      if (nv.name.trim()) body.name = nv.name.trim();
      if (price != null) body.sellingPrice = price;
      if (nv.sku.trim()) body.sku = nv.sku.trim();
      if (stock != null) body.initialStock = stock;
      if (optionValues.length) body.optionValues = optionValues;
      const res: any = await api.post(`/api/dashboard/products/${product.id}/variants`, body);
      applyProduct(res);
      toast.success("Variant added.");
      setAddOpen(false);
      setNv({ name: "", sellingPrice: "", sku: "", initialStock: "" });
      setNvOpts({});
    } catch (e: any) {
      setAddErr(
        apiErrorMessage(e, "Couldn't add the variant.", {
          VARIANT_LIMIT_REACHED: `A product can have at most ${MAX_VARIANTS} variants.`,
          NOT_FOUND: "That product no longer exists.",
        })
      );
    } finally {
      setAddBusy(false);
    }
  };

  const startEdit = (v: any) => {
    setEditId(v.id);
    setEdit({ name: v.name || "", sellingPrice: v.sellingPrice != null ? String(v.sellingPrice) : "", sku: v.sku || "" });
  };

  const saveVariant = async () => {
    if (!editId) return;
    const price = validPrice(edit.sellingPrice);
    if (price === "invalid") return toast.error("Enter a valid selling price with at most 2 decimals.");
    setRowBusy(true);
    try {
      const res: any = await api.patch(`/api/dashboard/products/${product.id}/variants/${editId}`, {
        name: edit.name.trim() || undefined,
        sellingPrice: price, // null clears the override
        sku: edit.sku.trim() || null,
      });
      applyProduct(res);
      toast.success("Variant updated.");
      setEditId(null);
    } catch (e: any) {
      toast.error(apiErrorMessage(e, "Couldn't update the variant.", { VARIANT_NOT_FOUND: "That variant no longer exists.", NOT_FOUND: "That product no longer exists." }));
    } finally {
      setRowBusy(false);
    }
  };

  const setArchived = async (v: any, archived: boolean) => {
    setRowBusy(true);
    try {
      const res: any = await api.post(`/api/dashboard/products/${product.id}/variants/${v.id}/${archived ? "archive" : "restore"}`);
      applyProduct(res);
      toast.success(archived ? "Variant retired." : "Variant restored.");
      setArchiveArmed(null);
    } catch (e: any) {
      toast.error(apiErrorMessage(e, "Couldn't change the variant.", { VARIANT_NOT_FOUND: "That variant no longer exists.", NOT_FOUND: "That product no longer exists." }));
    } finally {
      setRowBusy(false);
    }
  };

  return (
    <View style={{ gap: 12 }}>
      {/* Dimensions */}
      <Card style={{ padding: 14, gap: 10 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
          <View style={{ flex: 1 }}>
            <T w="extra" size={14}>
              Option dimensions
            </T>
            <T w="regular" size={12} color={C.ink400}>
              Up to {MAX_OPTIONS}. Values are combined into the variant grid — Colour [Red, Blue] × Size [S, M] makes 4 variants.
            </T>
          </View>
          <Pill>{`${options.length}/${MAX_OPTIONS}`}</Pill>
        </View>
        <Err text={dimErr} />
        {wipeArmed ? (
          <View style={{ backgroundColor: C.gold100, borderRadius: 14, padding: 12 }}>
            <T w="semi" size={12} color={C.ink700}>
              Removing every dimension archives all {variants.length} variant{variants.length === 1 ? "" : "s"} and returns this product to a plain product. History and stock rows are kept. Press the button again to confirm.
            </T>
          </View>
        ) : null}
        {dims.map((d) => (
          <View key={d.key} style={{ gap: 6 }}>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Input
                style={{ flex: 1 }}
                value={d.name}
                maxLength={MAX_OPTION_NAME}
                placeholder="Colour"
                onChangeText={(t) => setDims((ds) => ds.map((x) => (x.key === d.key ? { ...x, name: t } : x)))}
              />
              <Pressable onPress={() => setDims((ds) => ds.filter((x) => x.key !== d.key))} hitSlop={8} style={{ width: 52, height: 52, borderRadius: 15, backgroundColor: C.danger100, alignItems: "center", justifyContent: "center" }}>
                <Ionicons name="trash-outline" size={18} color={C.danger500} />
              </Pressable>
            </View>
            <Input value={d.values} placeholder="Red, Blue" onChangeText={(t) => setDims((ds) => ds.map((x) => (x.key === d.key ? { ...x, values: t } : x)))} />
          </View>
        ))}
        {dims.length === 0 ? (
          <T w="regular" size={12} color={C.ink400}>
            No dimensions yet — add one to generate a variant grid, or add variants one at a time below.
          </T>
        ) : null}
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Button
            small
            variant="outline"
            icon="add"
            label="Add dimension"
            disabled={dims.length >= MAX_OPTIONS}
            onPress={() => setDims((ds) => [...ds, { key: Date.now(), name: "", values: "" }])}
          />
          <Button small label={wipeArmed ? "Yes, remove all" : "Save options"} variant={wipeArmed ? "danger" : "primary"} busy={dimBusy} onPress={saveDimensions} style={{ flex: 1 }} />
        </View>
        {gridSize > 0 ? (
          <T w="semi" size={11.5} color={gridSize > MAX_VARIANTS ? C.danger500 : C.ink400}>
            This grid makes {gridSize} variant{gridSize === 1 ? "" : "s"} (limit {MAX_VARIANTS}).
          </T>
        ) : null}
      </Card>

      {/* Variants */}
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <T w="display" size={16}>
          Variants ({variants.length})
        </T>
        <Button small variant="outline" icon="add" label="Add variant" onPress={() => { setAddErr(""); setAddOpen(true); }} />
      </View>
      {variants.length === 0 ? (
        <T w="regular" size={12.5} color={C.ink400}>
          No variants. Stock is held at product level.
        </T>
      ) : null}
      {variants.map((v: any) => {
        const archived = !!v.archivedAt;
        const vOpts: any[] = Array.isArray(v.options) ? v.options : [];
        return (
          <Card key={v.id} style={{ padding: 12, gap: 8, opacity: archived ? 0.7 : 1 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <View style={{ flex: 1 }}>
                <T w="bold" size={14} numberOfLines={1}>
                  {v.name}
                </T>
                <T w="regular" size={11.5} color={C.ink400} numberOfLines={1}>
                  {rawNum(v.quantity).toLocaleString()} in stock · {v.sellingPrice != null ? `${currency} ${v.sellingPrice}` : "Product price"}
                  {v.sku ? ` · ${v.sku}` : ""}
                </T>
                {vOpts.length ? (
                  <T w="regular" size={11} color={C.ink400} numberOfLines={1}>
                    {vOpts.map((o: any) => `${o.option ?? o.name}: ${o.value}`).join(" · ")}
                  </T>
                ) : null}
              </View>
              {archived ? <Pill tone="neutral">Retired</Pill> : null}
            </View>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Button small variant="outline" label="Edit" icon="create-outline" onPress={() => startEdit(v)} style={{ flex: 1 }} />
              {archived ? (
                <Button small variant="outline" label="Restore" busy={rowBusy} onPress={() => setArchived(v, false)} style={{ flex: 1 }} />
              ) : archiveArmed === v.id ? (
                <Button small variant="danger" label="Confirm retire" busy={rowBusy} onPress={() => setArchived(v, true)} style={{ flex: 1 }} />
              ) : (
                <Button small variant="outline" label="Retire" onPress={() => setArchiveArmed(v.id)} style={{ flex: 1 }} />
              )}
            </View>
          </Card>
        );
      })}

      {/* Add variant */}
      <Sheet open={addOpen} onClose={() => setAddOpen(false)} title="Add variant" footer={<Button label="Add variant" busy={addBusy} onPress={addVariant} />}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <ScrollView style={{ maxHeight: 440 }} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 18, gap: 12, paddingBottom: 8 }}>
            <Err text={addErr} />
            <Field label="Name" hint={options.length ? "Optional — leave blank to build it from the option values." : undefined}>
              <Input value={nv.name} onChangeText={(t) => setNv({ ...nv, name: t })} maxLength={MAX_VARIANT_NAME} placeholder={options.length ? "Red / M" : "1 Litre"} />
            </Field>
            {options.map((o: any) => (
              <Field key={o.name} label={o.name}>
                <Input value={nvOpts[o.name] || ""} onChangeText={(t) => setNvOpts({ ...nvOpts, [o.name]: t })} placeholder={(o.values || []).map((x: any) => x.value).slice(0, 3).join(", ")} />
              </Field>
            ))}
            <Field label={`Selling price (${currency})`} hint="Optional — blank uses the product price.">
              <Input value={nv.sellingPrice} onChangeText={(t) => setNv({ ...nv, sellingPrice: decimal(t) })} keyboardType="decimal-pad" placeholder="0.00" />
            </Field>
            <Field label="SKU" hint={`Up to ${MAX_SKU} characters.`}>
              <Input value={nv.sku} onChangeText={(t) => setNv({ ...nv, sku: t })} maxLength={MAX_SKU} autoCapitalize="characters" />
            </Field>
            <Field label="Opening stock" hint={`Optional, 1 – ${MAX_STOCK.toLocaleString()}.`}>
              <Input value={nv.initialStock} onChangeText={(t) => setNv({ ...nv, initialStock: t.replace(/[^0-9]/g, "") })} keyboardType="number-pad" placeholder="0" />
            </Field>
          </ScrollView>
        </KeyboardAvoidingView>
      </Sheet>

      {/* Edit variant */}
      <Sheet open={!!editId} onClose={() => setEditId(null)} title="Edit variant" footer={<Button label="Save variant" busy={rowBusy} onPress={saveVariant} />}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <ScrollView style={{ maxHeight: 400 }} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 18, gap: 12, paddingBottom: 8 }}>
            <Field label="Name">
              <Input value={edit.name} onChangeText={(t) => setEdit({ ...edit, name: t })} maxLength={MAX_VARIANT_NAME} />
            </Field>
            <Field label={`Price (${currency})`} hint="Blank clears the override — the variant falls back to the product price.">
              <Input value={edit.sellingPrice} onChangeText={(t) => setEdit({ ...edit, sellingPrice: decimal(t) })} keyboardType="decimal-pad" placeholder="Product price" />
            </Field>
            <Field label="SKU">
              <Input value={edit.sku} onChangeText={(t) => setEdit({ ...edit, sku: t })} maxLength={MAX_SKU} autoCapitalize="characters" />
            </Field>
          </ScrollView>
        </KeyboardAvoidingView>
      </Sheet>
    </View>
  );
}
