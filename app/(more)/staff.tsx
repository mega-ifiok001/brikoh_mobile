import { useCallback, useEffect, useState } from "react";
import { FlatList, KeyboardAvoidingView, Platform, RefreshControl, ScrollView, View } from "react-native";
import { useAuth } from "../../src/context/AuthContext";
import { api } from "../../src/lib/api";
import { getAccess, ROLE_META } from "../../src/lib/access";
import { apiErrorMessage, asList, fd, titleCase } from "../../src/lib/format";
import { Avatar, Button, Card, EmptyState, ErrorState, Field, Input, ListSkeleton, Pill, Sheet, T, toast } from "../../src/components/ui";
import { AddButton, ConfirmSheet, Page, SectionTitle, SelectField } from "../../src/components/kit";
import { C } from "../../src/theme";

const ROLES = (["ADMIN", "MANAGER", "STAFF"] as const).map((id) => ({ value: id as string, label: ROLE_META[id].label, sub: ROLE_META[id].hint }));

const emailOf = (m: any): string => (m ? m.email || m.account?.email || "" : "");

export default function Staff() {
  const { me } = useAuth();
  const allowed = getAccess(me).can("staff");
  const myEmail: string = (me.account as any)?.email || "";

  const [members, setMembers] = useState<any[]>([]);
  const [invites, setInvites] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [invEmail, setInvEmail] = useState("");
  const [invRole, setInvRole] = useState("STAFF");
  const [invBusy, setInvBusy] = useState(false);

  const [editFor, setEditFor] = useState<any | null>(null);
  const [editRole, setEditRole] = useState("STAFF");
  const [editBusy, setEditBusy] = useState(false);

  const [removeFor, setRemoveFor] = useState<any | null>(null);
  const [removeBusy, setRemoveBusy] = useState(false);
  const [revokeFor, setRevokeFor] = useState<any | null>(null);
  const [revokeBusy, setRevokeBusy] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await api.get("/api/dashboard/staff");
      setMembers(asList(res, "items", "staff", "staffMembers", "data"));
    } catch (e: any) {
      if (e?.status === 403 || e?.code === "INSUFFICIENT_PERMISSIONS") {
        setError("Only the store owner can manage staff. Staff accounts cannot open this page.");
      } else {
        setError(apiErrorMessage(e, "Couldn't load the team."));
      }
      setMembers([]);
    }
    try {
      const res = await api.get("/api/dashboard/staff/invites");
      setInvites(asList(res, "items", "invites", "data"));
    } catch {
      setInvites([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (allowed) load();
  }, [load, allowed]);

  if (!allowed) {
    return (
      <Page title="Staff">
        <EmptyState icon="lock-closed-outline" title="Not available for your role" sub="Only the store owner or an admin can manage the team." />
      </Page>
    );
  }

  const isMe = (m: any) => {
    const em = emailOf(m);
    return !!em && em.toLowerCase() === myEmail.toLowerCase();
  };

  const sendInvite = async () => {
    const email = invEmail.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(email)) return toast.error("Enter a valid email for the invite.");
    setInvBusy(true);
    try {
      await api.post("/api/dashboard/staff/invites", { email, role: invRole });
      toast.success(`Invite sent to ${email}.`);
      setInvEmail("");
      setInviteOpen(false);
      load();
    } catch (e: any) {
      toast.error(
        apiErrorMessage(e, "Couldn't send the invite.", {
          EMAIL_TAKEN: "That email already belongs to an account.",
          ALREADY_STAFF: "That person is already on your team.",
          STAFF_LIMIT_REACHED: "You've reached your staff limit for this plan.",
        })
      );
    } finally {
      setInvBusy(false);
    }
  };

  const openEdit = (m: any) => {
    setEditFor(m);
    setEditRole(String(m.role || "STAFF").toUpperCase());
  };

  const saveRole = async () => {
    if (!editFor) return;
    setEditBusy(true);
    try {
      await api.patch(`/api/dashboard/staff/${editFor.id}`, { role: editRole });
      toast.success(`${emailOf(editFor)} is now ${ROLE_META[editRole as keyof typeof ROLE_META]?.label ?? titleCase(editRole)}.`);
      setEditFor(null);
      load();
    } catch (e: any) {
      toast.error(apiErrorMessage(e, "Couldn't change the role."));
    } finally {
      setEditBusy(false);
    }
  };

  const toggleActive = async () => {
    if (!editFor) return;
    const next = editFor.isActive === false; // currently inactive -> activate
    setEditBusy(true);
    try {
      await api.patch(`/api/dashboard/staff/${editFor.id}`, { isActive: next });
      toast.success(next ? `${emailOf(editFor)} can sign in again.` : `${emailOf(editFor)} is deactivated.`);
      setEditFor(null);
      load();
    } catch (e: any) {
      toast.error(apiErrorMessage(e, "Couldn't update the member."));
    } finally {
      setEditBusy(false);
    }
  };

  const confirmRemove = async () => {
    if (!removeFor) return;
    setRemoveBusy(true);
    try {
      await api.del(`/api/dashboard/staff/${removeFor.id}`);
      toast.success("Member removed from the team.");
      setRemoveFor(null);
      load();
    } catch (e: any) {
      toast.error(apiErrorMessage(e, "Couldn't remove the member."));
    } finally {
      setRemoveBusy(false);
    }
  };

  const confirmRevoke = async () => {
    if (!revokeFor) return;
    setRevokeBusy(true);
    try {
      await api.del(`/api/dashboard/staff/invites/${revokeFor.id}`);
      toast.success("Invite revoked.");
      setRevokeFor(null);
      load();
    } catch (e: any) {
      toast.error(apiErrorMessage(e, "Couldn't revoke the invite."));
    } finally {
      setRevokeBusy(false);
    }
  };

  const permSummary = (m: any): string => {
    const p = m.permissions;
    if (!Array.isArray(p) || p.length === 0) return "";
    if (p.includes("all")) return "All permissions";
    return p.slice(0, 3).join(", ") + (p.length > 3 ? "..." : "");
  };

  return (
    <Page title="Staff" right={<AddButton onPress={() => setInviteOpen(true)} />}>
      {loading ? (
        <View style={{ padding: 16 }}>
          <ListSkeleton rows={4} />
        </View>
      ) : (
        <FlatList
          data={error ? [] : members}
          keyExtractor={(m) => String(m.id)}
          contentContainerStyle={{ padding: 16, paddingBottom: 32, gap: 10 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load();
              }}
              tintColor={C.brand}
            />
          }
          ListHeaderComponent={
            <T w="regular" size={13} color={C.ink400} style={{ marginBottom: 4 }}>
              Who can sign in and what they can touch.
            </T>
          }
          ListEmptyComponent={
            error ? (
              <ErrorState message={error} onRetry={load} />
            ) : (
              <EmptyState icon="people-outline" title="Just you so far" sub="Invite a colleague to help with sales, stock or money, each with their own role." />
            )
          }
          renderItem={({ item: m }) => {
            const mine = isMe(m);
            const active = m.isActive !== false;
            const perms = permSummary(m);
            return (
              <Card onPress={mine ? undefined : () => openEdit(m)} style={{ padding: 14, flexDirection: "row", alignItems: "center", gap: 12 }}>
                <Avatar name={emailOf(m) || "?"} />
                <View style={{ flex: 1, gap: 3 }}>
                  <T w="extra" size={14} numberOfLines={1}>
                    {emailOf(m)}
                    {mine ? " (you)" : ""}
                  </T>
                  <T w="regular" size={12} color={C.ink400}>
                    Joined {fd(m.createdAt)}
                    {perms ? ` · ${perms}` : ""}
                  </T>
                  <View style={{ flexDirection: "row", gap: 6, marginTop: 2 }}>
                    <Pill tone={mine ? "dark" : "brand"}>{mine ? "Owner" : titleCase(m.role || "STAFF")}</Pill>
                    <Pill tone={active ? "green" : "neutral"}>{active ? "Active" : "Deactivated"}</Pill>
                  </View>
                </View>
              </Card>
            );
          }}
          ListFooterComponent={
            !error && invites.length > 0 ? (
              <View style={{ gap: 10, marginTop: 10 }}>
                <SectionTitle>Pending invites</SectionTitle>
                <T w="regular" size={12} color={C.ink400}>
                  The invite link is only in the email. It is never shown here.
                </T>
                {invites.map((inv) => (
                  <Card key={String(inv.id)} style={{ padding: 14, flexDirection: "row", alignItems: "center", gap: 10 }}>
                    <View style={{ flex: 1 }}>
                      <T w="bold" size={14} numberOfLines={1}>
                        {inv.email}
                      </T>
                      <T w="regular" size={12} color={C.ink400}>
                        {titleCase(inv.role || "STAFF")} · expires {fd(inv.expiresAt)}
                      </T>
                    </View>
                    <Button label="Revoke" variant="danger" small onPress={() => setRevokeFor(inv)} />
                  </Card>
                ))}
              </View>
            ) : undefined
          }
        />
      )}

      {/* Invite */}
      <Sheet
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        title="Invite someone"
        footer={<Button label="Send invite" icon="send" onPress={sendInvite} busy={invBusy} />}
      >
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 18, gap: 14, paddingBottom: 6 }}>
            <T w="regular" size={12.5} color={C.ink400}>
              They'll get an email with a link to join your store.
            </T>
            <Field label="Email">
              <Input value={invEmail} onChangeText={setInvEmail} placeholder="colleague@email.com" keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />
            </Field>
            <SelectField label="Role" value={invRole} options={ROLES} onChange={setInvRole} />
          </ScrollView>
        </KeyboardAvoidingView>
      </Sheet>

      {/* Edit member */}
      <Sheet
        open={!!editFor}
        onClose={() => setEditFor(null)}
        title="Edit member"
        footer={
          <View style={{ gap: 10 }}>
            <Button label="Save role" onPress={saveRole} busy={editBusy} disabled={String(editFor?.role || "STAFF").toUpperCase() === editRole} />
            <View style={{ flexDirection: "row", gap: 10 }}>
              <Button
                label={editFor?.isActive === false ? "Re-activate" : "Deactivate"}
                variant="outline"
                onPress={toggleActive}
                disabled={editBusy}
                style={{ flex: 1 }}
              />
              <Button
                label="Remove"
                variant="danger"
                disabled={editBusy}
                onPress={() => {
                  setRemoveFor(editFor);
                  setEditFor(null);
                }}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        }
      >
        <View style={{ paddingHorizontal: 18, gap: 14 }}>
          <T w="bold" size={14}>
            {emailOf(editFor)}
          </T>
          {permSummary(editFor || {}) ? (
            <T w="regular" size={12} color={C.ink400}>
              Permissions: {permSummary(editFor)}
            </T>
          ) : null}
          <SelectField label="Role" value={editRole} options={ROLES} onChange={setEditRole} />
        </View>
      </Sheet>

      <ConfirmSheet
        open={!!removeFor}
        title={`Remove ${emailOf(removeFor)}?`}
        message="They'll lose access immediately. Their sales history and stock movements stay in the records."
        confirmLabel="Remove member"
        danger
        busy={removeBusy}
        onConfirm={confirmRemove}
        onClose={() => setRemoveFor(null)}
      />
      <ConfirmSheet
        open={!!revokeFor}
        title="Revoke invite?"
        message={`The invite sent to ${revokeFor?.email ?? "this address"} will no longer work.`}
        confirmLabel="Revoke invite"
        danger
        busy={revokeBusy}
        onConfirm={confirmRevoke}
        onClose={() => setRevokeFor(null)}
      />
    </Page>
  );
}
