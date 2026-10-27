# R-004 · Claude's verdict on Grok's review of RP-004 (26 Oct)

**Verdict: Grok is right on 4 of 6. Fixes 1, 2, 3 and 5a are built; 4 is narrowed; 6 is rejected; 5b–5c are parked until after tonight.**
Claude built the change, so Claude does not approve its own fixes: Grok re-checks them with packet RP-004b below.

| # | Call | Reasoning, checked against the code |
|---|---|---|
| 1 | **Fix (different method)** | Real: Vercel can run two copies, and the 3-minute check lives in each copy's memory. A lock only works inside one copy, so it can't fix this. Instead **every caption read is also kept as its own record** (`caption_reads`, id `video@time`), never overwritten. The merged `transcripts` record stays for convenience; nothing read is ever lost. |
| 2 | **Fix** | Real: the webhook only kept comments it could link to a live. Every page comment is now kept, with `liveId: null` and its `postId` when it isn't linked, so a live Facebook started before the portal knew about it is still covered. The caption read runs only for linked lives. Owner question 1 is answered by the rule "keep every live comment as written" (nothing filtered at save). |
| 3 | **Fix** | Real and likely: Graph reads hide names until Meta App Review (KI-009), while webhooks carry them. Saving now reads what is kept and **only fills empty fields** (`server/fillBlanks.ts`); a kept name is never blanked. New batch read `getRecords`. |
| 4 | **Narrowed** | Page tokens are only letters and digits, so JSON never escapes them and the replace catches paging links. One line added anyway: any `access_token=` value is blanked. Not adopted: removing the caption `uri` and video `source`; they are signed Facebook file links (not the token), shown only to owner/admin, and `source` is what the replay job needs. |
| 5a | **Fix** | Real, and the numbers matter: LINEN SHOP's video is **18,219 s (5 h 4 min)** (source: `transcripts` record `videoLengthSec`). The job now saves after every 10-minute piece and prints each piece's lines to the log, so a stopped job keeps everything done. |
| 5b, 5c | **Parked until after tonight (OL-43)** | Only Claude commits the request file, and a stale link fails at download before any Groq time is spent. A `workflow_dispatch` trigger and a download cap are worth doing, but they don't affect tonight. |
| 6 | **Reject** | The ids are Facebook ids (digits, or digits_digits); video ids are checked as digits at the endpoint. No real caller sends commas or quotes. |

**Owner question for Grok's #5:** is the Groq key on the free plan or a paid plan? The free plan's limits (per Grok, not verified by Claude) would mean a 5-hour replay takes several hours. → OL-42.

**Checks after the fixes:** tests 65/65 (new: unlinked comment kept; a later read never blanks a name), build OK, lint 23 (unchanged).

## RP-004b · re-check packet for Grok

Paste to Grok: "Re-check these fixes to your RP-004 findings on branch `claude/clever-noether-tta7o2` (repo ronsumay2019-code/bangkok-plus-size-ootd-portal). For each, say FIXED or NOT FIXED with a concrete example. (1) `keepLiveCaptions` in server.ts: every read is also written to collection `caption_reads` with a unique id before the merge. (2) the webhook keeps every comment in `raw_comments`, with `liveId: null` and `postId` when unlinked. (3) `keepRawComments` reads existing records with `getRecords` and merges with `server/fillBlanks.ts` so a kept name is never blanked. (4) `/api/live/transcript-check` also blanks any `access_token=` value. (5) `scripts/replay-transcribe.mjs` saves after every piece. Rejected with reasons: #6 and part of #4; parked: 5b–5c. Verdict: APPROVE or CHANGES NEEDED."
