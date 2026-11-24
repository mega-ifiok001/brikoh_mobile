import { useCallback, useEffect, useMemo, useState } from "react";
import { FlatList, KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../src/context/AuthContext";
import { api } from "../../src/lib/api";
import { getAccess } from "../../src/lib/access";
import { apiErrorMessage, asList, fd, fdDateOnly, fm, rawNum, titleCase, toISODate } from "../../src/lib/format";
import { Button, Card, EmptyState, ErrorState, Field, Input, ListSkeleton, Money, Pill, Sheet, T, toast } from "../../src/components/ui";
import { AddButton, ConfirmSheet, Page, SelectField } from "../../src/components/kit";
import { DateField, isValidDate } from "../../src/components/expenses/DateField";
import { C } from "../../src/theme";

const CATEGORIES = ["RENT", "TRANSPORT", "PACKAGING", "SALARIES", "MARKETING", "UTILITIES", "OTHER"] as const;

const catColors = (): Record<string, string> => ({
  RENT: C.brand,
  TRANSPORT: C.ink700,
  PACKAGING: C.gold600,
  SALARIES: C.leaf500,
  MARKETING: "#f4a766",
  UTILITIES: C.ink400,
  OTHER: C.cream300,
});

type FormState = { category: string; amount: string; date: string; description: string };
const blank = (): FormState => ({ category: "OTHER", amount: "", date: toISODate(new Date()), description: "" });

export default function Expenses() {
  const { me } = useAuth();
  const currency: string = (me.store as any)?.currency || "NGN";
  const allowed = getAccess(me).can("expenses");

  const [date, setDate] = useState(() => toISODate(new Date()));
  const [appliedDate, setAppliedDate] = useState(() => toISODate(new Date()));
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState<FormState>(blank());
  const [formBusy, setFormBusy] = useState(false);
  const [formErr, setFormErr] = useState("");

  const [delFor, setDelFor] = useState<any | null>(null);
  const [delBusy, setDelBusy] = useState(false);

  const dateLabel = isValidDate(appliedDate) ? fdDateOnly(appliedDate) : appliedDate;

  const load = useCallback(
    async (quiet = false) => {
      if (!quiet) setLoading(true);
      setError(null);
      try {
        const qs = new URLSearchParams();
        qs.set("date", appliedDate);
        qs.set("limit", "100");
        const res: any = await api.get(`/api/dashboard/expenses?${qs.toString()}`);
        const list = asList(res, "expenses", "items", "data");
        list.sort((a, b) => new Date(b.date || b.createdAt).getTime() - new Date(a.date || a.createdAt).getTime());
        setItems(list);
      } catch (e: any) {
        setError(apiErrorMessage(e, "Couldn't load expenses."));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [appliedDate]
  );

  useEffect(() => {
    if (allowed) load();
  }, [load, allowed]);

  const total = items.reduce((a, x) => a + rawNum(x.amount), 0);
  const byCat = useMemo(() => {
    const m: Record<string, number> = {};
    items.forEach((x) => {
      const c = String(x.category || "OTHER").toUpperCase();
      m[c] = (m[c] || 0) + rawNum(x.amount);
    });
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  }, [items]);

  const openCreate = () => {
    setEditing(null);
    setForm(blank());
    setFormErr("");
    setFormOpen(true);
  };

  const openEdit = (x: any) => {
    setEditing(x);
    setForm({
      category: String(x.category || "OTHER").toUpperCase(),
      amount: String(x.amount ?? ""),
      date: x.date ? String(x.date).slice(0, 10) : toISODate(new Date()),
      description: x.description || "",
    });
    setFormErr("");
    setFormOpen(true);
  };

  const submit = async () => {
    const amountNum = parseFloat(form.amount);
    if (!isFinite(amountNum) || amountNum <= 0) return setFormErr("Enter an amount greater than zero.");
    if (!form.date || !isValidDate(form.date)) return setFormErr("Pick the date the expense belongs to (YYYY-MM-DD).");
    if (!(CATEGORIES as readonly string[]).includes(form.category)) return setFormErr("Pick a valid category.");

    setFormBusy(true);
    setFormErr("");
    const payload = {
      category: form.category,
      amount: amountNum.toFixed(2),
      date: form.date,
      description: form.description.trim() || undefined,
    };
    try {
      if (editing) {
        await api.put(`/api/dashboard/expenses/${editing.id}`, payload);
        toast.success("Expense updated.");
      } else {
        await api.post("/api/dashboard/expenses", payload);
        toast.success("Expense recorded.");
      }
      setFormOpen(false);
      load(true);
    } catch (e: any) {
      setFormErr(apiErrorMessage(e, "Couldn't save the expense."));
    } finally {
      setFormBusy(false);
    }
  };

  const confirmDelete = async () => {
    if (!delFor) return;
    setDelBusy(true);
    try {
      await api.del(`/api/dashboard/expenses/${delFor.id}`);
      toast.success("Expense deleted.");
      setDelFor(null);
      load(true);
    } catch (e: any) {
      toast.error(apiErrorMessage(e, "Couldn't delete the expense."));
    } finally {
      setDelBusy(false);
    }
  };

  if (!allowed) {
    return (
      <Page title="Expenses">
        <EmptyState icon="lock-closed-outline" title="No access" sub="Your role doesn't include expenses. Ask the store owner to grant it." />
      </Page>
    );
  }

  const header = (
    <View style={{ gap: 12, marginBottom: 4 }}>
      <Card style={{ padding: 14, gap: 10 }}>
        <DateField label="Expenses date" value={date} onChange={setDate} quick />
        {!isValidDate(date) ? <T w="semi" size={12} color={C.danger500}>Enter a valid date in YYYY-MM-DD format.</T> : null}
        <Button label="Apply date" onPress={() => setAppliedDate(date)} disabled={!isValidDate(date) || loading} small />
      </Card>

      <Card style={{ padding: 16 }}>
        <T w="semi" size={12} color={C.ink400}>
          Spent on {dateLabel}
        </T>
        <T w="display" size={30} style={{ letterSpacing: -0.5, marginTop: 2 }}>
          {fm(total, currency)}
        </T>
        <T w="regular" size={12} color={C.ink400}>
          {items.length} expense{items.length === 1 ? "" : "s"} · feeds your profit and loss report
        </T>

        <T w="bold" size={11} color={C.ink400} style={{ marginTop: 16, textTransform: "uppercase", letterSpacing: 0.8 }}>
          Where it went
        </T>
        {byCat.length === 0 ? (
          <T w="semi" size={13} color={C.ink400} style={{ marginTop: 8 }}>
            Nothing recorded on this date.
          </T>
        ) : (
          <View style={{ gap: 10, marginTop: 10 }}>
            {byCat.map(([cat, amt]) => (
              <View key={cat}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
                  <T w="extra" size={12} color={C.ink500}>
                    {titleCase(cat)}
                  </T>
                  <Money v={amt} currency={currency} size={12} />
                </View>
                <View style={{ height: 8, borderRadius: 8, backgroundColor: C.cream100, overflow: "hidden" }}>
                  <View style={{ height: 8, borderRadius: 8, backgroundColor: catColors()[cat] || C.ink400, width: `${Math.min(100, Math.max(6, (amt / (total || 1)) * 100))}%` }} />
                </View>
              </View>
            ))}
          </View>
        )}
      </Card>
    </View>
  );

  return (
    <Page title="Expenses" right={<AddButton onPress={openCreate} />}>
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
          ListHeaderComponent={header}
          ListEmptyComponent={
            loading ? (
              <View style={{ marginHorizontal: -16 }}>
                <ListSkeleton rows={4} />
              </View>
            ) : (
              <EmptyState
                icon="cash-outline"
                title={`No expenses on ${dateLabel}`}
                sub="Rent, transport, packaging, salaries, data. Record them here and the P&L does the maths."
                action={<Button label="Record an expense" icon="add" onPress={openCreate} small />}
              />
            )
          }
          renderItem={({ item: x }) => (
            <Card onPress={() => openEdit(x)} style={{ padding: 14 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Pill>{titleCase(x.category)}</Pill>
                    <T w="regular" size={11.5} color={C.ink400}>
                      {fd(x.date || x.createdAt)}
                    </T>
                  </View>
                  <T w="semi" size={13} color={C.ink500} numberOfLines={2} style={{ marginTop: 6 }}>
                    {x.description || "No description"}
                  </T>
                </View>
                <Money v={x.amount} currency={currency} size={14.5} />
                <Pressable onPress={() => setDelFor(x)} hitSlop={10} style={{ padding: 6 }}>
                  <Ionicons name="trash-outline" size={19} color={C.danger500} />
                </Pressable>
              </View>
            </Card>
          )}
        />
      )}

      <Sheet
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? "Edit expense" : "Record expense"}
        footer={<Button label="Save" icon="checkmark" onPress={submit} busy={formBusy} />}
      >
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <ScrollView style={{ maxHeight: 420 }} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 18, gap: 12, paddingBottom: 6 }}>
            {formErr ? (
              <T w="bold" size={12.5} color={C.danger500}>
                {formErr}
              </T>
            ) : null}
            <SelectField
              label="Category"
              value={form.category}
              options={CATEGORIES.map((c) => ({ value: c, label: titleCase(c) }))}
              onChange={(v) => setForm({ ...form, category: v })}
            />
            <Field label={`Amount (${currency})`}>
              <Input value={form.amount} onChangeText={(t) => setForm({ ...form, amount: t })} placeholder="0.00" keyboardType="decimal-pad" />
            </Field>
            <DateField label="Date" hint="The day it belongs to, not when you're typing it in." value={form.date} onChange={(v) => setForm({ ...form, date: v })} quick />
            <Field label="Description">
              <Input value={form.description} onChangeText={(t) => setForm({ ...form, description: t })} placeholder="e.g. keke to market, 20 cartons" />
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
        title="Delete this expense?"
        message="It will drop out of the P&L on your next read."
        confirmLabel="Delete"
      />
    </Page>
  );
}
