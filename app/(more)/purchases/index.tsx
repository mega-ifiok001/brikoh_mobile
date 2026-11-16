import { useCallback, useEffect, useState } from "react";
import { FlatList, ScrollView, View } from "react-native";
import { router } from "expo-router";
import { useAuth } from "../../../src/context/AuthContext";
import { getAccess } from "../../../src/lib/access";
import { api } from "../../../src/lib/api";
import { usePaged } from "../../../src/lib/usePaged";
import { apiErrorMessage, asList, fd, rawNum, titleCase } from "../../../src/lib/format";
import { Button, Card, Chip, EmptyState, ErrorState, Field, Input, ListSkeleton, Money, Pill, StatusPill, T, toast } from "../../../src/components/ui";
import { AddButton, ConfirmSheet, Page, Segmented, SelectField, SwitchRow } from "../../../src/components/kit";
import { ErrorBanner, FormSheet, useRefreshOnFocus } from "../../../src/components/invoices/shared";
import { C } from "../../../src/theme";

const STATUSES = ["ALL", "DRAFT", "ORDERED", "PARTIALLY_RECEIVED", "RECEIVED", "CANCELLED"] as const;

const EMPTY_FORM = { name: "", contactName: "", phone: "", email: "", address: "", notes: "", isActive: true };

export default function PurchasesIndex() {
  const { me } = useAuth();
  const currency: string = (me.store as any)?.currency || "NGN";
  const allowed = getAccess(me).can("purchases");
  const [tab, setTab] = useState<"pos" | "suppliers">("pos");
  const [supplierFormSignal, setSupplierFormSignal] = useState(0);

  if (!allowed) {
    return (
      <Page title="Purchases">
        <EmptyState icon="lock-closed-outline" title="No access" sub="Your role doesn't include purchases. Ask the store owner to grant it." />
      </Page>
    );
  }

  return (
    <Page
      title="Purchases"
      right={<AddButton onPress={() => (tab === "pos" ? router.push("/purchases/new") : setSupplierFormSignal((n) => n + 1))} />}
    >
      <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
        <Segmented
          options={[
            { value: "pos", label: "Purchase orders" },
            { value: "suppliers", label: "Suppliers" },
          ]}
          value={tab}
          onChange={(v) => setTab(v as "pos" | "suppliers")}
        />
      </View>
      <View style={{ flex: 1 }}>{tab === "pos" ? <PurchaseOrders currency={currency} /> : <Suppliers currency={currency} addSignal={supplierFormSignal} />}</View>
    </Page>
  );
}

/* ------------------------------- Purchase orders ------------------------------ */

