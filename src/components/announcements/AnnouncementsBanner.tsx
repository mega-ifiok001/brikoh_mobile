// Native port of the web announcements banner. Shows the newest un-dismissed announcement
// for this store's tier. Dismissals ("Got it") are saved on the device with SecureStore, per
// store, so an announcement never comes back after a relaunch or a new sign-in. The view
// endpoint records one idempotent view per display.
import { useEffect, useRef, useState } from "react";
import { Platform, View } from "react-native";
import * as SecureStore from "expo-secure-store";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../context/AuthContext";
import { listAnnouncements, markAnnouncementViewed, isEveryTier, type Announcement } from "../../lib/announcements";
import { ago, titleCase } from "../../lib/format";
import { Button, Pill, Skeleton, T } from "../ui";
import { C, R, shadow } from "../../theme";

const storageKey = (storeId: string) => `brikoh_seen_announcements_${storeId.replace(/[^A-Za-z0-9._-]/g, "_")}`;

// SecureStore doesn't exist on web, so fall back to localStorage there.
const store = {
  get: async (k: string): Promise<string | null> =>
    Platform.OS === "web" ? globalThis.localStorage?.getItem(k) ?? null : SecureStore.getItemAsync(k),
  set: async (k: string, v: string): Promise<void> => {
    if (Platform.OS === "web") globalThis.localStorage?.setItem(k, v);
    else await SecureStore.setItemAsync(k, v);
  },
};

async function loadSeen(key: string): Promise<string[]> {
  try {
    const raw = await store.get(key);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.map(String) : [];
  } catch (e) {
    console.warn("[announcements] couldn't read dismissed list", e);
    return [];
  }
}

async function saveSeen(key: string, ids: Set<string>) {
  try {
    await store.set(key, JSON.stringify([...ids]));
  } catch (e) {
    console.warn("[announcements] couldn't save dismissed list", e);
  }
}

const tierLabel = (tier: string) => (isEveryTier(tier) ? "Everyone" : titleCase(tier));

export default function AnnouncementsBanner() {
  const { me } = useAuth();
  const key = storageKey(String(me?.store?.id ?? "device"));
  const seenIds = useRef<Set<string>>(new Set());
  const [items, setItems] = useState<Announcement[]>([]);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [list, saved] = await Promise.all([listAnnouncements(), loadSeen(key)]);
        if (!alive) return;
        seenIds.current = new Set(saved);
        setItems(list.items.filter((a) => !seenIds.current.has(a.id)));
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
  }, [key]);

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
            seenIds.current.add(current.id);
            saveSeen(key, seenIds.current);
            setIndex((i) => i + 1);
          }}
        />
      </View>
    </View>
  );
}