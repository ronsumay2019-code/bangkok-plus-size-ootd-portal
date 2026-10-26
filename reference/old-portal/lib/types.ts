/* Shared data model. The same shapes are used by the public catalogue, the staff portal,
   the Supabase tables (snake_case columns, see supabase/migrations) and the API routes. */

export const SIZES = ["XL", "2XL", "3XL", "4XL", "5XL"] as const;
export type Size = (typeof SIZES)[number];

export const CATEGORIES = ["Tops", "Dresses", "Bottoms", "Sets", "Accessories", "Footwear", "Skincare", "Grocery"] as const;
export type Category = (typeof CATEGORIES)[number];

/** Clothing uses XL to 5XL; footwear uses EU shoe sizes; everything else is one size. */
export const CLOTHING: readonly Category[] = ["Tops", "Dresses", "Bottoms", "Sets"];
export const MORE_CATEGORIES: readonly Category[] = ["Accessories", "Footwear", "Skincare", "Grocery"];
export const SHOE_SIZES = ["36", "37", "38", "39", "40", "41", "42", "43"] as const;
export const ONE_SIZE = "One size";
export type SizeKind = "clothing" | "shoes" | "one";

export function sizeKind(category: string): SizeKind {
  if ((CLOTHING as readonly string[]).includes(category)) return "clothing";
  return category === "Footwear" ? "shoes" : "one";
}

/** The sizes a new item in this category starts with. */
export function sizesFor(category: string): string[] {
  const k = sizeKind(category);
  return k === "clothing" ? [...SIZES] : k === "shoes" ? [...SHOE_SIZES] : [ONE_SIZE];
}

/** What a live can sell (owner, 2026-10-14): the type chosen when an item is called, and the rack category it is
    saved under. Clothing keeps XL–5XL, shoes EU 36–43; the rest are one size, so "MINE B12" needs no size. */
export const LIVE_ITEM_TYPES: readonly { category: Category; label: string }[] = [
  { category: "Tops", label: "Clothing (XL–5XL)" },
  { category: "Accessories", label: "Accessories" },
  { category: "Footwear", label: "Shoes (EU 36–43)" },
  { category: "Skincare", label: "Skincare" },
  { category: "Grocery", label: "Grocery" },
];
export const LIVE_ITEM_CATEGORIES = LIVE_ITEM_TYPES.map((t) => t.category) as [Category, ...Category[]];

export interface SizeChart {
  /** e.g. ["Size", "Waist", "Hips", "Length"] */
  head: string[];
  /** e.g. [["XL", "30–38", "46", "30"], ...]. First cell is the size. */
  rows: string[][];
}

export interface FitTally { perfect: number; tight: number; loose: number }

export interface Product {
  id: string;
  /** Item code said on the live and used in claims: "MINE V12 2XL" */
  code: string;
  name: string;
  category: Category;
  /** Pesos. null until priced. */
  price: number | null;
  /** Original price for sale items */
  was: number | null;
  /** Sizes the item comes in */
  sizes: string[];
  /**
   * Pieces per size. null = open (not counted, sell as many as ordered; "abundance first").
   * A number = limited: first comments win, the rest go to the waitlist.
   */
  stock: Record<string, number | null>;
  /** Clothes-only photos from the Facebook page */
  photos: string[];
  /** Date of the Facebook post, YYYY-MM-DD. Items older than settings.maxAgeDays are hidden. */
  postedOn: string | null;
  postUrl: string | null;
  description: string[];
  stretch: "none" | "some" | "stretchy" | null;
  /** Garment measurements in inches, measured once in Bangkok */
  chart: SizeChart | null;
  /** AI try-on photo, always labeled */
  tryOn: string | null;
  /** Approved AI previews keyed by actual preview size; never stretch one photo. */
  tryOnBySize?: Record<string, string>;
  /** Short pitch video */
  pitch: string | null;
  /** Where the item appears in a live replay */
  replay: { url: string; at: string } | null;
  /** Day-3 "how did it fit?" answers per size */
  fit: Record<string, FitTally> | null;
  /** Shown on the public catalogue */
  published: boolean;
  /** Placeholder item from the demo data */
  sample?: boolean;
  fromLive?: { liveId: string; at: string };
  /** Best before / expiry (YYYY-MM-DD), for skincare and grocery. Shown on the item page. */
  expiresOn?: string | null;
}

export type GateStatus = "KNOWN" | "NO_HISTORY" | "NEW";

export interface BodyMeasurements { bust?: number; waist?: number; hips?: number }

