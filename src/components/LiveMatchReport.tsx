import React, { useState } from 'react';
import { ShieldCheck } from 'lucide-react';

/** The portal's own check of a live's orders against Facebook's comments (live acceptance test 5). Read-only. */
export const LiveMatchReport: React.FC<{ liveId?: string }> = ({ liveId }) => {
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<any>(null);

  const run = async () => {
    setBusy(true);
    setReport(null);
    try {
      const r = await fetch(`/api/live/match-report${liveId ? `?live=${encodeURIComponent(liveId)}` : ''}`);
      setReport(await r.json().catch(() => ({ error: `HTTP ${r.status}` })));
    } catch (err: any) {
      setReport({ error: `Network error: ${err?.message || 'unknown'}` });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 space-y-3">
      <div className="flex items-center gap-2">
        <ShieldCheck className="w-5 h-5 text-emerald-400" />
        <h3 className="text-sm font-bold text-white">Check orders against Facebook</h3>
      </div>
      <p className="text-xs text-neutral-400">Reads every comment on this live from Facebook and compares it with the portal's orders. "Not on Facebook" must be 0. "Missing" lists "mine" comments that have no order yet.</p>
      <button type="button" onClick={run} disabled={busy} className="px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-white text-sm font-semibold">
        {busy ? 'Checking…' : 'Check now'}
      </button>
      {report && !report.error && (
        <ul className="text-sm text-neutral-200 space-y-1">
          <li>Comments on Facebook: <strong>{report.facebookComments}</strong> · saying "mine": <strong>{report.commentsSayingMine}</strong></li>
          <li>"Mine" comments with an order: <strong>{report.captured}</strong> · missing: <strong className={report.missing ? 'text-amber-400' : 'text-emerald-400'}>{report.missing}</strong></li>
          <li>Order lines: <strong>{report.orderLines}</strong> · not on Facebook: <strong className={report.orderLinesNotOnFacebook ? 'text-red-400' : 'text-emerald-400'}>{report.orderLinesNotOnFacebook}</strong></li>
        </ul>
      )}
      {report && <pre className="text-[11px] text-neutral-300 bg-neutral-950 border border-neutral-800 rounded-lg p-3 max-h-96 overflow-auto whitespace-pre-wrap">{JSON.stringify(report, null, 2)}</pre>}
    </div>
  );
};
