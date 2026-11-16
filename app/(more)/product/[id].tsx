// Product create (id = "new") and edit. Mirrors the web Products form: same endpoints,
// payload building and validation. Image upload isn't available on mobile yet, so images are URLs.
import { useCallback, useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../../src/context/AuthContext";
import { api } from "../../../src/lib/api";
import { getAccess } from "../../../src/lib/access";
import { apiErrorMessage, asList, pick, rawNum } from "../../../src/lib/format";
import { Button, Card, EmptyState, ErrorState, Field, Input, Skeleton, StatusPill, T, toast } from "../../../src/components/ui";
import { ConfirmSheet, DetailRow, Page, SectionTitle, SelectField, SwitchRow } from "../../../src/components/kit";
import { DateField } from "../../../src/components/expenses/DateField";
import StockAdjustSheet from "../../../src/components/stock/StockAdjustSheet";
import ProductVariantsSection, { MAX_OPTIONS, MAX_OPTION_NAME, MAX_VARIANTS, parseValues } from "../../../src/components/stock/ProductVariantsSection";
import { C } from "../../../src/theme";

const MAX_IMAGES = 10;
const MAX_PRODUCT_NAME = 120;
const MAX_PRODUCT_SKU = 64;
const MAX_VARIANT_NAME = 80;
const MAX_DESCRIPTION = 2000;
const MAX_MONEY = 99999999.99;

interface VariantRow {
  key: number;
  name: string;
  sellingPrice: string;
  sku: string;
  initialStock: string;
}
interface OptionDraft {
  key: number;
  name: string;
  values: string;
}
interface FormState {
  name: string;
  sku: string;
  price: string;
  costPrice: string;
  discountPrice: string;
  description: string;
  categoryId: string;
  unitId: string;
  lowStockThreshold: string;
  expiryDate: string;
  initialStock: string;
  images: string[];
  coverImageUrl: string;
}

const BLANK: FormState = {
  name: "",
  sku: "",
  price: "",
  costPrice: "",
  discountPrice: "",
  description: "",
  categoryId: "",
  unitId: "",
  lowStockThreshold: "",
  expiryDate: "",
  initialStock: "",
  images: [],
  coverImageUrl: "",
};

const decimal = (t: string) => t.replace(/[^0-9.]/g, "");
const digits = (t: string) => t.replace(/[^0-9]/g, "");
const money2 = (n: number) => Math.round(n * 100) === n * 100;

function formFromProduct(x: any): FormState {
  return {
    name: x.name || "",
    sku: x.sku || "",
    price: x.price != null ? String(x.price) : "",
    costPrice: x.costPrice != null ? String(x.costPrice) : "",
    discountPrice: x.discountPrice != null ? String(x.discountPrice) : "",
    description: x.description || "",
    categoryId: x.categoryId || x.category?.id || "",
    unitId: x.unitId || x.unit?.id || "",
    lowStockThreshold: x.lowStockThreshold != null ? String(x.lowStockThreshold) : "",
    expiryDate: x.expiryDate ? String(x.expiryDate).slice(0, 10) : "",
    initialStock: "",
    coverImageUrl: x.coverImageUrl || x.images?.[0] || "",
    images: Array.isArray(x.images) ? [...x.images] : x.coverImageUrl ? [x.coverImageUrl] : [],
  };
}

export default function ProductScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { me } = useAuth();
  const allowed = getAccess(me).can("products");
  const currency: string = (me.store as any)?.currency || "NGN";
  const isNew = id === "new";

  const [product, setProduct] = useState<any | null>(null);
  const [loading, setLoading] = useState(!isNew);
  const [loadErr, setLoadErr] = useState<string | null>(null);

  const [cats, setCats] = useState<any[]>([]);
  const [units, setUnits] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);

  const [form, setForm] = useState<FormState>(BLANK);
  const [variantRows, setVariantRows] = useState<VariantRow[]>([]);
  const [createOptions, setCreateOptions] = useState<OptionDraft[]>([]);
  const [newCat, setNewCat] = useState("");
  const [newUnit, setNewUnit] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [formErr, setFormErr] = useState("");

  const [statusBusy, setStatusBusy] = useState(false);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [delOpen, setDelOpen] = useState(false);
  const [delBusy, setDelBusy] = useState(false);

  const set = (patch: Partial<FormState>) => setForm((f) => ({ ...f, ...patch }));

  const loadCatalog = useCallback(async () => {
    const [c, u, b] = await Promise.allSettled([api.get("/api/dashboard/categories"), api.get("/api/dashboard/units"), api.get("/api/dashboard/branches")]);
    if (c.status === "fulfilled") setCats(asList(c.value, "categories", "items", "data"));
    if (u.status === "fulfilled") setUnits(asList(u.value, "units", "items", "data"));
    if (b.status === "fulfilled") setBranches(asList(b.value, "branches", "items", "data"));
  }, []);

  const loadProduct = useCallback(async (quiet?: boolean) => {
    if (isNew) return;
    if (quiet !== true) setLoading(true);
    setLoadErr(null);
    try {
      const res: any = await api.get(`/api/dashboard/products/${id}`);
      const p = res?.product ?? res;
      if (!p?.id) throw new Error("Product not found");
      setProduct(p);
      setForm(formFromProduct(p));
    } catch (e: any) {
      setLoadErr(apiErrorMessage(e, "Couldn't load this product.", { NOT_FOUND: "That product no longer exists." }));
    } finally {
      setLoading(false);
    }
  }, [id, isNew]);

  useEffect(() => {
    loadCatalog();
  }, [loadCatalog]);
  useEffect(() => {
    loadProduct();
  }, [loadProduct]);

  // ------------------------------------------------------------------ save
  const submit = async () => {
    setFormErr("");
    const editing = !isNew;
    const name = form.name.trim();
    if (!name) return setFormErr("Give the product a name.");
    if (name.length > MAX_PRODUCT_NAME) return setFormErr(`Product name must be ${MAX_PRODUCT_NAME} characters or fewer.`);
    const sku = form.sku.trim();
    if (sku.length > MAX_PRODUCT_SKU) return setFormErr(`SKU must be ${MAX_PRODUCT_SKU} characters or fewer.`);

    const price = Number(form.price);
    if (!Number.isFinite(price) || price <= 0 || !money2(price) || price > MAX_MONEY) {
      return setFormErr("Enter a valid price greater than zero with at most 2 decimal places.");
    }
    const costPrice = form.costPrice.trim() ? Number(form.costPrice) : null;
    if (costPrice != null && (!Number.isFinite(costPrice) || costPrice < 0 || costPrice > MAX_MONEY || !money2(costPrice))) {
      return setFormErr("Enter a valid cost price.");
    }
    const discountPrice = form.discountPrice.trim() ? Number(form.discountPrice) : null;
    if (discountPrice != null && (!Number.isFinite(discountPrice) || discountPrice < 0 || discountPrice >= price || discountPrice > MAX_MONEY || !money2(discountPrice))) {
      return setFormErr("Discount price must be lower than the price and have at most 2 decimal places.");
    }
    const description = form.description.trim();
    if (description.length > MAX_DESCRIPTION) return setFormErr(`Description must be ${MAX_DESCRIPTION} characters or fewer.`);

    const variants = editing ? [] : variantRows.filter((v) => v.name.trim());
    if (variants.length > MAX_VARIANTS) return setFormErr(`Maximum ${MAX_VARIANTS} variants allowed.`);
    const opening = !editing && form.initialStock.trim() ? Number(form.initialStock) : null;
    if (opening != null && (!Number.isInteger(opening) || opening < 1 || opening > 1000000)) {
      return setFormErr("Opening stock must be an integer between 1 and 1,000,000.");
    }
    if (!editing && variants.length > 0 && opening != null) return setFormErr("Initial stock and variants cannot be used together.");
    for (const v of variants) {
      const vn = v.name.trim();
      if (vn.length > MAX_VARIANT_NAME) return setFormErr(`Variant names must be ${MAX_VARIANT_NAME} characters or fewer.`);
      if (v.sku.trim().length > MAX_PRODUCT_SKU) return setFormErr(`SKU for variant "${vn}" is too long.`);
      if (v.sellingPrice.trim()) {
        const n = Number(v.sellingPrice);
        if (!Number.isFinite(n) || n < 0 || n > MAX_MONEY || !money2(n)) return setFormErr(`Invalid selling price for variant "${vn}".`);
      }
      if (v.initialStock.trim()) {
        const s = Number(v.initialStock);
        if (!Number.isInteger(s) || s < 1 || s > 1000000) return setFormErr(`Invalid initial stock for variant "${vn}".`);
      }
    }

    const cleanOptions = editing
      ? []
      : createOptions.map((o) => ({ name: o.name.trim(), values: parseValues(o.values) })).filter((o) => o.name || o.values.length > 0);
    if (cleanOptions.length > 0) {
      if (cleanOptions.length > MAX_OPTIONS) return setFormErr(`A product can have at most ${MAX_OPTIONS} dimensions.`);
      if (opening != null) return setFormErr("Opening stock and option dimensions can't be used together — the grid's variants each hold their own stock.");
      if (variants.length > 0) return setFormErr("Use either option dimensions or a manual variant list — not both.");
      for (const o of cleanOptions) {
        if (!o.name) return setFormErr("Every dimension needs a name — e.g. Colour or Size.");
        if (o.name.length > MAX_OPTION_NAME) return setFormErr(`"${o.name}" is too long — dimensions are ${MAX_OPTION_NAME} characters or fewer.`);
        if (o.values.length === 0) return setFormErr(`Add at least one value for "${o.name}".`);
        for (const val of o.values) {
          if (val.length > MAX_OPTION_NAME) return setFormErr(`"${val}" is too long — values are ${MAX_OPTION_NAME} characters or fewer.`);
        }
      }
      const grid = cleanOptions.reduce((a, o) => a * o.values.length, 1);
      if (grid > MAX_VARIANTS) return setFormErr(`Those dimensions make ${grid} variants — the limit is ${MAX_VARIANTS} per product.`);
    }

    let lowStockThreshold: number | null = null;
    if (form.lowStockThreshold.trim()) {
      const t = Number(form.lowStockThreshold);
      if (!Number.isInteger(t) || t < 0) return setFormErr("Low-stock threshold must be a non-negative integer.");
      lowStockThreshold = t;
    }

    let expiryDate: string | null = null;
    if (form.expiryDate) {
      const parsed = new Date(`${form.expiryDate}T00:00:00Z`);
      if (Number.isNaN(parsed.getTime())) return setFormErr("Enter a valid expiry date.");
      expiryDate = parsed.toISOString();
    }

    if (form.images.length > MAX_IMAGES) return setFormErr(`Maximum ${MAX_IMAGES} images allowed.`);
    for (const im of form.images) {
      if (im.length > 2048) return setFormErr("Image URL must be 2048 characters or fewer.");
    }

    let categoryId = form.categoryId;
    let unitId = form.unitId;

    setBusy(true);
    try {
      if (categoryId === "__new") {
        const nm = newCat.trim();
        if (!nm) return setFormErr("Enter a category name.");
        const res: any = await api.post("/api/dashboard/categories", { name: nm });
        categoryId = pick<string>(res, ["id"]) || res?.category?.id || res?.data?.id || "";
        if (!categoryId) throw new Error("Couldn't create the category.");
        loadCatalog();
      }
      if (unitId === "__new") {
        const nm = newUnit.trim();
        if (!nm) return setFormErr("Enter a unit name.");
        const res: any = await api.post("/api/dashboard/units", { name: nm });
        unitId = pick<string>(res, ["id"]) || res?.unit?.id || res?.data?.id || "";
        if (!unitId) throw new Error("Couldn't create the unit.");
        loadCatalog();
      }

      const payload: Record<string, unknown> = { name, price };
      if (sku) payload.sku = sku;
      else if (editing) payload.sku = null;
      if (costPrice != null) payload.costPrice = costPrice;
      else if (editing) payload.costPrice = null;
      if (description) payload.description = description;
      else if (editing) payload.description = null;
      if (discountPrice != null) payload.discountPrice = discountPrice;
      else if (editing) payload.discountPrice = null;
      if (categoryId) payload.categoryId = categoryId;
      else if (editing) payload.categoryId = null;
      if (unitId) payload.unitId = unitId;
      else if (editing) payload.unitId = null;
      if (lowStockThreshold != null) payload.lowStockThreshold = lowStockThreshold;
      else if (editing) payload.lowStockThreshold = null;
      if (expiryDate) payload.expiryDate = expiryDate;
      else if (editing) payload.expiryDate = null;

      if (form.images.length > 0) {
        payload.images = form.images.slice(0, MAX_IMAGES);
        payload.coverImageUrl = form.coverImageUrl && form.images.includes(form.coverImageUrl) ? form.coverImageUrl : form.images[0];
      } else if (editing) {
        payload.images = [];
        payload.coverImageUrl = null;
      }

      // Create-only: status / quantity / variants / initialStock are never sent on PATCH.
      if (!editing) {
        if (cleanOptions.length > 0) {
          payload.options = cleanOptions;
        } else if (variants.length > 0) {
          payload.variants = variants.map((v) => {
            const row: Record<string, unknown> = { name: v.name.trim() };
            if (v.sellingPrice.trim()) row.sellingPrice = Number(v.sellingPrice);
            if (v.sku.trim()) row.sku = v.sku.trim();
            if (v.initialStock.trim()) row.initialStock = Number(v.initialStock);
            return row;
          });
        } else if (opening != null) {
          payload.initialStock = opening;
        }
      }

      if (editing) {
        await api.patch(`/api/dashboard/products/${id}`, payload);
        toast.success("Product updated.");
        await loadProduct(true);
      } else {
        const res: any = await api.post("/api/dashboard/products", payload);
        toast.success("Product created.");
        const newId = res?.product?.id ?? res?.id;
        if (newId) router.replace(`/product/${newId}`);
        else router.back();
      }
    } catch (e: any) {
      setFormErr(e?.code === "PRODUCT_LIMIT_REACHED" ? "You have reached your plan's product limit. Upgrade to add more." : e?.message || "Couldn't save the product.");
    } finally {
      setBusy(false);
    }
  };

  // ---------------------------------------------------------------- status
  const toggleStatus = async () => {
    if (!product) return;
    setStatusBusy(true);
    try {
      if (product.status === "PUBLISHED") {
        await api.post(`/api/dashboard/products/${product.id}/unpublish`);
        toast.success("Product moved to draft.");
      } else {
        await api.post(`/api/dashboard/products/${product.id}/publish`);
        toast.success("Product published — it's now buyable.");
      }
      await loadProduct(true);
    } catch (e: any) {
      toast.error(
        apiErrorMessage(e, "Couldn't change product status.", {
          PRODUCT_NOT_READY_TO_PUBLISH: "This product isn't ready to go live — it still needs a category, a unit and a photo.",
          NOT_FOUND: "That product no longer exists.",
        })
      );
    } finally {
      setStatusBusy(false);
    }
  };

  // ---------------------------------------------------------------- delete
  const confirmDelete = async () => {
    if (!product) return;
    setDelBusy(true);
    try {
      await api.del(`/api/dashboard/products/${product.id}`);
      toast.success("Product deleted.");
      setDelOpen(false);
      router.back();
    } catch (e: any) {
      toast.error(e?.message || "Couldn't delete the product.");
    } finally {
      setDelBusy(false);
    }
  };

  // ---------------------------------------------------------------- images
  const addImage = () => {
    const u = imageUrl.trim();
    if (!u) return;
    if (!/^https?:\/\//i.test(u)) return toast.error("Enter a full image URL starting with http(s)://");
    if (u.length > 2048) return toast.error("Image URL must be 2048 characters or fewer.");
    if (form.images.length >= MAX_IMAGES) return toast.error(`Maximum ${MAX_IMAGES} images allowed.`);
    if (form.images.includes(u)) return setImageUrl("");
    set({ images: [...form.images, u], coverImageUrl: form.coverImageUrl || u });
    setImageUrl("");
  };
  const removeImage = (u: string) => {
    const images = form.images.filter((x) => x !== u);
    set({ images, coverImageUrl: form.coverImageUrl === u ? images[0] || "" : form.coverImageUrl });
  };

  // ---------------------------------------------------------------- render
  if (!allowed) {
    return (
      <Page title="Product">
        <EmptyState icon="lock-closed-outline" title="No access" sub="Your role can't manage products." />
      </Page>
    );
  }
  if (loading) {
    return (
      <Page title="Product">
        <View style={{ padding: 16, gap: 12 }}>
          <Skeleton h={52} />
          <Skeleton h={52} />
          <Skeleton h={120} />
        </View>
      </Page>
    );
  }
  if (loadErr) {
    return (
      <Page title="Product">
        <ErrorState message={loadErr} onRetry={() => loadProduct()} />
      </Page>
    );
  }

  const stockTotal = product
    ? product.variants?.length
      ? product.variants.reduce((a: number, v: any) => a + rawNum(v.quantity), 0)
      : rawNum(product.quantity)
    : 0;
  const branchRows: any[] = product ? ((pick(product, ["branchStocks", "stockByBranch", "branchStock", "stocks"]) as any[]) || []).filter((x) => x && typeof x === "object") : [];

  const catOptions = [
    { value: "", label: "No category" },
    ...cats.map((c: any) => ({ value: c.id, label: c.name })),
    { value: "__new", label: "+ New category" },
  ];
  const unitOptions = [
    { value: "", label: "No unit" },
    ...units.map((u: any) => ({ value: u.id, label: u.name })),
    { value: "__new", label: "+ New unit" },
  ];

  return (
    <Page title={isNew ? "New product" : product?.name || "Product"}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 14 }} showsVerticalScrollIndicator={false}>
          {formErr ? (
            <View style={{ backgroundColor: C.danger100, borderRadius: 14, padding: 12 }}>
              <T w="bold" size={12.5} color={C.danger500}>
                {formErr}
              </T>
            </View>
          ) : null}

          {/* Status + stock (edit only) */}
          {product ? (
            <Card style={{ padding: 14, gap: 4 }}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <T w="display" size={16}>
                  Status
                </T>
                <StatusPill status={product.status} />
              </View>
              <SwitchRow
                label={product.status === "PUBLISHED" ? "Published" : "Draft"}
                sub={product.status === "PUBLISHED" ? "Visible and buyable. Switch off to move it to draft." : "Needs a category, a unit and a photo before it can go live."}
                value={product.status === "PUBLISHED"}
                onChange={() => !statusBusy && toggleStatus()}
              />
            </Card>
          ) : null}

          {/* Basics */}
          <Field label="Name">
            <Input value={form.name} onChangeText={(t) => set({ name: t })} maxLength={MAX_PRODUCT_NAME} placeholder="e.g. Ankara tote bag" />
          </Field>
          <Field label="Description">
            <Input
              value={form.description}
              onChangeText={(t) => set({ description: t })}
              maxLength={MAX_DESCRIPTION}
              multiline
              placeholder="Optional"
              style={{ height: 100, alignItems: "flex-start", paddingTop: 10 }}
            />
          </Field>
          <Field label="SKU" hint={`Optional, up to ${MAX_PRODUCT_SKU} characters.`}>
            <Input value={form.sku} onChangeText={(t) => set({ sku: t })} maxLength={MAX_PRODUCT_SKU} autoCapitalize="characters" />
          </Field>

          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Field label={`Price (${currency})`}>
                <Input value={form.price} onChangeText={(t) => set({ price: decimal(t) })} keyboardType="decimal-pad" placeholder="0.00" />
              </Field>
            </View>
            <View style={{ flex: 1 }}>
              <Field label="Discount price">
                <Input value={form.discountPrice} onChangeText={(t) => set({ discountPrice: decimal(t) })} keyboardType="decimal-pad" placeholder="Optional" />
              </Field>
            </View>
          </View>
          <Field label="Cost price" hint="Optional — what it costs you; used for profit reports.">
            <Input value={form.costPrice} onChangeText={(t) => set({ costPrice: decimal(t) })} keyboardType="decimal-pad" placeholder="0.00" />
          </Field>

          <SelectField label="Category" value={form.categoryId} options={catOptions} onChange={(v) => set({ categoryId: v })} placeholder="No category" />
          {form.categoryId === "__new" ? (
            <Field label="New category name">
              <Input value={newCat} onChangeText={setNewCat} placeholder="e.g. Bags" />
            </Field>
          ) : null}
          <SelectField label="Unit" value={form.unitId} options={unitOptions} onChange={(v) => set({ unitId: v })} placeholder="No unit" />
          {form.unitId === "__new" ? (
            <Field label="New unit name">
              <Input value={newUnit} onChangeText={setNewUnit} placeholder="e.g. Piece" />
            </Field>
          ) : null}

          <Field label="Restock alert level" hint="Alert when stock falls to this number or below.">
            <Input value={form.lowStockThreshold} onChangeText={(t) => set({ lowStockThreshold: digits(t) })} keyboardType="number-pad" placeholder="Optional" />
          </Field>
          <DateField label="Expiry date" value={form.expiryDate} onChange={(v) => set({ expiryDate: v })} optional />

          {/* Images */}
          <SectionTitle>Photos</SectionTitle>
          <T w="regular" size={12} color={C.ink400} style={{ marginTop: -8 }}>
            Photo upload isn't available in the app yet — paste an image URL. Up to {MAX_IMAGES}; tap one to make it the cover.
          </T>
          {form.images.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
              {form.images.map((u) => {
                const cover = (form.coverImageUrl || form.images[0]) === u;
                return (
                  <Pressable key={u} onPress={() => set({ coverImageUrl: u })} style={{ width: 92 }}>
                    <Image source={{ uri: u }} style={{ width: 92, height: 92, borderRadius: 16, backgroundColor: C.cream100, borderWidth: 2, borderColor: cover ? C.brand : C.cream200 }} contentFit="cover" />
                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 4 }}>
                      <T w="bold" size={11} color={cover ? C.brand : C.ink400}>
                        {cover ? "Cover" : "Photo"}
                      </T>
                      <Pressable onPress={() => removeImage(u)} hitSlop={8}>
                        <Ionicons name="trash-outline" size={15} color={C.danger500} />
                      </Pressable>
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
          ) : null}
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Input style={{ flex: 1 }} value={imageUrl} onChangeText={setImageUrl} placeholder="https://…" autoCapitalize="none" autoCorrect={false} keyboardType="url" onSubmitEditing={addImage} />
            <Button label="Add" small onPress={addImage} style={{ height: 52 }} />
          </View>

          {/* Create-only stock / variants */}
          {isNew ? (
            <>
              <SectionTitle>Stock and variants</SectionTitle>
              <T w="regular" size={12} color={C.ink400} style={{ marginTop: -8 }}>
                Choose one: opening stock, option dimensions (a generated grid) or a manual variant list. You can adjust stock per branch after saving.
              </T>
              <Field label="Opening stock" hint="Optional, 1 – 1,000,000.">
                <Input value={form.initialStock} onChangeText={(t) => set({ initialStock: digits(t) })} keyboardType="number-pad" placeholder="0" />
              </Field>

              <Card style={{ padding: 14, gap: 10 }}>
                <T w="extra" size={14}>
                  Option dimensions
                </T>
                <T w="regular" size={12} color={C.ink400}>
                  Up to {MAX_OPTIONS}. Colour [Red, Blue] × Size [S, M] makes 4 variants.
                </T>
                {createOptions.map((o) => (
                  <View key={o.key} style={{ gap: 6 }}>
                    <View style={{ flexDirection: "row", gap: 8 }}>
                      <Input style={{ flex: 1 }} value={o.name} maxLength={MAX_OPTION_NAME} placeholder="Colour" onChangeText={(t) => setCreateOptions((l) => l.map((x) => (x.key === o.key ? { ...x, name: t } : x)))} />
                      <Pressable onPress={() => setCreateOptions((l) => l.filter((x) => x.key !== o.key))} style={{ width: 52, height: 52, borderRadius: 15, backgroundColor: C.danger100, alignItems: "center", justifyContent: "center" }}>
                        <Ionicons name="trash-outline" size={18} color={C.danger500} />
                      </Pressable>
                    </View>
                    <Input value={o.values} placeholder="Red, Blue" onChangeText={(t) => setCreateOptions((l) => l.map((x) => (x.key === o.key ? { ...x, values: t } : x)))} />
                  </View>
                ))}
                <Button small variant="outline" icon="add" label="Add dimension" disabled={createOptions.length >= MAX_OPTIONS} onPress={() => setCreateOptions((l) => [...l, { key: Date.now(), name: "", values: "" }])} />
              </Card>

              <Card style={{ padding: 14, gap: 10 }}>
                <T w="extra" size={14}>
                  Manual variants
                </T>
                {variantRows.map((v) => {
                  const upd = (patch: Partial<VariantRow>) => setVariantRows((l) => l.map((x) => (x.key === v.key ? { ...x, ...patch } : x)));
                  return (
                    <View key={v.key} style={{ gap: 6, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: C.cream100 }}>
                      <View style={{ flexDirection: "row", gap: 8 }}>
                        <Input style={{ flex: 1 }} value={v.name} maxLength={MAX_VARIANT_NAME} placeholder="Variant name" onChangeText={(t) => upd({ name: t })} />
                        <Pressable onPress={() => setVariantRows((l) => l.filter((x) => x.key !== v.key))} style={{ width: 52, height: 52, borderRadius: 15, backgroundColor: C.danger100, alignItems: "center", justifyContent: "center" }}>
                          <Ionicons name="trash-outline" size={18} color={C.danger500} />
                        </Pressable>
                      </View>
                      <View style={{ flexDirection: "row", gap: 8 }}>
                        <Input style={{ flex: 1 }} value={v.sellingPrice} placeholder="Price" keyboardType="decimal-pad" onChangeText={(t) => upd({ sellingPrice: decimal(t) })} />
                        <Input style={{ flex: 1 }} value={v.initialStock} placeholder="Stock" keyboardType="number-pad" onChangeText={(t) => upd({ initialStock: digits(t) })} />
                      </View>
                      <Input value={v.sku} placeholder="SKU (optional)" maxLength={MAX_PRODUCT_SKU} autoCapitalize="characters" onChangeText={(t) => upd({ sku: t })} />
                    </View>
                  );
                })}
                <Button small variant="outline" icon="add" label="Add variant" disabled={variantRows.length >= MAX_VARIANTS} onPress={() => setVariantRows((l) => [...l, { key: Date.now(), name: "", sellingPrice: "", sku: "", initialStock: "" }])} />
              </Card>
            </>
          ) : null}

          <Button label={isNew ? "Create product" : "Save changes"} busy={busy} onPress={submit} />

          {/* Edit-only: stock, variants, delete */}
          {product ? (
            <>
              <SectionTitle>Stock</SectionTitle>
              <Card style={{ paddingHorizontal: 14, paddingVertical: 4 }}>
                <DetailRow label={product.variants?.length ? "Total across variants" : "Total in stock"} value={stockTotal.toLocaleString()} strong />
                {branchRows.map((b: any, i: number) => (
                  <DetailRow key={(b.branchId || b.id || "") + i} label={b.branchName || b.branch?.name || b.name || "Branch"} value={rawNum(b.quantity).toLocaleString()} />
                ))}
              </Card>
              <Button label="Adjust stock" variant="dark" icon="swap-vertical" onPress={() => setAdjustOpen(true)} />

              <ProductVariantsSection product={product} currency={currency} onChanged={(next) => setProduct(next)} />

              <Button label="Delete product" variant="danger" icon="trash-outline" onPress={() => setDelOpen(true)} />
            </>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>

      <StockAdjustSheet open={adjustOpen} onClose={() => setAdjustOpen(false)} product={product} branches={branches} onDone={() => loadProduct(true)} />
      <ConfirmSheet
        open={delOpen}
        title="Delete this product?"
        message={`"${product?.name || "This product"}" will be removed from your catalogue.`}
        confirmLabel="Delete"
        danger
        busy={delBusy}
        onConfirm={confirmDelete}
        onClose={() => setDelOpen(false)}
      />
    </Page>
  );
}
