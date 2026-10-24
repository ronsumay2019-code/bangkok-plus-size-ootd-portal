import React, { useState } from 'react';
import { 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  Clock, 
  Search, 
  Filter, 
  Check, 
  X, 
  Edit2, 
  ShieldCheck, 
  FileCheck, 
  User, 
  Tag, 
  ExternalLink,
  Copy,
  Sparkles,
  ShieldAlert,
  Lock,
  ArrowRight,
  MessageSquare,
  Video,
  ArrowRightLeft,
  Plus,
  ShoppingBag,
} from 'lucide-react';
import { 
  BuyerOrder, 
  ReconciliationSummary, 
  LiveSession,
  OrderAmendment,
  MessengerThread,
} from '../types/reconciliation';

interface OrderReviewApprovalWorkspaceProps {
  orders: BuyerOrder[];
  summary: ReconciliationSummary | null;
  activeLive: LiveSession;
  userRole: 'owner' | 'admin' | 'staff';
  amendments?: OrderAmendment[];
  messengerThreads?: MessengerThread[];
  onApproveOrder: (orderId: string) => void;
  onApproveBatchOrders?: (orderIds: string[]) => void;
  onRejectOrder: (orderId: string, reason: string) => void;
  onUpdateOrder: (orderId: string, updates: Partial<BuyerOrder>) => void;
  onGenerateInvoices: (buyerNames?: string[]) => void;
  onTriggerReconciliation: () => void;
  onOwnerApproval: (action: 'approve' | 'request_amendment', notes?: string) => Promise<void>;
  onOpenOverride: (order: BuyerOrder, isPreOrder: boolean) => void;
  onAddOrder?: (order: {
    buyerName: string;
    itemCode: string;
    size: string;
    colour: string;
    quantity: number;
    channel: 'live_chat' | 'messenger';
    statedPrice: number;
  }) => void;
}

