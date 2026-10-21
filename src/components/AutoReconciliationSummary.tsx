import React, { useState } from 'react';
import { 
  FileCheck, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  Copy, 
  Download, 
  Send, 
  DollarSign, 
  ShoppingBag, 
  ShieldCheck, 
  Coins, 
  Sparkles,
  Users,
  Store,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { ReconciliationSummary, BuyerBag } from '../types/reconciliation';

interface AutoReconciliationSummaryProps {
  summary: ReconciliationSummary | null;
  onGenerateInvoices: (buyerNames?: string[]) => void;
  onTriggerReconciliation: () => void;
}

export const AutoReconciliationSummary: React.FC<AutoReconciliationSummaryProps> = ({
  summary,
  onGenerateInvoices,
  onTriggerReconciliation,
}) => {
  const [selectedBuyer, setSelectedBuyer] = useState<string | null>(null);
  const [copiedDraft, setCopiedDraft] = useState<string | null>(null);
  const [invoicingSuccess, setInvoicingSuccess] = useState(false);
  const [filterMode, setFilterMode] = useState<'all' | 'ready' | 'needs_resolution'>('all');

  if (!summary) {
    return (
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-12 text-center space-y-4">
        <Sparkles className="w-12 h-12 text-amber-400 mx-auto" />
        <h3 className="text-lg font-bold text-white">No Reconciliation Data Available Yet</h3>
        <p className="text-sm text-neutral-400 max-w-md mx-auto">
          The automatic reconciliation pipeline triggers immediately when a live selling broadcast ends, or you can trigger it manually anytime.
        </p>
        <button
          onClick={onTriggerReconciliation}
          className="px-5 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold transition shadow-lg"
        >
          Run Reconciliation Pipeline Now
        </button>
      </div>
    );
  }

  const handleCopyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedDraft(id);
    setTimeout(() => setCopiedDraft(null), 2500);
  };

  const handleApproveAllInvoices = () => {
    onGenerateInvoices();
    setInvoicingSuccess(true);
    setTimeout(() => setInvoicingSuccess(false), 4000);
  };

  const filteredBags = summary.buyerBags.filter((b) => {
    if (filterMode === 'ready') return b.totalPiecesGot > 0 && b.isComplete;
    if (filterMode === 'needs_resolution') return !b.isComplete;
    return true;
  });

  const accuracy = summary.accuracy;
  const readyChecklist = summary.checklist.readyToLeaveStore;

  return (
    <div className="space-y-6">
      {/* Top Banner: Auto-Triggered Status & Reconciled Checkpoint */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-rose-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold text-xs border border-emerald-500/30 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                AUTOMATIC RECONCILIATION COMPLETE
              </span>
              <span className="text-xs text-neutral-500">
                Triggered: {new Date(summary.generatedAt).toLocaleTimeString()}
              </span>
            </div>
            <h2 className="text-xl font-bold text-white tracking-tight">
              Consolidated Reconciliation & Gated Invoicing Summary
            </h2>
            <p className="text-xs text-neutral-400">
              Live Session: <strong className="text-neutral-200">{summary.liveTitle}</strong> · Bangkok Store Buying
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onTriggerReconciliation}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-xl text-xs font-semibold border border-neutral-700 transition"
            >
              <Sparkles className="w-3.5 h-3.5 text-rose-400" />
              <span>Re-Run Audit</span>
            </button>
            <button
              onClick={handleApproveAllInvoices}
              className="flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-emerald-950/40 transition"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Approve Invoices for Reconciled Items Only ({summary.invoicingQueue.eligibleInvoicesCount})</span>
            </button>
          </div>
        </div>

        {/* Success Alert Banner */}
        {invoicingSuccess && (
          <div className="mb-6 p-4 rounded-xl bg-emerald-950/60 border border-emerald-500/60 text-emerald-200 text-xs flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <div>
              <strong>Official Invoices Successfully Generated!</strong> Only verified, purchased pieces were billed. Shortages were protected from invoicing, eliminating refund cycles.
            </div>
          </div>
        )}

        {/* 4 Financial & Operational Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Reconciled Revenue */}
          <div className="bg-neutral-950/60 border border-neutral-800 rounded-xl p-4">
            <div className="flex items-center justify-between text-neutral-400 text-xs mb-2">
              <span>Reconciled Buyer Revenue</span>
              <DollarSign className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-bold text-emerald-400 font-mono">
              ₱{summary.projectedRevenuePhp.toLocaleString()}
            </div>
            <div className="text-[11px] text-neutral-500 mt-1 flex items-center justify-between">
              <span>{summary.invoicingQueue.eligibleInvoicesCount} Invoicable Bags</span>
              <span className="text-emerald-500 font-semibold">100% Verified Stock</span>
            </div>
          </div>

          {/* Card 2: Supplier Purchases THB */}
          <div className="bg-neutral-950/60 border border-neutral-800 rounded-xl p-4">
            <div className="flex items-center justify-between text-neutral-400 text-xs mb-2">
              <span>Supplier Purchase Cost</span>
              <Coins className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-2xl font-bold text-amber-300 font-mono">
              ฿{summary.totalPurchasedCostThb.toLocaleString()} <span className="text-xs text-neutral-400">THB</span>
            </div>
            <div className="text-[11px] text-neutral-500 mt-1 flex items-center justify-between">
              <span>Rate: 1 THB = ₱{summary.phpPerThbRate ?? 1.62}</span>
              <span className="text-amber-400">≈ ₱{Math.round(summary.totalPurchasedCostThb * (summary.phpPerThbRate || 1.62)).toLocaleString()}</span>
            </div>
          </div>

          {/* Card 3: Estimated Gross Profit */}
          <div className="bg-neutral-950/60 border border-neutral-800 rounded-xl p-4">
            <div className="flex items-center justify-between text-neutral-400 text-xs mb-2">
              <span>Projected Gross Margin</span>
              <Sparkles className="w-4 h-4 text-rose-400" />
            </div>
            <div className="text-2xl font-bold text-rose-400 font-mono">
              ₱{(summary.estimatedGrossProfitPhp || 0).toLocaleString()}
            </div>
            <div className="text-[11px] text-neutral-500 mt-1">
              Live Session Margin: {summary.projectedRevenuePhp > 0 ? Math.round(((summary.estimatedGrossProfitPhp || 0) / summary.projectedRevenuePhp) * 100) : 0}%
            </div>
          </div>

          {/* Card 4: Store Purchase Accuracy */}
          <div className="bg-neutral-950/60 border border-neutral-800 rounded-xl p-4">
            <div className="flex items-center justify-between text-neutral-400 text-xs mb-2">
              <span>Purchase Accuracy</span>
              <ShieldCheck className="w-4 h-4 text-purple-400" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-purple-300 font-mono">
                {accuracy.piecesAccuracy ?? 100}%
              </span>
              <span className="text-xs text-neutral-400">Target: {accuracy.targetPercent}%</span>
            </div>
            <div className="text-[11px] text-neutral-500 mt-1 flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${accuracy.isPassing ? 'bg-emerald-400' : 'bg-amber-400'}`} />
              <span>{accuracy.isPassing ? 'Owner Target Met ✓' : 'Shortage Discrepancy'}</span>
            </div>
          </div>
        </div>

        {/* Shortages & Tied Up Extras Notice */}
        {(summary.extraStockCostThb > 0 || summary.projectedLostSalesPhp > 0) && (
          <div className="mt-4 p-3 bg-neutral-950/70 border border-neutral-800 rounded-xl flex flex-wrap items-center justify-between gap-4 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-neutral-400">Tied-Up Extra Stock:</span>
              <strong className="text-purple-300 font-mono">฿{summary.extraStockCostThb.toLocaleString()} THB</strong>
              <span className="text-neutral-500">(Surplus inventory to list on catalogue)</span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-neutral-400">Lost Sales From Shortage:</span>
              <strong className="text-rose-400 font-mono">₱{summary.projectedLostSalesPhp.toLocaleString()} PHP</strong>
              <span className="text-neutral-500">(Oversold demand unfulfilled at store)</span>
            </div>
          </div>
        )}
      </div>

      {/* Zero Refund Invoicing Gate Section */}
      <div className="bg-gradient-to-r from-purple-950/30 via-neutral-900 to-emerald-950/30 border border-purple-500/30 rounded-2xl p-6 shadow-xl">
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-xl bg-purple-500/20 text-purple-300 border border-purple-500/30">
            <ShieldCheck className="w-6 h-6" />
          </div>

          <div className="space-y-1 flex-1">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <span>Zero-Refund Cycle Invoicing Gate</span>
              <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-xs font-mono">
                {summary.invoicingQueue.eligibleInvoicesCount} Ready / {summary.invoicingQueue.blockedInvoicesCount} Blocked
              </span>
            </h3>
            <p className="text-xs text-neutral-300 leading-relaxed">
              <strong>Owner Core Business Rule:</strong> Only final orders verified and covered by physical store purchases are billed. If an item was short or unfulfilled at the supplier, it is <em>strictly excluded</em> from the invoice. This guarantees 100% fulfillment, eliminates refund cycles, avoids customer disputes, and streamlines cash flow.
            </p>
          </div>
        </div>
      </div>

      {/* Tabbed View: Buyer Bags vs Store Buying Sheet */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="p-4 bg-neutral-900/90 border-b border-neutral-800 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-4 h-4 text-rose-400" />
            <h3 className="font-bold text-sm text-white">
              Reconciled Buyer Allocation Bags ({summary.buyerBags.length} Customers)
            </h3>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 text-xs">
            <button
              onClick={() => setFilterMode('all')}
              className={`px-3 py-1.5 rounded-lg font-medium transition ${
                filterMode === 'all'
                  ? 'bg-rose-600 text-white'
                  : 'bg-neutral-800 text-neutral-400 hover:text-neutral-200'
              }`}
            >
              All Bags ({summary.buyerBags.length})
            </button>
            <button
              onClick={() => setFilterMode('ready')}
              className={`px-3 py-1.5 rounded-lg font-medium transition ${
                filterMode === 'ready'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-neutral-800 text-neutral-400 hover:text-neutral-200'
              }`}
            >
              100% Complete ({summary.buyerBags.filter((b) => b.isComplete).length})
            </button>
            <button
              onClick={() => setFilterMode('needs_resolution')}
              className={`px-3 py-1.5 rounded-lg font-medium transition ${
                filterMode === 'needs_resolution'
                  ? 'bg-amber-600 text-white'
                  : 'bg-neutral-800 text-neutral-400 hover:text-neutral-200'
              }`}
            >
              Has Shortages ({summary.buyerBags.filter((b) => !b.isComplete).length})
            </button>
          </div>
        </div>

        {/* Customer Bags List */}
        <div className="divide-y divide-neutral-800">
          {filteredBags.map((bag) => {
            const isExpanded = selectedBuyer === bag.buyerName;
            const hasShortage = !bag.isComplete;

            return (
              <div key={bag.buyerName} className="p-4 hover:bg-neutral-800/30 transition">
                <div 
                  className="flex flex-wrap items-center justify-between gap-4 cursor-pointer"
                  onClick={() => setSelectedBuyer(isExpanded ? null : bag.buyerName)}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs ${
                      bag.isComplete
                        ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-500/40'
                        : 'bg-amber-950/60 text-amber-300 border border-amber-500/40'
                    }`}>
                      {bag.buyerName.slice(0, 2).toUpperCase()}
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-white">{bag.buyerName}</span>
                        <span className="text-xs text-neutral-500 font-mono">{bag.buyerContact}</span>
                        {hasShortage && (
                          <span className="px-2 py-0.2 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-bold border border-amber-500/30">
                            Short {bag.totalPiecesMissing} pc
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-neutral-400 mt-0.5">
                        {bag.lines.length} Line items · {bag.totalPiecesGot} pcs verified
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="font-bold text-sm text-emerald-400 font-mono">
                        ₱{bag.subtotalPhp.toLocaleString()}
                      </div>
                      <div className="text-[10px] text-neutral-500">
                        {bag.invoiceStatus === 'invoiced' ? (
                          <span className="text-emerald-400 font-semibold">INVOICED #{bag.invoiceId}</span>
                        ) : (
                          'Ready to invoice'
                        )}
                      </div>
                    </div>

                    {isExpanded ? (
                      <ChevronUp className="w-5 h-5 text-neutral-400" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-neutral-400" />
                    )}
                  </div>
                </div>

                {/* Expanded Details: Bag Line Items & Messenger Draft */}
                {isExpanded && (
                  <div className="mt-4 pt-4 border-t border-neutral-800 space-y-4">
                    {/* Line Items Table */}
                    <div className="bg-neutral-950 rounded-xl border border-neutral-800 overflow-hidden text-xs">
                      <table className="w-full text-left">
                        <thead className="bg-neutral-900/80 text-neutral-400 border-b border-neutral-800">
                          <tr>
                            <th className="p-2.5 font-medium">Item & Spec</th>
                            <th className="p-2.5 font-medium">Ordered</th>
                            <th className="p-2.5 font-medium">Got (Store)</th>
                            <th className="p-2.5 font-medium">Missing</th>
                            <th className="p-2.5 font-medium">Unit Price</th>
                            <th className="p-2.5 font-medium">Total Billed</th>
                            <th className="p-2.5 font-medium">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-850">
                          {bag.lines.map((l) => (
                            <tr key={l.orderId} className={l.missing > 0 ? 'bg-amber-950/10' : ''}>
                              <td className="p-2.5">
                                <span className="font-mono font-bold text-white">{l.itemCode}</span>
                                <span className="text-neutral-400 ml-2">({l.size} {l.colour})</span>
                              </td>
                              <td className="p-2.5 text-neutral-300 font-mono">{l.ordered}</td>
                              <td className="p-2.5 text-emerald-400 font-bold font-mono">{l.got}</td>
                              <td className="p-2.5 font-mono">
                                {l.missing > 0 ? (
                                  <span className="text-amber-400 font-bold">{l.missing}</span>
                                ) : (
                                  <span className="text-neutral-600">0</span>
                                )}
                              </td>
                              <td className="p-2.5 text-neutral-300 font-mono">₱{l.unitPricePhp.toLocaleString()}</td>
                              <td className="p-2.5 text-emerald-400 font-mono font-bold">
                                ₱{(l.got * l.unitPricePhp).toLocaleString()}
                              </td>
                              <td className="p-2.5">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  l.status === 'filled'
                                    ? 'bg-emerald-500/20 text-emerald-300'
                                    : l.status === 'partial'
                                    ? 'bg-amber-500/20 text-amber-300'
                                    : 'bg-red-500/20 text-red-300'
                                }`}>
                                  {l.status.toUpperCase()}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Pre-Drafted Warm Taglish Messenger Message */}
                    {bag.suggestedMessageDraft && (
                      <div className="bg-amber-950/20 border border-amber-600/30 rounded-xl p-3.5 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-amber-200 flex items-center gap-1.5">
                            <Send className="w-3.5 h-3.5 text-amber-400" />
                            <span>Messenger Waitlist & Shortage Draft (Zero-Refund Protocol)</span>
                          </span>
                          <button
                            onClick={() => handleCopyText(bag.suggestedMessageDraft!, bag.buyerName)}
                            className="flex items-center gap-1 px-2.5 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-xs font-medium transition"
                          >
                            <Copy className="w-3 h-3" />
                            <span>{copiedDraft === bag.buyerName ? 'Copied!' : 'Copy Message'}</span>
                          </button>
                        </div>
                        <p className="text-xs text-neutral-300 italic bg-neutral-950/80 p-2.5 rounded-lg border border-neutral-800">
                          "{bag.suggestedMessageDraft}"
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Consolidated Store Buying Sheet */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-neutral-800">
          <div className="flex items-center gap-2">
            <Store className="w-4 h-4 text-amber-400" />
            <h3 className="font-bold text-sm text-white">
              Consolidated Store Buying Sheet (Supplier Purchase Breakdown)
            </h3>
          </div>
          <span className="text-xs text-neutral-400 font-mono">
            ฿{summary.totalPurchasedCostThb.toLocaleString()} THB Total
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-neutral-950 text-neutral-400 border-b border-neutral-800">
              <tr>
                <th className="p-3 font-semibold">Variant Key</th>
                <th className="p-3 font-semibold">Approved Demand</th>
                <th className="p-3 font-semibold">Purchased Count</th>
                <th className="p-3 font-semibold">Status</th>
                <th className="p-3 font-semibold">Unit Cost (THB)</th>
                <th className="p-3 font-semibold">Total Cost (THB)</th>
                <th className="p-3 font-semibold">Tied Up / Lost Sales</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800 font-mono">
              {summary.variants.map((v) => {
                const [code, size, colour] = v.key.split('|');
                return (
                  <tr key={v.key} className="hover:bg-neutral-800/30">
                    <td className="p-3">
                      <strong className="text-white">{code}</strong> · {size} {colour}
                    </td>
                    <td className="p-3 text-neutral-300">{v.approvedDemand} pcs</td>
                    <td className="p-3 text-emerald-400 font-bold">{v.purchasedCount ?? 'Pending'} pcs</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        v.shortCount > 0
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          : v.extraCount > 0
                          ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                          : 'bg-emerald-500/20 text-emerald-300'
                      }`}>
                        {v.shortCount > 0
                          ? `SHORT ${v.shortCount}`
                          : v.extraCount > 0
                          ? `EXTRA ${v.extraCount}`
                          : 'BALANCED ✓'}
                      </span>
                    </td>
                    <td className="p-3 text-neutral-300">฿{v.unitCostThb ?? 0}</td>
                    <td className="p-3 text-amber-300 font-bold">
                      ฿{((v.purchasedCount || 0) * (v.unitCostThb || 0)).toLocaleString()}
                    </td>
                    <td className="p-3 text-neutral-400">
                      {v.extraCostThb ? (
                        <span className="text-purple-300">฿{v.extraCostThb.toLocaleString()} extra</span>
                      ) : v.lostSalesPhp ? (
                        <span className="text-rose-400">₱{v.lostSalesPhp.toLocaleString()} lost</span>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
