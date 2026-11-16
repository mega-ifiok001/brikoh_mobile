import { titleCase } from "../../lib/format";
import type { Ticket, TicketMessage, TicketPriority, TicketStatus } from "../../lib/tickets";
import type { Tone } from "../ui";

export const STATUSES: Array<"ALL" | TicketStatus> = ["ALL", "OPEN", "PENDING", "IN_PROGRESS", "RESOLVED", "CLOSED"];
export const PRIORITIES: Array<"ALL" | TicketPriority> = ["ALL", "LOW", "MEDIUM", "HIGH", "URGENT"];

export const PRIORITY_TONE: Record<string, Tone> = {
  LOW: "neutral",
  MEDIUM: "brand",
  HIGH: "gold",
  URGENT: "danger",
};

export function isClosed(t: Ticket): boolean {
  return String(t.status ?? "").toUpperCase() === "CLOSED";
}

export function authorName(m: TicketMessage): string {
  const name = m.author?.name?.trim();
  if (name) return name;
  if (m.author?.type) return titleCase(String(m.author.type));
  return "Support";
}

export function isMerchant(m: TicketMessage): boolean {
  return String(m.author?.type ?? "").toUpperCase() === "MERCHANT";
}
