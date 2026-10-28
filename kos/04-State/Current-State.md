# Current State: what works, what is only built, what failed

**This page is the answer.** Any question about the portal ("does the live start by itself?", "can we invoice from it?") is answered from this page, not from memory. If reality ever contradicts a line here, that line is wrong: change it to **Failed** with the evidence, the same day, and fix the system (owner, 26 Oct: "that's going to be your own self-check, your own self-correct logic").

Statuses (only these four):
- **Working**: proven at a real live or real use, with evidence checked against the source.
- **Built**: code exists and its automatic tests pass; **not yet proven** at a real live. Never called working.
- **Failed**: a real live or real use showed it does not work. Evidence linked.
- **Not built**.

Where it runs: **production** (`main`, last merge `22581a1`, PR #6) or **work branch** only (`claude/clever-noether-tta7o2`).

Updated: Tue 27 Oct 2026, ~00:30 Manila, by Claude.

## Facebook Live Selling: from the host's call to the shipped order

| # | Step | Status | Runs where | Evidence |
|---|---|---|---|---|
| 1 | Facebook sends each live comment to the portal, with the buyer's name | **Failed** (28 Oct) | production | 26 Oct live: comment notices 18:45–21:11 Manila, names included (notice log query 10:51Z, 11:24Z) **28 Oct live: Facebook's notices arrived but every one failed: the database was exhausted (KI-018); nothing was saved from ~16:00 Manila.** |
| 2 | Facebook sends each Messenger message to the portal | **Working** | production | 2,779 messages / 479 conversations saved, newest seconds old (query 11:01Z, 26 Oct) |
| 3 | Facebook's "live started / ended" notice reaches the portal | **Failed** | production | Page set to send `live_videos` at 11:30 (owner screenshot); at the 26 Oct live none arrived (KI-015) |
| 4 | Live session turns on and off by itself, no screen and no person | **Built** | **production since 27 Oct 17:23 Manila** (PR #11, `main` f7ababf; **deploy confirmed 17:25**: `raw_comments` writes resumed). **Automatic end seen in production 27 Oct**: 17:23:56 ended `live_2026_10_27` and 17:24:13 ended the open 26 Oct session ("Facebook reports the video VOD"); owner to confirm the broadcast had ended. **Resolved 27 Oct (owner): the end was correct**: the broadcast had ended hours earlier; the comments arriving 17:25–19:01 Manila were written 14:45–16:10 Manila (the real live) and delivered late by Facebook. 99 kept (1 by the Page), 54 orders, 40 commenters; Facebook shows 138 (owner), gap 39 unexplained. The hand-added session's start (16:58) is wrong; the live began by ~14:45 Automatic start not yet seen (tonight's session was added by hand) | Regression test "26 Oct lesson…" passes; fails on the old code (`7c1a0c9`). **Failed in production 26 Oct**: Claude had to add the session by hand at 19:24 with the owner's OK. **Failed again in production 27 Oct**: the fix was never merged to `main`; from ~16:58 Manila every comment on post …1112620411686989 got "Comment outside a live, not captured" (notice log); Claude added `live_2026_10_27` by hand at 17:14. Owner GO 27 Oct: merge right after the live |
| 5 | Portal page opens for staff | **Failed** | production + preview | 26 Oct ~19:00–19:20: page kept loading on main and preview; database answered normally; cause unknown (no Vercel log access) (KI-014) |
| 6 | Every comment kept exactly as written | **Built** | production since 27 Oct (PR #11) | Tests (`raw_comments`, unlinked comments kept, names never blanked). Production does **not** keep them: `raw_comments` last write 04:46Z 26 Oct |
| 7 | Comments turned into pending lines (buyer-first, old method) | **Built, not trusted** | production | 26 Oct: 113 lines / 29 buyers written by the portal's capture (`ord_wh_` ids). **Not verified against Facebook** (OL-59). Follows the buyers, not the host, so it is not the approved method |
| 8 | Host's words kept during the live (Facebook captions) | **Built** | work branch | Tests pass; never ran at a live (not in production). Facebook keeps only ~1 minute of captions after the live (LINEN SHOP: 17 lines) |
| 9 | Replay transcribed after the live (Groq) | **Built** | GitHub Action | Never completed on a real replay. Since 27 Oct needs only the video id + the `META_PAGE_ACCESS_TOKEN` secret (not yet added). Free plan: ≥2.5 h for a 5 h replay |
| 10 | Host's item calls (code, price, size, colour) taken from the host's words | **Not built** | — | No extractor yet: Job 1 needs these as input |
| 11 | Orders found inside each host item call (Job 1) | **Built** | work branch | Unit tests incl. 6 R-003 regressions; never run on real host calls (step 10 missing) |
| 12 | Review across the whole chat and Messenger (Job 2) | **Not built** | — | — |
| 13 | Portal checks its own orders against Facebook's comments | **Built** | production since 27 Oct (PR #11) | Test passes (`faf9c9d`): lists "mine" comments with no order; order lines with no Facebook comment must be 0. Never run on a real live. **27 Oct 19:20 Manila, PR #12 (`main` 02eb6fd): runs by itself after every live** (once, within 24 h of the end): reads Facebook's full comment list, keeps missing comments, captures missing orders, moves the start to the first comment, saves the report. Test "27 Oct lesson" fails on PR #11's code, passes now (67/67). **Ran by itself in production 27 Oct 19:21 Manila** (no button): 27 Oct live: Facebook lists 128 comments, portal now keeps 137 (owner sees 138 on Facebook), +22 orders (76 total), 0 "mine" comments without an order, 1 order line not on Facebook, start moved to 14:44. 26 Oct live: 229 comments, +12 orders, 1 "mine" without an order, **19 order lines not on Facebook** (see OL-59), start moved to 18:43 |
| 14 | Invoice picture in the shop's template | **Built** | work branch | Unit tests (Codex, PR #10); never used for a real invoice |
| 15 | Invoice sent in Messenger, 24 hours from mark-sent, payments with proof | **Built** | production | Tests; a Messenger reply from the portal was verified 24 Oct; a real invoice end to end: not yet |
| 16 | Messenger sends only within Meta's 24-hour window | **Built** | production since 27 Oct (PR #11) | Unit test; not yet seen on a real send |
| 17 | Shipping | **Not built** in this build | — | — |

## Platform

| What | Status | Evidence |
|---|---|---|
| Anonymous database access removed | **Working** | `pg_policies` empty; server requests 200/201 (26 Oct ~10:05) |
| Page key copy in the database (KI-005) | **Open** | Portal reads the Vercel copy ("vercel settings", 26 Oct 12:29); delete needs owner OK (OL-47) |
| Webhook signature check (`META_APP_SECRET`) | **Not set** | KI-008 |
| Supabase free-plan limits | **Exhausted 28 Oct** (KI-018): database too slow to answer from ~16:00 Manila; restriction from 24 Nov if it stays over | Supabase logs 28 Oct; owner screenshot 26 Oct (KI-016) |
| Claude's access to Vercel logs and deployments | **Refused (403)** | 26 Oct (OL-61) |

## History: truth audit of 24 Oct

As of Sun 25 Oct 2026, about 04:20 Manila (24 Oct, about 20:20 UTC). Corrected: an earlier draft said "22:xx". Every line is either **Verified**, with its evidence, or **Not verified**. Claims don't count.

## Production database (Supabase `bpso-live-portal`, ref `muqgabsvghhytwawipex`)

Evidence: SQL row counts run by Claude on 24 Oct.

| What | Count | Status |
|---|---|---|
| Lives | 2. "LINEN SHOP😍" (FB video `3310662652470857`; the portal record runs from 05:35Z to 13:34Z, but **13:34Z is when Start fresh closed it, not when the broadcast ended**. The real broadcast length is unknown and T-031 measures it) and an empty "Live · 2026-10-24" (13:43Z, 7 seconds long) | Verified |
| Orders | **1** (LINEN SHOP orders were not captured) | Verified |
| Messenger threads / messages | 182 / 1,365 | Verified |
| Backup `portal_backup.records_20261024_before_reset` | orders 1,352 · lives 2 (NEW SHOP 22 Oct, video `1126219396590785`; NEW SHOP 24 Oct) · inventory 11 · threads 134 · messages 830 | Verified |
| `portal_kv.metaCredentials` | Holds the keys `token` and `pageId`. **The Facebook Page token is stored in the database.** The value was not read. | Verified (keys only) |
| Row-level security | `temp_dev_all` policy, role `anon`, ALL commands, on `portal_kv`, `portal_records`, `portal_sessions` and `portal_staff` | Verified |
| The server uses the service-role key; the anon key is not in the client code | `grep` of `server/`, `src/` and `dist/` | Verified |

## Portal behaviour

| What | Status | Evidence |
|---|---|---|
| Messenger reply sent from inside the portal | Verified 24 Oct | Facebook returned message IDs; the recipient confirmed |
| Staff sign-in and seats (owner, co-owner, 3 admins) | Verified 24 Oct | Owner signed in on production |
| Saving to the database after the null-kv fix (PR #6) | Verified in tests (38 pass) | Not re-verified on production since |
| **Item Event capture from the host** (Business B3) | **Does not exist.** The controller from `283fd52` was removed in `6857377`. It used fixed segments (`HOST_BROADCAST_SEGMENTS`), not live input. | git history |
| Order windows and Job 1 / Job 2 (Business B5–B7) | **Do not exist.** `server/orderIntent.ts` reads each comment alone, with no window and no event. | Code |
| Reconciliation engine | **Built on a rack** (`InventoryItem` rows, 25 uses in `src/services/reconciliationEngine.ts`). Conflicts with Business B1. | Code |
| "152 = 152" on 22 Oct | **Not proven to be computed.** `271b9f2` sets `totalMined: 152` and edits `purchased` by hand, with orders loaded from `src/data/liveOrdersSnapshot.json`. | git show |
| Commenter names from Facebook | Hidden in Graph reads until Meta App Review; the webhook gives names | Observed 24 Oct |
| `META_APP_SECRET` (webhook signature check) | Not set when last checked on 24 Oct | Not re-checked |
| Latest production deployment | **Not checked.** Vercel refused the listing (403 forbidden). | Tool error 24 Oct |

## Facebook transcript (T-031 step 1, verified 26 Oct)
- **LINEN SHOP video `3310662652470857`: Facebook gives the portal an auto-generated caption file** (`.srt`, locale en_US, `is_auto_generated: true`). Read through the Graph API `/{video}/captions` with the Page token. Evidence: the owner ran the Facebook transcript check on the preview, 26 Oct 01:17Z.
- **Video length: 18,218.9 seconds (5 h 3 min 39 s).** Status VOD. Created 2026-10-24 05:35:46Z.
- The file is on Facebook's CDN. Claude's sandbox can't reach that host, so the portal fetches it server-side ("Fetch & keep transcript") and stores it as collection `transcripts`, which Claude then reads from the database.
- **First fetch (26 Oct 01:27Z): 17 caption lines, covering only 0:02 to 1:00 of a 5 h 3 min video.** The text is good Taglish with prices, colours and buyer names, e.g. "sky for three thousand ninety pesos", "Ah green lang po", "Yeah cream". It isn't yet known whether Facebook's file stops at 1 minute or the reading stops early. The fetch now records the file's size, its number of time lines and its ending, to tell the two apart.

## Issues #7, #8, #9 · builder evidence (26 Oct UTC)

- T-012: pure host-event segments and Job 1 implemented; tests in `tests/liveEngine.test.ts`. No routes/UI wired. Messages must be scoped to the live by the caller (job1 has no live-end parameter).
- T-037: shop invoice canvas renderer ported with pure grouping/pagination tests and SAMPLE artwork. No generator UI or sending changes.
- T-003b: `kos-check` workflow added and validated with disposable git histories; hosted Actions execution not yet verified. Existing CI unchanged.
- Local `npm test`: 53 Node tests passed, 0 failed, plus the reconciliation integration suite passed. `npm run build`: passed. Lint baseline: 23 existing diagnostics; no new diagnostics. These are local implementation checks, not production verification.
- Status: in review; Grok review and Claude evaluator verdict pending. No deployment or production data changes.

## PR #10 · R-003 fixes ready for re-check

All six requested review fixes implemented on the existing PR. Local `npm test`:
60 Node tests passed, 0 failed, plus all 3 existing reconciliation integration
scenarios passed. `npm run build` passed; lint retains the same 23 diagnostics
as the original baseline (captured outputs identical). All six numbered review
regressions fail against 01beb80 and pass after fixes; re-called host metadata
passes both. KOS handoffs, lessons and issue notes updated. PR still targets
`claude/clever-noether-tta7o2`; owner/Claude re-check required before merge.
