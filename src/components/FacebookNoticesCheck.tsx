import React, { useState } from 'react';
import { Radio } from 'lucide-react';

/** Which notices Facebook sends the portal (OL-22). "Live start & end" lets the live session turn on and off with no screen open. */
export const FacebookNoticesCheck: React.FC = () => {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<any>(null);

  const run = async (turnOn: boolean) => {
    setBusy(true);
    setResult(null);
    try {
      const r = await fetch('/api/facebook/page-notices', { method: turnOn ? 'POST' : 'GET' });
      setResult(await r.json().catch(() => ({ error: `HTTP ${r.status}` })));
    } catch (err: any) {
      setResult({ error: `Network error: ${err?.message || 'unknown'}` });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 space-y-3">
      <div className="flex items-center gap-2">
        <Radio className="w-5 h-5 text-rose-400" />
        <h3 className="text-sm font-bold text-white">Facebook notices</h3>
      </div>
      <p className="text-xs text-neutral-400">Shows which notices the Page sends the portal. "Live start &amp; end" turns the live session on and off by itself. "Check" changes nothing; "Turn on live start &amp; end" (owner) keeps every notice already on and adds it.</p>
      <div className="flex gap-2">
        <button type="button" onClick={() => run(false)} disabled={busy} className="px-4 py-2 rounded-lg bg-sky-700 hover:bg-sky-600 disabled:opacity-50 text-white text-sm font-semibold">
          {busy ? 'Checking…' : 'Check'}
        </button>
        <button type="button" onClick={() => run(true)} disabled={busy} className="px-4 py-2 rounded-lg bg-rose-700 hover:bg-rose-600 disabled:opacity-50 text-white text-sm font-semibold">
          Turn on live start &amp; end
        </button>
      </div>
      {result && !result.error && (
        <p className={`text-sm font-semibold ${result.liveStartEndOn ? 'text-emerald-400' : 'text-amber-400'}`}>
          Live start &amp; end: {result.liveStartEndOn ? 'ON' : 'OFF'} · On now: {(result.noticesOn || []).join(', ') || 'none'}
        </p>
      )}
      {result && <pre className="text-[11px] text-neutral-300 bg-neutral-950 border border-neutral-800 rounded-lg p-3 max-h-96 overflow-auto whitespace-pre-wrap">{JSON.stringify(result, null, 2)}</pre>}
    </div>
  );
};
