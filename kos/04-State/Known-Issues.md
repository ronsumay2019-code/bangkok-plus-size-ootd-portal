# Known issues

Severity: **C** = critical (blocks GO), **H** = high, **M** = medium.

| ID | Sev | Issue | Evidence | Fix (ticket) |
|---|---|---|---|---|
| KI-001 | C | **No Item Event capture.** Codes, prices, colours and sizes are taken from the chat instead of from the host. This breaks Business B3. | `server/orderIntent.ts`; controller removed in `6857377` | W2 |
| KI-002 | C | **No order windows and no Job 1 / Job 2.** Each comment is judged alone (Business B5–B7). | Code | W2 |
| KI-003 | C | **The reconciliation engine assumes a rack and stock inventory.** This conflicts with Business B1 and B2. | `src/services/reconciliationEngine.ts` | W2: retire it from the critical path (A8: no buying list) |
| KI-004 | C | **Anyone holding the anon key has full access** to `portal_staff`, `portal_sessions`, `portal_kv` and `portal_records` (the `temp_dev_all` policy). A forged session or a token read is possible. | pg_policies | W5 |
| KI-005 | C | **The Facebook Page token is stored in `portal_kv.metaCredentials`.** It should live in env vars only, and is exposed by KI-004. | portal_kv keys | W5 |
| KI-006 | H | **LINEN SHOP orders are not in the portal** (1 order). `seenCommentIds` is stale. | Row counts | W1; tests only (ships with 0 data) |
| KI-007 | H | **The "152 = 152" of 22 Oct was hand-set,** not computed. | `271b9f2` | W2 golden test |
| KI-008 | H | **`META_APP_SECRET` is not set,** so webhooks are not signature-checked. | Session 24 Oct | W1, needs owner |
| KI-009 | H | **Names in Graph reads are hidden** until Meta App Review. | Observed | Owner (Meta) |
| KI-010 | M | **The main repo docs conflict with the Live Selling Business.** `bangkokplussizeootd/CLAUDE.md` and LIVE-SELLING-ARCHITECTURE describe a rack, a run sheet, an Inventory board and the 90% purchase rule. The Live Selling Business wins. Confirmed by the owner 25 Oct (A8). | Docs | Mark the main repo docs as outdated for live selling |
| KI-011 | M | **Wrong 24h wording on screen.** The "Ready for the next live" card says "within 24 hours of the live"; the rule is 24h from when the invoice is marked sent. | `src/components/ReadyForNextLive.tsx:113` | W3 |
| KI-012 | M | **Vercel deployment listing was refused (403)** for this session, so the production deployment can't be audited. | Tool error | W7 |
