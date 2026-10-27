# Review packet RP-002: T-039 tabs and clean-up (code change)

**For: Grok (independent reviewer).** Paste or upload this whole file into Grok, then send Grok's full answer back to Claude.

## Your role
You are the **independent adversarial reviewer** for the Bangkok Plus Size OOTD live-selling portal. Another agent built or wrote what is below. Your job is to **find what is wrong, missing, risky or untrue**, not to praise it.

Rules you must judge against:
- The owner's **Live Selling Business** rules, included below. They are a HARD RULE.
- **Real data only:** no invented numbers.
- **No secrets** in code or docs.
- Nothing is sent to buyers without a person.

## What to send back (use exactly this format)
1. **Verdict:** APPROVE / CHANGES NEEDED / REJECT.
2. **Findings,** most serious first. For each one:
   - severity (Critical / High / Medium / Low);
   - where (section, or file and line);
   - what is wrong;
   - a concrete example of how it fails;
   - the fix you suggest.
3. **What you tried to break and could not.**
4. **Questions for the owner,** only if a business rule is unclear. Don't guess.

## What to attack in this review
- Is anything still reachable that the owner asked to remove (Analytics, Pola AI, Gap Analysis, rack board)? Any broken link to a removed tab?
- **Owner override without a reason:** can someone who isn't the owner or an admin now change orders? (The server must still check the role from the sign-in.) Can an empty override break saving or the history?
- The rewritten automatic **pre-order reply to buyers:** is it correct, warm, short Taglish? Does it promise anything untrue?
- Any change that could break a live, invoices, payments or Messenger sending?

---
## A. What the owner decided

## Tab names and clean-up (decided by the owner, 25 Oct)

**Seven simple tabs:**

| Tab | Was | Notes |
|---|---|---|
| **Live** | Live Session Command | Appears and clears by itself (B21) |
| **Replay** | Replay Review Studio | Review each past live (B20) |
| **Orders** | Order Review & Verification, plus live-time Messenger orders | Buyers, evidence, store match ([[Screens]] §3–5) |
| **Pre-orders** | Pre-Orders Lane | **Kept**: a separate revenue stream (B31) |
| **Invoices** | Reconciliation & Invoices | All-in-one invoice generator; live invoices and pre-order invoices |
| **Payments & Shipping** | same | Unchanged |
| **Messages** | the Messenger inbox in Page Messenger Orders | **Kept as is** |

**Removed:**
- Sales & Demand Analytics;
- Pola AI Co-Pilot;
- the Strategic analysis pop-up;
- the old inventory / rack board.

**Owner override: kept, with no reason asked.** In the invoice generator it is a **tick box next to a line**; ticking it lets the owner override that line.

**Kept as they are:**
- staff sign-in links (5 seats);
- the owner's Facebook token form;
- the owner's Start fresh;
- the READY / ON AIR status.


## B. The checks the builder (Claude) ran
- `npm test`: 38/38 pass. The new "owner overrides without giving a reason" check fails on the old code and passes on the new.
- `npm run build`: OK.
- `npm run lint`: 23 type errors, the same 23 as before the change (pre-existing, KI-013).
- Browser on a local copy: the 7 tabs show; the removed tabs are gone.
- Not deployed.

## C. The full code change (git diff 3f69236..4c01a94)

