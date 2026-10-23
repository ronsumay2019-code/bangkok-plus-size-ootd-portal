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
  ChevronLeft,
  Activity,
  RefreshCw,
  Send,
  Terminal,
  Clock,
  User,
  Check,
  CheckCircle2,
  MessageCircle,
  Edit2,
  DollarSign,
  Layers,
  Radio,
} from 'lucide-react';
import { 
  LiveSession, 
  BuyerOrder, 
  InventoryItem, 
  ReconciliationSummary,
  MessengerThread,
  OrderAmendment,
} from '../types/reconciliation';
import {
  HOST_BROADCAST_SEGMENTS,
  HostItemSegment,
  parseMinerQueueComment,
} from '../services/liveSellingEngine';
import { MetaGraphApiBadge } from './MetaGraphApiBadge';

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
  onUpdateOrder?: (orderId: string, updates: Partial<BuyerOrder>) => Promise<void> | void;
  onBatchSetPrice?: (itemCode: string, pricePhp: number) => Promise<void> | void;
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
  onUpdateOrder,
  onBatchSetPrice,
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

  // Inline claim price editing by agent
  const [editingPriceOrderId, setEditingPriceOrderId] = useState<string | null>(null);
  const [tempPriceInput, setTempPriceInput] = useState<string>('');
  const [applyToAllSameItem, setApplyToAllSameItem] = useState(false);
  const [isSavingPrice, setIsSavingPrice] = useState(false);

  // Quick batch item price setter for agent during live
  const [batchItemCode, setBatchItemCode] = useState('');
  const [batchPriceInput, setBatchPriceInput] = useState('');
  const [isApplyingBatch, setIsApplyingBatch] = useState(false);
  const [batchStatusMsg, setBatchStatusMsg] = useState('');

  // Live claims stream search & sorting
  const [claimsFilter, setClaimsFilter] = useState('');
  const [claimsSort, setClaimsSort] = useState<'latest' | 'earliest'>('latest');

  // Real Live Selling Host Item Calling State
  const [activeSegmentIndex, setActiveSegmentIndex] = useState<number>(7); // Default to RUSTANS (segment #8, index 7)
  const currentHostSegment = HOST_BROADCAST_SEGMENTS[activeSegmentIndex] || HOST_BROADCAST_SEGMENTS[0];
  const [naturalCommentInput, setNaturalCommentInput] = useState('');
  const [naturalBuyerInput, setNaturalBuyerInput] = useState('');
  const [simulatorMode, setSimulatorMode] = useState<'natural' | 'manual'>('natural');

  const handleSelectSegment = (idx: number) => {
    if (idx < 0 || idx >= HOST_BROADCAST_SEGMENTS.length) return;
    setActiveSegmentIndex(idx);
    const seg = HOST_BROADCAST_SEGMENTS[idx];
    setNewItemCode(seg.itemCode);
    setNewPrice(String(seg.pricePhp));
    setNewSize(seg.availableSizes[0] || 'FREE SIZE (PLUS)');
    if (seg.availableColors.length > 0) {
      setNewColour(seg.availableColors[0]);
    }
  };

  const handleQuickMineColor = (color: string) => {
    setNewItemCode(currentHostSegment.itemCode);
    setNewPrice(String(currentHostSegment.pricePhp));
    setNewSize(currentHostSegment.availableSizes[0] || 'FREE SIZE (PLUS)');
    setNewColour(color);
    setNaturalCommentInput(`Mine ${currentHostSegment.itemCode} ${color}`);
  };

  const handleNaturalCommentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!naturalCommentInput.trim()) return;

    let bName = naturalBuyerInput.trim();
    let comment = naturalCommentInput.trim();

    // Check if format is "Buyer Name: comment"
    const colonIdx = comment.indexOf(':');
    if (colonIdx > 0 && colonIdx < 40 && !bName) {
      bName = comment.slice(0, colonIdx).trim();
      comment = comment.slice(colonIdx + 1).trim();
    }

    if (!bName) bName = 'FB Live Miner';

    const parsedOrders = parseMinerQueueComment(
      comment,
      bName,
      currentHostSegment
    );

    if (parsedOrders.length === 0) {
      alert('Comment recognized as stream chatter/banter — no order created.');
      return;
    }

    for (const p of parsedOrders) {
      onAddOrder({
        buyerName: p.buyerName,
        itemCode: p.itemCode,
        size: p.size,
        colour: p.colour,
        quantity: p.quantity,
        channel: 'live_chat',
        statedPrice: p.statedUnitPricePhp || currentHostSegment.pricePhp,
      });
    }

    setNaturalCommentInput('');
    setNaturalBuyerInput('');
  };

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
    const effectiveCode = newItemCode.trim() || currentHostSegment.itemCode;
    const effectiveBuyer = newBuyerName.trim() || 'FB Live Miner';

    // Agent entered price: use entered price, else matched host segment price, else matched inventory price
    let price = newPrice.trim() !== '' ? Number(newPrice) : 0;
    if (isNaN(price)) price = 0;
    if (price === 0) {
      if (effectiveCode.toUpperCase() === currentHostSegment.itemCode) {
        price = currentHostSegment.pricePhp;
      } else {
        const matchInv = inventory.find(
          (i) => i.itemCode.toLowerCase() === effectiveCode.toLowerCase()
        );
        if (matchInv?.unitPricePhp) {
          price = matchInv.unitPricePhp;
        } else {
          const segMatch = HOST_BROADCAST_SEGMENTS.find(
            (s) => s.itemCode.toLowerCase() === effectiveCode.toLowerCase()
          );
          if (segMatch?.pricePhp) price = segMatch.pricePhp;
        }
      }
    }

    const qty = Math.max(1, parseInt(newQuantity, 10) || 1);
    const sz = newSize.trim() || currentHostSegment.availableSizes[0] || 'FREE SIZE (PLUS)';
    const clr = newColour.trim() || currentHostSegment.availableColors[0] || 'ASSORTED';

    onAddOrder({
      buyerName: effectiveBuyer,
      itemCode: effectiveCode.toUpperCase(),
      size: sz.toUpperCase(),
      colour: clr.toUpperCase(),
      quantity: qty,
      channel: newChannel,
      statedPrice: price,
    });

    // Reset fields to empty
    setNewBuyerName('');
    setNewItemCode('');
    setNewSize('');
    setNewColour('');
    setNewPrice('');
    setNewQuantity('1');
  };

  const handleSaveClaimPrice = async (orderId: string, itemCode: string) => {
    const p = Math.max(0, Number(tempPriceInput) || 0);
    setIsSavingPrice(true);
    try {
      if (applyToAllSameItem && onBatchSetPrice) {
        await onBatchSetPrice(itemCode, p);
      } else if (onUpdateOrder) {
        await onUpdateOrder(orderId, { statedUnitPricePhp: p });
      }
      setEditingPriceOrderId(null);
      setApplyToAllSameItem(false);
    } catch (e) {
      console.error('Failed to update price', e);
    } finally {
      setIsSavingPrice(false);
    }
  };

  const handleApplyBatchItemPrice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!batchItemCode.trim() || !batchPriceInput.trim()) return;
    const p = Math.max(0, Number(batchPriceInput) || 0);
    setIsApplyingBatch(true);
    try {
      if (onBatchSetPrice) {
        await onBatchSetPrice(batchItemCode.trim(), p);
      } else if (onUpdateOrder) {
        const matching = liveOrders.filter(
          (o) => o.itemCode.toUpperCase() === batchItemCode.trim().toUpperCase()
        );
        for (const m of matching) {
          await onUpdateOrder(m.id, { statedUnitPricePhp: p });
        }
      }
      setBatchStatusMsg(`Set ₱${p.toLocaleString()} for all ${batchItemCode.toUpperCase()}`);
      setTimeout(() => setBatchStatusMsg(''), 3500);
      setBatchItemCode('');
      setBatchPriceInput('');
    } catch (e) {
      console.error('Failed to batch set price', e);
    } finally {
      setIsApplyingBatch(false);
    }
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
  const liveOrders = orders.filter((o) => !o.liveId || o.liveId === live.id);
  const filteredLiveOrders = liveOrders
    .filter((o) => {
      if (!claimsFilter.trim()) return true;
      const q = claimsFilter.toLowerCase();
      return (
        o.buyerName.toLowerCase().includes(q) ||
        o.itemCode.toLowerCase().includes(q) ||
        o.colour.toLowerCase().includes(q) ||
        (o.itemName && o.itemName.toLowerCase().includes(q))
      );
    })
    .sort((a, b) => {
      const timeA = new Date(a.orderedAt).getTime() || 0;
      const timeB = new Date(b.orderedAt).getTime() || 0;
      return claimsSort === 'latest' ? timeB - timeA : timeA - timeB;
    });
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
                <div className="absolute top-3 left-3 bg-neutral-950/85 backdrop-blur-md px-3 py-1.5 rounded-lg border border-neutral-800 text-xs flex items-center gap-2 text-white shadow-lg">
                  <div className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                  <span>Host Calling: <strong className="text-amber-400 font-mono">{currentHostSegment.itemCode}</strong> · <span className="text-emerald-400 font-bold">₱{currentHostSegment.pricePhp}</span></span>
                </div>
              )}
              {/* Flash on Screen during Live: Official Meta Graph API Verification */}
              <div className="absolute top-3 right-3 z-10">
                <MetaGraphApiBadge variant="live_overlay" />
              </div>
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

            {/* Host Live Item Calling Stream Controller (Specification 10) */}
            <div className="p-4 bg-neutral-950 border-t border-neutral-800 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-neutral-800/80">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
                  <span className="text-xs font-bold text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Radio className="w-3.5 h-3.5 text-rose-500" />
                    Host Item Calling Controller · Item #{activeSegmentIndex + 1} of {HOST_BROADCAST_SEGMENTS.length}
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 font-mono font-bold border border-rose-500/30">
                    ON STREAM: {currentHostSegment.itemCode}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <MetaGraphApiBadge variant="host_bar" className="hidden sm:flex" />
                  <button
                    type="button"
                    disabled={activeSegmentIndex === 0}
                    onClick={() => handleSelectSegment(activeSegmentIndex - 1)}
                    className="px-2.5 py-1 bg-neutral-800 hover:bg-neutral-700 disabled:opacity-30 text-white text-xs font-semibold rounded-lg flex items-center gap-1 transition cursor-pointer"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    <span>Prev Item</span>
                  </button>

                  <button
                    type="button"
                    disabled={activeSegmentIndex === HOST_BROADCAST_SEGMENTS.length - 1}
                    onClick={() => handleSelectSegment(activeSegmentIndex + 1)}
                    className="px-3.5 py-1 bg-gradient-to-r from-amber-500 to-rose-600 hover:from-amber-400 hover:to-rose-500 disabled:opacity-30 text-neutral-950 font-bold text-xs rounded-lg flex items-center gap-1.5 shadow-lg transition cursor-pointer"
                  >
                    <span>Next Item Called</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Active Host Item Announced Details */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 text-xs bg-neutral-900/90 p-3 rounded-xl border border-neutral-800">
                <div className="sm:col-span-5 space-y-1">
                  <div className="text-[10px] text-neutral-400 uppercase tracking-wide font-semibold">Active Garment Called by Host</div>
                  <div className="text-sm font-bold text-white flex items-center gap-2">
                    <span className="text-amber-400 font-mono">{currentHostSegment.itemCode}</span>
                    <span className="text-neutral-300 text-xs truncate">— {currentHostSegment.itemName}</span>
                  </div>
                  <div className="text-xs font-mono text-emerald-400 font-bold">
                    Selling Price: ₱{currentHostSegment.pricePhp.toLocaleString()}
                  </div>
                </div>

                <div className="sm:col-span-3 space-y-1">
                  <div className="text-[10px] text-neutral-400 uppercase tracking-wide font-semibold">Sizes Called on Stream</div>
                  <div className="flex flex-wrap gap-1">
                    {currentHostSegment.availableSizes.map((sz) => (
                      <span key={sz} className="px-2 py-0.5 rounded bg-neutral-800 text-neutral-200 font-mono text-[10px] border border-neutral-700">
                        {sz}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="sm:col-span-4 space-y-1">
                  <div className="text-[10px] text-neutral-400 uppercase tracking-wide font-semibold">Colors Available / Shown (Click to Mine)</div>
                  <div className="flex flex-wrap gap-1 max-h-16 overflow-y-auto">
                    {currentHostSegment.availableColors.map((col) => (
                      <button
                        key={col}
                        type="button"
                        onClick={() => handleQuickMineColor(col)}
                        title={`Click to quickly prepare mine order for ${col}`}
                        className="px-2 py-0.5 rounded bg-amber-500/15 hover:bg-amber-500/30 text-amber-300 font-semibold text-[10px] border border-amber-500/30 transition cursor-pointer"
                      >
                        + {col}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Stream Timeline Ribbon */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[10px]">
                <span className="text-neutral-500 shrink-0 uppercase tracking-wider font-semibold text-[9px]">Timeline:</span>
                {HOST_BROADCAST_SEGMENTS.map((seg, idx) => (
                  <button
                    key={seg.itemCode}
                    type="button"
                    onClick={() => handleSelectSegment(idx)}
                    className={`shrink-0 px-2.5 py-1 rounded-lg font-mono text-[10px] transition cursor-pointer ${
                      activeSegmentIndex === idx
                        ? 'bg-amber-500 text-neutral-950 font-bold ring-1 ring-amber-400 shadow'
                        : 'bg-neutral-900 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 border border-neutral-800'
                    }`}
                  >
                    {idx + 1}. {seg.itemCode} (₱{seg.pricePhp})
                  </button>
                ))}
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
                  aria-label="META_PAGE_ACCESS_TOKEN"
                  value={fbAccessTokenInput}
                  onChange={(e) => setFbAccessTokenInput(e.target.value)}
                  placeholder="META_PAGE_ACCESS_TOKEN (or FB_PAGE_ACCESS_TOKEN)"
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
                    <code className="text-amber-300">Jhoy Escobiñas: Mine LU pants black</code>):
                  </label>
                  <textarea
                    rows={4}
                    name="rawBatchComments"
                    aria-label="Raw Morning Live Comments"
                    value={rawBatchComments}
                    onChange={(e) => setRawBatchComments(e.target.value)}
                    placeholder={"Jhoy Escobiñas: Mine LU pants black\nEmz Cruz: Mine Rustans Pink & Charcoal\nArcega Gina: AC RUSTANS\nShiela Marasigan: Rustans violet"}
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

          {/* Real-Time Demand Allocation Alert */}
          {shortages.length > 0 && (
            <div className="bg-amber-950/40 border border-amber-600/50 rounded-2xl p-4 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div className="text-xs space-y-1">
                <div className="font-bold text-amber-200 flex items-center gap-2">
                  <span>REAL-TIME DEMAND & STORE WHOLESALE ALLOCATION ALERT</span>
                  <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-mono text-[10px]">
                    {shortages.length} Shortage Lines
                  </span>
                </div>
                <p className="text-amber-300/80">
                  Host alert during live: Live stream claims exceed physical pieces purchased at the store!
                </p>
                <div className="flex flex-wrap gap-2 pt-1">
                  {shortages.map((s) => (
                    <span key={s.key} className="px-2 py-1 rounded bg-amber-900/60 border border-amber-700/50 text-amber-200 font-mono text-[11px]">
                      <strong>{s.code} {s.size} {s.colour}</strong>: {s.ordered} ordered, {s.observed ?? 0} in store (<strong>SHORT {s.gap}</strong>)
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
                Prevents duplicate entries & adjusts order spec immediately
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
              <div className="flex items-center gap-2">
                <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Host-Synced & Queue-Aware
                </span>
              </div>
            </div>

            {/* Active Host Context Pill */}
            <div className="p-2.5 rounded-xl bg-neutral-950 border border-amber-500/30 mb-3 space-y-1">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-neutral-400">Host Segment: <strong className="text-amber-400 font-mono">{currentHostSegment.itemCode}</strong></span>
                <span className="text-emerald-400 font-mono font-bold">Host Price: ₱{currentHostSegment.pricePhp.toLocaleString()}</span>
              </div>
              <div className="text-[10px] text-neutral-400 truncate">
                Vague comments (e.g. <em>"Mine black"</em>, <em>"Mine pink & charcoal"</em>) automatically inherit this active garment & price!
              </div>
            </div>

            {/* Dual Input Mode Selector */}
            <div className="flex rounded-lg bg-neutral-950 p-1 border border-neutral-800 mb-3 text-xs">
              <button
                type="button"
                onClick={() => setSimulatorMode('natural')}
                className={`flex-1 py-1 rounded-md font-semibold transition ${
                  simulatorMode === 'natural'
                    ? 'bg-amber-500 text-neutral-950 font-bold shadow'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                Intelligent Comment Parser
              </button>
              <button
                type="button"
                onClick={() => setSimulatorMode('manual')}
                className={`flex-1 py-1 rounded-md font-semibold transition ${
                  simulatorMode === 'manual'
                    ? 'bg-amber-500 text-neutral-950 font-bold shadow'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                Manual Field Form
              </button>
            </div>

            {simulatorMode === 'natural' ? (
              <form onSubmit={handleNaturalCommentSubmit} className="space-y-2.5 text-xs">
                <div>
                  <label className="text-[10px] text-neutral-400 block mb-0.5">Miner Live Comment *</label>
                  <input
                    type="text"
                    placeholder="e.g. Mine Rustans Pink & Charcoal or Jhoy: Mine LU pants black"
                    value={naturalCommentInput}
                    onChange={(e) => setNaturalCommentInput(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-2.5 py-2 text-neutral-200 font-mono placeholder:text-neutral-600 focus:border-amber-500 text-xs"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-neutral-400 block mb-0.5">Buyer Name (Optional if in comment)</label>
                    <input
                      type="text"
                      placeholder="e.g. Emz Cruz"
                      value={naturalBuyerInput}
                      onChange={(e) => setNaturalBuyerInput(e.target.value)}
                      className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-2.5 py-1.5 text-neutral-200 placeholder:text-neutral-600 focus:border-amber-500 text-xs"
                    />
                  </div>

                  <div className="flex items-end">
                    <button
                      type="submit"
                      disabled={!naturalCommentInput.trim()}
                      className="w-full bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 disabled:opacity-50 text-white font-bold rounded-lg py-2 flex items-center justify-center gap-1.5 shadow transition cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Capture Mine Piece(s)</span>
                    </button>
                  </div>
                </div>

                {/* Quick Stream Sample Comment Chips */}
                <div className="pt-1">
                  <span className="text-[10px] text-neutral-500 block mb-1">Quick Stream Samples from Morning Live:</span>
                  <div className="flex flex-wrap gap-1">
                    {[
                      { b: 'Jhoy Escobiñas', c: 'Mine LU pants black' },
                      { b: 'Emz Cruz', c: 'Mine Rustans Pink & Charcoal' },
                      { b: 'Arcega Gina', c: 'AC RUSTANS' },
                      { b: 'Shiela Marasigan', c: 'Rustans violet' },
                      { b: 'Marlon Escobiñas', c: 'Mine linen pants avocado and yellow' },
                      { b: 'Weng De Leon Eraña', c: 'Mine 2 tops' },
                    ].map((s) => (
                      <button
                        key={s.c}
                        type="button"
                        onClick={() => {
                          setNaturalBuyerInput(s.b);
                          setNaturalCommentInput(s.c);
                        }}
                        className="px-2 py-0.5 rounded bg-neutral-950 hover:bg-neutral-850 text-neutral-300 font-mono text-[10px] border border-neutral-800 transition cursor-pointer"
                      >
                        {s.c}
                      </button>
                    ))}
                  </div>
                </div>
              </form>
            ) : (
              /* Datalists for quick click suggestions while allowing arbitrary ad-hoc codes */
              <>
                <datalist id="live-simulator-item-codes">
                  {HOST_BROADCAST_SEGMENTS.map((s) => (
                    <option key={s.itemCode} value={s.itemCode} />
                  ))}
                  {Array.from(new Set(inventory.map((i) => i.itemCode))).map((code) => (
                    <option key={code} value={code} />
                  ))}
                </datalist>

                <datalist id="live-simulator-sizes">
                  <option value="FREE SIZE (PLUS)" />
                  <option value="XL" />
                  <option value="2XL" />
                  <option value="3XL" />
                  <option value="4XL" />
                  <option value="5XL" />
                  <option value="6XL" />
                </datalist>

                <datalist id="live-simulator-colours">
                  {currentHostSegment.availableColors.map((col) => (
                    <option key={col} value={col} />
                  ))}
                  <option value="BLACK" />
                  <option value="WHITE" />
                  <option value="PINK" />
                  <option value="CHARCOAL" />
                  <option value="MAROON" />
                  <option value="BROWN" />
                  <option value="VIOLET" />
                  <option value="NAVY" />
                  <option value="ASSORTED" />
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
                      <label className="text-[10px] text-neutral-400 block mb-0.5">Item Code (blank = {currentHostSegment.itemCode})</label>
                      <input
                        type="text"
                        list="live-simulator-item-codes"
                        placeholder={currentHostSegment.itemCode}
                        value={newItemCode}
                        onChange={(e) => {
                          const val = e.target.value;
                          setNewItemCode(val);
                          const segMatch = HOST_BROADCAST_SEGMENTS.find(
                            (s) => s.itemCode.toLowerCase() === val.trim().toLowerCase()
                          );
                          if (segMatch && !newPrice) {
                            setNewPrice(String(segMatch.pricePhp));
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
                        placeholder={currentHostSegment.availableSizes[0] || 'FREE SIZE'}
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
                        placeholder={currentHostSegment.availableColors[0] || 'ASSORTED'}
                        value={newColour}
                        onChange={(e) => setNewColour(e.target.value)}
                        className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-2 py-1.5 text-neutral-200 placeholder:text-neutral-600 focus:border-amber-500"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] text-neutral-400 block mb-0.5">Price (₱)</label>
                      <input
                        type="number"
                        placeholder={String(currentHostSegment.pricePhp)}
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
                        disabled={!newBuyerName && !newItemCode}
                        className="w-full bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 disabled:opacity-50 text-white font-semibold rounded-lg py-1.5 flex items-center justify-center gap-1.5 shadow transition cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add Mine Claim</span>
                      </button>
                    </div>
                  </div>
                </form>
              </>
            )}
          </div>

          {/* Real-time Live Comments Stream */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 flex flex-col h-[460px]">
            <div className="flex flex-wrap items-center justify-between pb-2 border-b border-neutral-800 mb-2 gap-2">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                  Today's Live Claims ({filteredLiveOrders.length})
                </h4>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={claimsFilter}
                  onChange={(e) => setClaimsFilter(e.target.value)}
                  placeholder="Filter (e.g. RUSTANS, LU)..."
                  className="bg-neutral-950 border border-neutral-800 rounded px-2 py-0.5 text-[11px] text-white placeholder:text-neutral-500 focus:outline-none focus:border-amber-500 w-36"
                />
                <button
                  type="button"
                  onClick={() => setClaimsSort((s) => (s === 'latest' ? 'earliest' : 'latest'))}
                  className="px-2 py-0.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-[10px] rounded transition cursor-pointer font-mono"
                  title="Toggle sorting"
                >
                  {claimsSort === 'latest' ? 'Latest ↓' : 'Earliest ↑'}
                </button>
              </div>
            </div>

            {/* Quick Agent Price Setter Bar by Item Code */}
            <div className="p-2 rounded-xl bg-amber-950/30 border border-amber-500/30 text-xs mb-2 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-amber-300 flex items-center gap-1">
                  <DollarSign className="w-3.5 h-3.5 text-amber-400" /> Agent Price Setter by Item Code
                </span>
                {batchStatusMsg && (
                  <span className="text-[10px] text-emerald-400 font-semibold animate-pulse">
                    ✓ {batchStatusMsg}
                  </span>
                )}
              </div>
              <form onSubmit={handleApplyBatchItemPrice} className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={batchItemCode}
                  onChange={(e) => setBatchItemCode(e.target.value)}
                  placeholder="Code (e.g. RUSTANS, 40)"
                  list="live-claims-item-codes"
                  className="flex-1 bg-neutral-900 border border-neutral-700 rounded px-2 py-1 text-xs text-white uppercase placeholder:text-neutral-500 focus:border-amber-500 focus:outline-none"
                />
                <datalist id="live-claims-item-codes">
                  {Array.from(new Set(liveOrders.map((o) => o.itemCode).filter(Boolean))).map((code) => (
                    <option key={code} value={code} />
                  ))}
                </datalist>
                <div className="flex items-center gap-1">
                  <span className="text-amber-400 text-xs font-bold">₱</span>
                  <input
                    type="number"
                    value={batchPriceInput}
                    onChange={(e) => setBatchPriceInput(e.target.value)}
                    placeholder="Price"
                    className="w-20 bg-neutral-900 border border-neutral-700 rounded px-2 py-1 text-xs text-white font-mono placeholder:text-neutral-500 focus:border-amber-500 focus:outline-none"
                  />
                </div>
                <button
                  type="submit"
                  disabled={!batchItemCode.trim() || !batchPriceInput.trim() || isApplyingBatch}
                  className="px-2.5 py-1 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-neutral-950 font-bold text-xs rounded transition flex items-center gap-1 cursor-pointer"
                >
                  Apply
                </button>
              </form>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1 text-xs">
              {filteredLiveOrders.map((ord, idx) => (
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

                    {editingPriceOrderId === ord.id ? (
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          handleSaveClaimPrice(ord.id, ord.itemCode);
                        }}
                        className="flex flex-col items-end gap-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center gap-1">
                          <span className="text-amber-400 font-bold text-xs">₱</span>
                          <input
                            type="number"
                            autoFocus
                            value={tempPriceInput}
                            onChange={(e) => setTempPriceInput(e.target.value)}
                            placeholder="Price"
                            className="w-20 bg-neutral-950 border border-amber-500 rounded px-1.5 py-0.5 text-xs text-white font-mono focus:outline-none focus:ring-1 focus:ring-amber-500"
                          />
                          <button
                            type="submit"
                            disabled={isSavingPrice}
                            className="px-2 py-0.5 bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-[10px] rounded cursor-pointer"
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingPriceOrderId(null);
                              setApplyToAllSameItem(false);
                            }}
                            className="px-1 text-neutral-400 hover:text-white text-xs"
                          >
                            ✕
                          </button>
                        </div>
                        <label className="flex items-center gap-1 text-[10px] text-neutral-400 hover:text-neutral-200 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={applyToAllSameItem}
                            onChange={(e) => setApplyToAllSameItem(e.target.checked)}
                            className="rounded border-neutral-700 bg-neutral-900 text-amber-500 text-[10px]"
                          />
                          <span>Apply to all {ord.itemCode}</span>
                        </label>
                      </form>
                    ) : ord.statedUnitPricePhp && ord.statedUnitPricePhp > 0 ? (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingPriceOrderId(ord.id);
                          setTempPriceInput(String(ord.statedUnitPricePhp));
                          setApplyToAllSameItem(false);
                        }}
                        title="Click to change price entered by agent"
                        className="group flex items-center gap-1 font-semibold text-amber-300 hover:text-amber-200 hover:bg-amber-950/60 px-2 py-0.5 rounded-lg border border-amber-500/20 hover:border-amber-500/60 transition cursor-pointer"
                      >
                        <span className="font-mono">₱{ord.statedUnitPricePhp.toLocaleString()}</span>
                        <Edit2 className="w-2.5 h-2.5 opacity-60 group-hover:opacity-100 text-amber-400 transition" />
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingPriceOrderId(ord.id);
                          setTempPriceInput('');
                          setApplyToAllSameItem(false);
                        }}
                        title="Price pending agent entry - Click to enter price"
                        className="group flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/50 hover:border-amber-400 transition cursor-pointer"
                      >
                        <Edit2 className="w-2.5 h-2.5 text-amber-300" />
                        <span className="font-semibold text-[10px] uppercase tracking-wide">Enter Price</span>
                      </button>
                    )}
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
                Live Stream Demand vs Store Wholesale Inventory
              </h3>
              <span className="px-2 py-0.5 rounded-full bg-neutral-800 text-neutral-300 font-mono text-[10px]">
                {coverageList.length} Garment Variants
              </span>
            </div>
            <p className="text-xs text-neutral-400">
              Live selling stream miner claims compared against Bangkok wholesale purchases (Total 152 pcs paid at store)
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
                    {isShort ? `SHORT ${cov.gap}` : isCovered ? 'COVERED ✓' : isExtra ? `EXTRA ${cov.gap}` : 'PENDING'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs py-1.5 bg-neutral-900/60 rounded-lg px-2.5 mb-2 font-mono">
                  <div>
                    <span className="text-neutral-500">Ordered: </span>
                    <strong className="text-white">{cov.ordered}</strong>
                  </div>
                  <div>
                    <span className="text-neutral-500">Store Stock: </span>
                    <strong className={cov.observed !== null ? 'text-amber-300' : 'text-neutral-500'}>
                      {cov.observed !== null ? cov.observed : 'Verified'}
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
