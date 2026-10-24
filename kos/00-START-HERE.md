# START HERE (every agent, every time)

Updated: 24 Oct 2026, Claude.

1. **Current project:**
   - The Bangkok Plus Size OOTD live-selling portal (`bangkok-plus-size-ootd-portal.vercel.app`).
   - Goal: production-ready, 95% error-free, 100% of critical scenarios passing, by **Mon 26 Oct, 4:00 PM Manila**.
   - It ships empty (0 data).
2. **Last completed:**
   - Live Selling Bible recorded.
   - Truth audit done.
   - KOS seeded.
   - Master Plan drafted.
   All on branch `claude/clever-noether-tta7o2`.
3. **Next:**
   - **Grok:** independent review of [[Master-Plan]] (G3).
   - **Owner:** answer the questions in [[Live-Selling-Bible]] §3.
4. **Files to read, in this order:**
   1. [[Live-Selling-Bible]] (HARD RULE)
   2. [[Lessons]]
   3. [[Current-State]]
   4. [[Known-Issues]]
   5. [[Master-Plan]]
   6. `KOS-MASTER-PLAN-PROMPT.md`
   7. your ticket in `05-Work/Tickets/`
5. **Do not touch:**
   - secrets (names only, in [[Env-Var-Names]]);
   - the `portal_backup` schema;
   - `main` (no direct push);
   - production data (no deletes without the owner and a fresh backup);
   - sent invoices;
   - the old Vercel project `bangkokplussizeootd`;
   - the Bible (owner only).
6. **Model routing:**

   | Agent | Role |
   |---|---|
   | Claude | Lead, evaluator, KOS keeper, story |
   | Antigravity | Builder of the event capture, the Job 2 queue and the UI |
   | Codex | Job 1 pure function, tests, golden harness, CI, migrations |
   | Grok | Independent adversarial reviewer; Meta policy watch |

   The builder never reviews their own work.
7. **Open owner blockers:**
   - Bible Q1–Q9.
   - Golden fixture time on Sunday morning.
   - RLS migration approval.
   - `META_APP_SECRET` in Vercel.
   - Branch protection.