```diff
diff --git a/server.ts b/server.ts
index 15f4c95..5c7f6a1 100644
--- a/server.ts
+++ b/server.ts
@@ -3092,11 +3092,8 @@ app.post('/api/owner/order-override', (req, res) => {
     });
   }
 
-  if (!reason || !reason.trim()) {
-    return res.status(400).json({
-      error: 'Override reason is mandatory for operational audit compliance.',
-    });
-  }
+  // The owner overrides without giving a reason (owner, 25 Oct); a note is kept only if one was typed.
+  const note = typeof reason === 'string' ? reason.trim() : '';
 
   const nowIso = new Date().toISOString();
 
@@ -3134,7 +3131,7 @@ app.post('/api/owner/order-override', (req, res) => {
       version: currentVersion,
       by: author || `${role.toUpperCase()} (Authorized)`,
       at: nowIso,
-      reason: reason.trim(),
+      reason: note,
       before: beforeState,
       after: {
         itemCode: preOrder.itemCode,
@@ -3189,7 +3186,7 @@ app.post('/api/owner/order-override', (req, res) => {
     version: currentVersion,
     by: author || `${role.toUpperCase()} (Authorized)`,
     at: nowIso,
-    reason: reason.trim(),
+    reason: note,
     before: beforeState,
     after: {
       itemCode: order.itemCode,
diff --git a/src/App.tsx b/src/App.tsx
index 55fde00..e99f081 100644
--- a/src/App.tsx
+++ b/src/App.tsx
@@ -2,13 +2,9 @@ import React, { useState, useEffect, useMemo } from 'react';
 import { Header } from './components/Header';
 import { LiveSessionCommand } from './components/LiveSessionCommand';
 import { AutoReconciliationSummary } from './components/AutoReconciliationSummary';
-import { InventoryStoreBoard } from './components/InventoryStoreBoard';
 import { MessengerAdjustmentManager } from './components/MessengerAdjustmentManager';
 import { ReplayReviewStudio } from './components/ReplayReviewStudio';
-import { PolaAICopilot } from './components/PolaAICopilot';
-import { StrategicAnalysisModal } from './components/StrategicAnalysisModal';
 import { OrderReviewApprovalWorkspace } from './components/OrderReviewApprovalWorkspace';
-import { BuyingBehaviorDashboard } from './components/BuyingBehaviorDashboard';
 import { PreOrdersLane } from './components/PreOrdersLane';
 import { OwnerOverrideModal } from './components/OwnerOverrideModal';
 import { MobileAccessQRModal } from './components/MobileAccessQRModal';
@@ -80,7 +76,6 @@ function mergeThreads(incoming: MessengerThread[], existing: MessengerThread[]):
 
 export default function App({ authEnabled = false, portalUser = null, signOut }: Partial<PortalAuthContext> = {}) {
   const [activeTab, setActiveTab] = useState<string>('live_command');
-  const [showAnalysisModal, setShowAnalysisModal] = useState<boolean>(false);
   const [isMobileAccessModalOpen, setIsMobileAccessModalOpen] = useState<boolean>(false);
   const [isMetaTokenModalOpen, setIsMetaTokenModalOpen] = useState<boolean>(false);
   const [lives, setLives] = useState<LiveSession[]>(SEED_LIVE_SESSIONS);
@@ -1151,7 +1146,6 @@ export default function App({ authEnabled = false, portalUser = null, signOut }:
         activeLive={activeLive}
         summary={summary}
         phpRate={phpRate}
-        onOpenAnalysis={() => setShowAnalysisModal(true)}
         onOpenMobileAccessModal={() => setIsMobileAccessModalOpen(true)}
         onOpenMetaTokenModal={() => setIsMetaTokenModalOpen(true)}
         preOrdersCount={preOrders.length}
@@ -1291,27 +1285,6 @@ export default function App({ authEnabled = false, portalUser = null, signOut }:
           />
         )}
 
-        {activeTab === 'buying_analytics' && (
-          <BuyingBehaviorDashboard
-            orders={orders}
-            amendments={amendments}
-            inventory={inventory}
-            summary={summary}
-          />
-        )}
-
-        {activeTab === 'inventory_board' && (
-          <InventoryStoreBoard
-            inventory={inventory.filter((i) => i.liveId === activeLive.id)}
-            summary={summary}
-            phpRate={phpRate}
-            onUpdateItem={handleUpdateInventoryItem}
-            onAddItem={handleAddInventoryItem}
-            onSyncInventory={handleSyncInventory}
-            activeLive={activeLive}
-          />
-        )}
-
         {activeTab === 'messenger_adjustments' && (
           <MessengerAdjustmentManager
             amendments={amendments}
@@ -1356,9 +1329,6 @@ export default function App({ authEnabled = false, portalUser = null, signOut }:
           />
         )}
 
-        {activeTab === 'pola_ai' && (
-          <PolaAICopilot summary={summary} />
-        )}
         </ErrorBoundary>
       </main>
 
@@ -1372,12 +1342,6 @@ export default function App({ authEnabled = false, portalUser = null, signOut }:
         onApplyOverride={handleApplyOverride}
       />
 
-      {/* Executive Gap Analysis Modal */}
-      <StrategicAnalysisModal
-        isOpen={showAnalysisModal}
-        onClose={() => setShowAnalysisModal(false)}
-      />
-
       {/* Mobile Phone App Access & Multi-Login QR Code Modal */}
       <MobileAccessQRModal
         isOpen={isMobileAccessModalOpen}
diff --git a/src/components/AutoReconciliationSummary.tsx b/src/components/AutoReconciliationSummary.tsx
index 5ef0b6a..7356765 100644
--- a/src/components/AutoReconciliationSummary.tsx
+++ b/src/components/AutoReconciliationSummary.tsx
@@ -691,7 +691,7 @@ PAYMENT OPTIONS:
               <ShoppingBag className="w-8 h-8 text-neutral-600 mx-auto" />
               <p className="text-sm font-semibold text-neutral-300">No Approved Buyer Invoices Yet</p>
               <p className="text-xs text-neutral-500 max-w-md mx-auto">
-                Customer claims are currently in <strong>Order Review & Verification</strong>. Verify prices and codes, then click <strong>Approve</strong> to release approved items into final customer invoice bags here.
+                Customer claims are currently in <strong>Orders</strong>. Verify prices and codes, then click <strong>Approve</strong> to release approved items into final customer invoice bags here.
               </p>
             </div>
           ) : (
diff --git a/src/components/Header.tsx b/src/components/Header.tsx
index 6bb9db1..231f582 100644
--- a/src/components/Header.tsx
+++ b/src/components/Header.tsx
@@ -6,8 +6,6 @@ import {
   Coins, 
   FileCheck, 
   ShieldCheck, 
-  Sparkles,
-  HelpCircle,
   ShoppingBag,
   Wallet,
   Activity,
@@ -24,7 +22,6 @@ interface HeaderProps {
   activeLive: LiveSession;
   summary: ReconciliationSummary | null;
   phpRate: number;
-  onOpenAnalysis: () => void;
   onOpenMobileAccessModal?: () => void;
   onOpenMetaTokenModal?: () => void;
   preOrdersCount?: number;
@@ -50,7 +47,6 @@ export const Header: React.FC<HeaderProps> = ({
   activeLive,
   summary,
   phpRate,
-  onOpenAnalysis,
   onOpenMobileAccessModal,
   onOpenMetaTokenModal,
   preOrdersCount = 0,
@@ -66,15 +62,13 @@ export const Header: React.FC<HeaderProps> = ({
   const readyToLeave = summary?.checklist.readyToLeaveStore;
 
   const navItems = [
-    { id: 'live_command', label: 'Live Session Command', icon: Radio, badge: isOnAir ? 'ON AIR' : 'READY' },
-    { id: 'messenger_adjustments', label: 'Page Messenger Orders', icon: ShieldCheck, badge: 'Direct DMs' },
-    { id: 'order_review', label: 'Order Review & Verification', icon: CheckCircle2, badge: activeLive.reconciliationStatus === 'awaiting_owner_review' ? 'Awaiting Review' : 'Verified Orders' },
-    { id: 'reconciliation', label: 'Reconciliation & Invoices', icon: FileCheck, badge: summary ? `${summary.buyerBags.length} Bags` : undefined },
-    { id: 'payments', label: 'Payments & Shipping', icon: Wallet, badge: `${awaitingPaymentCount} to pay` },
-    { id: 'pre_orders', label: 'Pre-Orders Lane', icon: ShoppingBag, badge: `${preOrdersCount} Pre-orders` },
-    { id: 'replay_studio', label: 'Replay Review Studio', icon: CheckCircle2 },
-    { id: 'buying_analytics', label: 'Sales & Demand Analytics', icon: Sparkles },
-    { id: 'pola_ai', label: 'Pola AI Co-Pilot', icon: Sparkles, badge: 'Gemini' },
+    { id: 'live_command', label: 'Live', icon: Radio, badge: isOnAir ? 'ON AIR' : 'READY' },
+    { id: 'replay_studio', label: 'Replay', icon: CheckCircle2 },
+    { id: 'order_review', label: 'Orders', icon: CheckCircle2, badge: activeLive.reconciliationStatus === 'awaiting_owner_review' ? 'To review' : undefined },
+    { id: 'pre_orders', label: 'Pre-orders', icon: ShoppingBag, badge: preOrdersCount ? `${preOrdersCount}` : undefined },
+    { id: 'reconciliation', label: 'Invoices', icon: FileCheck, badge: summary?.buyerBags.length ? `${summary.buyerBags.length}` : undefined },
+    { id: 'payments', label: 'Payments & Shipping', icon: Wallet, badge: awaitingPaymentCount ? `${awaitingPaymentCount} to pay` : undefined },
+    { id: 'messenger_adjustments', label: 'Messages', icon: ShieldCheck },
   ];
 
   return (
@@ -192,14 +186,6 @@ export const Header: React.FC<HeaderProps> = ({
             </button>
           )}
 
-          {/* Executive Gap Analysis Button */}
-          <button
-            onClick={onOpenAnalysis}
-            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-xs font-medium text-neutral-200 border border-neutral-700 transition"
-          >
-            <HelpCircle className="w-3.5 h-3.5 text-rose-400" />
-            <span>Gap Analysis & Checklists</span>
-          </button>
         </div>
       </div>
 
diff --git a/src/components/MessengerAdjustmentManager.tsx b/src/components/MessengerAdjustmentManager.tsx
index 83cb93d..0c1cd60 100644
--- a/src/components/MessengerAdjustmentManager.tsx
+++ b/src/components/MessengerAdjustmentManager.tsx
@@ -126,7 +126,7 @@ export const MessengerAdjustmentManager: React.FC<MessengerAdjustmentManagerProp
       if (onReplyMessenger) {
         await onReplyMessenger(
           thread.id,
-          `Hi Sis ${thread.buyerName}! Confirmed & routed your ${intent.suggestedSpec.itemCode} (${intent.suggestedSpec.size} ${intent.suggestedSpec.colour}) to our Dedicated Pre-Orders Lane so it stays separate from today's live rack.`
+          `Hi Sis ${thread.buyerName}! Noted po your ${intent.suggestedSpec.itemCode} (${intent.suggestedSpec.size} ${intent.suggestedSpec.colour}) as a pre-order po. Salamat sis! 💕`
         );
       }
       return;
