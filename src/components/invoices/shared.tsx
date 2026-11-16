// Pieces shared by the Invoices and Purchases screens: form sheet, date field,
// payment sheet, product / customer pickers, the line-item editor and a few helpers.
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Pressable, ScrollView, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../lib/api";
import { apiErrorMessage, asList, fm, pick, rawNum, toISODate } from "../../lib/format";
import { Button, Card, Chip, Field, Input, Money, SearchBar, Sheet, T, tap, toast } from "../ui";
import { SelectField } from "../kit";
import { C } from "../../theme";

export const MAX_QTY = 1_000_000;
export const MAX_MONEY = 99999999.99;
export const KAV_BEHAVIOR = "padding" as const;

/* --------------------------------- Helpers -------------------------------- */

/** Re-run `fn` whenever the screen regains focus (but not on first mount). */
export function useRefreshOnFocus(fn: () => void) {
  const ref = useRef(fn);
  ref.current = fn;
  const first = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (first.current) {
        first.current = false;
        return;
      }
      ref.current();
    }, [])
  );
}

/** The backend builds shareUrl from an env origin; fall back to https:// if the scheme is missing. */
export function normalizeShareUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

/** Strip thousands separators / spaces from a typed number. */
export const cleanNum = (s: string) => s.replace(/[,\s]/g, "");

/** Validate a YYYY-MM-DD string. Returns the ISO timestamp the API expects (UTC midnight). */
export function parseDateInput(s: string): { empty: true } | { iso: string } | { error: string } {
  const v = s.trim();
  if (!v) return { empty: true };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return { error: "Use the date format YYYY-MM-DD." };
  const d = new Date(`${v}T00:00:00.000Z`);
  if (isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== v) return { error: "That date doesn't exist." };
  return { iso: d.toISOString() };
}

export function ErrorBanner({ message }: { message: string }) {
  if (!message) return null;
  return (
    <View style={{ backgroundColor: C.danger100, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10 }}>
      <T w="bold" size={13} color={C.danger500}>
        {message}
      </T>
    </View>
  );
}

/* -------------------------------- FormSheet -------------------------------- */

/** Bottom sheet that stays above the keyboard and scrolls its body. Footer lives inside the keyboard-avoiding area. */
export function FormSheet({
  open,
  onClose,
  title,
  children,
  footer,
  maxHeight = 460,
  scroll = true,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  maxHeight?: number;
  scroll?: boolean;
}) {
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <KeyboardAvoidingView behavior={KAV_BEHAVIOR}>
        {scroll ? (
          <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight }} contentContainerStyle={{ paddingHorizontal: 18, gap: 14, paddingBottom: 8 }}>
            {children}
          </ScrollView>
        ) : (
          children
        )}
        {footer ? <View style={{ paddingHorizontal: 18, paddingTop: 10 }}>{footer}</View> : null}
      </KeyboardAvoidingView>
    </Sheet>
  );
}

/* -------------------------------- DateField -------------------------------- */

export function DateField({
  label,
  value,
  onChange,
  quickDays = [7, 14, 30],
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  quickDays?: number[];
  hint?: string;
}) {
  const parsed = parseDateInput(value);
  const bad = "error" in parsed ? parsed.error : "";
  return (
    <View style={{ gap: 8 }}>
      <Field label={label} hint={bad || hint || "Format YYYY-MM-DD. Leave empty for none."}>
        <Input value={value} onChangeText={onChange} placeholder="YYYY-MM-DD" keyboardType="numbers-and-punctuation" autoCorrect={false} maxLength={10} />
      </Field>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {quickDays.map((d) => (
          <Chip key={d} label={`+${d} days`} on={false} onPress={() => onChange(toISODate(new Date(Date.now() + d * 86400000)))} />
        ))}
        {value ? <Chip label="Clear" on={false} onPress={() => onChange("")} /> : null}
      </View>
    </View>
  );
}

/* ------------------------------- PaymentSheet ------------------------------ */

