// Native port of the web announcements banner. Shows the newest un-dismissed announcement
// for this store's tier. Dismissals are kept in module-level memory for the app session
// (the web used localStorage); the view endpoint records one idempotent view per display.
import { useEffect, useState } from "react";
import { View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { listAnnouncements, markAnnouncementViewed, isEveryTier, type Announcement } from "../../lib/announcements";
import { ago, titleCase } from "../../lib/format";
import { Button, Pill, Skeleton, T } from "../ui";
import { C, R, shadow } from "../../theme";

const seenIds = new Set<string>();

const tierLabel = (tier: string) => (isEveryTier(tier) ? "Everyone" : titleCase(tier));

export default function AnnouncementsBanner() {
  const [items, setItems] = useState<Announcement[]>([]);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const list = await listAnnouncements();
        if (!alive) return;
        setItems(list.items.filter((a) => !seenIds.has(a.id)));
        setIndex(0);
      } catch {
        if (alive) setItems([]); // non-critical: never break the dashboard
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const current = items[index];

  useEffect(() => {
    if (current) markAnnouncementViewed(current.id).catch(() => {});
  }, [current]);

  if (loading) return <Skeleton h={96} r={R.lg} style={{ marginBottom: 14 }} />;
  if (!current) return null;

  return (
    <View style={{ marginBottom: 14, backgroundColor: C.white, borderWidth: 1, borderColor: C.brand100, borderRadius: R.lg, overflow: "hidden", ...shadow.card }}>
      <View style={{ flexDirection: "row", gap: 12, padding: 14 }}>
        <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: C.brand, alignItems: "center", justifyContent: "center" }}>
          <Ionicons name="sparkles" size={18} color="#fff" />
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
            <T w="extra" size={14}>
              {current.title || "Announcement"}
            </T>
            <Pill tone="brand">{tierLabel(current.targetTier)}</Pill>
          </View>
          {current.body ? (
            <T w="semi" size={13} color={C.ink500} style={{ lineHeight: 19 }}>
              {current.body}
            </T>
          ) : null}
          <T w="semi" size={11} color={C.ink300}>
            {current.publishedAt ? `Published ${ago(current.publishedAt)}` : "From the Brikoh team"}
          </T>
        </View>
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", borderTopWidth: 1, borderTopColor: C.cream100, paddingHorizontal: 14, paddingVertical: 6 }}>
        {items.length > 1 ? (
          <T w="bold" size={11} color={C.ink300} style={{ flex: 1 }}>
            {index + 1} of {items.length}
          </T>
        ) : (
          <View style={{ flex: 1 }} />
        )}
        <Button
          label="Got it"
          icon="checkmark"
          variant="ghost"
          small
          onPress={() => {
            seenIds.add(current.id);
            setIndex((i) => i + 1);
          }}
        />
      </View>
    </View>
  );
}