@@ -402,7 +402,7 @@ export const MessengerAdjustmentManager: React.FC<MessengerAdjustmentManagerProp
                       <Zap className="w-3.5 h-3.5" />
                       <span>
                         {activeThread.detectedIntent.type === 'pre_order'
-                          ? 'Route to Pre-Orders Lane'
+                          ? 'Move to Pre-orders'
                           : activeThread.detectedIntent.type === 'invoice_inquiry'
                           ? 'Draft Reconciled Invoice Reply'
                           : '1-Click Apply Spec Swap & Reply'}
@@ -519,7 +519,7 @@ export const MessengerAdjustmentManager: React.FC<MessengerAdjustmentManagerProp
               <MessageSquare className="w-8 h-8 text-neutral-700 mb-2" />
               <p className="font-semibold text-neutral-300">Business Messenger Inbox Ready</p>
               <p className="mt-1 max-w-md">
-                Connect your Facebook Page Access Token in <strong>Live Session Command</strong> to pull real buyer messages from this morning&apos;s live broadcast, or incoming messages will appear automatically via <code className="text-neutral-400">/api/meta/webhook</code>.
+                Connect your Facebook Page Access Token in <strong>Live</strong> to pull real buyer messages from this morning&apos;s live broadcast, or incoming messages will appear automatically via <code className="text-neutral-400">/api/meta/webhook</code>.
               </p>
             </div>
           )}
