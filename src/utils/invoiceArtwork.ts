/** Port of the shop-approved reference invoice renderer; no reference imports or shop state. */
export interface InvoiceLineInput {
  code: string;
  description?: string;
  size?: string;
  colour?: string;
  unitPrice: number;
  qty: number;
}
export interface InvoiceLine extends InvoiceLineInput { amount: number }
export interface InvoiceArtworkInput {
  buyerName: string;
  kind: 'live' | 'preorder';
  number: string;
  status: string;
  liveTitle?: string;
  liveDate?: string;
  invoiceDate: string;
  dueDate: string;
  lines: readonly InvoiceLineInput[];
  shipping: number;
  paymentQRs?: readonly PaymentQRSlot[];
}
const cents = (value: number): number => {
  const n = Math.round(value * 100);
  if (!Number.isFinite(value) || value < 0 || !Number.isSafeInteger(n) || Math.abs(value * 100 - n) > 0.000001)
    throw new Error('Money must be nonnegative with at most two decimal places.');
  return n;
};
const safeMoney = (value: number): number => {
  if (!Number.isSafeInteger(value)) throw new Error('Invoice amount is too large.');
  return value / 100;
};
export const php = (value: number): string => new Intl.NumberFormat('en-PH', {
  style: 'currency', currency: 'PHP', minimumFractionDigits: 2, maximumFractionDigits: 2,
}).format(value);
export const invoiceTitle = (kind: InvoiceArtworkInput['kind']): string =>
  kind === 'live' ? 'LIVE ORDER INVOICE' : 'PRE-ORDER INVOICE';

/** The caller supplies host-derived fields; buyer comment text is never an input. */
export function groupInvoiceLines(lines: readonly InvoiceLineInput[]): InvoiceLine[] {
  const grouped = new Map<string, InvoiceLine>();
  for (const line of lines) {
    if (!line.code.trim() || !Number.isSafeInteger(line.qty) || line.qty < 1)
      throw new Error('An invoice line needs an item code and positive whole quantity.');
    const price = cents(line.unitPrice);
    const key = JSON.stringify([line.code, line.size ?? '', line.colour ?? '', price]);
    const previous = grouped.get(key);
    const qty = (previous?.qty ?? 0) + line.qty;
    if (!Number.isSafeInteger(qty)) throw new Error('Quantity is too large.');
    grouped.set(key, { ...(previous ?? line), qty, amount: safeMoney(price * qty) });
  }
  return [...grouped.values()];
}
export function invoiceTotals(lines: readonly InvoiceLineInput[], shipping: number) {
  const items = groupInvoiceLines(lines);
  const subtotalCents = items.reduce((sum, line) => sum + cents(line.amount), 0);
  const total = safeMoney(subtotalCents + cents(shipping));
  return { lines: items, subtotal: safeMoney(subtotalCents), shipping, total, balance: total };
}
const dateLabel = (value: string): string => new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Manila', day: '2-digit', month: 'short', year: 'numeric',
  hour: '2-digit', minute: '2-digit', hour12: true,
}).format(new Date(value)) + ' PHT';

/** Pure pagination shared with canvas drawing. Rows remain whole, as in the reference. */
export function rowNeedsPage(y: number, height: number, startAt: number, bodyEnd = BODY_END): boolean {
  if (!Number.isFinite(height) || height < 0 || height > bodyEnd - startAt)
    throw new Error('A row is too tall for an invoice page.');
  return y + height > bodyEnd;
}
export function pageLabel(index: number, count: number): string { return `Page ${index + 1} of ${count}`; }
export function splitPages(heights: readonly number[], startAt = 301, bodyEnd = BODY_END) {
  const pages: number[][] = [[]];
  let y = startAt;
  heights.forEach((height, index) => {
    if (rowNeedsPage(y, height, startAt, bodyEnd)) { pages.push([]); y = startAt; }
    pages.at(-1)!.push(index); y += height;
  });
  return pages.map((rows, index) => ({ rows, label: pageLabel(index, pages.length) }));
}

