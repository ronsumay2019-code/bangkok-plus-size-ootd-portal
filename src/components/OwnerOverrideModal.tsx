import React, { useState } from 'react';
import { 
  ShieldAlert, 
  X, 
  History, 
  CheckCircle2, 
  AlertTriangle, 
  ArrowRight, 
  Tag, 
  User, 
  FileText,
  Lock
} from 'lucide-react';
import { BuyerOrder, PreOrder, OrderOverrideHistoryItem } from '../types/reconciliation';

interface OwnerOverrideModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: BuyerOrder | PreOrder | null;
  isPreOrder?: boolean;
  userRole: 'owner' | 'admin' | 'staff';
  onApplyOverride: (params: {
    orderId: string;
    isPreOrder: boolean;
    role: 'owner' | 'admin';
    author: string;
    reason: string;
    overrides: Partial<BuyerOrder>;
  }) => Promise<void>;
}

export const OwnerOverrideModal: React.FC<OwnerOverrideModalProps> = ({
  isOpen,
  onClose,
  order,
  isPreOrder = false,
  userRole,
  onApplyOverride,
}) => {
  if (!isOpen || !order) return null;

  const [activeTab, setActiveTab] = useState<'override' | 'history'>('override');
  const [authorName, setAuthorName] = useState('Pola (Shop Owner)');
  const [overrideReason, setOverrideReason] = useState('');
  const [selectedRole, setSelectedRole] = useState<'owner' | 'admin'>('owner');

  // Override fields initialized from order
  const [itemCode, setItemCode] = useState(order.itemCode);
  const [itemName, setItemName] = useState(order.itemName);
  const [size, setSize] = useState(order.size);
  const [colour, setColour] = useState(order.colour);
  const [quantity, setQuantity] = useState(order.quantity);
  const [pricePhp, setPricePhp] = useState(order.statedUnitPricePhp ?? 1890);
  const [status, setStatus] = useState<string>(order.status);
  const [notes, setNotes] = useState(('reviewNotes' in order ? order.reviewNotes : (order as PreOrder).notes) || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const history: OrderOverrideHistoryItem[] = order.overrideHistory || [];
  const currentVersion = order.version || 1;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!overrideReason.trim()) {
      setErrorMessage('A mandatory override justification reason is required for audit compliance.');
      return;
    }
    if (userRole === 'staff' && selectedRole !== 'owner' && selectedRole !== 'admin') {
      setErrorMessage('Unauthorized: Only an Owner or Admin can execute order overrides.');
      return;
    }

    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      await onApplyOverride({
        orderId: order.id,
        isPreOrder,
        role: selectedRole,
        author: authorName.trim() || `${selectedRole.toUpperCase()} (Authorized)`,
        reason: overrideReason.trim(),
        overrides: {
          itemCode: itemCode.trim().toUpperCase(),
          itemName: itemName.trim().toUpperCase(),
          size: size.trim().toUpperCase(),
          colour: colour.trim().toUpperCase(),
          quantity: Number(quantity),
          statedUnitPricePhp: Number(pricePhp),
          status: status as any,
          reviewNotes: notes,
          ...(isPreOrder ? {} : {}),
        },
      });
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to apply override');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-neutral-900 border border-neutral-700/80 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-neutral-950 via-rose-950/40 to-neutral-950 border-b border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/30">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white tracking-tight">
                  Owner & Admin Full Override Engine
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Version {currentVersion}
                </span>
                {isPreOrder && (
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                    Pre-Order Lane
                  </span>
                )}
              </div>
              <p className="text-xs text-neutral-400 mt-0.5">
                Target: <span className="text-white font-medium">{order.buyerName}</span> &bull; ID: <span className="font-mono text-neutral-300">{order.id}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-neutral-800 bg-neutral-950 px-5 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab('override')}
            className={`py-3 px-4 border-b-2 flex items-center gap-2 transition ${
              activeTab === 'override'
                ? 'border-rose-500 text-rose-400'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <ShieldAlert className="w-4 h-4" />
            <span>Apply Override</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`py-3 px-4 border-b-2 flex items-center gap-2 transition ${
              activeTab === 'history'
                ? 'border-rose-500 text-rose-400'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <History className="w-4 h-4" />
            <span>Audit Trail History ({history.length})</span>
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          {errorMessage && (
            <div className="p-3 bg-rose-950/60 border border-rose-500/50 rounded-xl text-rose-200 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{errorMessage}</span>
            </div>
          )}

          {activeTab === 'override' ? (
            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              {/* Role & Authorized Signer */}
              <div className="bg-neutral-950 p-3.5 rounded-xl border border-neutral-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-neutral-300 flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-amber-400" />
                    Authorized Executive Role
                  </span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedRole('owner')}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition ${
                        selectedRole === 'owner'
                          ? 'bg-rose-500/20 text-rose-300 border-rose-500'
                          : 'bg-neutral-900 text-neutral-400 border-neutral-800'
                      }`}
                    >
                      Shop Owner
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedRole('admin')}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition ${
                        selectedRole === 'admin'
                          ? 'bg-blue-500/20 text-blue-300 border-blue-500'
                          : 'bg-neutral-900 text-neutral-400 border-neutral-800'
                      }`}
                    >
                      System Admin
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-neutral-400 mb-1">Author Name / Signer</label>
                    <input
                      type="text"
                      value={authorName}
                      onChange={(e) => setAuthorName(e.target.value)}
                      className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-1.5 text-white focus:outline-none focus:border-rose-500"
                      placeholder="e.g. Pola (Shop Owner)"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-neutral-400 mb-1">Target Order Channel</label>
                    <div className="px-3 py-1.5 bg-neutral-900 border border-neutral-800 rounded-lg text-neutral-300 capitalize">
                      {order.channel.replace(/_/g, ' ')}
                    </div>
                  </div>
                </div>
              </div>

              {/* Overridable Garment Spec Fields */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-neutral-400 mb-1">Garment Code</label>
                  <input
                    type="text"
                    value={itemCode}
                    onChange={(e) => setItemCode(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-1.5 text-white uppercase font-mono font-bold focus:border-rose-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-neutral-400 mb-1">Size Spec</label>
                  <input
                    type="text"
                    value={size}
                    onChange={(e) => setSize(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-1.5 text-white uppercase font-mono font-bold focus:border-rose-500"
                    placeholder="e.g. 3XL, 4XL"
                    required
                  />
                </div>
                <div>
                  <label className="block text-neutral-400 mb-1">Garment Colour</label>
                  <input
                    type="text"
                    value={colour}
                    onChange={(e) => setColour(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-1.5 text-white uppercase font-medium focus:border-rose-500"
                    placeholder="e.g. MAROON"
                    required
                  />
                </div>
                <div>
                  <label className="block text-neutral-400 mb-1">Quantity (pcs)</label>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    value={quantity}
                    onChange={(e) => setQuantity(Number(e.target.value))}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-1.5 text-white font-mono font-bold focus:border-rose-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-neutral-400 mb-1">Unit Price (PHP)</label>
                  <input
                    type="number"
                    min="0"
                    value={pricePhp}
                    onChange={(e) => setPricePhp(Number(e.target.value))}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-1.5 text-white font-mono font-bold focus:border-rose-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-neutral-400 mb-1">Order Status</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-1.5 text-white capitalize focus:border-rose-500"
                  >
                    <option value="pending">Pending</option>
                    <option value="confirmed">Confirmed</option>
                    <option value="short">Short (Out of Stock)</option>
                    <option value="replaced">Replaced</option>
                    <option value="cancelled">Cancelled</option>
                    <option value="invoiced">Invoiced</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-neutral-400 mb-1">Item Title / Description</label>
                <input
                  type="text"
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-1.5 text-white focus:border-rose-500"
                  placeholder="Garment descriptive title"
                />
              </div>

              {/* Mandatory Reason Box */}
              <div className="bg-rose-950/20 border border-rose-500/30 rounded-xl p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="font-semibold text-rose-300 flex items-center gap-1.5 text-[11px]">
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                    Mandatory Audit Override Reason *
                  </label>
                  <span className="text-[10px] text-neutral-400">Strictly recorded in immutable audit log</span>
                </div>
                <textarea
                  rows={2}
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  placeholder="Explain why this live order or pre-order is being overridden (e.g. VIP client requested size adjustment, extra stock discovered on wholesale rack, price exception authorized by owner)..."
                  className="w-full bg-neutral-900 border border-neutral-700 rounded-lg p-2.5 text-white placeholder-neutral-500 focus:outline-none focus:border-rose-500 text-xs"
                  required
                />
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-xl font-medium transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !overrideReason.trim()}
                  className="px-5 py-2 bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white rounded-xl font-bold shadow-lg shadow-rose-950/40 disabled:opacity-50 transition flex items-center gap-2"
                >
                  <ShieldAlert className="w-4 h-4" />
                  <span>{isSubmitting ? 'Recording Audit...' : 'Execute Full Override'}</span>
                </button>
              </div>
            </form>
          ) : (
            /* History Tab */
            <div className="space-y-3">
              {history.length === 0 ? (
                <div className="text-center py-8 text-neutral-500 text-xs">
                  <History className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p>No prior overrides have been executed on this order.</p>
                  <p className="text-[11px] text-neutral-600 mt-1">This order is at base version 1.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {history.map((item, idx) => (
                    <div
                      key={idx}
                      className="bg-neutral-950 border border-neutral-800 rounded-xl p-3.5 space-y-2 text-xs"
                    >
                      <div className="flex items-center justify-between pb-2 border-b border-neutral-800">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/30 text-[10px]">
                            v{item.version}
                          </span>
                          <span className="font-semibold text-white">{item.by}</span>
                        </div>
                        <span className="text-neutral-500 text-[10px]">
                          {new Date(item.at).toLocaleString()}
                        </span>
                      </div>

                      <div className="bg-neutral-900/60 p-2.5 rounded-lg border border-neutral-800/80">
                        <span className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider block mb-1">
                          Justification Reason:
                        </span>
                        <p className="text-neutral-200 italic">{item.reason}</p>
                      </div>

                      {/* Before / After Diff */}
                      <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
                        <div className="p-2 rounded bg-rose-950/20 border border-rose-900/30">
                          <span className="text-[10px] text-rose-400 font-bold block mb-1">Before:</span>
                          <div className="text-neutral-300 font-mono">
                            {item.before.itemCode} &bull; {item.before.size} &bull; {item.before.colour} &bull; Qty: {item.before.quantity} &bull; ₱{item.before.statedUnitPricePhp}
                          </div>
                        </div>
                        <div className="p-2 rounded bg-emerald-950/20 border border-emerald-900/30">
                          <span className="text-[10px] text-emerald-400 font-bold block mb-1">After:</span>
                          <div className="text-neutral-200 font-mono font-semibold">
                            {item.after.itemCode} &bull; {item.after.size} &bull; {item.after.colour} &bull; Qty: {item.after.quantity} &bull; ₱{item.after.statedUnitPricePhp}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