diff --git a/src/components/OwnerOverrideModal.tsx b/src/components/OwnerOverrideModal.tsx
index 0932f12..125b733 100644
--- a/src/components/OwnerOverrideModal.tsx
+++ b/src/components/OwnerOverrideModal.tsx
@@ -41,7 +41,6 @@ export const OwnerOverrideModal: React.FC<OwnerOverrideModalProps> = ({
 
   const [activeTab, setActiveTab] = useState<'override' | 'history'>('override');
   const [authorName, setAuthorName] = useState('Pola (Shop Owner)');
-  const [overrideReason, setOverrideReason] = useState('');
   const [selectedRole, setSelectedRole] = useState<'owner' | 'admin'>('owner');
 
   // Override fields initialized from order
@@ -61,10 +60,6 @@ export const OwnerOverrideModal: React.FC<OwnerOverrideModalProps> = ({
 
   const handleSubmit = async (e: React.FormEvent) => {
     e.preventDefault();
-    if (!overrideReason.trim()) {
-      setErrorMessage('A mandatory override justification reason is required for audit compliance.');
-      return;
-    }
     if (userRole === 'staff' && selectedRole !== 'owner' && selectedRole !== 'admin') {
       setErrorMessage('Unauthorized: Only an Owner or Admin can execute order overrides.');
       return;
@@ -79,7 +74,7 @@ export const OwnerOverrideModal: React.FC<OwnerOverrideModalProps> = ({
         isPreOrder,
         role: selectedRole,
         author: authorName.trim() || `${selectedRole.toUpperCase()} (Authorized)`,
-        reason: overrideReason.trim(),
+        reason: '',
         overrides: {
           itemCode: itemCode.trim().toUpperCase(),
           itemName: itemName.trim().toUpperCase(),
@@ -314,25 +309,6 @@ export const OwnerOverrideModal: React.FC<OwnerOverrideModalProps> = ({
                 />
               </div>
 
-              {/* Mandatory Reason Box */}
-              <div className="bg-rose-950/20 border border-rose-500/30 rounded-xl p-3.5 space-y-2">
-                <div className="flex items-center justify-between">
-                  <label className="font-semibold text-rose-300 flex items-center gap-1.5 text-[11px]">
-                    <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
-                    Mandatory Audit Override Reason *
-                  </label>
-                  <span className="text-[10px] text-neutral-400">Strictly recorded in immutable audit log</span>
-                </div>
-                <textarea
-                  rows={2}
-                  value={overrideReason}
-                  onChange={(e) => setOverrideReason(e.target.value)}
-                  placeholder="Explain why this live order or pre-order is being overridden (e.g. VIP client requested size adjustment, extra stock discovered on wholesale rack, price exception authorized by owner)..."
-                  className="w-full bg-neutral-900 border border-neutral-700 rounded-lg p-2.5 text-white placeholder-neutral-500 focus:outline-none focus:border-rose-500 text-xs"
-                  required
-                />
-              </div>
-
               {/* Action Buttons */}
               <div className="pt-2 flex items-center justify-end gap-3">
                 <button
@@ -344,7 +320,7 @@ export const OwnerOverrideModal: React.FC<OwnerOverrideModalProps> = ({
                 </button>
                 <button
                   type="submit"
-                  disabled={isSubmitting || !overrideReason.trim()}
+                  disabled={isSubmitting}
                   className="px-5 py-2 bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white rounded-xl font-bold shadow-lg shadow-rose-950/40 disabled:opacity-50 transition flex items-center gap-2"
                 >
                   <ShieldAlert className="w-4 h-4" />
@@ -380,12 +356,12 @@ export const OwnerOverrideModal: React.FC<OwnerOverrideModalProps> = ({
                         </span>
                       </div>
 
-                      <div className="bg-neutral-900/60 p-2.5 rounded-lg border border-neutral-800/80">
-                        <span className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider block mb-1">
-                          Justification Reason:
-                        </span>
-                        <p className="text-neutral-200 italic">{item.reason}</p>
-                      </div>
+                      {item.reason && (
+                        <div className="bg-neutral-900/60 p-2.5 rounded-lg border border-neutral-800/80">
+                          <span className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider block mb-1">Note</span>
+                          <p className="text-neutral-200 italic">{item.reason}</p>
+                        </div>
+                      )}
 
                       {/* Before / After Diff */}
                       <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
diff --git a/src/components/PreOrdersLane.tsx b/src/components/PreOrdersLane.tsx
index f8244ae..3691d6a 100644
--- a/src/components/PreOrdersLane.tsx
+++ b/src/components/PreOrdersLane.tsx
@@ -161,7 +161,7 @@ export const PreOrdersLane: React.FC<PreOrdersLaneProps> = ({
               <div>
                 <div className="flex items-center gap-2">
                   <h2 className="text-lg font-bold text-white tracking-tight">
-                    Dedicated Pre-Orders Lane
+                    Pre-orders
                   </h2>
                   <span className="text-xs px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-semibold border border-purple-500/30">
                     Isolated Lane
diff --git a/src/components/ReadyForNextLive.tsx b/src/components/ReadyForNextLive.tsx
index 77e5399..b3db110 100644
--- a/src/components/ReadyForNextLive.tsx
+++ b/src/components/ReadyForNextLive.tsx
@@ -110,13 +110,13 @@ export const ReadyForNextLive: React.FC<ReadyForNextLiveProps> = ({
             <div className="p-2.5 rounded-xl bg-neutral-950 border border-neutral-800"><b className="block text-lg text-sky-300">{invoiced}</b>invoiced</div>
             <div className="p-2.5 rounded-xl bg-neutral-950 border border-neutral-800"><b className="block text-lg text-rose-300">{unpaid}</b>waiting for payment</div>
           </div>
-          <p className="text-[11px] text-neutral-500">Invoice and collect payment within 24 hours of the live.</p>
+          <p className="text-[11px] text-neutral-500">Buyers have 24 hours to pay from the moment their invoice is sent.</p>
           <div className="flex flex-wrap gap-2 text-xs">
             <button type="button" onClick={onOpenReview} className="px-3 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-white font-semibold flex items-center gap-1.5">
               <ClipboardCheck className="w-4 h-4" /> Review orders
             </button>
             <button type="button" onClick={onOpenReconciliation} className="px-3 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-white font-semibold flex items-center gap-1.5">
-              <FileCheck className="w-4 h-4" /> Reconcile &amp; invoice
+              <FileCheck className="w-4 h-4" /> Invoices
             </button>
             <button type="button" onClick={onOpenPayments} className="px-3 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-white font-semibold flex items-center gap-1.5">
               <Wallet className="w-4 h-4" /> Payments &amp; shipping
diff --git a/tests/serverFlow.test.ts b/tests/serverFlow.test.ts
index 4aec19e..536ebf5 100644
--- a/tests/serverFlow.test.ts
+++ b/tests/serverFlow.test.ts
@@ -239,6 +239,8 @@ test('owner creates admin and co-owner links; admins cannot create links or see
   assert.equal((await call(A, '/api/auth/invite', { token: coLogin.data.token, body: { staffId: 'admin3' } })).status, 200, 'the co-owner can create admin links');
   const override = await call(B, '/api/owner/order-override', { token: adminToken, body: { orderId: 'ord_live_2', role: 'staff', reason: 'size fix', overrides: { size: '3XL' } } });
   assert.equal(override.status, 200, 'the role comes from the sign-in, not from the request body');
+  const noReason = await call(B, '/api/owner/order-override', { token: ownerToken, body: { orderId: 'ord_live_2', overrides: { size: '4XL' } } });
+  assert.equal(noReason.status, 200, 'the owner overrides without giving a reason');
 });
 
 test('reset is disabled once data lives in the database', async () => {
```