export interface Customer {
  id: string;
  /** Facebook page-scoped id of the commenter, when known */
  fbId: string | null;
  name: string;
  phone: string | null;
  address: string | null;
  city: string | null;
  province: string | null;
  courierBranch: string | null;
  /** Completed orders that shipped */
  shipped: number;
  /** Lifetime spend, pesos */
  lifetime: number;
  /** Times they claimed and never paid */
  misses: number;
  /** Has an existing Messenger thread with the page */
  messaged: boolean;
  /** New Miner Form received */
  formReceived: boolean;
  /** Deposit held, pesos (credited to the next invoice) */
  deposit: number;
  size: string | null;
  /** Saved only with consent; cleared on "DELETE SIZE" */
  body: BodyMeasurements | null;
  sizeConsentAt: string | null;
  /** Tapped "Notify me" / sent NOTIFY: may receive live invites */
  liveOptIn: boolean;
  lastOrderAt: string | null;
  /** Her last message to the page. Messenger allows normal messages for 24 hours after it. */
  lastInboundAt: string | null;
  /** Secret for her own order page (/track/<token>). Anyone with the link sees her orders, so it is long and random. */
  trackToken?: string | null;
  notes: string;
}

export type LiveStatus = "planned" | "live" | "ended";

export interface Live {
  id: string;
  title: string;
  status: LiveStatus;
  startedAt: string | null;
  endedAt: string | null;
  /** Facebook live video id (from the webhook) */
  fbVideoId: string | null;
  /** Link to the Facebook live video, pasted by staff. Shown on the catalogue while live and as a replay. */
  videoUrl?: string | null;
  payday: boolean;
  workflow?: { pending?: {name:string;text:string;at?:string;source?:ClaimSource;commentId?:string|null;fbId?:string|null}[]; store: string; review?: { signature: string; at: string; reviewer: string }; notes?: string };
  /** Item codes planned for tonight, in show order (run sheet) */
  lineup: string[];
  /** Index into lineup of the item on camera now */
  onCamera: number;
}

export type ClaimSource = "facebook" | "tiktok" | "instagram" | "manual";

export interface Claim {
  id: string;
  /** null means ordered outside an actual live interval: pre-order. */
  liveId: string | null;
  customerId: string;
  customerName: string;
  code: string;
  /** null when the comment had no size and the item comes in more than one */
  size: string | null;
  qty: number;
  raw: string;
  /** Optional price per piece agreed for this buyer; never changes the Rack price. */
  unitPrice?: number | null;
  source: ClaimSource;
  commentId: string | null;
  at: string;
  pinned: boolean;
  released: boolean;
  parsedBy: "rule" | "ai" | "staff";
  /** Set once the claim is on an invoice */
  invoiceId: string | null;
}

export type ClaimState = "won" | "held" | "partial" | "missed" | "released" | "needs_size" | "unknown_item";

export type PayMethod = "gcash" | "maya" | "bank";

export interface Payment {
  id: string;
  customerId: string;
  invoiceId: string | null;
  amount: number;
  method: PayMethod;
  proof: boolean;
  proofImage?: string | null;
  kind: "deposit" | "payment";
  at: string;
}

export interface InvoiceLine { code: string; name: string; size: string; qty: number; price: number }

export type InvoiceStatus = "unpaid" | "partial" | "paid" | "expired" | "cancelled";

export interface Invoice {
  revision?: number;
  manualSendRequired?: boolean;
  deliveryNote?: string;
  id: string;
  number: string;
  customerId: string;
  liveId: string | null;
  lines: InvoiceLine[];
  subtotal: number;
  shipping: number;
  depositCredit: number;
  status: InvoiceStatus;
  issuedAt: string;
  /** issuedAt + settings.holdHours */
  dueAt: string;
  /** Hours after issue at which reminders went out, e.g. [2, 12] */
  remindersSent: number[];
  sentAt: string | null;
  batchId: string | null;
}

/** 0 Bag open · 1 Packed in Bangkok · 2 Flown BKK → MNL · 3 At our PH warehouse (received by the PH team) · 4 Out with courier · 5 Delivered */
export type BatchStatus = 0 | 1 | 2 | 3 | 4 | 5;

export interface Batch {
  id: string;
  number: string;
  status: BatchStatus;
  cutoffAt: string;
  updatedAt: string;
  note: string;
  /** Cargo forwarder that issued the waybill */
  forwarder?: string | null;
  /** Cargo waybill number: one for the whole shipment */
  waybill?: string | null;
  /** Expected arrival in Manila, YYYY-MM-DD */
  eta?: string | null;
  /** Waybill photo (Supabase storage path, or a data URL in demo mode). Staff only: never shown to buyers. */
  waybillPhoto?: string | null;
  /** When each step happened: status number → ISO time */
  steps?: Partial<Record<number, string>>;
  /** Steps already sent to buyers as app notifications */
  pushed?: number[];
}

export interface Box {
  id: string;
  batchId: string;
  customerId: string;
  boxNo: string;
  items: number;
  city: string;
  /** Local courier tracking number for this buyer's parcel (J&T, LBC, …) */
  tracking: string | null;
  /** Local courier in the Philippines */
  courier?: string | null;
  /** Tracking number already sent as an app notification */
  pushedTracking?: string | null;
}

