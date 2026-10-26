# Current State: truth audit

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
