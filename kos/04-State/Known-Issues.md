# Known issues

Severity: **C** = critical (blocks GO), **H** = high, **M** = medium.

| ID | Sev | Issue | Evidence | Fix (ticket) |
|---|---|---|---|---|
| KI-001 | C | **No Item Event capture.** Codes, prices, colours and sizes are taken from the chat instead of from the host. This breaks Business B3. | `server/orderIntent.ts`; controller removed in `6857377` | W2 |
| KI-002 | C | **No order windows and no Job 1 / Job 2.** Each comment is judged alone (Business B5–B7). | Code | W2 |
| KI-003 | C | **The reconciliation engine assumes a rack and stock inventory.** This conflicts with Business B1 and B2. | `src/services/reconciliationEngine.ts` | W2: retire it from the critical path (A8: no buying list) |
| KI-004 | C | **FIXED 26 Oct** (anonymous policies dropped; verified). **Anyone holding the anon key has full access** to `portal_staff`, `portal_sessions`, `portal_kv` and `portal_records` (the `temp_dev_all` policy). A forged session or a token read is possible. | pg_policies | W5 |
| KI-005 | C | **The Facebook Page token is stored in `portal_kv.metaCredentials`.** It should live in env vars only, and is exposed by KI-004. | portal_kv keys | W5 |
| KI-006 | H | **LINEN SHOP orders are not in the portal** (1 order). `seenCommentIds` is stale. | Row counts | W1; tests only (ships with 0 data) |
| KI-007 | H | **The "152 = 152" of 22 Oct was hand-set,** not computed. | `271b9f2` | W2 golden test |
| KI-008 | H | **`META_APP_SECRET` is not set,** so webhooks are not signature-checked. | Session 24 Oct | W1, needs owner |
| KI-009 | H | **Names in Graph reads are hidden** until Meta App Review. | Observed | Owner (Meta) |
| KI-010 | M | **The main repo docs conflict with the Live Selling Business.** `bangkokplussizeootd/CLAUDE.md` and LIVE-SELLING-ARCHITECTURE describe a rack, a run sheet, an Inventory board and the 90% purchase rule. The Live Selling Business wins. Confirmed by the owner 25 Oct (A8). | Docs | Mark the main repo docs as outdated for live selling |
| KI-011 | M | **FIXED on the branch 25 Oct.** **Wrong 24h wording on screen.** The "Ready for the next live" card says "within 24 hours of the live"; the rule is 24h from when the invoice is marked sent. | `src/components/ReadyForNextLive.tsx:113` | W3 |
| KI-012 | M | **Vercel deployment listing was refused (403)** for this session, so the production deployment can't be audited. | Tool error | W7 |
| KI-013 | M | **23 TypeScript errors exist in the code** (`npm run lint`: seed data, reconciliation engine, vite config). They were there before 25 Oct; the build and tests still pass. | `npm run lint` | W7: fix before CI makes lint required |

## PR #10 / R-003 corrections (builder status: fixed locally; re-check pending)

Mixed-text orders and pre-call signals could be dropped, stale clarification
specifications could leak across unrelated events, first quantities were labelled
extra, and shipping could not be pending. See the six numbered R-003 regression
tests and T-012/T-037 revision packets. These fixes are not production verified.

## Found at the 26 Oct live

| ID | Sev | Issue | Evidence | Fix (ticket) |
|---|---|---|---|---|
| KI-014 | C | **The portal page would not open** at the 26 Oct live, on the main address and the preview. Database requests were healthy (200s) and the data is small (~1.7 MB). Cause unknown: Claude's Vercel log access is refused (403). | Owner, 19:00–19:20; Supabase edge logs | OL-57 |
| KI-015 | H | **Facebook's "live started" notice did not arrive** at the 26 Oct live, although the Page now sends `live_videos` (set 11:30). The app-level webhook field may still be off. Automatic start is not working yet. | Notice log 10:45–11:30Z: comments, messages, reactions, photo edits only | OL-56, T-032 |
| KI-016 | H | **Supabase organisation over the free plan's limits**; restriction from 24 Nov if it stays over. **Cause confirmed 28 Oct (KI-018):** each request loaded the whole portal data. | Owner screenshot | OL-54 |
| KI-017 | M | **FIXED 27 Oct 17:23 (PR #11): `raw_comments` writes resumed 17:25 Manila.** Was: **Production still runs the older code** (`main`): comments are not kept raw, and comments before a live session starts are only in the 50-entry notice log. | `raw_comments` last write 04:46Z. **27 Oct live: every comment dropped as "outside a live" until a session was added by hand (17:14 Manila)** | GO of the work branch (given 27 Oct; merge after the live) |
| KI-018 | C | **28 Oct live: the database was exhausted, so every comment notice failed.** Every request (each comment notice, each page refresh) reloaded the whole portal data. 38,512 database calls 12:00–16:00 Manila (20,413 full reads of `portal_records`, 6,027 of `portal_kv`); from ~16:00 Manila the database answered trivial queries in 10–39 s or timed out (Supabase logs: 522 on every request, "statement timeout", autovacuum could not start). Fix built: each request reads only `__stateVersion` and reloads everything only when another server copy saved (**merged to production 28 Oct ~20:25 Manila, PR #13, `main` 868eecc**; deploy and database recovery not yet confirmed). **28 Oct 20:20 Manila: no portal requests reach the database since 19:38, yet one-line queries still time out (Postgres "statement timeout" 12:22–12:23Z): the database instance itself is starved; it needs a restart in Supabase (Settings → General → Restart project) or a paid plan. Owner decision.**. **Guard:** test "28 Oct lesson: comment notices and page refreshes do not reload the whole database each time" (fails on the old code: 5 full reloads for 5 notices). **Rule from now on:** any hand edit in the database must also change `portal_kv.__stateVersion`, or running server copies keep the old data. | Supabase edge + Postgres logs 28 Oct 04:00–12:10Z | Merge to `main`; then the end-of-live fill recovers the live's comments from Facebook once the database answers |
| KI-019 | H | **28 Oct: Claude called production "the old code" although PR #11 and PR #12 were live, and the owner had to point to the record.** Cause: the per-message record showed only the start of long rows (newest evidence is at their end) and PR #12 was never written into Releases. **Guard:** `scripts/kos-context.sh` now starts with the latest production merges on `main` and the latest record commits, newest first; Releases carries 0.3 (PR #12). **Merged 28 Oct (PR #13).** | Owner, 28 Oct | Guard in production |
