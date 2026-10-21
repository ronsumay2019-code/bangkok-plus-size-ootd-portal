import React, { useState, useMemo } from 'react';
import { 
  Store, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  AlertCircle,
  Plus, 
  Save, 
  Receipt, 
  RotateCcw,
  RefreshCw,
  Search,
  Filter,
  Package,
  Layers,
  Sparkles,
  ArrowRight,
  Clock,
  Check,
  ChevronDown,
  X
} from 'lucide-react';
import { 
  InventoryItem, 
  ReconciliationSummary, 
  InventorySyncResult, 
  InventoryDiscrepancy,
  LiveSession 
} from '../types/reconciliation';

interface InventoryStoreBoardProps {
  inventory: InventoryItem[];
  summary: ReconciliationSummary | null;
  phpRate: number;
  onUpdateItem: (itemId: string, patch: Partial<InventoryItem>) => void;
  onAddItem: (item: {
    code: string;
    description: string;
    size: string;
    colour: string;
    observed: number | null;
    purchased: number | null;
    cost: number | null;
    price: number | null;
    store: string;
  }) => void;
  onSyncInventory?: () => Promise<InventorySyncResult | null>;
  activeLive?: LiveSession;
}

export const InventoryStoreBoard: React.FC<InventoryStoreBoardProps> = ({
  inventory,
  summary,
  phpRate,
  onUpdateItem,
  onAddItem,
  onSyncInventory,
  activeLive,
}) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncResult, setLastSyncResult] = useState<InventorySyncResult | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'discrepancies' | 'shortage' | 'uncounted' | 'surplus' | 'balanced'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Modal form states
  const [newCode, setNewCode] = useState('BP06');
  const [newDesc, setNewDesc] = useState('Denim Patch Overalls');
  const [newSize, setNewSize] = useState('3XL');
  const [newColour, setNewColour] = useState('DENIM BLUE');
  const [newObserved, setNewObserved] = useState('3');
  const [newPurchased, setNewPurchased] = useState('3');
  const [newCost, setNewCost] = useState('580');
  const [newPrice, setNewPrice] = useState('2290');
  const [newStore, setNewStore] = useState('Pratunam Market Soi 3');

  const checklistItems = summary?.checklist.items || [];
  const readyToLeave = summary?.checklist.readyToLeaveStore || false;

  // Derive demand and discrepancy metrics
  // If syncResult is present, use it; otherwise compute from summary coverage and inventory
  const derivedMetrics = useMemo(() => {
    let shortageCount = 0;
    let uncountedCount = 0;
    let surplusCount = 0;
    let balancedCount = 0;
    let totalDemand = 0;
    let totalObserved = 0;

    inventory.forEach((item) => {
      // Find coverage from summary if available
      const cov = summary?.coverage?.find(
        (c) => c.code.toUpperCase() === item.code.toUpperCase() && 
               (!item.size || c.size.toUpperCase() === item.size.toUpperCase())
      );
      const demand = item.liveDemand !== undefined ? item.liveDemand : (cov?.ordered ?? 0);
      totalDemand += demand;

      const observed = item.observed;
      if (observed !== null && observed !== undefined) {
        totalObserved += observed;
      }

      const flag = item.discrepancyFlag || (
        observed === null || observed === undefined
          ? 'uncounted'
          : observed < demand
          ? 'shortage'
          : observed > demand
          ? 'surplus'
          : 'balanced'
      );

      if (flag === 'shortage') shortageCount++;
      else if (flag === 'uncounted') uncountedCount++;
      else if (flag === 'surplus') surplusCount++;
      else if (flag === 'balanced') balancedCount++;
    });

    return {
      shortageCount: lastSyncResult?.criticalCount ?? shortageCount,
      uncountedCount: lastSyncResult?.warningCount ?? uncountedCount,
      surplusCount: lastSyncResult?.surplusCount ?? surplusCount,
      balancedCount: lastSyncResult?.balancedCount ?? balancedCount,
      discrepanciesCount: (lastSyncResult?.criticalCount ?? shortageCount) + (lastSyncResult?.warningCount ?? uncountedCount),
      totalDemand: lastSyncResult?.totalDemandPieces ?? totalDemand,
      totalObserved: lastSyncResult?.totalObservedPieces ?? totalObserved,
    };
  }, [inventory, summary, lastSyncResult]);

  // Missing rack items (from sync result if live orders don't have rack items)
  const missingRackItems = useMemo(() => {
    return lastSyncResult?.discrepancies?.filter((d) => d.flag === 'missing_rack') || [];
  }, [lastSyncResult]);

  // Trigger Inventory Sync API Call
  const handleSync = async () => {
    setIsSyncing(true);
    try {
      if (onSyncInventory) {
        const result = await onSyncInventory();
        if (result) {
          setLastSyncResult(result);
          setLastSyncedAt(result.syncedAt);
        }
      } else {
        // Direct API call fallback
        const res = await fetch('/api/inventory/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ liveId: activeLive?.id }),
        });
        if (res.ok) {
          const data: any = await res.json();
          if (data.syncResult) {
            setLastSyncResult(data.syncResult);
            setLastSyncedAt(data.syncResult.syncedAt);
          }
        }
      }
    } catch (err) {
      console.error('Error during inventory sync:', err);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleCreateItem = (e: React.FormEvent) => {
    e.preventDefault();
    onAddItem({
      code: newCode,
      description: newDesc,
      size: newSize,
      colour: newColour,
      observed: newObserved ? Number(newObserved) : null,
      purchased: newPurchased ? Number(newPurchased) : null,
      cost: newCost ? Number(newCost) : 450,
      price: newPrice ? Number(newPrice) : 1890,
      store: newStore,
    });
    setShowAddModal(false);
  };

  const handleOpenAddForMissing = (missing: InventoryDiscrepancy) => {
    setNewCode(missing.code);
    setNewDesc(`${missing.code} Live Selling Garment`);
    setNewSize(missing.size || '3XL');
    setNewColour(missing.colour || 'MAROON');
    setNewObserved(String(missing.liveDemand || 1));
    setNewPurchased(String(missing.liveDemand || 1));
    setShowAddModal(true);
  };

  // Filtered inventory list
  const filteredInventory = useMemo(() => {
    return inventory.filter((item) => {
      // Search matching
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = !q || 
        item.code.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.size.toLowerCase().includes(q) ||
        item.colour.toLowerCase().includes(q) ||
        item.supplierStore.toLowerCase().includes(q);

      if (!matchesSearch) return false;

      // Status filtering
      const cov = summary?.coverage?.find(
        (c) => c.code.toUpperCase() === item.code.toUpperCase() && 
               (!item.size || c.size.toUpperCase() === item.size.toUpperCase())
      );
      const demand = item.liveDemand !== undefined ? item.liveDemand : (cov?.ordered ?? 0);
      const observed = item.observed;

      const flag = item.discrepancyFlag || (
        observed === null || observed === undefined
          ? 'uncounted'
          : observed < demand
          ? 'shortage'
          : observed > demand
          ? 'surplus'
          : 'balanced'
      );

      if (selectedFilter === 'all') return true;
      if (selectedFilter === 'discrepancies') return flag === 'shortage' || flag === 'uncounted';
      return flag === selectedFilter;
    });
  }, [inventory, summary, searchQuery, selectedFilter]);

  return (
    <div className="space-y-6">
      {/* 7-Point "Ready to Leave the Store" Official Checklist */}
      <div className={`border rounded-2xl p-6 shadow-xl transition ${
        readyToLeave 
          ? 'bg-gradient-to-r from-emerald-950/40 via-neutral-900 to-teal-950/40 border-emerald-500/50' 
          : 'bg-neutral-900 border-neutral-800'
      }`}>
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4 pb-3 border-b border-neutral-800">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                <Store className="w-5 h-5 text-amber-400" />
                <span>Store Operations Checklist Â· Workflow 2026-10-13.3</span>
              </h2>
              <span className={`px-3 py-1 rounded-full text-xs font-bold tracking-wider ${
                readyToLeave 
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 animate-pulse' 
                  : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
              }`}>
                READY TO LEAVE THE STORE: {readyToLeave ? 'YES âœ“' : 'NOT YET'}
              </span>
            </div>
            <p className="text-xs text-neutral-400 mt-1">
              Built strictly from recorded state. Approvals belong to OWNER/ADMIN. Staff never tick by hand.
            </p>
          </div>

          {/* Action buttons: Sync Inventory & Add Rack Item */}
          <div className="flex items-center gap-2.5">
            <button
              onClick={handleSync}
              disabled={isSyncing}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-rose-600 via-rose-500 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-rose-950/40 transition disabled:opacity-60 cursor-pointer"
              title="Verify physical rack quantities against current live order demand and automatically flag discrepancies"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Verifying Rack vs Demand...' : 'Sync Inventory'}</span>
            </button>

            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-1.5 px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-white border border-neutral-700 hover:border-neutral-600 rounded-xl text-xs font-semibold shadow-md transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 text-rose-400" />
              <span>Add Observed Store Rack Item</span>
            </button>
          </div>
        </div>

        {/* 7 Checklist Gates */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
          {checklistItems.map((item, idx) => (
            <div
              key={item.id}
              className={`p-3.5 rounded-xl border flex items-start gap-3 transition ${
                item.done
                  ? 'bg-emerald-950/20 border-emerald-500/40 text-neutral-200'
                  : 'bg-neutral-950/60 border-neutral-800 text-neutral-400'
              }`}
            >
              <div className="mt-0.5 shrink-0">
                {item.done ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                ) : (
                  <XCircle className="w-4 h-4 text-amber-500" />
                )}
              </div>
              <div className="text-xs space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-neutral-500 text-[10px]">Gate #{idx + 1}</span>
                  <strong className={item.done ? 'text-white' : 'text-neutral-300'}>{item.label}</strong>
                </div>
                <p className="text-[11px] text-neutral-400 leading-relaxed">{item.detail}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Discrepancy Control Center & Live Demand Sync HUD */}
      <div className="bg-gradient-to-r from-neutral-900 via-neutral-900/95 to-neutral-900 border border-neutral-800 rounded-2xl p-5 shadow-xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-neutral-800/80">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-rose-400" />
              <h3 className="font-bold text-sm text-white tracking-tight">
                Live Rack vs Order Demand Verification
              </h3>
              {lastSyncedAt && (
                <span className="flex items-center gap-1 text-[11px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                  <Check className="w-3 h-3" />
                  Synced {new Date(lastSyncedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
              )}
            </div>
            <p className="text-xs text-neutral-400">
              Cross-checks physically counted garments on store racks against incoming live broadcast claims & messenger adjustments.
            </p>
          </div>

          <button
            onClick={handleSync}
            disabled={isSyncing}
            className="flex items-center gap-2 text-xs font-semibold px-3.5 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-neutral-200 transition cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-amber-400 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>Re-verify Demand vs Rack</span>
          </button>
        </div>

        {/* Executive Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <button
            onClick={() => setSelectedFilter('all')}
            className={`p-3 rounded-xl border text-left transition ${
              selectedFilter === 'all'
                ? 'bg-neutral-800/80 border-rose-500/50 shadow-md ring-1 ring-rose-500/30'
                : 'bg-neutral-950/60 border-neutral-800 hover:border-neutral-700'
            }`}
          >
            <span className="text-[10px] uppercase font-bold text-neutral-400 block tracking-wider">Rack Rows</span>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-xl font-black text-white font-mono">{inventory.length}</span>
              <span className="text-[10px] text-neutral-500">items</span>
            </div>
            <span className="text-[10px] text-neutral-400 mt-0.5 block truncate">
              {derivedMetrics.totalObserved} pcs observed
            </span>
          </button>

          <button
            onClick={() => setSelectedFilter('discrepancies')}
            className={`p-3 rounded-xl border text-left transition ${
              selectedFilter === 'discrepancies'
                ? 'bg-rose-950/30 border-rose-500 shadow-md ring-1 ring-rose-500/30'
                : 'bg-neutral-950/60 border-neutral-800 hover:border-neutral-700'
            }`}
          >
            <span className="text-[10px] uppercase font-bold text-rose-400 block tracking-wider flex items-center gap-1">
              <AlertTriangle className="w-3 h-3 text-rose-400" />
              <span>Discrepancies</span>
            </span>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-xl font-black text-rose-300 font-mono">{derivedMetrics.discrepanciesCount}</span>
              <span className="text-[10px] text-rose-400/80">flagged</span>
            </div>
            <span className="text-[10px] text-neutral-400 mt-0.5 block">
              Requires host action
            </span>
          </button>

          <button
            onClick={() => setSelectedFilter('shortage')}
            className={`p-3 rounded-xl border text-left transition ${
              selectedFilter === 'shortage'
                ? 'bg-red-950/40 border-red-500 shadow-md ring-1 ring-red-500/40'
                : 'bg-neutral-950/60 border-neutral-800 hover:border-neutral-700'
            }`}
          >
            <span className="text-[10px] uppercase font-bold text-red-400 block tracking-wider">Overclaimed</span>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-xl font-black text-red-400 font-mono">{derivedMetrics.shortageCount}</span>
              <span className="text-[10px] text-red-400/80">short</span>
            </div>
            <span className="text-[10px] text-neutral-400 mt-0.5 block">
              Demand &gt; Physical Rack
            </span>
          </button>

          <button
            onClick={() => setSelectedFilter('uncounted')}
            className={`p-3 rounded-xl border text-left transition ${
              selectedFilter === 'uncounted'
                ? 'bg-amber-950/30 border-amber-500 shadow-md ring-1 ring-amber-500/30'
                : 'bg-neutral-950/60 border-neutral-800 hover:border-neutral-700'
            }`}
          >
            <span className="text-[10px] uppercase font-bold text-amber-400 block tracking-wider">Uncounted</span>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-xl font-black text-amber-300 font-mono">{derivedMetrics.uncountedCount}</span>
              <span className="text-[10px] text-amber-400/80">pending</span>
            </div>
            <span className="text-[10px] text-neutral-400 mt-0.5 block">
              No physical count entered
            </span>
          </button>

          <button
            onClick={() => setSelectedFilter('surplus')}
            className={`p-3 rounded-xl border text-left transition ${
              selectedFilter === 'surplus'
                ? 'bg-sky-950/30 border-sky-500 shadow-md ring-1 ring-sky-500/30'
                : 'bg-neutral-950/60 border-neutral-800 hover:border-neutral-700'
            }`}
          >
            <span className="text-[10px] uppercase font-bold text-sky-400 block tracking-wider">Surplus Stock</span>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-xl font-black text-sky-300 font-mono">{derivedMetrics.surplusCount}</span>
              <span className="text-[10px] text-sky-400/80">extra</span>
            </div>
            <span className="text-[10px] text-neutral-400 mt-0.5 block">
              Rack &gt; Live Demand
            </span>
          </button>

          <button
            onClick={() => setSelectedFilter('balanced')}
            className={`p-3 rounded-xl border text-left transition ${
              selectedFilter === 'balanced'
                ? 'bg-emerald-950/30 border-emerald-500 shadow-md ring-1 ring-emerald-500/30'
                : 'bg-neutral-950/60 border-neutral-800 hover:border-neutral-700'
            }`}
          >
            <span className="text-[10px] uppercase font-bold text-emerald-400 block tracking-wider">Balanced</span>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-xl font-black text-emerald-400 font-mono">{derivedMetrics.balancedCount}</span>
              <span className="text-[10px] text-emerald-400/80">exact</span>
            </div>
            <span className="text-[10px] text-neutral-400 mt-0.5 block">
              100% Demand Covered
            </span>
          </button>
        </div>

        {/* Missing Rack Items Critical Banner */}
        {missingRackItems.length > 0 && (
          <div className="bg-red-950/30 border border-red-500/50 rounded-xl p-4 text-xs space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-red-400 font-bold">
                <AlertCircle className="w-4 h-4 text-red-400" />
                <span>CRITICAL DISCREPANCY: {missingRackItems.length} Live Selling Item(s) Missing Physical Rack Rows!</span>
              </div>
              <span className="px-2 py-0.5 rounded bg-red-500/20 text-red-300 text-[10px] font-mono">
                Unregistered Demand
              </span>
            </div>
            <p className="text-neutral-300">
              Live broadcast buyers have claimed these garments, but staff have not logged physical store rack records for them. Add them immediately to verify stock at the supplier stall.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-1">
              {missingRackItems.map((missing, idx) => (
                <div key={idx} className="bg-neutral-900/80 border border-neutral-800 p-2.5 rounded-lg flex items-center justify-between">
                  <div>
                    <span className="font-bold text-white font-mono text-xs">{missing.code} ({missing.size} {missing.colour})</span>
                    <span className="text-[11px] text-red-300 block">
                      Demand: {missing.liveDemand} pcs claimed by {missing.buyers.join(', ')}
                    </span>
                  </div>
                  <button
                    onClick={() => handleOpenAddForMissing(missing)}
                    className="flex items-center gap-1 px-2.5 py-1 bg-red-600 hover:bg-red-500 text-white rounded-lg text-[11px] font-bold transition cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Add to Rack</span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Physical Inventory Board Rack List */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-xl space-y-4">
        {/* Header with Search and Filter tabs */}
        <div className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-neutral-800">
          <div>
            <h3 className="font-bold text-sm text-white flex items-center gap-2">
              <span>Physical Store Inventory Items</span>
              <span className="px-2 py-0.5 rounded-full bg-neutral-800 text-neutral-300 font-mono text-xs">
                {filteredInventory.length} of {inventory.length}
              </span>
            </h3>
            <p className="text-xs text-neutral-400">
              Pratunam wholesale market observed pieces, purchased pieces, supplier cost (THB), and verified receipt references.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search code, size, colour..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-neutral-950 border border-neutral-700 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-rose-500 w-48 sm:w-60"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            <div className="text-xs text-neutral-400">
              Currency: <strong className="text-amber-300 font-mono">THB</strong> Â· Retail: <strong className="text-emerald-400 font-mono">PHP</strong>
            </div>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-neutral-500 flex items-center gap-1 text-[11px] font-semibold">
            <Filter className="w-3 h-3" /> Filter:
          </span>
          {[
            { id: 'all', label: `All Rows (${inventory.length})` },
            { id: 'discrepancies', label: `Discrepancies Only (${derivedMetrics.discrepanciesCount})`, highlight: derivedMetrics.discrepanciesCount > 0 },
            { id: 'shortage', label: `Shortages (${derivedMetrics.shortageCount})`, color: 'text-red-400' },
            { id: 'uncounted', label: `Uncounted (${derivedMetrics.uncountedCount})`, color: 'text-amber-400' },
            { id: 'surplus', label: `Surplus (${derivedMetrics.surplusCount})`, color: 'text-sky-400' },
            { id: 'balanced', label: `Balanced (${derivedMetrics.balancedCount})`, color: 'text-emerald-400' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSelectedFilter(tab.id as any)}
              className={`px-3 py-1 rounded-lg font-medium transition cursor-pointer ${
                selectedFilter === tab.id
                  ? 'bg-rose-600 text-white font-bold shadow-sm'
                  : tab.highlight
                  ? 'bg-rose-950/40 border border-rose-500/40 text-rose-300 hover:bg-rose-900/40'
                  : 'bg-neutral-950 hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 border border-neutral-800'
              }`}
            >
              <span className={selectedFilter !== tab.id ? tab.color : ''}>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Grid of Inventory Cards */}
        {filteredInventory.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-neutral-800 rounded-2xl space-y-2">
            <Package className="w-8 h-8 text-neutral-600 mx-auto" />
            <p className="text-sm font-semibold text-neutral-400">No inventory rack items match your current filter</p>
            <p className="text-xs text-neutral-500">Try clearing the search query or selecting "All Rows"</p>
            <button
              onClick={() => { setSearchQuery(''); setSelectedFilter('all'); }}
              className="mt-2 px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-lg text-xs"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredInventory.map((item) => {
              // Find live demand from summary coverage or item.liveDemand
              const cov = summary?.coverage?.find(
                (c) => c.code.toUpperCase() === item.code.toUpperCase() && 
                       (!item.size || c.size.toUpperCase() === item.size.toUpperCase())
              );
              const demand = item.liveDemand !== undefined ? item.liveDemand : (cov?.ordered ?? 0);
              const observed = item.observed;
              const buyers = cov?.buyers?.map(b => b.name) || [];

              // Discrepancy Flag
              const flag = item.discrepancyFlag || (
                observed === null || observed === undefined
                  ? 'uncounted'
                  : observed < demand
                  ? 'shortage'
                  : observed > demand
                  ? 'surplus'
                  : 'balanced'
              );
              const gap = item.discrepancyGap !== undefined ? item.discrepancyGap : (
                observed === null || observed === undefined ? null : observed - demand
              );

              // Border and styling based on flag
              const cardBorderClass = 
                flag === 'shortage'
                  ? 'border-red-500/70 bg-gradient-to-b from-red-950/25 via-neutral-950 to-neutral-950 shadow-red-950/20 shadow-md'
                  : flag === 'uncounted'
                  ? 'border-amber-500/60 bg-gradient-to-b from-amber-950/20 via-neutral-950 to-neutral-950'
                  : flag === 'surplus'
                  ? 'border-sky-500/40 bg-gradient-to-b from-sky-950/15 via-neutral-950 to-neutral-950'
                  : 'border-emerald-500/40 bg-gradient-to-b from-emerald-950/10 via-neutral-950 to-neutral-950';

              return (
                <div
                  key={item.id}
                  className={`border rounded-xl p-4 space-y-3 transition hover:border-neutral-600 ${cardBorderClass}`}
                >
                  {/* Card Header with Discrepancy Tag */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 font-bold text-xs font-mono">
                        {item.code}
                      </span>
                      <span className="font-semibold text-white text-xs">{item.size} Â· {item.colour}</span>
                    </div>

                    <span className="text-[10px] text-neutral-500 font-mono">
                      {item.supplierReceiptRef || 'No Receipt'}
                    </span>
                  </div>

                  {/* Discrepancy Alert Tag / Banner on Card */}
                  {flag === 'shortage' && (
                    <div className="flex items-start gap-1.5 px-2.5 py-1.5 rounded-lg bg-red-500/20 border border-red-500/40 text-red-300 text-xs font-semibold">
                      <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
                      <div className="leading-tight">
                        <span className="block font-bold">DEFICIT: Short by {Math.abs(gap ?? 0)} pcs!</span>
                        <span className="text-[10px] text-red-200 font-normal">
                          Live Demand ({demand}) &gt; Physical Rack ({observed ?? 0})
                        </span>
                      </div>
                    </div>
                  )}

                  {flag === 'uncounted' && (
                    <div className="flex items-start gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-semibold">
                      <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                      <div className="leading-tight">
                        <span className="block font-bold">UNCOUNTED ON RACK</span>
                        <span className="text-[10px] text-amber-200 font-normal">
                          {demand > 0 ? `${demand} pcs ordered in live demand` : 'Staff must verify rack quantity'}
                        </span>
                      </div>
                    </div>
                  )}

                  {flag === 'surplus' && (
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-sky-500/15 border border-sky-500/30 text-sky-300 text-xs font-medium">
                      <Package className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                      <span>SURPLUS: +{gap} unsold rack unit(s)</span>
                    </div>
                  )}

                  {flag === 'balanced' && (
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-medium">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>BALANCED: Rack ({observed}) matches live demand</span>
                    </div>
                  )}

                  <p className="text-xs text-neutral-300 line-clamp-1">{item.description}</p>

                  {/* Quantitative Demand vs Physical Rack Bar */}
                  <div className="bg-neutral-900/90 border border-neutral-800 rounded-xl p-2.5 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-neutral-400 font-medium flex items-center gap-1 text-[11px]">
                        <Clock className="w-3 h-3 text-rose-400" />
                        <span>Live Order Demand:</span>
                      </span>
                      <span className={`font-mono font-bold px-2 py-0.5 rounded text-xs ${
                        demand > 0 ? 'bg-rose-500/20 text-rose-300' : 'bg-neutral-800 text-neutral-400'
                      }`}>
                        {demand} pcs
                      </span>
                    </div>

                    {buyers.length > 0 && (
                      <p className="text-[10px] text-neutral-400 truncate">
                        Buyers: <span className="text-neutral-300">{buyers.slice(0, 3).join(', ')}{buyers.length > 3 ? ` +${buyers.length - 3}` : ''}</span>
                      </p>
                    )}
                  </div>

                  {/* Editable Quantitative Inputs Grid */}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-neutral-900 p-2 rounded-lg border border-neutral-850">
                      <span className="text-neutral-500 text-[10px] block">Observed on Rack:</span>
                      <input
                        type="number"
                        min="0"
                        value={item.observed ?? ''}
                        onChange={(e) => onUpdateItem(item.id, { observed: e.target.value === '' ? null : Number(e.target.value) })}
                        placeholder="Unknown"
                        className="w-full bg-transparent font-bold text-amber-300 font-mono mt-0.5 focus:outline-none"
                      />
                    </div>

                    <div className="bg-neutral-900 p-2 rounded-lg border border-neutral-850">
                      <span className="text-neutral-500 text-[10px] block">Actually Purchased:</span>
                      <input
                        type="number"
                        min="0"
                        value={item.purchased ?? ''}
                        onChange={(e) => onUpdateItem(item.id, { purchased: e.target.value === '' ? null : Number(e.target.value) })}
                        placeholder="Pending"
                        className="w-full bg-transparent font-bold text-emerald-400 font-mono mt-0.5 focus:outline-none"
                      />
                    </div>

                    <div className="bg-neutral-900 p-2 rounded-lg border border-neutral-850">
                      <span className="text-neutral-500 text-[10px] block">Supplier Cost (THB):</span>
                      <input
                        type="number"
                        min="0"
                        value={item.cost ?? ''}
                        onChange={(e) => onUpdateItem(item.id, { cost: e.target.value === '' ? null : Number(e.target.value) })}
                        placeholder="à¸¿0"
                        className="w-full bg-transparent font-bold text-neutral-200 font-mono mt-0.5 focus:outline-none"
                      />
                    </div>

                    <div className="bg-neutral-900 p-2 rounded-lg border border-neutral-850">
                      <span className="text-neutral-500 text-[10px] block">Buyer Price (PHP):</span>
                      <input
                        type="number"
                        min="0"
                        value={item.price ?? ''}
                        onChange={(e) => onUpdateItem(item.id, { price: e.target.value === '' ? null : Number(e.target.value) })}
                        placeholder="â‚±0"
                        className="w-full bg-transparent font-bold text-neutral-200 font-mono mt-0.5 focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Quick Action Helpers for Discrepancy Resolution */}
                  {(flag === 'uncounted' || flag === 'shortage') && demand > 0 && (
                    <div className="flex items-center gap-1.5 pt-1">
                      <button
                        onClick={() => onUpdateItem(item.id, { observed: demand })}
                        className="flex-1 py-1.5 px-2 bg-neutral-800 hover:bg-neutral-700 text-amber-300 hover:text-white border border-neutral-700 rounded-lg text-[10px] font-bold transition flex items-center justify-center gap-1 cursor-pointer"
                        title="Set physical rack observed count to match live order demand"
                      >
                        <Check className="w-3 h-3 text-amber-400" />
                        <span>Match Rack to Demand ({demand} pcs)</span>
                      </button>

                      <button
                        onClick={() => onUpdateItem(item.id, { observed: 0 })}
                        className="py-1.5 px-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-red-400 border border-neutral-700 rounded-lg text-[10px] font-medium transition cursor-pointer"
                        title="Mark item as 0 pieces on store rack"
                      >
                        0 on Rack
                      </button>
                    </div>
                  )}

                  {/* Physical Evidence Note */}
                  <div className="text-[11px] text-neutral-400 bg-neutral-900/60 p-2 rounded-lg italic">
                    {item.syncNote || item.evidence || 'Physical garment verified on Bangkok store visit.'}
                  </div>

                  {/* Supplier Reference Field */}
                  <div className="flex items-center justify-between text-[11px] pt-1 text-neutral-500">
                    <span className="flex items-center gap-1">
                      <Receipt className="w-3 h-3 text-neutral-400" />
                      <span>{item.supplierStore}</span>
                    </span>
                    <span className="text-neutral-400 font-mono font-medium">
                      Ref: {item.supplierReceiptRef}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add New Item Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
              <h3 className="font-bold text-base text-white flex items-center gap-2">
                <Plus className="w-4 h-4 text-rose-400" />
                <span>Add Observed Store Rack Item</span>
              </h3>
              <button onClick={() => setShowAddModal(false)} className="text-neutral-400 hover:text-white cursor-pointer">âœ•</button>
            </div>

            <form onSubmit={handleCreateItem} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-neutral-400 block mb-1">Item Code</label>
                  <input
                    type="text"
                    required
                    value={newCode}
                    onChange={(e) => setNewCode(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-700 rounded-lg p-2 text-white font-mono uppercase"
                  />
                </div>
                <div>
                  <label className="text-neutral-400 block mb-1">Size</label>
                  <select
                    value={newSize}
                    onChange={(e) => setNewSize(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-700 rounded-lg p-2 text-white"
                  >
                    <option value="XL">XL</option>
                    <option value="2XL">2XL</option>
                    <option value="3XL">3XL</option>
                    <option value="4XL">4XL</option>
                    <option value="5XL">5XL</option>
                    <option value="6XL">6XL</option>
                    <option value="FREE SIZE">FREE SIZE</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-neutral-400 block mb-1">Description / Style Name</label>
                <input
                  type="text"
                  required
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-700 rounded-lg p-2 text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-neutral-400 block mb-1">Colour</label>
                  <input
                    type="text"
                    required
                    value={newColour}
                    onChange={(e) => setNewColour(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-700 rounded-lg p-2 text-white uppercase"
                  />
                </div>
                <div>
                  <label className="text-neutral-400 block mb-1">Observed Pieces on Rack</label>
                  <input
                    type="number"
                    min="0"
                    value={newObserved}
                    onChange={(e) => setNewObserved(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-700 rounded-lg p-2 text-white font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-neutral-400 block mb-1">Supplier Unit Cost (THB)</label>
                  <input
                    type="number"
                    min="0"
                    value={newCost}
                    onChange={(e) => setNewCost(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-700 rounded-lg p-2 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="text-neutral-400 block mb-1">Buyer Price (PHP)</label>
                  <input
                    type="number"
                    min="0"
                    value={newPrice}
                    onChange={(e) => setNewPrice(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-700 rounded-lg p-2 text-white font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="text-neutral-400 block mb-1">Supplier Store / Location</label>
                <input
                  type="text"
                  value={newStore}
                  onChange={(e) => setNewStore(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-700 rounded-lg p-2 text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-neutral-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl shadow-lg shadow-rose-900/30 cursor-pointer"
                >
                  Save Rack Item
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
