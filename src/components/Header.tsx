import React from 'react';
import { 
  Radio, 
  CheckCircle2, 
  Store, 
  Coins, 
  FileCheck, 
  ShieldCheck, 
  Sparkles,
  HelpCircle,
  ShoppingBag,
  Activity,
  UserCheck,
  QrCode,
  Smartphone,
} from 'lucide-react';
import { LiveSession, ReconciliationSummary } from '../types/reconciliation';

interface HeaderProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  activeLive: LiveSession;
  summary: ReconciliationSummary | null;
  phpRate: number;
  onOpenAnalysis: () => void;
  onOpenMobileAccessModal?: () => void;
  onOpenMetaTokenModal?: () => void;
  preOrdersCount?: number;
  userRole: 'owner' | 'admin' | 'staff';
  setUserRole: (role: 'owner' | 'admin' | 'staff') => void;
  currentUserName?: string;
  graphSyncStats?: {
    lastSyncAt: string;
    syncCount: number;
    onAirVideoId: string;
    broadcastStatus: string;
  };
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  activeLive,
  summary,
  phpRate,
  onOpenAnalysis,
  onOpenMobileAccessModal,
  onOpenMetaTokenModal,
  preOrdersCount = 0,
  userRole,
  setUserRole,
  currentUserName,
  graphSyncStats,
}) => {
  const isOnAir = activeLive.status === 'live';
  const readyToLeave = summary?.checklist.readyToLeaveStore;

  const navItems = [
    { id: 'live_command', label: 'Live Session Command', icon: Radio, badge: isOnAir ? 'ON AIR' : 'ENDED' },
    { id: 'messenger_adjustments', label: 'Page Messenger Orders', icon: ShieldCheck, badge: 'Direct DMs' },
    { id: 'order_review', label: 'Order Review & Verification', icon: CheckCircle2, badge: activeLive.reconciliationStatus === 'awaiting_owner_review' ? 'Awaiting Review' : 'Verified Orders' },
    { id: 'reconciliation', label: 'Reconciliation & Invoices', icon: FileCheck, badge: summary ? `${summary.buyerBags.length} Bags` : undefined },
    { id: 'pre_orders', label: 'Pre-Orders Lane', icon: ShoppingBag, badge: `${preOrdersCount} Pre-orders` },
    { id: 'replay_studio', label: 'Replay Review Studio', icon: CheckCircle2 },
    { id: 'buying_analytics', label: 'Sales & Demand Analytics', icon: Sparkles },
    { id: 'pola_ai', label: 'Pola AI Co-Pilot', icon: Sparkles, badge: 'Gemini' },
  ];

  return (
    <header className="sticky top-0 z-40 bg-neutral-900/90 backdrop-blur-md border-b border-neutral-800">
      {/* Top Banner with Shop Details & Currency Rules */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-wrap items-center justify-between gap-4">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-rose-600 via-pink-500 to-amber-400 p-0.5 shadow-lg shadow-rose-950/40">
            <img 
              src="/brand/bpso-logo-original.jpg" 
              alt="BPSO" 
              className="w-full h-full object-cover rounded-[10px]"
              onError={(e) => {
                // Fallback icon if image is loading
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-lg text-white tracking-tight">Bangkok Plus Size OOTD</h1>
              <span className="text-xs px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 font-medium border border-rose-500/30">
                Portal 2026.10
              </span>
            </div>
            <p className="text-xs text-neutral-400">
              Live Selling Order Reconciliation & Inventory Direct-Sync
            </p>
          </div>
        </div>

        {/* Live Status & Currency Checkpoint Widgets */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Live Status Chip */}
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-semibold ${
            isOnAir 
              ? 'bg-rose-950/60 border-rose-600/50 text-rose-300 animate-pulse' 
              : 'bg-emerald-950/40 border-emerald-600/40 text-emerald-300'
          }`}>
            <span className={`w-2 h-2 rounded-full ${isOnAir ? 'bg-rose-500' : 'bg-emerald-400'}`} />
            <span>{isOnAir ? 'LIVE BROADCAST ON AIR' : 'LIVE CONCLUDED · RECONCILED'}</span>
          </div>

          {/* Store Location */}
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-neutral-800/80 border border-neutral-700/80 text-xs text-neutral-300">
            <Store className="w-3.5 h-3.5 text-amber-400" />
            <span className="truncate max-w-[170px]" title={activeLive.storeName}>
              {activeLive.storeName}
            </span>
          </div>

          {/* Exchange Rate Badge */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-800/80 border border-neutral-700/80 text-xs text-neutral-300">
            <Coins className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-neutral-400">Rate:</span>
            <span className="font-semibold text-amber-300">1 THB = ₱{phpRate.toFixed(2)} PHP</span>
          </div>

          {/* Zero Refund Gated Badge */}
          <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-950/50 border border-purple-500/40 text-xs text-purple-300">
            <ShieldCheck className="w-3.5 h-3.5 text-purple-400" />
            <span>Zero-Refund Invoicing Gate</span>
          </div>

          {/* Meta Webhook & Graph API Status / Token Config */}
          <button
            type="button"
            onClick={onOpenMetaTokenModal}
            className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-800/80 hover:bg-neutral-700/80 border border-neutral-700/80 text-xs text-neutral-300 transition cursor-pointer"
            title="Click to connect or view your Facebook Page Access Token for automated Messenger DM dispatch"
          >
            <Activity className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
            <span className="text-neutral-400">Meta API:</span>
            <span className="font-semibold text-emerald-300">
              {graphSyncStats?.mode === 'live_graph_api' ? 'Graph API Active' : 'Connect Token 🔑'}
            </span>
          </button>

          {/* User Executive Role Switcher & Current User */}
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-neutral-800/90 border border-neutral-700 text-xs">
            <UserCheck className="w-3.5 h-3.5 text-rose-400" />
            <span className="text-neutral-400 text-[11px]">Role:</span>
            <select
              value={userRole}
              onChange={(e) => setUserRole(e.target.value as any)}
              className="bg-transparent text-white font-bold text-xs focus:outline-none cursor-pointer"
            >
              <option value="owner" className="bg-neutral-900 text-white">Owner (Full Override)</option>
              <option value="admin" className="bg-neutral-900 text-white">Admin (Full Override)</option>
              <option value="staff" className="bg-neutral-900 text-neutral-300">Staff (Standard)</option>
            </select>
            {currentUserName && (
              <span className="hidden xl:inline text-[10px] text-neutral-400 font-mono border-l border-neutral-700 pl-1.5 truncate max-w-[130px]" title={currentUserName}>
                {currentUserName}
              </span>
            )}
          </div>

          {/* Mobile Phone App Access QR Button */}
          {onOpenMobileAccessModal && (
            <button
              type="button"
              onClick={onOpenMobileAccessModal}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-rose-600 via-pink-600 to-rose-700 hover:from-rose-500 hover:to-pink-500 text-xs font-bold text-white shadow-md shadow-rose-950/40 transition cursor-pointer"
              title="Generate QR code and links for 2 Admin phones without losing your session"
            >
              <QrCode className="w-3.5 h-3.5" />
              <span>📱 Admin Phone QR</span>
            </button>
          )}

          {/* Executive Gap Analysis Button */}
          <button
            onClick={onOpenAnalysis}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-xs font-medium text-neutral-200 border border-neutral-700 transition"
          >
            <HelpCircle className="w-3.5 h-3.5 text-rose-400" />
            <span>Gap Analysis & Checklists</span>
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex overflow-x-auto no-scrollbar gap-1 pt-1 pb-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                isActive
                  ? 'bg-rose-600 text-white shadow-md shadow-rose-950/50 font-semibold'
                  : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/60'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-neutral-400'}`} />
              <span>{item.label}</span>
              {item.badge && (
                <span className={`text-[10px] px-1.5 py-0.2 rounded font-bold ${
                  isActive
                    ? 'bg-rose-800/80 text-rose-100'
                    : item.badge === 'ON AIR'
                    ? 'bg-rose-500/30 text-rose-300'
                    : 'bg-neutral-800 text-neutral-400'
                }`}>
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </header>
  );
};
