// Customer create (id = "new") and detail/edit/delete + credit repayment.
// Same endpoints and payloads as the web Customers page.
import { useCallback, useEffect, useState } from "react";
import { KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../../src/context/AuthContext";
import { api } from "../../../src/lib/api";
import { getAccess } from "../../../src/lib/access";
import { apiErrorMessage, asList, fd, fdt, rawNum, titleCase } from "../../../src/lib/format";
import { Avatar, Button, Card, EmptyState, ErrorState, Field, Input, Money, Pill, Sheet, Skeleton, StatusPill, T, toast } from "../../../src/components/ui";
import { ConfirmSheet, Page, SectionTitle, SelectField, StatTile } from "../../../src/components/kit";
import { C } from "../../../src/theme";

type Form = { name: string; phone: string; email: string; groupId: string };
const BLANK: Form = { name: "", phone: "", email: "", groupId: "" };

const openCreditOf = (c: any): number | null => {
  const val = c?.openCredit ?? c?.outstandingBalance ?? c?.creditBalance;
  return val != null ? rawNum(val) : null;
};

export default function CustomerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { me } = useAuth();
  const allowed = getAccess(me).can("customers");
  const currency: string = (me.store as any)?.currency || "NGN";
  const isNew = id === "new";

  const [customer, setCustomer] = useState<any | null>(null);
  const [repayments, setRepayments] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(!isNew);
  const [error, setError] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<Form>(BLANK);
  const [formBusy, setFormBusy] = useState(false);
  const [formErr, setFormErr] = useState("");
  const [groupDraft, setGroupDraft] = useState("");
  const [groupBusy, setGroupBusy] = useState(false);

  const [repay, setRepay] = useState("");
  const [repayNote, setRepayNote] = useState("");
  const [repayBusy, setRepayBusy] = useState(false);

  const [delOpen, setDelOpen] = useState(false);
  const [delBusy, setDelBusy] = useState(false);

  const loadGroups = useCallback(async () => {
    try {
      const res = await api.get("/api/dashboard/customer-groups");
      setGroups(asList(res, "items", "groups", "data"));
    } catch {
      /* optional */
    }
  }, []);

  const load = useCallback(
    async (quiet?: boolean) => {
      if (isNew) return;
      if (!quiet) setLoading(true);
      setError(null);
      try {
        const res: any = await api.get(`/api/dashboard/customers/${id}`);
        const full = res?.customer ?? res;
        if (!full?.id) throw new Error("Customer not found");
        setCustomer(full);
        setRepayments(Array.isArray(res?.repayments) ? res.repayments : []);
        let list: any[] = Array.isArray(res?.recentOrders) ? res.recentOrders : [];
        try {
          const o: any = await api.get(`/api/dashboard/orders?customerId=${encodeURIComponent(String(id))}&limit=20`);
          const l = asList(o, "items", "orders", "data");
          if (l.length || !list.length) list = l;
        } catch {
          /* fall back to recentOrders */
        }
        setOrders(list);
      } catch (e: any) {
        setError(apiErrorMessage(e, "Couldn't load this customer.", { NOT_FOUND: "That customer no longer exists." }));
      } finally {
        setLoading(false);
      }
    },
    [id, isNew]
  );

  useEffect(() => {
    load();
    loadGroups();
  }, [load, loadGroups]);

  const openEdit = () => {
    if (!customer) return;
    setForm({ name: customer.name || "", phone: customer.phone || "", email: customer.email || "", groupId: customer.group?.id || customer.groupId || "" });
    setFormErr("");
    setFormOpen(true);
  };

  const addGroup = async () => {
    const name = groupDraft.trim();
    if (!name) return;
    setGroupBusy(true);
    try {
      await api.post("/api/dashboard/customer-groups", { name });
      setGroupDraft("");
      toast.success("Group added.");
      await loadGroups();
    } catch (e: any) {
      toast.error(e?.message || "Couldn't add the group.");
    } finally {
      setGroupBusy(false);
    }
  };

  const submit = async () => {
    if (!form.name.trim()) return setFormErr("Name is required.");
    setFormBusy(true);
    setFormErr("");
    const payload = {
      name: form.name.trim(),
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      groupId: form.groupId || null,
    };
    try {
      if (isNew) {
        const res: any = await api.post("/api/dashboard/customers", payload);
        toast.success("Customer added.");
        const newId = res?.customer?.id ?? res?.id;
        if (newId) router.replace(`/customer/${newId}`);
        else router.back();
      } else {
        await api.put(`/api/dashboard/customers/${id}`, payload);
        toast.success("Customer updated.");
        setFormOpen(false);
        await load(true);
      }
    } catch (e: any) {
      setFormErr(e?.message || "Couldn't save the customer.");
    } finally {
      setFormBusy(false);
    }
  };

  const confirmDelete = async () => {
    setDelBusy(true);
    try {
      await api.del(`/api/dashboard/customers/${id}`);
      toast.success("Customer removed.");
      setDelOpen(false);
      router.back();
    } catch (e: any) {
      toast.error(apiErrorMessage(e, "Couldn't delete the customer.", { CUSTOMER_HAS_RECORDS: "This customer has orders or invoices and can't be deleted." }));
    } finally {
      setDelBusy(false);
    }
  };

  const doRepay = async () => {
    const amount = repay.trim();
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) return toast.error("Enter a positive amount.");
    setRepayBusy(true);
    try {
      await api.post(`/api/dashboard/customers/${id}/credits/repayments`, { amount, note: repayNote.trim() || undefined }); // amount is a string decimal
      toast.success("Repayment recorded.");
      setRepay("");
      setRepayNote("");
      await load(true);
    } catch (e: any) {
      toast.error(e?.message || "Couldn't record the repayment.");
    } finally {
      setRepayBusy(false);
    }
  };

  const groupOptions = [{ value: "", label: "General" }, ...groups.map((g: any) => ({ value: g.id, label: g.name }))];

  const formBody = (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={isNew ? { flex: 1 } : undefined}>
      <ScrollView keyboardShouldPersistTaps="handled" style={isNew ? undefined : { maxHeight: 460 }} contentContainerStyle={{ padding: isNew ? 16 : 0, paddingHorizontal: isNew ? 16 : 18, gap: 14, paddingBottom: 24 }}>
        {formErr ? (
          <View style={{ backgroundColor: C.danger100, borderRadius: 14, padding: 12 }}>
            <T w="bold" size={12.5} color={C.danger500}>
              {formErr}
            </T>
          </View>
        ) : null}
        <Field label="Name">
          <Input value={form.name} onChangeText={(t) => setForm({ ...form, name: t })} placeholder="Full name" autoCapitalize="words" />
        </Field>
        <Field label="Phone">
          <Input value={form.phone} onChangeText={(t) => setForm({ ...form, phone: t })} placeholder="Optional" keyboardType="phone-pad" />
        </Field>
        <Field label="Email">
          <Input value={form.email} onChangeText={(t) => setForm({ ...form, email: t })} placeholder="Optional" keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />
        </Field>
        <SelectField label="Group" value={form.groupId} options={groupOptions} onChange={(v) => setForm({ ...form, groupId: v })} placeholder="General" />
        <Field label="New group">
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Input style={{ flex: 1 }} value={groupDraft} onChangeText={setGroupDraft} placeholder="e.g. VIP" onSubmitEditing={addGroup} />
            <Button label="Add" small variant="outline" busy={groupBusy} onPress={addGroup} style={{ height: 52 }} />
          </View>
        </Field>
        {isNew ? <Button label="Add customer" busy={formBusy} onPress={submit} /> : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );

  if (!allowed) {
    return (
      <Page title="Customer">
        <EmptyState icon="lock-closed-outline" title="No access" sub="Your role can't manage customers." />
      </Page>
    );
  }
  if (isNew) return <Page title="New customer">{formBody}</Page>;
  if (loading) {
    return (
      <Page title="Customer">
        <View style={{ padding: 16, gap: 12 }}>
          <Skeleton h={90} />
          <Skeleton h={70} />
          <Skeleton h={140} />
        </View>
      </Page>
    );
  }
  if (error || !customer) {
    return (
      <Page title="Customer">
        <ErrorState message={error || "Couldn't load this customer."} onRetry={() => load()} />
      </Page>
    );
  }

  const credit = openCreditOf(customer);
  const owes = credit != null && credit > 0;

  return (
    <Page title={customer.name || "Customer"}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 14 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {/* Contact */}
        <Card style={{ padding: 14, gap: 12 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <Avatar name={customer.name} size={52} />
            <View style={{ flex: 1 }}>
              <T w="display" size={18} numberOfLines={1}>
                {customer.name || "Unnamed"}
              </T>
              <T w="regular" size={12} color={C.ink400}>
                Since {fd(customer.createdAt)}
              </T>
            </View>
          </View>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            <Pill>{titleCase(customer.source || "MANUAL")}</Pill>
            <Pill tone="brand">{customer.group?.name || "General"}</Pill>
            {customer.segment ? <Pill tone={customer.segment === "VIP" ? "gold" : "neutral"}>{customer.segment}</Pill> : null}
          </View>
          {customer.phone ? (
            <Pressable onPress={() => Linking.openURL(`tel:${customer.phone}`)} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <Ionicons name="call-outline" size={17} color={C.brand} />
              <T w="semi" size={14}>
                {customer.phone}
              </T>
            </Pressable>
          ) : null}
          {customer.email ? (
            <Pressable onPress={() => Linking.openURL(`mailto:${customer.email}`)} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <Ionicons name="mail-outline" size={17} color={C.brand} />
              <T w="semi" size={14} numberOfLines={1} style={{ flex: 1 }}>
                {customer.email}
              </T>
            </Pressable>
          ) : null}
          {!customer.phone && !customer.email ? (
            <T w="regular" size={13} color={C.ink400}>
              No contact details
            </T>
          ) : null}
        </Card>

        <View style={{ flexDirection: "row", gap: 10 }}>
          <StatTile label="Orders" value={String(customer.ordersCount ?? "—")} />
          <StatTile label="Lifetime spend" value={customer.totalSpent != null ? `${currency} ${rawNum(customer.totalSpent).toLocaleString()}` : "—"} />
          <StatTile label="Open credit" value={owes ? `${currency} ${credit!.toLocaleString()}` : "—"} tone={owes ? "gold" : undefined} />
        </View>

        {/* Credit */}
        {owes ? (
          <Card style={{ padding: 14, gap: 10, backgroundColor: C.gold100 }}>
            <T w="extra" size={11} color={C.gold600}>
              OUTSTANDING CREDIT
            </T>
            <Money v={credit} currency={currency} size={24} w="display" color={C.gold600} />
            <Field label="Repayment amount">
              <Input value={repay} onChangeText={(t) => setRepay(t.replace(/[^0-9.]/g, ""))} keyboardType="decimal-pad" placeholder="0.00" />
            </Field>
            <Field label="Note">
              <Input value={repayNote} onChangeText={setRepayNote} placeholder="Optional" />
            </Field>
            <Button label="Record repayment" icon="cash-outline" busy={repayBusy} onPress={doRepay} />
          </Card>
        ) : null}

        {/* Orders */}
        <SectionTitle>Orders</SectionTitle>
        {orders.length === 0 ? (
          <T w="regular" size={13} color={C.ink400}>
            No orders yet.
          </T>
        ) : (
          orders.slice(0, 20).map((o: any, i: number) => (
            <Card key={o.id || i} onPress={o.id ? () => router.push(`/order/${o.id}`) : undefined} style={{ padding: 12, flexDirection: "row", alignItems: "center", gap: 10 }}>
              <View style={{ flex: 1 }}>
                <T w="bold" size={13.5} numberOfLines={1}>
                  {o.orderNumber || o.number || String(o.id || "").slice(0, 8) || "Order"}
                </T>
                <T w="regular" size={11.5} color={C.ink400}>
                  {fdt(o.createdAt)}
                  {rawNum(o.balanceDue) > 0 ? ` · owes ${currency} ${rawNum(o.balanceDue).toLocaleString()}` : ""}
                </T>
              </View>
              <View style={{ alignItems: "flex-end", gap: 4 }}>
                <Money v={o.total} currency={currency} size={13} />
                <StatusPill status={o.status} />
              </View>
            </Card>
          ))
        )}

        {/* Repayments */}
        {repayments.length > 0 ? (
          <>
            <SectionTitle>Repayment history</SectionTitle>
            {repayments.map((r: any, i: number) => (
              <Card key={r.id || i} style={{ padding: 12 }}>
                <Money v={r.amount} currency={currency} size={14} />
                <T w="regular" size={11.5} color={C.ink400}>
                  {r.note || "—"} · {r.recordedByName || "Staff"} · {fdt(r.createdAt)}
                </T>
              </Card>
            ))}
          </>
        ) : null}

        <View style={{ flexDirection: "row", gap: 10, marginTop: 6 }}>
          <Button label="Edit" icon="create-outline" variant="outline" onPress={openEdit} style={{ flex: 1 }} />
          <Button label="Delete" icon="trash-outline" variant="danger" onPress={() => setDelOpen(true)} style={{ flex: 1 }} />
        </View>
      </ScrollView>

      <Sheet open={formOpen} onClose={() => setFormOpen(false)} title="Edit customer" footer={<Button label="Save changes" busy={formBusy} onPress={submit} />}>
        {formBody}
      </Sheet>
      <ConfirmSheet
        open={delOpen}
        title="Delete this customer?"
        message="Customers with orders or invoices can't be removed — their financial history must stay."
        confirmLabel="Delete"
        danger
        busy={delBusy}
        onConfirm={confirmDelete}
        onClose={() => setDelOpen(false)}
      />
    </Page>
  );
}
