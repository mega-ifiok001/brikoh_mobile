// Receipts: plain-text share (WhatsApp, SMS…) and PDF share. Built on the device, no backend.
import { Platform, Share } from "react-native";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { fdt, fm, titleCase } from "./format";

export interface ReceiptData {
  storeName: string;
  number: string;
  date?: string | null;
  currency: string;
  lines: { name: string; qty: number; unit: number; total: number }[];
  total: number;
  method?: string | null;
  outstanding?: number;
}

export function receiptText(d: ReceiptData): string {
  const out: string[] = [d.storeName, `Receipt ${d.number}`];
  if (d.date) out.push(fdt(d.date));
  out.push("");
  d.lines.forEach((l) => out.push(`${l.qty} × ${l.name} — ${fm(l.total, d.currency)}`));
  out.push("", `Total: ${fm(d.total, d.currency)}`);
  if (d.method) out.push(`Paid by: ${titleCase(d.method)}`);
  if (d.outstanding && d.outstanding > 0) out.push(`Balance owing: ${fm(d.outstanding, d.currency)}`);
  out.push("", "Thank you for shopping with us!");
  return out.join("\n");
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);

function receiptHtml(d: ReceiptData): string {
  const rows = d.lines
    .map((l) => `<tr><td>${l.qty} × ${esc(l.name)}</td><td class="r">${esc(fm(l.total, d.currency))}</td></tr>`)
    .join("");
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  body{font-family:-apple-system,Roboto,Helvetica,Arial,sans-serif;color:#0A100D;margin:0;padding:32px;}
  .card{max-width:380px;margin:0 auto;}
  h1{font-size:22px;margin:0 0 4px;} .muted{color:#6b5f55;font-size:13px;margin:2px 0;}
  table{width:100%;border-collapse:collapse;margin-top:18px;font-size:15px;}
  td{padding:8px 0;border-bottom:1px solid #ece3d5;} .r{text-align:right;white-space:nowrap;}
  .total td{font-weight:800;font-size:18px;border-bottom:none;padding-top:14px;}
  .foot{margin-top:24px;text-align:center;color:#6b5f55;font-size:13px;}
</style></head><body><div class="card">
  <h1>${esc(d.storeName)}</h1>
  <div class="muted">Receipt ${esc(d.number)}</div>
  ${d.date ? `<div class="muted">${esc(fdt(d.date))}</div>` : ""}
  <table>${rows}
    <tr class="total"><td>Total</td><td class="r">${esc(fm(d.total, d.currency))}</td></tr>
  </table>
  ${d.method ? `<div class="muted" style="margin-top:8px">Paid by ${esc(titleCase(d.method))}</div>` : ""}
  ${d.outstanding && d.outstanding > 0 ? `<div class="muted">Balance owing: ${esc(fm(d.outstanding, d.currency))}</div>` : ""}
  <div class="foot">Thank you for shopping with us!</div>
</div></body></html>`;
}

export async function shareReceiptText(d: ReceiptData): Promise<void> {
  await Share.share({ message: receiptText(d) });
}

export async function shareReceiptPdf(d: ReceiptData): Promise<void> {
  const html = receiptHtml(d);
  if (Platform.OS === "web") {
    await Print.printAsync({ html });
    return;
  }
  const { uri } = await Print.printToFileAsync({ html });
  if (!(await Sharing.isAvailableAsync())) throw new Error("Sharing isn't available on this device.");
  await Sharing.shareAsync(uri, { mimeType: "application/pdf", dialogTitle: "Share receipt", UTI: "com.adobe.pdf" });
}