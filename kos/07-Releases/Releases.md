# Releases (what we can reuse)

Rules: [[Reuse-Loop]]. Only **Production-ready** entries may be reused or run on autopilot.

| Entry | Version | Status | Business | Story covered | Evidence |
|---|---|---|---|---|---|
| Facebook Live Selling: host item → order → invoice → shipped | 0.1 | **Draft** | Bangkok Plus Size OOTD | Comment capture only. Not yet: host item calls, Job 1/Job 2, invoice, payment, shipping | 26 Oct live: acceptance tests 1, 3, 4, 5 failed (OL-60); 113 database lines unverified (OL-59) |

## Acceptance tests: Facebook Live Selling (OL-60)

At a real live, with no person and no agent touching it:

1. The live session turns on and off by itself.
2. Every comment is kept exactly as written.
3. The host's item calls (code, price, size, colour) are captured from the host's words.
4. Orders are found inside each host event (Job 1) and reviewed across chat and Messenger (Job 2).
5. The portal makes its own match report against Facebook's comments.

Then, for Production-ready: the invoice, payment and shipping steps run on real orders, and the story is documented end to end.
