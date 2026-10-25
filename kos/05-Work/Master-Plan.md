# Master Plan: production-ready by Mon 26 Oct 2026, 4:00 PM Manila

Author: Claude (lead). Status: **G1 draft, waiting on Grok's independent review (G3) and the owner's answers to the Live Selling Business questions.**
Built on: [[Live-Selling-Business]] (HARD RULE), [[Current-State]], [[Known-Issues]], [[Lessons]].

## 1. What "done" means (v3, 25 Oct: follow the host)

Production goes live **empty (0 data)**. After a real live, the portal produces the final orders the way the owner's strategy says ([[Live-Selling-Business]] §4):

1. **Host events first:** each item code with its price, size and colour, and its time.
2. **Then, inside each event:** the orders from the live chat and Messenger.
3. **Then the review:** every mention counted and typed, and the latest granted change is final.
4. **The item story keeps everything.** Nothing is deleted.
5. A person reviews.
6. The owner approves one invoice per buyer for the live.
7. The invoice is sent or copied in Messenger and marked sent, which starts the buyer's 24h.
8. The payment proof is recorded.
9. Paid orders go to Shipping; unpaid orders go to Payments.

The team keeps its paper list during the first lives, so both results can be compared.

GO requires:
- the acceptance suite passes ≥95% overall and 100% of its critical scenarios;
- the golden test passes;
- the owner says GO.

## 2. The design of the core (W2), v3

| Step | What it does | Rule |
|---|---|---|
| **1. Host Event capture** | ItemEvent = `{live, seq, code, price, sizes[], colours[], description?, available?, calledAt, source: replay \| admin, evidence}`. **This is the first and only source of codes and prices.** **Automatic, from the live's video and audio (B17).** No admin entry. Feasibility is being tested in T-031. | S1, B3, L-009 |
| **2. Raw capture** | Every live comment, and every Messenger message during the live, is saved raw (id, time, name, text). Nothing is filtered when it is saved. | B7 |
| **3. Segments** | Event N = [calledAt N, calledAt N+1). The last segment runs to the end of the live. **A search filter for where an order was placed, not a limit:** later changes in any event or in Messenger still count. | S2, S6 |
| **4. Job 1, per segment** | Find the orders placed in the segment's chat and Messenger: MINE+code, code only, code+size/colour, against **codes from host events only**. MINE with no code is matched by its clarifying reply (B6). "+1", "one more" or a number means extra pieces. A repeated "mine" stays 1 order. | S3, B6, B9 |
| **5. Job 2: one reconciliation agent after the live** | **Pass 1:** an order placed once, with no requests, no other conversation and no Messenger side chat, is **confirmed**. **Pass 2:** an order mentioned again, in any later event or in Messenger: follow the thread to the end and type it as a change request (item/size/colour), extra piece, swap, question, or denied (out of stock only). An acknowledged and approved change is the final order; the previous one is dropped and kept in the story. Anything the agent can't decide is shown at invoice time, marked unclear, and never guessed (B18). | S4, S6, S7, B7, B18 |
| **6. Item story** | For each code: every capture, change and denial, with its comment or message link and time. The final order points back into its story. | S4 |
| **8. Store match** | At the end of the live: the team's total number of items is shown next to the store owner's total. If they differ, the portal lists the orders per code so the difference can be found before leaving the store. | S8 |
| **7. First miner and bag list** | When pieces run short, the earliest confirmed order keeps the piece. The bag list per buyer matches the bag labels. | B10, B14 |
| **Golden test** | A past live's replay events, comments and Messenger messages go through steps 1–7, plus the owner's decisions on anything unclear. The result must equal **the team's paper order list** for that live (from a photo), **and its total items must equal the store owner's total** for that live (owner-held). It is computed, never typed in (L-008). | — |
| **Retired** | The rack, inventory board and 90% buying-list rule (B12). The "Live Order Sheet" built from orders (L-009). | B12 |

## 3. Tickets on the critical path (each 15 min or less; split further at G1)

