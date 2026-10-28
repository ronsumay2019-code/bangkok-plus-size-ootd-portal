# Releases (what we can reuse)

Rules: [[Reuse-Loop]]. Only **Production-ready** entries may be reused or run on autopilot.

| Entry | Version | Status | Business | Story covered | Evidence |
|---|---|---|---|---|---|
| Facebook Live Selling: host item → order → invoice → shipped | 0.1 | **Draft** | Bangkok Plus Size OOTD | Comment capture only. Not yet: host item calls, Job 1/Job 2, invoice, payment, shipping | 26 Oct live: acceptance tests 1, 3, 4, 5 failed (OL-60); 113 database lines unverified (OL-59). **27 Oct live: test 1 failed again** (fix was still on the branch; comments dropped ~16:58–17:14 Manila). **0.2 merged to production 27 Oct 17:23** (PR #11: automatic start/end, every comment kept, match report, Messenger 24h guard); 67 tests pass; not yet proven at a live. **28 Oct live: failed: database exhausted by a full reload on every request (KI-018); fix built (70 tests pass), not in production** |

## Acceptance tests: Facebook Live Selling (OL-60)

At a real live, with no person and no agent touching it:

1. The live session turns on and off by itself. *(26 Oct: built on the work branch, automatic test passes and fails on the old code. 27 Oct: failed at the live because it was never merged; **merged to production 27 Oct 17:23 (PR #11)**. Not yet proven: passes only when a real live starts and ends by itself.)*
2. Every comment is kept exactly as written. *(In production since 27 Oct 17:23 (PR #11); proven when tonight's comments appear in `raw_comments`.)*
3. The host's item calls (code, price, size, colour) are captured from the host's words.
4. Orders are found inside each host event (Job 1) and reviewed across chat and Messenger (Job 2).
5. The portal makes its own match report against Facebook's comments. *(26 Oct: built on the work branch: Replay tab → "Check orders against Facebook"; automatic test passes; in production since 27 Oct 17:23 (PR #11). 27 Oct: now runs by itself once after each live and fills missing comments and orders from Facebook's own list (27 Oct live: 99 of 138 had arrived).)*

Then, for Production-ready: the invoice, payment and shipping steps run on real orders, and the story is documented end to end.
