# START HERE (every agent, every time)

Updated: 24 Oct 2026, Claude.

1. **Current project:**
   - The Bangkok Plus Size OOTD live-selling portal (`bangkok-plus-size-ootd-portal.vercel.app`).
   - Goal: production-ready, 95% error-free, 100% of critical scenarios passing, by **Mon 26 Oct, 4:00 PM Manila**.
   - It ships empty (0 data).
2. **Last completed:**
   - Live Selling Business recorded.
   - Truth audit done.
   - KOS seeded.
   - Master Plan drafted.
   All on branch `claude/clever-noether-tta7o2`.
3. **Next:**
   - **Grok:** independent review of [[Master-Plan]] (G3).
   - **Owner:** answer the questions in [[Live-Selling-Business]] §3.
4. **Files to read, in this order:**
   1. [[Live-Selling-Business]] (HARD RULE)
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
   | Antigravity | Builder of the event capture, the Job 2 queue and the UI |
   | Codex | Job 1 pure function, tests, golden harness, CI, migrations |
   | Grok | Independent adversarial reviewer; Meta policy watch |

   The builder never reviews their own work.
7. **Open owner blockers:**
   - Business Q1–Q9.
   - Golden fixture time on Sunday morning.
   - RLS migration approval.
   - `META_APP_SECRET` in Vercel.
   - Branch protection.
