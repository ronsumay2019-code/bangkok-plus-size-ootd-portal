# START HERE (every agent, every time)

Updated: 25 Oct 2026, Claude.

1. **Current project:**
   - The Bangkok Plus Size OOTD live-selling portal (`bangkok-plus-size-ootd-portal.vercel.app`).
   - **Tonight (Mon 26 Oct), live at 7–8 PM Manila:** the capture release (see [[Master-Plan]] → Tonight release). The full automatic portal follows after the trial lives.
   - It ships empty (0 data).
2. **Last completed (25 Oct):**
   - The owner's answers and the "follow the host" strategy are recorded in [[Live-Selling-Business]] (B1–B21, S1–S8).
   - Master Plan v3 is written (host events first; one reconciliation agent after the live; Replay section; automatic Live Session section).
   All on branch `claude/clever-noether-tta7o2`.
3. **Next:**
   - **T-031** (top priority): automatic host capture from the replay (download, transcribe, extract), tested on LINEN SHOP.
   - **T-032:** automatic detection of when a live starts and ends.
   - **Grok:** independent review of [[Master-Plan]].
3b. **Every request starts as a query:** Reuse, Extend, Fork or New? Answer it from [[Releases]] using [[Reuse-Loop]], and write the answer in the ticket.
3c. **What works today is answered only from [[Current-State]]** (a hook, `.claude/settings.json` → `scripts/kos-context.sh`, puts Current-State, the open loops and the open known issues in front of every message to Claude) (Working / Built / Failed / Not built, each with evidence). If reality contradicts it, change the line to Failed the same day and fix the system.
4. **Files to read, in this order:**
   1. [[Live-Selling-Business]] (HARD RULE)
   1b. [[Meta-Compliance]] (HARD RULE)
   1c. [[Reuse-Loop]] (HARD RULE) and [[Releases]]
   2. [[Open-Loop]] (nothing left unanswered)
   3. [[Lessons]]
   4. [[Current-State]]
   5. [[Known-Issues]]
   6. [[Master-Plan]]
   7. `KOS-MASTER-PLAN-PROMPT.md`
   8. your ticket in `05-Work/Tickets/`
5. **Do not touch:**
   - secrets (names only, in [[Env-Var-Names]]);
   - the `portal_backup` schema;
   - `main` (no direct push);
   - production data (no deletes without the owner and a fresh backup);
   - sent invoices;
   - the old Vercel project `bangkokplussizeootd`;
   - the Live Selling Business (owner only).
6. **Model routing:**

   | Agent | Role |
   |---|---|
   | Claude | Lead, evaluator, KOS keeper, story |
   | Antigravity | Builder of the Replay and Live Session sections, the Job 2 reconciliation and the UI |
   | Codex | Host-capture pipeline (T-031), segments and Job 1, tests, golden harness, CI, migrations |
   | Grok | Independent adversarial reviewer, manual: Claude prepares a review packet in `06-Loop/Review-Packets/`, the owner runs it in Grok chat and pastes the answer back |

   The builder never reviews their own work.
7. **Open owner blockers:** see [[Open-Loop]]:
   - transcription key and cost approval;
   - Meta webhook check;
   - RLS migration approval;
   - `META_APP_SECRET`;
   - branch protection;
   - Vercel permissions;
   - Grok review.
