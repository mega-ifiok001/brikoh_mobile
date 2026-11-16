import { useCallback, useEffect, useMemo, useState } from "react";
import { FlatList, KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../src/context/AuthContext";
import { api } from "../../src/lib/api";
import { asList, fm, rawNum } from "../../src/lib/format";
import { Button, Chip, EmptyState, Input, LargeTitle, ListSkeleton, Money, Pill, SearchBar, Sheet, T, tap, toast } from "../../src/components/ui";
import { C, R, shadow } from "../../src/theme";

interface Line {
  key: string;
  productId: string;
  variantId?: string;
  name: string;
  variantName?: string;
  price: number;
  qty: number;
  max: number;
}

const METHODS = [
  { id: "CASH", label: "Cash", icon: "cash-outline" },
  { id: "TRANSFER", label: "Transfer", icon: "swap-horizontal-outline" },
  { id: "CARD", label: "Card", icon: "card-outline" },
  { id: "CREDIT", label: "Credit", icon: "time-outline" },
] as const;

function posErrorMessage(e: any): string {
  const code = e?.code || e?.details?.error?.code;
  const map: Record<string, string> = {
    INSUFFICIENT_STOCK: "Not enough stock for one of the items. The shelf has been refreshed.",
    PRODUCT_UNAVAILABLE: "One of the products is no longer available.",
    INVALID_DISCOUNT_CODE: "That discount code isn't valid.",
    DISCOUNT_EXPIRED: "That discount code has expired.",
    PAYMENT_NOT_CONFIGURED: "Card payments aren't set up for this store yet.",
    PAYMENT_PROVIDER_ERROR: "Card payment couldn't be started — please try again.",
    CUSTOMER_REQUIRED_FOR_CREDIT: "Credit sales need a saved customer.",
  };
  if (e?.status === 429) return "Too many sales in a short time — wait a moment and try again.";
  return map[code] || e?.message || "Couldn't record the sale.";
}

export default function Sell() {
  const { me } = useAuth();
  const store = me.store || {};
  const currency: string = store.currency || "NGN";

  const [products, setProducts] = useState<any[]>([]);
  const [cats, setCats] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [branchId, setBranchId] = useState("");
  const [loading, setLoading] = useState(true);

  const [q, setQ] = useState("");
  const [catF, setCatF] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [variantPick, setVariantPick] = useState<any | null>(null);
  const [branchOpen, setBranchOpen] = useState(false);

  const [cartOpen, setCartOpen] = useState(false);
  const [method, setMethod] = useState<string>("CASH");
  const [amountPaid, setAmountPaid] = useState("");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [receipt, setReceipt] = useState<any | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [pRes, cRes, bRes] = await Promise.all([
        api.get("/api/dashboard/products?limit=200").catch(() => null),
        api.get("/api/dashboard/categories").catch(() => null),
        api.get("/api/dashboard/branches").catch(() => null),
      ]);
      const list = pRes ? asList(pRes, "items", "products", "data") : [];
      setProducts(list.filter((p: any) => p.status === "PUBLISHED"));
      if (cRes) setCats(asList(cRes, "categories", "items", "data"));
      const bl = bRes ? asList(bRes, "branches", "items", "data") : [];
      setBranches(bl);
      setBranchId((cur) => cur || store.defaultBranchId || bl[0]?.id || "");
      if (pRes === null) toast.error("Couldn't load products.");
    } finally {
      setLoading(false);
    }
  }, [store.defaultBranchId]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return products.filter((p) => {
      if (catF && p.categoryId !== catF) return false;
      if (s && !(p.name || "").toLowerCase().includes(s) && !(p.sku || "").toLowerCase().includes(s)) return false;
      return true;
    });
  }, [products, q, catF]);

  const effPrice = (p: any) => rawNum(p.discountPrice ?? p.price ?? 0);
  const stockOf = (p: any) => (p.variants?.length ? p.variants.reduce((a: number, v: any) => a + rawNum(v.quantity), 0) : rawNum(p.quantity));
  const inCart = (p: any) => lines.filter((l) => l.productId === p.id).reduce((a, l) => a + l.qty, 0);

  const addToCart = (p: any) => {
    if (p.variants?.length) {
      setVariantPick(p);
      return;
    }
    const max = rawNum(p.quantity);
    if (max <= 0) return toast.error(`${p.name} is out of stock.`);
    const ex = lines.find((l) => l.productId === p.id && !l.variantId);
    if (ex && ex.qty >= max) return toast.error("No more stock on this product.");
    tap();
    setLines((ls) => {
      const e = ls.find((l) => l.productId === p.id && !l.variantId);
      if (e) return ls.map((l) => (l.key === e.key ? { ...l, qty: l.qty + 1 } : l));
      return [...ls, { key: p.id, productId: p.id, name: p.name, price: effPrice(p), qty: 1, max }];
    });
  };

  const addVariant = (p: any, v: any) => {
    const max = rawNum(v.quantity);
    if (max <= 0) return toast.error(`${v.name} is out of stock.`);
    const ex = lines.find((l) => l.productId === p.id && l.variantId === v.id);
    if (ex && ex.qty >= max) return toast.error("No more stock on this variant.");
    tap();
    setLines((ls) => {
      const e = ls.find((l) => l.productId === p.id && l.variantId === v.id);
      if (e) return ls.map((l) => (l.key === e.key ? { ...l, qty: l.qty + 1 } : l));
      return [
        ...ls,
        { key: p.id + v.id, productId: p.id, variantId: v.id, name: p.name, variantName: v.name, price: rawNum(v.sellingPrice ?? p.discountPrice ?? p.price), qty: 1, max },
      ];
    });
    setVariantPick(null);
  };

  const bump = (key: string, d: number) =>
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, qty: Math.min(l.max, Math.max(0, l.qty + d)) } : l)).filter((l) => l.qty > 0));

  const subtotal = lines.reduce((a, l) => a + l.price * l.qty, 0);
  const itemCount = lines.reduce((a, l) => a + l.qty, 0);
  const hasCode = !!code.trim();
  const paidNow = parseFloat(amountPaid) || 0;

  const canSubmit = (() => {
    if (!lines.length) return false;
    if (method === "CARD") return !!email.trim();
    if (method === "CREDIT") return true;
    if (!hasCode && paidNow < subtotal && amountPaid !== "") return false;
    return true;
  })();

  const charge = async () => {
    if (!canSubmit) {
      toast.error(method === "CARD" ? "An email is required for card payments." : "Amount received is less than the total.");
      return;
    }
    setBusy(true);
    try {
      const payload: any = {
        items: lines.map((l) => ({ productId: l.productId, variantId: l.variantId || undefined, quantity: l.qty })),
        branchId: branchId || undefined,
        paymentMethod: method,
        discountCode: code.trim() || undefined,
      };
      if (method === "CREDIT") payload.amountPaid = paidNow;
      if (method === "CARD") payload.email = email.trim();

      const res: any = await api.post("/api/dashboard/orders", payload);
      const order = res?.order ?? {};
      const payment = res?.payment ?? null;
      const total = rawNum(order.total ?? subtotal);

      setCartOpen(false);
      setReceipt({
        number: order.orderNumber || (order.id ? String(order.id).slice(0, 8).toUpperCase() : "—"),
        total,
        method,
        change: method === "CASH" && amountPaid ? Math.max(0, paidNow - total) : 0,
        outstanding: rawNum(order.balanceDue ?? 0),
        redirectUrl: payment?.redirectUrl ?? null,
      });
      setLines([]);
      setEmail("");
      setCode("");
      setAmountPaid("");
      setMethod("CASH");
      load();
    } catch (e: any) {
      toast.error(posErrorMessage(e));
      const c = e?.code;
      if (c === "INSUFFICIENT_STOCK" || c === "PRODUCT_UNAVAILABLE") load();
    } finally {
      setBusy(false);
    }
  };

  const branchName = branches.find((b) => b.id === branchId)?.name || "Branch";

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1 }}>
      <LargeTitle
        title="Sell"
        right={
          branches.length > 1 ? (
            <Pressable
              onPress={() => setBranchOpen(true)}
              style={{ flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: C.brand50, paddingHorizontal: 12, paddingVertical: 8, borderRadius: R.pill }}
            >
              <T w="extra" size={12} color={C.brand}>
                {branchName}
              </T>
              <Ionicons name="chevron-down" size={13} color={C.brand} />
            </Pressable>
          ) : null
        }
      />
      <View style={{ paddingHorizontal: 16, gap: 10 }}>
        <SearchBar value={q} onChangeText={setQ} placeholder="Search the shelf…" />
        {cats.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
            <Chip label="All" on={!catF} onPress={() => setCatF("")} />
            {cats.map((c) => (
              <Chip key={c.id} label={c.name} on={catF === c.id} onPress={() => setCatF(catF === c.id ? "" : c.id)} />
            ))}
          </ScrollView>
        )}
      </View>

      {loading && !products.length ? (
        <View style={{ marginTop: 14 }}>
          <ListSkeleton rows={4} />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(p) => p.id}
          numColumns={2}
          columnWrapperStyle={{ gap: 10 }}
          contentContainerStyle={{ padding: 16, paddingBottom: lines.length ? 110 : 24, gap: 10 }}
          showsVerticalScrollIndicator={false}
          refreshing={loading}
          onRefresh={load}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={<EmptyState icon="cube-outline" title="Nothing on the shelf" sub={q ? "No products match your search." : "Add and publish products to start selling."} />}
          renderItem={({ item: p }) => {
            const stock = stockOf(p);
            const n = inCart(p);
            const img = p.coverImageUrl || p.images?.[0];
            return (
              <Pressable
                onPress={() => addToCart(p)}
                style={({ pressed }) => ({
                  flex: 1,
                  backgroundColor: C.white,
                  borderRadius: R.lg,
                  padding: 8,
                  borderWidth: n ? 1.5 : 1,
                  borderColor: n ? C.brand : C.cream200,
                  opacity: pressed ? 0.88 : stock <= 0 ? 0.6 : 1,
                  transform: [{ scale: pressed ? 0.98 : 1 }],
                  ...shadow.card,
                })}
              >
                <View style={{ height: 96, borderRadius: 12, backgroundColor: C.cream100, overflow: "hidden", alignItems: "center", justifyContent: "center" }}>
                  {img ? <Image source={{ uri: img }} style={{ width: "100%", height: "100%" }} contentFit="cover" transition={150} /> : <Ionicons name="cube-outline" size={30} color={C.ink300} />}
                  {n > 0 && (
                    <View style={{ position: "absolute", top: 6, right: 6, backgroundColor: C.brand, borderRadius: R.pill, paddingHorizontal: 8, paddingVertical: 2 }}>
                      <T w="extra" size={11} color="#fff">
                        ×{n}
                      </T>
                    </View>
                  )}
                </View>
                <T w="bold" size={13} numberOfLines={1} style={{ marginTop: 8 }}>
                  {p.name}
                </T>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 3 }}>
                  <Money v={effPrice(p)} currency={currency} size={13} color={C.brand} />
                  <Pill tone={stock <= 0 ? "danger" : stock <= 5 ? "gold" : "green"}>{stock <= 0 ? "Out" : String(stock)}</Pill>
                </View>
              </Pressable>
            );
          }}
        />
      )}

      {/* Floating cart bar */}
      {lines.length > 0 && (
        <View
          style={{
            position: "absolute",
            left: 12,
            right: 12,
            bottom: 10,
            height: 62,
            borderRadius: 22,
            backgroundColor: C.ink900,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingLeft: 16,
            paddingRight: 8,
            ...shadow.float,
          }}
        >
          <Pressable onPress={() => setCartOpen(true)} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <View style={{ backgroundColor: C.brand, borderRadius: R.pill, minWidth: 26, height: 26, alignItems: "center", justifyContent: "center", paddingHorizontal: 8 }}>
              <T w="extra" size={13} color="#fff">
                {itemCount}
              </T>
            </View>
            <T w="semi" size={13} color={C.ink300}>
              {itemCount === 1 ? "item" : "items"}
            </T>
          </Pressable>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <T w="display" size={18} color="#fff">
              {fm(subtotal, currency)}
            </T>
            <Pressable
              onPress={() => {
                tap();
                setCartOpen(true);
              }}
              style={({ pressed }) => ({ backgroundColor: C.brand, borderRadius: 16, height: 46, paddingHorizontal: 18, justifyContent: "center", opacity: pressed ? 0.85 : 1 })}
            >
              <T w="extra" size={14} color="#fff">
                Charge →
              </T>
            </Pressable>
          </View>
        </View>
      )}

      {/* Checkout sheet */}
      <Sheet
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        title="Checkout"
        footer={
          <View style={{ gap: 10 }}>
            <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" }}>
              <T w="semi" size={13} color={C.ink400}>
                {hasCode ? "Estimated total" : "Total"}
              </T>
              <T w="display" size={28} style={{ letterSpacing: -0.5 }}>
                {fm(subtotal, currency)}
              </T>
            </View>
            <Button label="Complete sale" onPress={charge} busy={busy} disabled={!canSubmit} />
          </View>
        }
      >
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <ScrollView style={{ maxHeight: 440 }} contentContainerStyle={{ paddingHorizontal: 18, gap: 14, paddingBottom: 6 }} keyboardShouldPersistTaps="handled">
            <View style={{ backgroundColor: C.cream50, borderRadius: 16, paddingHorizontal: 12 }}>
              {lines.map((l, i) => (
                <View key={l.key} style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, borderTopWidth: i ? 1 : 0, borderTopColor: C.cream200 }}>
                  <View style={{ flex: 1 }}>
                    <T w="bold" size={13.5} numberOfLines={1}>
                      {l.name}
                      {l.variantName ? ` · ${l.variantName}` : ""}
                    </T>
                    <T w="regular" size={11.5} color={C.ink400}>
                      {fm(l.price, currency)} each
                    </T>
                  </View>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 2 }}>
                    <StepBtn icon="remove" onPress={() => bump(l.key, -1)} />
                    <T w="extra" size={14} style={{ minWidth: 26, textAlign: "center" }}>
                      {l.qty}
                    </T>
                    <StepBtn icon="add" onPress={() => bump(l.key, 1)} disabled={l.qty >= l.max} />
                  </View>
                  <Money v={l.price * l.qty} currency={currency} size={13.5} />
                </View>
              ))}
            </View>

            <View style={{ flexDirection: "row", gap: 8 }}>
              {METHODS.map((m) => {
                const on = method === m.id;
                return (
                  <Pressable
                    key={m.id}
                    onPress={() => {
                      tap();
                      setMethod(m.id);
                    }}
                    style={{ flex: 1, height: 62, borderRadius: 16, alignItems: "center", justifyContent: "center", gap: 4, backgroundColor: on ? C.ink900 : C.white, borderWidth: 1, borderColor: on ? C.ink900 : C.cream300 }}
                  >
                    <Ionicons name={m.icon as any} size={19} color={on ? "#fff" : C.ink500} />
                    <T w="bold" size={11.5} color={on ? "#fff" : C.ink500}>
                      {m.label}
                    </T>
                  </Pressable>
                );
              })}
            </View>

            {method === "CARD" && <Input value={email} onChangeText={setEmail} placeholder="Customer email (required)" keyboardType="email-address" autoCapitalize="none" />}
            {(method === "CASH" || method === "TRANSFER" || method === "CREDIT") && (
              <Input
                value={amountPaid}
                onChangeText={setAmountPaid}
                keyboardType="decimal-pad"
                placeholder={method === "CASH" ? "Cash received (optional)" : method === "TRANSFER" ? "Amount received (optional)" : "Amount paid now (optional)"}
              />
            )}
            <Input value={code} onChangeText={(t) => setCode(t.toUpperCase())} placeholder="Discount code (optional)" autoCapitalize="characters" />
          </ScrollView>
        </KeyboardAvoidingView>
      </Sheet>

      {/* Variant picker */}
      <Sheet open={!!variantPick} onClose={() => setVariantPick(null)} title={variantPick?.name || "Choose a variant"}>
        <ScrollView style={{ maxHeight: 380 }} contentContainerStyle={{ paddingHorizontal: 18, gap: 8, paddingBottom: 10 }}>
          {(variantPick?.variants || []).map((v: any) => {
            const out = rawNum(v.quantity) <= 0;
            return (
              <Pressable
                key={v.id}
                disabled={out}
                onPress={() => addVariant(variantPick, v)}
                style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 10, padding: 14, borderRadius: 16, borderWidth: 1, borderColor: C.cream200, backgroundColor: pressed ? C.cream50 : C.white, opacity: out ? 0.5 : 1 })}
              >
                <View style={{ flex: 1 }}>
                  <T w="bold" size={14}>
                    {v.name}
                  </T>
                  <T w="regular" size={12} color={C.ink400}>
                    {out ? "Out of stock" : `${rawNum(v.quantity)} in stock`}
                  </T>
                </View>
                <Money v={v.sellingPrice ?? variantPick?.discountPrice ?? variantPick?.price} currency={currency} size={14} color={C.brand} />
              </Pressable>
            );
          })}
        </ScrollView>
      </Sheet>

      {/* Branch picker */}
      <Sheet open={branchOpen} onClose={() => setBranchOpen(false)} title="Sell from">
        <View style={{ paddingHorizontal: 18, gap: 8, paddingBottom: 10 }}>
          {branches.map((b) => (
            <Pressable
              key={b.id}
              onPress={() => {
                setBranchId(b.id);
                setBranchOpen(false);
              }}
              style={{ flexDirection: "row", alignItems: "center", padding: 14, borderRadius: 16, borderWidth: 1.5, borderColor: b.id === branchId ? C.brand : C.cream200, backgroundColor: b.id === branchId ? C.brand50 : C.white }}
            >
              <T w="bold" size={14} style={{ flex: 1 }}>
                {b.name}
              </T>
              {b.id === branchId && <Ionicons name="checkmark-circle" size={20} color={C.brand} />}
            </Pressable>
          ))}
        </View>
      </Sheet>

      {/* Receipt */}
      <Sheet open={!!receipt} onClose={() => setReceipt(null)}>
        {receipt && (
          <View style={{ paddingHorizontal: 18, alignItems: "center", gap: 6, paddingBottom: 6 }}>
            <View style={{ width: 68, height: 68, borderRadius: 34, backgroundColor: C.leaf100, alignItems: "center", justifyContent: "center", marginBottom: 6 }}>
              <Ionicons name="checkmark" size={36} color={C.leaf500} />
            </View>
            <T w="display" size={22}>
              Sale recorded
            </T>
            <T w="semi" size={12.5} color={C.ink400}>
              Order {receipt.number}
            </T>
            <T w="display" size={36} style={{ marginTop: 8, letterSpacing: -0.8 }}>
              {fm(receipt.total, currency)}
            </T>
            {receipt.change > 0 && (
              <View style={{ backgroundColor: C.gold100, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 8, marginTop: 6 }}>
                <T w="extra" size={13} color={C.gold600}>
                  Change to give: {fm(receipt.change, currency)}
                </T>
              </View>
            )}
            {receipt.outstanding > 0 && (
              <View style={{ backgroundColor: C.danger100, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 8, marginTop: 6 }}>
                <T w="extra" size={13} color={C.danger500}>
                  Still owing: {fm(receipt.outstanding, currency)}
                </T>
              </View>
            )}
            <View style={{ width: "100%", gap: 10, marginTop: 16 }}>
              {receipt.redirectUrl ? <Button label="Open card payment" icon="card-outline" onPress={() => Linking.openURL(receipt.redirectUrl)} /> : null}
              <Button label="New sale" variant={receipt.redirectUrl ? "outline" : "primary"} onPress={() => setReceipt(null)} />
            </View>
          </View>
        )}
      </Sheet>
    </SafeAreaView>
  );
}

function StepBtn({ icon, onPress, disabled }: { icon: "add" | "remove"; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable
      disabled={disabled}
      onPress={() => {
        tap();
        onPress();
      }}
      hitSlop={6}
      style={{ width: 30, height: 30, borderRadius: 10, backgroundColor: C.white, borderWidth: 1, borderColor: C.cream300, alignItems: "center", justifyContent: "center", opacity: disabled ? 0.4 : 1 }}
    >
      <Ionicons name={icon} size={16} color={C.ink700} />
    </Pressable>
  );
}
