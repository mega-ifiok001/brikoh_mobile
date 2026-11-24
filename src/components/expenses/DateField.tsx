import { useState } from "react";
import { Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { C } from "../../theme";
import { toISODate } from "../../lib/format";
import { Chip, Field, Sheet, T, tap } from "../ui";

export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** True when the string is a real calendar date in YYYY-MM-DD form. */
export function isValidDate(s: string): boolean {
  if (!DATE_RE.test(s)) return false;
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}

function dateFromValue(value: string): Date {
  if (!isValidDate(value)) return new Date();
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, m - 1, d, 12);
}

function displayValue(value: string): string {
  return isValidDate(value)
    ? dateFromValue(value).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
    : "Choose a date";
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
  const [open, setOpen] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const d = dateFromValue(value);
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const selected = isValidDate(value) ? dateFromValue(value) : null;
  const year = visibleMonth.getFullYear();
  const month = visibleMonth.getMonth();
  const monthTitle = visibleMonth.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  const leadingDays = (new Date(year, month, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = Array.from({ length: Math.ceil((leadingDays + daysInMonth) / 7) * 7 }, (_, index) => {
    const day = index - leadingDays + 1;
    return day > 0 && day <= daysInMonth ? day : null;
  });
  const today = toISODate(new Date());
  const yesterday = toISODate(new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate() - 1));

  const openPicker = () => {
    const d = dateFromValue(value);
    setVisibleMonth(new Date(d.getFullYear(), d.getMonth(), 1));
    setOpen(true);
  };

  return (
    <>
      <Field label={label} hint={hint}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${label}: ${displayValue(value)}`}
          onPress={openPicker}
          style={({ pressed }) => ({
            height: 52,
            borderRadius: 15,
            backgroundColor: C.white,
            borderWidth: 1.5,
            borderColor: C.cream300,
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 14,
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <T w="semi" size={15} color={selected ? C.ink900 : C.ink300} style={{ flex: 1 }} numberOfLines={1}>
            {displayValue(value)}
          </T>
          <Ionicons name="calendar-outline" size={19} color={C.ink400} />
        </Pressable>
        {quick ? (
          <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
            <Chip label="Today" on={value === today} onPress={() => onChange(today)} />
            <Chip label="Yesterday" on={value === yesterday} onPress={() => onChange(yesterday)} />
            {optional && value ? <Chip label="Clear" onPress={() => onChange("")} /> : null}
          </View>
        ) : optional && value ? (
          <View style={{ flexDirection: "row", marginTop: 8 }}>
            <Chip label="Clear" onPress={() => onChange("")} />
          </View>
        ) : null}
      </Field>

      <Sheet open={open} onClose={() => setOpen(false)} title="Choose date">
        <View style={{ paddingHorizontal: 18, paddingBottom: 18 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Previous month"
              onPress={() => {
                tap();
                setVisibleMonth(new Date(year, month - 1, 1));
              }}
              hitSlop={8}
              style={{ width: 40, height: 40, borderRadius: 13, backgroundColor: C.cream100, alignItems: "center", justifyContent: "center" }}
            >
              <Ionicons name="chevron-back" size={19} color={C.ink700} />
            </Pressable>
            <T w="bold" size={15}>{monthTitle}</T>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Next month"
              onPress={() => {
                tap();
                setVisibleMonth(new Date(year, month + 1, 1));
              }}
              hitSlop={8}
              style={{ width: 40, height: 40, borderRadius: 13, backgroundColor: C.cream100, alignItems: "center", justifyContent: "center" }}
            >
              <Ionicons name="chevron-forward" size={19} color={C.ink700} />
            </Pressable>
          </View>

          <View style={{ flexDirection: "row", marginBottom: 6 }}>
            {["M", "T", "W", "T", "F", "S", "S"].map((day, index) => (
              <View key={`${day}-${index}`} style={{ width: `${100 / 7}%`, alignItems: "center", paddingVertical: 7 }}>
                <T w="bold" size={11} color={C.ink400}>{day}</T>
              </View>
            ))}
          </View>

          <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
            {cells.map((day, index) => {
              if (day == null) return <View key={`blank-${index}`} style={{ width: `${100 / 7}%`, height: 44 }} />;
              const dayDate = new Date(year, month, day, 12);
              const dayValue = toISODate(dayDate);
              const isSelected = value === dayValue;
              const isToday = today === dayValue;
              return (
                <Pressable
                  key={dayValue}
                  accessibilityRole="button"
                  accessibilityLabel={dayDate.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
                  accessibilityState={{ selected: isSelected }}
                  onPress={() => {
                    tap();
                    onChange(dayValue);
                    setOpen(false);
                  }}
                  style={({ pressed }) => ({
                    width: `${100 / 7}%`,
                    height: 44,
                    alignItems: "center",
                    justifyContent: "center",
                    opacity: pressed ? 0.75 : 1,
                  })}
                >
                  <View
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: 13,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: isSelected ? C.brand : "transparent",
                      borderWidth: isToday && !isSelected ? 1 : 0,
                      borderColor: C.brand,
                    }}
                  >
                    <T w={isSelected ? "extra" : "semi"} size={13} color={isSelected ? C.onBrand : C.ink800}>{day}</T>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>
      </Sheet>
    </>
  );
}