export interface WaitlistEntry {
  id: string;
  customerId: string | null;
  customerName: string;
  code: string;
  size: string | null;
  at: string;
  notifiedAt: string | null;
}

export type FitVerdict = "tight" | "perfect" | "loose";

export interface FitFeedback {
  id: string;
  customerId: string;
  code: string;
  size: string;
  verdict: FitVerdict;
  at: string;
}

export type PostStatus = "draft" | "approved" | "posted";
export type Platform = "facebook" | "instagram" | "tiktok";

export interface Post {
  id: string;
  /** Manila date YYYY-MM-DD */
  date: string;
  /** Manila time HH:MM */
  slot: string;
  kind: "pitch" | "styling" | "highlight" | "trust" | "teaser" | "countdown";
  productCode: string | null;
  platforms: Platform[];
  caption: string;
  status: PostStatus;
}

export type MessageKind =
  | "invoice" | "reminder" | "final_notice" | "paid" | "shipped" | "batch_update" | "tracking"
  | "reply" | "fit_check" | "restock" | "winback" | "live_invite" | "gate_onboarding" | "size_reply";

export interface OutboxMessage {
  commentId?: string | null;
  commentAt?: string | null;
  id: string;
  customerId: string;
  kind: MessageKind;
  text: string;
  createdAt: string;
  sentAt: string | null;
  /** Why it was not sent (no Messenger thread, Meta not connected, ...) */
  error: string | null;
}

export interface People {
  /** The face of the live */
  host: string;
  /** Stylist on the live, in Facebook reels and in Messenger replies. ai = true labels them as AI everywhere. */
  stylist: { name: string; ai: boolean };
  /** Stylists shown on the catalogue, website and TikTok (e.g. Bea, AI, and Rose). Falls back to `stylist`. */
  webStylists?: { name: string; ai: boolean }[];
  /** Likeness in AI try-on photos. consent: she agreed (in writing) to AI photos made from her real photo. */
  tryOn: { name: string; ai: boolean; consent?: boolean };
}

/** A Manila warehouse contact shown to buyers whose shipment has arrived (owner, 19 Oct). */
export interface PhContact { name: string; role: string; phone: string; messenger?: string; hours?: string }

export interface Settings {
  shopName: string;
  page: string;
  siteUrl: string;
  social: { instagram: string; tiktok: string };
  people: People;
  maxAgeDays: number;
  /** Manila time. days: 0 = Sunday … 6 = Saturday. paydays: dates labeled "Payday haul". */
  live: { days: number[]; hour: number; hours: number; paydays: number[] };
  /** New Miner Gate deposit, pesos */
  deposit: number;
  /** How long a claim/invoice stays reserved without payment */
  holdHours: number;
  /** Payment reminders, hours after the invoice goes out */
  reminderHours: number[];
  /** Release unpaid items to the next in line when the hold runs out */
  autoRelease: boolean;
  /** Weekly open-bag cutoff, Manila time */
  batchCutoff: { day: number; hour: number; minute: number };
  /** Shipping per order by region, pesos */
  shipping: Record<string, number>;
  couriers: string;
  hero: { photo: string; alt: string; tag: [string, string] } | null;
  /** When there is no hero photo: item ids shown as a 2×2 photo grid at the top of the home page */
  heroItems?: string[];
  /** Manila warehouse contacts; each buyer is assigned one when her shipment arrives there (lib/tracking.ts assignContact) */
  phContacts?: PhContact[];
  /** Holiday theme and the owner's message on the portal and the VIP/customer pages (lib/holiday.ts) */
  holiday?: import("./holiday").HolidaySettings;
}

/** Everything the portal works with. Each array maps to one Supabase table. */
export interface ShopState {
  settings: Settings;
  products: Product[];
  customers: Customer[];
  lives: Live[];
  claims: Claim[];
  payments: Payment[];
  invoices: Invoice[];
  batches: Batch[];
  boxes: Box[];
  waitlist: WaitlistEntry[];
  fitFeedback: FitFeedback[];
  posts: Post[];
  outbox: OutboxMessage[];
}

export type TableName = Exclude<keyof ShopState, "settings">;

/** What the public catalogue needs: no customer data. */
/** A live or a recent replay the catalogue can play. No customer data. */
export interface PublicStream {
  id: string;
  title: string;
  live: boolean;
  startedAt: string | null;
  endedAt: string | null;
  videoUrl: string;
  /** Item codes shown on that live, in show order */
  lineup: string[];
  /** Placeholder replay for previews: dated "N days ago" when the page opens, marked Sample, never ages out */
  sampleDaysAgo?: number;
}

export interface PublicCatalog {
  settings: Settings;
  products: Product[];
  batch: Batch | null;
  /** The live on air (first) and replays from the last REPLAY_DAYS days, newest first */
  streams?: PublicStream[];
}
