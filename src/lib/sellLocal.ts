// Sell-screen data kept on the device: recently sold products and held (parked) sales.
import { getJSON, setJSON, storeKey } from "./localStore";

export interface CartLine {
  key: string;
  productId: string;
  variantId?: string;
  name: string;
  variantName?: string;
  price: number;
  qty: number;
  max: number;
}

export interface HeldCart {
  id: string;
  savedAt: string;
  lines: CartLine[];
}

const RECENT_MAX = 8;
const HELD_MAX = 10;

const recentKey = (storeId: string) => storeKey("brikoh_recent_products", storeId);
const heldKey = (storeId: string) => storeKey("brikoh_held_carts", storeId);

export const loadRecentIds = (storeId: string) => getJSON<string[]>(recentKey(storeId), []);

export async function addRecentIds(storeId: string, ids: string[]): Promise<string[]> {
  const old = await loadRecentIds(storeId);
  const next = [...new Set([...ids, ...old])].slice(0, RECENT_MAX);
  await setJSON(recentKey(storeId), next);
  return next;
}

export const loadHeld = (storeId: string) => getJSON<HeldCart[]>(heldKey(storeId), []);
export const saveHeld = (storeId: string, carts: HeldCart[]) => setJSON(heldKey(storeId), carts.slice(0, HELD_MAX));