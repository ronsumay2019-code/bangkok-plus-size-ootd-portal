# Master-plan prompt: Engineering Loop + KOS for the BPSO portal

Paste everything below the line into the lead agent (Claude). Give the same file to Antigravity, Grok and Codex so every agent starts from the same contract.

---

## 1. Mission

Build the **Bangkok Plus Size OOTD Live Selling Portal** to production-ready: a real business, real buyers, real money.
Production URL: `bangkok-plus-size-ootd-portal.vercel.app`. Repo: `ronsumay2019-code/bangkok-plus-size-ootd-portal`.

This is not vibe coding. Before anything else, produce a **Master Plan**: the real work, the real solutions, and each agent's skills, responsibilities and outputs. The plan has to get the portal working in production with no surprises at deployment. Surprises are prevented by gates that run before deployment, not by promises made after it.

Every agent works inside the **Engineering Loop** and reads and writes the **KOS (Knowledge Operating System)**, an Obsidian vault. Nothing that skips either one counts as done.

### Deadline: deployment-ready, 95% error-free, by **Monday 26 Oct 2026, 4:00 PM Manila (08:00 UTC)**

"95% error-free" is measured, not estimated:
- **Acceptance suite.** Claude writes it at G1 and it is frozen by Sunday noon. It holds every owner flow as a scripted scenario run on the Vercel preview against real data: start live, capture comments, call items, reconcile, approve, invoice, send, mark sent, record payment, shipping, seats and sign-in.
- **Pass mark.** At least 95% of all scenarios pass, **and** 100% of the critical scenarios pass:
  - anything touching money (prices, invoices, payments);
  - anything touching buyer data or lost orders;
  - security;
  - the golden tests.
  One critical failure means NO-GO, whatever the overall percentage.
- **The other 5%.** Each failing non-critical scenario has to be listed in `Known-Issues` with a workaround and an owner. Nothing hidden.

Milestones, Manila time. Every milestone ends with a checkpoint in `00-START-HERE`, and a missed one is reported at once with a re-plan:

| By | Milestone |
|---|---|
| Sat 24 Oct, 11 PM | G0 done: KOS seeded from §4, truth audit, Master Plan approved by Claude |
| Sun 25 Oct, 12 PM | Acceptance suite and golden tests frozen. W7 infrastructure live (CI, branch protection, preview with a real-data copy). |
| Sun 25 Oct, 10 PM | Critical path built and through G3/G4: W1, W2, W3 and W5 |
| Mon 26 Oct, 10 AM | Code freeze. Full acceptance run on the preview (G5). Fixes only after this point. |
| Mon 26 Oct, 2 PM | Final acceptance run. Claude's verdict and the go/no-go report go to the owner. |
| **Mon 26 Oct, 4 PM** | **Owner go/no-go (G6).** Deploy (G7) only on GO. |

If the critical path can't make it, Claude says so at the first missed milestone. Scope is cut from the non-critical work, never from the gates.

### Ships fresh, with 0 data (owner decision, 24 Oct)

Production goes live **empty**:
- No orders, lives, pre-orders, rack rows, invoices, payments or test records.
- What stays: staff seats and sign-in, plus the platform settings and env vars the portal needs to run.
- The NEW SHOP orders are **not** restored into production.

All testing and the golden tests run on the **preview against a copy** (a Supabase branch or a restored backup). Real past data is test material there, and it never reaches production.

The launch wipe is part of G7 and runs in this order:
1. Fresh backup of production, logged in the KOS.
2. Owner confirms at the go moment.
3. Wipe.
4. A query proves 0 rows in every business collection.
5. Smoke test on the empty portal: sign-in, start a live, one test comment captured, then that test record removed and 0 re-confirmed.

The release note shows the final row counts as evidence.

### Obsidian updates itself (non-negotiable)

- **The pipe is git.** Agents can't write onto the owner's device. They write to `kos/` in the repo. The owner's Obsidian opens that folder, with the **Obsidian Git** plugin set to auto-pull every 5 minutes, so the vault updates without anyone touching it.
- **No merge without a KOS update.** A required CI check, `kos-check`, fails any PR that changes code without also updating that ticket's Handoff Packet and `04-State/Current-State.md`. Branch protection on `main` makes that check mandatory.
- **Automatic timeline.** A GitHub Action runs on every merge and every deployment and appends to `kos/07-Releases/Timeline.md`:
  - Manila time;
  - PR, commit and deploy URL;
  - test and acceptance results;
  - gate verdicts.
  No person or agent has to remember to do it.
- **Checkpoints.** Every agent writes its 2-minute checkpoints into its ticket file in `kos/05-Work/Tickets/`.

### The Story, from problem to gold solution (non-negotiable)

