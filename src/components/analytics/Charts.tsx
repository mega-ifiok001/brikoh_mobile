// Plain-View charts (no chart libs): a scrollable column chart and a ranked horizontal bar list.
import { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { T } from "../ui";
import { C } from "../../theme";
import { fd, fm, plural, rawNum } from "../../lib/format";

export interface Bucket {
  start: string;
  totalSales: any;
  orderCount: number;
}

const CHART_H = 140;

function dayLabel(iso: string) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

/** Column chart of sales per bucket. Tap a column to see its exact value. */
export function BucketChart({ buckets, currency }: { buckets: Bucket[]; currency: string }) {
  const [sel, setSel] = useState<number | null>(null);
  if (buckets.length === 0) {
    return (
      <T w="semi" size={13} color={C.ink400} style={{ marginTop: 16 }}>
        No data in this range.
      </T>
    );
  }
  const max = Math.max(1, ...buckets.map((b) => rawNum(b.totalSales)));
  const active = sel != null && buckets[sel] ? buckets[sel] : null;
  return (
    <View style={{ marginTop: 12 }}>
      <View style={{ minHeight: 40, justifyContent: "center" }}>
        {active ? (
          <View>
            <T w="display" size={18}>
              {fm(active.totalSales, currency)}
            </T>
            <T w="semi" size={11.5} color={C.ink400}>
              {fd(active.start)} · {plural(active.orderCount ?? 0, "order")}
            </T>
          </View>
        ) : (
          <T w="regular" size={12} color={C.ink400}>
            Tap a bar for details
          </T>
        )}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingBottom: 4, alignItems: "flex-end" }}>
        {buckets.map((b, i) => {
          const v = rawNum(b.totalSales);
          const h = Math.max(4, (v / max) * CHART_H);
          const on = sel === i;
          return (
            <Pressable key={b.start + i} onPress={() => setSel(on ? null : i)} style={{ width: 32, alignItems: "center" }}>
              <View style={{ height: CHART_H, justifyContent: "flex-end", alignItems: "center", width: "100%" }}>
                <View style={{ width: 16, height: h, borderTopLeftRadius: 8, borderTopRightRadius: 8, backgroundColor: on ? C.brandDark : C.brand, opacity: on || sel == null ? 1 : 0.45 }} />
              </View>
              <View style={{ height: 1, alignSelf: "stretch", backgroundColor: C.cream200 }} />
              <T w="bold" size={9} color={C.ink300} style={{ marginTop: 4 }} numberOfLines={1}>
                {dayLabel(b.start)}
              </T>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

export interface BarRow {
  key: string;
  label: string;
  sub?: string;
  value: number;
  display: string;
}

/** Ranked horizontal bars: label + value on top, proportional bar underneath. */
export function BarList({ rows, minPct = 4, color = C.ink700 }: { rows: BarRow[]; minPct?: number; color?: string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <View style={{ gap: 14 }}>
      {rows.map((r) => (
        <View key={r.key} style={{ gap: 6 }}>
          <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 10 }}>
            <View style={{ flex: 1, flexDirection: "row", alignItems: "baseline", gap: 6 }}>
              <T w="extra" size={13} color={C.ink700} numberOfLines={1} style={{ flexShrink: 1 }}>
                {r.label}
              </T>
              {r.sub ? (
                <T w="regular" size={11} color={C.ink300}>
                  {r.sub}
                </T>
              ) : null}
            </View>
            <T w="extra" size={13}>
              {r.display}
            </T>
          </View>
          <View style={{ height: 10, borderRadius: 5, backgroundColor: C.cream100, overflow: "hidden" }}>
            <View style={{ height: "100%", width: `${Math.min(100, Math.max(minPct, (r.value / max) * 100))}%`, borderRadius: 5, backgroundColor: color }} />
          </View>
        </View>
      ))}
    </View>
  );
}
