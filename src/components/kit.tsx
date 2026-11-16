// Shared building blocks for the "manage" screens (forms, pickers, headers).
// Built on top of ui.tsx — import primitives (T, Card, Button, Input, Sheet…) from there.
import { useState, type ReactNode } from "react";
import { Pressable, ScrollView, Switch, View } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { C, R, shadow } from "../theme";
import { Button, Field, Sheet, T, tap, type IconName } from "./ui";

/** Back button + centered title + optional right slot. Use as the top row of every pushed screen. */
export function ScreenHeader({ title, right, onBack }: { title: string; right?: ReactNode; onBack?: () => void }) {
  const router = useRouter();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 8, gap: 8 }}>
      <Pressable
        onPress={() => (onBack ? onBack() : router.canGoBack() ? router.back() : router.replace("/home"))}
        hitSlop={10}
        style={{ width: 40, height: 40, borderRadius: 13, backgroundColor: C.white, borderWidth: 1, borderColor: C.cream200, alignItems: "center", justifyContent: "center" }}
      >
        <Ionicons name="chevron-back" size={20} color={C.ink900} />
      </Pressable>
      <T w="extra" size={15} numberOfLines={1} style={{ flex: 1, textAlign: "center" }}>
        {title}
      </T>
      <View style={{ minWidth: 40, alignItems: "flex-end" }}>{right}</View>
    </View>
  );
}

/** Standard page wrapper for pushed screens: safe area + header. Children render below the header. */
export function Page({ title, right, children }: { title: string; right?: ReactNode; children: ReactNode }) {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.cream50 }}>
      <ScreenHeader title={title} right={right} />
      {children}
    </SafeAreaView>
  );
}

/** Round orange "+" button for the header's right slot. */
export function AddButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      onPress={() => {
        tap();
        onPress();
      }}
      hitSlop={8}
      style={({ pressed }) => ({ width: 40, height: 40, borderRadius: 13, backgroundColor: C.brand, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.85 : 1, ...shadow.brand })}
    >
      <Ionicons name="add" size={22} color="#fff" />
    </Pressable>
  );
}

/** Picker: shows the selected label in an input-looking row; opens a bottom sheet of options. */
export interface Option {
  value: string;
  label: string;
  sub?: string;
}
export function SelectField({
  label,
  value,
  options,
  onChange,
  placeholder = "Select…",
  hint,
}: {
  label?: string;
  value: string;
  options: Option[];
  onChange: (v: string) => void;
  placeholder?: string;
  hint?: string;
}) {
  const [open, setOpen] = useState(false);
  const sel = options.find((o) => o.value === value);
  return (
    <>
      <Field label={label} hint={hint}>
        <Pressable
          onPress={() => {
            tap();
            setOpen(true);
          }}
          style={{ height: 52, borderRadius: 15, backgroundColor: C.white, borderWidth: 1.5, borderColor: C.cream300, flexDirection: "row", alignItems: "center", paddingHorizontal: 14, gap: 8 }}
        >
          <T w="semi" size={15} color={sel ? C.ink900 : C.ink300} style={{ flex: 1 }} numberOfLines={1}>
            {sel?.label || placeholder}
          </T>
          <Ionicons name="chevron-down" size={18} color={C.ink400} />
        </Pressable>
      </Field>
      <Sheet open={open} onClose={() => setOpen(false)} title={label || "Choose"}>
        <ScrollView style={{ maxHeight: 420 }} contentContainerStyle={{ paddingHorizontal: 18, gap: 8, paddingBottom: 10 }}>
          {options.length === 0 ? (
            <T w="regular" size={13} color={C.ink400} style={{ paddingVertical: 20, textAlign: "center" }}>
              Nothing to choose from yet.
            </T>
          ) : null}
          {options.map((o) => {
            const on = o.value === value;
            return (
              <Pressable
                key={o.value}
                onPress={() => {
                  onChange(o.value);
                  setOpen(false);
                }}
                style={{ flexDirection: "row", alignItems: "center", gap: 10, padding: 14, borderRadius: 16, borderWidth: 1.5, borderColor: on ? C.brand : C.cream200, backgroundColor: on ? C.brand50 : C.white }}
              >
                <View style={{ flex: 1 }}>
                  <T w="bold" size={14}>
                    {o.label}
                  </T>
                  {o.sub ? (
                    <T w="regular" size={12} color={C.ink400}>
                      {o.sub}
                    </T>
                  ) : null}
                </View>
                {on ? <Ionicons name="checkmark-circle" size={20} color={C.brand} /> : null}
              </Pressable>
            );
          })}
        </ScrollView>
      </Sheet>
    </>
  );
}

