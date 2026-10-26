# R-001 · Grok's review of the Master Plan (RP-001), received 26 Oct 2026, verbatim

1. Verdict: CHANGES NEEDED
2. Findings (most serious first)

Severity: Critical
Where: T-031, §2 step 1 / Host Event capture, Risks §6, B17/B19/B24, schedule critical path
What is wrong: Automatic host-first capture (the non-negotiable foundation of S1–S5 and B3) is entirely dependent on a post-live replay download + Whisper large-v3 transcription that has not been proven on a real Bangkok Plus Size live, has unknown wall-clock time, and has no defined fallback that still obeys "no people during the live / follow the host." The 1-hour readiness target is unrealistic for typical lives.
Concrete example: The documented LINEN SHOP live ran ~8 hours (05:35Z–13:34Z). Even on a paid Whisper tier, download + ffmpeg cut + transcription + clock alignment + event extraction can easily exceed 45–90 minutes. By the time ItemEvents exist, the team has already left the store or the store-match window has closed. If the transcript misses or garbles a code/price/size/colour (Taglish, background noise, overlapping speech), every subsequent Job 1/Job 2 match for that code is wrong or missing, and the portal is following buyers or guessing instead of the host.
Fix: Make T-031 a hard gate with a timed run on the longest available replay before any other W2 work. Require an explicit owner-approved fallback (e.g., paid tier with measured cost, or a post-live "host event confirmation" queue that is still derived only from the transcript, never from chat). Do not treat "report options" as sufficient for Monday.

Severity: High
Where: §2 steps 2 & 5 (Job 1 / Job 2), B7, B29, B25, Screens §3–5
What is wrong: Messenger orders and adjustments during the live are declared "live orders / same order adjusted," but the plan never specifies the deterministic matching rules, does not explicitly require capture of the shop's own Page replies, and relies only on Facebook display name. This can produce double-counting, missed adjustments, or orders on the wrong invoice type.
Concrete example: Buyer posts "mine T7 red" in live chat. Ten minutes later in Messenger the buyer writes "change to blue 2XL" and the Page replies "noted po." If outgoing Page messages are not stored, or if the matcher treats the Messenger message as a new capture because the code is not repeated, the system emits two orders (or an un-granted change). The live invoice then contains the original red instead of the blue, or the buyer is invoiced twice. Same-name collisions (explicitly listed as a residual risk) make it worse.
Fix: Define and unit-test a single matching function: same buyer name + overlapping time window + (code match OR explicit change/swap language) + Page reply presence = adjustment of the existing capture, not a new order. Capture both inbound and outbound Messenger messages. Surface any ambiguous link as "unclear" for the invoice-time human, never auto-merge.

Severity: High
Where: KI-004, KI-005, T-005, T-030 (0-data launch)
What is wrong: The current temp_dev_all RLS policy and Page token in portal_kv remain in place until an owner-approved migration. A 0-data wipe does not make the database safe; any subsequent live data is fully readable/writable by anyone who obtains the anon key.
Concrete example: After T-030 wipe and "GO," the first live's comments, Messenger threads, and evidence screenshots land in the tables. An attacker who previously scraped the anon key (or finds it in an old client bundle) reads every buyer name, order, and token, or injects fake orders.
Fix: Block any production write and the GO decision until T-005 has run, RLS is verified to deny anon access, the token is only in env, and a post-migration security check passes. Treat this as non-cuttable.

Severity: High
Where: B23, Screens §5 (Evidence card), §2 step 6
What is wrong: The evidence requirement is stated, but the plan does not guarantee that the card always reflects the latest granted state rather than an intermediate capture, nor does it handle clock skew or Messenger-only orders cleanly. An order can be marked confirmed while the displayed proof is stale or incomplete.
Concrete example: A chat "mine T7" is later changed via Messenger to a different size. The story stores both, but the evidence card renders the video frame and comment from the first capture. The invoice-time reviewer sees the wrong proof, approves the original, and the bag is packed incorrectly.
Fix: Make the evidence card a pure function of the final capture only (final message/comment + its exact timestamp + aligned replay frame + host transcript line at that instant + full prior story collapsed). Add an automated check that fails the golden test if any confirmed order lacks a complete, timestamp-consistent proof pack.

Severity: Medium
Where: S8 / store match, §2 step 8, B24
What is wrong: The store match only compares total item counts and then dumps per-code lists. It does not automatically surface which specific orders are extra or missing relative to the store owner's tally, so the "difference is found before leaving the store" step remains manual and error-prone under time pressure.
Concrete example: Portal total = 142, store total = 140. The UI shows the two numbers and a long per-code list. The team must manually cross-check every line while packing; they miss the two extras, leave the store, and the discrepancy is only discovered at home.
Fix: When totals differ, automatically highlight the codes whose portal counts diverge most and list the individual order lines (with evidence links) for those codes only. Keep the total-only rule, but make the drill-down one-click.

Severity: Medium
Where: T-032, B31, segments, schedule
What is wrong: Live start/end detection is a spike. Any miss reclassifies orders between Live invoice and Pre-order invoice or assigns them to the wrong event window.
Concrete example: Webhook for live end is delayed. A buyer messages "I want the linen set I saw" 20 minutes after the actual end. It is treated as a live order instead of a pre-order, appears on the live invoice, and the amounts no longer match the shop's two-invoice template.
Fix: Dual detection (webhook + video status poll) plus a clear "live window closed" timestamp that is used for all classification. Any message outside that window is forced to the Pre-orders tab.

Severity: Medium
Where: Schedule, critical-path table, Risks
What is wrong: The Monday 16:00 Manila deadline is already structurally at risk. T-031 (unknown outcome) blocks host capture; T-002 needs owner confirmation of a possibly incomplete invoice list; T-005 needs owner migration approval; multiple agents must be handed the repo. The plan's own "if Q1–Q9 late then NO-GO" logic applies equally to T-031.
Concrete example: T-031 report arrives Monday morning saying "transcript usable but processing 95 minutes." There is no remaining time to implement, test, and run the golden fixture before 16:00.
Fix: Explicitly list the true critical path (T-031 → host-event model → Job 1/2 → golden → T-005) and pre-agree a reduced Monday scope (e.g., one live only, manual host-event confirmation queue) if the spike misses its time or quality bar.

3. What you tried to break and could not
- Host-first sequencing inside the written design (steps 1 → 3 → 4). Segments are correctly described as a search filter, not an order window (S6/A2).
- The "latest granted change wins, earlier kept in story" rule and the "never guess, show unclear at invoice time" rule (B18/S4/S7).
- Separation of Live vs Pre-order invoices and the "amounts add up" statement (B31).
- Explicit rejection of the rack/inventory/90 % buying-list model (B1/B12).
- The requirement that no order is confirmed without an evidence pack (B23).
- The 0-data launch intent and the statement that paper lists are not source of truth (B26).

4. Questions for the owner
None. The business rules as written are clear enough for the findings above; the gaps are in the plan's ability to implement them safely and on the stated timeline.
