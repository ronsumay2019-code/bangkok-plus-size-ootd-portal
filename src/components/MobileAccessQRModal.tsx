import React, { useState, useEffect } from 'react';
import {
  QrCode,
  Smartphone,
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
import QRCode from 'qrcode';

export interface MobileSessionInfo {
  id: string;
  userName: string;
  role: 'owner' | 'admin' | 'staff';
  label: string;
  description: string;
  defaultDevice: string;
}

interface MobileAccessQRModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUserRole: 'owner' | 'admin' | 'staff';
  currentUserName: string;
  onSwitchUser?: (userName: string, role: 'owner' | 'admin' | 'staff') => void;
  /** Staff sign-in is on: links carry a one-time access code created by the owner */
  authEnabled?: boolean;
}

type ProfileKey = 'owner2' | 'admin1' | 'admin2' | 'admin3' | 'owner';
/** Seats that get a sign-in link from the owner (the primary owner uses PORTAL_OWNER_CODE) */
type InviteKey = Exclude<ProfileKey, 'owner'>;

const PROFILE_TABS: Array<{ key: ProfileKey; label: string; colour: string }> = [
  { key: 'owner2', label: 'Co-owner', colour: 'amber' },
  { key: 'admin1', label: 'Admin 1', colour: 'rose' },
  { key: 'admin2', label: 'Admin 2', colour: 'purple' },
  { key: 'admin3', label: 'Admin 3', colour: 'sky' },
  { key: 'owner', label: 'My Owner Phone', colour: 'amber' },
];

const TAB_ACTIVE: Record<string, string> = {
  amber: 'bg-amber-600 text-white shadow-lg shadow-amber-950/50',
  rose: 'bg-rose-600 text-white shadow-lg shadow-rose-950/50',
  purple: 'bg-purple-600 text-white shadow-lg shadow-purple-950/50',
  sky: 'bg-sky-600 text-white shadow-lg shadow-sky-950/50',
};

