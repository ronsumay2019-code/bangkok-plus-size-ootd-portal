import React from 'react';
import { 
  X, 
  CheckCircle2, 
  AlertTriangle, 
  ShieldCheck, 
  FileText, 
  Store, 
  Layers, 
  ArrowRight,
  TrendingUp,
  Cpu,
  Clock,
  ExternalLink
} from 'lucide-react';

interface StrategicAnalysisModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const StrategicAnalysisModal: React.FC<StrategicAnalysisModalProps> = ({
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      <div className="bg-neutral-900 border border-neutral-800 rounded-3xl max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl space-y-6 p-6 sm:p-8">
        {/* Header */}
        <div className="flex items-start justify-between pb-4 border-b border-neutral-800">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-3 py-0.5 rounded-full bg-rose-500/20 text-rose-300 font-bold text-xs border border-rose-500/30">
                Executive Audit Report
              </span>
              <span className="text-xs text-neutral-400 font-mono">
                Bangkok Plus Size OOTD · Workflow 2026-10-19.10
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight mt-1">
              Live Selling Order Capture, Reconciliation & Zero-Refund Invoicing Analysis
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Section 1: The Latest Checklists Pulled from the Repository */}
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-amber-400 uppercase tracking-wider flex items-center gap-2">
            <FileText className="w-4 h-4" />
            <span>1. Latest Checklists Pulled from Repository</span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            {/* Checklist A */}
            <div className="p-4 rounded-2xl bg-neutral-950 border border-neutral-800 space-y-2">
              <div className="flex items-center justify-between">
                <strong className="text-white font-bold">A. "Ready to Leave the Store" 7-Point Gate</strong>
                <span className="text-[10px] font-mono text-emerald-400">docs/STORE-OPERATIONS.md</span>
              </div>
              <ul className="space-y-1.5 text-neutral-300">
                <li className="flex items-start gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                  <span><strong>Gate 1 (Orders on list):</strong> Every confirmed live order is linked to a store inventory row.</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                  <span><strong>Gate 2 (Rack stock):</strong> Nothing ordered is SHORT or missing a physical row on the rack.</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                  <span><strong>Gate 3 (Owner approval):</strong> Buying list approved by owner before purchase.</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                  <span><strong>Gate 4 (Purchases entered):</strong> Purchased piece counts entered for all approved rows.</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                  <span><strong>Gate 5 (Accuracy Target):</strong> Purchase is at least 90% accurate in both pieces & supplier money.</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                  <span><strong>Gate 6 (Reconciliation approved):</strong> Owner approves supplier reconciliation & receipt ref.</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                  <span><strong>Gate 7 (Shortages reviewed):</strong> Every short item reviewed; waitlist messages prepared.</span>
                </li>
              </ul>
            </div>

            {/* Checklist B */}
            <div className="p-4 rounded-2xl bg-neutral-950 border border-neutral-800 space-y-2">
              <div className="flex items-center justify-between">
                <strong className="text-white font-bold">B. Replay Orders Procedure (2026-10-15)</strong>
                <span className="text-[10px] font-mono text-emerald-400">docs/REPLAY-ORDERS-PROCEDURE.md</span>
              </div>
              <ul className="space-y-1.5 text-neutral-300">
                <li className="flex items-start gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                  <span><strong>Order Lanes:</strong> Live Broadcast/Replay Comments = <em>Live Order</em>. Messenger/Reel = <em>Pre-order</em>.</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                  <span><strong>Host Confirmation:</strong> "Palitan natin" or replacement voids original with note "REPLACED... do not buy, do not invoice".</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                  <span><strong>Host Prices Only:</strong> Unit prices taken only from host's spoken words with timestamp, never rack tags.</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                  <span><strong>Clock Lag Alignment:</strong> Calibrate broadcast creation lag (2–5 mins) before matching comments.</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                  <span><strong>No Guesswork:</strong> Ambiguous or uncalled items carry notes; owner decides final resolution.</span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Section 2: Identifying Where & How Gaps Emerge */}
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-rose-400 uppercase tracking-wider flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            <span>2. Where & How Order Capture & Reconciliation Gaps Occur</span>
          </h3>

          <div className="space-y-2.5 text-xs">
            <div className="p-3.5 rounded-xl bg-neutral-950 border border-neutral-800 space-y-1">
              <strong className="text-rose-300 font-semibold">Gap 1: Buying Behaviors During Live Chat (Glued Words, Code-Only, Rapid Comments)</strong>
              <p className="text-neutral-400 leading-relaxed">
                During fast live selling, buyers type irregular formats: "Miner1", "Mine na 3 and 7", "Confirm T2", "T maroon", or just "9". Standard regex parsers miss 80% of these (on Oct 16 Hand Stitch, standard parser caught only 19 out of ~100 order comments). When staff try to manually re-enter them during the broadcast while webhooks are also running, duplicate orders and quantity conflicts proliferate.
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-neutral-950 border border-neutral-800 space-y-1">
              <strong className="text-rose-300 font-semibold">Gap 2: Size & Color Adjustments (In-Live vs Post-Live in Business Messenger)</strong>
              <p className="text-neutral-400 leading-relaxed">
                Buyers frequently change their minds: in live chat ("Sis palitan ko size 3XL"), or 30 minutes after the live in Messenger ("Sister pwede bang Navy na lang instead of Stone?"). Previously, there was no linked amendment lane. Staff either created a second order (causing double-buying at the Bangkok store) or wrote manual paper notes that failed to update the buying sheet, resulting in Bangkok staff purchasing the wrong garment.
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-neutral-950 border border-neutral-800 space-y-1">
              <strong className="text-rose-300 font-semibold">Gap 3: Premature Invoicing & Disastrous Refund Cycles</strong>
              <p className="text-neutral-400 leading-relaxed">
                When customer orders are invoiced <em>before</em> store purchase reconciliation is confirmed, buyers pay for items that turn out to be out of stock or short at the supplier. This triggers complicated refund requests, bank transfer fees, inventory bookkeeping mismatches, and customer frustration.
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-neutral-950 border border-neutral-800 space-y-1">
              <strong className="text-rose-300 font-semibold">Gap 4: Currency Conversion & Financial Discrepancies (THB vs PHP)</strong>
              <p className="text-neutral-400 leading-relaxed">
                Purchases at Pratunam and Platinum are made in Thai Baht (THB), while customer retail sales are in Philippine Peso (PHP). Relying on assumed or hardcoded exchange rates distorts real profit margins. The app must strictly use the owner's entered daily rate, while tracking tied-up capital in extra stock and lost sales from shortages.
              </p>
            </div>
          </div>
        </div>

        {/* Section 3: How We Close the Gap (The Closed-Loop Architecture) */}
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-2">
            <ShieldCheck className="w-4 h-4" />
            <span>3. How We Close the Gap in This Solution</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="p-3.5 rounded-xl bg-emerald-950/20 border border-emerald-500/40 space-y-1">
              <strong className="text-emerald-300 font-semibold">1. Instant End-of-Live Auto-Trigger</strong>
              <p className="text-neutral-400">
                The instant the live broadcast ends, the automatic reconciliation engine triggers immediately. It pulls all captured live comments, Messenger adjustments, and VIP orders into an immutable audit snapshot.
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-emerald-950/20 border border-emerald-500/40 space-y-1">
              <strong className="text-emerald-300 font-semibold">2. Automated Amendment & Deduplication Engine</strong>
              <p className="text-neutral-400">
                Whenever a size or color swap occurs, the engine voids the original order spec (marking it <em>replaced</em>) and assigns the new variant. Replaced specs are completely removed from store demand so duplicate items are never bought.
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-emerald-950/20 border border-emerald-500/40 space-y-1">
              <strong className="text-emerald-300 font-semibold">3. Strict Gated Invoicing (Zero Refund Cycles)</strong>
              <p className="text-neutral-400">
                The portal guarantees that <strong>only reconciled, physically purchased items</strong> can be invoiced. If an item is shorted, it is completely blocked from billing; the system generates an automated warm Taglish waitlist message instead.
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-emerald-950/20 border border-emerald-500/40 space-y-1">
              <strong className="text-emerald-300 font-semibold">4. First-Come First-Served Stock Allocation</strong>
              <p className="text-neutral-400">
                If demand is 4 and rack stock is 3, the engine chronologically fills the first 3 buyers. The 4th buyer is transparently flagged as SHORT, protecting staff from arbitrary blame or confusion.
              </p>
            </div>
          </div>
        </div>

        {/* Section 4: Recommended Better Approach for Live Sessions & Replay Review */}
        <div className="p-4 rounded-2xl bg-neutral-950 border border-neutral-800 space-y-2 text-xs">
          <strong className="text-amber-300 font-bold flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            <span>4. Recommended Better Approach for Live & Replay Operations</span>
          </strong>
          <ul className="space-y-1.5 text-neutral-300">
            <li className="flex items-start gap-2">
              <span className="text-amber-400 font-bold">•</span>
              <span><strong>Real-time Rolling Demand Board during Live:</strong> Keep the "Ordered vs on the rack" view visible to the host on air. When BP02 reaches 2 orders for 2 rack pieces, the host immediately calls "Last piece na po!", stopping overselling at the source.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-amber-400 font-bold">•</span>
              <span><strong>Replay Review Timestamp Anchoring:</strong> In Replay Studio, every customer claim is timestamp-linked to the host's spoken words. One-click verification prevents pricing disputes or memory slips.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-amber-400 font-bold">•</span>
              <span><strong>AI Speech & Video Multimodal Verification:</strong> Gemini transcribe automatically turns host audio into structured price logs (e.g. `[BP01: ₱1,890 for Maricel]`), providing an independent audit layer.</span>
            </li>
          </ul>
        </div>

        {/* Footer Action */}
        <div className="flex items-center justify-end pt-2 border-t border-neutral-800">
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold transition shadow-lg"
          >
            Close & Return to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
};
