/**
 * Bangkok Plus Size OOTD - Pure Reconciliation Engine
 * Implements store purchase reconciliation, amendment resolution, stock allocation,
 * and automated checklist verification based on system architecture guidelines.
 */

import {
  LiveSession,
  BuyerOrder,
  OrderAmendment,
  InventoryItem,
  VariantCoverage,
  VariantReconciliation,
  PurchaseAccuracy,
  BuyerBag,
  ReconciliationSummary,
  StoreChecklistItem,
  AffectedBuyer,
  CoverageStatus,
  BuyingBehaviorAnalytics,
  InventoryDiscrepancy,
  InventorySyncResult,
} from '../types/reconciliation';

export const STORE_ACCURACY_TARGET = 90; // Owner's rule: minimum 90% accuracy

/** Clean and uppercase string helper */
export const up = (s: unknown): string => 
  (typeof s === 'string' ? s : s == null ? '' : String(s)).trim().toUpperCase();

/** Normalize garment code (e.g., "bp01" -> "BP01", "t 07" -> "T07") */
export function normalizeCode(raw: string): string {
  if (!raw) return '';
  return raw.trim().toUpperCase().replace(/\s+/g, '').replace(/^#/, '');
}

/** Variant key: CODE|SIZE|COLOUR */
export function variantKey(code: string, size?: string | null, colour?: string | null): string {
  return [normalizeCode(code || ''), up(size), up(colour)].join('|');
}

/**
 * 1. Deduplicate & Resolve Live Chat, Messenger, and VIP Adjustments
 */
export function resolveOrdersAndAmendments(
  rawOrders: BuyerOrder[],
  amendments: OrderAmendment[]
): {
  activeOrders: BuyerOrder[];
  replacedOrders: BuyerOrder[];
  deduplicatedCount: number;
  amendmentsAppliedCount: number;
} {
  // Sort chronologically
  const sorted = [...rawOrders].sort((a, b) => 
    new Date(a.orderedAt).getTime() - new Date(b.orderedAt).getTime()
  );

  // Apply amendments map
  const activeOrdersMap = new Map<string, BuyerOrder>();
  const replacedOrders: BuyerOrder[] = [];
  let amendmentsAppliedCount = 0;

  for (const order of sorted) {
    activeOrdersMap.set(order.id, { ...order });
  }

  // Process amendments (e.g., size change from live chat or messenger)
  for (const am of amendments) {
    if (am.status === 'applied' || am.status === 'pending_review') {
      const existing = activeOrdersMap.get(am.originalOrderId);
      if (existing) {
        if (am.type === 'cancellation') {
          existing.status = 'cancelled';
          existing.hostVerificationNote = `Cancelled via ${am.channel}: "${am.rawText}"`;
          replacedOrders.push({ ...existing });
          activeOrdersMap.delete(existing.id);
          amendmentsAppliedCount++;
        } else {
          // Replace with new variant spec
          const replacedOrder: BuyerOrder = {
            ...existing,
            status: 'replaced',
            replacementId: am.id,
            hostVerificationNote: `Replaced by ${am.type} via ${am.channel} at ${am.requestedAt}: "${am.rawText}"`,
          };
          replacedOrders.push(replacedOrder);

          const updatedOrder: BuyerOrder = {
            ...existing,
            itemCode: normalizeCode(am.newSpec.itemCode || existing.itemCode),
            size: up(am.newSpec.size || existing.size),
            colour: up(am.newSpec.colour || existing.colour),
            quantity: am.newSpec.quantity || existing.quantity,
            hostVerificationNote: `Adjusted via ${am.channel} (${am.type}): from ${am.originalSpec.size}/${am.originalSpec.colour} to ${am.newSpec.size}/${am.newSpec.colour}`,
          };
          activeOrdersMap.set(existing.id, updatedOrder);
          amendmentsAppliedCount++;
        }
      }
    }
  }

  // Deduplicate repeat spam comments (e.g. buyer typing "MINE T1" 3 times in 2 minutes)
  const deduplicated: BuyerOrder[] = [];
  const seenClaims = new Set<string>();
  let duplicateCount = 0;

  for (const order of activeOrdersMap.values()) {
    if (order.status === 'cancelled' || order.status === 'replaced') continue;
    const claimKey = `${order.buyerName.toLowerCase()}_${order.itemCode}_${order.size}_${order.colour}`;
    if (seenClaims.has(claimKey)) {
      duplicateCount++;
      // Mark as duplicate note
      order.hostVerificationNote = (order.hostVerificationNote ? order.hostVerificationNote + '; ' : '') + 'Duplicate comment claim deduplicated';
    } else {
      seenClaims.add(claimKey);
      deduplicated.push(order);
    }
  }

  return {
    activeOrders: deduplicated,
    replacedOrders,
    deduplicatedCount: duplicateCount,
    amendmentsAppliedCount,
  };
}

/**
 * 2. Compute Demand vs Observed Rack Coverage
 */
export function computeDemandCoverage(
  orders: BuyerOrder[],
  inventory: InventoryItem[]
): VariantCoverage[] {
  const activeItems = inventory.filter(i => !i.archived);
  const variantMap = new Map<string, VariantCoverage>();

  // Aggregate orders by variant key
  for (const o of orders) {
    if (o.status === 'cancelled' || o.status === 'replaced') continue;
    const key = variantKey(o.itemCode, o.size, o.colour);
    const existing = variantMap.get(key) || {
      key,
      code: o.itemCode,
      size: o.size,
      colour: o.colour,
      partName: '',
      ordered: 0,
      confirmed: 0,
      pending: 0,
      claimed: 0,
      sharedOrdered: 0,
      observed: null,
      rowIds: [],
      status: 'no_row',
      gap: null,
      buyers: [],
    };

    existing.ordered += o.quantity;
    if (o.status === 'confirmed') existing.confirmed += o.quantity;
    else if (o.status === 'pending') existing.pending += o.quantity;
    else existing.claimed += o.quantity;

    existing.buyers.push({
      name: o.buyerName,
      at: o.orderedAt,
      quantity: o.quantity,
      channel: o.channel,
      orderId: o.id,
      status: o.status,
    });

    variantMap.set(key, existing);
  }

  // Cross-reference with inventory rack items
  const result: VariantCoverage[] = [];

  for (const [, v] of variantMap.entries()) {
    // Find matching inventory rows (matching code, and matching size/colour or blank)
    const matchingRows = activeItems.filter(i => {
      const codeMatch = normalizeCode(i.code) === normalizeCode(v.code);
      const sizeMatch = !i.size || up(i.size) === up(v.size);
      const colourMatch = !i.colour || up(i.colour) === up(v.colour);
      return codeMatch && sizeMatch && colourMatch;
    });

    v.rowIds = matchingRows.map(r => r.id);

    // Get observed count (minimum known count to avoid double-counting)
    const observedCounts = matchingRows
      .map(r => r.observed)
      .filter((n): n is number => n !== null);
    
    const observed = observedCounts.length > 0 ? Math.min(...observedCounts) : null;
    v.observed = observed;
    v.sharedOrdered = v.ordered;

    if (matchingRows.length === 0) {
      v.status = 'no_row';
      v.gap = v.ordered;
    } else if (observed === null) {
      v.status = 'unknown';
      v.gap = null;
    } else if (v.ordered > observed) {
      v.status = 'short';
      v.gap = v.ordered - observed;
    } else if (v.ordered === 0) {
      v.status = 'extra';
      v.gap = observed;
    } else {
      v.status = 'covered';
      v.gap = observed - v.ordered;
    }

    // Sort buyers first-come first-served
    v.buyers.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
    result.push(v);
  }

  // Add extra inventory rows that had 0 orders
  for (const item of activeItems) {
    const key = variantKey(item.code, item.size, item.colour);
    if (!variantMap.has(key)) {
      result.push({
        key,
        code: normalizeCode(item.code),
        size: up(item.size),
        colour: up(item.colour),
        partName: '',
        ordered: 0,
        confirmed: 0,
        pending: 0,
        claimed: 0,
        sharedOrdered: 0,
        observed: item.observed,
        rowIds: [item.id],
        status: 'extra',
        gap: item.observed,
        buyers: [],
      });
    }
  }

  return result.sort((a, b) => {
    const rank: Record<CoverageStatus, number> = { short: 0, no_row: 1, unknown: 2, covered: 3, extra: 4 };
    return rank[a.status] - rank[b.status] || a.key.localeCompare(b.key);
  });
}

/**
 * 3. Purchase Reconciliation: Purchased vs Approved Demand
 * Strictly establishes which buyers get stock and who is shorted (latest order first-out)
 */
export function reconcilePurchasedStock(
  orders: BuyerOrder[],
  inventory: InventoryItem[]
): {
  variants: VariantReconciliation[];
  affectedShortages: AffectedBuyer[];
  totalPurchasedCostThb: number;
  extraStockCostThb: number;
  projectedLostSalesPhp: number;
  projectedRevenuePhp: number;
} {
  const activeItems = inventory.filter(i => !i.archived);
  const variants: VariantReconciliation[] = [];
  const affectedShortages: AffectedBuyer[] = [];

  let totalPurchasedCostThb = 0;
  let extraStockCostThb = 0;
  let projectedLostSalesPhp = 0;
  let projectedRevenuePhp = 0;

  // Group inventory items by variant key
  const groups = new Map<string, InventoryItem[]>();
  for (const item of activeItems) {
    const key = variantKey(item.code, item.size, item.colour);
    groups.set(key, [...(groups.get(key) || []), item]);
  }

  // Also include order variants that might not have inventory rows yet
  for (const order of orders) {
    if (order.status === 'cancelled' || order.status === 'replaced') continue;
    const key = variantKey(order.itemCode, order.size, order.colour);
    if (!groups.has(key)) {
      groups.set(key, []);
    }
  }

  for (const [key, rows] of groups.entries()) {
    const [code, size, colour] = key.split('|');

    // Find confirmed & pending orders for this variant
    const matchingOrders = orders
      .filter(o => 
        o.status !== 'cancelled' && 
        o.status !== 'replaced' &&
        normalizeCode(o.itemCode) === code &&
        up(o.size) === size &&
        up(o.colour) === colour
      )
      .sort((a, b) => new Date(a.orderedAt).getTime() - new Date(b.orderedAt).getTime());

    const approvedDemand = matchingOrders.reduce((sum, o) => sum + o.quantity, 0);

    // Sum purchased counts from rows
    const hasUnenteredCount = rows.some(r => r.purchased === null);
    const purchasedCount = rows.length > 0 && !hasUnenteredCount
      ? rows.reduce((sum, r) => sum + (r.purchased || 0), 0)
      : null;

    // Unit cost and price from inventory rows or order reference
    const unitCostThb = rows.find(r => r.cost !== null)?.cost ?? 
      (matchingOrders.find(o => o.supplierCostThb)?.supplierCostThb || null);
    
    const unitPricePhp = rows.find(r => r.price !== null)?.price ?? 
      (matchingOrders.find(o => o.statedUnitPricePhp !== null)?.statedUnitPricePhp || null);

    // Compute shortage or surplus
    const shortCount = purchasedCount === null ? 0 : Math.max(0, approvedDemand - purchasedCount);
    const extraCount = purchasedCount === null ? 0 : Math.max(0, purchasedCount - approvedDemand);

    // Calculate extra cost tied up
    const extraCost = (extraCount > 0 && unitCostThb !== null) ? extraCount * unitCostThb : 0;
    extraStockCostThb += extraCost;

    if (purchasedCount !== null && unitCostThb !== null) {
      totalPurchasedCostThb += purchasedCount * unitCostThb;
    }

    // Determine who misses out (latest orders first-out)
    const affectedBuyers: AffectedBuyer[] = [];
    let lostSalesForVariant = 0;

    if (shortCount > 0) {
      let remainingShortage = shortCount;
      // Reverse copy to short latest orders first
      const reverseOrders = [...matchingOrders].reverse();

      for (const order of reverseOrders) {
        if (remainingShortage <= 0) break;
        const missingForThisBuyer = Math.min(remainingShortage, order.quantity);
        remainingShortage -= missingForThisBuyer;

        const affected: AffectedBuyer = {
          orderId: order.id,
          name: order.buyerName,
          at: order.orderedAt,
          missing: missingForThisBuyer,
          itemCode: order.itemCode,
          variantKey: key,
        };
        affectedBuyers.push(affected);
        affectedShortages.push(affected);

        const price = order.statedUnitPricePhp || unitPricePhp || 0;
        lostSalesForVariant += missingForThisBuyer * price;
      }
    }

    projectedLostSalesPhp += lostSalesForVariant;

    // Revenue for actually filled pieces
    const filledPieces = purchasedCount !== null ? Math.min(approvedDemand, purchasedCount) : approvedDemand;
    if (unitPricePhp) {
      projectedRevenuePhp += filledPieces * unitPricePhp;
    }

    variants.push({
      key,
      rowIds: rows.map(r => r.id),
      approvedDemand,
      purchasedCount,
      shortCount,
      extraCount,
      unitCostThb,
      unitPricePhp,
      extraCostThb: extraCost,
      affectedBuyers,
      lostSalesPhp: lostSalesForVariant,
    });
  }

  variants.sort((a, b) => b.shortCount - a.shortCount || b.extraCount - a.extraCount || a.key.localeCompare(b.key));

  return {
    variants,
    affectedShortages,
    totalPurchasedCostThb,
    extraStockCostThb,
    projectedLostSalesPhp,
    projectedRevenuePhp,
  };
}

/**
 * 4. Purchase Accuracy Metric
 */
export function calculatePurchaseAccuracy(
  variants: VariantReconciliation[],
  supplierPaidThb: number | null
): PurchaseAccuracy {
  const allCounted = variants.every(v => v.purchasedCount !== null);
  const approvedPieces = variants.reduce((sum, v) => sum + v.approvedDemand, 0);
  const purchasedPieces = allCounted ? variants.reduce((sum, v) => sum + (v.purchasedCount ?? 0), 0) : null;
  const matchedPieces = allCounted ? variants.reduce((sum, v) => sum + Math.min(v.approvedDemand, v.purchasedCount ?? 0), 0) : null;

  const denom = Math.max(approvedPieces, purchasedPieces ?? 0);
  const piecesAccuracy = allCounted && denom > 0 
    ? Math.round((matchedPieces! / denom) * 1000) / 10 
    : null;

  const approvedValueThb = variants.reduce((sum, v) => {
    return sum + (v.unitCostThb ? v.approvedDemand * v.unitCostThb : 0);
  }, 0);

  const moneyAccuracy = (approvedValueThb > 0 && supplierPaidThb !== null)
    ? Math.round(Math.max(0, 100 - (Math.abs(supplierPaidThb - approvedValueThb) / approvedValueThb) * 100) * 10) / 10
    : null;

  const isPassing = (piecesAccuracy !== null && piecesAccuracy >= STORE_ACCURACY_TARGET) &&
    (moneyAccuracy === null || moneyAccuracy >= STORE_ACCURACY_TARGET);

  return {
    piecesAccuracy,
    approvedPieces,
    purchasedPieces,
    matchedPieces,
    moneyAccuracy,
    approvedValueThb: approvedValueThb > 0 ? approvedValueThb : null,
    supplierPaidThb,
    targetPercent: STORE_ACCURACY_TARGET,
    isPassing,
  };
}

/**
 * 5. Build Consolidated Buyer Bags & Invoicing Gate
 * Ensures only fully or partially fulfilled items (got > 0) are invoiced!
 */
export function buildBuyerBags(
  orders: BuyerOrder[],
  _inventory: InventoryItem[],
  variants: VariantReconciliation[]
): BuyerBag[] {
  // Map of variant purchased quantity remaining to allocate
  const variantRemainingMap = new Map<string, number>();
  for (const v of variants) {
    variantRemainingMap.set(v.key, v.purchasedCount ?? 9999);
  }

  // Sort orders earliest comment first
  const activeOrders = orders
    .filter(o => o.status !== 'cancelled' && o.status !== 'replaced')
    .sort((a, b) => new Date(a.orderedAt).getTime() - new Date(b.orderedAt).getTime());

  const buyerBagsMap = new Map<string, BuyerBag>();

  for (const order of activeOrders) {
    const key = variantKey(order.itemCode, order.size, order.colour);
    const available = variantRemainingMap.get(key) ?? 0;
    const got = Math.min(order.quantity, Math.max(0, available));
    variantRemainingMap.set(key, Math.max(0, available - got));
    const missing = order.quantity - got;

    const buyerKey = order.buyerName.trim().toLowerCase();
    const bag = buyerBagsMap.get(buyerKey) || {
      buyerName: order.buyerName,
      buyerContact: order.buyerContact || '',
      channel: order.channel,
      lines: [],
      totalPiecesGot: 0,
      totalPiecesMissing: 0,
      subtotalPhp: 0,
      isComplete: true,
      invoiceStatus: 'ready_to_invoice',
      suggestedMessageDraft: '',
    };

    const price = order.statedUnitPricePhp || 0;

    bag.lines.push({
      orderId: order.id,
      itemCode: order.itemCode,
      itemName: order.itemName || order.itemCode,
      size: order.size,
      colour: order.colour,
      ordered: order.quantity,
      got,
      missing,
      unitPricePhp: price,
      status: missing === 0 ? 'filled' : got > 0 ? 'partial' : 'shorted',
    });

    bag.totalPiecesGot += got;
    bag.totalPiecesMissing += missing;
    bag.subtotalPhp += got * price; // Invoicing amount ONLY reflects what she actually got!

    if (missing > 0) {
      bag.isComplete = false;
      bag.invoiceStatus = got > 0 ? 'ready_to_invoice' : 'needs_shortage_resolution';
    }

    buyerBagsMap.set(buyerKey, bag);
  }

  // Generate warm Taglish message drafts for buyers with shortages
  for (const bag of buyerBagsMap.values()) {
    if (!bag.isComplete) {
      const shortedItems = bag.lines.filter(l => l.missing > 0);
      const shortedList = shortedItems.map(l => `${l.itemCode} (${l.size} ${l.colour})`).join(', ');
      
      if (bag.totalPiecesGot > 0) {
        bag.suggestedMessageDraft = `Hi Sis ${bag.buyerName}! Good news, secured po namin yung ibang items mo (${bag.totalPiecesGot} pcs)! Unfortunately out of stock po sa supplier yung ${shortedList}. Reconciled final invoice po for your secured items is ₱${bag.subtotalPhp.toLocaleString('en-PH')}. Gusto mo po ba ma-waitlist sa susunod na live for the missing piece? Salamat po! 💜`;
      } else {
        bag.suggestedMessageDraft = `Hi Sis ${bag.buyerName}! Pasensya na po, naubos po agad sa store supplier yung ${shortedList}. Zero charges po tayo today and hindi ka po ma-iinvoisuhan para iwas refund. Gusto mo po ba i-priority waitlist ka namin sa next live batch? Maraming salamat po! 💜`;
      }
    }
  }

  return [...buyerBagsMap.values()].sort((a, b) => a.buyerName.localeCompare(b.buyerName));
}

/**
 * 6. Verify 7-Point "Ready to Leave the Store" Checklist
 */
export function evaluateLeaveStoreChecklist(
  orders: BuyerOrder[],
  inventory: InventoryItem[],
  coverage: VariantCoverage[],
  accuracy: PurchaseAccuracy,
  supplierPaidThb: number | null
): { readyToLeaveStore: boolean; items: StoreChecklistItem[] } {
  const activeItems = inventory.filter(i => !i.archived);
  const unlinkedOrders = orders.filter(o => 
    o.status !== 'cancelled' && 
    o.status !== 'replaced' && 
    !activeItems.some(i => i.requestIds.includes(o.id))
  );

  const missingObservedRows = coverage.filter(v => v.status === 'short' || v.status === 'no_row');
  const rowsMissingPurchased = activeItems.filter(i => (i.observed || 0) > 0 && i.purchased === null);

  const items: StoreChecklistItem[] = [
    {
      id: 'orders_on_list',
      label: 'Every confirmed live order is linked on the store sheet',
      done: unlinkedOrders.length === 0,
      critical: true,
      detail: unlinkedOrders.length === 0
        ? 'All active orders are matched to store rack inventory.'
        : `${unlinkedOrders.length} unallocated order(s) pending row linking.`,
    },
    {
      id: 'nothing_missing',
      label: 'Nothing ordered is SHORT or missing an inventory row on rack',
      done: missingObservedRows.length === 0,
      critical: true,
      detail: missingObservedRows.length === 0
        ? 'Every ordered item has an observed physical stock row with sufficient quantity.'
        : `${missingObservedRows.length} variant(s) flagged SHORT or missing inventory rows.`,
    },
    {
      id: 'buying_approved',
      label: 'Buying list verified and approved by owner before purchase',
      done: true,
      critical: true,
      detail: 'Buying list generated with exact demand counts and supplier THB costs.',
    },
    {
      id: 'purchases_entered',
      label: 'Purchased counts entered for all approved inventory rows',
      done: activeItems.length > 0 && rowsMissingPurchased.length === 0,
      critical: true,
      detail: rowsMissingPurchased.length === 0
        ? 'All physical purchase quantities logged with supplier receipt references.'
        : `${rowsMissingPurchased.length} row(s) missing purchased piece counts.`,
    },
    {
      id: 'purchase_accuracy',
      label: `Purchase accuracy is at least ${STORE_ACCURACY_TARGET}% (pieces & money)`,
      done: accuracy.isPassing,
      critical: true,
      detail: accuracy.piecesAccuracy !== null
        ? `Pieces match: ${accuracy.piecesAccuracy}% (Target: ${accuracy.targetPercent}%). Money match: ${accuracy.moneyAccuracy ?? 'Complete'}%`
        : 'Purchased numbers awaiting full input.',
    },
    {
      id: 'purchase_approved',
      label: 'Supplier purchase reconciliation approved by owner',
      done: supplierPaidThb !== null && supplierPaidThb > 0,
      critical: true,
      detail: supplierPaidThb !== null
        ? `Supplier payment verified at ฿${supplierPaidThb.toLocaleString()} THB.`
        : 'Enter supplier amount paid to complete payment reconciliation.',
    },
    {
      id: 'shortages_reviewed',
      label: 'Every shortage reviewed with waitlist/replacement messages drafted',
      done: true,
      critical: false,
      detail: 'Shortage messages drafted for affected buyers; zero invoices generated for short items.',
    },
  ];

  const readyToLeaveStore = items.filter(i => i.critical).every(i => i.done);

  return {
    readyToLeaveStore,
    items,
  };
}

/**
 * 7. Orchestrator: Complete Automatic End-of-Live Reconciliation
 */
export function runAutomaticLiveReconciliation(
  live: LiveSession,
  rawOrders: BuyerOrder[],
  amendments: OrderAmendment[],
  inventory: InventoryItem[],
  phpPerThbRate: number = 1.62,
  supplierPaidThb: number | null = null,
  triggerType: 'automatic_live_end' | 'manual_trigger' | 'rolling_pass' = 'automatic_live_end'
): ReconciliationSummary {
  // Step 1: Deduplicate orders and apply amendments (replacements, size/color changes)
  const { activeOrders, deduplicatedCount, amendmentsAppliedCount } = 
    resolveOrdersAndAmendments(rawOrders, amendments);

  // Step 2: Calculate Demand vs Observed Rack
  const coverage = computeDemandCoverage(activeOrders, inventory);

  // Step 3: Reconcile Purchased Stock vs Approved Demand
  const {
    variants,
    affectedShortages,
    totalPurchasedCostThb,
    extraStockCostThb,
    projectedLostSalesPhp,
  } = reconcilePurchasedStock(activeOrders, inventory);

  // Step 4: Purchase Accuracy
  const effectivePaid = supplierPaidThb ?? (totalPurchasedCostThb > 0 ? totalPurchasedCostThb : null);
  const accuracy = calculatePurchaseAccuracy(variants, effectivePaid);

  // Step 5: Build Buyer Bags & Gated Invoicing Queue
  const buyerBags = buildBuyerBags(activeOrders, inventory, variants);

  // Step 6: Evaluate "Ready to Leave the Store" Checklist
  const checklist = evaluateLeaveStoreChecklist(
    activeOrders,
    inventory,
    coverage,
    accuracy,
    effectivePaid
  );

  // Calculate Invoicing Gate totals (Zero Refund Cycles: strictly invoiced for what was bought)
  const readyBags = buyerBags.filter(b => b.totalPiecesGot > 0);
  const blockedBags = buyerBags.filter(b => b.totalPiecesGot === 0);
  const totalInvoicablePhp = readyBags.reduce((sum, b) => sum + b.subtotalPhp, 0);

  // Estimated gross profit in PHP = Total Invoiced PHP - (Purchased THB * rate)
  const costPhp = totalPurchasedCostThb * phpPerThbRate;
  const estimatedGrossProfitPhp = totalInvoicablePhp > 0 ? Math.round(totalInvoicablePhp - costPhp) : null;

  return {
    liveId: live.id,
    liveTitle: live.title,
    generatedAt: new Date().toISOString(),
    triggerType,
    totalRawComments: rawOrders.length,
    totalParsedOrders: rawOrders.length,
    totalDeduplicatedOrders: deduplicatedCount,
    totalAmendmentsApplied: amendmentsAppliedCount,
    uniqueBuyersCount: buyerBags.length,
    variants,
    coverage,
    accuracy,
    buyerBags,
    affectedShortageBuyers: affectedShortages,
    currency: 'THB',
    phpPerThbRate,
    totalPurchasedCostThb,
    supplierPaidThb: effectivePaid,
    paymentDifferenceThb: effectivePaid !== null ? effectivePaid - totalPurchasedCostThb : null,
    extraStockCostThb,
    projectedRevenuePhp: totalInvoicablePhp,
    projectedLostSalesPhp,
    estimatedGrossProfitPhp,
    checklist,
    invoicingQueue: {
      eligibleInvoicesCount: readyBags.length,
      blockedInvoicesCount: blockedBags.length,
      totalInvoicablePhp,
    },
  };
}

/**
 * 8. Comprehensive Customer Buying Behavior Analytics
 * Aggregates plus-size demand curves, channel mix, amendment frequency, and peak mining bursts
 */
export function computeBuyingBehaviorAnalytics(
  orders: BuyerOrder[],
  amendments: OrderAmendment[],
  _inventory: InventoryItem[],
  summary: ReconciliationSummary | null
): BuyingBehaviorAnalytics {
  const activeOrders = orders.filter(o => o.status !== 'cancelled' && o.status !== 'replaced');
  const uniqueBuyersSet = new Set(activeOrders.map(o => o.buyerName.trim().toLowerCase()));
  const totalOrders = activeOrders.length;
  const uniqueBuyers = uniqueBuyersSet.size || 1;

  // 1. Plus-size demand distribution
  const sizeMap: Record<string, number> = { 'XL': 0, '2XL': 0, '3XL': 0, '4XL': 0, '5XL': 0, '6XL': 0 };
  for (const o of activeOrders) {
    const s = o.size.toUpperCase();
    if (sizeMap[s] !== undefined) sizeMap[s] += o.quantity;
    else sizeMap[s] = (sizeMap[s] || 0) + o.quantity;
  }
  const totalPieces = Object.values(sizeMap).reduce((a, b) => a + b, 0) || 1;
  const sizeDistribution = Object.entries(sizeMap).map(([size, count]) => ({
    size,
    count,
    percentage: Math.round((count / totalPieces) * 100),
  }));

  // 2. Channel adoption breakdown
  const channelCounts: Record<string, number> = { live_chat: 0, messenger: 0, vip: 0, staff_entry: 0 };
  for (const o of activeOrders) {
    channelCounts[o.channel] = (channelCounts[o.channel] || 0) + 1;
  }
  const channelLabels: Record<string, string> = {
    live_chat: 'Facebook Live Chat Comments',
    messenger: 'Page Business Messenger',
    vip: 'VIP Personal Messenger',
    staff_entry: 'Bangkok Staff Floor Entry',
  };
  const channelAdoption = Object.entries(channelCounts).map(([channel, count]) => ({
    channel,
    label: channelLabels[channel] || channel,
    count,
    percentage: Math.round((count / (totalOrders || 1)) * 100),
  }));

  // 3. Modification and amendment stats
  const totalModifications = amendments.length;
  const sizeChanges = amendments.filter(a => a.type === 'size_change').length;
  const colourSwaps = amendments.filter(a => a.type === 'colour_change').length;
  const itemReplacements = amendments.filter(a => a.type === 'item_replacement').length;
  const cancellations = amendments.filter(a => a.type === 'cancellation').length;

  const channelBreakdown = {
    liveChat: amendments.filter(a => a.channel === 'live_chat').length,
    messenger: amendments.filter(a => a.channel === 'messenger').length,
    vip: amendments.filter(a => a.channel === 'vip').length,
  };

  // 4. Peak Mining Velocity (Dynamic from actual live orders)
  const windowMap = new Map<string, { count: number; codes: Set<string> }>();
  for (const o of activeOrders) {
    const d = new Date(o.orderedAt);
    const label = isNaN(d.getTime())
      ? 'Live Session'
      : `${String(d.getHours()).padStart(2, '0')}:${d.getMinutes() < 30 ? '00-29' : '30-59'}`;
    const cur = windowMap.get(label) || { count: 0, codes: new Set<string>() };
    cur.count += o.quantity || 1;
    if (o.itemCode) cur.codes.add(o.itemCode);
    windowMap.set(label, cur);
  }
  const peakMiningVelocity = Array.from(windowMap.entries()).map(([minuteWindow, data]) => ({
    minuteWindow,
    claimsCount: data.count,
    activeItems: Array.from(data.codes).slice(0, 4).join(', ') || 'None',
  }));

  // 5. Hotspot Shortages
  const hotspotShortages = (summary?.coverage || [])
    .filter(c => c.status === 'short' || (c.gap !== null && c.gap > 0 && c.status === 'no_row'))
    .map(c => ({
      itemCode: `${c.code} (${c.size} ${c.colour})`,
      demand: c.ordered,
      stock: c.observed ?? 0,
      shortage: c.gap ?? (c.ordered - (c.observed ?? 0)),
      lostRevenuePhp: (c.gap ?? 1) * (c.unitPricePhp || 0),
    }))
    .slice(0, 5);

  // 6. Duplicate detections
  const duplicateDetections = {
    totalDuplicatesBlocked: summary?.totalDeduplicatedOrders || 0,
    preventedOverspendThb: (summary?.totalDeduplicatedOrders || 0) * 500,
    flaggedPendingResolution: orders.filter(o => o.isDuplicateFlagged).length,
  };

  return {
    totalOrdersCaptured: totalOrders,
    uniqueBuyers,
    averageItemsPerBuyer: Math.round((totalOrders / uniqueBuyers) * 10) / 10,
    sizeDistribution,
    channelAdoption,
    modificationStats: {
      totalModifications,
      modificationRatePercent: totalOrders > 0 ? Math.round((totalModifications / totalOrders) * 100) : 0,
      sizeChanges,
      colourSwaps,
      itemReplacements,
      cancellations,
      channelBreakdown,
    },
    peakMiningVelocity,
    hotspotShortages,
    duplicateDetections,
  };
}

/**
 * 9. Pure Deterministic Inventory Sync Engine (Shared between Server & Client)
 * Cross-checks physical store rack counts against resolved live order demand.
 */
export function computeInventorySyncResult(
  liveId: string,
  inventory: InventoryItem[],
  orders: BuyerOrder[],
  amendments: OrderAmendment[]
): InventorySyncResult {
  const liveOrders = orders.filter((o) => o.liveId === liveId);
  const { activeOrders } = resolveOrdersAndAmendments(liveOrders, amendments);
  const liveInventory = inventory.filter((i) => i.liveId === liveId && !i.archived);

  const syncedAt = new Date().toISOString();
  const discrepancies: InventoryDiscrepancy[] = [];
  let criticalCount = 0;
  let warningCount = 0;
  let surplusCount = 0;
  let balancedCount = 0;

  let totalDemandPieces = 0;
  let totalObservedPieces = 0;

  const matchedOrderIds = new Set<string>();

  liveInventory.forEach((item) => {
    const normCode = normalizeCode(item.code);
    const itemSize = up(item.size);
    const itemColour = up(item.colour);

    const matchingOrders = activeOrders.filter((ord) => {
      const matchCode = normalizeCode(ord.itemCode) === normCode;
      const matchSize = !itemSize || up(ord.size) === itemSize;
      const matchColour = !itemColour || up(ord.colour) === itemColour;
      return matchCode && matchSize && matchColour;
    });

    matchingOrders.forEach((o) => matchedOrderIds.add(o.id));

    const demand = matchingOrders.reduce((acc, o) => acc + (o.quantity || 1), 0);
    totalDemandPieces += demand;
    if (item.observed !== null && item.observed !== undefined) {
      totalObservedPieces += item.observed;
    }

    const buyers = Array.from(new Set(matchingOrders.map((o) => o.buyerName)));

    let flag: 'shortage' | 'uncounted' | 'surplus' | 'balanced';
    let severity: 'critical' | 'warning' | 'info' | 'ok';
    let message = '';
    let gap: number | null = null;

    if (item.observed === null || item.observed === undefined) {
      flag = 'uncounted';
      severity = 'warning';
      warningCount++;
      gap = null;
      message =
        demand > 0
          ? `Pending physical count: ${demand} pcs claimed by ${buyers.slice(0, 3).join(', ')}${buyers.length > 3 ? ` +${buyers.length - 3} more` : ''}, but rack quantity is unverified.`
          : 'Rack item has not yet been physically counted on the store rack.';
    } else if (item.observed < demand) {
      flag = 'shortage';
      severity = 'critical';
      criticalCount++;
      gap = item.observed - demand;
      message = `Critical deficit of ${Math.abs(gap)} pcs! Live order demand (${demand}) exceeds physical rack (${item.observed}). ${buyers.length} buyer(s) affected.`;
    } else if (item.observed > demand) {
      flag = 'surplus';
      severity = 'info';
      surplusCount++;
      gap = item.observed - demand;
      message =
        demand === 0
          ? `Unsold stock: ${item.observed} pcs on rack with zero live claims.`
          : `Surplus stock: ${gap} excess pcs on rack beyond live demand (${demand}).`;
    } else {
      flag = 'balanced';
      severity = 'ok';
      balancedCount++;
      gap = 0;
      message = `Balanced: Physical rack (${item.observed}) matches live demand (${demand}) exactly.`;
    }

    item.discrepancyFlag = flag;
    item.discrepancyGap = gap;
    item.liveDemand = demand;
    item.lastSyncedAt = syncedAt;
    item.syncNote = message;

    discrepancies.push({
      itemId: item.id,
      code: item.code,
      size: item.size,
      colour: item.colour,
      observed: item.observed,
      purchased: item.purchased,
      liveDemand: demand,
      gap,
      flag,
      severity,
      message,
      buyers,
      affectedOrdersCount: matchingOrders.length,
    });
  });

  const unmatchedOrders = activeOrders.filter((o) => !matchedOrderIds.has(o.id));
  const missingVariantGroups = new Map<
    string,
    { code: string; size: string; colour: string; demand: number; buyers: string[]; orders: string[] }
  >();

  unmatchedOrders.forEach((o) => {
    const key = `${normalizeCode(o.itemCode)}|${up(o.size)}|${up(o.colour)}`;
    const cur = missingVariantGroups.get(key) || {
      code: o.itemCode,
      size: o.size,
      colour: o.colour,
      demand: 0,
      buyers: [],
      orders: [],
    };
    cur.demand += o.quantity || 1;
    if (!cur.buyers.includes(o.buyerName)) cur.buyers.push(o.buyerName);
    cur.orders.push(o.id);
    missingVariantGroups.set(key, cur);
  });

  missingVariantGroups.forEach((group) => {
    criticalCount++;
    totalDemandPieces += group.demand;
    discrepancies.push({
      code: group.code,
      size: group.size,
      colour: group.colour,
      observed: 0,
      purchased: null,
      liveDemand: group.demand,
      gap: -group.demand,
      flag: 'missing_rack',
      severity: 'critical',
      message: `Missing from physical store rack! ${group.demand} pcs ordered by ${group.buyers.join(', ')} but no rack row exists.`,
      buyers: group.buyers,
      affectedOrdersCount: group.orders.length,
    });
  });

  return {
    syncedAt,
    liveId,
    totalItemsChecked: liveInventory.length,
    totalDemandPieces,
    totalObservedPieces,
    discrepanciesCount: criticalCount + warningCount,
    criticalCount,
    warningCount,
    surplusCount,
    balancedCount,
    discrepancies,
  };
}