export function PaymentSheet({
  open,
  onClose,
  title,
  balanceLabel,
  balance,
  currency,
  max,
  busy,
  notePlaceholder,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  balanceLabel: string;
  balance: number;
  currency: string;
  max?: number;
  busy: boolean;
  notePlaceholder?: string;
  onSubmit: (amount: string, note: string) => void;
}) {
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  useEffect(() => {
    if (open) {
      setAmount("");
      setNote("");
    }
  }, [open]);

  const submit = () => {
    const a = cleanNum(amount);
    if (!a || isNaN(Number(a)) || Number(a) <= 0) {
      toast.error("Enter a positive amount.");
      return;
    }
    if (max != null && Number(a) > max) {
      toast.error(`Amount can't exceed ${max.toLocaleString()}.`);
      return;
    }
    onSubmit(a, note.trim());
  };

  return (
    <FormSheet
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <View style={{ flexDirection: "row", gap: 10 }}>
          <Button label="Cancel" variant="outline" onPress={onClose} disabled={busy} style={{ flex: 1 }} />
          <Button label="Save payment" icon="checkmark" onPress={submit} busy={busy} style={{ flex: 1.6 }} />
        </View>
      }
    >
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: C.cream100, borderRadius: 14, padding: 12 }}>
        <T w="semi" size={13} color={C.ink500}>
          {balanceLabel}
        </T>
        <Money v={balance} currency={currency} size={15} />
      </View>
      <Field label={`Amount (${currency})`}>
        <Input value={amount} onChangeText={setAmount} placeholder="0.00" keyboardType="decimal-pad" autoFocus />
      </Field>
      {balance > 0 ? (
        <View style={{ flexDirection: "row" }}>
          <Chip label="Full balance" on={false} onPress={() => setAmount(balance.toFixed(2))} />
        </View>
      ) : null}
      <Field label="Note">
        <Input value={note} onChangeText={setNote} placeholder={notePlaceholder || "e.g. bank transfer ref"} />
      </Field>
    </FormSheet>
  );
}

/* --------------------------------- Products -------------------------------- */

/** Loads the product catalog (cursor pages, same endpoint as the web, up to ~500 items). */
export function useProducts() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let all: any[] = [];
      let cursor: string | null = null;
      for (let i = 0; i < 5; i++) {
        const qs = new URLSearchParams({ limit: "100" });
        if (cursor) qs.set("cursor", cursor);
        const res: any = await api.get(`/api/dashboard/products?${qs.toString()}`);
        all = all.concat(asList(res, "items", "products", "data"));
        cursor = pick<string>(res, ["nextCursor", "after", "next"]) ?? null;
        if (!cursor) break;
      }
      setProducts(all);
    } catch (e: any) {
      setError(apiErrorMessage(e, "Couldn't load your products."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { products, loading, error, reload: load };
}

export function ProductPickerSheet({
  open,
  onClose,
  products,
  loading,
  currency,
  priceOf,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  products: any[];
  loading: boolean;
  currency: string;
  priceOf: (p: any) => any;
  onPick: (p: any) => void;
}) {
  const [q, setQ] = useState("");
  useEffect(() => {
    if (open) setQ("");
  }, [open]);
  const needle = q.trim().toLowerCase();
  const list = needle ? products.filter((p) => `${p.name || ""} ${p.sku || ""}`.toLowerCase().includes(needle)) : products;

  return (
    <FormSheet open={open} onClose={onClose} title="Choose a product" scroll={false}>
      <View style={{ paddingHorizontal: 18, paddingBottom: 10 }}>
        <SearchBar value={q} onChangeText={setQ} placeholder="Search products" />
      </View>
      {loading && !products.length ? (
        <ActivityIndicator color={C.brand} style={{ marginVertical: 30 }} />
      ) : (
        <FlatList
          data={list}
          keyExtractor={(p) => p.id}
          style={{ height: 360 }}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingHorizontal: 18, gap: 8, paddingBottom: 10 }}
          ListEmptyComponent={
            <T w="regular" size={13} color={C.ink400} style={{ textAlign: "center", paddingVertical: 24 }}>
              {products.length ? "No products match your search." : "No products yet. Add products first."}
            </T>
          }
          renderItem={({ item: p }) => {
            const price = priceOf(p);
            return (
              <Pressable
                onPress={() => {
                  tap();
                  onPick(p);
                }}
                style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: 14, borderWidth: 1, borderColor: C.cream200, backgroundColor: pressed ? C.cream100 : C.white })}
              >
                <View style={{ flex: 1 }}>
                  <T w="bold" size={14} numberOfLines={1}>
                    {p.name}
                  </T>
                  {p.variants?.length > 0 ? (
                    <T w="regular" size={11.5} color={C.ink400}>
                      {p.variants.filter((v: any) => !v.archivedAt).length} variants
                    </T>
                  ) : null}
                </View>
                {price != null ? <Money v={price} currency={currency} size={13} /> : null}
              </Pressable>
            );
          }}
        />
      )}
    </FormSheet>
  );
}

