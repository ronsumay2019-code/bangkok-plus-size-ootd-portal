# R-001 · Claude's evaluator verdict on Grok's Master Plan review (26 Oct, 08:55 Manila)

**Verdict on the plan: CHANGES. Grok is right on all 7 findings. Two need a correction or a narrower fix (marked below).** The changes are made in [[Master-Plan]] the same day.

| # | Grok finding | Claude's call | Reasoning | Change |
|---|---|---|---|---|
| 1 | **Critical:** automatic host capture is unproven, with no timed run and no fallback | **Accept.** One correction to Grok's example. | Host capture is the foundation (S1), so if it fails nothing downstream is right. **Correction:** "LINEN SHOP ran ~8 hours (05:35Z–13:34Z)" isn't the broadcast length. 13:34Z is when Start fresh closed the portal's live record. The real broadcast length is unknown, and T-031 must measure it. Our Current-State wording invited the misread, and it is fixed. | T-031 is a **hard gate**: a timed run on the **longest** available replay before any other W2 work counts as done. The owner must approve the fallback *before* the result is in (§5 of the plan). |
| 2 | **High:** Messenger matching is undefined, and Page replies may not be stored | **Accept.** | The portal **does** already store the Page's own replies (`messenger_messages` has sender `page_agent`; 16 invoice-like ones on 23 Oct, SQL). But the matching rule was never written, and an unwritten rule means double counting. | T-013 now specifies one matching function, with tests: same buyer name + Messenger message during the live + (code match, or change/swap words) + a Page reply that acknowledges it means the existing order is adjusted. Anything ambiguous goes to unclear and is never merged. |
| 3 | **High:** security before go-live | **Accept** (it was already never-cut; now it's an explicit GO gate). | The anon key isn't in the client bundle (verified 24 Oct), which lowers the chance of abuse. But "lower" isn't "safe". | **No GO, and no production writes, until T-005 is done** and a check proves anonymous access is refused and the token lives only in env. |
| 4 | **High:** the evidence card may show stale proof | **Accept.** | The owner named this exact failure (25 Oct: "capturing… not the latest one"). | The card is built **only from the final capture**. The golden test fails if any confirmed order lacks a complete, time-consistent proof pack. |
| 5 | **Medium:** store-match drill-down | **Accept the goal; the fix is narrowed.** | Per-code "divergence" can't be computed: the store owner gives **one total only** (S8). | When totals differ, the portal lists the **riskiest orders first**: unclear, changed, extra pieces, Messenger-only. Those are where count errors come from. One tap each to the evidence. |
| 6 | **Medium:** live start and end detection | **Accept.** | A late "end" would put pre-orders on the live invoice (B31). | T-032: dual detection (webhook + video status) and one **"live window closed" time**. Anything after it is a pre-order. |
| 7 | **Medium:** the Monday deadline is structurally at risk | **Accept. It is already decided by the facts.** | See below. | Owner decision needed: OL-32. |

## The deadline, stated plainly (26 Oct, 08:55 Manila; GO was due 16:00)
- **Missed and not reported at the time:**
  - Sun 12 PM (database lock-down approval and branch protection);
  - Sun 6 PM (golden fixture);
  - Sun 10 PM (core built through review).

  That breaks the plan's own rule ("say so at the first missed milestone"), and is logged as **L-010**.
- **Facts:**
  - T-031 (host capture) **hasn't started**; it needs a transcription key.
  - The order finder (PR #10) has 3 open defects (R-003).
  - The invoice generator, review pages and Live/Replay sections aren't built.
  - The security lock-down isn't approved.
- **Honest conclusion: the automatic portal can't be production-ready by 16:00 today.** Shipping it would break the owner's own rule ("I don't want to hear issues upon deployment").
- **Recommendation:** set a **new GO date once T-031 has a timed result**, with milestones that are reported the moment they slip. The trial weeks (B30) mean the team keeps its usual way meanwhile, so a later date costs the business no lost orders.
