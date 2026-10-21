/**
 * End-to-End & Integration Test Suite for Bangkok Plus Size OOTD
 * Uses self-contained ephemeral fixtures so production seedData remains 100% clean.
 */

import {
  resolveOrdersAndAmendments,
  runAutomaticLiveReconciliation,
  computeInventorySyncResult,
} from './reconciliationEngine';
import {
  LiveSession,
  InventoryItem,
  BuyerOrder,
  OrderAmendment,
} from '../types/reconciliation';

export function runIntegrationTestSuite(): {
  passed: number;
  failed: number;
  results: Array<{ name: string; status: 'PASS' | 'FAIL'; detail: string }>;
} {
  const results: Array<{ name: string; status: 'PASS' | 'FAIL'; detail: string }> = [];

  const assert = (name: string, condition: boolean, detail: string) => {
    results.push({ name, status: condition ? 'PASS' : 'FAIL', detail });
  };

  const live: LiveSession = {
    id: 'test_live_01',
    title: 'Integration Test Session',
    status: 'ended',
    startedAt: new Date(Date.now() - 3600000).toISOString(),
    endedAt: new Date().toISOString(),
    fbVideoId: null,
    videoUrl: '',
    storeName: 'Pratunam Test Rack',
    storeDate: new Date().toISOString().slice(0, 10),
    lineup: ['BP01', 'BP02'],
    totalComments: 3,
    totalMined: 3,
    reconciledAt: null,
    reconciliationStatus: 'unreconciled',
  };

  const inventory: InventoryItem[] = [
    {
      id: 'inv_1',
      liveId: 'test_live_01',
      code: 'BP01',
      description: 'Linen Top',
      size: '3XL',
      colour: 'MAROON',
      part: null,
      observed: 1,
      purchased: 1,
      cost: 450,
      price: 1890,
      evidence: '',
      supplierStore: 'Store A',
      supplierReceiptRef: 'R1',
      archived: false,
      requestIds: ['o1', 'o2'],
    },
    {
      id: 'inv_2',
      liveId: 'test_live_01',
      code: 'BP02',
      description: 'Stone Tunic',
      size: '3XL',
      colour: 'STONE',
      part: null,
      observed: 2,
      purchased: 2,
      cost: 500,
      price: 2190,
      evidence: '',
      supplierStore: 'Store A',
      supplierReceiptRef: 'R1',
      archived: false,
      requestIds: ['o3'],
    },
  ];

  const orders: BuyerOrder[] = [
    {
      id: 'o1',
      liveId: 'test_live_01',
      buyerName: 'Buyer One',
      channel: 'live_chat',
      itemCode: 'BP01',
      itemName: 'Linen Top',
      size: '3XL',
      colour: 'MAROON',
      quantity: 1,
      statedUnitPricePhp: 1890,
      orderedAt: new Date(Date.now() - 3000000).toISOString(),
      status: 'confirmed',
      invoiced: false,
    },
    {
      id: 'o2',
      liveId: 'test_live_01',
      buyerName: 'Buyer Two',
      channel: 'live_chat',
      itemCode: 'BP01',
      itemName: 'Linen Top',
      size: '3XL',
      colour: 'MAROON',
      quantity: 1,
      statedUnitPricePhp: 1890,
      orderedAt: new Date(Date.now() - 2000000).toISOString(),
      status: 'confirmed',
      invoiced: false,
    },
    {
      id: 'o3',
      liveId: 'test_live_01',
      buyerName: 'Buyer Three',
      channel: 'messenger',
      itemCode: 'BP02',
      itemName: 'Stone Tunic',
      size: '2XL',
      colour: 'NAVY',
      quantity: 1,
      statedUnitPricePhp: 2190,
      orderedAt: new Date(Date.now() - 1000000).toISOString(),
      status: 'confirmed',
      invoiced: false,
    },
  ];

  const amendments: OrderAmendment[] = [
    {
      id: 'a1',
      originalOrderId: 'o3',
      buyerName: 'Buyer Three',
      channel: 'messenger',
      type: 'size_change',
      requestedAt: new Date().toISOString(),
      originalSpec: { itemCode: 'BP02', size: '2XL', colour: 'NAVY', quantity: 1 },
      newSpec: { itemCode: 'BP02', size: '3XL', colour: 'STONE', quantity: 1 },
      rawText: 'Swap to 3XL Stone',
      status: 'applied',
    },
  ];

  const syncRes = computeInventorySyncResult(live.id, inventory, orders, amendments);
  assert(
    'Inventory Sync detects shortage on BP01 (2 demand vs 1 rack) and surplus on BP02 (1 demand vs 2 rack)',
    syncRes.criticalCount === 1 && syncRes.surplusCount === 1,
    `critical=${syncRes.criticalCount}, surplus=${syncRes.surplusCount}`
  );

  const summary = runAutomaticLiveReconciliation(live, orders, amendments, inventory, 1.62, null, 'automatic_live_end');
  const allBagsBilledOnlyGot = summary.buyerBags.every((b) => {
    const expectedPhp = b.lines.reduce((acc, l) => acc + l.got * l.unitPricePhp, 0);
    return b.subtotalPhp === expectedPhp;
  });
  assert(
    'Zero-Refund Invoicing Gate bills strictly for fulfilled pieces (got > 0)',
    allBagsBilledOnlyGot && summary.affectedShortageBuyers.length === 1,
    `shortedBuyers=${summary.affectedShortageBuyers.length}`
  );

  const { activeOrders, amendmentsAppliedCount } = resolveOrdersAndAmendments(orders, amendments);
  const swapped = activeOrders.find((o) => o.id === 'o3');
  assert(
    'Messenger amendment updates spec without duplicating active demand',
    amendmentsAppliedCount === 1 && swapped?.size === '3XL' && swapped?.colour === 'STONE',
    `swapped=${swapped?.size} ${swapped?.colour}`
  );

  const passed = results.filter((r) => r.status === 'PASS').length;
  const failed = results.filter((r) => r.status === 'FAIL').length;
  return { passed, failed, results };
}
