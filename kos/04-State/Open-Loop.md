# Open Loop: nothing left unanswered (HARD RULE, owner, 24 Oct)

**Rule.** No question, request or task is left unanswered or untouched, here or on any platform in this build, before moving to the next topic. That covers chat, GitHub PRs, issues and review comments, Vercel, Supabase, Meta, and the agents' own sessions.

How the rule works:
- Every item gets a row, with one of these statuses:
  - **Answered** (the answer is linked);
  - **Done** (the evidence is linked);
  - **Waiting on [person]** (what exactly is needed, and since when);
  - **Parked by owner** (only the owner can park an item).
- A topic is closed only when all of its rows are Answered, Done or Parked.
- Every agent's Handoff Packet lists the Open-Loop rows it opened or closed.
- The lead (Claude) checks this ledger at every gate and at the start of every reply.

Platform sweep, 24 Oct (Claude):
- GitHub: **0** open PRs and **0** open issues (API listing).
- Vercel: could not be checked (403).

| # | Item | Raised | Status | Answer / evidence / what's needed |
|---|---|---|---|---|
| OL-01 | Restore the 152 NEW SHOP orders, pause, or both? | Owner, 24 Oct | **Answered** | Production ships fresh with 0 data. NEW SHOP data is used only as test material on the preview. |
| OL-02 | "How many orders have been reconciled for approval?" | Owner, 24 Oct | **Answered** | 1 order is in the production database (SQL, 24 Oct). No reconciliation is possible until W2 exists. |
| OL-03 | LINEN SHOP orders missing after Start fresh | Owner, 24 Oct | **Answered**, not fixed | Root cause: Facebook hides names and `seenCommentIds` was stale. Fix is W1 (T-010). Production ships with 0 data. |
| OL-04 | Official release PDF for the owner | Owner, 24 Oct | **Withdrawn** | It overstated readiness (L-004). It will be replaced by the gate G7 release note. It was never sent. |
| OL-05 | What makes this portal hard; ranking among builds | Owner, 24 Oct | **Answered** | In chat, 24 Oct; summarised in [[Story]] chapter 1 |
| OL-06 | Where Codex fits; team of Claude, Antigravity, Grok | Owner, 24 Oct | **Answered** | [[Master-Plan]] and `00-START-HERE` model routing |
| OL-07 | Obsidian connection (browser, MCP, links, file?) | Owner, 24 Oct | **Answered**; setup **Waiting on owner** | Git plus the Obsidian Git plugin. Steps given in chat. Next: the owner confirms the vault opens and auto-pulls. |
| OL-08 | Live Selling Business questions Q1–Q9 | Claude, 24 Oct | **Waiting on owner** | [[Live-Selling-Business]] §3 |
| OL-09 | Golden fixture: Item Events plus the confirmed final order list for one past live | Claude, 24 Oct | **Waiting on owner/staff** | Needed by Sun 12 PM. Claude prepares the sheet. |
| OL-10 | Approve the RLS lockdown migration (KI-004, KI-005) | Claude, 24 Oct | **Waiting on owner** | Approval of the migration in Supabase |
| OL-11 | `META_APP_SECRET` in Vercel (KI-008) | Claude, 24 Oct | **Waiting on owner** | Enter it in Vercel → Environment Variables (never in chat) |
| OL-12 | Branch protection on `main` | Claude, 24 Oct | **Waiting on owner** | Allow it on GitHub (T-003) |
| OL-13 | Vercel listing refused (403) (KI-012) | Claude, 24 Oct | **Waiting on owner** | Check the connected Vercel account's team permissions |
| OL-14 | Grok independent review of the Master Plan (G3) | Claude, 24 Oct | **Waiting on owner** | Claude can't reach Grok, Antigravity or Codex from this session. The owner gives Grok the repo or the plan file, and Grok's report is saved to `06-Loop/Reviews/`. |
| OL-15 | Logins for the platforms | Owner, 24 Oct | **Answered** | Noted. They go into each platform's own settings, never chat or the vault. |
| OL-16 | Main repo docs conflict with the Live Selling Business (KI-010) | Claude, 24 Oct | **Waiting on owner** (Q8) | — |
