// Guided tour: the steps, plus remembering what the user chose so it never nags.
// Status is saved on the device (SecureStore, localStorage on web), per store.
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import type { IconName } from "../components/ui";

export type TourStatus = "completed" | "skipped" | "dismissed";
export type TourTab = "home" | "orders" | "sell" | "products" | "more";

// Same order as the tab bar, so we can work out where each tab sits.
export const TAB_ORDER: TourTab[] = ["home", "orders", "sell", "products", "more"];

export interface TourStep {
  id: string;
  title: string;
  body: string;
  icon: IconName;
  tab?: TourTab; // which tab this step points at (none = centred welcome card)
}

export const TOUR_STEPS: TourStep[] = [
  {
    id: "welcome",
    icon: "sparkles",
    title: "Welcome to Brikoh",
    body: "Take a 30-second tour of the main screens. You can skip it now and replay it any time from More → App tour.",
  },
  {
    id: "home",
    tab: "home",
    icon: "grid",
    title: "Home: your day at a glance",
    body: "See sales, wallet balance, low-stock alerts and updates from the Brikoh team. Tap the eye to hide amounts when others are around.",
  },
  {
    id: "orders",
    tab: "orders",
    icon: "receipt",
    title: "Orders",
    body: "Every order from your storefront and in-person sales lives here. Open one to update its status, confirm payment or ship it.",
  },
  {
    id: "sell",
    tab: "sell",
    icon: "cart",
    title: "Sell: ring up a sale fast",
    body: "Pick products, add them to the cart and take payment in a few taps. This is the button you'll use most.",
  },
  {
    id: "products",
    tab: "products",
    icon: "cube",
    title: "Products",
    body: "Add products, set prices and keep stock up to date. Low-stock items show up on Home so you can restock in time.",
  },
  {
    id: "more",
    tab: "more",
    icon: "ellipsis-horizontal",
    title: "More: everything else",
    body: "Customers, invoices, expenses, reports, staff and settings are all here. Replay this tour any time from the App tour row.",
  },
];

const keyFor = (ownerId: string) => `brikoh_tour_v1_${ownerId.replace(/[^A-Za-z0-9._-]/g, "_")}`;

export async function getTourStatus(ownerId: string): Promise<TourStatus | null> {
  try {
    const k = keyFor(ownerId);
    const raw = Platform.OS === "web" ? (globalThis as any).localStorage?.getItem(k) ?? null : await SecureStore.getItemAsync(k);
    return raw === "completed" || raw === "skipped" || raw === "dismissed" ? raw : null;
  } catch {
    return null;
  }
}

export async function saveTourStatus(ownerId: string, status: TourStatus): Promise<void> {
  try {
    const k = keyFor(ownerId);
    if (Platform.OS === "web") (globalThis as any).localStorage?.setItem(k, status);
    else await SecureStore.setItemAsync(k, status);
  } catch (e) {
    console.warn("[tour] couldn't save tour status", e);
  }
}