export const OrderReviewApprovalWorkspace: React.FC<OrderReviewApprovalWorkspaceProps> = ({
  orders = [],
  summary,
  activeLive,
  userRole = 'owner',
  amendments = [],
  messengerThreads = [],
  onApproveOrder,
  onApproveBatchOrders,
  onRejectOrder,
  onUpdateOrder,
  onGenerateInvoices,
  onTriggerReconciliation,
  onOwnerApproval,
  onOpenOverride,
  onAddOrder,
}) => {
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'confirmed' | 'short' | 'duplicates'>('pending');
  const [searchQuery, setSearchQuery] = useState('');
  const [editingOrder, setEditingOrder] = useState<BuyerOrder | null>(null);
  const [rejectModalOrder, setRejectModalOrder] = useState<BuyerOrder | null>(null);
  const [rejectReason, setRejectReason] = useState('Out of stock at supplier');
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set());
  const [approvalNotes, setApprovalNotes] = useState('');
  const [selectedMessengerSnapshot, setSelectedMessengerSnapshot] = useState<MessengerThread | null>(null);
  const [isApproving, setIsApproving] = useState(false);

  // Add Manual Order Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [newBuyerName, setNewBuyerName] = useState('');
  const [newItemCode, setNewItemCode] = useState('');
  const [newSize, setNewSize] = useState('FREE SIZE (PLUS)');
  const [newColour, setNewColour] = useState('ASSORTED');
  const [newQty, setNewQty] = useState('1');
  const [newPrice, setNewPrice] = useState('550');
  const [newChannel, setNewChannel] = useState<'live_chat' | 'messenger'>('live_chat');
  const [isAddingOrder, setIsAddingOrder] = useState(false);

  // Edit form state
  const [editItemCode, setEditItemCode] = useState('');
  const [editSize, setEditSize] = useState('');
  const [editColour, setEditColour] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [editNotes, setEditNotes] = useState('');

  const KNOWN_BANGKOK_PRICES: Record<string, number> = {
    'RUSTANS': 550,
    'LU PANTS': 490,
    'LINEN PANTS': 490,
    'LONG DRESS': 650,
    'FLOWY DRESS': 590,
    'SEXY BLACK': 550,
    'HALF SET': 590,
    'ELEGANT SET': 650,
    'GIG 5': 550,
    'TALI TIE DYE': 450,
    'SKORT': 450,
  };

  const safeOrders = orders || [];
  const pendingOrders = safeOrders.filter((o) => o?.status === 'pending');
  const confirmedOrders = safeOrders.filter((o) => o?.status === 'confirmed' || o?.status === 'invoiced');
  const shortOrders = safeOrders.filter((o) => o?.status === 'short');
  const duplicateOrders = safeOrders.filter((o) => o?.isDuplicateFlagged);

  const filteredOrders = safeOrders.filter((o) => {
    if (!o) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      return Boolean(
        (o.buyerName && o.buyerName.toLowerCase().includes(q)) ||
        (o.itemCode && o.itemCode.toLowerCase().includes(q)) ||
        (o.size && o.size.toLowerCase().includes(q)) ||
        (o.colour && o.colour.toLowerCase().includes(q))
      );
    }
    if (filterStatus === 'pending') return o.status === 'pending';
    if (filterStatus === 'confirmed') return o.status === 'confirmed' || o.status === 'invoiced';
    if (filterStatus === 'short') return o.status === 'short';
    if (filterStatus === 'duplicates') return o.isDuplicateFlagged;
    return true;
  });

  const handleOpenEdit = (ord: BuyerOrder) => {
    setEditingOrder(ord);
    setEditItemCode(ord.itemCode === 'PENDING SPEC' ? '' : ord.itemCode);
    setEditSize(ord.size || 'FREE SIZE (PLUS)');
    setEditColour(ord.colour || 'ASSORTED');
    setEditPrice(ord.statedUnitPricePhp ? String(ord.statedUnitPricePhp) : '');
    setEditNotes(ord.reviewNotes || '');
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingOrder) return;

    const finalItemCode = (editItemCode.trim() || 'PENDING SPEC').toUpperCase();
    const finalPrice = editPrice !== '' ? Number(editPrice) : 0;

    onUpdateOrder(editingOrder.id, {
      itemCode: finalItemCode,
      size: editSize.toUpperCase(),
      colour: editColour.toUpperCase(),
      statedUnitPricePhp: finalPrice,
      reviewNotes: editNotes,
      reviewedBy: 'Owner / Admin',
      reviewedAt: new Date().toISOString(),
    });

    setEditingOrder(null);
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onAddOrder) return;
    if (!newBuyerName.trim() || !newItemCode.trim()) {
      alert('Please fill in Buyer Name and Item Code.');
      return;
    }
    setIsAddingOrder(true);
    try {
      await onAddOrder({
        buyerName: newBuyerName.trim(),
        itemCode: newItemCode.trim().toUpperCase(),
        size: newSize.trim().toUpperCase(),
        colour: newColour.trim().toUpperCase(),
        quantity: Math.max(1, parseInt(newQty, 10) || 1),
        channel: newChannel,
        statedPrice: parseFloat(newPrice) || 0,
      });
      setShowAddModal(false);
      setNewBuyerName('');
      setNewItemCode('');
      setNewSize('FREE SIZE (PLUS)');
      setNewColour('ASSORTED');
      setNewQty('1');
      setNewPrice('550');
    } catch (err) {
      console.error('Failed to add manual order', err);
    } finally {
      setIsAddingOrder(false);
    }
  };

  const handleAttemptApprove = (ord: BuyerOrder) => {
    if (!ord.statedUnitPricePhp || ord.statedUnitPricePhp <= 0) {
      alert(`Cannot approve claim for ${ord.buyerName}: Unit price is ₱0. Please set the item price first.`);
      handleOpenEdit(ord);
      return;
    }
    if (ord.itemCode === 'PENDING SPEC') {
      alert(`Cannot approve claim for ${ord.buyerName}: Item code is PENDING SPEC. Please assign the garment code first.`);
      handleOpenEdit(ord);
      return;
    }
    onApproveOrder(ord.id);
  };

  const handleToggleSelect = (id: string) => {
    const next = new Set(selectedOrderIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedOrderIds(next);
  };

  const handleBulkApprove = () => {
    const validIds: string[] = [];
    let skippedCount = 0;
    selectedOrderIds.forEach((id) => {
      const ord = orders.find((o) => o.id === id);
      if (ord && ord.statedUnitPricePhp && ord.statedUnitPricePhp > 0 && ord.itemCode !== 'PENDING SPEC') {
        validIds.push(id);
      } else {
        skippedCount++;
      }
    });

    if (validIds.length === 0 && skippedCount > 0) {
      alert(`Cannot approve: All selected orders have ₱0 price or PENDING SPEC item code. Please update their prices and codes first.`);
      return;
    }

    if (onApproveBatchOrders) {
      onApproveBatchOrders(validIds);
    } else {
      validIds.forEach((id) => onApproveOrder(id));
    }
    setSelectedOrderIds(new Set());

    if (skippedCount > 0) {
      alert(`Approved ${validIds.length} orders. ${skippedCount} orders were skipped because they have ₱0 price or PENDING SPEC.`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Executive Owner / Admin Review Gate Banner */}
      {activeLive?.reconciliationStatus === 'awaiting_owner_review' && (
        <div className="bg-gradient-to-r from-amber-950/80 via-neutral-900 to-rose-950/80 border-2 border-amber-500 rounded-2xl p-5 shadow-2xl relative overflow-hidden">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/40 shrink-0">
                <Lock className="w-6 h-6 animate-pulse text-amber-400" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-white tracking-tight">
                    STREAM ENDED &bull; AUTOMATIC RECONCILIATION COMPLETED &bull; AWAITING OWNER REVIEW
                  </h3>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500 text-neutral-950 font-extrabold uppercase tracking-wide">
                    Gate Active
                  </span>
                </div>
                <p className="text-xs text-amber-200/90 mt-1 max-w-3xl leading-relaxed">
                  The live broadcast stream has ended and the pure reconciliation engine immediately executed. Discrepancies and stock shortages have been flagged. Per BPSO store operations policy, staff cannot release official invoices until the Owner or Admin verifies physical rack coverage and approves.
                </p>
                <div className="mt-2 text-[11px] text-neutral-400">
                  Logged in role: <strong className="text-white capitalize">{userRole}</strong> (Full override & sign-off authorized for Owner / Admin)
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto shrink-0">
              <button
                onClick={async () => {
                  setIsApproving(true);
                  try {
                    await onOwnerApproval('request_amendment', approvalNotes);
                  } finally {
                    setIsApproving(false);
                  }
                }}
                disabled={isApproving}
                className="px-3.5 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 rounded-xl text-xs font-semibold transition"
              >
                Request Recount
              </button>
              <button
                onClick={async () => {
                  setIsApproving(true);
                  try {
                    await onOwnerApproval('approve', approvalNotes);
                  } finally {
                    setIsApproving(false);
                  }
                }}
                disabled={isApproving}
                className="px-4 py-2 bg-gradient-to-r from-amber-500 to-rose-500 hover:from-amber-400 hover:to-rose-400 text-neutral-950 font-extrabold rounded-xl text-xs shadow-lg shadow-amber-950/50 transition flex items-center gap-1.5"
              >
                <ShieldCheck className="w-4 h-4 text-neutral-950" />
                <span>{isApproving ? 'Approving...' : 'Approve Reconciliation & Unlock Invoicing'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {activeLive?.ownerApprovedBy && (
        <div className="p-3.5 bg-emerald-950/40 border border-emerald-500/50 rounded-xl flex items-center justify-between text-xs text-emerald-200">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>
              Reconciliation officially signed off & approved by <strong>{activeLive.ownerApprovedBy}</strong> {activeLive.ownerApprovedAt ? `at ${new Date(activeLive.ownerApprovedAt).toLocaleTimeString()}` : ''}. Invoicing gate is unlocked!
            </span>
          </div>
          {activeLive.ownerReviewNotes && (
            <span className="text-[11px] italic text-emerald-300/80 max-w-sm truncate">
              "{activeLive.ownerReviewNotes}"
            </span>
          )}
        </div>
      )}

      {/* Spotlight on Pending Orders Awaiting Reconciliation */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4 pb-3 border-b border-neutral-800">
          <div>
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-amber-400" />
              <h2 className="text-lg font-bold text-white tracking-tight">
                Order Review & Final Invoicing Workspace
              </h2>
            </div>
            <p className="text-xs text-neutral-400 mt-1">
              Review and approve pending orders, resolve duplicate entries, and verify final specs before official invoicing.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onGenerateInvoices()}
              className="flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-emerald-950/40 transition"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Final Invoice Approval ({summary?.invoicingQueue?.eligibleInvoicesCount || 0} Ready)</span>
            </button>
          </div>
        </div>

        {/* 4 Status Counter Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
          <button
            onClick={() => setFilterStatus('pending')}
            className={`p-3.5 rounded-xl border text-left transition ${
              filterStatus === 'pending'
                ? 'bg-amber-950/50 border-amber-500 text-amber-200'
                : 'bg-neutral-950/70 border-neutral-800 text-neutral-400 hover:border-neutral-700'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-semibold text-xs text-amber-300">Awaiting Reconciliation</span>
              <AlertTriangle className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-2xl font-bold font-mono text-white mt-1">
              {pendingOrders.length}
            </div>
            <span className="text-[10px] text-amber-400/80">Needs stock check or approval</span>
          </button>

          <button
            onClick={() => setFilterStatus('confirmed')}
            className={`p-3.5 rounded-xl border text-left transition ${
              filterStatus === 'confirmed'
                ? 'bg-emerald-950/50 border-emerald-500 text-emerald-200'
                : 'bg-neutral-950/70 border-neutral-800 text-neutral-400 hover:border-neutral-700'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-semibold text-xs text-emerald-300">Reconciled & Confirmed</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-bold font-mono text-white mt-1">
              {confirmedOrders.length}
            </div>
            <span className="text-[10px] text-emerald-400/80">Ready for official final invoice</span>
          </button>

          <button
            onClick={() => setFilterStatus('duplicates')}
            className={`p-3.5 rounded-xl border text-left transition ${
              filterStatus === 'duplicates'
                ? 'bg-rose-950/50 border-rose-500 text-rose-200'
                : 'bg-neutral-950/70 border-neutral-800 text-neutral-400 hover:border-neutral-700'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-semibold text-xs text-rose-300">Flagged Duplicates</span>
              <AlertTriangle className="w-4 h-4 text-rose-400" />
            </div>
            <div className="text-2xl font-bold font-mono text-white mt-1">
              {duplicateOrders.length}
            </div>
            <span className="text-[10px] text-rose-400/80">Repeat comment / multi-claim</span>
          </button>

          <button
            onClick={() => setFilterStatus('all')}
            className={`p-3.5 rounded-xl border text-left transition ${
              filterStatus === 'all'
                ? 'bg-neutral-800 border-neutral-600 text-white'
                : 'bg-neutral-950/70 border-neutral-800 text-neutral-400 hover:border-neutral-700'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-semibold text-xs text-neutral-300">Total Orders In Intake</span>
              <FileCheck className="w-4 h-4 text-neutral-400" />
            </div>
            <div className="text-2xl font-bold font-mono text-white mt-1">
              {orders.length}
            </div>
            <span className="text-[10px] text-neutral-500">Live chat, Messenger & VIP</span>
          </button>
        </div>
      </div>

      {/* Orders Table Container */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-xl space-y-4">
        {/* Table Filters & Bulk Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-neutral-800">
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-neutral-500" />
              <input
                type="text"
                placeholder="Search buyer, item code, size..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-neutral-950 border border-neutral-700 rounded-xl pl-9 pr-4 py-2 text-xs text-white w-64 focus:outline-none focus:border-rose-500"
              />
            </div>

            {onAddOrder && (
              <button
                type="button"
                onClick={() => setShowAddModal(true)}
                className="px-3.5 py-2 bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Add Buyer / Order</span>
              </button>
            )}

            {selectedOrderIds.size > 0 && (
              <button
                onClick={handleBulkApprove}
                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Bulk Approve ({selectedOrderIds.size})</span>
              </button>
            )}
          </div>

          <div className="text-xs text-neutral-400">
            Showing <strong className="text-white">{filteredOrders.length}</strong> of {orders.length} orders
          </div>
        </div>

        {/* Orders Table */}
        <div className="overflow-x-auto text-xs">
          <table className="w-full text-left">
            <thead className="bg-neutral-950 text-neutral-400 border-b border-neutral-800 font-semibold">
              <tr>
                <th className="p-3 w-8">
                  <input
                    type="checkbox"
                    checked={selectedOrderIds.size === filteredOrders.length && filteredOrders.length > 0}
                    onChange={(e) => {
                      if (e.target.checked) setSelectedOrderIds(new Set(filteredOrders.map((o) => o.id)));
                      else setSelectedOrderIds(new Set());
                    }}
                    className="rounded bg-neutral-900 border-neutral-700"
                  />
                </th>
                <th className="p-3">Buyer & Channel</th>
                <th className="p-3">Item Code</th>
                <th className="p-3">Size & Colour</th>
                <th className="p-3">Price (PHP)</th>
                <th className="p-3">Ordered At</th>
                <th className="p-3">Audit / Replay Note</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800">
              {filteredOrders.map((ord) => {
                const isSelected = selectedOrderIds.has(ord.id);
                const isPending = ord.status === 'pending';
                const isConfirmed = ord.status === 'confirmed';
                const isDuplicate = ord.isDuplicateFlagged;

                const matchingAmendment = (amendments || []).find(
                  (a) => a.originalOrderId === ord.id || 
                         (a.buyerName && ord.buyerName && a.buyerName.toLowerCase() === ord.buyerName.toLowerCase())
                );
                const matchingMessengerThread = (messengerThreads || []).find(
                  (t) => (t.buyerName && ord.buyerName && t.buyerName.toLowerCase() === ord.buyerName.toLowerCase()) ||
                         (t.psid && ord.sourceCommentId && ord.sourceCommentId.includes(t.psid))
                );
                const isAmended = !!matchingAmendment || ord.status === 'replaced' || Boolean(ord.hostVerificationNote && ord.hostVerificationNote.includes('Adjusted'));

                return (
                  <tr key={ord.id} className={`hover:bg-neutral-800/30 transition ${isSelected ? 'bg-rose-950/20' : ''}`}>
                    <td className="p-3">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggleSelect(ord.id)}
                        className="rounded bg-neutral-900 border-neutral-700"
                      />
                    </td>

                    <td className="p-3">
                      <div className="font-bold text-white flex items-center gap-1.5">
                        <span>{ord.buyerName}</span>
                        {ord.isVip && (
                          <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 font-bold text-[9px] border border-amber-500/30">
                            VIP
                          </span>
                        )}
                        {ord.version && ord.version > 1 && (
                          <span className="px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-300 font-bold text-[9px] border border-rose-500/30 font-mono">
                            v{ord.version} Override
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 mt-0.5">
                        <span className="text-[11px] text-neutral-400">
                          {ord.channel === 'messenger' ? '💬 Page Messenger' : ord.channel === 'vip' ? '👑 VIP Inbox' : '📹 Live Chat'}
                        </span>
                        {ord.channel === 'messenger' || matchingMessengerThread ? (
                          <button
                            type="button"
                            onClick={() => setSelectedMessengerSnapshot(matchingMessengerThread || {
                              id: `th_${ord.id}`,
                              psid: `psid_${ord.id}`,
                              buyerName: ord.buyerName,
                              buyerHandle: `fb.com/${ord.buyerName}`,
                              windowExpiresAt: new Date(Date.now() + 24 * 3600000).toISOString(),
                              unreadCount: 0,
                              messages: [
                                {
                                  id: `m_${ord.id}`,
                                  mid: `m_${ord.id}`,
                                  sender: 'buyer',
                                  text: `Claim placed: ${ord.itemCode} (${ord.size} ${ord.colour}) - ₱${ord.statedUnitPricePhp}`,
                                  timestamp: ord.orderedAt,
                                }
                              ]
                            })}
                            className="text-[10px] text-sky-400 hover:text-sky-300 font-semibold flex items-center gap-1"
                          >
                            <MessageSquare className="w-3 h-3" />
                            <span>Messenger DM ↗</span>
                          </button>
                        ) : (
                          <a
                            href={activeLive?.videoUrl || `https://www.facebook.com/watch/?v=${activeLive?.fbVideoId || '1126219396590785'}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[10px] text-rose-400 hover:text-rose-300 font-semibold flex items-center gap-1"
                          >
                            <Video className="w-3 h-3" />
                            <span>Live Stream ↗</span>
                          </a>
                        )}
                      </div>
                      {ord.reviewNotes && (
                        <div className="text-[10px] text-neutral-400 italic mt-1 truncate max-w-xs" title={ord.reviewNotes}>
                          {ord.reviewNotes}
                        </div>
                      )}
                    </td>

                    <td className="p-3">
                      {ord.itemCode === 'PENDING SPEC' ? (
                        <div className="flex flex-col items-start gap-1">
                          <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold text-[10px] border border-amber-500/30">
                            ⚠️ PENDING SPEC
                          </span>
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(ord)}
                            className="px-2 py-0.5 rounded bg-sky-950/60 hover:bg-sky-800 text-sky-300 text-[10px] font-semibold border border-sky-600/40 transition"
                          >
                            Assign Code
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-bold text-rose-300">{ord.itemCode}</span>
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(ord)}
                            title="Edit Item Code"
                            className="text-neutral-600 hover:text-neutral-300 transition"
                          >
                            <Edit2 className="w-2.5 h-2.5" />
                          </button>
                        </div>
                      )}
                    </td>

                    <td className="p-3 font-mono">
                      <span className="font-semibold text-white">{ord.size}</span>
                      <span className="text-neutral-400 ml-1.5">{ord.colour}</span>
                    </td>

                    <td className="p-3 font-mono">
                      {!ord.statedUnitPricePhp || ord.statedUnitPricePhp <= 0 ? (
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(ord)}
                          className="px-2 py-1 rounded bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 font-bold text-[11px] border border-rose-500/40 flex items-center gap-1 shadow transition"
                        >
                          <AlertTriangle className="w-3 h-3 text-rose-400" />
                          <span>⚠️ ₱0 · Set Price</span>
                        </button>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-amber-300">₱{ord.statedUnitPricePhp.toLocaleString()}</span>
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(ord)}
                            title="Edit Price"
                            className="text-neutral-600 hover:text-neutral-300 transition"
                          >
                            <Edit2 className="w-2.5 h-2.5" />
                          </button>
                        </div>
                      )}
                    </td>

                    <td className="p-3 text-neutral-400 font-mono text-[11px]">
                      {new Date(ord.orderedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>

                    <td className="p-3 max-w-sm text-[11px]">
                      <div className="text-neutral-300">
                        {ord.hostVerificationNote || ord.reviewNotes || 'Captured from live stream.'}
                      </div>

                      {/* Snapshot of Amended Order with Live Chat / Messenger Link (Requirement 2B) */}
                      {isAmended && (
                        <div className="mt-2 p-2 rounded-lg bg-amber-950/40 border border-amber-500/40 text-[11px] space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-amber-300 flex items-center gap-1 text-[10px]">
                              <ArrowRightLeft className="w-3 h-3 text-amber-400" />
                              <span>Amended Order Snapshot ({matchingAmendment?.type.replace('_', ' ') || 'Adjusted'})</span>
                            </span>
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-neutral-900 text-amber-200 font-mono">
                              {matchingAmendment?.channel === 'messenger' ? '💬 Messenger' : '📹 Live Chat'}
                            </span>
                          </div>

                          {matchingAmendment && (
                            <div className="font-mono text-[10px] text-neutral-300 flex items-center gap-1">
                              <span className="text-neutral-400 line-through">{matchingAmendment.originalSpec.size} {matchingAmendment.originalSpec.colour}</span>
                              <ArrowRight className="w-2.5 h-2.5 text-amber-400" />
                              <span className="text-emerald-400 font-bold">{matchingAmendment.newSpec.size} {matchingAmendment.newSpec.colour}</span>
                            </div>
                          )}

                          {matchingAmendment?.rawText && (
                            <div className="text-[10px] text-neutral-400 italic truncate">
                              "{matchingAmendment.rawText}"
                            </div>
                          )}

                          <div className="pt-1 flex items-center gap-2 border-t border-amber-900/40">
                            {matchingAmendment?.channel === 'messenger' || ord.channel === 'messenger' ? (
                              <button
                                type="button"
                                onClick={() => setSelectedMessengerSnapshot(matchingMessengerThread || {
                                  id: `th_${ord.id}`,
                                  psid: `psid_${ord.id}`,
                                  buyerName: ord.buyerName,
                                  buyerHandle: `fb.com/${ord.buyerName}`,
                                  windowExpiresAt: new Date(Date.now() + 24 * 3600000).toISOString(),
                                  unreadCount: 0,
                                  messages: [
                                    {
                                      id: `m_${ord.id}`,
                                      mid: `m_${ord.id}`,
                                      sender: 'buyer',
                                      text: matchingAmendment?.rawText || `Adjustment request for ${ord.itemCode}`,
                                      timestamp: ord.orderedAt,
                                    }
                                  ]
                                })}
                                className="text-[10px] text-sky-400 hover:text-sky-300 font-semibold flex items-center gap-1"
                              >
                                <MessageSquare className="w-3 h-3" />
                                <span>View Synced Messenger Thread Snapshot ↗</span>
                              </button>
                            ) : (
                              <a
                                href={activeLive?.videoUrl || `https://www.facebook.com/watch/?v=${activeLive?.fbVideoId || '1126219396590785'}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[10px] text-rose-400 hover:text-rose-300 font-semibold flex items-center gap-1"
                              >
                                <Video className="w-3 h-3" />
                                <span>View FB Live Chat Replay ↗</span>
                              </a>
                            )}
                          </div>
                        </div>
                      )}
                    </td>

                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        isConfirmed
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                          : isPending
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                          : ord.status === 'invoiced'
                          ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                          : 'bg-neutral-800 text-neutral-400'
                      }`}>
                        {ord.status.toUpperCase()}
                      </span>
                    </td>

                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {isPending && (
                          <button
                            onClick={() => handleAttemptApprove(ord)}
                            title={
                              !ord.statedUnitPricePhp || ord.statedUnitPricePhp <= 0
                                ? '⚠️ Price is ₱0 — click to assign price before approving'
                                : ord.itemCode === 'PENDING SPEC'
                                ? '⚠️ Item code is PENDING SPEC — click to assign code before approving'
                                : 'Approve Order'
                            }
                            className={`p-1.5 rounded-lg transition ${
                              !ord.statedUnitPricePhp || ord.statedUnitPricePhp <= 0 || ord.itemCode === 'PENDING SPEC'
                                ? 'bg-amber-950/60 text-amber-400 hover:bg-amber-600 hover:text-white border border-amber-500/40'
                                : 'bg-emerald-600/30 hover:bg-emerald-600 text-emerald-300 hover:text-white'
                            }`}
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {/* Owner / Admin Executive Override */}
                        <button
                          onClick={() => onOpenOverride(ord, false)}
                          title="Full Owner & Admin Executive Override Power"
                          className="p-1.5 rounded-lg bg-rose-950/40 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/30 transition"
                        >
                          <ShieldAlert className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => handleOpenEdit(ord)}
                          title="Edit Spec / Price"
                          className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white transition"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => setRejectModalOrder(ord)}
                          title="Reject / Cancel"
                          className="p-1.5 rounded-lg bg-rose-950/40 hover:bg-rose-600 text-rose-400 hover:text-white transition"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Order Modal */}
      {editingOrder && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
              <h3 className="font-bold text-base text-white flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-rose-400" />
                <span>Manual Order Review & Spec Update</span>
              </h3>
              <button onClick={() => setEditingOrder(null)} className="text-neutral-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-3 text-xs">
              <div className="p-3 bg-neutral-950 rounded-xl border border-neutral-800 space-y-1">
                <div className="text-neutral-400">Buyer: <strong className="text-white">{editingOrder.buyerName}</strong></div>
                {editingOrder.reviewNotes && (
                  <div className="text-[11px] text-amber-300/90 font-mono">
                    Note / Comment: "{editingOrder.reviewNotes}"
                  </div>
                )}
              </div>

              <div>
                <label className="text-neutral-400 block mb-1 font-semibold">Bangkok Garment Item Code</label>
                <input
                  type="text"
                  list="modal-bangkok-item-codes"
                  value={editItemCode}
                  onChange={(e) => {
                    const val = e.target.value;
                    setEditItemCode(val);
                    const upper = val.trim().toUpperCase();
                    if (KNOWN_BANGKOK_PRICES[upper] && (!editPrice || editPrice === '0')) {
                      setEditPrice(String(KNOWN_BANGKOK_PRICES[upper]));
                    }
                  }}
                  placeholder="e.g. RUSTANS, LU PANTS, LINEN PANTS..."
                  className="w-full bg-neutral-950 border border-neutral-700 rounded-lg p-2 text-white font-mono uppercase"
                  required
                />
                <datalist id="modal-bangkok-item-codes">
                  <option value="RUSTANS" />
                  <option value="LU PANTS" />
                  <option value="LINEN PANTS" />
                  <option value="LONG DRESS" />
                  <option value="FLOWY DRESS" />
                  <option value="SEXY BLACK" />
                  <option value="HALF SET" />
                  <option value="ELEGANT SET" />
                  <option value="GIG 5" />
                  <option value="TALI TIE DYE" />
                  <option value="SKORT" />
                </datalist>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-neutral-400 block mb-1">Size</label>
                  <select
                    value={editSize}
                    onChange={(e) => setEditSize(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-700 rounded-lg p-2 text-white"
                  >
                    <option value="FREE SIZE (PLUS)">FREE SIZE (PLUS)</option>
                    <option value="FS (PLUS)">FS (PLUS)</option>
                    <option value="XL">XL</option>
                    <option value="2XL">2XL</option>
                    <option value="3XL">3XL</option>
                    <option value="4XL">4XL</option>
                    <option value="5XL">5XL</option>
                    <option value="6XL">6XL</option>
                  </select>
                </div>

                <div>
                  <label className="text-neutral-400 block mb-1">Colour</label>
                  <input
                    type="text"
                    value={editColour}
                    onChange={(e) => setEditColour(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-700 rounded-lg p-2 text-white uppercase"
                  />
                </div>
              </div>

              <div>
                <label className="text-neutral-400 block mb-1 font-semibold">
                  Unit Price (PHP) {(!editPrice || editPrice === '0') && <span className="text-rose-400">* Required</span>}
                </label>
                <input
                  type="number"
                  min="1"
                  value={editPrice}
                  onChange={(e) => setEditPrice(e.target.value)}
                  placeholder="e.g. 550"
                  className={`w-full bg-neutral-950 border rounded-lg p-2 text-white font-mono ${
                    !editPrice || editPrice === '0' ? 'border-rose-500' : 'border-neutral-700'
                  }`}
                  required
                />
              </div>

              <div>
                <label className="text-neutral-400 block mb-1">Review Audit Reason / Host Quote Note</label>
                <textarea
                  rows={2}
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="e.g. Host verbally called item price on replay"
                  className="w-full bg-neutral-950 border border-neutral-700 rounded-lg p-2 text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-neutral-800">
                <button
                  type="button"
                  onClick={() => setEditingOrder(null)}
                  className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl shadow"
                >
                  Confirm & Sync Spec
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {rejectModalOrder && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-2xl">
            <h3 className="font-bold text-base text-white flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-rose-500" />
              <span>Cancel or Reject Claim</span>
            </h3>

            <p className="text-xs text-neutral-300">
              Are you sure you want to decline order for <strong>{rejectModalOrder.buyerName}</strong> ({rejectModalOrder.itemCode} {rejectModalOrder.size})?
            </p>

            <select
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="w-full bg-neutral-950 border border-neutral-700 rounded-lg p-2 text-xs text-white"
            >
              <option value="Out of stock at supplier">Out of stock at supplier</option>
              <option value="Buyer cancelled via Messenger">Buyer cancelled via Messenger</option>
              <option value="Duplicate comment claim">Duplicate comment claim</option>
              <option value="Unverified test comment">Unverified test comment</option>
            </select>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-neutral-800 text-xs">
              <button
                type="button"
                onClick={() => setRejectModalOrder(null)}
                className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-xl"
              >
                Keep Order
              </button>
              <button
                type="button"
                onClick={() => {
                  onRejectOrder(rejectModalOrder.id, rejectReason);
                  setRejectModalOrder(null);
                  onTriggerReconciliation();
                }}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl"
              >
                Confirm Decline
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Synced Messenger Thread Snapshot Modal (Requirement 2B) */}
      {selectedMessengerSnapshot && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-neutral-700 rounded-2xl max-w-lg w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-sky-400" />
                <div>
                  <h3 className="font-bold text-sm text-white">{selectedMessengerSnapshot.buyerName}</h3>
                  <div className="text-[10px] text-neutral-400 font-mono">PSID: {selectedMessengerSnapshot.psid}</div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedMessengerSnapshot(null)}
                className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 bg-neutral-950 rounded-xl border border-neutral-800 max-h-72 overflow-y-auto space-y-2 text-xs">
              {selectedMessengerSnapshot.messages.map((m) => (
                <div
                  key={m.id}
                  className={`p-2.5 rounded-xl max-w-[85%] text-xs ${
                    m.sender === 'buyer'
                      ? 'bg-neutral-800 text-neutral-200 mr-auto'
                      : 'bg-gradient-to-r from-sky-600 to-blue-600 text-white ml-auto'
                  }`}
                >
                  <div>{m.text}</div>
                  <div className="text-[9px] opacity-60 text-right mt-1 font-mono">
                    {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-neutral-800 text-xs">
              <span className="text-[11px] text-emerald-400 flex items-center gap-1 font-mono">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Meta 24h Messaging Window Active
              </span>
              <button
                type="button"
                onClick={() => setSelectedMessengerSnapshot(null)}
                className="px-4 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-white font-medium rounded-lg transition"
              >
                Close Snapshot
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Add Manual Buyer / Order Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-neutral-700 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
              <h3 className="font-bold text-base text-white flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-rose-500" />
                <span>Add Manual Order / Claim</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-neutral-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="text-neutral-400 block mb-1 font-semibold">Buyer Name *</label>
                <input
                  type="text"
                  required
                  value={newBuyerName}
                  onChange={(e) => setNewBuyerName(e.target.value)}
                  placeholder="e.g. Donna Cruz"
                  className="w-full bg-neutral-950 border border-neutral-700 rounded-lg p-2.5 text-white font-medium focus:border-rose-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-neutral-400 block mb-1 font-semibold">Bangkok Item Code *</label>
                <input
                  type="text"
                  list="add-modal-item-codes"
                  required
                  value={newItemCode}
                  onChange={(e) => {
                    const val = e.target.value;
                    setNewItemCode(val);
                    const upper = val.trim().toUpperCase();
                    if (KNOWN_BANGKOK_PRICES[upper]) {
                      setNewPrice(String(KNOWN_BANGKOK_PRICES[upper]));
                    }
                  }}
                  placeholder="e.g. RUSTANS, LU PANTS, FLOWY DRESS..."
                  className="w-full bg-neutral-950 border border-neutral-700 rounded-lg p-2.5 text-white font-mono uppercase focus:border-rose-500 focus:outline-none"
                />
                <datalist id="add-modal-item-codes">
                  <option value="RUSTANS" />
                  <option value="LU PANTS" />
                  <option value="LINEN PANTS" />
                  <option value="LONG DRESS" />
                  <option value="FLOWY DRESS" />
                  <option value="SEXY BLACK" />
                  <option value="HALF SET" />
                  <option value="ELEGANT SET" />
                  <option value="GIG 5" />
                  <option value="TALI TIE DYE" />
                  <option value="SKORT" />
                </datalist>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-neutral-400 block mb-1">Size</label>
                  <select
                    value={newSize}
                    onChange={(e) => setNewSize(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-700 rounded-lg p-2.5 text-white focus:border-rose-500 focus:outline-none"
                  >
                    <option value="FREE SIZE (PLUS)">FREE SIZE (PLUS)</option>
                    <option value="FS (PLUS)">FS (PLUS)</option>
                    <option value="XL">XL</option>
                    <option value="2XL">2XL</option>
                    <option value="3XL">3XL</option>
                    <option value="4XL">4XL</option>
                    <option value="5XL">5XL</option>
                    <option value="6XL">6XL</option>
                  </select>
                </div>

                <div>
                  <label className="text-neutral-400 block mb-1">Colour</label>
                  <input
                    type="text"
                    value={newColour}
                    onChange={(e) => setNewColour(e.target.value)}
                    placeholder="e.g. BLACK, MAROON"
                    className="w-full bg-neutral-950 border border-neutral-700 rounded-lg p-2.5 text-white uppercase focus:border-rose-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-neutral-400 block mb-1 font-semibold">Unit Price (PHP)</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={newPrice}
                    onChange={(e) => setNewPrice(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-700 rounded-lg p-2.5 text-white font-mono focus:border-rose-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-neutral-400 block mb-1">Quantity</label>
                  <input
                    type="number"
                    min="1"
                    value={newQty}
                    onChange={(e) => setNewQty(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-700 rounded-lg p-2.5 text-white font-mono focus:border-rose-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-neutral-400 block mb-1">Intake Channel</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setNewChannel('live_chat')}
                    className={`p-2 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
                      newChannel === 'live_chat'
                        ? 'bg-rose-950/60 border-rose-500 text-rose-300'
                        : 'bg-neutral-950 border-neutral-800 text-neutral-400'
                    }`}
                  >
                    <Video className="w-3.5 h-3.5" />
                    <span>Live Chat</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewChannel('messenger')}
                    className={`p-2 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
                      newChannel === 'messenger'
                        ? 'bg-sky-950/60 border-sky-500 text-sky-300'
                        : 'bg-neutral-950 border-neutral-800 text-neutral-400'
                    }`}
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>Page Messenger</span>
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-neutral-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isAddingOrder}
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl shadow flex items-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>{isAddingOrder ? 'Adding...' : 'Add Order'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
