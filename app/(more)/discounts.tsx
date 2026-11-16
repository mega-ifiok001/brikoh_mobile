import { useState } from "react";
import { FlatList, KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../src/context/AuthContext";
import { api } from "../../src/lib/api";
import { getAccess } from "../../src/lib/access";
import { usePaged } from "../../src/lib/usePaged";
import { apiErrorMessage, fd, rawNum } from "../../src/lib/format";
import { Button, Card, EmptyState, ErrorState, Field, Input, ListSkeleton, Money, Pill, Sheet, T, toast } from "../../src/components/ui";
import { AddButton, ConfirmSheet, Page, Segmented, SwitchRow } from "../../src/components/kit";
import { DateField, isValidDate } from "../../src/components/expenses/DateField";
import { C } from "../../src/theme";

type FormState = {
  name: string;
  type: "PERCENTAGE" | "FIXED";
  value: string;
  code: string;
  startsAt: string;
  endsAt: string;
  isActive: boolean;
};

const BLANK: FormState = { name: "", type: "PERCENTAGE", value: "", code: "", startsAt: "", endsAt: "", isActive: true };

const isCoupon = (d: any) =>
  !!d.code && (d.maxUses != null || d.firstOrderOnly === true || d.minSubtotal != null || d.perCustomerUses != null);

export default function Discounts() {
  const { me } = useAuth();
  const currency: string = (me.store as any)?.currency || "NGN";
  const allowed = getAccess(me).can("discounts");

  const { items, loading, loadingMore, error, refresh, loadMore, setItems } = usePaged(
    "/api/dashboard/discounts",
    {},
    ["items", "discounts", "data"],
    { limit: 24 }
  );
  const [refreshing, setRefreshing] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState<FormState>(BLANK);
  const [formBusy, setFormBusy] = useState(false);
  const [formErr, setFormErr] = useState("");

  const [delFor, setDelFor] = useState<any | null>(null);
  const [delBusy, setDelBusy] = useState(false);

  const openCreate = () => {
    setEditing(null);
    setForm(BLANK);
    setFormErr("");
    setFormOpen(true);
  };

  const openEdit = (d: any) => {
    setEditing(d);
    setForm({
      name: d.name || "",
      type: d.type === "FIXED" ? "FIXED" : "PERCENTAGE",
      value: String(d.value ?? ""),
      code: d.code || "",
      startsAt: d.startsAt ? String(d.startsAt).slice(0, 10) : "",
      endsAt: d.endsAt ? String(d.endsAt).slice(0, 10) : "",
      isActive: d.isActive !== false,
    });
    setFormErr("");
    setFormOpen(true);
  };

  const submit = async () => {
    const v = parseFloat(form.value);
    if (!form.name.trim()) return setFormErr("Give the discount a name.");
    if (!isFinite(v) || v <= 0) return setFormErr("Enter a value greater than zero.");
    if (form.type === "PERCENTAGE" && v > 100) return setFormErr("Percentage can't be over 100.");
    if (form.startsAt && !isValidDate(form.startsAt)) return setFormErr("Start date must be YYYY-MM-DD.");
    if (form.endsAt && !isValidDate(form.endsAt)) return setFormErr("End date must be YYYY-MM-DD.");
    if (form.startsAt && form.endsAt && form.endsAt < form.startsAt) return setFormErr("End date must be after the start date.");

    setFormBusy(true);
    setFormErr("");
    const payload: any = {
      name: form.name.trim(),
      type: form.type,
      value: String(v),
      isActive: form.isActive,
    };
    if (editing) payload.code = form.code.trim() ? form.code.trim().toUpperCase() : null;
    else if (form.code.trim()) payload.code = form.code.trim().toUpperCase();
    payload.startsAt = form.startsAt ? new Date(form.startsAt + "T00:00:00.000Z").toISOString() : null;
    payload.endsAt = form.endsAt ? new Date(form.endsAt + "T23:59:59.000Z").toISOString() : null;

    try {
      if (editing) {
        await api.put(`/api/dashboard/discounts/${editing.id}`, payload);
        toast.success("Discount updated.");
      } else {
        await api.post("/api/dashboard/discounts", payload);
        toast.success("Discount created.");
      }
      setFormOpen(false);
      refresh();
    } catch (e: any) {
      setFormErr(apiErrorMessage(e, "Couldn't save the discount.", { DISCOUNT_CODE_TAKEN: "That code is already in use." }));
    } finally {
      setFormBusy(false);
    }
  };

  const toggleActive = async (d: any) => {
    const next = d.isActive === false;
    try {
      await api.put(`/api/dashboard/discounts/${d.id}`, { isActive: next });
      setItems((list) => list.map((x) => (x.id === d.id ? { ...x, isActive: next } : x)));
      toast.success(next ? "Discount activated." : "Discount paused.");
    } catch (e: any) {
      toast.error(apiErrorMessage(e, "Couldn't change the discount."));
    }
  };

  const confirmDelete = async () => {
    if (!delFor) return;
    setDelBusy(true);
    try {
      await api.del(`/api/dashboard/discounts/${delFor.id}`);
      toast.success("Discount deleted.");
      setDelFor(null);
      refresh();
    } catch (e: any) {
      toast.error(apiErrorMessage(e, "Couldn't delete the discount."));
    } finally {
      setDelBusy(false);
    }
  };

  if (!allowed) {
    return (
      <Page title="Discounts">
        <EmptyState icon="lock-closed-outline" title="No access" sub="Your role doesn't include discounts. Ask the store owner to grant it." />
      </Page>
    );
  }

  return (
    <Page title="Discounts" right={<AddButton onPress={openCreate} />}>
      {error && !items.length ? (
        <ErrorState message={error} onRetry={refresh} />
      ) : (
        <FlatList
          data={loading ? [] : items}
          keyExtractor={(x) => String(x.id)}
          contentContainerStyle={{ padding: 16, paddingBottom: 30, gap: 10 }}
          showsVerticalScrollIndicator={false}
          refreshing={refreshing}
          onRefresh={async () => {
            setRefreshing(true);
            await refresh();
            setRefreshing(false);
          }}
          onEndReached={loadMore}
          onEndReachedThreshold={0.4}
          ListHeaderComponent={
            <T w="regular" size={12.5} color={C.ink400} style={{ marginBottom: 4 }}>
              Cart-wide promos and coupon codes your customers can use at checkout.
            </T>
          }
          ListFooterComponent={loadingMore ? <ListSkeleton rows={1} /> : undefined}
          ListEmptyComponent={
            loading ? (
              <View style={{ marginHorizontal: -16 }}>
                <ListSkeleton rows={4} />
              </View>
            ) : (
              <EmptyState
                icon="pricetag-outline"
                title="No discounts yet"
                sub="Create a code like SAVE10 to hand out at the counter, or link one to a customer group for automatic discounts."
                action={<Button label="Create a discount" icon="add" onPress={openCreate} small />}
              />
            )
          }
          renderItem={({ item: d }) => {
            const active = d.isActive !== false;
            return (
              <Card onPress={() => openEdit(d)} style={{ padding: 14, gap: 8 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <View style={{ flex: 1 }}>
                    <T w="extra" size={14.5} numberOfLines={1}>
                      {d.name}
                    </T>
                    <T w="regular" size={11.5} color={C.ink400} style={{ marginTop: 2 }}>
                      {d.startsAt || d.endsAt ? `${fd(d.startsAt)} to ${fd(d.endsAt)}` : "Evergreen"}
                    </T>
                  </View>
                  {d.type === "PERCENTAGE" ? (
                    <T w="extra" size={15}>
                      {rawNum(d.value)}% off
                    </T>
                  ) : (
                    <Money v={d.value} currency={currency} size={15} />
                  )}
                </View>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
                  <Pill tone={active ? "green" : "neutral"}>{active ? "Active" : "Paused"}</Pill>
                  {d.code ? (
                    <View style={{ backgroundColor: C.cream100, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 }}>
                      <T w="extra" size={11} style={{ letterSpacing: 1 }}>
                        {d.code}
                      </T>
                    </View>
                  ) : null}
                  {isCoupon(d) ? (
                    <>
                      <Pill tone="brand">{d.maxUses ? `max ${d.maxUses}` : "coupon"}</Pill>
                      {d.minSubtotal != null ? <Pill>{`min ${rawNum(d.minSubtotal)}`}</Pill> : null}
                      {d.firstOrderOnly === true ? <Pill>1st order</Pill> : null}
                      {d.perCustomerUses != null && d.perCustomerUses !== 1 ? <Pill>{`${d.perCustomerUses}x / customer`}</Pill> : null}
                    </>
                  ) : null}
                  <View style={{ flex: 1 }} />
                  <Pressable onPress={() => toggleActive(d)} hitSlop={8} style={{ padding: 6 }}>
                    <Ionicons name={active ? "pause-circle-outline" : "play-circle-outline"} size={21} color={C.ink500} />
                  </Pressable>
                  <Pressable onPress={() => setDelFor(d)} hitSlop={8} style={{ padding: 6 }}>
                    <Ionicons name="trash-outline" size={19} color={C.danger500} />
                  </Pressable>
                </View>
              </Card>
            );
          }}
        />
      )}

      <Sheet
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? `Edit ${editing.name}` : "New discount"}
        footer={<Button label={editing ? "Save changes" : "Create discount"} icon="checkmark" onPress={submit} busy={formBusy} />}
      >
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <ScrollView style={{ maxHeight: 460 }} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 18, gap: 12, paddingBottom: 6 }}>
            {formErr ? (
              <T w="bold" size={12.5} color={C.danger500}>
                {formErr}
              </T>
            ) : null}
            <Field label="Name">
              <Input value={form.name} onChangeText={(t) => setForm({ ...form, name: t })} placeholder="e.g. Weekend flash sale" />
            </Field>
            <Field label="Type">
              <Segmented
                options={[
                  { value: "PERCENTAGE", label: "Percentage" },
                  { value: "FIXED", label: "Fixed amount" },
                ]}
                value={form.type}
                onChange={(v) => setForm({ ...form, type: v as FormState["type"] })}
              />
            </Field>
            <Field label={form.type === "PERCENTAGE" ? "Percent off" : `Amount off (${currency})`}>
              <Input value={form.value} onChangeText={(t) => setForm({ ...form, value: t })} placeholder="10" keyboardType="decimal-pad" />
            </Field>
            <Field label="Code" hint="Optional. Without a code this is a rule (e.g. group discount), not a coupon.">
              <Input value={form.code} onChangeText={(t) => setForm({ ...form, code: t.toUpperCase() })} placeholder="SAVE10" autoCapitalize="characters" autoCorrect={false} />
            </Field>
            <DateField label="Starts" optional hint="Optional" value={form.startsAt} onChange={(v) => setForm({ ...form, startsAt: v })} />
            <DateField label="Ends" optional hint="Optional" value={form.endsAt} onChange={(v) => setForm({ ...form, endsAt: v })} />
            <SwitchRow
              label="Active"
              sub={form.isActive ? "Available now" : "Paused until re-activated"}
              value={form.isActive}
              onChange={(v) => setForm({ ...form, isActive: v })}
            />
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
        message="Past orders keep their recorded discount amounts. New checkouts won't be able to use this code."
        confirmLabel="Delete discount"
      />
    </Page>
  );
}
