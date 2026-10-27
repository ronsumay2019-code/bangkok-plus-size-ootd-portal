/* One branded renderer for invoice images, PDF pages and private accounting lists. */
import { invoiceAmounts, invoiceDate, php, money, paymentDeadline, previousBalances, windowHours } from "./finance";
import { ONE_SIZE, type Customer, type Invoice, type Live, type Payment } from "./types";
import { invoiceLane, liveLabel } from "./order-lanes";

export type PaymentQRSlot = { id: string; active: { account: string; number: string; image: string } | null };
export type PrintBlock = { text?: string; columns?: string[]; bold?: boolean; pink?: boolean; image?: string; paymentQRs?: PaymentQRSlot[] };
const W = 1200, H = 1697, M = 76, BODY_END = 1560;
/** Breaks text into lines between words; only a single word wider than the line is split by character. */
export function wrapWords(text: string, width: number, measure: (s: string) => number): string[] {
  const out: string[] = [];
  for (const paragraph of text.split("\n")) {
    let line = "";
    for (const word of paragraph.match(/\s*\S+\s*/g) ?? []) {
      if (line && measure(line + word.trimEnd()) > width) { out.push(line.trimEnd()); line = word.trimStart(); } else line += word;
      while (line.length > 1 && measure(line.trimEnd()) > width) {
        let cut = line.length - 1;
        while (cut > 1 && measure(line.slice(0, cut)) > width) cut--;
        out.push(line.slice(0, cut)); line = line.slice(cut);
      }
    }
    out.push(line.trimEnd());
  }
  return out;
}
const wrap = (ctx: CanvasRenderingContext2D, text: string, width: number) => wrapWords(text, width, s => ctx.measureText(s).width);
async function readImage(url: string): Promise<HTMLImageElement> { return new Promise((resolve, reject) => { const img = new Image(); img.onload = () => resolve(img); img.onerror = () => reject(new Error("Receipt image could not be rendered.")); img.src = url; }); }
export async function renderBranded(title: string, subtitle: string, blocks: PrintBlock[]): Promise<HTMLCanvasElement[]> {
  await document.fonts.ready;
  const pages: HTMLCanvasElement[] = []; let canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, y: number;
  const page = () => {
    canvas = document.createElement("canvas"); canvas.width = W; canvas.height = H; ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, W, H); ctx.strokeStyle = "#cf1d72"; ctx.lineWidth = 3; ctx.strokeRect(34, 34, W - 68, H - 68);
    ctx.fillStyle = "#cf1d72"; ctx.font = "bold 38px Arial"; ctx.fillText("Bangkok Plus Size OOTD", M, 110);
    ctx.font = "19px Arial"; ctx.fillStyle = "#625662"; ctx.fillText("Since 2021  |  Bangkok to Philippines", M, 146);
    ctx.fillStyle = "#cf1d72"; ctx.fillRect(M, 170, W - M * 2, 3);
    ctx.fillStyle = "#25212c"; ctx.font = "bold 29px Arial"; ctx.fillText(title, M, 216);
    ctx.font = "19px Arial"; ctx.fillStyle = "#625662";
    const sub = wrap(ctx, subtitle, W - 2 * M); sub.forEach((s, i) => ctx.fillText(s, M, 249 + 24 * i)); y = 277 + sub.length * 24;
    pages.push(canvas);
  };
  page();
  for (const block of blocks) {
    if (block.paymentQRs) {
      const slots = block.paymentQRs;
      const width = (W - 2 * M - 24 * 2) / 3;
      const images = await Promise.all(slots.map(s => s.active ? readImage(s.active.image) : null));
      ctx!.font = "18px Arial";
      const labels = slots.map(s => wrap(ctx!, s.active ? `${s.active.account}\n${s.active.number}` : "QR not configured", width - 24));
      const height = 322 + Math.max(...labels.map(l => l.length), 1) * 23;
      if (y! + height + 20 > BODY_END) page();
      slots.forEach((s, i) => {
        const x = M + i * (width + 24), img = images[i];
        ctx!.strokeStyle = "#efc4d7"; ctx!.lineWidth = 1; ctx!.strokeRect(x, y!, width, height);
        ctx!.fillStyle = "#a71053"; ctx!.font = "bold 21px Arial";
        ctx!.fillText(s.id === "gcash" ? "GCash" : s.id === "maya" ? "Maya" : "Bank / InstaPay", x + 12, y! + 30);
        if (img) {
          const ratio = Math.min((width - 32) / img.width, 260 / img.height);
          ctx!.imageSmoothingEnabled = false;
          ctx!.drawImage(img, x + (width - img.width * ratio) / 2, y! + 45 + (260 - img.height * ratio) / 2, img.width * ratio, img.height * ratio);
          ctx!.imageSmoothingEnabled = true;
        }
        ctx!.fillStyle = "#25212c"; ctx!.font = "18px Arial";
        labels[i].forEach((line, j) => ctx!.fillText(line, x + 12, y! + 322 + 23 * j));
      });
      y! += height + 20; continue;
    }
    if (block.image) {
      const img = await readImage(block.image); const ratio = Math.min((W - M * 2) / img.width, 440 / img.height); const height = img.height * ratio;
      if (y! + height + 24 > BODY_END) page();
      ctx!.drawImage(img, M, y!, img.width * ratio, height); y! += height + 24; continue;
    }
    const cols = block.columns ?? [block.text ?? ""]; const widths = cols.length === 4 ? [580, 95, 165, 208] : cols.length === 2 ? [730, 318] : [W - 2 * M];
    ctx!.font = `${block.bold ? "bold " : ""}20px Arial`;
    const lines = cols.map((c, i) => wrap(ctx!, c, widths[i] - 24)); const height = Math.max(...lines.map(l => l.length)) * 26 + 18;
    if (height > BODY_END - 350) throw new Error("A description is too long for an invoice page. Shorten it before exporting.");
    if (y! + height > BODY_END) page();
    ctx!.font = `${block.bold ? "bold " : ""}20px Arial`; ctx!.fillStyle = block.pink ? "#fff0f6" : "#ffffff";
    ctx!.fillRect(M - 10, y! - 3, W - 2 * M + 20, height); ctx!.fillStyle = block.pink ? "#a71053" : "#25212c";
    let x = M; lines.forEach((ls, i) => { ls.forEach((l, j) => ctx!.fillText(l, x, y! + 22 + j * 26)); x += widths[i]; });
    ctx!.strokeStyle = "#efd9e3"; ctx!.lineWidth = 1; ctx!.beginPath(); ctx!.moveTo(M, y! + height); ctx!.lineTo(W - M, y! + height); ctx!.stroke(); y! += height;
  }
  pages.forEach((p, index) => { const c = p.getContext("2d")!; c.fillStyle = "#625662"; c.font = "17px Arial"; c.fillText("Bangkok Plus Size OOTD  |  Please keep this document for your records.", M, 1610); c.fillText(`Page ${index + 1} of ${pages.length}`, W - 225, 1610); });
  return pages;
}
/** lives: names a live invoice, and each earlier one, by its live's title and date (owner, 2026-10-15). */
export function invoiceBlocks(inv: Invoice, customer: Customer, invoices: Invoice[], payments: Payment[], paymentQRs: PaymentQRSlot[] = [], now = Date.now(), lives: Live[] = []): PrintBlock[] {
  const a = invoiceAmounts(inv, payments); const previous = previousBalances(inv, invoices, payments);
  const rows: PrintBlock[] = [{ text: "BILL TO: " + customer.name, bold: true, pink: true }, ...(liveLabel(inv.liveId, lives) ? [{ columns: ["Live", liveLabel(inv.liveId, lives)] }] : []), { columns: ["Invoice date", invoiceDate(inv.issuedAt)] }, { columns: ["Payment due", invoiceDate(new Date(paymentDeadline(inv, now)).toISOString())] }, { columns: ["Payment window", `${windowHours(inv)} hours`] }];
  if (previous.length) { rows.push({ text: "PREVIOUS UNPAID BALANCES (separate invoices)", bold: true, pink: true }); for (const { invoice: i, remaining } of previous) rows.push({ columns: [`${i.number} | ${invoiceLane(i.liveId, lives, true)}`, php(remaining)] }); }
  rows.push({ columns: ["ITEM / SIZE", "QTY", "UNIT PRICE", "AMOUNT"], bold: true, pink: true });
  // One-size items (accessories, skincare, grocery) print no size line; clothing without a size still says so.
  for (const l of inv.lines) rows.push({ columns: [[l.name.startsWith(l.code) ? l.name : `${l.code} - ${l.name}`, l.size === ONE_SIZE ? "" : l.size || "Size not specified"].filter(Boolean).join("\n"), String(l.qty), php(l.price), php(money(l.price * l.qty))] });
  rows.push({ columns: ["Subtotal", php(inv.subtotal)] }, { columns: ["Shipping", inv.shipping ? php(inv.shipping) : inv.batchId ? php(0) : "Pending assignment"] }, { columns: ["INVOICE TOTAL", php(a.total)], bold: true, pink: true });
  if (inv.depositCredit) rows.push({ columns: ["Deposit credit applied", php(inv.depositCredit)] });
  if (a.cash) rows.push({ columns: ["Payments received", php(a.cash)] });
  rows.push({ columns: ["THIS INVOICE BALANCE", php(a.remaining)], bold: true, pink: true });
  if (a.overpaid) rows.push({ columns: ["Overpayment - review refund / credit", php(a.overpaid)] });
  if (previous.length) rows.push({ columns: ["TOTAL OUTSTANDING (including previous invoices)", php(money(a.remaining + previous.reduce((n, x) => n + x.remaining, 0)))], bold: true });
  rows.push({ text: "MODE OF PAYMENT — SHOP-APPROVED QR CODES", bold: true, pink: true },
    { paymentQRs: ["gcash", "maya", "bank"].map(id => ({ id, active: paymentQRs.find(s => s.id === id)?.active ?? null })) },
    { text: "Please check the recipient and amount in your payment app before paying. Send your payment screenshot/photo in Messenger. Payment is recorded after the proof is checked." }, { text: "Payment QRs are sent only by the shop in Messenger. Never pay a QR posted in comments." });
  return rows;
}
export async function invoiceArtwork(inv: Invoice, c: Customer, invoices: Invoice[], payments: Payment[], paymentQRs: PaymentQRSlot[] = [], lives: Live[] = []) { return renderBranded(inv.liveId ? "LIVE ORDER INVOICE" : "PRE-ORDER INVOICE", `${inv.number}  |  ${inv.status === "cancelled" ? "CANCELLED" : invoiceAmounts(inv, payments).remaining === 0 ? "PAID" : "AWAITING PAYMENT"}`, invoiceBlocks(inv, c, invoices, payments, paymentQRs, Date.now(), lives)); }
export function joinedImage(pages: HTMLCanvasElement[]): string {
  const scale = Math.min(1, 15000 / (H * pages.length)); const c = document.createElement("canvas"); c.width = Math.round(W * scale); c.height = Math.round(H * pages.length * scale);
  const ctx = c.getContext("2d")!; ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height); pages.forEach((p, i) => ctx.drawImage(p, 0, i * H * scale, W * scale, H * scale));
  let image = c.toDataURL("image/jpeg", .9); if (image.length > 1_390_000) image = c.toDataURL("image/jpeg", .65);
  if (image.length > 1_390_000) throw new Error("This invoice has too many details for one Messenger image. Download its separate page images and send them manually."); return image;
}
export function download(url: string, name: string) { const a = document.createElement("a"); a.href = url; a.download = name; a.click(); }
/** Small standards-based PDF containing the exact rendered A4 pages as JPEG XObjects. */
export function pagesPDF(pages: HTMLCanvasElement[]): Blob {
  const enc = new TextEncoder(); const chunks: Uint8Array[] = []; const offsets = [0]; let size = 0;
  const put = (s: string | Uint8Array) => { const b = typeof s === "string" ? enc.encode(s) : s; chunks.push(b); size += b.length; };
  const obj = (id: number, body: string) => { offsets[id] = size; put(`${id} 0 obj\n${body}\nendobj\n`); };
  put("%PDF-1.4\n"); obj(1, "<< /Type /Catalog /Pages 2 0 R >>"); obj(2, `<< /Type /Pages /Count ${pages.length} /Kids [${pages.map((_, i) => `${3 + i * 3} 0 R`).join(" ")}] >>`);
  pages.forEach((p, index) => {
    const id = 3 + index * 3, raw = atob(p.toDataURL("image/jpeg", .94).split(",")[1]), bytes = Uint8Array.from(raw, c => c.charCodeAt(0));
    obj(id, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Resources << /XObject << /Im ${id + 2} 0 R >> >> /Contents ${id + 1} 0 R >>`);
    const stream = "q\n595.28 0 0 841.89 0 0 cm\n/Im Do\nQ\n";
    obj(id + 1, `<< /Length ${enc.encode(stream).length} >>\nstream\n${stream}endstream`);
    offsets[id + 2] = size; put(`${id + 2} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${p.width} /Height ${p.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${bytes.length} >>\nstream\n`); put(bytes); put("\nendstream\nendobj\n");
  });
  const xref = size, count = 3 + pages.length * 3; put(`xref\n0 ${count}\n0000000000 65535 f \n`); for (let i = 1; i < count; i++) put(`${String(offsets[i]).padStart(10, "0")} 00000 n \n`);
  put(`trailer\n<< /Size ${count} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`); return new Blob(chunks as BlobPart[], { type: "application/pdf" });
}
export function downloadPDF(pages: HTMLCanvasElement[], name: string) { const url = URL.createObjectURL(pagesPDF(pages)); download(url, name); setTimeout(() => URL.revokeObjectURL(url), 30000); }