| Ticket | Work | Builder | Review | Needs |
|---|---|---|---|---|
| T-001 | Owner answers Business Q1–Q9 | Owner | — | **Done 25 Oct.** Three short follow-ups are in [[Live-Selling-Business]] §4 |
| T-002 | **Golden fixture:** a photo of the team's **paper order list** for one past live (LINEN SHOP 24 Oct or NEW SHOP 22 Oct), plus that live's video id. Claude fetches the comments and Messenger messages. | Owner provides the photo; Claude transcribes it, and the owner confirms the transcription | Claude | **Photo from the owner** |
| T-003 | **W7 infrastructure:** CI on PRs (`typecheck`, `test`, `build`, `kos-check`), branch protection on `main`, the Timeline Action | Codex | Grok, Claude | Owner allows branch protection on GitHub |
| T-004 | **W7:** a Supabase branch (or schema copy) holding the backup data, for the preview | Codex | Claude | Owner approves the branch's cost, if any |
| T-005 | **W5 security:** RLS lockdown (remove `temp_dev_all`; service role only); move the Page token out of `portal_kv` into env only | Codex | Grok, Claude | **Owner approves the migration** |
| T-010 | **W1:** save the raw chat for every comment (no filtering at save time); reset seen-IDs together with the data | Antigravity | Grok, Claude | — |
| T-011 | **W2:** Host Event capture, automatic: data model, plus extracting code, price, sizes and colours from the transcript, with the evidence time for each | Antigravity | Grok, Claude | T-031 result |
| T-031 | **Spike (TOP PRIORITY, critical path):** (1) can the portal fetch the LINEN SHOP replay video through the Graph API, without the token leaving the server? (2) Can a transcription service pull out the codes, prices, sizes and colours from Taglish speech with store noise? Report accuracy against the paper list and the exact cost. No spending without owner approval. | Codex (Claude evaluates) | Grok, Claude | Owner approves the test cost |
| T-012 | **W2:** Segments and Job 1 per segment as pure functions (codes from host events only; extra pieces; repeated mine), with unit tests built from real comment text | Codex | Grok, Claude | — |
| T-013 | **W2:** Job 2 per order (count mentions, type them, latest granted change is final), item story, first miner, bag list | Antigravity | Grok, Claude | — |
| T-014 | **W2:** golden test harness: fixture in, final orders out, diff against the owner's list | Codex | Claude | T-002 |
| T-015 | **W3:** invoices built from final orders; one invoice per live per buyer; owner approval; mark-sent starts the 24h; fix the wording in KI-011 | Antigravity | Grok, Claude | T-013 |
| T-016 | **W4:** payment proof, then Payments or Shipping (exists; re-test it on the new orders) | Codex | Claude | T-015 |
| T-020 | **Acceptance suite:** owner-flow scenarios with the critical ones marked, frozen by Sun 12 PM | Claude, with Grok adding attack cases | Owner reads it | — |
| T-021 | **W1:** `META_APP_SECRET` in Vercel; webhook signature check turned on | Codex | Grok | **Owner enters the secret in Vercel** |
| T-030 | Launch: backup, wipe, prove 0 rows, smoke test, release note, final Story chapters | Claude | Owner | GO |

**Cut first if a milestone slips** (not critical):
- Pola AI copilot;
- buying-behaviour dashboard;
- Messenger photo polish;
- Shipping tracking detail;
- replay transcription.

**Never cut:** any gate, W2, W5, golden tests, the 0-data launch.

## 4. Schedule (re-planned Sun 25 Oct, 04:44 Manila, after the first milestone was missed)

The owner's PC clock showed 3:34 PM on 24 Oct when it was 04:34 Sunday in Manila, so the owner's local time appears to be **13 hours behind Manila** (UTC-5). Both columns are shown. The deadline is fixed in Manila time.

