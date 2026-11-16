import { useCallback, useEffect, useState } from "react";
import { Pressable, RefreshControl, ScrollView, View } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../src/lib/api";
import { apiErrorMessage, asList, fd, fm, rawNum, titleCase } from "../src/lib/format";
import { Button, Card, ErrorState, Input, Money, Skeleton, StatusPill, T, toast, Sheet } from "../src/components/ui";
import { C, shadow } from "../src/theme";

export default function Wallet() {
  const router = useRouter();
  const [wallet, setWallet] = useState<any | null>(null);
  const [entries, setEntries] = useState<any[]>([]);
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [accountId, setAccountId] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const [acctOpen, setAcctOpen] = useState(false);
  const [acctForm, setAcctForm] = useState({ accountName: "", bankName: "", bankCode: "", accountNumber: "" });
  const [acctBusy, setAcctBusy] = useState(false);
  const [acctErr, setAcctErr] = useState("");

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    setError(null);
    try {
      const res: any = await api.get("/api/dashboard/wallet");
      const w = res?.wallet ?? res;
      setWallet(w);
      setEntries(Array.isArray(res?.recentEntries) ? res.recentEntries : Array.isArray(w?.recentEntries) ? w.recentEntries : []);
    } catch (e: any) {
      setError(apiErrorMessage(e, "Couldn't load your wallet."));
      setWallet(null);
    }
    try {
      setWithdrawals(asList(await api.get("/api/dashboard/wallet/withdrawals?limit=30"), "withdrawals", "items", "data"));
    } catch {
      setWithdrawals([]);
    }
    try {
      const list = asList(await api.get("/api/dashboard/wallet/bank-accounts"), "bankAccounts", "accounts", "items", "data");
      setAccounts(list);
      setAccountId((cur) => cur || list.find((a: any) => a.isDefault)?.id || list[0]?.id || "");
    } catch {
      setAccounts([]);
    }
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const available = wallet?.available ?? "0.00";
  const currency = wallet?.currency || "NGN";

  const addAccount = async () => {
    const digits = acctForm.accountNumber.replace(/\D/g, "");
    if (!acctForm.accountName.trim() || !acctForm.bankName.trim() || !acctForm.bankCode.trim() || digits.length < 8) {
      setAcctErr("Fill in the account holder, bank, bank code and a full account number.");
      return;
    }
    setAcctBusy(true);
    setAcctErr("");
    try {
      const body = { accountName: acctForm.accountName.trim(), bankName: acctForm.bankName.trim(), bankCode: acctForm.bankCode.trim(), accountNumber: digits };
      try {
        await api.post("/api/dashboard/wallet/bank-accounts", body);
      } catch {
        await api.post("/api/dashboard/bank-accounts", body);
      }
      toast.success("Bank account saved.");
      setAcctOpen(false);
      setAcctForm({ accountName: "", bankName: "", bankCode: "", accountNumber: "" });
      load(true);
    } catch (e: any) {
      setAcctErr(apiErrorMessage(e, "Couldn't save the account."));
    } finally {
      setAcctBusy(false);
    }
  };

  const withdraw = async () => {
    const n = parseFloat(amount);
    if (!isFinite(n) || n <= 0) return setErr("Enter how much to withdraw.");
    if (n < 100) return setErr("Minimum withdrawal is ₦100.00.");
    if (!accountId) return setErr("Add a bank account first.");
    if (n > rawNum(available)) return setErr("Amount exceeds your available balance.");
    setBusy(true);
    setErr("");
    try {
      await api.post("/api/dashboard/wallet/withdrawals", { bankAccountId: accountId, amount: n.toFixed(2) });
      toast.success("Withdrawal requested — money is on its way.");
      setOpen(false);
      setAmount("");
      load(true);
    } catch (e: any) {
      setErr(
        apiErrorMessage(e, "Couldn't request the withdrawal.", {
          WITHDRAWAL_BELOW_MINIMUM: "Minimum withdrawal is ₦100.00.",
          INSUFFICIENT_WALLET_BALANCE: "Amount exceeds your available balance.",
          BANK_ACCOUNT_NOT_FOUND: "That bank account was not found.",
        })
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.cream50 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 8 }}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={{ width: 40, height: 40, borderRadius: 13, backgroundColor: C.white, borderWidth: 1, borderColor: C.cream200, alignItems: "center", justifyContent: "center" }}>
          <Ionicons name="chevron-back" size={20} color={C.ink900} />
        </Pressable>
        <T w="extra" size={15}>
          Wallet
        </T>
        <View style={{ width: 40 }} />
      </View>

      {error && !wallet ? (
        <ErrorState message={error} onRetry={() => load()} />
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 30, gap: 12 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} tintColor={C.brand} onRefresh={() => { setRefreshing(true); load(true); }} />}
        >
          {loading && !wallet ? (
            <>
              <Skeleton h={170} r={26} />
              <Skeleton h={70} r={16} />
              <Skeleton h={200} r={18} />
            </>
          ) : (
            <>
              <LinearGradient colors={[C.brand, C.brandDark]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: 26, padding: 20, overflow: "hidden", ...shadow.brand }}>
                <View style={{ position: "absolute", right: -30, bottom: -50, width: 170, height: 170, borderRadius: 85, backgroundColor: "rgba(255,255,255,0.13)" }} />
                <T w="bold" size={12.5} color="rgba(255,255,255,0.85)">
                  Available balance
                </T>
                <T w="display" size={38} color="#fff" style={{ letterSpacing: -1, marginTop: 2 }}>
                  {fm(available, currency)}
                </T>
                <View style={{ marginTop: 16, flexDirection: "row" }}>
                  <Pressable
                    disabled={rawNum(available) < 100}
                    onPress={() => {
                      setErr("");
                      setOpen(true);
                    }}
                    style={({ pressed }) => ({ backgroundColor: "#fff", borderRadius: 14, paddingHorizontal: 22, height: 44, justifyContent: "center", opacity: rawNum(available) < 100 ? 0.55 : pressed ? 0.85 : 1 })}
                  >
                    <T w="extra" size={13.5} color="#0A100D">
                      Withdraw
                    </T>
                  </Pressable>
                </View>
              </LinearGradient>

              <View style={{ flexDirection: "row", gap: 10 }}>
                <Stat label="Pending" value={wallet?.pending} currency={currency} />
                <Stat label="Withdrawn" value={wallet?.withdrawn} currency={currency} />
                <Stat label="Total earned" value={wallet?.totalCredits} currency={currency} />
              </View>
              <T w="regular" size={11.5} color={C.ink400} style={{ paddingHorizontal: 4 }}>
                Online sales paid through Paystack land here. Cash, transfer and credit sales never touch this balance.
              </T>

              <T w="display" size={17} style={{ marginTop: 8 }}>
                Activity
              </T>
              <Card style={{ paddingHorizontal: 14 }}>
                {entries.length === 0 ? (
                  <T w="semi" size={13} color={C.ink400} style={{ paddingVertical: 24, textAlign: "center" }}>
                    Credits from online sales and debits from withdrawals appear here.
                  </T>
                ) : (
                  entries.slice(0, 15).map((e, i) => {
                    const credit = String(e.type || "").toUpperCase() === "CREDIT";
                    return (
                      <View key={e.id || i} style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12, borderTopWidth: i ? 1 : 0, borderTopColor: C.cream100 }}>
                        <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: credit ? C.leaf100 : C.cream100, alignItems: "center", justifyContent: "center" }}>
                          <Ionicons name={credit ? "arrow-down" : "arrow-up"} size={17} color={credit ? C.leaf500 : C.ink500} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <T w="bold" size={13.5}>
                            {titleCase(String(e.source || "movement").replace(/_/g, " "))}
                          </T>
                          <T w="regular" size={11.5} color={C.ink400}>
                            {fd(e.createdAt)}
                          </T>
                        </View>
                        <T w="extra" size={13.5} color={credit ? C.leaf500 : C.ink700}>
                          {credit ? "+" : "−"}
                          {fm(e.amount, currency)}
                        </T>
                      </View>
                    );
                  })
                )}
              </Card>

              <T w="display" size={17} style={{ marginTop: 8 }}>
                Withdrawals
              </T>
              <Card style={{ paddingHorizontal: 14 }}>
                {withdrawals.length === 0 ? (
                  <T w="semi" size={13} color={C.ink400} style={{ paddingVertical: 24, textAlign: "center" }}>
                    No withdrawals yet.
                  </T>
                ) : (
                  withdrawals.map((p, i) => (
                    <View key={p.id || i} style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12, borderTopWidth: i ? 1 : 0, borderTopColor: C.cream100 }}>
                      <View style={{ flex: 1 }}>
                        <T w="bold" size={13.5} numberOfLines={1}>
                          {p.bankAccount?.accountName || p.reference || "Withdrawal"}
                        </T>
                        <T w="regular" size={11.5} color={C.ink400} numberOfLines={1}>
                          {[p.bankAccount?.bankName, p.bankAccount?.maskedAccountNumber, fd(p.createdAt)].filter(Boolean).join(" · ")}
                        </T>
                      </View>
                      <View style={{ alignItems: "flex-end", gap: 4 }}>
                        <Money v={p.amount} currency={currency} size={13.5} />
                        <StatusPill status={p.status} />
                      </View>
                    </View>
                  ))
                )}
              </Card>
            </>
          )}
        </ScrollView>
      )}

      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title="Withdraw"
        footer={<Button label="Request withdrawal" onPress={withdraw} busy={busy} />}
      >
        <View style={{ paddingHorizontal: 18, gap: 12 }}>
          <T w="semi" size={12.5} color={C.ink400}>
            Available: {fm(available, currency)} · minimum ₦100
          </T>
          <Input value={amount} onChangeText={setAmount} placeholder="Amount" keyboardType="decimal-pad" />
          <T w="bold" size={12} color={C.ink500}>
            To account
          </T>
          {accounts.length === 0 ? (
            <T w="regular" size={12.5} color={C.ink400}>
              No bank account saved yet. Add one to withdraw.
            </T>
          ) : (
            accounts.map((a) => {
              const on = a.id === accountId;
              return (
                <Pressable
                  key={a.id}
                  onPress={() => setAccountId(a.id)}
                  style={{ flexDirection: "row", alignItems: "center", gap: 10, padding: 14, borderRadius: 16, borderWidth: 1.5, borderColor: on ? C.brand : C.cream200, backgroundColor: on ? C.brand50 : C.white }}
                >
                  <View style={{ flex: 1 }}>
                    <T w="bold" size={13.5}>
                      {a.accountName}
                    </T>
                    <T w="regular" size={12} color={C.ink400}>
                      {a.bankName} · {a.maskedAccountNumber || `****${String(a.accountNumber || "").slice(-4)}`}
                    </T>
                  </View>
                  {on && <Ionicons name="checkmark-circle" size={20} color={C.brand} />}
                </Pressable>
              );
            })
          )}
          <Button label="Add bank account" variant="outline" small icon="add" onPress={() => { setAcctErr(""); setAcctOpen(true); }} />
          {err ? (
            <T w="bold" size={12.5} color={C.danger500}>
              {err}
            </T>
          ) : null}
        </View>
      </Sheet>

      <Sheet open={acctOpen} onClose={() => setAcctOpen(false)} title="Add bank account" footer={<Button label="Save account" onPress={addAccount} busy={acctBusy} />}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 18, gap: 12, paddingBottom: 8 }}>
          <Input value={acctForm.accountName} onChangeText={(v) => setAcctForm({ ...acctForm, accountName: v })} placeholder="Account holder name" />
          <Input value={acctForm.bankName} onChangeText={(v) => setAcctForm({ ...acctForm, bankName: v })} placeholder="Bank name, e.g. GTBank" />
          <Input value={acctForm.bankCode} onChangeText={(v) => setAcctForm({ ...acctForm, bankCode: v })} placeholder="Bank code, e.g. 058" autoCapitalize="none" />
          <Input value={acctForm.accountNumber} onChangeText={(v) => setAcctForm({ ...acctForm, accountNumber: v.replace(/\D/g, "") })} placeholder="Account number (10 digits)" keyboardType="number-pad" />
          {acctErr ? (
            <T w="bold" size={12.5} color={C.danger500}>
              {acctErr}
            </T>
          ) : null}
        </ScrollView>
      </Sheet>
    </SafeAreaView>
  );
}

function Stat({ label, value, currency }: { label: string; value: any; currency: string }) {
  return (
    <Card style={{ flex: 1, padding: 12 }}>
      <T w="semi" size={11} color={C.ink400}>
        {label}
      </T>
      <T w="display" size={16} style={{ marginTop: 2 }} numberOfLines={1} adjustsFontSizeToFit>
        {fm(value ?? 0, currency, { compact: true })}
      </T>
    </Card>
  );
}
