import React, { useEffect, useMemo, useState } from 'react';
import { Wallet, Clock, CheckCircle2, Camera, Send, Truck, AlertTriangle, ExternalLink } from 'lucide-react';
import type { BuyerOrder, LiveSession } from '../types/reconciliation';
import { shrinkPhoto } from '../utils/photos';
import { formatManilaDay, manilaDay } from '../utils/dates';

const PAY_WINDOW_MS = 24 * 3600 * 1000;

interface InvoiceGroup {
  invoiceNumber: string;
  buyerName: string;
  live?: LiveSession;
  pieces: number;
  totalPhp: number;
  invoicedAt?: string;
  sentAt?: string;
  paid: boolean;
  paidAt?: string;
  proof?: BuyerOrder['paymentProof'];
}

interface PaymentsShippingProps {
  orders: BuyerOrder[];
  lives: LiveSession[];
  canRecord: boolean;
  onOrdersUpdated: (orders: BuyerOrder[]) => void;
  showToast?: (msg: string) => void;
}

function timeLeft(ms: number): string {
  const abs = Math.abs(ms);
  const h = Math.floor(abs / 3600000);
  const m = Math.floor((abs % 3600000) / 60000);
  return h ? `${h}h ${m}m` : `${m}m`;
}

const manilaTime = (iso?: string) =>
  iso
    ? new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(iso))
    : '';

/**
 * After a live: invoiced orders wait here for payment (24 hours from the invoice reaching the buyer).
 * Paid invoices move to "Paid — ready for shipping" (shipping and tracking come later).
 */