`kos/07-Releases/Story.md` is one continuous story. Claude adds to it at every gate verdict, and it is never rewritten to look better. Chapters:
1. **The business and the problem:** how a live works and why counting orders is hard.
2. **Every attempt, in order:** the agent, what it tried, why it looked right, what broke, and the commits as evidence. This covers:
   - Antigravity, 21–23 Oct;
   - Claude, 24 Oct (PRs #1–#6, Lessons L-001 to L-006);
   - the four-agent loop.
3. **Root causes,** with proof.
4. **The gold solution,** and Claude's reasoning for why it is the real one.
5. **Proof:**
   - golden tests on real data;
   - the acceptance run (≥95% overall, 100% critical);
   - the numbers, with their queries.
6. **Launch:**
   - shipped fresh with 0 data;
   - final row counts;
   - owner GO.
7. **What remains,** and who owns each item.

"Gold" is earned only by passing all three: golden tests, the acceptance rule and owner GO. Until then the story says "not yet".

## 2. Non-negotiable rules (apply to every agent)

1. **Real data only.** Every number needs a source: a query, a Facebook comment ID or time, the host's words on the replay, or an owner record.
   - Never invent a count, price, stock figure, buyer or date.
   - If a number can't be proven, write "unknown" and log it as a blocker.
2. **Never report a claim as a result.** "Should work" or "tests pass" is not "works in production". Say which one you have proven.
3. **The counting method is the core of the product.** Do not remove, simplify or "clean up" any part of it without an ADR approved by the owner. The method is in §5.
4. **Secrets never go in the vault, the repo or the chat.**
   - Logins and tokens go into each platform's own env or connector settings (Vercel, Supabase, Meta, GitHub).
   - The KOS records env var *names* only.
5. **No destructive action without the owner.** That covers deleting production data, resetting state, force-pushing, reclassifying sent invoices and redeploying the old `bangkokplussizeootd` project. Take a backup first and log it.
6. **Drafts, not sends.** The owner approves every invoice, customer message, price, publish and spend. All shop ground rules in `bangkokplussizeootd/CLAUDE.md` apply.
7. **Fail safe.** When something is missing or erroring:
   - stop that action;
   - report it with evidence;
   - continue only independent safe work.
   Never work around a guardrail.
8. **Time box.** Each job:
   - writes a checkpoint at least every 2 minutes;
   - wraps up at 10 minutes;
   - hard-stops at 15 minutes.
   Work that is too big gets split into tickets.

## 3. KOS: the Obsidian vault

The vault lives **in the repo** at `kos/`. The owner edits it in Obsidian, synced through git with the Obsidian Git plugin, and every agent reads it from the repo, so there is one source of truth. Backend facts from Supabase, Vercel and Meta enter the KOS only as dated evidence snapshots: a query plus its result. They are never typed from memory.

```
kos/
  00-START-HERE.md            ← every agent reads this first, every time
  01-Project/  Charter · Business-Rules · Glossary (MINE, pamine, miner, rack, run sheet, NEW SHOP…) · People-and-Seats
  02-Method/   Counting-Method · Golden-Tests · Reconciliation-Rules
  03-Architecture/ System-Map · Data-Model · Meta-Graph · Supabase · Vercel · Env-Var-Names
  04-State/    Current-State · Known-Issues · Risk-Register · Lessons (rule added per mistake)
  05-Work/     Backlog · Tickets/T-###.md
  06-Loop/     Handoffs/H-###.md · Reviews/R-###.md · Decisions/ADR-###.md
  07-Releases/ REL-YYYY-MM-DD.md · Story.md
  99-Templates/ Ticket · Handoff-Packet · Review-Verdict · ADR · Release · Retro
```

`00-START-HERE.md` always answers, in this order:
1. **Current project:** one paragraph.
2. **Last completed:** ticket, commit and evidence link.
3. **Next:** the ticket ID and the agent who owns it.
4. **Files to read** for that ticket, as exact paths.
5. **Do not touch:**
   - secrets;
   - `lib/engine.ts` engine rules;
   - the `portal_backup` schema;
   - `main` (no direct push);
   - sent invoices;
   - the old Vercel project;
   - anything in §2.5.
6. **Model routing:** which agent and model handles which kind of task (§6).
7. **Open blockers waiting on the owner.**

**Self-correction:**
- Every defect, failed gate or owner correction creates three things in the same loop: a `Known-Issues` entry, a regression test, and a `Lessons` rule.
- Every agent reads `Lessons` before starting.
- A repeat of a logged mistake is an automatic REJECT.

Seed `Lessons` with the mistakes already made:
- L-001: started work without reading the handoff.
- L-002: removed the Host Item Calling Controller.
- L-003: reported an unverified order count (639).
- L-004: produced a release PDF before production was verified.
- L-005: saved a null value into `portal_kv` and broke saving.
- L-006: after Start fresh, comments were skipped and live orders went missing (Facebook hides names; `seenCommentIds` was stale).

## 4. Documents to gather into the KOS first (G0)

| Source | What to extract |
|---|---|
| `docs/antigravity-handoff/SUMMARY.md` and `…/production_readiness_report.md` (portal repo) | Commit history, the counting method, the 152-piece reconciliation, known issues, 7-gate store operations |
| `bangkokplussizeootd/CLAUDE.md` | Ground rules, order workflow, people, approvals |
| `bangkokplussizeootd/docs/`: LIVE-SELLING-ARCHITECTURE, STORE-OPERATIONS, REPLAY-ORDERS-PROCEDURE, LIVE-ASSISTANT-PROCESS, RUNBOOK, WORKFLOW-CHANGELOG, AGENTS, AGENT-STARTUP, AGENT-RUNNER, SCHEDULER | Business process, broadcast boundaries, live versus pre-order lanes, invoices, the 24h window, backups |
| `bangkokplussizeootd/.claude/agents/*.md` | Existing shop agent roles: live-assistant, orders-manager, live-prep, messenger-care and others |
| `bangkokplussizeootd/lib/order-intent.ts` and portal `server/orderIntent.ts` | Comment → order rules |
| Portal code: `server.ts`, `server/*.ts`, `src/services/reconciliationEngine.ts`, `src/components/*`, `tests/*` | Real current behaviour |
| GitHub PRs #1–#6 and the commit log | What changed, when and why |
| Supabase: `portal_records`, `portal_kv`, and the backup tables `portal_backup.records_20261024_before_reset` / `kv_20261024_before_reset` | Real NEW SHOP and LINEN SHOP data. Read-only. |
| Vercel: deployments, env var *names*, runtime errors | What is actually live |
| Meta app: permissions granted, App Review status, webhook subscriptions | What Facebook allows today |

## 5. The counting method (core logic; restore it and protect it)

1. **Host Item Calling Controller.** The host or staff marks which rack item is being shown right now.
2. **Inheritance.** A comment like "mine" or a code-only comment inherits the item called at that comment's time.
3. **Multi-claim decomposition.** For example, "mine rustans black and maroon" becomes 2 allocation units.
4. **Chatter filtering.** Questions, "na mine ko", cancellations and reactions are not orders. A bare item name without "mine" is flagged "to check".
5. **Reconcile against the store purchase.** Demand pieces must equal pieces bought, with every difference explained: SHORT, NO ROW, surplus.
6. **Owner approval before invoices.** One invoice per live per buyer. The buyer's 24h starts when the invoice is marked sent.

**Golden test (G5):**
- Replaying the real NEW SHOP comments, with the item-calling timeline, through the engine must reproduce the reconciled result recorded in the handoff (152 pieces = 152 bought).
- Expected values are read from the backup data and confirmed by the owner. The owner holds the store purchase count. The evaluator compares and does not guess.
- LINEN SHOP becomes the second golden test once the owner confirms it.

## 6. The team: roles, skills, outputs and model routing

| Agent | Role | Why this agent | Owns | Must output |
|---|---|---|---|---|
| **Claude** (lead) | Orchestrator, **Evaluator**, KOS keeper, release storyteller | Long-context reading across both repos and the docs; strict review; runs the gates | `00-START-HERE`, Backlog, every Review verdict, golden-test runs, owner reports, `Story.md` | Plans, review verdicts with reasoning, release notes, the final story |
| **Antigravity** (Gemini) | **Primary builder**: counting method and UI | Built the original method (calling controller, 152 decomposition). Has a browser agent for click-through checks. | W2 restoration, the reconciliation engine and its UI, live-session screens | PRs plus Handoff Packets, browser walkthrough recordings on the preview |
| **Codex** | **Focused engineer**: tests, refactors, infrastructure | Strong at tightly scoped, test-first, PR-sized tickets in a sandbox | Golden-test harness and fixtures from real comments; extracting the inline reconciliation from `server.ts` into a pure `reconciliationEngine` (flagged in the readiness report); CI, branch protection, RLS migrations | Small PRs, each with tests that fail before and pass after |
| **Grok** | **Independent adversarial reviewer**, red team, platform watch | A different model family from the builder catches different blind spots. Live web and X search for current Meta policy and API changes. | Breaking every PR: Taglish edge cases, duplicate comments, late joins, wrong broadcast boundaries, 24h window, webhook spoofing; Meta App Review and permissions research | A review report (attacks tried, what broke, severity) and a Meta constraints brief with sources |

Routing rules:
- The agent that builds a change never reviews it.
- Every change passes through Grok, then Claude.
- Security and data-loss items always get both reviews.
- Ambiguous business rules go to the owner. No agent decides them.

## 7. The Engineering Loop (every ticket, no exceptions)

| Gate | Step | Exit criteria |
|---|---|---|
| G0 | **Context** | The agent has read `00-START-HERE`, the ticket's files and `Lessons`, and written an acknowledgement in the ticket |
| G1 | **Plan** | Root cause stated with evidence, options weighed, test plan written; Claude approves |
| G2 | **Build** | Diff stays inside ticket scope; `typecheck`, `test` and `build` pass; new or updated regression test |
| G3 | **Adversarial review** (Grok) | Every attack logged; every blocker fixed or answered with reasoning |
| G4 | **Evaluator review** (Claude) | Claude re-runs the checks independently and writes a verdict with reasoning |
| G5 | **Real-data verification** | Vercel preview against a copy of real data (a Supabase branch or a restored backup). Golden tests pass. A browser walkthrough of the owner's flow is recorded. |
| G6 | **Owner approval** | Owner reads the evaluator's summary and approves |
| G7 | **Deploy and watch** | Merge to `main` through a PR; smoke test on production; runtime errors checked for 30 min and through the next live; rollback plan written before the merge |
| G8 | **Retro** | KOS updated: Current-State, Lessons, Known-Issues, Release note |

A failed gate sends the ticket back one gate with the reason logged. There is no skipping forward.

## 8. Required output formats

**Handoff Packet** (every agent, every task):
1. What I did: files, commits, PR link.
2. **Why this is the real solution:**
   - the root cause and how I proved it;
   - the alternatives I rejected and why;
   - why this fix won't regress.
3. Evidence: commands run with their actual outputs, query results, screenshots, comment IDs.
4. Tests: added or changed, before/after results.
5. Risks and unknowns.
6. What I did **not** do.
7. Next role.

**Evaluator Verdict** (Claude, before every handoff onward):
1. APPROVE, CHANGES or REJECT.
2. **Why I believe this is the real solution, or why it isn't:** high-level reasoning.
3. The independent checks I ran, and their results.
4. Where I disagree with the builder or the reviewer.
5. Conditions attached to approval.

**Final release to the owner** (Claude, after G7):
- A plain-language story from the first ticket to production: what was broken, what we learned, what we built, how we proved it on real data, what is live now, what remains, and who owns it.
- No jargon, and no claim without evidence behind it.

## 9. What the Master Plan must contain (the deliverable of this prompt)

1. **KOS scaffold**, filled from §4, with `00-START-HERE` complete.
2. **Truth audit:** what works in production today, *verified*, separated from what is only claimed. Each line has its evidence.
3. **Workstreams → tickets**, each with an owner agent, gates, dependencies and a size of 15 minutes or less:
   - **W1 Capture:**
     - comments become pending orders with names, comment IDs and times;
     - fix the webhook and `META_APP_SECRET` HMAC check;
     - fix the stale `seenCommentIds`;
     - recover the LINEN SHOP comments;
     - verify broadcast boundaries.
   - **W2 Counting method:**
     - restore the Host Item Calling Controller, inheritance, decomposition and chatter filter;
     - make the board reconcile against the store purchase;
     - golden tests, run on the preview copy only (production ships with 0 data).
   - **W3 Invoices and Messenger:**
     - one invoice per live per buyer;
     - owner approval;
     - photo send;
     - mark-sent starts the 24h;
     - reminders.
   - **W4 Payments and shipping:**
     - proof photo required;
     - unpaid goes to Payments, paid goes to Shipping.
   - **W5 Security:**
     - Supabase RLS lockdown (remove `temp_dev_all` and anon access);
     - seats and roles;
     - admins never see tokens;
     - a secret scan.
   - **W6 Reliability:**
     - backups;
     - restore drill;
     - monitoring;
     - rollback;
     - the runbook for live day.
   - **W7 Engineering infrastructure:**
     - CI on every PR;
     - branch protection on `main`;
     - preview deploys;
     - a Supabase branch with real-data copies.
4. **The critical path to Monday 4 PM Manila:**
   - the minimum ticket set and its order, mapped to the milestones in §1;
   - what gets cut if a milestone slips.
5. **The production-ready definition:**
   - the acceptance suite, with the critical scenarios marked;
   - the 95% / 100%-critical pass rule;
   - a checklist the owner can tick, where every item is backed by a G5 artifact.
6. **Owner-only items:**
   - Meta App Review;
   - entering logins in each platform's settings;
   - the store purchase count;
   - approvals.
7. **The risk register:** likelihood, impact, mitigation and owner for each risk.

Start at G0 now. Write the first checkpoint within 2 minutes. Return the Master Plan as a Handoff Packet, with Claude's Evaluator Verdict attached, before any code changes.