/** Confirmation bottom sheet for destructive / irreversible actions. */
export function ConfirmSheet({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  danger,
  busy,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  message?: string;
  confirmLabel?: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <View style={{ flexDirection: "row", gap: 10 }}>
          <Button label="Cancel" variant="outline" onPress={onClose} style={{ flex: 1 }} disabled={busy} />
          <Button label={confirmLabel} variant={danger ? "danger" : "primary"} onPress={onConfirm} busy={busy} style={{ flex: 1.4 }} />
        </View>
      }
    >
      {message ? (
        <T w="regular" size={14} color={C.ink500} style={{ paddingHorizontal: 18, lineHeight: 21 }}>
          {message}
        </T>
      ) : null}
    </Sheet>
  );
}

/** Row with a title, optional description and a native switch. */
export function SwitchRow({ label, sub, value, onChange }: { label: string; sub?: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10 }}>
      <View style={{ flex: 1 }}>
        <T w="bold" size={14}>
          {label}
        </T>
        {sub ? (
          <T w="regular" size={12} color={C.ink400} style={{ marginTop: 1 }}>
            {sub}
          </T>
        ) : null}
      </View>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: C.brand, false: C.cream300 }} thumbColor="#fff" ios_backgroundColor={C.cream300} />
    </View>
  );
}

/** Pill-style segmented control (2–4 options). */
export function Segmented({ options, value, onChange }: { options: { value: string; label: string }[]; value: string; onChange: (v: string) => void }) {
  return (
    <View style={{ flexDirection: "row", backgroundColor: C.cream100, borderRadius: 14, padding: 4 }}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => {
              tap();
              onChange(o.value);
            }}
            style={{ flex: 1, height: 38, borderRadius: 11, alignItems: "center", justifyContent: "center", backgroundColor: on ? C.white : "transparent", ...(on ? shadow.card : null) }}
          >
            <T w="bold" size={12.5} color={on ? C.ink900 : C.ink500}>
              {o.label}
            </T>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Small stat tile used in rows of 2–3 (label on top, big number below). */
export function StatTile({ label, value, tone }: { label: string; value: string; tone?: "gold" | "green" | "danger" }) {
  const color = tone === "gold" ? C.gold600 : tone === "green" ? C.leaf500 : tone === "danger" ? C.danger500 : C.ink900;
  return (
    <View style={{ flex: 1, backgroundColor: C.white, borderWidth: 1, borderColor: C.cream200, borderRadius: R.lg, padding: 12, ...shadow.card }}>
      <T w="semi" size={11} color={C.ink400}>
        {label}
      </T>
      <T w="display" size={18} color={color} style={{ marginTop: 2 }} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </T>
    </View>
  );
}

/** Tappable list row with icon / title / subtitle / right content. */
export function ListRow({
  icon,
  title,
  sub,
  right,
  onPress,
  last,
}: {
  icon?: IconName;
  title: string;
  sub?: string;
  right?: ReactNode;
  onPress?: () => void;
  last?: boolean;
}) {
  return (
    <Pressable
      disabled={!onPress}
      onPress={() => {
        tap();
        onPress?.();
      }}
      style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 13, borderBottomWidth: last ? 0 : 1, borderBottomColor: C.cream100, opacity: pressed ? 0.6 : 1 })}
    >
      {icon ? (
        <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: C.brand50, alignItems: "center", justifyContent: "center" }}>
          <Ionicons name={icon} size={18} color={C.brand} />
        </View>
      ) : null}
      <View style={{ flex: 1 }}>
        <T w="bold" size={14} numberOfLines={1}>
          {title}
        </T>
        {sub ? (
          <T w="regular" size={12} color={C.ink400} numberOfLines={2}>
            {sub}
          </T>
        ) : null}
      </View>
      {right}
    </Pressable>
  );
}

/** Label / value row for detail screens. */
export function DetailRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 14, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: C.cream100 }}>
      <T w="semi" size={13} color={C.ink400}>
        {label}
      </T>
      <T w={strong ? "extra" : "bold"} size={13} style={{ flex: 1, textAlign: "right" }}>
        {value}
      </T>
    </View>
  );
}

/** Section heading used between cards. */
export function SectionTitle({ children, action, onAction }: { children: string; action?: string; onAction?: () => void }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
      <T w="display" size={17}>
        {children}
      </T>
      {action ? (
        <Pressable onPress={onAction} hitSlop={10}>
          <T w="extra" size={12.5} color={C.brand}>
            {action}
          </T>
        </Pressable>
      ) : null}
    </View>
  );
}
