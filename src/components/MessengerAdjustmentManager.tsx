import React, { useState } from 'react';
import {
  MessageSquare,
  ArrowRightLeft,
  CheckCircle2,
  Clock,
  Plus,
  ShieldCheck,
  User,
  Sparkles,
  ArrowRight,
  Send,
  Zap,
  Inbox,
  FileText,
  ExternalLink,
  Search,
} from 'lucide-react';
import { OrderAmendment, BuyerOrder, MessengerThread, PreOrder, ReconciliationSummary } from '../types/reconciliation';
import { SEED_MESSENGER_THREADS } from '../data/seedData';

interface MessengerAdjustmentManagerProps {
  amendments: OrderAmendment[];
  orders: BuyerOrder[];
  messengerThreads?: MessengerThread[];
  summary?: ReconciliationSummary | null;
  onSubmitAmendment: (amendment: {
    originalOrderId: string;
    buyerName: string;
    channel: 'live_chat' | 'messenger' | 'vip';
    type: 'size_change' | 'colour_change' | 'quantity_change' | 'item_replacement' | 'cancellation';
    newSpec: {
      itemCode: string;
      size: string;
      colour: string;
      quantity: number;
    };
    rawText: string;
  }) => void;
  onReplyMessenger?: (threadId: string, text: string) => Promise<void>;
  onSimulateMessengerDm?: (buyerName: string, text: string) => Promise<void>;
  onRoutePreOrder?: (preOrderData: Partial<PreOrder>) => Promise<void>;
}

