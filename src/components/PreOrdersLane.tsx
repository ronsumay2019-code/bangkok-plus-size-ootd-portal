import React, { useState } from 'react';
import { 
  ShoppingBag, 
  Plus, 
  Search, 
  Filter, 
  ShieldAlert, 
  CheckCircle2, 
  Clock, 
  MessageSquare, 
  Video, 
  Sparkles, 
  Store,
  Layers,
  ArrowRight,
  ExternalLink,
  Tag,
  X,
  Send,
} from 'lucide-react';
import { PreOrder, BuyerOrder, MessengerThread } from '../types/reconciliation';

interface PreOrdersLaneProps {
  preOrders: PreOrder[];
  messengerThreads?: MessengerThread[];
  onAddPreOrder: (data: Partial<PreOrder>) => Promise<void>;
  onUpdateStatus: (preOrderId: string, status: PreOrder['status'], notes?: string) => Promise<void>;
  onOpenOverride: (order: PreOrder, isPreOrder: boolean) => void;
  onReplyMessenger?: (threadId: string, text: string) => Promise<void>;
  userRole: 'owner' | 'admin' | 'staff';
}

export const PreOrdersLane: React.FC<PreOrdersLaneProps> = ({
  preOrders,
  messengerThreads = [],
  onAddPreOrder,
  onUpdateStatus,
  onOpenOverride,
  onReplyMessenger,
  userRole,
}) => {
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterChannel, setFilterChannel] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedMessengerThread, setSelectedMessengerThread] = useState<MessengerThread | null>(null);
  const [replyText, setReplyText] = useState('');
  const [isSendingReply, setIsSendingReply] = useState(false);

  // New pre-order form state
  const [buyerName, setBuyerName] = useState('');
  const [buyerContact, setBuyerContact] = useState('');
  const [itemCode, setItemCode] = useState('');
  const [itemName, setItemName] = useState('');
  const [size, setSize] = useState('3XL');
  const [colour, setColour] = useState('MAROON');
  const [quantity, setQuantity] = useState(1);
  const [statedPrice, setStatedPrice] = useState(1890);
  const [channel, setChannel] = useState<PreOrder['channel']>('messenger');
  const [targetStore, setTargetStore] = useState('Pratunam Market Wholesale');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const filtered = preOrders.filter((item) => {
    if (filterStatus !== 'all' && item.status !== filterStatus) return false;
    if (filterChannel !== 'all' && item.channel !== filterChannel) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        item.buyerName.toLowerCase().includes(q) ||
        item.itemCode.toLowerCase().includes(q) ||
        item.colour.toLowerCase().includes(q) ||
        (item.buyerContact && item.buyerContact.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!buyerName || !itemCode) return;
    setIsSubmitting(true);
    try {
      await onAddPreOrder({
        buyerName,
        buyerContact,
        itemCode: itemCode.trim().toUpperCase(),
        itemName: itemName.trim().toUpperCase() || itemCode.trim().toUpperCase(),
        size: size.trim().toUpperCase(),
        colour: colour.trim().toUpperCase(),
        quantity: Number(quantity),
        statedUnitPricePhp: Number(statedPrice),
        channel,
        targetStore,
        notes,
      });
      setShowAddModal(false);
      // Reset
      setBuyerName('');
      setBuyerContact('');
      setItemCode('');
      setItemName('');
      setNotes('');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMessengerThread || !replyText.trim() || !onReplyMessenger) return;
    setIsSendingReply(true);
    try {
      await onReplyMessenger(selectedMessengerThread.id, replyText.trim());
      setReplyText('');
    } finally {
      setIsSendingReply(false);
    }
  };

  const getStatusBadge = (status: PreOrder['status']) => {
    switch (status) {
      case 'confirmed':
        return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
      case 'allocated':
        return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
      case 'invoiced':
        return 'bg-purple-500/20 text-purple-300 border-purple-500/30';
      case 'cancelled':
        return 'bg-rose-500/20 text-rose-300 border-rose-500/30';
      default:
        return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
    }
  };

  const getChannelIcon = (ch: PreOrder['channel']) => {
    switch (ch) {
      case 'reels':
        return <Video className="w-3.5 h-3.5 text-pink-400" />;
      case 'vip':
        return <Sparkles className="w-3.5 h-3.5 text-amber-400" />;
      default:
        return <MessageSquare className="w-3.5 h-3.5 text-blue-400" />;
    }
  };

  const totalValuePhp = preOrders
    .filter((p) => p.status !== 'cancelled')
    .reduce((sum, p) => sum + (p.statedUnitPricePhp || 0) * p.quantity, 0);

  return (
    <div className="space-y-6">
      {/* Overview Banner */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-5 pb-4 border-b border-neutral-800">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-gradient-to-tr from-purple-600 to-indigo-600 rounded-xl text-white shadow-md">
                <Layers className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-white tracking-tight">
                    Dedicated Pre-Orders Lane
                  </h2>
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-semibold border border-purple-500/30">
                    Isolated Lane
                  </span>
                </div>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Pre-orders from Messenger, Reels, and VIP catalog are isolated from live orders so store rack quantities are never contaminated.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-purple-950/40 transition"
            >
              <Plus className="w-4 h-4" />
              <span>Create Separate Pre-Order</span>
            </button>
          </div>
        </div>

        {/* Lane Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="p-3.5 bg-neutral-950/70 border border-neutral-800 rounded-xl">
            <span className="text-neutral-400 text-[11px] block">Total Pre-Orders</span>
            <div className="text-2xl font-bold font-mono text-white mt-1">
              {preOrders.length}
            </div>
            <span className="text-[10px] text-neutral-500">Across Messenger & Reels</span>
          </div>

          <div className="p-3.5 bg-amber-950/20 border border-amber-900/30 rounded-xl">
            <span className="text-amber-300 text-[11px] block">Pending Wholesale</span>
            <div className="text-2xl font-bold font-mono text-amber-200 mt-1">
              {preOrders.filter((p) => p.status === 'pending').length}
            </div>
            <span className="text-[10px] text-amber-400/80">Awaiting Bangkok run</span>
          </div>

          <div className="p-3.5 bg-emerald-950/20 border border-emerald-900/30 rounded-xl">
            <span className="text-emerald-300 text-[11px] block">Confirmed / Allocated</span>
            <div className="text-2xl font-bold font-mono text-emerald-200 mt-1">
              {preOrders.filter((p) => p.status === 'confirmed' || p.status === 'allocated').length}
            </div>
            <span className="text-[10px] text-emerald-400/80">Secured at supplier</span>
          </div>

          <div className="p-3.5 bg-purple-950/20 border border-purple-900/30 rounded-xl">
            <span className="text-purple-300 text-[11px] block">Pre-Order Gross PHP</span>
            <div className="text-2xl font-bold font-mono text-purple-200 mt-1">
              ₱{totalValuePhp.toLocaleString()}
            </div>
            <span className="text-[10px] text-purple-400/80">Active pre-order value</span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-neutral-900/90 border border-neutral-800 p-3.5 rounded-xl text-xs">
        <div className="flex items-center gap-2 flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-neutral-500 ml-1" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by buyer, item code, or contact..."
            className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-1.5 text-white placeholder-neutral-500 focus:outline-none focus:border-purple-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-1.5 text-neutral-300 capitalize"
          >
            <option value="all">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="confirmed">Confirmed</option>
            <option value="allocated">Allocated</option>
            <option value="invoiced">Invoiced</option>
            <option value="cancelled">Cancelled</option>
          </select>

          <select
            value={filterChannel}
            onChange={(e) => setFilterChannel(e.target.value)}
            className="bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-1.5 text-neutral-300 capitalize"
          >
            <option value="all">All Channels</option>
            <option value="messenger">Messenger</option>
            <option value="reels">Facebook Reels</option>
            <option value="vip">VIP Messenger</option>
            <option value="post">Post Comment</option>
          </select>
        </div>
      </div>

      {/* Pre-Orders List */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-12 text-center text-neutral-400 text-xs">
            <ShoppingBag className="w-10 h-10 mx-auto text-neutral-600 mb-2" />
            <p className="font-semibold text-neutral-300">No pre-orders found in this filter.</p>
            <p className="text-neutral-500 mt-1">Pre-orders remain strictly separated from live stream inventory.</p>
          </div>
        ) : (
          filtered.map((item) => (
            <div
              key={item.id}
              className="bg-neutral-900 border border-neutral-800 hover:border-neutral-700/80 rounded-2xl p-4 transition shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4"
            >
              {/* Item Info */}
              <div className="flex items-start gap-3.5">
                <div className="p-2.5 rounded-xl bg-purple-950/40 border border-purple-800/40 text-purple-400 shrink-0">
                  {getChannelIcon(item.channel)}
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="font-bold text-white text-sm tracking-tight">
                      {item.buyerName}
                    </h4>
                    {item.buyerContact && (
                      <span className="text-[10px] text-neutral-400 font-mono">
                        ({item.buyerContact})
                      </span>
                    )}
                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${getStatusBadge(item.status)} uppercase font-bold`}>
                      {item.status}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-neutral-800 text-neutral-300 font-mono">
                      v{item.version || 1}
                    </span>
                    {item.overrideHistory && item.overrideHistory.length > 0 && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 flex items-center gap-1 font-semibold">
                        <ShieldAlert className="w-3 h-3" />
                        Owner Overridden ({item.overrideHistory.length})
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-3 text-xs mt-1.5 text-neutral-300">
                    <span className="font-mono font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                      {item.itemCode}
                    </span>
                    <span className="text-white font-medium">{item.itemName}</span>
                    <span className="text-neutral-500">&bull;</span>
                    <span className="font-mono bg-neutral-800 px-1.5 py-0.5 rounded text-neutral-200">
                      {item.size}
                    </span>
                    <span className="font-mono bg-neutral-800 px-1.5 py-0.5 rounded text-neutral-200">
                      {item.colour}
                    </span>
                    <span className="text-neutral-500">&bull;</span>
                    <span>Qty: <strong className="text-white font-mono">{item.quantity}</strong></span>
                    <span className="text-neutral-500">&bull;</span>
                    <span className="font-mono text-emerald-400 font-bold">₱{(item.statedUnitPricePhp || 0) * item.quantity}</span>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 text-[11px] text-neutral-400 mt-2">
                    <span className="flex items-center gap-1">
                      <Store className="w-3 h-3 text-neutral-500" />
                      Target: {item.targetStore || 'Pratunam Market Wholesale'}
                    </span>
                    <span>&bull;</span>
                    <span>Created: {new Date(item.createdAt).toLocaleDateString()}</span>
                    {item.notes && (
                      <>
                        <span>&bull;</span>
                        <span className="italic text-neutral-400">"{item.notes}"</span>
                      </>
                    )}
                  </div>

                  {/* Snapshot of Messenger Inbox in Pre-Orders Lane (Requirement 2C) */}
                  {(() => {
                    const matchingThread = messengerThreads.find(
                      (t) => t.buyerName.toLowerCase() === item.buyerName.toLowerCase() ||
                             (item.buyerContact && (t.psid === item.buyerContact || item.buyerContact.includes(t.psid)))
                    );

                    if (item.channel !== 'messenger' && !matchingThread) return null;

                    const lastMsg = matchingThread?.messages?.[matchingThread.messages.length - 1];

                    return (
                      <div className="mt-3 p-3 bg-neutral-950/90 rounded-xl border border-sky-500/40 text-xs space-y-2 max-w-xl">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 font-bold text-sky-300 text-[11px]">
                            <MessageSquare className="w-3.5 h-3.5 text-sky-400" />
                            <span>Business Messenger Inbox Snapshot · Order Source</span>
                          </div>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono">
                            24h Window Active
                          </span>
                        </div>

                        <div className="bg-neutral-900/80 rounded-lg p-2.5 border border-neutral-800 text-[11px] text-neutral-300">
                          <div className="text-[10px] text-neutral-500 mb-0.5 font-mono">
                            Latest Customer Inquiry / Order Message:
                          </div>
                          <div className="italic text-sky-200">
                            "{lastMsg?.text || item.notes || `Hi sis! Pa-preorder po ako ng ${item.itemCode} (${item.size} ${item.colour}) please.`}"
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-[10px] text-neutral-400 font-mono">
                          <span>PSID: {matchingThread?.psid || item.buyerContact || 'Page Connected PSID'}</span>
                          <button
                            type="button"
                            onClick={() => setSelectedMessengerThread(matchingThread || {
                              id: `th_pre_${item.id}`,
                              psid: item.buyerContact || `psid_${item.id}`,
                              buyerName: item.buyerName,
                              buyerHandle: `fb.com/${item.buyerName}`,
                              windowExpiresAt: new Date(Date.now() + 24 * 3600000).toISOString(),
                              unreadCount: 0,
                              messages: [
                                {
                                  id: `m_pre_${item.id}`,
                                  mid: `m_pre_${item.id}`,
                                  sender: 'buyer',
                                  text: item.notes || `Pre-order inquiry for ${item.itemCode} (${item.size} ${item.colour})`,
                                  timestamp: item.createdAt,
                                }
                              ]
                            })}
                            className="text-sky-400 hover:text-sky-300 font-semibold flex items-center gap-1 underline"
                          >
                            <span>Open Messenger Conversation Thread</span>
                            <ArrowRight className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* Actions & Override Button */}
              <div className="flex items-center gap-2 self-end md:self-center shrink-0">
                {/* Status Quick Toggle */}
                <select
                  value={item.status}
                  onChange={(e) => onUpdateStatus(item.id, e.target.value as PreOrder['status'])}
                  className="bg-neutral-950 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-neutral-200 text-xs font-medium focus:border-purple-500"
                >
                  <option value="pending">Pending</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="allocated">Allocated</option>
                  <option value="invoiced">Invoiced</option>
                  <option value="cancelled">Cancelled</option>
                </select>

                {/* Owner / Admin Full Override Power */}
                <button
                  onClick={() => onOpenOverride(item, true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-rose-300 border border-rose-500/30 hover:border-rose-500 rounded-lg text-xs font-semibold transition"
                  title="Full Executive Override Power (Owner/Admin)"
                >
                  <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
                  <span>Owner Override</span>
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add Pre-Order Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-neutral-900 border border-neutral-700 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
            <div className="p-4 bg-gradient-to-r from-purple-950/60 to-neutral-900 border-b border-neutral-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-purple-400" />
                <h3 className="font-bold text-white text-sm">
                  Create Separate Pre-Order
                </h3>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-neutral-400 hover:text-white"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="p-5 space-y-3.5 text-xs">
              <div className="p-3 bg-purple-950/20 border border-purple-500/30 rounded-xl text-neutral-300 text-[11px]">
                Pre-orders are saved to the isolated pre-order collection. They do not alter or consume live broadcast rack inventory.
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-neutral-400 mb-1">Buyer Name *</label>
                  <input
                    type="text"
                    required
                    value={buyerName}
                    onChange={(e) => setBuyerName(e.target.value)}
                    placeholder="e.g. Donna Cruz"
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-1.5 text-white focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-neutral-400 mb-1">Contact / Messenger Handle</label>
                  <input
                    type="text"
                    value={buyerContact}
                    onChange={(e) => setBuyerContact(e.target.value)}
                    placeholder="e.g. @donnacruz / 0917-xxx"
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-1.5 text-white focus:border-purple-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-neutral-400 mb-1">Item Code *</label>
                  <input
                    type="text"
                    required
                    value={itemCode}
                    onChange={(e) => setItemCode(e.target.value)}
                    placeholder="BP01"
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-1.5 text-white uppercase font-mono font-bold focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-neutral-400 mb-1">Size *</label>
                  <input
                    type="text"
                    required
                    value={size}
                    onChange={(e) => setSize(e.target.value)}
                    placeholder="3XL"
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-1.5 text-white uppercase font-mono font-bold focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-neutral-400 mb-1">Colour *</label>
                  <input
                    type="text"
                    required
                    value={colour}
                    onChange={(e) => setColour(e.target.value)}
                    placeholder="MAROON"
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-1.5 text-white uppercase font-medium focus:border-purple-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-neutral-400 mb-1">Quantity</label>
                  <input
                    type="number"
                    min="1"
                    value={quantity}
                    onChange={(e) => setQuantity(Number(e.target.value))}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-1.5 text-white font-mono font-bold focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-neutral-400 mb-1">Price (PHP)</label>
                  <input
                    type="number"
                    value={statedPrice}
                    onChange={(e) => setStatedPrice(Number(e.target.value))}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-1.5 text-white font-mono font-bold focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-neutral-400 mb-1">Source Channel</label>
                  <select
                    value={channel}
                    onChange={(e) => setChannel(e.target.value as PreOrder['channel'])}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-1.5 text-white capitalize focus:border-purple-500"
                  >
                    <option value="messenger">Messenger</option>
                    <option value="reels">Facebook Reels</option>
                    <option value="vip">VIP Messenger</option>
                    <option value="post">Post Comment</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-neutral-400 mb-1">Target Sourcing Store</label>
                <input
                  type="text"
                  value={targetStore}
                  onChange={(e) => setTargetStore(e.target.value)}
                  placeholder="e.g. Pratunam Soi 3 / Platinum Fashion Mall"
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-1.5 text-white focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-neutral-400 mb-1">Notes / Instructions</label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Buyer willing to wait for next Bangkok shipment, preferred Mariveles pickup..."
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-lg p-2.5 text-white focus:border-purple-500"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 bg-neutral-800 text-neutral-300 rounded-xl font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl font-bold shadow-lg shadow-purple-950/40"
                >
                  {isSubmitting ? 'Saving...' : 'Add Pre-Order'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Synced Messenger Thread Snapshot Modal (Requirement 2C) */}
      {selectedMessengerThread && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-neutral-700 rounded-2xl max-w-lg w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-sky-400" />
                <div>
                  <h3 className="font-bold text-sm text-white">{selectedMessengerThread.buyerName}</h3>
                  <div className="text-[10px] text-neutral-400 font-mono">PSID: {selectedMessengerThread.psid}</div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedMessengerThread(null)}
                className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 bg-neutral-950 rounded-xl border border-neutral-800 max-h-72 overflow-y-auto space-y-2 text-xs">
              {selectedMessengerThread.messages.map((m) => (
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

            <form onSubmit={handleSendReply} className="flex gap-2 pt-2 border-t border-neutral-800">
              <input
                type="text"
                placeholder="Reply to customer via Business Messenger..."
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                className="flex-1 bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder:text-neutral-500 focus:border-purple-500"
              />
              <button
                type="submit"
                disabled={isSendingReply || !replyText.trim()}
                className="px-3.5 py-1.5 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white font-semibold rounded-lg text-xs flex items-center gap-1 transition"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{isSendingReply ? 'Sending...' : 'Reply'}</span>
              </button>
            </form>

            <div className="flex items-center justify-between pt-2 border-t border-neutral-800 text-xs">
              <span className="text-[11px] text-emerald-400 flex items-center gap-1 font-mono">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                24h Messaging Window Active
              </span>
              <button
                type="button"
                onClick={() => setSelectedMessengerThread(null)}
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