| Manila | Owner's clock (UTC-5) | Done |
|---|---|---|
| ~~Sat 11 PM~~ | ~~Sat 10 AM~~ | **Missed.** G0 and the plan draft were done. The Grok review and the Q1–Q9 answers were not. |
| Sun 12 PM | Sat 11 PM | Q1–Q9 answered; Grok's plan review saved; RLS migration approved; branch protection allowed; T-003, T-004, T-020 |
| Sun 6 PM | Sun 5 AM | T-002 golden fixture (one past live: Item Events and the confirmed order list) |
| Sun 10 PM | Sun 9 AM | T-005, T-010 to T-015 through G4 |
| Mon 10 AM | Sun 9 PM | Code freeze; T-016; full acceptance run on the preview (G5) |
| Mon 2 PM | Mon 1 AM | Final run; go/no-go report |
| **Mon 4 PM** | **Mon 3 AM** | **Owner GO, then T-030** |

**Risk, stated plainly.** W2 can't start until Q1–Q9 are answered, and Antigravity, Codex and Grok can only work when the owner hands them the repo. If Q1–Q9 aren't answered by Sun 12 PM Manila, W2 isn't likely to pass G5 by Mon 10 AM, and the honest outcome would be NO-GO or a cut scope, reported at once.

## 5. What only the owner can do

- Answer Business Q1–Q9.
- Give the golden-fixture time on Sunday morning (T-002).
- Approve the RLS migration (T-005).
- Enter `META_APP_SECRET` in Vercel.
- Allow branch protection.
- Submit Meta App Review (needed for names in Graph reads; not on Monday's path, because the webhook gives names).
- Approve any paid service.
- Give GO.

## 6. Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Business answers arrive late | Medium | Blocks W2 | The questions are small and specific; Claude collects the answers Saturday night |
| No golden fixture by Sunday noon | Medium | No proof, so NO-GO | Use the shorter live; Claude prepares the sheet so staff only fill it in |
| **Automatic host capture doesn't work** (the video can't be fetched, or transcription is inaccurate on Taglish) | **Unknown until T-031** | **The core can't follow the host, so NO-GO for W2** | Run T-031 first. If it fails, report at once with the options; the owner decides (B17 says no people during the live). |
| The replay isn't ready right after the live, so the store match (S8) is late | Unknown | The store match waits | Measure the replay's ready time in T-031 |
| Comment delay puts a "mine" in the wrong window | High | Wrong item | Business Q3 grace period; Job 2 review |
| Webhook names missing for some buyers | Medium | Can't invoice | "Name needed" queue; Messenger match |
| Vercel access for agents (403 today) | Known | Can't audit deploys | Owner checks the Vercel team permissions for the connected account |

## Handoff Packet

1. **What I did:**
   - recorded the Live Selling Business;
   - ran the truth audit with real queries;
   - seeded the KOS (Current-State, Known-Issues, Lessons, Story);
   - wrote this plan.
   No portal code was changed.
2. **Why this is the real solution:**
   - The portal fails because it reads item meaning from the chat. The Live Selling Business says meaning comes from the host's Item Events. Every past attempt had either no events or fixed events, so no amount of comment parsing could ever be right.
   - The plan makes events the first-class input.
   - It keeps people deciding the Job 2 changes, because grant or deny is said on the live and isn't in the data.
   - It proves the result with a computed golden test instead of a typed number.
3. **Evidence:** the SQL counts and policies in [[Current-State]], and the commits named in [[Story]].
4. **Tests:** none yet. This is a plan.
5. **Risks:** §6. The biggest is the time needed from the owner on Sunday.
6. **Not done:**
   - no code;
   - no migration;
   - Vercel deployment audit (403).
7. **Next:** Grok, independent review of this plan (G3). The owner: Business Q1–Q9.

## Evaluator Verdict (Claude)

**Verdict: CHANGES, pending independent review.**

I wrote this plan, so my verdict is a self-check, not the independent review the loop requires. Grok reviews it next.

Self-check reasoning:
- The plan follows every Business rule (B1–B8) and puts the owner's correction (L-007) at its centre.
- It doesn't depend on Meta App Review or a paid transcription service for Monday.

Conditions before G1 passes:
- the owner's answers to Q1–Q9;
- a fixture for the golden test.
