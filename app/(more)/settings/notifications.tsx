import { useCallback, useEffect, useState } from "react";
import { api } from "../../../src/lib/api";
import { apiErrorMessage } from "../../../src/lib/format";
import { Card, toast } from "../../../src/components/ui";
import { SwitchRow } from "../../../src/components/kit";
import { SaveBar, SettingsScreen } from "../../../src/components/settings/bits";

type Prefs = { lowStockAlerts: boolean; paymentAlerts: boolean; expiringSoonAlerts: boolean; receiptsEnabled: boolean };

const ROWS: { key: keyof Prefs; title: string; body: string }[] = [
  { key: "lowStockAlerts", title: "Low stock", body: "Email me when a product's stock falls to its alert threshold." },
  { key: "paymentAlerts", title: "Payments received", body: "Email me the moment money lands: online sales, credit repayments, invoice payments." },
  { key: "expiringSoonAlerts", title: "Expiring products", body: "Email me when something on the shelf is about to pass its expiry date." },
  { key: "receiptsEnabled", title: "Customer receipts", body: "Email your customer a branded receipt after a successful sale. Uses the email captured on the order; a walk-in sale with no email sends nothing." },
];

export default function NotificationSettings() {
  const [form, setForm] = useState<Prefs>({ lowStockAlerts: true, paymentAlerts: true, expiringSoonAlerts: true, receiptsEnabled: true });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res: any = await api.get("/api/dashboard/settings/notifications");
      setForm({
        lowStockAlerts: res.lowStockAlerts !== false,
        paymentAlerts: res.paymentAlerts !== false,
        expiringSoonAlerts: res.expiringSoonAlerts !== false,
        receiptsEnabled: res.receiptsEnabled !== false,
      });
    } catch (e: any) {
      setError(apiErrorMessage(e, "Couldn't load alert preferences."));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    setBusy(true);
    try {
      await api.put("/api/dashboard/settings/notifications", form);
      toast.success("Alert preferences saved.");
    } catch (e: any) {
      toast.error(apiErrorMessage(e, "Couldn't save alert settings."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SettingsScreen title="Alerts" loading={loading} error={error} onRetry={load}>
      <Card style={{ paddingHorizontal: 14 }}>
        {ROWS.map((r) => (
          <SwitchRow key={r.key} label={r.title} sub={r.body} value={form[r.key]} onChange={(v) => setForm((f) => ({ ...f, [r.key]: v }))} />
        ))}
      </Card>
      <SaveBar label="Save preferences" busy={busy} onPress={save} />
    </SettingsScreen>
  );
}
