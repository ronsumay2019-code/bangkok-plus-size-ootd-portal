import React, { useState } from 'react';
import { Radio, Play, RotateCcw, ClipboardCheck, FileCheck, Wallet, Trash2 } from 'lucide-react';
import type { BuyerOrder, LiveSession } from '../types/reconciliation';
import { formatManilaDay, manilaDay } from '../utils/dates';

interface ReadyForNextLiveProps {
  /** The most recent live (ended), or a placeholder when there is none yet */
  lastLive: LiveSession;
  /** That live's orders */
  orders: BuyerOrder[];
  onStartNewLive?: (fbVideo: string) => Promise<void> | void;
  onResumeLive?: () => void;
  onOpenReview?: () => void;
  onOpenReconciliation?: () => void;
  onOpenPayments?: () => void;
  /** Owner only */
  onStartFresh?: (fbVideo: string, confirm: string) => Promise<string | null>;
}

/** The Live Session screen before and after a live: nothing from the last live, just what to do next. */
export const ReadyForNextLive: React.FC<ReadyForNextLiveProps> = ({
  lastLive,
  orders,
  onStartNewLive,
  onResumeLive,
  onOpenReview,
  onOpenReconciliation,
  onOpenPayments,
  onStartFresh,
}) => {
  const [link, setLink] = useState('');
  const [starting, setStarting] = useState(false);
  const [showFresh, setShowFresh] = useState(false);
  const [freshVideo, setFreshVideo] = useState('');
  const [freshConfirm, setFreshConfirm] = useState('');
  const [freshBusy, setFreshBusy] = useState(false);
  const [freshError, setFreshError] = useState<string | null>(null);

  const day = manilaDay(lastLive.startedAt) || lastLive.storeDate;
  const endedToday = lastLive.status === 'ended' && day === manilaDay(new Date().toISOString());
  const hasLastLive = !!lastLive.endedAt || orders.length > 0;
  const count = (f: (o: BuyerOrder) => boolean) => orders.filter(f).length;
  const toReview = count((o) => o.status === 'pending');
  const invoiced = new Set(orders.filter((o) => o.invoiced && o.invoiceNumber).map((o) => o.invoiceNumber)).size;
  const unpaid = new Set(orders.filter((o) => o.invoiced && o.invoiceNumber && o.paymentStatus !== 'paid').map((o) => o.invoiceNumber)).size;

  return (
    <div className="space-y-4">
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 sm:p-6 shadow-xl space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-rose-600/20 text-rose-300 border border-rose-500/40">
            <Radio className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Ready for the next live</h2>
            <p className="text-xs text-neutral-400">Paste the Facebook live link when you go live, then tap Start. Orders from the comments appear here.</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            name="nextLiveLink"
            aria-label="Facebook live link"
            value={link}
            onChange={(e) => setLink(e.target.value)}
            placeholder="Facebook live link or video ID (optional)"
            className="flex-1 bg-neutral-950 border border-neutral-700 rounded-xl px-3 py-2.5 text-sm text-white font-mono placeholder:text-neutral-600"
          />
          <button
            type="button"
            disabled={starting || !onStartNewLive}
            onClick={async () => {
              setStarting(true);
              try {
                await onStartNewLive?.(link.trim());
                setLink('');
              } finally {
                setStarting(false);
              }
            }}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 disabled:opacity-50 text-white font-bold text-sm flex items-center justify-center gap-2"
          >
            <Play className="w-4 h-4 fill-current" /> {starting ? 'Starting…' : 'Start new live'}
          </button>
        </div>
        <p className="text-[11px] text-neutral-500">
          Facebook only lets the portal find a live by itself after Meta approves the app, so paste the link to be sure every comment is read.
        </p>
      </div>

      {hasLastLive && (
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <span className="text-[10px] uppercase tracking-wider text-neutral-500 font-semibold">Last live</span>
              <h3 className="text-sm font-bold text-white">
                {lastLive.title} · {formatManilaDay(day)}
              </h3>
            </div>
            {endedToday && onResumeLive && (
              <button type="button" onClick={onResumeLive} className="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs flex items-center gap-1.5">
                <RotateCcw className="w-3.5 h-3.5" /> Resume this live
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <div className="p-2.5 rounded-xl bg-neutral-950 border border-neutral-800"><b className="block text-lg text-white">{orders.length}</b>orders</div>
            <div className="p-2.5 rounded-xl bg-neutral-950 border border-neutral-800"><b className="block text-lg text-amber-300">{toReview}</b>to review</div>
            <div className="p-2.5 rounded-xl bg-neutral-950 border border-neutral-800"><b className="block text-lg text-sky-300">{invoiced}</b>invoiced</div>
            <div className="p-2.5 rounded-xl bg-neutral-950 border border-neutral-800"><b className="block text-lg text-rose-300">{unpaid}</b>waiting for payment</div>
          </div>
          <p className="text-[11px] text-neutral-500">Invoice and collect payment within 24 hours of the live.</p>
          <div className="flex flex-wrap gap-2 text-xs">
            <button type="button" onClick={onOpenReview} className="px-3 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-white font-semibold flex items-center gap-1.5">
              <ClipboardCheck className="w-4 h-4" /> Review orders
            </button>
            <button type="button" onClick={onOpenReconciliation} className="px-3 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-white font-semibold flex items-center gap-1.5">
              <FileCheck className="w-4 h-4" /> Reconcile &amp; invoice
            </button>
            <button type="button" onClick={onOpenPayments} className="px-3 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-white font-semibold flex items-center gap-1.5">
              <Wallet className="w-4 h-4" /> Payments &amp; shipping
            </button>
          </div>
        </div>
      )}

      {onStartFresh && (
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 text-xs space-y-2">
          {!showFresh ? (
            <button type="button" onClick={() => setShowFresh(true)} className="text-amber-300 hover:text-amber-200 font-semibold flex items-center gap-1.5">
              <Trash2 className="w-3.5 h-3.5" /> Start fresh from a live… (owner)
            </button>
          ) : (
            <div className="space-y-2">
              <p className="text-amber-100">
                <strong>Owner only.</strong> Deletes every order, live, pre-order and rack row in the portal, then starts again from the live below; its
                comments are pulled fresh. Messenger chats and staff sign-ins are kept.
              </p>
              <input
                type="text"
                name="freshVideo"
                aria-label="Facebook live link or video ID"
                value={freshVideo}
                onChange={(e) => setFreshVideo(e.target.value)}
                placeholder="Facebook live link or video ID"
                className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-2.5 py-1.5 text-white font-mono"
              />
              <input
                type="text"
                name="freshConfirm"
                aria-label="Type START FRESH to confirm"
                value={freshConfirm}
                onChange={(e) => setFreshConfirm(e.target.value)}
                placeholder="Type START FRESH to confirm"
                autoCapitalize="characters"
                className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-2.5 py-1.5 text-white font-mono"
              />
              {freshError && <p className="text-rose-300">{freshError}</p>}
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={freshBusy || freshConfirm.trim().toUpperCase() !== 'START FRESH' || !freshVideo.trim()}
                  onClick={async () => {
                    setFreshBusy(true);
                    setFreshError(null);
                    const err = await onStartFresh(freshVideo.trim(), freshConfirm.trim().toUpperCase());
                    setFreshBusy(false);
                    if (err) setFreshError(err);
                    else {
                      setShowFresh(false);
                      setFreshVideo('');
                      setFreshConfirm('');
                    }
                  }}
                  className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-white font-bold"
                >
                  {freshBusy ? 'Starting fresh…' : 'Delete and start fresh'}
                </button>
                <button type="button" onClick={() => setShowFresh(false)} className="px-3 py-1.5 rounded-lg bg-neutral-800 text-neutral-300">
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