export type PaymentQRSlot = { id: string; active: { account: string; number: string; image: string } | null };
export type PrintBlock = { text?: string; columns?: string[]; bold?: boolean; pink?: boolean; image?: string; paymentQRs?: PaymentQRSlot[] };
export const W = 1200, H = 1697, M = 76, BODY_END = 1560;
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
  let pageStart = 0;
  const page = () => {
    canvas = document.createElement("canvas"); canvas.width = W; canvas.height = H; ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, W, H); ctx.strokeStyle = "#cf1d72"; ctx.lineWidth = 3; ctx.strokeRect(34, 34, W - 68, H - 68);
    ctx.fillStyle = "#cf1d72"; ctx.font = "bold 38px Arial"; ctx.fillText("Bangkok Plus Size OOTD", M, 110);
    ctx.font = "19px Arial"; ctx.fillStyle = "#625662"; ctx.fillText("Since 2021  |  Bangkok to Philippines", M, 146);
    ctx.fillStyle = "#cf1d72"; ctx.fillRect(M, 170, W - M * 2, 3);
    ctx.fillStyle = "#25212c"; ctx.font = "bold 29px Arial"; ctx.fillText(title, M, 216);
    ctx.font = "19px Arial"; ctx.fillStyle = "#625662";
    const sub = wrap(ctx, subtitle, W - 2 * M); sub.forEach((s, i) => ctx.fillText(s, M, 249 + 24 * i)); y = 277 + sub.length * 24; pageStart = y;
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
      if (rowNeedsPage(y!, height + 20, pageStart)) page();
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
      if (rowNeedsPage(y!, height + 24, pageStart)) page();
      ctx!.drawImage(img, M, y!, img.width * ratio, height); y! += height + 24; continue;
    }
    const cols = block.columns ?? [block.text ?? ""]; const widths = cols.length === 4 ? [580, 95, 165, 208] : cols.length === 2 ? [730, 318] : [W - 2 * M];
    ctx!.font = `${block.bold ? "bold " : ""}20px Arial`;
    const lines = cols.map((c, i) => wrap(ctx!, c, widths[i] - 24)); const height = Math.max(...lines.map(l => l.length)) * 26 + 18;
    if (height > BODY_END - 350) throw new Error("A description is too long for an invoice page. Shorten it before exporting.");
    if (rowNeedsPage(y!, height, pageStart)) page();
    ctx!.font = `${block.bold ? "bold " : ""}20px Arial`; ctx!.fillStyle = block.pink ? "#fff0f6" : "#ffffff";
    ctx!.fillRect(M - 10, y! - 3, W - 2 * M + 20, height); ctx!.fillStyle = block.pink ? "#a71053" : "#25212c";
    let x = M; lines.forEach((ls, i) => { ls.forEach((l, j) => ctx!.fillText(l, x, y! + 22 + j * 26)); x += widths[i]; });
    ctx!.strokeStyle = "#efd9e3"; ctx!.lineWidth = 1; ctx!.beginPath(); ctx!.moveTo(M, y! + height); ctx!.lineTo(W - M, y! + height); ctx!.stroke(); y! += height;
  }
  pages.forEach((p, index) => { const c = p.getContext("2d")!; c.fillStyle = "#625662"; c.font = "17px Arial"; c.fillText("Bangkok Plus Size OOTD  |  Please keep this document for your records.", M, 1610); c.fillText(pageLabel(index, pages.length), W - 225, 1610); });
  return pages;
}

export function invoiceBlocks(input: InvoiceArtworkInput): PrintBlock[] {
  const a = invoiceTotals(input.lines, input.shipping);
  const rows: PrintBlock[] = [
    { text: 'BILL TO: ' + input.buyerName, bold: true, pink: true },
    ...([input.liveTitle, input.liveDate].some(Boolean) ? [{ columns: ['Live', [input.liveTitle, input.liveDate].filter(Boolean).join(' · ')] }] : []),
    { columns: ['Invoice date', dateLabel(input.invoiceDate)] },
    { columns: ['Payment due', dateLabel(input.dueDate)] },
    { columns: ['Payment window', '24 hours'] },
    { columns: ['ITEM / SIZE', 'QTY', 'UNIT PRICE', 'AMOUNT'], bold: true, pink: true },
  ];
  for (const line of a.lines) {
    const item = [line.code, line.description].filter(Boolean).join(' ')
      + (line.colour ? ' · ' + line.colour : '');
    rows.push({ columns: [[item, line.size || 'Size not specified'].join('\n'),
      String(line.qty), php(line.unitPrice), php(line.amount)] });
  }
  rows.push(
    { columns: ['Subtotal', php(a.subtotal)] },
    { columns: ['Shipping', php(a.shipping)] },
    { columns: ['INVOICE TOTAL', php(a.total)], bold: true, pink: true },
    { columns: ['THIS INVOICE BALANCE', php(a.balance)], bold: true, pink: true },
    { text: 'MODE OF PAYMENT — SHOP-APPROVED QR CODES', bold: true, pink: true },
    { paymentQRs: ['gcash', 'maya', 'bank'].map(id => ({ id, active: input.paymentQRs?.find(s => s.id === id)?.active ?? null })) },
    { text: 'Please check the recipient and amount in your payment app before paying. Send your payment screenshot/photo in Messenger. Payment is recorded after the proof is checked.' },
    { text: 'Payment QRs are sent only by the shop in Messenger. Never pay a QR posted in comments.' },
  );
  return rows;
}
export function invoiceArtwork(input: InvoiceArtworkInput): Promise<HTMLCanvasElement[]> {
  return renderBranded(invoiceTitle(input.kind), `${input.number}  |  ${input.status}`, invoiceBlocks(input));
}
export function joinedImage(pages: HTMLCanvasElement[]): string {
  if (!pages.length) throw new Error("No invoice pages to preview.");
  const scale = Math.min(1, 15000 / (H * pages.length)); const c = document.createElement("canvas"); c.width = Math.round(W * scale); c.height = Math.round(H * pages.length * scale);
  const ctx = c.getContext("2d")!; ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height); pages.forEach((p, i) => ctx.drawImage(p, 0, i * H * scale, W * scale, H * scale));
  let image = c.toDataURL("image/jpeg", .9); if (image.length > 1_390_000) image = c.toDataURL("image/jpeg", .65);
  if (image.length > 1_390_000) throw new Error("This invoice has too many details for one Messenger image. Download its separate page images and send them manually."); return image;
}
