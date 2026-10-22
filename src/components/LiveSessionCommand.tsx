import React, { useState, useEffect } from 'react';
import { 
  Square, 
  RotateCcw, 
  Sparkles, 
  AlertTriangle, 
  ArrowRightLeft, 
  MessageSquare, 
  Plus, 
  ExternalLink,
  ChevronRight,
  Activity,
  RefreshCw,
  Send,
  Terminal,
  Clock,
  User,
  Check,
  CheckCircle2,
  MessageCircle,
} from 'lucide-react';
import { 
  LiveSession, 
  BuyerOrder, 
  InventoryItem, 
  ReconciliationSummary,
  MessengerThread,
  OrderAmendment,
} from '../types/reconciliation';

interface LiveSessionCommandProps {
  live: LiveSession;
  orders: BuyerOrder[];
  inventory: InventoryItem[];
  summary: ReconciliationSummary | null;
  messengerThreads?: MessengerThread[];
  amendments?: OrderAmendment[];
  webhookEventsLog?: Array<{
    id: string;
    timestamp: string;
    type: string;
    source: string;
    details: string;
    payload: any;
  }>;
  graphSyncStats?: {
    lastSyncAt: string;
    syncCount: number;
    onAirVideoId: string;
    broadcastStatus: string;
    lastStatusCheck: string;
  };
  onToggleLive: (action: 'start' | 'end') => void;
  onAddOrder: (order: {
    buyerName: string;
    itemCode: string;
    size: string;
    colour: string;
    quantity: number;
    channel: 'live_chat' | 'messenger';
    statedPrice: number;
  }) => void;
  onQuickAmendment: (originalOrderId: string, newSpec: { size: string; colour: string }) => void;
  onTriggerReconciliation: () => void;
  onSwitchToSummary: () => void;
  onSimulateWebhook?: (payload: any) => Promise<void>;
  onGraphSync?: (
    forceStatus?: string,
    options?: { fbVideoId?: string; fbPageId?: string; accessToken?: string }
  ) => Promise<void>;
  onBulkImportOrders?: (rawLines: string) => Promise<void>;
  onReplyMessenger?: (threadId: string, text: string) => Promise<void>;
}

