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
| OL-07 | Obsidian connection (browser, MCP, links, file?) | Owner, 24 Oct | **Done** (auto-pull interval **waiting on owner**) | The vault `kos` opened; Git plugin installed; *Git: Pull* returned "Everything is up-to-date" (owner, 24 Oct). Still to do: Settings → search "interval" → Auto pull interval 5. |
| OL-08 | Live Selling Business questions Q1–Q9 | Claude, 24 Oct | **Answered** 25 Oct (voice notes) | Verbatim in [[Live-Selling-Business]] §3; rules B5–B7 updated, B9–B15 added |
| OL-09 | Golden fixture for one past live | Claude, 24 Oct | **Waiting on owner** | Now OL-25 (sent invoices plus the store owner's total) |
| OL-10 | Approve the RLS lockdown migration (KI-004, KI-005) | Claude, 24 Oct | **Waiting on owner** | Approval of the migration in Supabase |
| OL-11 | `META_APP_SECRET` in Vercel (KI-008) | Claude, 24 Oct | **Waiting on owner** | Enter it in Vercel → Environment Variables (never in chat) |
| OL-12 | Branch protection on `main` | Claude, 24 Oct | **Waiting on owner** | Allow it on GitHub (T-003) |
| OL-13 | Vercel listing refused (403) (KI-012) | Claude, 24 Oct | **Waiting on owner** | Check the connected Vercel account's team permissions |
| OL-14 | Grok independent review of the Master Plan (G3) | Claude, 24 Oct | **Waiting on owner**: packet ready | Owner chose manual reviews (25 Oct). Packets: `06-Loop/Review-Packets/RP-001-master-plan.md` and `RP-002-T-039-tabs.md`. The owner pastes Grok's answer back; Claude saves it to `06-Loop/Reviews/` and responds. |
| OL-15 | Logins for the platforms | Owner, 24 Oct | **Answered** | Noted. They go into each platform's own settings, never chat or the vault. |
| OL-16 | Main repo docs conflict with the Live Selling Business (KI-010) | Claude, 24 Oct | **Answered** 25 Oct | A8: a buying list never exists. The rack, run sheet, inventory board and 90% rule don't apply to live selling. The Live Selling Business wins. |
| OL-17 | **First milestone missed:** "Sat 24 Oct, 11 PM Manila: plan reviewed by Grok, owner has the questions" | Claude, Sun 25 Oct 04:44 Manila | **Waiting on owner** | Done by then: G0 and the Master Plan draft. Not done: the Grok review (OL-14) and the Q1–Q9 answers (OL-08). Re-plan in [[Master-Plan]] §4. |
| OL-18 | Follow-ups: rule B5 reading, price source, who uses the portal during the live | Claude, 25 Oct | **1 and 2 answered** by the owner's "follow the host" note; **3 replaced by OL-19** | [[Live-Selling-Business]] §4: an event is where the agent looks, and price comes from the host |
| OL-19 | When is the host captured: replay, admin during the live, or both? | Claude, 25 Oct | **Answered** 25 Oct | B17: automatically, no people during the live. Feasibility test T-031. |
| OL-20 | Approve the replay transcription test (T-031) | Claude, 25 Oct | **Waiting on owner** | The old procedure used Groq Whisper's free plan. Whether it is still free must be checked; if any cost applies, the exact amount comes before anything runs. Needs a transcription API key entered in settings (never in chat). |
| OL-21 | Store match: total count only, or item by item? | Claude, 25 Oct | **Answered** 25 Oct | Total count only (S8) |
| OL-22 | Webhook subscriptions in Meta (feed, live_videos, messages) for automatic live start and end (T-032) | Claude, 25 Oct | **Waiting on owner** | Owner checks Meta for Developers → Webhooks → Page, or grants an agent access |
| OL-23 | A photo of the paper order list for LINEN SHOP | Claude, 25 Oct | **Withdrawn** 25 Oct | The paper list is a personal scratch note (B26). Replaced by OL-25. |
| OL-25 | Golden reference: use the invoices actually sent for NEW SHOP (22 Oct) plus the store owner's total? | Claude, 25 Oct | **Answered** 25 Oct: invoices are sent inside Messenger "with no issue". Claude pulls all NEW SHOP chats from 22–23 Oct when T-002 starts. | The portal's Messenger copy holds 16 invoice-like Page messages to 15 buyers on 23 Oct (SQL). It may be incomplete; the owner confirms whether every NEW SHOP invoice was sent through Messenger. |
| OL-24 | Evidence card: is the replay frame plus the comment data enough? | Claude, 25 Oct | **Answered** 25 Oct | Approved ("I really like it"); [[Screens]] |
| OL-26 | Invoice delivery: text or picture; long invoices | Claude, 25 Oct | **Answered** 25 Oct | Picture in the shop's template (B27), one line per item with quantity (B28), bag photo only |
| OL-27 | Review pages and invoice generator layout | Owner, 25 Oct | **Answered** 25 Oct | Approved direction in [[Screens]]; no reason field on edits |
| OL-28 | Simple tab names, and which old features to hide or remove | Owner, 25 Oct | **Answered** 25 Oct | 7 tabs; Pre-orders and Messages kept; Analytics, Pola, Strategic and the rack board removed; owner override is a tick box with no reason. [[Screens]], B31–B32 |
| OL-29 | How the AI team connects | Owner, 25 Oct | **Answered** 25 Oct | The repo is the shared workspace. Codex connects to GitHub; Antigravity works in the local clone; Grok reviews manually from packets Claude prepares (the owner has a paid Grok subscription since 26 Oct; chat, not API). |
| OL-30 | Codex connected to GitHub (owner, 26 Oct). First tasks: issues #7 (T-012), #8 (T-037), #9 (T-003b) | Owner/Claude, 26 Oct | **Waiting on owner** to start each in Codex (base branch `claude/clever-noether-tta7o2`) | Codex PRs go into the work branch, then a Grok packet, then Claude's verdict |
