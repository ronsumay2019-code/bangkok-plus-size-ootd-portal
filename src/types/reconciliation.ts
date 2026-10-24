/**
 * Bangkok Plus Size OOTD - Live Selling & Inventory Reconciliation Portal Types
 * Based on production architecture (docs/STORE-OPERATIONS.md, docs/LIVE-SELLING-ARCHITECTURE.md)
 */

export type LiveStatus = 'live' | 'ended' | 'planned';

export interface LiveSession {
  id: string;
  title: string;
  status: LiveStatus;
  startedAt: string;
  endedAt: string | null;
  fbVideoId: string | null;
  videoUrl: string;
  storeName: string;
  storeDate: string;
  lineup: string[];
  totalComments: number;
  totalMined: number;
  reconciledAt: string | null;
  reconciliationStatus: 'unreconciled' | 'reconciling' | 'reconciled' | 'needs_review' | 'awaiting_owner_review';
  metaWebhookStatus?: 'active' | 'listening' | 'disconnected';
  lastGraphSyncAt?: string;
  graphSyncCount?: number;
  autoReconcileTriggeredAt?: string;
  ownerReviewNotes?: string;
  ownerApprovedAt?: string;
  ownerApprovedBy?: string;
}

export interface OrderOverrideHistoryItem {
  version: number;
  by: string;
  at: string;
  reason: string;
  before: Partial<BuyerOrder>;
  after: Partial<BuyerOrder>;
}

export type OrderSource = 'live_chat' | 'messenger' | 'vip' | 'staff_entry';
export type OrderStatus = 'pending' | 'confirmed' | 'short' | 'replaced' | 'cancelled' | 'invoiced';

export interface BuyerOrder {
  id: string;
  liveId: string;
  buyerName: string;
  buyerHandle?: string;
  buyerContact?: string;
  channel: OrderSource;
  sourceCommentId?: string;
  itemCode: string;
  itemName: string;
  size: string;
  colour: string;
  quantity: number;
  statedUnitPricePhp: number | null;
  supplierCostThb?: number;
  orderedAt: string;
  replayTimestampSeconds?: number;
  hostVerificationNote?: string;
  status: OrderStatus;
  isVip?: boolean;
  priorityScore?: number;
  replacementId?: string; // If this order was replaced by a later amendment
  allocatedInventoryRowId?: string | null;
  invoiced: boolean;
  invoiceNumber?: string;
  /** When the invoice was made */
  invoicedAt?: string;
  /** When the invoice reached the buyer (Messenger delivery or "mark sent"); the 24 hours to pay start here */
  invoiceSentAt?: string;
  paymentStatus?: 'unpaid' | 'paid';
  paidAt?: string;
  /** Payment proof checked by staff; no proof means not paid */
  paymentProof?: { photoPath?: string; reference?: string; amountPhp?: number; recordedBy?: string; recordedAt: string };
  isDuplicateFlagged?: boolean;
  duplicateReason?: string;
  pendingReason?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  reviewNotes?: string;
  lane?: 'live' | 'pre_order';
  version?: number;
  overrideHistory?: OrderOverrideHistoryItem[];
}

export interface PreOrder {
  id: string;
  buyerName: string;
  buyerContact?: string;
  itemCode: string;
  itemName: string;
  size: string;
  colour: string;
  quantity: number;
  statedUnitPricePhp: number | null;
  supplierCostThb?: number;
  channel: 'messenger' | 'reels' | 'post' | 'vip' | 'manual';
  createdAt: string;
  status: 'pending' | 'confirmed' | 'allocated' | 'invoiced' | 'cancelled';
  targetStore?: string;
  notes?: string;
  version: number;
  overrideHistory?: OrderOverrideHistoryItem[];
}

export type AmendmentType = 
  | 'size_change'
  | 'colour_change'
  | 'quantity_change'
  | 'item_replacement'
  | 'cancellation';

