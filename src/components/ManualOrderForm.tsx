import React, { useState } from 'react';
import { Plus, PenLine } from 'lucide-react';

interface ManualOrderFormProps {
  onAddOrder: (order: {
    buyerName: string;
    itemCode: string;
    size: string;
    colour: string;
    quantity: number;
    channel: 'live_chat' | 'messenger';
    statedPrice: number | null;
  }) => void;
}

/** Add one order by hand during a live. Nothing is preset; a blank price waits for review. */
export const ManualOrderForm: React.FC<ManualOrderFormProps> = ({ onAddOrder }) => {
  const [buyer, setBuyer] = useState('');
  const [code, setCode] = useState('');
  const [size, setSize] = useState('');
  const [colour, setColour] = useState('');
  const [qty, setQty] = useState('1');
  const [price, setPrice] = useState('');

  const field = 'w-full bg-neutral-950 border border-neutral-700 rounded-lg px-2.5 py-1.5 text-neutral-200 placeholder:text-neutral-600 text-xs';

  return (
    <form
      className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 shadow-lg space-y-2.5 text-xs"
      onSubmit={(e) => {
        e.preventDefault();
        if (!buyer.trim() || !code.trim()) return;
        const p = Number(price);
        onAddOrder({
          buyerName: buyer.trim(),
          itemCode: code.trim().toUpperCase(),
          size: size.trim(),
          colour: colour.trim(),
          quantity: Math.max(1, Number(qty) || 1),
          channel: 'live_chat',
          statedPrice: price.trim() && Number.isFinite(p) && p > 0 ? p : null,
        });
        setBuyer('');
        setCode('');
        setSize('');
        setColour('');
        setQty('1');
        setPrice('');
      }}
    >
      <div className="flex items-center gap-2">
        <PenLine className="w-4 h-4 text-amber-400" />
        <h4 className="text-xs font-bold text-white uppercase tracking-wider">Add order by hand</h4>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <input name="manualBuyer" aria-label="Buyer's Facebook name" value={buyer} onChange={(e) => setBuyer(e.target.value)} placeholder="Buyer's Facebook name *" className={`${field} col-span-2`} />
        <input name="manualCode" aria-label="Item code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="Item code (as called) *" className={field} />
        <input name="manualQty" aria-label="Quantity" type="number" min={1} value={qty} onChange={(e) => setQty(e.target.value)} placeholder="Qty" className={field} />
        <input name="manualSize" aria-label="Size" value={size} onChange={(e) => setSize(e.target.value)} placeholder="Size (e.g. 2XL)" className={field} />
        <input name="manualColour" aria-label="Colour" value={colour} onChange={(e) => setColour(e.target.value)} placeholder="Colour" className={field} />
        <input
          name="manualPrice"
          aria-label="Host's price"
          type="number"
          inputMode="decimal"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          placeholder="Host's price ₱ (blank = needs price)"
          className={`${field} col-span-2`}
        />
      </div>
      <button
        type="submit"
        disabled={!buyer.trim() || !code.trim()}
        className="w-full bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 disabled:opacity-40 text-white font-bold rounded-lg py-2 flex items-center justify-center gap-1.5"
      >
        <Plus className="w-3.5 h-3.5" /> Add order
      </button>
    </form>
  );
};
