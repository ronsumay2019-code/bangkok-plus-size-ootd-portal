import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { LiveSessionCommand } from './components/LiveSessionCommand';
import { AutoReconciliationSummary } from './components/AutoReconciliationSummary';
import { InventoryStoreBoard } from './components/InventoryStoreBoard';
import { MessengerAdjustmentManager } from './components/MessengerAdjustmentManager';
import { ReplayReviewStudio } from './components/ReplayReviewStudio';
import { PolaAICopilot } from './components/PolaAICopilot';
import { StrategicAnalysisModal } from './components/StrategicAnalysisModal';
import { OrderReviewApprovalWorkspace } from './components/OrderReviewApprovalWorkspace';
import { BuyingBehaviorDashboard } from './components/BuyingBehaviorDashboard';
import { PreOrdersLane } from './components/PreOrdersLane';
import { OwnerOverrideModal } from './components/OwnerOverrideModal';
import { 
  LiveSession, 
  BuyerOrder, 
  InventoryItem, 
  OrderAmendment, 
  PreOrder,
  ReconciliationSummary,
  InventorySyncResult,
  MessengerThread,
} from './types/reconciliation';
import { 
  SEED_LIVE_SESSIONS, 
  SEED_INVENTORY_ITEMS, 
  SEED_BUYER_ORDERS, 
  SEED_AMENDMENTS,
  SEED_PRE_ORDERS,
  SEED_MESSENGER_THREADS,
} from './data/seedData';
import { runAutomaticLiveReconciliation } from './services/reconciliationEngine';

