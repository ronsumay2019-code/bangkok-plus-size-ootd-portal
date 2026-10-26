# Timeline

The automatic part (merges and deploys) is added by the Timeline Action once ticket T-003 lands. Until then Claude adds the entries.

| Manila time | Event | Evidence |
|---|---|---|
| 22 Oct | Antigravity: host calling controller with fixed segments; "152 = 152" hand-set | `283fd52`, `271b9f2` |
| 24 Oct | Claude: PRs #1–#6 merged (database, Messenger send, seats, junk filter, payments, null-save fix) | GitHub PRs #1–#6 |
| 24 Oct | LINEN SHOP live; 1 order in the portal | SQL count |
| 24 Oct | Owner: production ships with 0 data; Monday 4 PM deadline | Master-plan prompt |
| 24 Oct | Owner: Live Selling Business (HARD RULE) recorded | [[Live-Selling-Business]] |
| 24 Oct | G0 truth audit; Master Plan drafted | [[Current-State]], [[Master-Plan]] |
| Sun 25 Oct, about 04:30 | Owner connected Obsidian; *Git: Pull* reported "Everything is up-to-date" | Owner screenshot |
| Sun 25 Oct, 04:44 | First milestone (Sat 11 PM) missed; schedule re-planned | [[Master-Plan]] §4, OL-17 |
| Sun 25 Oct | Owner answered Q1–Q9 by voice. No item window, Messenger orders count as live orders, out of stock is the only denial, first miner wins, no buying list. W2 redesigned as the Live Order Sheet. | [[Live-Selling-Business]] §3, [[Master-Plan]] §2 |
| Sun 25 Oct | Owner restated the strategy: **follow the host**. Claude's buyer-first redesign was corrected (L-009); W2 redesigned to v3, host events first. | [[Live-Selling-Business]] §4, [[Master-Plan]] §2 |
| Sun 25 Oct | Owner clarified: events are only a search filter for where orders were placed; changes can come in any later event or in Messenger. One reconciliation agent after the live: pass 1 confirmed orders, pass 2 followed threads. | [[Live-Selling-Business]] §4 (S6, S7) |
| Sun 25 Oct | Owner: price is always recorded with each order. The store owner counts the items during the live, and the team's total must match the store owner's total at the end. | [[Live-Selling-Business]] (B16, S8) |
| Sun 25 Oct | Owner: no people use the portal during the live; people come in only at the invoice (prepare, photo, send in Messenger). Automatic host capture becomes the critical path (T-031). | [[Live-Selling-Business]] (B17, B18) |
| Sun 25 Oct | Owner: store match is total count only. Host capture reuses the method proven in the old portal (replay download plus transcription). Replay section and an automatic Live Session section are required. | [[Live-Selling-Business]] (S8, B19–B21) |
| Sun 25 Oct | Owner: transcription accuracy isn't the bar; every confirmed order must carry evidence (timestamp, screenshot from the live, the final comment). | [[Live-Selling-Business]] (B22, B23) |
| Sun 25 Oct | Owner: the team stays 1–2 hours after the live to sort and tally, so the target is final orders within 1 hour. Buyers are linked across chat and Messenger by Facebook name, as the old portal did. | [[Live-Selling-Business]] (B24, B25) |
| Sun 25 Oct | Owner: the paper list is only the admin's scratch note, so it isn't the test truth. Proposed instead: the invoices actually sent for NEW SHOP, plus the store owner's total. | [[Live-Selling-Business]] (B26), OL-25 |
| Sun 25 Oct | Owner approved the evidence card, the review pages and the all-in-one invoice generator (no edit-reason field). Invoice goes as a picture in the shop's template with the bag photo; evidence stays internal. Trial weeks run alongside the usual way, with match reports. | [[Screens]], [[Live-Selling-Business]] (B27–B30) |
| Sun 25 Oct | Owner decided the tabs: Live, Replay, Orders, Pre-orders, Invoices, Payments & Shipping, Messages. Analytics, Pola AI, Strategic analysis and the rack board removed. Owner override kept as a tick box with no reason. Live and pre-order invoices add up. | [[Screens]], B31–B32 |
| Sun 25 Oct | T-039 built on the branch: 7 tabs (Live, Replay, Orders, Pre-orders, Invoices, Payments & Shipping, Messages); Analytics, Pola AI, Gap Analysis and the rack board removed; owner override needs no reason (test added, and it fails without the fix); 24h wording fixed (KI-011). Tests 38/38; build OK; type errors unchanged (23 before and after). Not deployed. | branch `claude/clever-noether-tta7o2` |
| Sun 25 Oct | Owner chose manual Grok reviews. Review packets RP-001 (Master Plan) and RP-002 (tab clean-up) prepared. | `06-Loop/Review-Packets/` |
| Mon 26 Oct | Owner connected Codex to GitHub and took a paid Grok plan. Claude opened Codex tasks #7 (T-012 segments + Job 1), #8 (T-037 invoice template), #9 (T-003b kos-check). The old template files were added under `reference/old-portal/`. | GitHub issues #7–#9 |
| Mon 26 Oct | Codex delivered PR #10 (T-012, T-037, T-003b). Claude re-ran it: 53/53 tests, build OK, lint unchanged. Probing found 3 real defects in Job 1 (orders lost when mixed with thanks or a question; a stale unclear 'mine' passing its size to a later item; first order with quantity labelled extra). Grok packet RP-003 prepared. | PR #10, R-003 |
| Mon 26 Oct, 08:55 | Grok reviews received: R-001 (plan, CHANGES, 7 findings, all accepted, 1 narrowed) and R-002 (T-039; Claude approves as built, optional note rejected per the owner's words). **Milestones Sun 12 PM, 6 PM and 10 PM were missed and not reported at the time (L-010).** Claude advises that today's 4 PM GO can't be met with a proven portal. | `06-Loop/Reviews/` |
| Mon 26 Oct | Owner: transcription works (seen in the old portal). Use the live video's own Facebook transcript first; the old portal's method is the last resort. T-031 re-scoped. | [[Live-Selling-Business]] B33 |
| Mon 26 Oct | T-031 step 1 built on the branch: an owner/admin-only "Facebook transcript check" in the Replay tab asks Facebook for a live video's own transcript (captions) with the Page token on the server; the token is scrubbed from the reply. Tests 38/38 (new 503/400 checks), build OK, lint 23. Needs a preview deploy for the owner to run it on LINEN SHOP. | branch `claude/clever-noether-tta7o2` |
| Mon 26 Oct | Owner: the first portal used Groq ("Croc") on the downloaded replay and it worked; Antigravity's portal started and ended the live session automatically. Verified: that detection is still in the code but runs only while the portal is open (every 30 s from the browser). | [[Live-Selling-Business]] |