export interface OrderAmendment {
  id: string;
  originalOrderId: string;
  buyerName: string;
  channel: 'live_chat' | 'messenger' | 'vip';
  type: AmendmentType;
  requestedAt: string;
  originalSpec: {
    itemCode: string;
    size: string;
    colour: string;
    quantity: number;
  };
  newSpec: {
    itemCode: string;
    size: string;
    colour: string;
    quantity: number;
  };
  rawText: string;
  screenshotUrl?: string;
  status: 'applied' | 'pending_review' | 'rejected';
  resolvedAt?: string;
  resolutionNote?: string;
}

export interface InventoryItem {
  id: string;
  liveId: string;
  code: string;
  description: string;
  size: string;
  colour: string;
  part: number | null;
  observed: number | null; // Physically seen on rack
  purchased: number | null; // Actually purchased at store
  cost: number | null; // THB supplier unit cost
  price: number | null; // PHP reference retail price
  evidence: string;
  supplierStore: string;
  supplierReceiptRef: string;
  archived: boolean;
  requestIds: string[];
  discrepancyFlag?: 'shortage' | 'uncounted' | 'surplus' | 'balanced';
  discrepancyGap?: number | null; // e.g. -2 for shortage, +3 for surplus
  liveDemand?: number;
  lastSyncedAt?: string;
  syncNote?: string;
}

export interface InventoryDiscrepancy {
  itemId?: string;
  code: string;
  size: string;
  colour: string;
  observed: number | null;
  purchased: number | null;
  liveDemand: number;
  gap: number | null;
  flag: 'shortage' | 'uncounted' | 'surplus' | 'balanced' | 'missing_rack';
  severity: 'critical' | 'warning' | 'info' | 'ok';
  message: string;
  buyers: string[];
  affectedOrdersCount: number;
}

export interface InventorySyncResult {
  syncedAt: string;
  liveId: string;
  totalItemsChecked: number;
  totalDemandPieces: number;
  totalObservedPieces: number;
  discrepanciesCount: number;
  criticalCount: number;
  warningCount: number;
  surplusCount: number;
  balancedCount: number;
  discrepancies: InventoryDiscrepancy[];
}

export type CoverageStatus = 'covered' | 'short' | 'unknown' | 'no_row' | 'extra';

export interface VariantCoverage {
  key: string;
  code: string;
  size: string;
  colour: string;
  partName: string;
  ordered: number;
  confirmed: number;
  pending: number;
  claimed: number;
  sharedOrdered: number;
  observed: number | null;
  rowIds: string[];
  status: CoverageStatus;
  gap: number | null;
  buyers: Array<{
    name: string;
    at: string;
    quantity: number;
    channel: OrderSource;
    orderId: string;
    status: OrderStatus;
  }>;
}

export interface AffectedBuyer {
  orderId: string;
  name: string;
  at: string;
  missing: number;
  itemCode: string;
  variantKey: string;
}

export interface VariantReconciliation {
  key: string;
  rowIds: string[];
  approvedDemand: number;
  purchasedCount: number | null;
  shortCount: number;
  extraCount: number;
  unitCostThb: number | null;
  unitPricePhp: number | null;
  extraCostThb: number | null;
  affectedBuyers: AffectedBuyer[];
  lostSalesPhp: number | null;
}

export interface PurchaseAccuracy {
  piecesAccuracy: number | null;
  approvedPieces: number;
  purchasedPieces: number | null;
  matchedPieces: number | null;
  moneyAccuracy: number | null;
  approvedValueThb: number | null;
  supplierPaidThb: number | null;
  targetPercent: number;
  isPassing: boolean;
}

export interface BuyerBagLine {
  orderId: string;
  itemCode: string;
  itemName: string;
  size: string;
  colour: string;
  ordered: number;
  got: number;
  missing: number;
  unitPricePhp: number;
  status: 'filled' | 'partial' | 'shorted';
}

export interface BuyerBag {
  buyerName: string;
  buyerContact?: string;
  channel: OrderSource;
  lines: BuyerBagLine[];
  totalPiecesGot: number;
  totalPiecesMissing: number;
  subtotalPhp: number;
  isComplete: boolean;
  invoiceStatus: 'ready_to_invoice' | 'invoiced' | 'needs_shortage_resolution';
  invoiceId?: string;
  suggestedMessageDraft?: string;
}