function PurchaseOrders({ currency }: { currency: string }) {
  const [statusF, setStatusF] = useState<(typeof STATUSES)[number]>("ALL");
  const [supplierF, setSupplierF] = useState("");
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const { items, loading, loadingMore, error, hasMore, refresh, loadMore } = usePaged(
    "/api/dashboard/purchase-orders",
    { status: statusF === "ALL" ? undefined : statusF, supplierId: supplierF || undefined },
    ["items", "purchaseOrders", "orders", "data"],
    { limit: 24 }
  );

  useEffect(() => {
    api
      .get("/api/dashboard/suppliers")
      .then((res) => setSuppliers(asList(res, "items", "suppliers", "data")))
      .catch(() => setSuppliers([]));
  }, []);

  useRefreshOnFocus(() => {
    refresh();
  });

  const header = (
    <View style={{ gap: 12, marginBottom: 4 }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }} keyboardShouldPersistTaps="handled">
        {STATUSES.map((s) => (
          <Chip key={s} label={s === "ALL" ? "All" : titleCase(s).replace("Partially Received", "Partial")} on={statusF === s} onPress={() => setStatusF(s)} />
        ))}
      </ScrollView>
      {suppliers.length > 0 ? (
        <SelectField
          value={supplierF}
          placeholder="All suppliers"
          options={[{ value: "", label: "All suppliers" }, ...suppliers.map((s) => ({ value: s.id, label: s.name }))]}
          onChange={setSupplierF}
        />
      ) : null}
    </View>
  );

  if (error && !items.length) {
    return <ErrorState message={error} onRetry={refresh} />;
  }

  const filtered = statusF !== "ALL" || !!supplierF;

  return (
    <FlatList
      data={loading ? [] : items}
      keyExtractor={(i) => String(i.id)}
      contentContainerStyle={{ padding: 16, paddingBottom: 30, gap: 10 }}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      refreshing={refreshing}
      onRefresh={async () => {
        setRefreshing(true);
        await refresh();
        setRefreshing(false);
      }}
      onEndReachedThreshold={0.4}
      onEndReached={() => {
        if (hasMore && !loadingMore && !loading) loadMore();
      }}
      ListHeaderComponent={header}
      ListEmptyComponent={
        loading ? (
          <View style={{ marginHorizontal: -16 }}>
            <ListSkeleton rows={5} />
          </View>
        ) : (
          <EmptyState
            icon="cube-outline"
            title={filtered ? "No purchase orders match" : "No purchase orders"}
            sub={filtered ? "Try a different filter." : "Order goods from a supplier, then record the delivery. Stock lands in your chosen branch automatically."}
            action={filtered ? undefined : <Button label="Create a purchase order" icon="add" small onPress={() => router.push("/purchases/new")} />}
          />
        )
      }
      ListFooterComponent={loadingMore ? <ListSkeleton rows={1} /> : undefined}
      renderItem={({ item: po }) => {
        const paid = rawNum(po.amountPaid);
        return (
          <Card onPress={() => router.push(`/purchases/${po.id}`)} style={{ padding: 14, gap: 8 }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
              <T w="extra" size={14.5} style={{ flex: 1 }} numberOfLines={1}>
                {po.number || "Draft"}
              </T>
              <StatusPill status={po.status} />
            </View>
            <T w="semi" size={13} color={C.ink500} numberOfLines={1}>
              {po.supplier?.name || po.supplierName || "No supplier"}
              {po.branch?.name ? ` · ${po.branch.name}` : ""}
            </T>
            <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" }}>
              <View>
                <T w="regular" size={11.5} color={C.ink400}>
                  {po.expectedDeliveryDate ? `Expected ${fd(po.expectedDeliveryDate)}` : "No expected date"}
                </T>
                {paid > 0 ? (
                  <T w="semi" size={11.5} color={C.leaf500}>
                    Paid {paid.toLocaleString()}
                  </T>
                ) : null}
              </View>
              <Money v={po.total} currency={currency} size={15} />
            </View>
          </Card>
        );
      }}
    />
  );
}

/* --------------------------------- Suppliers --------------------------------- */

