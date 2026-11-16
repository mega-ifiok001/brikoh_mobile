import { useCallback, useEffect, useState } from "react";
import { FlatList, KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../src/context/AuthContext";
import { api } from "../../src/lib/api";
import { getAccess } from "../../src/lib/access";
import { apiErrorMessage, asList, fd } from "../../src/lib/format";
import { Button, Card, EmptyState, ErrorState, Field, Input, ListSkeleton, Pill, Sheet, T, toast } from "../../src/components/ui";
import { AddButton, ConfirmSheet, DetailRow, Page, SelectField } from "../../src/components/kit";
import { C } from "../../src/theme";

export default function Branches() {
  const { me } = useAuth();
  const allowed = getAccess(me).can("branches");
  const defaultId = (me.store as any)?.defaultBranchId;

  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [detail, setDetail] = useState<any | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState({ name: "", address: "" });
  const [formBusy, setFormBusy] = useState(false);
  const [formErr, setFormErr] = useState("");

  const [delFor, setDelFor] = useState<any | null>(null);
  const [delBusy, setDelBusy] = useState(false);

  const [transferOpen, setTransferOpen] = useState(false);
  const [tFrom, setTFrom] = useState("");
  const [tTo, setTTo] = useState("");
  const [tProductId, setTProductId] = useState("");
  const [tVariantId, setTVariantId] = useState("");
  const [tQty, setTQty] = useState("1");
  const [tBusy, setTBusy] = useState(false);
  const [tErr, setTErr] = useState("");
  const [products, setProducts] = useState<any[]>([]);

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    setError(null);
    try {
      const res: any = await api.get("/api/dashboard/branches");
      setItems(asList(res, "items", "branches", "data"));
    } catch (e: any) {
      setError(apiErrorMessage(e, "Couldn't load branches."));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (allowed) load();
  }, [load, allowed]);

  const isDefaultBranch = (b: any) => !!b && (b.isDefault === true || (!!defaultId && b.id === defaultId));

  const openDetail = async (b: any) => {
    setDetail(b);
    try {
      const res: any = await api.get(`/api/dashboard/branches/${b.id}`);
      setDetail(res?.branch ?? res ?? b);
    } catch {
      // keep list row data
    }
  };

  const openCreate = () => {
    setEditing(null);
    setForm({ name: "", address: "" });
    setFormErr("");
    setFormOpen(true);
  };

  const openEdit = (b: any) => {
    setDetail(null);
    setEditing(b);
    setForm({ name: b.name || "", address: b.address || "" });
    setFormErr("");
    setFormOpen(true);
  };

  const submit = async () => {
    if (!form.name.trim()) return setFormErr("Branch name is required.");
    setFormBusy(true);
    setFormErr("");
    try {
      const payload = { name: form.name.trim(), address: form.address.trim() || null };
      if (editing) {
        await api.patch(`/api/dashboard/branches/${editing.id}`, payload);
        toast.success("Branch updated.");
      } else {
        await api.post("/api/dashboard/branches", payload);
        toast.success("Branch added.");
      }
      setFormOpen(false);
      await load(true);
    } catch (e: any) {
      setFormErr(
        apiErrorMessage(e, "Couldn't save the branch.", {
          LOCATION_LIMIT_REACHED: "You have reached your plan's location limit. Upgrade to add more.",
        })
      );
    } finally {
      setFormBusy(false);
    }
  };

  const setDefault = async (b: any) => {
    try {
      await api.put(`/api/dashboard/branches/${b.id}/default`);
      toast.success(`${b.name} is now your default branch.`);
      setDetail((d: any) => (d && d.id === b.id ? { ...d, isDefault: true } : d));
      await load(true);
    } catch (e: any) {
      toast.error(apiErrorMessage(e, "Couldn't change the default branch."));
    }
  };

  const confirmDelete = async () => {
    if (!delFor) return;
    setDelBusy(true);
    try {
      await api.del(`/api/dashboard/branches/${delFor.id}`);
      toast.success("Branch deleted.");
      if (detail?.id === delFor.id) setDetail(null);
      setDelFor(null);
      load(true);
    } catch (e: any) {
      toast.error(
        apiErrorMessage(e, "Couldn't delete the branch. It may still hold stock or have orders.", {
          DEFAULT_BRANCH: "You can't delete the default branch. Make another branch default first.",
          BRANCH_HAS_STOCK: "This branch still holds stock. Transfer everything out first.",
          BRANCH_HAS_ORDERS: "This branch has order history and can't be deleted.",
        })
      );
    } finally {
      setDelBusy(false);
    }
  };

  const openTransfer = (fromBranchId?: string) => {
    if (items.length < 2) {
      toast.info("You need at least two branches to transfer stock.");
      return;
    }
    const from = items.find((b) => b.id === fromBranchId) || items.find((b) => isDefaultBranch(b)) || items[0];
    const other = items.find((b) => b.id !== from?.id) || items[0];
    setDetail(null);
    setTFrom(from?.id || "");
    setTTo(other?.id || "");
    setTProductId("");
    setTVariantId("");
    setTQty("1");
    setTErr("");
    setTransferOpen(true);
    api
      .get("/api/dashboard/products?limit=100")
      .then((res: any) => setProducts(asList(res, "products", "items", "data")))
      .catch(() => setProducts([]));
  };

  const tProduct = products.find((p) => p.id === tProductId);

  const submitTransfer = async () => {
    const qty = parseInt(tQty, 10) || 0;
    if (!tProductId) return setTErr("Pick the product to move.");
    if (qty < 1) return setTErr("Quantity must be at least 1.");
    if (tFrom === tTo) return setTErr("Source and destination must be different.");
    if (tProduct?.variants?.length && !tVariantId) return setTErr("This product has variants. Pick one.");

    setTBusy(true);
    setTErr("");
    try {
      await api.post("/api/dashboard/branches/transfers", {
        productId: tProductId,
        variantId: tVariantId || undefined,
        sourceBranchId: tFrom,
        destinationBranchId: tTo,
        quantity: qty,
      });
      toast.success(`Moved ${qty} x ${tProduct?.name || "product"} to ${items.find((b) => b.id === tTo)?.name}.`);
      setTransferOpen(false);
      load(true);
    } catch (e: any) {
      setTErr(apiErrorMessage(e, "Couldn't record the transfer."));
    } finally {
      setTBusy(false);
    }
  };

  if (!allowed) {
    return (
      <Page title="Branches">
        <EmptyState icon="lock-closed-outline" title="No access" sub="Your role doesn't include branches. Ask the store owner to grant it." />
      </Page>
    );
  }

  const branchOptions = items.map((b) => ({ value: String(b.id), label: b.name }));

  return (
    <Page title="Branches" right={<AddButton onPress={openCreate} />}>
      {error && !items.length ? (
        <ErrorState message={error} onRetry={() => load()} />
      ) : (
        <FlatList
          data={loading ? [] : items}
          keyExtractor={(x) => String(x.id)}
          contentContainerStyle={{ padding: 16, paddingBottom: 30, gap: 10 }}
          showsVerticalScrollIndicator={false}
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            load(true);
          }}
          ListHeaderComponent={
            <View style={{ gap: 10, marginBottom: 4 }}>
              <T w="regular" size={12.5} color={C.ink400}>
                Shops, warehouses and stalls where your stock lives. Checkout and new product stock use the default branch.
              </T>
              {items.length > 1 ? <Button label="Transfer stock" icon="swap-horizontal" variant="outline" onPress={() => openTransfer()} small /> : null}
            </View>
          }
          ListEmptyComponent={
            loading ? (
              <View style={{ marginHorizontal: -16 }}>
                <ListSkeleton rows={3} />
              </View>
            ) : (
              <EmptyState
                icon="business-outline"
                title="No branches"
                sub="Every store starts with a Main Branch. Add more locations to track stock separately."
                action={<Button label="Add a branch" icon="add" onPress={openCreate} small />}
              />
            )
          }
          renderItem={({ item: b }) => {
            const isDef = isDefaultBranch(b);
            return (
              <Card onPress={() => openDetail(b)} style={{ padding: 14 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                  <View style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: C.brand50 ?? C.cream100, alignItems: "center", justifyContent: "center" }}>
                    <Ionicons name={isDef ? "storefront-outline" : "business-outline"} size={21} color={C.brand} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <T w="extra" size={15} numberOfLines={1} style={{ flexShrink: 1 }}>
                        {b.name}
                      </T>
                      {isDef ? <Pill tone="dark">Default</Pill> : null}
                    </View>
                    <T w="regular" size={12.5} color={C.ink400} numberOfLines={1}>
                      {b.address || "No address set"}
                    </T>
                    <T w="regular" size={11} color={C.ink300 ?? C.ink400} style={{ marginTop: 2 }}>
                      Added {fd(b.createdAt)}
                    </T>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={C.ink400} />
                </View>
              </Card>
            );
          }}
        />
      )}

      <Sheet
        open={!!detail}
        onClose={() => setDetail(null)}
        title={detail?.name || "Branch"}
        footer={
          detail ? (
            <View style={{ gap: 8 }}>
              <Button label="Edit name / address" icon="create-outline" onPress={() => openEdit(detail)} />
              {items.length > 1 ? <Button label="Transfer from here" icon="swap-horizontal" variant="outline" onPress={() => openTransfer(detail.id)} /> : null}
              {!isDefaultBranch(detail) ? <Button label="Make default" variant="outline" onPress={() => setDefault(detail)} /> : null}
              <Button
                label="Delete branch"
                variant="ghost"
                onPress={() => {
                  setDelFor(detail);
                }}
              />
            </View>
          ) : undefined
        }
      >
        {detail ? (
          <View style={{ paddingHorizontal: 18, gap: 10, paddingBottom: 8 }}>
            <T w="regular" size={12.5} color={C.ink400}>
              {isDefaultBranch(detail) ? "Default branch. Checkout and new product stock land here." : "Stock location for this store. Not the default branch."}
            </T>
            <DetailRow label="Address" value={detail.address || "No address set"} />
            <DetailRow label="Created" value={fd(detail.createdAt)} />
            {detail.updatedAt ? <DetailRow label="Updated" value={fd(detail.updatedAt)} /> : null}
            <T w="regular" size={12} color={C.ink400}>
              You can't delete a branch that still holds stock or has past orders. Transfer stock out first.
            </T>
          </View>
        ) : null}
      </Sheet>

      <Sheet
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? `Edit ${editing.name}` : "New branch"}
        footer={<Button label="Save branch" icon="checkmark" onPress={submit} busy={formBusy} />}
      >
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <ScrollView style={{ maxHeight: 360 }} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 18, gap: 12, paddingBottom: 6 }}>
            {formErr ? (
              <T w="bold" size={12.5} color={C.danger500}>
                {formErr}
              </T>
            ) : null}
            <Field label="Name">
              <Input value={form.name} onChangeText={(t) => setForm({ ...form, name: t })} placeholder="e.g. Balogun Market Stall" />
            </Field>
            <Field label="Address" hint="Optional. Helps staff know which location.">
              <Input value={form.address} onChangeText={(t) => setForm({ ...form, address: t })} placeholder="Street, town" />
            </Field>
          </ScrollView>
        </KeyboardAvoidingView>
      </Sheet>

      <Sheet
        open={transferOpen}
        onClose={() => setTransferOpen(false)}
        title="Transfer stock"
        footer={<Button label="Move stock" icon="swap-horizontal" onPress={submitTransfer} busy={tBusy} />}
      >
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <ScrollView style={{ maxHeight: 460 }} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 18, gap: 12, paddingBottom: 6 }}>
            <T w="regular" size={12.5} color={C.ink400}>
              Moves quantity between branches in one step. Source stock can never go negative.
            </T>
            {tErr ? (
              <T w="bold" size={12.5} color={C.danger500}>
                {tErr}
              </T>
            ) : null}
            <SelectField label="From" value={tFrom} options={branchOptions} onChange={setTFrom} />
            <SelectField label="To" value={tTo} options={branchOptions} onChange={setTTo} />
            <SelectField
              label="Product"
              value={tProductId}
              options={products.map((p) => ({ value: String(p.id), label: p.name }))}
              placeholder="Choose a product"
              onChange={(v) => {
                setTProductId(v);
                setTVariantId("");
              }}
            />
            {tProduct?.variants?.length > 0 ? (
              <SelectField
                label="Variant"
                value={tVariantId}
                options={tProduct.variants.map((v: any) => ({ value: String(v.id), label: v.name }))}
                placeholder="Choose variant"
                onChange={setTVariantId}
              />
            ) : null}
            <Field label="Quantity">
              <Input value={tQty} onChangeText={(t) => setTQty(t.replace(/[^0-9]/g, ""))} keyboardType="number-pad" />
            </Field>
          </ScrollView>
        </KeyboardAvoidingView>
      </Sheet>

      <ConfirmSheet
        open={!!delFor}
        onClose={() => setDelFor(null)}
        onConfirm={confirmDelete}
        busy={delBusy}
        danger
        title={`Delete "${delFor?.name || ""}"?`}
        message="The default branch can't be deleted. A branch that still holds stock or has order history must be emptied first."
        confirmLabel="Delete branch"
      />
    </Page>
  );
}
