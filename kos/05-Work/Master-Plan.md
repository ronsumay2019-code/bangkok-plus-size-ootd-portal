# Master Plan: production-ready by Mon 26 Oct 2026, 4:00 PM Manila

Author: Claude (lead). Status: **G1 draft, waiting on Grok's independent review (G3) and the owner's answers to the Live Selling Business questions.**
Built on: [[Live-Selling-Business]] (HARD RULE), [[Current-State]], [[Known-Issues]], [[Lessons]].

## 1. What "done" means

Production goes live **empty (0 data)**. The owner can then run one real live from start to finish in the portal:

1. **Item Events** are captured from the host.
2. **Job 1** finds 1st captures inside each event window.
3. **Job 2** reviews each capture against the whole chat and Messenger, and people decide every change.
4. The orders are final.
5. The owner approves.
6. One invoice per buyer is copied or sent in Messenger and marked sent, which starts the buyer's 24h.
7. The payment proof is recorded.
8. Paid orders go to Shipping; unpaid orders go to Payments.

GO requires:
- the acceptance suite passes ≥95% overall and 100% of its critical scenarios;
- the golden tests pass;
- the owner says GO.

## 2. The design of the core (W2), from the Live Selling Business

| Piece | What it is | Business rule |
|---|---|---|
| **ItemEvent** | `{live, seq, code, price, description, colours[], sizes[], calledAt, source: staff \| replay, note}` | B3 |
| **Event capture panel** (live screen) | One tap, "Host called an item", stamps the time. Staff then type the code, price, colours and sizes. Details can be edited until the next event, because hosts say them before or after the code. Nothing else happens on this screen. | B3, B4 |
| **Raw chat store** | **Every** comment on the live video is saved: id, time, buyer name or id, text. Job 2 needs the whole chat; today only order-like comments are kept. | B7 |
| **Job 1** (pure function) | `windowOf(comment.time)` gives event N. A match is any of MINE+code, MINE only, code only, or code+size/colour, loosely matched. A buyer's first match is their **1st capture**. | B5, B6 |
| **Job 2** (review queue) | For each 1st capture, list every later mention by that buyer in the chat and in Messenger. Each mention gets a type (replacement / additional / swap / chatter). An agent may *propose* the type; **a person sets the type and granted / denied**. The final order count follows the outcomes table. | B7 |
| **Golden test** | Real comments plus the real Item Events of one past live go through Job 1. The owner-approved Job 2 decisions are applied. The result must equal the **owner-confirmed final order list**. Expected values are never typed into code (L-008). | — |
| **Rack-based engine and Inventory board** | Taken off the critical path (Business B1). Whether the store-purchase check stays depends on owner answer Q8. | B1, B2 |

**Proposal for Business Q1, waiting for the owner:**
- During the live, staff capture the events (the panel above). This is the only source that exists in real time.
- After the live, the replay is the check. Replay transcription is a paid service, so it needs the owner's approval of the cost, and it is **not** on the Monday critical path.

## 3. Tickets on the critical path (each 15 min or less; split further at G1)

| Ticket | Work | Builder | Review | Needs |
|---|---|---|---|---|
| T-001 | Owner answers Business Q1–Q9 | Owner | — | **Blocks T-010 to T-016** |
| T-002 | **Golden fixture.** Record the Item Events of one past live from its replay (NEW SHOP 22 Oct, video `1126219396590785`, or LINEN SHOP) and get the owner-confirmed final order list | Owner or staff, with Claude preparing the sheet | Claude | **Owner time on Sunday morning** |
| T-003 | **W7 infrastructure:** CI on PRs (`typecheck`, `test`, `build`, `kos-check`), branch protection on `main`, the Timeline Action | Codex | Grok, Claude | Owner allows branch protection on GitHub |
| T-004 | **W7:** a Supabase branch (or schema copy) holding the backup data, for the preview | Codex | Claude | Owner approves the branch's cost, if any |
| T-005 | **W5 security:** RLS lockdown (remove `temp_dev_all`; service role only); move the Page token out of `portal_kv` into env only | Codex | Grok, Claude | **Owner approves the migration** |
| T-010 | **W1:** save the raw chat for every comment (no filtering at save time); reset seen-IDs together with the data | Antigravity | Grok, Claude | — |
| T-011 | **W2:** ItemEvent model, API and capture panel | Antigravity | Grok, Claude | T-001 (Q1, Q2, Q6) |
| T-012 | **W2:** Job 1 as a pure function, with unit tests built from real comment text | Codex | Grok, Claude | T-001 (Q2, Q3) |
| T-013 | **W2:** Job 2 review queue and decision recording (types, granted / denied, Messenger mentions) | Antigravity | Grok, Claude | T-001 (Q4, Q7, Q9) |
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

## 4. Schedule (Manila time)

| By | Done |
|---|---|
| Sat 11 PM | This plan reviewed by Grok; the owner has the Live Selling Business questions |
| Sun 12 PM | T-001, T-002, T-003, T-004, T-020 |
| Sun 10 PM | T-005, T-010 to T-015 through G4 |
| Mon 10 AM | Code freeze; T-016; full acceptance run on the preview (G5) |
| Mon 2 PM | Final run; go/no-go report |
| **Mon 4 PM** | **Owner GO, then T-030** |

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
| Staff miss an event call during a live | Medium | Wrong windows | Events stay editable; the replay check after the live; an "unassigned comments" list |
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
