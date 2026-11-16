// Plain-text YYYY-MM-DD date entry (no native date picker is installed).
import { View } from "react-native";
import { Chip, Field, Input } from "../ui";
import { toISODate } from "../../lib/format";

export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** True when the string is a real calendar date in YYYY-MM-DD form. */
export function isValidDate(s: string): boolean {
  if (!DATE_RE.test(s)) return false;
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}

export function DateField({
  label,
  value,
  onChange,
  hint,
  quick,
  optional,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
  quick?: boolean;
  optional?: boolean;
}) {
  const today = new Date();
  const yest = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
  return (
    <Field label={label} hint={hint}>
      <Input
        value={value}
        onChangeText={(t) => onChange(t.replace(/[^0-9-]/g, "").slice(0, 10))}
        placeholder="YYYY-MM-DD"
        keyboardType="numbers-and-punctuation"
        maxLength={10}
      />
      {quick ? (
        <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
          <Chip label="Today" on={value === toISODate(today)} onPress={() => onChange(toISODate(today))} />
          <Chip label="Yesterday" on={value === toISODate(yest)} onPress={() => onChange(toISODate(yest))} />
          {optional && value ? <Chip label="Clear" onPress={() => onChange("")} /> : null}
        </View>
      ) : optional && value ? (
        <View style={{ flexDirection: "row", marginTop: 8 }}>
          <Chip label="Clear" onPress={() => onChange("")} />
        </View>
      ) : null}
    </Field>
  );
}
