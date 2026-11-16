import { useCallback, useEffect, useState } from "react";
import { View } from "react-native";
import { api } from "../../../src/lib/api";
import { apiErrorMessage, asList } from "../../../src/lib/format";
import { Card, EmptyState, Field, Input, Pill, Sheet, T, toast, Button } from "../../../src/components/ui";
import { AddButton, SwitchRow } from "../../../src/components/kit";
import { SettingsScreen } from "../../../src/components/settings/bits";
import { C } from "../../../src/theme";
import { ScrollView } from "react-native";

const BLANK = { accountName: "", bankName: "", accountNumber: "", isDefault: false };

export default function BankSettings() {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(BLANK);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    setError(null);
    try {
      const res: any = await api.get("/api/dashboard/settings/bank-accounts");
      setAccounts(asList(res, "bankAccounts", "accounts", "items", "data"));
    } catch (e: any) {
      setError(apiErrorMessage(e, "Couldn't load bank accounts."));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    const accountName = form.accountName.trim();
    const bankName = form.bankName.trim();
    const accountNumber = form.accountNumber.trim();
    if (!accountName || !bankName || !accountNumber) return setErr("Account name, bank name and account number are required.");
    if (!/^\d{10}$/.test(accountNumber)) return setErr("Account number must be exactly 10 digits.");
    setBusy(true);
    setErr("");
    try {
      await api.post("/api/dashboard/settings/bank-accounts", { accountName, bankName, accountNumber, isDefault: form.isDefault });
      toast.success("Bank account added.");
      setOpen(false);
      setForm(BLANK);
      load(true);
    } catch (e: any) {
      setErr(apiErrorMessage(e, "Couldn't add the bank account.", { VALIDATION_ERROR: "Check the fields: account number must be exactly 10 digits." }));
    } finally {
      setBusy(false);
    }
  };

  const openAdd = () => {
    setForm(BLANK);
    setErr("");
    setOpen(true);
  };

  return (
    <SettingsScreen
      title="Bank accounts"
      loading={loading}
      error={error}
      onRetry={load}
      right={<AddButton onPress={openAdd} />}
      refreshing={refreshing}
      onRefresh={() => {
        setRefreshing(true);
        load(true);
      }}
    >
      <T w="regular" size={12} color={C.ink400}>
        Bank accounts customers pay into for manual bank transfers. The default account is shown at checkout. Without a default, bank-transfer checkout is unavailable.
      </T>
      {accounts.length === 0 ? (
        <Card>
          <EmptyState icon="card-outline" title="No settlement accounts yet" sub="Add one to accept bank transfers." action={<Button label="Add bank account" onPress={openAdd} small />} />
        </Card>
      ) : (
        accounts.map((a) => (
          <Card key={a.id} style={{ padding: 14, flexDirection: "row", alignItems: "center", gap: 10 }}>
            <View style={{ flex: 1 }}>
              <T w="extra" size={14} numberOfLines={1}>
                {a.accountName}
              </T>
              <T w="regular" size={12.5} color={C.ink400}>
                {a.bankName} · {a.accountNumber || a.maskedAccountNumber}
              </T>
            </View>
            {a.isDefault ? <Pill tone="green">Default</Pill> : null}
          </Card>
        ))
      )}

      <Sheet open={open} onClose={() => setOpen(false)} title="Add bank account" footer={<Button label="Add account" onPress={save} busy={busy} />}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 18, gap: 12, paddingBottom: 8 }}>
          <Field label="Account name">
            <Input value={form.accountName} onChangeText={(v) => setForm({ ...form, accountName: v })} placeholder="e.g. Adebayo Idowu" maxLength={200} />
          </Field>
          <Field label="Bank name">
            <Input value={form.bankName} onChangeText={(v) => setForm({ ...form, bankName: v })} placeholder="e.g. Access Bank" maxLength={200} />
          </Field>
          <Field label="Account number" hint="Exactly 10 digits">
            <Input value={form.accountNumber} onChangeText={(v) => setForm({ ...form, accountNumber: v.replace(/\D/g, "").slice(0, 10) })} placeholder="0123456789" keyboardType="number-pad" maxLength={10} />
          </Field>
          <SwitchRow label="Set as default" sub="Used for bank-transfer checkouts. Only one default at a time." value={form.isDefault} onChange={(v) => setForm({ ...form, isDefault: v })} />
          {err ? (
            <T w="bold" size={12.5} color={C.danger500}>
              {err}
            </T>
          ) : null}
        </ScrollView>
      </Sheet>
    </SettingsScreen>
  );
}
