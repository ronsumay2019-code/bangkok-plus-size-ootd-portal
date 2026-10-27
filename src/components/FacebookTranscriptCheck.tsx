import React, { useState } from 'react';
import { FileText } from 'lucide-react';

/** Shows what Facebook gives the portal for a live video's own transcript (B33). Read-only. */
export const FacebookTranscriptCheck: React.FC<{ defaultVideoId?: string }> = ({ defaultVideoId }) => {
  const [videoId, setVideoId] = useState(defaultVideoId || '');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const check = async (save = false) => {
    setBusy(true);
    setResult(null);
    try {
      const r = await fetch(`/api/live/transcript-check?video=${encodeURIComponent(videoId.trim())}${save ? '&save=1' : ''}`);
      const j = await r.json().catch(() => ({ error: `HTTP ${r.status}` }));
      setResult(JSON.stringify(j, null, 2));
    } catch (err: any) {
      setResult(`Network error: ${err?.message || 'unknown'}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 space-y-3">
      <div className="flex items-center gap-2">
        <FileText className="w-5 h-5 text-sky-400" />
        <h3 className="text-sm font-bold text-white">Facebook transcript check</h3>
      </div>
      <p className="text-xs text-neutral-400">Asks Facebook for this live video's own transcript, the one viewers turn on from the ⋯ menu. "Check" changes nothing. "Fetch & keep transcript" saves the caption lines for the order finder.</p>
      <div className="flex gap-2">
        <input
          type="text"
          name="transcriptVideoId"
          aria-label="Facebook video ID"
          value={videoId}
          onChange={(e) => setVideoId(e.target.value)}
          placeholder="Facebook video ID"
          className="flex-1 bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-white font-mono"
        />
        <button
          type="button"
          onClick={() => check(false)}
          disabled={busy || !videoId.trim()}
          className="px-4 py-2 rounded-lg bg-sky-700 hover:bg-sky-600 disabled:opacity-50 text-white text-sm font-semibold"
        >
          {busy ? 'Checking…' : 'Check'}
        </button>
        <button
          type="button"
          onClick={() => check(true)}
          disabled={busy || !videoId.trim()}
          className="px-4 py-2 rounded-lg bg-neutral-700 hover:bg-neutral-600 disabled:opacity-50 text-white text-sm font-semibold"
        >
          Fetch &amp; keep transcript
        </button>
      </div>
      {result && <pre className="text-[11px] text-neutral-300 bg-neutral-950 border border-neutral-800 rounded-lg p-3 max-h-96 overflow-auto whitespace-pre-wrap">{result}</pre>}
    </div>
  );
};
