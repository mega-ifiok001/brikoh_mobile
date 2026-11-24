import { useCallback, useEffect, useRef, useState } from "react";
import { Platform, Pressable, RefreshControl, ScrollView, View } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { api } from "../src/lib/api";
import { apiErrorMessage, asList, fd, fdDateOnly, fm, pick, rawNum, titleCase, toISODate } from "../src/lib/format";
import { Button, Card, Chip, ErrorState, Field, Input, Money, SearchBar, Skeleton, StatusPill, T, toast, Sheet } from "../src/components/ui";
import { DateField, isValidDate } from "../src/components/expenses/DateField";
import { C, shadow } from "../src/theme";

type TransactionView = "all" | "wallet";

function monthStart(): string {
  const now = new Date();
  return toISODate(new Date(now.getFullYear(), now.getMonth(), 1));
}

function transactionDate(value?: any): string {
  if (!value) return "—";
  const text = String(value);
  return isValidDate(text) ? fdDateOnly(text) : fd(text);
}

export default function Wallet() {
  const router = useRouter();
  const [wallet, setWallet] = useState<any | null>(null);
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

  const [transactions, setTransactions] = useState<any[]>([]);
  const [fromDate, setFromDate] = useState(() => monthStart());
  const [toDate, setToDate] = useState(() => toISODate(new Date()));
  const [appliedFrom, setAppliedFrom] = useState(() => monthStart());
  const [appliedTo, setAppliedTo] = useState(() => toISODate(new Date()));
  const [view, setView] = useState<TransactionView>("all");
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState({ direction: "", type: "", status: "", method: "", branch: "" });
  const [filterDraft, setFilterDraft] = useState(filters);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [transactionsLoading, setTransactionsLoading] = useState(true);
  const [transactionsMore, setTransactionsMore] = useState(false);
  const [transactionsError, setTransactionsError] = useState<string | null>(null);
  const [exportBusy, setExportBusy] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailItem, setDetailItem] = useState<any>(null);
  const [detail, setDetail] = useState<any>(null);
  const [detailBusy, setDetailBusy] = useState(false);
  const [detailError, setDetailError] = useState("");
  const transactionReqId = useRef(0);

  const loadTransactions = useCallback(async (cursor?: string | null) => {
    const id = ++transactionReqId.current;
    const append = !!cursor;
    if (append) setTransactionsMore(true);
    else setTransactionsLoading(true);
    setTransactionsError(null);
    try {
      const qs = new URLSearchParams({ from: appliedFrom, to: appliedTo, view, limit: "25" });
      if (appliedSearch.trim()) qs.set("search", appliedSearch.trim());
      Object.entries(filters).forEach(([key, value]) => {
        if (value.trim()) qs.set(key, value.trim());
      });
      if (cursor) qs.set("cursor", cursor);
      const res: any = await api.get(`/api/dashboard/transactions?${qs.toString()}`);
      if (id !== transactionReqId.current) return;
      const payload = res?.data ?? res;
      const rows = asList(payload, "items", "transactions", "data", "results");
      setTransactions((old) => append ? [...old, ...rows] : rows);
      setNextCursor(pick<string>(payload, ["nextCursor", "after", "next"]) ?? pick<string>(res, ["nextCursor", "after", "next"]) ?? null);
    } catch (e: any) {
      if (id !== transactionReqId.current) return;
      setTransactionsError(apiErrorMessage(e, "Couldn't load transactions."));
      if (!append) setTransactions([]);
    } finally {
      if (id === transactionReqId.current) {
        setTransactionsLoading(false);
        setTransactionsMore(false);
      }
    }
  }, [appliedFrom, appliedTo, view, appliedSearch, filters]);

  useEffect(() => {
    const timer = setTimeout(() => setAppliedSearch(search), 350);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    loadTransactions();
  }, [loadTransactions]);

  const transactionDateError = !isValidDate(fromDate)
    ? "Choose a valid start date."
    : !isValidDate(toDate)
      ? "Choose a valid end date."
      : fromDate > toDate
        ? "Start date must be on or before end date."
        : "";

  const openTransaction = async (item: any) => {
    const id = item?.id;
    if (!id) return;
    setDetailItem(item);
    setDetailOpen(true);
    setDetailBusy(true);
    setDetail(null);
    setDetailError("");
    try {
      const res = await api.get(`/api/dashboard/transactions/${encodeURIComponent(String(id))}`);
      setDetail((res as any)?.transaction ?? (res as any)?.data?.transaction ?? (res as any)?.data ?? res);
    } catch (e: any) {
      setDetailError(apiErrorMessage(e, "Couldn't load transaction details."));
    } finally {
      setDetailBusy(false);
    }
  };

  const exportTransactions = async () => {
    if (!isValidDate(appliedFrom) || !isValidDate(appliedTo) || appliedFrom > appliedTo) {
      toast.error("Choose a valid date range first.");
      return;
    }
    setExportBusy(true);
    try {
      const qs = new URLSearchParams({ from: appliedFrom, to: appliedTo, view });
      if (search.trim()) qs.set("search", search.trim());
      Object.entries(filters).forEach(([key, value]) => {
        if (value.trim()) qs.set(key, value.trim());
      });
      const csv = await api.getText(`/api/dashboard/transactions/export.csv?${qs.toString()}`);
      if (!csv.trim()) throw new Error("The statement is empty.");
      const filename = `brikoh-transactions-${appliedFrom}-to-${appliedTo}.csv`;
      if (Platform.OS === "web") {
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      } else {
        const file = new File(Paths.cache, filename);
        await file.write(csv);
        if (!(await Sharing.isAvailableAsync())) throw new Error("Sharing isn't available on this device.");
        await Sharing.shareAsync(file.uri, { mimeType: "text/csv", dialogTitle: "Export transactions", UTI: "public.comma-separated-values-text" });
      }
      toast.success("Transaction statement exported.");
    } catch (e: any) {
      toast.error(apiErrorMessage(e, "Couldn't export the transaction statement."));
    } finally {
      setExportBusy(false);
    }
  };

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    setError(null);
    try {
      const res: any = await api.get("/api/dashboard/wallet");
      const w = res?.wallet ?? res;
      setWallet(w);
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
          refreshControl={<RefreshControl refreshing={refreshing} tintColor={C.brand} onRefresh={() => { setRefreshing(true); load(true); loadTransactions(); }} />}
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

              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 8 }}>
                <T w="display" size={17}>Transactions</T>
                <Button label="Export CSV" icon="download-outline" variant="outline" small onPress={exportTransactions} busy={exportBusy} />
              </View>
              <Card style={{ padding: 14, gap: 12 }}>
                <DateField label="From" value={fromDate} onChange={setFromDate} quick />
                <DateField label="To" value={toDate} onChange={setToDate} quick />
                {transactionDateError ? <T w="semi" size={12} color={C.danger500}>{transactionDateError}</T> : null}
                <Button
                  label="Apply date range"
                  onPress={() => { setAppliedFrom(fromDate); setAppliedTo(toDate); }}
                  disabled={!!transactionDateError || transactionsLoading}
                  small
                />
              </Card>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <Chip label="All transactions" on={view === "all"} onPress={() => setView("all")} />
                <Chip label="Wallet only" on={view === "wallet"} onPress={() => setView("wallet")} />
                <Button label="Filters" icon="options-outline" variant="outline" small onPress={() => { setFilterDraft(filters); setFiltersOpen(true); }} />
              </View>
              <SearchBar value={search} onChangeText={setSearch} placeholder="Search transactions" />
              <Card style={{ paddingHorizontal: 14 }}>
                {transactionsLoading ? (
                  <View style={{ paddingVertical: 10, gap: 10 }}><Skeleton h={54} r={14} /><Skeleton h={54} r={14} /></View>
                ) : transactionsError ? (
                  <ErrorState message={transactionsError} onRetry={() => loadTransactions()} />
                ) : transactions.length === 0 ? (
                  <T w="semi" size={13} color={C.ink400} style={{ paddingVertical: 24, textAlign: "center" }}>
                    No transactions found for this date range.
                  </T>
                ) : (
                  transactions.map((transaction, i) => {
                    const direction = String(transaction.direction || "").toUpperCase();
                    const credit = ["CREDIT", "IN", "INBOUND"].includes(direction);
                    const title = transaction.description || transaction.title || transaction.source || transaction.type || "Transaction";
                    const subtitle = [transactionDate(transaction.createdAt || transaction.date), transaction.method ? titleCase(transaction.method) : null, transaction.branch?.name || transaction.branchName].filter(Boolean).join(" · ");
                    return (
                      <Pressable
                        key={String(transaction.id || i)}
                        onPress={() => openTransaction(transaction)}
                        style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12, borderTopWidth: i ? 1 : 0, borderTopColor: C.cream100, opacity: pressed ? 0.75 : 1 })}
                      >
                        <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: credit ? C.leaf100 : C.cream100, alignItems: "center", justifyContent: "center" }}>
                          <Ionicons name={credit ? "arrow-down" : "arrow-up"} size={17} color={credit ? C.leaf500 : C.ink500} />
                        </View>
                        <View style={{ flex: 1, gap: 3 }}>
                          <T w="bold" size={13.5} numberOfLines={1}>{titleCase(String(title).replace(/_/g, " "))}</T>
                          <T w="regular" size={11} color={C.ink400} numberOfLines={1}>{subtitle}</T>
                        </View>
                        <View style={{ alignItems: "flex-end", gap: 4 }}>
                          <T w="extra" size={13} color={credit ? C.leaf500 : C.ink700}>{credit ? "+" : "−"}{fm(Math.abs(rawNum(transaction.amount)), transaction.currency || currency)}</T>
                          {transaction.status ? <StatusPill status={transaction.status} /> : null}
                        </View>
                      </Pressable>
                    );
                  })
                )}
                {!transactionsLoading && !transactionsError && nextCursor ? (
                  <Button label="Load more" variant="outline" small busy={transactionsMore} onPress={() => loadTransactions(nextCursor)} style={{ marginVertical: 10 }} />
                ) : null}
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

      <Sheet
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        title="Transaction filters"
        footer={
          <View style={{ flexDirection: "row", gap: 10 }}>
            <Button
              label="Clear"
              variant="outline"
              small
              style={{ flex: 1 }}
              onPress={() => {
                const empty = { direction: "", type: "", status: "", method: "", branch: "" };
                setFilterDraft(empty);
                setFilters(empty);
                setFiltersOpen(false);
              }}
            />
            <Button label="Apply filters" small style={{ flex: 1.4 }} onPress={() => { setFilters(filterDraft); setFiltersOpen(false); }} />
          </View>
        }
      >
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 18, gap: 12, paddingBottom: 8 }}>
          <Field label="Direction" hint="Example: credit or debit">
            <Input value={filterDraft.direction} onChangeText={(direction) => setFilterDraft({ ...filterDraft, direction })} placeholder="Any direction" autoCapitalize="none" />
          </Field>
          <Field label="Type">
            <Input value={filterDraft.type} onChangeText={(type) => setFilterDraft({ ...filterDraft, type })} placeholder="Any type" autoCapitalize="none" />
          </Field>
          <Field label="Status">
            <Input value={filterDraft.status} onChangeText={(status) => setFilterDraft({ ...filterDraft, status })} placeholder="Any status" autoCapitalize="none" />
          </Field>
          <Field label="Method">
            <Input value={filterDraft.method} onChangeText={(method) => setFilterDraft({ ...filterDraft, method })} placeholder="Any method" autoCapitalize="none" />
          </Field>
          <Field label="Branch" hint="Branch ID">
            <Input value={filterDraft.branch} onChangeText={(branch) => setFilterDraft({ ...filterDraft, branch })} placeholder="Any branch" autoCapitalize="none" />
          </Field>
        </ScrollView>
      </Sheet>

      <Sheet open={detailOpen} onClose={() => setDetailOpen(false)} title="Transaction details">
        {detailBusy ? (
          <View style={{ paddingHorizontal: 18, paddingBottom: 20, gap: 10 }}><Skeleton h={52} r={14} /><Skeleton h={52} r={14} /></View>
        ) : detailError ? (
          <ErrorState message={detailError} onRetry={() => detailItem && openTransaction(detailItem)} />
        ) : detail ? (
          <ScrollView contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 18 }}>
            <Card style={{ paddingHorizontal: 14 }}>
              {[
                ["ID", detail.id],
                ["Type", detail.type ? titleCase(String(detail.type).replace(/_/g, " ")) : null],
                ["Direction", detail.direction ? titleCase(detail.direction) : null],
                ["Status", detail.status ? titleCase(detail.status) : null],
                ["Amount", detail.amount != null ? fm(detail.amount, detail.currency || currency) : null],
                ["Method", detail.method ? titleCase(detail.method) : null],
                ["Reference", detail.reference],
                ["Description", detail.description],
                ["Branch", detail.branch?.name || detail.branchName],
                ["Date", transactionDate(detail.createdAt || detail.date)],
              ].filter(([, value]) => value != null && value !== "").map(([label, value], index) => (
                <View key={String(label)} style={{ paddingVertical: 12, borderTopWidth: index ? 1 : 0, borderTopColor: C.cream100, gap: 3 }}>
                  <T w="semi" size={11} color={C.ink400}>{label}</T>
                  <T w="bold" size={13} selectable>{String(value)}</T>
                </View>
              ))}
            </Card>
          </ScrollView>
        ) : null}
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
