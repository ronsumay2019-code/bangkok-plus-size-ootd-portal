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
  onRejectOrder: (orderId: string, reason: string) => void;
  onUpdateOrder: (orderId: string, updates: Partial<BuyerOrder>) => void;
  onGenerateInvoices: (buyerNames?: string[]) => void;
  onTriggerReconciliation: () => void;
  onOwnerApproval: (action: 'approve' | 'request_amendment', notes?: string) => Promise<void>;
  onOpenOverride: (order: BuyerOrder, isPreOrder: boolean) => void;
}

export const OrderReviewApprovalWorkspace: React.FC<OrderReviewApprovalWorkspaceProps> = ({
  orders,
  summary,
  activeLive,
  userRole,
  amendments = [],
  messengerThreads = [],
  onApproveOrder,
  onRejectOrder,
  onUpdateOrder,
  onGenerateInvoices,
  onTriggerReconciliation,
  onOwnerApproval,
  onOpenOverride,
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

  // Edit form state
  const [editSize, setEditSize] = useState('');
  const [editColour, setEditColour] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [editNotes, setEditNotes] = useState('');

  const pendingOrders = orders.filter((o) => o.status === 'pending');
  const confirmedOrders = orders.filter((o) => o.status === 'confirmed');
  const shortOrders = orders.filter((o) => o.status === 'short');
  const duplicateOrders = orders.filter((o) => o.isDuplicateFlagged);

  const filteredOrders = orders.filter((o) => {
    if (filterStatus === 'pending') return o.status === 'pending';
    if (filterStatus === 'confirmed') return o.status === 'confirmed';
    if (filterStatus === 'short') return o.status === 'short';
    if (filterStatus === 'duplicates') return o.isDuplicateFlagged;
    return true;
  }).filter((o) => 
    o.buyerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    o.itemCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
    o.size.toLowerCase().includes(searchQuery.toLowerCase()) ||
    o.colour.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleOpenEdit = (ord: BuyerOrder) => {
    setEditingOrder(ord);
    setEditSize(ord.size);
    setEditColour(ord.colour);
    setEditPrice(String(ord.statedUnitPricePhp || 1890));
    setEditNotes(ord.reviewNotes || '');
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingOrder) return;

    onUpdateOrder(editingOrder.id, {
      size: editSize.toUpperCase(),
      colour: editColour.toUpperCase(),
      statedUnitPricePhp: Number(editPrice) || editingOrder.statedUnitPricePhp,
      reviewNotes: editNotes,
      reviewedBy: 'Owner / Admin',
      reviewedAt: new Date().toISOString(),
    });

    setEditingOrder(null);
  };

  const handleToggleSelect = (id: string) => {
    const next = new Set(selectedOrderIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedOrderIds(next);
  };

  const handleBulkApprove = () => {
    selectedOrderIds.forEach((id) => onApproveOrder(id));
    setSelectedOrderIds(new Set());
    onTriggerReconciliation();
  };

  return (
    <div className="space-y-6">
      {/* Executive Owner / Admin Review Gate Banner */}
      {activeLive.reconciliationStatus === 'awaiting_owner_review' && (
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

      {activeLive.ownerApprovedBy && (
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
              <span>Final Invoice Approval ({summary?.invoicingQueue.eligibleInvoicesCount || 0} Ready)</span>
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

                const matchingAmendment = amendments.find(
                  (a) => a.originalOrderId === ord.id || 
                         a.buyerName.toLowerCase() === ord.buyerName.toLowerCase()
                );
                const matchingMessengerThread = messengerThreads.find(
                  (t) => t.buyerName.toLowerCase() === ord.buyerName.toLowerCase() ||
                         (t.psid && ord.sourceCommentId?.includes(t.psid))
                );
                const isAmended = !!matchingAmendment || ord.status === 'replaced' || (ord.hostVerificationNote && ord.hostVerificationNote.includes('Adjusted'));

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
                            href={activeLive.videoUrl || `https://www.facebook.com/watch/?v=${activeLive.fbVideoId || '1126219396590785'}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[10px] text-rose-400 hover:text-rose-300 font-semibold flex items-center gap-1"
                          >
                            <Video className="w-3 h-3" />
                            <span>Live Stream ↗</span>
                          </a>
                        )}
                      </div>
                    </td>

                    <td className="p-3 font-mono font-bold text-rose-300">
                      {ord.itemCode}
                    </td>

                    <td className="p-3 font-mono">
                      <span className="font-semibold text-white">{ord.size}</span>
                      <span className="text-neutral-400 ml-1.5">{ord.colour}</span>
                    </td>

                    <td className="p-3 font-mono font-bold text-amber-300">
                      ₱{(ord.statedUnitPricePhp || 0).toLocaleString()}
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
                                href={activeLive.videoUrl || `https://www.facebook.com/watch/?v=${activeLive.fbVideoId || '1126219396590785'}`}
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
                            onClick={() => {
                              onApproveOrder(ord.id);
                              onTriggerReconciliation();
                            }}
                            title="Approve Order"
                            className="p-1.5 rounded-lg bg-emerald-600/30 hover:bg-emerald-600 text-emerald-300 hover:text-white transition"
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
              <div className="p-3 bg-neutral-950 rounded-xl border border-neutral-800">
                <div className="text-neutral-400">Buyer: <strong className="text-white">{editingOrder.buyerName}</strong></div>
                <div className="text-neutral-400">Item: <strong className="text-rose-300 font-mono">{editingOrder.itemCode}</strong></div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-neutral-400 block mb-1">Size</label>
                  <select
                    value={editSize}
                    onChange={(e) => setEditSize(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-700 rounded-lg p-2 text-white"
                  >
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
                    className="w-full bg-neutral-950 border border-neutral-700 rounded-lg p-2 text-white"
                  />
                </div>
              </div>

              <div>
                <label className="text-neutral-400 block mb-1">Unit Price (PHP)</label>
                <input
                  type="number"
                  value={editPrice}
                  onChange={(e) => setEditPrice(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-700 rounded-lg p-2 text-white font-mono"
                />
              </div>

              <div>
                <label className="text-neutral-400 block mb-1">Review Audit Reason / Host Quote Note</label>
                <textarea
                  rows={2}
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="e.g. Host verbally corrected price on replay (06:52)"
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
    </div>
  );
};