export const LiveSessionCommand: React.FC<LiveSessionCommandProps> = ({
  live,
  orders,
  inventory,
  summary,
  messengerThreads = [],
  amendments = [],
  webhookEventsLog = [],
  graphSyncStats,
  onToggleLive,
  onAddOrder,
  onQuickAmendment,
  onTriggerReconciliation,
  onSwitchToSummary,
  onGraphSync,
  onBulkImportOrders,
  onReplyMessenger,
}) => {
  const isOnAir = live.status === 'live';
  const [secondsOnAir, setSecondsOnAir] = useState(0);
  const [newBuyerName, setNewBuyerName] = useState('');
  const [newItemCode, setNewItemCode] = useState('');
  const [newSize, setNewSize] = useState('');
  const [newColour, setNewColour] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [newQuantity, setNewQuantity] = useState('1');
  const [newChannel, setNewChannel] = useState<'live_chat' | 'messenger'>('live_chat');
  const [selectedOrderForSwap, setSelectedOrderForSwap] = useState<string>('');
  const [swapNewSize, setSwapNewSize] = useState('4XL');
  const [swapNewColour, setSwapNewColour] = useState('MAROON');
  const [autoReconciling, setAutoReconciling] = useState(false);
  const [reconcileStep, setReconcileStep] = useState(0);
  const [isSyncingGraph, setIsSyncingGraph] = useState(false);
  const [showWebhookLog, setShowWebhookLog] = useState(false);

  // In-session Messenger reply state
  const [activeMessengerThreadId, setActiveMessengerThreadId] = useState<string>(messengerThreads[0]?.id || '');
  const [quickMessengerReply, setQuickMessengerReply] = useState('');
  const [isSendingQuickReply, setIsSendingQuickReply] = useState(false);

  // Morning Live Graph API v22.0 connection inputs
  const [fbVideoIdInput, setFbVideoIdInput] = useState(live.fbVideoId || '');
  const [fbPageIdInput, setFbPageIdInput] = useState('');
  const [fbAccessTokenInput, setFbAccessTokenInput] = useState('');
  const [rawBatchComments, setRawBatchComments] = useState('');
  const [showBatchImport, setShowBatchImport] = useState(false);

  // Live timer tick
  useEffect(() => {
    if (!isOnAir) return;
    const interval = setInterval(() => {
      setSecondsOnAir((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [isOnAir]);

  const formatTimer = (secs: number) => {
    const hrs = Math.floor(secs / 3600);
    const mins = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return `${hrs > 0 ? hrs + ':' : ''}${String(mins).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const handleEndLiveAndAutoReconcile = () => {
    setAutoReconciling(true);
    setReconcileStep(1);

    // Simulate animated execution of the automatic multi-stage reconciliation pipeline
    setTimeout(() => setReconcileStep(2), 500);
    setTimeout(() => setReconcileStep(3), 1000);
    setTimeout(() => setReconcileStep(4), 1500);
    setTimeout(() => {
      setReconcileStep(5);
      onToggleLive('end');
      setAutoReconciling(false);
      onSwitchToSummary();
    }, 2000);
  };

  const handleSimulateMineComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBuyerName.trim() || !newItemCode.trim()) return;

    // Auto lookup price if not explicitly typed
    let price = Number(newPrice);
    if (!price || isNaN(price)) {
      const matchInv = inventory.find(
        (i) => i.itemCode.toLowerCase() === newItemCode.trim().toLowerCase()
      );
      price = matchInv ? matchInv.unitPricePhp : 1890;
    }

    const qty = Math.max(1, parseInt(newQuantity, 10) || 1);
    const sz = newSize.trim() || 'Free Size';
    const clr = newColour.trim() || 'Assorted';

    onAddOrder({
      buyerName: newBuyerName.trim(),
      itemCode: newItemCode.trim().toUpperCase(),
      size: sz.toUpperCase(),
      colour: clr.toUpperCase(),
      quantity: qty,
      channel: newChannel,
      statedPrice: price,
    });

    // Reset all fields to empty to allow agents to enter unforeseen/called codes cleanly
    setNewBuyerName('');
    setNewItemCode('');
    setNewSize('');
    setNewColour('');
    setNewPrice('');
    setNewQuantity('1');
  };

  const handleSendMessengerQuickReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeMessengerThreadId || !quickMessengerReply.trim() || !onReplyMessenger) return;
    setIsSendingQuickReply(true);
    try {
      await onReplyMessenger(activeMessengerThreadId, quickMessengerReply.trim());
      setQuickMessengerReply('');
    } finally {
      setIsSendingQuickReply(false);
    }
  };

  const handleApplySwap = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrderForSwap) return;
    onQuickAmendment(selectedOrderForSwap, {
      size: swapNewSize,
      colour: swapNewColour,
    });
    setSelectedOrderForSwap('');
  };

  // Filter current live orders
  const liveOrders = orders.filter((o) => o.liveId === live.id);
  const coverageList = summary?.coverage || [];
  const shortages = coverageList.filter((c) => c.status === 'short');
  const covered = coverageList.filter((c) => c.status === 'covered');

  return (
    <div className="space-y-6">
      {/* Automated Pipeline Progress Modal/Banner */}
      {autoReconciling && (
        <div className="bg-gradient-to-r from-rose-950 via-neutral-900 to-amber-950 border border-rose-500/50 rounded-2xl p-6 shadow-2xl animate-pulse">
          <div className="flex items-center gap-3 mb-4">
            <Sparkles className="w-6 h-6 text-amber-400 animate-spin" />
            <h3 className="text-lg font-bold text-white">
              Live Ended · Automatic Order Reconciliation Pipeline Running...
            </h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
            <div className={`p-3 rounded-xl border ${reconcileStep >= 1 ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-300' : 'bg-neutral-800 border-neutral-700 text-neutral-400'}`}>
              <div className="font-semibold mb-1">1. Intake & Deduplication</div>
              <div>Ingesting comments & merging Messenger adjustments...</div>
            </div>
            <div className={`p-3 rounded-xl border ${reconcileStep >= 2 ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-300' : 'bg-neutral-800 border-neutral-700 text-neutral-400'}`}>
              <div className="font-semibold mb-1">2. Inventory Sync</div>
              <div>Matching variants against physical store rows...</div>
            </div>
            <div className={`p-3 rounded-xl border ${reconcileStep >= 3 ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-300' : 'bg-neutral-800 border-neutral-700 text-neutral-400'}`}>
              <div className="font-semibold mb-1">3. Shortage Allocation</div>
              <div>First-come, first-served allocation + shortage audit...</div>
            </div>
            <div className={`p-3 rounded-xl border ${reconcileStep >= 4 ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-300' : 'bg-neutral-800 border-neutral-700 text-neutral-400'}`}>
              <div className="font-semibold mb-1">4. Zero-Refund Invoicing Gate</div>
              <div>Preparing verified final buying & invoice summaries...</div>
            </div>
          </div>
        </div>
      )}

      {/* Main Broadcast & Control Card */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Video Broadcast View & Oversell Alert Banner (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden shadow-xl">
            {/* Live Header Bar */}
            <div className="p-4 bg-neutral-900/90 border-b border-neutral-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className={`px-2.5 py-1 rounded-md text-xs font-bold tracking-wider ${
                  isOnAir ? 'bg-rose-600 text-white animate-pulse' : 'bg-neutral-800 text-neutral-300'
                }`}>
                  {isOnAir ? '● ON AIR' : 'BROADCAST ENDED'}
                </span>
                <span className="font-mono text-sm text-neutral-200">
                  {isOnAir ? formatTimer(secondsOnAir) : 'Duration: 1h 48m'}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <a 
                  href={live.videoUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-xs text-neutral-400 hover:text-neutral-200 transition"
                >
                  <span>FB Live #{live.fbVideoId}</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>

            {/* Video Preview Player */}
            <div className="relative aspect-video bg-black flex items-center justify-center overflow-hidden">
              <video
                src="/media/bpso-live-preview.mp4"
                poster="/media/bpso-live-poster.jpg"
                controls
                muted
                autoPlay={isOnAir}
                loop
                className="w-full h-full object-cover"
              />
              {isOnAir && (
                <div className="absolute top-3 left-3 bg-neutral-950/80 backdrop-blur-md px-3 py-1.5 rounded-lg border border-neutral-800 text-xs flex items-center gap-2 text-white">
                  <div className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                  <span>Showing item: <strong className="text-amber-400">BP01 House Patchwork Linen</strong></span>
                </div>
              )}
            </div>

            {/* Live Session Controls */}
            <div className="p-4 bg-neutral-900 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-white">{live.title}</h3>
                <p className="text-xs text-neutral-400">{live.storeName} · Live Selling Host: Myra</p>
              </div>

              <div className="flex items-center gap-2">
                {isOnAir ? (
                  <button
                    onClick={handleEndLiveAndAutoReconcile}
                    className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-rose-950/40 transition"
                  >
                    <Square className="w-3.5 h-3.5 fill-current" />
                    <span>End Live & Auto-Reconcile Orders</span>
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onToggleLive('start')}
                      className="flex items-center gap-2 px-3.5 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-lg text-xs font-semibold transition"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Resume Live Broadcast</span>
                    </button>
                    <button
                      onClick={onTriggerReconciliation}
                      className="flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold shadow-lg transition"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Re-Run Reconciliation Pipeline</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Meta Webhook & Graph API Sync Engine Card */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 sm:p-5 shadow-xl space-y-3.5">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-neutral-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30">
                  <Activity className="w-4 h-4 animate-pulse" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-white text-xs tracking-tight">
                      Meta Webhook Events & Periodic Graph API Sync
                    </h4>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
                      Webhook Subscribed
                    </span>
                  </div>
                  <p className="text-[11px] text-neutral-400">
                    Endpoint: <code className="text-neutral-300 font-mono">/api/meta/webhook</code> &bull; Polling: Graph API v22.0
                  </p>
                </div>
              </div>

              {/* Poller Status Indicator */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    if (onGraphSync) {
                      setIsSyncingGraph(true);
                      try {
                        await onGraphSync();
                      } finally {
                        setIsSyncingGraph(false);
                      }
                    }
                  }}
                  disabled={isSyncingGraph}
                  className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 rounded-lg text-xs font-medium flex items-center gap-1.5 transition"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSyncingGraph ? 'animate-spin text-blue-400' : ''}`} />
                  <span>{isSyncingGraph ? 'Syncing...' : 'Poll Graph API'}</span>
                </button>
              </div>
            </div>

            {/* Quick Status Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-[11px]">
              <div className="bg-neutral-950 p-2.5 rounded-xl border border-neutral-800">
                <span className="text-neutral-500 block text-[10px]">Broadcast State</span>
                <span className="font-bold font-mono text-white">
                  {graphSyncStats?.broadcastStatus || (isOnAir ? 'LIVE' : 'LIVE_STOPPED')}
                </span>
              </div>
              <div className="bg-neutral-950 p-2.5 rounded-xl border border-neutral-800">
                <span className="text-neutral-500 block text-[10px]">Video Broadcast ID</span>
                <span className="font-mono text-neutral-300 truncate block">
                  #{graphSyncStats?.onAirVideoId || live.fbVideoId || '960013119961912'}
                </span>
              </div>
              <div className="bg-neutral-950 p-2.5 rounded-xl border border-neutral-800">
                <span className="text-neutral-500 block text-[10px]">Last Graph Check</span>
                <span className="text-neutral-300 font-mono">
                  {graphSyncStats?.lastSyncAt ? new Date(graphSyncStats.lastSyncAt).toLocaleTimeString() : 'Just now'}
                </span>
              </div>
              <div className="bg-neutral-950 p-2.5 rounded-xl border border-neutral-800">
                <span className="text-neutral-500 block text-[10px]">Events Ingested</span>
                <span className="font-bold text-amber-400 font-mono">
                  {webhookEventsLog.length} events
                </span>
              </div>
            </div>

            {/* Morning Live Broadcast Connector & Bulk Intake */}
            <div className="bg-neutral-950 p-3.5 rounded-xl border border-neutral-800/80 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[11px] font-semibold text-neutral-200 flex items-center gap-1.5">
                  <Terminal className="w-3.5 h-3.5 text-blue-400" />
                  Connect & Sync Morning Facebook Live Broadcast (Graph API v22.0)
                </span>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setShowBatchImport(!showBatchImport)}
                    className="text-[10px] text-amber-400 hover:text-amber-300 font-semibold"
                  >
                    {showBatchImport ? 'Hide Batch Comment Intake ?' : 'Paste Morning Live Comments ?'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowWebhookLog(!showWebhookLog)}
                    className="text-[10px] text-blue-400 hover:text-blue-300 font-medium"
                  >
                    {showWebhookLog ? 'Hide Webhook Log ?' : 'View Webhook Log ?'}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 text-xs">
                <input
                  type="text"
                  name="fbVideoIdInput"
                  aria-label="Facebook Live Video ID or URL"
                  value={fbVideoIdInput}
                  onChange={(e) => setFbVideoIdInput(e.target.value)}
                  placeholder="FB Video ID or URL (blank = auto-detect latest morning live)"
                  className="sm:col-span-4 bg-neutral-900 border border-neutral-700 rounded-lg px-2.5 py-1.5 text-white font-mono text-[11px]"
                />
                <input
                  type="text"
                  name="fbPageIdInput"
                  aria-label="Facebook Page ID"
                  value={fbPageIdInput}
                  onChange={(e) => setFbPageIdInput(e.target.value)}
                  placeholder="Page ID (default: me)"
                  className="sm:col-span-2 bg-neutral-900 border border-neutral-700 rounded-lg px-2.5 py-1.5 text-white font-mono text-[11px]"
                />
                <input
                  type="password"
                  name="fbAccessTokenInput"
                  aria-label="Facebook Page Access Token"
                  value={fbAccessTokenInput}
                  onChange={(e) => setFbAccessTokenInput(e.target.value)}
                  placeholder="Page Access Token (or use server .env)"
                  className="sm:col-span-3 bg-neutral-900 border border-neutral-700 rounded-lg px-2.5 py-1.5 text-white font-mono text-[11px]"
                />
                <button
                  type="button"
                  disabled={isSyncingGraph}
                  onClick={async () => {
                    if (onGraphSync) {
                      setIsSyncingGraph(true);
                      try {
                        await onGraphSync('LIVE_STOPPED', {
                          fbVideoId: fbVideoIdInput,
                          fbPageId: fbPageIdInput,
                          accessToken: fbAccessTokenInput,
                        });
                      } finally {
                        setIsSyncingGraph(false);
                      }
                    }
                  }}
                  className="sm:col-span-3 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg font-bold flex items-center justify-center gap-1.5 transition"
                >
                  <Send className="w-3 h-3" />
                  <span>Sync Morning Live</span>
                </button>
              </div>

              {graphSyncStats?.lastStatusCheck && (
                <div className="text-[11px] text-neutral-400 font-mono bg-neutral-900/70 px-2.5 py-1.5 rounded border border-neutral-800">
                  {graphSyncStats.lastStatusCheck}
                </div>
              )}

              {showBatchImport && (
                <div className="pt-2 border-t border-neutral-800 space-y-2">
                  <label className="text-[11px] text-neutral-300 block font-medium">
                    Paste Raw Facebook Live Comments from This Morning&apos;s Broadcast (1 comment per line, e.g.{' '}
                    <code className="text-amber-300">Buyer Name: MINE BP01 3XL MAROON</code>):
                  </label>
                  <textarea
                    rows={4}
                    name="rawBatchComments"
                    aria-label="Raw Morning Live Comments"
                    value={rawBatchComments}
                    onChange={(e) => setRawBatchComments(e.target.value)}
                    placeholder={"Buyer Name: MINE BP01 3XL MAROON\nBuyer Name: MINE BP02 2XL STONE"}
                    className="w-full bg-neutral-900 border border-neutral-700 rounded-lg p-2.5 text-xs text-white font-mono"
                  />
                  <div className="flex justify-end">
                    <button
                      type="button"
                      disabled={!rawBatchComments.trim()}
                      onClick={async () => {
                        if (onBulkImportOrders && rawBatchComments.trim()) {
                          await onBulkImportOrders(rawBatchComments);
                          setRawBatchComments('');
                          setShowBatchImport(false);
                        }
                      }}
                      className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold rounded-lg transition"
                    >
                      Parse & Reconcile Morning Live Comments
                    </button>
                  </div>
                </div>
              )}

              {/* Collapsible Webhook Audit Feed */}
              {showWebhookLog && (
                <div className="mt-2 pt-2 border-t border-neutral-800 space-y-1.5 max-h-40 overflow-y-auto font-mono text-[10px]">
                  {webhookEventsLog.length === 0 ? (
                    <div className="text-neutral-500 py-2">No webhook events logged yet.</div>
                  ) : (
                    webhookEventsLog.map((evt) => (
                      <div key={evt.id} className="p-2 bg-neutral-900 rounded border border-neutral-800 text-neutral-300">
                        <div className="flex items-center justify-between text-neutral-500 mb-0.5">
                          <span className="text-blue-400 font-bold uppercase">{evt.type}</span>
                          <span>{new Date(evt.timestamp).toLocaleTimeString()}</span>
                        </div>
                        <div className="text-neutral-200">{evt.details}</div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Real-Time Oversold Warning Alert */}
          {shortages.length > 0 && (
            <div className="bg-amber-950/40 border border-amber-600/50 rounded-2xl p-4 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div className="text-xs space-y-1">
                <div className="font-bold text-amber-200 flex items-center gap-2">
                  <span>REAL-TIME OVERSOLD ALERT ON STORE RACK</span>
                  <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-mono text-[10px]">
                    {shortages.length} Shortage Lines
                  </span>
                </div>
                <p className="text-amber-300/80">
                  Host alert during live: Demand exceeds observed pieces at the Bangkok store!
                </p>
                <div className="flex flex-wrap gap-2 pt-1">
                  {shortages.map((s) => (
                    <span key={s.key} className="px-2 py-1 rounded bg-amber-900/60 border border-amber-700/50 text-amber-200 font-mono text-[11px]">
                      <strong>{s.code} {s.size} {s.colour}</strong>: {s.ordered} ordered, {s.observed ?? 0} on rack (<strong>SHORT {s.gap}</strong>)
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* In-Live Size/Color Swap Logger */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <ArrowRightLeft className="w-4 h-4 text-rose-400" />
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                  In-Live Size & Colour Swap Logger
                </h4>
              </div>
              <span className="text-[11px] text-neutral-400">
                Prevents duplicate entries & adjusts store rack demand immediately
              </span>
            </div>

            <form onSubmit={handleApplySwap} className="grid grid-cols-1 sm:grid-cols-12 gap-2 text-xs">
              <div className="sm:col-span-5">
                <select
                  value={selectedOrderForSwap}
                  onChange={(e) => setSelectedOrderForSwap(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-2.5 py-2 text-neutral-200"
                >
                  <option value="">Select Buyer's Claim to Swap...</option>
                  {liveOrders.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.buyerName} — {o.itemCode} ({o.size} {o.colour})
                    </option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-3">
                <select
                  value={swapNewSize}
                  onChange={(e) => setSwapNewSize(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-2.5 py-2 text-neutral-200"
                >
                  <option value="XL">New Size: XL</option>
                  <option value="2XL">New Size: 2XL</option>
                  <option value="3XL">New Size: 3XL</option>
                  <option value="4XL">New Size: 4XL</option>
                  <option value="5XL">New Size: 5XL</option>
                  <option value="6XL">New Size: 6XL</option>
                </select>
              </div>

              <div className="sm:col-span-2">
                <input
                  type="text"
                  value={swapNewColour}
                  onChange={(e) => setSwapNewColour(e.target.value)}
                  placeholder="Colour"
                  className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-2.5 py-2 text-neutral-200"
                />
              </div>

              <div className="sm:col-span-2">
                <button
                  type="submit"
                  disabled={!selectedOrderForSwap}
                  className="w-full h-full bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white rounded-lg font-semibold py-2 transition"
                >
                  Swap Spec
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Right Column: Live Comment Feed & Real-time Demand Ledger (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          {/* Quick Mine Simulator (Requirement 1: Editable, Empty Defaults, Adapts to Any Live Item Code) */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 shadow-lg">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-amber-400" />
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                  Live Mine Capture Simulator
                </h4>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                Editable & Sync Ready
              </span>
            </div>

            {/* Datalists for quick click suggestions while allowing arbitrary ad-hoc codes */}
            <datalist id="live-simulator-item-codes">
              {Array.from(new Set(inventory.map((i) => i.itemCode))).map((code) => (
                <option key={code} value={code} />
              ))}
              <option value="BP01" />
              <option value="BP02" />
              <option value="BP03" />
              <option value="BP04" />
              <option value="BP05" />
              <option value="BP07" />
              <option value="D3" />
              <option value="T10" />
            </datalist>

            <datalist id="live-simulator-sizes">
              <option value="Free Size" />
              <option value="L" />
              <option value="XL" />
              <option value="2XL" />
              <option value="3XL" />
              <option value="4XL" />
              <option value="5XL" />
              <option value="6XL" />
              <option value="Plus Size" />
            </datalist>

            <datalist id="live-simulator-colours">
              <option value="Maroon" />
              <option value="Black" />
              <option value="Navy" />
              <option value="Emerald" />
              <option value="Stone" />
              <option value="White" />
              <option value="Floral" />
              <option value="Assorted" />
            </datalist>

            <form onSubmit={handleSimulateMineComment} className="space-y-2 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-neutral-400 block mb-0.5">Buyer Name *</label>
                  <input
                    type="text"
                    placeholder="e.g. Aileen Cruz"
                    value={newBuyerName}
                    onChange={(e) => setNewBuyerName(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-2.5 py-1.5 text-neutral-200 placeholder:text-neutral-600 focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-neutral-400 block mb-0.5">Item Code * (Type any called code)</label>
                  <input
                    type="text"
                    list="live-simulator-item-codes"
                    placeholder="e.g. BP01, D3, T10..."
                    value={newItemCode}
                    onChange={(e) => {
                      const val = e.target.value;
                      setNewItemCode(val);
                      // Auto-suggest price if known inventory code
                      const match = inventory.find((i) => i.itemCode.toLowerCase() === val.trim().toLowerCase());
                      if (match && !newPrice) {
                        setNewPrice(String(match.unitPricePhp));
                      }
                    }}
                    className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-2.5 py-1.5 text-neutral-200 font-mono placeholder:text-neutral-600 focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div>
                  <label className="text-[10px] text-neutral-400 block mb-0.5">Size</label>
                  <input
                    type="text"
                    list="live-simulator-sizes"
                    placeholder="e.g. 3XL"
                    value={newSize}
                    onChange={(e) => setNewSize(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-2 py-1.5 text-neutral-200 placeholder:text-neutral-600 focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="text-[10px] text-neutral-400 block mb-0.5">Colour</label>
                  <input
                    type="text"
                    list="live-simulator-colours"
                    placeholder="e.g. Maroon"
                    value={newColour}
                    onChange={(e) => setNewColour(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-2 py-1.5 text-neutral-200 placeholder:text-neutral-600 focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="text-[10px] text-neutral-400 block mb-0.5">Price (₱)</label>
                  <input
                    type="number"
                    placeholder="1890"
                    value={newPrice}
                    onChange={(e) => setNewPrice(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-2 py-1.5 text-neutral-200 font-mono placeholder:text-neutral-600 focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="text-[10px] text-neutral-400 block mb-0.5">Qty</label>
                  <input
                    type="number"
                    min="1"
                    placeholder="1"
                    value={newQuantity}
                    onChange={(e) => setNewQuantity(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-2 py-1.5 text-neutral-200 font-mono placeholder:text-neutral-600 focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 pt-1">
                <div className="sm:col-span-6">
                  <select
                    value={newChannel}
                    onChange={(e) => setNewChannel(e.target.value as 'live_chat' | 'messenger')}
                    className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-2.5 py-1.5 text-neutral-200 text-xs"
                  >
                    <option value="live_chat">📹 Channel: Facebook Live Chat</option>
                    <option value="messenger">💬 Channel: Business Messenger DM</option>
                  </select>
                </div>

                <div className="sm:col-span-6">
                  <button
                    type="submit"
                    disabled={!newBuyerName || !newItemCode}
                    className="w-full bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 disabled:opacity-50 text-white font-semibold rounded-lg py-1.5 flex items-center justify-center gap-1.5 shadow transition"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Mine Claim</span>
                  </button>
                </div>
              </div>
            </form>
          </div>

          {/* Real-time Live Comments Stream */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 flex flex-col h-[400px]">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-800 mb-3">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                  Live Stream Claims ({liveOrders.length} Captured)
                </h4>
              </div>
              <span className="text-[11px] text-neutral-400">Earliest comments first</span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1 text-xs">
              {liveOrders.map((ord, idx) => (
                <div
                  key={ord.id}
                  className={`p-2.5 rounded-xl border transition ${
                    ord.status === 'confirmed'
                      ? 'bg-neutral-950/70 border-neutral-800 hover:border-neutral-700'
                      : ord.status === 'replaced'
                      ? 'bg-neutral-950/40 border-neutral-900 opacity-60 line-through'
                      : 'bg-amber-950/30 border-amber-800/40'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-neutral-500 text-[10px]">#{idx + 1}</span>
                      <span className="font-semibold text-white">{ord.buyerName}</span>
                      {ord.isVip && (
                        <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 font-bold text-[9px] border border-amber-500/30">
                          VIP
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-neutral-400 font-mono">
                      {new Date(ord.orderedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-neutral-300">
                    <div className="flex items-center gap-1.5 font-mono">
                      <span className="px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 font-bold">
                        {ord.itemCode}
                      </span>
                      <span>{ord.size}</span>
                      <span>{ord.colour}</span>
                      <span className="text-neutral-400">×{ord.quantity}</span>
                    </div>

                    <span className="font-semibold text-amber-300">
                      ₱{(ord.statedUnitPricePhp || 0).toLocaleString()}
                    </span>
                  </div>

                  {ord.hostVerificationNote && (
                    <div className="mt-1 text-[10px] text-neutral-400 italic">
                      {ord.hostVerificationNote}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Quick Link to Reconciled Summary */}
            <div className="pt-3 border-t border-neutral-800">
              <button
                onClick={onSwitchToSummary}
                className="w-full flex items-center justify-between px-3 py-2 bg-neutral-800 hover:bg-neutral-700 text-xs font-semibold text-white rounded-xl transition"
              >
                <span>View Full Reconciled Summary & Bags</span>
                <ChevronRight className="w-4 h-4 text-neutral-400" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Live Business Messenger & In-Live Amendments Inbox (Requirement 2A) */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-3 border-b border-neutral-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-gradient-to-tr from-sky-600 to-blue-600 rounded-xl text-white shadow">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm text-white">
                  Live Business Messenger & In-Live Amendments Inbox
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 font-mono text-[10px] font-bold border border-sky-500/30">
                  {messengerThreads.length} Synced Threads
                </span>
                <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-mono text-[10px] font-bold border border-amber-500/30">
                  {amendments.length} Live Amendments
                </span>
              </div>
              <p className="text-xs text-neutral-400">
                Synced Meta Page Business Messenger threads and live buyer amendment requests during broadcast.
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Threads Column (4 cols) */}
          <div className="lg:col-span-4 bg-neutral-950/70 border border-neutral-800 rounded-xl p-3 flex flex-col h-[340px]">
            <div className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider mb-2 flex items-center justify-between">
              <span>Customer DM Threads</span>
              <span className="text-sky-400 font-mono">Meta Page Inbox</span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {messengerThreads.length === 0 ? (
                <div className="text-center py-8 text-neutral-500 text-xs italic">
                  No Messenger threads synced yet. Incoming buyer messages will appear here live.
                </div>
              ) : (
                messengerThreads.map((th) => {
                  const isSelected = (activeMessengerThreadId || messengerThreads[0]?.id) === th.id;
                  const lastMsg = th.messages?.[th.messages.length - 1];
                  const hasIntent = !!th.detectedIntent;

                  return (
                    <button
                      key={th.id}
                      onClick={() => setActiveMessengerThreadId(th.id)}
                      className={`w-full text-left p-2.5 rounded-xl border transition ${
                        isSelected
                          ? 'bg-sky-950/40 border-sky-500 text-white'
                          : 'bg-neutral-900/60 border-neutral-800 text-neutral-300 hover:border-neutral-700'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-xs truncate max-w-[150px] text-white">
                          {th.buyerName}
                        </span>
                        <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-300 font-mono">
                          24h Active
                        </span>
                      </div>

                      <div className="text-[11px] text-neutral-400 truncate">
                        {lastMsg ? lastMsg.text : 'Thread opened'}
                      </div>

                      {hasIntent && (
                        <div className="mt-1 flex items-center gap-1">
                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                            {th.detectedIntent?.type.replace('_', ' ').toUpperCase()}
                          </span>
                        </div>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Active Conversation & Quick Reply (5 cols) */}
          <div className="lg:col-span-5 bg-neutral-950/70 border border-neutral-800 rounded-xl p-3 flex flex-col h-[340px]">
            {(() => {
              const activeTh = messengerThreads.find(
                (t) => t.id === (activeMessengerThreadId || messengerThreads[0]?.id)
              );

              if (!activeTh) {
                return (
                  <div className="flex-1 flex items-center justify-center text-xs text-neutral-500 italic">
                    Select a Messenger thread to view messages and reply.
                  </div>
                );
              }

              return (
                <>
                  <div className="pb-2 border-b border-neutral-800 mb-2 flex items-center justify-between">
                    <div>
                      <div className="font-bold text-xs text-white">{activeTh.buyerName}</div>
                      <div className="text-[10px] text-neutral-400 font-mono">PSID: {activeTh.psid || activeTh.id}</div>
                    </div>
                    {activeTh.detectedIntent && (
                      <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-semibold border border-amber-500/30">
                        {activeTh.detectedIntent.summary || activeTh.detectedIntent.type}
                      </span>
                    )}
                  </div>

                  <div className="flex-1 overflow-y-auto space-y-2 pr-1 text-xs mb-2">
                    {activeTh.messages.map((m) => (
                      <div
                        key={m.id}
                        className={`p-2 rounded-xl max-w-[85%] text-xs ${
                          m.sender === 'buyer'
                            ? 'bg-neutral-800 text-neutral-200 mr-auto'
                            : 'bg-gradient-to-r from-sky-600 to-blue-600 text-white ml-auto'
                        }`}
                      >
                        <div>{m.text}</div>
                        <div className="text-[9px] opacity-60 text-right mt-0.5 font-mono">
                          {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    ))}
                  </div>

                  <form onSubmit={handleSendMessengerQuickReply} className="flex gap-2 pt-2 border-t border-neutral-800">
                    <input
                      type="text"
                      placeholder={`Reply to ${activeTh.buyerName} via Messenger...`}
                      value={quickMessengerReply}
                      onChange={(e) => setQuickMessengerReply(e.target.value)}
                      className="flex-1 bg-neutral-900 border border-neutral-700 rounded-lg px-2.5 py-1.5 text-xs text-neutral-200 placeholder:text-neutral-500 focus:border-sky-500"
                    />
                    <button
                      type="submit"
                      disabled={isSendingQuickReply || !quickMessengerReply.trim()}
                      className="bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>{isSendingQuickReply ? 'Sending...' : 'Reply'}</span>
                    </button>
                  </form>
                </>
              );
            })()}
          </div>

          {/* In-Live Amendments Log (3 cols) */}
          <div className="lg:col-span-3 bg-neutral-950/70 border border-neutral-800 rounded-xl p-3 flex flex-col h-[340px]">
            <div className="text-[11px] font-bold text-amber-400 uppercase tracking-wider mb-2 flex items-center justify-between">
              <span>Amendments Log</span>
              <span className="font-mono text-[10px] text-neutral-400">{amendments.length}</span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1 text-xs">
              {amendments.length === 0 ? (
                <div className="text-neutral-500 text-center py-8 text-[11px] italic">
                  No adjustments requested yet during this live session.
                </div>
              ) : (
                amendments.map((am) => (
                  <div key={am.id} className="p-2 rounded-lg bg-neutral-900 border border-neutral-800 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-white text-[11px]">{am.buyerName}</span>
                      <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 font-bold uppercase">
                        {am.type.replace('_', ' ')}
                      </span>
                    </div>

                    <div className="font-mono text-[10px] text-neutral-300 flex items-center gap-1">
                      <span className="text-neutral-500">{am.originalSpec.size} {am.originalSpec.colour}</span>
                      <ArrowRightLeft className="w-3 h-3 text-amber-400" />
                      <span className="text-emerald-400 font-bold">{am.newSpec.size} {am.newSpec.colour}</span>
                    </div>

                    <div className="text-[10px] text-neutral-400 italic truncate">
                      "{am.rawText}"
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-3 border-b border-neutral-800">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-sm text-white">
                Live Demand vs On-Rack Physical Inventory
              </h3>
              <span className="px-2 py-0.5 rounded-full bg-neutral-800 text-neutral-300 font-mono text-[10px]">
                {coverageList.length} Variants
              </span>
            </div>
            <p className="text-xs text-neutral-400">
              Live-lane demand (live comments + pending/confirmed order requests) compared against physical rack count
            </p>
          </div>

          <div className="flex items-center gap-3 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              <span className="text-neutral-300">Covered: {covered.length}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
              <span className="text-neutral-300">Shortage: {shortages.length}</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {coverageList.map((cov) => {
            const isShort = cov.status === 'short';
            const isCovered = cov.status === 'covered';
            const isExtra = cov.status === 'extra';

            return (
              <div
                key={cov.key}
                className={`p-3.5 rounded-xl border transition ${
                  isShort
                    ? 'bg-amber-950/30 border-amber-500/50'
                    : isCovered
                    ? 'bg-neutral-950/70 border-neutral-800'
                    : isExtra
                    ? 'bg-purple-950/20 border-purple-800/40'
                    : 'bg-red-950/30 border-red-500/40'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white text-sm">{cov.code}</span>
                    <span className="text-xs text-neutral-400">{cov.size} {cov.colour}</span>
                  </div>

                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    isShort
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                      : isCovered
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      : isExtra
                      ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                      : 'bg-red-500/20 text-red-300 border border-red-500/40'
                  }`}>
                    {isShort ? `SHORT ${cov.gap}` : isCovered ? 'COVERED ✓' : isExtra ? `EXTRA ${cov.gap}` : 'NO ROW'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs py-1.5 bg-neutral-900/60 rounded-lg px-2.5 mb-2 font-mono">
                  <div>
                    <span className="text-neutral-500">Ordered: </span>
                    <strong className="text-white">{cov.ordered}</strong>
                  </div>
                  <div>
                    <span className="text-neutral-500">On Rack: </span>
                    <strong className={cov.observed !== null ? 'text-amber-300' : 'text-neutral-500'}>
                      {cov.observed !== null ? cov.observed : 'Unknown'}
                    </strong>
                  </div>
                </div>

                {cov.buyers.length > 0 ? (
                  <div className="space-y-1 text-[11px] text-neutral-400">
                    <div className="text-[10px] text-neutral-500 font-semibold uppercase">Buyers in line:</div>
                    {cov.buyers.map((b, idx) => {
                      const isMiss = isShort && cov.gap && idx >= cov.buyers.length - cov.gap;
                      return (
                        <div key={b.orderId} className={`flex items-center justify-between ${isMiss ? 'text-amber-400 font-medium' : ''}`}>
                          <span>{idx + 1}. {b.name} ({b.quantity}pc)</span>
                          {isMiss ? (
                            <span className="text-[10px] text-amber-400 font-bold">Misses Out</span>
                          ) : (
                            <span className="text-[10px] text-emerald-400">Secured ✓</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-[11px] text-neutral-500 italic">No buyer claims for this item yet.</div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