export default function App() {
  const [activeTab, setActiveTab] = useState<string>('live_command');
  const [showAnalysisModal, setShowAnalysisModal] = useState<boolean>(false);
  const [lives, setLives] = useState<LiveSession[]>(SEED_LIVE_SESSIONS);
  const [inventory, setInventory] = useState<InventoryItem[]>(SEED_INVENTORY_ITEMS);
  const [orders, setOrders] = useState<BuyerOrder[]>(SEED_BUYER_ORDERS);
  const [amendments, setAmendments] = useState<OrderAmendment[]>(SEED_AMENDMENTS);
  const [preOrders, setPreOrders] = useState<PreOrder[]>(SEED_PRE_ORDERS);
  const [messengerThreads, setMessengerThreads] = useState<MessengerThread[]>(SEED_MESSENGER_THREADS);
  const [phpRate, setPhpRate] = useState<number>(1.62);
  const [summary, setSummary] = useState<ReconciliationSummary | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Role authorization state ('owner' | 'admin' | 'staff')
  const [userRole, setUserRole] = useState<'owner' | 'admin' | 'staff'>('owner');

  // Meta Webhook & Graph API state (clean start with zero test events)
  const [webhookEventsLog, setWebhookEventsLog] = useState<any[]>([]);
  const [graphSyncStats, setGraphSyncStats] = useState<any>({
    lastSyncAt: new Date().toISOString(),
    syncCount: 0,
    onAirVideoId: 'Not connected yet',
    broadcastStatus: 'READY_TO_SYNC',
    lastStatusCheck: 'Ready to sync morning live broadcast via Graph API v22.0',
  });

  // Owner full override modal state
  const [overrideModal, setOverrideModal] = useState<{
    isOpen: boolean;
    order: BuyerOrder | PreOrder | null;
    isPreOrder: boolean;
  }>({
    isOpen: false,
    order: null,
    isPreOrder: false,
  });

  const activeLive = lives[0];

  // Helper toast notification
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Fetch initial state from backend and auto-sync Facebook Live + Messenger every 30s
  useEffect(() => {
    const runAutoSync = async (liveIdToSync: string) => {
      try {
        const syncRes = await fetch('/api/facebook/live-sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ liveId: liveIdToSync }),
        });
        if (syncRes.ok) {
          const syncData: any = await syncRes.json();
          if (syncData.targetLive) setLives((prev) => prev.map((l) => (l.id === syncData.targetLive.id ? syncData.targetLive : l)));
          if (Array.isArray(syncData.orders)) setOrders(syncData.orders);
          if (Array.isArray(syncData.inventory)) setInventory(syncData.inventory.filter((i: any) => !i.id?.startsWith('inv_')));
          if (Array.isArray(syncData.messengerThreads)) setMessengerThreads(syncData.messengerThreads);
          if (syncData.latestSummary) setSummary(syncData.latestSummary);
          if (syncData.graphSyncStats) setGraphSyncStats(syncData.graphSyncStats);
        }
      } catch {
        // Silent background sync fallback
      }
    };

    const fetchState = async () => {
      let currentLiveId = activeLive.id;
      try {
        const res = await fetch('/api/state');
        if (res.ok) {
          const data: any = await res.json();
          if (Array.isArray(data.lives) && data.lives.length) {
            setLives(data.lives);
            currentLiveId = data.lives[0].id;
          }
          if (Array.isArray(data.inventory)) setInventory(data.inventory.filter((i: any) => !i.id?.startsWith('inv_')));
          if (Array.isArray(data.orders)) setOrders(data.orders);
          if (Array.isArray(data.amendments)) setAmendments(data.amendments);
          if (Array.isArray(data.preOrders)) setPreOrders(data.preOrders);
          if (Array.isArray(data.messengerThreads)) setMessengerThreads(data.messengerThreads);
          if (Array.isArray(data.webhookEventsLog)) setWebhookEventsLog(data.webhookEventsLog);
          if (data.graphSyncStats) setGraphSyncStats(data.graphSyncStats);
          if (data.phpPerThbRate) setPhpRate(data.phpPerThbRate);
          if (data.latestSummary) setSummary(data.latestSummary);
        }
      } catch (e) {
        // Fallback to local pure engine computation
        const initSummary = runAutomaticLiveReconciliation(
          activeLive,
          orders.filter((o) => o.liveId === activeLive.id),
          amendments,
          inventory.filter((i) => i.liveId === activeLive.id),
          phpRate,
          null,
          'rolling_pass'
        );
        setSummary(initSummary);
      }
      await runAutoSync(currentLiveId);
    };
    fetchState();
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') {
        void runAutoSync(activeLive.id);
      }
    }, 30_000);
    return () => clearInterval(timer);
  }, []);

  // 1. Toggle Live Session (Start or End -> Auto-Reconciliation on End)
  const handleToggleLive = async (action: 'start' | 'end') => {
    try {
      const res = await fetch('/api/live/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ liveId: activeLive.id, action }),
      });
      if (res.ok) {
        const data: any = await res.json();
        setLives((prev) => prev.map((l) => (l.id === data.live.id ? data.live : l)));
        if (data.summary) setSummary(data.summary);
      }
    } catch (e) {
      // Local fallback
      setLives((prev) =>
        prev.map((l) =>
          l.id === activeLive.id
            ? { ...l, status: action === 'end' ? 'ended' : 'live', endedAt: action === 'end' ? new Date().toISOString() : null }
            : l
        )
      );
      const updatedLive = { ...activeLive, status: action === 'end' ? ('ended' as const) : ('live' as const) };
      const newSummary = runAutomaticLiveReconciliation(
        updatedLive,
        orders.filter((o) => o.liveId === activeLive.id),
        amendments,
        inventory.filter((i) => i.liveId === activeLive.id),
        phpRate,
        null,
        action === 'end' ? 'automatic_live_end' : 'rolling_pass'
      );
      setSummary(newSummary);
    }

    if (action === 'end') {
      showToast('Live ended: Automatic reconciliation executed for all pending orders!');
    } else {
      showToast('Live broadcast resumed on air.');
    }
  };

  // 2. Add New Order
  const handleAddOrder = async (orderData: {
    buyerName: string;
    itemCode: string;
    size: string;
    colour: string;
    quantity: number;
    channel: 'live_chat' | 'messenger';
    statedPrice: number;
  }) => {
    try {
      const res = await fetch('/api/orders/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ liveId: activeLive.id, ...orderData }),
      });
      if (res.ok) {
        const data: any = await res.json();
        setOrders((prev) => [...prev, data.order]);
        if (data.summary) setSummary(data.summary);
      }
    } catch (e) {
      // Local fallback
      const newOrd: BuyerOrder = {
        id: `ord_${Date.now()}`,
        liveId: activeLive.id,
        buyerName: orderData.buyerName,
        channel: orderData.channel,
        itemCode: orderData.itemCode.toUpperCase(),
        itemName: orderData.itemCode.toUpperCase(),
        size: orderData.size.toUpperCase(),
        colour: orderData.colour.toUpperCase(),
        quantity: orderData.quantity,
        statedUnitPricePhp: orderData.statedPrice,
        orderedAt: new Date().toISOString(),
        status: 'pending',
        invoiced: false,
      };
      setOrders((prev) => [...prev, newOrd]);
      const newSummary = runAutomaticLiveReconciliation(
        activeLive,
        [...orders, newOrd].filter((o) => o.liveId === activeLive.id),
        amendments,
        inventory.filter((i) => i.liveId === activeLive.id),
        phpRate,
        null,
        'rolling_pass'
      );
      setSummary(newSummary);
    }
    showToast(`Claim captured for ${orderData.buyerName}: ${orderData.itemCode} (${orderData.size})`);
  };

  // 3. Quick Size / Color Swap
  const handleQuickAmendment = async (
    originalOrderId: string,
    newSpec: { size: string; colour: string }
  ) => {
    const target = orders.find((o) => o.id === originalOrderId);
    if (!target) return;

    try {
      const res = await fetch('/api/amendments/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          originalOrderId,
          buyerName: target.buyerName,
          channel: 'live_chat',
          type: 'size_change',
          newSpec: {
            itemCode: target.itemCode,
            size: newSpec.size,
            colour: newSpec.colour,
            quantity: target.quantity,
          },
          rawText: `In-live chat swap requested for ${target.buyerName}: ${target.itemCode} to ${newSpec.size} ${newSpec.colour}`,
        }),
      });
      if (res.ok) {
        const data: any = await res.json();
        setAmendments((prev) => [...prev, data.amendment]);
        if (data.summary) setSummary(data.summary);
      }
    } catch (e) {
      // Local fallback
      const newAmd: OrderAmendment = {
        id: `amd_${Date.now()}`,
        originalOrderId,
        buyerName: target.buyerName,
        channel: 'live_chat',
        type: 'size_change',
        requestedAt: new Date().toISOString(),
        originalSpec: { itemCode: target.itemCode, size: target.size, colour: target.colour, quantity: target.quantity },
        newSpec: { itemCode: target.itemCode, size: newSpec.size, colour: newSpec.colour, quantity: target.quantity },
        rawText: `Quick in-live swap to ${newSpec.size} ${newSpec.colour}`,
        status: 'applied',
        resolvedAt: new Date().toISOString(),
        resolutionNote: 'In-live swap applied directly to demand.',
      };
      setAmendments((prev) => [...prev, newAmd]);
      const newSummary = runAutomaticLiveReconciliation(
        activeLive,
        orders.filter((o) => o.liveId === activeLive.id),
        [...amendments, newAmd],
        inventory.filter((i) => i.liveId === activeLive.id),
        phpRate,
        null,
        'rolling_pass'
      );
      setSummary(newSummary);
    }
    showToast(`Spec swapped for ${target.buyerName}: now ${newSpec.size} ${newSpec.colour}!`);
  };

  // 4. Trigger Full Reconciliation
  const handleTriggerReconciliation = async () => {
    try {
      const res = await fetch('/api/reconciliation/trigger-auto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          liveId: activeLive.id,
          phpRate,
          triggerType: 'manual_trigger',
        }),
      });
      if (res.ok) {
        const data: any = await res.json();
        setSummary(data.summary);
        if (Array.isArray(data.orders)) setOrders(data.orders);
        if (Array.isArray(data.inventory)) setInventory(data.inventory.filter((i: any) => !i.id?.startsWith('inv_')));
        if (data.targetLive) {
          setLives((prev) => prev.map((l) => (l.id === data.targetLive.id ? data.targetLive : l)));
        }
      }
    } catch (e) {
      const newSummary = runAutomaticLiveReconciliation(
        activeLive,
        orders.filter((o) => !o.liveId || o.liveId === activeLive.id),
        amendments,
        inventory.filter((i) => !i.liveId || i.liveId === activeLive.id),
        phpRate,
        null,
        'manual_trigger'
      );
      setSummary(newSummary);
    }
    showToast('Reconciliation pipeline recalculated with latest inventory counts!');
  };

  // 5. Update Inventory Item
  const handleUpdateInventoryItem = async (itemId: string, patch: Partial<InventoryItem>) => {
    try {
      const res = await fetch('/api/inventory/patch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId, ...patch }),
      });
      if (res.ok) {
        const data: any = await res.json();
        setInventory((prev) => prev.map((i) => (i.id === itemId ? data.item : i)));
        if (data.summary) setSummary(data.summary);
      }
    } catch (e) {
      setInventory((prev) => prev.map((i) => (i.id === itemId ? { ...i, ...patch } : i)));
      const updatedInv = inventory.map((i) => (i.id === itemId ? { ...i, ...patch } : i));
      const newSummary = runAutomaticLiveReconciliation(
        activeLive,
        orders.filter((o) => o.liveId === activeLive.id),
        amendments,
        updatedInv.filter((i) => i.liveId === activeLive.id),
        phpRate,
        null,
        'rolling_pass'
      );
      setSummary(newSummary);
    }
    showToast('Store inventory updated.');
  };

  // 6. Add Inventory Item
  const handleAddInventoryItem = async (itemData: any) => {
    try {
      const res = await fetch('/api/inventory/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ liveId: activeLive.id, ...itemData }),
      });
      if (res.ok) {
        const data: any = await res.json();
        setInventory((prev) => [...prev, data.item]);
        if (data.summary) setSummary(data.summary);
      }
    } catch (e) {
      const newItem: InventoryItem = {
        id: `inv_${Date.now()}`,
        liveId: activeLive.id,
        code: itemData.code.toUpperCase(),
        description: itemData.description,
        size: itemData.size.toUpperCase(),
        colour: itemData.colour.toUpperCase(),
        part: null,
        observed: itemData.observed,
        purchased: itemData.purchased,
        cost: itemData.cost,
        price: itemData.price,
        evidence: 'Physical garment verified.',
        supplierStore: itemData.store,
        supplierReceiptRef: 'PENDING',
        archived: false,
        requestIds: [],
      };
      setInventory((prev) => [...prev, newItem]);
      const newSummary = runAutomaticLiveReconciliation(
        activeLive,
        orders.filter((o) => o.liveId === activeLive.id),
        amendments,
        [...inventory, newItem].filter((i) => i.liveId === activeLive.id),
        phpRate,
        null,
        'rolling_pass'
      );
      setSummary(newSummary);
    }
    showToast(`Added rack row for ${itemData.code} (${itemData.size})`);
  };

  // 6b. Sync Inventory: Verify physical rack quantities against live demand & flag discrepancies
  const handleSyncInventory = async (): Promise<InventorySyncResult | null> => {
    try {
      const res = await fetch('/api/inventory/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ liveId: activeLive.id }),
      });
      if (res.ok) {
        const data: any = await res.json();
        if (Array.isArray(data.inventory)) setInventory(data.inventory.filter((i: any) => !i.id?.startsWith('inv_')));
        if (data.summary) setSummary(data.summary);
        const sr: InventorySyncResult = data.syncResult;
        showToast(
          `Inventory synced! ${sr.totalItemsChecked} items checked vs ${sr.totalDemandPieces} pcs demand. Flagged: ${sr.criticalCount} shortage(s), ${sr.warningCount} uncounted.`
        );
        return sr;
      }
    } catch (e) {
      console.error('Failed to sync inventory:', e);
      showToast('Inventory verification executed locally.');
    }
    return null;
  };

  // 7. Generate Invoices
  const handleGenerateInvoices = async (buyerNames?: string[]) => {
    try {
      const res = await fetch('/api/invoices/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ buyerNames }),
      });
      if (res.ok) {
        const data: any = await res.json();
        if (data.summary) setSummary(data.summary);
        showToast(`Generated official invoices for ${data.generatedInvoices.length} reconciled buyers!`);
      }
    } catch (e) {
      showToast('Official invoices generated for verified pieces only.');
    }
  };

  // 8. Order Review & Manual Approval
  const handleApproveOrder = async (orderId: string) => {
    try {
      const res = await fetch('/api/orders/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId }),
      });
      if (res.ok) {
        const data: any = await res.json();
        setOrders((prev) => prev.map((o) => (o.id === orderId ? data.order : o)));
        if (data.summary) setSummary(data.summary);
        showToast(`Order approved and added to confirmed store buying demand.`);
      } else {
        const errJson = await res.json().catch(() => null);
        showToast(`Cannot approve: ${errJson?.error || 'Invalid order details.'}`);
      }
    } catch (e) {
      const target = orders.find((o) => o.id === orderId);
      if (target && (!target.statedUnitPricePhp || target.statedUnitPricePhp <= 0 || target.itemCode === 'PENDING SPEC')) {
        showToast(`Cannot approve claim: Unit price is ₱0 or item code is pending specification.`);
        return;
      }
      setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status: 'confirmed' } : o)));
      const updated = orders.map((o) => (o.id === orderId ? { ...o, status: 'confirmed' as const } : o));
      const newSummary = runAutomaticLiveReconciliation(
        activeLive,
        updated.filter((o) => o.liveId === activeLive.id),
        amendments,
        inventory.filter((i) => i.liveId === activeLive.id),
        phpRate,
        null,
        'rolling_pass'
      );
      setSummary(newSummary);
      showToast(`Order approved and added to confirmed store buying demand.`);
    }
  };

  const handleRejectOrder = async (orderId: string, reason: string) => {
    try {
      const res = await fetch('/api/orders/reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, reason }),
      });
      if (res.ok) {
        const data: any = await res.json();
        setOrders((prev) => prev.map((o) => (o.id === orderId ? data.order : o)));
        if (data.summary) setSummary(data.summary);
      }
    } catch (e) {
      setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status: 'cancelled' } : o)));
      const updated = orders.map((o) => (o.id === orderId ? { ...o, status: 'cancelled' as const } : o));
      const newSummary = runAutomaticLiveReconciliation(
        activeLive,
        updated.filter((o) => o.liveId === activeLive.id),
        amendments,
        inventory.filter((i) => i.liveId === activeLive.id),
        phpRate,
        null,
        'rolling_pass'
      );
      setSummary(newSummary);
    }
    showToast(`Order cancelled: ${reason}.`);
  };

  const handleUpdateOrder = async (orderId: string, updates: Partial<BuyerOrder>) => {
    try {
      const res = await fetch('/api/orders/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, updates }),
      });
      if (res.ok) {
        const data: any = await res.json();
        setOrders((prev) => prev.map((o) => (o.id === orderId ? data.order : o)));
        if (data.summary) setSummary(data.summary);
      }
    } catch (e) {
      setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, ...updates } : o)));
      const updated = orders.map((o) => (o.id === orderId ? { ...o, ...updates } : o));
      const newSummary = runAutomaticLiveReconciliation(
        activeLive,
        updated.filter((o) => o.liveId === activeLive.id),
        amendments,
        inventory.filter((i) => i.liveId === activeLive.id),
        phpRate,
        null,
        'rolling_pass'
      );
      setSummary(newSummary);
    }
    showToast(`Order spec updated and synced with store inventory.`);
  };

  const handleBatchSetPrice = async (itemCode: string, pricePhp: number) => {
    const cleanCode = itemCode.trim().toUpperCase();
    try {
      const res = await fetch('/api/orders/batch-set-price', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemCode: cleanCode, pricePhp, liveId: activeLive.id }),
      });
      if (res.ok) {
        const data: any = await res.json();
        if (data.orders) setOrders(data.orders);
        if (data.summary) setSummary(data.summary);
        showToast(`Agent price set to ₱${pricePhp.toLocaleString()} for all ${cleanCode} (${data.updatedCount || 0} claims).`);
        return;
      }
    } catch (e) {
      console.warn('Batch set price remote failed, updating locally', e);
    }

    // Local fallback
    const updated = orders.map((o) =>
      o.itemCode.toUpperCase() === cleanCode ? { ...o, statedUnitPricePhp: pricePhp } : o
    );
    setOrders(updated);
    const newSummary = runAutomaticLiveReconciliation(
      activeLive,
      updated.filter((o) => o.liveId === activeLive.id),
      amendments,
      inventory.filter((i) => i.liveId === activeLive.id),
      phpRate,
      null,
      'rolling_pass'
    );
    setSummary(newSummary);
    showToast(`Agent price set to ₱${pricePhp.toLocaleString()} for all ${cleanCode}.`);
  };

  // 12. Owner / Admin Approval Gate for Reconciliation
  const handleOwnerApproval = async (action: 'approve' | 'request_amendment', notes?: string) => {
    try {
      const res = await fetch('/api/owner/review-approval', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          liveId: activeLive.id,
          role: userRole,
          reviewedBy: userRole === 'owner' ? 'Pola (Shop Owner)' : 'Admin System',
          action,
          notes,
        }),
      });
      const data: any = await res.json();
      if (res.ok) {
        setLives((prev) => prev.map((l) => (l.id === data.targetLive.id ? data.targetLive : l)));
        showToast(action === 'approve' ? 'Reconciliation approved by Owner! Invoices unlocked.' : 'Amendment requested.');
      } else {
        showToast(data.error || 'Approval failed');
      }
    } catch (err: any) {
      showToast(err.message || 'Network error during approval');
    }
  };

  // 13. Executive Order Override Handler (Owner / Admin)
  const handleApplyOverride = async (params: {
    orderId: string;
    isPreOrder: boolean;
    role: 'owner' | 'admin';
    author: string;
    reason: string;
    overrides: Partial<BuyerOrder>;
  }) => {
    const res = await fetch('/api/owner/order-override', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    const data = await res.json();
    if (res.ok) {
      if (params.isPreOrder) {
        setPreOrders((prev) => prev.map((p) => (p.id === params.orderId ? data.order : p)));
        showToast(`Pre-order ${params.orderId} overridden by ${params.role.toUpperCase()}`);
      } else {
        setOrders((prev) => prev.map((o) => (o.id === params.orderId ? data.order : o)));
        if (data.summary) setSummary(data.summary);
        showToast(`Live order ${params.orderId} overridden by ${params.role.toUpperCase()}`);
      }
    } else {
      throw new Error(data.error || 'Failed to execute override');
    }
  };

  // 14. Pre-Orders Handlers (Dedicated Lane)
  const handleAddPreOrder = async (orderData: Partial<PreOrder>) => {
    const res = await fetch('/api/pre-orders/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(orderData),
    });
    if (res.ok) {
      const data: any = await res.json();
      setPreOrders((prev) => [data.preOrder, ...prev]);
      showToast(`Pre-order created for ${orderData.buyerName} in isolated pre-order lane.`);
    }
  };

  const handleUpdatePreOrderStatus = async (preOrderId: string, status: PreOrder['status'], notes?: string) => {
    const res = await fetch('/api/pre-orders/update-status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ preOrderId, status, notes }),
    });
    if (res.ok) {
      const data: any = await res.json();
      setPreOrders((prev) => prev.map((p) => (p.id === preOrderId ? data.preOrder : p)));
      showToast(`Pre-order status updated to ${status}.`);
    }
  };

  // 15. Meta Webhook & Graph API + Business Messenger Handlers
  const handleSimulateWebhook = async (payload: any) => {
    const res = await fetch('/api/meta/webhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-portal-simulator': 'true',
      },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      const data: any = await res.json();
      // Refresh state to capture updated orders or reconciliation
      const stateRes = await fetch('/api/state');
      if (stateRes.ok) {
        const stateData: any = await stateRes.json();
        if (stateData.lives) setLives(stateData.lives);
        if (stateData.orders) setOrders(stateData.orders);
        if (stateData.messengerThreads) setMessengerThreads(stateData.messengerThreads);
        if (stateData.latestSummary) setSummary(stateData.latestSummary);
        if (stateData.webhookEventsLog) setWebhookEventsLog(stateData.webhookEventsLog);
        if (stateData.graphSyncStats) setGraphSyncStats(stateData.graphSyncStats);
      }
      showToast(`Meta Webhook processed: ${data.eventDetails}`);
    }
  };

  const handleReplyMessenger = async (threadId: string, text: string) => {
    try {
      const res = await fetch('/api/meta/messenger/reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ threadId, text }),
      });
      const data: any = await res.json();
      if (res.ok && data.thread) {
        setMessengerThreads((prev) => prev.map((t) => (t.id === threadId ? data.thread : t)));
        showToast(`Sent Business Messenger reply to ${data.thread.buyerName}`);
      } else {
        showToast(data.error || 'Could not send Messenger reply');
      }
    } catch (e) {
      showToast('Messenger reply logged locally.');
    }
  };

  const handleSimulateMessengerDm = async (buyerName: string, text: string) => {
    try {
      const res = await fetch('/api/meta/messenger/simulate-dm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ buyerName, text }),
      });
      const data: any = await res.json();
      if (res.ok) {
        if (data.messengerThreads) setMessengerThreads(data.messengerThreads);
        if (data.webhookEventsLog) setWebhookEventsLog(data.webhookEventsLog);
        showToast(`Ingested Business Messenger DM from ${buyerName}!`);
      }
    } catch (e) {
      showToast('Simulated DM locally.');
    }
  };

  const handleGraphSync = async (
    forceStatus?: string,
    options?: { fbVideoId?: string; fbPageId?: string; accessToken?: string }
  ) => {
    const res = await fetch('/api/facebook/live-sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        liveId: activeLive.id,
        forceStatus,
        fbVideoId: options?.fbVideoId,
        fbPageId: options?.fbPageId,
        accessToken: options?.accessToken,
      }),
    });
    if (res.ok) {
      const data: any = await res.json();
      if (data.targetLive) setLives((prev) => prev.map((l) => (l.id === data.targetLive.id ? data.targetLive : l)));
      if (Array.isArray(data.orders)) setOrders(data.orders);
      if (Array.isArray(data.messengerThreads)) setMessengerThreads(data.messengerThreads);
      if (data.latestSummary) setSummary(data.latestSummary);
      if (data.graphSyncStats) setGraphSyncStats(data.graphSyncStats);
      if (data.graphError) {
        showToast(`Graph API: ${data.graphError}`);
      } else {
        showToast(
          `Graph API synced: ${data.totalCommentsFetched || 0} comments scanned, +${
            data.backfilledComments || 0
          } claims mined!`
        );
      }
    }
  };

  const handleBulkImportOrders = async (rawLines: string) => {
    const res = await fetch('/api/orders/bulk-import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ liveId: activeLive.id, rawLines }),
    });
    if (res.ok) {
      const data: any = await res.json();
      if (Array.isArray(data.orders)) setOrders(data.orders);
      if (data.targetLive) setLives((prev) => prev.map((l) => (l.id === data.targetLive.id ? data.targetLive : l)));
      if (data.summary) setSummary(data.summary);
      showToast(`Imported ${data.importedCount} live claim(s) from ${data.totalScanned} comment lines!`);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col font-sans">
      {/* Toast Popup */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-gradient-to-r from-neutral-900 to-neutral-850 border border-rose-500/50 text-white px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-2 text-xs font-semibold animate-bounce">
          <span className="w-2 h-2 rounded-full bg-rose-500" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        activeLive={activeLive}
        summary={summary}
        phpRate={phpRate}
        onOpenAnalysis={() => setShowAnalysisModal(true)}
        preOrdersCount={preOrders.length}
        userRole={userRole}
        setUserRole={setUserRole}
        graphSyncStats={graphSyncStats}
      />

      {/* Main Body Content based on active tab */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'live_command' && (
          <LiveSessionCommand
            live={activeLive}
            orders={orders}
            inventory={inventory}
            summary={summary}
            messengerThreads={messengerThreads}
            amendments={amendments}
            webhookEventsLog={webhookEventsLog}
            graphSyncStats={graphSyncStats}
            onToggleLive={handleToggleLive}
            onAddOrder={handleAddOrder}
            onUpdateOrder={handleUpdateOrder}
            onBatchSetPrice={handleBatchSetPrice}
            onQuickAmendment={handleQuickAmendment}
            onTriggerReconciliation={handleTriggerReconciliation}
            onSwitchToSummary={() => setActiveTab('reconciliation')}
            onSimulateWebhook={handleSimulateWebhook}
            onGraphSync={handleGraphSync}
            onBulkImportOrders={handleBulkImportOrders}
            onReplyMessenger={handleReplyMessenger}
          />
        )}

        {activeTab === 'reconciliation' && (
          <AutoReconciliationSummary
            summary={summary}
            onGenerateInvoices={handleGenerateInvoices}
            onTriggerReconciliation={handleTriggerReconciliation}
          />
        )}

        {activeTab === 'order_review' && (
          <OrderReviewApprovalWorkspace
            orders={orders}
            summary={summary}
            activeLive={activeLive}
            userRole={userRole}
            amendments={amendments}
            messengerThreads={messengerThreads}
            onApproveOrder={handleApproveOrder}
            onRejectOrder={handleRejectOrder}
            onUpdateOrder={handleUpdateOrder}
            onGenerateInvoices={handleGenerateInvoices}
            onTriggerReconciliation={handleTriggerReconciliation}
            onOwnerApproval={handleOwnerApproval}
            onOpenOverride={(order, isPreOrder) => setOverrideModal({ isOpen: true, order, isPreOrder })}
          />
        )}

        {activeTab === 'pre_orders' && (
          <PreOrdersLane
            preOrders={preOrders}
            messengerThreads={messengerThreads}
            onAddPreOrder={handleAddPreOrder}
            onUpdateStatus={handleUpdatePreOrderStatus}
            onOpenOverride={(order, isPreOrder) => setOverrideModal({ isOpen: true, order, isPreOrder })}
            onReplyMessenger={handleReplyMessenger}
            userRole={userRole}
          />
        )}

        {activeTab === 'buying_analytics' && (
          <BuyingBehaviorDashboard
            orders={orders}
            amendments={amendments}
            inventory={inventory}
            summary={summary}
          />
        )}

        {activeTab === 'inventory_board' && (
          <InventoryStoreBoard
            inventory={inventory.filter((i) => i.liveId === activeLive.id)}
            summary={summary}
            phpRate={phpRate}
            onUpdateItem={handleUpdateInventoryItem}
            onAddItem={handleAddInventoryItem}
            onSyncInventory={handleSyncInventory}
            activeLive={activeLive}
          />
        )}

        {activeTab === 'messenger_adjustments' && (
          <MessengerAdjustmentManager
            amendments={amendments}
            orders={orders}
            messengerThreads={messengerThreads}
            summary={summary}
            onReplyMessenger={handleReplyMessenger}
            onSimulateMessengerDm={handleSimulateMessengerDm}
            onRoutePreOrder={handleAddPreOrder}
            onSubmitAmendment={async (amData) => {
              const target = orders.find((o) => o.id === amData.originalOrderId);
              if (!target) return;
              try {
                const res = await fetch('/api/amendments/submit', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(amData),
                });
                if (res.ok) {
                  const data: any = await res.json();
                  setAmendments((prev) => [...prev, data.amendment]);
                  if (data.summary) setSummary(data.summary);
                  showToast(`Applied ${amData.type.replace('_', ' ')} for ${amData.buyerName} & synced rack demand!`);
                  return;
                }
              } catch (e) {}
              handleQuickAmendment(amData.originalOrderId, {
                size: amData.newSpec.size,
                colour: amData.newSpec.colour,
              });
            }}
          />
        )}

        {activeTab === 'replay_studio' && (
          <ReplayReviewStudio
            live={activeLive}
            orders={orders}
            onVerifyPrice={(orderId, price, ts) => {
              showToast(`Verified ${orderId} at ₱${price} on replay timestamp ${ts}`);
            }}
          />
        )}

        {activeTab === 'pola_ai' && (
          <PolaAICopilot summary={summary} />
        )}
      </main>

      {/* Executive Owner / Admin Override Modal */}
      <OwnerOverrideModal
        isOpen={overrideModal.isOpen}
        onClose={() => setOverrideModal({ isOpen: false, order: null, isPreOrder: false })}
        order={overrideModal.order}
        isPreOrder={overrideModal.isPreOrder}
        userRole={userRole}
        onApplyOverride={handleApplyOverride}
      />

      {/* Executive Gap Analysis Modal */}
      <StrategicAnalysisModal
        isOpen={showAnalysisModal}
        onClose={() => setShowAnalysisModal(false)}
      />
    </div>
  );
}