export const MessengerAdjustmentManager: React.FC<MessengerAdjustmentManagerProps> = ({
  amendments,
  orders,
  messengerThreads = SEED_MESSENGER_THREADS,
  summary,
  onSubmitAmendment,
  onReplyMessenger,
  onRoutePreOrder,
}) => {
  const [showModal, setShowModal] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState('');
  const [channel, setChannel] = useState<'messenger' | 'live_chat' | 'vip'>('messenger');
  const [type, setType] = useState<'size_change' | 'colour_change' | 'item_replacement' | 'cancellation'>('size_change');
  const [newSize, setNewSize] = useState('3XL');
  const [newColour, setNewColour] = useState('MAROON');
  const [newItemCode, setNewItemCode] = useState('');
  const [rawText, setRawText] = useState('');

  // Business Messenger Inbox state
  const [activeThreadId, setActiveThreadId] = useState<string>(messengerThreads[0]?.id || '');
  const [searchQuery, setSearchQuery] = useState('');
  const [replyText, setReplyText] = useState('');
  const [isSendingReply, setIsSendingReply] = useState(false);

  // Real-time sorting: threads with the latest incoming message are always at the top!
  const sortedThreads = [...messengerThreads].sort((a, b) => {
    const aLast = a.messages && a.messages.length > 0 ? a.messages[a.messages.length - 1] : null;
    const bLast = b.messages && b.messages.length > 0 ? b.messages[b.messages.length - 1] : null;
    const aTime = aLast?.timestamp ? new Date(aLast.timestamp).getTime() : new Date(a.windowExpiresAt || 0).getTime() - 24 * 3600 * 1000;
    const bTime = bLast?.timestamp ? new Date(bLast.timestamp).getTime() : new Date(b.windowExpiresAt || 0).getTime() - 24 * 3600 * 1000;
    return bTime - aTime;
  });

  const filteredThreads = sortedThreads.filter((t) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    const nameMatch = t.buyerName.toLowerCase().includes(q);
    const msgMatch = (t.messages || []).some((m) => m.text.toLowerCase().includes(q));
    const handleMatch = (t.buyerHandle || '').toLowerCase().includes(q);
    return nameMatch || msgMatch || handleMatch;
  });

  const selectedOrder = orders.find((o) => o.id === selectedOrderId);
  const activeThread = filteredThreads.find((t) => t.id === activeThreadId) || filteredThreads[0] || sortedThreads[0];

  const getHoursRemaining = (iso: string) => {
    const diffMs = new Date(iso).getTime() - Date.now();
    return Math.max(0, Math.round((diffMs / 3600000) * 10) / 10);
  };

  const handleSendReply = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    if (!activeThread || !replyText.trim()) return;
    setIsSendingReply(true);
    try {
      if (onReplyMessenger) {
        await onReplyMessenger(activeThread.id, replyText.trim());
      }
      setReplyText('');
    } finally {
      setIsSendingReply(false);
    }
  };

  const handleApplyDetectedIntent = async (thread: MessengerThread) => {
    const intent = thread.detectedIntent;
    if (!intent) return;

    if (intent.type === 'pre_order' && intent.suggestedSpec && onRoutePreOrder) {
      await onRoutePreOrder({
        buyerName: thread.buyerName,
        buyerContact: thread.buyerHandle,
        itemCode: intent.suggestedSpec.itemCode,
        itemName: `${intent.suggestedSpec.itemCode} Messenger Pre-Order`,
        size: intent.suggestedSpec.size,
        colour: intent.suggestedSpec.colour,
        quantity: intent.suggestedSpec.quantity || 1,
        statedUnitPricePhp: 2290,
        channel: 'messenger',
        notes: `Auto-routed from Business Messenger DM (${thread.psid})`,
      });
      if (onReplyMessenger) {
        await onReplyMessenger(
          thread.id,
          `Hi Sis ${thread.buyerName}! Confirmed & routed your ${intent.suggestedSpec.itemCode} (${intent.suggestedSpec.size} ${intent.suggestedSpec.colour}) to our Dedicated Pre-Orders Lane so it stays separate from today's live rack.`
        );
      }
      return;
    }

    if (intent.type === 'invoice_inquiry') {
      const bag = summary?.buyerBags.find((b) => b.buyerName.toLowerCase() === thread.buyerName.toLowerCase());
      const draft = bag
        ? `Hi Sis ${thread.buyerName}! Your reconciled final bag has ${bag.totalPiecesGot} verified pc(s) totaling ₱${bag.subtotalPhp.toLocaleString('en-PH')} PHP (Zero-Refund Verified). Ready for checkout!`
        : `Hi Sis ${thread.buyerName}! Your order is currently undergoing final Pratunam rack verification. We will release your verified invoice link as soon as Owner sign-off completes!`;
      setReplyText(draft);
      return;
    }

    // Match linked order or find by buyerName
    const targetOrd =
      orders.find((o) => o.id === thread.linkedOrderId) ||
      orders.find((o) => o.buyerName.toLowerCase() === thread.buyerName.toLowerCase());

    if (targetOrd && intent.suggestedSpec) {
      const lastBuyerMsg =
        [...thread.messages].reverse().find((m) => m.sender === 'buyer')?.text || intent.summary;
      onSubmitAmendment({
        originalOrderId: targetOrd.id,
        buyerName: targetOrd.buyerName,
        channel: 'messenger',
        type:
          intent.type === 'cancellation'
            ? 'cancellation'
            : intent.type === 'colour_change'
            ? 'colour_change'
            : intent.type === 'item_replacement'
            ? 'item_replacement'
            : 'size_change',
        newSpec: {
          itemCode: intent.suggestedSpec.itemCode || targetOrd.itemCode,
          size: intent.suggestedSpec.size || targetOrd.size,
          colour: intent.suggestedSpec.colour || targetOrd.colour,
          quantity: intent.suggestedSpec.quantity || targetOrd.quantity,
        },
        rawText: lastBuyerMsg,
      });

      if (onReplyMessenger) {
        await onReplyMessenger(
          thread.id,
          `Noted Sis ${thread.buyerName}! Na-update na po namin ang live bag mo to ${intent.suggestedSpec.itemCode} (${intent.suggestedSpec.size} ${intent.suggestedSpec.colour}) at naka-sync na sa Pratunam store buying sheet!`
        );
      }
    }
  };

  const handleSubmit = (e: React.SyntheticEvent) => {
    e.preventDefault();
    if (!selectedOrderId || !selectedOrder) return;

    onSubmitAmendment({
      originalOrderId: selectedOrderId,
      buyerName: selectedOrder.buyerName,
      channel,
      type,
      newSpec: {
        itemCode: newItemCode || selectedOrder.itemCode,
        size: newSize,
        colour: newColour,
        quantity: selectedOrder.quantity,
      },
      rawText: rawText || `Customer requested ${type} in ${channel}`,
    });

    setShowModal(false);
    setSelectedOrderId('');
    setRawText('');
  };

  return (
    <div className="space-y-6">
      {/* Header Banner & Gap-Closing Architecture explanation */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4 pb-3 border-b border-neutral-800">
          <div>
            <div className="flex items-center gap-2">
              <ArrowRightLeft className="w-5 h-5 text-rose-400" />
              <h2 className="text-lg font-bold text-white tracking-tight">
                Business Messenger Live Inbox & Order Adjustment Ledger
              </h2>
              <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 font-bold">
                Meta Graph API v22.0 + pages_messaging
              </span>
            </div>
            <p className="text-xs text-neutral-400 mt-1">
              Direct in-portal Business Messenger access with automated intent detection, 24h policy window tracking, and 1-click store rack demand sync.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowModal(true)}
              className="flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-semibold shadow-lg transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Log Manual Adjustment</span>
            </button>
          </div>
        </div>

        {/* How this closes the gap summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs pt-1">
          <div className="p-3 rounded-xl bg-neutral-950/80 border border-neutral-800">
            <strong className="text-amber-300 block mb-1">1. Traceable Replacement</strong>
            <p className="text-neutral-400">
              When a buyer changes size or color in Messenger, the original order is marked <em>replaced</em> and immediately decoupled from demand.
            </p>
          </div>

          <div className="p-3 rounded-xl bg-neutral-950/80 border border-neutral-800">
            <strong className="text-emerald-300 block mb-1">2. Comment + DM Idempotency</strong>
            <p className="text-neutral-400">
              Prevents double-booking when buyers comment &ldquo;MINE&rdquo; on Facebook Live and follow up via Business Messenger inbox.
            </p>
          </div>

          <div className="p-3 rounded-xl bg-neutral-950/80 border border-neutral-800">
            <strong className="text-purple-300 block mb-1">3. 24-Hour Meta Policy Guard</strong>
            <p className="text-neutral-400">
              Tracks Meta&apos;s 24h standard messaging reply window per buyer thread so reconciled invoices are dispatched before window expiry.
            </p>
          </div>
        </div>
      </div>

      {/* In-Portal Business Messenger Live Inbox */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Thread List (5 cols) */}
        <div className="lg:col-span-5 bg-neutral-900 border border-neutral-800 rounded-2xl p-4 shadow-xl flex flex-col">
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-neutral-800">
            <div className="flex items-center gap-2">
              <Inbox className="w-4 h-4 text-blue-400" />
              <h3 className="font-bold text-sm text-white">
                Page Business Messenger Inbox ({messengerThreads.length})
              </h3>
            </div>
            <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-2 py-0.5 rounded-full">
              Webhook Connected
            </span>
          </div>

          {/* Real-time Messenger Buyer Search Bar */}
          <div className="relative mb-3">
            <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search buyer name or message (e.g. Bracx)..."
              className="w-full bg-neutral-950 border border-neutral-700/80 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-blue-500 transition"
            />
          </div>

          <div className="space-y-2.5 overflow-y-auto max-h-[430px] pr-1">
            {filteredThreads.length === 0 ? (
              <div className="p-6 text-center text-xs text-neutral-500 bg-neutral-950 rounded-xl border border-neutral-800">
                {searchQuery ? `No buyer matches for "${searchQuery}"` : 'No Business Messenger threads synced yet.'}
              </div>
            ) : (
              filteredThreads.map((thread) => {
              const isSelected = activeThread?.id === thread.id;
              const hrsLeft = getHoursRemaining(thread.windowExpiresAt);
              const lastMsg = thread.messages[thread.messages.length - 1];

              return (
                <button
                  key={thread.id}
                  type="button"
                  onClick={() => setActiveThreadId(thread.id)}
                  className={`w-full text-left p-3.5 rounded-xl border transition space-y-2 ${
                    isSelected
                      ? 'bg-blue-950/30 border-blue-500/50 shadow-md'
                      : 'bg-neutral-950 border-neutral-800 hover:border-neutral-700'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-white">{thread.buyerName}</span>
                      {thread.unreadCount > 0 && (
                        <span className="px-1.5 py-0.5 text-[10px] font-bold bg-rose-600 text-white rounded-full">
                          {thread.unreadCount} new
                        </span>
                      )}
                    </div>
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded-full flex items-center gap-1 ${
                        hrsLeft < 6
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          : 'bg-neutral-800 text-neutral-400'
                      }`}
                    >
                      <Clock className="w-2.5 h-2.5" />
                      {hrsLeft}h window
                    </span>
                  </div>

                  {thread.detectedIntent && (
                    <div className="flex items-center gap-1.5 text-[10px] font-mono">
                      <span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30 font-semibold">
                        AI Triage: {thread.detectedIntent.type.replace('_', ' ').toUpperCase()}
                      </span>
                      {thread.detectedIntent.suggestedSpec && (
                        <span className="text-emerald-300 font-bold">
                          → {thread.detectedIntent.suggestedSpec.itemCode} ({thread.detectedIntent.suggestedSpec.size}{' '}
                          {thread.detectedIntent.suggestedSpec.colour})
                        </span>
                      )}
                    </div>
                  )}

                  {lastMsg && (
                    <p className="text-xs text-neutral-400 truncate">
                      {lastMsg.sender === 'page_agent' ? 'You: ' : ''}
                      {lastMsg.text}
                    </p>
                  )}
                </button>
              );
            })
            )}
          </div>
        </div>

        {/* Right: Active Thread Conversation & 1-Click Action Bar (7 cols) */}
        <div className="lg:col-span-7 bg-neutral-900 border border-neutral-800 rounded-2xl p-5 shadow-xl flex flex-col justify-between">
          {activeThread ? (
            <>
              {/* Conversation Header */}
              <div className="pb-3 mb-3 border-b border-neutral-800 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-sm text-white">{activeThread.buyerName}</h4>
                      <span className="text-[11px] font-mono text-neutral-400">
                        PSID: {activeThread.psid}
                      </span>
                    </div>
                    <p className="text-[11px] text-neutral-500">{activeThread.buyerHandle}</p>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono px-2.5 py-1 rounded-lg bg-neutral-950 border border-neutral-800 text-neutral-300">
                      24h Meta Window: <strong className="text-emerald-400">{getHoursRemaining(activeThread.windowExpiresAt)}h remaining</strong>
                    </span>
                  </div>
                </div>

                {/* AI Auto-Triage Action Banner */}
                {activeThread.detectedIntent && (
                  <div className="p-3 rounded-xl bg-gradient-to-r from-blue-950/60 via-neutral-950 to-purple-950/60 border border-blue-500/40 flex flex-wrap items-center justify-between gap-3">
                    <div className="space-y-0.5 text-xs">
                      <div className="flex items-center gap-1.5 font-bold text-blue-300">
                        <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                        <span>
                          Auto-Detected Messenger Intent ({Math.round(activeThread.detectedIntent.confidence * 100)}% match)
                        </span>
                      </div>
                      <p className="text-neutral-300 text-[11px]">{activeThread.detectedIntent.summary}</p>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleApplyDetectedIntent(activeThread)}
                      className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-lg flex items-center gap-1.5 transition shrink-0"
                    >
                      <Zap className="w-3.5 h-3.5" />
                      <span>
                        {activeThread.detectedIntent.type === 'pre_order'
                          ? 'Route to Pre-Orders Lane'
                          : activeThread.detectedIntent.type === 'invoice_inquiry'
                          ? 'Draft Reconciled Invoice Reply'
                          : '1-Click Apply Spec Swap & Reply'}
                      </span>
                    </button>
                  </div>
                )}
              </div>

              {/* Message History */}
              <div className="space-y-3 overflow-y-auto max-h-[260px] pr-1 my-2">
                {activeThread.messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${
                      msg.sender === 'page_agent' ? 'items-end' : 'items-start'
                    }`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs ${
                        msg.sender !== 'page_agent'
                          ? 'bg-neutral-950 border border-neutral-800 text-neutral-200'
                          : msg.deliveryStatus === 'failed' || msg.deliveryStatus === 'not_sent'
                          ? 'bg-neutral-800 text-neutral-100 border border-amber-500/60'
                          : msg.deliveryStatus === 'sending'
                          ? 'bg-rose-600/60 text-white'
                          : 'bg-rose-600 text-white'
                      }`}
                    >
                      <p>{msg.text}</p>
                    </div>
                    <span className="text-[10px] text-neutral-500 font-mono mt-1 px-1">
                      {msg.sender === 'page_agent' ? 'Page Admin' : activeThread.buyerName} ·{' '}
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      {msg.sender === 'page_agent' && msg.deliveryStatus === 'sending' && ' · Sending…'}
                      {msg.sender === 'page_agent' && msg.deliveryStatus === 'sent' && (
                        <span className="text-emerald-400"> · ✓ Delivered</span>
                      )}
                    </span>
                    {msg.sender === 'page_agent' && (msg.deliveryStatus === 'failed' || msg.deliveryStatus === 'not_sent') && (
                      <span className="text-[10px] text-amber-400 mt-0.5 px-1 max-w-[85%] text-right">
                        {msg.deliveryStatus === 'failed' ? '⚠ Not delivered' : '⚠ Not sent to Messenger (saved here only)'}
                        {msg.deliveryDetail ? ` — ${msg.deliveryDetail}` : ''} · use Open in Messenger
                      </span>
                    )}
                  </div>
                ))}
              </div>

              {/* Reply Composer */}
              <form onSubmit={handleSendReply} className="pt-3 border-t border-neutral-800 space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    name="messengerReply"
                    aria-label="Reply to buyer on Business Messenger"
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder={`Reply to ${activeThread.buyerName} via Business Messenger...`}
                    className="flex-1 bg-neutral-950 border border-neutral-700 rounded-xl px-3.5 py-2 text-xs text-white"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const bag = summary?.buyerBags.find(
                        (b) => b.buyerName.toLowerCase() === activeThread.buyerName.toLowerCase()
                      );
                      setReplyText(
                        bag?.suggestedMessageDraft ||
                          `Hi Sis ${activeThread.buyerName}! Reconciled bag confirmed (${bag?.totalPiecesGot || 1} pcs = ₱${(bag?.subtotalPhp || 0).toLocaleString('en-PH')} PHP).`
                      );
                    }}
                    title="Insert Reconciled Bag Summary"
                    className="px-3 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-xl text-xs font-semibold flex items-center gap-1 transition"
                  >
                    <FileText className="w-3.5 h-3.5 text-amber-400" />
                    <span>Insert Invoice</span>
                  </button>
                  <button
                    type="submit"
                    disabled={isSendingReply || !replyText.trim()}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Send DM</span>
                  </button>
                  <a
                    href={
                      activeThread.buyerHandle && activeThread.buyerHandle.includes('m.me')
                        ? activeThread.buyerHandle
                        : activeThread.psid && /^\d{8,}$/.test(activeThread.psid)
                        ? `https://m.me/${activeThread.psid}`
                        : `https://business.facebook.com/latest/inbox/messenger?asset_id=109603071381200`
                    }
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => {
                      if (replyText.trim()) {
                        navigator.clipboard.writeText(replyText.trim());
                      }
                    }}
                    title="Open Facebook Messenger directly (copies message text to clipboard)"
                    className="px-3 py-2 bg-neutral-800 hover:bg-neutral-700 text-sky-400 border border-neutral-700 hover:border-sky-500 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition whitespace-nowrap"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>Open in Messenger</span>
                    <ExternalLink className="w-3 h-3 opacity-70" />
                  </a>
                </div>
              </form>
            </>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 text-xs text-neutral-500">
              <MessageSquare className="w-8 h-8 text-neutral-700 mb-2" />
              <p className="font-semibold text-neutral-300">Business Messenger Inbox Ready</p>
              <p className="mt-1 max-w-md">
                Connect your Facebook Page Access Token in <strong>Live Session Command</strong> to pull real buyer messages from this morning&apos;s live broadcast, or incoming messages will appear automatically via <code className="text-neutral-400">/api/meta/webhook</code>.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Adjustments Queue List */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-neutral-800">
          <h3 className="font-bold text-sm text-white">
            Recorded Customer Amendments ({amendments.length})
          </h3>
          <span className="text-xs text-neutral-500">Live & Post-Live Multi-Channel Feed</span>
        </div>

        <div className="space-y-3">
          {amendments.map((am) => (
            <div
              key={am.id}
              className="p-4 rounded-xl bg-neutral-950 border border-neutral-800 hover:border-neutral-700 transition space-y-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-rose-400" />
                  <span className="font-bold text-sm text-white">{am.buyerName}</span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      am.channel === 'messenger'
                        ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                        : am.channel === 'vip'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                        : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                    }`}
                  >
                    via{' '}
                    {am.channel === 'messenger'
                      ? 'Business Messenger'
                      : am.channel === 'vip'
                      ? 'VIP Channel'
                      : 'Live Chat'}
                  </span>
                  <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-neutral-800 text-neutral-300">
                    {am.type.replace('_', ' ')}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1 ${
                      am.status === 'applied'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    }`}
                  >
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                    <span>{am.status.toUpperCase()}</span>
                  </span>
                  <span className="text-xs text-neutral-500 font-mono">
                    {new Date(am.requestedAt).toLocaleTimeString()}
                  </span>
                </div>
              </div>

              {/* Spec Comparison: Original Spec -> New Spec */}
              <div className="flex flex-wrap items-center gap-4 text-xs bg-neutral-900/80 p-3 rounded-lg border border-neutral-850">
                <div className="space-y-0.5">
                  <span className="text-neutral-500 text-[10px] block">ORIGINAL LIVE CLAIM:</span>
                  <span className="font-mono text-neutral-300 line-through">
                    {am.originalSpec.itemCode} · {am.originalSpec.size} · {am.originalSpec.colour} (×
                    {am.originalSpec.quantity})
                  </span>
                </div>

                <ArrowRight className="w-4 h-4 text-rose-400 shrink-0" />

                <div className="space-y-0.5">
                  <span className="text-[10px] block font-semibold text-emerald-400">
                    RECONCILED DEMAND SPEC:
                  </span>
                  <span className="font-mono font-bold text-white">
                    {am.newSpec.itemCode} · {am.newSpec.size} · {am.newSpec.colour} (×
                    {am.newSpec.quantity})
                  </span>
                </div>
              </div>

              {/* Customer's Raw Words */}
              <div className="text-xs text-neutral-300 italic bg-neutral-900/40 p-2.5 rounded-lg border border-neutral-850">
                &ldquo;{am.rawText}&rdquo;
              </div>

              {am.resolutionNote && (
                <div className="text-[11px] text-neutral-500 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Audit Trail: {am.resolutionNote}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Manual Amendment Log Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
              <h3 className="font-bold text-base text-white flex items-center gap-2">
                <ArrowRightLeft className="w-4 h-4 text-rose-400" />
                <span>Log Order Adjustment</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="text-neutral-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3 text-xs">
              <div>
                <label className="text-neutral-400 block mb-1">Select Buyer & Existing Claim</label>
                <select
                  required
                  name="selectedOrderId"
                  aria-label="Select Buyer and Existing Claim"
                  value={selectedOrderId}
                  onChange={(e) => {
                    setSelectedOrderId(e.target.value);
                    const ord = orders.find((o) => o.id === e.target.value);
                    if (ord) {
                      setNewItemCode(ord.itemCode);
                      setNewSize(ord.size);
                      setNewColour(ord.colour);
                    }
                  }}
                  className="w-full bg-neutral-950 border border-neutral-700 rounded-lg p-2.5 text-white"
                >
                  <option value="">Choose an order to modify...</option>
                  {orders.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.buyerName} — {o.itemCode} ({o.size} {o.colour}) [₱{o.statedUnitPricePhp}]
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-neutral-400 block mb-1">Channel Received</label>
                  <select
                    name="channel"
                    aria-label="Channel Received"
                    value={channel}
                    onChange={(e) => setChannel(e.target.value as any)}
                    className="w-full bg-neutral-950 border border-neutral-700 rounded-lg p-2.5 text-white"
                  >
                    <option value="messenger">Business Messenger (Page Inbox)</option>
                    <option value="live_chat">Live Chat Comment (During Live)</option>
                    <option value="vip">VIP Personal Message</option>
                  </select>
                </div>

                <div>
                  <label className="text-neutral-400 block mb-1">Adjustment Type</label>
                  <select
                    name="adjustmentType"
                    aria-label="Adjustment Type"
                    value={type}
                    onChange={(e) => setType(e.target.value as any)}
                    className="w-full bg-neutral-950 border border-neutral-700 rounded-lg p-2.5 text-white"
                  >
                    <option value="size_change">Size Change</option>
                    <option value="colour_change">Colour Change</option>
                    <option value="item_replacement">Item Replacement</option>
                    <option value="cancellation">Cancellation</option>
                  </select>
                </div>
              </div>

              {type !== 'cancellation' && (
                <div className="grid grid-cols-3 gap-3 p-3 bg-neutral-950 rounded-xl border border-neutral-800">
                  <div>
                    <label className="text-neutral-400 block mb-1">New Item Code</label>
                    <input
                      type="text"
                      name="newItemCode"
                      aria-label="New Item Code"
                      value={newItemCode}
                      onChange={(e) => setNewItemCode(e.target.value.toUpperCase())}
                      placeholder={selectedOrder?.itemCode || 'BP01'}
                      className="w-full bg-neutral-900 border border-neutral-700 rounded-lg p-2 text-white font-mono"
                    />
                  </div>

                  <div>
                    <label className="text-neutral-400 block mb-1">New Size</label>
                    <select
                      name="newSize"
                      aria-label="New Size"
                      value={newSize}
                      onChange={(e) => setNewSize(e.target.value)}
                      className="w-full bg-neutral-900 border border-neutral-700 rounded-lg p-2 text-white"
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
                    <label className="text-neutral-400 block mb-1">New Colour</label>
                    <input
                      type="text"
                      name="newColour"
                      aria-label="New Colour"
                      value={newColour}
                      onChange={(e) => setNewColour(e.target.value.toUpperCase())}
                      placeholder="e.g. STONE"
                      className="w-full bg-neutral-900 border border-neutral-700 rounded-lg p-2 text-white"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="text-neutral-400 block mb-1">
                  Customer&apos;s Raw Message / Screenshot Context
                </label>
                <textarea
                  rows={2}
                  required
                  name="rawText"
                  aria-label="Customer Raw Message"
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                  placeholder="Paste message (e.g. 'Sis palitan ko po ng 3XL masikip pala 2XL')"
                  className="w-full bg-neutral-950 border border-neutral-700 rounded-lg p-2.5 text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-neutral-800">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!selectedOrderId}
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-bold rounded-xl"
                >
                  Apply & Recalculate Demand
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
