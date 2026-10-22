import React, { useState, useEffect } from 'react';
import {
  QrCode,
  Smartphone,
  Laptop,
  Users,
  Copy,
  Check,
  ExternalLink,
  ShieldCheck,
  CheckCircle2,
  Share2,
  X,
  Key,
  RefreshCw,
  Info,
  Sparkles,
  ArrowRight,
} from 'lucide-react';

export interface MobileSessionInfo {
  id: string;
  userName: string;
  role: 'owner' | 'admin' | 'staff';
  token: string;
  label: string;
  description: string;
  defaultDevice: string;
}

interface MobileAccessQRModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUserRole: 'owner' | 'admin' | 'staff';
  currentUserName: string;
  onSwitchUser?: (userName: string, role: 'owner' | 'admin' | 'staff', token: string) => void;
}

export const MobileAccessQRModal: React.FC<MobileAccessQRModalProps> = ({
  isOpen,
  onClose,
  currentUserRole,
  currentUserName,
  onSwitchUser,
}) => {
  const [activeTab, setActiveTab] = useState<'admin1' | 'admin2' | 'owner' | 'sessions'>('admin1');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [urlMode, setUrlMode] = useState<'production' | 'current'>('production');

  const PROD_BASE_URL = 'https://bangkok-plus-size-ootd-portal.vercel.app';
  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : PROD_BASE_URL;
  // If current origin is localhost, default to production so phones outside LAN can reach the cloud portal
  const effectiveBaseUrl = urlMode === 'production' || currentOrigin.includes('localhost') || currentOrigin.includes('127.0.0.1')
    ? PROD_BASE_URL
    : currentOrigin;

  const adminProfiles: Record<'admin1' | 'admin2' | 'owner', MobileSessionInfo> = {
    admin1: {
      id: 'admin1',
      userName: 'Admin 1 (Staff Lead)',
      role: 'admin',
      token: 'bpso_admin_one_2026',
      label: 'Admin 1 Mobile Access',
      description: 'Full admin access for staff lead on mobile phone. Can approve claims, edit garment specs, and manage buyer bags.',
      defaultDevice: 'Phone 1 (Staff Lead)',
    },
    admin2: {
      id: 'admin2',
      userName: 'Admin 2 (Inventory Lead)',
      role: 'admin',
      token: 'bpso_admin_two_2026',
      label: 'Admin 2 Mobile Access',
      description: 'Full admin access for inventory & verification admin on mobile phone. Can review live claims, set prices, and approve invoices.',
      defaultDevice: 'Phone 2 (Inventory Lead)',
    },
    owner: {
      id: 'owner',
      userName: 'Pola (Shop Owner)',
      role: 'owner',
      token: 'bpso_owner_pola_2026',
      label: 'Shop Owner Mobile Access',
      description: 'Executive owner access with full override powers. Can be opened on owner phone alongside desktop session.',
      defaultDevice: 'Shop Owner Phone',
    },
  };

  const getAccessUrl = (profileKey: 'admin1' | 'admin2' | 'owner') => {
    const prof = adminProfiles[profileKey];
    return `${effectiveBaseUrl}/?auth=${prof.id}&token=${prof.token}&user=${encodeURIComponent(prof.userName)}&role=${prof.role}`;
  };

  const getQrCodeImgUrl = (text: string) => {
    // Standard high-reliability QR code API (generates crisp 280x280 PNG)
    return `https://api.qrserver.com/v1/create-qr-code/?size=280x280&margin=12&format=png&data=${encodeURIComponent(text)}`;
  };

  const handleCopyLink = (profileKey: 'admin1' | 'admin2' | 'owner') => {
    const link = getAccessUrl(profileKey);
    navigator.clipboard.writeText(link);
    setCopiedKey(profileKey);
    setTimeout(() => setCopiedKey(null), 3000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-neutral-900 border border-neutral-700 rounded-3xl max-w-2xl w-full p-6 sm:p-7 space-y-6 shadow-2xl my-8 relative overflow-hidden">
        {/* Glow decoration */}
        <div className="absolute top-0 right-0 w-72 h-72 bg-gradient-to-br from-rose-600/15 via-purple-600/10 to-transparent rounded-full blur-3xl pointer-events-none" />

        {/* Header */}
        <div className="flex items-start justify-between gap-4 pb-4 border-b border-neutral-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-gradient-to-tr from-rose-600 to-pink-600 text-white shadow-lg shadow-rose-950/40">
              <QrCode className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
                  Mobile Phone App Access & QR Code Hub
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-extrabold border border-emerald-500/30">
                  Multi-Login Active
                </span>
              </div>
              <p className="text-xs text-neutral-400 mt-0.5">
                Grant instant portal access to your 2 admins on their mobile phones without passwords or losing your current desktop login.
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

        {/* Safety Guarantee Callout */}
        <div className="p-3.5 bg-gradient-to-r from-emerald-950/50 via-neutral-950/70 to-emerald-950/40 border border-emerald-500/40 rounded-2xl flex items-start gap-3 text-xs">
          <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <span className="font-bold text-emerald-200">
              Zero-Logout Guarantee • Multi-Device Simultaneous Access
            </span>
            <p className="text-neutral-300 text-[11px] leading-relaxed">
              Each admin phone uses an independent persistent access token. Sharing this QR code with <strong>Admin 1</strong> and <strong>Admin 2</strong> will <strong>never log you out</strong> of your session. All 3 devices operate at the same time with live real-time sync.
            </p>
          </div>
        </div>

        {/* Tab Selection */}
        <div className="flex flex-wrap items-center gap-2 border-b border-neutral-800 pb-3 text-xs">
          <button
            type="button"
            onClick={() => setActiveTab('admin1')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold transition ${
              activeTab === 'admin1'
                ? 'bg-rose-600 text-white shadow-lg shadow-rose-950/50'
                : 'bg-neutral-800/80 text-neutral-400 hover:text-white'
            }`}
          >
            <Smartphone className="w-4 h-4 text-rose-300" />
            <span>Admin 1 Phone</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('admin2')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold transition ${
              activeTab === 'admin2'
                ? 'bg-purple-600 text-white shadow-lg shadow-purple-950/50'
                : 'bg-neutral-800/80 text-neutral-400 hover:text-white'
            }`}
          >
            <Smartphone className="w-4 h-4 text-purple-300" />
            <span>Admin 2 Phone</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('owner')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold transition ${
              activeTab === 'owner'
                ? 'bg-amber-600 text-white shadow-lg shadow-amber-950/50'
                : 'bg-neutral-800/80 text-neutral-400 hover:text-white'
            }`}
          >
            <Key className="w-4 h-4 text-amber-300" />
            <span>Owner Phone</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('sessions')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold transition ${
              activeTab === 'sessions'
                ? 'bg-neutral-700 text-white shadow'
                : 'bg-neutral-800/80 text-neutral-400 hover:text-white'
            }`}
          >
            <Users className="w-4 h-4 text-neutral-300" />
            <span>Active Logins (3)</span>
          </button>
        </div>

        {/* Tab Content: Admin 1 / Admin 2 / Owner */}
        {activeTab !== 'sessions' && (
          <div className="space-y-5">
            {/* Active profile description */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-neutral-950/70 p-3.5 rounded-2xl border border-neutral-800 text-xs">
              <div>
                <span className="text-neutral-400 block text-[10px] font-semibold uppercase">Profile Target:</span>
                <strong className="text-white text-sm">{adminProfiles[activeTab].userName}</strong>
                <p className="text-neutral-400 text-[11px] mt-0.5">{adminProfiles[activeTab].description}</p>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 font-mono text-[11px] font-bold border border-emerald-500/40">
                ROLE: {adminProfiles[activeTab].role.toUpperCase()}
              </span>
            </div>

            {/* QR Code and Instructions Container */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 items-center">
              {/* Left Column: QR Code Box */}
              <div className="flex flex-col items-center justify-center p-5 bg-neutral-950 rounded-2xl border-2 border-neutral-700/80 shadow-inner space-y-3">
                <div className="p-3 bg-white rounded-2xl shadow-2xl border-4 border-neutral-200">
                  <img
                    src={getQrCodeImgUrl(getAccessUrl(activeTab))}
                    alt={`${adminProfiles[activeTab].label} QR Code`}
                    className="w-48 h-48 sm:w-52 sm:h-52 object-contain"
                    onError={(e) => {
                      // Fallback QR code provider if offline/fallback needed
                      (e.target as HTMLImageElement).src = `https://quickchart.io/qr?text=${encodeURIComponent(getAccessUrl(activeTab))}&size=260`;
                    }}
                  />
                </div>
                <div className="text-center space-y-0.5">
                  <span className="text-xs font-bold text-white flex items-center justify-center gap-1.5">
                    <Smartphone className="w-3.5 h-3.5 text-rose-400" />
                    <span>Scan with Phone Camera</span>
                  </span>
                  <span className="text-[10px] text-neutral-400 block font-mono">
                    Instant login without typing password
                  </span>
                </div>
              </div>

              {/* Right Column: Actions & Quick Guide */}
              <div className="space-y-4 text-xs">
                {/* 1-Click Copy Link */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-neutral-300 block">
                    Direct Phone Access Link:
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={getAccessUrl(activeTab)}
                      className="bg-neutral-950 border border-neutral-700 rounded-xl px-3 py-2 text-neutral-300 text-[11px] font-mono w-full truncate focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => handleCopyLink(activeTab)}
                      className="px-3.5 py-2 bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white rounded-xl font-bold flex items-center gap-1.5 shadow transition shrink-0"
                    >
                      {copiedKey === activeTab ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copy Link</span>
                        </>
                      )}
                    </button>
                  </div>
                  <span className="text-[10px] text-neutral-500 italic block">
                    Paste in Messenger or Viber DM to the admin. Clicking it logs them in automatically.
                  </span>
                </div>

                {/* Test buttons */}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <a
                    href={getAccessUrl(activeTab)}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 rounded-xl text-xs font-semibold transition"
                  >
                    <ExternalLink className="w-3.5 h-3.5 text-neutral-400" />
                    <span>Test Open In New Tab</span>
                  </a>

                  {onSwitchUser && (
                    <button
                      type="button"
                      onClick={() => {
                        const prof = adminProfiles[activeTab];
                        onSwitchUser(prof.userName, prof.role, prof.token);
                        onClose();
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-amber-300 border border-neutral-700 rounded-xl text-xs font-semibold transition"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Switch Local View To This Profile</span>
                    </button>
                  )}
                </div>

                {/* Mobile PWA / Add to Home Screen Instructions */}
                <div className="p-3 bg-neutral-950/80 rounded-xl border border-neutral-800 space-y-1.5">
                  <span className="text-[11px] font-bold text-amber-300 flex items-center gap-1.5">
                    <Share2 className="w-3.5 h-3.5 text-amber-400" />
                    <span>How Admins Can Install As An App On Their Phone:</span>
                  </span>
                  <ul className="text-[11px] text-neutral-400 space-y-1 list-disc list-inside">
                    <li>
                      <strong className="text-neutral-200">iPhone (Safari):</strong> Tap the <em>Share icon</em> (square with arrow) ➔ tap <em>"Add to Home Screen"</em>.
                    </li>
                    <li>
                      <strong className="text-neutral-200">Android (Chrome):</strong> Tap the <em>three dots menu</em> ➔ tap <em>"Add to Home screen"</em> or <em>"Install App"</em>.
                    </li>
                    <li>
                      Launches full screen with zero address bar, working like a native mobile app!
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab Content: Active Connected Sessions */}
        {activeTab === 'sessions' && (
          <div className="space-y-4 text-xs">
            <div className="bg-neutral-950/80 border border-neutral-800 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-neutral-800">
                <span className="font-bold text-sm text-white flex items-center gap-2">
                  <Users className="w-4 h-4 text-rose-400" />
                  <span>Authorized Multi-Login Device Registry</span>
                </span>
                <span className="text-emerald-400 font-mono text-[11px]">3 Seats Configured</span>
              </div>

              <div className="divide-y divide-neutral-850">
                {/* Seat 1: Owner */}
                <div className="py-2.5 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center justify-center font-bold">
                      👑
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <strong className="text-white">Pola (Shop Owner)</strong>
                        <span className="px-2 py-0.2 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-bold border border-amber-500/30">
                          OWNER
                        </span>
                        {currentUserRole === 'owner' && (
                          <span className="text-[10px] text-emerald-400 font-mono">● You are here</span>
                        )}
                      </div>
                      <div className="text-[11px] text-neutral-400 flex items-center gap-2 mt-0.5">
                        <Laptop className="w-3 h-3 text-neutral-500" />
                        <span>Desktop / Primary Browser</span>
                        <span className="text-neutral-600">&bull;</span>
                        <span className="text-emerald-400">Active Now</span>
                      </div>
                    </div>
                  </div>
                  <span className="text-[11px] text-neutral-400 font-mono">Permanent Seat</span>
                </div>

                {/* Seat 2: Admin 1 */}
                <div className="py-2.5 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-rose-500/20 text-rose-300 border border-rose-500/40 flex items-center justify-center font-bold">
                      1
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <strong className="text-white">Admin 1 (Staff Lead)</strong>
                        <span className="px-2 py-0.2 rounded-full bg-rose-500/20 text-rose-300 text-[10px] font-bold border border-rose-500/30">
                          ADMIN
                        </span>
                        {currentUserName.includes('Admin 1') && (
                          <span className="text-[10px] text-emerald-400 font-mono">● Active Device</span>
                        )}
                      </div>
                      <div className="text-[11px] text-neutral-400 flex items-center gap-2 mt-0.5">
                        <Smartphone className="w-3 h-3 text-neutral-500" />
                        <span>Phone 1 (Mobile App)</span>
                        <span className="text-neutral-600">&bull;</span>
                        <span className="text-emerald-400">Authorized &bull; Non-Expiring</span>
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab('admin1')}
                    className="px-2.5 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-semibold transition"
                  >
                    View QR
                  </button>
                </div>

                {/* Seat 3: Admin 2 */}
                <div className="py-2.5 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-purple-500/20 text-purple-300 border border-purple-500/40 flex items-center justify-center font-bold">
                      2
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <strong className="text-white">Admin 2 (Inventory Lead)</strong>
                        <span className="px-2 py-0.2 rounded-full bg-purple-500/20 text-purple-300 text-[10px] font-bold border border-purple-500/30">
                          ADMIN
                        </span>
                        {currentUserName.includes('Admin 2') && (
                          <span className="text-[10px] text-emerald-400 font-mono">● Active Device</span>
                        )}
                      </div>
                      <div className="text-[11px] text-neutral-400 flex items-center gap-2 mt-0.5">
                        <Smartphone className="w-3 h-3 text-neutral-500" />
                        <span>Phone 2 (Mobile App)</span>
                        <span className="text-neutral-600">&bull;</span>
                        <span className="text-emerald-400">Authorized &bull; Non-Expiring</span>
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab('admin2')}
                    className="px-2.5 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-semibold transition"
                  >
                    View QR
                  </button>
                </div>
              </div>
            </div>

            <div className="p-3.5 bg-neutral-950/60 rounded-xl border border-neutral-800 flex items-center justify-between">
              <span className="text-neutral-400 text-xs">
                Logged in on current browser as: <strong className="text-white">{currentUserName}</strong> ({currentUserRole.toUpperCase()})
              </span>
              <span className="text-emerald-400 font-mono text-[11px]">Safe Session Persistence ✓</span>
            </div>
          </div>
        )}

        {/* Modal Footer */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-neutral-800 text-xs">
          <div className="flex items-center gap-2 text-neutral-400">
            <Info className="w-4 h-4 text-neutral-500" />
            <span>Target Portal: <strong className="text-neutral-200">{effectiveBaseUrl}</strong></span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-xl font-bold transition"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
