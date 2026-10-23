import React, { useState, useEffect } from 'react';
import { Key, ShieldCheck, Check, AlertCircle, X, ExternalLink, Activity } from 'lucide-react';

interface MetaTokenModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTokenSaved?: () => void;
}

export const MetaTokenModal: React.FC<MetaTokenModalProps> = ({
  isOpen,
  onClose,
  onTokenSaved,
}) => {
  const [tokenInput, setTokenInput] = useState('');
  const [pageIdInput, setPageIdInput] = useState('me');
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [currentTokenInfo, setCurrentTokenInfo] = useState<{
    hasToken: boolean;
    maskedToken: string | null;
    pageId: string;
    mode: string;
  } | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetch('/api/meta/token')
        .then((r) => r.json())
        .then((data) => {
          if (data.success) {
            setCurrentTokenInfo(data);
            if (data.pageId) setPageIdInput(data.pageId);
          }
        })
        .catch(() => {});
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSaveToken = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tokenInput.trim()) {
      setStatusMessage({ type: 'error', text: 'Please enter a valid Page Access Token.' });
      return;
    }

    setIsSaving(true);
    setStatusMessage(null);

    try {
      const res = await fetch('/api/meta/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: tokenInput.trim(),
          pageId: pageIdInput.trim() || 'me',
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setStatusMessage({
          type: 'success',
          text: 'Facebook Page Access Token successfully connected! Real-time Messenger dispatch and Graph API sync are now active.',
        });
        setCurrentTokenInfo(data);
        setTokenInput('');
        if (onTokenSaved) onTokenSaved();
        setTimeout(() => {
          onClose();
        }, 2000);
      } else {
        setStatusMessage({ type: 'error', text: data.error || 'Failed to save token.' });
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Network error saving token.' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-neutral-900 border border-neutral-700 rounded-3xl max-w-xl w-full p-6 sm:p-7 space-y-5 shadow-2xl relative">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 pb-4 border-b border-neutral-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-gradient-to-tr from-blue-600 to-sky-600 text-white shadow-lg shadow-blue-950/40">
              <Key className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
                Facebook Page Access Token Setup
              </h3>
              <p className="text-xs text-neutral-400 mt-0.5">
                Connect your Meta token to enable automated direct Messenger dispatch to buyers.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Current Status Pill */}
        <div className="p-3.5 bg-neutral-950 rounded-2xl border border-neutral-800 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-emerald-400" />
            <span className="text-neutral-300">Live API Status:</span>
          </div>
          {currentTokenInfo?.hasToken ? (
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono text-[11px] font-bold border border-emerald-500/40">
              🟢 Connected ({currentTokenInfo.maskedToken})
            </span>
          ) : (
            <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-mono text-[11px] font-bold border border-amber-500/40">
              🟡 Token Not Configured Yet
            </span>
          )}
        </div>

        {/* Form */}
        <form onSubmit={handleSaveToken} className="space-y-4 text-xs">
          <div>
            <label className="block text-xs font-bold text-neutral-200 mb-1.5">
              Meta Page Access Token (<code className="text-sky-300 font-mono">META_PAGE_ACCESS_TOKEN</code> / <code className="text-neutral-400 font-mono">FB_PAGE_ACCESS_TOKEN</code>)
            </label>
            <textarea
              rows={3}
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              placeholder="Paste your META_PAGE_ACCESS_TOKEN here (e.g. EAAB... or EAAG...)"
              className="w-full bg-neutral-950 border border-neutral-700 focus:border-blue-500 rounded-xl p-3 text-white font-mono text-xs focus:outline-none transition"
              required
            />
            <span className="text-[10px] text-neutral-400 block mt-1">
              Supports both <code className="text-sky-300 font-mono">META_PAGE_ACCESS_TOKEN</code> and <code className="text-neutral-300 font-mono">FB_PAGE_ACCESS_TOKEN</code> simultaneously. Setting either synchronizes both across all Graph API v22.0 messaging routes.
            </span>
          </div>

          <div>
            <label className="block text-xs font-bold text-neutral-200 mb-1.5">
              Facebook Page ID (Optional)
            </label>
            <input
              type="text"
              value={pageIdInput}
              onChange={(e) => setPageIdInput(e.target.value)}
              placeholder="Page ID or leave as 'me'"
              className="w-full bg-neutral-950 border border-neutral-700 focus:border-blue-500 rounded-xl px-3 py-2 text-white font-mono text-xs focus:outline-none transition"
            />
          </div>

          {/* Meta Brand Safety & Compliance Policy Control */}
          <div className="p-3.5 bg-neutral-950/80 rounded-2xl border border-neutral-800 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-neutral-200 flex items-center gap-1.5 text-xs">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Meta Brand Policy & Public Badge Safety</span>
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
                Safe Mode Active
              </span>
            </div>
            <p className="text-[11px] text-neutral-400 leading-relaxed">
              To protect your Facebook business page from trademark strikes, public broadcast HUDs and buyer invoices use the compliant BPSO Verified seal by default. Keep this disabled until you receive formal written clearance from the Meta Brand Resource Center.
            </p>
            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="brandApprovalToggle"
                checked={localStorage.getItem('bpso_meta_public_brand_approved') === 'true'}
                onChange={(e) => {
                  localStorage.setItem('bpso_meta_public_brand_approved', e.target.checked ? 'true' : 'false');
                  window.dispatchEvent(new Event('storage'));
                  setStatusMessage({
                    type: 'success',
                    text: e.target.checked
                      ? 'Public Meta badge enabled on live HUD and invoices.'
                      : 'Safe Mode active: Public materials will use the compliant BPSO seal.',
                  });
                }}
                className="w-4 h-4 text-blue-600 rounded bg-neutral-900 border-neutral-700 focus:ring-0 cursor-pointer"
              />
              <label htmlFor="brandApprovalToggle" className="text-xs text-neutral-300 cursor-pointer select-none">
                I have received formal approval from Meta to display the Meta logo on public broadcasts & invoices
              </label>
            </div>
            <div className="pt-1 text-[10px]">
              <a
                href="https://about.meta.com/brand/resources/meta/request-brand-permissions/"
                target="_blank"
                rel="noreferrer"
                className="text-sky-400 hover:text-sky-300 underline flex items-center gap-1"
              >
                <span>Submit official request to Meta Brand Permissions Center</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>

          {statusMessage && (
            <div
              className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
                statusMessage.type === 'success'
                  ? 'bg-emerald-950/60 border-emerald-500 text-emerald-200'
                  : 'bg-rose-950/60 border-rose-500 text-rose-200'
              }`}
            >
              {statusMessage.type === 'success' ? (
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              )}
              <span>{statusMessage.text}</span>
            </div>
          )}

          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-neutral-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-semibold rounded-xl transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2 bg-gradient-to-r from-blue-600 to-sky-600 hover:from-blue-500 hover:to-sky-500 disabled:opacity-50 text-white font-bold rounded-xl shadow-lg transition flex items-center gap-1.5"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>{isSaving ? 'Connecting...' : 'Save & Connect Token'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