function Suppliers({ currency, addSignal }: { currency: string; addSignal: number }) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formBusy, setFormBusy] = useState(false);
  const [formErr, setFormErr] = useState("");
  const [delFor, setDelFor] = useState<any | null>(null);
  const [delBusy, setDelBusy] = useState(false);

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    setError(null);
    try {
      const res = await api.get("/api/dashboard/suppliers");
      setItems(asList(res, "items", "suppliers", "data"));
    } catch (e: any) {
      setError(apiErrorMessage(e, "Couldn't load suppliers."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);
  useRefreshOnFocus(() => {
    load(true);
  });

  const openCreate = useCallback(() => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormErr("");
    setFormOpen(true);
  }, []);

  // The header "+" lives in the parent; it bumps this counter to open the create sheet.
  useEffect(() => {
    if (addSignal > 0) openCreate();
  }, [addSignal, openCreate]);

  const openEdit = (s: any) => {
    setEditing(s);
    setForm({
      name: s.name || "",
      contactName: s.contactName || "",
      phone: s.phone || "",
      email: s.email || "",
      address: s.address || "",
      notes: s.notes || "",
      isActive: s.isActive !== false,
    });
    setFormErr("");
    setFormOpen(true);
  };

  const submit = async () => {
    if (!form.name.trim()) return setFormErr("Supplier name is required.");
    setFormBusy(true);
    setFormErr("");
    const payload = {
      name: form.name.trim(),
      contactName: form.contactName.trim() || undefined,
      phone: form.phone.trim() || undefined,
      email: form.email.trim() || undefined,
      address: form.address.trim() || undefined,
      notes: form.notes.trim() || undefined,
      isActive: form.isActive,
    };
    try {
      if (editing) {
        await api.put(`/api/dashboard/suppliers/${editing.id}`, payload);
        toast.success("Supplier updated.");
      } else {
        await api.post("/api/dashboard/suppliers", payload);
        toast.success("Supplier added.");
      }
      setFormOpen(false);
      load(true);
    } catch (e: any) {
      setFormErr(apiErrorMessage(e, "Couldn't save the supplier.", { SUPPLIER_NAME_TAKEN: "Another supplier already uses that name." }));
    } finally {
      setFormBusy(false);
    }
  };

  const confirmDelete = async () => {
    if (!delFor) return;
    setDelBusy(true);
    try {
      await api.del(`/api/dashboard/suppliers/${delFor.id}`);
      toast.success("Supplier removed.");
      setDelFor(null);
      load(true);
    } catch (e: any) {
      toast.error(apiErrorMessage(e, "Couldn't remove the supplier.", { SUPPLIER_HAS_ORDERS: "This supplier has purchase orders. Mark them inactive instead." }));
      setDelFor(null);
    } finally {
      setDelBusy(false);
    }
  };

  const set = (k: keyof typeof EMPTY_FORM) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <View style={{ flex: 1 }}>
      {error && !items.length ? (
        <ErrorState message={error} onRetry={() => load()} />
      ) : (
        <FlatList
          data={loading ? [] : items}
          keyExtractor={(s) => String(s.id)}
          contentContainerStyle={{ padding: 16, paddingBottom: 30, gap: 10 }}
          showsVerticalScrollIndicator={false}
          refreshing={refreshing}
          onRefresh={async () => {
            setRefreshing(true);
            await load(true);
            setRefreshing(false);
          }}
          ListEmptyComponent={
            loading ? (
              <View style={{ marginHorizontal: -16 }}>
                <ListSkeleton rows={4} />
              </View>
            ) : (
              <EmptyState
                icon="people-outline"
                title="No suppliers yet"
                sub="Add the people and companies you buy from. You'll order against them here."
                action={<Button label="Add a supplier" icon="add" small onPress={openCreate} />}
              />
            )
          }
          renderItem={({ item: s }) => {
            const due = rawNum(s.balanceDue);
            const active = s.isActive !== false;
            return (
              <Card onPress={() => openEdit(s)} style={{ padding: 14, gap: 6 }}>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                  <T w="extra" size={14.5} style={{ flex: 1 }} numberOfLines={1}>
                    {s.name}
                  </T>
                  <Pill tone={active ? "green" : "neutral"}>{active ? "Active" : "Inactive"}</Pill>
                </View>
                <T w="semi" size={12.5} color={C.ink500} numberOfLines={1}>
                  {[s.contactName, s.phone, s.email].filter(Boolean).join(" · ") || "No contact details"}
                </T>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <T w="regular" size={11.5} color={C.ink400}>
                    {s.purchaseOrderCount != null ? `${s.purchaseOrderCount} order${s.purchaseOrderCount === 1 ? "" : "s"}` : " "}
                  </T>
                  {due > 0 ? (
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <T w="semi" size={11.5} color={C.gold600}>
                        Balance due
                      </T>
                      <Money v={s.balanceDue} currency={currency} size={13.5} />
                    </View>
                  ) : null}
                </View>
              </Card>
            );
          }}
        />
      )}

      <FormSheet
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? `Edit ${editing.name}` : "Add supplier"}
        maxHeight={440}
        footer={
          <View style={{ gap: 10 }}>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <Button label="Cancel" variant="outline" onPress={() => setFormOpen(false)} disabled={formBusy} style={{ flex: 1 }} />
              <Button label="Save supplier" icon="checkmark" onPress={submit} busy={formBusy} style={{ flex: 1.6 }} />
            </View>
            {editing ? (
              <Button
                label="Remove supplier"
                icon="trash-outline"
                variant="danger"
                disabled={formBusy}
                onPress={() => {
                  setFormOpen(false);
                  setDelFor(editing);
                }}
              />
            ) : null}
          </View>
        }
      >
        <ErrorBanner message={formErr} />
        <Field label="Name">
          <Input value={form.name} onChangeText={set("name")} placeholder="e.g. Mama Ada Wholesale" />
        </Field>
        <Field label="Contact person">
          <Input value={form.contactName} onChangeText={set("contactName")} />
        </Field>
        <Field label="Phone">
          <Input value={form.phone} onChangeText={set("phone")} keyboardType="phone-pad" />
        </Field>
        <Field label="Email">
          <Input value={form.email} onChangeText={set("email")} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />
        </Field>
        <Field label="Address">
          <Input value={form.address} onChangeText={set("address")} />
        </Field>
        <Field label="Notes">
          <Input value={form.notes} onChangeText={set("notes")} placeholder="Anything worth remembering" />
        </Field>
        <SwitchRow label="Active" sub="Available for new purchase orders" value={form.isActive} onChange={(v) => setForm((f) => ({ ...f, isActive: v }))} />
      </FormSheet>

      <ConfirmSheet
        open={!!delFor}
        onClose={() => setDelFor(null)}
        onConfirm={confirmDelete}
        busy={delBusy}
        danger
        title={`Remove "${delFor?.name || ""}"?`}
        message="Suppliers with purchase orders can't be removed. Mark them inactive instead."
        confirmLabel="Remove supplier"
      />
    </View>
  );
}
