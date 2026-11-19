// Tiny JSON storage helper for non-secret, larger-than-keychain data
// (recent products, held sales, checklist state). Works on iOS, Android and web.
import AsyncStorage from "@react-native-async-storage/async-storage";

export async function getJSON<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export async function setJSON(key: string, value: unknown): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.warn("[localStore] couldn't save", key, e);
  }
}

/** Builds a safe per-store key, e.g. storeKey("brikoh_held_carts", store.id). */
export const storeKey = (prefix: string, id: string) => `${prefix}_${String(id).replace(/[^A-Za-z0-9._-]/g, "_")}`;