export interface StoreChecklistItem {
  id: 
    | 'orders_on_list'
    | 'nothing_missing'
    | 'buying_approved'
    | 'purchases_entered'
    | 'purchase_accuracy'
    | 'purchase_approved'
    | 'shortages_reviewed';
  label: string;
  done: boolean;
  critical: boolean;
  detail: string;
}

export interface ReconciliationSummary {
  liveId: string;
  liveTitle: string;
  generatedAt: string;
  triggerType: 'automatic_live_end' | 'manual_trigger' | 'rolling_pass';
  totalRawComments: number;
  totalParsedOrders: number;
  totalDeduplicatedOrders: number;
  totalAmendmentsApplied: number;
  uniqueBuyersCount: number;
  
  // Stock metrics
  variants: VariantReconciliation[];
  coverage: VariantCoverage[];
  accuracy: PurchaseAccuracy;
  
  // Buyer bags
  buyerBags: BuyerBag[];
  affectedShortageBuyers: AffectedBuyer[];
  
  // Financial breakdown
  currency: 'THB';
  phpPerThbRate: number | null;
  totalPurchasedCostThb: number;
  supplierPaidThb: number | null;
  paymentDifferenceThb: number | null;
  extraStockCostThb: number;
  projectedRevenuePhp: number;
  projectedLostSalesPhp: number;
  estimatedGrossProfitPhp: number | null;
  
  // Checklist
  checklist: {
    readyToLeaveStore: boolean;
    items: StoreChecklistItem[];
  };

  // Safe Invoice queue (Zero Refund cycles guarantee)
  invoicingQueue: {
    eligibleInvoicesCount: number;
    blockedInvoicesCount: number;
    totalInvoicablePhp: number;
  };
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  metadata?: {
    modelUsed?: string;
    taskType?: string;
    resolvedDiscrepancy?: boolean;
    citations?: string[];
  };
}

export interface BuyingBehaviorAnalytics {
  totalOrdersCaptured: number;
  uniqueBuyers: number;
  averageItemsPerBuyer: number;
  sizeDistribution: Array<{ size: string; count: number; percentage: number }>;
  channelAdoption: Array<{ channel: string; label: string; count: number; percentage: number }>;
  modificationStats: {
    totalModifications: number;
    modificationRatePercent: number;
    sizeChanges: number;
    colourSwaps: number;
    itemReplacements: number;
    cancellations: number;
    channelBreakdown: { liveChat: number; messenger: number; vip: number };
  };
  peakMiningVelocity: Array<{ minuteWindow: string; claimsCount: number; activeItems: string }>;
  hotspotShortages: Array<{ itemCode: string; demand: number; stock: number; shortage: number; lostRevenuePhp: number }>;
  duplicateDetections: {
    totalDuplicatesBlocked: number;
    preventedOverspendThb: number;
    flaggedPendingResolution: number;
  };
}

export interface MessengerMessage {
  id: string;
  sender: 'buyer' | 'page_agent' | 'system_auto';
  text: string;
  timestamp: string;
  mid?: string;
  /** Outgoing messages only: whether Meta delivered it ('sending' is shown in the browser until the server answers) */
  deliveryStatus?: 'sending' | 'sent' | 'failed' | 'not_sent';
  deliveryDetail?: string;
}

export interface MessengerThread {
  id: string;
  psid: string;
  buyerName: string;
  buyerHandle: string;
  windowExpiresAt: string; // Meta 24-hour standard messaging window
  unreadCount: number;
  linkedOrderId?: string;
  detectedIntent?: {
    type: 'size_change' | 'colour_change' | 'item_replacement' | 'cancellation' | 'pre_order' | 'invoice_inquiry';
    confidence: number;
    summary: string;
    suggestedSpec?: {
      itemCode: string;
      size: string;
      colour: string;
      quantity: number;
    };
  };
  messages: MessengerMessage[];
}