/* --------------------------------- Customers ------------------------------- */

export function CustomerPickerSheet({
  open,
  onClose,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (c: { id: string; name: string }) => void;
}) {
  const [q, setQ] = useState("");
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const reqId = useRef(0);

  useEffect(() => {
    if (open) setQ("");
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(async () => {
      const id = ++reqId.current;
      setLoading(true);
      setError("");
      try {
        const qs = new URLSearchParams({ limit: "50" });
        if (q.trim()) qs.set("q", q.trim());
        const res: any = await api.get(`/api/dashboard/customers?${qs.toString()}`);
        if (id !== reqId.current) return;
        setItems(asList(res, "items", "customers", "data"));
      } catch (e: any) {
        if (id === reqId.current) setError(apiErrorMessage(e, "Couldn't load customers."));
      } finally {
        if (id === reqId.current) setLoading(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [open, q]);

  return (
    <FormSheet open={open} onClose={onClose} title="Choose a customer" scroll={false}>
      <View style={{ paddingHorizontal: 18, paddingBottom: 10 }}>
        <SearchBar value={q} onChangeText={setQ} placeholder="Search name, phone or email" />
      </View>
      {error ? (
        <T w="semi" size={13} color={C.danger500} style={{ textAlign: "center", paddingVertical: 24 }}>
          {error}
        </T>
      ) : loading && !items.length ? (
        <ActivityIndicator color={C.brand} style={{ marginVertical: 30 }} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(c) => c.id}
          style={{ height: 360 }}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingHorizontal: 18, gap: 8, paddingBottom: 10 }}
          ListEmptyComponent={
            <T w="regular" size={13} color={C.ink400} style={{ textAlign: "center", paddingVertical: 24 }}>
              {q ? "No customers match your search." : "No customers yet. Add a customer first."}
            </T>
          }
          renderItem={({ item: c }) => (
            <Pressable
              onPress={() => {
                tap();
                onPick({ id: c.id, name: c.name || "Unnamed" });
              }}
              style={({ pressed }) => ({ padding: 12, borderRadius: 14, borderWidth: 1, borderColor: C.cream200, backgroundColor: pressed ? C.cream100 : C.white })}
            >
              <T w="bold" size={14} numberOfLines={1}>
                {c.name || "Unnamed"}
              </T>
              {c.phone || c.email ? (
                <T w="regular" size={12} color={C.ink400} numberOfLines={1}>
                  {[c.phone, c.email].filter(Boolean).join(" · ")}
                </T>
              ) : null}
            </Pressable>
          )}
        />
      )}
    </FormSheet>
  );
}

/* -------------------------------- Line editor ------------------------------ */

export interface LineRow {
  key: string;
  productId: string;
  productName: string;
  variantId: string;
  quantity: string;
  unitPrice: string;
}

let seq = 0;
export const newLine = (over: Partial<LineRow> = {}): LineRow => ({
  key: `l${++seq}`,
  productId: "",
  productName: "",
  variantId: "",
  quantity: "1",
  unitPrice: "",
  ...over,
});

export const linesTotal = (rows: LineRow[]) => rows.reduce((a, r) => a + (parseFloat(cleanNum(r.quantity)) || 0) * (parseFloat(cleanNum(r.unitPrice)) || 0), 0);

export function LineEditor({
  rows,
  setRows,
  products,
  productsLoading,
  currency,
  priceLabel,
  priceOf,
  withVariants,
}: {
  rows: LineRow[];
  setRows: (fn: (rs: LineRow[]) => LineRow[]) => void;
  products: any[];
  productsLoading: boolean;
  currency: string;
  priceLabel: string;
  priceOf: (p: any) => any;
  withVariants?: boolean;
}) {
  const [pickFor, setPickFor] = useState<string | null>(null);
  const patch = (key: string, p: Partial<LineRow>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...p } : r)));

  return (
    <View style={{ gap: 10 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <T w="display" size={17}>
          {withVariants ? "Lines" : "Line items"}
        </T>
        <Button label="Add line" icon="add" variant="ghost" small onPress={() => setRows((rs) => [...rs, newLine()])} />
      </View>

      {rows.map((r, idx) => {
        const prod = products.find((p) => p.id === r.productId);
        const name = r.productName || prod?.name || "";
        const variants: any[] = withVariants && prod?.variants?.length ? prod.variants.filter((v: any) => !v.archivedAt || v.id === r.variantId) : [];
        const lineTotal = (parseFloat(cleanNum(r.quantity)) || 0) * (parseFloat(cleanNum(r.unitPrice)) || 0);
        return (
          <Card key={r.key} style={{ padding: 12, gap: 10 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Pressable
                onPress={() => {
                  tap();
                  setPickFor(r.key);
                }}
                style={{ flex: 1, height: 48, borderRadius: 14, backgroundColor: C.white, borderWidth: 1.5, borderColor: C.cream300, flexDirection: "row", alignItems: "center", paddingHorizontal: 12, gap: 8 }}
              >
                <T w="semi" size={14} color={name ? C.ink900 : C.ink300} style={{ flex: 1 }} numberOfLines={1}>
                  {name || "Choose a product…"}
                </T>
                <Ionicons name="chevron-down" size={16} color={C.ink400} />
              </Pressable>
              <Pressable
                onPress={() => {
                  tap();
                  setRows((rs) => (rs.length > 1 ? rs.filter((x) => x.key !== r.key) : rs));
                }}
                disabled={rows.length <= 1}
                hitSlop={8}
                accessibilityLabel={`Remove line ${idx + 1}`}
                style={{ width: 40, height: 40, borderRadius: 13, backgroundColor: C.danger100, alignItems: "center", justifyContent: "center", opacity: rows.length <= 1 ? 0.4 : 1 }}
              >
                <Ionicons name="trash-outline" size={18} color={C.danger500} />
              </Pressable>
            </View>

            {variants.length > 0 ? (
              <SelectField
                label="Variant"
                value={r.variantId}
                placeholder="Pick a variant…"
                options={variants.map((v: any) => ({ value: v.id, label: `${v.name}${v.archivedAt ? " (retired)" : ""}` }))}
                onChange={(v) => patch(r.key, { variantId: v })}
              />
            ) : null}

            <View style={{ flexDirection: "row", gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Field label="Qty">
                  <Input value={r.quantity} onChangeText={(v) => patch(r.key, { quantity: v.replace(/[^0-9]/g, "") })} keyboardType="number-pad" placeholder="1" />
                </Field>
              </View>
              <View style={{ flex: 1.6 }}>
                <Field label={`${priceLabel} (${currency})`}>
                  <Input value={r.unitPrice} onChangeText={(v) => patch(r.key, { unitPrice: v })} keyboardType="decimal-pad" placeholder="0.00" />
                </Field>
              </View>
            </View>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <T w="semi" size={12} color={C.ink400}>
                Line total
              </T>
              <Money v={lineTotal} currency={currency} size={14} />
            </View>
          </Card>
        );
      })}

      <ProductPickerSheet
        open={pickFor !== null}
        onClose={() => setPickFor(null)}
        products={products}
        loading={productsLoading}
        currency={currency}
        priceOf={priceOf}
        onPick={(p) => {
          if (pickFor) {
            setRows((rs) =>
              rs.map((x) => (x.key === pickFor ? { ...x, productId: p.id, productName: p.name || "", variantId: "", unitPrice: String(priceOf(p) ?? x.unitPrice) } : x))
            );
          }
          setPickFor(null);
        }}
      />
    </View>
  );
}

/** Sticky bottom bar used on the create/edit screens: total on the left, primary action on the right. */
export function TotalBar({ label, total, currency, actionLabel, busy, onPress }: { label: string; total: number; currency: string; actionLabel: string; busy: boolean; onPress: () => void }) {
  return (
    <View style={{ padding: 16, paddingBottom: 22, backgroundColor: C.cream50, borderTopWidth: 1, borderTopColor: C.cream200, flexDirection: "row", alignItems: "center", gap: 12 }}>
      <View style={{ flex: 1 }}>
        <T w="semi" size={11.5} color={C.ink400}>
          {label}
        </T>
        <T w="display" size={20} numberOfLines={1} adjustsFontSizeToFit>
          {fm(total, currency)}
        </T>
      </View>
      <Button label={actionLabel} icon="checkmark" onPress={onPress} busy={busy} style={{ flex: 1.2 }} />
    </View>
  );
}

export const balanceOf = (o: any): number => (o?.balanceDue != null ? rawNum(o.balanceDue) : rawNum(o?.total) - rawNum(o?.amountPaid));
