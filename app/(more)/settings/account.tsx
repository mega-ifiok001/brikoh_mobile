import { useState } from "react";
import { api } from "../../../src/lib/api";
import { apiErrorMessage } from "../../../src/lib/format";
import { useAuth } from "../../../src/context/AuthContext";
import { Button, Card, Field, Input, T, toast } from "../../../src/components/ui";
import { ConfirmSheet, DetailRow } from "../../../src/components/kit";
import { SaveBar, SettingsScreen } from "../../../src/components/settings/bits";
import { C } from "../../../src/theme";

export default function AccountSettings() {
  const { me, logout } = useAuth();
  const account: any = me.account || {};
  const name = account.fullName || account.name || [account.firstName, account.lastName].filter(Boolean).join(" ");

  const [pw, setPw] = useState({ current: "", next: "", confirm: "" });
  const [pwBusy, setPwBusy] = useState(false);
  const [delOpen, setDelOpen] = useState(false);
  const [delBusy, setDelBusy] = useState(false);

  const savePassword = async () => {
    if (!pw.current) return toast.error("Enter your current password.");
    if (pw.next.length < 8) return toast.error("New password must be at least 8 characters.");
    if (pw.next !== pw.confirm) return toast.error("New passwords don't match.");
    setPwBusy(true);
    try {
      await api.post("/api/dashboard/settings/password", { currentPassword: pw.current, newPassword: pw.next, confirmPassword: pw.confirm });
      setPw({ current: "", next: "", confirm: "" });
      toast.success("Password changed. Other sessions have been signed out.");
    } catch (e: any) {
      toast.error(apiErrorMessage(e, "Couldn't change the password.", { INVALID_CREDENTIALS: "Current password is incorrect." }));
    } finally {
      setPwBusy(false);
    }
  };

  const deleteAccount = async () => {
    setDelBusy(true);
    try {
      await api.del("/api/dashboard/account");
      toast.success("Account deleted.");
      setDelOpen(false);
      try {
        await logout();
      } catch {
        /* session already gone */
      }
    } catch (e: any) {
      toast.error(apiErrorMessage(e, "Couldn't delete the account."));
      setDelOpen(false);
    } finally {
      setDelBusy(false);
    }
  };

  return (
    <SettingsScreen title="Account and password">
      <Card style={{ paddingHorizontal: 14 }}>
        {name ? <DetailRow label="Name" value={name} /> : null}
        <DetailRow label="Email" value={account.email || "-"} />
        {account.phone ? <DetailRow label="Phone" value={String(account.phone)} /> : null}
      </Card>
      <T w="regular" size={12} color={C.ink400}>
        Profile fields (name, phone) are managed at signup. Password and account deletion live here.
      </T>

      <T w="display" size={17} style={{ marginTop: 6 }}>
        Change password
      </T>
      <Field label="Current password">
        <Input secureTextEntry value={pw.current} onChangeText={(v) => setPw({ ...pw, current: v })} autoCapitalize="none" autoComplete="current-password" />
      </Field>
      <Field label="New password" hint="At least 8 characters">
        <Input secureTextEntry value={pw.next} onChangeText={(v) => setPw({ ...pw, next: v })} autoCapitalize="none" autoComplete="new-password" />
      </Field>
      <Field label="Confirm new password">
        <Input secureTextEntry value={pw.confirm} onChangeText={(v) => setPw({ ...pw, confirm: v })} autoCapitalize="none" autoComplete="new-password" />
      </Field>
      <SaveBar label="Update password" icon="key-outline" busy={pwBusy} onPress={savePassword} />

      <Card style={{ padding: 16, marginTop: 10, gap: 10, borderColor: C.danger100 }}>
        <T w="display" size={16} color={C.danger500}>
          Danger zone
        </T>
        <T w="regular" size={12.5} color={C.ink500}>
          Permanently delete your account and the entire store: orders, products, customers, everything. This cannot be undone.
        </T>
        <Button label="Delete account" variant="danger" onPress={() => setDelOpen(true)} />
      </Card>

      <ConfirmSheet
        open={delOpen}
        danger
        busy={delBusy}
        title="Delete your account forever?"
        message="Your store, orders, stock, customers and staff will all be permanently removed."
        confirmLabel="Yes, delete everything"
        onConfirm={deleteAccount}
        onClose={() => setDelOpen(false)}
      />
    </SettingsScreen>
  );
}
