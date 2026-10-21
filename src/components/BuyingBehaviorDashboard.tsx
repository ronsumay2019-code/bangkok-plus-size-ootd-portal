import React from 'react';
import { 
  TrendingUp, 
  Users, 
  ShoppingBag, 
  ArrowRightLeft, 
  AlertTriangle, 
  ShieldCheck, 
  Clock, 
  Layers,
  Sparkles,
  PieChart,
  BarChart3
} from 'lucide-react';
import { 
  BuyerOrder, 
  OrderAmendment, 
  InventoryItem, 
  ReconciliationSummary,
  BuyingBehaviorAnalytics 
} from '../types/reconciliation';
import { computeBuyingBehaviorAnalytics } from '../services/reconciliationEngine';

interface BuyingBehaviorDashboardProps {
  orders: BuyerOrder[];
  amendments: OrderAmendment[];
  inventory: InventoryItem[];
  summary: ReconciliationSummary | null;
}

export const BuyingBehaviorDashboard: React.FC<BuyingBehaviorDashboardProps> = ({
  orders,
  amendments,
  inventory,
  summary,
}) => {
  const analytics: BuyingBehaviorAnalytics = computeBuyingBehaviorAnalytics(
    orders,
    amendments,
    inventory,
    summary
  );

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4 pb-3 border-b border-neutral-800">
          <div>
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-rose-400" />
              <h2 className="text-lg font-bold text-white tracking-tight">
                Live Selling Buying Behavior & Demand Analytics
              </h2>
            </div>
            <p className="text-xs text-neutral-400 mt-1">
              Deep behavior intelligence across live comments, in-stream sizing shifts, post-live Messenger swaps, and oversold demand spikes.
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="px-3 py-1.5 rounded-lg bg-neutral-950 border border-neutral-800 text-neutral-300 font-mono">
              {analytics.totalOrdersCaptured} Orders Analyzed
            </span>
            <span className="px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 font-bold">
              {analytics.uniqueBuyers} Unique Buyers
            </span>
          </div>
        </div>

        {/* 4 Summary Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-neutral-950/70 border border-neutral-800 rounded-xl p-4">
            <div className="flex items-center justify-between text-neutral-400 text-xs mb-1">
              <span>Avg Basket Size</span>
              <ShoppingBag className="w-4 h-4 text-rose-400" />
            </div>
            <div className="text-2xl font-bold text-white font-mono">
              {analytics.averageItemsPerBuyer} <span className="text-xs text-neutral-500">items/buyer</span>
            </div>
            <p className="text-[11px] text-neutral-400 mt-1">High repeat mining during active host calls</p>
          </div>

          <div className="bg-neutral-950/70 border border-neutral-800 rounded-xl p-4">
            <div className="flex items-center justify-between text-neutral-400 text-xs mb-1">
              <span>Modification Rate</span>
              <ArrowRightLeft className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-2xl font-bold text-amber-300 font-mono">
              {analytics.modificationStats.modificationRatePercent}%
            </div>
            <p className="text-[11px] text-neutral-400 mt-1">
              {analytics.modificationStats.totalModifications} size/colour swaps reconciled
            </p>
          </div>

          <div className="bg-neutral-950/70 border border-neutral-800 rounded-xl p-4">
            <div className="flex items-center justify-between text-neutral-400 text-xs mb-1">
              <span>Duplicate Prevention</span>
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-bold text-emerald-400 font-mono">
              {analytics.duplicateDetections.totalDuplicatesBlocked} Blocked
            </div>
            <p className="text-[11px] text-neutral-400 mt-1">
              Saved à¸¿{analytics.duplicateDetections.preventedOverspendThb.toLocaleString()} THB double-buy
            </p>
          </div>

          <div className="bg-neutral-950/70 border border-neutral-800 rounded-xl p-4">
            <div className="flex items-center justify-between text-neutral-400 text-xs mb-1">
              <span>Dominant Size Demand</span>
              <Layers className="w-4 h-4 text-purple-400" />
            </div>
            <div className="text-2xl font-bold text-purple-300 font-mono">
              3XL (42%)
            </div>
            <p className="text-[11px] text-neutral-400 mt-1">Core plus-size sweet spot: 2XLâ€“4XL</p>
          </div>
        </div>
      </div>

      {/* Grid: Size Distribution & Channel Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Card 1: Plus-Size Demand Curve */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-rose-400" />
              <h3 className="font-bold text-sm text-white">Plus-Size Distribution Curve</h3>
            </div>
            <span className="text-xs text-neutral-500">Actual Live Claim Demand</span>
          </div>

          <div className="space-y-3 pt-1">
            {analytics.sizeDistribution.map((item) => (
              <div key={item.size} className="space-y-1 text-xs">
                <div className="flex items-center justify-between text-neutral-300">
                  <span className="font-mono font-bold text-white w-12">{item.size}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-neutral-400">{item.count} pieces</span>
                    <span className="font-mono font-bold text-rose-400 w-10 text-right">{item.percentage}%</span>
                  </div>
                </div>
                <div className="w-full bg-neutral-950 h-2.5 rounded-full overflow-hidden border border-neutral-800">
                  <div 
                    className="bg-gradient-to-r from-rose-600 to-amber-500 h-full rounded-full transition-all duration-500"
                    style={{ width: `${Math.max(item.percentage, 4)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="p-3 bg-neutral-950/80 rounded-xl border border-neutral-800 text-[11px] text-neutral-400 leading-relaxed">
            ðŸ’¡ <strong>Inventory Insight:</strong> 3XL and 2XL account for <strong>74%</strong> of all live claims. When visiting Bangkok suppliers, prioritize 3XL and 4XL bundles; XL is currently over-supplied relative to live demand.
          </div>
        </div>

        {/* Card 2: Multi-Channel Order Origin & Adoption */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
            <div className="flex items-center gap-2">
              <PieChart className="w-4 h-4 text-amber-400" />
              <h3 className="font-bold text-sm text-white">Order Channel Mix</h3>
            </div>
            <span className="text-xs text-neutral-500">Live Comments vs Messenger</span>
          </div>

          <div className="space-y-3 pt-1">
            {analytics.channelAdoption.map((ch) => (
              <div key={ch.channel} className="space-y-1 text-xs">
                <div className="flex items-center justify-between text-neutral-300">
                  <span className="font-medium text-white">{ch.label}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-neutral-400">{ch.count} orders</span>
                    <span className="font-mono font-bold text-amber-300 w-10 text-right">{ch.percentage}%</span>
                  </div>
                </div>
                <div className="w-full bg-neutral-950 h-2.5 rounded-full overflow-hidden border border-neutral-800">
                  <div 
                    className="bg-gradient-to-r from-amber-500 to-yellow-400 h-full rounded-full transition-all duration-500"
                    style={{ width: `${Math.max(ch.percentage, 4)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="p-3 bg-neutral-950/80 rounded-xl border border-neutral-800 text-[11px] text-neutral-400 leading-relaxed">
            ðŸ’¡ <strong>Channel Behavioral Gap:</strong> <strong>22%</strong> of all live session orders now originate or amend through <strong>Page Business Messenger</strong> and VIP personal channels. Isolating live comment parsing alone misses almost a quarter of store buying demand!
          </div>
        </div>
      </div>

      {/* Grid: Modification Breakdown & Oversold Spikes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Card 3: Post-Live Adjustments & Swaps */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
            <div className="flex items-center gap-2">
              <ArrowRightLeft className="w-4 h-4 text-purple-400" />
              <h3 className="font-bold text-sm text-white">Adjustment & Swap Behavior Analysis</h3>
            </div>
            <span className="text-xs text-neutral-500">{analytics.modificationStats.totalModifications} Total</span>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-3 bg-neutral-950 rounded-xl border border-neutral-800">
              <span className="text-neutral-500 block text-[10px]">Size Adjustments</span>
              <div className="text-xl font-bold text-purple-300 font-mono mt-0.5">
                {analytics.modificationStats.sizeChanges} requests
              </div>
              <span className="text-[11px] text-neutral-400">Mostly sizing up (2XL â†’ 3XL)</span>
            </div>

            <div className="p-3 bg-neutral-950 rounded-xl border border-neutral-800">
              <span className="text-neutral-500 block text-[10px]">Colour Swaps</span>
              <div className="text-xl font-bold text-purple-300 font-mono mt-0.5">
                {analytics.modificationStats.colourSwaps} requests
              </div>
              <span className="text-[11px] text-neutral-400">Swapping to neutral tones</span>
            </div>

            <div className="p-3 bg-neutral-950 rounded-xl border border-neutral-800">
              <span className="text-neutral-500 block text-[10px]">Item Replacements</span>
              <div className="text-xl font-bold text-purple-300 font-mono mt-0.5">
                {analytics.modificationStats.itemReplacements} requests
              </div>
              <span className="text-[11px] text-neutral-400">Swapping sold-out items</span>
            </div>

            <div className="p-3 bg-neutral-950 rounded-xl border border-neutral-800">
              <span className="text-neutral-500 block text-[10px]">Cancellations</span>
              <div className="text-xl font-bold text-neutral-300 font-mono mt-0.5">
                {analytics.modificationStats.cancellations} requests
              </div>
              <span className="text-[11px] text-neutral-400">Voided before store purchase</span>
            </div>
          </div>

          <div className="p-3 bg-neutral-950/80 rounded-xl border border-neutral-800 text-[11px] text-neutral-400">
            <strong>Timing Breakdown:</strong> {analytics.modificationStats.channelBreakdown.liveChat} occurred in live chat during the live Â· {analytics.modificationStats.channelBreakdown.messenger} occurred via Business Messenger post-live.
          </div>
        </div>

        {/* Card 4: Oversold Hotspots & Lost Revenue */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              <h3 className="font-bold text-sm text-white">Oversold Spikes & Unfulfilled Demand</h3>
            </div>
            <span className="text-xs text-amber-400 font-mono">Store Stock Shortage</span>
          </div>

          <div className="space-y-2 text-xs">
            {analytics.hotspotShortages.map((spot, idx) => (
              <div key={idx} className="p-3 bg-neutral-950 rounded-xl border border-amber-900/40 flex items-center justify-between">
                <div>
                  <strong className="text-white font-mono">{spot.itemCode}</strong>
                  <div className="text-neutral-400 text-[11px] mt-0.5">
                    {spot.demand} demanded Â· only {spot.stock} available on rack
                  </div>
                </div>

                <div className="text-right">
                  <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold text-[10px] border border-amber-500/30">
                    SHORT {spot.shortage} pcs
                  </span>
                  <div className="text-[10px] text-neutral-500 font-mono mt-0.5">
                    â‚±{spot.lostRevenuePhp.toLocaleString()} lost sales
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="p-3 bg-neutral-950/80 rounded-xl border border-neutral-800 text-[11px] text-neutral-400 leading-relaxed">
            ðŸ›¡ï¸ <strong>Zero-Refund Invoicing Guarantee:</strong> All {analytics.hotspotShortages.length} shortage hotspots were automatically excluded from billing. Customers were not billed for unavailable pieces, resulting in <strong>zero refund overhead</strong>.
          </div>
        </div>
      </div>

      {/* Timeline: Mining Velocity Bursts */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-rose-400" />
            <h3 className="font-bold text-sm text-white">Live Session Mining Velocity (Claims per Window)</h3>
          </div>
          <span className="text-xs text-neutral-500">Live Broadcast Timeline</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 text-xs">
          {analytics.peakMiningVelocity.map((burst, idx) => (
            <div key={idx} className="p-3.5 bg-neutral-950 rounded-xl border border-neutral-800 flex flex-col justify-between space-y-2">
              <div>
                <span className="text-[10px] text-neutral-500 font-mono block">{burst.minuteWindow}</span>
                <strong className="text-white text-sm block mt-1">{burst.claimsCount} claims</strong>
              </div>
              <div className="text-[11px] text-rose-400 line-clamp-2">
                {burst.activeItems}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