export const PaymentsShipping: React.FC<PaymentsShippingProps> = ({ orders, lives, canRecord, onOrdersUpdated, showToast }) => {
  const [now, setNow] = useState(Date.now());
  const [openInvoice, setOpenInvoice] = useState<string | null>(null);
  const [photo, setPhoto] = useState('');
  const [reference, setReference] = useState('');
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  const groups = useMemo(() => {
    const map = new Map<string, InvoiceGroup>();
    for (const o of orders) {
      if (!o.invoiced || !o.invoiceNumber) continue;
      const g =
        map.get(o.invoiceNumber) ||
        ({ invoiceNumber: o.invoiceNumber, buyerName: o.buyerName, live: lives.find((l) => l.id === o.liveId), pieces: 0, totalPhp: 0, paid: true } as InvoiceGroup);
      g.pieces += o.quantity || 1;
      g.totalPhp += (o.quantity || 1) * (o.statedUnitPricePhp || 0);
      if (o.invoicedAt && (!g.invoicedAt || o.invoicedAt < g.invoicedAt)) g.invoicedAt = o.invoicedAt;
      if (o.invoiceSentAt && (!g.sentAt || o.invoiceSentAt < g.sentAt)) g.sentAt = o.invoiceSentAt;
      if (o.paymentStatus !== 'paid') g.paid = false;
      if (o.paidAt) g.paidAt = o.paidAt;
      if (o.paymentProof) g.proof = o.paymentProof;
      map.set(o.invoiceNumber, g);
    }
    return [...map.values()];
  }, [orders, lives]);

  const deadline = (g: InvoiceGroup) => (g.sentAt ? new Date(g.sentAt).getTime() + PAY_WINDOW_MS : Infinity);
  const awaiting = groups.filter((g) => !g.paid).sort((a, b) => deadline(a) - deadline(b));
  const paid = groups.filter((g) => g.paid).sort((a, b) => (b.paidAt || '').localeCompare(a.paidAt || ''));

  const post = async (url: string, body: any) => {
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data: any = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) throw new Error(data.error || 'Something went wrong');
    if (Array.isArray(data.orders)) onOrdersUpdated(data.orders);
    return data;
  };

  const markSent = async (g: InvoiceGroup) => {
    try {
      await post('/api/invoices/mark-sent', { invoiceNumber: g.invoiceNumber });
      showToast?.(`${g.invoiceNumber} marked sent. ${g.buyerName} has 24 hours to pay.`);
    } catch (err: any) {
      showToast?.(err.message);
    }
  };

  const openRecord = (g: InvoiceGroup) => {
    setOpenInvoice(g.invoiceNumber);
    setPhoto('');
    setReference('');
    setAmount(g.totalPhp ? String(g.totalPhp) : '');
    setError(null);
  };

  const savePayment = async (g: InvoiceGroup) => {
    setBusy(true);
    setError(null);
    try {
      await post('/api/payments/record', { invoiceNumber: g.invoiceNumber, photoDataUrl: photo, reference, amountPhp: Number(amount) || undefined });
      setOpenInvoice(null);
      showToast?.(`Payment recorded for ${g.buyerName}. Moved to Paid.`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const viewProof = async (g: InvoiceGroup) => {
    try {
      const res = await fetch(`/api/payments/proof?invoiceNumber=${encodeURIComponent(g.invoiceNumber)}`);
      const data: any = await res.json().catch(() => ({}));
      if (!res.ok || !data.url) throw new Error(data.error || 'Could not open the photo');
      window.open(data.url, '_blank', 'noopener');
    } catch (err: any) {
      showToast?.(err.message);
    }
  };

  const liveLabel = (g: InvoiceGroup) =>
    g.live ? `${g.live.title} · ${formatManilaDay(manilaDay(g.live.startedAt) || g.live.storeDate)}` : 'Live';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Wallet className="w-5 h-5 text-rose-400" />
        <h2 className="text-lg font-bold text-white">Payments &amp; Shipping</h2>
        <span className="text-xs text-neutral-400">Buyers pay within 24 hours of receiving their invoice. Payments need a screenshot or photo.</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Awaiting payment */}
        <section className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 space-y-3">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-400" /> Awaiting payment
            <span className="ml-auto text-xs text-neutral-400">{awaiting.length} invoice{awaiting.length === 1 ? '' : 's'}</span>
          </h3>
          {awaiting.length === 0 && <p className="text-xs text-neutral-500 py-6 text-center">No unpaid invoices.</p>}
          {awaiting.map((g) => {
            const left = deadline(g) - now;
            const overdue = g.sentAt && left < 0;
            return (
              <div key={g.invoiceNumber} className={`rounded-xl border p-3 text-xs space-y-2 ${overdue ? 'border-rose-600/60 bg-rose-950/30' : 'border-neutral-800 bg-neutral-950'}`}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <strong className="text-white text-sm">{g.buyerName}</strong>
                    <div className="text-neutral-400">
                      {g.invoiceNumber} · {liveLabel(g)}
                    </div>
                    <div className="text-neutral-300">
                      {g.pieces} pc{g.pieces === 1 ? '' : 's'} · ₱{g.totalPhp.toLocaleString()}
                    </div>
                  </div>
                  <div className="text-right">
                    {!g.sentAt ? (
                      <span className="inline-block px-2 py-0.5 rounded-full bg-neutral-800 text-neutral-300 border border-neutral-700">Not sent yet</span>
                    ) : overdue ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 font-bold">
                        <AlertTriangle className="w-3 h-3" /> Overdue by {timeLeft(left)}
                      </span>
                    ) : (
                      <span className="inline-block px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold">{timeLeft(left)} left</span>
                    )}
                    {g.sentAt && <div className="text-neutral-500 mt-1">Sent {manilaTime(g.sentAt)}</div>}
                  </div>
                </div>

                {canRecord && openInvoice !== g.invoiceNumber && (
                  <div className="flex flex-wrap gap-2">
                    {!g.sentAt && (
                      <button type="button" onClick={() => markSent(g)} className="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-semibold flex items-center gap-1.5">
                        <Send className="w-3.5 h-3.5" /> Mark invoice sent
                      </button>
                    )}
                    <button type="button" onClick={() => openRecord(g)} className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Record payment
                    </button>
                  </div>
                )}

                {openInvoice === g.invoiceNumber && (
                  <div className="space-y-2 pt-2 border-t border-neutral-800">
                    <label className="flex items-center gap-2 px-3 py-2 rounded-lg bg-neutral-800 text-neutral-200 cursor-pointer w-fit">
                      <Camera className="w-4 h-4" />
                      <span>{photo ? 'Change payment photo' : 'Add payment screenshot or photo'}</span>
                      <input
                        type="file"
                        accept="image/*"
                        name="paymentPhoto"
                        className="hidden"
                        onChange={async (e) => {
                          const f = e.target.files?.[0];
                          if (f) setPhoto(await shrinkPhoto(f));
                          e.target.value = '';
                        }}
                      />
                    </label>
                    {photo && <img src={photo} alt="Payment proof" className="max-h-40 rounded-lg border border-neutral-700" />}
                    <input
                      type="text"
                      name="paymentReference"
                      value={reference}
                      onChange={(e) => setReference(e.target.value)}
                      placeholder="Reference (e.g. GCash ref no.)"
                      className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-2.5 py-1.5 text-white"
                    />
                    <input
                      type="number"
                      name="paymentAmount"
                      inputMode="decimal"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="Amount paid (₱)"
                      className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-2.5 py-1.5 text-white"
                    />
                    {error && <p className="text-rose-300">{error}</p>}
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={busy || !photo}
                        onClick={() => savePayment(g)}
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-bold"
                      >
                        {busy ? 'Saving…' : 'Save payment'}
                      </button>
                      <button type="button" onClick={() => setOpenInvoice(null)} className="px-3 py-1.5 rounded-lg bg-neutral-800 text-neutral-300">
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </section>

        {/* Paid, ready for shipping */}
        <section className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 space-y-3">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Truck className="w-4 h-4 text-emerald-400" /> Paid — ready for shipping
            <span className="ml-auto text-xs text-neutral-400">{paid.length} invoice{paid.length === 1 ? '' : 's'}</span>
          </h3>
          <p className="text-[11px] text-neutral-500">Shipping and tracking will be added here next.</p>
          {paid.length === 0 && <p className="text-xs text-neutral-500 py-6 text-center">No paid invoices yet.</p>}
          {paid.map((g) => (
            <div key={g.invoiceNumber} className="rounded-xl border border-neutral-800 bg-neutral-950 p-3 text-xs space-y-1">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <strong className="text-white text-sm">{g.buyerName}</strong>
                  <div className="text-neutral-400">
                    {g.invoiceNumber} · {liveLabel(g)}
                  </div>
                  <div className="text-neutral-300">
                    {g.pieces} pc{g.pieces === 1 ? '' : 's'} · ₱{g.totalPhp.toLocaleString()}
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold">Paid</span>
              </div>
              <div className="text-neutral-500">
                {manilaTime(g.paidAt)}
                {g.proof?.recordedBy ? ` · checked by ${g.proof.recordedBy}` : ''}
                {g.proof?.reference ? ` · ${g.proof.reference}` : ''}
                {g.proof?.amountPhp ? ` · ₱${g.proof.amountPhp.toLocaleString()}` : ''}
              </div>
              {g.proof?.photoPath && (
                <button type="button" onClick={() => viewProof(g)} className="text-sky-300 hover:text-sky-200 flex items-center gap-1">
                  <ExternalLink className="w-3 h-3" /> View payment photo
                </button>
              )}
            </div>
          ))}
        </section>
      </div>
    </div>
  );
};