export const MobileAccessQRModal: React.FC<MobileAccessQRModalProps> = ({
  isOpen,
  onClose,
  currentUserRole,
  currentUserName,
  onSwitchUser,
  authEnabled = false,
}) => {
  const [activeTab, setActiveTab] = useState<ProfileKey | 'sessions'>('owner2');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [urlMode, setUrlMode] = useState<'production' | 'current'>('production');

  const PROD_BASE_URL = 'https://bangkok-plus-size-ootd-portal.vercel.app';
  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : PROD_BASE_URL;
  // If current origin is localhost, default to production so phones outside LAN can reach the cloud portal
  const effectiveBaseUrl = urlMode === 'production' || currentOrigin.includes('localhost') || currentOrigin.includes('127.0.0.1')
    ? PROD_BASE_URL
    : currentOrigin;

  const adminDescription =
    'Admin access: review live claims, set prices, approve orders and reply to buyers. Cannot see or change the Facebook token or create sign-in links.';
  const adminProfiles: Record<ProfileKey, MobileSessionInfo> = {
    owner2: {
      id: 'owner2',
      userName: 'Co-owner',
      role: 'owner',
      label: 'Co-owner Access',
      description: 'Same access as the shop owner, including the Facebook token and creating sign-in links for admins.',
      defaultDevice: 'Co-owner Phone',
    },
    admin1: {
      id: 'admin1',
      userName: 'Admin 1',
      role: 'admin',
      label: 'Admin 1 Access',
      description: adminDescription,
      defaultDevice: 'Admin 1 Phone',
    },
    admin2: {
      id: 'admin2',
      userName: 'Admin 2',
      role: 'admin',
      label: 'Admin 2 Access',
      description: adminDescription,
      defaultDevice: 'Admin 2 Phone',
    },
    admin3: {
      id: 'admin3',
      userName: 'Admin 3',
      role: 'admin',
      label: 'Admin 3 Access',
      description: adminDescription,
      defaultDevice: 'Admin 3 Phone',
    },
    owner: {
      id: 'owner',
      userName: 'Pola (Shop Owner)',
      role: 'owner',
      label: 'Shop Owner Mobile Access',
      description: 'Executive owner access with full override powers. Can be opened on owner phone alongside desktop session.',
      defaultDevice: 'Shop Owner Phone',
    },
  };

  // Access codes exist only in this browser tab until the owner shares them; the server keeps only a hash
  const [inviteCodes, setInviteCodes] = useState<Partial<Record<InviteKey, string>>>({});
  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const isOwner = currentUserRole === 'owner';

  const getAccessUrl = (profileKey: ProfileKey) => {
    const prof = adminProfiles[profileKey];
    if (authEnabled) {
      if (profileKey === 'owner') return `${effectiveBaseUrl}/`;
      const code = inviteCodes[profileKey];
      return code ? `${effectiveBaseUrl}/?invite=${encodeURIComponent(code)}` : '';
    }
    return `${effectiveBaseUrl}/?auth=${prof.id}&user=${encodeURIComponent(prof.userName)}&role=${prof.role}`;
  };

  const createInvite = async (profileKey: InviteKey, revokeSessions: boolean) => {
    setInviteBusy(true);
    setInviteError(null);
    try {
      const res = await fetch('/api/auth/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ staffId: profileKey, revokeSessions }),
      });
      const data: any = await res.json().catch(() => ({}));
      if (!res.ok || !data.code) throw new Error(data.error || 'Could not create the sign-in link');
      setInviteCodes((prev) => ({ ...prev, [profileKey]: data.code }));
    } catch (err: any) {
      setInviteError(err?.message || 'Could not create the sign-in link');
    } finally {
      setInviteBusy(false);
    }
  };

  // QR codes are drawn in the browser so access links are never sent to an outside QR service
  const currentAccessUrl = activeTab !== 'sessions' ? getAccessUrl(activeTab) : '';
  useEffect(() => {
    let cancelled = false;
    if (!currentAccessUrl) {
      setQrDataUrl('');
      return;
    }
    QRCode.toDataURL(currentAccessUrl, { width: 280, margin: 2 })
      .then((url) => !cancelled && setQrDataUrl(url))
      .catch(() => !cancelled && setQrDataUrl(''));
    return () => {
      cancelled = true;
    };
  }, [currentAccessUrl]);

  const handleCopyLink = (profileKey: ProfileKey) => {
    const link = getAccessUrl(profileKey);
    if (!link) return;
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
                Give the co-owner and your 3 admins their own sign-in link without logging yourself out.
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
              Each person gets their own private link. Sharing a link <strong>never logs you out</strong>, and everyone can use the portal at the same time.
            </p>
          </div>
        </div>

        {/* Tab Selection */}
        <div className="flex flex-wrap items-center gap-2 border-b border-neutral-800 pb-3 text-xs">
          {PROFILE_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold transition ${
                activeTab === tab.key ? TAB_ACTIVE[tab.colour] : 'bg-neutral-800/80 text-neutral-400 hover:text-white'
              }`}
            >
              {tab.key === 'owner' || tab.key === 'owner2' ? <Key className="w-4 h-4" /> : <Smartphone className="w-4 h-4" />}
              <span>{tab.label}</span>
            </button>
          ))}

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
            <span>Seats ({PROFILE_TABS.length})</span>
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
                {authEnabled && activeTab === 'owner' ? (
                  <div className="w-48 sm:w-52 text-center text-[11px] text-neutral-300 space-y-2 py-6">
                    <Key className="w-6 h-6 text-amber-300 mx-auto" />
                    <p>On your phone, open the portal and type your <strong>owner access code</strong> (the PORTAL_OWNER_CODE saved in Vercel).</p>
                  </div>
                ) : authEnabled && !currentAccessUrl ? (
                  <div className="w-48 sm:w-52 text-center text-[11px] text-neutral-300 space-y-3 py-6">
                    {isOwner ? (
                      <>
                        <p>Create a private sign-in link for {adminProfiles[activeTab].userName}. Any older link for this seat stops working.</p>
                        <button
                          type="button"
                          disabled={inviteBusy}
                          onClick={() => createInvite(activeTab as InviteKey, false)}
                          className="px-3 py-2 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white rounded-xl font-bold"
                        >
                          {inviteBusy ? 'Creating…' : 'Create sign-in link'}
                        </button>
                      </>
                    ) : (
                      <p>Only the shop owner can create phone sign-in links.</p>
                    )}
                    {inviteError && <p className="text-rose-400">{inviteError}</p>}
                  </div>
                ) : (
                  <div className="p-3 bg-white rounded-2xl shadow-2xl border-4 border-neutral-200">
                    {qrDataUrl ? (
                      <img
                        src={qrDataUrl}
                        alt={`${adminProfiles[activeTab].label} QR Code`}
                        className="w-48 h-48 sm:w-52 sm:h-52 object-contain"
                      />
                    ) : (
                      <div className="w-48 h-48 sm:w-52 sm:h-52" />
                    )}
                  </div>
                )}
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

                  {authEnabled && isOwner && activeTab !== 'owner' && currentAccessUrl && (
                    <button
                      type="button"
                      disabled={inviteBusy}
                      onClick={() => createInvite(activeTab as InviteKey, true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-amber-300 border border-neutral-700 rounded-xl text-xs font-semibold transition"
                      title="Creates a new link and signs this admin out of every phone"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>New link + sign out old phones</span>
                    </button>
                  )}

                  {onSwitchUser && !authEnabled && (
                    <button
                      type="button"
                      onClick={() => {
                        const prof = adminProfiles[activeTab];
                        onSwitchUser(prof.userName, prof.role);
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
                    <span>How to Install It As An App On a Phone:</span>
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
                <span className="text-emerald-400 font-mono text-[11px]">{PROFILE_TABS.length} seats</span>
              </div>

              <div className="divide-y divide-neutral-850">
                {PROFILE_TABS.map((tab) => {
                  const prof = adminProfiles[tab.key];
                  return (
                    <div key={tab.key} className="py-2.5 flex items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <strong className="text-white">{tab.key === 'owner' ? prof.userName : tab.label}</strong>
                          <span className="px-2 py-0.2 rounded-full bg-neutral-800 text-neutral-300 text-[10px] font-bold border border-neutral-700">
                            {prof.role.toUpperCase()}
                          </span>
                          {currentUserName === prof.userName && (
                            <span className="text-[10px] text-emerald-400 font-mono">● You are here</span>
                          )}
                        </div>
                        <div className="text-[11px] text-neutral-400 mt-0.5">
                          {tab.key === 'owner' ? 'Signs in with the owner code' : 'Signs in with a link from the owner'}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setActiveTab(tab.key)}
                        className="px-2.5 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-semibold transition"
                      >
                        {tab.key === 'owner' ? 'View' : 'View link'}
                      </button>
                    </div>
                  );
                })}
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
