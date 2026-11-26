import { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, Switch, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../../src/lib/api";
import { useAuth } from "../../../src/context/AuthContext";
import { apiErrorMessage, asList, fm } from "../../../src/lib/format";
import { Button, Card, EmptyState, Field, Input, Pill, Sheet, T, toast } from "../../../src/components/ui";
import { AddButton, ConfirmSheet, Segmented, SelectField, SwitchRow } from "../../../src/components/kit";
import { SettingsScreen } from "../../../src/components/settings/bits";
import { C } from "../../../src/theme";

/** Validate + normalize a fee into a 2dp decimal string (>= 0, <= 99,999,999.99). */
function normalizeFee(raw: string): string | null {
  const t = String(raw ?? "").trim().replace(/,/g, "");
  if (!t) return "0.00";
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return null;
  const n = Number(t);
  if (n > 99999999.99) return null;
  return n.toFixed(2);
}

const BLANK = { name: "", kind: "DELIVERY" as "PICKUP" | "DELIVERY", provider: "MANUAL" as "MANUAL" | "SHIPBUBBLE", description: "", baseFee: "", isActive: true, pickupAddressText: "" };

export default function DeliveryOptions() {
  const { me } = useAuth();
  const currency: string = me.store?.currency || "NGN";
  const [options, setOptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState({ ...BLANK });
  const [formBusy, setFormBusy] = useState(false);
  const [formErr, setFormErr] = useState("");
  const [delFor, setDelFor] = useState<any | null>(null);
  const [delBusy, setDelBusy] = useState(false);

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    setError(null);
    try {
      const res: any = await api.get("/api/dashboard/settings/delivery-options");
      setOptions(asList(res, "deliveryOptions", "items", "data"));
    } catch (e: any) {
      setError(apiErrorMessage(e, "Couldn't load delivery options."));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm({ ...BLANK });
    setFormErr("");
    setFormOpen(true);
  };
  const openEdit = (o: any) => {
    setEditing(o);
    setForm({
      name: o.name || "",
      kind: o.kind === "PICKUP" ? "PICKUP" : "DELIVERY",
      provider: o.provider === "SHIPBUBBLE" ? "SHIPBUBBLE" : "MANUAL",
      description: o.description || "",
      baseFee: o.baseFee != null ? String(o.baseFee) : "",
      isActive: o.isActive !== false,
      pickupAddressText: o.pickupAddressText || "",
    });
    setFormErr("");
    setFormOpen(true);
  };

  const submit = async () => {
    const name = form.name.trim();
    if (!name) return setFormErr("Give the option a name.");
    if (name.length > 200) return setFormErr("The name must be 200 characters or fewer.");
    const baseFee = form.provider === "SHIPBUBBLE" ? "0.00" : normalizeFee(form.baseFee);
    if (baseFee === null) return setFormErr("Base fee must be a number with at most 2 decimal places (max 99,999,999.99).");
    setFormBusy(true);
    setFormErr("");
    const payload: any = {
      name,
      kind: form.provider === "SHIPBUBBLE" ? "DELIVERY" : form.kind,
      provider: form.provider,
      description: form.description.trim() || null,
      isActive: form.isActive,
      ...(form.provider === "MANUAL" ? { baseFee } : {}),
      ...(form.provider === "MANUAL" && form.kind === "PICKUP" ? { pickupAddressText: form.pickupAddressText.trim() || null } : {}),
    };
    try {
      if (editing) {
        await api.put(`/api/dashboard/settings/delivery-options/${editing.id}`, payload);
        toast.success("Delivery option updated.");
      } else {
        await api.post("/api/dashboard/settings/delivery-options", payload);
        toast.success("Delivery option created.");
      }
      setFormOpen(false);
      load(true);
    } catch (e: any) {
      setFormErr(
        apiErrorMessage(e, "Couldn't save the delivery option.", {
          DELIVERY_OPTION_EXISTS: "An option with that name already exists.",
          ACCESS_DENIED: "Only the store owner can manage delivery options.",
          NOT_FOUND: "That option no longer exists. The list has changed.",
        })
      );
    } finally {
      setFormBusy(false);
    }
  };

  const toggleActive = async (o: any) => {
    try {
      await api.put(`/api/dashboard/settings/delivery-options/${o.id}`, { isActive: o.isActive === false });
      toast.success(o.isActive === false ? "Option is live on your storefront." : "Option hidden from your storefront.");
      load(true);
    } catch (e: any) {
      toast.error(apiErrorMessage(e, "Couldn't update the option."));
    }
  };

  const confirmDelete = async () => {
    if (!delFor) return;
    setDelBusy(true);
    try {
      await api.del(`/api/dashboard/settings/delivery-options/${delFor.id}`);
      toast.success("Delivery option deleted.");
      setDelFor(null);
      load(true);
    } catch (e: any) {
      toast.error(apiErrorMessage(e, "Couldn't delete the delivery option."));
    } finally {
      setDelBusy(false);
    }
  };

  return (
    <SettingsScreen
      title="Delivery options"
      loading={loading}
      error={error}
      onRetry={load}
      right={<AddButton onPress={openCreate} />}
      refreshing={refreshing}
      onRefresh={() => {
        setRefreshing(true);
        load(true);
      }}
    >
      <T w="regular" size={12} color={C.ink400}>
        The fulfilment choices buyers pick at checkout. The fee charged is the option's flat base fee. With at least one live option, checkout requires a selection.
      </T>
      {options.length === 0 ? (
        <Card>
          <EmptyState icon="bicycle-outline" title="No delivery options" sub="Add pickup or delivery choices so buyers can tell you how to get their order to them." action={<Button label="Add an option" onPress={openCreate} small />} />
        </Card>
      ) : (
        options.map((o) => {
          const pickup = o.kind === "PICKUP";
          const addr = o.pickupAddressText || o.pickupLocation?.address;
          return (
            <Card key={o.id} style={{ padding: 14, gap: 10 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <View style={{ width: 42, height: 42, borderRadius: 13, backgroundColor: pickup ? C.leaf100 : C.brand50, alignItems: "center", justifyContent: "center" }}>
                  <Ionicons name={pickup ? "storefront-outline" : "bicycle-outline"} size={20} color={pickup ? C.leaf500 : C.brand} />
                </View>
                <View style={{ flex: 1 }}>
                  <T w="extra" size={14.5} numberOfLines={1}>
                    {o.name}
                  </T>
                  <T w="regular" size={12.5} color={C.ink400} numberOfLines={2}>
                    {o.provider === "SHIPBUBBLE" ? "Courier rates are quoted at checkout" : `Base fee: ${fm(o.baseFee || "0", currency)}`}
                    {o.description ? ` · ${o.description}` : ""}
                  </T>
                </View>
                <Switch value={o.isActive !== false} onValueChange={() => toggleActive(o)} trackColor={{ true: C.brand, false: C.cream200 }} />
              </View>
              <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
                <Pill tone={pickup ? "neutral" : "brand"}>{pickup ? "Pickup" : "Delivery"}</Pill>
                {o.provider === "SHIPBUBBLE" ? <Pill tone="brand">Shipbubble</Pill> : null}
                {o.isActive === false ? <Pill tone="neutral">Hidden</Pill> : null}
              </View>
              {pickup && addr ? (
                <T w="regular" size={12} color={C.ink400}>
                  {addr}
                </T>
              ) : null}
              <View style={{ flexDirection: "row", gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <Button label="Edit" variant="outline" small icon="create-outline" onPress={() => openEdit(o)} />
                </View>
                <View style={{ flex: 1 }}>
                  <Button label="Delete" variant="danger" small icon="trash-outline" onPress={() => setDelFor(o)} />
                </View>
              </View>
            </Card>
          );
        })
      )}

      <Sheet
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? "Edit option" : "New delivery option"}
        footer={<Button label="Save option" icon="checkmark" onPress={submit} busy={formBusy} />}
      >
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 18, gap: 12, paddingBottom: 8 }}>
          {formErr ? (
            <T w="bold" size={12.5} color={C.danger500}>
              {formErr}
            </T>
          ) : null}
          <Field label="Name" hint='e.g. "Delivery rider", "Pick up at store"'>
            <Input value={form.name} onChangeText={(v) => setForm({ ...form, name: v })} placeholder="Delivery rider" maxLength={200} />
          </Field>
          <Field label="Provider">
            <SelectField
              value={form.provider}
              options={[
                { value: "MANUAL", label: "Manual delivery or pickup" },
                { value: "SHIPBUBBLE", label: "Shipbubble courier" },
              ]}
              onChange={(provider) => setForm({ ...form, provider: provider as "MANUAL" | "SHIPBUBBLE", ...(provider === "SHIPBUBBLE" ? { kind: "DELIVERY" as const } : {}) })}
            />
          </Field>
          {form.provider === "SHIPBUBBLE" ? (
            <T w="regular" size={12} color={C.ink400} style={{ lineHeight: 18 }}>
              Courier rates are quoted at storefront checkout. Configure your pickup address and package defaults in Settings → Shipbubble shipping, and add shipping weight to each product.
            </T>
          ) : null}
          {form.provider === "MANUAL" ? <Field label="Kind">
            <Segmented
              options={[
                { value: "DELIVERY", label: "Delivery" },
                { value: "PICKUP", label: "Pickup" },
              ]}
              value={form.kind}
              onChange={(v) => setForm({ ...form, kind: v as "PICKUP" | "DELIVERY" })}
            />
          </Field> : null}
          {form.provider === "MANUAL" ? <Field label={`Base fee (${currency})`} hint="Flat component, always charged.">
            <Input value={form.baseFee} onChangeText={(v) => setForm({ ...form, baseFee: v })} placeholder="0.00" keyboardType="decimal-pad" />
          </Field> : null}
          <Field label="Description" hint='Optional, e.g. "2-4 working days".'>
            <Input value={form.description} onChangeText={(v) => setForm({ ...form, description: v })} maxLength={500} />
          </Field>
          {form.provider === "MANUAL" && form.kind === "PICKUP" ? (
            <Field label="Pickup address" hint="Shown to the buyer at checkout. Optional.">
              <Input value={form.pickupAddressText} onChangeText={(v) => setForm({ ...form, pickupAddressText: v })} maxLength={500} multiline placeholder="12 Marina Rd, Lagos Island" />
            </Field>
          ) : null}
          <SwitchRow label="Live on storefront" value={form.isActive} onChange={(v) => setForm({ ...form, isActive: v })} />
        </ScrollView>
      </Sheet>

      <ConfirmSheet
        open={!!delFor}
        danger
        busy={delBusy}
        title={`Delete "${delFor?.name || ""}"?`}
        message="Buyers can no longer choose it at checkout. Orders already placed keep the delivery name and fee they were charged."
        confirmLabel="Delete option"
        onConfirm={confirmDelete}
        onClose={() => setDelFor(null)}
      />
    </SettingsScreen>
  );
}
